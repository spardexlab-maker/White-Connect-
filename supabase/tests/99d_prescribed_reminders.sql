-- Prescribed medicine "every 8 h" → shows as pending for the patient → one tap with the
-- first time → reminders follow the doctor's interval; doses logged with amount; doctor sees it.
begin;
select plan(9);
\set A1 '''00000000-0000-4000-f000-0000000000a1'''
\set AHMED '''00000000-0000-4000-9000-000000000010'''
\set U_DRAHMED '''00000000-0000-4000-a000-000000000010'''
\set U_RECA '''00000000-0000-4000-a000-000000000020'''
\set U_HASAN '''00000000-0000-4000-a000-000000000050'''
\set P_HASAN '''00000000-0000-4000-5000-000000000050'''

create temp table t (k text primary key, id uuid);
grant all on t to authenticated;
select tests.login(:U_RECA);
insert into t select 'q', (public.reception_quick_book(:A1, :AHMED, 'idem-prx-walkin', p_patient_id => :P_HASAN) ->> 'queue_entry_id')::uuid;
select tests.login(:U_DRAHMED);
insert into t select 'enc', (public.start_encounter((select id from t where k = 'q'), true)).id;
insert into t select 'rx', (public.save_prescription_draft((select id from t where k = 'enc'), jsonb_build_array(
  jsonb_build_object('display_name', 'Amoxicillin 500 mg', 'dose', '1', 'dose_unit', 'كبسولة', 'frequency_text', 'كل 8 ساعات',
                     'interval_hours', '8', 'duration_days', '7')), 'idem-prx-rx') ->> 'prescription_id')::uuid;
select tests.diagnose((select id from t where k = 'enc'));
select public.approve_prescription((select id from t where k = 'rx'), null);

select tests.login(:U_HASAN);
select is((select (e ->> 'interval_hours')::int from jsonb_array_elements(public.rx_pending_reminders()) e
            where e ->> 'prescription_id' = (select id::text from t where k = 'rx')), 8, 'the prescribed medicine waits for the patient with the doctor''s interval');
insert into t select 'plan', (public.create_medication_plan((select id from t where k = 'rx'), 1, current_date + 1, array['06:00','14:00','22:00'], true)).id;
select is((select count(*)::int from jsonb_array_elements(public.rx_pending_reminders()) e
            where e ->> 'prescription_id' = (select id::text from t where k = 'rx')), 0, 'once activated it is no longer pending');
select is((select dose::int || ' ' || dose_unit || ' / ' || interval_hours from public.medication_plans where id = (select id from t where k = 'plan')),
          '1 كبسولة / 8', 'the plan carries the prescribed dose and interval');
select is((select count(*)::int from public.reminder_jobs where plan_id = (select id from t where k = 'plan')), 21, '3 doses a day × 7 days');
select ok(jsonb_array_length(public.my_upcoming_doses(72)) > 0, 'the phone gets the next days of doses to schedule');

-- move the first dose into the past (as the test owner), then the patient logs it: 2 capsules
select tests.logout();
update public.reminder_jobs set scheduled_at = now() - interval '5 hours' where id = (select id from public.reminder_jobs where plan_id = (select id from t where k = 'plan') order by scheduled_at limit 1);
select tests.login(:U_HASAN);
select is((public.log_dose((select id from public.reminder_jobs where plan_id = (select id from t where k = 'plan') order by scheduled_at limit 1), 'taken', 2) ->> 'dose_amount')::numeric,
          2::numeric, 'a dose is logged with how much was taken');
select throws_ok(format($q$ select public.log_dose(%L, 'taken', 0) $q$, (select id from public.reminder_jobs where plan_id = (select id from t where k = 'plan') order by scheduled_at offset 1 limit 1)),
                 'P0001', 'app:invalid_input', 'a zero amount is refused');
select tests.login(:U_DRAHMED);
select is((select (e ->> 'taken')::int from jsonb_array_elements(public.medication_adherence(:P_HASAN)) e where e ->> 'id' = (select id::text from t where k = 'plan')),
          1, 'the treating doctor sees the dose was taken');
select is((select (e ->> 'taken_amount')::numeric from jsonb_array_elements(public.medication_adherence(:P_HASAN)) e where e ->> 'id' = (select id::text from t where k = 'plan')),
          2::numeric, '…and how many capsules');
select * from finish();
rollback;
