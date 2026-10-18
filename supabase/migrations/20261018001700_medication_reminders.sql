-- =====================================================================
-- 0017 Medication plans & reminders (Phase 5, spec §11).
--   * Source = an approved prescription line. Activated by the pharmacist
--     at dispensing with the patient's consent, or by the patient when the
--     medicine was obtained elsewhere (source recorded).
--   * Times are EXPLICIT local times agreed with the patient — nothing is
--     inferred from "three times daily". As-needed lines get no schedule.
--   * Jobs are generated for the course only (start … start+duration−1)
--     and are cancelled when the prescription is revised or cancelled.
--   * Dispatch goes through the outbox with a per-job dedupe key, so a
--     retried worker never sends the same reminder twice. Generic text.
--   * Taken / skipped / snoozed are patient self-reports, not proof of
--     adherence.
-- =====================================================================

create table public.medication_plans (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id),
  prescription_id uuid not null references public.prescriptions (id),
  version_id uuid not null references public.prescription_versions (id),
  line_no int not null,
  display_name text not null,
  instructions text,
  start_date date not null,
  end_date date,
  times_local time[] not null default '{}',
  as_needed boolean not null default false,
  timezone text not null default 'Asia/Baghdad',
  source text not null check (source in ('pharmacist', 'patient')),
  consent_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'paused', 'stopped', 'cancelled', 'completed')),
  status_reason text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1,
  check (end_date is null or end_date >= start_date),
  check (as_needed or cardinality(times_local) between 1 and 12)
);
create unique index medication_plans_one_active on public.medication_plans (prescription_id, line_no, patient_id)
  where status in ('active', 'paused');
create trigger medication_plans_touch before update on public.medication_plans
  for each row execute function private.touch_row();

create table public.reminder_jobs (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.medication_plans (id),
  scheduled_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'queued', 'cancelled')),
  dose_status text check (dose_status in ('taken', 'skipped', 'snoozed')),
  dose_recorded_at timestamptz,
  snooze_count int not null default 0,
  queued_at timestamptz,
  unique (plan_id, scheduled_at)
);
create index reminder_jobs_due on public.reminder_jobs (scheduled_at) where status = 'pending';

alter table public.medication_plans enable row level security;
alter table public.reminder_jobs enable row level security;
create policy plans_read on public.medication_plans for select to authenticated
  using (private.is_linked_to_patient(patient_id) or private.is_rx_author(prescription_id)
         or exists (select 1 from public.prescription_dispatches d where d.prescription_id = medication_plans.prescription_id
                     and private.is_pharmacy_staff(d.pharmacy_id)));
create policy reminder_jobs_read on public.reminder_jobs for select to authenticated
  using (exists (select 1 from public.medication_plans p where p.id = reminder_jobs.plan_id and private.is_linked_to_patient(p.patient_id)));
grant select on public.medication_plans, public.reminder_jobs to authenticated;

