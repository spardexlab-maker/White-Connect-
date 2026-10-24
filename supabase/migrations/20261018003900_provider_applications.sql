-- «استمارة انضمام طبيب» (owner request, 24 Oct 2026): a real doctor fills in
-- an online form (no account needed); the platform admin reviews it, contacts
-- the doctor and then creates the clinic and the doctor's account with the
-- existing admin tools. Photo and certificates are uploaded by the doctor from
-- «ملفي المهني» once the account is active, so the public form takes no files.

create table public.provider_applications (
  id uuid primary key default gen_random_uuid(),
  application_number text not null unique default ('J' || private.random_code(6)),
  kind text not null default 'doctor' check (kind in ('doctor', 'laboratory', 'pharmacy')),
  full_name text not null check (length(trim(full_name)) between 3 and 120),
  title text,                                    -- د. / أ.د. / استشاري …
  specialty_id uuid references public.specialties (id),
  specialty_other text,
  sub_specialty text,
  license_number text not null check (length(trim(license_number)) between 2 and 40),   -- رقم إجازة ممارسة المهنة / النقابة
  graduation_year int check (graduation_year between 1950 and 2100),
  qualifications text,                           -- الشهادات (بورد، ماجستير …)
  years_experience int check (years_experience between 0 and 70),
  phone text not null check (length(trim(phone)) between 7 and 20),
  whatsapp text,
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  gender text check (gender in ('male', 'female')),
  clinic_name text not null check (length(trim(clinic_name)) between 2 and 120),
  city_id uuid references public.cities (id),
  area text,
  address text not null check (length(trim(address)) >= 5),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  clinic_phone text,
  working_hours text,                            -- e.g. السبت–الخميس 4–9 م
  services jsonb not null default '[]'::jsonb,   -- [{name, price, minutes}]
  consultation_fee_minor bigint check (consultation_fee_minor >= 0),
  appointment_minutes int check (appointment_minutes between 5 and 180),
  accepts_walk_in boolean not null default true,
  bio text,
  languages text,
  notes text,
  consent boolean not null check (consent),      -- confirms the information is correct and may be shown to patients
  status text not null default 'new' check (status in ('new', 'contacted', 'approved', 'rejected')),
  admin_note text,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  submitted_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1,
  check (specialty_id is not null or length(trim(coalesce(specialty_other, ''))) > 1 or kind <> 'doctor'),
  check (jsonb_typeof(services) = 'array' and jsonb_array_length(services) <= 30)
);
create index provider_applications_status_idx on public.provider_applications (status, created_at desc);
create trigger provider_applications_touch before update on public.provider_applications
  for each row execute function private.touch_row();
alter table public.provider_applications enable row level security;
create policy provider_applications_admin on public.provider_applications for select to authenticated using (private.is_platform_admin());
grant select on public.provider_applications to authenticated;

-- public: anyone (signed in or not) can submit; light limits stop floods
create or replace function public.submit_provider_application(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.provider_applications;
  svc jsonb;
  admin_id uuid;
begin
  if coalesce(p ->> 'website', '') <> '' then perform private.fail('invalid_input'); end if;      -- hidden field: bots fill it
  if (select count(*) from public.provider_applications where created_at > now() - interval '1 hour') >= 30 then
    perform private.fail('rate_limited');
  end if;
  if exists (select 1 from public.provider_applications where phone = trim(p ->> 'phone') and created_at > now() - interval '1 day') then
    perform private.fail('application_duplicate');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('name', left(trim(x ->> 'name'), 80),
                                               'price', case when (x ->> 'price') ~ '^\d{1,9}$' then (x ->> 'price')::bigint end,
                                               'minutes', case when (x ->> 'minutes') ~ '^\d{1,3}$' then (x ->> 'minutes')::int end)), '[]'::jsonb)
    into svc
    from jsonb_array_elements(case when jsonb_typeof(p -> 'services') = 'array' then p -> 'services' else '[]'::jsonb end) x
   where length(trim(coalesce(x ->> 'name', ''))) > 1;

  insert into public.provider_applications (
    kind, full_name, title, specialty_id, specialty_other, sub_specialty, license_number, graduation_year, qualifications, years_experience,
    phone, whatsapp, email, gender, clinic_name, city_id, area, address, latitude, longitude, clinic_phone, working_hours, services,
    consultation_fee_minor, appointment_minutes, accepts_walk_in, bio, languages, notes, consent, submitted_by)
  values (
    coalesce(nullif(p ->> 'kind', ''), 'doctor'), trim(p ->> 'full_name'), nullif(trim(p ->> 'title'), ''),
    nullif(p ->> 'specialty_id', '')::uuid, nullif(trim(p ->> 'specialty_other'), ''), nullif(trim(p ->> 'sub_specialty'), ''),
    trim(p ->> 'license_number'), nullif(p ->> 'graduation_year', '')::int, nullif(trim(p ->> 'qualifications'), ''),
    nullif(p ->> 'years_experience', '')::int, trim(p ->> 'phone'), nullif(trim(p ->> 'whatsapp'), ''), nullif(lower(trim(p ->> 'email')), ''),
    nullif(p ->> 'gender', ''), trim(p ->> 'clinic_name'), nullif(p ->> 'city_id', '')::uuid, nullif(trim(p ->> 'area'), ''),
    trim(p ->> 'address'), nullif(p ->> 'latitude', '')::double precision, nullif(p ->> 'longitude', '')::double precision,
    nullif(trim(p ->> 'clinic_phone'), ''), nullif(trim(p ->> 'working_hours'), ''), svc,
    nullif(p ->> 'consultation_fee_minor', '')::bigint, nullif(p ->> 'appointment_minutes', '')::int,
    coalesce((p ->> 'accepts_walk_in')::boolean, true), nullif(trim(p ->> 'bio'), ''), nullif(trim(p ->> 'languages'), ''),
    nullif(trim(p ->> 'notes'), ''), coalesce((p ->> 'consent')::boolean, false), auth.uid())
  returning * into a;

  for admin_id in select pa.user_id from public.platform_admins pa where pa.revoked_at is null loop
    perform private.notify_user(admin_id, 'application.new', jsonb_build_object('application_number', a.application_number),
                                'app:' || a.id, array['in_app', 'push']::public.notification_channel[]);
  end loop;
  return jsonb_build_object('application_number', a.application_number);
exception
  when check_violation or not_null_violation or invalid_text_representation then
    perform private.fail('application_invalid');
end;
$$;

-- admin: review and note
create or replace function public.review_provider_application(p_id uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then perform private.fail('forbidden'); end if;
  if p_status not in ('new', 'contacted', 'approved', 'rejected') then perform private.fail('invalid_input'); end if;
  update public.provider_applications
     set status = p_status, admin_note = coalesce(nullif(trim(coalesce(p_note, '')), ''), admin_note),
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id;
  perform private.audit('provider_application.' || p_status, 'provider_application', p_id, null, null, p_note);
end;
$$;

revoke execute on function public.submit_provider_application(jsonb), public.review_provider_application(uuid, text, text) from public;
grant execute on function public.submit_provider_application(jsonb) to anon, authenticated;
grant execute on function public.review_provider_application(uuid, text, text) to authenticated;
