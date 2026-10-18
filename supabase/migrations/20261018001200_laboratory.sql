-- =====================================================================
-- 0012 Laboratory (Phase 3, spec §12).
--   * Lab-defined catalog (prices, specimen, preparation, reference text).
--   * Orders from a doctor referral (service request, not an automatic
--     time booking) or a direct walk-in visit at the lab.
--   * Specimen barcode independent of the patient QR; rejection +
--     recollection.
--   * Technician saves DRAFT results; only an approver releases them.
--     Partial release is supported and never marks the whole order done.
--   * Release → patient sees it + ordering doctor gets a review TASK (no
--     automatic interpretation). Correction = new version keeping the
--     original + reason, notifying both.
--   * No invented reference ranges, flags or diagnoses: every value,
--     range and flag is typed by the lab.
-- =====================================================================

create type public.lab_status as enum
  ('ordered', 'scheduled', 'checked_in', 'sample_collected', 'processing', 'pending_review', 'released', 'cancelled', 'sample_rejected');

create table public.lab_test_catalog (
  id uuid primary key default gen_random_uuid(),
  lab_facility_id uuid not null references public.facilities (id),
  code text not null,
  name text not null,
  specimen_type text not null,
  unit text,
  reference_range_text text,           -- written by the lab
  price_minor bigint check (price_minor >= 0),
  turnaround_hours int check (turnaround_hours > 0),
  preparation_note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (lab_facility_id, code)
);

create table public.lab_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('L' || private.random_code(8)),
  patient_id uuid not null references public.patients (id),
  lab_facility_id uuid not null references public.facilities (id),
  source text not null check (source in ('referral', 'direct')),
  encounter_id uuid references public.encounters (id),
  ordering_practitioner_id uuid references public.practitioner_profiles (id),
  ordering_facility_id uuid references public.facilities (id),
  status public.lab_status not null default 'ordered',
  clinical_note text,                 -- shown to the lab (reason for test)
  created_by uuid not null references public.profiles (id),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1,
  unique (created_by, idempotency_key),
  check ((source = 'referral') = (encounter_id is not null and ordering_practitioner_id is not null))
);
create index lab_orders_lab_idx on public.lab_orders (lab_facility_id, created_at desc);
create index lab_orders_patient_idx on public.lab_orders (patient_id);
create trigger lab_orders_touch before update on public.lab_orders
  for each row execute function private.touch_row();
alter table public.clinical_tasks add constraint clinical_tasks_lab_order_fk foreign key (lab_order_id) references public.lab_orders (id);

create table public.lab_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.lab_orders (id),
  test_id uuid not null references public.lab_test_catalog (id),
  display_name text not null,
  status public.lab_status not null default 'ordered',
  released_at timestamptz,
  unique (order_id, test_id)
);

create table public.specimens (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.lab_orders (id),
  barcode text not null unique default ('S' || private.random_code(10)),
  specimen_type text not null,
  status text not null default 'collected' check (status in ('collected', 'rejected')),
  collected_by uuid not null references public.profiles (id),
  collected_at timestamptz not null default now(),
  rejection_reason text,
  rejected_at timestamptz
);

create table public.lab_results (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.lab_order_items (id),
  version_no int not null,
  status text not null default 'draft' check (status in ('draft', 'released', 'superseded')),
  value_text text,
  value_numeric numeric,
  unit text,
  reference_range text,
  lab_flag text check (lab_flag in ('low', 'high', 'abnormal', 'critical')),
  notes text,
  entered_by uuid not null references public.profiles (id),
  released_by uuid references public.profiles (id),
  released_at timestamptz,
  supersedes_id uuid references public.lab_results (id),
  correction_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_item_id, version_no),
  check (value_text is not null or value_numeric is not null),
  check (supersedes_id is null or correction_reason is not null)
);
create unique index lab_results_one_draft on public.lab_results (order_item_id) where status = 'draft';
create unique index lab_results_one_released on public.lab_results (order_item_id) where status = 'released';
create trigger lab_results_no_delete before delete on public.lab_results
  for each row execute function private.forbid_delete();

