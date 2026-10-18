-- The platform (super) admin runs facility finance and reports directly; the
-- separate complex-manager role is no longer offered. Only the guards of
-- these two non-clinical functions change (bodies otherwise identical).

create or replace function public.add_expense(p_facility_id uuid, p_category text, p_amount_minor bigint, p_spent_on date default current_date, p_note text default null)
returns public.expenses
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.expenses;
begin
  if not (private.can_admin_facility(p_facility_id) or private.is_platform_admin()) then perform private.fail('forbidden'); end if;
  insert into public.expenses (facility_id, category, amount_minor, spent_on, note, created_by)
  values (p_facility_id, trim(p_category), p_amount_minor, p_spent_on, p_note, auth.uid()) returning * into e;
  return e;
end;
$$;

create or replace function public.facility_report(p_facility_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  tz text := private.facility_tz(p_facility_id);
begin
  if not (private.can_admin_facility(p_facility_id) or private.is_platform_admin()) then perform private.fail('forbidden'); end if;
  return jsonb_build_object(
    'appointments_by_status', coalesce((select jsonb_object_agg(status, n) from (
        select a.status, count(*) n from public.appointments a
         where a.facility_id = p_facility_id and (lower(a.period) at time zone tz)::date between p_from and p_to group by a.status) s), '{}'::jsonb),
    'by_practitioner', coalesce((select jsonb_agg(x order by x.total desc) from (
        select pp.full_name as practitioner, count(*) as total,
               count(*) filter (where a.status = 'fulfilled') as fulfilled,
               count(*) filter (where a.status = 'cancelled') as cancelled,
               count(*) filter (where a.status = 'no_show') as no_show,
               count(*) filter (where a.source = 'reception') as from_reception,
               count(*) filter (where a.source in ('app', 'web')) as from_app
          from public.appointments a join public.practitioner_profiles pp on pp.id = a.practitioner_id
         where a.facility_id = p_facility_id and (lower(a.period) at time zone tz)::date between p_from and p_to
         group by pp.full_name) x), '[]'::jsonb),
    'walk_ins', (select count(*) from public.queue_entries where facility_id = p_facility_id and kind = 'walk_in' and service_date between p_from and p_to),
    'invoiced_minor', (select coalesce(sum(total_minor), 0) from public.invoices where facility_id = p_facility_id and status <> 'void'
                         and (created_at at time zone tz)::date between p_from and p_to),
    'collected_minor', (select coalesce(sum(p.amount_minor) filter (where p.amount_minor > 0), 0) from public.invoice_payments p
                          join public.invoices i on i.id = p.invoice_id where i.facility_id = p_facility_id and (p.created_at at time zone tz)::date between p_from and p_to),
    'refunded_minor', (select coalesce(-sum(p.amount_minor) filter (where p.amount_minor < 0), 0) from public.invoice_payments p
                         join public.invoices i on i.id = p.invoice_id where i.facility_id = p_facility_id and (p.created_at at time zone tz)::date between p_from and p_to),
    'by_method', coalesce((select jsonb_object_agg(method, total) from (select p.method, sum(p.amount_minor) total from public.invoice_payments p
                          join public.invoices i on i.id = p.invoice_id where i.facility_id = p_facility_id and (p.created_at at time zone tz)::date between p_from and p_to group by p.method) m), '{}'::jsonb),
    'expenses_minor', (select coalesce(sum(amount_minor), 0) from public.expenses where facility_id = p_facility_id and spent_on between p_from and p_to),
    'expenses_by_category', coalesce((select jsonb_object_agg(category, total) from (select category, sum(amount_minor) total from public.expenses
                          where facility_id = p_facility_id and spent_on between p_from and p_to group by category) e), '{}'::jsonb),
    'open_invoices', (select count(*) from public.invoices where facility_id = p_facility_id and status = 'open'));
end;
$$;
