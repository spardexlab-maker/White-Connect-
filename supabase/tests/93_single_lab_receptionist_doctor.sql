-- One-person lab can release; a receptionist works for one doctor; invitations can name the doctor.
begin;
select plan(7);
\set ADMIN '\'00000000-0000-4000-a000-000000000001\''
\set M_RECA '\'00000000-0000-4000-8000-000000000020\''
\set AHMED '\'00000000-0000-4000-9000-000000000010\''
\set SARA '\'00000000-0000-4000-9000-000000000011\''
\set ORG_A '\'00000000-0000-4000-e000-000000000001\''
\set A1 '\'00000000-0000-4000-f000-0000000000a1\''
\set A2 '\'00000000-0000-4000-f000-0000000000a2\''
\set MONA '\'00000000-0000-4000-a000-000000000051\''

select tests.login(:ADMIN, 'admin@demo.test', 'aal2');
select lives_ok(format('select public.set_reception_scope(%L, %L, true)', :M_RECA, :SARA), 'assigning a doctor works');
select is((select array_agg(practitioner_id) from public.reception_scopes where membership_id = :M_RECA), array[:SARA]::uuid[],
          'assigning a doctor replaces the previous one (one doctor per receptionist)');
create temp table tok on commit drop as
  select token from public.create_invitation('new.rec@demo.test', :ORG_A, :A1, 'receptionist', 72, :AHMED);
select is((select count(*)::int from tok), 1, 'receptionist invitation names the doctor');
select throws_ok(format($q$select public.create_invitation('x@demo.test', %L, %L, 'pharmacist', 72, %L)$q$, :ORG_A, :A2, :AHMED),
                 'P0001', 'app:invalid_input', 'only receptionist invitations carry a doctor');

-- acceptance applies the doctor
select tests.logout();
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-a000-0000000000e1', 'authenticated', 'authenticated', 'new.rec@demo.test', '', now(), '{}', '{}', now(), now());
select tests.login('00000000-0000-4000-a000-0000000000e1', 'new.rec@demo.test');
select public.accept_invitation((select token from tok));
select tests.logout();
select is((select array_agg(rs.practitioner_id) from public.reception_scopes rs join public.memberships m on m.id = rs.membership_id
            where m.user_id = '00000000-0000-4000-a000-0000000000e1'), array[:AHMED]::uuid[], 'accepting the invitation links the receptionist to that doctor');

-- one-person lab
select tests.login('00000000-0000-4000-a000-000000000040', 'lab.a@demo.test');
select ok(private.has_facility_role('00000000-0000-4000-f000-0000000000a3', array['lab_technician']::public.member_role[]), 'lab staff member is a technician');
select ok((select pg_get_functiondef('public.release_lab_results(uuid, uuid[])'::regprocedure) like '%lab_technician%'), 'technicians may release results');
select * from finish();
rollback;
