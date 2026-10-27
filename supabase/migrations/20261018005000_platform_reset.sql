-- «مسح البيانات التجريبية» (owner request, 27 Oct 2026): before real data
-- goes in, the super admin empties the platform of the demo data in one step.
--  * Wiped: every organization, branch and facility with all their staff,
--    schedules, bookings, visits, prescriptions, lab work, pharmacy stock,
--    finance; every patient and their records; invitations, applications,
--    notifications; every account that is not a platform admin.
--  * Kept: the platform admins (their accounts and 2FA), the shared catalogs
--    (cities, specialties, the master lab-test list, the medicine list),
--    platform settings, the access-audit trail, monitoring history and OTP
--    limits. Uploaded files stay in storage (no longer linked to anything).
--  * Guarded: platform admin (with 2FA when required), a typed Arabic phrase,
--    one transaction (all or nothing), audited; and a one-way lock the admin
--    sets once real data is in, after which the reset can never run again.

alter table public.platform_settings add column if not exists reset_locked_at timestamptz;

create or replace function private.reset_targets()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    -- organizations and everything under them
    'public.organizations', 'public.branches', 'public.facilities', 'public.facility_resources', 'public.memberships',
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

-- What the reset would remove, for the confirmation screen.
create or replace function public.admin_reset_preview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  n bigint;
  counts jsonb := '{}'::jsonb;
  t text;
begin
  if not private.is_platform_admin() then perform private.fail('forbidden'); end if;
  foreach t in array array['public.organizations', 'public.facilities', 'public.practitioner_profiles', 'public.patients',
                           'public.appointments', 'public.encounters', 'public.prescriptions', 'public.lab_orders', 'public.sales'] loop
    execute format('select count(*) from %s', t) into n;
    counts := counts || jsonb_build_object(split_part(t, '.', 2), n);
  end loop;
  return jsonb_build_object(
    'counts', counts,
    'accounts', (select count(*) from auth.users u where not exists (select 1 from public.platform_admins a where a.user_id = u.id and a.revoked_at is null)),
    'admins_kept', (select count(*) from public.platform_admins where revoked_at is null),
    'locked_at', (select reset_locked_at from public.platform_settings limit 1));
end;
$$;

create or replace function public.admin_reset_platform(p_confirm text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  before jsonb;
  removed_accounts int;
begin
  if not private.is_platform_admin() then perform private.fail('forbidden'); end if;
  if exists (select 1 from public.platform_settings where reset_locked_at is not null) then perform private.fail('reset_locked'); end if;
  if coalesce(trim(p_confirm), '') <> 'احذف كل البيانات التجريبية' then perform private.fail('confirm_phrase'); end if;

  before := public.admin_reset_preview();
  execute 'truncate table ' || array_to_string(private.reset_targets(), ', ') || ' restart identity';

  -- every account that is not a platform admin (identities, sessions, factors and profiles go with it)
  delete from public.profiles p where not exists (select 1 from public.platform_admins a where a.user_id = p.id);
  delete from auth.users u where not exists (select 1 from public.platform_admins a where a.user_id = u.id);
  get diagnostics removed_accounts = row_count;

  perform setval('public.patient_code_seq', 1, false);
  perform private.audit('platform.reset', 'platform', null, null, null, 'مسح البيانات التجريبية',
                        before || jsonb_build_object('accounts_removed', removed_accounts));
  return jsonb_build_object('ok', true, 'removed', before -> 'counts', 'accounts_removed', removed_accounts);
end;
$$;

-- Once real data is in: lock the reset for good (no unlock function exists).
create or replace function public.admin_lock_reset()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare at timestamptz;
begin
  if not private.is_platform_admin() then perform private.fail('forbidden'); end if;
  update public.platform_settings set reset_locked_at = coalesce(reset_locked_at, now()) returning reset_locked_at into at;
  perform private.audit('platform.reset_locked', 'platform', null, null, null, null, '{}'::jsonb);
  return at;
end;
$$;

revoke execute on function private.reset_targets() from public, anon, authenticated;
revoke execute on function public.admin_reset_preview(), public.admin_reset_platform(text), public.admin_lock_reset() from public, anon;
grant execute on function public.admin_reset_preview(), public.admin_reset_platform(text), public.admin_lock_reset() to authenticated;
