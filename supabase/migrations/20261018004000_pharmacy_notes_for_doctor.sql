-- The pharmacist's note reaches the doctor (owner request, 25 Oct 2026):
-- «طلب توضيح» / «غير متوفر» notes on a doctor's prescriptions are listed for
-- that doctor («ملاحظات الصيدلية»), the doctor answers there, and the answer
-- shows to the pharmacy next to the line it was asked about.

alter table public.dispatch_line_notes add column if not exists doctor_reply text;
alter table public.dispatch_line_notes add column if not exists replied_at timestamptz;
alter table public.dispatch_line_notes add column if not exists replied_by uuid references public.profiles (id);
alter table public.dispatch_line_notes add column if not exists doctor_seen_at timestamptz;

-- the doctor's inbox of pharmacy notes (newest first, last 60 days)
create or replace function public.doctor_pharmacy_notes()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', n.id, 'kind', n.kind, 'note', n.note, 'at', n.created_at,
      'reply', n.doctor_reply, 'replied_at', n.replied_at, 'seen', n.doctor_seen_at is not null,
      'pharmacy', ph.name, 'pharmacy_phone', ph.phone, 'pharmacist', pr.display_name,
      'rx_number', r.rx_number, 'prescription_id', r.id, 'encounter_id', r.encounter_id,
      'medicine', i.display_name, 'line_no', n.line_no, 'patient_name', pt.full_name, 'public_code', pt.public_code)
      order by n.created_at desc), '[]'::jsonb)
    from public.dispatch_line_notes n
    join public.prescription_dispatches d on d.id = n.dispatch_id
    join public.prescriptions r on r.id = d.prescription_id
    join public.facilities ph on ph.id = d.pharmacy_id
    join public.patients pt on pt.id = r.patient_id
    left join public.profiles pr on pr.id = n.created_by
    left join public.prescription_items i on i.version_id = d.version_id and i.line_no = n.line_no
   where r.practitioner_id = private.current_practitioner_id()
     and n.kind in ('clarification_requested', 'not_available')
     and n.created_at > now() - interval '60 days';
$$;

create or replace function public.mark_pharmacy_notes_seen()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.dispatch_line_notes n set doctor_seen_at = now()
    from public.prescription_dispatches d join public.prescriptions r on r.id = d.prescription_id
   where d.id = n.dispatch_id and r.practitioner_id = private.current_practitioner_id() and n.doctor_seen_at is null;
$$;

