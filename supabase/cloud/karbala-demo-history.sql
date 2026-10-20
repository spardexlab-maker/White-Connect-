-- =====================================================================
-- Karbala DEMO: past medical history for the demo patient Karrar and his
-- daughter (synthetic). Signed visit notes, approved prescriptions and
-- released lab results dated in the past, so the medical card, the
-- patient journey and the lab/Rx history have content from day one.
-- Run after karbala-demo.sql. Idempotent (fixed ids).
-- =====================================================================
create or replace function pg_temp.visit(p_enc uuid, p_patient uuid, p_fac uuid, p_dr text, p_at timestamptz,
  p_reason text, p_history text, p_exam text, p_assessment text, p_plan text, p_follow text, p_vitals jsonb)
returns void language plpgsql as $$
declare
  prac uuid := ('cb1a0000-0000-4000-9000-0000000000' || p_dr)::uuid;
  usr uuid := ('cb1a0000-0000-4000-a000-0000000000' || p_dr)::uuid;
begin
  if exists (select 1 from public.encounters where id = p_enc) then return; end if;
  insert into public.encounters (id, patient_id, facility_id, practitioner_id, status, started_at, ended_at, identity_verified, created_by, created_at)
  values (p_enc, p_patient, p_fac, prac, 'completed', p_at, p_at + interval '20 minutes', true, usr, p_at);
  insert into public.clinical_notes (encounter_id, version_no, status, reason_for_visit, history, examination, assessment, plan, follow_up, vitals,
                                     signed_at, signed_by, created_by, created_at)
  values (p_enc, 1, 'signed', p_reason, p_history, p_exam, p_assessment, p_plan, p_follow, coalesce(p_vitals, '{}'::jsonb),
          p_at + interval '18 minutes', usr, usr, p_at);
  insert into public.care_relationships (patient_id, facility_id, practitioner_id, source, created_by, created_at)
  select p_patient, p_fac, prac, 'appointment', usr, p_at
   where not exists (select 1 from public.care_relationships c where c.patient_id = p_patient and c.practitioner_id = prac and c.facility_id = p_fac);
end $$;

-- items: [{"ing","str","form","dose","unit","freq","days","qty","qunit","notes"}]
create or replace function pg_temp.rx(p_rx uuid, p_enc uuid, p_items jsonb)
returns void language plpgsql as $$
declare
  e public.encounters;
  usr uuid;
  v uuid;
  at timestamptz;
  snap jsonb;
  num text;
begin
  if exists (select 1 from public.prescriptions where id = p_rx) then return; end if;
  select * into e from public.encounters where id = p_enc;
  usr := e.created_by; at := e.started_at + interval '15 minutes';
  insert into public.prescriptions (id, patient_id, encounter_id, facility_id, practitioner_id, status, created_by, idempotency_key, created_at)
  values (p_rx, e.patient_id, e.id, e.facility_id, e.practitioner_id, 'draft', usr, 'krb-demo-' || p_rx, at)
  returning rx_number into num;
  insert into public.prescription_versions (prescription_id, version_no, created_at) values (p_rx, 1, at) returning id into v;
  insert into public.prescription_items (version_id, line_no, medication_id, display_name, dose, dose_unit, route, frequency_text,
                                         duration_days, start_date, quantity, quantity_unit, instructions)
  select v, x.ord, m.id, coalesce(m.active_ingredient || ' ' || m.strength || ' ' || m.dosage_form, x.it ->> 'ing'),
         (x.it ->> 'dose')::numeric, x.it ->> 'unit', 'فموي', x.it ->> 'freq', (x.it ->> 'days')::int, at::date,
         (x.it ->> 'qty')::numeric, x.it ->> 'qunit', x.it ->> 'notes'
    from jsonb_array_elements(p_items) with ordinality x(it, ord)
    left join public.medication_catalog m on m.active_ingredient = x.it ->> 'ing' and m.strength = x.it ->> 'str' and m.dosage_form = x.it ->> 'form';
  select jsonb_build_object(
    'rx_number', num, 'version_no', 1, 'approved_at', at,
    'practitioner', jsonb_build_object('full_name', pp.full_name, 'title', pp.title, 'license_number', pp.license_number),
    'facility', jsonb_build_object('name', f.name, 'branch', b.name, 'address', b.address, 'phone', f.phone),
    'patient', jsonb_build_object('full_name', p.full_name, 'public_code', p.public_code, 'sex', p.sex,
                                  'birth_year', coalesce(p.birth_year, extract(year from p.birth_date)::int)),
    'items', (select jsonb_agg(to_jsonb(i) - 'version_id' - 'id' order by i.line_no) from public.prescription_items i where i.version_id = v))
  into snap
  from public.practitioner_profiles pp, public.facilities f, public.branches b, public.patients p
  where pp.id = e.practitioner_id and f.id = e.facility_id and b.id = f.branch_id and p.id = e.patient_id;
  update public.prescription_versions
     set status = 'approved', approved_at = at, approved_by = usr, snapshot = snap,
         verify_token = encode(extensions.gen_random_bytes(18), 'hex'), verify_expires_at = at + interval '30 days'
   where id = v;
  update public.prescriptions set status = 'active', current_version_id = v where id = p_rx;
  insert into public.prescription_events (prescription_id, version_id, event, facility_id, actor_user_id, occurred_at)
  values (p_rx, v, 'approved', e.facility_id, usr, at);
