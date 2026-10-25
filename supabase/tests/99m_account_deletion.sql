-- «احذف حسابي»: the patient's account is cut off from the record; the record stays with clinics.
begin;
select plan(8);
\set U_HASAN '''00000000-0000-4000-a000-000000000050'''
\set P_HASAN '''00000000-0000-4000-5000-000000000050'''
\set U_DRAHMED '''00000000-0000-4000-a000-000000000010'''

insert into public.push_devices (user_id, kind, token, platform) values (:U_HASAN, 'fcm', 'test-delete-token', 'android');

select tests.login(:U_HASAN);
select throws_ok(format($$ select public.erase_account(%L) $$, :U_HASAN), '42501', null, 'a user cannot call the eraser directly (only the edge function)');
select tests.logout();

set local role service_role;
select is(public.erase_account(:U_DRAHMED), 'staff_account', 'staff accounts are closed by the admin, not here');
select is(public.erase_account(:U_HASAN), 'ok', 'the patient account is erased');
reset role;

select is((select count(*)::int from public.patient_account_links where user_id = :U_HASAN and revoked_at is null), 0, 'the account no longer reaches the medical record');
select ok(exists (select 1 from public.patients where id = :P_HASAN), 'the medical record itself stays with the clinics');
select is((select status::text from public.profiles where id = :U_HASAN), 'suspended', 'the profile is closed and blanked');
select is((select count(*)::int from public.push_devices where user_id = :U_HASAN), 0, 'no more notifications to that phone');
select is((select count(*)::int from public.appointments a where a.patient_id = :P_HASAN and a.status in ('awaiting_confirmation', 'confirmed') and lower(a.period) > now()), 0,
          'upcoming bookings are cancelled');

select * from finish();
rollback;
