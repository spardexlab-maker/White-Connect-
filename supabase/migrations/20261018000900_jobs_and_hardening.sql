-- =====================================================================
-- 0009 Background jobs + hardening.
--   * my_patient_card: serialize first-token creation (two concurrent
--     calls from the same app could race on the one-active-token index).
--   * In-app is the only default channel until a push provider is
--     configured (Phase 5); nothing pretends to send push.
--   * pg_cron: periodic expiry of lapsed confirmations (the booking path
--     also expires lazily, so correctness never depends on the cron).
-- =====================================================================

create or replace function public.my_patient_card(p_patient_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  tok text;
  p public.patients;
begin
  if not private.is_linked_to_patient(p_patient_id) then perform private.fail('forbidden'); end if;
  select * into p from public.patients where id = p_patient_id for update;
  select token into tok from public.patient_qr_tokens where patient_id = p_patient_id and revoked_at is null;
  if tok is null then tok := private.new_qr_token(p_patient_id); end if;
  return jsonb_build_object('patient_id', p.id, 'public_code', p.public_code, 'full_name', p.full_name, 'qr_token', tok);
end;
$$;

create or replace function private.new_qr_token(p_patient_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw text := 'qr_' || encode(extensions.gen_random_bytes(24), 'hex');
begin
  perform 1 from public.patients where id = p_patient_id for update;
  update public.patient_qr_tokens set revoked_at = now() where patient_id = p_patient_id and revoked_at is null;
  insert into public.patient_qr_tokens (patient_id, token_hash, token) values (p_patient_id, private.sha256_hex(raw), raw);
  return raw;
end;
$$;

create or replace function private.notify_patient(
  p_patient_id uuid,
  p_template text,
  p_payload jsonb,
  p_dedupe text,
  p_channels public.notification_channel[] default array['in_app']::public.notification_channel[]
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
      values (l.user_id, ch, p_template, coalesce(p_payload, '{}'::jsonb), p_dedupe || ':' || l.user_id || ':' || ch)
      on conflict (dedupe_key) do nothing;
      n := n + 1;
    end loop;
  end loop;
  return n;
end;
$$;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('expire-pending-appointments', '* * * * *', 'select public.expire_pending_appointments()');
  end if;
end $$;
