-- Clinic photos / certificates: the doctor (own profile, own clinic) or the platform admin; shown publicly.
begin;
select plan(5);
\set A1 '''00000000-0000-4000-f000-0000000000a1'''
\set AHMED '''00000000-0000-4000-9000-000000000010'''
\set SARA '''00000000-0000-4000-9000-000000000011'''
\set U_DRAHMED '''00000000-0000-4000-a000-000000000010'''
\set U_RECA '''00000000-0000-4000-a000-000000000020'''
insert into storage.objects (bucket_id, name) values
  ('public-media', 'practitioners/00000000-0000-4000-9000-000000000010/cert1.jpg'),
  ('public-media', 'facilities/00000000-0000-4000-f000-0000000000a1/room.jpg'),
  ('public-media', 'practitioners/00000000-0000-4000-9000-000000000011/x.jpg');
select tests.login(:U_DRAHMED);
select lives_ok(format($q$select public.add_provider_media('certificate', %L, 'practitioners/%s/cert1.jpg', 'بورد الباطنية')$q$, :AHMED, :AHMED),
                'a doctor adds a certificate to his own profile');
select lives_ok(format($q$select public.add_provider_media('clinic_photo', %L, 'facilities/%s/room.jpg')$q$, :A1, :A1), 'and a photo of his clinic');
select throws_ok(format($q$select public.add_provider_media('certificate', %L, 'practitioners/%s/x.jpg')$q$, :SARA, :SARA), 'P0001', 'app:forbidden',
                 'but not to another doctor''s profile');
select tests.login(:U_RECA);
select throws_ok(format($q$select public.add_provider_media('clinic_photo', %L, 'facilities/%s/room.jpg')$q$, :A1, :A1), 'P0001', 'app:forbidden',
                 'reception cannot add media');
select tests.logout();
select is(jsonb_array_length(public.provider_media(:A1, :AHMED) -> 'certificates'), 1, 'the provider page lists the certificate');
select * from finish();
rollback;
