-- =====================================================================
-- 0011 Electronic prescriptions (Phase 3, spec §9).
--
--   * Structured catalog: active ingredient ≠ brand product ≠ package.
--   * Prescription header + immutable versions; approval freezes a
--     snapshot (number, version, doctor, clinic, patient, date, items) and
--     issues a short-lived verification token for the printed QR.
--   * Revision after sending = new version; the previous one becomes
--     'superseded' and can no longer be dispensed; the pharmacy is told.
--   * Printing is NOT sending; sending is NOT dispensing. Each is its own
--     event; re-printing never changes counts.
--   * Sending goes only to a pharmacy chosen explicitly (default shown in
--     the UI = the visit facility's default pharmacy, not the doctor's).
-- =====================================================================

create table public.medication_catalog (
  id uuid primary key default gen_random_uuid(),
  active_ingredient text not null,
  brand_name text,
  strength text not null,
  dosage_form text not null,          -- tablet, capsule, syrup, injection …
  unit text not null,                 -- mg, ml, …
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (active_ingredient, brand_name, strength, dosage_form)
);
create index medication_catalog_search on public.medication_catalog (lower(active_ingredient), lower(brand_name));

create type public.rx_status as enum ('draft', 'active', 'cancelled');
create type public.rx_version_status as enum ('draft', 'approved', 'superseded', 'cancelled');

create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  rx_number text not null unique default ('RX' || private.random_code(8)),
  patient_id uuid not null references public.patients (id),
  encounter_id uuid not null references public.encounters (id),
  facility_id uuid not null references public.facilities (id),
  practitioner_id uuid not null references public.practitioner_profiles (id),
  status public.rx_status not null default 'draft',
  current_version_id uuid,
  cancel_reason text,
  created_by uuid not null references public.profiles (id),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1,
  unique (created_by, idempotency_key)
);
create index prescriptions_patient_idx on public.prescriptions (patient_id);
create trigger prescriptions_touch before update on public.prescriptions
  for each row execute function private.touch_row();
create trigger prescriptions_no_delete before delete on public.prescriptions
  for each row execute function private.forbid_delete();

create table public.prescription_versions (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions (id),
  version_no int not null,
  status public.rx_version_status not null default 'draft',
  approved_at timestamptz,
  approved_by uuid references public.profiles (id),
  snapshot jsonb,                       -- frozen at approval
  verify_token text unique,
  verify_expires_at timestamptz,
  revision_reason text,
  created_at timestamptz not null default now(),
  unique (prescription_id, version_no),
  check (status = 'draft' or snapshot is not null)
);
create unique index rx_one_draft on public.prescription_versions (prescription_id) where status = 'draft';
create unique index rx_one_approved on public.prescription_versions (prescription_id) where status = 'approved';
alter table public.prescriptions add constraint prescriptions_current_version_fk
  foreign key (current_version_id) references public.prescription_versions (id);
create trigger rx_versions_no_delete before delete on public.prescription_versions
  for each row execute function private.forbid_delete();

create table public.prescription_items (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.prescription_versions (id),
  line_no int not null,
  medication_id uuid references public.medication_catalog (id),
  display_name text not null,                   -- frozen catalog text
  dose numeric(10, 3),
  dose_unit text,
  route text,
  frequency_text text,                          -- exactly as written; never auto-interpreted
  interval_hours int check (interval_hours between 1 and 168),
  duration_days int check (duration_days between 1 and 365),
  start_date date,
  quantity numeric(10, 2) check (quantity > 0),
  quantity_unit text,
  instructions text,
  as_needed boolean not null default false,
  max_daily text,
  unique (version_id, line_no)
);

-- approved/superseded versions and their items are immutable
create or replace function private.protect_approved_rx_items()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  st public.rx_version_status;
begin
  select status into st from public.prescription_versions where id = coalesce(new.version_id, old.version_id);
  if st <> 'draft' then perform private.fail('signed_record_locked'); end if;
  return coalesce(new, old);
