-- =====================================================================
-- SYNTHETIC DEVELOPMENT DATA ONLY — never run against production.
-- Every name, phone and coordinate here is invented. Demo accounts share
-- the password  Demo-Pass-2026!  (local development only).
--
-- Contents (spec §20): two medical complexes, a doctor working at two
-- locations, two receptionists, two pharmacies, two laboratories,
-- patients with and without accounts (incl. same-name and shared-phone
-- cases), platform admin.
-- =====================================================================

-- Dev convenience: admin MFA not enforced locally (production default = true).
update public.platform_settings set require_admin_mfa = false;

-- ---------------------------------------------------------------------
-- Auth users
-- ---------------------------------------------------------------------
create or replace function pg_temp.mk_user(p_id uuid, p_email text, p_name text)
returns void language plpgsql as $$
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
          extensions.crypt('Demo-Pass-2026!', extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}', jsonb_build_object('display_name', p_name),
          now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), p_id, p_id::text, jsonb_build_object('sub', p_id::text, 'email', p_email),
          'email', now(), now(), now());
end $$;

select pg_temp.mk_user('00000000-0000-4000-a000-000000000001', 'admin@demo.test',        'مشرف المنصة');
select pg_temp.mk_user('00000000-0000-4000-a000-000000000002', 'orgadmin.a@demo.test',   'مدير مجمع الرافدين');
select pg_temp.mk_user('00000000-0000-4000-a000-000000000010', 'dr.ahmed@demo.test',     'د. أحمد');
select pg_temp.mk_user('00000000-0000-4000-a000-000000000011', 'dr.sara@demo.test',      'د. سارة');
select pg_temp.mk_user('00000000-0000-4000-a000-000000000012', 'dr.layla@demo.test',     'د. ليلى');
select pg_temp.mk_user('00000000-0000-4000-a000-000000000020', 'reception.a@demo.test',  'سكرتير الرافدين');
select pg_temp.mk_user('00000000-0000-4000-a000-000000000021', 'reception.b@demo.test',  'سكرتير دجلة');
select pg_temp.mk_user('00000000-0000-4000-a000-000000000030', 'pharm.a@demo.test',      'صيدلاني الرافدين');
select pg_temp.mk_user('00000000-0000-4000-a000-000000000031', 'pharm.b@demo.test',      'صيدلاني دجلة');
select pg_temp.mk_user('00000000-0000-4000-a000-000000000040', 'lab.a@demo.test',        'فني مختبر الرافدين');
select pg_temp.mk_user('00000000-0000-4000-a000-000000000041', 'labapprover.a@demo.test','معتمد مختبر الرافدين');
select pg_temp.mk_user('00000000-0000-4000-a000-000000000042', 'lab.b@demo.test',        'فني مختبر دجلة');
select pg_temp.mk_user('00000000-0000-4000-a000-000000000050', 'hasan@demo.test',        'حسن');
select pg_temp.mk_user('00000000-0000-4000-a000-000000000051', 'mona@demo.test',         'منى');

insert into public.platform_admins (user_id) values ('00000000-0000-4000-a000-000000000001');

-- ---------------------------------------------------------------------
-- Catalogs
-- ---------------------------------------------------------------------
insert into public.cities (id, name_ar, name_en) values
  ('00000000-0000-4000-c000-000000000001', 'بغداد', 'Baghdad'),
  ('00000000-0000-4000-c000-000000000002', 'البصرة', 'Basra'),
  ('00000000-0000-4000-c000-000000000003', 'أربيل', 'Erbil');

insert into public.specialties (id, code, name_ar, name_en, sort_order) values
  ('00000000-0000-4000-d000-000000000001', 'internal', 'باطنية', 'Internal medicine', 1),
  ('00000000-0000-4000-d000-000000000002', 'pediatrics', 'أطفال', 'Pediatrics', 2),
  ('00000000-0000-4000-d000-000000000003', 'dermatology', 'جلدية', 'Dermatology', 3),
  ('00000000-0000-4000-d000-000000000004', 'cardiology', 'قلبية', 'Cardiology', 4),
  ('00000000-0000-4000-d000-000000000005', 'ent', 'أنف وأذن وحنجرة', 'ENT', 5),
  ('00000000-0000-4000-d000-000000000006', 'dentistry', 'أسنان', 'Dentistry', 6);

