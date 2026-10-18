-- =====================================================================
-- 0016 Pharmacy operations (Phase 4, spec §10).
--   * Products (brand/pack) linked to the catalog's active ingredient,
--     explicit units-per-pack; batches with expiry and cost.
--   * Stock never negative (CHECK + row locks); expired batches never
--     dispensed; FEFO allocation; reserved ≠ available.
--   * Dispensing is atomic and idempotent, only from the CURRENT approved
--     version, never above the prescribed quantity; partial supported.
--   * Pharmacist cannot edit the prescription: only "not available" /
--     clarification notes; substitutions are out of scope (need approval).
--   * Money in integer minor units (IQD).
--   * Reports distinguish prescribed (lines/units) from dispensed and sold.
-- =====================================================================

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.facilities (id),
  name text not null,
  phone text,
  created_at timestamptz not null default now(),
  unique (pharmacy_id, name)
);

create table public.pharmacy_products (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.facilities (id),
  medication_id uuid references public.medication_catalog (id),
  name text not null,                         -- brand / product name as sold
  barcode text,
  pack_description text,                      -- e.g. "علبة 20 قرص"
  unit_name text not null default 'قرص',     -- base dispensing unit
  units_per_pack int not null default 1 check (units_per_pack > 0),
  unit_price_minor bigint not null default 0 check (unit_price_minor >= 0),
  reorder_level int not null default 0 check (reorder_level >= 0),
  manual_availability text check (manual_availability in ('available', 'limited', 'unavailable')),
  manual_availability_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1,
  unique (pharmacy_id, barcode)
);
create index pharmacy_products_med_idx on public.pharmacy_products (pharmacy_id, medication_id);
create trigger pharmacy_products_touch before update on public.pharmacy_products
  for each row execute function private.touch_row();

create table public.inventory_batches (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.pharmacy_products (id),
  batch_no text not null,
  expiry_date date not null,
  quantity_on_hand int not null check (quantity_on_hand >= 0),     -- base units; never negative
  unit_cost_minor bigint not null default 0 check (unit_cost_minor >= 0),
  supplier_id uuid references public.suppliers (id),
  received_at timestamptz not null default now(),
  received_by uuid references public.profiles (id),
  unique (product_id, batch_no, expiry_date)
);
create index inventory_batches_fefo on public.inventory_batches (product_id, expiry_date) where quantity_on_hand > 0;

create table public.stock_movements (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.pharmacy_products (id),
  batch_id uuid references public.inventory_batches (id),
  quantity int not null check (quantity <> 0),            -- signed, base units
  kind text not null check (kind in ('receive', 'dispense', 'sale', 'return', 'adjust', 'count')),
  dispatch_id uuid references public.prescription_dispatches (id),
  sale_id uuid,
  reason text,
  actor_user_id uuid,
  idempotency_key text,
  occurred_at timestamptz not null default now()
);
create unique index stock_movements_idem on public.stock_movements (actor_user_id, idempotency_key, batch_id) where idempotency_key is not null;
create index stock_movements_product_idx on public.stock_movements (product_id, occurred_at desc);

create table public.stock_reservations (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid not null references public.prescription_dispatches (id),
  line_no int not null,
  product_id uuid not null references public.pharmacy_products (id),
  batch_id uuid not null references public.inventory_batches (id),
  quantity int not null check (quantity > 0),
  status text not null default 'active' check (status in ('active', 'consumed', 'released')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index stock_reservations_active on public.stock_reservations (batch_id) where status = 'active';

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  sale_number text not null unique default ('S' || private.random_code(8)),
  pharmacy_id uuid not null references public.facilities (id),
  dispatch_id uuid references public.prescription_dispatches (id),
  patient_id uuid references public.patients (id),
  source text not null check (source in ('e_prescription', 'paper_prescription', 'otc')),
  source_note text,
  total_minor bigint not null default 0 check (total_minor >= 0),
  currency text not null default 'IQD',
  created_by uuid not null references public.profiles (id),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (created_by, idempotency_key)
);
alter table public.stock_movements add constraint stock_movements_sale_fk foreign key (sale_id) references public.sales (id);

create table public.sale_lines (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id),
  product_id uuid not null references public.pharmacy_products (id),
  batch_id uuid not null references public.inventory_batches (id),
  rx_line_no int,
  quantity int not null check (quantity > 0),
  returned_quantity int not null default 0 check (returned_quantity >= 0),
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  line_total_minor bigint not null check (line_total_minor >= 0),
  check (returned_quantity <= quantity)
);

