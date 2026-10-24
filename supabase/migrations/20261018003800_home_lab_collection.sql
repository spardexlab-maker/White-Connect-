-- Home sample collection («تحليل منزلي», owner request, 24 Oct 2026):
--  * a lab can switch on home collection;
--  * the patient asks for a visit (tests from the lab's list, or the tests a
--    doctor already ordered at that lab), with address, phone, day and time window;
--  * the lab works through new / scheduled / on the way / collected, and the
--    patient follows each step on the phone (status history + notifications);
--  * when the sample is collected the order enters the lab's normal workflow
--    and the result comes back the usual way.

alter table public.facilities add column if not exists home_collection boolean not null default false;
alter table public.facilities add column if not exists home_collection_fee_minor bigint check (home_collection_fee_minor >= 0);
alter table public.facilities add column if not exists home_collection_note text;

create table public.home_lab_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique default ('H' || private.random_code(7)),
  patient_id uuid not null references public.patients (id),
  lab_facility_id uuid not null references public.facilities (id),
  lab_order_id uuid references public.lab_orders (id),          -- the doctor's order, or the one made at collection
  test_ids uuid[] not null default '{}',
  tests_text text,                                              -- names shown to both sides
  address text not null check (length(trim(address)) >= 5),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  phone text not null check (length(trim(phone)) >= 7),
  preferred_date date not null,
  preferred_window text not null check (preferred_window in ('morning', 'noon', 'evening')),
  notes text,
  status text not null default 'requested'
    check (status in ('requested', 'scheduled', 'on_the_way', 'collected', 'rejected', 'cancelled')),
  scheduled_at timestamptz,
  collector_name text,
  status_reason text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1,
  check (array_length(test_ids, 1) is not null or lab_order_id is not null)
);
create index home_lab_requests_lab_idx on public.home_lab_requests (lab_facility_id, status, preferred_date);
create index home_lab_requests_patient_idx on public.home_lab_requests (patient_id, created_at desc);
create trigger home_lab_requests_touch before update on public.home_lab_requests
  for each row execute function private.touch_row();

create table public.home_lab_request_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.home_lab_requests (id),
  status text not null,
  note text,
  at timestamptz not null default now(),
  by_user uuid references public.profiles (id)
);
create index home_lab_request_events_req_idx on public.home_lab_request_events (request_id, at);

alter table public.home_lab_requests enable row level security;
alter table public.home_lab_request_events enable row level security;
create policy home_lab_requests_read on public.home_lab_requests for select to authenticated
  using (private.is_linked_to_patient(patient_id) or private.is_lab_staff(lab_facility_id));
create policy home_lab_request_events_read on public.home_lab_request_events for select to authenticated
  using (exists (select 1 from public.home_lab_requests r where r.id = request_id
                  and (private.is_linked_to_patient(r.patient_id) or private.is_lab_staff(r.lab_facility_id))));
grant select on public.home_lab_requests, public.home_lab_request_events to authenticated;

-- labs that come to the patient's home
create or replace function public.home_collection_labs()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', f.id, 'name', f.name, 'phone', f.phone, 'area', b.area, 'address', b.address, 'city', c.name_ar,
      'latitude', b.latitude, 'longitude', b.longitude,
      'fee_minor', f.home_collection_fee_minor, 'note', f.home_collection_note,
      'tests', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'price_minor', t.price_minor,
                                                            'preparation_note', t.preparation_note) order by t.name), '[]'::jsonb)
                  from public.lab_test_catalog t where t.lab_facility_id = f.id and t.is_active))
      order by f.name), '[]'::jsonb)
    from public.facilities f
    join public.branches b on b.id = f.branch_id
    left join public.cities c on c.id = b.city_id
   where f.type = 'laboratory' and f.status = 'active' and f.is_public and f.home_collection;
$$;

-- the patient (or a linked family member) asks for a home visit
create or replace function public.request_home_lab(
  p_patient_id uuid,
  p_lab_facility_id uuid,
  p_test_ids uuid[],
  p_address text,
  p_phone text,
  p_date date,
  p_window text,
  p_notes text default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_lab_order_id uuid default null
) returns public.home_lab_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.home_lab_requests;
  names text;
  o public.lab_orders;
