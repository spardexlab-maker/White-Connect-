-- Prescribed medicines → reminders → intake the doctor can see (owner request, 22 Oct 2026):
--  * when the doctor sets "every N hours" on an approved prescription, the patient
--    sees it as «فعّل التذكير» and only picks the first dose time (the rest follows
--    the doctor's interval) — the patient's tap is still the consent;
--  * each dose is logged with WHEN and HOW MUCH (e.g. 1 tablet), from the app or
--    straight from the reminder notification;
--  * the treating doctor sees taken / skipped / missed doses with times and amounts.

alter table public.medication_plans add column if not exists dose numeric(10, 3);
alter table public.medication_plans add column if not exists dose_unit text;
alter table public.reminder_jobs add column if not exists dose_amount numeric(10, 3);

-- a prescription plan carries the prescribed dose per intake
create or replace function private.fill_plan_dose()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.dose is null and new.version_id is not null then
    select i.dose, i.dose_unit, coalesce(new.interval_hours, i.interval_hours)
      into new.dose, new.dose_unit, new.interval_hours
      from public.prescription_items i where i.version_id = new.version_id and i.line_no = new.line_no;
  end if;
  return new;
end;
$$;
drop trigger if exists medication_plans_fill_dose on public.medication_plans;
create trigger medication_plans_fill_dose before insert on public.medication_plans
  for each row execute function private.fill_plan_dose();

-- the patient's prescribed medicines that still have no reminder plan
create or replace function public.rx_pending_reminders()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'prescription_id', r.id, 'rx_number', r.rx_number, 'line_no', i.line_no, 'display_name', i.display_name,
      'dose', i.dose, 'dose_unit', i.dose_unit, 'frequency_text', i.frequency_text, 'interval_hours', i.interval_hours,
      'duration_days', i.duration_days, 'instructions', i.instructions, 'approved_at', v.approved_at,
      'doctor', pp.full_name, 'patient_id', r.patient_id, 'patient_name', pt.full_name)
      order by v.approved_at desc, i.line_no), '[]'::jsonb)
    from public.prescriptions r
    join public.prescription_versions v on v.id = r.current_version_id and v.status = 'approved'
    join public.prescription_items i on i.version_id = v.id and not i.as_needed
    join public.practitioner_profiles pp on pp.id = r.practitioner_id
    join public.patients pt on pt.id = r.patient_id
   where r.status = 'active'
     and private.is_linked_to_patient(r.patient_id)
     and v.approved_at > now() - make_interval(days => coalesce(i.duration_days, 30) + 2)
     and not exists (select 1 from public.medication_plans p
                      where p.prescription_id = r.id and p.line_no = i.line_no and p.patient_id = r.patient_id);
$$;

-- log a dose with the amount taken (default: the prescribed dose)
create or replace function public.log_dose(p_job_id uuid, p_status text, p_amount numeric default null)
returns jsonb
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
  if p_amount is not null and (p_amount <= 0 or p_amount > 100) then perform private.fail('invalid_input'); end if;
  if p_status = 'snoozed' then
    if j.snooze_count >= 3 then perform private.fail('snooze_limit'); end if;
    update public.reminder_jobs set dose_status = 'snoozed', snooze_count = snooze_count + 1, status = 'pending',
           scheduled_at = greatest(now(), scheduled_at) + interval '15 minutes', queued_at = null
     where id = j.id
    returning * into j;
  else
    update public.reminder_jobs set dose_status = p_status, dose_recorded_at = now(),
           dose_amount = case when p_status = 'taken' then coalesce(p_amount, p.dose, 1) end,
           status = case when status = 'pending' then 'cancelled' else status end
     where id = j.id
    returning * into j;
  end if;
  return jsonb_build_object('id', j.id, 'dose_status', j.dose_status, 'scheduled_at', j.scheduled_at,
                            'dose_amount', j.dose_amount, 'dose_unit', p.dose_unit, 'display_name', p.display_name);
end;
$$;

