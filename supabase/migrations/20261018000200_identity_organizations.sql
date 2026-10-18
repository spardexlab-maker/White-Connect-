-- =====================================================================
-- 0002 Identity, organizations, facilities, memberships, practitioners,
-- invitations, platform admins.
--
-- Key rules (spec §2, §3, §21):
--   * A login account (auth.users / profiles) is NOT a patient record.
--   * Roles are bound to an organization/facility via memberships, never
--     to the user alone. No self-service role selection.
--   * A practitioner has ONE professional identity and can work at many
--     facilities (one doctor membership per facility).
--   * Platform admins manage the platform but get NO implicit access to
--     medical records.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Catalogs (global, not tenant-scoped)
-- ---------------------------------------------------------------------
create table public.cities (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  name_en text,
  country_code text not null default 'IQ',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (country_code, name_ar)
);

create table public.specialties (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_ar text not null,
  name_en text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Profiles (one per auth account)
-- ---------------------------------------------------------------------
create type public.account_status as enum ('active', 'suspended');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  locale text not null default 'ar' check (locale in ('ar', 'en')),
  status public.account_status not null default 'active',
  suspended_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1
);
create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_row();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', null))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

create table public.platform_admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  granted_by uuid references public.profiles (id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);

-- ---------------------------------------------------------------------
-- Organizations → branches → facilities
-- ---------------------------------------------------------------------
create type public.entity_status as enum ('pending', 'active', 'suspended', 'closed');
create type public.facility_type as enum ('clinic', 'pharmacy', 'laboratory');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  kind text not null default 'medical_complex' check (kind in ('medical_complex', 'independent')),
  status public.entity_status not null default 'pending',
  verified_at timestamptz,
  verified_by uuid references public.profiles (id),
  status_reason text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1
);
create trigger organizations_touch before update on public.organizations
  for each row execute function private.touch_row();

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null,
  city_id uuid references public.cities (id),
  area text,
  address text,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  timezone text not null default 'Asia/Baghdad',
  status public.entity_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1,
  unique (id, organization_id)
);
create index branches_org_idx on public.branches (organization_id);
create trigger branches_touch before update on public.branches
  for each row execute function private.touch_row();

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  branch_id uuid not null,
  type public.facility_type not null,
  name text not null check (length(trim(name)) > 0),
  description text,
  phone text,
  opening_hours_note text,
  is_public boolean not null default true,
  status public.entity_status not null default 'pending',
  status_reason text,
  -- defaults used when a doctor at this clinic refers out (§2)
  default_pharmacy_id uuid references public.facilities (id),
  default_lab_id uuid references public.facilities (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1,
  -- the branch must belong to the same organization
  foreign key (branch_id, organization_id) references public.branches (id, organization_id),
  unique (id, organization_id),
  check (type = 'clinic' or (default_pharmacy_id is null and default_lab_id is null))
);
create index facilities_org_idx on public.facilities (organization_id);
create index facilities_branch_idx on public.facilities (branch_id);
create trigger facilities_touch before update on public.facilities
  for each row execute function private.touch_row();

create or replace function private.check_facility_defaults()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.default_pharmacy_id is not null and not exists (
       select 1 from public.facilities f where f.id = new.default_pharmacy_id and f.type = 'pharmacy') then
    perform private.fail('invalid_default_pharmacy');
  end if;
  if new.default_lab_id is not null and not exists (
       select 1 from public.facilities f where f.id = new.default_lab_id and f.type = 'laboratory') then
    perform private.fail('invalid_default_lab');
  end if;
  return new;
end;
$$;
create trigger facilities_defaults_check before insert or update of default_pharmacy_id, default_lab_id
  on public.facilities for each row execute function private.check_facility_defaults();

-- ---------------------------------------------------------------------
-- Practitioner professional identity (one per person)
-- ---------------------------------------------------------------------
create table public.practitioner_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id),
  full_name text not null,
  title text,
  specialty_id uuid references public.specialties (id),
  bio text,
  license_number text,
  license_verified_at timestamptz,
  license_verified_by uuid references public.profiles (id),
  photo_path text,
  status public.entity_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1
);
create trigger practitioner_profiles_touch before update on public.practitioner_profiles
  for each row execute function private.touch_row();

-- ---------------------------------------------------------------------
-- Memberships: user × (organization | facility) × role
-- ---------------------------------------------------------------------
create type public.member_role as enum (
  'doctor',
  'receptionist',
  'pharmacist',
  'pharmacy_staff',
  'lab_technician',
  'lab_approver',
  'facility_admin',
  'organization_admin'
);
create type public.membership_status as enum ('active', 'suspended', 'revoked');

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  organization_id uuid not null references public.organizations (id),
  facility_id uuid,
  role public.member_role not null,
  status public.membership_status not null default 'active',
  status_reason text,
  granted_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  version int not null default 1,
  foreign key (facility_id, organization_id) references public.facilities (id, organization_id),
  check ((role = 'organization_admin') = (facility_id is null))
);
create unique index memberships_unique_active
  on public.memberships (user_id, organization_id, coalesce(facility_id, '00000000-0000-0000-0000-000000000000'::uuid), role)
  where status <> 'revoked';