-- =====================================================================
create or replace function private.generate_reminder_jobs(p_plan_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.medication_plans;
  n int;
begin
  select * into p from public.medication_plans where id = p_plan_id;
  if p.as_needed or p.status <> 'active' then return 0; end if;
  insert into public.reminder_jobs (plan_id, scheduled_at)
  select p.id, ((d::date + t)::timestamp at time zone p.timezone)
    from generate_series(greatest(p.start_date, (now() at time zone p.timezone)::date),
                         coalesce(p.end_date, (now() at time zone p.timezone)::date + 30), interval '1 day') d,
         unnest(p.times_local) t
   where ((d::date + t)::timestamp at time zone p.timezone) > now()
  on conflict (plan_id, scheduled_at) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Activate reminders for a prescription line (pharmacist at dispensing,
-- or the patient for medicine obtained outside the platform).
create or replace function public.create_medication_plan(
  p_prescription_id uuid,
  p_line_no int,
  p_start_date date,
  p_times text[],
  p_patient_consent boolean,
  p_dispatch_id uuid default null
) returns public.medication_plans
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.prescriptions;
  v public.prescription_versions;
  it public.prescription_items;
  plan public.medication_plans;
  src text;
  times time[];
begin
  select * into r from public.prescriptions where id = p_prescription_id;
  if r.id is null or r.status <> 'active' then perform private.fail('prescription_not_dispensable'); end if;
  select * into v from public.prescription_versions where id = r.current_version_id;
  select * into it from public.prescription_items where version_id = v.id and line_no = p_line_no;
  if it.id is null then perform private.fail('invalid_line'); end if;

  if private.is_linked_to_patient(r.patient_id) and p_dispatch_id is null then
    src := 'patient';
  elsif p_dispatch_id is not null and exists (select 1 from public.prescription_dispatches d
           where d.id = p_dispatch_id and d.prescription_id = r.id and private.is_pharmacy_staff(d.pharmacy_id)) then
    src := 'pharmacist';
  else
    perform private.fail('forbidden');
  end if;
  if not coalesce(p_patient_consent, false) then perform private.fail('consent_required'); end if;
  if not it.as_needed and (p_times is null or cardinality(p_times) = 0) then perform private.fail('times_required'); end if;
  if it.duration_days is null and not it.as_needed then perform private.fail('duration_required'); end if;
  select coalesce(array_agg(x::time order by x::time), '{}') into times from unnest(coalesce(p_times, '{}')) x;

  -- replace an existing active plan for the same line (explicit re-setup)
  update public.medication_plans set status = 'stopped', status_reason = 'replaced'
   where prescription_id = r.id and line_no = p_line_no and patient_id = r.patient_id and status in ('active', 'paused');
  update public.reminder_jobs j set status = 'cancelled'
    from public.medication_plans p
   where j.plan_id = p.id and p.prescription_id = r.id and p.line_no = p_line_no and p.status_reason = 'replaced' and j.status = 'pending';

  insert into public.medication_plans (patient_id, prescription_id, version_id, line_no, display_name, instructions, start_date, end_date,
                                       times_local, as_needed, timezone, source, consent_at, created_by)
  values (r.patient_id, r.id, v.id, p_line_no, it.display_name, it.instructions, p_start_date,
          case when it.duration_days is not null then p_start_date + it.duration_days - 1 end,
          case when it.as_needed then '{}' else times end, it.as_needed, private.facility_tz(r.facility_id), src, now(), auth.uid())
  returning * into plan;
  perform private.generate_reminder_jobs(plan.id);
  perform private.audit('medication_plan.created', 'medication_plan', plan.id, null, r.patient_id, null, jsonb_build_object('source', src));
  return plan;
end;
$$;

create or replace function public.set_medication_plan_status(p_plan_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.medication_plans;
begin
  select * into p from public.medication_plans where id = p_plan_id for update;
  if p.id is null or not private.is_linked_to_patient(p.patient_id) then perform private.fail('forbidden'); end if;
  if p_status not in ('active', 'paused', 'stopped') or p.status in ('cancelled', 'completed', 'stopped') then perform private.fail('invalid_transition'); end if;
  update public.medication_plans set status = p_status where id = p.id;
  if p_status in ('paused', 'stopped') then
    update public.reminder_jobs set status = 'cancelled' where plan_id = p.id and status = 'pending';
  else
    perform private.generate_reminder_jobs(p.id);
  end if;
end;
$$;

-- Patient self-report for a dose (not proof of adherence).
create or replace function public.record_dose(p_job_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  j public.reminder_jobs;
  p public.medication_plans;
begin
  select * into j from public.reminder_jobs where id = p_job_id for update;
  select * into p from public.medication_plans where id = j.plan_id;
  if j.id is null or not private.is_linked_to_patient(p.patient_id) then perform private.fail('forbidden'); end if;
  if p_status not in ('taken', 'skipped', 'snoozed') then perform private.fail('invalid_status'); end if;
  if p_status = 'snoozed' then
    if j.snooze_count >= 3 then perform private.fail('snooze_limit'); end if;
    update public.reminder_jobs set dose_status = 'snoozed', snooze_count = snooze_count + 1, status = 'pending',
           scheduled_at = greatest(now(), scheduled_at) + interval '15 minutes', queued_at = null
     where id = j.id;
  else
    update public.reminder_jobs set dose_status = p_status, dose_recorded_at = now(),
           status = case when status = 'pending' then 'cancelled' else status end
     where id = j.id;
  end if;
end;
$$;

-- Cron: queue due reminders into the outbox exactly once per job (+snooze).
create or replace function public.dispatch_due_reminders()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  j record;
  n int := 0;
begin
  -- course finished → completed
  update public.medication_plans set status = 'completed'
   where status = 'active' and end_date is not null and end_date < (now() at time zone timezone)::date;
  for j in
    select rj.id, rj.snooze_count, mp.patient_id, mp.id as plan_id
      from public.reminder_jobs rj join public.medication_plans mp on mp.id = rj.plan_id
     where rj.status = 'pending' and rj.scheduled_at <= now() and mp.status = 'active'
     order by rj.scheduled_at
     limit 500
     for update of rj skip locked
  loop
    perform private.notify_patient(j.patient_id, 'medication.reminder',
      jsonb_build_object('reminder_job_id', j.id, 'plan_id', j.plan_id),       -- no drug name in the payload
      'rem:' || j.id || ':' || j.snooze_count, array['in_app', 'push']::public.notification_channel[]);
    update public.reminder_jobs set status = 'queued', queued_at = now() where id = j.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Revised / cancelled prescriptions cancel their plans and pending jobs.
create or replace function private.cancel_plans_on_rx_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('superseded', 'cancelled') and old.status = 'approved' then
    update public.medication_plans set status = 'cancelled',
           status_reason = case when new.status = 'superseded' then 'prescription_revised' else 'prescription_cancelled' end
     where version_id = new.id and status in ('active', 'paused');
    update public.reminder_jobs j set status = 'cancelled'
      from public.medication_plans p
     where j.plan_id = p.id and p.version_id = new.id and j.status = 'pending';
  end if;
  return new;
end;
$$;
create trigger rx_versions_cancel_plans after update of status on public.prescription_versions
  for each row execute function private.cancel_plans_on_rx_change();

-- Patient view: plans + today's / upcoming doses.
create or replace function public.my_medication_plans()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'display_name', p.display_name, 'instructions', p.instructions, 'start_date', p.start_date, 'end_date', p.end_date,
      'times', p.times_local, 'as_needed', p.as_needed, 'status', p.status, 'status_reason', p.status_reason, 'source', p.source,
      'patient_name', pt.full_name,
      'doses', coalesce((select jsonb_agg(jsonb_build_object('id', j.id, 'scheduled_at', j.scheduled_at, 'status', j.status,
                                         'dose_status', j.dose_status, 'snooze_count', j.snooze_count) order by j.scheduled_at)
                          from public.reminder_jobs j
                         where j.plan_id = p.id and j.scheduled_at >= now() - interval '12 hours' and j.scheduled_at < now() + interval '36 hours'), '[]'::jsonb))
      order by p.status <> 'active', p.created_at desc), '[]'::jsonb)
    from public.medication_plans p join public.patients pt on pt.id = p.patient_id
   where private.is_linked_to_patient(p.patient_id);
$$;

revoke execute on function public.create_medication_plan(uuid, int, date, text[], boolean, uuid), public.set_medication_plan_status(uuid, text),
  public.record_dose(uuid, text), public.my_medication_plans() from public, anon;
grant execute on function public.create_medication_plan(uuid, int, date, text[], boolean, uuid), public.set_medication_plan_status(uuid, text),
  public.record_dose(uuid, text), public.my_medication_plans() to authenticated;
revoke execute on function public.dispatch_due_reminders() from public, anon, authenticated;
grant execute on function public.dispatch_due_reminders() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('dispatch-due-reminders', '* * * * *', 'select public.dispatch_due_reminders()');
  end if;
end $$;
