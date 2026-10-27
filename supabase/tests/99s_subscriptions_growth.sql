-- Subscriptions (warn only, nothing switched off) and the super admin's growth numbers.
begin;
select plan(14);
\set U_ADMIN '''00000000-0000-4000-a000-000000000001'''
\set U_STAFF '''00000000-0000-4000-a000-000000000002'''
\set U_HASAN '''00000000-0000-4000-a000-000000000050'''
\set ORG '''00000000-0000-4000-e000-000000000001'''

select tests.login(:U_HASAN);
select throws_ok($q$ select public.admin_subscriptions() $q$, 'P0001', 'app:forbidden', 'only the platform admin lists subscriptions');
select throws_ok($q$ select public.admin_growth() $q$, 'P0001', 'app:forbidden', 'only the platform admin sees the growth numbers');
select is(public.subscription_notice(:ORG), null, 'a non-member sees no banner (and learns nothing)');

select tests.login(:U_ADMIN, 'admin@demo.test', 'aal2');
select throws_ok(format($q$ select public.admin_set_subscription(%L, 'monthly', current_date, current_date - 1, true) $q$, :ORG),
                 'P0001', 'app:invalid_subscription', 'the end must not be before the start');
select is((select x ->> 'state' from jsonb_array_elements(public.admin_subscriptions() -> 'items') x where x ->> 'organization_id' = :ORG), 'none',
          'an organization without a subscription shows as none');
select lives_ok(format($q$ select public.admin_set_subscription(%L, 'monthly', current_date, current_date + 30, true, 50000, 'نقداً') $q$, :ORG),
                'the admin records a paid month');
select is((select x ->> 'state' from jsonb_array_elements(public.admin_subscriptions() -> 'items') x where x ->> 'organization_id' = :ORG), 'active', 'paid and far from the end: active');

select tests.login(:U_STAFF);
select is(public.subscription_notice(:ORG), null, 'active: no banner for the staff');

select tests.login(:U_ADMIN, 'admin@demo.test', 'aal2');
select public.admin_set_subscription(:ORG, 'monthly', current_date - 27, current_date + 3, true);
select tests.login(:U_STAFF);
select is(public.subscription_notice(:ORG) ->> 'state', 'expiring', 'three days before the end the staff see a reminder');
select ok(not (public.subscription_notice(:ORG) ? 'amount_iqd'), 'the banner carries no amount or note');

select tests.login(:U_ADMIN, 'admin@demo.test', 'aal2');
select public.admin_set_subscription(:ORG, 'monthly', current_date - 40, current_date - 10, true);
select tests.login(:U_STAFF);
select is(public.subscription_notice(:ORG) ->> 'state', 'expired', 'after the end the banner turns red');

select tests.login(:U_ADMIN, 'admin@demo.test', 'aal2');
select ok((public.admin_growth() -> 'subscriptions' ->> 'expired')::int >= 1, 'the growth numbers count the expired subscription');
select is(jsonb_array_length(public.admin_growth() -> 'daily'), 30, 'thirty days of daily counts');
reset role;
select ok(exists (select 1 from public.access_audit where action = 'subscription.set'), 'subscription changes are audited');
select * from finish();
rollback;