create or replace function private.protect_released_results()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'superseded' or (old.status = 'released' and new.status is distinct from 'superseded') then
    perform private.fail('signed_record_locked');
  end if;
  if old.status = 'released' and (new.value_text, new.value_numeric, new.unit, new.reference_range, new.lab_flag, new.notes)
       is distinct from (old.value_text, old.value_numeric, old.unit, old.reference_range, old.lab_flag, old.notes) then
    perform private.fail('signed_record_locked');
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger lab_results_lock before update on public.lab_results
  for each row execute function private.protect_released_results();

-- =====================================================================
-- Access helpers
-- =====================================================================
create or replace function private.is_lab_staff(p_lab_facility_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_facility_role(p_lab_facility_id, array['lab_technician', 'lab_approver']::public.member_role[]);
$$;

create or replace function private.is_ordering_doctor(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.lab_orders o
                  where o.id = p_order_id and o.ordering_practitioner_id = private.current_practitioner_id()
                    and private.has_facility_role(o.ordering_facility_id, array['doctor']::public.member_role[]));
$$;

-- who may see RELEASED results of an order (lab staff see drafts too)
create or replace function private.can_read_lab_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.lab_orders o where o.id = p_order_id and (
            private.is_lab_staff(o.lab_facility_id)
         or private.is_ordering_doctor(o.id)
         or private.is_linked_to_patient(o.patient_id)
         or private.has_consent(o.patient_id, 'lab_result', o.id)));
$$;

