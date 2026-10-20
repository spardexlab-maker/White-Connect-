-- Paused sessions (several open, one active), the medical card for treating
-- doctors only, and sending an approved prescription to a pharmacy later.
begin;
select plan(15);
\set A1 '''00000000-0000-4000-f000-0000000000a1'''
\set PH_A '''00000000-0000-4000-f000-0000000000a2'''
\set AHMED '''00000000-0000-4000-9000-000000000010'''
\set SARA '''00000000-0000-4000-9000-000000000011'''
\set U_DRAHMED '''00000000-0000-4000-a000-000000000010'''
\set U_DRSARA '''00000000-0000-4000-a000-000000000011'''
\set U_RECA '''00000000-0000-4000-a000-000000000020'''

create temp table t (k text primary key, id uuid, txt text);
grant all on t to authenticated;

select tests.login(:U_RECA);
insert into t (k, id, txt) select 'q1', (r ->> 'queue_entry_id')::uuid, r ->> 'patient_id'
  from (select public.reception_quick_book(:A1, :AHMED, 'idem-pause-1', p_new_patient_name => 'مريض أول (إيقاف)') r) x;
insert into t (k, id, txt) select 'q2', (r ->> 'queue_entry_id')::uuid, r ->> 'patient_id'
  from (select public.reception_quick_book(:A1, :AHMED, 'idem-pause-2', p_new_patient_name => 'مريض ثانٍ (إيقاف)') r) x;
insert into t (k, id) select 'p1', txt::uuid from t where k = 'q1';

-- sessions
select tests.login(:U_DRAHMED);
insert into t (k, id) select 'e1', (public.start_encounter((select id from t where k = 'q1'), true)).id;
select throws_ok(format('select public.start_encounter(%L, true)', (select id from t where k = 'q2')),
                 'P0001', 'app:another_session_in_progress', 'only one ACTIVE session at a time');
select lives_ok(format('select public.pause_encounter(%L, %L)', (select id from t where k = 'e1'), 'أُرسل لإجراء تحليل'), 'the doctor pauses the session');
insert into t (k, id) select 'e2', (public.start_encounter((select id from t where k = 'q2'), true)).id;
select ok((select id from t where k = 'e2') is not null, 'another patient can be seen while the first session is paused');
select is((select count(*)::int from public.encounters where practitioner_id = :AHMED and status = 'in_progress'
            and id in (select id from t where k in ('e1', 'e2'))), 2, 'both sessions stay open');
select public.resume_encounter((select id from t where k = 'e1'));
select ok((select paused_at is null from public.encounters where id = (select id from t where k = 'e1')), 'resume re-activates the first session');
select ok((select paused_at is not null from public.encounters where id = (select id from t where k = 'e2')), 'the session active at that moment is paused automatically');
select lives_ok(format($q$select public.save_clinical_note_draft(%L, '{"assessment":"تقييم للبطاقة","plan":"خطة"}')$q$, (select id from t where k = 'e1')),
                'notes keep working after resuming');
select public.sign_clinical_note((select id from t where k = 'e1'));

-- prescription: approve for printing, send later
insert into t (k, id) select 'rx', (public.save_prescription_draft((select id from t where k = 'e1'),
  jsonb_build_array(jsonb_build_object('display_name', 'Paracetamol 500 mg tablet', 'dose', '1', 'dose_unit', 'قرص', 'frequency_text', 'عند اللزوم')),
  'idem-rx-later') ->> 'prescription_id')::uuid;
select public.approve_prescription((select id from t where k = 'rx'));
select is((select count(*)::int from public.prescription_dispatches where prescription_id = (select id from t where k = 'rx')), 0,
          'approving does not require sending to a pharmacy');
select public.send_prescription_to_pharmacy((select id from t where k = 'rx'), :PH_A);
select public.send_prescription_to_pharmacy((select id from t where k = 'rx'), :PH_A);
select is((select count(*)::int from public.prescription_dispatches where prescription_id = (select id from t where k = 'rx') and status = 'sent'), 1,
          'an approved prescription can be sent later (once)');

-- medical card
select ok((public.patient_medical_card((select id from t where k = 'p1')) -> 'visits') @> '[{"assessment":"تقييم للبطاقة"}]', 'the treating doctor sees the visit on the card');
select ok(jsonb_array_length(public.patient_medical_card((select id from t where k = 'p1')) -> 'prescriptions') = 1, 'the card lists approved prescriptions');

select tests.login(:U_DRSARA);
select throws_ok(format('select public.patient_medical_card(%L)', (select id from t where k = 'p1')),
                 'P0001', 'app:forbidden', 'a doctor who does not treat the patient cannot open the card');
select tests.login(:U_RECA);
select throws_ok(format('select public.patient_medical_card(%L)', (select id from t where k = 'p1')),
                 'P0001', 'app:forbidden', 'reception cannot open the medical card');
-- the patient now becomes Dr. Sara's patient too (e.g. referred / booked with her)
select tests.logout();
insert into public.care_relationships (patient_id, facility_id, practitioner_id, source)
values ((select id from t where k = 'p1'), :A1, :SARA, 'referral');
select tests.login(:U_DRSARA);
select ok((public.patient_medical_card((select id from t where k = 'p1')) -> 'visits') @> '[{"assessment":"تقييم للبطاقة"}]',
          'once the patient is under another doctor''s care, that doctor sees the other doctor''s signed visit');
select tests.logout();
select ok((select count(*) from public.access_audit where action = 'medical_card.viewed' and patient_id = (select id from t where k = 'p1')) >= 3,
          'every opening of the card is audited');
select * from finish();
rollback;
