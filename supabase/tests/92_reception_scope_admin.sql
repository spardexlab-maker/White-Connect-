-- The platform admin assigns doctors to a receptionist without gaining reception powers.
begin;
select plan(6);
\set ADMIN '\'00000000-0000-4000-a000-000000000001\''
\set RECA  '\'00000000-0000-4000-a000-000000000020\''
\set M_RECA '\'00000000-0000-4000-8000-000000000020\''
\set SARA '\'00000000-0000-4000-9000-000000000011\''
\set A1 '\'00000000-0000-4000-f000-0000000000a1\''

select tests.login(:ADMIN, 'admin@demo.test', 'aal2');
select is((select count(*)::int from public.reception_scope_options(:M_RECA)), 2, 'admin sees the clinic doctors for this receptionist');
select lives_ok(format('select public.set_reception_scope(%L, %L, false)', :M_RECA, :SARA), 'admin removes a doctor from the receptionist');
select ok(not (select allowed from public.reception_scope_options(:M_RECA) where practitioner_id = :SARA), 'scope reflects the change');
select throws_ok(format('select * from public.facility_day_board(%L, current_date, null)', :A1), 'P0001', null,
                 'admin still has no reception access to appointments');
select tests.login(:RECA, 'reception.a@demo.test');
select ok(not exists (select 1 from public.reception_practitioners(:A1) where practitioner_id = :SARA), 'receptionist no longer manages that doctor');
select throws_ok(format('select * from public.reception_scope_options(%L)', :M_RECA), 'P0001', 'app:forbidden', 'receptionist cannot change own scope');
select * from finish();
rollback;
