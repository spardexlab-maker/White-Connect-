-- «مسح البيانات التجريبية»: only the admin, only with the phrase, all demo data gone, admins and catalogs kept, lockable for good.
begin;
select plan(13);
\set U_ADMIN '''00000000-0000-4000-a000-000000000001'''
\set U_HASAN '''00000000-0000-4000-a000-000000000050'''

create temp table k as select (select count(*) from public.specialties) sp, (select count(*) from public.cities) ci,
                              (select count(*) from public.lab_test_master) lm, (select count(*) from public.medication_catalog) mc;

select tests.login(:U_HASAN);
select throws_ok($q$ select public.admin_reset_platform('احذف كل البيانات التجريبية') $q$, 'P0001', 'app:forbidden', 'a patient cannot reset the platform');

select tests.login(:U_ADMIN, 'admin@demo.test', 'aal2');
select ok((public.admin_reset_preview() -> 'counts' ->> 'patients')::int > 0, 'the preview counts the demo patients');
select throws_ok($q$ select public.admin_reset_platform('نعم') $q$, 'P0001', 'app:confirm_phrase', 'the exact phrase is required');
select is((public.admin_reset_platform('احذف كل البيانات التجريبية') ->> 'ok')::boolean, true, 'the reset runs');
reset role;

select is((select count(*)::int from public.organizations), 0, 'no organizations left');
select is((select count(*)::int from public.patients), 0, 'no patients left');
select is((select count(*)::int from public.appointments) + (select count(*)::int from public.encounters) + (select count(*)::int from public.prescriptions), 0,
          'no bookings, visits or prescriptions left');
select is((select count(*)::int from auth.users), (select count(*)::int from public.platform_admins), 'only the platform admin accounts remain');
select ok(exists (select 1 from auth.users where id = :U_ADMIN), 'the admin account itself is kept');
select ok((select (select count(*) from public.specialties) = sp and (select count(*) from public.cities) = ci
                  and (select count(*) from public.lab_test_master) = lm and (select count(*) from public.medication_catalog) = mc from k),
          'the shared catalogs are kept');
select ok(exists (select 1 from public.access_audit where action = 'platform.reset'), 'the reset is audited');

select tests.login(:U_ADMIN, 'admin@demo.test', 'aal2');
select isnt(public.admin_lock_reset(), null, 'the admin locks the reset once real data is in');
select throws_ok($q$ select public.admin_reset_platform('احذف كل البيانات التجريبية') $q$, 'P0001', 'app:reset_locked', 'after the lock it can never run again');

select * from finish();
rollback;
