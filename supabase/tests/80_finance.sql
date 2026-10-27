-- Phase 6: operational invoices (one per visit, idempotent payments, no
-- overpayment, refunds with reason, void rules), reports without medical
-- data, platform health admin-only.
begin;
select plan(12);

\set A1 '''00000000-0000-4000-f000-0000000000a1'''
\set U_RECA '''00000000-0000-4000-a000-000000000020'''
\set U_RECB '''00000000-0000-4000-a000-000000000021'''
\set U_DRAHMED '''00000000-0000-4000-a000-000000000010'''
\set U_ADMIN '''00000000-0000-4000-a000-000000000001'''
\set U_HASAN '''00000000-0000-4000-a000-000000000050'''

create temp table t (k text primary key, id uuid);
grant all on t to authenticated;

select tests.login(:U_RECA);
insert into t select 'inv', (public.create_invoice('00000000-0000-4000-4000-000000000001')).id;
select is((public.create_invoice('00000000-0000-4000-4000-000000000001')).id, (select id from t where k = 'inv'), 'one invoice per visit (idempotent)');
select is((select total_minor from public.invoices where id = (select id from t where k = 'inv')), 25000::bigint, 'invoice uses the appointment price snapshot');
select throws_ok(format('select public.record_invoice_payment(%L, 30000, %L)', (select id from t where k = 'inv'), 'idem-pay-over'), 'P0001', 'app:overpayment', 'no overpayment');
select public.record_invoice_payment((select id from t where k = 'inv'), 25000, 'idem-pay-1');
select public.record_invoice_payment((select id from t where k = 'inv'), 25000, 'idem-pay-1');
select is((select status from public.invoices where id = (select id from t where k = 'inv')), 'paid', 'paid once; replayed payment ignored');
select throws_ok(format('select public.record_invoice_payment(%L, -5000, %L)', (select id from t where k = 'inv'), 'idem-ref-1'), 'P0001', 'app:reason_required', 'refund needs a reason');
select public.record_invoice_payment((select id from t where k = 'inv'), -5000, 'idem-ref-2', 'cash', 'استرداد جزئي (اختبار)');
select is((select status from public.invoices where id = (select id from t where k = 'inv')), 'open', 'partial refund reopens the balance');

select tests.login(:U_RECB);
select throws_ok(format('select public.invoice_document(%L)', (select id from t where k = 'inv')), 'P0001', 'app:forbidden', 'another complex cannot read the invoice');

-- facility report: run by the platform admin (facility-admin role retired) — counts and money only
select tests.login(:U_DRAHMED);
select throws_ok(format('select public.facility_report(%L, (now() at time zone ''Asia/Baghdad'')::date, (now() at time zone ''Asia/Baghdad'')::date)', :A1), 'P0001', 'app:forbidden', 'a doctor cannot open financial reports');
select tests.login(:U_ADMIN, 'admin@demo.test', 'aal2');
select is((public.facility_report(:A1, (now() at time zone 'Asia/Baghdad')::date, (now() at time zone 'Asia/Baghdad')::date) ->> 'collected_minor')::bigint, 25000::bigint, 'collected amount reported');
select ok(not (public.facility_report(:A1, (now() at time zone 'Asia/Baghdad')::date, (now() at time zone 'Asia/Baghdad')::date)::text ~* 'assessment|diagnos|full_name'), 'report contains no clinical or patient names');

select tests.login(:U_RECA);
select throws_ok(format('select public.facility_report(%L, (now() at time zone ''Asia/Baghdad'')::date, (now() at time zone ''Asia/Baghdad'')::date)', :A1), 'P0001', 'app:forbidden', 'receptionist cannot open financial reports');
select throws_ok('select public.system_health()', 'P0001', 'app:forbidden', 'system health is platform-admin only');

select * from finish();
rollback;