create table public.dispensing_records (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid not null references public.prescription_dispatches (id),
  version_id uuid not null references public.prescription_versions (id),
  line_no int not null,
  product_id uuid not null references public.pharmacy_products (id),
  batch_id uuid not null references public.inventory_batches (id),
  quantity int not null check (quantity > 0),
  sale_id uuid references public.sales (id),
  dispensed_by uuid not null references public.profiles (id),
  dispensed_at timestamptz not null default now()
);
create index dispensing_dispatch_idx on public.dispensing_records (dispatch_id, line_no);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id),
  amount_minor bigint not null check (amount_minor > 0),
  method text not null default 'cash' check (method in ('cash', 'card', 'other')),
  received_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  sale_line_id uuid not null references public.sale_lines (id),
  quantity int not null check (quantity > 0),
  amount_minor bigint not null check (amount_minor >= 0),
  reason text not null,
  restocked boolean not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

-- line-level notes from the pharmacist (not available / clarification)
create table public.dispatch_line_notes (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid not null references public.prescription_dispatches (id),
  line_no int not null,
  kind text not null check (kind in ('not_available', 'clarification_requested', 'note')),
  note text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

-- =====================================================================
-- RLS: pharmacy members only (products are not public; availability is
-- served by search_medications to prescribers).
-- =====================================================================
create or replace function private.is_pharmacy_staff(p_pharmacy_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select private.has_facility_role(p_pharmacy_id, array['pharmacist', 'pharmacy_staff']::public.member_role[]); $$;

alter table public.suppliers enable row level security;
alter table public.pharmacy_products enable row level security;
alter table public.inventory_batches enable row level security;
alter table public.stock_movements enable row level security;
alter table public.stock_reservations enable row level security;
alter table public.sales enable row level security;
alter table public.sale_lines enable row level security;
alter table public.dispensing_records enable row level security;
alter table public.payments enable row level security;
alter table public.refunds enable row level security;
alter table public.dispatch_line_notes enable row level security;

create policy suppliers_read on public.suppliers for select to authenticated using (private.is_pharmacy_staff(pharmacy_id));
create policy products_read on public.pharmacy_products for select to authenticated using (private.is_pharmacy_staff(pharmacy_id));
create policy batches_read on public.inventory_batches for select to authenticated
  using (exists (select 1 from public.pharmacy_products p where p.id = inventory_batches.product_id and private.is_pharmacy_staff(p.pharmacy_id)));
create policy movements_read on public.stock_movements for select to authenticated
  using (exists (select 1 from public.pharmacy_products p where p.id = stock_movements.product_id and private.is_pharmacy_staff(p.pharmacy_id)));
create policy reservations_read on public.stock_reservations for select to authenticated
  using (exists (select 1 from public.pharmacy_products p where p.id = stock_reservations.product_id and private.is_pharmacy_staff(p.pharmacy_id)));
create policy sales_read on public.sales for select to authenticated using (private.is_pharmacy_staff(pharmacy_id));
create policy sale_lines_read on public.sale_lines for select to authenticated
  using (exists (select 1 from public.sales s where s.id = sale_lines.sale_id and private.is_pharmacy_staff(s.pharmacy_id)));
create policy dispensing_read on public.dispensing_records for select to authenticated
  using (exists (select 1 from public.prescription_dispatches d where d.id = dispensing_records.dispatch_id
                  and (private.is_pharmacy_staff(d.pharmacy_id) or private.can_read_rx(d.prescription_id))));
create policy payments_read on public.payments for select to authenticated
  using (exists (select 1 from public.sales s where s.id = payments.sale_id and private.is_pharmacy_staff(s.pharmacy_id)));
create policy refunds_read on public.refunds for select to authenticated
  using (exists (select 1 from public.sale_lines l join public.sales s on s.id = l.sale_id where l.id = refunds.sale_line_id and private.is_pharmacy_staff(s.pharmacy_id)));
create policy line_notes_read on public.dispatch_line_notes for select to authenticated
  using (exists (select 1 from public.prescription_dispatches d where d.id = dispatch_line_notes.dispatch_id
                  and (private.is_pharmacy_staff(d.pharmacy_id) or private.is_rx_author(d.prescription_id))));

grant select on public.suppliers, public.pharmacy_products, public.inventory_batches, public.stock_movements, public.stock_reservations,
  public.sales, public.sale_lines, public.dispensing_records, public.payments, public.refunds, public.dispatch_line_notes to authenticated;

-- =====================================================================
-- Helpers
-- =====================================================================
create or replace function private.batch_available(p_batch_id uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select b.quantity_on_hand - coalesce((select sum(r.quantity) from public.stock_reservations r
                                        where r.batch_id = b.id and r.status = 'active'), 0)::int
    from public.inventory_batches b where b.id = p_batch_id;
$$;

-- FEFO allocation of p_qty units of a product from non-expired batches.
-- Locks the batch rows (concurrent dispensing of the last pack: one wins).
-- p_dispatch_id: reservations of that dispatch count as available to it.
create or replace function private.allocate_fefo(p_product_id uuid, p_qty int, p_dispatch_id uuid default null)
returns table (batch_id uuid, quantity int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  b record;
  left_ int := p_qty;
  take int;
  avail int;
begin
  for b in
    select ib.id, ib.quantity_on_hand from public.inventory_batches ib
     where ib.product_id = p_product_id and ib.expiry_date > current_date and ib.quantity_on_hand > 0
     order by ib.expiry_date, ib.received_at
     for update
  loop
    exit when left_ <= 0;
    avail := b.quantity_on_hand - coalesce((select sum(r.quantity) from public.stock_reservations r
              where r.batch_id = b.id and r.status = 'active' and r.dispatch_id is distinct from p_dispatch_id), 0)::int;
    if avail <= 0 then continue; end if;
    take := least(avail, left_);
    batch_id := b.id; quantity := take;
    return next;
    left_ := left_ - take;
  end loop;
  if left_ > 0 then perform private.fail('insufficient_stock'); end if;
end;
$$;

-- =====================================================================
-- Product & stock management
-- =====================================================================
create or replace function public.upsert_pharmacy_product(
  p_pharmacy_id uuid,
  p_name text,
  p_unit_price_minor bigint,
  p_medication_id uuid default null,
  p_units_per_pack int default 1,
  p_unit_name text default 'قرص',
  p_pack_description text default null,
  p_barcode text default null,
  p_reorder_level int default 0,
  p_product_id uuid default null,
  p_is_active boolean default true
) returns public.pharmacy_products
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.pharmacy_products;
begin
  if not private.has_facility_role(p_pharmacy_id, array['pharmacist', 'facility_admin']::public.member_role[]) then perform private.fail('forbidden'); end if;
  if p_product_id is null then
    insert into public.pharmacy_products (pharmacy_id, medication_id, name, barcode, pack_description, unit_name, units_per_pack, unit_price_minor, reorder_level, is_active)
    values (p_pharmacy_id, p_medication_id, trim(p_name), nullif(trim(p_barcode), ''), p_pack_description, p_unit_name, p_units_per_pack, p_unit_price_minor, p_reorder_level, p_is_active)
    returning * into r;
  else
    update public.pharmacy_products set medication_id = p_medication_id, name = trim(p_name), barcode = nullif(trim(p_barcode), ''),
           pack_description = p_pack_description, unit_name = p_unit_name, units_per_pack = p_units_per_pack,
           unit_price_minor = p_unit_price_minor, reorder_level = p_reorder_level, is_active = p_is_active
     where id = p_product_id and pharmacy_id = p_pharmacy_id returning * into r;
    if r.id is null then perform private.fail('not_found'); end if;
  end if;
  return r;
end;
$$;

-- Manual availability (when stock is not tracked) — shown with its date,
-- never as a confirmed quantity.
create or replace function public.set_manual_availability(p_product_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ph uuid;
begin
  select pharmacy_id into ph from public.pharmacy_products where id = p_product_id;
  if ph is null or not private.is_pharmacy_staff(ph) then perform private.fail('forbidden'); end if;
  update public.pharmacy_products set manual_availability = p_status, manual_availability_at = case when p_status is null then null else now() end
   where id = p_product_id;
end;
$$;

create or replace function public.receive_stock(
  p_product_id uuid,
  p_batch_no text,
  p_expiry_date date,
  p_packs int,
  p_unit_cost_minor bigint,
  p_idempotency_key text,
  p_supplier_name text default null
) returns public.inventory_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.pharmacy_products;
  b public.inventory_batches;
  sup uuid;
  units int;
begin
  select * into p from public.pharmacy_products where id = p_product_id;
  if p.id is null or not private.has_facility_role(p.pharmacy_id, array['pharmacist', 'facility_admin']::public.member_role[]) then
    perform private.fail('forbidden');
  end if;
  if p_packs is null or p_packs <= 0 then perform private.fail('invalid_quantity'); end if;
  if p_expiry_date <= current_date then perform private.fail('expired_batch'); end if;
  if exists (select 1 from public.stock_movements where actor_user_id = auth.uid() and idempotency_key = p_idempotency_key) then
    select b2.* into b from public.inventory_batches b2 join public.stock_movements m on m.batch_id = b2.id
     where m.actor_user_id = auth.uid() and m.idempotency_key = p_idempotency_key limit 1;
    return b;
  end if;
  units := p_packs * p.units_per_pack;
  if p_supplier_name is not null and length(trim(p_supplier_name)) > 0 then
    insert into public.suppliers (pharmacy_id, name) values (p.pharmacy_id, trim(p_supplier_name))
    on conflict (pharmacy_id, name) do update set name = excluded.name returning id into sup;
  end if;
  insert into public.inventory_batches (product_id, batch_no, expiry_date, quantity_on_hand, unit_cost_minor, supplier_id, received_by)
  values (p.id, trim(p_batch_no), p_expiry_date, units, p_unit_cost_minor, sup, auth.uid())
  on conflict (product_id, batch_no, expiry_date) do update set quantity_on_hand = public.inventory_batches.quantity_on_hand + excluded.quantity_on_hand
  returning * into b;
  insert into public.stock_movements (product_id, batch_id, quantity, kind, actor_user_id, idempotency_key)
  values (p.id, b.id, units, 'receive', auth.uid(), p_idempotency_key);
  return b;
end;
$$;

-- Stock count / adjustment with reason (never below reserved quantity).
create or replace function public.adjust_stock(p_batch_id uuid, p_counted_quantity int, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.inventory_batches;
  ph uuid;
  reserved int;
begin
  select * into b from public.inventory_batches where id = p_batch_id for update;
  select pharmacy_id into ph from public.pharmacy_products where id = b.product_id;
  if b.id is null or not private.has_facility_role(ph, array['pharmacist', 'facility_admin']::public.member_role[]) then perform private.fail('forbidden'); end if;
  if p_reason is null or length(trim(p_reason)) < 3 then perform private.fail('reason_required'); end if;
  if p_counted_quantity < 0 then perform private.fail('invalid_quantity'); end if;
  select coalesce(sum(quantity), 0) into reserved from public.stock_reservations where batch_id = b.id and status = 'active';
  if p_counted_quantity < reserved then perform private.fail('below_reserved'); end if;
  if p_counted_quantity = b.quantity_on_hand then return; end if;
  update public.inventory_batches set quantity_on_hand = p_counted_quantity where id = b.id;
  insert into public.stock_movements (product_id, batch_id, quantity, kind, reason, actor_user_id)
  values (b.product_id, b.id, p_counted_quantity - b.quantity_on_hand, 'count', p_reason, auth.uid());
end;
$$;

-- =====================================================================
-- Prescription preparation and dispensing
-- =====================================================================

-- quantities already dispensed per line for a dispatch
create or replace function private.dispensed_qty(p_dispatch_id uuid, p_line_no int)
returns int
language sql
stable
security definer
set search_path = ''
as $$ select coalesce(sum(quantity), 0)::int from public.dispensing_records where dispatch_id = p_dispatch_id and line_no = p_line_no; $$;

create or replace function private.load_dispatch_for_pharmacy(p_dispatch_id uuid)
returns public.prescription_dispatches
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.prescription_dispatches;
  r public.prescriptions;
  v public.prescription_versions;
begin
  select * into d from public.prescription_dispatches where id = p_dispatch_id for update;
  if d.id is null or not private.is_pharmacy_staff(d.pharmacy_id) then perform private.fail('forbidden'); end if;
  select * into r from public.prescriptions where id = d.prescription_id;
  select * into v from public.prescription_versions where id = d.version_id;
  -- only the current approved version of an active prescription can be dispensed
  if r.status <> 'active' or v.status <> 'approved' or r.current_version_id <> d.version_id then
    perform private.fail('prescription_not_dispensable');
  end if;
  if d.status in ('dispensed', 'cancelled') then perform private.fail('invalid_transition'); end if;
  return d;
end;
$$;

-- Reserve stock for preparation (FEFO). p_lines: [{line_no, product_id, quantity}] in base units.
create or replace function public.prepare_dispatch(p_dispatch_id uuid, p_lines jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.prescription_dispatches;
  l jsonb;
  a record;
  prescribed numeric;
  ph uuid;
begin
  d := private.load_dispatch_for_pharmacy(p_dispatch_id);
  update public.stock_reservations set status = 'released' where dispatch_id = d.id and status = 'active';
  for l in select * from jsonb_array_elements(p_lines) loop
    select pharmacy_id into ph from public.pharmacy_products where id = (l ->> 'product_id')::uuid;
    if ph is distinct from d.pharmacy_id then perform private.fail('invalid_product'); end if;
    select quantity into prescribed from public.prescription_items where version_id = d.version_id and line_no = (l ->> 'line_no')::int;
    if not found then perform private.fail('invalid_line'); end if;
    if prescribed is not null and (l ->> 'quantity')::int + private.dispensed_qty(d.id, (l ->> 'line_no')::int) > prescribed then
      perform private.fail('exceeds_prescribed');
    end if;
    for a in select * from private.allocate_fefo((l ->> 'product_id')::uuid, (l ->> 'quantity')::int, d.id) loop
      insert into public.stock_reservations (dispatch_id, line_no, product_id, batch_id, quantity, created_by)
      values (d.id, (l ->> 'line_no')::int, (l ->> 'product_id')::uuid, a.batch_id, a.quantity, auth.uid());
    end loop;
  end loop;
  update public.prescription_dispatches set status = 'preparing', updated_at = now() where id = d.id;
  insert into public.prescription_events (prescription_id, version_id, event, facility_id, actor_user_id)
  values (d.prescription_id, d.version_id, 'preparing', d.pharmacy_id, auth.uid());
end;
$$;

-- Atomic dispensing: allocate (consuming this dispatch's reservations
-- first), decrement stock, record dispensing + sale + movements.
create or replace function public.dispense_prescription(p_dispatch_id uuid, p_lines jsonb, p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.prescription_dispatches;
  r public.prescriptions;
  s public.sales;
  l jsonb;
  a record;
  p public.pharmacy_products;
  prescribed numeric;
  total bigint := 0;
  complete boolean;
begin
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then perform private.fail('idempotency_key_required'); end if;
  select * into s from public.sales where created_by = auth.uid() and idempotency_key = p_idempotency_key;
  if s.id is not null then
    return jsonb_build_object('sale_id', s.id, 'sale_number', s.sale_number, 'total_minor', s.total_minor, 'replayed', true);
  end if;
  d := private.load_dispatch_for_pharmacy(p_dispatch_id);
  select * into r from public.prescriptions where id = d.prescription_id;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then perform private.fail('items_required'); end if;

  insert into public.sales (pharmacy_id, dispatch_id, patient_id, source, created_by, idempotency_key)
  values (d.pharmacy_id, d.id, r.patient_id, 'e_prescription', auth.uid(), p_idempotency_key) returning * into s;

  for l in select * from jsonb_array_elements(p_lines) loop
    select * into p from public.pharmacy_products where id = (l ->> 'product_id')::uuid and pharmacy_id = d.pharmacy_id and is_active;
    if p.id is null then perform private.fail('invalid_product'); end if;
    select quantity into prescribed from public.prescription_items where version_id = d.version_id and line_no = (l ->> 'line_no')::int;
    if not found then perform private.fail('invalid_line'); end if;
    if (l ->> 'quantity')::int <= 0 then perform private.fail('invalid_quantity'); end if;
    if prescribed is not null and (l ->> 'quantity')::int + private.dispensed_qty(d.id, (l ->> 'line_no')::int) > prescribed then
      perform private.fail('exceeds_prescribed');
    end if;
    for a in select * from private.allocate_fefo(p.id, (l ->> 'quantity')::int, d.id) loop
      update public.inventory_batches set quantity_on_hand = quantity_on_hand - a.quantity where id = a.batch_id;
      insert into public.dispensing_records (dispatch_id, version_id, line_no, product_id, batch_id, quantity, sale_id, dispensed_by)
      values (d.id, d.version_id, (l ->> 'line_no')::int, p.id, a.batch_id, a.quantity, s.id, auth.uid());
      insert into public.sale_lines (sale_id, product_id, batch_id, rx_line_no, quantity, unit_price_minor, line_total_minor)
      values (s.id, p.id, a.batch_id, (l ->> 'line_no')::int, a.quantity, p.unit_price_minor, a.quantity * p.unit_price_minor);
      insert into public.stock_movements (product_id, batch_id, quantity, kind, dispatch_id, sale_id, actor_user_id)
      values (p.id, a.batch_id, -a.quantity, 'dispense', d.id, s.id, auth.uid());
      total := total + a.quantity * p.unit_price_minor;
    end loop;
  end loop;
  update public.stock_reservations set status = 'consumed' where dispatch_id = d.id and status = 'active';
  update public.sales set total_minor = total where id = s.id;

  -- complete when every line with a prescribed quantity is fully dispensed
  select bool_and(i.quantity is null or private.dispensed_qty(d.id, i.line_no) >= i.quantity)
    into complete from public.prescription_items i where i.version_id = d.version_id;
  update public.prescription_dispatches set status = case when complete then 'dispensed' else 'partially_dispensed' end, updated_at = now()
   where id = d.id;
  insert into public.prescription_events (prescription_id, version_id, event, facility_id, actor_user_id)
  values (d.prescription_id, d.version_id, case when complete then 'dispensed' else 'partially_dispensed' end, d.pharmacy_id, auth.uid());
  perform private.notify_patient(r.patient_id, 'prescription.dispensed', jsonb_build_object('rx_number', r.rx_number), 'disp:' || s.id);
  return jsonb_build_object('sale_id', s.id, 'sale_number', s.sale_number, 'total_minor', total, 'complete', complete);
end;
$$;

-- Not available / clarification: never edits the prescription.
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
  if p_kind = 'clarification_requested' then
    perform private.notify_user((select pp.user_id from public.prescriptions r join public.practitioner_profiles pp on pp.id = r.practitioner_id where r.id = d.prescription_id),
      'prescription.clarification', jsonb_build_object('prescription_id', d.prescription_id, 'line_no', p_line_no), 'clar:' || d.id || ':' || p_line_no || ':' || extract(epoch from now())::bigint);
  end if;
end;
$$;

-- Direct sale: OTC or paper prescription (source documented).
create or replace function public.direct_sale(
  p_pharmacy_id uuid,
  p_lines jsonb,               -- [{product_id, quantity}]
  p_source text,
  p_idempotency_key text,
  p_source_note text default null,
  p_patient_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.sales;
  l jsonb;
  a record;
  p public.pharmacy_products;
  total bigint := 0;
begin
  if not private.is_pharmacy_staff(p_pharmacy_id) then perform private.fail('forbidden'); end if;
  if p_source not in ('paper_prescription', 'otc') then perform private.fail('invalid_source'); end if;
  if p_source = 'paper_prescription' and (p_source_note is null or length(trim(p_source_note)) < 3) then perform private.fail('source_note_required'); end if;
  select * into s from public.sales where created_by = auth.uid() and idempotency_key = p_idempotency_key;
  if s.id is not null then return jsonb_build_object('sale_id', s.id, 'sale_number', s.sale_number, 'total_minor', s.total_minor, 'replayed', true); end if;
  insert into public.sales (pharmacy_id, patient_id, source, source_note, created_by, idempotency_key)
  values (p_pharmacy_id, p_patient_id, p_source, p_source_note, auth.uid(), p_idempotency_key) returning * into s;
  for l in select * from jsonb_array_elements(p_lines) loop
    select * into p from public.pharmacy_products where id = (l ->> 'product_id')::uuid and pharmacy_id = p_pharmacy_id and is_active;
    if p.id is null then perform private.fail('invalid_product'); end if;
    if (l ->> 'quantity')::int <= 0 then perform private.fail('invalid_quantity'); end if;
    for a in select * from private.allocate_fefo(p.id, (l ->> 'quantity')::int, null) loop
      update public.inventory_batches set quantity_on_hand = quantity_on_hand - a.quantity where id = a.batch_id;
      insert into public.sale_lines (sale_id, product_id, batch_id, quantity, unit_price_minor, line_total_minor)
      values (s.id, p.id, a.batch_id, a.quantity, p.unit_price_minor, a.quantity * p.unit_price_minor);
      insert into public.stock_movements (product_id, batch_id, quantity, kind, sale_id, actor_user_id)
      values (p.id, a.batch_id, -a.quantity, 'sale', s.id, auth.uid());
      total := total + a.quantity * p.unit_price_minor;
    end loop;
  end loop;
  update public.sales set total_minor = total where id = s.id;
  return jsonb_build_object('sale_id', s.id, 'sale_number', s.sale_number, 'total_minor', total);
end;
$$;

create or replace function public.record_payment(p_sale_id uuid, p_amount_minor bigint, p_method text default 'cash')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.sales;
  paid bigint;
begin
  select * into s from public.sales where id = p_sale_id for update;
  if s.id is null or not private.is_pharmacy_staff(s.pharmacy_id) then perform private.fail('forbidden'); end if;
  select coalesce(sum(amount_minor), 0) into paid from public.payments where sale_id = s.id;
  if paid + p_amount_minor > s.total_minor then perform private.fail('overpayment'); end if;
  insert into public.payments (sale_id, amount_minor, method, received_by) values (s.id, p_amount_minor, p_method, auth.uid());
end;
$$;

-- Return: restock only non-expired items; refund at the sold price.
create or replace function public.return_sale_line(p_sale_line_id uuid, p_quantity int, p_reason text, p_restock boolean default true)
returns public.refunds
language plpgsql
security definer
set search_path = ''
as $$
declare
  sl public.sale_lines;
  s public.sales;
  b public.inventory_batches;
  rf public.refunds;
  restock boolean;
begin
  select * into sl from public.sale_lines where id = p_sale_line_id for update;
  select * into s from public.sales where id = sl.sale_id;
  if sl.id is null or not private.has_facility_role(s.pharmacy_id, array['pharmacist', 'facility_admin']::public.member_role[]) then perform private.fail('forbidden'); end if;
  if p_reason is null or length(trim(p_reason)) < 3 then perform private.fail('reason_required'); end if;
  if p_quantity <= 0 or sl.returned_quantity + p_quantity > sl.quantity then perform private.fail('invalid_quantity'); end if;
  select * into b from public.inventory_batches where id = sl.batch_id for update;
  restock := p_restock and b.expiry_date > current_date;
  update public.sale_lines set returned_quantity = returned_quantity + p_quantity where id = sl.id;
  if restock then
    update public.inventory_batches set quantity_on_hand = quantity_on_hand + p_quantity where id = b.id;
    insert into public.stock_movements (product_id, batch_id, quantity, kind, sale_id, reason, actor_user_id)
    values (sl.product_id, b.id, p_quantity, 'return', s.id, p_reason, auth.uid());
  end if;
  insert into public.refunds (sale_line_id, quantity, amount_minor, reason, restocked, created_by)
  values (sl.id, p_quantity, p_quantity * sl.unit_price_minor, p_reason, restock, auth.uid()) returning * into rf;
  return rf;
end;
$$;

-- =====================================================================
-- Read models
-- =====================================================================
create or replace function public.pharmacy_stock(p_pharmacy_id uuid)
returns table (product_id uuid, name text, medication text, unit_name text, units_per_pack int, unit_price_minor bigint,
               on_hand int, reserved int, available int, expired_on_hand int, nearest_expiry date, reorder_level int,
               low_stock boolean, manual_availability text, manual_availability_at timestamptz, batches jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not private.is_pharmacy_staff(p_pharmacy_id) then perform private.fail('forbidden'); end if;
  return query
  with b as (
    select ib.*, coalesce((select sum(r.quantity) from public.stock_reservations r where r.batch_id = ib.id and r.status = 'active'), 0)::int as res
      from public.inventory_batches ib
  )
  select p.id, p.name,
         (select concat_ws(' ', m.active_ingredient, m.strength, m.dosage_form) from public.medication_catalog m where m.id = p.medication_id),
         p.unit_name, p.units_per_pack, p.unit_price_minor,
         coalesce(sum(b.quantity_on_hand) filter (where b.expiry_date > current_date), 0)::int,
         coalesce(sum(b.res), 0)::int,
         coalesce(sum(b.quantity_on_hand - b.res) filter (where b.expiry_date > current_date), 0)::int,
         coalesce(sum(b.quantity_on_hand) filter (where b.expiry_date <= current_date), 0)::int,
         min(b.expiry_date) filter (where b.expiry_date > current_date and b.quantity_on_hand > 0),
         p.reorder_level,
         coalesce(sum(b.quantity_on_hand - b.res) filter (where b.expiry_date > current_date), 0) <= p.reorder_level,
         p.manual_availability, p.manual_availability_at,
         coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'batch_no', b.batch_no, 'expiry_date', b.expiry_date, 'on_hand', b.quantity_on_hand,
                                               'reserved', b.res, 'expired', b.expiry_date <= current_date) order by b.expiry_date)
                  filter (where b.id is not null), '[]'::jsonb)
    from public.pharmacy_products p
    left join b on b.product_id = p.id
   where p.pharmacy_id = p_pharmacy_id
   group by p.id
   order by p.name;
end;
$$;

-- Dispensing view of a dispatch: prescribed vs dispensed per line + products to pick.
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
      'notes', coalesce((select jsonb_agg(jsonb_build_object('kind', n.kind, 'note', n.note, 'at', n.created_at) order by n.created_at)
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

-- Prescribed vs dispensed vs sold — only prescriptions this pharmacy
-- received; grouped by active ingredient (catalog) and by product.
create or replace function public.pharmacy_report(p_pharmacy_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_facility_role(p_pharmacy_id, array['pharmacist', 'facility_admin']::public.member_role[]) then perform private.fail('forbidden'); end if;
  return jsonb_build_object(
    'by_ingredient', coalesce((select jsonb_agg(x order by x.unique_prescriptions desc) from (
        select coalesce(m.active_ingredient, i.display_name) as ingredient,
               count(distinct r.id) as unique_prescriptions,         -- unique approved prescriptions (current versions)
               count(*) as line_count,                               -- times the item appeared
               coalesce(sum(i.quantity), 0) as units_requested,
               coalesce((select sum(dr.quantity) from public.dispensing_records dr join public.prescription_dispatches d2 on d2.id = dr.dispatch_id
                          join public.pharmacy_products pp on pp.id = dr.product_id
                         where d2.pharmacy_id = p_pharmacy_id and (pp.medication_id = m.id)
                           and dr.dispensed_at::date between p_from and p_to), 0) as units_dispensed
          from public.prescription_dispatches d
          join public.prescriptions r on r.id = d.prescription_id and r.status = 'active'
          join public.prescription_items i on i.version_id = r.current_version_id
          left join public.medication_catalog m on m.id = i.medication_id
         where d.pharmacy_id = p_pharmacy_id and d.sent_at::date between p_from and p_to
         group by m.id, coalesce(m.active_ingredient, i.display_name)) x), '[]'::jsonb),
    'by_product', coalesce((select jsonb_agg(y order by y.sold_units desc) from (
        select p.name, coalesce(sum(sl.quantity), 0) as sold_units, coalesce(sum(sl.returned_quantity), 0) as returned_units,
               coalesce(sum(sl.line_total_minor), 0) as sales_minor,
               coalesce(sum(sl.returned_quantity * sl.unit_price_minor), 0) as refunds_minor
          from public.pharmacy_products p
          join public.sale_lines sl on sl.product_id = p.id
          join public.sales s on s.id = sl.sale_id and s.created_at::date between p_from and p_to
         where p.pharmacy_id = p_pharmacy_id
         group by p.id) y), '[]'::jsonb),
    'top_prescribers', coalesce((select jsonb_agg(z order by z.prescriptions desc) from (
        select v.snapshot -> 'practitioner' ->> 'full_name' as practitioner, count(distinct r.id) as prescriptions
          from public.prescription_dispatches d
          join public.prescriptions r on r.id = d.prescription_id and r.status = 'active'
          join public.prescription_versions v on v.id = r.current_version_id
         where d.pharmacy_id = p_pharmacy_id and d.sent_at::date between p_from and p_to
         group by 1 limit 10) z), '[]'::jsonb),
    'totals', (select jsonb_build_object('sales_minor', coalesce(sum(total_minor), 0), 'sales_count', count(*))
                 from public.sales where pharmacy_id = p_pharmacy_id and created_at::date between p_from and p_to),
    'refunds_minor', (select coalesce(sum(rf.amount_minor), 0) from public.refunds rf join public.sale_lines sl on sl.id = rf.sale_line_id
                        join public.sales s on s.id = sl.sale_id where s.pharmacy_id = p_pharmacy_id and rf.created_at::date between p_from and p_to)
  );
end;
$$;

-- Prescriber-side availability: real stock when tracked, otherwise the
-- dated manual status, otherwise 'unknown'.
create or replace function public.search_medications(p_query text, p_pharmacy_id uuid default null)
returns table (medication_id uuid, active_ingredient text, brand_name text, strength text, dosage_form text, unit text,
               availability text, availability_updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.active_ingredient, m.brand_name, m.strength, m.dosage_form, m.unit,
         case
           when p_pharmacy_id is null then 'unknown'
           when exists (select 1 from public.pharmacy_products p join public.inventory_batches b on b.product_id = p.id
                         where p.pharmacy_id = p_pharmacy_id and p.medication_id = m.id and p.is_active) then
             case when (select coalesce(sum(private.batch_available(b.id)), 0) from public.pharmacy_products p
                          join public.inventory_batches b on b.product_id = p.id
                         where p.pharmacy_id = p_pharmacy_id and p.medication_id = m.id and p.is_active and b.expiry_date > current_date) > 0
                  then 'in_stock' else 'out_of_stock' end
           else coalesce((select p.manual_availability from public.pharmacy_products p
                           where p.pharmacy_id = p_pharmacy_id and p.medication_id = m.id and p.manual_availability is not null
                           order by p.manual_availability_at desc limit 1), 'unknown')
         end,
         case when p_pharmacy_id is null then null else
           greatest((select max(mv.occurred_at) from public.stock_movements mv join public.pharmacy_products p on p.id = mv.product_id
                      where p.pharmacy_id = p_pharmacy_id and p.medication_id = m.id),
                    (select max(p.manual_availability_at) from public.pharmacy_products p where p.pharmacy_id = p_pharmacy_id and p.medication_id = m.id)) end
    from public.medication_catalog m
   where m.is_active and length(trim(coalesce(p_query, ''))) >= 2
     and (m.active_ingredient ilike '%' || trim(p_query) || '%' or coalesce(m.brand_name, '') ilike '%' || trim(p_query) || '%')
   order by m.active_ingredient, m.brand_name nulls first, m.strength
   limit 20;
$$;

-- Reservations of a superseded/cancelled version are released.
create or replace function private.release_stale_reservations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('superseded', 'cancelled') and old.status = 'approved' then
    update public.stock_reservations r set status = 'released'
      from public.prescription_dispatches d
     where r.dispatch_id = d.id and d.prescription_id = new.prescription_id and r.status = 'active';
  end if;
  return new;
end;
$$;
create trigger rx_versions_release_reservations after update of status on public.prescription_versions
  for each row execute function private.release_stale_reservations();

revoke execute on function
  public.upsert_pharmacy_product(uuid, text, bigint, uuid, int, text, text, text, int, uuid, boolean),
  public.set_manual_availability(uuid, text), public.receive_stock(uuid, text, date, int, bigint, text, text),
  public.adjust_stock(uuid, int, text), public.prepare_dispatch(uuid, jsonb), public.dispense_prescription(uuid, jsonb, text),
  public.dispatch_line_note(uuid, int, text, text), public.direct_sale(uuid, jsonb, text, text, text, uuid),
  public.record_payment(uuid, bigint, text), public.return_sale_line(uuid, int, text, boolean),
  public.pharmacy_stock(uuid), public.dispatch_lines(uuid), public.pharmacy_report(uuid, date, date)
from public, anon;
grant execute on function
  public.upsert_pharmacy_product(uuid, text, bigint, uuid, int, text, text, text, int, uuid, boolean),
  public.set_manual_availability(uuid, text), public.receive_stock(uuid, text, date, int, bigint, text, text),
  public.adjust_stock(uuid, int, text), public.prepare_dispatch(uuid, jsonb), public.dispense_prescription(uuid, jsonb, text),
  public.dispatch_line_note(uuid, int, text, text), public.direct_sale(uuid, jsonb, text, text, text, uuid),
  public.record_payment(uuid, bigint, text), public.return_sale_line(uuid, int, text, boolean),
  public.pharmacy_stock(uuid), public.dispatch_lines(uuid), public.pharmacy_report(uuid, date, date)
to authenticated;
