-- Lab tests at any lab (owner request, 25 Oct 2026):
--  * a platform-wide test catalogue («دليل التحاليل») kept by the super admin:
--    names, code, specimen, unit and reference range; labs link their own tests to it;
--  * a doctor without a lab orders tests «for any lab»: the order gets a short code
--    and a QR, shows on the patient's phone and is valid 7 days;
--  * a lab on the platform enters / scans the code, takes the tests it does (the rest
--    stays open for another lab) and the order joins its normal workflow — results go
--    to the patient's journey and to the ordering doctor as usual;
--  * a lab off the platform: the patient enters the values in the app; they show in
--    the trends and charts marked «أدخلها المريض», and the doctor is told.

create table public.lab_test_master (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_]{1,20}$'),
  name_ar text not null,
  name_en text,
  category text,
  specimen_type text,
  unit text,
  reference_range text,                 -- e.g. «70-100», «< 200»
  sort_order int not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.lab_test_master enable row level security;
create policy lab_test_master_read on public.lab_test_master for select using (true);
grant select on public.lab_test_master to anon, authenticated;

-- a lab's own test points at the catalogue entry (matched by code when it is the same)
alter table public.lab_test_catalog add column if not exists master_id uuid references public.lab_test_master (id);

insert into public.lab_test_master (code, name_ar, name_en, category, specimen_type, unit, reference_range, sort_order) values
  ('CBC',    'صورة دم كاملة (CBC)',          'Complete blood count',        'دم',        'دم كامل', null,       null,           1),
  ('HB',     'الهيموغلوبين',                 'Hemoglobin',                  'دم',        'دم كامل', 'g/dL',     '12-16',        2),
  ('WBC',    'كريات الدم البيض',             'White blood cells',           'دم',        'دم كامل', '10^3/µL',  '4.0-11.0',     3),
  ('PLT',    'الصفائح الدموية',              'Platelets',                   'دم',        'دم كامل', '10^3/µL',  '150-450',      4),
  ('ESR',    'سرعة الترسيب',                 'ESR',                         'دم',        'دم كامل', 'mm/hr',    '0-20',         5),
  ('FBS',    'سكر صائم',                     'Fasting blood sugar',         'سكر',       'مصل',     'mg/dL',    '70-100',       10),
  ('RBS',    'سكر عشوائي',                   'Random blood sugar',          'سكر',       'مصل',     'mg/dL',    '70-140',       11),
  ('HBA1C',  'السكر التراكمي HbA1c',          'HbA1c',                       'سكر',       'دم كامل', '%',        '4.0-5.6',      12),
  ('CHOL',   'الكولسترول الكلي',             'Total cholesterol',           'دهون',      'مصل',     'mg/dL',    '< 200',        20),
  ('TG',     'الدهون الثلاثية',              'Triglycerides',               'دهون',      'مصل',     'mg/dL',    '< 150',        21),
  ('HDL',    'الكولسترول النافع HDL',        'HDL cholesterol',             'دهون',      'مصل',     'mg/dL',    '> 40',         22),
  ('LDL',    'الكولسترول الضار LDL',         'LDL cholesterol',             'دهون',      'مصل',     'mg/dL',    '< 100',        23),
  ('UREA',   'اليوريا',                      'Blood urea',                  'كلى',       'مصل',     'mg/dL',    '15-45',        30),
  ('CREAT',  'الكرياتينين',                  'Creatinine',                  'كلى',       'مصل',     'mg/dL',    '0.6-1.2',      31),
  ('UA',     'حامض اليوريك',                 'Uric acid',                   'كلى',       'مصل',     'mg/dL',    '3.5-7.2',      32),
  ('ALT',    'إنزيم الكبد ALT (GPT)',        'ALT',                         'كبد',       'مصل',     'U/L',      '7-56',         40),
  ('AST',    'إنزيم الكبد AST (GOT)',        'AST',                         'كبد',       'مصل',     'U/L',      '10-40',        41),
  ('ALP',    'الفوسفاتيز القلوي',            'Alkaline phosphatase',        'كبد',       'مصل',     'U/L',      '44-147',       42),
  ('TBIL',   'البيليروبين الكلي',            'Total bilirubin',             'كبد',       'مصل',     'mg/dL',    '0.1-1.2',      43),
  ('ALB',    'الألبومين',                    'Albumin',                     'كبد',       'مصل',     'g/dL',     '3.5-5.0',      44),
  ('TSH',    'هرمون الغدة الدرقية TSH',      'TSH',                         'هرمونات',   'مصل',     'mIU/L',    '0.4-4.0',      50),
  ('FT4',    'الثايروكسين الحر FT4',         'Free T4',                     'هرمونات',   'مصل',     'ng/dL',    '0.8-1.8',      51),
  ('VITD',   'فيتامين D',                    'Vitamin D (25-OH)',           'فيتامينات', 'مصل',     'ng/mL',    '30-100',       60),
  ('B12',    'فيتامين B12',                  'Vitamin B12',                 'فيتامينات', 'مصل',     'pg/mL',    '200-900',      61),
  ('FERR',   'مخزون الحديد (الفيريتين)',     'Ferritin',                    'فيتامينات', 'مصل',     'ng/mL',    '20-250',       62),
  ('FE',     'الحديد في الدم',               'Serum iron',                  'فيتامينات', 'مصل',     'µg/dL',    '60-170',       63),
  ('CA',     'الكالسيوم',                    'Calcium',                     'أملاح',     'مصل',     'mg/dL',    '8.5-10.5',     70),
  ('NA',     'الصوديوم',                     'Sodium',                      'أملاح',     'مصل',     'mmol/L',   '135-145',      71),
  ('K',      'البوتاسيوم',                   'Potassium',                   'أملاح',     'مصل',     'mmol/L',   '3.5-5.1',      72),
  ('CRP',    'بروتين الالتهاب CRP',          'C-reactive protein',          'مناعة',     'مصل',     'mg/L',     '< 6',          80),
  ('ASO',    'ASO',                          'Antistreptolysin O',          'مناعة',     'مصل',     'IU/mL',    '< 200',        81),
  ('RF',     'عامل الروماتيزم RF',           'Rheumatoid factor',           'مناعة',     'مصل',     'IU/mL',    '< 14',         82),
  ('GUE',    'فحص الإدرار العام',            'General urine examination',   'إدرار',     'إدرار',   null,       null,           90),
  ('GSE',    'فحص الخروج العام',             'General stool examination',   'خروج',      'خروج',    null,       null,           91),
  ('BHCG',   'فحص الحمل بالدم β-hCG',        'Beta hCG',                    'هرمونات',   'مصل',     'mIU/mL',   null,           52),
  ('PSA',    'PSA البروستات',                'PSA',                         'هرمونات',   'مصل',     'ng/mL',    '< 4',          53)
