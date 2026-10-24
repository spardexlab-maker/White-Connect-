-- The doctor's reminder schedule is locked for the patient; the patient's own medicines stay editable.
begin;
select plan(8);
\set A1 '''00000000-0000-4000-f000-0000000000a1'''
\set AHMED '''00000000-0000-4000-9000-000000000010'''
\set U_DRAHMED '''00000000-0000-4000-a000-000000000010'''
\set U_RECA '''00000000-0000-4000-a000-000000000020'''
\set U_HASAN '''00000000-0000-4000-a000-000000000050'''
\set P_HASAN '''00000000-0000-4000-5000-000000000050'''

create temp table t (k text primary key, id uuid);
grant all on t to authenticated;
select tests.login(:U_RECA);
insert into t select 'q', (public.reception_quick_book(:A1, :AHMED, 'idem-lock-walkin', p_patient_id => :P_HASAN) ->> 'queue_entry_id')::uuid;
select tests.login(:U_DRAHMED);
insert into t select 'enc', (public.start_encounter((select id from t where k = 'q'), true)).id;
insert into t select 'rx', (public.save_prescription_draft((select id from t where k = 'enc'), jsonb_build_array(
  jsonb_build_object('display_name', 'Amoxicillin 500 mg', 'dose', '1', 'dose_unit', 'كبسولة', 'frequency_text', 'كل 8 ساعات',
                     'interval_hours', '8', 'duration_days', '7')), 'idem-lock-rx') ->> 'prescription_id')::uuid;
select tests.diagnose((select id from t where k = 'enc'));
select public.approve_prescription((select id from t where k = 'rx'), null);

select tests.login(:U_HASAN);
insert into t select 'rxplan', (public.create_medication_plan((select id from t where k = 'rx'), 1, current_date + 1, array['06:00','14:00','22:00'], true)).id;
select throws_ok(format($q$ select public.set_medication_plan_status(%L, 'paused') $q$, (select id from t where k = 'rxplan')),
                 'P0001', 'app:prescribed_plan_locked', 'the patient cannot pause the doctor''s schedule');
select throws_ok(format($q$ select public.update_own_medication_plan(%L, 'x', array['09:00']) $q$, (select id from t where k = 'rxplan')),
                 'P0001', 'app:prescribed_plan_locked', '…nor change its times');
select is((select (e ->> 'prescribed')::boolean from jsonb_array_elements(public.my_medication_plans()) e where e ->> 'id' = (select id::text from t where k = 'rxplan')),
          true, 'the app knows the plan is the doctor''s');

insert into t select 'own', (public.create_own_medication_plan(:P_HASAN, 'Vitamin D', array['08:00'], current_date + 1, 10, 24)).id;
select lives_ok(format($q$ select public.update_own_medication_plan(%L, 'Vitamin D3', array['09:00','21:00'], 12, 5) $q$, (select id from t where k = 'own')),
                'the patient edits a medicine they added');
select is((select display_name || ' / ' || interval_hours || ' / ' || (end_date - start_date + 1) from public.medication_plans where id = (select id from t where k = 'own')),
          'Vitamin D3 / 12 / 5', 'name, interval and course length are saved');
select is((select count(*)::int from public.reminder_jobs where plan_id = (select id from t where k = 'own') and status = 'pending'), 10,
          'reminders are re-made for the new times (2 a day × 5 days)');
select lives_ok(format($q$ select public.set_medication_plan_status(%L, 'paused') $q$, (select id from t where k = 'own')), 'own medicine can be paused');
select public.set_medication_plan_status((select id from t where k = 'own'), 'active');
select is((select count(*)::int from public.reminder_jobs where plan_id = (select id from t where k = 'own') and status = 'pending'), 10,
          'resuming brings the reminders back');
select * from finish();
rollback;