-- ---------------------------------------------------------------------
-- Organizations / branches / facilities  (fictional complexes)
-- ---------------------------------------------------------------------
insert into public.organizations (id, name, status, verified_at) values
  ('00000000-0000-4000-e000-000000000001', 'مجمع الرافدين الطبي (تجريبي)', 'active', now()),
  ('00000000-0000-4000-e000-000000000002', 'مجمع دجلة الطبي (تجريبي)', 'active', now());

insert into public.branches (id, organization_id, name, city_id, area, address, latitude, longitude) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-e000-000000000001', 'فرع الكرادة',
   '00000000-0000-4000-c000-000000000001', 'الكرادة', 'شارع تجريبي 12، الكرادة', 33.3015, 44.4210),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-e000-000000000002', 'فرع المنصور',
   '00000000-0000-4000-c000-000000000001', 'المنصور', 'شارع تجريبي 40، المنصور', 33.3240, 44.3460);

insert into public.facilities (id, organization_id, branch_id, type, name, description, phone, status, opening_hours_note) values
  ('00000000-0000-4000-f000-0000000000a2', '00000000-0000-4000-e000-000000000001', '00000000-0000-4000-b000-000000000001',
   'pharmacy', 'صيدلية الرافدين', 'صيدلية المجمع', '07700000101', 'active', 'يومياً 9 ص – 11 م'),
  ('00000000-0000-4000-f000-0000000000a3', '00000000-0000-4000-e000-000000000001', '00000000-0000-4000-b000-000000000001',
   'laboratory', 'مختبر الرافدين', 'تحاليل عامة وهرمونات', '07700000102', 'active', 'السبت – الخميس 8 ص – 8 م'),
  ('00000000-0000-4000-f000-0000000000b2', '00000000-0000-4000-e000-000000000002', '00000000-0000-4000-b000-000000000002',
   'pharmacy', 'صيدلية دجلة', 'صيدلية المجمع', '07700000201', 'active', 'يومياً 9 ص – 10 م'),
  ('00000000-0000-4000-f000-0000000000b3', '00000000-0000-4000-e000-000000000002', '00000000-0000-4000-b000-000000000002',
   'laboratory', 'مختبر دجلة', 'تحاليل عامة', '07700000202', 'active', 'السبت – الخميس 8 ص – 6 م');

insert into public.facilities (id, organization_id, branch_id, type, name, description, phone, status,
                               default_pharmacy_id, default_lab_id, opening_hours_note) values
  ('00000000-0000-4000-f000-0000000000a1', '00000000-0000-4000-e000-000000000001', '00000000-0000-4000-b000-000000000001',
   'clinic', 'عيادات الرافدين', 'عيادات استشارية', '07700000100', 'active',
   '00000000-0000-4000-f000-0000000000a2', '00000000-0000-4000-f000-0000000000a3', 'السبت – الخميس 4 م – 9 م'),
  ('00000000-0000-4000-f000-0000000000b1', '00000000-0000-4000-e000-000000000002', '00000000-0000-4000-b000-000000000002',
   'clinic', 'عيادات دجلة', 'عيادات استشارية', '07700000200', 'active',
   '00000000-0000-4000-f000-0000000000b2', '00000000-0000-4000-f000-0000000000b3', 'السبت – الخميس 9 ص – 1 م');

-- ---------------------------------------------------------------------
-- Practitioners (one identity, Dr. Ahmed works at BOTH complexes)
-- ---------------------------------------------------------------------
insert into public.practitioner_profiles (id, user_id, full_name, title, specialty_id, bio, license_number, license_verified_at) values
  ('00000000-0000-4000-9000-000000000010', '00000000-0000-4000-a000-000000000010', 'د. أحمد سالم (تجريبي)', 'استشاري باطنية',
   '00000000-0000-4000-d000-000000000001', 'ملف تجريبي لأغراض التطوير.', 'DEMO-1001', now()),
  ('00000000-0000-4000-9000-000000000011', '00000000-0000-4000-a000-000000000011', 'د. سارة ناجي (تجريبي)', 'أخصائية أطفال',
   '00000000-0000-4000-d000-000000000002', 'ملف تجريبي لأغراض التطوير.', 'DEMO-1002', now()),
  ('00000000-0000-4000-9000-000000000012', '00000000-0000-4000-a000-000000000012', 'د. ليلى عباس (تجريبي)', 'أخصائية جلدية',
   '00000000-0000-4000-d000-000000000003', 'ملف تجريبي لأغراض التطوير.', 'DEMO-1003', null);

