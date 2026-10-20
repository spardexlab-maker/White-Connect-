-- Owner requests (20 Oct 2026):
--  1) A doctor can keep several sessions open: pause one (patient sent for a
--     test / x-ray) and see the next patient, then resume. Exactly one
--     session per doctor is ACTIVE (in_progress and not paused) at a time.
--  2) Patient medical card for treating doctors: any doctor the patient is
--     booked with / queued for / in a session with sees the patient's
--     visits (signed notes only), released lab results and approved
--     prescriptions from all doctors. Every opening is audited.
--  3) A prescription is approved and printed for the patient (stamped by
--     the doctor); sending it to a pharmacy is optional and can also be
--     done after approval.

-- ---------------------------------------------------------------------
-- 1) paused sessions
-- ---------------------------------------------------------------------
alter table public.encounters add column if not exists paused_at timestamptz;
alter table public.encounters add column if not exists pause_reason text;

create or replace function public.start_encounter(
  p_queue_entry_id uuid,
  p_identity_verified boolean
) returns public.encounters
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.queue_entries;
  me uuid := private.current_practitioner_id();
  enc public.encounters;
begin
  select * into q from public.queue_entries where id = p_queue_entry_id for update;
  if q.id is null then perform private.fail('not_found'); end if;
  if me is null or q.practitioner_id is distinct from me
     or not private.has_facility_role(q.facility_id, array['doctor']::public.member_role[]) then
    perform private.fail('forbidden');
  end if;
  if not p_identity_verified then perform private.fail('verification_required'); end if;

  select * into enc from public.encounters where queue_entry_id = q.id;
  if enc.id is not null then return enc; end if;               -- idempotent

  if q.status not in ('waiting', 'called') then perform private.fail('invalid_transition'); end if;
  -- one ACTIVE session per doctor at a time; paused sessions don't count
  if exists (select 1 from public.encounters where practitioner_id = me and status = 'in_progress' and paused_at is null) then
    perform private.fail('another_session_in_progress');
  end if;

  insert into public.encounters (patient_id, facility_id, practitioner_id, appointment_id, queue_entry_id,
                                 status, started_at, identity_verified, created_by)
  values (q.patient_id, q.facility_id, me, q.appointment_id, q.id, 'in_progress', now(), true, auth.uid())
  returning * into enc;
  update public.queue_entries set status = 'in_session', started_at = now() where id = q.id;
  insert into public.clinical_notes (encounter_id, version_no, created_by) values (enc.id, 1, auth.uid());
  insert into public.care_relationships (patient_id, facility_id, practitioner_id, source, created_by)
  values (q.patient_id, q.facility_id, me, 'appointment', auth.uid()) on conflict do nothing;
  perform private.audit('encounter.started', 'encounter', enc.id, enc.facility_id, enc.patient_id);
  return enc;
end;
$$;

-- Pause the doctor's own active session (e.g. patient sent for a test).
create or replace function public.pause_encounter(p_encounter_id uuid, p_reason text default null)
returns public.encounters
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.encounters;
begin
  if not private.is_encounter_author(p_encounter_id) then perform private.fail('forbidden'); end if;
  select * into e from public.encounters where id = p_encounter_id for update;
  if e.status <> 'in_progress' then perform private.fail('invalid_transition'); end if;
  if e.paused_at is not null then return e; end if;           -- idempotent
  update public.encounters set paused_at = now(), pause_reason = nullif(trim(coalesce(p_reason, '')), '')
   where id = e.id returning * into e;
  perform private.audit('encounter.paused', 'encounter', e.id, e.facility_id, e.patient_id, e.pause_reason);
  return e;
end;
$$;

-- Resume a paused session. Whatever session is active at that moment is
-- paused automatically, so switching between patients is one action.
create or replace function public.resume_encounter(p_encounter_id uuid)
returns public.encounters
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.encounters;
  other public.encounters;
