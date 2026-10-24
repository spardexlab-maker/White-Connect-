-- Phase 3 acceptance: sessions, notes isolation, prescriptions (print ≠
-- send ≠ dispense, versions), location-based pharmacy, lab draft/release/
-- correction, review tasks. Spec §18-c, d, e, f, g, i, j.
begin;
select plan(44);

\set A1 '''00000000-0000-4000-f000-0000000000a1'''
\set B1 '''00000000-0000-4000-f000-0000000000b1'''
\set PH_A '''00000000-0000-4000-f000-0000000000a2'''
\set PH_B '''00000000-0000-4000-f000-0000000000b2'''
\set LAB_A '''00000000-0000-4000-f000-0000000000a3'''
\set AHMED '''00000000-0000-4000-9000-000000000010'''
\set U_DRAHMED '''00000000-0000-4000-a000-000000000010'''
\set U_DRSARA '''00000000-0000-4000-a000-000000000011'''
\set U_RECA '''00000000-0000-4000-a000-000000000020'''
\set U_RECB '''00000000-0000-4000-a000-000000000021'''
\set U_PHA '''00000000-0000-4000-a000-000000000030'''
\set U_PHB '''00000000-0000-4000-a000-000000000031'''
\set U_LABTECH '''00000000-0000-4000-a000-000000000040'''
\set U_LABAPPR '''00000000-0000-4000-a000-000000000041'''
\set U_ADMIN '''00000000-0000-4000-a000-000000000001'''
\set U_HASAN '''00000000-0000-4000-a000-000000000050'''
\set P_HASAN '''00000000-0000-4000-5000-000000000050'''

create temp table t (k text primary key, id uuid, txt text);
grant all on t to authenticated;
insert into t (k, id) select 'cbc', id from public.lab_test_catalog where lab_facility_id = :LAB_A and code = 'CBC';
insert into t (k, id) select 'fbs', id from public.lab_test_catalog where lab_facility_id = :LAB_A and code = 'FBS';
insert into t (k, id) select 'para', id from public.medication_catalog where active_ingredient = 'Paracetamol' and dosage_form = 'tablet';

-- ---------------------------------------------------------------------
-- Name-only walk-in → doctor session (§18-d)
-- ---------------------------------------------------------------------
select tests.login(:U_RECA);
insert into t (k, id, txt) select 'q1', (r ->> 'queue_entry_id')::uuid, r ->> 'patient_id'
  from (select public.reception_quick_book(:A1, :AHMED, 'idem-clin-walkin-1', p_new_patient_name => 'مراجع بالاسم فقط') r) x;
insert into t (k, id) select 'p1', txt::uuid from t where k = 'q1';

select tests.login(:U_DRAHMED);
select throws_ok(format('select public.start_encounter(%L, false)', (select id from t where k = 'q1')),
                 'P0001', 'app:verification_required', 'session cannot start without identity confirmation');
select is((select count(*)::int from public.encounters where queue_entry_id = (select id from t where k = 'q1')), 0,
          'no session exists until the doctor presses start (time passing does nothing)');
insert into t (k, id) select 'e1', (public.start_encounter((select id from t where k = 'q1'), true)).id;
select ok((select started_at is not null and status = 'in_progress' from public.encounters where id = (select id from t where k = 'e1')),
          'start records the real start time');
select is((public.start_encounter((select id from t where k = 'q1'), true)).id, (select id from t where k = 'e1'),
          'starting twice is idempotent');

select public.save_clinical_note_draft((select id from t where k = 'e1'),
  '{"reason_for_visit":"صداع","assessment":"تقييم تجريبي","plan":"خطة تجريبية","vitals":{"pulse":80}}');
select is((select assessment from public.clinical_notes where encounter_id = (select id from t where k = 'e1') and status = 'draft'),
          'تقييم تجريبي', 'draft autosave stores structured fields');

-- prescription for the name-only patient
insert into t (k, id) select 'rx1', (public.save_prescription_draft((select id from t where k = 'e1'),
  jsonb_build_array(jsonb_build_object('medication_id', (select id from t where k = 'para'), 'dose', '1', 'dose_unit', 'قرص',
    'route', 'فموي', 'frequency_text', 'ثلاث مرات يومياً', 'duration_days', '5', 'quantity', '15', 'quantity_unit', 'قرص')),
  'idem-rx-1') ->> 'prescription_id')::uuid;
select tests.login(:U_PHA);
select is((select count(*)::int from public.prescriptions where id = (select id from t where k = 'rx1')), 0,
          'pharmacy cannot see a draft that was not sent to it');

-- pharmacy default follows the VISIT location (§18-f)
select tests.login(:U_DRAHMED);
select is((select pharmacy_id from public.pharmacy_choices((select id from t where k = 'e1')) where is_default), :PH_A::uuid,
          'at Rafidain the default pharmacy is Rafidain pharmacy');
select public.approve_prescription((select id from t where k = 'rx1'), :PH_A);
select is((select status::text from public.prescriptions where id = (select id from t where k = 'rx1')), 'active', 'prescription approved');
select is((select count(*)::int from public.notification_outbox o where o.payload ->> 'prescription_id' = (select id::text from t where k = 'rx1')), 0,
          'no notification is attempted for a patient without an account');