-- ---------------------------------------------------------------------
-- Memberships
-- ---------------------------------------------------------------------
insert into public.memberships (id, user_id, organization_id, facility_id, role) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-a000-000000000002', '00000000-0000-4000-e000-000000000001', null, 'organization_admin'),
  ('00000000-0000-4000-8000-000000000010', '00000000-0000-4000-a000-000000000010', '00000000-0000-4000-e000-000000000001', '00000000-0000-4000-f000-0000000000a1', 'doctor'),
  ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-a000-000000000010', '00000000-0000-4000-e000-000000000002', '00000000-0000-4000-f000-0000000000b1', 'doctor'),
  ('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-a000-000000000011', '00000000-0000-4000-e000-000000000001', '00000000-0000-4000-f000-0000000000a1', 'doctor'),
  ('00000000-0000-4000-8000-000000000013', '00000000-0000-4000-a000-000000000012', '00000000-0000-4000-e000-000000000002', '00000000-0000-4000-f000-0000000000b1', 'doctor'),
  -- Dr. Ahmed is also administrator of the Rafidain clinic (separate role)
  ('00000000-0000-4000-8000-000000000014', '00000000-0000-4000-a000-000000000010', '00000000-0000-4000-e000-000000000001', '00000000-0000-4000-f000-0000000000a1', 'facility_admin'),
  ('00000000-0000-4000-8000-000000000020', '00000000-0000-4000-a000-000000000020', '00000000-0000-4000-e000-000000000001', '00000000-0000-4000-f000-0000000000a1', 'receptionist'),
  ('00000000-0000-4000-8000-000000000021', '00000000-0000-4000-a000-000000000021', '00000000-0000-4000-e000-000000000002', '00000000-0000-4000-f000-0000000000b1', 'receptionist'),
  ('00000000-0000-4000-8000-000000000030', '00000000-0000-4000-a000-000000000030', '00000000-0000-4000-e000-000000000001', '00000000-0000-4000-f000-0000000000a2', 'pharmacist'),
  ('00000000-0000-4000-8000-000000000031', '00000000-0000-4000-a000-000000000031', '00000000-0000-4000-e000-000000000002', '00000000-0000-4000-f000-0000000000b2', 'pharmacist'),
  ('00000000-0000-4000-8000-000000000040', '00000000-0000-4000-a000-000000000040', '00000000-0000-4000-e000-000000000001', '00000000-0000-4000-f000-0000000000a3', 'lab_technician'),
  ('00000000-0000-4000-8000-000000000041', '00000000-0000-4000-a000-000000000041', '00000000-0000-4000-e000-000000000001', '00000000-0000-4000-f000-0000000000a3', 'lab_approver'),
  ('00000000-0000-4000-8000-000000000042', '00000000-0000-4000-a000-000000000042', '00000000-0000-4000-e000-000000000002', '00000000-0000-4000-f000-0000000000b3', 'lab_technician');

insert into public.reception_scopes (membership_id, practitioner_id) values
  ('00000000-0000-4000-8000-000000000020', '00000000-0000-4000-9000-000000000010'),
  ('00000000-0000-4000-8000-000000000020', '00000000-0000-4000-9000-000000000011'),
  ('00000000-0000-4000-8000-000000000021', '00000000-0000-4000-9000-000000000010'),
  ('00000000-0000-4000-8000-000000000021', '00000000-0000-4000-9000-000000000012');

-- ---------------------------------------------------------------------
-- Services, resources, policies, schedules
-- ---------------------------------------------------------------------
insert into public.facility_resources (id, facility_id, name, kind) values
  ('00000000-0000-4000-7000-0000000000a3', '00000000-0000-4000-f000-0000000000a3', 'محطة السحب 1', 'collection_station'),
  ('00000000-0000-4000-7000-0000000000b3', '00000000-0000-4000-f000-0000000000b3', 'محطة السحب 1', 'collection_station');

