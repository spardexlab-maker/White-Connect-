-- =====================================================================
-- 0004 Administration RPCs: organizations, branches, facilities,
-- invitations, memberships, reception scopes, suspension, workspaces.
-- Every administrative change is audited with a reason where required.
-- =====================================================================

-- Operator bootstrap (run once from the SQL editor / service role; not
-- exposed to the Data API).
create or replace function private.bootstrap_platform_admin(p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower(p_email);
  if uid is null then perform private.fail('user_not_found'); end if;
  insert into public.platform_admins (user_id) values (uid)
  on conflict (user_id) do update set revoked_at = null;
  insert into public.access_audit (actor_user_id, action, entity_type, entity_id)
  values (null, 'platform_admin.bootstrapped', 'profile', uid);
  return uid;
end;
$$;

-- ---------------------------------------------------------------------
-- Organizations / branches / facilities
-- ---------------------------------------------------------------------
create or replace function public.admin_create_organization(
  p_name text,
  p_kind text default 'medical_complex',
  p_activate boolean default false
) returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.organizations;
begin
  if not private.is_platform_admin() then perform private.fail('forbidden'); end if;
  insert into public.organizations (name, kind, status, verified_at, verified_by, created_by)
  values (trim(p_name), p_kind,
          case when p_activate then 'active'::public.entity_status else 'pending'::public.entity_status end,
          case when p_activate then now() end,
          case when p_activate then auth.uid() end,
          auth.uid())
  returning * into rec;
  perform private.audit('organization.created', 'organization', rec.id, null, null, null, '{}'::jsonb, rec.id);
  return rec;
end;
$$;

create or replace function public.admin_create_branch(
  p_organization_id uuid,
  p_name text,
  p_city_id uuid default null,
  p_area text default null,
  p_address text default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_timezone text default 'Asia/Baghdad'
) returns public.branches
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.branches;
begin
  if not (private.is_platform_admin() or private.is_org_admin(p_organization_id)) then
    perform private.fail('forbidden');
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    perform private.fail('invalid_timezone');
  end if;
  insert into public.branches (organization_id, name, city_id, area, address, latitude, longitude, timezone)
  values (p_organization_id, trim(p_name), p_city_id, p_area, p_address, p_latitude, p_longitude, p_timezone)
  returning * into rec;
  perform private.audit('branch.created', 'branch', rec.id, null, null, null, '{}'::jsonb, p_organization_id);
  return rec;
end;
$$;

create or replace function public.admin_create_facility(
  p_organization_id uuid,
  p_branch_id uuid,
  p_type public.facility_type,
  p_name text,
  p_description text default null,
  p_phone text default null,
  p_activate boolean default false
) returns public.facilities
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.facilities;
begin
  if not (private.is_platform_admin() or private.is_org_admin(p_organization_id)) then
    perform private.fail('forbidden');
  end if;
  -- only platform admin may activate (verification step, §13)
  insert into public.facilities (organization_id, branch_id, type, name, description, phone, status)
  values (p_organization_id, p_branch_id, p_type, trim(p_name), p_description, p_phone,
          case when p_activate and private.is_platform_admin() then 'active'::public.entity_status
               else 'pending'::public.entity_status end)
  returning * into rec;
  perform private.audit('facility.created', 'facility', rec.id, rec.id, null, null, '{}'::jsonb, p_organization_id);
  return rec;
end;
$$;

-- Status changes (verify / suspend / reactivate / close) need a reason.
-- Suspension never deletes patient records (§13).
create or replace function public.admin_set_entity_status(
  p_entity text,                 -- organization | facility
  p_id uuid,
  p_status public.entity_status,
  p_reason text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  org uuid;
begin
  if not private.is_platform_admin() then perform private.fail('forbidden'); end if;
  if p_reason is null or length(trim(p_reason)) < 5 then perform private.fail('reason_required'); end if;
  if p_entity = 'organization' then
    update public.organizations
       set status = p_status, status_reason = p_reason,
           verified_at = case when p_status = 'active' and verified_at is null then now() else verified_at end,
           verified_by = case when p_status = 'active' and verified_by is null then auth.uid() else verified_by end
     where id = p_id returning id into org;
  elsif p_entity = 'facility' then
    update public.facilities set status = p_status, status_reason = p_reason
     where id = p_id returning organization_id into org;
  else
    perform private.fail('invalid_entity');
  end if;
  if org is null then perform private.fail('not_found'); end if;
  perform private.audit(p_entity || '.status_changed', p_entity, p_id,
                        case when p_entity = 'facility' then p_id end, null, p_reason,
                        jsonb_build_object('status', p_status), org);
end;
$$;

create or replace function public.admin_set_account_status(
  p_user_id uuid,
  p_status public.account_status,
  p_reason text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then perform private.fail('forbidden'); end if;
  if p_user_id = auth.uid() then perform private.fail('cannot_change_self'); end if;
  if p_reason is null or length(trim(p_reason)) < 5 then perform private.fail('reason_required'); end if;
  update public.profiles set status = p_status, suspended_reason = case when p_status = 'suspended' then p_reason end
   where id = p_user_id;
  if not found then perform private.fail('not_found'); end if;
  perform private.audit('account.status_changed', 'profile', p_user_id, null, null, p_reason,
                        jsonb_build_object('status', p_status));
end;
$$;

-- ---------------------------------------------------------------------
-- Practitioner identity
-- ---------------------------------------------------------------------
create or replace function public.admin_upsert_practitioner(
  p_user_id uuid,
  p_full_name text,
  p_specialty_id uuid default null,
  p_title text default null,
  p_license_number text default null,
  p_mark_license_verified boolean default false
) returns public.practitioner_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.practitioner_profiles;
begin
  if not private.is_platform_admin() then perform private.fail('forbidden'); end if;
  insert into public.practitioner_profiles (user_id, full_name, specialty_id, title, license_number,
                                            license_verified_at, license_verified_by)
  values (p_user_id, trim(p_full_name), p_specialty_id, p_title, p_license_number,
          case when p_mark_license_verified then now() end,
          case when p_mark_license_verified then auth.uid() end)
  on conflict (user_id) do update
    set full_name = excluded.full_name,
        specialty_id = excluded.specialty_id,
        title = excluded.title,
        license_number = excluded.license_number,
        license_verified_at = coalesce(excluded.license_verified_at, public.practitioner_profiles.license_verified_at),
        license_verified_by = coalesce(excluded.license_verified_by, public.practitioner_profiles.license_verified_by)
  returning * into rec;
  perform private.audit('practitioner.upserted', 'practitioner', rec.id);
  return rec;
end;
$$;

-- ---------------------------------------------------------------------
-- Invitations
-- ---------------------------------------------------------------------
create or replace function private.can_invite(p_org uuid, p_facility uuid, p_role public.member_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_platform_admin()
      or private.is_org_admin(p_org)
      or (p_facility is not null and p_role not in ('facility_admin', 'organization_admin')
          and private.can_admin_facility(p_facility));
$$;

-- Returns the raw token ONCE; delivery (email) goes through the outbox.
create or replace function public.create_invitation(
  p_email text,
  p_organization_id uuid,
  p_facility_id uuid,
  p_role public.member_role,
  p_valid_hours int default 72
) returns table (invitation_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  raw text := 'inv_' || encode(extensions.gen_random_bytes(24), 'hex');
  rec public.invitations;
begin
  if not private.can_invite(p_organization_id, p_facility_id, p_role) then
    perform private.fail('forbidden');
  end if;
  if p_valid_hours < 1 or p_valid_hours > 336 then perform private.fail('invalid_validity'); end if;
  insert into public.invitations (email, organization_id, facility_id, role, token_hash, expires_at, invited_by)
  values (lower(trim(p_email)), p_organization_id, p_facility_id, p_role, private.sha256_hex(raw),
          now() + make_interval(hours => p_valid_hours), auth.uid())
  returning * into rec;
  perform private.audit('invitation.created', 'invitation', rec.id, p_facility_id, null, null,
                        jsonb_build_object('role', p_role), p_organization_id);
  return query select rec.id, raw, rec.expires_at;
end;
$$;

create or replace function public.revoke_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.invitations;
begin
  select * into rec from public.invitations where id = p_invitation_id;
  if rec.id is null or not private.can_invite(rec.organization_id, rec.facility_id, rec.role) then
    perform private.fail('forbidden');
  end if;
  update public.invitations set revoked_at = now() where id = p_invitation_id and accepted_at is null;
  perform private.audit('invitation.revoked', 'invitation', p_invitation_id, rec.facility_id, null, null, '{}'::jsonb, rec.organization_id);
end;
$$;

-- The invitee (signed in with the invited email, own password) accepts.
create or replace function public.accept_invitation(p_token text)
returns public.memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invitations;
  mem public.memberships;
  my_email text := lower(auth.jwt() ->> 'email');
begin
  if auth.uid() is null then perform private.fail('not_authenticated'); end if;
  select * into inv from public.invitations where token_hash = private.sha256_hex(p_token) for update;
  if inv.id is null or inv.revoked_at is not null or inv.accepted_at is not null or inv.expires_at < now() then
    perform private.fail('invalid_or_expired_invitation');
  end if;
  if my_email is null or my_email <> lower(inv.email::text) then
    perform private.fail('invitation_email_mismatch');
  end if;
  insert into public.memberships (user_id, organization_id, facility_id, role, granted_by)
  values (auth.uid(), inv.organization_id, inv.facility_id, inv.role, inv.invited_by)
  on conflict do nothing
  returning * into mem;
  if mem.id is null then
    select * into mem from public.memberships
     where user_id = auth.uid() and organization_id = inv.organization_id
       and facility_id is not distinct from inv.facility_id and role = inv.role and status <> 'revoked';
  end if;
  update public.invitations set accepted_at = now(), accepted_by = auth.uid() where id = inv.id;
  perform private.audit('invitation.accepted', 'membership', mem.id, inv.facility_id, null, null, '{}'::jsonb, inv.organization_id);
  return mem;
end;
$$;

-- Direct grant (platform admin / org admin) for an existing account.
create or replace function public.admin_grant_membership(
  p_user_id uuid,
  p_organization_id uuid,
  p_facility_id uuid,
  p_role public.member_role
) returns public.memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  mem public.memberships;
begin
  if not private.can_invite(p_organization_id, p_facility_id, p_role) then perform private.fail('forbidden'); end if;
  insert into public.memberships (user_id, organization_id, facility_id, role, granted_by)
  values (p_user_id, p_organization_id, p_facility_id, p_role, auth.uid())
  returning * into mem;
  perform private.audit('membership.granted', 'membership', mem.id, p_facility_id, null, null,
                        jsonb_build_object('role', p_role, 'user_id', p_user_id), p_organization_id);
  return mem;
end;
$$;

-- Suspend / revoke immediately removes access; records stay intact.
create or replace function public.set_membership_status(
  p_membership_id uuid,
  p_status public.membership_status,
  p_reason text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  mem public.memberships;
begin
  select * into mem from public.memberships where id = p_membership_id for update;
  if mem.id is null or not private.can_invite(mem.organization_id, mem.facility_id, mem.role) then
    perform private.fail('forbidden');
  end if;
  if mem.status = 'revoked' then perform private.fail('membership_revoked'); end if;
  if p_reason is null or length(trim(p_reason)) < 5 then perform private.fail('reason_required'); end if;
  update public.memberships
     set status = p_status, status_reason = p_reason,
         revoked_at = case when p_status = 'revoked' then now() end
   where id = p_membership_id;
  perform private.audit('membership.status_changed', 'membership', mem.id, mem.facility_id, null, p_reason,
                        jsonb_build_object('status', p_status), mem.organization_id);
end;
$$;

create or replace function public.set_reception_scope(
  p_membership_id uuid,
  p_practitioner_id uuid,
  p_allowed boolean
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  mem public.memberships;
begin
  select * into mem from public.memberships where id = p_membership_id;
  if mem.id is null or mem.role <> 'receptionist' then perform private.fail('not_found'); end if;
  if not private.can_manage_reception(mem.facility_id, p_practitioner_id) then perform private.fail('forbidden'); end if;
  if not private.practitioner_works_at(p_practitioner_id, mem.facility_id) then
    perform private.fail('practitioner_not_at_facility');
  end if;
  if p_allowed then
    insert into public.reception_scopes (membership_id, practitioner_id, created_by)
    values (p_membership_id, p_practitioner_id, auth.uid()) on conflict do nothing;
  else
    delete from public.reception_scopes where membership_id = p_membership_id and practitioner_id = p_practitioner_id;
  end if;
  perform private.audit('reception_scope.changed', 'membership', mem.id, mem.facility_id, null, null,
                        jsonb_build_object('practitioner_id', p_practitioner_id, 'allowed', p_allowed), mem.organization_id);
end;
$$;

-- ---------------------------------------------------------------------
-- Workspaces for the signed-in user (server is the source of truth).
-- ---------------------------------------------------------------------
create or replace function public.my_workspaces()
returns table (
  membership_id uuid,
  role public.member_role,
  organization_id uuid,
  organization_name text,
  facility_id uuid,
  facility_name text,
  facility_type public.facility_type,
  branch_id uuid,
  branch_name text,
  timezone text,
  default_pharmacy_id uuid,
  default_lab_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.role, o.id, o.name, f.id, f.name, f.type, b.id, b.name,
         coalesce(b.timezone, 'Asia/Baghdad'), f.default_pharmacy_id, f.default_lab_id
    from public.memberships m
    join public.organizations o on o.id = m.organization_id and o.status in ('active', 'pending')
    join public.profiles p on p.id = m.user_id and p.status = 'active'
    left join public.facilities f on f.id = m.facility_id
    left join public.branches b on b.id = f.branch_id
   where m.user_id = auth.uid() and m.status = 'active'
     and (f.id is null or f.status in ('active', 'pending'))
   order by o.name, f.name, m.role;
$$;

create or replace function public.my_access_summary()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'user_id', auth.uid(),
    'account_status', (select status from public.profiles where id = auth.uid()),
    'is_platform_admin', private.is_platform_admin(),
    'platform_admin_needs_mfa', exists (select 1 from public.platform_admins a where a.user_id = auth.uid() and a.revoked_at is null)
                                and not private.mfa_ok(),
    'practitioner_id', private.current_practitioner_id(),
    'patient_ids', coalesce((select jsonb_agg(jsonb_build_object('patient_id', l.patient_id, 'relationship', l.relationship))
                               from public.patient_account_links l
                              where l.user_id = auth.uid() and l.revoked_at is null and l.verified_at is not null), '[]'::jsonb)
  );
$$;

-- Facility member directory for administrators (names only).
create or replace function public.facility_members(p_facility_id uuid)
returns table (membership_id uuid, user_id uuid, display_name text, email text, role public.member_role,
               status public.membership_status, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not (private.can_admin_facility(p_facility_id) or private.is_platform_admin()) then
    perform private.fail('forbidden');
  end if;
  return query
  select m.id, m.user_id, coalesce(pp.full_name, p.display_name), u.email::text, m.role, m.status, m.created_at
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    join auth.users u on u.id = m.user_id
    left join public.practitioner_profiles pp on pp.user_id = m.user_id
   where m.facility_id = p_facility_id
   order by m.status, m.role, 3;
end;
$$;

-- Platform operations dashboard (counts only — no medical data).
create or replace function public.platform_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then perform private.fail('forbidden'); end if;
  return jsonb_build_object(
    'organizations', (select jsonb_object_agg(status, n) from (select status, count(*) n from public.organizations group by status) s),
    'facilities', (select jsonb_object_agg(type, n) from (select type, count(*) n from public.facilities group by type) s),
    'pending_facilities', (select count(*) from public.facilities where status = 'pending'),
    'active_memberships', (select count(*) from public.memberships where status = 'active'),
    'open_invitations', (select count(*) from public.invitations where accepted_at is null and revoked_at is null and expires_at > now()),
    'suspended_accounts', (select count(*) from public.profiles where status = 'suspended')
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------
revoke execute on function
  public.admin_create_organization(text, text, boolean),
  public.admin_create_branch(uuid, text, uuid, text, text, double precision, double precision, text),
  public.admin_create_facility(uuid, uuid, public.facility_type, text, text, text, boolean),
  public.admin_set_entity_status(text, uuid, public.entity_status, text),
  public.admin_set_account_status(uuid, public.account_status, text),
  public.admin_upsert_practitioner(uuid, text, uuid, text, text, boolean),
  public.create_invitation(text, uuid, uuid, public.member_role, int),
  public.revoke_invitation(uuid),
  public.accept_invitation(text),
  public.admin_grant_membership(uuid, uuid, uuid, public.member_role),
  public.set_membership_status(uuid, public.membership_status, text),
  public.set_reception_scope(uuid, uuid, boolean),
  public.my_workspaces(),
  public.my_access_summary(),
  public.facility_members(uuid),
  public.platform_overview()
from public, anon;
grant execute on function
  public.admin_create_organization(text, text, boolean),
  public.admin_create_branch(uuid, text, uuid, text, text, double precision, double precision, text),
  public.admin_create_facility(uuid, uuid, public.facility_type, text, text, text, boolean),
  public.admin_set_entity_status(text, uuid, public.entity_status, text),
  public.admin_set_account_status(uuid, public.account_status, text),
  public.admin_upsert_practitioner(uuid, text, uuid, text, text, boolean),
  public.create_invitation(text, uuid, uuid, public.member_role, int),
  public.revoke_invitation(uuid),
  public.accept_invitation(text),
  public.admin_grant_membership(uuid, uuid, uuid, public.member_role),
  public.set_membership_status(uuid, public.membership_status, text),
  public.set_reception_scope(uuid, uuid, boolean),
  public.my_workspaces(),
  public.my_access_summary(),
  public.facility_members(uuid),
  public.platform_overview()
to authenticated;
