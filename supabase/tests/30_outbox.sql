-- Transactional outbox: dedupe, idempotent completion, retry/backoff,
-- dead-letter, and worker-only access (§11, §15, §18-k partial).
begin;
select plan(12);

\set P_HASAN '''00000000-0000-4000-5000-000000000050'''
\set U_HASAN '''00000000-0000-4000-a000-000000000050'''

select private.notify_patient(:P_HASAN, 'appointment.confirmed', '{"booking_number":"B1"}', 'dedupe-test');
select private.notify_patient(:P_HASAN, 'appointment.confirmed', '{"booking_number":"B1"}', 'dedupe-test');
select is((select count(*)::int from public.notification_outbox where dedupe_key like 'dedupe-test:%:in_app'), 1,
          'the same event enqueued twice produces one outbox row');

create temp table claimed as select * from public.outbox_claim(10, 60);
select is((select count(*)::int from claimed where dedupe_key like 'dedupe-test:%:in_app'), 1, 'worker claims the pending row');
select is((select count(*)::int from public.outbox_claim(10, 60) where dedupe_key like 'dedupe-test:%:in_app'), 0,
          'a leased row is not claimed twice (no double send)');

select public.outbox_complete((select id from claimed where dedupe_key like 'dedupe-test:%:in_app'), true, null, 't', 'b');
select public.outbox_complete((select id from claimed where dedupe_key like 'dedupe-test:%:in_app'), true, null, 't', 'b');
select is((select count(*)::int from public.notifications where user_id = :U_HASAN and title = 't'), 1,
          'completing twice creates one inbox item (idempotent)');

-- failure → backoff → dead letter
select private.notify_patient(:P_HASAN, 'appointment.delay', '{}', 'fail-test');
update public.notification_outbox set max_attempts = 2 where dedupe_key like 'fail-test:%:in_app';
create temp table c1 as select * from public.outbox_claim(10, 60);
select public.outbox_complete((select id from c1 where dedupe_key like 'fail-test:%:in_app'), false, 'provider down');
select is((select status::text from public.notification_outbox where dedupe_key like 'fail-test:%:in_app'), 'failed', 'first failure is retryable');
select ok((select next_attempt_at > now() from public.notification_outbox where dedupe_key like 'fail-test:%:in_app'), 'retry is scheduled with backoff');
update public.notification_outbox set next_attempt_at = now() - interval '1 second' where dedupe_key like 'fail-test:%:in_app';
create temp table c2 as select * from public.outbox_claim(10, 60);
select public.outbox_complete((select id from c2 where dedupe_key like 'fail-test:%:in_app'), false, 'provider down');
select is((select status::text from public.notification_outbox where dedupe_key like 'fail-test:%:in_app'), 'dead', 'exhausted attempts go to dead-letter review');

-- every inbox notification also goes to the phone, once
select is((select count(*)::int from public.notification_outbox where dedupe_key like 'dedupe-test:%:push'), 1,
          'an in-app notification is mirrored to push exactly once');
-- «حان دورك» when the patient is called in
create temp table qe as select id from public.queue_entries order by created_at, id limit 1;
update public.queue_entries set patient_id = :P_HASAN, status = 'waiting' where id = (select id from qe);
update public.queue_entries set status = 'called' where id = (select id from qe);
select is((select count(*)::int from public.notification_outbox where template = 'queue.called' and channel = 'push'), 1,
          'calling the patient in sends «حان دورك» to the phone');
select is((select count(*)::int from public.notification_outbox where template = 'queue.called' and channel = 'in_app'),
          (select count(*)::int from public.notification_outbox where template = 'queue.called' and channel = 'push'), 'one push per call');

-- only the worker (service role) may claim
grant all on claimed to authenticated;
select tests.login(:U_HASAN);
select throws_ok($$ select * from public.outbox_claim(1, 60) $$, '42501', null, 'users cannot run the worker API');
select is((select count(*)::int from public.notifications where user_id <> :U_HASAN), 0, 'users only see their own inbox');

select * from finish();
rollback;
