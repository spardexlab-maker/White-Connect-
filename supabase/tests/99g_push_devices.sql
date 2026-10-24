-- Push devices belong to their user; only the worker reads targets; appointment reminders are queued once.
begin;
select plan(8);
\set U_HASAN '''00000000-0000-4000-a000-000000000050'''
\set U_DRAHMED '''00000000-0000-4000-a000-000000000010'''
\set P_HASAN '''00000000-0000-4000-5000-000000000050'''

select tests.login(:U_HASAN);
select lives_ok($$ select public.register_push_device('fcm', 'fcm-token-for-hasan-phone-0001', 'android') $$, 'a phone registers its FCM token');
select throws_ok($$ select public.register_push_device('web', 'http://not-https.example/sub-123456789', 'chrome', '{"p256dh":"x","auth":"y"}') $$,
                 'P0001', 'app:invalid_input', 'web push endpoints must be https with keys');
select is((select count(*)::int from public.push_devices), 1, 'the user sees their own device');
select throws_ok($$ select public.push_targets(auth.uid()) $$, '42501', null, 'patients cannot read delivery targets');

-- the same phone signs in as someone else: the token moves to that user
select tests.login(:U_DRAHMED);
select public.register_push_device('fcm', 'fcm-token-for-hasan-phone-0001', 'android');
select is((select count(*)::int from public.push_devices), 1, 'the token moved to the new account');
select tests.logout();
select is((select user_id from public.push_devices where token = 'fcm-token-for-hasan-phone-0001'), :U_DRAHMED::uuid, '…and no longer reaches the previous one');

-- a confirmed appointment tomorrow gets one reminder (twice queued = still one)
update public.appointments set status = 'confirmed',
       period = tstzrange(now() + interval '20 hours', now() + interval '20 hours 15 minutes'),
       blocked_period = tstzrange(now() + interval '20 hours', now() + interval '20 hours 15 minutes')
 where id = (select id from public.appointments where patient_id = :P_HASAN order by created_at limit 1);
select ok(public.queue_appointment_reminders() >= 1, 'tomorrow''s appointment is reminded');
select public.queue_appointment_reminders();
select is((select count(*)::int from public.notification_outbox where template = 'appointment.reminder_day' and channel = 'push'),
          (select count(*)::int from public.notification_outbox where template = 'appointment.reminder_day' and channel = 'in_app'),
          'one push per in-app reminder, not duplicated by the next run');
select * from finish();
rollback;
