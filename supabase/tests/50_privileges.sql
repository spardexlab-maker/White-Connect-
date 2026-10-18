-- Privilege hygiene: no write/TRUNCATE rights beyond the intended set,
-- column-level updates stay column-level (cloud defaults are wider).
begin;
select plan(7);
select is((select count(*)::int from information_schema.role_table_grants
            where table_schema = 'public' and grantee in ('anon', 'authenticated')
              and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES')), 0, 'no TRUNCATE/TRIGGER/REFERENCES for API roles');
select is((select count(*)::int from information_schema.role_table_grants
            where table_schema = 'public' and grantee = 'anon' and privilege_type <> 'SELECT'), 0, 'anon cannot write any table');
select ok(not has_table_privilege('anon', 'public.patients', 'select'), 'anon has no privilege on patients');
select ok(not has_table_privilege('authenticated', 'public.facilities', 'update'), 'no table-level UPDATE on facilities');
select ok(not has_column_privilege('authenticated', 'public.facilities', 'status', 'update'), 'facility status is not directly updatable');
select ok(has_column_privilege('authenticated', 'public.facilities', 'phone', 'update'), 'intended column update remains');
select ok(not has_column_privilege('authenticated', 'public.patient_qr_tokens', 'token', 'select'), 'raw QR token column is not readable by table access');
select * from finish();
rollback;
