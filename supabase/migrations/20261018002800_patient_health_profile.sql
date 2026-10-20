-- Patient health profile (owner request, 20 Oct 2026). The patient (or a
-- guardian) keeps their own basics — birth date, height, weight, blood
-- type, chronic conditions, regular medications, allergies — and sees
-- their lab results per test with previous → current values. Treating
-- doctors see the same profile in the session and on the medical card.
-- Everything is shown as recorded (who recorded it is kept); nothing is
-- interpreted automatically.

create table public.patient_health_profiles (
  patient_id uuid primary key references public.patients (id),
  height_cm numeric(5, 1) check (height_cm between 30 and 250),
  weight_kg numeric(5, 1) check (weight_kg between 1 and 400),
  blood_type text check (blood_type in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  notes text check (length(notes) <= 1000),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

create table public.patient_conditions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id),
  name text not null check (length(trim(name)) between 1 and 200),
  since_year int check (since_year between 1900 and 2100),
  status text not null default 'active' check (status in ('active', 'resolved', 'entered_in_error')),
  source text not null check (source in ('patient_reported', 'clinician')),
  recorded_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);
create index patient_conditions_patient_idx on public.patient_conditions (patient_id);

alter table public.patient_health_profiles enable row level security;
alter table public.patient_conditions enable row level security;
-- no direct table access: everything goes through the functions below
revoke all on public.patient_health_profiles, public.patient_conditions from anon, authenticated;

-- who may see / edit a patient's health profile
create or replace function private.can_view_health(p_patient_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_linked_to_patient(p_patient_id) or private.treats_patient(p_patient_id);
$$;

-- lab results grouped per test (same test code across labs), newest first
create or replace function private.lab_trends(p_patient_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(t order by t.latest_at desc), '[]'::jsonb) from (
    select g.key, max(g.name) as name, max(g.released_at) as latest_at,
           (array_agg(g.unit order by g.released_at desc))[1] as unit,
           (array_agg(g.reference_range order by g.released_at desc))[1] as reference_range,
           jsonb_agg(jsonb_build_object('value_numeric', g.value_numeric, 'value_text', g.value_text, 'flag', g.lab_flag,
                                        'released_at', g.released_at, 'lab', g.lab, 'order_id', g.order_id)
                     order by g.released_at desc) as points
      from (select coalesce(upper(c.code), i.display_name) as key, i.display_name as name, r.value_numeric, r.value_text,
                   coalesce(r.unit, c.unit) as unit, coalesce(r.reference_range, c.reference_range_text) as reference_range,
                   r.lab_flag, r.released_at, f.name as lab, o.id as order_id
              from public.lab_results r
              join public.lab_order_items i on i.id = r.order_item_id
              join public.lab_orders o on o.id = i.order_id
              join public.facilities f on f.id = o.lab_facility_id
              left join public.lab_test_catalog c on c.id = i.test_id
             where o.patient_id = p_patient_id and r.status = 'released') g
     group by g.key) t;
$$;

create or replace function public.health_profile(p_patient_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.patients;
  hp public.patient_health_profiles;
begin
  if not private.can_view_health(p_patient_id) then perform private.fail('forbidden'); end if;
  select * into p from public.patients where id = p_patient_id;
  select * into hp from public.patient_health_profiles where patient_id = p_patient_id;
  if not private.is_linked_to_patient(p_patient_id) then
    perform private.audit('health_profile.viewed', 'patient', p.id, null, p.id);
  end if;
  return jsonb_build_object(
    'patient', jsonb_build_object('id', p.id, 'full_name', p.full_name, 'public_code', p.public_code, 'sex', p.sex,
                                  'birth_date', p.birth_date, 'birth_year', coalesce(p.birth_year, extract(year from p.birth_date)::int)),
    'profile', jsonb_build_object('height_cm', hp.height_cm, 'weight_kg', hp.weight_kg, 'blood_type', hp.blood_type, 'notes', hp.notes,
                                  'updated_at', hp.updated_at),
    -- last weight recorded by a doctor in a signed visit, for comparison
    'last_vitals', (select jsonb_build_object('vitals', n.vitals, 'at', n.signed_at)
                      from public.clinical_notes n join public.encounters e on e.id = n.encounter_id
                     where e.patient_id = p.id and n.status = 'signed' and n.vitals <> '{}'::jsonb
                     order by n.signed_at desc limit 1),
    'conditions', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'since_year', c.since_year, 'status', c.status,
                                                                'source', c.source, 'created_at', c.created_at) order by c.created_at)
                              from public.patient_conditions c where c.patient_id = p.id and c.status <> 'entered_in_error'), '[]'::jsonb),
    'medications', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'dose_text', m.dose_text,
                                                                 'started_on', m.started_on) order by m.created_at)
                               from public.patient_reported_medications m where m.patient_id = p.id and m.stopped_on is null), '[]'::jsonb),
    -- medicines from approved prescriptions whose course has not ended
    'prescribed', coalesce((select jsonb_agg(jsonb_build_object('name', it.display_name, 'dose', it.dose, 'dose_unit', it.dose_unit,
                                                                'frequency', it.frequency_text, 'until', it.start_date + it.duration_days,
                                                                'doctor', pp.full_name) order by v.approved_at desc)
                              from public.prescriptions rx
                              join public.prescription_versions v on v.id = rx.current_version_id and v.status = 'approved'
                              join public.prescription_items it on it.version_id = v.id
                              join public.practitioner_profiles pp on pp.id = rx.practitioner_id
                             where rx.patient_id = p.id and rx.status = 'active'
                               and (it.duration_days is null or coalesce(it.start_date, v.approved_at::date) + it.duration_days >= current_date)), '[]'::jsonb),
    'allergies_recorded', exists (select 1 from public.allergies a where a.patient_id = p.id),
    'allergies', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'substance', a.substance, 'reaction', a.reaction,
                                                               'severity', a.severity, 'source', a.source) order by a.created_at)
                             from public.allergies a where a.patient_id = p.id and a.status = 'active'), '[]'::jsonb),
    'lab_trends', private.lab_trends(p.id)
  );