end $$;

-- results: [{"code","num","text","flag","notes"}]; released the next day by the Karbala lab account
create or replace function pg_temp.lab(p_order uuid, p_enc uuid, p_results jsonb)
returns void language plpgsql as $$
declare
  e public.encounters;
  lab uuid := 'cb1a0000-0000-4000-f000-000000000013';
  tech uuid := 'cb1a0000-0000-4000-a000-000000000041';
  at timestamptz;
  rel timestamptz;
  r jsonb;
  c public.lab_test_catalog;
  item uuid;
begin
  if exists (select 1 from public.lab_orders where id = p_order) then return; end if;
  select * into e from public.encounters where id = p_enc;
  at := e.started_at + interval '16 minutes'; rel := e.started_at + interval '1 day 2 hours';
  insert into public.lab_orders (id, patient_id, lab_facility_id, source, encounter_id, ordering_practitioner_id, ordering_facility_id,
                                 status, clinical_note, created_by, idempotency_key, created_at)
  values (p_order, e.patient_id, lab, 'referral', e.id, e.practitioner_id, e.facility_id, 'released', null, e.created_by, 'krb-demo-' || p_order, at);
  for r in select * from jsonb_array_elements(p_results) loop
    select * into c from public.lab_test_catalog where lab_facility_id = lab and code = r ->> 'code';
    insert into public.lab_order_items (order_id, test_id, display_name, status, released_at)
    values (p_order, c.id, c.name, 'released', rel) returning id into item;
    insert into public.lab_results (order_item_id, version_no, status, value_text, value_numeric, unit, reference_range, lab_flag, notes,
                                    entered_by, released_by, released_at, created_at)
    values (item, 1, 'released', r ->> 'text', (r ->> 'num')::numeric, c.unit, c.reference_range_text, r ->> 'flag', r ->> 'notes',
            tech, tech, rel, rel - interval '1 hour');
  end loop;
end $$;

-- allergy recorded by the internist
insert into public.allergies (patient_id, substance, reaction, severity, source, recorded_by, recorded_by_practitioner_id, facility_id, created_at)
select 'cb1a0000-0000-4000-5000-000000000051', 'Penicillin', 'طفح جلدي وحكة', 'moderate', 'clinician',
       'cb1a0000-0000-4000-a000-000000000011', 'cb1a0000-0000-4000-9000-000000000011', 'cb1a0000-0000-4000-f000-000000000011', now() - interval '120 days'
 where not exists (select 1 from public.allergies where patient_id = 'cb1a0000-0000-4000-5000-000000000051');

