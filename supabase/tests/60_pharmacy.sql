-- Phase 4 acceptance (§10, §18-g, §18-h): dispensing from the current
-- version only, never above prescribed, FEFO, no expired, no negative
-- stock, partial dispensing, returns, reports (prescribed ≠ sold).
begin;
select plan(22);

\set A1 '''00000000-0000-4000-f000-0000000000a1'''
\set PH_A '''00000000-0000-4000-f000-0000000000a2'''
\set AHMED '''00000000-0000-4000-9000-000000000010'''
\set U_DRAHMED '''00000000-0000-4000-a000-000000000010'''
\set U_RECA '''00000000-0000-4000-a000-000000000020'''
\set U_PHA '''00000000-0000-4000-a000-000000000030'''
\set U_PHB '''00000000-0000-4000-a000-000000000031'''

create temp table t (k text primary key, id uuid, txt text);
grant all on t to authenticated;
insert into t (k, id) select 'para', id from public.medication_catalog where active_ingredient = 'Paracetamol' and dosage_form = 'tablet';

-- stock: product + two batches (FEFO) + one expired batch inserted directly
select tests.login(:U_PHA);
insert into t (k, id) select 'prod', (public.upsert_pharmacy_product(:PH_A, 'باراسيتامول 500 (تجريبي)', 250, (select id from t where k = 'para'), 10, 'قرص')).id;
select public.receive_stock((select id from t where k = 'prod'), 'LATE', current_date + 300, 2, 100, 'idem-recv-late');
select public.receive_stock((select id from t where k = 'prod'), 'EARLY', current_date + 30, 1, 100, 'idem-recv-early');
select public.receive_stock((select id from t where k = 'prod'), 'EARLY', current_date + 30, 1, 100, 'idem-recv-early');
select is((select sum(quantity_on_hand)::int from public.inventory_batches where product_id = (select id from t where k = 'prod')), 30,
          'receiving converts packs to units; replayed receipt is not double counted');
select throws_ok(format('select public.receive_stock(%L, %L, %L, 1, 100, %L)', (select id from t where k = 'prod'), 'OLD', current_date - 1, 'idem-recv-old'),
                 'P0001', 'app:expired_batch', 'an expired batch cannot be received');
select tests.logout();
insert into public.inventory_batches (product_id, batch_no, expiry_date, quantity_on_hand) values ((select id from t where k = 'prod'), 'EXPIRED', current_date - 5, 50);
select throws_ok(format('update public.inventory_batches set quantity_on_hand = -1 where product_id = %L and batch_no = %L', (select id from t where k = 'prod'), 'LATE'),
                 '23514', null, 'stock can never go negative (constraint)');

-- a prescription for 12 tablets sent to pharmacy A
select tests.login(:U_RECA);
insert into t (k, id) select 'q', (public.reception_quick_book(:A1, :AHMED, 'idem-ph-walkin', p_new_patient_name => 'مريض صيدلية تجريبي') ->> 'queue_entry_id')::uuid;
select tests.login(:U_DRAHMED);
insert into t (k, id) select 'enc', (public.start_encounter((select id from t where k = 'q'), true)).id;
insert into t (k, id) select 'rx', (public.save_prescription_draft((select id from t where k = 'enc'),
  jsonb_build_array(jsonb_build_object('medication_id', (select id from t where k = 'para'), 'frequency_text', 'ثلاث مرات يومياً', 'quantity', '12', 'quantity_unit', 'قرص')),
  'idem-ph-rx') ->> 'prescription_id')::uuid;
select public.approve_prescription((select id from t where k = 'rx'), :PH_A);
-- printing twice changes nothing in dispensing or counts
select public.record_prescription_print((select id from t where k = 'rx'), :A1);
select public.record_prescription_print((select id from t where k = 'rx'), :A1);

select tests.login(:U_PHA);
insert into t (k, id) select 'disp', dispatch_id from public.pharmacy_inbox(:PH_A) where prescription_id = (select id from t where k = 'rx');
select throws_ok(format($q$ select public.dispense_prescription(%L, '[{"line_no":1,"product_id":"%s","quantity":13}]', 'idem-disp-over') $q$,
                        (select id from t where k = 'disp'), (select id from t where k = 'prod')),
                 'P0001', 'app:exceeds_prescribed', 'cannot dispense more than prescribed');

-- prepare reserves (reserved ≠ available)
select public.prepare_dispatch((select id from t where k = 'disp'), jsonb_build_array(jsonb_build_object('line_no', 1, 'product_id', (select id from t where k = 'prod'), 'quantity', 8)));
select is((select reserved from public.pharmacy_stock(:PH_A) where product_id = (select id from t where k = 'prod')), 8, 'preparation reserves stock');
select is((select available from public.pharmacy_stock(:PH_A) where product_id = (select id from t where k = 'prod')), 22, 'available = on hand − reserved');
select is((select expired_on_hand from public.pharmacy_stock(:PH_A) where product_id = (select id from t where k = 'prod')), 50, 'expired stock is reported separately');

