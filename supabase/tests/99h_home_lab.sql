-- Home sample collection: the patient asks, the lab schedules / goes / collects, the order enters the lab workflow.
begin;
select plan(13);
\set LAB_A '''00000000-0000-4000-f000-0000000000a3'''
\set LAB_B '''00000000-0000-4000-f000-0000000000b3'''
\set U_HASAN '''00000000-0000-4000-a000-000000000050'''
\set P_HASAN '''00000000-0000-4000-5000-000000000050'''
\set U_LABTECH '''00000000-0000-4000-a000-000000000040'''
\set U_LABAPPR '''00000000-0000-4000-a000-000000000041'''
\set U_LABB '''00000000-0000-4000-a000-000000000042'''

create temp table t (k text primary key, id uuid);
grant all on t to authenticated;
insert into t select 'cbc', id from public.lab_test_catalog where lab_facility_id = :LAB_A and code = 'CBC';
insert into t select 'fbs', id from public.lab_test_catalog where lab_facility_id = :LAB_A and code = 'FBS';

select tests.login(:U_HASAN);
select throws_ok(format($q$ select public.request_home_lab(%L, %L, array[%L]::uuid[], 'بغداد، الكرادة، شارع 62', '07700000000', current_date + 1, 'morning') $q$,
                 :P_HASAN, :LAB_A, (select id from t where k = 'cbc')),
                 'P0001', 'app:home_collection_unavailable', 'a lab that does not come home cannot be asked');

select tests.login(:U_LABB);
select throws_ok(format($q$ select public.set_home_collection(%L, true) $q$, :LAB_A), 'P0001', 'app:forbidden', 'another lab cannot switch it on');
select tests.login(:U_LABAPPR);
select public.set_home_collection(:LAB_A, true, 5000, 'نغطي الكرادة والجادرية');

select tests.login(:U_HASAN);
select ok(exists (select 1 from jsonb_array_elements(public.home_collection_labs()) e where e ->> 'id' = :LAB_A::text and jsonb_array_length(e -> 'tests') > 0),
          'the lab now shows in the home-collection list with its tests');
insert into t select 'r', (public.request_home_lab(:P_HASAN, :LAB_A, array[(select id from t where k = 'cbc'), (select id from t where k = 'fbs')],
                                                    'بغداد، الكرادة، شارع 62، دار 14', '07700000000', current_date + 1, 'morning', 'الطابق الثاني')).id;
select is((select status from public.home_lab_requests where id = (select id from t where k = 'r')), 'requested', 'the request is made');
select throws_ok(format($q$ select public.request_home_lab(%L, %L, array[%L]::uuid[], 'بغداد، الكرادة، شارع 62', '07700000000', current_date + 1, 'noon') $q$,
                 :P_HASAN, :LAB_A, (select id from t where k = 'cbc')),
                 'P0001', 'app:home_lab_duplicate', 'one request per lab per day');
select tests.logout();
select ok(exists (select 1 from public.notification_outbox where template = 'homelab.new' and recipient_user_id = :U_LABTECH::uuid), 'the lab staff are notified');

select tests.login(:U_LABB);
select throws_ok(format($q$ select public.lab_home_requests(%L) $q$, :LAB_A), 'P0001', 'app:forbidden', 'another lab cannot see the requests');

select tests.login(:U_LABTECH);
select is(jsonb_array_length(public.lab_home_requests(:LAB_A)), 1, 'the lab sees the request');
select public.lab_update_home_request((select id from t where k = 'r'), 'scheduled', (current_date + 1 + time '09:30') at time zone 'Asia/Baghdad', 'علي');
select throws_ok(format($q$ select public.lab_update_home_request(%L, 'requested') $q$, (select id from t where k = 'r')),
                 'P0001', 'app:invalid_transition', 'statuses only move forward');
select public.lab_update_home_request((select id from t where k = 'r'), 'on_the_way');
select public.lab_update_home_request((select id from t where k = 'r'), 'collected');
select is((select count(*)::int from public.lab_order_items i join public.home_lab_requests r on r.lab_order_id = i.order_id
            where r.id = (select id from t where k = 'r')), 2, 'collecting creates the lab order with both tests');

select tests.login(:U_HASAN);
select is((select jsonb_array_length(e -> 'events') from jsonb_array_elements(public.my_home_lab_requests()) e
            where e ->> 'id' = (select id::text from t where k = 'r')), 4, 'the patient follows every step');
select throws_ok(format($q$ select public.cancel_home_lab_request(%L) $q$, (select id from t where k = 'r')),
                 'P0001', 'app:invalid_transition', 'a collected request cannot be cancelled');
select tests.logout();
select is((select count(*)::int from public.notification_outbox where template like 'homelab.%' and recipient_user_id = :U_HASAN::uuid and channel = 'push'),
          3, 'the patient got scheduled / on the way / collected');
select * from finish();
rollback;