-- printing twice does not duplicate anything (§18-g)
select public.record_prescription_print((select id from t where k = 'rx1'), :A1);
select public.record_prescription_print((select id from t where k = 'rx1'), :A1);
select is((select count(*)::int from public.prescription_events where prescription_id = (select id from t where k = 'rx1') and event = 'printed'), 2,
          'each print is logged as a print event');
select is((select count(*)::int from public.prescription_events where prescription_id = (select id from t where k = 'rx1') and event in ('approved', 'sent')), 2,
          'prints do not create extra approvals or sends');
select is((select count(*)::int from public.prescription_dispatches where prescription_id = (select id from t where k = 'rx1')), 1,
          'one dispatch to the chosen pharmacy');
-- re-sending to the same pharmacy does not duplicate
select public.revise_prescription((select id from t where k = 'rx1'));
select throws_ok(format('select public.approve_prescription(%L, %L)', (select id from t where k = 'rx1'), :PH_A),
                 'P0001', 'app:reason_required', 'a revision after sending needs a reason');
insert into t (k, txt) select 'tok_v1', verify_token from public.prescription_versions where prescription_id = (select id from t where k = 'rx1') and version_no = 1;
select public.approve_prescription((select id from t where k = 'rx1'), :PH_A, 'تعديل الكمية (اختبار)');
select is((select count(*)::int from public.prescription_dispatches where prescription_id = (select id from t where k = 'rx1')), 1,
          'sending the revision again does not create a second request');
select is((select status::text from public.prescription_versions where prescription_id = (select id from t where k = 'rx1') and version_no = 1), 'superseded',
          'the old version is superseded');
select is(public.verify_prescription((select txt from t where k = 'tok_v1')) ->> 'status', 'superseded',
          'the old printed QR verifies as superseded (not dispensable)');

-- pharmacy B sees nothing; pharmacy A sees the new version
select tests.login(:U_PHB);
select is((select count(*)::int from public.pharmacy_inbox(:PH_B)), 0, 'another pharmacy sees nothing');
select tests.login(:U_PHA);
select is((select version_no from public.pharmacy_inbox(:PH_A) where prescription_id = (select id from t where k = 'rx1')), 2,
          'the chosen pharmacy sees the latest version');
select is((select count(*)::int from public.clinical_notes), 0, 'pharmacy cannot read clinical notes');

-- ---------------------------------------------------------------------
-- Lab order, waiting for results frees the doctor (§18-j)
-- ---------------------------------------------------------------------
select tests.login(:U_DRAHMED);
insert into t (k, id) select 'lo1', (public.order_lab_tests((select id from t where k = 'e1'), :LAB_A,
  array[(select id from t where k = 'cbc'), (select id from t where k = 'fbs')], 'idem-lab-1')).id;
select is((public.order_lab_tests((select id from t where k = 'e1'), :LAB_A,
  array[(select id from t where k = 'cbc'), (select id from t where k = 'fbs')], 'idem-lab-1')).id, (select id from t where k = 'lo1'),
  'duplicate submit of the same lab order returns the same order');
select public.sign_clinical_note((select id from t where k = 'e1'));
select throws_ok(format($q$ select public.save_clinical_note_draft(%L, '{"plan":"x"}') $q$, (select id from t where k = 'e1')),
                 'P0001', 'app:no_draft', 'a signed note can no longer be edited as a draft');
select public.set_encounter_status((select id from t where k = 'e1'), 'awaiting_results');
select is((select status::text from public.queue_entries where id = (select id from t where k = 'q1')), 'done',
          'awaiting results releases the doctor''s queue slot');

-- the doctor can start the next patient right away
select tests.login(:U_RECA);
insert into t (k, id) select 'q2', (public.reception_quick_book(:A1, :AHMED, 'idem-clin-walkin-2', p_patient_id => :P_HASAN) ->> 'queue_entry_id')::uuid;
select tests.login(:U_DRAHMED);
select lives_ok(format('select public.start_encounter(%L, true)', (select id from t where k = 'q2')),
                'next patient can be seen while results are pending');

-- ---------------------------------------------------------------------
-- Isolation of clinical notes (§18-e)
-- ---------------------------------------------------------------------
select tests.login(:U_RECA);
select is((select count(*)::int from public.clinical_notes), 0, 'receptionist cannot read clinical notes');
select throws_ok(format('select public.encounter_context(%L)', (select id from t where k = 'e1')), 'P0001', 'app:forbidden',
                 'receptionist cannot open the session context');
select tests.login(:U_DRSARA);
select is((select count(*)::int from public.clinical_notes where encounter_id = (select id from t where k = 'e1')), 0,
          'another doctor of the same clinic has no automatic access');
select tests.login(:U_ADMIN);
select is((select count(*)::int from public.clinical_notes) + (select count(*)::int from public.encounters), 0,
          'platform admin cannot read clinical records');

