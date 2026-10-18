-- =====================================================================
-- 0003 Patients: medical identity separate from login accounts,
-- public codes, rotatable QR tokens, account links, care relationships,
-- consent grants, staff lookup, link codes and audited merge.
--
-- Spec §1, §4: a patient can exist without an account; name is the only
-- mandatory field; phone is NOT unique and never auto-merges; QR holds
-- a random revocable token only; knowing a patient_id grants nothing.
-- =====================================================================

create type public.patient_sex as enum ('female', 'male');
create type public.patient_record_status as enum ('active', 'merged', 'deceased', 'inactive');

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  public_code text not null unique default ('P' || private.random_code(9)),
  full_name text not null check (length(trim(full_name)) between 1 and 200),
  sex public.patient_sex,
  birth_date date,
  birth_year int check (birth_year between 1900 and 2100),
  phone text,
  city_id uuid references public.cities (id),
  is_provisional boolean not null default false,
  status public.patient_record_status not null default 'active',
  merged_into uuid references public.patients (id),
  created_by uuid references public.profiles (id),
  created_at_facility_id uuid references public.facilities (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1,
  check ((status = 'merged') = (merged_into is not null)),
  check (merged_into is distinct from id)
);
create index patients_phone_idx on public.patients (phone) where phone is not null;
create index patients_name_idx on public.patients (lower(full_name));
create trigger patients_touch before update on public.patients
  for each row execute function private.touch_row();

-- Login account ↔ patient record (self or guardian of a dependant).
create table public.patient_account_links (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id),
  user_id uuid not null references public.profiles (id),
  relationship text not null check (relationship in ('self', 'guardian')),
  verified_at timestamptz,
  verified_method text check (verified_method in ('self_registration', 'in_person_code', 'admin')),
  verified_by uuid references public.profiles (id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (patient_id, user_id)
);
-- an account has at most one active "self" record
create unique index patient_links_one_self on public.patient_account_links (user_id)
  where relationship = 'self' and revoked_at is null;
-- a record is "self" for at most one account
create unique index patient_links_one_owner on public.patient_account_links (patient_id)
  where relationship = 'self' and revoked_at is null;

create table public.patient_identifiers (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id),
  kind text not null check (kind in ('national_id', 'passport', 'other')),
  value text not null,
  verified_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (kind, value)
);

-- QR: random token; only its hash is stored. Rotation revokes the old one.
create table public.patient_qr_tokens (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id),
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index patient_qr_one_active on public.patient_qr_tokens (patient_id) where revoked_at is null;

-- One-time code a patient shows at reception to link a provisional record.
create table private.account_link_codes (
  code_hash text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz
);

