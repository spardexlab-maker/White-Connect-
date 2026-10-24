-- Diagnosis before approving / completing; reopening a finished session; booking a follow-up.
begin;
select plan(10);
\set A1 '''00000000-0000-4000-f000-0000000000a1'''
\set AHMED '''00000000-0000-4000-9000-000000000010'''
\set U_DRAHMED '''00000000-0000-4000-a000-000000000010'''
\set U_DRSARA '''00000000-0000-4000-a000-000000000011'''
\set U_RECA '''00000000-0000-4000-a000-000000000020'''
\set P_HASAN '''00000000-0000-4000-5000-000000000050'''

create temp table t (k text primary key, id uuid);
grant all on t to authenticated;
select tests.login(:U_RECA);
insert into t select 'q', (public.reception_quick_book(:A1, :AHMED, 'idem-reopen-walkin', p_patient_id => :P_HASAN) ->> 'queue_entry_id')::uuid;
select tests.login(:U_DRAHMED);
insert into t select 'enc', (public.start_encounter((select id from t where k = 'q'), true)).id;
insert into t select 'rx', (public.save_prescription_draft((select id from t where k = 'enc'), jsonb_build_array(
  jsonb_build_object('display_name', 'Cetirizine 10 mg', 'dose', '1', 'dose_unit', 'حبة', 'frequency_text', 'مرة يومياً', 'interval_hours', '24', 'duration_days', '5')),
  'idem-reopen-rx') ->> 'prescription_id')::uuid;

select throws_ok(format($q$ select public.approve_prescription(%L, null) $q$, (select id from t where k = 'rx')), 'P0001', 'app:diagnosis_required',
                 'a prescription cannot be approved without a diagnosis');
select throws_ok(format($q$ select public.set_encounter_status(%L, 'completed') $q$, (select id from t where k = 'enc')), 'P0001', 'app:diagnosis_required',
                 'nor can the session be completed');
select tests.diagnose((select id from t where k = 'enc'), 'التهاب أنف تحسسي');
select lives_ok(format($q$ select public.approve_prescription(%L, null) $q$, (select id from t where k = 'rx')), 'with a diagnosis the prescription is approved');
select lives_ok(format($q$ select public.set_encounter_status(%L, 'completed') $q$, (select id from t where k = 'enc')), 'and the session completed');

select ok(exists (select 1 from jsonb_array_elements(public.my_recent_encounters(30)) e where e ->> 'id' = (select id::text from t where k = 'enc')
                  and e ->> 'diagnosis' = 'التهاب أنف تحسسي'), 'the doctor finds the finished session with its diagnosis');

select tests.login(:U_DRSARA);
select throws_ok(format($q$ select public.reopen_encounter(%L, 'سؤال من الصيدلية') $q$, (select id from t where k = 'enc')), 'P0001', 'app:forbidden',
                 'another doctor cannot reopen it');
select tests.login(:U_DRAHMED);
select throws_ok(format($q$ select public.reopen_encounter(%L, '') $q$, (select id from t where k = 'enc')), 'P0001', 'app:reason_required', 'a reason is required');
select is((public.reopen_encounter((select id from t where k = 'enc'), 'الصيدلية طلبت تغيير الدواء')).status::text, 'in_progress',
          'the author reopens it and it is active again');
select lives_ok(format($q$ select public.revise_prescription(%L) $q$, (select id from t where k = 'rx')), 'so the prescription can be revised');

-- follow-up visit booked by the doctor
select is((public.book_follow_up((select id from t where k = 'enc'), date_trunc('day', now() at time zone 'Asia/Baghdad') at time zone 'Asia/Baghdad' + interval '7 days 17 hours')).status::text,
          'confirmed', 'the doctor books the next visit (confirmed)');
select * from finish();
rollback;