begin
  if not private.is_encounter_author(p_encounter_id) then perform private.fail('forbidden'); end if;
  select * into e from public.encounters where id = p_encounter_id for update;
  if e.status <> 'in_progress' then perform private.fail('invalid_transition'); end if;
  if e.paused_at is null then return e; end if;               -- idempotent
  for other in
    select * from public.encounters
     where practitioner_id = e.practitioner_id and status = 'in_progress' and paused_at is null and id <> e.id
     for update
  loop
    update public.encounters set paused_at = now(), pause_reason = 'تبديل إلى مريض آخر' where id = other.id;
    perform private.audit('encounter.paused', 'encounter', other.id, other.facility_id, other.patient_id, 'switch');
  end loop;
  update public.encounters set paused_at = null, pause_reason = null where id = e.id returning * into e;
  perform private.audit('encounter.resumed', 'encounter', e.id, e.facility_id, e.patient_id);
  return e;
end;
$$;

revoke execute on function public.pause_encounter(uuid, text), public.resume_encounter(uuid) from public, anon;
grant execute on function public.pause_encounter(uuid, text), public.resume_encounter(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2) medical card
-- ---------------------------------------------------------------------
-- The current doctor treats this patient: an open care relationship, a
-- live appointment, or a queue entry with them.
create or replace function private.treats_patient(p_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.practitioner_profiles pp
     where pp.id = private.current_practitioner_id() and pp.status = 'active'
       and (
         exists (select 1 from public.care_relationships c
                  where c.patient_id = p_patient_id and c.practitioner_id = pp.id and c.ended_at is null
                    and private.has_facility_role(c.facility_id, array['doctor']::public.member_role[]))
         or exists (select 1 from public.appointments a
                     where a.patient_id = p_patient_id and a.practitioner_id = pp.id
                       and a.status in ('awaiting_confirmation', 'confirmed', 'checked_in', 'fulfilled')
                       and private.has_facility_role(a.facility_id, array['doctor']::public.member_role[]))
         or exists (select 1 from public.queue_entries q
                     where q.patient_id = p_patient_id and q.practitioner_id = pp.id and q.status <> 'cancelled'
                       and private.has_facility_role(q.facility_id, array['doctor']::public.member_role[]))
       )
  );
$$;

