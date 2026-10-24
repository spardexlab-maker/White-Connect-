-- Tests for any lab: the doctor orders with a code, a lab takes part of it, the rest the patient enters.
begin;
select plan(12);
\set A1 '''00000000-0000-4000-f000-0000000000a1'''
\set LAB_A '''00000000-0000-4000-f000-0000000000a3'''
\set AHMED '''00000000-0000-4000-9000-000000000010'''
\set U_DRAHMED '''00000000-0000-4000-a000-000000000010'''
\set U_RECA '''00000000-0000-4000-a000-000000000020'''
\set U_HASAN '''00000000-0000-4000-a000-000000000050'''
\set P_HASAN '''00000000-0000-4000-5000-000000000050'''
\set U_LABTECH '''00000000-0000-4000-a000-000000000040'''
\set U_LABB '''00000000-0000-4000-a000-000000000042'''

create temp table t (k text primary key, v text);
grant all on t to authenticated;
select ok((select count(*) from public.lab_test_master) >= 30, 'the test catalogue is seeded');
select tests.login(:U_RECA);
insert into t select 'q', public.reception_quick_book(:A1, :AHMED, 'idem-open-walkin', p_patient_id => :P_HASAN) ->> 'queue_entry_id';
select tests.login(:U_DRAHMED);
insert into t select 'enc', (public.start_encounter((select v::uuid from t where k = 'q'), true)).id;
insert into t select 'code', public.create_open_lab_order((select v::uuid from t where k = 'enc'), jsonb_build_array(
  jsonb_build_object('master_id', (select id from public.lab_test_master where code = 'FBS')),
  jsonb_build_object('master_id', (select id from public.lab_test_master where code = 'VITD')),
  jsonb_build_object('name', 'فحص نادر غير مدرج')), 'صائم') ->> 'code';
select ok((select v from t where k = 'code') ~ '^[A-Z0-9]{4}-[A-Z0-9]{4}$', 'the order gets a short code');
insert into t select 'fbs', i.id from public.open_lab_order_items i join public.lab_test_master m on m.id = i.master_id
  where m.code = 'FBS' and i.order_id = (select id from public.open_lab_orders where code = (select v from t where k = 'code'));
insert into t select 'vitd', i.id from public.open_lab_order_items i join public.lab_test_master m on m.id = i.master_id
  where m.code = 'VITD' and i.order_id = (select id from public.open_lab_orders where code = (select v from t where k = 'code'));

select tests.login(:U_HASAN);
select is((select jsonb_array_length(e -> 'items') from jsonb_array_elements(public.my_open_lab_orders()) e where e ->> 'code' = (select v from t where k = 'code')), 3,
          'the patient sees the order with its three tests');

select tests.login(:U_LABTECH);
select throws_ok($$ select public.lab_lookup_open_order('00000000-0000-4000-f000-0000000000a3', 'XXXX-XXXX') $$, 'P0001', 'app:open_order_not_found', 'a wrong code is refused');
insert into t select 'lookup', public.lab_lookup_open_order(:LAB_A, 'https://white-connect.vercel.app/lab-order?code=' || lower((select v from t where k = 'code')))::text;
select ok(((select v::jsonb from t where k = 'lookup') -> 'matches') ->> (select v from t where k = 'fbs') is not null,
          'the lab''s own «سكر صائم» is matched to the catalogue test (code from a scanned QR link)');
select is((public.lab_claim_open_order(:LAB_A, (select v from t where k = 'code'), jsonb_build_array(jsonb_build_object(
            'item_id', (select v from t where k = 'fbs'),
            'test_id', (select id from public.lab_test_catalog where lab_facility_id = :LAB_A and code = 'FBS')))) ->> 'left_open')::int, 2,
          'the lab takes «سكر صائم»; two tests stay open');
select tests.logout();
select is((select o.source || '/' || (o.ordering_practitioner_id = :AHMED::uuid)::text from public.lab_orders o
            where o.id = (select lab_order_id from public.open_lab_order_items where id = (select v::uuid from t where k = 'fbs'))), 'referral/true',
          'it arrives as the doctor''s referral (results go back to him)');

select tests.login(:U_LABB);
select throws_ok(format($q$ select public.lab_claim_open_order(%L, %L, '[]') $q$, '00000000-0000-4000-f000-0000000000a3', (select v from t where k = 'code')),
                 'P0001', 'app:forbidden', 'another lab''s staff cannot act for this lab');

select tests.login(:U_HASAN);
select lives_ok(format($q$ select public.add_self_lab_result(%L, null, '24', current_date, p_open_item_id => %L) $q$, :P_HASAN,
          (select v from t where k = 'vitd')),
          'the patient enters the vitamin D result from an outside lab');
select is((select p ->> 'source' from jsonb_array_elements(public.health_profile(:P_HASAN) -> 'lab_trends') tr, jsonb_array_elements(tr -> 'points') p
            where tr ->> 'key' = 'VITD' limit 1), 'patient', 'it shows in the trends, marked as entered by the patient');
select is((select tr ->> 'reference_range' from jsonb_array_elements(public.health_profile(:P_HASAN) -> 'lab_trends') tr where tr ->> 'key' = 'VITD'), '30-100',
          '…with the catalogue''s reference range (so it is coloured low/normal/high)');
select tests.logout();
select ok(exists (select 1 from public.notification_outbox where template = 'lab.patient_entered' and recipient_user_id = :U_DRAHMED::uuid),
          'the ordering doctor is told');
select * from finish();
rollback;
