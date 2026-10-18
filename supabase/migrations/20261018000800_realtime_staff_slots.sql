-- =====================================================================
-- 0008 Realtime publication + staff slot view.
-- Realtime is a refresh signal only (RLS still filters what each client
-- receives); the database remains the source of truth (§15).
-- =====================================================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.appointments, public.queue_entries, public.notifications;
  end if;
end $$;

-- Staff may see near-term slots (patient min-notice / window rules do not
-- apply to the desk); everything else is identical.
drop function if exists public.get_available_slots(uuid, uuid, uuid, date, date);
create or replace function public.get_available_slots(
  p_facility_id uuid,
  p_practitioner_id uuid,
  p_service_id uuid,
  p_from date,
  p_to date,
  p_for_staff boolean default false
) returns table (slot_start timestamptz, slot_end timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  svc public.clinic_services;
  pol public.booking_policies;
  step interval;
  dur interval;
  blk interval;
  staff boolean := false;
begin
  if p_to < p_from or p_to - p_from > 31 then perform private.fail('invalid_range'); end if;
  if p_for_staff then
    staff := private.can_manage_reception(p_facility_id, p_practitioner_id);
    if not staff then perform private.fail('forbidden'); end if;
  end if;
  select * into svc from public.clinic_services s
   where s.id = p_service_id and s.facility_id = p_facility_id and s.is_active and (s.is_public or staff);
  if svc.id is null then return; end if;
  if not exists (select 1 from public.facilities f where f.id = p_facility_id and f.status = 'active') then return; end if;
  if p_practitioner_id is not null and not private.practitioner_works_at(p_practitioner_id, p_facility_id) then return; end if;

  pol := private.effective_policy(p_facility_id, p_practitioner_id);
  dur := make_interval(mins => svc.duration_minutes);
  blk := make_interval(mins => svc.duration_minutes + svc.buffer_minutes);
  step := make_interval(mins => coalesce(pol.slot_step_minutes, svc.duration_minutes + svc.buffer_minutes));

  return query
  with windows as (
    select w from private.working_windows(p_facility_id, p_practitioner_id, p_from, p_to) w
  ), candidates as (
    select distinct gs as s
      from windows, generate_series(lower(windows.w), upper(windows.w) - dur, step) gs
  )
  select c.s, c.s + dur
    from candidates c
   where c.s >= case when staff then now() else now() + make_interval(mins => pol.min_notice_minutes) end
     and (staff or c.s <= now() + make_interval(days => pol.booking_window_days))
     and not private.is_unavailable(p_facility_id, p_practitioner_id, tstzrange(c.s, c.s + blk, '[)'))
     and not exists (
       select 1 from public.appointments a
        where a.holds_slot
          and not (a.status = 'awaiting_confirmation' and a.confirmation_deadline <= now())
          and a.blocked_period && tstzrange(c.s, c.s + blk, '[)')
          and ((p_practitioner_id is not null and a.practitioner_id = p_practitioner_id)
               or (svc.resource_id is not null and a.resource_id = svc.resource_id)))
   order by c.s;
end;
$$;
grant execute on function public.get_available_slots(uuid, uuid, uuid, date, date, boolean) to anon, authenticated;
