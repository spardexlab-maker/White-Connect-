-- Subscriptions and growth numbers (owner request, 27 Oct 2026).
--  1) Each organization (a complex, or an independent clinic/lab/pharmacy) has a
--     plan, an end date and a paid flag. The super admin keeps them up to date.
--  2) Staff see a banner a week before the end, and a red one once it has ended
--     or is unpaid. Nothing is switched off: the owner chose "warn only".
--  3) The super admin sees growth numbers: bookings, new patients, top doctors
--     and the AI assistant's usage with an estimated cost. Counts only — no
--     medical content, no patient names.

create table public.subscriptions (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  plan text not null check (plan in ('trial', 'monthly', 'yearly', 'custom')),
  starts_on date not null,
  ends_on date not null,
  paid boolean not null default false,
  amount_iqd bigint check (amount_iqd >= 0),
  note text check (length(note) <= 300),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
alter table public.subscriptions enable row level security;
revoke all on public.subscriptions from anon, authenticated;

-- days before the end when the reminder starts, and the AI cost estimate (USD per message)
alter table public.platform_settings
  add column if not exists subscription_notice_days int not null default 7 check (subscription_notice_days between 1 and 60),
  add column if not exists ai_cost_per_message_usd numeric(10, 6) not null default 0.0003 check (ai_cost_per_message_usd >= 0);

create or replace function private.baghdad_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Baghdad')::date;
$$;

-- none | active | expiring | expired | unpaid
create or replace function private.subscription_state(s public.subscriptions)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when s.organization_id is null then 'none'
    when s.ends_on < private.baghdad_today() then 'expired'
    when not s.paid and s.plan <> 'trial' then 'unpaid'
    when s.ends_on - private.baghdad_today() < (select subscription_notice_days from public.platform_settings limit 1) then 'expiring'
    else 'active'
  end;
$$;

-- every organization with its subscription, for the super admin page
create or replace function public.admin_subscriptions()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then perform private.fail('forbidden'); end if;
  return jsonb_build_object(
    'today', private.baghdad_today(),
    'notice_days', (select subscription_notice_days from public.platform_settings limit 1),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'organization_id', o.id, 'name', o.name, 'kind', o.kind, 'status', o.status,
               'facilities', (select count(*) from public.facilities f where f.organization_id = o.id),
               'facility_types', (select coalesce(jsonb_agg(distinct f.type), '[]'::jsonb) from public.facilities f where f.organization_id = o.id),
               'plan', s.plan, 'starts_on', s.starts_on, 'ends_on', s.ends_on, 'paid', s.paid,
               'amount_iqd', s.amount_iqd, 'note', s.note, 'updated_at', s.updated_at,
               'days_left', s.ends_on - private.baghdad_today(),
               'state', private.subscription_state(s))
             order by (s.organization_id is null), s.ends_on nulls last, o.name)
      from public.organizations o
      left join public.subscriptions s on s.organization_id = o.id
      where o.status <> 'closed'), '[]'::jsonb));
end;
$$;

