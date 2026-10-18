-- Acceptance §18-a, §18-b, §18-c: overlap prevention across sources and
-- branches, confirmation expiry, atomic reschedule, walk-ins.
begin;
select plan(24);

-- fixture ids (see supabase/seed.sql)
\set A1 '''00000000-0000-4000-f000-0000000000a1'''
\set B1 '''00000000-0000-4000-f000-0000000000b1'''
\set AHMED '''00000000-0000-4000-9000-000000000010'''
\set LAYLA '''00000000-0000-4000-9000-000000000012'''
\set SVC_A30 '''00000000-0000-4000-6000-000000000001'''
\set SVC_A15 '''00000000-0000-4000-6000-000000000002'''
\set SVC_B30 '''00000000-0000-4000-6000-000000000004'''
\set SVC_LAYLA '''00000000-0000-4000-6000-000000000005'''
\set U_HASAN '''00000000-0000-4000-a000-000000000050'''
\set U_RECA '''00000000-0000-4000-a000-000000000020'''
\set U_RECB '''00000000-0000-4000-a000-000000000021'''
\set P_HASAN '''00000000-0000-4000-5000-000000000050'''
\set P_ALI1 '''00000000-0000-4000-5000-000000000060'''
\set P_ALI2 '''00000000-0000-4000-5000-000000000061'''
\set P_ZAINAB '''00000000-0000-4000-5000-000000000062'''

select tests.open_all_week(:A1, :AHMED);
select tests.open_all_week(:B1, :AHMED);

-- Hasan books 18:00 (30 min) via the app → holds 18:00–18:30, awaiting confirmation
select tests.login(:U_HASAN);
create temp table t_ids (name text primary key, id uuid);
grant all on t_ids to authenticated;
insert into t_ids select 'hasan_1800', (public.book_appointment(:P_HASAN, :A1, :AHMED, :SVC_A30, tests.at(2, '18:00'), 'idem-hasan-1800')).id;

select is((select status::text from public.appointments where id = (select id from t_ids where name = 'hasan_1800')),
          'awaiting_confirmation', 'patient app booking starts awaiting confirmation');

select is((public.book_appointment(:P_HASAN, :A1, :AHMED, :SVC_A30, tests.at(2, '18:00'), 'idem-hasan-1800')).id,
          (select id from t_ids where name = 'hasan_1800'), 'idempotent replay returns the same appointment');

-- reception at the same clinic: a DIFFERENT start that overlaps (18:15) fails
select tests.login(:U_RECA);
select throws_ok(
  format('select public.book_appointment(%L, %L, %L, %L, %L, %L, ''reception'')',
         :P_ALI1, :A1, :AHMED, :SVC_A15, tests.at(2, '18:15'), 'idem-reca-1815'),
  'P0001', 'app:slot_unavailable', 'overlapping different start time is rejected (18:15 inside 18:00–18:30)');

select throws_ok(
  format('select public.book_appointment(%L, %L, %L, %L, %L, %L, ''reception'')',
         :P_ALI1, :A1, :AHMED, :SVC_A30, tests.at(2, '18:00'), 'idem-reca-1800'),
  'P0001', 'app:slot_unavailable', 'same slot from reception is rejected while pending confirmation');

-- half-open intervals: 18:30 directly after 18:00–18:30 is fine
insert into t_ids select 'ali1_1830', (public.book_appointment(:P_ALI1, :A1, :AHMED, :SVC_A30, tests.at(2, '18:30'), 'idem-reca-1830', 'reception')).id;
select is((select status::text from public.appointments where id = (select id from t_ids where name = 'ali1_1830')),
          'confirmed', 'reception booking at 18:30 (adjacent) succeeds and is confirmed');

-- the same doctor at the OTHER complex cannot be double-booked
select tests.login(:U_RECB);
select throws_ok(
  format('select public.book_appointment(%L, %L, %L, %L, %L, %L, ''reception'')',
         :P_ZAINAB, :B1, :AHMED, :SVC_B30, tests.at(2, '18:10'), 'idem-recb-1810'),
  'P0001', 'app:slot_unavailable', 'doctor cannot be booked at branch B while busy at branch A');

-- scope rules: reception A cannot book Dr. Layla (not in scope / other clinic)
select tests.login(:U_RECA);
select throws_ok(
  format('select public.book_appointment(%L, %L, %L, %L, %L, %L, ''reception'')',
         :P_ALI1, :B1, :LAYLA, :SVC_LAYLA, tests.at(2, '11:00'), 'idem-reca-layla'),
  'P0001', 'app:forbidden', 'receptionist cannot book outside their clinic/doctor scope');

-- a patient cannot pretend to be reception
select tests.login(:U_HASAN);
select throws_ok(
  format('select public.book_appointment(%L, %L, %L, %L, %L, %L, ''reception'')',
         :P_HASAN, :A1, :AHMED, :SVC_A30, tests.at(2, '20:00'), 'idem-hasan-fake'),
  'P0001', 'app:forbidden', 'patient cannot use the reception source');

-- outside working hours
select throws_ok(
  format('select public.book_appointment(%L, %L, %L, %L, %L, %L)',
         :P_HASAN, :A1, :AHMED, :SVC_A30, tests.at(2, '21:45'), 'idem-hasan-late'),
  'P0001', 'app:outside_working_hours', 'slot crossing the end of the working window is rejected');

-- ---------------------------------------------------------------------
-- §18-b: expiry. Make Hasan's pending booking overdue.
-- ---------------------------------------------------------------------
select tests.logout();
update public.appointments set confirmation_deadline = now() - interval '1 minute'
 where id = (select id from t_ids where name = 'hasan_1800');