on conflict (code) do nothing;

-- the lab tests that already carry a catalogue code get linked
update public.lab_test_catalog c set master_id = m.id from public.lab_test_master m
 where c.master_id is null and upper(c.code) = m.code;

-- the super admin keeps the catalogue
create or replace function public.upsert_lab_test_master(p jsonb)
returns public.lab_test_master
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.lab_test_master;
begin
  if not private.is_platform_admin() then perform private.fail('forbidden'); end if;
  if length(trim(coalesce(p ->> 'name_ar', ''))) < 2 or upper(trim(coalesce(p ->> 'code', ''))) !~ '^[A-Z0-9_]{1,20}$' then
    perform private.fail('invalid_input');
  end if;
  insert into public.lab_test_master as m (id, code, name_ar, name_en, category, specimen_type, unit, reference_range, sort_order, is_active)
  values (coalesce(nullif(p ->> 'id', '')::uuid, gen_random_uuid()), upper(trim(p ->> 'code')), trim(p ->> 'name_ar'),
          nullif(trim(p ->> 'name_en'), ''), nullif(trim(p ->> 'category'), ''), nullif(trim(p ->> 'specimen_type'), ''),
          nullif(trim(p ->> 'unit'), ''), nullif(trim(p ->> 'reference_range'), ''),
          coalesce(nullif(p ->> 'sort_order', '')::int, 100), coalesce((p ->> 'is_active')::boolean, true))
  on conflict (id) do update
    set code = excluded.code, name_ar = excluded.name_ar, name_en = excluded.name_en, category = excluded.category,
        specimen_type = excluded.specimen_type, unit = excluded.unit, reference_range = excluded.reference_range,
        sort_order = excluded.sort_order, is_active = excluded.is_active, updated_at = now()
  returning * into t;
  update public.lab_test_catalog c set master_id = t.id where c.master_id is null and upper(c.code) = t.code;
  return t;
