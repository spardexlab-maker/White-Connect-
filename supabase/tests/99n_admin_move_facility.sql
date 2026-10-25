-- Super admin attaches a clinic added on its own to a complex; staff move with it.
begin;
select plan(11);
\set U_ADMIN '''00000000-0000-4000-a000-000000000001'''
\set U_DRSARA '''00000000-0000-4000-a000-000000000011'''
\set U_HASAN '''00000000-0000-4000-a000-000000000050'''
\set RAFIDAIN '''00000000-0000-4000-e000-000000000001'''
\set B_KARRADA '''00000000-0000-4000-b000-000000000001'''

create temp table t (k text primary key, v uuid);
grant all on t to authenticated;

select tests.login(:U_ADMIN);
insert into t select 'org', (public.admin_create_organization('عيادة مستقلة', 'independent', true)).id;
insert into t select 'br', (public.admin_create_branch((select v from t where k = 'org'), 'الفرع', null, 'المنصور')).id;
insert into t select 'clinic', (public.admin_create_facility((select v from t where k = 'org'), (select v from t where k = 'br'), 'clinic', 'عيادة د. سارة')).id;
insert into t select 'org2', (public.admin_create_organization('صيدلية مستقلة', 'independent', true)).id;
insert into t select 'br2', (public.admin_create_branch((select v from t where k = 'org2'), 'الفرع', null, 'الكرخ')).id;
insert into t select 'ph', (public.admin_create_facility((select v from t where k = 'org2'), (select v from t where k = 'br2'), 'pharmacy', 'صيدلية مستقلة')).id;
select tests.logout();
insert into public.memberships (user_id, organization_id, facility_id, role, status)
  select :U_DRSARA, (select v from t where k = 'org'), (select v from t where k = 'clinic'), 'doctor', 'active';

select tests.login(:U_HASAN);
select throws_ok(format($$ select public.admin_move_facility(%L, %L) $$, (select v from t where k = 'clinic'), :RAFIDAIN), 'P0001', 'app:forbidden', 'only the super admin moves facilities');
select tests.login(:U_ADMIN);
select throws_ok(format($$ select public.admin_move_facility(%L, %L) $$, (select v from t where k = 'clinic'), (select v from t where k = 'org2')), 'P0001', 'app:not_a_complex', 'the target must be a complex');
select is((select jsonb_array_length(doctors) from public.admin_structure() where facility_id = (select v from t where k = 'clinic')), 1, 'the structure view lists the clinic''s doctor');

select lives_ok(format($$ select public.admin_move_facility(%L, %L) $$, (select v from t where k = 'clinic'), :RAFIDAIN), 'a clinic moves into the complex with its own place');
select tests.logout();
select is((select organization_id from public.facilities where id = (select v from t where k = 'clinic')), :RAFIDAIN::uuid, 'the clinic now belongs to the complex');
select is((select organization_id from public.branches where id = (select v from t where k = 'br')), :RAFIDAIN::uuid, 'its place became one of the complex''s');
select is((select organization_id from public.memberships where user_id = :U_DRSARA and facility_id = (select v from t where k = 'clinic')), :RAFIDAIN::uuid, 'the doctor keeps access, now under the complex');
select is((select status::text from public.organizations where id = (select v from t where k = 'org')), 'closed', 'the empty independent record is closed');

select tests.login(:U_ADMIN);
select lives_ok(format($$ select public.admin_move_facility(%L, %L, %L) $$, (select v from t where k = 'ph'), :RAFIDAIN, :B_KARRADA), 'a pharmacy joins the complex at the complex''s existing place');
select tests.logout();
select is((select branch_id from public.facilities where id = (select v from t where k = 'ph')), :B_KARRADA::uuid, 'the pharmacy sits at the complex''s place');
select is((select count(*)::int from public.access_audit where action = 'facility.moved'), 2, 'both moves are in the audit log');

select * from finish();
rollback;