create or replace function private.refresh_lab_order_status(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  total int; rel int; canc int;
begin
  select count(*), count(*) filter (where status = 'released'), count(*) filter (where status = 'cancelled')
    into total, rel, canc from public.lab_order_items where order_id = p_order_id;
  if total > 0 and rel + canc = total and rel > 0 then
    update public.lab_orders set status = 'released' where id = p_order_id and status <> 'released';
  elsif rel > 0 then
    update public.lab_orders set status = 'processing' where id = p_order_id;   -- partial: never "all ready"
  end if;
end;
$$;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.lab_test_catalog enable row level security;
alter table public.lab_orders enable row level security;
alter table public.lab_order_items enable row level security;
alter table public.specimens enable row level security;
alter table public.lab_results enable row level security;

create policy lab_catalog_read on public.lab_test_catalog for select using (is_active or private.is_lab_staff(lab_facility_id));
create policy lab_catalog_write on public.lab_test_catalog for all to authenticated
  using (private.has_facility_role(lab_facility_id, array['lab_approver', 'facility_admin']::public.member_role[]))
  with check (private.has_facility_role(lab_facility_id, array['lab_approver', 'facility_admin']::public.member_role[]));
create policy lab_orders_read on public.lab_orders for select to authenticated using (private.can_read_lab_order(id));
create policy lab_items_read on public.lab_order_items for select to authenticated using (private.can_read_lab_order(order_id));
create policy specimens_read on public.specimens for select to authenticated
  using (exists (select 1 from public.lab_orders o where o.id = specimens.order_id and private.is_lab_staff(o.lab_facility_id)));
create policy lab_results_read on public.lab_results for select to authenticated
  using (exists (select 1 from public.lab_order_items i join public.lab_orders o on o.id = i.order_id
                  where i.id = lab_results.order_item_id
                    and (private.is_lab_staff(o.lab_facility_id)
                         or (lab_results.status in ('released', 'superseded') and private.can_read_lab_order(o.id)))));

grant select on public.lab_test_catalog to anon, authenticated;
grant insert, update on public.lab_test_catalog to authenticated;
grant select on public.lab_orders, public.lab_order_items, public.specimens, public.lab_results to authenticated;

-- =====================================================================
-- RPCs
-- =====================================================================
create or replace function private.insert_lab_order(
  p_patient_id uuid, p_lab_facility_id uuid, p_source text, p_encounter_id uuid, p_practitioner_id uuid,
  p_ordering_facility_id uuid, p_test_ids uuid[], p_idempotency_key text, p_note text
) returns public.lab_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.lab_orders;
  n int;
begin
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then perform private.fail('idempotency_key_required'); end if;
  select * into o from public.lab_orders where created_by = auth.uid() and idempotency_key = p_idempotency_key;
  if o.id is not null then return o; end if;
  if not exists (select 1 from public.facilities where id = p_lab_facility_id and type = 'laboratory' and status = 'active') then
    perform private.fail('invalid_lab');
  end if;
  if p_test_ids is null or array_length(p_test_ids, 1) is null then perform private.fail('items_required'); end if;
  select count(*) into n from public.lab_test_catalog where id = any (p_test_ids) and lab_facility_id = p_lab_facility_id and is_active;
  if n <> array_length(p_test_ids, 1) then perform private.fail('invalid_test'); end if;

  insert into public.lab_orders (patient_id, lab_facility_id, source, encounter_id, ordering_practitioner_id, ordering_facility_id,
                                 clinical_note, created_by, idempotency_key)
  values (p_patient_id, p_lab_facility_id, p_source, p_encounter_id, p_practitioner_id, p_ordering_facility_id, p_note,
          auth.uid(), p_idempotency_key)
  returning * into o;
  insert into public.lab_order_items (order_id, test_id, display_name)
  select o.id, t.id, t.name from public.lab_test_catalog t where t.id = any (p_test_ids);
  -- the referral gives the lab identity access for THIS patient (identity only)
  insert into public.care_relationships (patient_id, facility_id, source, created_by)
  values (p_patient_id, p_lab_facility_id, case when p_source = 'referral' then 'referral' else 'lab_visit' end, auth.uid())
  on conflict do nothing;
  return o;
end;
$$;

create or replace function public.order_lab_tests(
  p_encounter_id uuid,
  p_lab_facility_id uuid,
  p_test_ids uuid[],
  p_idempotency_key text,
  p_note text default null
) returns public.lab_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.encounters;
  o public.lab_orders;
begin
  if not private.is_encounter_author(p_encounter_id) then perform private.fail('forbidden'); end if;
  select * into e from public.encounters where id = p_encounter_id;
  if e.status not in ('in_progress', 'awaiting_results', 'ready_for_review') then perform private.fail('encounter_closed'); end if;
  o := private.insert_lab_order(e.patient_id, p_lab_facility_id, 'referral', e.id, e.practitioner_id, e.facility_id,
                                p_test_ids, p_idempotency_key, p_note);
  perform private.audit('lab_order.created', 'lab_order', o.id, e.facility_id, e.patient_id);
  return o;
end;
$$;

-- Direct visit at the lab (no doctor): patient must be identified and
-- attached first (lookup + verification).
create or replace function public.lab_register_direct(
  p_lab_facility_id uuid,
  p_patient_id uuid,
  p_test_ids uuid[],
  p_idempotency_key text
) returns public.lab_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.lab_orders;
begin
  if not private.is_lab_staff(p_lab_facility_id) then perform private.fail('forbidden'); end if;
  if not exists (select 1 from public.care_relationships where patient_id = p_patient_id and facility_id = p_lab_facility_id and ended_at is null) then
    perform private.fail('patient_not_attached');
  end if;
  o := private.insert_lab_order(p_patient_id, p_lab_facility_id, 'direct', null, null, null, p_test_ids, p_idempotency_key, null);
  update public.lab_orders set status = 'checked_in' where id = o.id and status = 'ordered' returning * into o;
  update public.lab_order_items set status = 'checked_in' where order_id = o.id and status = 'ordered';
  perform private.audit('lab_order.direct', 'lab_order', o.id, p_lab_facility_id, p_patient_id);
  return o;
end;
$$;

create or replace function public.lab_check_in(p_order_id uuid)
returns public.lab_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.lab_orders;
begin
  select * into o from public.lab_orders where id = p_order_id for update;
  if o.id is null or not private.is_lab_staff(o.lab_facility_id) then perform private.fail('forbidden'); end if;
  if o.status not in ('ordered', 'scheduled') then perform private.fail('invalid_transition'); end if;
  update public.lab_orders set status = 'checked_in' where id = o.id returning * into o;
  update public.lab_order_items set status = 'checked_in' where order_id = o.id and status in ('ordered', 'scheduled');
  return o;
end;
$$;

create or replace function public.collect_specimen(p_order_id uuid, p_specimen_type text)
returns public.specimens
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.lab_orders;
  s public.specimens;
begin
  select * into o from public.lab_orders where id = p_order_id for update;
  if o.id is null or not private.is_lab_staff(o.lab_facility_id) then perform private.fail('forbidden'); end if;
  if o.status not in ('checked_in', 'sample_rejected', 'ordered', 'scheduled') then perform private.fail('invalid_transition'); end if;
  insert into public.specimens (order_id, specimen_type, collected_by) values (o.id, p_specimen_type, auth.uid()) returning * into s;
  update public.lab_orders set status = 'sample_collected' where id = o.id;
  update public.lab_order_items set status = 'sample_collected'
   where order_id = o.id and status in ('ordered', 'scheduled', 'checked_in', 'sample_rejected');
  return s;
end;
$$;

create or replace function public.reject_specimen(p_specimen_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.specimens;
  o public.lab_orders;
begin
  select * into s from public.specimens where id = p_specimen_id for update;
  select * into o from public.lab_orders where id = s.order_id for update;
  if s.id is null or not private.is_lab_staff(o.lab_facility_id) then perform private.fail('forbidden'); end if;
  if p_reason is null or length(trim(p_reason)) < 3 then perform private.fail('reason_required'); end if;
  update public.specimens set status = 'rejected', rejection_reason = p_reason, rejected_at = now() where id = s.id;
  update public.lab_order_items set status = 'sample_rejected' where order_id = o.id and status in ('sample_collected', 'processing');
  update public.lab_orders set status = 'sample_rejected' where id = o.id;
end;
$$;

create or replace function public.save_lab_result_draft(
  p_order_item_id uuid,
  p_value_text text default null,
  p_value_numeric numeric default null,
  p_unit text default null,
  p_reference_range text default null,
  p_lab_flag text default null,
  p_notes text default null
) returns public.lab_results
language plpgsql
security definer
set search_path = ''
as $$
declare
  it public.lab_order_items;
  o public.lab_orders;
  r public.lab_results;
begin
  select * into it from public.lab_order_items where id = p_order_item_id for update;
  select * into o from public.lab_orders where id = it.order_id;
  if it.id is null or not private.is_lab_staff(o.lab_facility_id) then perform private.fail('forbidden'); end if;
  if it.status not in ('sample_collected', 'processing', 'pending_review') then perform private.fail('invalid_transition'); end if;
  select * into r from public.lab_results where order_item_id = it.id and status = 'draft';
  if r.id is null then
    insert into public.lab_results (order_item_id, version_no, value_text, value_numeric, unit, reference_range, lab_flag, notes, entered_by)
    values (it.id, coalesce((select max(version_no) from public.lab_results where order_item_id = it.id), 0) + 1,
            p_value_text, p_value_numeric, p_unit, p_reference_range, p_lab_flag, p_notes, auth.uid())
    returning * into r;
  else
    update public.lab_results set value_text = p_value_text, value_numeric = p_value_numeric, unit = p_unit,
           reference_range = p_reference_range, lab_flag = p_lab_flag, notes = p_notes, entered_by = auth.uid()
     where id = r.id returning * into r;
  end if;
  update public.lab_order_items set status = 'pending_review' where id = it.id;
  update public.lab_orders set status = 'pending_review' where id = o.id and status in ('sample_collected', 'processing');
  return r;
end;
$$;

create or replace function private.after_results_released(p_order public.lab_orders, p_corrected boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_order.ordering_practitioner_id is not null then
    insert into public.clinical_tasks (practitioner_id, patient_id, facility_id, kind, lab_order_id, encounter_id)
    values (p_order.ordering_practitioner_id, p_order.patient_id, p_order.ordering_facility_id,
            case when p_corrected then 'review_corrected_result' else 'review_lab_result' end, p_order.id, p_order.encounter_id);
    update public.encounters set status = 'ready_for_review' where id = p_order.encounter_id and status = 'awaiting_results';
    perform private.notify_user((select user_id from public.practitioner_profiles where id = p_order.ordering_practitioner_id),
      case when p_corrected then 'lab.corrected_for_doctor' else 'lab.released_for_doctor' end,
      jsonb_build_object('lab_order_id', p_order.id, 'order_number', p_order.order_number),
      'labdoc:' || p_order.id || ':' || extract(epoch from now())::bigint);
  end if;
  perform private.notify_patient(p_order.patient_id, case when p_corrected then 'lab.corrected' else 'lab.released' end,
    jsonb_build_object('lab_order_id', p_order.id, 'order_number', p_order.order_number),
    'lab:' || p_order.id || ':' || extract(epoch from now())::bigint);
end;
$$;

-- Approver releases selected drafts (partial release allowed).
create or replace function public.release_lab_results(p_order_id uuid, p_item_ids uuid[])
returns public.lab_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.lab_orders;
  n int;
begin
  select * into o from public.lab_orders where id = p_order_id for update;
  if o.id is null or not private.has_facility_role(o.lab_facility_id, array['lab_approver']::public.member_role[]) then
    perform private.fail('forbidden');
  end if;
  with rel as (
    update public.lab_results r set status = 'released', released_by = auth.uid(), released_at = now()
      from public.lab_order_items i
     where r.order_item_id = i.id and i.order_id = o.id and i.id = any (p_item_ids) and r.status = 'draft'
    returning i.id
  )
  update public.lab_order_items set status = 'released', released_at = now() where id in (select id from rel);
  get diagnostics n = row_count;
  if n = 0 then perform private.fail('nothing_to_release'); end if;
  perform private.refresh_lab_order_status(o.id);
  select * into o from public.lab_orders where id = o.id;
  perform private.after_results_released(o, false);
  perform private.audit('lab_results.released', 'lab_order', o.id, o.lab_facility_id, o.patient_id, null, jsonb_build_object('items', n));
  return o;
end;
$$;

create or replace function public.correct_lab_result(
  p_result_id uuid,
  p_reason text,
  p_value_text text default null,
  p_value_numeric numeric default null,
  p_unit text default null,
  p_reference_range text default null,
  p_lab_flag text default null,
  p_notes text default null
) returns public.lab_results
language plpgsql
security definer
set search_path = ''
as $$
declare
  old public.lab_results;
  o public.lab_orders;
  r public.lab_results;
begin
  select * into old from public.lab_results where id = p_result_id for update;
  select o2.* into o from public.lab_orders o2 join public.lab_order_items i on i.order_id = o2.id where i.id = old.order_item_id;
  if old.id is null or not private.has_facility_role(o.lab_facility_id, array['lab_approver']::public.member_role[]) then
    perform private.fail('forbidden');
  end if;
  if old.status <> 'released' then perform private.fail('invalid_transition'); end if;
  if p_reason is null or length(trim(p_reason)) < 5 then perform private.fail('reason_required'); end if;
  update public.lab_results set status = 'superseded' where id = old.id;
  insert into public.lab_results (order_item_id, version_no, status, value_text, value_numeric, unit, reference_range, lab_flag, notes,
                                  entered_by, released_by, released_at, supersedes_id, correction_reason)
  values (old.order_item_id, old.version_no + 1, 'released', p_value_text, p_value_numeric, coalesce(p_unit, old.unit),
          coalesce(p_reference_range, old.reference_range), p_lab_flag, p_notes, auth.uid(), auth.uid(), now(), old.id, p_reason)
  returning * into r;
  perform private.after_results_released(o, true);
  perform private.audit('lab_result.corrected', 'lab_result', r.id, o.lab_facility_id, o.patient_id, p_reason);
  return r;
end;
$$;

-- Lab worklist (staff).
create or replace function public.lab_worklist(p_lab_facility_id uuid, p_status public.lab_status default null)
returns table (order_id uuid, order_number text, status public.lab_status, source text, created_at timestamptz,
               patient_id uuid, patient_name text, patient_code text, ordering_doctor text, ordering_facility text,
               item_count int, released_count int, latest_barcode text)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not private.is_lab_staff(p_lab_facility_id) then perform private.fail('forbidden'); end if;
  return query
  select o.id, o.order_number, o.status, o.source, o.created_at, p.id, p.full_name, p.public_code, pp.full_name, f.name,
         (select count(*)::int from public.lab_order_items i where i.order_id = o.id),
         (select count(*)::int from public.lab_order_items i where i.order_id = o.id and i.status = 'released'),
         (select s.barcode from public.specimens s where s.order_id = o.id and s.status = 'collected' order by s.collected_at desc limit 1)
    from public.lab_orders o
    join public.patients p on p.id = o.patient_id
    left join public.practitioner_profiles pp on pp.id = o.ordering_practitioner_id
    left join public.facilities f on f.id = o.ordering_facility_id
   where o.lab_facility_id = p_lab_facility_id and (p_status is null or o.status = p_status)
   order by o.created_at desc
   limit 200;
end;
$$;

-- Order detail: lab staff see drafts; doctor/patient see released only.
create or replace function public.lab_order_detail(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  o public.lab_orders;
  staff boolean;
begin
  if not private.can_read_lab_order(p_order_id) then perform private.fail('forbidden'); end if;
  select * into o from public.lab_orders where id = p_order_id;
  staff := private.is_lab_staff(o.lab_facility_id);
  return jsonb_build_object(
    'order', to_jsonb(o) - 'idempotency_key',
    'lab', (select name from public.facilities where id = o.lab_facility_id),
    'patient', (select jsonb_build_object('full_name', p.full_name, 'public_code', p.public_code, 'sex', p.sex,
                                          'birth_year', coalesce(p.birth_year, extract(year from p.birth_date)::int))
                  from public.patients p where p.id = o.patient_id),
    'ordering_doctor', (select full_name from public.practitioner_profiles where id = o.ordering_practitioner_id),
    'specimens', case when staff then coalesce((select jsonb_agg(to_jsonb(s) order by s.collected_at) from public.specimens s where s.order_id = o.id), '[]'::jsonb) end,
    'items', coalesce((select jsonb_agg(jsonb_build_object(
        'id', i.id, 'name', i.display_name, 'status', i.status, 'released_at', i.released_at,
        'catalog', (select jsonb_build_object('unit', t.unit, 'reference_range_text', t.reference_range_text, 'specimen_type', t.specimen_type)
                      from public.lab_test_catalog t where t.id = i.test_id),
        'results', coalesce((select jsonb_agg(to_jsonb(r) order by r.version_no) from public.lab_results r
                              where r.order_item_id = i.id and (staff or r.status in ('released', 'superseded'))), '[]'::jsonb))
        order by i.display_name) from public.lab_order_items i where i.order_id = o.id), '[]'::jsonb));
end;
$$;

revoke execute on function
  public.order_lab_tests(uuid, uuid, uuid[], text, text), public.lab_register_direct(uuid, uuid, uuid[], text),
  public.lab_check_in(uuid), public.collect_specimen(uuid, text), public.reject_specimen(uuid, text),
  public.save_lab_result_draft(uuid, text, numeric, text, text, text, text), public.release_lab_results(uuid, uuid[]),
  public.correct_lab_result(uuid, text, text, numeric, text, text, text, text),
  public.lab_worklist(uuid, public.lab_status), public.lab_order_detail(uuid)
from public, anon;
grant execute on function
  public.order_lab_tests(uuid, uuid, uuid[], text, text), public.lab_register_direct(uuid, uuid, uuid[], text),
  public.lab_check_in(uuid), public.collect_specimen(uuid, text), public.reject_specimen(uuid, text),
  public.save_lab_result_draft(uuid, text, numeric, text, text, text, text), public.release_lab_results(uuid, uuid[]),
  public.correct_lab_result(uuid, text, text, numeric, text, text, text, text),
  public.lab_worklist(uuid, public.lab_status), public.lab_order_detail(uuid)
to authenticated;