insert into public.clinic_services (id, facility_id, practitioner_id, name, duration_minutes, buffer_minutes, price_minor, resource_id, preparation_note) values
  ('00000000-0000-4000-6000-000000000001', '00000000-0000-4000-f000-0000000000a1', '00000000-0000-4000-9000-000000000010', 'استشارة باطنية', 30, 0, 25000, null, null),
  ('00000000-0000-4000-6000-000000000002', '00000000-0000-4000-f000-0000000000a1', '00000000-0000-4000-9000-000000000010', 'مراجعة', 15, 0, 10000, null, null),
  ('00000000-0000-4000-6000-000000000003', '00000000-0000-4000-f000-0000000000a1', '00000000-0000-4000-9000-000000000011', 'استشارة أطفال', 20, 5, 20000, null, null),
  ('00000000-0000-4000-6000-000000000004', '00000000-0000-4000-f000-0000000000b1', '00000000-0000-4000-9000-000000000010', 'استشارة باطنية', 30, 0, 30000, null, null),
  ('00000000-0000-4000-6000-000000000005', '00000000-0000-4000-f000-0000000000b1', '00000000-0000-4000-9000-000000000012', 'استشارة جلدية', 20, 0, 25000, null, null),
  ('00000000-0000-4000-6000-000000000006', '00000000-0000-4000-f000-0000000000a3', null, 'سحب عينة دم', 10, 0, 5000, '00000000-0000-4000-7000-0000000000a3', 'صيام 8 ساعات لبعض التحاليل حسب ما يحدده المختبر'),
  ('00000000-0000-4000-6000-000000000007', '00000000-0000-4000-f000-0000000000b3', null, 'سحب عينة دم', 10, 0, 5000, '00000000-0000-4000-7000-0000000000b3', null);

insert into public.booking_policies (facility_id, practitioner_id, confirmation_mode, confirmation_timeout_minutes,
  booking_window_days, min_notice_minutes, cancellation_cutoff_minutes, cancellation_policy_text) values
  ('00000000-0000-4000-f000-0000000000a1', null, 'manual', 120, 30, 30, 120, 'يمكن الإلغاء مجاناً قبل ساعتين من الموعد.'),
  ('00000000-0000-4000-f000-0000000000b1', null, 'manual', 60, 21, 60, 180, 'يرجى الإلغاء قبل 3 ساعات على الأقل.'),
  ('00000000-0000-4000-f000-0000000000a3', null, 'auto', 60, 14, 15, 60, null),
  ('00000000-0000-4000-f000-0000000000b3', null, 'auto', 60, 14, 15, 60, null);

-- Weekly templates (local Asia/Baghdad). Friday (5) off.
-- Dr. Ahmed: Rafidain evenings; Dijla mornings + Thursday evening, which
-- deliberately OVERLAPS Rafidain Thursday — the DB still prevents him
-- from being booked in both places at once.
insert into public.schedules (facility_id, practitioner_id, weekday, start_local, end_local, valid_from)
select '00000000-0000-4000-f000-0000000000a1'::uuid, '00000000-0000-4000-9000-000000000010'::uuid, d, '16:00'::time, '21:00'::time, current_date - 30
  from unnest(array[0,1,2,3,4,6]) d
union all
select '00000000-0000-4000-f000-0000000000b1', '00000000-0000-4000-9000-000000000010', d, '09:00', '13:00', current_date - 30
  from unnest(array[0,1,2,3,4,6]) d
union all
select '00000000-0000-4000-f000-0000000000b1', '00000000-0000-4000-9000-000000000010', 4, '16:00', '20:00', current_date - 30
union all
select '00000000-0000-4000-f000-0000000000a1', '00000000-0000-4000-9000-000000000011', d, '15:00', '20:00', current_date - 30
  from unnest(array[0,1,2,3,6]) d
union all
select '00000000-0000-4000-f000-0000000000b1', '00000000-0000-4000-9000-000000000012', d, '10:00', '14:00', current_date - 30
  from unnest(array[0,2,4,6]) d
union all
select '00000000-0000-4000-f000-0000000000a3', null, d, '08:00', '20:00', current_date - 30
  from unnest(array[0,1,2,3,4,6]) d
union all
select '00000000-0000-4000-f000-0000000000b3', null, d, '08:00', '18:00', current_date - 30
  from unnest(array[0,1,2,3,4,6]) d;

