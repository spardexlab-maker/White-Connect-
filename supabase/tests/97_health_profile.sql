-- Patient health profile: patient edits, treating doctor reads (audited), others cannot;
-- lab results grouped per test with previous -> current; printable lab report.
begin;
select plan(11);
\set LAB_A '''00000000-0000-4000-f000-0000000000a3'''
\set A1 '''00000000-0000-4000-f000-0000000000a1'''
\set AHMED '''00000000-0000-4000-9000-000000000010'''
\set U_LAB '''00000000-0000-4000-a000-000000000040'''
\set U_RECA '''00000000-0000-4000-a000-000000000020'''
\set U_DRAHMED '''00000000-0000-4000-a000-000000000010'''
\set U_DRSARA '''00000000-0000-4000-a000-000000000011'''
\set U_MONA '''00000000-0000-4000-a000-000000000051'''
\set P_MONA '''00000000-0000-4000-5000-000000000051'''

create temp table t (k text primary key, id uuid);
grant all on t to authenticated;
insert into t (k, id) select 'vitd', id from public.lab_test_catalog where lab_facility_id = :LAB_A order by code limit 1;

-- the patient fills in her profile
select tests.login(:U_MONA, 'mona@demo.test');
select lives_ok(format($q$select public.save_health_profile(%L, '1987-05-01', 164, 70, 'O+', null)$q$, :P_MONA), 'patient saves her basics');
select lives_ok(format($q$select public.add_condition(%L, 'ارتفاع ضغط الدم', 2020)$q$, :P_MONA), 'patient adds a chronic condition');
select lives_ok(format($q$select public.add_reported_medication(%L, 'Amlodipine 5 mg', 'قرص صباحاً')$q$, :P_MONA), 'patient adds a regular medicine');
select is((public.health_profile(:P_MONA) -> 'profile' ->> 'weight_kg')::numeric, 70::numeric, 'profile is returned to the patient');

-- two results for the same test: previous and current
select tests.login(:U_LAB, 'lab.a@demo.test');
select public.attach_patient_to_facility(:LAB_A, :P_MONA, 'هوية مطابقة');
insert into t (k, id) select 'o1', (public.lab_register_direct(:LAB_A, :P_MONA, array[(select id from t where k = 'vitd')], 'idem-trend-1')).id;
select public.complete_lab_order((select id from t where k = 'o1'),
  jsonb_build_array(jsonb_build_object('item_id', (select id from public.lab_order_items where order_id = (select id from t where k = 'o1')), 'value', '10')));
-- the first result is from yesterday
select tests.logout();
set local session_replication_role = replica;   -- test only: released results are otherwise locked
update public.lab_results set released_at = now() - interval '1 day'
 where order_item_id in (select id from public.lab_order_items where order_id = (select id from t where k = 'o1'));
set local session_replication_role = origin;
select tests.login(:U_LAB, 'lab.a@demo.test');
insert into t (k, id) select 'o2', (public.lab_register_direct(:LAB_A, :P_MONA, array[(select id from t where k = 'vitd')], 'idem-trend-2')).id;
select public.complete_lab_order((select id from t where k = 'o2'),
  jsonb_build_array(jsonb_build_object('item_id', (select id from public.lab_order_items where order_id = (select id from t where k = 'o2')), 'value', '20')));

select tests.login(:U_MONA, 'mona@demo.test');
select is(jsonb_array_length((select x -> 'points' from jsonb_array_elements(public.health_profile(:P_MONA) -> 'lab_trends') x limit 1)), 2,
          'the same test is grouped with its history');
select is(((select x -> 'points' -> 0 from jsonb_array_elements(public.health_profile(:P_MONA) -> 'lab_trends') x limit 1) ->> 'value_numeric')::numeric, 20::numeric,
          'the newest value comes first (previous 10 -> current 20)');
select is(public.lab_report((select id from t where k = 'o2')) -> 'items' -> 0 ->> 'value_numeric', '20', 'the patient can open the printable report');

-- others
select tests.login(:U_RECA);
select throws_ok(format('select public.health_profile(%L)', :P_MONA), 'P0001', 'app:forbidden', 'reception cannot read the health profile');
select tests.login(:U_DRSARA);
select throws_ok(format('select public.health_profile(%L)', :P_MONA), 'P0001', 'app:forbidden', 'a doctor who does not treat the patient cannot read it');
select tests.logout();
insert into public.care_relationships (patient_id, facility_id, practitioner_id, source) values (:P_MONA, :A1, :AHMED, 'referral') on conflict do nothing;
select tests.login(:U_DRAHMED);
select is(jsonb_array_length(public.health_profile(:P_MONA) -> 'conditions'), 1, 'the treating doctor sees the conditions');
select tests.logout();
select ok(exists (select 1 from public.access_audit where action = 'health_profile.viewed' and patient_id = :P_MONA), 'the doctor''s view is audited');
select * from finish();
rollback;
