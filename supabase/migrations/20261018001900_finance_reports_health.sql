-- =====================================================================
-- 0019 Operational finance, reports and system health (Phase 6).
--   * Scope: an OPERATIONAL fee ledger (invoices, payments, refunds,
--     expenses) — explicitly not a legal accounting system (§13).
--   * Payment records are independent from appointments/services (§14).
--   * Facility/organization reports are counts and money only — no
--     medical details. Platform health shows jobs, backlogs, failures.
-- =====================================================================

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique default ('I' || private.random_code(8)),
  facility_id uuid not null references public.facilities (id),
  patient_id uuid not null references public.patients (id),
  appointment_id uuid references public.appointments (id),
  lab_order_id uuid references public.lab_orders (id),
  status text not null default 'open' check (status in ('open', 'paid', 'void')),
  total_minor bigint not null default 0 check (total_minor >= 0),
  currency text not null default 'IQD',
  void_reason text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1
);
create unique index invoices_one_per_appointment on public.invoices (appointment_id) where appointment_id is not null and status <> 'void';
create unique index invoices_one_per_lab_order on public.invoices (lab_order_id) where lab_order_id is not null and status <> 'void';
create index invoices_facility_idx on public.invoices (facility_id, created_at desc);
create trigger invoices_touch before update on public.invoices for each row execute function private.touch_row();

create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id),
  description text not null,
  quantity int not null default 1 check (quantity > 0),
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  line_total_minor bigint not null check (line_total_minor >= 0)
);

create table public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id),
  amount_minor bigint not null check (amount_minor <> 0),         -- negative = refund
  method text not null default 'cash' check (method in ('cash', 'card', 'other')),
  note text,
  received_by uuid not null references public.profiles (id),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (received_by, idempotency_key)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id),
  category text not null,
  amount_minor bigint not null check (amount_minor > 0),
  spent_on date not null default current_date,
  note text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create or replace function private.can_bill(p_facility_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select private.has_facility_role(p_facility_id, array['receptionist', 'facility_admin', 'lab_technician', 'lab_approver', 'doctor']::public.member_role[]); $$;

alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.invoice_payments enable row level security;
alter table public.expenses enable row level security;
create policy invoices_read on public.invoices for select to authenticated
  using (private.can_bill(facility_id) or private.is_linked_to_patient(patient_id));
create policy invoice_lines_read on public.invoice_lines for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_lines.invoice_id));
create policy invoice_payments_read on public.invoice_payments for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_payments.invoice_id));
create policy expenses_read on public.expenses for select to authenticated
  using (private.can_admin_facility(facility_id));
grant select on public.invoices, public.invoice_lines, public.invoice_payments, public.expenses to authenticated;

