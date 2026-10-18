-- Doctors working in the same complex as a facility (e.g. shown to the
-- pharmacist or lab staff). Directory data only: name, title, specialty,
-- clinic — no patient or schedule data. Callers must be active members of
-- that facility (any role) or a platform admin.
create or replace function public.organization_doctors(p_facility_id uuid)
returns table (practitioner_id uuid, full_name text, title text, specialty text, license_verified boolean,
               facility_id uuid, facility_name text, branch_name text, phone text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (private.is_member_of_facility(p_facility_id) or private.is_platform_admin()) then
    perform private.fail('forbidden');
  end if;
  return query
    select distinct on (pp.id, f.id)
           pp.id, pp.full_name, pp.title, s.name_ar, pp.license_verified_at is not null,
           f.id, f.name, b.name, f.phone
      from public.facilities me
      join public.facilities f on f.organization_id = me.organization_id and f.type = 'clinic' and f.status = 'active'
      join public.branches b on b.id = f.branch_id
      join public.memberships m on m.facility_id = f.id and m.role = 'doctor' and m.status = 'active'
      join public.practitioner_profiles pp on pp.user_id = m.user_id and pp.status = 'active'
      left join public.specialties s on s.id = pp.specialty_id
     where me.id = p_facility_id
     order by pp.id, f.id;
end;
$$;

revoke execute on function public.organization_doctors(uuid) from public, anon;
grant execute on function public.organization_doctors(uuid) to authenticated;
