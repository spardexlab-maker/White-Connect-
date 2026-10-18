-- Phase 5 (§11, §18-k): 10-day course stops at the end, explicit times,
-- revision cancels the schedule, dispatch never duplicates, as-needed has
-- no schedule, generic payload.
begin;
select plan(12);

\set A1 '''00000000-0000-4000-f000-0000000000a1'''
\set PH_A '''00000000-0000-4000-f000-0000000000a2'''
\set AHMED '''00000000-0000-4000-9000-000000000010'''
\set U_DRAHMED '''00000000-0000-4000-a000-000000000010'''
\set U_RECA '''00000000-0000-4000-a000-000000000020'''
\set U_PHA '''00000000-0000-4000-a000-000000000030'''
\set U_HASAN '''00000000-0000-4000-a000-000000000050'''
\set P_HASAN '''00000000-0000-4000-5000-000000000050'''

create temp table t (k text primary key, id uuid);
grant all on t to authenticated;
insert into t select 'para', id from public.medication_catalog where active_ingredient = 'Paracetamol' and dosage_form = 'tablet';

select tests.login(:U_RECA);
insert into t select 'q', (public.reception_quick_book(:A1, :AHMED, 'idem-rem-walkin', p_patient_id => :P_HASAN) ->> 'queue_entry_id')::uuid;
select tests.login(:U_DRAHMED);
insert into t select 'enc', (public.start_encounter((select id from t where k = 'q'), true)).id;
insert into t select 'rx', (public.save_prescription_draft((select id from t where k = 'enc'), jsonb_build_array(
  jsonb_build_object('medication_id', (select id from t where k = 'para'), 'frequency_text', 'ثلاث مرات يومياً', 'duration_days', '10', 'quantity', '30'),
  jsonb_build_object('display_name', 'Salbutamol inhaler', 'frequency_text', 'عند اللزوم', 'as_needed', true)), 'idem-rem-rx') ->> 'prescription_id')::uuid;
select public.approve_prescription((select id from t where k = 'rx'), :PH_A);

-- pharmacist activates with the patient's consent and AGREED times
select tests.login(:U_PHA);
insert into t select 'disp', dispatch_id from public.pharmacy_inbox(:PH_A) where prescription_id = (select id from t where k = 'rx');
select throws_ok(format($q$ select public.create_medication_plan(%L, 1, current_date + 1, array['08:00','14:00','20:00'], false, %L) $q$,
                        (select id from t where k = 'rx'), (select id from t where k = 'disp')), 'P0001', 'app:consent_required', 'reminders need patient consent');
insert into t select 'plan', (public.create_medication_plan((select id from t where k = 'rx'), 1, current_date + 1, array['08:00','14:00','20:00'], true, (select id from t where k = 'disp'))).id;
select is((select count(*)::int from public.reminder_jobs), 0, 'pharmacy cannot read the patient''s reminder schedule');
select tests.logout();
select is((select end_date from public.medication_plans where id = (select id from t where k = 'plan')), current_date + 10, '10-day course ends on day 10');
select is((select count(*)::int from public.reminder_jobs where plan_id = (select id from t where k = 'plan')), 30, 'exactly 3 agreed times × 10 days');
select is((select max((scheduled_at at time zone 'Asia/Baghdad')::date) from public.reminder_jobs where plan_id = (select id from t where k = 'plan')),
          current_date + 10, 'no reminder after the course ends');
select is((select times_local from public.medication_plans where id = (select id from t where k = 'plan')), array['08:00','14:00','20:00']::time[],
          'times are the explicit agreed times (not inferred from the frequency text)');
select tests.login(:U_PHA);
insert into t select 'prn', (public.create_medication_plan((select id from t where k = 'rx'), 2, current_date + 1, null, true, (select id from t where k = 'disp'))).id;
select tests.logout();
select is((select count(*)::int from public.reminder_jobs where plan_id = (select id from t where k = 'prn')), 0, 'as-needed medicine gets no fixed schedule');

-- dispatch twice (worker retry) → one outbox entry per job
update public.reminder_jobs set scheduled_at = now() - interval '1 minute'
 where id = (select id from public.reminder_jobs where plan_id = (select id from t where k = 'plan') order by scheduled_at limit 1);
select is(public.dispatch_due_reminders(), 1, 'one due reminder dispatched');
select is(public.dispatch_due_reminders(), 0, 'a second run dispatches nothing (no duplicate)');
select ok((select bool_and(not (payload ? 'display_name') and payload::text not ilike '%paracetamol%') from public.notification_outbox where template = 'medication.reminder'),
          'reminder payload carries no medication name');

-- patient self-report
select tests.login(:U_HASAN);
select public.record_dose((select id from public.reminder_jobs where plan_id = (select id from t where k = 'plan') order by scheduled_at limit 1), 'taken');

-- revision cancels the old schedule
select tests.login(:U_DRAHMED);
select public.revise_prescription((select id from t where k = 'rx'));
select public.approve_prescription((select id from t where k = 'rx'), null, 'تعديل المدة (اختبار)');
select is((select status from public.medication_plans where id = (select id from t where k = 'plan')), 'cancelled', 'revised prescription cancels the plan');
select is((select count(*)::int from public.reminder_jobs where plan_id = (select id from t where k = 'plan') and status = 'pending'), 0,
          'no pending reminders remain from the old version');

select * from finish();
rollback;
