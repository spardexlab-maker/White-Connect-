-- App errors and uptime for «صحة النظام»: anyone reports, only the super admin reads.
begin;
select plan(7);
\set U_ADMIN '''00000000-0000-4000-a000-000000000001'''
\set U_HASAN '''00000000-0000-4000-a000-000000000050'''

set local role anon;
select lives_ok($$ select public.report_client_error('android', 'TypeError: boom', E'TypeError: boom\n at Home (index.js:10:3)', 'home', '0.7.0') $$, 'the app reports an error before sign-in');
select lives_ok($$ select public.report_client_error('android', 'TypeError: boom', E'TypeError: boom\n at Home (index.js:10:3)', 'home', '0.7.0') $$, 'the same error again');
select lives_ok($$ select public.report_client_error('desktop', 'x') $$, 'an unknown source is ignored');
reset role;
select is((select sum(count)::int from private.client_errors where message = 'TypeError: boom'), 2, 'repeats are counted on one entry');
select is((select count(*)::int from public.notification_outbox where template = 'monitor.error'), 2, 'a new kind of error alerts the super admin (bell + push)');

select tests.login(:U_HASAN);
select throws_ok($$ select public.admin_monitor() $$, 'P0001', 'app:forbidden', 'only the super admin sees monitoring');
select tests.login(:U_ADMIN);
select is((select jsonb_array_length(public.admin_monitor()->'errors')), 1, 'the super admin sees the error');

select * from finish();
rollback;