-- Treatment relationship: which facility / practitioner legitimately
-- treats this patient. Created by bookings, walk-ins, referrals.
create table public.care_relationships (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id),
  facility_id uuid not null references public.facilities (id),
  practitioner_id uuid references public.practitioner_profiles (id),
  source text not null check (source in ('appointment', 'walk_in', 'referral', 'lab_visit', 'pharmacy', 'registration')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create unique index care_rel_unique on public.care_relationships
  (patient_id, facility_id, coalesce(practitioner_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where ended_at is null;
create index care_rel_patient_idx on public.care_relationships (patient_id);

-- Explicit sharing by the patient (§16).
create table public.consent_grants (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id),
  grantee_facility_id uuid references public.facilities (id),
  grantee_practitioner_id uuid references public.practitioner_profiles (id),
  scope text not null check (scope in ('full_history', 'encounter', 'lab_result', 'prescription')),
  resource_id uuid,
  purpose text not null,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  granted_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  check (grantee_facility_id is not null or grantee_practitioner_id is not null),
  check (scope = 'full_history' or resource_id is not null),
  check (expires_at is null or expires_at > starts_at)
);
create index consent_patient_idx on public.consent_grants (patient_id);

-- =====================================================================
-- Patient authorization helpers
-- =====================================================================

-- Records the current account may act for (self + verified dependants).
create or replace function private.is_linked_to_patient(p_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.patient_account_links l
     where l.patient_id = p_patient_id and l.user_id = auth.uid()
       and l.revoked_at is null and l.verified_at is not null
  );
$$;

-- Staff of a facility that has a care relationship with the patient may
-- see IDENTITY (name, code, phone, age) — never clinical notes.
create or replace function private.staff_can_see_identity(p_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.care_relationships c
     where c.patient_id = p_patient_id and c.ended_at is null
       and private.is_member_of_facility(c.facility_id)
  );
$$;

-- Clinical visibility for a practitioner: own care relationship (at a
-- facility where they currently work) or a live consent grant.
create or replace function private.practitioner_can_see_clinical(p_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_practitioner_id() is not null and (
    exists (
      select 1 from public.care_relationships c
       where c.patient_id = p_patient_id and c.ended_at is null
         and c.practitioner_id = private.current_practitioner_id()
         and private.has_facility_role(c.facility_id, array['doctor']::public.member_role[])
    )
    or exists (
      select 1 from public.consent_grants g
       where g.patient_id = p_patient_id and g.scope = 'full_history'
         and g.revoked_at is null and g.starts_at <= now()
         and (g.expires_at is null or g.expires_at > now())
         and (g.grantee_practitioner_id = private.current_practitioner_id()
              or (g.grantee_facility_id is not null
                  and private.has_facility_role(g.grantee_facility_id, array['doctor']::public.member_role[])))
    )
  );
$$;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.patients enable row level security;
alter table public.patient_account_links enable row level security;
alter table public.patient_identifiers enable row level security;
alter table public.patient_qr_tokens enable row level security;
alter table public.care_relationships enable row level security;
alter table public.consent_grants enable row level security;
alter table private.account_link_codes enable row level security;

create policy patients_read on public.patients for select to authenticated
  using (private.is_linked_to_patient(id) or private.staff_can_see_identity(id));
-- Writes go through RPCs only (no direct insert/update grants).

create policy patient_links_read on public.patient_account_links for select to authenticated
  using (user_id = auth.uid());

create policy patient_identifiers_read on public.patient_identifiers for select to authenticated
  using (private.is_linked_to_patient(patient_id) or private.staff_can_see_identity(patient_id));

create policy patient_qr_read on public.patient_qr_tokens for select to authenticated
  using (private.is_linked_to_patient(patient_id));

create policy care_rel_read on public.care_relationships for select to authenticated
  using (private.is_linked_to_patient(patient_id) or private.is_member_of_facility(facility_id));

create policy consent_read on public.consent_grants for select to authenticated
  using (private.is_linked_to_patient(patient_id)
         or (grantee_practitioner_id is not null and grantee_practitioner_id = private.current_practitioner_id())
         or (grantee_facility_id is not null and private.is_member_of_facility(grantee_facility_id)));

grant select on public.patients, public.patient_account_links, public.patient_identifiers,
  public.patient_qr_tokens, public.care_relationships, public.consent_grants to authenticated;

-- =====================================================================
-- RPCs
-- =====================================================================

-- Patient self-registration: creates the account's own medical record.
create or replace function public.register_self_patient(
  p_full_name text,
  p_sex public.patient_sex default null,
  p_birth_date date default null,
  p_phone text default null,
  p_city_id uuid default null
) returns public.patients
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.patients;
begin
  if auth.uid() is null or not private.account_active() then
    perform private.fail('not_authenticated');
  end if;
  if exists (select 1 from public.patient_account_links
              where user_id = auth.uid() and relationship = 'self' and revoked_at is null) then
    perform private.fail('self_record_exists');
  end if;
  if p_full_name is null or length(trim(p_full_name)) = 0 then
    perform private.fail('name_required');
  end if;

  insert into public.patients (full_name, sex, birth_date, birth_year, phone, city_id, created_by)
  values (trim(p_full_name), p_sex, p_birth_date, extract(year from p_birth_date)::int,
          nullif(trim(p_phone), ''), p_city_id, auth.uid())
  returning * into rec;

  insert into public.patient_account_links (patient_id, user_id, relationship, verified_at, verified_method)
  values (rec.id, auth.uid(), 'self', now(), 'self_registration');

  perform private.audit('patient.self_registered', 'patient', rec.id, null, rec.id);
  return rec;
end;
$$;

-- Reception: provisional record with NAME ONLY (everything else optional).
create or replace function private.create_provisional_patient_internal(
  p_facility_id uuid,
  p_full_name text,
  p_phone text,
  p_sex public.patient_sex,
  p_birth_year int
) returns public.patients
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.patients;
begin
  if p_full_name is null or length(trim(p_full_name)) = 0 then
    perform private.fail('name_required');
  end if;
  insert into public.patients (full_name, phone, sex, birth_year, is_provisional, created_by, created_at_facility_id)
  values (trim(p_full_name), nullif(trim(p_phone), ''), p_sex, p_birth_year, true, auth.uid(), p_facility_id)
  returning * into rec;

  insert into public.care_relationships (patient_id, facility_id, source, created_by)
  values (rec.id, p_facility_id, 'registration', auth.uid());

  perform private.audit('patient.provisional_created', 'patient', rec.id, p_facility_id, rec.id);
  return rec;
end;
$$;

create or replace function public.create_provisional_patient(
  p_facility_id uuid,
  p_full_name text,
  p_phone text default null,
  p_sex public.patient_sex default null,
  p_birth_year int default null
) returns public.patients
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_facility_role(p_facility_id,
       array['receptionist', 'doctor', 'facility_admin', 'lab_technician', 'lab_approver', 'pharmacist']::public.member_role[]) then
    perform private.fail('forbidden');
  end if;
  return private.create_provisional_patient_internal(p_facility_id, p_full_name, p_phone, p_sex, p_birth_year);
end;
$$;

-- Masks a phone for verification displays: keeps last 3 digits.
create or replace function private.mask_phone(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p is null then null
              when length(p) <= 3 then '***'
              else repeat('•', greatest(length(p) - 3, 0)) || right(p, 3) end;
$$;

-- Staff lookup by phone / public code / QR token / name.
-- Returns minimal verification data; never auto-selects; rate limited
-- and audited. Does NOT create access to the clinical record.
create or replace function public.lookup_patients(
  p_facility_id uuid,
  p_query text,
  p_kind text default 'auto'   -- auto | phone | code | qr | name
) returns table (
  patient_id uuid,
  public_code text,
  full_name text,
  sex public.patient_sex,
  birth_year int,
  phone_masked text,
  is_provisional boolean,
  has_account boolean,
  known_here boolean
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  q text := trim(coalesce(p_query, ''));
  kind text := p_kind;
  limit_per_min int;
begin
  if not private.has_facility_role(p_facility_id,
       array['receptionist', 'doctor', 'facility_admin', 'lab_technician', 'lab_approver', 'pharmacist', 'pharmacy_staff']::public.member_role[]) then
    perform private.fail('forbidden');
  end if;
  if length(q) < 3 then
    perform private.fail('query_too_short');
  end if;
  select lookup_rate_limit_per_minute into limit_per_min from public.platform_settings;
  perform private.enforce_rate_limit('patient_lookup', limit_per_min);

  if kind = 'auto' then
    kind := case
      when q ~ '^P[0-9A-Z]{9}$' then 'code'
      when q ~ '^[+0-9 ()-]{6,}$' then 'phone'
      when q ~ '^qr_' then 'qr'
      else 'name' end;
  end if;

  perform private.audit('patient.lookup', 'facility', p_facility_id, p_facility_id, null, null,
                        jsonb_build_object('kind', kind));

  return query
  select p.id, p.public_code, p.full_name, p.sex,
         coalesce(p.birth_year, extract(year from p.birth_date)::int),
         private.mask_phone(p.phone), p.is_provisional,
         exists (select 1 from public.patient_account_links l where l.patient_id = p.id and l.revoked_at is null),
         exists (select 1 from public.care_relationships c where c.patient_id = p.id and c.facility_id = p_facility_id and c.ended_at is null)
    from public.patients p
   where p.status = 'active'
     and case kind
           when 'code'  then p.public_code = upper(q)
           when 'phone' then regexp_replace(p.phone, '[^0-9]', '', 'g') = regexp_replace(q, '[^0-9]', '', 'g')
           when 'qr'    then p.id = (select t.patient_id from public.patient_qr_tokens t
                                       where t.token_hash = private.sha256_hex(q) and t.revoked_at is null)
           -- name search is restricted to patients already known to this facility
           else lower(p.full_name) like '%' || lower(q) || '%'
                and exists (select 1 from public.care_relationships c
                             where c.patient_id = p.id and c.facility_id = p_facility_id and c.ended_at is null)
         end
   order by p.full_name
   limit 20;
end;
$$;

-- Staff confirms they verified the person (in-person) and attaches the
-- patient to their facility → creates a care relationship (identity only).
create or replace function public.attach_patient_to_facility(
  p_facility_id uuid,
  p_patient_id uuid,
  p_verification_note text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_facility_role(p_facility_id,
       array['receptionist', 'doctor', 'facility_admin', 'lab_technician', 'lab_approver', 'pharmacist']::public.member_role[]) then
    perform private.fail('forbidden');
  end if;
  if p_verification_note is null or length(trim(p_verification_note)) < 3 then
    perform private.fail('verification_required');
  end if;
  if not exists (select 1 from public.patients where id = p_patient_id and status = 'active') then
    perform private.fail('patient_not_found');
  end if;
  insert into public.care_relationships (patient_id, facility_id, source, created_by)
  values (p_patient_id, p_facility_id, 'registration', auth.uid())
  on conflict do nothing;
  perform private.audit('patient.attached', 'patient', p_patient_id, p_facility_id, p_patient_id, p_verification_note);
end;
$$;

-- Patient (or guardian) rotates the QR token. Returns the raw token ONCE.
create or replace function public.rotate_patient_qr(p_patient_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw text := 'qr_' || encode(extensions.gen_random_bytes(24), 'hex');
begin
  if not private.is_linked_to_patient(p_patient_id) then
    perform private.fail('forbidden');
  end if;
  update public.patient_qr_tokens set revoked_at = now()
   where patient_id = p_patient_id and revoked_at is null;
  insert into public.patient_qr_tokens (patient_id, token_hash) values (p_patient_id, private.sha256_hex(raw));
  perform private.audit('patient.qr_rotated', 'patient', p_patient_id, null, p_patient_id);
  return raw;
end;
$$;

-- Patient creates a short-lived code to prove account ownership at the desk.
create or replace function public.create_account_link_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw text := private.random_code(8);
begin
  if auth.uid() is null then perform private.fail('not_authenticated'); end if;
  delete from private.account_link_codes where user_id = auth.uid() and used_at is null;
  insert into private.account_link_codes (code_hash, user_id, expires_at)
  values (private.sha256_hex(raw), auth.uid(), now() + interval '15 minutes');
  return raw;
end;
$$;

-- Generic, audited merge of a duplicate record into a target record.
-- Re-points EVERY foreign key that references patients(id) (discovered
-- from the catalog, so later modules are covered automatically), keeps
-- the source row as status='merged' for traceability.
create or replace function private.merge_patients_internal(p_source uuid, p_target uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  fk record;
begin
  if p_source = p_target then perform private.fail('same_patient'); end if;
  perform 1 from public.patients where id in (p_source, p_target) for update;
  if (select count(*) from public.patients where id in (p_source, p_target) and status = 'active') <> 2 then
    perform private.fail('patient_not_found');
  end if;

  -- conflicting unique rows: drop duplicates that already exist on target
  delete from public.care_relationships s
   where s.patient_id = p_source and exists (
     select 1 from public.care_relationships t
      where t.patient_id = p_target and t.facility_id = s.facility_id
        and t.practitioner_id is not distinct from s.practitioner_id and t.ended_at is null);
  -- QR tokens and account links stay on the source row (revoked); a
  -- guardian link that does not exist on the target moves over.
  update public.patient_qr_tokens set revoked_at = now() where patient_id = p_source and revoked_at is null;
  update public.patient_account_links s set patient_id = p_target
   where s.patient_id = p_source and s.revoked_at is null and s.relationship = 'guardian'
     and not exists (select 1 from public.patient_account_links t where t.patient_id = p_target and t.user_id = s.user_id);
  update public.patient_account_links set revoked_at = now()
   where patient_id = p_source and revoked_at is null;

  for fk in
    select n.nspname as sch, c.relname as tbl, a.attname as col
      from pg_constraint k
      join pg_class c on c.oid = k.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
     where k.contype = 'f' and k.confrelid = 'public.patients'::regclass
       and array_length(k.conkey, 1) = 1
       and not (c.relname = 'patients' and a.attname = 'merged_into')
       and c.relname not in ('patient_account_links', 'patient_qr_tokens')
  loop
    execute format('update %I.%I set %I = $1 where %I = $2', fk.sch, fk.tbl, fk.col, fk.col)
      using p_target, p_source;
  end loop;

  update public.patients set status = 'merged', merged_into = p_target where id = p_source;
  perform private.audit('patient.merged', 'patient', p_target, null, p_target, p_reason,
                        jsonb_build_object('source_patient_id', p_source));
end;
$$;

-- Staff links a provisional record to a patient's account after in-person
-- verification + the one-time code shown in the patient's app. If the
-- account already owns a record, the provisional one is merged into it.
create or replace function public.link_patient_with_code(
  p_facility_id uuid,
  p_patient_id uuid,
  p_code text,
  p_verification_note text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
  existing uuid;
begin
  if not private.has_facility_role(p_facility_id,
       array['receptionist', 'doctor', 'facility_admin', 'lab_technician', 'lab_approver']::public.member_role[]) then
    perform private.fail('forbidden');
  end if;
  if not private.staff_can_see_identity(p_patient_id) then
    perform private.fail('forbidden');
  end if;
  if p_verification_note is null or length(trim(p_verification_note)) < 3 then
    perform private.fail('verification_required');
  end if;

  update private.account_link_codes set used_at = now()
   where code_hash = private.sha256_hex(upper(trim(p_code))) and used_at is null and expires_at > now()
   returning user_id into owner_id;
  if owner_id is null then perform private.fail('invalid_or_expired_code'); end if;

  select patient_id into existing from public.patient_account_links
   where user_id = owner_id and relationship = 'self' and revoked_at is null;

  if existing is null then
    insert into public.patient_account_links (patient_id, user_id, relationship, verified_at, verified_method, verified_by)
    values (p_patient_id, owner_id, 'self', now(), 'in_person_code', auth.uid());
    update public.patients set is_provisional = false where id = p_patient_id;
    perform private.audit('patient.account_linked', 'patient', p_patient_id, p_facility_id, p_patient_id, p_verification_note);
    return p_patient_id;
  elsif existing = p_patient_id then
    return p_patient_id;
  else
    perform private.merge_patients_internal(p_patient_id, existing, p_verification_note);
    insert into public.care_relationships (patient_id, facility_id, source, created_by)
    values (existing, p_facility_id, 'registration', auth.uid()) on conflict do nothing;
    return existing;
  end if;
end;
$$;

-- Explicit merge of two records both visible to a facility admin.
create or replace function public.merge_patients(
  p_facility_id uuid,
  p_source uuid,
  p_target uuid,
  p_reason text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_admin_facility(p_facility_id) then perform private.fail('forbidden'); end if;
  if not exists (select 1 from public.care_relationships where patient_id = p_source and facility_id = p_facility_id and ended_at is null)
     or not exists (select 1 from public.care_relationships where patient_id = p_target and facility_id = p_facility_id and ended_at is null) then
    perform private.fail('forbidden');
  end if;
  if p_reason is null or length(trim(p_reason)) < 5 then perform private.fail('reason_required'); end if;
  perform private.merge_patients_internal(p_source, p_target, p_reason);
end;
$$;

-- Patient shares their history with a facility / practitioner.
create or replace function public.grant_consent(
  p_patient_id uuid,
  p_scope text,
  p_purpose text,
  p_facility_id uuid default null,
  p_practitioner_id uuid default null,
  p_resource_id uuid default null,
  p_expires_at timestamptz default null
) returns public.consent_grants
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.consent_grants;
begin
  if not private.is_linked_to_patient(p_patient_id) then perform private.fail('forbidden'); end if;
  insert into public.consent_grants (patient_id, grantee_facility_id, grantee_practitioner_id, scope, resource_id, purpose, expires_at, granted_by)
  values (p_patient_id, p_facility_id, p_practitioner_id, p_scope, p_resource_id, p_purpose, p_expires_at, auth.uid())
  returning * into rec;
  perform private.audit('consent.granted', 'consent_grant', rec.id, p_facility_id, p_patient_id, null,
                        jsonb_build_object('scope', p_scope));
  return rec;
end;
$$;

create or replace function public.revoke_consent(p_consent_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  pid uuid;
begin
  select patient_id into pid from public.consent_grants where id = p_consent_id;
  if pid is null or not private.is_linked_to_patient(pid) then perform private.fail('forbidden'); end if;
  update public.consent_grants set revoked_at = now() where id = p_consent_id and revoked_at is null;
  perform private.audit('consent.revoked', 'consent_grant', p_consent_id, null, pid);
end;
$$;

-- ---------------------------------------------------------------------
-- Execute grants
-- ---------------------------------------------------------------------
revoke execute on function
  public.register_self_patient(text, public.patient_sex, date, text, uuid),
  public.create_provisional_patient(uuid, text, text, public.patient_sex, int),
  public.lookup_patients(uuid, text, text),
  public.attach_patient_to_facility(uuid, uuid, text),
  public.rotate_patient_qr(uuid),
  public.create_account_link_code(),
  public.link_patient_with_code(uuid, uuid, text, text),
  public.merge_patients(uuid, uuid, uuid, text),
  public.grant_consent(uuid, text, text, uuid, uuid, uuid, timestamptz),
  public.revoke_consent(uuid)
from public, anon;
grant execute on function
  public.register_self_patient(text, public.patient_sex, date, text, uuid),
  public.create_provisional_patient(uuid, text, text, public.patient_sex, int),
  public.lookup_patients(uuid, text, text),
  public.attach_patient_to_facility(uuid, uuid, text),
  public.rotate_patient_qr(uuid),
  public.create_account_link_code(),
  public.link_patient_with_code(uuid, uuid, text, text),
  public.merge_patients(uuid, uuid, uuid, text),
  public.grant_consent(uuid, text, text, uuid, uuid, uuid, timestamptz),
  public.revoke_consent(uuid)
to authenticated;