create or replace function public.patient_medical_card(p_patient_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.patients;
begin
  if not private.treats_patient(p_patient_id) then perform private.fail('forbidden'); end if;
  select * into p from public.patients where id = p_patient_id;
  if p.id is null then perform private.fail('not_found'); end if;
  perform private.audit('medical_card.viewed', 'patient', p.id, null, p.id);
  return jsonb_build_object(
    'patient', jsonb_build_object('id', p.id, 'public_code', p.public_code, 'full_name', p.full_name, 'sex', p.sex,
                                  'birth_year', coalesce(p.birth_year, extract(year from p.birth_date)::int)),
    'allergies_recorded', exists (select 1 from public.allergies a where a.patient_id = p.id),
    'allergies', coalesce((select jsonb_agg(jsonb_build_object('substance', a.substance, 'reaction', a.reaction, 'severity', a.severity)
                                    order by a.created_at)
                             from public.allergies a where a.patient_id = p.id and a.status = 'active'), '[]'::jsonb),
    -- visits by every doctor; only SIGNED notes are shared (drafts stay private to their author)
    'visits', coalesce((select jsonb_agg(v order by v.started_at desc) from (
        select e.id as encounter_id, e.started_at, e.status, f.name as facility, pp.full_name as doctor, s.name_ar as specialty,
               n.reason_for_visit, n.assessment, n.plan, n.follow_up, n.vitals, n.signed_at
          from public.encounters e
          join public.facilities f on f.id = e.facility_id
          join public.practitioner_profiles pp on pp.id = e.practitioner_id
          left join public.specialties s on s.id = pp.specialty_id
          left join lateral (select * from public.clinical_notes cn where cn.encounter_id = e.id and cn.status = 'signed'
                              order by cn.version_no desc limit 1) n on true
         where e.patient_id = p.id and e.started_at is not null
         order by e.started_at desc limit 100) v), '[]'::jsonb),
    'labs', coalesce((select jsonb_agg(l order by l.released_at desc) from (
        select i.display_name as test, r.value_text, r.value_numeric, r.unit, r.reference_range, r.lab_flag, r.notes,
               r.released_at, lf.name as lab, pp.full_name as ordered_by
          from public.lab_results r
          join public.lab_order_items i on i.id = r.order_item_id
          join public.lab_orders o on o.id = i.order_id
          join public.facilities lf on lf.id = o.lab_facility_id
          left join public.practitioner_profiles pp on pp.id = o.ordering_practitioner_id
         where o.patient_id = p.id and r.status = 'released'
         order by r.released_at desc limit 200) l), '[]'::jsonb),
    'prescriptions', coalesce((select jsonb_agg(x order by x.approved_at desc) from (
        select rx.id as prescription_id, rx.rx_number, v.approved_at, pp.full_name as doctor, f.name as facility,
               (select jsonb_agg(jsonb_build_object('name', it.display_name, 'dose', it.dose, 'dose_unit', it.dose_unit,
                                                    'frequency', it.frequency_text, 'duration_days', it.duration_days,
                                                    'instructions', it.instructions) order by it.line_no)
                  from public.prescription_items it where it.version_id = v.id) as items
          from public.prescriptions rx
          join public.prescription_versions v on v.id = rx.current_version_id and v.status = 'approved'
          join public.practitioner_profiles pp on pp.id = rx.practitioner_id
          join public.facilities f on f.id = rx.facility_id
         where rx.patient_id = p.id and rx.status = 'active'
         order by v.approved_at desc limit 100) x), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.patient_medical_card(uuid) from public, anon;
grant execute on function public.patient_medical_card(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3) send an approved prescription to a pharmacy (optional, later)
-- ---------------------------------------------------------------------
create or replace function public.send_prescription_to_pharmacy(p_prescription_id uuid, p_pharmacy_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rx public.prescriptions;
  pharm public.facilities;
begin
  select * into rx from public.prescriptions where id = p_prescription_id for update;
  if rx.id is null or not private.is_rx_author(rx.id) then perform private.fail('forbidden'); end if;
  if rx.status <> 'active' or rx.current_version_id is null then perform private.fail('invalid_transition'); end if;
  select * into pharm from public.facilities where id = p_pharmacy_id and type = 'pharmacy' and status = 'active';
  if pharm.id is null then perform private.fail('invalid_pharmacy'); end if;
  if exists (select 1 from public.prescription_dispatches where prescription_id = rx.id and pharmacy_id = pharm.id and status <> 'cancelled') then
    return;                                                    -- already sent: idempotent
  end if;
  insert into public.prescription_dispatches (prescription_id, pharmacy_id, version_id, sent_by)
  values (rx.id, pharm.id, rx.current_version_id, auth.uid())
  on conflict (prescription_id, pharmacy_id) do update
    set version_id = excluded.version_id, status = 'sent', received_at = null, updated_at = now();
  insert into public.prescription_events (prescription_id, version_id, event, facility_id, actor_user_id)
  values (rx.id, rx.current_version_id, 'sent', pharm.id, auth.uid());
  insert into public.care_relationships (patient_id, facility_id, source, created_by)
  values (rx.patient_id, pharm.id, 'pharmacy', auth.uid()) on conflict do nothing;
  perform private.audit('prescription.sent', 'prescription', rx.id, rx.facility_id, rx.patient_id, null,
                        jsonb_build_object('pharmacy_id', pharm.id));
end;
$$;

revoke execute on function public.send_prescription_to_pharmacy(uuid, uuid) from public, anon;
grant execute on function public.send_prescription_to_pharmacy(uuid, uuid) to authenticated;
