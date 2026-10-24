-- Doctor session changes (owner request, 24 Oct 2026):
--  * a diagnosis (the note's «التقييم / التشخيص») is required before a
--    prescription is approved and before the session is completed;
--  * the doctor can reopen a finished session of theirs (e.g. the pharmacy asks
--    about a medicine, or the patient comes back): it becomes active again, so
--    the prescription can be revised — the new version replaces the old one and
--    the old version's reminders are cancelled (existing revision rules);
--  * the doctor can book the patient's next visit from the session; the patient
--    sees it in «حجوزاتي» and gets a notification.

alter table public.encounters add column if not exists reopened_at timestamptz;
alter table public.encounters add column if not exists reopen_reason text;
alter table public.encounters add column if not exists reopen_count int not null default 0;

create or replace function private.encounter_has_diagnosis(p_encounter_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.clinical_notes n
                  where n.encounter_id = p_encounter_id and n.status <> 'superseded'
                    and length(trim(coalesce(n.assessment, ''))) > 0);
$$;

create or replace function private.require_diagnosis_on_rx()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'approved' and old.status = 'draft'
     and not private.encounter_has_diagnosis((select r.encounter_id from public.prescriptions r where r.id = new.prescription_id)) then
    perform private.fail('diagnosis_required');
  end if;
  return new;
end;
$$;
create trigger prescription_versions_require_diagnosis before update of status on public.prescription_versions
  for each row execute function private.require_diagnosis_on_rx();

create or replace function private.require_diagnosis_on_complete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' and not private.encounter_has_diagnosis(new.id) then
    perform private.fail('diagnosis_required');
  end if;
  return new;
end;
$$;
create trigger encounters_require_diagnosis before update of status on public.encounters
  for each row execute function private.require_diagnosis_on_complete();

-- reopen a finished session (author only, within 30 days); it comes back active
-- and any other running session of the doctor is paused automatically
create or replace function public.reopen_encounter(p_encounter_id uuid, p_reason text)
returns public.encounters
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.encounters;
begin
  if not private.is_encounter_author(p_encounter_id) then perform private.fail('forbidden'); end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then perform private.fail('reason_required'); end if;
  select * into e from public.encounters where id = p_encounter_id for update;
  if e.status not in ('completed', 'closed', 'awaiting_results', 'ready_for_review') then perform private.fail('invalid_transition'); end if;
  if coalesce(e.ended_at, e.started_at) < now() - interval '30 days' then perform private.fail('reopen_window_passed'); end if;
  update public.encounters
     set status = 'in_progress', paused_at = now(), pause_reason = 'أُعيد فتحها للتعديل',
         reopened_at = now(), reopen_reason = trim(p_reason), reopen_count = reopen_count + 1
   where id = e.id;
  perform private.audit('encounter.reopened', 'encounter', e.id, e.facility_id, e.patient_id, trim(p_reason), jsonb_build_object('from', e.status));
  return public.resume_encounter(e.id);
end;
$$;

-- the doctor's own recent sessions (to reopen one)
create or replace function public.my_recent_encounters(p_days int default 30)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', e.id, 'status', e.status, 'started_at', e.started_at, 'ended_at', e.ended_at, 'paused_at', e.paused_at,
      'patient_name', p.full_name, 'public_code', p.public_code, 'facility', f.name, 'reopen_count', e.reopen_count,
      'diagnosis', (select n.assessment from public.clinical_notes n where n.encounter_id = e.id and n.status <> 'superseded'
                     order by n.version_no desc limit 1),
      'prescriptions', (select count(*) from public.prescriptions r where r.encounter_id = e.id and r.status = 'active'))
      order by coalesce(e.ended_at, e.started_at) desc), '[]'::jsonb)
    from public.encounters e
    join public.patients p on p.id = e.patient_id
    join public.facilities f on f.id = e.facility_id
   where e.practitioner_id = private.current_practitioner_id()
     and e.status in ('completed', 'closed', 'awaiting_results', 'ready_for_review')
     and coalesce(e.ended_at, e.started_at) > now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 90));
$$;

-- book the patient's next visit with this doctor, from the session
create or replace function public.book_follow_up(p_encounter_id uuid, p_start timestamptz, p_service_id uuid default null, p_note text default null)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.encounters;
  svc uuid := p_service_id;
  appt public.appointments;
begin
  if not private.is_encounter_author(p_encounter_id) then perform private.fail('forbidden'); end if;
  select * into e from public.encounters where id = p_encounter_id;
  if p_start <= now() then perform private.fail('invalid_input'); end if;
  if svc is null then
    select s.id into svc from public.clinic_services s
     where s.facility_id = e.facility_id and s.is_active and (s.practitioner_id = e.practitioner_id or s.practitioner_id is null)
     order by (s.practitioner_id is not null) desc, s.duration_minutes limit 1;
  end if;
  if svc is null then perform private.fail('followup_service_missing'); end if;
  appt := private.insert_appointment(e.patient_id, e.facility_id, e.practitioner_id, svc, p_start, 'reception',
                                     'followup:' || e.id || ':' || extract(epoch from p_start)::bigint, false, 'confirmed', null,
                                     coalesce(nullif(trim(coalesce(p_note, '')), ''), 'موعد مراجعة حدّده الطبيب'));
  perform private.notify_patient(e.patient_id, 'appointment.followup', jsonb_build_object('booking_number', appt.booking_number, 'starts_at', lower(appt.period)),
                                 'followup:' || appt.id, array['in_app', 'push']::public.notification_channel[]);
  perform private.audit('appointment.followup_booked', 'appointment', appt.id, e.facility_id, e.patient_id, null, jsonb_build_object('encounter', e.id));
  return appt;
end;
$$;

revoke execute on function public.reopen_encounter(uuid, text), public.my_recent_encounters(int), public.book_follow_up(uuid, timestamptz, uuid, text) from public, anon;
grant execute on function public.reopen_encounter(uuid, text), public.my_recent_encounters(int), public.book_follow_up(uuid, timestamptz, uuid, text) to authenticated;
