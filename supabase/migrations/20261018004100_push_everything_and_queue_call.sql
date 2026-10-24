-- Phone alerts (owner request, 25 Oct 2026):
--  * every notification that lands in the in-app inbox also goes to the
--    person's phone / browser (several older ones were in-app only: result
--    ready, appointment confirmed, new prescription, dispensed…);
--  * «حان دورك» when the receptionist calls the patient in;
--  * phones that ring medicine doses from their own schedule say so, and only
--    those are skipped for server medicine reminders (no double ring, and no
--    silence when the phone's own schedule is off).

-- mirror in-app → push (a push row that already exists for the same event wins)
create or replace function private.mirror_inbox_to_push()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.channel = 'in_app' then
    insert into public.notification_outbox (recipient_user_id, channel, template, payload, dedupe_key)
    values (new.recipient_user_id, 'push', new.template, new.payload, regexp_replace(new.dedupe_key, ':in_app$', '') || ':push')
    on conflict (dedupe_key) do nothing;
  end if;
  return null;
end;
$$;
drop trigger if exists notification_outbox_mirror_push on public.notification_outbox;
create trigger notification_outbox_mirror_push after insert on public.notification_outbox
  for each row execute function private.mirror_inbox_to_push();

-- «حان دورك»: the receptionist (or the doctor) calls the patient in
create or replace function private.notify_queue_called()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'called' and old.status is distinct from 'called' and new.patient_id is not null then
    perform private.notify_patient(new.patient_id, 'queue.called',
      jsonb_build_object('doctor', (select pp.full_name from public.practitioner_profiles pp where pp.id = new.practitioner_id)),
      'call:' || new.id || ':' || extract(epoch from coalesce(new.called_at, now()))::bigint,
      array['in_app', 'push']::public.notification_channel[]);
  end if;
  return new;
end;
$$;
drop trigger if exists queue_entries_notify_called on public.queue_entries;
create trigger queue_entries_notify_called after update of status on public.queue_entries
  for each row execute function private.notify_queue_called();

-- the phone tells whether it rings doses itself
alter table public.push_devices add column if not exists local_reminders boolean not null default false;
create or replace function public.set_push_device_local_reminders(p_token text, p_on boolean)
returns void language sql security definer set search_path = '' as $$
  update public.push_devices set local_reminders = coalesce(p_on, false) where token = p_token and user_id = auth.uid();
$$;
revoke execute on function public.set_push_device_local_reminders(text, boolean) from public, anon;
grant execute on function public.set_push_device_local_reminders(text, boolean) to authenticated;

create or replace function public.push_targets(p_user_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'token', token, 'web_keys', web_keys, 'local_reminders', local_reminders)), '[]'::jsonb)
    from public.push_devices where user_id = p_user_id and disabled_at is null;
$$;
