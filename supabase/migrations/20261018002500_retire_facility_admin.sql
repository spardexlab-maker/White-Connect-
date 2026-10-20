-- The owner retired the "facility admin" (مدير المنشأة) role (20 Oct 2026):
-- the platform admin runs facilities directly. The enum value stays (old
-- records and audit keep their meaning) but the role can no longer be held:
--  * it cannot be invited or granted,
--  * no membership with it can be active (blocks reactivation too),
--  * existing ones are suspended — records are kept, nothing is deleted.

create or replace function private.can_invite(p_org uuid, p_facility uuid, p_role public.member_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_role <> 'facility_admin'
     and (private.is_platform_admin()
          or private.is_org_admin(p_org)
          or (p_facility is not null and p_role <> 'organization_admin'
              and private.can_admin_facility(p_facility)));
$$;

create or replace function private.reject_facility_admin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role = 'facility_admin' and new.status = 'active' then
    perform private.fail('role_retired');
  end if;
  return new;
end;
$$;

drop trigger if exists memberships_no_facility_admin on public.memberships;
create trigger memberships_no_facility_admin
  before insert or update of role, status on public.memberships
  for each row execute function private.reject_facility_admin();

update public.memberships set status = 'suspended' where role = 'facility_admin' and status = 'active';