create index memberships_user_idx on public.memberships (user_id) where status = 'active';
create index memberships_facility_idx on public.memberships (facility_id) where status = 'active';
create trigger memberships_touch before update on public.memberships
  for each row execute function private.touch_row();

-- role must match facility type
create or replace function private.check_membership_role()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  ftype public.facility_type;
begin
  if new.facility_id is null then
    return new;
  end if;
  select type into ftype from public.facilities where id = new.facility_id;
  if (new.role in ('doctor', 'receptionist') and ftype <> 'clinic')
     or (new.role in ('pharmacist', 'pharmacy_staff') and ftype <> 'pharmacy')
     or (new.role in ('lab_technician', 'lab_approver') and ftype <> 'laboratory') then
    perform private.fail('role_facility_mismatch');
  end if;
  if new.role = 'doctor' and not exists (
       select 1 from public.practitioner_profiles p where p.user_id = new.user_id) then
    perform private.fail('practitioner_profile_required');
  end if;
  return new;
end;
$$;
create trigger memberships_role_check before insert or update of role, facility_id
  on public.memberships for each row execute function private.check_membership_role();

-- Receptionist → which doctors they may manage at that clinic (§3: explicit).
create table public.reception_scopes (
  membership_id uuid not null references public.memberships (id) on delete cascade,
  practitioner_id uuid not null references public.practitioner_profiles (id),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id),
  primary key (membership_id, practitioner_id)
);

-- ---------------------------------------------------------------------
-- Invitations (staff onboarding: admin chooses role + facility, invitee
-- sets their own password; token stored hashed, short-lived).
-- ---------------------------------------------------------------------
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext not null,
  organization_id uuid not null references public.organizations (id),
  facility_id uuid,
  role public.member_role not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id),
  revoked_at timestamptz,
  invited_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  foreign key (facility_id, organization_id) references public.facilities (id, organization_id),
  check ((role = 'organization_admin') = (facility_id is null)),
  check (expires_at <= created_at + interval '14 days')
);
create index invitations_email_idx on public.invitations (email) where accepted_at is null and revoked_at is null;

-- =====================================================================
-- Authorization helpers (used by RLS and RPCs)
-- =====================================================================
create or replace function private.mfa_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'aal') = 'aal2', false)
      or not (select s.require_admin_mfa from public.platform_settings s);
$$;

create or replace function private.account_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'active');
$$;

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admins a
    join public.profiles p on p.id = a.user_id and p.status = 'active'
    where a.user_id = auth.uid() and a.revoked_at is null
  ) and private.mfa_ok();
$$;

-- Active facility membership with one of the given roles. Suspended
-- organizations / facilities / accounts lose access immediately.
create or replace function private.has_facility_role(p_facility_id uuid, p_roles public.member_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.memberships m
      join public.facilities f on f.id = m.facility_id and f.status in ('active', 'pending')
      join public.organizations o on o.id = m.organization_id and o.status in ('active', 'pending')
      join public.profiles p on p.id = m.user_id and p.status = 'active'
     where m.user_id = auth.uid()
       and m.facility_id = p_facility_id
       and m.status = 'active'
       and m.role = any (p_roles)
  );
$$;

create or replace function private.is_org_admin(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.memberships m
      join public.organizations o on o.id = m.organization_id and o.status in ('active', 'pending')
      join public.profiles p on p.id = m.user_id and p.status = 'active'
     where m.user_id = auth.uid()
       and m.organization_id = p_org_id
       and m.role = 'organization_admin'
       and m.status = 'active'
  ) and private.mfa_ok();
$$;

