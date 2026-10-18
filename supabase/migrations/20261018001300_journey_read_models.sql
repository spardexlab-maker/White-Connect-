-- =====================================================================
-- 0013 Read models: patient journey, patient prescriptions/results,
-- session orders and doctor review tasks.
-- =====================================================================

-- One timeline per patient, events linked to the same visit (§8, §23).
create or replace function public.patient_journey()
returns table (event_type text, occurred_at timestamptz, ref_id uuid, encounter_id uuid, patient_id uuid, patient_name text,
               facility_name text, practitioner_name text, status text, title text, corrected boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select patient_id from public.patient_account_links
     where user_id = auth.uid() and revoked_at is null and verified_at is not null
  )
  select 'visit', coalesce(e.started_at, e.created_at), e.id, e.id, p.id, p.full_name, f.name, pp.full_name, e.status::text,
         'زيارة', false
    from public.encounters e join mine m on m.patient_id = e.patient_id
    join public.patients p on p.id = e.patient_id join public.facilities f on f.id = e.facility_id
    join public.practitioner_profiles pp on pp.id = e.practitioner_id
  union all
  select 'prescription', v.approved_at, r.id, r.encounter_id, p.id, p.full_name, v.snapshot -> 'facility' ->> 'name',
         v.snapshot -> 'practitioner' ->> 'full_name', r.status::text,
         'وصفة ' || r.rx_number || case when v.version_no > 1 then ' (إصدار ' || v.version_no || ')' else '' end, v.version_no > 1
    from public.prescriptions r join mine m on m.patient_id = r.patient_id
    join public.patients p on p.id = r.patient_id
    join public.prescription_versions v on v.id = r.current_version_id
   where r.status <> 'draft'
  union all
  select 'lab', coalesce((select max(i.released_at) from public.lab_order_items i where i.order_id = o.id), o.created_at), o.id,
         o.encounter_id, p.id, p.full_name, f.name, pp.full_name, o.status::text,
         'تحاليل ' || o.order_number,
         exists (select 1 from public.lab_results r join public.lab_order_items i on i.id = r.order_item_id
                  where i.order_id = o.id and r.supersedes_id is not null)
    from public.lab_orders o join mine m on m.patient_id = o.patient_id
    join public.patients p on p.id = o.patient_id join public.facilities f on f.id = o.lab_facility_id
    left join public.practitioner_profiles pp on pp.id = o.ordering_practitioner_id
  order by 2 desc;
$$;

