-- AI assistant usage limit: signed-in users only, 10 per hour; only the count is kept (no text).
begin;
select plan(4);
\set U_HASAN '''00000000-0000-4000-a000-000000000050'''
select throws_ok($q$select public.ai_triage_begin()$q$, 'P0001', 'app:not_authenticated', 'anonymous callers are refused');
select tests.login(:U_HASAN);
select ok(jsonb_array_length(public.ai_triage_begin() -> 'specialties') > 0, 'a signed-in user gets the specialties list');
select public.ai_triage_begin() from generate_series(1, 9);
select throws_ok($q$select public.ai_triage_begin()$q$, 'P0001', 'app:ai_rate_limited', 'the 11th request within an hour is refused');
select tests.logout();
select is((select count(*)::int from public.ai_usage where user_id = :U_HASAN), 10, 'only 10 uses were recorded');
select * from finish();
rollback;