begin
  if not private.is_linked_to_patient(p_patient_id) then perform private.fail('forbidden'); end if;
  if not exists (select 1 from public.facilities where id = p_lab_facility_id and type = 'laboratory' and status = 'active' and home_collection) then
    perform private.fail('home_collection_unavailable');
  end if;
  if p_date is null or p_date < (now() at time zone 'Asia/Baghdad')::date or p_date > (now() at time zone 'Asia/Baghdad')::date + 30 then
    perform private.fail('invalid_date');
  end if;
  if p_window not in ('morning', 'noon', 'evening') then perform private.fail('invalid_input'); end if;
  if length(trim(coalesce(p_address, ''))) < 5 or length(trim(coalesce(p_phone, ''))) < 7 then perform private.fail('address_phone_required'); end if;
  if p_lab_order_id is not null then
    select * into o from public.lab_orders where id = p_lab_order_id;
    if o.id is null or o.patient_id <> p_patient_id or o.lab_facility_id <> p_lab_facility_id
       or o.status not in ('ordered', 'scheduled') then perform private.fail('invalid_lab_order'); end if;
    select string_agg(i.display_name, '، ' order by i.display_name) into names from public.lab_order_items i where i.order_id = o.id;
  else
    if p_test_ids is null or array_length(p_test_ids, 1) is null then perform private.fail('items_required'); end if;
    if (select count(*) from public.lab_test_catalog where id = any (p_test_ids) and lab_facility_id = p_lab_facility_id and is_active)
       <> array_length(p_test_ids, 1) then perform private.fail('invalid_test'); end if;
    select string_agg(t.name, '، ' order by t.name) into names from public.lab_test_catalog t where t.id = any (p_test_ids);
  end if;
  if exists (select 1 from public.home_lab_requests where patient_id = p_patient_id and lab_facility_id = p_lab_facility_id
              and status in ('requested', 'scheduled', 'on_the_way') and preferred_date = p_date) then
    perform private.fail('home_lab_duplicate');
  end if;

  insert into public.home_lab_requests (patient_id, lab_facility_id, lab_order_id, test_ids, tests_text, address, latitude, longitude,
                                        phone, preferred_date, preferred_window, notes, created_by)
  values (p_patient_id, p_lab_facility_id, p_lab_order_id, coalesce(case when p_lab_order_id is null then p_test_ids end, '{}'),
          names, trim(p_address), p_latitude, p_longitude, trim(p_phone), p_date, p_window, nullif(trim(coalesce(p_notes, '')), ''), auth.uid())
  returning * into r;
  insert into public.home_lab_request_events (request_id, status, by_user) values (r.id, 'requested', auth.uid());
  -- the lab gets to see who is asking (identity only)
  insert into public.care_relationships (patient_id, facility_id, source, created_by)
  values (p_patient_id, p_lab_facility_id, 'lab_visit', auth.uid()) on conflict do nothing;
  perform private.notify_facility_staff(p_lab_facility_id, array['lab_technician', 'lab_approver']::public.member_role[],
                                        'homelab.new', jsonb_build_object('request_number', r.request_number), 'homelab:' || r.id || ':new');
  perform private.audit('home_lab.requested', 'home_lab_request', r.id, p_lab_facility_id, p_patient_id);
  return r;
end;
$$;

