-- The facility-admin role is retired: it cannot be invited, granted or made active.
begin;
select plan(4);
\set ADMIN '\'00000000-0000-4000-a000-000000000001\''
\set ORG_A '\'00000000-0000-4000-e000-000000000001\''
\set A1 '\'00000000-0000-4000-f000-0000000000a1\''

select is((select count(*)::int from public.memberships where role = 'facility_admin' and status = 'active'), 0, 'no active facility admins remain');

select tests.login(:ADMIN, 'admin@demo.test', 'aal2');
select throws_ok(format($q$select public.create_invitation('fa@demo.test', %L, %L, 'facility_admin')$q$, :ORG_A, :A1),
                 'P0001', 'app:forbidden', 'even the platform admin cannot invite a facility admin');
select throws_ok(format($q$select public.admin_grant_membership('00000000-0000-4000-a000-000000000020', %L, %L, 'facility_admin')$q$, :ORG_A, :A1),
                 'P0001', 'app:forbidden', 'nor grant it directly');
select tests.logout();

select throws_ok(format($q$insert into public.memberships (user_id, organization_id, facility_id, role)
                           values ('00000000-0000-4000-a000-000000000020', %L, %L, 'facility_admin')$q$, :ORG_A, :A1),
                 'P0001', 'app:role_retired', 'an active facility-admin membership cannot exist');
select * from finish();
rollback;
