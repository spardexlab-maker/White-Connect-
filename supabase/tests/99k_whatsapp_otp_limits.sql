-- WhatsApp sign-in codes cost money: the send-sms hook may send at most 5 per number per
-- hour, only to Iraqi mobiles, under a platform-wide hourly ceiling; users cannot call it.
begin;
select plan(7);

select throws_ok($$ set local role authenticated; select public.otp_send_allowed('9647701234567') $$,
                 '42501', null, 'a signed-in user cannot call the limiter');
reset role;

set local role service_role;
select is(public.otp_send_allowed('+964 770 123 4567'), 'ok', 'an Iraqi mobile is allowed');
select is(public.otp_send_allowed('15551234567'), 'phone_invalid', 'a non-Iraqi number is refused (no international cost)');
select is((select array_agg(public.otp_send_allowed('9647701234567'))::text from generate_series(1, 4)), '{ok,ok,ok,ok}', 'five codes in an hour are fine');
select is(public.otp_send_allowed('9647701234567'), 'otp_rate_limited', 'the sixth code within the hour is refused');
select is(public.otp_send_allowed('9647801234567'), 'ok', 'another number is not affected');
reset role;

update private.otp_limits set platform_hour = 6;
set local role service_role;
select is(public.otp_send_allowed('9647501234567'), 'otp_unavailable', 'the platform-wide hourly ceiling stops everything');
reset role;

select * from finish();
rollback;
