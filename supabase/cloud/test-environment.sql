-- =====================================================================
-- Cloud TEST environment (synthetic, clearly labelled "(اختبار)").
-- One test complex with every role so the owner can try the full flow.
-- All ids start with 7e57 so the set can be disabled/removed later
-- (see test-environment-disable.sql). The password placeholder
-- __TEST_PASSWORD__ is substituted at run time and never committed.
-- Idempotent: re-running does nothing for rows that already exist.
-- =====================================================================
create or replace function pg_temp.mk_test_user(p_id uuid, p_email text, p_name text, p_password text)
returns void language plpgsql as $$
begin
  if exists (select 1 from auth.users where id = p_id or lower(email) = lower(p_email)) then return; end if;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', lower(p_email),
          extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}', jsonb_build_object('display_name', p_name, 'test_account', true),
          now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), p_id, p_id::text, jsonb_build_object('sub', p_id::text, 'email', lower(p_email), 'email_verified', true),
          'email', now(), now(), now());
end $$;

select pg_temp.mk_test_user('7e570000-0000-4000-a000-000000000001', 'spardexlab+orgadmin@gmail.com',     'مدير المجمع (اختبار)',   '__TEST_PASSWORD__');
select pg_temp.mk_test_user('7e570000-0000-4000-a000-000000000010', 'spardexlab+doctor@gmail.com',       'د. باطنية (اختبار)',     '__TEST_PASSWORD__');
select pg_temp.mk_test_user('7e570000-0000-4000-a000-000000000011', 'spardexlab+doctor2@gmail.com',      'د. أطفال (اختبار)',      '__TEST_PASSWORD__');
select pg_temp.mk_test_user('7e570000-0000-4000-a000-000000000020', 'spardexlab+reception@gmail.com',    'سكرتير (اختبار)',        '__TEST_PASSWORD__');
select pg_temp.mk_test_user('7e570000-0000-4000-a000-000000000030', 'spardexlab+pharmacy@gmail.com',     'صيدلاني (اختبار)',       '__TEST_PASSWORD__');
select pg_temp.mk_test_user('7e570000-0000-4000-a000-000000000040', 'spardexlab+lab@gmail.com',          'فني مختبر (اختبار)',     '__TEST_PASSWORD__');
select pg_temp.mk_test_user('7e570000-0000-4000-a000-000000000021', 'spardexlab+reception2@gmail.com',   'سكرتير د. أطفال (اختبار)', '__TEST_PASSWORD__');
select pg_temp.mk_test_user('7e570000-0000-4000-a000-000000000050', 'spardexlab+patient@gmail.com',      'مريض (اختبار)',          '__TEST_PASSWORD__');

-- organisation / branch / facilities
insert into public.organizations (id, name, status, verified_at)
values ('7e570000-0000-4000-e000-000000000001', 'مجمع الاختبار الطبي (اختبار)', 'active', now())
on conflict (id) do nothing;

insert into public.branches (id, organization_id, name, city_id, area, address, latitude, longitude)
values ('7e570000-0000-4000-b000-000000000001', '7e570000-0000-4000-e000-000000000001', 'الفرع الرئيسي',
        (select id from public.cities where name_ar = 'بغداد' limit 1), 'الكرادة', 'عنوان تجريبي — للاختبار فقط', 33.3020, 44.4200)
on conflict (id) do nothing;

insert into public.facilities (id, organization_id, branch_id, type, name, description, phone, status, opening_hours_note) values
  ('7e570000-0000-4000-f000-000000000002', '7e570000-0000-4000-e000-000000000001', '7e570000-0000-4000-b000-000000000001',
   'pharmacy', 'صيدلية الاختبار', 'صيدلية تجريبية', '07700000901', 'active', 'يومياً'),
  ('7e570000-0000-4000-f000-000000000003', '7e570000-0000-4000-e000-000000000001', '7e570000-0000-4000-b000-000000000001',
   'laboratory', 'مختبر الاختبار', 'مختبر تجريبي', '07700000902', 'active', 'يومياً')
on conflict (id) do nothing;
insert into public.facilities (id, organization_id, branch_id, type, name, description, phone, status, default_pharmacy_id, default_lab_id, opening_hours_note)
values ('7e570000-0000-4000-f000-000000000001', '7e570000-0000-4000-e000-000000000001', '7e570000-0000-4000-b000-000000000001',
        'clinic', 'عيادات الاختبار', 'عيادات تجريبية للتجربة', '07700000900', 'active',
        '7e570000-0000-4000-f000-000000000002', '7e570000-0000-4000-f000-000000000003', 'يومياً 8 ص – 10 م (للاختبار)')
on conflict (id) do nothing;