end;
$$;
create trigger rx_items_lock before insert or update or delete on public.prescription_items
  for each row execute function private.protect_approved_rx_items();

create table public.prescription_dispatches (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions (id),
  pharmacy_id uuid not null references public.facilities (id),
  version_id uuid not null references public.prescription_versions (id),
  status text not null default 'sent' check (status in ('sent', 'received', 'preparing', 'ready', 'partially_dispensed', 'dispensed', 'not_available', 'cancelled')),
  sent_by uuid not null references public.profiles (id),
  sent_at timestamptz not null default now(),
  received_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (prescription_id, pharmacy_id)
);
create index rx_dispatch_pharmacy_idx on public.prescription_dispatches (pharmacy_id, sent_at desc);

create table public.prescription_events (
  id bigint generated always as identity primary key,
  prescription_id uuid not null references public.prescriptions (id),
  version_id uuid references public.prescription_versions (id),
  event text not null check (event in ('approved', 'sent', 'received', 'printed', 'preparing', 'ready',
                                        'partially_dispensed', 'dispensed', 'not_available', 'revised', 'cancelled')),
  facility_id uuid references public.facilities (id),
  actor_user_id uuid,
  note text,
  occurred_at timestamptz not null default now()
);
create index rx_events_idx on public.prescription_events (prescription_id, occurred_at);

-- =====================================================================
-- Access helpers
-- =====================================================================
create or replace function private.is_rx_author(p_prescription_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.prescriptions r
                  where r.id = p_prescription_id and private.is_encounter_author(r.encounter_id));
$$;

create or replace function private.pharmacy_has_rx(p_prescription_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.prescription_dispatches d
                  where d.prescription_id = p_prescription_id
                    and private.has_facility_role(d.pharmacy_id, array['pharmacist', 'pharmacy_staff']::public.member_role[]));
$$;

create or replace function private.can_read_rx(p_prescription_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_rx_author(p_prescription_id)
      or private.pharmacy_has_rx(p_prescription_id)
      or exists (select 1 from public.prescriptions r
                  where r.id = p_prescription_id
                    and (private.has_consent(r.patient_id, 'prescription', r.id)
                         or (r.status <> 'draft' and private.is_linked_to_patient(r.patient_id))));
$$;

alter table public.medication_catalog enable row level security;
alter table public.prescriptions enable row level security;
alter table public.prescription_versions enable row level security;
alter table public.prescription_items enable row level security;
alter table public.prescription_dispatches enable row level security;
alter table public.prescription_events enable row level security;

create policy med_catalog_read on public.medication_catalog for select to authenticated using (true);
create policy med_catalog_admin on public.medication_catalog for all to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());
create policy rx_read on public.prescriptions for select to authenticated using (private.can_read_rx(id));
-- patients and pharmacies never see drafts
create policy rx_versions_read on public.prescription_versions for select to authenticated
  using (private.is_rx_author(prescription_id) or (status <> 'draft' and private.can_read_rx(prescription_id)));
create policy rx_items_read on public.prescription_items for select to authenticated
  using (exists (select 1 from public.prescription_versions v where v.id = prescription_items.version_id));
create policy rx_dispatch_read on public.prescription_dispatches for select to authenticated
  using (private.can_read_rx(prescription_id));
create policy rx_events_read on public.prescription_events for select to authenticated
  using (private.is_rx_author(prescription_id) or private.pharmacy_has_rx(prescription_id));

grant select on public.medication_catalog, public.prescriptions, public.prescription_versions, public.prescription_items,
  public.prescription_dispatches, public.prescription_events to authenticated;
grant insert, update on public.medication_catalog to authenticated;

-- =====================================================================
-- RPCs
-- =====================================================================

