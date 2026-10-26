-- The patient's own copy of a visit: diagnosis and advice once the doctor finishes; nobody else's visits.
begin;
select plan(7);
\set A1 '''00000000-0000-4000-f000-0000000000a1'''
\set AHMED '''00000000-0000-4000-9000-000000000010'''
\set U_DRAHMED '''00000000-0000-4000-a000-000000000010'''
\set U_RECA '''00000000-0000-4000-a000-000000000020'''
\set U_HASAN '''00000000-0000-4000-a000-000000000050'''
\set U_MONA '''00000000-0000-4000-a000-000000000051'''
\set P_HASAN '''00000000-0000-4000-5000-000000000050'''

create temp table t (k text primary key, id uuid);
grant all on t to authenticated;
select tests.login(:U_RECA);
insert into t select 'q', (public.reception_quick_book(:A1, :AHMED, 'idem-visit-walkin', p_patient_id => :P_HASAN) ->> 'queue_entry_id')::uuid;
select tests.login(:U_DRAHMED);
insert into t select 'enc', (public.start_encounter((select id from t where k = 'q'), true)).id;

select tests.login(:U_HASAN);
select is((public.patient_visit((select id from t where k = 'enc')) ->> 'finished')::boolean, false, 'while the session runs the patient sees it in progress');
select is(public.patient_visit((select id from t where k = 'enc')) ->> 'diagnosis', null, 'and no clinical content yet');

select tests.login(:U_DRAHMED);
select tests.diagnose((select id from t where k = 'enc'), 'التهاب أنف تحسسي');
select public.set_encounter_status((select id from t where k = 'enc'), 'completed');

select tests.login(:U_HASAN);
select is(public.patient_visit((select id from t where k = 'enc')) ->> 'diagnosis', 'التهاب أنف تحسسي', 'after the doctor finishes, the patient sees the diagnosis');
select isnt(public.patient_visit((select id from t where k = 'enc')) ->> 'doctor', null, 'with the doctor''s name');
select ok(not (public.patient_visit((select id from t where k = 'enc')) ? 'history'), 'internal history notes are not part of the patient copy');

select tests.login(:U_MONA);
select throws_ok(format($q$ select public.patient_visit(%L) $q$, (select id from t where k = 'enc')), 'P0001', 'app:forbidden', 'another patient cannot open it');
select tests.login(:U_DRAHMED);
select throws_ok(format($q$ select public.patient_visit(%L) $q$, (select id from t where k = 'enc')), 'P0001', 'app:forbidden', 'the patient copy is for linked patient accounts only');

select * from finish();
rollback;
