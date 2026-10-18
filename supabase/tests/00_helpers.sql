-- Shared test helpers (installed into a `tests` schema; files run in
-- alphabetical order and each one rolls back its own data).
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

-- Act as a given auth user for the rest of the transaction.
create or replace function tests.login(p_uid uuid, p_email text default null, p_aal text default 'aal1')
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'aal', p_aal, 'email', p_email)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function tests.as_anon()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);
end $$;

create or replace function tests.logout()
returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Local timestamp in Asia/Baghdad on (today + p_days) at p_time.
create or replace function tests.at(p_days int, p_time time)
returns timestamptz language sql stable as $$
  select (((now() at time zone 'Asia/Baghdad')::date + p_days) + p_time)::timestamp at time zone 'Asia/Baghdad';
$$;

-- Open every weekday 08:00–22:00 for a practitioner at a facility so
-- tests never depend on today's weekday.
create or replace function tests.open_all_week(p_facility uuid, p_practitioner uuid)
returns void language sql as $$
  insert into public.schedules (facility_id, practitioner_id, weekday, start_local, end_local, valid_from)
  select p_facility, p_practitioner, d, '08:00', '22:00', current_date - 1 from generate_series(0, 6) d;
$$;

grant execute on all functions in schema tests to authenticated, anon;

select pass('helpers installed');
select * from finish();
commit;