-- the next few days of doses for the phone to schedule (survives the app not being opened)
create or replace function public.my_upcoming_doses(p_hours int default 72)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', j.id, 'scheduled_at', j.scheduled_at, 'dose_status', j.dose_status,
                                               'display_name', p.display_name, 'dose', p.dose, 'dose_unit', p.dose_unit)
                            order by j.scheduled_at), '[]'::jsonb)
    from public.reminder_jobs j join public.medication_plans p on p.id = j.plan_id
   where p.status = 'active' and not p.as_needed and private.is_linked_to_patient(p.patient_id)
     and j.status <> 'cancelled' and j.dose_status is distinct from 'taken' and j.dose_status is distinct from 'skipped'
     and j.scheduled_at > now() - interval '5 minutes'
     and j.scheduled_at < now() + make_interval(hours => least(greatest(coalesce(p_hours, 72), 1), 168));
$$;

-- adherence for the patient and the treating doctor, now with amounts and times
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
           pl.dose, pl.dose_unit, (pl.prescription_id is not null) as prescribed,
           (select pp.full_name from public.prescriptions r join public.practitioner_profiles pp on pp.id = r.practitioner_id
             where r.id = pl.prescription_id) as prescribed_by,
           (select array_agg(to_char(t, 'HH24:MI') order by t) from unnest(pl.times_local) t) as times,
           count(j.id) filter (where j.scheduled_at <= now()) as due,
           count(j.id) filter (where j.dose_status = 'taken') as taken,
           count(j.id) filter (where j.dose_status = 'skipped') as skipped,
           count(j.id) filter (where j.scheduled_at < now() - interval '2 hours' and j.dose_status is null and j.status <> 'cancelled') as missed,
           coalesce(sum(j.dose_amount) filter (where j.dose_status = 'taken'), 0) as taken_amount,
           max(j.dose_recorded_at) filter (where j.dose_status = 'taken') as last_taken_at,
           coalesce(jsonb_agg(jsonb_build_object('at', j.scheduled_at, 'recorded_at', j.dose_recorded_at, 'amount', j.dose_amount,
                      'state', case when j.dose_status = 'taken' then 'taken' when j.dose_status = 'skipped' then 'skipped'
                                    when j.scheduled_at < now() - interval '2 hours' and j.status <> 'cancelled' then 'missed' else 'pending' end)
                      order by j.scheduled_at) filter (where j.scheduled_at <= now() and j.scheduled_at > now() - interval '7 days'), '[]'::jsonb) as recent
      from public.medication_plans pl
      left join public.reminder_jobs j on j.plan_id = pl.id and j.scheduled_at >= since and j.scheduled_at <= now() + interval '1 day'
     where pl.patient_id = p_patient_id and (pl.status in ('active', 'paused') or pl.updated_at >= since)
     group by pl.id) x), '[]'::jsonb);
end;
$$;

revoke execute on function public.rx_pending_reminders(), public.log_dose(uuid, text, numeric), public.my_upcoming_doses(int) from public, anon;
grant execute on function public.rx_pending_reminders(), public.log_dose(uuid, text, numeric), public.my_upcoming_doses(int) to authenticated;

-- patient view: plans with the prescribed dose and each logged dose (time + amount), last 2 days → next 36 h
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
      'patient_name', pt.full_name, 'dose', p.dose, 'dose_unit', p.dose_unit, 'interval_hours', p.interval_hours,
      'prescribed_by', (select pp.full_name from public.prescriptions r join public.practitioner_profiles pp on pp.id = r.practitioner_id where r.id = p.prescription_id),
      'doses', coalesce((select jsonb_agg(jsonb_build_object('id', j.id, 'scheduled_at', j.scheduled_at, 'status', j.status,
                                         'dose_status', j.dose_status, 'snooze_count', j.snooze_count,
                                         'dose_amount', j.dose_amount, 'recorded_at', j.dose_recorded_at) order by j.scheduled_at)
                          from public.reminder_jobs j
                         where j.plan_id = p.id and j.scheduled_at >= now() - interval '48 hours' and j.scheduled_at < now() + interval '36 hours'), '[]'::jsonb))
      order by p.status <> 'active', p.created_at desc), '[]'::jsonb)
    from public.medication_plans p join public.patients pt on pt.id = p.patient_id
   where private.is_linked_to_patient(p.patient_id);
$$;

-- older app versions still call record_dose: same behaviour, now also storing the prescribed amount
create or replace function public.record_dose(p_job_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.log_dose(p_job_id, p_status, null);
end;
$$;