-- doctors' professional identities
insert into public.practitioner_profiles (id, user_id, full_name, title, specialty_id, bio, license_number, license_verified_at) values
  ('7e570000-0000-4000-9000-000000000010', '7e570000-0000-4000-a000-000000000010', 'د. باطنية (اختبار)', 'أخصائي باطنية',
   (select id from public.specialties where name_ar = 'باطنية' limit 1), 'حساب تجريبي للاختبار فقط.', 'TEST-0001', now()),
  ('7e570000-0000-4000-9000-000000000011', '7e570000-0000-4000-a000-000000000011', 'د. أطفال (اختبار)', 'أخصائية أطفال',
   (select id from public.specialties where name_ar = 'أطفال' limit 1), 'حساب تجريبي للاختبار فقط.', 'TEST-0002', now())
on conflict (id) do nothing;

-- memberships
insert into public.memberships (id, user_id, organization_id, facility_id, role) values
  ('7e570000-0000-4000-8000-000000000001', '7e570000-0000-4000-a000-000000000001', '7e570000-0000-4000-e000-000000000001', null, 'organization_admin'),
  ('7e570000-0000-4000-8000-000000000010', '7e570000-0000-4000-a000-000000000010', '7e570000-0000-4000-e000-000000000001', '7e570000-0000-4000-f000-000000000001', 'doctor'),
  ('7e570000-0000-4000-8000-000000000011', '7e570000-0000-4000-a000-000000000011', '7e570000-0000-4000-e000-000000000001', '7e570000-0000-4000-f000-000000000001', 'doctor'),
  ('7e570000-0000-4000-8000-000000000020', '7e570000-0000-4000-a000-000000000020', '7e570000-0000-4000-e000-000000000001', '7e570000-0000-4000-f000-000000000001', 'receptionist'),
  ('7e570000-0000-4000-8000-000000000030', '7e570000-0000-4000-a000-000000000030', '7e570000-0000-4000-e000-000000000001', '7e570000-0000-4000-f000-000000000002', 'pharmacist'),
  ('7e570000-0000-4000-8000-000000000021', '7e570000-0000-4000-a000-000000000021', '7e570000-0000-4000-e000-000000000001', '7e570000-0000-4000-f000-000000000001', 'receptionist'),
  ('7e570000-0000-4000-8000-000000000040', '7e570000-0000-4000-a000-000000000040', '7e570000-0000-4000-e000-000000000001', '7e570000-0000-4000-f000-000000000003', 'lab_technician')
on conflict (id) do nothing;

-- one doctor per receptionist; the lab is run by one account (lab_technician)
insert into public.reception_scopes (membership_id, practitioner_id) values
  ('7e570000-0000-4000-8000-000000000020', '7e570000-0000-4000-9000-000000000010'),
  ('7e570000-0000-4000-8000-000000000021', '7e570000-0000-4000-9000-000000000011')
on conflict do nothing;

-- services, lab station, policies
insert into public.facility_resources (id, facility_id, name, kind)
values ('7e570000-0000-4000-7000-000000000003', '7e570000-0000-4000-f000-000000000003', 'محطة السحب 1', 'collection_station')
on conflict (id) do nothing;

insert into public.clinic_services (id, facility_id, practitioner_id, name, duration_minutes, buffer_minutes, price_minor, resource_id, preparation_note) values
  ('7e570000-0000-4000-6000-000000000001', '7e570000-0000-4000-f000-000000000001', '7e570000-0000-4000-9000-000000000010', 'استشارة باطنية', 30, 0, 25000, null, null),
  ('7e570000-0000-4000-6000-000000000002', '7e570000-0000-4000-f000-000000000001', '7e570000-0000-4000-9000-000000000010', 'مراجعة', 15, 0, 10000, null, null),
  ('7e570000-0000-4000-6000-000000000003', '7e570000-0000-4000-f000-000000000001', '7e570000-0000-4000-9000-000000000011', 'استشارة أطفال', 20, 0, 20000, null, null),
  ('7e570000-0000-4000-6000-000000000004', '7e570000-0000-4000-f000-000000000003', null, 'سحب عينة دم', 10, 0, 5000, '7e570000-0000-4000-7000-000000000003', null)
on conflict (id) do nothing;

insert into public.booking_policies (facility_id, practitioner_id, confirmation_mode, confirmation_timeout_minutes,
  booking_window_days, min_notice_minutes, cancellation_cutoff_minutes, cancellation_policy_text)
select v.f::uuid, null::uuid, v.mode, 120, 30, 10, 60, v.txt
  from (values ('7e570000-0000-4000-f000-000000000001', 'manual', 'للاختبار: الإلغاء مجاني قبل ساعة.'),
               ('7e570000-0000-4000-f000-000000000003', 'auto', null)) v(f, mode, txt)
 where not exists (select 1 from public.booking_policies b where b.facility_id = v.f::uuid and b.practitioner_id is null);