-- ---------------------------------------------------------------------
-- Patients
-- ---------------------------------------------------------------------
-- with accounts (self-registered)
insert into public.patients (id, public_code, full_name, sex, birth_date, birth_year, phone, city_id, created_by) values
  ('00000000-0000-4000-5000-000000000050', 'PDEMO00050', 'حسن علي (تجريبي)', 'male', '1990-04-12', 1990, '07801110001',
   '00000000-0000-4000-c000-000000000001', '00000000-0000-4000-a000-000000000050'),
  ('00000000-0000-4000-5000-000000000051', 'PDEMO00051', 'منى جاسم (تجريبي)', 'female', '1987-09-02', 1987, '07801110002',
   '00000000-0000-4000-c000-000000000001', '00000000-0000-4000-a000-000000000051'),
  -- Mona's child (dependant, guardian link)
  ('00000000-0000-4000-5000-000000000052', 'PDEMO00052', 'يوسف (تجريبي)', 'male', '2019-01-20', 2019, null,
   '00000000-0000-4000-c000-000000000001', '00000000-0000-4000-a000-000000000051');
insert into public.patient_account_links (patient_id, user_id, relationship, verified_at, verified_method) values
  ('00000000-0000-4000-5000-000000000050', '00000000-0000-4000-a000-000000000050', 'self', now(), 'self_registration'),
  ('00000000-0000-4000-5000-000000000051', '00000000-0000-4000-a000-000000000051', 'self', now(), 'self_registration'),
  ('00000000-0000-4000-5000-000000000052', '00000000-0000-4000-a000-000000000051', 'guardian', now(), 'admin');

-- without accounts (provisional, created at reception). Two people share
-- the SAME NAME; two others share ONE PHONE — none are merged.
insert into public.patients (id, public_code, full_name, phone, sex, birth_year, is_provisional, created_by, created_at_facility_id) values
  ('00000000-0000-4000-5000-000000000060', 'PDEMO00060', 'علي حسين (تجريبي)', null, 'male', 1975, true,
   '00000000-0000-4000-a000-000000000020', '00000000-0000-4000-f000-0000000000a1'),
  ('00000000-0000-4000-5000-000000000061', 'PDEMO00061', 'علي حسين (تجريبي)', '07801119999', 'male', 1998, true,
   '00000000-0000-4000-a000-000000000020', '00000000-0000-4000-f000-0000000000a1'),
  ('00000000-0000-4000-5000-000000000062', 'PDEMO00062', 'زينب كريم (تجريبي)', '07801115555', 'female', 1980, true,
   '00000000-0000-4000-a000-000000000021', '00000000-0000-4000-f000-0000000000b1'),
  ('00000000-0000-4000-5000-000000000063', 'PDEMO00063', 'فاطمة كريم (تجريبي)', '07801115555', 'female', 2004, true,
   '00000000-0000-4000-a000-000000000021', '00000000-0000-4000-f000-0000000000b1'),
  ('00000000-0000-4000-5000-000000000064', 'PDEMO00064', 'سلمى رعد (تجريبي)', null, 'female', null, true,
   '00000000-0000-4000-a000-000000000020', '00000000-0000-4000-f000-0000000000a1');
insert into public.care_relationships (patient_id, facility_id, source, created_by) values
  ('00000000-0000-4000-5000-000000000060', '00000000-0000-4000-f000-0000000000a1', 'registration', '00000000-0000-4000-a000-000000000020'),
  ('00000000-0000-4000-5000-000000000061', '00000000-0000-4000-f000-0000000000a1', 'registration', '00000000-0000-4000-a000-000000000020'),
  ('00000000-0000-4000-5000-000000000062', '00000000-0000-4000-f000-0000000000b1', 'registration', '00000000-0000-4000-a000-000000000021'),
  ('00000000-0000-4000-5000-000000000063', '00000000-0000-4000-f000-0000000000b1', 'registration', '00000000-0000-4000-a000-000000000021');

-- ---------------------------------------------------------------------
-- Sample activity relative to "today" (Asia/Baghdad) so boards are not
-- empty in development. Inserted directly (seed runs as postgres); the
-- overlap constraint still applies to these rows.
-- ---------------------------------------------------------------------
create or replace function pg_temp.local_ts(p_days int, p_time time)
returns timestamptz language sql stable as $$
  select (((now() at time zone 'Asia/Baghdad')::date + p_days) + p_time)::timestamp at time zone 'Asia/Baghdad'
$$;