-- the doctor answers; the pharmacy is told
create or replace function public.reply_pharmacy_note(p_note_id uuid, p_reply text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n public.dispatch_line_notes;
  d public.prescription_dispatches;
  u uuid;
begin
  select * into n from public.dispatch_line_notes where id = p_note_id for update;
  select * into d from public.prescription_dispatches where id = n.dispatch_id;
  if n.id is null or not private.is_rx_author(d.prescription_id) then perform private.fail('forbidden'); end if;
  if length(trim(coalesce(p_reply, ''))) < 2 then perform private.fail('reason_required'); end if;
  update public.dispatch_line_notes
     set doctor_reply = trim(p_reply), replied_at = now(), replied_by = auth.uid(), doctor_seen_at = coalesce(doctor_seen_at, now())
   where id = n.id;
  for u in select distinct m.user_id from public.memberships m
            where m.facility_id = d.pharmacy_id and m.role in ('pharmacist', 'pharmacy_staff') and m.status = 'active'
  loop
    perform private.notify_user(u, 'prescription.clarification_reply', jsonb_build_object('prescription_id', d.prescription_id, 'line_no', n.line_no),
                                'clarreply:' || n.id || ':' || extract(epoch from now())::bigint, array['in_app', 'push']::public.notification_channel[]);
  end loop;
  perform private.audit('prescription.clarification_reply', 'prescription', d.prescription_id, d.pharmacy_id, null, null, jsonb_build_object('line_no', n.line_no));
end;
$$;

revoke execute on function public.doctor_pharmacy_notes(), public.mark_pharmacy_notes_seen(), public.reply_pharmacy_note(uuid, text) from public, anon;
grant execute on function public.doctor_pharmacy_notes(), public.mark_pharmacy_notes_seen(), public.reply_pharmacy_note(uuid, text) to authenticated;

-- the pharmacy's dispensing view now carries the doctor's answer under each note
create or replace function public.dispatch_lines(p_dispatch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  d public.prescription_dispatches;
begin
  select * into d from public.prescription_dispatches where id = p_dispatch_id;
  if d.id is null or not private.is_pharmacy_staff(d.pharmacy_id) then perform private.fail('forbidden'); end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'line_no', i.line_no, 'display_name', i.display_name, 'medication_id', i.medication_id,
      'prescribed_quantity', i.quantity, 'quantity_unit', i.quantity_unit,
      'dispensed', private.dispensed_qty(d.id, i.line_no),
      'reserved', coalesce((select sum(r.quantity) from public.stock_reservations r where r.dispatch_id = d.id and r.line_no = i.line_no and r.status = 'active'), 0),
      'reserved_product_id', (select r.product_id from public.stock_reservations r where r.dispatch_id = d.id and r.line_no = i.line_no and r.status = 'active' limit 1),
      'notes', coalesce((select jsonb_agg(jsonb_build_object('kind', n.kind, 'note', n.note, 'at', n.created_at,
                                                            'reply', n.doctor_reply, 'replied_at', n.replied_at) order by n.created_at)
                          from public.dispatch_line_notes n where n.dispatch_id = d.id and n.line_no = i.line_no), '[]'::jsonb),
      'products', coalesce((select jsonb_agg(jsonb_build_object('product_id', p.id, 'name', p.name, 'unit_name', p.unit_name,
                              'unit_price_minor', p.unit_price_minor,
                              -- this prescription's own reservations count as available to it
                              'available', coalesce((select sum(private.batch_available(b.id)) from public.inventory_batches b
                                                      where b.product_id = p.id and b.expiry_date > current_date), 0)
                                           + coalesce((select sum(r.quantity) from public.stock_reservations r
                                                        where r.dispatch_id = d.id and r.product_id = p.id and r.status = 'active'), 0),
                              'manual_availability', p.manual_availability, 'manual_availability_at', p.manual_availability_at))
                            from public.pharmacy_products p
                           where p.pharmacy_id = d.pharmacy_id and p.is_active and (i.medication_id is null or p.medication_id = i.medication_id)), '[]'::jsonb))
      order by i.line_no) from public.prescription_items i where i.version_id = d.version_id), '[]'::jsonb);
end;
$$;

-- the request now also rings on the doctor's phone / browser, and «غير متوفر» is told too
create or replace function public.dispatch_line_note(p_dispatch_id uuid, p_line_no int, p_kind text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.prescription_dispatches;
begin
  select * into d from public.prescription_dispatches where id = p_dispatch_id;
  if d.id is null or not private.is_pharmacy_staff(d.pharmacy_id) then perform private.fail('forbidden'); end if;
  insert into public.dispatch_line_notes (dispatch_id, line_no, kind, note, created_by) values (d.id, p_line_no, p_kind, p_note, auth.uid());
  if p_kind = 'not_available' and not exists (select 1 from public.dispensing_records where dispatch_id = d.id) then
    update public.prescription_dispatches set status = 'not_available', updated_at = now() where id = d.id and status in ('sent', 'received', 'preparing');
    insert into public.prescription_events (prescription_id, version_id, event, facility_id, actor_user_id, note)
    values (d.prescription_id, d.version_id, 'not_available', d.pharmacy_id, auth.uid(), p_note);
  end if;
  if p_kind in ('clarification_requested', 'not_available') then
    perform private.notify_user((select pp.user_id from public.prescriptions r join public.practitioner_profiles pp on pp.id = r.practitioner_id where r.id = d.prescription_id),
      case when p_kind = 'not_available' then 'prescription.not_available' else 'prescription.clarification' end,
      jsonb_build_object('prescription_id', d.prescription_id, 'line_no', p_line_no),
      'clar:' || d.id || ':' || p_line_no || ':' || extract(epoch from now())::bigint, array['in_app', 'push']::public.notification_channel[]);
  end if;
end;
$$;