end;
$$;

-- =====================================================================
-- Open orders
-- =====================================================================
create table public.open_lab_orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                      -- e.g. T7K4-92QX (shown and in the QR)
  patient_id uuid not null references public.patients (id),
  encounter_id uuid not null references public.encounters (id),
  practitioner_id uuid not null references public.practitioner_profiles (id),
  facility_id uuid not null references public.facilities (id),
  note text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  cancelled_at timestamptz
);
create index open_lab_orders_patient_idx on public.open_lab_orders (patient_id, created_at desc);

create table public.open_lab_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.open_lab_orders (id),
  master_id uuid references public.lab_test_master (id),
  name text not null,
  status text not null default 'open' check (status in ('open', 'at_lab', 'self_entered', 'cancelled')),
  lab_order_id uuid references public.lab_orders (id),
  lab_facility_id uuid references public.facilities (id),
  claimed_at timestamptz
);
create index open_lab_order_items_order_idx on public.open_lab_order_items (order_id);

-- results the patient typed in from a lab that does not use the platform
create table public.patient_lab_entries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id),
  open_item_id uuid references public.open_lab_order_items (id),
  master_id uuid references public.lab_test_master (id),
  name text not null,
  value_numeric numeric,
  value_text text,
  unit text,
  reference_range text,
  taken_on date not null,
  lab_name text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  check (value_numeric is not null or length(trim(coalesce(value_text, ''))) > 0)
);
create index patient_lab_entries_patient_idx on public.patient_lab_entries (patient_id, taken_on desc);

alter table public.open_lab_orders enable row level security;
alter table public.open_lab_order_items enable row level security;
alter table public.patient_lab_entries enable row level security;
create policy open_lab_orders_read on public.open_lab_orders for select to authenticated
  using (private.is_linked_to_patient(patient_id) or practitioner_id = private.current_practitioner_id());
create policy open_lab_order_items_read on public.open_lab_order_items for select to authenticated
  using (exists (select 1 from public.open_lab_orders o where o.id = order_id
                  and (private.is_linked_to_patient(o.patient_id) or o.practitioner_id = private.current_practitioner_id())));
create policy patient_lab_entries_read on public.patient_lab_entries for select to authenticated
  using (private.can_view_health(patient_id));
grant select on public.open_lab_orders, public.open_lab_order_items, public.patient_lab_entries to authenticated;

create or replace function private.new_open_lab_code()
returns text language plpgsql volatile set search_path = '' as $$
declare
  c text;
begin
  loop
    c := private.random_code(4) || '-' || private.random_code(4);
    exit when not exists (select 1 from public.open_lab_orders where code = c);
  end loop;
  return c;
end;
$$;