-- notify every active member of a facility with one of the roles
create or replace function private.notify_facility_staff(p_facility_id uuid, p_roles public.member_role[], p_template text, p_payload jsonb, p_dedupe text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  u uuid;
begin
  for u in select distinct m.user_id from public.memberships m
            where m.facility_id = p_facility_id and m.role = any (p_roles) and m.status = 'active'
  loop
    perform private.notify_user(u, p_template, p_payload, p_dedupe, array['in_app', 'push']::public.notification_channel[]);
  end loop;
end;
$$;

-- the patient's requests with their timeline
create or replace function public.my_home_lab_requests()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'request_number', r.request_number, 'status', r.status, 'lab', f.name, 'lab_phone', f.phone,
      'tests', r.tests_text, 'address', r.address, 'preferred_date', r.preferred_date, 'preferred_window', r.preferred_window,
      'scheduled_at', r.scheduled_at, 'collector_name', r.collector_name, 'status_reason', r.status_reason,
      'lab_order_id', r.lab_order_id, 'lab_order_status', o.status, 'patient_name', p.full_name, 'created_at', r.created_at,
      'events', (select jsonb_agg(jsonb_build_object('status', e.status, 'at', e.at, 'note', e.note) order by e.at)
                   from public.home_lab_request_events e where e.request_id = r.id))
      order by r.created_at desc), '[]'::jsonb)
    from public.home_lab_requests r
    join public.facilities f on f.id = r.lab_facility_id
    join public.patients p on p.id = r.patient_id
    left join public.lab_orders o on o.id = r.lab_order_id
   where private.is_linked_to_patient(r.patient_id)
     and (r.status in ('requested', 'scheduled', 'on_the_way') or r.created_at > now() - interval '60 days');
$$;

create or replace function public.cancel_home_lab_request(p_request_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.home_lab_requests;
begin
  select * into r from public.home_lab_requests where id = p_request_id for update;
  if r.id is null or not private.is_linked_to_patient(r.patient_id) then perform private.fail('forbidden'); end if;
  if r.status not in ('requested', 'scheduled') then perform private.fail('invalid_transition'); end if;
  update public.home_lab_requests set status = 'cancelled', status_reason = nullif(trim(coalesce(p_reason, '')), '') where id = r.id;
  insert into public.home_lab_request_events (request_id, status, note, by_user) values (r.id, 'cancelled', nullif(trim(coalesce(p_reason, '')), ''), auth.uid());
  perform private.notify_facility_staff(r.lab_facility_id, array['lab_technician', 'lab_approver']::public.member_role[],
                                        'homelab.cancelled', jsonb_build_object('request_number', r.request_number), 'homelab:' || r.id || ':cancelled');
end;
$$;

-- the lab's list
create or replace function public.lab_home_requests(p_lab_facility_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_lab_staff(p_lab_facility_id) then perform private.fail('forbidden'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', r.id, 'request_number', r.request_number, 'status', r.status, 'patient_name', p.full_name, 'public_code', p.public_code,
      'phone', r.phone, 'address', r.address, 'latitude', r.latitude, 'longitude', r.longitude, 'tests', r.tests_text,
      'preferred_date', r.preferred_date, 'preferred_window', r.preferred_window, 'notes', r.notes,
      'scheduled_at', r.scheduled_at, 'collector_name', r.collector_name, 'status_reason', r.status_reason,
      'lab_order_id', r.lab_order_id, 'lab_order_number', o.order_number, 'lab_order_status', o.status,
      'from_doctor', (o.source = 'referral'), 'created_at', r.created_at)
      order by case r.status when 'requested' then 0 when 'on_the_way' then 1 when 'scheduled' then 2 else 3 end,
               coalesce(r.scheduled_at, r.preferred_date::timestamptz), r.created_at)
    from public.home_lab_requests r
    join public.patients p on p.id = r.patient_id
    left join public.lab_orders o on o.id = r.lab_order_id
   where r.lab_facility_id = p_lab_facility_id
     and (r.status in ('requested', 'scheduled', 'on_the_way') or r.updated_at > now() - interval '14 days')), '[]'::jsonb);
end;
$$;

-- the lab moves a request along: scheduled → on_the_way → collected, or rejected
create or replace function public.lab_update_home_request(
  p_request_id uuid,
  p_status text,
  p_scheduled_at timestamptz default null,
  p_collector_name text default null,
  p_note text default null
) returns public.home_lab_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.home_lab_requests;
  o public.lab_orders;
