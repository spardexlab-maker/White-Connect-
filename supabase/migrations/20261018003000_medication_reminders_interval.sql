-- Medication reminders, owner request (20 Oct 2026):
--  * the patient sets reminders "every N hours" (or at chosen times) for any
--    regular medicine, including ones not prescribed on the platform;
--  * each dose is recorded on the phone (taken / skipped);
--  * the treating doctor sees adherence: taken, skipped and missed doses.
-- Times are what the patient chooses; nothing is computed from the dose.

alter table public.medication_plans alter column prescription_id drop not null;
alter table public.medication_plans alter column version_id drop not null;
alter table public.medication_plans alter column line_no drop not null;
alter table public.medication_plans add column if not exists interval_hours int check (interval_hours between 1 and 24);
alter table public.medication_plans add column if not exists reported_medication_id uuid references public.patient_reported_medications (id);
alter table public.medication_plans drop constraint if exists medication_plans_rx_or_own;
alter table public.medication_plans add constraint medication_plans_rx_or_own
  check (prescription_id is not null and version_id is not null and line_no is not null or prescription_id is null and source = 'patient');

-- a patient-defined reminder (any medicine), every N hours from a first time or at given times
create or replace function public.create_own_medication_plan(
  p_patient_id uuid,
  p_name text,
  p_times text[],
  p_start_date date default null,
  p_days int default null,                 -- null = ongoing
  p_interval_hours int default null,
  p_instructions text default null,
  p_reported_medication_id uuid default null
) returns public.medication_plans
language plpgsql
security definer
set search_path = ''
as $$
declare
  pl public.medication_plans;
  st date := coalesce(p_start_date, (now() at time zone 'Asia/Baghdad')::date);
begin
  if not private.is_linked_to_patient(p_patient_id) then perform private.fail('forbidden'); end if;
  if p_name is null or length(trim(p_name)) = 0 then perform private.fail('invalid_input'); end if;
  if p_times is null or cardinality(p_times) not between 1 and 12 then perform private.fail('times_required'); end if;
  if p_days is not null and p_days not between 1 and 365 then perform private.fail('invalid_input'); end if;
  insert into public.medication_plans (patient_id, display_name, instructions, start_date, end_date, times_local, timezone,
                                       source, consent_at, created_by, interval_hours, reported_medication_id)
  values (p_patient_id, trim(p_name), nullif(trim(coalesce(p_instructions, '')), ''), st,
          case when p_days is null then null else st + p_days - 1 end,
          (select array_agg(t::time order by t::time) from unnest(p_times) t), 'Asia/Baghdad',
          'patient', now(), auth.uid(), p_interval_hours, p_reported_medication_id)
  returning * into pl;
  perform private.generate_reminder_jobs(pl.id);
  perform private.audit('medication_plan.created', 'medication_plan', pl.id, null, p_patient_id, null, jsonb_build_object('source', 'patient'));
  return pl;
end;
$$;

-- ongoing plans get their next 30 days of reminders topped up daily
create or replace function private.top_up_open_plans()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int := 0;
  p record;
begin
  for p in select id from public.medication_plans where status = 'active' and not as_needed loop
    n := n + private.generate_reminder_jobs(p.id);
  end loop;
  return n;
end;
$$;
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'top-up-reminders';
    perform cron.schedule('top-up-reminders', '17 1 * * *', 'select private.top_up_open_plans()');
  end if;
end $$;

-- adherence for the patient and the treating doctor (doctor reads are audited)
create or replace function public.medication_adherence(p_patient_id uuid, p_days int default 14)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  since timestamptz := now() - make_interval(days => least(greatest(coalesce(p_days, 14), 1), 90));
begin
  if not (private.is_linked_to_patient(p_patient_id) or private.treats_patient(p_patient_id)) then perform private.fail('forbidden'); end if;
  if not private.is_linked_to_patient(p_patient_id) then
    perform private.audit('medication_adherence.viewed', 'patient', p_patient_id, null, p_patient_id);
  end if;
  return coalesce((select jsonb_agg(x order by x.status = 'active' desc, x.display_name) from (
    select pl.id, pl.display_name, pl.status, pl.source, pl.interval_hours, pl.start_date, pl.end_date,
           (select array_agg(to_char(t, 'HH24:MI') order by t) from unnest(pl.times_local) t) as times,
           count(j.id) filter (where j.scheduled_at <= now()) as due,
           count(j.id) filter (where j.dose_status = 'taken') as taken,
           count(j.id) filter (where j.dose_status = 'skipped') as skipped,
           count(j.id) filter (where j.scheduled_at < now() - interval '2 hours' and j.dose_status is null and j.status <> 'cancelled') as missed,
           max(j.dose_recorded_at) filter (where j.dose_status = 'taken') as last_taken_at,
           coalesce(jsonb_agg(jsonb_build_object('at', j.scheduled_at,
                      'state', case when j.dose_status = 'taken' then 'taken' when j.dose_status = 'skipped' then 'skipped'
                                    when j.scheduled_at < now() - interval '2 hours' and j.status <> 'cancelled' then 'missed' else 'pending' end)
                      order by j.scheduled_at) filter (where j.scheduled_at <= now() and j.scheduled_at > now() - interval '7 days'), '[]'::jsonb) as recent
      from public.medication_plans pl
      left join public.reminder_jobs j on j.plan_id = pl.id and j.scheduled_at >= since and j.scheduled_at <= now() + interval '1 day'
     where pl.patient_id = p_patient_id and (pl.status in ('active', 'paused') or pl.updated_at >= since)
     group by pl.id) x), '[]'::jsonb);
end;
$$;

revoke execute on function public.create_own_medication_plan(uuid, text, text[], date, int, int, text, uuid), public.medication_adherence(uuid, int) from public, anon;
grant execute on function public.create_own_medication_plan(uuid, text, text[], date, int, int, text, uuid), public.medication_adherence(uuid, int) to authenticated;
