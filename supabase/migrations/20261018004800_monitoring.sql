-- Monitoring inside the super admin account (owner request, 25 Oct 2026) — no outside service:
--  * app errors: the website and the phone app report crashes / unexpected errors here
--    (deduplicated per day, no patient data — message, place and app version only);
--  * uptime: every 5 minutes the database itself calls the website and the API (pg_net);
--    two failures in a row open an incident and the super admins get a notification
--    (bell + phone push), and another one when it is back.
-- «صحة النظام» shows both.

create table if not exists private.client_errors (
  id bigint generated always as identity primary key,
  day date not null default current_date,
  fingerprint text not null,
  source text not null check (source in ('web', 'android', 'ios')),
  app_version text,
  message text not null,
  stack text,
  url text,
  last_user uuid,
  count int not null default 1,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  unique (day, fingerprint, source)
);

create table if not exists private.monitor_targets (
  key text primary key,
  label text not null,
  url text not null
);
insert into private.monitor_targets (key, label, url) values
  ('web', 'الموقع (white.spardexlab.site)', 'https://white.spardexlab.site/'),
  ('api', 'الخادم والتحديثات (Supabase)', 'https://utuwjykgubsqqescpiwz.supabase.co/functions/v1/app-update?platform=android&runtime-version=2')
on conflict (key) do nothing;

create table if not exists private.uptime_pending (
  request_id bigint primary key,
  target text not null references private.monitor_targets (key),
  sent_at timestamptz not null default now()
);
create table if not exists private.uptime_checks (
  id bigint generated always as identity primary key,
  target text not null references private.monitor_targets (key),
  at timestamptz not null,
  ok boolean not null,
  status int,
  error text
);
create index if not exists uptime_checks_target_at on private.uptime_checks (target, at desc);
create table if not exists private.uptime_incidents (
  id bigint generated always as identity primary key,
  target text not null references private.monitor_targets (key),
  started_at timestamptz not null,
  ended_at timestamptz,
  last_error text
);

