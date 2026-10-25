-- Super admin «المجمعات والجهات» (owner request, 25 Oct 2026): a tidier view — each complex
-- with its doctors, pharmacies and labs — and a way to attach a clinic / pharmacy / lab that
-- was added on its own (independent) to a complex later, staff and invitations included.

-- Who works where, for the structure view: the doctors (with specialty) and staff count of every facility.
create or replace function public.admin_structure()
returns table (facility_id uuid, doctors jsonb, staff_count int)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then perform private.fail('forbidden'); end if;
  return query
  select f.id,
         coalesce((select jsonb_agg(jsonb_build_object('name', p.full_name, 'specialty', s.name_ar) order by p.full_name)
                     from public.memberships m
                     join public.practitioner_profiles p on p.user_id = m.user_id
                     left join public.specialties s on s.id = p.specialty_id
                    where m.facility_id = f.id and m.role = 'doctor' and m.status = 'active'), '[]'::jsonb),
         (select count(*)::int from public.memberships m where m.facility_id = f.id and m.status = 'active')
    from public.facilities f;
end;
$$;
revoke execute on function public.admin_structure() from public, anon;
grant execute on function public.admin_structure() to authenticated;

-- Move a facility into a complex. Its place either moves with it (p_branch_id null: its own
-- branch becomes one of the complex's) or it joins one of the complex's existing places.
-- Memberships and pending invitations follow, so nobody loses access. An independent record
-- left empty is closed.
create or replace function public.admin_move_facility(p_facility_id uuid, p_organization_id uuid, p_branch_id uuid default null)
returns public.facilities
language plpgsql
security definer
set search_path = ''
as $$
declare
  fac public.facilities;
  target public.organizations;
  old_org uuid;
  old_branch uuid;
  new_branch uuid;
begin
  if not private.is_platform_admin() then perform private.fail('forbidden'); end if;
  select * into fac from public.facilities where id = p_facility_id;
  if fac.id is null then perform private.fail('not_found'); end if;
  select * into target from public.organizations where id = p_organization_id;
  if target.id is null then perform private.fail('not_found'); end if;
  if target.kind <> 'medical_complex' then perform private.fail('not_a_complex'); end if;
  if fac.organization_id = target.id then return fac; end if;
  old_org := fac.organization_id;
  old_branch := fac.branch_id;

  if p_branch_id is not null then
    if not exists (select 1 from public.branches where id = p_branch_id and organization_id = target.id) then perform private.fail('invalid_branch'); end if;
    new_branch := p_branch_id;
  else
    -- its own place moves too, which only works if no other facility still uses it
    if exists (select 1 from public.facilities where branch_id = old_branch and id <> fac.id) then perform private.fail('branch_shared'); end if;
    new_branch := old_branch;
  end if;

  -- one statement, so the paired (id, organization_id) references are checked only once everything has moved
  with b as (
    update public.branches set organization_id = target.id where id = old_branch and new_branch = old_branch returning id
  ), f as (
    update public.facilities set organization_id = target.id, branch_id = new_branch,
           -- referral defaults pointed at the old setup; the complex's own pharmacy/lab apply instead
           default_pharmacy_id = null, default_lab_id = null
     where id = fac.id returning id
  ), m as (
    update public.memberships set organization_id = target.id where facility_id = fac.id returning id
  )
  update public.invitations set organization_id = target.id where facility_id = fac.id;

  -- an independent record with nothing left in it is closed (history stays)
  update public.organizations o set status = 'closed', status_reason = 'merged_into_complex'
   where o.id = old_org and o.kind = 'independent'
     and not exists (select 1 from public.facilities x where x.organization_id = o.id);

  perform private.audit('facility.moved', 'facility', fac.id, fac.id, null, null,
                        jsonb_build_object('from_organization', old_org, 'to_organization', target.id), target.id);
  select * into fac from public.facilities where id = p_facility_id;
  return fac;
end;
$$;
revoke execute on function public.admin_move_facility(uuid, uuid, uuid) from public, anon;
grant execute on function public.admin_move_facility(uuid, uuid, uuid) to authenticated;
