-- WhatsApp sign-in codes (owner request, 25 Oct 2026): every code costs money, so the
-- send-sms hook asks here before it sends — at most 5 codes per number per hour and
-- a platform-wide ceiling per hour (both changeable by the super admin in one row).
-- Only the service role (the hook) can call it; nothing here is readable by users.

create table private.otp_send_log (
  id bigint generated always as identity primary key,
  phone text not null,
  sent_at timestamptz not null default now(),
  allowed boolean not null
);
create index otp_send_log_phone_idx on private.otp_send_log (phone, sent_at desc);
create index otp_send_log_time_idx on private.otp_send_log (sent_at desc);

create table private.otp_limits (
  id boolean primary key default true check (id),
  per_phone_hour int not null default 5,
  platform_hour int not null default 300
);
insert into private.otp_limits default values on conflict do nothing;

create or replace function public.otp_send_allowed(p_phone text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  l private.otp_limits;
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  verdict text := 'ok';
begin
  select * into l from private.otp_limits;
  if v_phone !~ '^9647[3-9][0-9]{8}$' then
    verdict := 'phone_invalid';
  elsif (select count(*) from private.otp_send_log where phone = v_phone and allowed and sent_at > now() - interval '1 hour') >= l.per_phone_hour then
    verdict := 'otp_rate_limited';
  elsif (select count(*) from private.otp_send_log where allowed and sent_at > now() - interval '1 hour') >= l.platform_hour then
    verdict := 'otp_unavailable';
  end if;
  insert into private.otp_send_log (phone, allowed) values (v_phone, verdict = 'ok');
  delete from private.otp_send_log where sent_at < now() - interval '30 days';
  return verdict;
end;
$$;
revoke execute on function public.otp_send_allowed(text) from public, anon, authenticated;
grant execute on function public.otp_send_allowed(text) to service_role;
