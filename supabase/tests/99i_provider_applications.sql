-- «استمارة انضمام طبيب»: anyone can submit, only the platform admin reads and reviews.
begin;
select plan(8);
\set U_ADMIN '''00000000-0000-4000-a000-000000000001'''
\set U_HASAN '''00000000-0000-4000-a000-000000000050'''

create temp table t (k text primary key, v text);
grant all on t to anon, authenticated;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
insert into t select 'n', public.submit_provider_application(jsonb_build_object(
  'full_name', 'د. سارة محمد', 'specialty_id', (select id from public.specialties order by sort_order limit 1),
  'license_number', 'IQ-12345', 'phone', '07801112233', 'clinic_name', 'عيادة النور', 'address', 'بغداد، المنصور، شارع 14 رمضان',
  'working_hours', 'السبت–الخميس 4–9 م', 'consent', true,
  'services', jsonb_build_array(jsonb_build_object('name', 'كشفية', 'price', '25000', 'minutes', '15'), jsonb_build_object('name', ''))
)) ->> 'application_number';
select ok((select v from t where k = 'n') like 'J%', 'a visitor without an account submits the form');
select throws_ok($$ select public.submit_provider_application('{"full_name":"د. سارة محمد","specialty_other":"عيون","license_number":"IQ-1","phone":"07801112233","clinic_name":"عيادة","address":"بغداد المنصور","consent":true}') $$,
                 'P0001', 'app:application_duplicate', 'the same phone twice in a day is refused');
select throws_ok($$ select public.submit_provider_application('{"full_name":"د. علي","specialty_other":"باطنية","license_number":"X1","phone":"07709998877","clinic_name":"عيادة","address":"بغداد الكرادة","consent":false}') $$,
                 'P0001', 'app:application_invalid', 'consent is required');
select throws_ok($$ select public.submit_provider_application('{"website":"spam","full_name":"bot"}') $$,
                 'P0001', 'app:invalid_input', 'the hidden bot field rejects spam');
reset role;

select is((select jsonb_array_length(services) from public.provider_applications where application_number = (select v from t where k = 'n')), 1,
          'empty service rows are dropped');
select ok(exists (select 1 from public.notification_outbox where template = 'application.new' and recipient_user_id = :U_ADMIN::uuid), 'the platform admin is notified');

select tests.login(:U_HASAN);
select is((select count(*)::int from public.provider_applications), 0, 'a patient cannot read applications');
select tests.login(:U_ADMIN, null, 'aal2');
select public.review_provider_application((select id from public.provider_applications where application_number = (select v from t where k = 'n')), 'contacted', 'اتصلت بها، تزورنا الأحد');
select is((select status || ' / ' || admin_note from public.provider_applications where application_number = (select v from t where k = 'n')),
          'contacted / اتصلت بها، تزورنا الأحد', 'the admin reviews and notes it');
select * from finish();
rollback;