-- Karrar: diabetes diagnosed, then hypertension, then follow-up ----------------
select pg_temp.visit('cb1a0000-0000-4000-d100-000000000001', 'cb1a0000-0000-4000-5000-000000000051', 'cb1a0000-0000-4000-f000-000000000011', '11',
  date_trunc('day', now()) - interval '120 days' + interval '14 hours',
  'عطش وكثرة تبول منذ شهر تقريباً', 'لا أمراض مزمنة سابقة. الوالد مصاب بالسكري.', 'الحالة العامة جيدة، لا علامات جفاف.',
  'ارتفاع سكر الدم — بانتظار التأكيد بالتحاليل', 'تحاليل سكر صائم وتراكمي ووظائف كلى، وحمية غذائية.', 'مراجعة بعد أسبوع مع النتائج',
  '{"bp_sys":"130","bp_dia":"85","pulse":"78","weight_kg":"92"}');
select pg_temp.lab('cb1a0000-0000-4000-d400-000000000001', 'cb1a0000-0000-4000-d100-000000000001',
  '[{"code":"FBS","num":168,"flag":"high"},{"code":"HBA1C","num":7.8,"flag":"high"},{"code":"CREAT","num":0.9}]');

select pg_temp.visit('cb1a0000-0000-4000-d100-000000000002', 'cb1a0000-0000-4000-5000-000000000051', 'cb1a0000-0000-4000-f000-000000000011', '11',
  date_trunc('day', now()) - interval '112 days' + interval '15 hours',
  'مراجعة مع نتائج التحاليل', 'سكر صائم 168 وتراكمي 7.8 حسب المختبر.', 'لا جديد.',
  'داء السكري النوع الثاني — تشخيص جديد', 'ميتفورمين مرتين يومياً مع الأكل، حمية ومشي يومي.', 'مراجعة بعد 3 أشهر مع HbA1c',
  '{"bp_sys":"132","bp_dia":"84","pulse":"76","weight_kg":"91"}');
select pg_temp.rx('cb1a0000-0000-4000-d300-000000000002', 'cb1a0000-0000-4000-d100-000000000002',
  '[{"ing":"Metformin","str":"500 mg","form":"tablet","dose":1,"unit":"قرص","freq":"مرتين يومياً بعد الأكل","days":90,"qty":180,"qunit":"قرص"}]');

select pg_temp.visit('cb1a0000-0000-4000-d100-000000000003', 'cb1a0000-0000-4000-5000-000000000051', 'cb1a0000-0000-4000-f000-000000000011', '13',
  date_trunc('day', now()) - interval '60 days' + interval '17 hours',
  'خفقان وصداع متكرر', 'مريض سكري على الميتفورمين.', 'الضغط 150/95، النبض منتظم. تخطيط القلب بلا تغيرات حادة.',
  'ارتفاع ضغط الدم الأساسي', 'أملوديبين يومياً، تقليل الملح، قياس الضغط في البيت.', 'مراجعة بعد شهرين',
  '{"bp_sys":"150","bp_dia":"95","pulse":"88","weight_kg":"90"}');
select pg_temp.rx('cb1a0000-0000-4000-d300-000000000003', 'cb1a0000-0000-4000-d100-000000000003',
  '[{"ing":"Amlodipine","str":"5 mg","form":"tablet","dose":1,"unit":"قرص","freq":"مرة واحدة صباحاً","days":60,"qty":60,"qunit":"قرص"}]');
select pg_temp.lab('cb1a0000-0000-4000-d400-000000000003', 'cb1a0000-0000-4000-d100-000000000003',
  '[{"code":"LDL","num":162,"flag":"high"},{"code":"TSH","num":2.1}]');

select pg_temp.visit('cb1a0000-0000-4000-d100-000000000004', 'cb1a0000-0000-4000-5000-000000000051', 'cb1a0000-0000-4000-f000-000000000011', '11',
  date_trunc('day', now()) - interval '20 days' + interval '16 hours',
  'مراجعة دورية للسكري', 'ملتزم بالعلاج والحمية. ضغط البيت حول 130/80.', 'الوزن نقص 4 كغ.',
  'سكري نوع ثاني — تحسن ملحوظ، ارتفاع كوليسترول', 'استمرار الميتفورمين، إضافة أتورفاستاتين مساءً، فيتامين D حسب النتيجة.', 'مراجعة بعد 3 أشهر',
  '{"bp_sys":"128","bp_dia":"80","pulse":"74","weight_kg":"88"}');
