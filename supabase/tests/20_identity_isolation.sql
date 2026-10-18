-- Acceptance §18-d (name-only booking, duplicates, shared phones, linking)
-- and §18-e/§18-f (tenant isolation, no implicit admin access).
begin;
select plan(30);

\set A1 '''00000000-0000-4000-f000-0000000000a1'''
\set B1 '''00000000-0000-4000-f000-0000000000b1'''
\set AHMED '''00000000-0000-4000-9000-000000000010'''
\set LAYLA '''00000000-0000-4000-9000-000000000012'''
\set SVC_A30 '''00000000-0000-4000-6000-000000000001'''
\set SVC_LAYLA '''00000000-0000-4000-6000-000000000005'''
\set U_ADMIN '''00000000-0000-4000-a000-000000000001'''
\set U_HASAN '''00000000-0000-4000-a000-000000000050'''
\set U_MONA '''00000000-0000-4000-a000-000000000051'''
\set U_RECA '''00000000-0000-4000-a000-000000000020'''
\set U_RECB '''00000000-0000-4000-a000-000000000021'''
\set U_PHARMA '''00000000-0000-4000-a000-000000000030'''
\set U_DRAHMED '''00000000-0000-4000-a000-000000000010'''
\set P_HASAN '''00000000-0000-4000-5000-000000000050'''
\set P_MONA '''00000000-0000-4000-5000-000000000051'''
\set P_YUSUF '''00000000-0000-4000-5000-000000000052'''
\set P_ZAINAB '''00000000-0000-4000-5000-000000000062'''

select tests.open_all_week(:A1, :AHMED);
select tests.open_all_week(:B1, :LAYLA);
create temp table t_ids (name text primary key, id uuid, extra text);
grant all on t_ids to authenticated, anon;

-- ---------------------------------------------------------------------
-- §18-d: name-only booking at reception (no phone, account, OTP)
-- ---------------------------------------------------------------------
select tests.login(:U_RECA);
insert into t_ids (name, id)
select 'noname1', (r ->> 'patient_id')::uuid from (
  select public.reception_quick_book(:A1, :AHMED, 'idem-nameonly-1', p_new_patient_name => 'كريم مجيد',
                                     p_service_id => :SVC_A30, p_start => tests.at(3, '17:00')) r) x;
select tests.logout();
select is((select phone from public.patients where id = (select id from t_ids where name = 'noname1')), null,
          'name-only patient has no phone');
select ok((select is_provisional from public.patients where id = (select id from t_ids where name = 'noname1')),
          'name-only patient is a provisional record');
select is((select count(*)::int from public.appointments where patient_id = (select id from t_ids where name = 'noname1')
             and status = 'confirmed'), 1, 'reception booking for name-only patient is confirmed');
select is((select count(*)::int from public.notification_outbox o
            where o.payload ->> 'appointment_id' in (select a.id::text from public.appointments a
                                                     where a.patient_id = (select id from t_ids where name = 'noname1'))),
          0, 'no notification is queued for a patient without an account');

-- same name again → a SEPARATE record (no automatic reuse)
select tests.login(:U_RECA);
insert into t_ids (name, id)
select 'noname2', (r ->> 'patient_id')::uuid from (
  select public.reception_quick_book(:A1, :AHMED, 'idem-nameonly-2', p_new_patient_name => 'كريم مجيد') r) x;
select isnt((select id from t_ids where name = 'noname2'), (select id from t_ids where name = 'noname1'),
            'two people with the same name get two separate records');

-- empty name is rejected
select throws_ok($$ select public.create_provisional_patient('00000000-0000-4000-f000-0000000000a1', '   ') $$,
                 'P0001', 'app:name_required', 'name is the only mandatory field and it is enforced');

-- shared phone → two candidates, never auto-merged
select tests.login(:U_RECB);
select is((select count(*)::int from public.lookup_patients(:B1, '07801115555')), 2,
          'lookup by a shared phone returns both candidates for explicit choice');
select is((select count(distinct patient_id)::int from public.lookup_patients(:B1, '07801115555')), 2,
          'shared-phone records remain distinct');
select ok((select bool_and(phone_masked like '%555' and phone_masked not like '0780%')
             from public.lookup_patients(:B1, '07801115555')), 'lookup masks phone numbers');

-- name search is limited to patients known at the searching facility
select is((select count(*)::int from public.lookup_patients(:B1, 'كريم مجيد')), 0,
          'name search does not reveal patients of another facility');

