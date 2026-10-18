-- =====================================================================
-- 0010 Clinical core (Phase 3): encounters, clinical notes (versioned,
-- signed = locked), allergies, patient-reported medications, clinical
-- review tasks.
--
-- Access rule for clinical records (§2, §3, §8):
--   * the authoring practitioner (while still working at that facility),
--   * the patient / guardian — only PUBLISHED content (signed summary
--     fields are not published in v1; drafts and internal notes never),
--   * other practitioners ONLY through a live consent grant.
--   Receptionists, pharmacies, labs, facility/org admins and platform
--   admins have no access to notes.
-- =====================================================================

create type public.encounter_status as enum
  ('not_started', 'in_progress', 'awaiting_results', 'ready_for_review', 'completed', 'closed');

create table public.encounters (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id),
  facility_id uuid not null references public.facilities (id),
  practitioner_id uuid not null references public.practitioner_profiles (id),
  appointment_id uuid unique references public.appointments (id),
  queue_entry_id uuid unique references public.queue_entries (id),
  follow_up_of uuid references public.encounters (id),       -- same care episode
  status public.encounter_status not null default 'in_progress',
  started_at timestamptz,                                      -- set ONLY by the doctor's action
  ended_at timestamptz,
  identity_verified boolean not null default false,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1,
  check (ended_at is null or started_at is not null and ended_at >= started_at)
);
create index encounters_patient_idx on public.encounters (patient_id, created_at desc);
create index encounters_practitioner_idx on public.encounters (practitioner_id, created_at desc);
create trigger encounters_touch before update on public.encounters
  for each row execute function private.touch_row();

create table public.clinical_notes (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters (id),
  version_no int not null,
  status text not null default 'draft' check (status in ('draft', 'signed', 'superseded')),
  reason_for_visit text,
  history text,
  examination text,
  assessment text,
  plan text,
  follow_up text,
  vitals jsonb not null default '{}'::jsonb,       -- {bp_sys, bp_dia, pulse, temp_c, spo2, weight_kg, height_cm}
  free_text text,
  signed_at timestamptz,
  signed_by uuid references public.profiles (id),
  supersedes_id uuid references public.clinical_notes (id),
  correction_reason text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1,
  unique (encounter_id, version_no),
  check (status <> 'signed' or signed_at is not null),
  check (supersedes_id is null or correction_reason is not null)
);
create unique index clinical_notes_one_draft on public.clinical_notes (encounter_id) where status = 'draft';
create trigger clinical_notes_touch before update on public.clinical_notes
  for each row execute function private.touch_row();

-- signed notes are immutable (only status → superseded is allowed)
create or replace function private.protect_signed_notes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status in ('signed', 'superseded') then
    if new.status = 'superseded' and old.status = 'signed'
       and (new.reason_for_visit, new.history, new.examination, new.assessment, new.plan, new.follow_up, new.vitals, new.free_text)
           is not distinct from
           (old.reason_for_visit, old.history, old.examination, old.assessment, old.plan, old.follow_up, old.vitals, old.free_text) then
      return new;
    end if;
    perform private.fail('signed_record_locked');
  end if;
  return new;
end;
$$;
create trigger clinical_notes_lock before update on public.clinical_notes
  for each row execute function private.protect_signed_notes();
create or replace function private.forbid_delete()
returns trigger language plpgsql set search_path = '' as $$
begin perform private.fail('delete_not_allowed'); return null; end; $$;
create trigger clinical_notes_no_delete before delete on public.clinical_notes
  for each row execute function private.forbid_delete();

create table public.allergies (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id),
  substance text not null check (length(trim(substance)) > 0),
  reaction text,
  severity text check (severity in ('mild', 'moderate', 'severe')),
  status text not null default 'active' check (status in ('active', 'resolved', 'entered_in_error')),
  source text not null check (source in ('clinician', 'patient_reported')),
  recorded_by uuid not null references public.profiles (id),
  recorded_by_practitioner_id uuid references public.practitioner_profiles (id),
  facility_id uuid references public.facilities (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1
);
create index allergies_patient_idx on public.allergies (patient_id);
create trigger allergies_touch before update on public.allergies
  for each row execute function private.touch_row();