-- ---------------------------------------------------------------------
-- App errors: anyone may report (also before sign-in), capped and deduplicated.
create or replace function public.report_client_error(
  p_source text, p_message text, p_stack text default null, p_url text default null, p_app_version text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_msg text := left(coalesce(nullif(trim(p_message), ''), 'unknown error'), 500);
  v_stack text := left(p_stack, 4000);
  v_fp text;
  v_new boolean;
  admin_id uuid;
begin
  if p_source not in ('web', 'android', 'ios') then return; end if;
  if (select count(*) from private.client_errors where day = current_date) >= 2000 then return; end if;
  -- same message at the same first stack line = same problem
  v_fp := md5(v_msg || '|' || coalesce(split_part(v_stack, E'\n', 2), ''));
  insert into private.client_errors (fingerprint, source, app_version, message, stack, url, last_user)
  values (v_fp, p_source, left(p_app_version, 40), v_msg, v_stack, left(p_url, 500), auth.uid())
  on conflict (day, fingerprint, source) do update
     set count = private.client_errors.count + 1, last_at = now(), last_user = coalesce(excluded.last_user, private.client_errors.last_user),
         app_version = coalesce(excluded.app_version, private.client_errors.app_version), url = coalesce(excluded.url, private.client_errors.url)
  returning (xmax = 0) into v_new;
  -- a problem never seen before: tell the super admins (at most 5 such alerts a day)
  if v_new and not exists (select 1 from private.client_errors where fingerprint = v_fp and day < current_date)
     and (select count(distinct fingerprint) from private.client_errors where day = current_date) <= 5 then
    for admin_id in select user_id from public.platform_admins loop
      perform private.notify_user(admin_id, 'monitor.error', jsonb_build_object('source', p_source),
                                  'monitor-error:' || v_fp || ':' || current_date, array['in_app', 'push']::public.notification_channel[]);
    end loop;
  end if;
end;
$$;
revoke execute on function public.report_client_error(text, text, text, text, text) from public;
grant execute on function public.report_client_error(text, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Uptime: collect the previous round's answers, raise / clear incidents, send the next round.
create or replace function private.uptime_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
  last2 boolean[];
  open_inc private.uptime_incidents;
  admin_id uuid;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_net') then return; end if;

  insert into private.uptime_checks (target, at, ok, status, error)
  select p.target, p.sent_at, coalesce(not r.timed_out and r.status_code between 200 and 399, false), r.status_code,
         case when r.timed_out then 'timeout' else left(r.error_msg, 300) end
    from private.uptime_pending p join net._http_response r on r.id = p.request_id;
  delete from private.uptime_pending p using net._http_response r where r.id = p.request_id;
  -- no answer within 2 minutes counts as down
  insert into private.uptime_checks (target, at, ok, error)
  select target, sent_at, false, 'no_response' from private.uptime_pending where sent_at < now() - interval '2 minutes';
  delete from private.uptime_pending where sent_at < now() - interval '2 minutes';

  for t in select * from private.monitor_targets loop
    select array_agg(ok order by at desc) into last2 from (select ok, at from private.uptime_checks where target = t.key order by at desc limit 2) x;
    select * into open_inc from private.uptime_incidents where target = t.key and ended_at is null order by started_at desc limit 1;
    if open_inc.id is null and last2 = array[false, false] then
      insert into private.uptime_incidents (target, started_at, last_error)
      values (t.key, (select min(at) from (select at from private.uptime_checks where target = t.key order by at desc limit 2) y),
              (select error from private.uptime_checks where target = t.key order by at desc limit 1));
      for admin_id in select user_id from public.platform_admins loop
        perform private.notify_user(admin_id, 'monitor.down', jsonb_build_object('target', t.label),
                                    'monitor-down:' || t.key || ':' || extract(epoch from now())::bigint, array['in_app', 'push']::public.notification_channel[]);
      end loop;
    elsif open_inc.id is not null and last2[1] then
      update private.uptime_incidents set ended_at = now() where id = open_inc.id;
      for admin_id in select user_id from public.platform_admins loop
        perform private.notify_user(admin_id, 'monitor.up', jsonb_build_object('target', t.label),
                                    'monitor-up:' || open_inc.id, array['in_app', 'push']::public.notification_channel[]);
      end loop;
    end if;
    insert into private.uptime_pending (request_id, target)
    values (net.http_get(url := t.url, timeout_milliseconds := 15000), t.key);
  end loop;

  delete from private.uptime_checks where at < now() - interval '30 days';
  delete from private.uptime_incidents where started_at < now() - interval '90 days';
  delete from private.client_errors where day < current_date - 30;
exception when others then
  return;   -- monitoring must never break anything else
end;
$$;
revoke execute on function private.uptime_tick() from public;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_cron;
    create extension if not exists pg_net;
    perform cron.schedule('uptime-check', '*/5 * * * *', 'select private.uptime_tick()');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- What «صحة النظام» shows.
create or replace function public.admin_monitor()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then perform private.fail('forbidden'); end if;
  return jsonb_build_object(
    'targets', coalesce((select jsonb_agg(jsonb_build_object(
        'key', t.key, 'label', t.label,
        'last', (select jsonb_build_object('ok', c.ok, 'at', c.at, 'status', c.status, 'error', c.error)
                   from private.uptime_checks c where c.target = t.key order by c.at desc limit 1),
        'uptime_24h', (select round(100.0 * count(*) filter (where ok) / nullif(count(*), 0), 2) from private.uptime_checks where target = t.key and at > now() - interval '24 hours'),
        'uptime_7d', (select round(100.0 * count(*) filter (where ok) / nullif(count(*), 0), 2) from private.uptime_checks where target = t.key and at > now() - interval '7 days'),
        'down', exists (select 1 from private.uptime_incidents i where i.target = t.key and i.ended_at is null)
      ) order by t.key) from private.monitor_targets t), '[]'::jsonb),
    'incidents', coalesce((select jsonb_agg(jsonb_build_object('target', t.label, 'started_at', i.started_at, 'ended_at', i.ended_at, 'error', i.last_error) order by i.started_at desc)
        from (select * from private.uptime_incidents order by started_at desc limit 20) i join private.monitor_targets t on t.key = i.target), '[]'::jsonb),
    'errors', coalesce((select jsonb_agg(e order by e->>'last_at' desc) from (
        select jsonb_build_object('fingerprint', fingerprint, 'source', source, 'message', max(message), 'url', max(url),
                                  'app_version', max(app_version), 'stack', left(max(stack), 800), 'count', sum(count)::int,
                                  'users', count(distinct last_user), 'first_at', min(first_at), 'last_at', max(last_at)) e
          from private.client_errors where day > current_date - 7
         group by fingerprint, source order by max(last_at) desc limit 50) x), '[]'::jsonb),
    'errors_24h', (select coalesce(sum(count), 0)::int from private.client_errors where last_at > now() - interval '24 hours')
  );
end;
$$;
revoke execute on function public.admin_monitor() from public, anon;
grant execute on function public.admin_monitor() to authenticated;
