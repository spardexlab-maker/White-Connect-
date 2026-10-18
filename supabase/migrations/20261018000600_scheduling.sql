-- =====================================================================
-- 0006 Scheduling engine: services, resources, policies, weekly
-- schedules, exceptions, appointments (overlap-proof), events, queue,
-- delay notices, public discovery.
--
-- Overlap prevention (§6): every slot-holding appointment stores its
-- blocked interval [start, end + buffer) and an EXCLUDE USING gist
-- constraint forbids two holding rows of the same practitioner (across
-- ALL facilities) or the same resource from overlapping. Half-open ranges
-- let 18:30 start right after 18:00–18:30. Every booking path (patient
-- app, reception, reschedule, walk-in assignment) goes through the same
-- private.insert_appointment() and therefore the same constraint.
-- =====================================================================

create type public.appointment_status as enum (
  'awaiting_confirmation', 'confirmed', 'checked_in', 'fulfilled',
  'cancelled', 'rejected', 'no_show', 'expired'
);
create type public.booking_source as enum ('app', 'web', 'reception');
create type public.queue_status as enum ('waiting', 'called', 'in_session', 'done', 'left', 'cancelled');

-- ---------------------------------------------------------------------
-- Services (visit types / lab collection services)
-- ---------------------------------------------------------------------
create table public.facility_resources (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id),
  name text not null,
  kind text not null check (kind in ('room', 'device', 'collection_station')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1,
  unique (id, facility_id)
);
create trigger facility_resources_touch before update on public.facility_resources
  for each row execute function private.touch_row();

create table public.clinic_services (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id),
  practitioner_id uuid references public.practitioner_profiles (id),   -- null = any doctor / lab service
  name text not null check (length(trim(name)) > 0),
  description text,
  duration_minutes int not null check (duration_minutes between 5 and 480),
  buffer_minutes int not null default 0 check (buffer_minutes between 0 and 120),
  price_minor bigint check (price_minor >= 0),
  currency text not null default 'IQD',
  resource_id uuid,
  preparation_note text,
  is_public boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1,
  foreign key (resource_id, facility_id) references public.facility_resources (id, facility_id)
);
create index clinic_services_facility_idx on public.clinic_services (facility_id) where is_active;
create trigger clinic_services_touch before update on public.clinic_services
  for each row execute function private.touch_row();

-- ---------------------------------------------------------------------
-- Booking policy per (facility, practitioner) — practitioner null =
-- facility default. Snapshotted values are copied into appointments.
-- ---------------------------------------------------------------------
create table public.booking_policies (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id),
  practitioner_id uuid references public.practitioner_profiles (id),
  confirmation_mode text not null default 'manual' check (confirmation_mode in ('manual', 'auto')),
  confirmation_timeout_minutes int not null default 120 check (confirmation_timeout_minutes between 5 and 2880),
  booking_window_days int not null default 30 check (booking_window_days between 1 and 365),
  min_notice_minutes int not null default 30 check (min_notice_minutes between 0 and 10080),
  slot_step_minutes int check (slot_step_minutes between 5 and 240),
  cancellation_cutoff_minutes int not null default 120 check (cancellation_cutoff_minutes >= 0),
  cancellation_policy_text text,
  late_policy_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1
);
create unique index booking_policies_unique on public.booking_policies
  (facility_id, coalesce(practitioner_id, '00000000-0000-0000-0000-000000000000'::uuid));
create trigger booking_policies_touch before update on public.booking_policies
  for each row execute function private.touch_row();

-- ---------------------------------------------------------------------
-- Weekly schedule (facility local time) + dated exceptions
-- weekday: 0 = Sunday … 6 = Saturday (extract(dow))
-- ---------------------------------------------------------------------
create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id),
  practitioner_id uuid references public.practitioner_profiles (id),  -- null = facility hours (labs)
  weekday smallint not null check (weekday between 0 and 6),
  start_local time not null,
  end_local time not null,
  valid_from date not null default current_date,
  valid_until date,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1,
  check (end_local > start_local),
  check (valid_until is null or valid_until >= valid_from)
);
create index schedules_lookup_idx on public.schedules (facility_id, practitioner_id, weekday);
create trigger schedules_touch before update on public.schedules
  for each row execute function private.touch_row();

create table public.schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid references public.facilities (id),                  -- null = all facilities (vacation)
  practitioner_id uuid references public.practitioner_profiles (id),
  period tstzrange not null check (not isempty(period) and lower_inc(period) and not upper_inc(period)),
  kind text not null check (kind in ('unavailable', 'available')),
  reason text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  check (facility_id is not null or practitioner_id is not null),
  check (kind = 'unavailable' or facility_id is not null)
);
create index schedule_exceptions_period_idx on public.schedule_exceptions using gist (period);

-- ---------------------------------------------------------------------
-- Appointments
-- ---------------------------------------------------------------------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  booking_number text not null unique default ('B' || private.random_code(7)),
  patient_id uuid not null references public.patients (id),
  facility_id uuid not null references public.facilities (id),
  practitioner_id uuid references public.practitioner_profiles (id),
  service_id uuid not null references public.clinic_services (id),
  resource_id uuid references public.facility_resources (id),
  status public.appointment_status not null,
  period tstzrange not null,                 -- [start, start + duration)
  blocked_period tstzrange not null,         -- [start, start + duration + buffer)
  duration_minutes int not null,             -- snapshot (§6)
  buffer_minutes int not null default 0,     -- snapshot
  price_minor bigint,                        -- snapshot
  currency text not null default 'IQD',
  timezone text not null,                    -- facility tz at booking time
  source public.booking_source not null,
  created_by uuid not null references public.profiles (id),
  confirmed_by uuid references public.profiles (id),
  confirmed_at timestamptz,
  confirmation_deadline timestamptz,
  cancellation_cutoff_minutes int not null default 0,
  idempotency_key text not null,
  rescheduled_from uuid references public.appointments (id),
  status_reason text,
  patient_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1,
  holds_slot boolean generated always as
    (status in ('awaiting_confirmation', 'confirmed', 'checked_in', 'fulfilled')) stored,
  unique (created_by, idempotency_key),
  check (practitioner_id is not null or resource_id is not null),
  check (lower_inc(period) and not upper_inc(period) and not isempty(period)),
  check (lower(blocked_period) = lower(period) and upper(blocked_period) >= upper(period)),
  check (status <> 'awaiting_confirmation' or confirmation_deadline is not null),
  -- THE overlap guarantees
  constraint appointments_no_practitioner_overlap
    exclude using gist (practitioner_id with =, blocked_period with &&)
    where (holds_slot and practitioner_id is not null),
  constraint appointments_no_resource_overlap
    exclude using gist (resource_id with =, blocked_period with &&)
    where (holds_slot and resource_id is not null)
);
create index appointments_patient_idx on public.appointments (patient_id, lower(period) desc);
create index appointments_facility_day_idx on public.appointments (facility_id, lower(period));
create index appointments_pending_deadline_idx on public.appointments (confirmation_deadline)
  where status = 'awaiting_confirmation';
create trigger appointments_touch before update on public.appointments
  for each row execute function private.touch_row();