create table public.patient_reported_medications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id),
  name text not null,
  dose_text text,
  started_on date,
  stopped_on date,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.clinical_tasks (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioner_profiles (id),
  patient_id uuid not null references public.patients (id),
  facility_id uuid references public.facilities (id),
  kind text not null check (kind in ('review_lab_result', 'review_corrected_result', 'follow_up')),
  lab_order_id uuid,
  encounter_id uuid references public.encounters (id),
  status text not null default 'open' check (status in ('open', 'done')),
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index clinical_tasks_open_idx on public.clinical_tasks (practitioner_id) where status = 'open';

-- =====================================================================
-- Access helpers
-- =====================================================================

-- consent grant for the current practitioner (scope or full history)
create or replace function private.has_consent(p_patient_id uuid, p_scope text, p_resource_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_practitioner_id() is not null and exists (
    select 1 from public.consent_grants g
     where g.patient_id = p_patient_id and g.revoked_at is null and g.starts_at <= now()
       and (g.expires_at is null or g.expires_at > now())
       and (g.scope = 'full_history' or (g.scope = p_scope and g.resource_id = p_resource_id))
       and (g.grantee_practitioner_id = private.current_practitioner_id()
            or (g.grantee_facility_id is not null
                and private.has_facility_role(g.grantee_facility_id, array['doctor']::public.member_role[]))));
$$;

-- practitioner may work on this encounter: its author, still a doctor there
create or replace function private.is_encounter_author(p_encounter_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.encounters e
     where e.id = p_encounter_id
       and e.practitioner_id = private.current_practitioner_id()
       and private.has_facility_role(e.facility_id, array['doctor']::public.member_role[]));
$$;

create or replace function private.can_read_encounter(p_encounter_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_encounter_author(p_encounter_id)
      or exists (select 1 from public.encounters e
                  where e.id = p_encounter_id
                    and (private.has_consent(e.patient_id, 'encounter', e.id)));
$$;

-- clinician-level read of patient safety data (allergies): own care
-- relationship as doctor, or consent.
create or replace function private.clinician_can_read_patient(p_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.practitioner_can_see_clinical(p_patient_id);
$$;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.encounters enable row level security;
alter table public.clinical_notes enable row level security;
alter table public.allergies enable row level security;
alter table public.patient_reported_medications enable row level security;
alter table public.clinical_tasks enable row level security;

-- patients see that a visit happened (metadata), never notes
create policy encounters_read on public.encounters for select to authenticated
  using (private.can_read_encounter(id) or private.is_linked_to_patient(patient_id));
create policy clinical_notes_read on public.clinical_notes for select to authenticated
  using (private.is_encounter_author(encounter_id)
         or (status = 'signed' and private.can_read_encounter(encounter_id)));
create policy allergies_read on public.allergies for select to authenticated
  using (private.is_linked_to_patient(patient_id) or private.clinician_can_read_patient(patient_id));
create policy prm_read on public.patient_reported_medications for select to authenticated
  using (private.is_linked_to_patient(patient_id) or private.clinician_can_read_patient(patient_id));
create policy clinical_tasks_read on public.clinical_tasks for select to authenticated
  using (practitioner_id = private.current_practitioner_id());

grant select on public.encounters, public.clinical_notes, public.allergies, public.patient_reported_medications,
  public.clinical_tasks to authenticated;

-- =====================================================================
-- RPCs
-- =====================================================================

-- Start a session: ONLY by the doctor pressing start, after choosing the
-- patient and confirming identity (§8). Time passing never starts it.
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
  -- one active session per doctor at a time
  if exists (select 1 from public.encounters where practitioner_id = me and status = 'in_progress') then
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

-- Autosave of the draft (optimistic concurrency via p_expected_version).
create or replace function public.save_clinical_note_draft(
  p_encounter_id uuid,
  p_fields jsonb,
  p_expected_version int default null
) returns public.clinical_notes
language plpgsql
security definer
set search_path = ''
as $$
declare
  n public.clinical_notes;
begin
  if not private.is_encounter_author(p_encounter_id) then perform private.fail('forbidden'); end if;
  select * into n from public.clinical_notes where encounter_id = p_encounter_id and status = 'draft' for update;
  if n.id is null then perform private.fail('no_draft'); end if;
  if p_expected_version is not null and n.version <> p_expected_version then perform private.fail('stale_version'); end if;
  update public.clinical_notes set
    reason_for_visit = coalesce(p_fields ->> 'reason_for_visit', reason_for_visit),
    history = coalesce(p_fields ->> 'history', history),
    examination = coalesce(p_fields ->> 'examination', examination),
    assessment = coalesce(p_fields ->> 'assessment', assessment),
    plan = coalesce(p_fields ->> 'plan', plan),
    follow_up = coalesce(p_fields ->> 'follow_up', follow_up),
    free_text = coalesce(p_fields ->> 'free_text', free_text),
    vitals = coalesce(p_fields -> 'vitals', vitals)
  where id = n.id returning * into n;
  return n;
end;
$$;

create or replace function public.sign_clinical_note(p_encounter_id uuid)
returns public.clinical_notes
language plpgsql
security definer
set search_path = ''
as $$
declare
  n public.clinical_notes;
begin
  if not private.is_encounter_author(p_encounter_id) then perform private.fail('forbidden'); end if;
  update public.clinical_notes set status = 'signed', signed_at = now(), signed_by = auth.uid()
   where encounter_id = p_encounter_id and status = 'draft' returning * into n;
  if n.id is null then perform private.fail('no_draft'); end if;
  perform private.audit('clinical_note.signed', 'clinical_note', n.id, null, null);
  return n;
end;
$$;

-- Correction = new signed version that supersedes; nothing is erased.
create or replace function public.amend_clinical_note(p_note_id uuid, p_fields jsonb, p_reason text)
returns public.clinical_notes
language plpgsql
security definer
set search_path = ''
as $$
declare
  old public.clinical_notes;
  n public.clinical_notes;
begin
  select * into old from public.clinical_notes where id = p_note_id for update;
  if old.id is null or old.status <> 'signed' then perform private.fail('invalid_transition'); end if;
  if not private.is_encounter_author(old.encounter_id) then perform private.fail('forbidden'); end if;
  if p_reason is null or length(trim(p_reason)) < 5 then perform private.fail('reason_required'); end if;
  update public.clinical_notes set status = 'superseded' where id = old.id;
  insert into public.clinical_notes (encounter_id, version_no, status, reason_for_visit, history, examination, assessment,
    plan, follow_up, vitals, free_text, signed_at, signed_by, supersedes_id, correction_reason, created_by)
  values (old.encounter_id, old.version_no + 1, 'signed',
    coalesce(p_fields ->> 'reason_for_visit', old.reason_for_visit), coalesce(p_fields ->> 'history', old.history),
    coalesce(p_fields ->> 'examination', old.examination), coalesce(p_fields ->> 'assessment', old.assessment),
    coalesce(p_fields ->> 'plan', old.plan), coalesce(p_fields ->> 'follow_up', old.follow_up),
    coalesce(p_fields -> 'vitals', old.vitals), coalesce(p_fields ->> 'free_text', old.free_text),
    now(), auth.uid(), old.id, p_reason, auth.uid())
  returning * into n;
  perform private.audit('clinical_note.amended', 'clinical_note', n.id, null, null, p_reason);
  return n;
end;
$$;

-- Session status: awaiting_results frees the doctor (queue done) without
-- closing the record; completion closes appointment + queue.
create or replace function public.set_encounter_status(p_encounter_id uuid, p_status public.encounter_status)
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
  if not ((e.status, p_status) in (
      ('in_progress', 'awaiting_results'), ('in_progress', 'completed'),
      ('awaiting_results', 'ready_for_review'), ('awaiting_results', 'completed'),
      ('ready_for_review', 'completed'), ('completed', 'closed'))) then
    perform private.fail('invalid_transition', e.status::text || '->' || p_status::text);
  end if;
  update public.encounters
     set status = p_status,
         ended_at = case when p_status in ('awaiting_results', 'completed') and ended_at is null then now() else ended_at end
   where id = e.id returning * into e;
  if p_status in ('awaiting_results', 'completed') then
    update public.queue_entries set status = 'done', finished_at = now() where id = e.queue_entry_id and status = 'in_session';
    update public.appointments set status = 'fulfilled'
     where id = e.appointment_id and status = 'checked_in';
    insert into public.appointment_events (appointment_id, from_status, to_status, actor_user_id, reason)
    select e.appointment_id, 'checked_in', 'fulfilled', auth.uid(), 'encounter' where e.appointment_id is not null
      and exists (select 1 from public.appointments where id = e.appointment_id and status = 'fulfilled')
      and not exists (select 1 from public.appointment_events where appointment_id = e.appointment_id and to_status = 'fulfilled');
  end if;
  perform private.audit('encounter.status', 'encounter', e.id, e.facility_id, e.patient_id, null, jsonb_build_object('status', p_status));
  return e;
end;
$$;

create or replace function public.add_allergy(
  p_patient_id uuid,
  p_substance text,
  p_reaction text default null,
  p_severity text default null
) returns public.allergies
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.allergies;
  is_patient boolean := private.is_linked_to_patient(p_patient_id);
begin
  if not (is_patient or private.clinician_can_read_patient(p_patient_id)) then perform private.fail('forbidden'); end if;
  insert into public.allergies (patient_id, substance, reaction, severity, source, recorded_by, recorded_by_practitioner_id)
  values (p_patient_id, trim(p_substance), p_reaction, p_severity,
          case when is_patient and private.current_practitioner_id() is null then 'patient_reported' else 'clinician' end,
          auth.uid(), private.current_practitioner_id())
  returning * into a;
  return a;
end;
$$;

create or replace function public.complete_clinical_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.clinical_tasks set status = 'done', done_at = now()
   where id = p_task_id and practitioner_id = private.current_practitioner_id() and status = 'open';
  if not found then perform private.fail('not_found'); end if;
end;
$$;

-- Doctor's patient context for the session header (identity + documented
-- allergies + own previous encounters). No inference that an empty
-- allergy list means "none".
create or replace function public.encounter_context(p_encounter_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e public.encounters;
  p public.patients;
begin
  if not private.can_read_encounter(p_encounter_id) then perform private.fail('forbidden'); end if;
  select * into e from public.encounters where id = p_encounter_id;
  select * into p from public.patients where id = e.patient_id;
  return jsonb_build_object(
    'encounter', to_jsonb(e),
    'patient', jsonb_build_object('id', p.id, 'public_code', p.public_code, 'full_name', p.full_name, 'sex', p.sex,
                                  'birth_year', coalesce(p.birth_year, extract(year from p.birth_date)::int)),
    'allergies_recorded', exists (select 1 from public.allergies a where a.patient_id = p.id),
    'allergies', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'substance', a.substance, 'reaction', a.reaction,
                                              'severity', a.severity, 'source', a.source) order by a.created_at)
                            from public.allergies a where a.patient_id = p.id and a.status = 'active'), '[]'::jsonb),
    'note', (select to_jsonb(n) from public.clinical_notes n where n.encounter_id = e.id and n.status in ('draft', 'signed')
              order by n.version_no desc limit 1),
    'history', coalesce((select jsonb_agg(jsonb_build_object('encounter_id', x.id, 'started_at', x.started_at, 'status', x.status,
                                              'facility', f.name,
                                              'assessment', (select n.assessment from public.clinical_notes n where n.encounter_id = x.id and n.status = 'signed' order by n.version_no desc limit 1),
                                              'plan', (select n.plan from public.clinical_notes n where n.encounter_id = x.id and n.status = 'signed' order by n.version_no desc limit 1))
                                    order by x.started_at desc)
                          from public.encounters x join public.facilities f on f.id = x.facility_id
                         where x.patient_id = p.id and x.id <> e.id and private.can_read_encounter(x.id)), '[]'::jsonb)
  );
end;
$$;

revoke execute on function
  public.start_encounter(uuid, boolean),
  public.save_clinical_note_draft(uuid, jsonb, int),
  public.sign_clinical_note(uuid),
  public.amend_clinical_note(uuid, jsonb, text),
  public.set_encounter_status(uuid, public.encounter_status),
  public.add_allergy(uuid, text, text, text),
  public.complete_clinical_task(uuid),
  public.encounter_context(uuid)
from public, anon;
grant execute on function
  public.start_encounter(uuid, boolean),
  public.save_clinical_note_draft(uuid, jsonb, int),
  public.sign_clinical_note(uuid),
  public.amend_clinical_note(uuid, jsonb, text),
  public.set_encounter_status(uuid, public.encounter_status),
  public.add_allergy(uuid, text, text, text),
  public.complete_clinical_task(uuid),
  public.encounter_context(uuid)
to authenticated;
