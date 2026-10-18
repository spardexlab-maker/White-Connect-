-- =====================================================================
-- 0007 Patient card (QR) retrieval + reception helpers.
--
-- Decision: the QR token must be re-displayable in the patient's app and
-- printable on a card for patients without the app, so the raw random
-- token is stored, readable ONLY by the linked account (RLS) and by staff
-- through issue_patient_card (care relationship + audit). The token is an
-- identifier, not a credential: lookup still needs an authorized staff
-- member, is rate limited and audited, and grants no record access.
-- =====================================================================

alter table public.patient_qr_tokens add column token text unique;

create or replace function private.new_qr_token(p_patient_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw text := 'qr_' || encode(extensions.gen_random_bytes(24), 'hex');
begin
  update public.patient_qr_tokens set revoked_at = now() where patient_id = p_patient_id and revoked_at is null;
  insert into public.patient_qr_tokens (patient_id, token_hash, token) values (p_patient_id, private.sha256_hex(raw), raw);
  return raw;
end;
$$;

create or replace function public.rotate_patient_qr(p_patient_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw text;
begin
  if not private.is_linked_to_patient(p_patient_id) then
    perform private.fail('forbidden');
  end if;
  raw := private.new_qr_token(p_patient_id);
  perform private.audit('patient.qr_rotated', 'patient', p_patient_id, null, p_patient_id);
  return raw;
end;
$$;

-- Patient app: card data (creates a token on first use). No health data.
create or replace function public.my_patient_card(p_patient_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  tok text;
  p public.patients;
begin
  if not private.is_linked_to_patient(p_patient_id) then perform private.fail('forbidden'); end if;
  select * into p from public.patients where id = p_patient_id;
  select token into tok from public.patient_qr_tokens where patient_id = p_patient_id and revoked_at is null;
  if tok is null then tok := private.new_qr_token(p_patient_id); end if;
  return jsonb_build_object('patient_id', p.id, 'public_code', p.public_code, 'full_name', p.full_name, 'qr_token', tok);
end;
$$;

-- Reception: printable card for a patient without the app.
create or replace function public.issue_patient_card(p_facility_id uuid, p_patient_id uuid, p_rotate boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  tok text;
  p public.patients;
begin
  if not private.has_facility_role(p_facility_id, array['receptionist', 'doctor', 'facility_admin', 'lab_technician', 'lab_approver']::public.member_role[])
     or not exists (select 1 from public.care_relationships c where c.patient_id = p_patient_id and c.facility_id = p_facility_id and c.ended_at is null) then
    perform private.fail('forbidden');
  end if;
  select * into p from public.patients where id = p_patient_id and status = 'active';
  if p.id is null then perform private.fail('patient_not_found'); end if;
  if not p_rotate then
    select token into tok from public.patient_qr_tokens where patient_id = p_patient_id and revoked_at is null;
  end if;
  if tok is null then tok := private.new_qr_token(p_patient_id); end if;
  perform private.audit('patient.card_issued', 'patient', p_patient_id, p_facility_id, p_patient_id, null,
                        jsonb_build_object('rotated', p_rotate));
  return jsonb_build_object('patient_id', p.id, 'public_code', p.public_code, 'full_name', p.full_name, 'qr_token', tok);
end;
$$;

-- Practitioners (and their services) the caller may manage at a clinic.
create or replace function public.reception_practitioners(p_facility_id uuid)
returns table (practitioner_id uuid, full_name text, specialty text, services jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not private.is_member_of_facility(p_facility_id) then perform private.fail('forbidden'); end if;
  return query
  select pp.id, pp.full_name, sp.name_ar,
         coalesce((select jsonb_agg(jsonb_build_object('id', cs.id, 'name', cs.name, 'duration_minutes', cs.duration_minutes,
                                                       'price_minor', cs.price_minor, 'buffer_minutes', cs.buffer_minutes,
                                                       'is_active', cs.is_active, 'is_public', cs.is_public) order by cs.name)
                     from public.clinic_services cs
                    where cs.facility_id = p_facility_id and (cs.practitioner_id is null or cs.practitioner_id = pp.id)), '[]'::jsonb)
    from public.memberships m
    join public.practitioner_profiles pp on pp.user_id = m.user_id and pp.status = 'active'
    left join public.specialties sp on sp.id = pp.specialty_id
   where m.facility_id = p_facility_id and m.role = 'doctor' and m.status = 'active'
     and private.can_manage_reception(p_facility_id, pp.id)
   order by pp.full_name;
end;
$$;

-- Patient-side live queue position for their own appointment (no other names).
create or replace function public.my_queue_status(p_appointment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a public.appointments;
  q public.queue_entries;
  ahead int;
  delay int;
begin
  select * into a from public.appointments where id = p_appointment_id;
  if a.id is null or not private.is_linked_to_patient(a.patient_id) then perform private.fail('forbidden'); end if;
  select * into q from public.queue_entries where appointment_id = a.id;
  if q.id is null then return jsonb_build_object('in_queue', false); end if;
  select count(*) into ahead from public.queue_entries o
   left join public.appointments oa on oa.id = o.appointment_id
   where o.facility_id = q.facility_id and o.service_date = q.service_date
     and o.practitioner_id is not distinct from q.practitioner_id
     and o.status in ('waiting', 'called') and o.id <> q.id
     and (o.priority, -extract(epoch from coalesce(lower(oa.period), o.arrived_at)))
         > (q.priority, -extract(epoch from lower(a.period)));
  select d.delay_minutes into delay from public.delay_notices d
   where d.facility_id = q.facility_id and d.service_date = q.service_date
     and d.practitioner_id is not distinct from q.practitioner_id
   order by d.created_at desc limit 1;
  return jsonb_build_object('in_queue', true, 'status', q.status, 'ahead', ahead, 'delay_minutes', coalesce(delay, 0));
end;
$$;

revoke execute on function
  public.rotate_patient_qr(uuid),
  public.my_patient_card(uuid),
  public.issue_patient_card(uuid, uuid, boolean),
  public.reception_practitioners(uuid),
  public.my_queue_status(uuid)
from public, anon;
grant execute on function
  public.rotate_patient_qr(uuid),
  public.my_patient_card(uuid),
  public.issue_patient_card(uuid, uuid, boolean),
  public.reception_practitioners(uuid),
  public.my_queue_status(uuid)
to authenticated;

-- the token column must not be readable by staff through table access
revoke select on public.patient_qr_tokens from authenticated;
grant select (id, patient_id, created_at, revoked_at) on public.patient_qr_tokens to authenticated;