-- Medication search with availability at the selected pharmacy. Stock
-- comes in Phase 4; until then availability is reported as 'unknown'
-- (never as a confirmed quantity).
create or replace function public.search_medications(p_query text, p_pharmacy_id uuid default null)
returns table (medication_id uuid, active_ingredient text, brand_name text, strength text, dosage_form text, unit text,
               availability text, availability_updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.active_ingredient, m.brand_name, m.strength, m.dosage_form, m.unit, 'unknown'::text, null::timestamptz
    from public.medication_catalog m
   where m.is_active and length(trim(coalesce(p_query, ''))) >= 2
     and (m.active_ingredient ilike '%' || trim(p_query) || '%' or coalesce(m.brand_name, '') ilike '%' || trim(p_query) || '%')
   order by m.active_ingredient, m.brand_name nulls first, m.strength
   limit 20;
$$;

-- Create or replace the draft (items as JSON array). Re-sending the same
-- idempotency key returns the same prescription.
create or replace function public.save_prescription_draft(
  p_encounter_id uuid,
  p_items jsonb,
  p_idempotency_key text,
  p_prescription_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.encounters;
  rx public.prescriptions;
  v public.prescription_versions;
  it jsonb;
  i int := 0;
  med public.medication_catalog;
begin
  if not private.is_encounter_author(p_encounter_id) then perform private.fail('forbidden'); end if;
  select * into e from public.encounters where id = p_encounter_id;
  if e.status not in ('in_progress', 'awaiting_results', 'ready_for_review') then perform private.fail('encounter_closed'); end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then perform private.fail('items_required'); end if;

  if p_prescription_id is not null then
    select * into rx from public.prescriptions where id = p_prescription_id and encounter_id = p_encounter_id for update;
    if rx.id is null then perform private.fail('not_found'); end if;
  else
    select * into rx from public.prescriptions where created_by = auth.uid() and idempotency_key = p_idempotency_key;
    if rx.id is null then
      insert into public.prescriptions (patient_id, encounter_id, facility_id, practitioner_id, created_by, idempotency_key)
      values (e.patient_id, e.id, e.facility_id, e.practitioner_id, auth.uid(), p_idempotency_key)
      returning * into rx;
    end if;
  end if;
  if rx.status = 'cancelled' then perform private.fail('invalid_transition'); end if;

  select * into v from public.prescription_versions where prescription_id = rx.id and status = 'draft';
  if v.id is null then
    insert into public.prescription_versions (prescription_id, version_no)
    values (rx.id, coalesce((select max(version_no) from public.prescription_versions where prescription_id = rx.id), 0) + 1)
    returning * into v;
  end if;
  delete from public.prescription_items where version_id = v.id;

  for it in select * from jsonb_array_elements(p_items) loop
    i := i + 1;
    med := null;
    if it ->> 'medication_id' is not null then
      select * into med from public.medication_catalog where id = (it ->> 'medication_id')::uuid;
    end if;
    if med.id is null and coalesce(trim(it ->> 'display_name'), '') = '' then perform private.fail('medication_required'); end if;
    insert into public.prescription_items (version_id, line_no, medication_id, display_name, dose, dose_unit, route,
      frequency_text, interval_hours, duration_days, start_date, quantity, quantity_unit, instructions, as_needed, max_daily)
    values (v.id, i, med.id,
      coalesce(case when med.id is not null then concat_ws(' ', med.active_ingredient,
                    case when med.brand_name is not null then '(' || med.brand_name || ')' end, med.strength, med.dosage_form) end,
               trim(it ->> 'display_name')),
      nullif(it ->> 'dose', '')::numeric, it ->> 'dose_unit', it ->> 'route', it ->> 'frequency_text',
      nullif(it ->> 'interval_hours', '')::int, nullif(it ->> 'duration_days', '')::int, nullif(it ->> 'start_date', '')::date,
      nullif(it ->> 'quantity', '')::numeric, it ->> 'quantity_unit', it ->> 'instructions',
      coalesce((it ->> 'as_needed')::boolean, false), it ->> 'max_daily');
  end loop;

  return jsonb_build_object('prescription_id', rx.id, 'rx_number', rx.rx_number, 'version_id', v.id, 'version_no', v.version_no);
end;
$$;

-- Approve the current draft. Optionally send to an explicitly chosen
-- pharmacy. One transaction: snapshot, supersede previous approved
-- version, dispatch update, events, patient notification.
create or replace function public.approve_prescription(
  p_prescription_id uuid,
  p_send_to_pharmacy_id uuid default null,
  p_revision_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  rx public.prescriptions;
  v public.prescription_versions;
  prev public.prescription_versions;
  snap jsonb;
  tok text := encode(extensions.gen_random_bytes(18), 'hex');
  pharm public.facilities;
begin
  select * into rx from public.prescriptions where id = p_prescription_id for update;
  if rx.id is null or not private.is_rx_author(rx.id) then perform private.fail('forbidden'); end if;
  select * into v from public.prescription_versions where prescription_id = rx.id and status = 'draft' for update;
  if v.id is null then perform private.fail('no_draft'); end if;
  if not exists (select 1 from public.prescription_items where version_id = v.id) then perform private.fail('items_required'); end if;
  select * into prev from public.prescription_versions where prescription_id = rx.id and status = 'approved' for update;
  if prev.id is not null and (p_revision_reason is null or length(trim(p_revision_reason)) < 5) then
    perform private.fail('reason_required');
  end if;
  if p_send_to_pharmacy_id is not null then
    select * into pharm from public.facilities where id = p_send_to_pharmacy_id and type = 'pharmacy' and status = 'active';
    if pharm.id is null then perform private.fail('invalid_pharmacy'); end if;
  end if;

  select jsonb_build_object(
    'rx_number', rx.rx_number, 'version_no', v.version_no, 'approved_at', now(),
    'practitioner', jsonb_build_object('full_name', pp.full_name, 'title', pp.title, 'license_number', pp.license_number),
    'facility', jsonb_build_object('name', f.name, 'branch', b.name, 'address', b.address, 'phone', f.phone),
    'patient', jsonb_build_object('full_name', p.full_name, 'public_code', p.public_code, 'sex', p.sex,
                                  'birth_year', coalesce(p.birth_year, extract(year from p.birth_date)::int)),
    'items', (select jsonb_agg(to_jsonb(i) - 'version_id' - 'id' order by i.line_no) from public.prescription_items i where i.version_id = v.id))
  into snap
  from public.practitioner_profiles pp, public.facilities f, public.branches b, public.patients p
  where pp.id = rx.practitioner_id and f.id = rx.facility_id and b.id = f.branch_id and p.id = rx.patient_id;

  if prev.id is not null then
    update public.prescription_versions set status = 'superseded', verify_expires_at = now() where id = prev.id;
  end if;
  update public.prescription_versions
     set status = 'approved', approved_at = now(), approved_by = auth.uid(), snapshot = snap,
         verify_token = tok, verify_expires_at = now() + interval '30 days', revision_reason = p_revision_reason
   where id = v.id returning * into v;
  update public.prescriptions set status = 'active', current_version_id = v.id where id = rx.id;
  insert into public.prescription_events (prescription_id, version_id, event, facility_id, actor_user_id, note)
  values (rx.id, v.id, case when prev.id is null then 'approved' else 'revised' end, rx.facility_id, auth.uid(), p_revision_reason);

  -- existing dispatches follow the new version (old one can no longer be dispensed)
  update public.prescription_dispatches set version_id = v.id, status = 'sent', received_at = null, updated_at = now()
   where prescription_id = rx.id and status not in ('dispensed', 'cancelled');
  if p_send_to_pharmacy_id is not null then
    insert into public.prescription_dispatches (prescription_id, pharmacy_id, version_id, sent_by)
    values (rx.id, p_send_to_pharmacy_id, v.id, auth.uid())
    on conflict (prescription_id, pharmacy_id) do update set version_id = excluded.version_id, updated_at = now();
    insert into public.prescription_events (prescription_id, version_id, event, facility_id, actor_user_id)
    values (rx.id, v.id, 'sent', p_send_to_pharmacy_id, auth.uid());
    insert into public.care_relationships (patient_id, facility_id, source, created_by)
    values (rx.patient_id, p_send_to_pharmacy_id, 'pharmacy', auth.uid()) on conflict do nothing;
  end if;

  perform private.notify_patient(rx.patient_id, 'prescription.approved',
    jsonb_build_object('prescription_id', rx.id, 'rx_number', rx.rx_number), 'rx:' || v.id);
  perform private.audit('prescription.approved', 'prescription', rx.id, rx.facility_id, rx.patient_id, p_revision_reason,
                        jsonb_build_object('version_no', v.version_no, 'sent_to', p_send_to_pharmacy_id));
  return jsonb_build_object('prescription_id', rx.id, 'rx_number', rx.rx_number, 'version_id', v.id, 'version_no', v.version_no,
                            'verify_token', tok);
end;
$$;

-- Start a revision of an approved prescription (copies items into a draft).
create or replace function public.revise_prescription(p_prescription_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  rx public.prescriptions;
  cur public.prescription_versions;
  d public.prescription_versions;
begin
  select * into rx from public.prescriptions where id = p_prescription_id for update;
  if rx.id is null or not private.is_rx_author(rx.id) then perform private.fail('forbidden'); end if;
  select * into d from public.prescription_versions where prescription_id = rx.id and status = 'draft';
  if d.id is not null then return jsonb_build_object('version_id', d.id, 'version_no', d.version_no); end if;
  select * into cur from public.prescription_versions where prescription_id = rx.id and status = 'approved';
  if cur.id is null then perform private.fail('invalid_transition'); end if;
  insert into public.prescription_versions (prescription_id, version_no) values (rx.id, cur.version_no + 1) returning * into d;
  insert into public.prescription_items (version_id, line_no, medication_id, display_name, dose, dose_unit, route, frequency_text,
    interval_hours, duration_days, start_date, quantity, quantity_unit, instructions, as_needed, max_daily)
  select d.id, line_no, medication_id, display_name, dose, dose_unit, route, frequency_text, interval_hours, duration_days,
         start_date, quantity, quantity_unit, instructions, as_needed, max_daily
    from public.prescription_items where version_id = cur.id;
  return jsonb_build_object('version_id', d.id, 'version_no', d.version_no);
end;
$$;

create or replace function public.cancel_prescription(p_prescription_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rx public.prescriptions;
begin
  select * into rx from public.prescriptions where id = p_prescription_id for update;
  if rx.id is null or not private.is_rx_author(rx.id) then perform private.fail('forbidden'); end if;
  if p_reason is null or length(trim(p_reason)) < 5 then perform private.fail('reason_required'); end if;
  if exists (select 1 from public.prescription_dispatches where prescription_id = rx.id and status in ('partially_dispensed', 'dispensed')) then
    perform private.fail('already_dispensed');
  end if;
  update public.prescription_versions set status = 'cancelled', verify_expires_at = now()
   where prescription_id = rx.id and status in ('draft', 'approved');
  update public.prescriptions set status = 'cancelled', cancel_reason = p_reason where id = rx.id;
  update public.prescription_dispatches set status = 'cancelled', updated_at = now() where prescription_id = rx.id;
  insert into public.prescription_events (prescription_id, event, facility_id, actor_user_id, note)
  values (rx.id, 'cancelled', rx.facility_id, auth.uid(), p_reason);
  perform private.notify_patient(rx.patient_id, 'prescription.cancelled', jsonb_build_object('rx_number', rx.rx_number), 'rxc:' || rx.id);
end;
$$;

-- Printing is logged only; it never creates a dispatch, sale or count.
create or replace function public.record_prescription_print(p_prescription_id uuid, p_facility_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v uuid;
begin
  if not (private.is_rx_author(p_prescription_id)
          or (private.pharmacy_has_rx(p_prescription_id)
              and private.has_facility_role(p_facility_id, array['pharmacist', 'pharmacy_staff']::public.member_role[]))) then
    perform private.fail('forbidden');
  end if;
  select current_version_id into v from public.prescriptions where id = p_prescription_id and status = 'active';
  if v is null then perform private.fail('not_printable'); end if;
  insert into public.prescription_events (prescription_id, version_id, event, facility_id, actor_user_id)
  values (p_prescription_id, v, 'printed', p_facility_id, auth.uid());
end;
$$;

-- Printable/verifiable copy of the CURRENT approved version.
create or replace function public.prescription_document(p_prescription_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  rx public.prescriptions;
  v public.prescription_versions;
begin
  if not private.can_read_rx(p_prescription_id) then perform private.fail('forbidden'); end if;
  select * into rx from public.prescriptions where id = p_prescription_id;
  select * into v from public.prescription_versions where id = rx.current_version_id;
  if v.id is null then perform private.fail('not_printable'); end if;
  return v.snapshot || jsonb_build_object('status', rx.status, 'version_status', v.status, 'verify_token',
                                          case when v.verify_expires_at > now() then v.verify_token end,
                                          'verify_expires_at', v.verify_expires_at);
end;
$$;

-- Public verification by QR token: minimal data, no patient name.
create or replace function public.verify_prescription(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select jsonb_build_object(
      'valid', v.status = 'approved' and r.status = 'active' and v.verify_expires_at > now(),
      'status', case when r.status = 'cancelled' then 'cancelled' when v.status = 'superseded' then 'superseded'
                     when v.verify_expires_at <= now() then 'expired' else 'approved' end,
      'rx_number', r.rx_number, 'version_no', v.version_no, 'approved_at', v.approved_at,
      'practitioner', v.snapshot -> 'practitioner' ->> 'full_name', 'facility', v.snapshot -> 'facility' ->> 'name')
    from public.prescription_versions v join public.prescriptions r on r.id = v.prescription_id
    where v.verify_token = p_token), jsonb_build_object('valid', false, 'status', 'unknown'));
$$;

-- Pharmacy inbox (Phase 4 adds preparation/dispensing on top).
create or replace function public.pharmacy_inbox(p_pharmacy_id uuid, p_status text default null)
returns table (dispatch_id uuid, prescription_id uuid, rx_number text, status text, rx_status public.rx_status,
               version_no int, sent_at timestamptz, received_at timestamptz, patient_name text, patient_code text,
               practitioner_name text, facility_name text, item_count int, printed_count int, revised boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not private.has_facility_role(p_pharmacy_id, array['pharmacist', 'pharmacy_staff']::public.member_role[]) then
    perform private.fail('forbidden');
  end if;
  return query
  select d.id, r.id, r.rx_number, d.status, r.status, v.version_no, d.sent_at, d.received_at,
         p.full_name, p.public_code, v.snapshot -> 'practitioner' ->> 'full_name', v.snapshot -> 'facility' ->> 'name',
         (select count(*)::int from public.prescription_items i where i.version_id = v.id),
         (select count(*)::int from public.prescription_events ev where ev.prescription_id = r.id and ev.event = 'printed'
            and ev.facility_id = p_pharmacy_id),
         v.version_no > 1
    from public.prescription_dispatches d
    join public.prescriptions r on r.id = d.prescription_id
    join public.prescription_versions v on v.id = d.version_id
    join public.patients p on p.id = r.patient_id
   where d.pharmacy_id = p_pharmacy_id and (p_status is null or d.status = p_status)
   order by d.updated_at desc
   limit 200;
end;
$$;

create or replace function public.pharmacy_prescription(p_dispatch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  d public.prescription_dispatches;
  v public.prescription_versions;
  r public.prescriptions;
begin
  select * into d from public.prescription_dispatches where id = p_dispatch_id;
  if d.id is null or not private.has_facility_role(d.pharmacy_id, array['pharmacist', 'pharmacy_staff']::public.member_role[]) then
    perform private.fail('forbidden');
  end if;
  select * into r from public.prescriptions where id = d.prescription_id;
  select * into v from public.prescription_versions where id = d.version_id;
  return v.snapshot || jsonb_build_object(
    'dispatch_id', d.id, 'dispatch_status', d.status, 'rx_status', r.status, 'prescription_id', r.id,
    'version_status', v.status, 'revision_reason', v.revision_reason,
    -- safety information authorized for dispensing (documented allergies only)
    'allergies', coalesce((select jsonb_agg(jsonb_build_object('substance', a.substance, 'severity', a.severity))
                            from public.allergies a where a.patient_id = r.patient_id and a.status = 'active'), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object('event', e.event, 'at', e.occurred_at) order by e.occurred_at)
                         from public.prescription_events e where e.prescription_id = r.id
                           and (e.facility_id = d.pharmacy_id or e.event in ('approved', 'revised', 'cancelled'))), '[]'::jsonb));
end;
$$;

create or replace function public.pharmacy_mark_received(p_dispatch_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.prescription_dispatches;
begin
  select * into d from public.prescription_dispatches where id = p_dispatch_id for update;
  if d.id is null or not private.has_facility_role(d.pharmacy_id, array['pharmacist', 'pharmacy_staff']::public.member_role[]) then
    perform private.fail('forbidden');
  end if;
  if d.status <> 'sent' then return; end if;
  update public.prescription_dispatches set status = 'received', received_at = now(), updated_at = now() where id = d.id;
  insert into public.prescription_events (prescription_id, version_id, event, facility_id, actor_user_id)
  values (d.prescription_id, d.version_id, 'received', d.pharmacy_id, auth.uid());
end;
$$;

-- Active pharmacies to choose from (default first = visit location).
create or replace function public.pharmacy_choices(p_encounter_id uuid)
returns table (pharmacy_id uuid, name text, branch text, is_default boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  def uuid;
begin
  if not private.is_encounter_author(p_encounter_id) then perform private.fail('forbidden'); end if;
  select f.default_pharmacy_id into def from public.encounters e join public.facilities f on f.id = e.facility_id where e.id = p_encounter_id;
  return query
  select f.id, f.name, b.name, f.id = def
    from public.facilities f join public.branches b on b.id = f.branch_id
   where f.type = 'pharmacy' and f.status = 'active'
   order by (f.id = def) desc, f.name;
end;
$$;

revoke execute on function
  public.search_medications(text, uuid), public.save_prescription_draft(uuid, jsonb, text, uuid),
  public.approve_prescription(uuid, uuid, text), public.revise_prescription(uuid), public.cancel_prescription(uuid, text),
  public.record_prescription_print(uuid, uuid), public.prescription_document(uuid), public.pharmacy_inbox(uuid, text),
  public.pharmacy_prescription(uuid), public.pharmacy_mark_received(uuid), public.pharmacy_choices(uuid)
from public, anon;
grant execute on function
  public.search_medications(text, uuid), public.save_prescription_draft(uuid, jsonb, text, uuid),
  public.approve_prescription(uuid, uuid, text), public.revise_prescription(uuid), public.cancel_prescription(uuid, text),
  public.record_prescription_print(uuid, uuid), public.prescription_document(uuid), public.pharmacy_inbox(uuid, text),
  public.pharmacy_prescription(uuid), public.pharmacy_mark_received(uuid), public.pharmacy_choices(uuid)
to authenticated;
grant execute on function public.verify_prescription(text) to anon, authenticated;