-- weekly hours: every day 08:00–22:00 (Asia/Baghdad) so testing works at any time
insert into public.schedules (facility_id, practitioner_id, weekday, start_local, end_local, valid_from)
select f::uuid, p::uuid, d, '08:00'::time, '22:00'::time, current_date - 1
  from (values ('7e570000-0000-4000-f000-000000000001', '7e570000-0000-4000-9000-000000000010'),
               ('7e570000-0000-4000-f000-000000000001', '7e570000-0000-4000-9000-000000000011'),
               ('7e570000-0000-4000-f000-000000000003', null)) v(f, p),
       generate_series(0, 6) d
 where not exists (select 1 from public.schedules s where s.facility_id = v.f::uuid and s.practitioner_id is not distinct from v.p::uuid);

-- lab tests
insert into public.lab_test_catalog (lab_facility_id, code, name, specimen_type, unit, reference_range_text, price_minor, turnaround_hours, preparation_note)
select '7e570000-0000-4000-f000-000000000003', v.* from (values
  ('CBC', 'صورة دم كاملة (CBC)', 'دم كامل', null, 'حسب تقرير المختبر', 10000, 4, null),
  ('FBS', 'سكر صائم', 'مصل', 'mg/dL', 'يحدده المختبر', 5000, 2, 'صيام 8 ساعات'),
  ('HBA1C', 'السكر التراكمي HbA1c', 'دم كامل', '%', 'يحدده المختبر', 15000, 24, null),
  ('TSH', 'هرمون الغدة الدرقية TSH', 'مصل', 'mIU/L', 'يحدده المختبر', 18000, 24, null)
) v(code, name, specimen, unit, rr, price, tat, prep)
 where not exists (select 1 from public.lab_test_catalog c where c.lab_facility_id = '7e570000-0000-4000-f000-000000000003' and c.code = v.code);

-- pharmacy stock (mapped to the starter medication catalogue when present)
insert into public.pharmacy_products (id, pharmacy_id, medication_id, name, pack_description, unit_name, units_per_pack, unit_price_minor, reorder_level)
select v.id::uuid, '7e570000-0000-4000-f000-000000000002',
       (select id from public.medication_catalog m where m.active_ingredient = v.ing and m.strength = v.str and m.dosage_form = v.form limit 1),
       v.name, v.pack, v.unit, v.upp, v.price, v.reorder
  from (values
    ('7e570000-0000-4000-3000-000000000001', 'Paracetamol', '500 mg', 'tablet', 'باراسيتامول 500 (اختبار)', 'علبة 20 قرص', 'قرص', 20, 250, 40),
    ('7e570000-0000-4000-3000-000000000002', 'Amoxicillin', '500 mg', 'capsule', 'أموكسيسيلين 500 (اختبار)', 'علبة 16 كبسولة', 'كبسولة', 16, 500, 32),
    ('7e570000-0000-4000-3000-000000000003', 'Omeprazole', '20 mg', 'capsule', 'أوميبرازول 20 (اختبار)', 'علبة 14 كبسولة', 'كبسولة', 14, 400, 14),
    ('7e570000-0000-4000-3000-000000000004', 'Ibuprofen', '400 mg', 'tablet', 'إيبوبروفين 400 (اختبار)', 'علبة 20 قرص', 'قرص', 20, 300, 20)
  ) as v(id, ing, str, form, name, pack, unit, upp, price, reorder)
on conflict (id) do nothing;

insert into public.inventory_batches (id, product_id, batch_no, expiry_date, quantity_on_hand, unit_cost_minor) values
  ('7e570000-0000-4000-3100-000000000001', '7e570000-0000-4000-3000-000000000001', 'T-P1', current_date + 300, 200, 150),
  ('7e570000-0000-4000-3100-000000000002', '7e570000-0000-4000-3000-000000000002', 'T-A1', current_date + 200, 64, 300),
  ('7e570000-0000-4000-3100-000000000003', '7e570000-0000-4000-3000-000000000003', 'T-O1', current_date + 150, 42, 250),
  ('7e570000-0000-4000-3100-000000000004', '7e570000-0000-4000-3000-000000000004', 'T-I1', current_date + 250, 100, 180)
on conflict (id) do nothing;
insert into public.stock_movements (product_id, batch_id, quantity, kind, reason)
select b.product_id, b.id, b.quantity_on_hand, 'receive', 'test environment'
  from public.inventory_batches b
 where b.id::text like '7e570000-%'
   and not exists (select 1 from public.stock_movements m where m.batch_id = b.id);

-- test patient with an account (self) — reception can also book name-only patients
insert into public.patients (id, public_code, full_name, sex, birth_year, created_by)
values ('7e570000-0000-4000-5000-000000000050', 'PTEST00050', 'مريض تجريبي (اختبار)', 'male', 1990, '7e570000-0000-4000-a000-000000000050')
on conflict (id) do nothing;
insert into public.patient_account_links (patient_id, user_id, relationship, verified_at, verified_method)
values ('7e570000-0000-4000-5000-000000000050', '7e570000-0000-4000-a000-000000000050', 'self', now(), 'self_registration')
on conflict do nothing;

select 'test environment ready' as result,
       (select count(*) from auth.users where id::text like '7e570000-%') as test_accounts;