-- partial dispensing (8 of 12), FEFO: the early batch (10) is used first
insert into t (k, txt) select 'sale1', public.dispense_prescription((select id from t where k = 'disp'),
  jsonb_build_array(jsonb_build_object('line_no', 1, 'product_id', (select id from t where k = 'prod'), 'quantity', 8)), 'idem-disp-1') ->> 'sale_id';
select is((select status from public.prescription_dispatches where id = (select id from t where k = 'disp')), 'partially_dispensed', 'partial dispensing is recorded as partial');
select is((select quantity_on_hand from public.inventory_batches where product_id = (select id from t where k = 'prod') and batch_no = 'EARLY'), 2,
          'FEFO: the earliest-expiring batch was used');
select is((select quantity_on_hand from public.inventory_batches where product_id = (select id from t where k = 'prod') and batch_no = 'EXPIRED'), 50,
          'expired batch is never dispensed');
select is((select sum(quantity)::int from public.stock_reservations where dispatch_id = (select id from t where k = 'disp') and status = 'active'), null,
          'reservations are consumed by dispensing');
select is(public.dispense_prescription((select id from t where k = 'disp'),
  jsonb_build_array(jsonb_build_object('line_no', 1, 'product_id', (select id from t where k = 'prod'), 'quantity', 8)), 'idem-disp-1') ->> 'sale_id',
  (select txt from t where k = 'sale1'), 'replaying the same dispense returns the same sale (no double dispensing)');
select is((select total_minor from public.sales where id = (select txt from t where k = 'sale1')::uuid), 2000::bigint, 'sale total in integer IQD (8 × 250)');

-- revision supersedes: the old version can no longer be dispensed
select tests.login(:U_DRAHMED);
select public.revise_prescription((select id from t where k = 'rx'));
select public.save_prescription_draft((select id from t where k = 'enc'),
  jsonb_build_array(jsonb_build_object('medication_id', (select id from t where k = 'para'), 'frequency_text', 'مرتين يومياً', 'quantity', '10', 'quantity_unit', 'قرص')),
  'idem-ph-rx', (select id from t where k = 'rx'));
select public.approve_prescription((select id from t where k = 'rx'), null, 'تقليل الكمية (اختبار)');
select tests.login(:U_PHA);
select is((select version_id from public.prescription_dispatches where id = (select id from t where k = 'disp')),
          (select current_version_id from public.prescriptions where id = (select id from t where k = 'rx')), 'the dispatch now points to the new version');
select throws_ok(format($q$ select public.dispense_prescription(%L, '[{"line_no":1,"product_id":"%s","quantity":5}]', 'idem-disp-2') $q$,
                        (select id from t where k = 'disp'), (select id from t where k = 'prod')),
                 'P0001', 'app:exceeds_prescribed', 'already-dispensed quantity counts against the revised version');
select lives_ok(format($q$ select public.dispense_prescription(%L, '[{"line_no":1,"product_id":"%s","quantity":2}]', 'idem-disp-3') $q$,
                       (select id from t where k = 'disp'), (select id from t where k = 'prod')), 'remaining quantity can be dispensed');
select is((select status from public.prescription_dispatches where id = (select id from t where k = 'disp')), 'dispensed', 'fully dispensed');

-- cancelled prescription cannot be dispensed
select tests.login(:U_DRAHMED);
select throws_ok(format('select public.cancel_prescription(%L, %L)', (select id from t where k = 'rx'), 'إلغاء تجريبي'),
                 'P0001', 'app:already_dispensed', 'a dispensed prescription cannot be cancelled');

-- return: restocks and is reported
select tests.login(:U_PHA);
select public.return_sale_line((select id from public.sale_lines where sale_id = (select txt from t where k = 'sale1')::uuid order by quantity desc limit 1), 2, 'مرتجع تجريبي');
select is((select (pharmacy_report(:PH_A, current_date, current_date) -> 'by_product' -> 0 ->> 'returned_units')::int), 2, 'returns are reported');

-- report: prescribed ≠ dispensed ≠ prints
select is((select (public.pharmacy_report(:PH_A, current_date, current_date) -> 'by_ingredient' -> 0 ->> 'unique_prescriptions')::int), 1,
          'one unique prescription counted (versions and reprints not double counted)');
select is((select (public.pharmacy_report(:PH_A, current_date, current_date) -> 'by_ingredient' -> 0 ->> 'units_dispensed')::int), 10,
          'dispensed units reported separately from requested units');

-- another pharmacy sees nothing
select tests.login(:U_PHB);
select is((select count(*)::int from public.pharmacy_products where pharmacy_id = :PH_A) + (select count(*)::int from public.sales where pharmacy_id = :PH_A), 0,
          'other pharmacy cannot see pharmacy A stock or sales');

select * from finish();
rollback;