insert into public.appointments (id, patient_id, facility_id, practitioner_id, service_id, status, period, blocked_period,
  duration_minutes, buffer_minutes, price_minor, timezone, source, created_by, confirmed_by, confirmed_at,
  confirmation_deadline, cancellation_cutoff_minutes, idempotency_key)
select v.id::uuid, v.patient::uuid, '00000000-0000-4000-f000-0000000000a1', '00000000-0000-4000-9000-000000000010',
       v.svc::uuid, v.status::public.appointment_status,
       tstzrange(pg_temp.local_ts(v.d, v.t::time), pg_temp.local_ts(v.d, v.t::time) + make_interval(mins => v.dur), '[)'),
       tstzrange(pg_temp.local_ts(v.d, v.t::time), pg_temp.local_ts(v.d, v.t::time) + make_interval(mins => v.dur), '[)'),
       v.dur, 0, v.price, 'Asia/Baghdad', v.src::public.booking_source, v.creator::uuid,
       case when v.status <> 'awaiting_confirmation' then '00000000-0000-4000-a000-000000000020'::uuid end,
       case when v.status <> 'awaiting_confirmation' then now() end,
       case when v.status = 'awaiting_confirmation' then greatest(now() + interval '90 minutes', pg_temp.local_ts(v.d, v.t::time) - interval '1 minute') end,
       120, 'seed-' || v.id
  from (values
    ('00000000-0000-4000-4000-000000000001', '00000000-0000-4000-5000-000000000060', '00000000-0000-4000-6000-000000000001', 'checked_in', 0, '16:00', 30, 25000, 'reception', '00000000-0000-4000-a000-000000000020'),
    ('00000000-0000-4000-4000-000000000002', '00000000-0000-4000-5000-000000000061', '00000000-0000-4000-6000-000000000002', 'confirmed', 0, '16:30', 15, 10000, 'reception', '00000000-0000-4000-a000-000000000020'),
    ('00000000-0000-4000-4000-000000000003', '00000000-0000-4000-5000-000000000051', '00000000-0000-4000-6000-000000000001', 'confirmed', 0, '17:00', 30, 25000, 'app', '00000000-0000-4000-a000-000000000051'),
    ('00000000-0000-4000-4000-000000000004', '00000000-0000-4000-5000-000000000050', '00000000-0000-4000-6000-000000000001', 'awaiting_confirmation', 0, '18:00', 30, 25000, 'app', '00000000-0000-4000-a000-000000000050'),
    ('00000000-0000-4000-4000-000000000005', '00000000-0000-4000-5000-000000000050', '00000000-0000-4000-6000-000000000001', 'awaiting_confirmation', 1, '17:30', 30, 25000, 'app', '00000000-0000-4000-a000-000000000050')
  ) as v(id, patient, svc, status, d, t, dur, price, src, creator);

insert into public.appointment_events (appointment_id, to_status, actor_user_id, reason)
select id, status, created_by, source::text from public.appointments where idempotency_key like 'seed-%';

insert into public.care_relationships (patient_id, facility_id, practitioner_id, source)
select distinct patient_id, facility_id, practitioner_id, 'appointment' from public.appointments where idempotency_key like 'seed-%'
on conflict do nothing;

insert into public.queue_entries (facility_id, practitioner_id, patient_id, appointment_id, kind, status, service_date, arrived_at, created_by)
values ('00000000-0000-4000-f000-0000000000a1', '00000000-0000-4000-9000-000000000010', '00000000-0000-4000-5000-000000000060',
        '00000000-0000-4000-4000-000000000001', 'appointment', 'waiting', (now() at time zone 'Asia/Baghdad')::date,
        pg_temp.local_ts(0, '15:50'), '00000000-0000-4000-a000-000000000020'),
       ('00000000-0000-4000-f000-0000000000a1', '00000000-0000-4000-9000-000000000010', '00000000-0000-4000-5000-000000000064',
        null, 'walk_in', 'waiting', (now() at time zone 'Asia/Baghdad')::date,
        pg_temp.local_ts(0, '16:10'), '00000000-0000-4000-a000-000000000020');
insert into public.care_relationships (patient_id, facility_id, practitioner_id, source)
values ('00000000-0000-4000-5000-000000000064', '00000000-0000-4000-f000-0000000000a1', '00000000-0000-4000-9000-000000000010', 'walk_in')
on conflict do nothing;