end;
$$;

-- the patient/guardian (or a treating doctor, for height/weight) updates the basics
create or replace function public.save_health_profile(
  p_patient_id uuid,
  p_birth_date date default null,
  p_height_cm numeric default null,
  p_weight_kg numeric default null,
  p_blood_type text default null,
  p_notes text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_patient boolean := private.is_linked_to_patient(p_patient_id);
begin
  if not (is_patient or private.treats_patient(p_patient_id)) then perform private.fail('forbidden'); end if;
  if p_birth_date is not null and (p_birth_date > current_date or p_birth_date < date '1900-01-01') then perform private.fail('invalid_input'); end if;
  if is_patient and p_birth_date is not null then
    update public.patients set birth_date = p_birth_date, birth_year = extract(year from p_birth_date)::int where id = p_patient_id;
  end if;
  insert into public.patient_health_profiles (patient_id, height_cm, weight_kg, blood_type, notes, updated_by, updated_at)
  values (p_patient_id, p_height_cm, p_weight_kg, nullif(p_blood_type, ''), nullif(trim(coalesce(p_notes, '')), ''), auth.uid(), now())
  on conflict (patient_id) do update
     set height_cm = excluded.height_cm, weight_kg = excluded.weight_kg,
         blood_type = case when is_patient then excluded.blood_type else public.patient_health_profiles.blood_type end,
         notes = case when is_patient then excluded.notes else public.patient_health_profiles.notes end,
         updated_by = excluded.updated_by, updated_at = now();
  perform private.audit('health_profile.updated', 'patient', p_patient_id, null, p_patient_id);
end;
$$;

create or replace function public.add_condition(p_patient_id uuid, p_name text, p_since_year int default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_patient boolean := private.is_linked_to_patient(p_patient_id);
  new_id uuid;
begin
  if not (is_patient or private.treats_patient(p_patient_id)) then perform private.fail('forbidden'); end if;
  if p_name is null or length(trim(p_name)) = 0 then perform private.fail('invalid_input'); end if;
  insert into public.patient_conditions (patient_id, name, since_year, source, recorded_by)
  values (p_patient_id, trim(p_name), p_since_year,
          case when is_patient and private.current_practitioner_id() is null then 'patient_reported' else 'clinician' end, auth.uid())
  returning patient_conditions.id into new_id;
  return new_id;
end;
$$;

-- resolved, or removed when it was entered by mistake (kept for the record)
create or replace function public.set_condition_status(p_condition_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.patient_conditions;
begin
  select * into c from public.patient_conditions where id = p_condition_id;
  if c.id is null or not (private.is_linked_to_patient(c.patient_id) or private.treats_patient(c.patient_id)) then perform private.fail('forbidden'); end if;
  if p_status not in ('active', 'resolved', 'entered_in_error') then perform private.fail('invalid_input'); end if;
  update public.patient_conditions set status = p_status where id = c.id;
end;
$$;

create or replace function public.add_reported_medication(p_patient_id uuid, p_name text, p_dose_text text default null, p_started_on date default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if not (private.is_linked_to_patient(p_patient_id) or private.treats_patient(p_patient_id)) then perform private.fail('forbidden'); end if;
  if p_name is null or length(trim(p_name)) = 0 then perform private.fail('invalid_input'); end if;
  insert into public.patient_reported_medications (patient_id, name, dose_text, started_on, created_by)
  values (p_patient_id, trim(p_name), nullif(trim(coalesce(p_dose_text, '')), ''), p_started_on, auth.uid())
  returning patient_reported_medications.id into new_id;
  return new_id;
end;
$$;

create or replace function public.stop_reported_medication(p_medication_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.patient_reported_medications;
begin
  select * into m from public.patient_reported_medications where id = p_medication_id;
  if m.id is null or not (private.is_linked_to_patient(m.patient_id) or private.treats_patient(m.patient_id)) then perform private.fail('forbidden'); end if;
  update public.patient_reported_medications set stopped_on = current_date where id = m.id and stopped_on is null;
end;
$$;

-- printable lab report: released results only, with the lab's letterhead
create or replace function public.lab_report(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  o public.lab_orders;
begin
  if not private.can_read_lab_order(p_order_id) then perform private.fail('forbidden'); end if;
  select * into o from public.lab_orders where id = p_order_id;
  if not exists (select 1 from public.lab_order_items where order_id = o.id and status = 'released') then perform private.fail('not_released'); end if;
  return jsonb_build_object(
    'order_number', o.order_number, 'created_at', o.created_at,
    'lab', (select jsonb_build_object('name', f.name, 'branch', b.name, 'address', b.address, 'phone', f.phone)
              from public.facilities f join public.branches b on b.id = f.branch_id where f.id = o.lab_facility_id),
    'patient', (select jsonb_build_object('full_name', p.full_name, 'public_code', p.public_code, 'sex', p.sex,
                                          'birth_year', coalesce(p.birth_year, extract(year from p.birth_date)::int))
                  from public.patients p where p.id = o.patient_id),
    'ordering_doctor', (select full_name from public.practitioner_profiles where id = o.ordering_practitioner_id),
    'specimen', (select jsonb_build_object('barcode', s.barcode, 'type', s.specimen_type, 'collected_at', s.collected_at)
                   from public.specimens s where s.order_id = o.id and s.status = 'collected' order by s.collected_at desc limit 1),
    'released_at', (select max(released_at) from public.lab_order_items where order_id = o.id and status = 'released'),
    'items', coalesce((select jsonb_agg(jsonb_build_object('name', i.display_name, 'value_numeric', r.value_numeric, 'value_text', r.value_text,
                                                          'unit', coalesce(r.unit, c.unit), 'reference_range', coalesce(r.reference_range, c.reference_range_text),
                                                          'flag', r.lab_flag, 'notes', r.notes, 'corrected', r.version_no > 1) order by i.display_name)
                         from public.lab_order_items i
                         join public.lab_results r on r.order_item_id = i.id and r.status = 'released'
                         left join public.lab_test_catalog c on c.id = i.test_id
                        where i.order_id = o.id), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.health_profile(uuid), public.save_health_profile(uuid, date, numeric, numeric, text, text),
  public.add_condition(uuid, text, int), public.set_condition_status(uuid, text),
  public.add_reported_medication(uuid, text, text, date), public.stop_reported_medication(uuid), public.lab_report(uuid) from public, anon;
grant execute on function public.health_profile(uuid), public.save_health_profile(uuid, date, numeric, numeric, text, text),
  public.add_condition(uuid, text, int), public.set_condition_status(uuid, text),
  public.add_reported_medication(uuid, text, text, date), public.stop_reported_medication(uuid), public.lab_report(uuid) to authenticated;