-- the doctor orders tests for any lab (items: [{master_id} | {name}])
create or replace function public.create_open_lab_order(p_encounter_id uuid, p_items jsonb, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.encounters;
  o public.open_lab_orders;
  it jsonb;
  m public.lab_test_master;
  n int := 0;
begin
  if not private.is_encounter_author(p_encounter_id) then perform private.fail('forbidden'); end if;
  select * into e from public.encounters where id = p_encounter_id;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then perform private.fail('items_required'); end if;
  insert into public.open_lab_orders (code, patient_id, encounter_id, practitioner_id, facility_id, note, created_by)
  values (private.new_open_lab_code(), e.patient_id, e.id, e.practitioner_id, e.facility_id, nullif(trim(coalesce(p_note, '')), ''), auth.uid())
  returning * into o;
  for it in select * from jsonb_array_elements(p_items) loop
    m := null;
    if nullif(it ->> 'master_id', '') is not null then
      select * into m from public.lab_test_master where id = (it ->> 'master_id')::uuid and is_active;
    end if;
    if m.id is not null then
      insert into public.open_lab_order_items (order_id, master_id, name) values (o.id, m.id, m.name_ar);
      n := n + 1;
    elsif length(trim(coalesce(it ->> 'name', ''))) >= 2 then
      insert into public.open_lab_order_items (order_id, name) values (o.id, left(trim(it ->> 'name'), 120));
      n := n + 1;
    end if;
  end loop;
  if n = 0 then perform private.fail('items_required'); end if;
  perform private.notify_patient(e.patient_id, 'lab.open_order', jsonb_build_object('code', o.code), 'openlab:' || o.id,
                                 array['in_app', 'push']::public.notification_channel[]);
  perform private.audit('open_lab_order.created', 'open_lab_order', o.id, e.facility_id, e.patient_id);
  return jsonb_build_object('id', o.id, 'code', o.code, 'expires_at', o.expires_at, 'items', n);
end;
$$;

create or replace function private.open_lab_order_json(o public.open_lab_orders)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', o.id, 'code', o.code, 'created_at', o.created_at, 'expires_at', o.expires_at, 'note', o.note,
    'expired', o.expires_at < now(), 'cancelled', o.cancelled_at is not null,
    'doctor', pp.full_name, 'clinic', f.name, 'patient_name', pt.full_name, 'patient_id', pt.id, 'public_code', pt.public_code,
    'birth_date', pt.birth_date, 'sex', pt.sex, 'encounter_id', o.encounter_id,
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id, 'name', i.name, 'master_id', i.master_id, 'code', m.code, 'unit', m.unit, 'reference_range', m.reference_range,
        'status', i.status, 'lab', lf.name, 'lab_order_id', i.lab_order_id, 'lab_order_status', lo.status) order by i.name), '[]'::jsonb)
        from public.open_lab_order_items i
        left join public.lab_test_master m on m.id = i.master_id
        left join public.facilities lf on lf.id = i.lab_facility_id
        left join public.lab_orders lo on lo.id = i.lab_order_id
       where i.order_id = o.id))
    from public.practitioner_profiles pp, public.facilities f, public.patients pt
   where pp.id = o.practitioner_id and f.id = o.facility_id and pt.id = o.patient_id;
$$;

-- the patient's open orders (and the last 60 days of finished ones)
create or replace function public.my_open_lab_orders()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(private.open_lab_order_json(o) order by o.created_at desc), '[]'::jsonb)
    from public.open_lab_orders o
   where private.is_linked_to_patient(o.patient_id) and o.created_at > now() - interval '60 days';
$$;

-- the doctor's orders in one session
create or replace function public.encounter_open_lab_orders(p_encounter_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_encounter_author(p_encounter_id) then perform private.fail('forbidden'); end if;
  return coalesce((select jsonb_agg(private.open_lab_order_json(o) order by o.created_at desc)
                     from public.open_lab_orders o where o.encounter_id = p_encounter_id), '[]'::jsonb);
end;
$$;

-- a lab looks the code up: patient, doctor, and each test matched to its own tests and prices
create or replace function public.lab_lookup_open_order(p_lab_facility_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.open_lab_orders;
begin
  if not private.is_lab_staff(p_lab_facility_id) then perform private.fail('forbidden'); end if;
  select * into o from public.open_lab_orders where code = upper(regexp_replace(trim(coalesce(p_code, '')), '^.*[?&]code=', ''));
  if o.id is null then perform private.fail('open_order_not_found'); end if;
  if o.cancelled_at is not null or o.expires_at < now() then perform private.fail('open_order_expired'); end if;
  perform private.audit('open_lab_order.looked_up', 'open_lab_order', o.id, p_lab_facility_id, o.patient_id);
  return private.open_lab_order_json(o) || jsonb_build_object('matches', (
    select coalesce(jsonb_object_agg(i.id, (
      select jsonb_build_object('test_id', c.id, 'name', c.name, 'price_minor', c.price_minor)
        from public.lab_test_catalog c
       where c.lab_facility_id = p_lab_facility_id and c.is_active
         and (c.master_id = i.master_id
              or upper(c.code) = (select m.code from public.lab_test_master m where m.id = i.master_id)
              or lower(trim(c.name)) = lower(trim(i.name)))
       order by (c.master_id = i.master_id) desc nulls last limit 1)), '{}'::jsonb)
      from public.open_lab_order_items i where i.order_id = o.id and i.status = 'open'),
    'lab_tests', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'price_minor', c.price_minor) order by c.name), '[]'::jsonb)
                    from public.lab_test_catalog c where c.lab_facility_id = p_lab_facility_id and c.is_active));
end;
$$;

