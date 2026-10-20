-- One-step lab completion (owner request, 20 Oct 2026): the lab member
-- receives the patient, runs the test, then completes the order with a
-- typed value OR an uploaded result file (or both) — one action publishes
-- it to the patient and the ordering doctor. The detailed draft/release
-- steps stay available underneath and are reused here.
--
-- p_results: [{"item_id", "value", "unit", "range", "flag", "notes"}] — value may be empty
-- when the order has an available result file.
create or replace function public.complete_lab_order(p_order_id uuid, p_results jsonb default '[]'::jsonb)
returns public.lab_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.lab_orders;
  it public.lab_order_items;
  r jsonb;
  v text;
  has_file boolean;
  ids uuid[] := '{}';
begin
  select * into o from public.lab_orders where id = p_order_id for update;
  if o.id is null or not private.has_facility_role(o.lab_facility_id, array['lab_technician', 'lab_approver']::public.member_role[]) then
    perform private.fail('forbidden');
  end if;
  if o.status in ('released', 'cancelled') then perform private.fail('invalid_transition'); end if;

  -- receive the patient and collect the sample if that was not recorded separately
  if o.status in ('ordered', 'scheduled') then perform public.lab_check_in(o.id); end if;
  if not exists (select 1 from public.specimens s where s.order_id = o.id and s.status = 'collected') then
    perform public.collect_specimen(o.id, coalesce((select c.specimen_type from public.lab_order_items i
                                                     join public.lab_test_catalog c on c.id = i.test_id
                                                    where i.order_id = o.id limit 1), 'عينة'));
  end if;

  has_file := exists (select 1 from public.attachments a where a.lab_order_id = o.id and a.status = 'available');

  for it in select * from public.lab_order_items where order_id = o.id and status not in ('released', 'cancelled') order by display_name loop
    r := null;
    select x into r from jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) x where x ->> 'item_id' = it.id::text limit 1;
    v := nullif(trim(coalesce(r ->> 'value', '')), '');
    if v is not null then
      perform public.save_lab_result_draft(it.id,
        case when v ~ '^-?[0-9]+(\.[0-9]+)?$' then null else v end,
        case when v ~ '^-?[0-9]+(\.[0-9]+)?$' then v::numeric end,
        nullif(r ->> 'unit', ''), nullif(r ->> 'range', ''), nullif(r ->> 'flag', ''), nullif(r ->> 'notes', ''));
    elsif exists (select 1 from public.lab_results lr where lr.order_item_id = it.id and lr.status = 'draft') then
      null;                                                       -- a saved draft is published as is
    elsif has_file then
      perform public.save_lab_result_draft(it.id, 'النتيجة في الملف المرفق', null, null, null, null, nullif(r ->> 'notes', ''));
    else
      perform private.fail('result_or_file_required');
    end if;
    ids := ids || it.id;
  end loop;

  if array_length(ids, 1) is null then perform private.fail('nothing_to_release'); end if;
  return public.release_lab_results(o.id, ids);
end;
$$;

revoke execute on function public.complete_lab_order(uuid, jsonb) from public, anon;
grant execute on function public.complete_lab_order(uuid, jsonb) to authenticated;
