-- =====================================================================
-- Karbala DEMO environment (synthetic). Fictional people and facilities,
-- all marked «(تجريبي)», located in Karbala:
--   مجمع الواحة الطبي: 3 doctors + pharmacy + lab (the clinic's defaults)
--   مجمع النور الطبي: 2 doctors + pharmacy (its lab default: الواحة)
--   صيدلية الرحمة الأهلية: independent pharmacy
-- One receptionist per doctor, one account per pharmacy and for the lab,
-- and a patient account (with a child) whose history is in
-- karbala-demo-history.sql. Ids start with cb1a0000 so the set can be
-- found and disabled later. __TEST_PASSWORD__ is substituted at run time
-- and never committed. Idempotent.
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

select pg_temp.mk_test_user(('cb1a0000-0000-4000-a000-0000000000' || v.n)::uuid, 'spardexlab+' || v.mail || '@gmail.com', v.name, '__TEST_PASSWORD__')
  from (values
    ('11', 'krb.dr.ali',     'د. علي حسن الموسوي (تجريبي)'),
    ('12', 'krb.dr.zainab',  'د. زينب كاظم الجبوري (تجريبي)'),
    ('13', 'krb.dr.haider',  'د. حيدر عبد الأمير الطائي (تجريبي)'),
    ('14', 'krb.dr.maryam',  'د. مريم جواد الكعبي (تجريبي)'),
    ('15', 'krb.dr.mustafa', 'د. مصطفى رحيم الخفاجي (تجريبي)'),
    ('21', 'krb.rec.ali',     'حسين كريم — سكرتير د. علي (تجريبي)'),
    ('22', 'krb.rec.zainab',  'نور الهدى سلمان — سكرتيرة د. زينب (تجريبي)'),
    ('23', 'krb.rec.haider',  'سجاد فاضل — سكرتير د. حيدر (تجريبي)'),
    ('24', 'krb.rec.maryam',  'فاطمة عدنان — سكرتيرة د. مريم (تجريبي)'),
    ('25', 'krb.rec.mustafa', 'مرتضى صادق — سكرتير د. مصطفى (تجريبي)'),
    ('31', 'krb.ph.waha',   'أحمد ماجد — صيدلية الواحة (تجريبي)'),
    ('32', 'krb.ph.noor',   'رقية حسن — صيدلية النور (تجريبي)'),
    ('33', 'krb.ph.rahma',  'عباس ناصر — صيدلية الرحمة (تجريبي)'),
    ('41', 'krb.lab',       'ياسر عبد الحسين — مختبر الواحة (تجريبي)'),
    ('51', 'krb.patient',   'كرار محمد جاسم (تجريبي)')
  ) v(n, mail, name);

-- organisations, branches (Karbala), facilities ------------------------------
insert into public.organizations (id, name, kind, status, verified_at) values
  ('cb1a0000-0000-4000-e000-000000000001', 'مجمع الواحة الطبي (تجريبي)', 'medical_complex', 'active', now()),
  ('cb1a0000-0000-4000-e000-000000000002', 'مجمع النور الطبي (تجريبي)', 'medical_complex', 'active', now()),
  ('cb1a0000-0000-4000-e000-000000000003', 'صيدلية الرحمة الأهلية (تجريبي)', 'independent', 'active', now())
on conflict (id) do nothing;

insert into public.branches (id, organization_id, name, city_id, area, address, latitude, longitude)
select v.id::uuid, v.org::uuid, v.name, (select id from public.cities where name_ar = 'كربلاء' limit 1), v.area, v.addr, v.lat, v.lng
  from (values
    ('cb1a0000-0000-4000-b000-000000000001', 'cb1a0000-0000-4000-e000-000000000001', 'فرع حي البلدية', 'حي البلدية', 'عنوان تجريبي — حي البلدية، كربلاء', 32.6160, 44.0249),
    ('cb1a0000-0000-4000-b000-000000000002', 'cb1a0000-0000-4000-e000-000000000002', 'فرع حي الإسكان', 'حي الإسكان', 'عنوان تجريبي — حي الإسكان، كربلاء', 32.6005, 44.0101),
    ('cb1a0000-0000-4000-b000-000000000003', 'cb1a0000-0000-4000-e000-000000000003', 'حي العباس', 'حي العباس', 'عنوان تجريبي — حي العباس، كربلاء', 32.6251, 44.0352)
  ) v(id, org, name, area, addr, lat, lng)
on conflict (id) do nothing;

insert into public.facilities (id, organization_id, branch_id, type, name, description, phone, status, opening_hours_note) values
  ('cb1a0000-0000-4000-f000-000000000012', 'cb1a0000-0000-4000-e000-000000000001', 'cb1a0000-0000-4000-b000-000000000001',
   'pharmacy', 'صيدلية الواحة (تجريبي)', 'صيدلية مجمع الواحة — بيانات تجريبية', '07700001012', 'active', 'يومياً 9 ص – 11 م'),
  ('cb1a0000-0000-4000-f000-000000000013', 'cb1a0000-0000-4000-e000-000000000001', 'cb1a0000-0000-4000-b000-000000000001',
   'laboratory', 'مختبر الواحة للتحليلات المرضية (تجريبي)', 'مختبر مجمع الواحة — بيانات تجريبية', '07700001013', 'active', 'يومياً 8 ص – 10 م'),
  ('cb1a0000-0000-4000-f000-000000000022', 'cb1a0000-0000-4000-e000-000000000002', 'cb1a0000-0000-4000-b000-000000000002',
   'pharmacy', 'صيدلية النور (تجريبي)', 'صيدلية مجمع النور — بيانات تجريبية', '07700001022', 'active', 'يومياً 9 ص – 11 م'),
  ('cb1a0000-0000-4000-f000-000000000032', 'cb1a0000-0000-4000-e000-000000000003', 'cb1a0000-0000-4000-b000-000000000003',
   'pharmacy', 'صيدلية الرحمة الأهلية (تجريبي)', 'صيدلية مستقلة — بيانات تجريبية', '07700001032', 'active', 'يومياً 8 ص – 12 م')
on conflict (id) do nothing;
insert into public.facilities (id, organization_id, branch_id, type, name, description, phone, status, default_pharmacy_id, default_lab_id, opening_hours_note) values
  ('cb1a0000-0000-4000-f000-000000000011', 'cb1a0000-0000-4000-e000-000000000001', 'cb1a0000-0000-4000-b000-000000000001',
   'clinic', 'عيادات الواحة التخصصية (تجريبي)', 'باطنية، أطفال، قلبية — بيانات تجريبية', '07700001011', 'active',
   'cb1a0000-0000-4000-f000-000000000012', 'cb1a0000-0000-4000-f000-000000000013', 'يومياً 9 ص – 10 م (للتجربة)'),
  ('cb1a0000-0000-4000-f000-000000000021', 'cb1a0000-0000-4000-e000-000000000002', 'cb1a0000-0000-4000-b000-000000000002',
   'clinic', 'عيادات النور (تجريبي)', 'نسائية وتوليد، عظام ومفاصل — بيانات تجريبية', '07700001021', 'active',
   'cb1a0000-0000-4000-f000-000000000022', 'cb1a0000-0000-4000-f000-000000000013', 'يومياً 9 ص – 10 م (للتجربة)')
on conflict (id) do nothing;

-- doctors -----------------------------------------------------------------
insert into public.practitioner_profiles (id, user_id, full_name, title, specialty_id, bio, license_number, license_verified_at)
select ('cb1a0000-0000-4000-9000-0000000000' || v.n)::uuid, ('cb1a0000-0000-4000-a000-0000000000' || v.n)::uuid, v.name, v.title,
       (select id from public.specialties where name_ar = v.spec limit 1), v.bio, 'KRB-DEMO-' || v.n, now()
  from (values
    ('11', 'د. علي حسن الموسوي (تجريبي)', 'استشاري الأمراض الباطنية', 'باطنية', 'خبرة في السكري وضغط الدم وأمراض الجهاز الهضمي. حساب تجريبي.'),
    ('12', 'د. زينب كاظم الجبوري (تجريبي)', 'أخصائية طب الأطفال', 'أطفال', 'متابعة نمو الأطفال والتطعيمات والتهابات الجهاز التنفسي. حساب تجريبي.'),
    ('13', 'د. حيدر عبد الأمير الطائي (تجريبي)', 'استشاري أمراض القلب', 'قلبية', 'ضغط الدم، تخطيط القلب، وأمراض الشرايين. حساب تجريبي.'),
    ('14', 'د. مريم جواد الكعبي (تجريبي)', 'أخصائية النسائية والتوليد', 'نسائية وتوليد', 'متابعة الحمل والسونار النسائي. حساب تجريبي.'),
    ('15', 'د. مصطفى رحيم الخفاجي (تجريبي)', 'أخصائي جراحة العظام والمفاصل', 'عظام ومفاصل', 'إصابات الملاعب، آلام المفاصل والعمود الفقري. حساب تجريبي.')
  ) v(n, name, title, spec, bio)
on conflict (id) do nothing;

-- memberships: doctors, one receptionist per doctor, pharmacies, lab ----------
insert into public.memberships (id, user_id, organization_id, facility_id, role)
select ('cb1a0000-0000-4000-8000-0000000000' || v.n)::uuid, ('cb1a0000-0000-4000-a000-0000000000' || v.n)::uuid,
       ('cb1a0000-0000-4000-e000-00000000000' || v.org)::uuid, ('cb1a0000-0000-4000-f000-0000000000' || v.fac)::uuid, v.role::public.member_role
  from (values
    ('11', '1', '11', 'doctor'), ('12', '1', '11', 'doctor'), ('13', '1', '11', 'doctor'),
    ('14', '2', '21', 'doctor'), ('15', '2', '21', 'doctor'),
    ('21', '1', '11', 'receptionist'), ('22', '1', '11', 'receptionist'), ('23', '1', '11', 'receptionist'),
    ('24', '2', '21', 'receptionist'), ('25', '2', '21', 'receptionist'),
    ('31', '1', '12', 'pharmacist'), ('32', '2', '22', 'pharmacist'), ('33', '3', '32', 'pharmacist'),
    ('41', '1', '13', 'lab_technician')
  ) v(n, org, fac, role)
on conflict (id) do nothing;

insert into public.reception_scopes (membership_id, practitioner_id)
select ('cb1a0000-0000-4000-8000-0000000000' || r)::uuid, ('cb1a0000-0000-4000-9000-0000000000' || d)::uuid
  from (values ('21', '11'), ('22', '12'), ('23', '13'), ('24', '14'), ('25', '15')) v(r, d)
on conflict do nothing;

-- services, lab station, booking policies, hours ------------------------------
insert into public.facility_resources (id, facility_id, name, kind)
values ('cb1a0000-0000-4000-7000-000000000013', 'cb1a0000-0000-4000-f000-000000000013', 'غرفة سحب العينات', 'collection_station')
on conflict (id) do nothing;

insert into public.clinic_services (id, facility_id, practitioner_id, name, duration_minutes, buffer_minutes, price_minor, resource_id, preparation_note)
select v.id::uuid, v.fac::uuid, v.prac::uuid, v.name, v.dur, 0, v.price, v.res::uuid, v.prep
  from (values
    ('cb1a0000-0000-4000-6000-000000000111', 'cb1a0000-0000-4000-f000-000000000011', 'cb1a0000-0000-4000-9000-000000000011', 'كشف باطنية', 20, 25000, null, null),
    ('cb1a0000-0000-4000-6000-000000000112', 'cb1a0000-0000-4000-f000-000000000011', 'cb1a0000-0000-4000-9000-000000000011', 'مراجعة', 10, 10000, null, null),
    ('cb1a0000-0000-4000-6000-000000000121', 'cb1a0000-0000-4000-f000-000000000011', 'cb1a0000-0000-4000-9000-000000000012', 'كشف أطفال', 15, 20000, null, null),
    ('cb1a0000-0000-4000-6000-000000000122', 'cb1a0000-0000-4000-f000-000000000011', 'cb1a0000-0000-4000-9000-000000000012', 'مراجعة', 10, 10000, null, null),
    ('cb1a0000-0000-4000-6000-000000000131', 'cb1a0000-0000-4000-f000-000000000011', 'cb1a0000-0000-4000-9000-000000000013', 'كشف قلبية مع تخطيط', 30, 35000, null, null),
    ('cb1a0000-0000-4000-6000-000000000132', 'cb1a0000-0000-4000-f000-000000000011', 'cb1a0000-0000-4000-9000-000000000013', 'مراجعة', 10, 15000, null, null),
    ('cb1a0000-0000-4000-6000-000000000141', 'cb1a0000-0000-4000-f000-000000000021', 'cb1a0000-0000-4000-9000-000000000014', 'كشف نسائية مع سونار', 30, 30000, null, null),
    ('cb1a0000-0000-4000-6000-000000000142', 'cb1a0000-0000-4000-f000-000000000021', 'cb1a0000-0000-4000-9000-000000000014', 'مراجعة', 15, 15000, null, null),
    ('cb1a0000-0000-4000-6000-000000000151', 'cb1a0000-0000-4000-f000-000000000021', 'cb1a0000-0000-4000-9000-000000000015', 'كشف عظام', 20, 30000, null, null),
    ('cb1a0000-0000-4000-6000-000000000152', 'cb1a0000-0000-4000-f000-000000000021', 'cb1a0000-0000-4000-9000-000000000015', 'مراجعة', 10, 15000, null, null)
  ) v(id, fac, prac, name, dur, price, res, prep)
on conflict (id) do nothing;
insert into public.clinic_services (id, facility_id, practitioner_id, name, duration_minutes, buffer_minutes, price_minor, resource_id, preparation_note)
values ('cb1a0000-0000-4000-6000-000000000013', 'cb1a0000-0000-4000-f000-000000000013', null, 'سحب عينة دم', 10, 0, 5000,
        'cb1a0000-0000-4000-7000-000000000013', 'بعض التحاليل تحتاج صياماً 8 ساعات')
on conflict (id) do nothing;

-- الواحة: the receptionist confirms requests; النور: bookings confirm automatically
insert into public.booking_policies (facility_id, practitioner_id, confirmation_mode, confirmation_timeout_minutes,
  booking_window_days, min_notice_minutes, cancellation_cutoff_minutes, cancellation_policy_text)
select v.f::uuid, null::uuid, v.mode, 120, 30, 10, 60, v.txt
  from (values ('cb1a0000-0000-4000-f000-000000000011', 'manual', 'الإلغاء مجاني قبل ساعة من الموعد.'),
               ('cb1a0000-0000-4000-f000-000000000021', 'auto', 'الإلغاء مجاني قبل ساعة من الموعد.'),
               ('cb1a0000-0000-4000-f000-000000000013', 'auto', null)) v(f, mode, txt)
 where not exists (select 1 from public.booking_policies b where b.facility_id = v.f::uuid and b.practitioner_id is null);

-- every day 09:00–22:00 (Asia/Baghdad) so any scenario can be tried at any time
insert into public.schedules (facility_id, practitioner_id, weekday, start_local, end_local, valid_from)
select v.f::uuid, v.p::uuid, d, '09:00'::time, '22:00'::time, current_date - 1
  from (values ('cb1a0000-0000-4000-f000-000000000011', 'cb1a0000-0000-4000-9000-000000000011'),
               ('cb1a0000-0000-4000-f000-000000000011', 'cb1a0000-0000-4000-9000-000000000012'),
               ('cb1a0000-0000-4000-f000-000000000011', 'cb1a0000-0000-4000-9000-000000000013'),
               ('cb1a0000-0000-4000-f000-000000000021', 'cb1a0000-0000-4000-9000-000000000014'),
               ('cb1a0000-0000-4000-f000-000000000021', 'cb1a0000-0000-4000-9000-000000000015'),
               ('cb1a0000-0000-4000-f000-000000000013', null)) v(f, p),
       generate_series(0, 6) d
 where not exists (select 1 from public.schedules s where s.facility_id = v.f::uuid and s.practitioner_id is not distinct from v.p::uuid);

-- lab tests -------------------------------------------------------------------
insert into public.lab_test_catalog (lab_facility_id, code, name, specimen_type, unit, reference_range_text, price_minor, turnaround_hours, preparation_note)
select 'cb1a0000-0000-4000-f000-000000000013', v.* from (values
  ('CBC', 'صورة دم كاملة (CBC)', 'دم كامل', null, 'حسب تقرير المختبر', 10000, 4, null),
  ('FBS', 'سكر صائم', 'مصل', 'mg/dL', '70-100', 5000, 2, 'صيام 8 ساعات'),
  ('HBA1C', 'السكر التراكمي HbA1c', 'دم كامل', '%', '4.0-5.6', 15000, 24, null),
  ('LDL', 'الكوليسترول الضار LDL', 'مصل', 'mg/dL', 'أقل من 100', 12000, 24, 'صيام 12 ساعة'),
  ('CREAT', 'الكرياتينين', 'مصل', 'mg/dL', '0.7-1.3', 8000, 6, null),
  ('TSH', 'هرمون الغدة الدرقية TSH', 'مصل', 'mIU/L', '0.4-4.0', 18000, 24, null),
  ('VITD', 'فيتامين D', 'مصل', 'ng/mL', '30-100', 25000, 48, null),
  ('CRP', 'بروتين الالتهاب CRP', 'مصل', 'mg/L', 'أقل من 5', 10000, 6, null)
) v(code, name, specimen, unit, rr, price, tat, prep)
 where not exists (select 1 from public.lab_test_catalog c where c.lab_facility_id = 'cb1a0000-0000-4000-f000-000000000013' and c.code = v.code);

-- pharmacy stock: every catalogue medicine in all three pharmacies ------------
insert into public.pharmacy_products (id, pharmacy_id, medication_id, name, pack_description, unit_name, units_per_pack, unit_price_minor, reorder_level)
select md5('krb-prod-' || ph || m.id)::uuid, ph::uuid, m.id, m.active_ingredient || ' ' || m.strength,
       case m.dosage_form when 'tablet' then 'علبة 20 قرص' when 'capsule' then 'علبة 14 كبسولة' when 'syrup' then 'قنينة 100 مل' else 'عبوة واحدة' end,
       case m.dosage_form when 'tablet' then 'قرص' when 'capsule' then 'كبسولة' when 'syrup' then 'قنينة' else 'عبوة' end,
       case m.dosage_form when 'tablet' then 20 when 'capsule' then 14 else 1 end,
       case m.dosage_form when 'tablet' then 250 when 'capsule' then 450 when 'syrup' then 3500 else 9000 end, 20
  from public.medication_catalog m,
       unnest(array['cb1a0000-0000-4000-f000-000000000012', 'cb1a0000-0000-4000-f000-000000000022', 'cb1a0000-0000-4000-f000-000000000032']) ph
on conflict (id) do nothing;

insert into public.inventory_batches (id, product_id, batch_no, expiry_date, quantity_on_hand, unit_cost_minor)
select md5('krb-batch-' || p.id)::uuid, p.id, 'KRB-' || upper(substr(md5(p.id::text), 1, 5)), current_date + 365,
       case when p.unit_name in ('قرص', 'كبسولة') then 400 else 30 end, (p.unit_price_minor * 0.6)::bigint
  from public.pharmacy_products p where p.pharmacy_id::text like 'cb1a0000-%'
on conflict (id) do nothing;
-- صيدلية الواحة: an older Paracetamol batch close to expiry (dispensed first) and an expired Ibuprofen batch
insert into public.inventory_batches (id, product_id, batch_no, expiry_date, quantity_on_hand, unit_cost_minor)
select md5('krb-batch-old-' || p.id)::uuid, p.id, case when p.name like 'Paracetamol 500%' then 'KRB-NEAR' else 'KRB-EXP' end,
       case when p.name like 'Paracetamol 500%' then current_date + 25 else current_date - 10 end, 60, 150
  from public.pharmacy_products p
 where p.pharmacy_id = 'cb1a0000-0000-4000-f000-000000000012' and (p.name like 'Paracetamol 500%' or p.name like 'Ibuprofen%')
on conflict (id) do nothing;
insert into public.stock_movements (product_id, batch_id, quantity, kind, reason)
select b.product_id, b.id, b.quantity_on_hand, 'receive', 'karbala demo'
  from public.inventory_batches b join public.pharmacy_products p on p.id = b.product_id
 where p.pharmacy_id::text like 'cb1a0000-%' and not exists (select 1 from public.stock_movements m where m.batch_id = b.id);

-- patients: Karrar (account, self) + his daughter (guardian link) + three without accounts
insert into public.patients (id, public_code, full_name, sex, birth_year, phone, city_id, created_by) values
  ('cb1a0000-0000-4000-5000-000000000051', 'PKRB000051', 'كرار محمد جاسم (تجريبي)', 'male', 1985, '07700001151', (select id from public.cities where name_ar = 'كربلاء'), 'cb1a0000-0000-4000-a000-000000000051'),
  ('cb1a0000-0000-4000-5000-000000000052', 'PKRB000052', 'زهراء كرار محمد (تجريبي)', 'female', 2019, '07700001151', (select id from public.cities where name_ar = 'كربلاء'), 'cb1a0000-0000-4000-a000-000000000051'),
  ('cb1a0000-0000-4000-5000-000000000053', 'PKRB000053', 'علي حسين جبار (تجريبي)', 'male', 1978, '07700001153', (select id from public.cities where name_ar = 'كربلاء'), 'cb1a0000-0000-4000-a000-000000000021'),
  ('cb1a0000-0000-4000-5000-000000000054', 'PKRB000054', 'سعاد عبد الله مهدي (تجريبي)', 'female', 1992, '07700001154', (select id from public.cities where name_ar = 'كربلاء'), 'cb1a0000-0000-4000-a000-000000000024'),
  ('cb1a0000-0000-4000-5000-000000000055', 'PKRB000055', 'حسن مهدي صالح (تجريبي)', 'male', 2001, '07700001155', (select id from public.cities where name_ar = 'كربلاء'), 'cb1a0000-0000-4000-a000-000000000025')
on conflict (id) do nothing;
insert into public.patient_account_links (patient_id, user_id, relationship, verified_at, verified_method) values
  ('cb1a0000-0000-4000-5000-000000000051', 'cb1a0000-0000-4000-a000-000000000051', 'self', now(), 'self_registration'),
  ('cb1a0000-0000-4000-5000-000000000052', 'cb1a0000-0000-4000-a000-000000000051', 'guardian', now(), 'admin')
on conflict do nothing;

select 'karbala demo ready' as result,
       (select count(*) from auth.users where id::text like 'cb1a0000-%') as accounts,
       (select count(*) from public.facilities where id::text like 'cb1a0000-%') as facilities,
       (select count(*) from public.pharmacy_products where pharmacy_id::text like 'cb1a0000-%') as products;
