-- The patient's own view of a doctor visit (owner request, 26 Oct 2026): the
-- reason, the diagnosis, the doctor's plan and follow-up advice, the measured
-- vitals, and what the visit produced (prescriptions, lab orders).
--  * only once the doctor has finished the session (or it waits on results);
--    a session still in progress shows nothing clinical yet;
--  * history, examination and free-text notes stay internal to the clinic;
--  * access through the caller's verified, unrevoked patient links only.

create or replace function public.patient_visit(p_encounter_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e public.encounters;
  n public.clinical_notes;
  done boolean;
begin
  select * into e from public.encounters where id = p_encounter_id;
  if not found or not exists (select 1 from public.patient_account_links l
                               where l.user_id = auth.uid() and l.patient_id = e.patient_id
                                 and l.revoked_at is null and l.verified_at is not null) then
    perform private.fail('forbidden');
  end if;
  done := e.status in ('awaiting_results', 'ready_for_review', 'completed', 'closed');
  if done then
    select * into n from public.clinical_notes
     where encounter_id = e.id and status <> 'superseded' order by version_no desc limit 1;
  end if;
  return jsonb_build_object(
    'id', e.id, 'status', e.status, 'started_at', coalesce(e.started_at, e.created_at), 'ended_at', e.ended_at, 'finished', done,
    'patient_name', (select full_name from public.patients where id = e.patient_id),
    'facility', (select name from public.facilities where id = e.facility_id),
    'doctor', (select full_name from public.practitioner_profiles where id = e.practitioner_id),
    'specialty', (select s.name_ar from public.practitioner_profiles pp join public.specialties s on s.id = pp.specialty_id
                   where pp.id = e.practitioner_id),
    'reason', n.reason_for_visit, 'diagnosis', n.assessment, 'plan', n.plan, 'follow_up', n.follow_up,
    'vitals', case when done then coalesce(n.vitals, '{}'::jsonb) else '{}'::jsonb end,
    'prescriptions', case when done then coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'rx_number', r.rx_number, 'status', r.status) order by r.created_at)
                        from public.prescriptions r where r.encounter_id = e.id and r.status <> 'draft'), '[]'::jsonb) else '[]'::jsonb end,
    'lab_orders', case when done then coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'order_number', o.order_number, 'status', o.status, 'lab', f.name,
                        'tests', (select jsonb_agg(i.display_name order by i.display_name) from public.lab_order_items i where i.order_id = o.id)) order by o.created_at)
                        from public.lab_orders o left join public.facilities f on f.id = o.lab_facility_id where o.encounter_id = e.id), '[]'::jsonb) else '[]'::jsonb end,
    'next_visit', (select min(lower(a.period)) from public.appointments a
                    where a.patient_id = e.patient_id and a.practitioner_id = e.practitioner_id
                      and lower(a.period) > now() and a.status in ('awaiting_confirmation', 'confirmed'))
  );
end;
$$;

revoke execute on function public.patient_visit(uuid) from public, anon;
grant execute on function public.patient_visit(uuid) to authenticated;
