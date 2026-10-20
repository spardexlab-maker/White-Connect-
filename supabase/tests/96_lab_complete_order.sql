-- One-step lab completion: value OR available result file; publishes to patient + doctor.
begin;
select plan(6);
\set LAB_A '''00000000-0000-4000-f000-0000000000a3'''
\set U_LAB '''00000000-0000-4000-a000-000000000040'''
\set U_RECA '''00000000-0000-4000-a000-000000000020'''
\set P_HASAN '''00000000-0000-4000-5000-000000000050'''

create temp table t (k text primary key, id uuid);
grant all on t to authenticated;
insert into t (k, id) select 'cbc', id from public.lab_test_catalog where lab_facility_id = :LAB_A and code = 'CBC';
insert into t (k, id) select 'fbs', id from public.lab_test_catalog where lab_facility_id = :LAB_A and code = 'FBS';

select tests.login(:U_LAB, 'lab.a@demo.test');
select public.attach_patient_to_facility(:LAB_A, :P_HASAN, 'هوية مطابقة');
insert into t (k, id) select 'o1', (public.lab_register_direct(:LAB_A, :P_HASAN, array[(select id from t where k = 'fbs')], 'idem-complete-1')).id;
insert into t (k, id) select 'o2', (public.lab_register_direct(:LAB_A, :P_HASAN, array[(select id from t where k = 'cbc')], 'idem-complete-2')).id;

-- typed value: receive + publish in one call (no separate collect / draft / release)
select lives_ok(format($q$select public.complete_lab_order(%L, jsonb_build_array(jsonb_build_object('item_id', (select id from public.lab_order_items where order_id = %L), 'value', '95', 'range', '70-100')))$q$,
                (select id from t where k = 'o1'), (select id from t where k = 'o1')), 'a typed value completes the order');
select is((select status::text from public.lab_orders where id = (select id from t where k = 'o1')), 'released', 'the order is released');
select is((select value_numeric from public.lab_results r join public.lab_order_items i on i.id = r.order_item_id
            where i.order_id = (select id from t where k = 'o1') and r.status = 'released'), 95::numeric, 'the value is published as typed');

-- neither a value nor a file: refused
select throws_ok(format('select public.complete_lab_order(%L)', (select id from t where k = 'o2')), 'P0001', 'app:result_or_file_required',
                 'a value or a result file is required');

-- a result file alone is enough
select tests.logout();
insert into public.attachments (patient_id, kind, lab_order_id, file_name, declared_mime, declared_size, status, storage_path, uploaded_by, available_at)
values (:P_HASAN, 'lab_result', (select id from t where k = 'o2'), 'cbc.pdf', 'application/pdf', 1000, 'available', 'files/x', :U_LAB, now());
select tests.login(:U_LAB, 'lab.a@demo.test');
select lives_ok(format('select public.complete_lab_order(%L)', (select id from t where k = 'o2')), 'an uploaded result file completes the order');

select tests.login(:U_RECA);
select throws_ok(format('select public.complete_lab_order(%L)', (select id from t where k = 'o2')), 'P0001', 'app:forbidden',
                 'only lab staff can complete');
select * from finish();
rollback;
