-- Patient-defined reminders (every N hours) and adherence for the treating doctor.
begin;
select plan(7);
\set A1 '''00000000-0000-4000-f000-0000000000a1'''
\set AHMED '''00000000-0000-4000-9000-000000000010'''
\set U_DRAHMED '''00000000-0000-4000-a000-000000000010'''
\set U_RECA '''00000000-0000-4000-a000-000000000020'''
\set U_MONA '''00000000-0000-4000-a000-000000000051'''
\set P_MONA '''00000000-0000-4000-5000-000000000051'''
create temp table t (k text primary key, id uuid);
grant all on t to authenticated;

select tests.login(:U_MONA, 'mona@demo.test');
insert into t (k, id) select 'pl', (public.create_own_medication_plan(:P_MONA, 'Metformin 500 mg', array['08:00', '20:00'], null, null, 12)).id;
select ok((select prescription_id is null and source = 'patient' and interval_hours = 12 from public.medication_plans where id = (select id from t where k = 'pl')),
          'a patient can set reminders for a medicine without a prescription');
select ok((select count(*) from public.reminder_jobs where plan_id = (select id from t where k = 'pl')) > 0, 'reminders are scheduled');
select throws_ok(format($q$select public.create_own_medication_plan(%L, 'x', array[]::text[])$q$, :P_MONA), 'P0001', 'app:times_required', 'times are required');

-- two past doses: one taken, one not recorded (missed)
select tests.logout();
with x as (insert into public.reminder_jobs (plan_id, scheduled_at, status)
  values ((select id from t where k = 'pl'), now() - interval '20 hours', 'queued') returning id)
insert into t (k, id) select 'j1', id from x;
insert into public.reminder_jobs (plan_id, scheduled_at, status) values ((select id from t where k = 'pl'), now() - interval '8 hours', 'queued');
select tests.login(:U_MONA, 'mona@demo.test');
select public.record_dose((select id from t where k = 'j1'), 'taken');
select is((public.medication_adherence(:P_MONA) -> 0 ->> 'taken')::int, 1, 'the patient sees the dose she took');

select tests.login(:U_RECA);
select throws_ok(format('select public.medication_adherence(%L)', :P_MONA), 'P0001', 'app:forbidden', 'reception cannot see adherence');
select tests.logout();
insert into public.care_relationships (patient_id, facility_id, practitioner_id, source) values (:P_MONA, :A1, :AHMED, 'referral') on conflict do nothing;
select tests.login(:U_DRAHMED);
select is((public.medication_adherence(:P_MONA) -> 0 ->> 'missed')::int, 1, 'the treating doctor sees the missed dose');
select is((public.medication_adherence(:P_MONA) -> 0 ->> 'taken')::int, 1, 'and the taken one');
select * from finish();
rollback;
