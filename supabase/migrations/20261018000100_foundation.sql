-- =====================================================================
-- 0001 Foundation: extensions, private helper schema, shared triggers,
-- platform settings, audit log.
--
-- Conventions used by every later migration:
--   * Domain tables live in `public` with RLS ENABLED and explicit GRANTs
--     (config: auto_expose_new_tables = false).
--   * Helper / authorization functions live in `private` (not exposed by
--     the Data API). SECURITY DEFINER functions always pin search_path = ''.
--   * Multi-step business operations are RPCs (single transaction).
--   * Timestamps are timestamptz (stored UTC); facilities carry a timezone.
--   * Money is bigint minor units (IQD has no minor unit in practice, so
--     amount_minor = dinars); never floating point.
-- =====================================================================

create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto  with schema extensions;
create extension if not exists citext    with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, anon, service_role;

-- ---------------------------------------------------------------------
-- Generic triggers
-- ---------------------------------------------------------------------
create or replace function private.touch_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.version := coalesce(old.version, 0) + 1;
  end if;
  return new;
end;
$$;

-- Short, non-sequential, human-copyable codes (Crockford base32, no I/L/O/U).
create or replace function private.random_code(p_len int)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  bytes bytea := extensions.gen_random_bytes(p_len);
  result text := '';
  i int;
begin
  for i in 0 .. p_len - 1 loop
    result := result || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return result;
end;
$$;

create or replace function private.sha256_hex(p text)
returns text
language sql
immutable
set search_path = ''
as $$ select encode(extensions.digest(p, 'sha256'), 'hex') $$;

-- Raise a typed application error. The client maps `errcode` P0001 +
-- message prefix "app:<code>" to a localized message.
create or replace function private.fail(p_code text, p_detail text default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = 'P0001',
    message = 'app:' || p_code,
    detail  = coalesce(p_detail, '');
end;
$$;

-- ---------------------------------------------------------------------
-- Platform settings (single row)
-- ---------------------------------------------------------------------
create table public.platform_settings (
  id boolean primary key default true check (id),
  require_admin_mfa boolean not null default true,
  default_timezone text not null default 'Asia/Baghdad',
  default_currency text not null default 'IQD',
  lookup_rate_limit_per_minute int not null default 30 check (lookup_rate_limit_per_minute > 0),
  updated_at timestamptz not null default now()
);
insert into public.platform_settings default values;
alter table public.platform_settings enable row level security;

-- ---------------------------------------------------------------------
-- Audit log: who did what to which entity. NEVER store clinical content
-- here — only identifiers, action names and non-sensitive metadata.
-- ---------------------------------------------------------------------
create table public.access_audit (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  organization_id uuid,
  facility_id uuid,
  patient_id uuid,
  reason text,
  metadata jsonb not null default '{}'::jsonb
);
create index access_audit_entity_idx on public.access_audit (entity_type, entity_id);
create index access_audit_patient_idx on public.access_audit (patient_id) where patient_id is not null;
create index access_audit_time_idx on public.access_audit (occurred_at desc);
alter table public.access_audit enable row level security;

create or replace function private.audit(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_facility_id uuid default null,
  p_patient_id uuid default null,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_organization_id uuid default null
) returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.access_audit
    (actor_user_id, action, entity_type, entity_id, facility_id, patient_id, reason, metadata, organization_id)
  values
    (auth.uid(), p_action, p_entity_type, p_entity_id, p_facility_id, p_patient_id, p_reason,
     coalesce(p_metadata, '{}'::jsonb), p_organization_id);
$$;

-- Simple per-user sliding-window rate limiter for sensitive lookups.
create table private.rate_limit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  bucket text not null,
  at timestamptz not null default now()
);
create index rate_limit_events_idx on private.rate_limit_events (user_id, bucket, at desc);

create or replace function private.enforce_rate_limit(p_bucket text, p_per_minute int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  delete from private.rate_limit_events where at < now() - interval '10 minutes';
  select count(*) into n from private.rate_limit_events
   where user_id = auth.uid() and bucket = p_bucket and at > now() - interval '1 minute';
  if n >= p_per_minute then
    perform private.fail('rate_limited');
  end if;
  insert into private.rate_limit_events (user_id, bucket) values (auth.uid(), p_bucket);
end;
$$;

revoke all on all functions in schema private from public;