-- Facility administration: facility_admin of that facility or org admin.
create or replace function private.can_admin_facility(p_facility_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (private.has_facility_role(p_facility_id, array['facility_admin']::public.member_role[]) and private.mfa_ok())
      or exists (select 1 from public.facilities f where f.id = p_facility_id and private.is_org_admin(f.organization_id));
$$;

create or replace function private.is_member_of_facility(p_facility_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_facility_role(p_facility_id, enum_range(null::public.member_role));
$$;

create or replace function private.current_practitioner_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.practitioner_profiles where user_id = auth.uid() and status = 'active';
$$;

-- The doctor works at that facility right now (active membership).
create or replace function private.practitioner_works_at(p_practitioner_id uuid, p_facility_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
      join public.practitioner_profiles pp on pp.user_id = m.user_id
     where pp.id = p_practitioner_id and m.facility_id = p_facility_id
       and m.role = 'doctor' and m.status = 'active'
  );
$$;

-- Receptionist may manage this doctor's schedule at this clinic.
create or replace function private.can_manage_reception(p_facility_id uuid, p_practitioner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.memberships m
      join public.reception_scopes rs on rs.membership_id = m.id
      join public.facilities f on f.id = m.facility_id and f.status in ('active', 'pending')
      join public.profiles p on p.id = m.user_id and p.status = 'active'
     where m.user_id = auth.uid() and m.facility_id = p_facility_id
       and m.role = 'receptionist' and m.status = 'active'
       and rs.practitioner_id = p_practitioner_id
  )
  -- the doctor manages their own administrative work, facility admins too
  or (private.current_practitioner_id() = p_practitioner_id
      and private.has_facility_role(p_facility_id, array['doctor']::public.member_role[]))
  or private.can_admin_facility(p_facility_id);
$$;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.cities enable row level security;
alter table public.specialties enable row level security;
alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.organizations enable row level security;
alter table public.branches enable row level security;
alter table public.facilities enable row level security;
alter table public.practitioner_profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.reception_scopes enable row level security;
alter table public.invitations enable row level security;

-- catalogs: world-readable; platform admin manages
create policy cities_read on public.cities for select using (true);
create policy cities_admin on public.cities for all to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());
create policy specialties_read on public.specialties for select using (true);
create policy specialties_admin on public.specialties for all to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());

-- profiles: own row; colleagues' names are exposed through RPCs only
create policy profiles_self_read on public.profiles for select to authenticated
  using (id = auth.uid() or private.is_platform_admin());
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy platform_admins_read on public.platform_admins for select to authenticated
  using (user_id = auth.uid() or private.is_platform_admin());

-- organizations / branches / facilities: public listing of active public
-- entities (no sensitive columns exist on these tables), members see
-- their own, admins manage through RPCs.
create policy organizations_read on public.organizations for select
  using (status = 'active'
         or private.is_platform_admin()
         or exists (select 1 from public.memberships m where m.organization_id = organizations.id and m.user_id = auth.uid() and m.status = 'active'));
create policy branches_read on public.branches for select
  using (status = 'active'
         or private.is_platform_admin()
         or private.is_org_admin(organization_id));
create policy facilities_read on public.facilities for select
  using ((status = 'active' and is_public)
         or private.is_platform_admin()
         or private.is_member_of_facility(id)
         or private.is_org_admin(organization_id));
create policy facilities_admin_update on public.facilities for update to authenticated
  using (private.can_admin_facility(id)) with check (private.can_admin_facility(id));

-- practitioner identity: the person, their facility admins, platform admin.
-- Public-safe fields are served by discovery RPCs.
create policy practitioner_self on public.practitioner_profiles for select to authenticated
  using (user_id = auth.uid()
         or private.is_platform_admin()
         or exists (select 1 from public.memberships m
                     where m.user_id = practitioner_profiles.user_id and m.role = 'doctor'
                       and m.status = 'active' and private.is_member_of_facility(m.facility_id)));
create policy practitioner_self_update on public.practitioner_profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy memberships_read on public.memberships for select to authenticated
  using (user_id = auth.uid()
         or private.is_platform_admin()
         or private.is_org_admin(organization_id)
         or (facility_id is not null and private.can_admin_facility(facility_id)));

create policy reception_scopes_read on public.reception_scopes for select to authenticated
  using (exists (select 1 from public.memberships m where m.id = reception_scopes.membership_id
                  and (m.user_id = auth.uid() or private.can_admin_facility(m.facility_id) or private.is_platform_admin())));

create policy invitations_read on public.invitations for select to authenticated
  using (private.is_platform_admin()
         or private.is_org_admin(organization_id)
         or (facility_id is not null and private.can_admin_facility(facility_id)));

create policy platform_settings_read on public.platform_settings for select to authenticated using (true);
create policy access_audit_admin_read on public.access_audit for select to authenticated
  using (private.is_platform_admin());

-- Column-level protection for profiles: users may only change display/locale.
revoke update on public.profiles from authenticated;
grant update (display_name, locale) on public.profiles to authenticated;
revoke update on public.practitioner_profiles from authenticated;
grant update (title, bio, photo_path) on public.practitioner_profiles to authenticated;
revoke update on public.facilities from authenticated;
grant update (description, phone, opening_hours_note, is_public, default_pharmacy_id, default_lab_id)
  on public.facilities to authenticated;

grant select on public.cities, public.specialties, public.organizations, public.branches, public.facilities
  to anon, authenticated;
grant select on public.profiles, public.platform_admins, public.practitioner_profiles, public.memberships,
  public.reception_scopes, public.invitations, public.platform_settings, public.access_audit
  to authenticated;
grant insert, update, delete on public.cities, public.specialties to authenticated;