-- ---------------------------------------------------------------------
create or replace function private.refresh_invoice(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  total bigint; paid bigint;
begin
  select coalesce(sum(line_total_minor), 0) into total from public.invoice_lines where invoice_id = p_invoice_id;
  select coalesce(sum(amount_minor), 0) into paid from public.invoice_payments where invoice_id = p_invoice_id;
  update public.invoices set total_minor = total,
         status = case when status = 'void' then 'void' when paid >= total and total > 0 then 'paid' else 'open' end
   where id = p_invoice_id;
end;
$$;

-- Invoice for a visit (price snapshot of the appointment) or a lab order
-- (catalog prices). Idempotent: one live invoice per appointment/order.
create or replace function public.create_invoice(p_appointment_id uuid default null, p_lab_order_id uuid default null)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invoices;
  a public.appointments;
  o public.lab_orders;
begin
  if (p_appointment_id is null) = (p_lab_order_id is null) then perform private.fail('invalid_reference'); end if;
  if p_appointment_id is not null then
    select * into a from public.appointments where id = p_appointment_id for update;   -- serializes concurrent creation
    if a.id is null or not (private.can_manage_reception(a.facility_id, a.practitioner_id) or private.can_admin_facility(a.facility_id)) then
      perform private.fail('forbidden');
    end if;
    select * into inv from public.invoices where appointment_id = a.id and status <> 'void';
    if inv.id is not null then return inv; end if;
    insert into public.invoices (facility_id, patient_id, appointment_id, created_by) values (a.facility_id, a.patient_id, a.id, auth.uid()) returning * into inv;
    insert into public.invoice_lines (invoice_id, description, unit_price_minor, line_total_minor)
    select inv.id, cs.name, coalesce(a.price_minor, 0), coalesce(a.price_minor, 0) from public.clinic_services cs where cs.id = a.service_id;
  else
    select * into o from public.lab_orders where id = p_lab_order_id for update;
    if o.id is null or not private.is_lab_staff(o.lab_facility_id) then perform private.fail('forbidden'); end if;
    select * into inv from public.invoices where lab_order_id = o.id and status <> 'void';
    if inv.id is not null then return inv; end if;
    insert into public.invoices (facility_id, patient_id, lab_order_id, created_by) values (o.lab_facility_id, o.patient_id, o.id, auth.uid()) returning * into inv;
    insert into public.invoice_lines (invoice_id, description, unit_price_minor, line_total_minor)
    select inv.id, t.name, coalesce(t.price_minor, 0), coalesce(t.price_minor, 0)
      from public.lab_order_items i join public.lab_test_catalog t on t.id = i.test_id where i.order_id = o.id and i.status <> 'cancelled';
  end if;
  perform private.refresh_invoice(inv.id);
  select * into inv from public.invoices where id = inv.id;
  perform private.audit('invoice.created', 'invoice', inv.id, inv.facility_id, inv.patient_id);
  return inv;
end;
$$;

create or replace function public.record_invoice_payment(p_invoice_id uuid, p_amount_minor bigint, p_idempotency_key text,
                                                         p_method text default 'cash', p_note text default null)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invoices;
  paid bigint;
begin
  select * into inv from public.invoices where id = p_invoice_id for update;
  if inv.id is null or not private.can_bill(inv.facility_id) then perform private.fail('forbidden'); end if;
  if inv.status = 'void' then perform private.fail('invalid_transition'); end if;
  if exists (select 1 from public.invoice_payments where received_by = auth.uid() and idempotency_key = p_idempotency_key) then return inv; end if;
  select coalesce(sum(amount_minor), 0) into paid from public.invoice_payments where invoice_id = inv.id;
  if p_amount_minor = 0 then perform private.fail('invalid_quantity'); end if;
  if p_amount_minor > 0 and paid + p_amount_minor > inv.total_minor then perform private.fail('overpayment'); end if;
  if p_amount_minor < 0 then
    if not private.can_admin_facility(inv.facility_id) and not private.has_facility_role(inv.facility_id, array['receptionist']::public.member_role[]) then
      perform private.fail('forbidden');
    end if;
    if paid + p_amount_minor < 0 then perform private.fail('refund_exceeds_paid'); end if;
    if p_note is null or length(trim(p_note)) < 3 then perform private.fail('reason_required'); end if;
  end if;
  insert into public.invoice_payments (invoice_id, amount_minor, method, note, received_by, idempotency_key)
  values (inv.id, p_amount_minor, p_method, p_note, auth.uid(), p_idempotency_key);
  perform private.refresh_invoice(inv.id);
  select * into inv from public.invoices where id = inv.id;
  return inv;
end;
$$;

create or replace function public.void_invoice(p_invoice_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invoices;
begin
  select * into inv from public.invoices where id = p_invoice_id for update;
  if inv.id is null or not private.can_admin_facility(inv.facility_id) then perform private.fail('forbidden'); end if;
  if exists (select 1 from public.invoice_payments where invoice_id = inv.id having sum(amount_minor) <> 0) then perform private.fail('refund_first'); end if;
  if p_reason is null or length(trim(p_reason)) < 5 then perform private.fail('reason_required'); end if;
  update public.invoices set status = 'void', void_reason = p_reason where id = inv.id;
  perform private.audit('invoice.voided', 'invoice', inv.id, inv.facility_id, inv.patient_id, p_reason);
end;
$$;

create or replace function public.invoice_document(p_invoice_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  inv public.invoices;
begin
  select * into inv from public.invoices where id = p_invoice_id;
  if inv.id is null or not (private.can_bill(inv.facility_id) or private.is_linked_to_patient(inv.patient_id)) then perform private.fail('forbidden'); end if;
  return jsonb_build_object(
    'invoice', to_jsonb(inv) - 'created_by',
    'facility', (select jsonb_build_object('name', f.name, 'branch', b.name, 'address', b.address, 'phone', f.phone)
                   from public.facilities f join public.branches b on b.id = f.branch_id where f.id = inv.facility_id),
    'patient', (select jsonb_build_object('full_name', p.full_name, 'public_code', p.public_code) from public.patients p where p.id = inv.patient_id),
    'lines', coalesce((select jsonb_agg(to_jsonb(l) - 'invoice_id') from public.invoice_lines l where l.invoice_id = inv.id), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(jsonb_build_object('amount_minor', p.amount_minor, 'method', p.method, 'at', p.created_at, 'note', p.note) order by p.created_at)
                           from public.invoice_payments p where p.invoice_id = inv.id), '[]'::jsonb),
    'paid_minor', (select coalesce(sum(amount_minor), 0) from public.invoice_payments where invoice_id = inv.id));
end;
$$;

create or replace function public.add_expense(p_facility_id uuid, p_category text, p_amount_minor bigint, p_spent_on date default current_date, p_note text default null)
returns public.expenses
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.expenses;
begin
  if not private.can_admin_facility(p_facility_id) then perform private.fail('forbidden'); end if;
  insert into public.expenses (facility_id, category, amount_minor, spent_on, note, created_by)
  values (p_facility_id, trim(p_category), p_amount_minor, p_spent_on, p_note, auth.uid()) returning * into e;
  return e;
end;
$$;

-- Operational facility report (no medical details).
create or replace function public.facility_report(p_facility_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  tz text := private.facility_tz(p_facility_id);
begin
  if not private.can_admin_facility(p_facility_id) then perform private.fail('forbidden'); end if;
  return jsonb_build_object(
    'appointments_by_status', coalesce((select jsonb_object_agg(status, n) from (
        select a.status, count(*) n from public.appointments a
         where a.facility_id = p_facility_id and (lower(a.period) at time zone tz)::date between p_from and p_to group by a.status) s), '{}'::jsonb),
    'by_practitioner', coalesce((select jsonb_agg(x order by x.total desc) from (
        select pp.full_name as practitioner, count(*) as total,
               count(*) filter (where a.status = 'fulfilled') as fulfilled,
               count(*) filter (where a.status = 'cancelled') as cancelled,
               count(*) filter (where a.status = 'no_show') as no_show,
               count(*) filter (where a.source = 'reception') as from_reception,
               count(*) filter (where a.source in ('app', 'web')) as from_app
          from public.appointments a join public.practitioner_profiles pp on pp.id = a.practitioner_id
         where a.facility_id = p_facility_id and (lower(a.period) at time zone tz)::date between p_from and p_to
         group by pp.full_name) x), '[]'::jsonb),
    'walk_ins', (select count(*) from public.queue_entries where facility_id = p_facility_id and kind = 'walk_in' and service_date between p_from and p_to),
    'invoiced_minor', (select coalesce(sum(total_minor), 0) from public.invoices where facility_id = p_facility_id and status <> 'void'
                         and (created_at at time zone tz)::date between p_from and p_to),
    'collected_minor', (select coalesce(sum(p.amount_minor) filter (where p.amount_minor > 0), 0) from public.invoice_payments p
                          join public.invoices i on i.id = p.invoice_id where i.facility_id = p_facility_id and (p.created_at at time zone tz)::date between p_from and p_to),
    'refunded_minor', (select coalesce(-sum(p.amount_minor) filter (where p.amount_minor < 0), 0) from public.invoice_payments p
                         join public.invoices i on i.id = p.invoice_id where i.facility_id = p_facility_id and (p.created_at at time zone tz)::date between p_from and p_to),
    'by_method', coalesce((select jsonb_object_agg(method, total) from (select p.method, sum(p.amount_minor) total from public.invoice_payments p
                          join public.invoices i on i.id = p.invoice_id where i.facility_id = p_facility_id and (p.created_at at time zone tz)::date between p_from and p_to group by p.method) m), '{}'::jsonb),
    'expenses_minor', (select coalesce(sum(amount_minor), 0) from public.expenses where facility_id = p_facility_id and spent_on between p_from and p_to),
    'expenses_by_category', coalesce((select jsonb_object_agg(category, total) from (select category, sum(amount_minor) total from public.expenses
                          where facility_id = p_facility_id and spent_on between p_from and p_to group by category) e), '{}'::jsonb),
    'open_invoices', (select count(*) from public.invoices where facility_id = p_facility_id and status = 'open'));
end;
$$;

-- Organization roll-up (counts and money only).
create or replace function public.organization_report(p_organization_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (private.is_org_admin(p_organization_id) or private.is_platform_admin()) then perform private.fail('forbidden'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'facility', f.name, 'type', f.type,
      'appointments', (select count(*) from public.appointments a where a.facility_id = f.id and lower(a.period)::date between p_from and p_to),
      'lab_orders', (select count(*) from public.lab_orders o where o.lab_facility_id = f.id and o.created_at::date between p_from and p_to),
      'prescriptions_received', (select count(distinct d.prescription_id) from public.prescription_dispatches d where d.pharmacy_id = f.id and d.sent_at::date between p_from and p_to),
      'collected_minor', (select coalesce(sum(p.amount_minor), 0) from public.invoice_payments p join public.invoices i on i.id = p.invoice_id
                           where i.facility_id = f.id and p.created_at::date between p_from and p_to)
                       + (select coalesce(sum(s.total_minor), 0) from public.sales s where s.pharmacy_id = f.id and s.created_at::date between p_from and p_to)
    ) order by f.name) from public.facilities f where f.organization_id = p_organization_id), '[]'::jsonb);
end;
$$;

-- Platform health: scheduled jobs, notification backlog / dead letters,
-- file quarantine, recent job failures. No patient data.
create or replace function public.system_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  jobs jsonb := '[]'::jsonb;
begin
  if not private.is_platform_admin() then perform private.fail('forbidden'); end if;
  if to_regclass('cron.job_run_details') is not null then
    execute $q$
      select coalesce(jsonb_agg(x order by x->>'job'), '[]'::jsonb) from (
        select jsonb_build_object('job', j.jobname, 'schedule', j.schedule,
                 'last_status', (select d.status from cron.job_run_details d where d.jobid = j.jobid order by d.start_time desc limit 1),
                 'last_run', (select d.start_time from cron.job_run_details d where d.jobid = j.jobid order by d.start_time desc limit 1),
                 'failures_24h', (select count(*) from cron.job_run_details d where d.jobid = j.jobid and d.status = 'failed' and d.start_time > now() - interval '24 hours')) x
          from cron.job j) s $q$ into jobs;
  end if;
  return jsonb_build_object(
    'jobs', jobs,
    'outbox', (select jsonb_build_object(
        'pending', count(*) filter (where status in ('pending', 'failed')),
        'dead', count(*) filter (where status = 'dead'),
        'sent_24h', count(*) filter (where status = 'sent' and sent_at > now() - interval '24 hours'),
        'oldest_pending', min(created_at) filter (where status in ('pending', 'failed'))) from public.notification_outbox),
    'dead_letters', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'template', o.template, 'channel', o.channel, 'attempts', o.attempts,
                                'last_error', o.last_error, 'created_at', o.created_at) order by o.created_at desc)
                              from (select * from public.notification_outbox where status = 'dead' order by created_at desc limit 20) o), '[]'::jsonb),
    'attachments', (select jsonb_build_object('quarantine', count(*) filter (where status = 'quarantine'),
                                              'rejected_7d', count(*) filter (where status = 'rejected' and created_at > now() - interval '7 days'))
                      from public.attachments),
    'reminders_due_backlog', (select count(*) from public.reminder_jobs where status = 'pending' and scheduled_at < now() - interval '5 minutes'));
end;
$$;

revoke execute on function public.create_invoice(uuid, uuid), public.record_invoice_payment(uuid, bigint, text, text, text), public.void_invoice(uuid, text),
  public.invoice_document(uuid), public.add_expense(uuid, text, bigint, date, text), public.facility_report(uuid, date, date),
  public.organization_report(uuid, date, date), public.system_health() from public, anon;
grant execute on function public.create_invoice(uuid, uuid), public.record_invoice_payment(uuid, bigint, text, text, text), public.void_invoice(uuid, text),
  public.invoice_document(uuid), public.add_expense(uuid, text, bigint, date, text), public.facility_report(uuid, date, date),
  public.organization_report(uuid, date, date), public.system_health() to authenticated;
