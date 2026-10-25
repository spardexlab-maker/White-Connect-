-- A clinic's place on the map, set (or corrected) by the super admin from a map link
-- (owner request, 25 Oct 2026). Patients see it as a map with a «directions» button,
-- and «nearest to me» uses it.
create or replace function public.admin_set_branch_location(
  p_branch_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_address text default null
) returns public.branches
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.branches;
begin
  select * into rec from public.branches where id = p_branch_id;
  if rec.id is null then perform private.fail('not_found'); end if;
  if not (private.is_platform_admin() or private.is_org_admin(rec.organization_id)) then perform private.fail('forbidden'); end if;
  if p_latitude is null or p_longitude is null or abs(p_latitude) > 90 or abs(p_longitude) > 180 then perform private.fail('invalid_location'); end if;
  update public.branches
     set latitude = p_latitude, longitude = p_longitude,
         address = coalesce(nullif(trim(coalesce(p_address, '')), ''), address)
   where id = p_branch_id
  returning * into rec;
  perform private.audit('branch.location_set', 'branch', rec.id, null, null, null, '{}'::jsonb, rec.organization_id);
  return rec;
end;
$$;
revoke execute on function public.admin_set_branch_location(uuid, double precision, double precision, text) from public, anon;
grant execute on function public.admin_set_branch_location(uuid, double precision, double precision, text) to authenticated;
