-- New patients get «ID-W<n>»; staff lookup accepts ID-W12 / idw12 / id-w 12; old codes still work.
begin;
select plan(4);
\set A1 '''00000000-0000-4000-f000-0000000000a1'''
\set AHMED '''00000000-0000-4000-9000-000000000010'''
\set U_RECA '''00000000-0000-4000-a000-000000000020'''
create temp table t (k text primary key, id uuid, code text);
grant all on t to authenticated;
select tests.login(:U_RECA);
insert into t (k, id) select 'p', (r ->> 'patient_id')::uuid
  from (select public.reception_quick_book(:A1, :AHMED, 'idem-code-1', p_new_patient_name => 'رقم جديد (اختبار)') r) x;
update t set code = (select public_code from public.patients where id = t.id) where k = 'p';
select matches((select code from t where k = 'p'), '^ID-W[0-9]+$', 'a new patient gets an ID-W number');
select is((select patient_id from public.lookup_patients(:A1, lower(replace((select code from t where k = 'p'), '-', '')))),
          (select id from t where k = 'p'), 'lookup accepts idw<n> without the dash, in lower case');
select is((select patient_id from public.lookup_patients(:A1, 'ID-W 0' || substring((select code from t where k = 'p') from 5))),
          (select id from t where k = 'p'), 'lookup accepts a space and a leading zero');
select is((select count(*)::int from public.lookup_patients(:A1, 'PDEMO00050')), 1, 'existing codes still work');
select * from finish();
rollback;