create table public.appointment_events (
  id bigint generated always as identity primary key,
  appointment_id uuid not null references public.appointments (id),
  from_status public.appointment_status,
  to_status public.appointment_status not null,
  actor_user_id uuid,
  reason text,
  occurred_at timestamptz not null default now()
);
create index appointment_events_appt_idx on public.appointment_events (appointment_id, occurred_at);

-- ---------------------------------------------------------------------
-- Queue (separate from appointments, §7)
-- ---------------------------------------------------------------------
create table public.queue_entries (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id),
  practitioner_id uuid references public.practitioner_profiles (id),
  patient_id uuid not null references public.patients (id),
  appointment_id uuid unique references public.appointments (id),
  kind text not null check (kind in ('appointment', 'walk_in')),
  status public.queue_status not null default 'waiting',
  service_date date not null,
  arrived_at timestamptz not null default now(),
  priority int not null default 0 check (priority between 0 and 10),
  priority_reason text,
  priority_set_by uuid references public.profiles (id),
  called_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1,
  idempotency_key text,
  check (kind = 'walk_in' or appointment_id is not null),
  check (priority = 0 or priority_reason is not null),
  unique (created_by, idempotency_key)
);
create index queue_day_idx on public.queue_entries (facility_id, service_date, status);
create trigger queue_entries_touch before update on public.queue_entries
  for each row execute function private.touch_row();

create table public.delay_notices (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id),
  practitioner_id uuid references public.practitioner_profiles (id),
  delay_minutes int not null check (delay_minutes between 0 and 600),
  message text,
  service_date date not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- =====================================================================
-- Helpers
-- =====================================================================
create or replace function private.facility_tz(p_facility_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(b.timezone, 'Asia/Baghdad')
    from public.facilities f join public.branches b on b.id = f.branch_id
   where f.id = p_facility_id;
$$;

-- Effective policy (practitioner-specific overrides facility default).
create or replace function private.effective_policy(p_facility_id uuid, p_practitioner_id uuid)
returns public.booking_policies
language sql
stable
security definer
set search_path = ''
as $$
  select bp.* from (
    select * from public.booking_policies
     where facility_id = p_facility_id and practitioner_id = p_practitioner_id
    union all
    select * from public.booking_policies
     where facility_id = p_facility_id and practitioner_id is null
    union all
    select gen_random_uuid(), p_facility_id, p_practitioner_id, 'manual', 120, 30, 30, null, 120,
           null, null, now(), now(), 1
  ) bp
  order by (bp.practitioner_id is not null and bp.practitioner_id = p_practitioner_id) desc,
           (bp.id in (select id from public.booking_policies)) desc
  limit 1;
$$;

-- Working windows for one practitioner/resource-owner at a facility over
-- a date range, as tstzranges (schedules + 'available' exceptions minus
-- nothing — unavailability is checked separately).
create or replace function private.working_windows(
  p_facility_id uuid,
  p_practitioner_id uuid,
  p_from date,
  p_to date
) returns setof tstzrange
language sql
stable
security definer
set search_path = ''
as $$
  with tz as (select private.facility_tz(p_facility_id) as name),
  days as (select d::date as day from generate_series(p_from, p_to, interval '1 day') d)
  select tstzrange(((days.day + s.start_local)::timestamp at time zone tz.name),
                   ((days.day + s.end_local)::timestamp at time zone tz.name), '[)')
    from days, tz, public.schedules s
   where s.facility_id = p_facility_id
     and s.practitioner_id is not distinct from p_practitioner_id
     and s.weekday = extract(dow from days.day)
     and days.day >= s.valid_from and (s.valid_until is null or days.day <= s.valid_until)
  union all
  select e.period from public.schedule_exceptions e, tz
   where e.kind = 'available' and e.facility_id = p_facility_id
     and e.practitioner_id is not distinct from p_practitioner_id
     and e.period && tstzrange((p_from::timestamp at time zone tz.name), ((p_to + 1)::timestamp at time zone tz.name), '[)');
$$;

create or replace function private.is_unavailable(p_facility_id uuid, p_practitioner_id uuid, p_period tstzrange)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.schedule_exceptions e
     where e.kind = 'unavailable' and e.period && p_period
       and ( (e.practitioner_id is not null and e.practitioner_id = p_practitioner_id
              and (e.facility_id is null or e.facility_id = p_facility_id))
          or (e.practitioner_id is null and e.facility_id = p_facility_id) )
  );
$$;

