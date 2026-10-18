-- Disable the cloud TEST environment without deleting history:
-- suspends the test complex and blocks sign-in for every 7e57… account.
update public.organizations set status = 'suspended' where id = '7e570000-0000-4000-e000-000000000001';
update public.facilities set status = 'suspended' where organization_id = '7e570000-0000-4000-e000-000000000001';
update public.memberships set status = 'suspended' where organization_id = '7e570000-0000-4000-e000-000000000001';
update auth.users set banned_until = 'infinity' where id::text like '7e570000-%';