create or replace function public.admin_set_subscription(
  p_organization_id uuid,
  p_plan text,
  p_starts_on date,
  p_ends_on date,
  p_paid boolean,
  p_amount_iqd bigint default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_id uuid;
begin
  if not private.is_platform_admin() then perform private.fail('forbidden'); end if;
  select id into org_id from public.organizations where id = p_organization_id;
  if org_id is null then perform private.fail('not_found'); end if;
  if p_plan is null or p_plan not in ('trial', 'monthly', 'yearly', 'custom')
     or p_starts_on is null or p_ends_on is null or p_ends_on < p_starts_on
     or p_amount_iqd < 0 or length(p_note) > 300 then
    perform private.fail('invalid_subscription');
  end if;
  insert into public.subscriptions (organization_id, plan, starts_on, ends_on, paid, amount_iqd, note, updated_by, updated_at)
  values (org_id, p_plan, p_starts_on, p_ends_on, coalesce(p_paid, false), p_amount_iqd, nullif(trim(p_note), ''), auth.uid(), now())
  on conflict (organization_id) do update
    set plan = excluded.plan, starts_on = excluded.starts_on, ends_on = excluded.ends_on, paid = excluded.paid,
        amount_iqd = excluded.amount_iqd, note = excluded.note, updated_by = excluded.updated_by, updated_at = now();
  perform private.audit('subscription.set', 'organization', org_id, null, null, null,
                        jsonb_build_object('plan', p_plan, 'starts_on', p_starts_on, 'ends_on', p_ends_on, 'paid', coalesce(p_paid, false), 'amount_iqd', p_amount_iqd),
                        org_id);
  return jsonb_build_object('organization_id', org_id, 'ends_on', p_ends_on, 'paid', coalesce(p_paid, false));
end;
$$;

create or replace function public.admin_set_subscription_notice_days(p_days int)
returns int
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then perform private.fail('forbidden'); end if;
  if p_days is null or p_days not between 1 and 60 then perform private.fail('invalid_input'); end if;
  update public.platform_settings set subscription_notice_days = p_days, updated_at = now() where id is not null;
  perform private.audit('settings.subscription_notice_days', 'platform', null, null, null, null, jsonb_build_object('days', p_days));
  return p_days;
end;
$$;

-- The banner for staff: only members of the organization see it, and only the
-- state and dates (no amount, no notes).
create or replace function public.subscription_notice(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.subscriptions;
  st text;
begin
  if auth.uid() is null then perform private.fail('not_authenticated'); end if;
  if not exists (select 1 from public.memberships m
                 where m.user_id = auth.uid() and m.organization_id = p_organization_id and m.status = 'active') then
    return null;
  end if;
  select * into s from public.subscriptions where organization_id = p_organization_id;
  if not found then return null; end if;
  st := private.subscription_state(s);
  if st in ('none', 'active') then return null; end if;
  return jsonb_build_object('state', st, 'ends_on', s.ends_on, 'days_left', s.ends_on - private.baghdad_today());
end;
$$;

-- Growth numbers for the super admin (Baghdad days). Counts only.
create or replace function public.admin_growth()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  today date := private.baghdad_today();
  m0 date := date_trunc('month', private.baghdad_today())::date;
  pm0 date := (date_trunc('month', private.baghdad_today()) - interval '1 month')::date;
  rate numeric := (select ai_cost_per_message_usd from public.platform_settings limit 1);
  ai_month bigint;
begin
  if not private.is_platform_admin() then perform private.fail('forbidden'); end if;
  ai_month := (select count(*) from public.ai_usage where (created_at at time zone 'Asia/Baghdad')::date >= m0);
  return jsonb_build_object(
    'today', today,
    'bookings', jsonb_build_object(
      'today', (select count(*) from public.appointments where (created_at at time zone 'Asia/Baghdad')::date = today),
      'month', (select count(*) from public.appointments where (created_at at time zone 'Asia/Baghdad')::date >= m0),
      'prev_month', (select count(*) from public.appointments where (created_at at time zone 'Asia/Baghdad')::date >= pm0
                                                              and (created_at at time zone 'Asia/Baghdad')::date < m0),
      'fulfilled_month', (select count(*) from public.appointments where status = 'fulfilled' and (created_at at time zone 'Asia/Baghdad')::date >= m0),
      'cancelled_month', (select count(*) from public.appointments where status in ('cancelled', 'rejected', 'no_show', 'expired')
                                                                  and (created_at at time zone 'Asia/Baghdad')::date >= m0),
      'by_source_month', coalesce((select jsonb_object_agg(source, n) from (
                           select source, count(*) n from public.appointments
                           where (created_at at time zone 'Asia/Baghdad')::date >= m0 group by source) x), '{}'::jsonb)),
    'patients', jsonb_build_object(
      'today', (select count(*) from public.patients where merged_into is null and (created_at at time zone 'Asia/Baghdad')::date = today),
      'month', (select count(*) from public.patients where merged_into is null and (created_at at time zone 'Asia/Baghdad')::date >= m0),
      'prev_month', (select count(*) from public.patients where merged_into is null and (created_at at time zone 'Asia/Baghdad')::date >= pm0
                                                          and (created_at at time zone 'Asia/Baghdad')::date < m0),
      'total', (select count(*) from public.patients where merged_into is null),
      'with_app', (select count(distinct patient_id) from public.patient_account_links where verified_at is not null and revoked_at is null)),
    'daily', (select jsonb_agg(jsonb_build_object(
                       'day', d::date,
                       'bookings', (select count(*) from public.appointments a where (a.created_at at time zone 'Asia/Baghdad')::date = d::date),
                       'patients', (select count(*) from public.patients p where p.merged_into is null and (p.created_at at time zone 'Asia/Baghdad')::date = d::date))
                     order by d)
              from generate_series(today - 29, today, interval '1 day') d),
    'top_doctors', coalesce((select jsonb_agg(t order by t.bookings desc, t.name) from (
                     select pp.full_name as name, sp.name_ar as specialty,
                            (select string_agg(distinct f.name, '، ') from public.appointments a2 join public.facilities f on f.id = a2.facility_id
                              where a2.practitioner_id = pp.id and (a2.created_at at time zone 'Asia/Baghdad')::date >= m0) as facilities,
                            count(*) as bookings,
                            count(*) filter (where a.status = 'fulfilled') as fulfilled
                     from public.appointments a
                     join public.practitioner_profiles pp on pp.id = a.practitioner_id
                     left join public.specialties sp on sp.id = pp.specialty_id
                     where (a.created_at at time zone 'Asia/Baghdad')::date >= m0
                     group by pp.id, pp.full_name, sp.name_ar
                     order by count(*) desc, pp.full_name
                     limit 10) t), '[]'::jsonb),
    'ai', jsonb_build_object(
      'today', (select count(*) from public.ai_usage where (created_at at time zone 'Asia/Baghdad')::date = today),
      'month', ai_month,
      'prev_month', (select count(*) from public.ai_usage where (created_at at time zone 'Asia/Baghdad')::date >= pm0
                                                           and (created_at at time zone 'Asia/Baghdad')::date < m0),
      'users_month', (select count(distinct user_id) from public.ai_usage where (created_at at time zone 'Asia/Baghdad')::date >= m0),
      'cost_per_message_usd', rate,
      'cost_month_usd', round(ai_month * rate, 2)),
    'subscriptions', (select jsonb_build_object(
        'expiring', count(*) filter (where private.subscription_state(s) = 'expiring'),
        'expired', count(*) filter (where private.subscription_state(s) = 'expired'),
        'unpaid', count(*) filter (where private.subscription_state(s) = 'unpaid'),
        'without', (select count(*) from public.organizations o where o.status <> 'closed'
                      and not exists (select 1 from public.subscriptions x where x.organization_id = o.id)),
        'paid_month_iqd', coalesce(sum(amount_iqd) filter (where paid and (updated_at at time zone 'Asia/Baghdad')::date >= m0), 0))
      from public.subscriptions s));
end;
$$;

create or replace function public.admin_set_ai_cost(p_usd numeric)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then perform private.fail('forbidden'); end if;
  if p_usd is null or p_usd < 0 or p_usd > 1 then perform private.fail('invalid_input'); end if;
  update public.platform_settings set ai_cost_per_message_usd = p_usd, updated_at = now() where id is not null;
  perform private.audit('settings.ai_cost', 'platform', null, null, null, null, jsonb_build_object('usd', p_usd));
  return p_usd;
end;
$$;

-- the demo-data wipe also empties the subscriptions
create or replace function private.reset_targets()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    -- organizations and everything under them
    'public.subscriptions', 'public.organizations', 'public.branches', 'public.facilities', 'public.facility_resources', 'public.memberships',
    'public.reception_scopes', 'public.invitations', 'public.practitioner_profiles', 'public.provider_applications', 'public.provider_media',
    'public.clinic_services', 'public.schedules', 'public.schedule_exceptions', 'public.booking_policies', 'public.delay_notices',
    -- patients and their records
    'public.patients', 'public.patient_account_links', 'public.patient_identifiers', 'public.patient_qr_tokens', 'public.patient_health_profiles',
    'public.patient_conditions', 'public.allergies', 'public.patient_reported_medications', 'public.patient_lab_entries',
    'public.care_relationships', 'public.consent_grants', 'public.attachments',
    -- booking, visits, clinical work
    'public.appointments', 'public.appointment_events', 'public.queue_entries', 'public.encounters', 'public.clinical_notes', 'public.clinical_tasks',
    'public.prescriptions', 'public.prescription_versions', 'public.prescription_items', 'public.prescription_events', 'public.prescription_dispatches',
    'public.dispatch_line_notes', 'public.dispensing_records', 'public.medication_plans', 'public.reminder_jobs',
    'public.lab_test_catalog', 'public.lab_orders', 'public.lab_order_items', 'public.specimens', 'public.lab_results',
    'public.open_lab_orders', 'public.open_lab_order_items', 'public.home_lab_requests', 'public.home_lab_request_events',
    -- pharmacy and finance
    'public.pharmacy_products', 'public.inventory_batches', 'public.stock_movements', 'public.stock_reservations', 'public.suppliers',
    'public.sales', 'public.sale_lines', 'public.invoices', 'public.invoice_lines', 'public.invoice_payments', 'public.payments',
    'public.refunds', 'public.expenses',
    -- messages and per-account traces
    'public.notification_outbox', 'public.notifications', 'public.push_devices', 'public.ai_usage',
    'private.account_link_codes', 'private.account_deletions', 'private.otp_send_log', 'private.rate_limit_events'
  ];
$$;

revoke execute on function private.baghdad_today(), private.subscription_state(public.subscriptions) from public, anon, authenticated;
revoke execute on function
  public.admin_subscriptions(),
  public.admin_set_subscription(uuid, text, date, date, boolean, bigint, text),
  public.admin_set_subscription_notice_days(int),
  public.subscription_notice(uuid),
  public.admin_growth(),
  public.admin_set_ai_cost(numeric)
from public, anon;
grant execute on function
  public.admin_subscriptions(),
  public.admin_set_subscription(uuid, text, date, date, boolean, bigint, text),
  public.admin_set_subscription_notice_days(int),
  public.subscription_notice(uuid),
  public.admin_growth(),
  public.admin_set_ai_cost(numeric)
to authenticated;
