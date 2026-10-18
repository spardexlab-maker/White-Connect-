-- Complex directory: members of a facility see the doctors of their complex only.
begin;
select plan(5);
\set PHARM_A '\'00000000-0000-4000-a000-000000000030\''
\set MONA    '\'00000000-0000-4000-a000-000000000051\''
\set PH_A    '\'00000000-0000-4000-f000-0000000000a2\''
\set PH_B    '\'00000000-0000-4000-f000-0000000000b2\''

select tests.login(:PHARM_A, 'pharm.a@demo.test');
select is((select count(*)::int from public.organization_doctors(:PH_A)), 2, 'Rafidain pharmacist sees the two Rafidain clinic doctors');
select ok(exists (select 1 from public.organization_doctors(:PH_A) where full_name like 'د. أحمد%'), 'includes Dr. Ahmed (works in this complex)');
select ok(not exists (select 1 from public.organization_doctors(:PH_A) where full_name like 'د. ليلى%'), 'excludes doctors of another complex');
select throws_ok($$ select * from public.organization_doctors('00000000-0000-4000-f000-0000000000b2') $$, 'P0001', 'app:forbidden', 'cannot list another complex');
select tests.login(:MONA, 'mona@demo.test');
select throws_ok($$ select * from public.organization_doctors('00000000-0000-4000-f000-0000000000a2') $$, 'P0001', 'app:forbidden', 'patients cannot use the staff directory');
select * from finish();
rollback;