-- patient with an account DOES get notifications
select tests.login(:U_HASAN);
insert into t_ids (name, id) select 'hasan_appt',
  (public.book_appointment(:P_HASAN, :A1, :AHMED, :SVC_A30, tests.at(3, '19:00'), 'idem-hasan-notify')).id;
select tests.logout();
select ok((select count(*) from public.notification_outbox where recipient_user_id = :U_HASAN
            and payload ->> 'appointment_id' = (select id::text from t_ids where name = 'hasan_appt')) >= 1,
          'booking for a patient with an account enqueues an outbox notification');

-- ---------------------------------------------------------------------
-- Linking a provisional record after in-person verification (§4)
-- ---------------------------------------------------------------------
select tests.login(:U_HASAN);
insert into t_ids (name, extra) select 'code', public.create_account_link_code();
select tests.login(:U_RECA);
select throws_ok(
  format('select public.link_patient_with_code(%L, %L, %L, %L)', :A1, (select id from t_ids where name = 'noname1'), 'WRONG123', 'ID card checked'),
  'P0001', 'app:invalid_or_expired_code', 'a wrong link code is rejected');
select is(public.link_patient_with_code(:A1, (select id from t_ids where name = 'noname1'),
                                        (select extra from t_ids where name = 'code'), 'ID card checked in person'),
          :P_HASAN::uuid, 'provisional record is merged into the verified account record');
select tests.logout();
select is((select status::text from public.patients where id = (select id from t_ids where name = 'noname1')), 'merged',
          'source record is kept as merged (traceable)');
select is((select count(*)::int from public.appointments where patient_id = (select id from t_ids where name = 'noname1')), 0,
          'history is re-pointed: no appointments left on the merged record');
select is((select count(*)::int from public.appointments where patient_id = :P_HASAN and lower(period) = tests.at(3, '17:00')), 1,
          'the provisional appointment now belongs to the verified record');
select ok(exists (select 1 from public.access_audit where action = 'patient.merged' and patient_id = :P_HASAN),
          'merge is audited');

-- ---------------------------------------------------------------------
-- §18-e isolation
-- ---------------------------------------------------------------------
select tests.login(:U_HASAN);
select is((select count(*)::int from public.patients where id = :P_MONA), 0,
          'a patient cannot read another patient record by id (URL tampering)');
select is((select count(*)::int from public.appointments where patient_id <> :P_HASAN), 0,
          'a patient only sees own appointments');
select throws_ok(format('select public.rotate_patient_qr(%L)', :P_MONA), 'P0001', 'app:forbidden',
                 'a patient cannot rotate someone else''s QR');

select tests.login(:U_MONA);
select is((select count(*)::int from public.patients), 2, 'guardian sees own record and the dependant only');
select ok(public.rotate_patient_qr(:P_YUSUF) like 'qr_%', 'guardian can manage the dependant''s QR');

-- reception A (complex A) cannot see complex B patients or bookings
select tests.login(:U_RECA);
select is((select count(*)::int from public.patients where id = :P_ZAINAB), 0,
          'facility A staff cannot read facility B patient');
select throws_ok(format('select * from public.facility_day_board(%L, current_date)', :B1), 'P0001', 'app:forbidden',
                 'facility A staff cannot open facility B day board');

-- pharmacist sees no appointments; platform admin gets no medical access
select tests.login(:U_PHARMA);
select is((select count(*)::int from public.appointments), 0, 'pharmacy staff cannot list clinic appointments');
select tests.login(:U_ADMIN);
select is((select count(*)::int from public.patients), 0, 'platform admin has no implicit access to patient records');
select ok((public.platform_overview() ->> 'active_memberships')::int > 0, 'platform admin sees operational counts only');

-- non-admins cannot use admin RPCs
select tests.login(:U_HASAN);
select throws_ok($$ select public.admin_create_organization('X') $$, 'P0001', 'app:forbidden',
                 'patients cannot create organizations');

-- anonymous visitors cannot read patients at all
select tests.as_anon();
select throws_ok($$ select count(*) from public.patients $$, '42501', null, 'anon has no privilege on patients');

-- suspending a membership removes access immediately
select tests.login(:U_ADMIN);
select public.set_membership_status('00000000-0000-4000-8000-000000000020', 'suspended', 'left the clinic (test)');
select tests.login(:U_RECA);
select throws_ok(
  format('select public.book_appointment(%L, %L, %L, %L, %L, %L, ''reception'')',
         :P_HASAN, :A1, :AHMED, :SVC_A30, tests.at(4, '17:00'), 'idem-suspended'),
  'P0001', 'app:forbidden', 'suspended receptionist loses access at once');

select * from finish();
rollback;
