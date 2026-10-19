-- Simplifications requested by the owner (19 Oct 2026):
--  1) one person runs a small lab: lab staff (technician) may also release
--     and correct results, set the lab's hours and its test catalogue.
--     Drafts and release stay separate steps (nothing is published on save).
--  2) a receptionist works for ONE doctor: assigning a doctor replaces the
--     previous one; an invitation for a receptionist can name the doctor,
--     applied when the invitation is accepted.
-- Existing data is not changed.

create or replace function public.release_lab_results(p_order_id uuid, p_item_ids uuid[])
returns public.lab_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.lab_orders;
  n int;
begin
  select * into o from public.lab_orders where id = p_order_id for update;
  if o.id is null or not private.has_facility_role(o.lab_facility_id, array['lab_technician', 'lab_approver']::public.member_role[]) then
    perform private.fail('forbidden');
  end if;
  with rel as (
    update public.lab_results r set status = 'released', released_by = auth.uid(), released_at = now()
      from public.lab_order_items i
     where r.order_item_id = i.id and i.order_id = o.id and i.id = any (p_item_ids) and r.status = 'draft'
    returning i.id
  )
  update public.lab_order_items set status = 'released', released_at = now() where id in (select id from rel);
  get diagnostics n = row_count;
  if n = 0 then perform private.fail('nothing_to_release'); end if;
  perform private.refresh_lab_order_status(o.id);
  select * into o from public.lab_orders where id = o.id;
  perform private.after_results_released(o, false);
  perform private.audit('lab_results.released', 'lab_order', o.id, o.lab_facility_id, o.patient_id, null, jsonb_build_object('items', n));
  return o;
end;
$$;

create or replace function public.correct_lab_result(
  p_result_id uuid,
  p_reason text,
  p_value_text text default null,
  p_value_numeric numeric default null,
  p_unit text default null,
  p_reference_range text default null,
  p_lab_flag text default null,
  p_notes text default null
) returns public.lab_results
language plpgsql
security definer
set search_path = ''
as $$
declare
  old public.lab_results;
  o public.lab_orders;
  r public.lab_results;
begin
  select * into old from public.lab_results where id = p_result_id for update;
  select o2.* into o from public.lab_orders o2 join public.lab_order_items i on i.order_id = o2.id where i.id = old.order_item_id;
  if old.id is null or not private.has_facility_role(o.lab_facility_id, array['lab_technician', 'lab_approver']::public.member_role[]) then
    perform private.fail('forbidden');
  end if;
  if old.status <> 'released' then perform private.fail('invalid_transition'); end if;
  if p_reason is null or length(trim(p_reason)) < 5 then perform private.fail('reason_required'); end if;
  update public.lab_results set status = 'superseded' where id = old.id;
  insert into public.lab_results (order_item_id, version_no, status, value_text, value_numeric, unit, reference_range, lab_flag, notes,
                                  entered_by, released_by, released_at, supersedes_id, correction_reason)
  values (old.order_item_id, old.version_no + 1, 'released', p_value_text, p_value_numeric, coalesce(p_unit, old.unit),
          coalesce(p_reference_range, old.reference_range), p_lab_flag, p_notes, auth.uid(), auth.uid(), now(), old.id, p_reason)
  returning * into r;
  perform private.after_results_released(o, true);
  perform private.audit('lab_result.corrected', 'lab_result', r.id, o.lab_facility_id, o.patient_id, p_reason);
  return r;
end;
$$;

create or replace function private.can_configure_schedule(p_facility_id uuid, p_practitioner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_admin_facility(p_facility_id)
      or (p_practitioner_id is not null and p_practitioner_id = private.current_practitioner_id()
          and private.has_facility_role(p_facility_id, array['doctor']::public.member_role[]))
      or (p_practitioner_id is null and private.has_facility_role(p_facility_id, array['lab_technician', 'lab_approver']::public.member_role[]));
$$;

drop policy if exists lab_catalog_write on public.lab_test_catalog;
create policy lab_catalog_write on public.lab_test_catalog for all to authenticated
  using (private.has_facility_role(lab_facility_id, array['lab_technician', 'lab_approver', 'facility_admin']::public.member_role[]))
  with check (private.has_facility_role(lab_facility_id, array['lab_technician', 'lab_approver', 'facility_admin']::public.member_role[]));

-- receptionist → one doctor
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
    delete from public.reception_scopes where membership_id = p_membership_id and practitioner_id <> p_practitioner_id;
    insert into public.reception_scopes (membership_id, practitioner_id, created_by)
    values (p_membership_id, p_practitioner_id, auth.uid()) on conflict do nothing;
  else
    delete from public.reception_scopes where membership_id = p_membership_id and practitioner_id = p_practitioner_id;
  end if;
  perform private.audit('reception_scope.changed', 'membership', mem.id, mem.facility_id, null, null,
                        jsonb_build_object('practitioner_id', p_practitioner_id, 'allowed', p_allowed), mem.organization_id);
end;
$$;

-- invitation can carry the receptionist's doctor
alter table public.invitations add column if not exists reception_practitioner_id uuid references public.practitioner_profiles (id);
alter table public.invitations drop constraint if exists invitations_reception_practitioner_role;
alter table public.invitations add constraint invitations_reception_practitioner_role
  check (reception_practitioner_id is null or role = 'receptionist');

drop function if exists public.create_invitation(text, uuid, uuid, public.member_role, int);
create or replace function public.create_invitation(
  p_email text,
  p_organization_id uuid,
  p_facility_id uuid,
  p_role public.member_role,
  p_valid_hours int default 72,
  p_reception_practitioner_id uuid default null
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
  if p_reception_practitioner_id is not null then
    if p_role <> 'receptionist' then perform private.fail('invalid_input'); end if;
    if not private.practitioner_works_at(p_reception_practitioner_id, p_facility_id) then perform private.fail('practitioner_not_at_facility'); end if;
  end if;
  insert into public.invitations (email, organization_id, facility_id, role, token_hash, expires_at, invited_by, reception_practitioner_id)
  values (lower(trim(p_email)), p_organization_id, p_facility_id, p_role, private.sha256_hex(raw),
          now() + make_interval(hours => p_valid_hours), auth.uid(), p_reception_practitioner_id)
  returning * into rec;
  perform private.audit('invitation.created', 'invitation', rec.id, p_facility_id, null, null,
                        jsonb_build_object('role', p_role, 'doctor', p_reception_practitioner_id), p_organization_id);
  return query select rec.id, raw, rec.expires_at;
end;
$$;
revoke execute on function public.create_invitation(text, uuid, uuid, public.member_role, int, uuid) from public, anon;
grant execute on function public.create_invitation(text, uuid, uuid, public.member_role, int, uuid) to authenticated;

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
  -- a receptionist invited for a specific doctor starts with that doctor only
  if inv.reception_practitioner_id is not null then
    insert into public.reception_scopes (membership_id, practitioner_id, created_by)
    values (mem.id, inv.reception_practitioner_id, inv.invited_by) on conflict do nothing;
  end if;
  update public.invitations set accepted_at = now(), accepted_by = auth.uid() where id = inv.id;
  perform private.audit('invitation.accepted', 'membership', mem.id, inv.facility_id, null, null, '{}'::jsonb, inv.organization_id);
  return mem;
end;
$$;
