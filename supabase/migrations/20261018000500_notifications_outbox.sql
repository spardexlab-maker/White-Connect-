-- =====================================================================
-- 0005 Transactional outbox + in-app inbox.
--
-- Business transactions INSERT into notification_outbox inside the same
-- transaction (so nothing is announced before commit). A short-lived
-- worker (Edge Function, invoked by pg_cron) claims batches with
-- FOR UPDATE SKIP LOCKED, delivers, and retries with backoff; rows that
-- exhaust attempts go to 'dead' for operator review.
--
-- Payloads carry identifiers + template keys only. Rendered texts are
-- generic on the lock screen (no medication / diagnosis names).
-- =====================================================================

create type public.outbox_status as enum ('pending', 'processing', 'sent', 'failed', 'dead', 'cancelled');
create type public.notification_channel as enum ('in_app', 'push', 'sms', 'email');

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.profiles (id),
  channel public.notification_channel not null,
  template text not null,
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text not null unique,
  status public.outbox_status not null default 'pending',
  attempts int not null default 0,
  max_attempts int not null default 5,
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version int not null default 1
);
create index outbox_due_idx on public.notification_outbox (next_attempt_at) where status in ('pending', 'failed');
create trigger outbox_touch before update on public.notification_outbox
  for each row execute function private.touch_row();

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  outbox_id uuid unique references public.notification_outbox (id),
  template text not null,
  title text not null,
  body text not null,
  link text,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notification_outbox enable row level security;
alter table public.notifications enable row level security;

create policy notifications_own on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_mark_read on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy outbox_admin_read on public.notification_outbox for select to authenticated
  using (private.is_platform_admin());

grant select on public.notifications, public.notification_outbox to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Enqueue for every verified account linked to the patient. A patient
-- without an account gets NOTHING queued (spec §18-d).
create or replace function private.notify_patient(
  p_patient_id uuid,
  p_template text,
  p_payload jsonb,
  p_dedupe text,
  p_channels public.notification_channel[] default array['in_app', 'push']::public.notification_channel[]
) returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int := 0;
  l record;
  ch public.notification_channel;
begin
  for l in
    select user_id from public.patient_account_links
     where patient_id = p_patient_id and revoked_at is null and verified_at is not null
  loop
    foreach ch in array p_channels loop
      insert into public.notification_outbox (recipient_user_id, channel, template, payload, dedupe_key)
      values (l.user_id, ch, p_template, coalesce(p_payload, '{}'::jsonb),
              p_dedupe || ':' || l.user_id || ':' || ch)
      on conflict (dedupe_key) do nothing;
      n := n + 1;
    end loop;
  end loop;
  return n;
end;
$$;

create or replace function private.notify_user(
  p_user_id uuid,
  p_template text,
  p_payload jsonb,
  p_dedupe text,
  p_channels public.notification_channel[] default array['in_app']::public.notification_channel[]
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ch public.notification_channel;
begin
  foreach ch in array p_channels loop
    insert into public.notification_outbox (recipient_user_id, channel, template, payload, dedupe_key)
    values (p_user_id, ch, p_template, coalesce(p_payload, '{}'::jsonb), p_dedupe || ':' || p_user_id || ':' || ch)
    on conflict (dedupe_key) do nothing;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Worker API (service_role only)
-- ---------------------------------------------------------------------
create or replace function public.outbox_claim(p_limit int default 50, p_lease_seconds int default 60)
returns setof public.notification_outbox
language sql
security definer
set search_path = ''
as $$
  update public.notification_outbox o
     set status = 'processing',
         locked_until = now() + make_interval(secs => p_lease_seconds),
         attempts = o.attempts + 1
   where o.id in (
     select id from public.notification_outbox
      where (status in ('pending', 'failed') and next_attempt_at <= now())
         or (status = 'processing' and locked_until < now())          -- crashed worker lease
      order by next_attempt_at
      limit p_limit
      for update skip locked)
  returning o.*;
$$;

create or replace function public.outbox_complete(
  p_id uuid,
  p_success boolean,
  p_error text default null,
  p_inbox_title text default null,
  p_inbox_body text default null,
  p_inbox_link text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.notification_outbox;
begin
  select * into o from public.notification_outbox where id = p_id for update;
  if o.id is null or o.status <> 'processing' then return; end if;   -- idempotent
  if p_success then
    if o.channel = 'in_app' then
      insert into public.notifications (user_id, outbox_id, template, title, body, link, payload)
      values (o.recipient_user_id, o.id, o.template, coalesce(p_inbox_title, o.template),
              coalesce(p_inbox_body, ''), p_inbox_link, o.payload)
      on conflict (outbox_id) do nothing;
    end if;
    update public.notification_outbox set status = 'sent', sent_at = now(), locked_until = null, last_error = null
     where id = p_id;
  else
    update public.notification_outbox
       set status = case when o.attempts >= o.max_attempts then 'dead'::public.outbox_status else 'failed'::public.outbox_status end,
           next_attempt_at = now() + make_interval(secs => least(3600, (30 * power(2, o.attempts))::int)),
           locked_until = null,
           last_error = left(coalesce(p_error, 'unknown'), 500)
     where id = p_id;
  end if;
end;
$$;

create or replace function public.admin_retry_dead_notification(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then perform private.fail('forbidden'); end if;
  update public.notification_outbox set status = 'pending', attempts = 0, next_attempt_at = now()
   where id = p_id and status = 'dead';
  perform private.audit('outbox.retry', 'notification_outbox', p_id);
end;
$$;

revoke execute on function public.outbox_claim(int, int), public.outbox_complete(uuid, boolean, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.outbox_claim(int, int), public.outbox_complete(uuid, boolean, text, text, text, text)
  to service_role;
revoke execute on function public.admin_retry_dead_notification(uuid) from public, anon;
grant execute on function public.admin_retry_dead_notification(uuid) to authenticated;
