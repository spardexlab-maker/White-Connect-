-- Notifications the moment the button is pressed (owner request, 25 Oct 2026):
--  * a new outbox row wakes the notifications worker right away (pg_net, async,
--    one call per statement) instead of waiting for the next one-minute tick;
--    the minute job stays as the safety net and for retries;
--  * calling a patient again («نداء مرة ثانية») sends «حان دورك» again.

create or replace function private.kick_notifications_worker()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  secret text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_net') then return null; end if;
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'worker_secret' limit 1;
  if secret is null then return null; end if;
  perform net.http_post(
    url := 'https://utuwjykgubsqqescpiwz.supabase.co/functions/v1/notifications-worker',
    headers := jsonb_build_object('x-worker-secret', secret, 'content-type', 'application/json'),
    body := '{}'::jsonb);
  return null;
exception when others then
  return null;   -- never block the action that created the notification
end;
$$;
create or replace trigger notification_outbox_kick_worker after insert on public.notification_outbox
  for each statement execute function private.kick_notifications_worker();

-- «حان دورك» on the first call and on every call again
create or replace function private.notify_queue_called()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'called' and new.patient_id is not null
     and (old.status is distinct from 'called' or new.called_at is distinct from old.called_at) then
    perform private.notify_patient(new.patient_id, 'queue.called',
      jsonb_build_object('doctor', (select pp.full_name from public.practitioner_profiles pp where pp.id = new.practitioner_id)),
      'call:' || new.id || ':' || extract(epoch from coalesce(new.called_at, now()))::bigint,
      array['in_app', 'push']::public.notification_channel[]);
  end if;
  return new;
end;
$$;
create or replace trigger queue_entries_notify_called after update of status, called_at on public.queue_entries
  for each row execute function private.notify_queue_called();
