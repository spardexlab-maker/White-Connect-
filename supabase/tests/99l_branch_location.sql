-- The super admin sets a clinic's place on the map (from a pasted map link); nobody else can.
begin;
select plan(4);
\set B1 '''00000000-0000-4000-b000-000000000001'''
\set U_ADMIN '''00000000-0000-4000-a000-000000000001'''
\set U_HASAN '''00000000-0000-4000-a000-000000000050'''

select tests.login(:U_HASAN);
select throws_ok(format($$ select public.admin_set_branch_location(%L, 33.3, 44.4) $$, :B1), 'P0001', 'app:forbidden', 'a patient cannot move a clinic');

select tests.login(:U_ADMIN);
select throws_ok(format($$ select public.admin_set_branch_location(%L, 133.3, 44.4) $$, :B1), 'P0001', 'app:invalid_location', 'impossible coordinates are refused');
select lives_ok(format($$ select public.admin_set_branch_location(%L, 33.312345, 44.361234) $$, :B1), 'the super admin sets the location');
select tests.logout();
select is((select array[latitude, longitude] from public.branches where id = :B1), array[33.312345, 44.361234]::double precision[], 'the clinic now sits at the new place');

select * from finish();
rollback;