-- the lab takes the tests it does: p_pick = [{item_id, test_id}]; the rest stays open
create or replace function public.lab_claim_open_order(p_lab_facility_id uuid, p_code text, p_pick jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.open_lab_orders;
  lo public.lab_orders;
  ids uuid[];
  pk jsonb;
  t public.lab_test_catalog;
  i public.open_lab_order_items;
begin
  if not private.is_lab_staff(p_lab_facility_id) then perform private.fail('forbidden'); end if;
  select * into o from public.open_lab_orders where code = upper(trim(coalesce(p_code, ''))) for update;
  if o.id is null then perform private.fail('open_order_not_found'); end if;
  if o.cancelled_at is not null or o.expires_at < now() then perform private.fail('open_order_expired'); end if;
  if jsonb_typeof(p_pick) <> 'array' or jsonb_array_length(p_pick) = 0 then perform private.fail('items_required'); end if;
  for pk in select * from jsonb_array_elements(p_pick) loop
    select * into i from public.open_lab_order_items where id = (pk ->> 'item_id')::uuid and order_id = o.id;
    select * into t from public.lab_test_catalog where id = (pk ->> 'test_id')::uuid and lab_facility_id = p_lab_facility_id and is_active;
    if i.id is null or i.status <> 'open' or t.id is null then perform private.fail('invalid_test'); end if;
    ids := array_append(ids, t.id);
    -- remember the link for next time
    if i.master_id is not null and t.master_id is null then update public.lab_test_catalog set master_id = i.master_id where id = t.id; end if;
  end loop;
  -- the doctor's order arrives as a referral: results go back to that doctor
  lo := private.insert_lab_order(o.patient_id, p_lab_facility_id, 'referral', o.encounter_id, o.practitioner_id, o.facility_id,
                                 (select array_agg(distinct x) from unnest(ids) x), 'open:' || o.id || ':' || p_lab_facility_id || ':' || extract(epoch from now())::bigint,
                                 'طلب مفتوح ' || o.code || coalesce(' — ' || o.note, ''));
  update public.open_lab_order_items
     set status = 'at_lab', lab_order_id = lo.id, lab_facility_id = p_lab_facility_id, claimed_at = now()
   where order_id = o.id and id in (select (x ->> 'item_id')::uuid from jsonb_array_elements(p_pick) x);
  perform private.notify_patient(o.patient_id, 'lab.open_claimed', jsonb_build_object('code', o.code), 'openclaim:' || lo.id,
                                 array['in_app', 'push']::public.notification_channel[]);
  perform private.audit('open_lab_order.claimed', 'open_lab_order', o.id, p_lab_facility_id, o.patient_id, null, jsonb_build_object('lab_order', lo.id));
  return jsonb_build_object('lab_order_id', lo.id, 'order_number', lo.order_number,
                            'left_open', (select count(*) from public.open_lab_order_items where order_id = o.id and status = 'open'));
end;
$$;

-- the patient types in a result from a lab that does not use the platform
create or replace function public.add_self_lab_result(
  p_patient_id uuid,
  p_name text,
  p_value text,
  p_taken_on date,
  p_unit text default null,
  p_reference_range text default null,
  p_lab_name text default null,
  p_master_id uuid default null,
  p_open_item_id uuid default null
) returns public.patient_lab_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.patient_lab_entries;
  m public.lab_test_master;
  i public.open_lab_order_items;
  o public.open_lab_orders;
  v text := trim(coalesce(p_value, ''));
begin
  if not private.is_linked_to_patient(p_patient_id) then perform private.fail('forbidden'); end if;
  if v = '' then perform private.fail('invalid_input'); end if;
  if p_taken_on is null or p_taken_on > current_date + 1 or p_taken_on < current_date - 3650 then perform private.fail('invalid_date'); end if;
  if p_open_item_id is not null then
    select * into i from public.open_lab_order_items where id = p_open_item_id;
    select * into o from public.open_lab_orders where id = i.order_id;
    if i.id is null or o.patient_id <> p_patient_id or i.status <> 'open' then perform private.fail('invalid_test'); end if;
  end if;
  select * into m from public.lab_test_master where id = coalesce(p_master_id, i.master_id);
  if length(trim(coalesce(m.name_ar, i.name, p_name, ''))) < 2 then perform private.fail('invalid_input'); end if;
  insert into public.patient_lab_entries (patient_id, open_item_id, master_id, name, value_numeric, value_text, unit, reference_range,
                                          taken_on, lab_name, created_by)
  values (p_patient_id, i.id, m.id, coalesce(m.name_ar, i.name, trim(p_name)),
          case when replace(v, ',', '.') ~ '^-?\d+(\.\d+)?$' then replace(v, ',', '.')::numeric end,
          case when replace(v, ',', '.') ~ '^-?\d+(\.\d+)?$' then null else left(v, 200) end,
          coalesce(nullif(trim(coalesce(p_unit, '')), ''), m.unit), coalesce(nullif(trim(coalesce(p_reference_range, '')), ''), m.reference_range),
          p_taken_on, nullif(trim(coalesce(p_lab_name, '')), ''), auth.uid())
  returning * into r;
  if i.id is not null then
    update public.open_lab_order_items set status = 'self_entered', claimed_at = now() where id = i.id;
    perform private.notify_user((select user_id from public.practitioner_profiles where id = o.practitioner_id), 'lab.patient_entered',
                                jsonb_build_object('code', o.code), 'selfres:' || r.id, array['in_app', 'push']::public.notification_channel[]);
  end if;
  return r;
end;
$$;

create or replace function public.delete_self_lab_result(p_entry_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r public.patient_lab_entries;
begin
  select * into r from public.patient_lab_entries where id = p_entry_id;
  if r.id is null or not private.is_linked_to_patient(r.patient_id) or r.created_by <> auth.uid() then perform private.fail('forbidden'); end if;
  delete from public.patient_lab_entries where id = r.id;
  update public.open_lab_order_items set status = 'open', claimed_at = null where id = r.open_item_id and status = 'self_entered';
end;
$$;

-- trends now include what the patient entered (marked as such), grouped by catalogue code
create or replace function private.lab_trends(p_patient_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(t order by t.latest_at desc), '[]'::jsonb) from (
    select g.key, max(g.name) as name, max(g.released_at) as latest_at,
           (array_agg(g.unit order by g.released_at desc))[1] as unit,
           (array_agg(g.reference_range order by g.released_at desc))[1] as reference_range,
           jsonb_agg(jsonb_build_object('value_numeric', g.value_numeric, 'value_text', g.value_text, 'flag', g.lab_flag,
                                        'released_at', g.released_at, 'lab', g.lab, 'order_id', g.order_id,
                                        'source', g.source, 'entry_id', g.entry_id)
                     order by g.released_at desc) as points
      from (select coalesce(m.code, upper(c.code), i.display_name) as key, i.display_name as name, r.value_numeric, r.value_text,
                   coalesce(r.unit, c.unit) as unit, coalesce(r.reference_range, c.reference_range_text) as reference_range,
                   r.lab_flag, r.released_at, f.name as lab, o.id as order_id, 'lab' as source, null::uuid as entry_id
              from public.lab_results r
              join public.lab_order_items i on i.id = r.order_item_id
              join public.lab_orders o on o.id = i.order_id
              join public.facilities f on f.id = o.lab_facility_id
              left join public.lab_test_catalog c on c.id = i.test_id
              left join public.lab_test_master m on m.id = c.master_id
             where o.patient_id = p_patient_id and r.status = 'released'
            union all
            select coalesce(m.code, e.name), e.name, e.value_numeric, e.value_text, e.unit, e.reference_range,
                   null, (e.taken_on + time '12:00')::timestamptz, coalesce(e.lab_name, 'أدخلها المريض'), null, 'patient', e.id
              from public.patient_lab_entries e
              left join public.lab_test_master m on m.id = e.master_id
             where e.patient_id = p_patient_id) g
     group by g.key) t;
$$;

revoke execute on function public.upsert_lab_test_master(jsonb), public.create_open_lab_order(uuid, jsonb, text), public.my_open_lab_orders(),
  public.encounter_open_lab_orders(uuid), public.lab_lookup_open_order(uuid, text), public.lab_claim_open_order(uuid, text, jsonb),
  public.add_self_lab_result(uuid, text, text, date, text, text, text, uuid, uuid), public.delete_self_lab_result(uuid) from public, anon;
grant execute on function public.upsert_lab_test_master(jsonb), public.create_open_lab_order(uuid, jsonb, text), public.my_open_lab_orders(),
  public.encounter_open_lab_orders(uuid), public.lab_lookup_open_order(uuid, text), public.lab_claim_open_order(uuid, text, jsonb),
  public.add_self_lab_result(uuid, text, text, date, text, text, text, uuid, uuid), public.delete_self_lab_result(uuid) to authenticated;