-- Release slots whose confirmation window elapsed. Atomic status change
-- (no reliance on now() in an index predicate).
create or replace function private.expire_overdue_internal(
  p_practitioner_id uuid default null,
  p_resource_id uuid default null
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  with expired as (
    update public.appointments
       set status = 'expired', status_reason = 'confirmation_timeout'
     where id in (
       select id from public.appointments
        where status = 'awaiting_confirmation' and confirmation_deadline <= now()
          and ((p_practitioner_id is null and p_resource_id is null)
               or practitioner_id = p_practitioner_id or resource_id = p_resource_id)
        order by id
        for update skip locked)
    returning id
  ), ev as (
    insert into public.appointment_events (appointment_id, from_status, to_status, reason)
    select id, 'awaiting_confirmation', 'expired', 'confirmation_timeout' from expired
    returning appointment_id
  )
  select count(*) into n from ev;
  return n;
end;
$$;

create or replace function public.expire_pending_appointments()
returns int
language sql
security definer
set search_path = ''
as $$ select private.expire_overdue_internal(); $$;

-- Transition table (§6).
create or replace function private.transition_allowed(p_from public.appointment_status, p_to public.appointment_status)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (p_from, p_to) in (
    ('awaiting_confirmation', 'confirmed'), ('awaiting_confirmation', 'rejected'),
    ('awaiting_confirmation', 'cancelled'), ('awaiting_confirmation', 'expired'),
    ('confirmed', 'checked_in'), ('confirmed', 'cancelled'), ('confirmed', 'no_show'),
    ('checked_in', 'fulfilled'), ('checked_in', 'cancelled')
  );
$$;

-- =====================================================================
-- Core insert — the single path every booking takes.
-- =====================================================================
create or replace function private.insert_appointment(
  p_patient_id uuid,
  p_facility_id uuid,
  p_practitioner_id uuid,
  p_service_id uuid,
  p_start timestamptz,
  p_source public.booking_source,
  p_idempotency_key text,
  p_enforce_patient_rules boolean,    -- min notice / booking window (patient self-booking)
  p_initial_status public.appointment_status default null,
  p_rescheduled_from uuid default null,
  p_patient_note text default null
) returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  svc public.clinic_services;
  fac public.facilities;
  pol public.booking_policies;
  tz text;
  appt public.appointments;
  p_end timestamptz;
  blocked tstzrange;
  st public.appointment_status;
begin
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then
    perform private.fail('idempotency_key_required');
  end if;

  -- idempotent replay
  select * into appt from public.appointments where created_by = auth.uid() and idempotency_key = p_idempotency_key;
  if appt.id is not null then
    return appt;
  end if;

  select * into fac from public.facilities where id = p_facility_id;
  if fac.id is null or fac.status <> 'active' then perform private.fail('facility_unavailable'); end if;

  select * into svc from public.clinic_services where id = p_service_id and facility_id = p_facility_id and is_active;
  if svc.id is null then perform private.fail('service_unavailable'); end if;
  if svc.practitioner_id is not null and svc.practitioner_id is distinct from p_practitioner_id then
    perform private.fail('service_unavailable');
  end if;
  if p_practitioner_id is not null and not private.practitioner_works_at(p_practitioner_id, p_facility_id) then
    perform private.fail('practitioner_not_at_facility');
  end if;
  if p_practitioner_id is null and svc.resource_id is null then
    perform private.fail('capacity_resource_required');
  end if;
  if not exists (select 1 from public.patients where id = p_patient_id and status = 'active') then
    perform private.fail('patient_not_found');
  end if;

  pol := private.effective_policy(p_facility_id, p_practitioner_id);
  tz := private.facility_tz(p_facility_id);
  p_end := p_start + make_interval(mins => svc.duration_minutes);
  blocked := tstzrange(p_start, p_end + make_interval(mins => svc.buffer_minutes), '[)');

  if p_start < now() then perform private.fail('slot_in_past'); end if;
  if p_enforce_patient_rules then
    if p_start < now() + make_interval(mins => pol.min_notice_minutes) then perform private.fail('slot_too_soon'); end if;
    if p_start > now() + make_interval(days => pol.booking_window_days) then perform private.fail('slot_outside_window'); end if;
  end if;

  -- must be fully inside one working window …
  if not exists (
    select 1 from private.working_windows(p_facility_id, p_practitioner_id,
                                          (p_start at time zone tz)::date - 1, (p_start at time zone tz)::date) w
     where w @> tstzrange(p_start, p_end, '[)')
  ) then
    perform private.fail('outside_working_hours');
  end if;
  -- … and not during a break / vacation / closure
  if private.is_unavailable(p_facility_id, p_practitioner_id, blocked) then
    perform private.fail('practitioner_unavailable');
  end if;

  -- free slots held by lapsed confirmations before competing for them
  perform private.expire_overdue_internal(p_practitioner_id, svc.resource_id);

  st := coalesce(p_initial_status,
                 case when p_source = 'reception' or pol.confirmation_mode = 'auto'
                      then 'confirmed'::public.appointment_status
                      else 'awaiting_confirmation'::public.appointment_status end);

  begin
    insert into public.appointments (
      patient_id, facility_id, practitioner_id, service_id, resource_id, status, period, blocked_period,
      duration_minutes, buffer_minutes, price_minor, currency, timezone, source, created_by,
      confirmed_by, confirmed_at, confirmation_deadline, cancellation_cutoff_minutes,
      idempotency_key, rescheduled_from, patient_note)
    values (
      p_patient_id, p_facility_id, p_practitioner_id, p_service_id, svc.resource_id, st,
      tstzrange(p_start, p_end, '[)'), blocked,
      svc.duration_minutes, svc.buffer_minutes, svc.price_minor, svc.currency, tz, p_source, auth.uid(),
      case when st in ('confirmed', 'checked_in') then auth.uid() end,
      case when st in ('confirmed', 'checked_in') then now() end,
      case when st = 'awaiting_confirmation'
           then least(now() + make_interval(mins => pol.confirmation_timeout_minutes), p_start) end,
      pol.cancellation_cutoff_minutes,
      p_idempotency_key, p_rescheduled_from, p_patient_note)
    returning * into appt;
  exception
    when exclusion_violation then
      perform private.fail('slot_unavailable');
    when unique_violation then
      -- concurrent replay with the same idempotency key
      select * into appt from public.appointments where created_by = auth.uid() and idempotency_key = p_idempotency_key;
      if appt.id is null then raise; end if;
      return appt;
  end;

  insert into public.appointment_events (appointment_id, from_status, to_status, actor_user_id, reason)
  values (appt.id, null, appt.status, auth.uid(), p_source::text);

  insert into public.care_relationships (patient_id, facility_id, practitioner_id, source, created_by)
  values (p_patient_id, p_facility_id, p_practitioner_id, 'appointment', auth.uid())
  on conflict do nothing;

  perform private.notify_patient(p_patient_id,
    case when appt.status = 'awaiting_confirmation' then 'appointment.requested' else 'appointment.confirmed' end,
    jsonb_build_object('appointment_id', appt.id, 'booking_number', appt.booking_number, 'starts_at', lower(appt.period)),
    'appt:' || appt.id || ':' || appt.status);

  return appt;
end;
$$;

-- =====================================================================
-- Public RPCs
-- =====================================================================

-- Patient (or guardian) books from the app / web.
create or replace function public.book_appointment(
  p_patient_id uuid,
  p_facility_id uuid,
  p_practitioner_id uuid,
  p_service_id uuid,
  p_start timestamptz,
  p_idempotency_key text,
  p_source public.booking_source default 'app',
  p_patient_note text default null
) returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  appt public.appointments;
begin
  if p_source = 'reception' then
    if not private.can_manage_reception(p_facility_id, p_practitioner_id)
       and not (p_practitioner_id is null and private.has_facility_role(p_facility_id,
                array['lab_technician', 'lab_approver', 'facility_admin']::public.member_role[])) then
      perform private.fail('forbidden');
    end if;
    if not private.staff_can_see_identity(p_patient_id) then
      perform private.fail('patient_not_attached');
    end if;
    appt := private.insert_appointment(p_patient_id, p_facility_id, p_practitioner_id, p_service_id, p_start,
                                       'reception', p_idempotency_key, false, null, null, p_patient_note);
  else
    if not private.is_linked_to_patient(p_patient_id) or not private.account_active() then
      perform private.fail('forbidden');
    end if;
    appt := private.insert_appointment(p_patient_id, p_facility_id, p_practitioner_id, p_service_id, p_start,
                                       p_source, p_idempotency_key, true, null, null, p_patient_note);
  end if;
  return appt;
end;
$$;

-- Reception quick booking (§7, §24): existing patient OR a name-only new
-- record, into a real slot OR the declared waiting list — one transaction.
create or replace function public.reception_quick_book(
  p_facility_id uuid,
  p_practitioner_id uuid,
  p_idempotency_key text,
  p_patient_id uuid default null,
  p_new_patient_name text default null,
  p_service_id uuid default null,
  p_start timestamptz default null,        -- null → waiting list
  p_phone text default null,
  p_sex public.patient_sex default null,
  p_birth_year int default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  pid uuid := p_patient_id;
  appt public.appointments;
  q public.queue_entries;
begin
  if not private.can_manage_reception(p_facility_id, p_practitioner_id) then
    perform private.fail('forbidden');
  end if;

  if p_idempotency_key is null or length(p_idempotency_key) < 8 then
    perform private.fail('idempotency_key_required');
  end if;
  -- replay safety
  if p_start is null then
    select * into q from public.queue_entries where created_by = auth.uid() and idempotency_key = p_idempotency_key;
    if q.id is not null then
      return jsonb_build_object('patient_id', q.patient_id, 'queue_entry_id', q.id);
    end if;
  else
    select * into appt from public.appointments where created_by = auth.uid() and idempotency_key = p_idempotency_key;
    if appt.id is not null then
      return jsonb_build_object('patient_id', appt.patient_id, 'appointment_id', appt.id,
                                'booking_number', appt.booking_number, 'status', appt.status);
    end if;
  end if;

  if pid is null then
    pid := (private.create_provisional_patient_internal(p_facility_id, p_new_patient_name, p_phone, p_sex, p_birth_year)).id;
  elsif not private.staff_can_see_identity(pid) then
    perform private.fail('patient_not_attached');
  end if;

  if p_start is not null then
    if p_service_id is null then perform private.fail('service_required'); end if;
    appt := private.insert_appointment(pid, p_facility_id, p_practitioner_id, p_service_id, p_start,
                                       'reception', p_idempotency_key, false);
    return jsonb_build_object('patient_id', pid, 'appointment_id', appt.id,
                              'booking_number', appt.booking_number, 'status', appt.status);
  end if;

  insert into public.queue_entries (facility_id, practitioner_id, patient_id, kind, service_date, created_by, idempotency_key)
  values (p_facility_id, p_practitioner_id, pid, 'walk_in',
          (now() at time zone private.facility_tz(p_facility_id))::date, auth.uid(), p_idempotency_key)
  returning * into q;
  insert into public.care_relationships (patient_id, facility_id, practitioner_id, source, created_by)
  values (pid, p_facility_id, p_practitioner_id, 'walk_in', auth.uid()) on conflict do nothing;
  perform private.audit('queue.walk_in_added', 'queue_entry', q.id, p_facility_id, pid, null,
                        '{}'::jsonb);
  return jsonb_build_object('patient_id', pid, 'queue_entry_id', q.id);
end;
$$;

-- Generic status change with authorization + transition validation.
create or replace function public.change_appointment_status(
  p_appointment_id uuid,
  p_to public.appointment_status,
  p_reason text default null,
  p_expected_version int default null
) returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  appt public.appointments;
  is_staff boolean;
  is_patient boolean;
  tz text;
  prev public.appointment_status;
begin
  select * into appt from public.appointments where id = p_appointment_id for update;
  if appt.id is null then perform private.fail('not_found'); end if;

  is_staff := private.can_manage_reception(appt.facility_id, appt.practitioner_id)
              or (appt.practitioner_id is null and private.has_facility_role(appt.facility_id,
                    array['lab_technician', 'lab_approver', 'facility_admin']::public.member_role[]));
  is_patient := private.is_linked_to_patient(appt.patient_id);

  if not (is_staff or (is_patient and p_to = 'cancelled')) then
    perform private.fail('forbidden');
  end if;
  if p_expected_version is not null and appt.version <> p_expected_version then
    perform private.fail('stale_version');
  end if;

  -- lapsed confirmation: expire now and report it; an old confirm cannot win
  if appt.status = 'awaiting_confirmation' and appt.confirmation_deadline <= now() then
    update public.appointments set status = 'expired', status_reason = 'confirmation_timeout'
     where id = appt.id returning * into appt;
    insert into public.appointment_events (appointment_id, from_status, to_status, actor_user_id, reason)
    values (appt.id, 'awaiting_confirmation', 'expired', auth.uid(), 'confirmation_timeout');
    return appt;     -- caller sees status = 'expired'
  end if;

  if not private.transition_allowed(appt.status, p_to) then
    perform private.fail('invalid_transition', appt.status::text || '->' || p_to::text);
  end if;
  if p_to in ('rejected', 'cancelled', 'no_show') and (p_reason is null or length(trim(p_reason)) = 0) then
    perform private.fail('reason_required');
  end if;
  if p_to = 'checked_in' then
    tz := appt.timezone;
    if (lower(appt.period) at time zone tz)::date <> (now() at time zone tz)::date then
      perform private.fail('check_in_not_today');
    end if;
  end if;

  prev := appt.status;
  update public.appointments
     set status = p_to,
         status_reason = coalesce(p_reason, status_reason),
         confirmed_by = case when p_to = 'confirmed' then auth.uid() else confirmed_by end,
         confirmed_at = case when p_to = 'confirmed' then now() else confirmed_at end
   where id = appt.id
  returning * into appt;

  insert into public.appointment_events (appointment_id, from_status, to_status, actor_user_id, reason)
  values (appt.id, prev, p_to, auth.uid(), p_reason);

  if p_to = 'checked_in' then
    insert into public.queue_entries (facility_id, practitioner_id, patient_id, appointment_id, kind, service_date, created_by)
    values (appt.facility_id, appt.practitioner_id, appt.patient_id, appt.id, 'appointment',
            (now() at time zone appt.timezone)::date, auth.uid())
    on conflict (appointment_id) do nothing;
  elsif p_to in ('cancelled', 'no_show') then
    update public.queue_entries set status = 'cancelled' where appointment_id = appt.id and status in ('waiting', 'called');
  end if;

  if p_to in ('confirmed', 'rejected', 'cancelled') then
    perform private.notify_patient(appt.patient_id, 'appointment.' || p_to::text,
      jsonb_build_object('appointment_id', appt.id, 'booking_number', appt.booking_number, 'starts_at', lower(appt.period)),
      'appt:' || appt.id || ':' || p_to::text);
  end if;
  return appt;
end;
$$;

-- Reschedule = one transaction: release old, insert new; on conflict the
-- whole function aborts and the original stays intact (§6, §18-b).
create or replace function public.reschedule_appointment(
  p_appointment_id uuid,
  p_new_start timestamptz,
  p_idempotency_key text,
  p_reason text default null
) returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  old public.appointments;
  new_appt public.appointments;
  is_staff boolean;
begin
  -- replay
  select * into new_appt from public.appointments where created_by = auth.uid() and idempotency_key = p_idempotency_key;
  if new_appt.id is not null then return new_appt; end if;

  select * into old from public.appointments where id = p_appointment_id for update;
  if old.id is null then perform private.fail('not_found'); end if;
  is_staff := private.can_manage_reception(old.facility_id, old.practitioner_id);
  if not (is_staff or private.is_linked_to_patient(old.patient_id)) then perform private.fail('forbidden'); end if;
  if old.status not in ('awaiting_confirmation', 'confirmed') then perform private.fail('invalid_transition'); end if;
  if not is_staff and lower(old.period) - make_interval(mins => old.cancellation_cutoff_minutes) < now() then
    perform private.fail('past_cancellation_cutoff');
  end if;

  update public.appointments set status = 'cancelled', status_reason = coalesce(p_reason, 'rescheduled')
   where id = old.id;
  insert into public.appointment_events (appointment_id, from_status, to_status, actor_user_id, reason)
  values (old.id, old.status, 'cancelled', auth.uid(), 'rescheduled');

  new_appt := private.insert_appointment(old.patient_id, old.facility_id, old.practitioner_id, old.service_id,
                                         p_new_start, case when is_staff then 'reception'::public.booking_source else old.source end,
                                         p_idempotency_key, not is_staff,
                                         case when is_staff or old.status = 'confirmed' then 'confirmed'::public.appointment_status end,
                                         old.id, old.patient_note);
  return new_appt;
end;
$$;

-- Walk-in from the waiting list gets a REAL slot via the same path.
create or replace function public.assign_walk_in_slot(
  p_queue_entry_id uuid,
  p_service_id uuid,
  p_start timestamptz,
  p_idempotency_key text
) returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.queue_entries;
  appt public.appointments;
begin
  select * into q from public.queue_entries where id = p_queue_entry_id for update;
  if q.id is null or q.kind <> 'walk_in' or q.appointment_id is not null then perform private.fail('not_found'); end if;
  if not private.can_manage_reception(q.facility_id, q.practitioner_id) then perform private.fail('forbidden'); end if;
  appt := private.insert_appointment(q.patient_id, q.facility_id, q.practitioner_id, p_service_id, p_start,
                                     'reception', p_idempotency_key, false, 'checked_in');
  update public.queue_entries set appointment_id = appt.id where id = q.id;
  return appt;
end;
$$;

-- Queue operations: call / start / finish / left, priority with reason.
create or replace function public.update_queue_entry(
  p_queue_entry_id uuid,
  p_status public.queue_status default null,
  p_priority int default null,
  p_priority_reason text default null
) returns public.queue_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.queue_entries;
begin
  select * into q from public.queue_entries where id = p_queue_entry_id for update;
  if q.id is null then perform private.fail('not_found'); end if;
  if not private.can_manage_reception(q.facility_id, q.practitioner_id) then perform private.fail('forbidden'); end if;
  if p_priority is not null then
    if p_priority > 0 and (p_priority_reason is null or length(trim(p_priority_reason)) < 3) then
      perform private.fail('reason_required');
    end if;
    update public.queue_entries
       set priority = p_priority, priority_reason = case when p_priority > 0 then p_priority_reason end,
           priority_set_by = auth.uid()
     where id = q.id;
    perform private.audit('queue.priority_changed', 'queue_entry', q.id, q.facility_id, q.patient_id, p_priority_reason,
                          jsonb_build_object('priority', p_priority));
  end if;
  if p_status is not null then
    update public.queue_entries
       set status = p_status,
           called_at = case when p_status = 'called' then now() else called_at end,
           started_at = case when p_status = 'in_session' then now() else started_at end,
           finished_at = case when p_status in ('done', 'left', 'cancelled') then now() else finished_at end
     where id = q.id;
  end if;
  select * into q from public.queue_entries where id = p_queue_entry_id;
  return q;
end;
$$;

-- Public delay notice: patients with a later appointment that day get a
-- generic message (no other patients' names).
create or replace function public.post_delay_notice(
  p_facility_id uuid,
  p_practitioner_id uuid,
  p_delay_minutes int,
  p_message text default null
) returns public.delay_notices
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.delay_notices;
  a record;
  tz text := private.facility_tz(p_facility_id);
begin
  if not private.can_manage_reception(p_facility_id, p_practitioner_id) then perform private.fail('forbidden'); end if;
  insert into public.delay_notices (facility_id, practitioner_id, delay_minutes, message, service_date, created_by)
  values (p_facility_id, p_practitioner_id, p_delay_minutes, p_message, (now() at time zone tz)::date, auth.uid())
  returning * into rec;
  for a in
    select id, patient_id from public.appointments
     where facility_id = p_facility_id and practitioner_id is not distinct from p_practitioner_id
       and status in ('confirmed', 'checked_in') and lower(period) > now()
       and (lower(period) at time zone tz)::date = rec.service_date
  loop
    perform private.notify_patient(a.patient_id, 'appointment.delay',
      jsonb_build_object('appointment_id', a.id, 'delay_minutes', p_delay_minutes),
      'delay:' || rec.id || ':' || a.id);
  end loop;
  return rec;
end;
$$;

-- =====================================================================
-- Read models
-- =====================================================================

-- Available slot starts (server-computed, §6). Public for discovery.
create or replace function public.get_available_slots(
  p_facility_id uuid,
  p_practitioner_id uuid,
  p_service_id uuid,
  p_from date,
  p_to date
) returns table (slot_start timestamptz, slot_end timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  svc public.clinic_services;
  pol public.booking_policies;
  step interval;
  dur interval;
  blk interval;
begin
  if p_to < p_from or p_to - p_from > 31 then perform private.fail('invalid_range'); end if;
  select * into svc from public.clinic_services s
   where s.id = p_service_id and s.facility_id = p_facility_id and s.is_active and s.is_public;
  if svc.id is null then return; end if;
  if not exists (select 1 from public.facilities f where f.id = p_facility_id and f.status = 'active') then return; end if;
  if p_practitioner_id is not null and not private.practitioner_works_at(p_practitioner_id, p_facility_id) then return; end if;

  pol := private.effective_policy(p_facility_id, p_practitioner_id);
  dur := make_interval(mins => svc.duration_minutes);
  blk := make_interval(mins => svc.duration_minutes + svc.buffer_minutes);
  step := make_interval(mins => coalesce(pol.slot_step_minutes, svc.duration_minutes + svc.buffer_minutes));

  return query
  with windows as (
    select w from private.working_windows(p_facility_id, p_practitioner_id, p_from, p_to) w
  ), candidates as (
    select distinct gs as s
      from windows, generate_series(lower(windows.w), upper(windows.w) - dur, step) gs
  )
  select c.s, c.s + dur
    from candidates c
   where c.s >= now() + make_interval(mins => pol.min_notice_minutes)
     and c.s <= now() + make_interval(days => pol.booking_window_days)
     and not private.is_unavailable(p_facility_id, p_practitioner_id, tstzrange(c.s, c.s + blk, '[)'))
     and not exists (
       select 1 from public.appointments a
        where a.holds_slot
          and not (a.status = 'awaiting_confirmation' and a.confirmation_deadline <= now())
          and a.blocked_period && tstzrange(c.s, c.s + blk, '[)')
          and ((p_practitioner_id is not null and a.practitioner_id = p_practitioner_id)
               or (svc.resource_id is not null and a.resource_id = svc.resource_id)))
   order by c.s;
end;
$$;

-- Provider discovery (doctors at clinics, laboratories). Only public
-- fields. Distance uses the branch's real coordinates (haversine, km).
create or replace function public.search_providers(
  p_kind text default 'doctor',            -- doctor | laboratory
  p_query text default null,
  p_specialty_id uuid default null,
  p_city_id uuid default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_max_km double precision default null,
  p_limit int default 30
) returns table (
  practitioner_id uuid,
  facility_id uuid,
  display_name text,
  title text,
  specialty_name text,
  facility_name text,
  organization_name text,
  branch_name text,
  area text,
  city_name text,
  address text,
  latitude double precision,
  longitude double precision,
  distance_km double precision,
  min_price_minor bigint,
  currency text,
  license_verified boolean,
  photo_path text,
  opening_hours_note text
)
language sql
stable
security definer
set search_path = ''
as $$
  with base as (
    select pp.id as practitioner_id, f.id as facility_id, pp.full_name as display_name, pp.title,
           sp.name_ar as specialty_name, f.name as facility_name, o.name as organization_name,
           b.name as branch_name, b.area, c.name_ar as city_name, b.address, b.latitude, b.longitude,
           b.city_id, pp.specialty_id, (pp.license_verified_at is not null) as license_verified,
           pp.photo_path, f.opening_hours_note
      from public.memberships m
      join public.practitioner_profiles pp on pp.user_id = m.user_id and pp.status = 'active'
      join public.facilities f on f.id = m.facility_id and f.status = 'active' and f.is_public
      join public.organizations o on o.id = f.organization_id and o.status = 'active'
      join public.branches b on b.id = f.branch_id
      left join public.cities c on c.id = b.city_id
      left join public.specialties sp on sp.id = pp.specialty_id
     where p_kind = 'doctor' and m.role = 'doctor' and m.status = 'active'
    union all
    select null, f.id, f.name, null, null, f.name, o.name, b.name, b.area, c.name_ar, b.address,
           b.latitude, b.longitude, b.city_id, null, true, null, f.opening_hours_note
      from public.facilities f
      join public.organizations o on o.id = f.organization_id and o.status = 'active'
      join public.branches b on b.id = f.branch_id
      left join public.cities c on c.id = b.city_id
     where p_kind = 'laboratory' and f.type = 'laboratory' and f.status = 'active' and f.is_public
  ), scored as (
    select base.*,
           case when p_lat is null or p_lng is null or base.latitude is null then null
                else 6371 * 2 * asin(sqrt(power(sin(radians(base.latitude - p_lat) / 2), 2)
                     + cos(radians(p_lat)) * cos(radians(base.latitude)) * power(sin(radians(base.longitude - p_lng) / 2), 2)))
           end as distance_km
      from base
  )
  select s.practitioner_id, s.facility_id, s.display_name, s.title, s.specialty_name, s.facility_name,
         s.organization_name, s.branch_name, s.area, s.city_name, s.address, s.latitude, s.longitude,
         round(s.distance_km::numeric, 1)::double precision,
         (select min(cs.price_minor) from public.clinic_services cs
           where cs.facility_id = s.facility_id and cs.is_active and cs.is_public
             and (cs.practitioner_id is null or cs.practitioner_id = s.practitioner_id)),
         'IQD', s.license_verified, s.photo_path, s.opening_hours_note
    from scored s
   where (p_specialty_id is null or s.specialty_id = p_specialty_id)
     and (p_city_id is null or s.city_id = p_city_id)
     and (p_max_km is null or (s.distance_km is not null and s.distance_km <= p_max_km))
     and (p_query is null or length(trim(p_query)) = 0
          or s.display_name ilike '%' || trim(p_query) || '%'
          or s.facility_name ilike '%' || trim(p_query) || '%'
          or coalesce(s.specialty_name, '') ilike '%' || trim(p_query) || '%'
          or coalesce(s.area, '') ilike '%' || trim(p_query) || '%'
          or exists (select 1 from public.clinic_services cs where cs.facility_id = s.facility_id and cs.is_active
                       and cs.is_public and cs.name ilike '%' || trim(p_query) || '%'))
   order by s.distance_km nulls last, s.display_name
   limit least(greatest(p_limit, 1), 100);
$$;

create or replace function public.get_provider_profile(p_facility_id uuid, p_practitioner_id uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'facility', jsonb_build_object('id', f.id, 'name', f.name, 'type', f.type, 'description', f.description,
                                   'phone', f.phone, 'opening_hours_note', f.opening_hours_note,
                                   'organization_name', o.name, 'branch_name', b.name, 'area', b.area,
                                   'address', b.address, 'city', c.name_ar, 'latitude', b.latitude,
                                   'longitude', b.longitude, 'timezone', b.timezone),
    'practitioner', case when pp.id is null then null else
                    jsonb_build_object('id', pp.id, 'full_name', pp.full_name, 'title', pp.title, 'bio', pp.bio,
                                       'specialty', sp.name_ar, 'license_verified', pp.license_verified_at is not null,
                                       'photo_path', pp.photo_path) end,
    'services', coalesce((select jsonb_agg(jsonb_build_object('id', cs.id, 'name', cs.name, 'description', cs.description,
                                   'duration_minutes', cs.duration_minutes, 'price_minor', cs.price_minor,
                                   'currency', cs.currency, 'preparation_note', cs.preparation_note) order by cs.name)
                           from public.clinic_services cs
                          where cs.facility_id = f.id and cs.is_active and cs.is_public
                            and (cs.practitioner_id is null or cs.practitioner_id = pp.id)), '[]'::jsonb),
    'weekly_hours', coalesce((select jsonb_agg(jsonb_build_object('weekday', s.weekday, 'start', s.start_local, 'end', s.end_local)
                                     order by s.weekday, s.start_local)
                               from public.schedules s
                              where s.facility_id = f.id and s.practitioner_id is not distinct from pp.id
                                and (s.valid_until is null or s.valid_until >= current_date)), '[]'::jsonb),
    'policy', (select jsonb_build_object('confirmation_mode', p.confirmation_mode,
                                         'confirmation_timeout_minutes', p.confirmation_timeout_minutes,
                                         'cancellation_cutoff_minutes', p.cancellation_cutoff_minutes,
                                         'cancellation_policy_text', p.cancellation_policy_text,
                                         'booking_window_days', p.booking_window_days)
                 from private.effective_policy(f.id, pp.id) p)
  )
  from public.facilities f
  join public.organizations o on o.id = f.organization_id and o.status = 'active'
  join public.branches b on b.id = f.branch_id
  left join public.cities c on c.id = b.city_id
  left join public.practitioner_profiles pp on pp.id = p_practitioner_id and pp.status = 'active'
       and private.practitioner_works_at(pp.id, f.id)
  left join public.specialties sp on sp.id = pp.specialty_id
  where f.id = p_facility_id and f.status = 'active' and f.is_public
    and (p_practitioner_id is null or pp.id is not null);
$$;

-- Staff day view for a facility (identity only; no clinical content).
create or replace function public.facility_day_board(
  p_facility_id uuid,
  p_date date,
  p_practitioner_id uuid default null
) returns table (
  appointment_id uuid,
  booking_number text,
  status public.appointment_status,
  starts_at timestamptz,
  ends_at timestamptz,
  practitioner_id uuid,
  practitioner_name text,
  service_name text,
  patient_id uuid,
  patient_name text,
  patient_code text,
  patient_phone text,
  source public.booking_source,
  confirmation_deadline timestamptz,
  arrived_at timestamptz,
  queue_entry_id uuid,
  queue_status public.queue_status,
  version int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  tz text := private.facility_tz(p_facility_id);
begin
  if not private.is_member_of_facility(p_facility_id) then perform private.fail('forbidden'); end if;
  return query
  select a.id, a.booking_number, a.status, lower(a.period), upper(a.period), a.practitioner_id, pp.full_name,
         cs.name, p.id, p.full_name, p.public_code, p.phone, a.source, a.confirmation_deadline,
         q.arrived_at, q.id, q.status, a.version
    from public.appointments a
    join public.patients p on p.id = a.patient_id
    join public.clinic_services cs on cs.id = a.service_id
    left join public.practitioner_profiles pp on pp.id = a.practitioner_id
    left join public.queue_entries q on q.appointment_id = a.id
   where a.facility_id = p_facility_id
     and (lower(a.period) at time zone tz)::date = p_date
     and (p_practitioner_id is null or a.practitioner_id = p_practitioner_id)
     and (a.practitioner_id is null
          or private.can_manage_reception(p_facility_id, a.practitioner_id)
          or private.has_facility_role(p_facility_id, array['facility_admin']::public.member_role[]))
   order by lower(a.period);
end;
$$;

create or replace function public.facility_queue(
  p_facility_id uuid,
  p_date date,
  p_practitioner_id uuid default null
) returns table (
  queue_entry_id uuid,
  kind text,
  status public.queue_status,
  priority int,
  priority_reason text,
  arrived_at timestamptz,
  appointment_id uuid,
  appointment_start timestamptz,
  duration_minutes int,
  practitioner_id uuid,
  patient_id uuid,
  patient_name text,
  patient_code text,
  queue_position bigint,
  estimated_start timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not private.is_member_of_facility(p_facility_id) then perform private.fail('forbidden'); end if;
  return query
  with entries as (
    select q.*, lower(a.period) as appt_start, coalesce(a.duration_minutes, 15) as dur,
           p.full_name as pname, p.public_code as pcode
      from public.queue_entries q
      join public.patients p on p.id = q.patient_id
      left join public.appointments a on a.id = q.appointment_id
     where q.facility_id = p_facility_id and q.service_date = p_date
       and (p_practitioner_id is null or q.practitioner_id = p_practitioner_id)
       and (q.practitioner_id is null or private.can_manage_reception(p_facility_id, q.practitioner_id))
  ), ordered as (
    select e.*,
           row_number() over w as pos,
           coalesce(sum(e.dur) over (partition by e.practitioner_id order by e.priority desc, coalesce(e.appt_start, e.arrived_at), e.arrived_at
                                     rows between unbounded preceding and 1 preceding), 0) as minutes_before
      from entries e
     where e.status in ('waiting', 'called')
    window w as (partition by e.practitioner_id order by e.priority desc, coalesce(e.appt_start, e.arrived_at), e.arrived_at)
  )
  select e.id, e.kind, e.status, e.priority, e.priority_reason, e.arrived_at, e.appointment_id, e.appt_start, e.dur,
         e.practitioner_id, e.patient_id, e.pname, e.pcode, o.pos,
         -- an estimate, never a promise (§7)
         case when o.id is null then null
              else greatest(now(), coalesce(e.appt_start, now())) + make_interval(mins => o.minutes_before::int)
                   + make_interval(mins => coalesce((select d.delay_minutes from public.delay_notices d
                                                      where d.facility_id = p_facility_id and d.service_date = p_date
                                                        and d.practitioner_id is not distinct from e.practitioner_id
                                                      order by d.created_at desc limit 1), 0)) end
    from entries e
    left join ordered o on o.id = e.id
   order by e.status in ('waiting', 'called') desc, o.pos nulls last, e.arrived_at;
end;
$$;

-- Patient's own appointments (also shows reception-made bookings, §7).
create or replace function public.my_appointments()
returns table (
  appointment_id uuid,
  booking_number text,
  status public.appointment_status,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text,
  patient_id uuid,
  patient_name text,
  facility_id uuid,
  facility_name text,
  branch_name text,
  address text,
  practitioner_id uuid,
  practitioner_name text,
  service_name text,
  price_minor bigint,
  currency text,
  confirmation_deadline timestamptz,
  cancellation_cutoff_minutes int,
  status_reason text
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.booking_number, a.status, lower(a.period), upper(a.period), a.timezone, p.id, p.full_name,
         f.id, f.name, b.name, b.address, pp.id, pp.full_name, cs.name, a.price_minor, a.currency,
         a.confirmation_deadline, a.cancellation_cutoff_minutes,
         case when a.status in ('rejected', 'cancelled') then a.status_reason end
    from public.appointments a
    join public.patients p on p.id = a.patient_id
    join public.facilities f on f.id = a.facility_id
    join public.branches b on b.id = f.branch_id
    join public.clinic_services cs on cs.id = a.service_id
    left join public.practitioner_profiles pp on pp.id = a.practitioner_id
   where private.is_linked_to_patient(a.patient_id)
   order by lower(a.period) desc;
$$;

-- =====================================================================
-- Facility configuration RPCs (schedules / services / policies)
-- =====================================================================
create or replace function private.can_configure_schedule(p_facility_id uuid, p_practitioner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_admin_facility(p_facility_id)
      or (p_practitioner_id is not null and p_practitioner_id = private.current_practitioner_id()
          and private.has_facility_role(p_facility_id, array['doctor']::public.member_role[]))
      or (p_practitioner_id is null and private.has_facility_role(p_facility_id, array['lab_approver']::public.member_role[]));
$$;

create or replace function public.upsert_clinic_service(
  p_facility_id uuid,
  p_name text,
  p_duration_minutes int,
  p_price_minor bigint default null,
  p_practitioner_id uuid default null,
  p_buffer_minutes int default 0,
  p_resource_id uuid default null,
  p_description text default null,
  p_preparation_note text default null,
  p_service_id uuid default null,
  p_is_active boolean default true
) returns public.clinic_services
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.clinic_services;
begin
  if not private.can_configure_schedule(p_facility_id, p_practitioner_id) then perform private.fail('forbidden'); end if;
  if p_service_id is null then
    insert into public.clinic_services (facility_id, practitioner_id, name, duration_minutes, buffer_minutes, price_minor,
                                        resource_id, description, preparation_note, is_active)
    values (p_facility_id, p_practitioner_id, p_name, p_duration_minutes, p_buffer_minutes, p_price_minor,
            p_resource_id, p_description, p_preparation_note, p_is_active)
    returning * into rec;
  else
    -- existing appointments keep their snapshot; only future bookings change
    update public.clinic_services
       set name = p_name, duration_minutes = p_duration_minutes, buffer_minutes = p_buffer_minutes,
           price_minor = p_price_minor, resource_id = p_resource_id, description = p_description,
           preparation_note = p_preparation_note, is_active = p_is_active
     where id = p_service_id and facility_id = p_facility_id
    returning * into rec;
    if rec.id is null then perform private.fail('not_found'); end if;
  end if;
  perform private.audit('service.upserted', 'clinic_service', rec.id, p_facility_id);
  return rec;
end;
$$;

create or replace function public.set_weekly_schedule(
  p_facility_id uuid,
  p_practitioner_id uuid,
  p_slots jsonb          -- [{weekday, start, end}, …] replaces future template
) returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  n int := 0;
begin
  if not private.can_configure_schedule(p_facility_id, p_practitioner_id) then perform private.fail('forbidden'); end if;
  if p_practitioner_id is not null and not private.practitioner_works_at(p_practitioner_id, p_facility_id) then
    perform private.fail('practitioner_not_at_facility');
  end if;
  -- end current templates yesterday (history preserved), start new today
  update public.schedules set valid_until = current_date - 1
   where facility_id = p_facility_id and practitioner_id is not distinct from p_practitioner_id
     and (valid_until is null or valid_until >= current_date) and valid_from < current_date;
  delete from public.schedules
   where facility_id = p_facility_id and practitioner_id is not distinct from p_practitioner_id and valid_from >= current_date;
  for item in select * from jsonb_array_elements(p_slots) loop
    insert into public.schedules (facility_id, practitioner_id, weekday, start_local, end_local, valid_from, created_by)
    values (p_facility_id, p_practitioner_id, (item ->> 'weekday')::smallint, (item ->> 'start')::time,
            (item ->> 'end')::time, current_date, auth.uid());
    n := n + 1;
  end loop;
  perform private.audit('schedule.replaced', 'facility', p_facility_id, p_facility_id, null, null,
                        jsonb_build_object('practitioner_id', p_practitioner_id, 'rows', n));
  return n;
end;
$$;

create or replace function public.add_schedule_exception(
  p_facility_id uuid,
  p_practitioner_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_kind text,
  p_reason text default null
) returns public.schedule_exceptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.schedule_exceptions;
begin
  if not private.can_configure_schedule(p_facility_id, p_practitioner_id)
     and not private.can_manage_reception(p_facility_id, p_practitioner_id) then
    perform private.fail('forbidden');
  end if;
  insert into public.schedule_exceptions (facility_id, practitioner_id, period, kind, reason, created_by)
  values (p_facility_id, p_practitioner_id, tstzrange(p_starts_at, p_ends_at, '[)'), p_kind, p_reason, auth.uid())
  returning * into rec;
  return rec;
end;
$$;

create or replace function public.set_booking_policy(
  p_facility_id uuid,
  p_practitioner_id uuid,
  p_confirmation_mode text,
  p_confirmation_timeout_minutes int,
  p_booking_window_days int,
  p_min_notice_minutes int,
  p_cancellation_cutoff_minutes int,
  p_slot_step_minutes int default null,
  p_cancellation_policy_text text default null,
  p_late_policy_text text default null
) returns public.booking_policies
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.booking_policies;
begin
  if not private.can_configure_schedule(p_facility_id, p_practitioner_id) then perform private.fail('forbidden'); end if;
  insert into public.booking_policies (facility_id, practitioner_id, confirmation_mode, confirmation_timeout_minutes,
    booking_window_days, min_notice_minutes, cancellation_cutoff_minutes, slot_step_minutes,
    cancellation_policy_text, late_policy_text)
  values (p_facility_id, p_practitioner_id, p_confirmation_mode, p_confirmation_timeout_minutes, p_booking_window_days,
          p_min_notice_minutes, p_cancellation_cutoff_minutes, p_slot_step_minutes, p_cancellation_policy_text, p_late_policy_text)
  on conflict (facility_id, coalesce(practitioner_id, '00000000-0000-0000-0000-000000000000'::uuid)) do update
    set confirmation_mode = excluded.confirmation_mode,
        confirmation_timeout_minutes = excluded.confirmation_timeout_minutes,
        booking_window_days = excluded.booking_window_days,
        min_notice_minutes = excluded.min_notice_minutes,
        cancellation_cutoff_minutes = excluded.cancellation_cutoff_minutes,
        slot_step_minutes = excluded.slot_step_minutes,
        cancellation_policy_text = excluded.cancellation_policy_text,
        late_policy_text = excluded.late_policy_text
  returning * into rec;
  perform private.audit('booking_policy.set', 'booking_policy', rec.id, p_facility_id);
  return rec;
end;
$$;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.facility_resources enable row level security;
alter table public.clinic_services enable row level security;
alter table public.booking_policies enable row level security;
alter table public.schedules enable row level security;
alter table public.schedule_exceptions enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_events enable row level security;
alter table public.queue_entries enable row level security;
alter table public.delay_notices enable row level security;

create policy resources_read on public.facility_resources for select to authenticated
  using (private.is_member_of_facility(facility_id));
create policy services_read on public.clinic_services for select
  using ((is_active and is_public) or private.is_member_of_facility(facility_id));
create policy policies_read on public.booking_policies for select
  using (true);
create policy schedules_read on public.schedules for select
  using (true);
create policy exceptions_read on public.schedule_exceptions for select to authenticated
  using ((facility_id is not null and private.is_member_of_facility(facility_id))
         or practitioner_id = private.current_practitioner_id());

-- Appointments: the patient (via verified link) and staff who manage that
-- doctor's desk; doctors see their own. Writes only via RPCs.
create policy appointments_read on public.appointments for select to authenticated
  using (private.is_linked_to_patient(patient_id)
         or (practitioner_id is not null and private.can_manage_reception(facility_id, practitioner_id))
         or (practitioner_id is null and private.is_member_of_facility(facility_id)));
create policy appointment_events_read on public.appointment_events for select to authenticated
  using (exists (select 1 from public.appointments a where a.id = appointment_events.appointment_id));
create policy queue_read on public.queue_entries for select to authenticated
  using ((practitioner_id is not null and private.can_manage_reception(facility_id, practitioner_id))
         or (practitioner_id is null and private.is_member_of_facility(facility_id)));
create policy delay_read on public.delay_notices for select
  using (true);

grant select on public.clinic_services, public.booking_policies, public.schedules, public.delay_notices to anon, authenticated;
grant select on public.facility_resources, public.schedule_exceptions, public.appointments, public.appointment_events,
  public.queue_entries to authenticated;

-- RPC grants
revoke execute on function
  public.book_appointment(uuid, uuid, uuid, uuid, timestamptz, text, public.booking_source, text),
  public.reception_quick_book(uuid, uuid, text, uuid, text, uuid, timestamptz, text, public.patient_sex, int),
  public.change_appointment_status(uuid, public.appointment_status, text, int),
  public.reschedule_appointment(uuid, timestamptz, text, text),
  public.assign_walk_in_slot(uuid, uuid, timestamptz, text),
  public.update_queue_entry(uuid, public.queue_status, int, text),
  public.post_delay_notice(uuid, uuid, int, text),
  public.facility_day_board(uuid, date, uuid),
  public.facility_queue(uuid, date, uuid),
  public.my_appointments(),
  public.upsert_clinic_service(uuid, text, int, bigint, uuid, int, uuid, text, text, uuid, boolean),
  public.set_weekly_schedule(uuid, uuid, jsonb),
  public.add_schedule_exception(uuid, uuid, timestamptz, timestamptz, text, text),
  public.set_booking_policy(uuid, uuid, text, int, int, int, int, int, text, text),
  public.expire_pending_appointments()
from public, anon;
grant execute on function
  public.book_appointment(uuid, uuid, uuid, uuid, timestamptz, text, public.booking_source, text),
  public.reception_quick_book(uuid, uuid, text, uuid, text, uuid, timestamptz, text, public.patient_sex, int),
  public.change_appointment_status(uuid, public.appointment_status, text, int),
  public.reschedule_appointment(uuid, timestamptz, text, text),
  public.assign_walk_in_slot(uuid, uuid, timestamptz, text),
  public.update_queue_entry(uuid, public.queue_status, int, text),
  public.post_delay_notice(uuid, uuid, int, text),
  public.facility_day_board(uuid, date, uuid),
  public.facility_queue(uuid, date, uuid),
  public.my_appointments(),
  public.upsert_clinic_service(uuid, text, int, bigint, uuid, int, uuid, text, text, uuid, boolean),
  public.set_weekly_schedule(uuid, uuid, jsonb),
  public.add_schedule_exception(uuid, uuid, timestamptz, timestamptz, text, text),
  public.set_booking_policy(uuid, uuid, text, int, int, int, int, int, text, text)
to authenticated;
grant execute on function public.expire_pending_appointments() to service_role;
grant execute on function public.get_available_slots(uuid, uuid, uuid, date, date),
  public.search_providers(text, text, uuid, uuid, double precision, double precision, double precision, int),
  public.get_provider_profile(uuid, uuid)
to anon, authenticated;