begin
  select * into r from public.home_lab_requests where id = p_request_id for update;
  if r.id is null or not private.is_lab_staff(r.lab_facility_id) then perform private.fail('forbidden'); end if;
  if not (
       (p_status = 'scheduled' and r.status in ('requested', 'scheduled'))
    or (p_status = 'on_the_way' and r.status = 'scheduled')
    or (p_status = 'collected' and r.status in ('scheduled', 'on_the_way'))
    or (p_status = 'rejected' and r.status in ('requested', 'scheduled'))
  ) then perform private.fail('invalid_transition'); end if;
  if p_status = 'scheduled' and (p_scheduled_at is null or p_scheduled_at < now() - interval '1 hour') then perform private.fail('invalid_date'); end if;
  if p_status = 'rejected' and length(trim(coalesce(p_note, ''))) < 3 then perform private.fail('reason_required'); end if;

  if p_status = 'collected' and r.lab_order_id is null then
    -- the sample is in: the order enters the lab's normal workflow
    o := private.insert_lab_order(r.patient_id, r.lab_facility_id, 'direct', null, null, null, r.test_ids,
                                  'homelab:' || r.id::text, 'سحب منزلي — طلب ' || r.request_number);
    r.lab_order_id := o.id;
  end if;

  update public.home_lab_requests
     set status = p_status,
         scheduled_at = case when p_status = 'scheduled' then p_scheduled_at else scheduled_at end,
         collector_name = coalesce(nullif(trim(coalesce(p_collector_name, '')), ''), collector_name),
         status_reason = case when p_status = 'rejected' then trim(p_note) else status_reason end,
         lab_order_id = r.lab_order_id
   where id = r.id
  returning * into r;
  insert into public.home_lab_request_events (request_id, status, note, by_user)
  values (r.id, p_status, nullif(trim(coalesce(p_note, '')), ''), auth.uid());
  perform private.notify_patient(r.patient_id, 'homelab.' || p_status,
                                 jsonb_build_object('request_number', r.request_number, 'starts_at', r.scheduled_at),
                                 'homelab:' || r.id || ':' || p_status || ':' || coalesce(extract(epoch from r.scheduled_at)::bigint, 0),
                                 array['in_app', 'push']::public.notification_channel[]);
  perform private.audit('home_lab.' || p_status, 'home_lab_request', r.id, r.lab_facility_id, r.patient_id, p_note);
  return r;
end;
$$;

-- the lab switches home collection on / off (with an optional visit fee and a note for patients)
create or replace function public.set_home_collection(p_lab_facility_id uuid, p_enabled boolean, p_fee_minor bigint default null, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- one person can run a small lab: any lab member may set it
  if not private.has_facility_role(p_lab_facility_id, array['lab_technician', 'lab_approver', 'facility_admin']::public.member_role[]) then
    perform private.fail('forbidden');
  end if;
  update public.facilities
     set home_collection = p_enabled, home_collection_fee_minor = p_fee_minor,
         home_collection_note = nullif(trim(coalesce(p_note, '')), '')
   where id = p_lab_facility_id and type = 'laboratory';
  perform private.audit('home_lab.settings', 'facility', p_lab_facility_id, p_lab_facility_id, null, null, jsonb_build_object('enabled', p_enabled));
end;
$$;

revoke execute on function public.home_collection_labs(), public.request_home_lab(uuid, uuid, uuid[], text, text, date, text, text, double precision, double precision, uuid),
  public.my_home_lab_requests(), public.cancel_home_lab_request(uuid, text), public.lab_home_requests(uuid),
  public.lab_update_home_request(uuid, text, timestamptz, text, text), public.set_home_collection(uuid, boolean, bigint, text) from public, anon;
grant execute on function public.home_collection_labs(), public.request_home_lab(uuid, uuid, uuid[], text, text, date, text, text, double precision, double precision, uuid),
  public.my_home_lab_requests(), public.cancel_home_lab_request(uuid, text), public.lab_home_requests(uuid),
  public.lab_update_home_request(uuid, text, timestamptz, text, text), public.set_home_collection(uuid, boolean, bigint, text) to authenticated;
grant execute on function public.home_collection_labs() to anon;

-- the lab's list updates live when a patient sends or cancels a request
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.home_lab_requests;
  end if;
end $$;
