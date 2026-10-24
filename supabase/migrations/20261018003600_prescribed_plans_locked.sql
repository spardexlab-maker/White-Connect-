-- Patient medicines (owner request, 24 Oct 2026):
--  * reminders that come from the doctor's prescription are the doctor's
--    schedule: the patient cannot pause, stop or change them (the doctor
--    revises the prescription instead — the old plan is cancelled then);
--  * medicines the patient added for themselves stay fully editable: name,
--    times / every N hours, course length, instructions.
-- Also: resuming a paused plan now re-creates the reminders it cancelled
-- (they used to collide with the cancelled rows and never came back).

create or replace function private.reschedule_plan(p_plan_id uuid)
returns int language plpgsql security definer set search_path = '' as $$
begin
  -- future reminders nobody answered can simply be re-made
  delete from public.reminder_jobs
   where plan_id = p_plan_id and scheduled_at > now() and dose_status is null and status in ('pending', 'cancelled');
  return private.generate_reminder_jobs(p_plan_id);
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
  if p.prescription_id is not null then perform private.fail('prescribed_plan_locked'); end if;
  if p_status not in ('active', 'paused', 'stopped') or p.status in ('cancelled', 'completed', 'stopped') then perform private.fail('invalid_transition'); end if;
  update public.medication_plans set status = p_status where id = p.id;
  if p_status in ('paused', 'stopped') then
    update public.reminder_jobs set status = 'cancelled' where plan_id = p.id and status = 'pending';
  else
    perform private.reschedule_plan(p.id);
  end if;
end;
$$;

-- edit a medicine the patient added for themselves
create or replace function public.update_own_medication_plan(
  p_plan_id uuid,
  p_name text,
  p_times text[],
  p_interval_hours int default null,
  p_days int default null,                 -- null = ongoing (counted from the original start)
  p_instructions text default null
) returns public.medication_plans
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.medication_plans;
begin
  select * into p from public.medication_plans where id = p_plan_id for update;
  if p.id is null or not private.is_linked_to_patient(p.patient_id) then perform private.fail('forbidden'); end if;
  if p.prescription_id is not null then perform private.fail('prescribed_plan_locked'); end if;
  if p.status not in ('active', 'paused') then perform private.fail('invalid_transition'); end if;
  if p_name is null or length(trim(p_name)) = 0 then perform private.fail('invalid_input'); end if;
  if p_times is null or cardinality(p_times) not between 1 and 12 then perform private.fail('times_required'); end if;
  if p_days is not null and p_days not between 1 and 365 then perform private.fail('invalid_input'); end if;
  if p_interval_hours is not null and p_interval_hours not between 1 and 24 then perform private.fail('invalid_input'); end if;
  update public.medication_plans
     set display_name = trim(p_name),
         times_local = (select array_agg(distinct t::time order by t::time) from unnest(p_times) t),
         interval_hours = p_interval_hours,
         end_date = case when p_days is null then null else greatest(start_date + p_days - 1, start_date) end,
         instructions = nullif(trim(coalesce(p_instructions, '')), '')
   where id = p.id
  returning * into p;
  if p.status = 'active' then perform private.reschedule_plan(p.id); end if;
  perform private.audit('medication_plan.updated', 'medication_plan', p.id, null, p.patient_id, null, jsonb_build_object('source', 'patient'));
  return p;
end;
$$;

revoke execute on function public.update_own_medication_plan(uuid, text, text[], int, int, text) from public, anon;
grant execute on function public.update_own_medication_plan(uuid, text, text[], int, int, text) to authenticated;

-- patient view: also says whether the plan is the doctor's (locked) and its course length
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
      'prescribed', p.prescription_id is not null,
      'days', case when p.end_date is null then null else p.end_date - p.start_date + 1 end,
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