-- a stale confirm cannot succeed: it reports 'expired' and frees the slot
select tests.login(:U_RECA);
select is((public.change_appointment_status((select id from t_ids where name = 'hasan_1800'), 'confirmed')).status::text,
          'expired', 'confirming after the deadline yields expired, not confirmed');

insert into t_ids select 'ali2_1800', (public.book_appointment(:P_ALI2, :A1, :AHMED, :SVC_A30, tests.at(2, '18:00'), 'idem-reca-ali2-1800', 'reception')).id;
select ok((select id from t_ids where name = 'ali2_1800') is not null, 'slot freed by expiry can be booked by someone else');

select throws_ok(
  format('select public.change_appointment_status(%L, ''confirmed'')', (select id from t_ids where name = 'hasan_1800')),
  'P0001', 'app:invalid_transition', 'the old expired request can never be confirmed later');

-- lazy expiry inside the booking path: overdue pending → competitor wins
select tests.login(:U_HASAN);
insert into t_ids select 'hasan_1900', (public.book_appointment(:P_HASAN, :A1, :AHMED, :SVC_A30, tests.at(2, '19:00'), 'idem-hasan-1900')).id;
select tests.logout();
update public.appointments set confirmation_deadline = now() - interval '1 second'
 where id = (select id from t_ids where name = 'hasan_1900');
select tests.login(:U_RECA);
select lives_ok(
  format('select public.book_appointment(%L, %L, %L, %L, %L, %L, ''reception'')',
         :P_ALI1, :A1, :AHMED, :SVC_A30, tests.at(2, '19:00'), 'idem-reca-1900'),
  'booking path expires overdue pending holds before competing');
select is((select status::text from public.appointments where id = (select id from t_ids where name = 'hasan_1900')),
          'expired', 'the overdue request was expired atomically');

-- ---------------------------------------------------------------------
-- Reschedule atomicity
-- ---------------------------------------------------------------------
select tests.login(:U_HASAN);
insert into t_ids select 'hasan_2000', (public.book_appointment(:P_HASAN, :A1, :AHMED, :SVC_A30, tests.at(2, '20:00'), 'idem-hasan-2000')).id;
select tests.login(:U_RECA);
select is((public.change_appointment_status((select id from t_ids where name = 'hasan_2000'), 'confirmed')).status::text,
          'confirmed', 'reception confirms in time');

select throws_ok(
  format('select public.reschedule_appointment(%L, %L, %L)', (select id from t_ids where name = 'hasan_2000'),
         tests.at(2, '18:40'), 'idem-resched-fail'),
  'P0001', 'app:slot_unavailable', 'reschedule into an occupied slot fails');
select is((select status::text from public.appointments where id = (select id from t_ids where name = 'hasan_2000')),
          'confirmed', 'failed reschedule leaves the original appointment intact');

insert into t_ids select 'hasan_2015', (public.reschedule_appointment((select id from t_ids where name = 'hasan_2000'),
                                         tests.at(2, '20:15'), 'idem-resched-ok')).id;
select is((select status::text from public.appointments where id = (select id from t_ids where name = 'hasan_2015')),
          'confirmed', 'reschedule overlapping its own old period succeeds in one transaction');
select is((select status::text from public.appointments where id = (select id from t_ids where name = 'hasan_2000')),
          'cancelled', 'the old appointment is released with history');

-- snapshot: changing the service duration later does not alter booked rows
select tests.logout();
update public.clinic_services set duration_minutes = 45 where id = :SVC_A30;
select is((select duration_minutes from public.appointments where id = (select id from t_ids where name = 'hasan_2015')),
          30, 'appointment keeps its duration snapshot');

-- ---------------------------------------------------------------------
-- §18-c: walk-in goes to the waiting list, never into a busy slot
-- ---------------------------------------------------------------------
select tests.login(:U_RECA);
insert into t_ids select 'walkin', (public.reception_quick_book(:A1, :AHMED, 'idem-walkin-1', p_patient_id => :P_ALI2) ->> 'queue_entry_id')::uuid;
select is((select appointment_id from public.queue_entries where id = (select id from t_ids where name = 'walkin')),
          null, 'walk-in sits on the declared waiting list without an appointment');

select throws_ok(
  format('select public.assign_walk_in_slot(%L, %L, %L, %L)', (select id from t_ids where name = 'walkin'),
         :SVC_A15, tests.at(2, '18:30'), 'idem-walkin-busy'),
  'P0001', 'app:slot_unavailable', 'walk-in assignment into an occupied future slot is rejected');

-- assigning the walk-in to a busy slot TODAY is rejected by the same constraint
select tests.logout();
insert into public.appointments (patient_id, facility_id, practitioner_id, service_id, status, period, blocked_period,
  duration_minutes, timezone, source, created_by, idempotency_key)
values (:P_ALI1, :A1, :AHMED, :SVC_A15, 'confirmed',
        tstzrange(now() + interval '20 minutes', now() + interval '35 minutes', '[)'),
        tstzrange(now() + interval '20 minutes', now() + interval '35 minutes', '[)'),
        15, 'Asia/Baghdad', 'reception', :U_RECA, 'fixture-today-busy');
select tests.login(:U_RECA);
select throws_ok(
  format('select public.assign_walk_in_slot(%L, %L, %L, %L)', (select id from t_ids where name = 'walkin'),
         :SVC_A15, date_trunc('minute', now() + interval '25 minutes'), 'idem-walkin-busy2'),
  'P0001', null, 'walk-in cannot be slipped into an occupied slot');

-- check-in does not start any clinical session; queue entry has no start time
select ok((select started_at is null from public.queue_entries where id = (select id from t_ids where name = 'walkin')),
          'waiting does not record a session start just because time passes');

select * from finish();
rollback;
