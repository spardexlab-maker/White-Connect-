-- Which doctors a receptionist manages is set by the platform admin (the
-- complex-manager role is gone). The admin gains only this assignment —
-- NOT reception powers (can_manage_reception is unchanged), so the admin
-- still cannot read appointments or look up patients.
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
  if not (private.can_manage_reception(mem.facility_id, p_practitioner_id) or private.is_platform_admin()) then
    perform private.fail('forbidden');
  end if;
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

-- Doctors of the receptionist's clinic and whether this receptionist manages each.
create or replace function public.reception_scope_options(p_membership_id uuid)
returns table (practitioner_id uuid, full_name text, specialty text, allowed boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  mem public.memberships;
begin
  select * into mem from public.memberships where id = p_membership_id;
  if mem.id is null or mem.role <> 'receptionist' then perform private.fail('not_found'); end if;
  if not (private.is_platform_admin() or private.can_admin_facility(mem.facility_id)) then perform private.fail('forbidden'); end if;
  return query
    select distinct pp.id, pp.full_name, s.name_ar,
           exists (select 1 from public.reception_scopes rs where rs.membership_id = mem.id and rs.practitioner_id = pp.id)
      from public.memberships d
      join public.practitioner_profiles pp on pp.user_id = d.user_id and pp.status = 'active'
      left join public.specialties s on s.id = pp.specialty_id
     where d.facility_id = mem.facility_id and d.role = 'doctor' and d.status = 'active'
     order by pp.full_name;
end;
$$;

revoke execute on function public.reception_scope_options(uuid) from public, anon;
grant execute on function public.reception_scope_options(uuid) to authenticated;
