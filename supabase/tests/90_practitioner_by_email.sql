-- Platform admin creates a doctor's professional identity by account email.
begin;
select plan(6);
\set ADMIN '\'00000000-0000-4000-a000-000000000001\''
\set MONA  '\'00000000-0000-4000-a000-000000000051\''

select tests.login(:ADMIN, 'admin@demo.test', 'aal2');
select lives_ok($$ select public.admin_upsert_practitioner_by_email('MONA@demo.test', 'د. منى (اختبار)', null, 'أخصائية', 'L-1', null, true) $$,
                'admin creates a practitioner profile by email (case-insensitive)');
select is((select full_name from public.practitioner_profiles where user_id = :MONA), 'د. منى (اختبار)', 'profile linked to that account');
select ok((select license_verified_at is not null from public.practitioner_profiles where user_id = :MONA), 'licence marked verified');
select throws_ok($$ select public.admin_upsert_practitioner_by_email('nobody@demo.test', 'x') $$, 'P0001', 'app:account_not_found',
                 'unknown email is refused');

select tests.login(:MONA, 'mona@demo.test');
select throws_ok($$ select public.admin_upsert_practitioner_by_email('mona@demo.test', 'self promotion') $$, 'P0001', 'app:forbidden',
                 'non-admin cannot create practitioner identities');
select tests.logout();
select ok(not has_function_privilege('anon', 'public.admin_upsert_practitioner_by_email(text, text, uuid, text, text, text, boolean)', 'execute'),
          'anon cannot execute');
select * from finish();
rollback;