-- ---------------------------------------------------------------------
-- Lab workflow: draft invisible, approver releases, partial, correction (§18-i)
-- ---------------------------------------------------------------------
select tests.login(:U_LABTECH);
select public.lab_check_in((select id from t where k = 'lo1'));
select public.collect_specimen((select id from t where k = 'lo1'), 'دم');
insert into t (k, id) select 'item_fbs', id from public.lab_order_items where order_id = (select id from t where k = 'lo1') and test_id = (select id from t where k = 'fbs');
insert into t (k, id) select 'item_cbc', id from public.lab_order_items where order_id = (select id from t where k = 'lo1') and test_id = (select id from t where k = 'cbc');
select public.save_lab_result_draft((select id from t where k = 'item_fbs'), null, 95, 'mg/dL', '70-100 (lab)', null, null);
select tests.login(:U_DRAHMED);
select is((select count(*)::int from public.lab_results), 0, 'the ordering doctor does not see drafts');
select throws_ok(format('select public.release_lab_results(%L, array[%L]::uuid[])', (select id from t where k = 'lo1'), (select id from t where k = 'item_fbs')),
                 'P0001', 'app:forbidden', 'someone outside the lab (the doctor) cannot release results');

select tests.login(:U_LABAPPR);
select public.release_lab_results((select id from t where k = 'lo1'), array[(select id from t where k = 'item_fbs')]);
select is((select status::text from public.lab_orders where id = (select id from t where k = 'lo1')), 'processing',
          'partial release does not mark the whole order as released');

select tests.login(:U_DRAHMED);
select is((select count(*)::int from public.lab_results where status = 'released'), 1, 'ordering doctor sees the released result');
select is((select count(*)::int from public.clinical_tasks where lab_order_id = (select id from t where k = 'lo1') and status = 'open'), 1,
          'release creates a review task (no automatic diagnosis)');
select is((select status::text from public.encounters where id = (select id from t where k = 'e1')), 'ready_for_review',
          'the waiting session becomes ready for review');
select tests.login(:U_DRSARA);
select is((select count(*)::int from public.lab_results), 0, 'another doctor gets no automatic access to results');

-- correction keeps the original
select tests.login(:U_LABAPPR);
insert into t (k, id) select 'res1', id from public.lab_results where order_item_id = (select id from t where k = 'item_fbs') and status = 'released';
select public.correct_lab_result((select id from t where k = 'res1'), 'خطأ إدخال (اختبار)', null, 105, null, null, 'high', null);
select is((select status from public.lab_results where id = (select id from t where k = 'res1')), 'superseded', 'original result kept as superseded');
select is((select count(*)::int from public.lab_results where order_item_id = (select id from t where k = 'item_fbs')), 2, 'corrected version added');
select tests.login(:U_DRAHMED);
select is((select count(*)::int from public.clinical_tasks where kind = 'review_corrected_result' and lab_order_id = (select id from t where k = 'lo1')), 1,
          'the ordering doctor is notified with a correction review task');

-- released results are locked
select tests.logout();
select throws_ok(format('update public.lab_results set value_numeric = 1 where id = (select id from public.lab_results where order_item_id = %L and status = %L)',
                        (select id from t where k = 'item_fbs'), 'released'),
                 'P0001', 'app:signed_record_locked', 'released results cannot be silently edited');

-- patient side: Hasan (has account) only sees released items of his own orders
select tests.login(:U_HASAN);
select is((select count(*)::int from public.lab_orders where id = (select id from t where k = 'lo1')), 0,
          'a patient cannot see another patient''s lab order');
select is((select count(*)::int from public.encounters where patient_id = :P_HASAN), 1, 'patient sees that his visit exists');
select is((select count(*)::int from public.clinical_notes), 0, 'patient does not see internal notes or drafts');

-- same doctor at the OTHER location → that location's pharmacy (§18-f)
select tests.login(:U_DRAHMED);
select tests.diagnose((select id from public.encounters where queue_entry_id = (select id from t where k = 'q2')));
select public.set_encounter_status((select id from public.encounters where queue_entry_id = (select id from t where k = 'q2')), 'completed');
select tests.login(:U_RECB);
insert into t (k, id) select 'q3', (public.reception_quick_book(:B1, :AHMED, 'idem-clin-walkin-b1', p_new_patient_name => 'مراجع فرع المنصور') ->> 'queue_entry_id')::uuid;
select tests.login(:U_DRAHMED);
insert into t (k, id) select 'e3', (public.start_encounter((select id from t where k = 'q3'), true)).id;
select is((select facility_id from public.encounters where id = (select id from t where k = 'e3')), :B1::uuid, 'session is recorded at the Dijla clinic');
select is((select pharmacy_id from public.pharmacy_choices((select id from t where k = 'e3')) where is_default), :PH_B::uuid,
          'at Dijla the default pharmacy is Dijla pharmacy, not one saved on the doctor');
select is((select count(*)::int from public.pharmacy_choices((select id from t where k = 'e3'))), 2, 'other pharmacies remain selectable explicitly');

select * from finish();
rollback;
