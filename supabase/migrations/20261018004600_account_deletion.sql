-- «احذف حسابي» (owner request, 25 Oct 2026; required by Google Play and the App Store).
-- The patient's personal account is erased: sign-in (email, phone, Google) is removed by
-- the delete-account edge function (soft delete in Auth), and here we cut the account
-- off its medical record, stop reminders and pushes, cancel upcoming bookings and blank
-- the profile. The medical record itself (visits, prescriptions, lab results) stays with
-- the treating clinics, as medical-records law requires; it is no longer reachable from
-- any account. Staff accounts are closed by the platform admin instead.

create table if not exists private.account_deletions (
  user_id uuid primary key,
  deleted_at timestamptz not null default now(),
  patient_ids uuid[] not null default '{}'
);

create or replace function public.erase_account(p_user uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patients uuid[];
  v_alone uuid[];  -- records nobody else (e.g. another guardian) still follows
begin
  if p_user is null or not exists (select 1 from public.profiles where id = p_user) then return 'not_found'; end if;
  if exists (select 1 from public.memberships where user_id = p_user and status = 'active')
     or exists (select 1 from public.practitioner_profiles where user_id = p_user)
     or exists (select 1 from public.platform_admins where user_id = p_user) then
    return 'staff_account';
  end if;

  select coalesce(array_agg(patient_id), '{}') into v_patients
    from public.patient_account_links where user_id = p_user and revoked_at is null;
  select coalesce(array_agg(x), '{}') into v_alone from unnest(v_patients) x
   where not exists (select 1 from public.patient_account_links l where l.patient_id = x and l.user_id <> p_user and l.revoked_at is null);

  -- upcoming bookings are cancelled so the clinic frees the slot
  with old as (
    select id, status from public.appointments
     where patient_id = any (v_alone) and status in ('awaiting_confirmation', 'confirmed') and lower(period) > now()
     for update
  ), c as (
    update public.appointments a set status = 'cancelled', status_reason = 'account_deleted'
      from old where a.id = old.id
    returning a.id, old.status as prev
  )
  insert into public.appointment_events (appointment_id, from_status, to_status, actor_user_id, reason)
  select id, prev, 'cancelled', p_user, 'account_deleted' from c;

  -- no more reminders to a phone nobody owns
  update public.reminder_jobs j set status = 'cancelled'
   where j.status = 'pending'
     and j.plan_id in (select id from public.medication_plans where patient_id = any (v_alone));
  update public.medication_plans set status = 'stopped', status_reason = 'account_deleted'
   where patient_id = any (v_alone) and status in ('active', 'paused');

  update public.patient_account_links set revoked_at = now()
   where user_id = p_user and revoked_at is null;

  delete from public.push_devices where user_id = p_user;
  delete from public.notifications where user_id = p_user;
  update public.notification_outbox set status = 'cancelled'
   where recipient_user_id = p_user and status in ('pending', 'failed');
  delete from private.account_link_codes where user_id = p_user;
  delete from public.ai_usage where user_id = p_user;

  update public.profiles
     set display_name = null, status = 'suspended', suspended_reason = 'account_deleted'
   where id = p_user;

  insert into private.account_deletions (user_id, patient_ids) values (p_user, v_patients)
    on conflict (user_id) do update set deleted_at = now();
  perform private.audit('account.deleted', 'profile', p_user, null, null, null, '{}'::jsonb, null);
  return 'ok';
end;
$$;
revoke execute on function public.erase_account(uuid) from public, anon, authenticated;
grant execute on function public.erase_account(uuid) to service_role;