select pg_temp.rx('cb1a0000-0000-4000-d300-000000000004', 'cb1a0000-0000-4000-d100-000000000004',
  '[{"ing":"Metformin","str":"500 mg","form":"tablet","dose":1,"unit":"قرص","freq":"مرتين يومياً بعد الأكل","days":90,"qty":180,"qunit":"قرص"},
    {"ing":"Atorvastatin","str":"20 mg","form":"tablet","dose":1,"unit":"قرص","freq":"مرة واحدة مساءً","days":90,"qty":90,"qunit":"قرص"}]');
select pg_temp.lab('cb1a0000-0000-4000-d400-000000000004', 'cb1a0000-0000-4000-d100-000000000004',
  '[{"code":"HBA1C","num":6.6,"flag":"high"},{"code":"FBS","num":118,"flag":"high"},{"code":"VITD","num":18,"flag":"low"}]');

-- his daughter Zahraa: pediatric visit -------------------------------------------
select pg_temp.visit('cb1a0000-0000-4000-d100-000000000005', 'cb1a0000-0000-4000-5000-000000000052', 'cb1a0000-0000-4000-f000-000000000011', '12',
  date_trunc('day', now()) - interval '35 days' + interval '13 hours',
  'حرارة وسعال منذ يومين', 'لا حساسية معروفة. التطعيمات حسب الجدول.', 'احمرار البلعوم، الصدر سليم. الحرارة 38.4.',
  'التهاب بلعوم فيروسي', 'باراسيتامول شراب عند الحرارة، سوائل وراحة.', 'مراجعة إذا استمرت الحرارة أكثر من 3 أيام',
  '{"temp_c":"38.4","pulse":"110","weight_kg":"21"}');
select pg_temp.rx('cb1a0000-0000-4000-d300-000000000005', 'cb1a0000-0000-4000-d100-000000000005',
  '[{"ing":"Paracetamol","str":"120 mg/5 ml","form":"syrup","dose":7.5,"unit":"مل","freq":"كل 6 ساعات عند الحرارة","days":5,"qty":1,"qunit":"قنينة","notes":"لا تتجاوز 4 جرعات باليوم"}]');
select pg_temp.lab('cb1a0000-0000-4000-d400-000000000005', 'cb1a0000-0000-4000-d100-000000000005',
  '[{"code":"CBC","text":"ضمن الحدود الطبيعية حسب تقرير المختبر"},{"code":"CRP","num":4}]');

-- Karrar's own health profile (height, weight, blood type), conditions and a regular supplement
insert into public.patient_health_profiles (patient_id, height_cm, weight_kg, blood_type, notes, updated_by)
values ('cb1a0000-0000-4000-5000-000000000051', 176, 88, 'O+', 'أمشي نصف ساعة يومياً.', 'cb1a0000-0000-4000-a000-000000000051')
on conflict (patient_id) do nothing;
update public.patients set birth_date = '1985-03-14' where id = 'cb1a0000-0000-4000-5000-000000000051' and birth_date is null;
insert into public.patient_conditions (patient_id, name, since_year, source, recorded_by)
select 'cb1a0000-0000-4000-5000-000000000051', v.n, v.y, v.s, v.u::uuid
  from (values ('السكري النوع الثاني', 2026, 'clinician', 'cb1a0000-0000-4000-a000-000000000011'),
               ('ارتفاع ضغط الدم', 2026, 'clinician', 'cb1a0000-0000-4000-a000-000000000013')) v(n, y, s, u)
 where not exists (select 1 from public.patient_conditions c where c.patient_id = 'cb1a0000-0000-4000-5000-000000000051' and c.name = v.n);
insert into public.patient_reported_medications (patient_id, name, dose_text, created_by)
select 'cb1a0000-0000-4000-5000-000000000051', 'Omega-3', 'كبسولة يومياً', 'cb1a0000-0000-4000-a000-000000000051'
 where not exists (select 1 from public.patient_reported_medications where patient_id = 'cb1a0000-0000-4000-5000-000000000051');

select 'history ready' as result,
       (select count(*) from public.encounters where id::text like 'cb1a0000-%') as visits,
       (select count(*) from public.prescriptions where id::text like 'cb1a0000-%') as prescriptions,
       (select count(*) from public.lab_results r join public.lab_order_items i on i.id = r.order_item_id where i.order_id::text like 'cb1a0000-%') as results;