create or replace function public.my_prescriptions()
returns table (prescription_id uuid, rx_number text, status public.rx_status, version_no int, approved_at timestamptz,
               patient_name text, practitioner_name text, facility_name text, items jsonb, pharmacy_name text, dispatch_status text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.rx_number, r.status, v.version_no, v.approved_at, v.snapshot -> 'patient' ->> 'full_name',
         v.snapshot -> 'practitioner' ->> 'full_name', v.snapshot -> 'facility' ->> 'name', v.snapshot -> 'items',
         (select f.name from public.prescription_dispatches d join public.facilities f on f.id = d.pharmacy_id
           where d.prescription_id = r.id order by d.sent_at desc limit 1),
         (select d.status from public.prescription_dispatches d where d.prescription_id = r.id order by d.sent_at desc limit 1)
    from public.prescriptions r
    join public.prescription_versions v on v.id = r.current_version_id
   where r.status <> 'draft' and private.is_linked_to_patient(r.patient_id)
   order by v.approved_at desc;
$$;

create or replace function public.my_lab_orders()
returns table (order_id uuid, order_number text, status public.lab_status, created_at timestamptz, lab_name text,
               ordering_doctor text, patient_name text, item_count int, released_count int)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.order_number, o.status, o.created_at, f.name, pp.full_name, p.full_name,
         (select count(*)::int from public.lab_order_items i where i.order_id = o.id),
         (select count(*)::int from public.lab_order_items i where i.order_id = o.id and i.status = 'released')
    from public.lab_orders o join public.facilities f on f.id = o.lab_facility_id
    join public.patients p on p.id = o.patient_id
    left join public.practitioner_profiles pp on pp.id = o.ordering_practitioner_id
   where private.is_linked_to_patient(o.patient_id)
   order by o.created_at desc;
$$;

-- Everything ordered in a session (doctor's view, drafts included).
create or replace function public.encounter_orders(p_encounter_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_encounter_author(p_encounter_id) then perform private.fail('forbidden'); end if;
  return jsonb_build_object(
    'prescriptions', coalesce((select jsonb_agg(jsonb_build_object(
        'id', r.id, 'rx_number', r.rx_number, 'status', r.status,
        'current_version_no', (select version_no from public.prescription_versions where id = r.current_version_id),
        'draft', (select jsonb_build_object('version_id', v.id, 'version_no', v.version_no,
                         'items', coalesce((select jsonb_agg(to_jsonb(i) order by i.line_no) from public.prescription_items i where i.version_id = v.id), '[]'::jsonb))
                    from public.prescription_versions v where v.prescription_id = r.id and v.status = 'draft'),
        'approved_items', (select v.snapshot -> 'items' from public.prescription_versions v where v.id = r.current_version_id),
        'dispatches', coalesce((select jsonb_agg(jsonb_build_object('pharmacy', f.name, 'status', d.status))
                                  from public.prescription_dispatches d join public.facilities f on f.id = d.pharmacy_id
                                 where d.prescription_id = r.id), '[]'::jsonb))
        order by r.created_at) from public.prescriptions r where r.encounter_id = p_encounter_id), '[]'::jsonb),
    'lab_orders', coalesce((select jsonb_agg(jsonb_build_object(
        'id', o.id, 'order_number', o.order_number, 'status', o.status, 'lab', f.name,
        'items', (select jsonb_agg(jsonb_build_object('name', i.display_name, 'status', i.status)) from public.lab_order_items i where i.order_id = o.id))
        order by o.created_at) from public.lab_orders o join public.facilities f on f.id = o.lab_facility_id
       where o.encounter_id = p_encounter_id), '[]'::jsonb));
end;
$$;

create or replace function public.my_clinical_tasks()
returns table (task_id uuid, kind text, created_at timestamptz, patient_id uuid, patient_name text, patient_code text,
               lab_order_id uuid, order_number text, encounter_id uuid, has_critical boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.kind, t.created_at, p.id, p.full_name, p.public_code, t.lab_order_id, o.order_number, t.encounter_id,
         exists (select 1 from public.lab_results r join public.lab_order_items i on i.id = r.order_item_id
                  where i.order_id = t.lab_order_id and r.status = 'released' and r.lab_flag = 'critical')
    from public.clinical_tasks t
    join public.patients p on p.id = t.patient_id
    left join public.lab_orders o on o.id = t.lab_order_id
   where t.practitioner_id = private.current_practitioner_id() and t.status = 'open'
   order by 10 desc, t.created_at;
$$;

-- Labs available to send to from a session (default first = visit location).
create or replace function public.lab_choices(p_encounter_id uuid)
returns table (lab_id uuid, name text, branch text, is_default boolean, tests jsonb)
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
  select f.default_lab_id into def from public.encounters e join public.facilities f on f.id = e.facility_id where e.id = p_encounter_id;
  return query
  select f.id, f.name, b.name, f.id = def,
         coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'code', t.code, 'name', t.name, 'specimen_type', t.specimen_type,
                                                       'price_minor', t.price_minor) order by t.name)
                     from public.lab_test_catalog t where t.lab_facility_id = f.id and t.is_active), '[]'::jsonb)
    from public.facilities f join public.branches b on b.id = f.branch_id
   where f.type = 'laboratory' and f.status = 'active'
   order by (f.id = def) desc, f.name;
end;
$$;

revoke execute on function public.patient_journey(), public.my_prescriptions(), public.my_lab_orders(),
  public.encounter_orders(uuid), public.my_clinical_tasks(), public.lab_choices(uuid) from public, anon;
grant execute on function public.patient_journey(), public.my_prescriptions(), public.my_lab_orders(),
  public.encounter_orders(uuid), public.my_clinical_tasks(), public.lab_choices(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.prescription_dispatches, public.lab_orders, public.clinical_tasks;
  end if;
end $$;
