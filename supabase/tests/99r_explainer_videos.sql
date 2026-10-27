-- Explainer films: the admin sets YouTube ids, everyone (even signed out) reads them.
begin;
select plan(5);
\set U_ADMIN '''00000000-0000-4000-a000-000000000001'''
\set U_HASAN '''00000000-0000-4000-a000-000000000050'''

select tests.login(:U_HASAN);
select throws_ok($q$ select public.admin_set_explainer_videos('[]'::jsonb) $q$, 'P0001', 'app:forbidden', 'only the platform admin sets the films');
select tests.login(:U_ADMIN, 'admin@demo.test', 'aal2');
select throws_ok($q$ select public.admin_set_explainer_videos('[{"audience":"patient","title":"x","youtube_id":"not-an-id"}]'::jsonb) $q$,
                 'P0001', 'app:invalid_video', 'a bad YouTube id is refused');
select is(jsonb_array_length(public.admin_set_explainer_videos('[{"audience":"patient","title":"شرح أبيض","youtube_id":"dQw4w9WgXcQ"},{"audience":"doctor","title":"للأطباء","youtube_id":"dQw4w9WgXcR"}]'::jsonb)), 2,
          'the admin saves two films');
select tests.as_anon();
select is(public.explainer_videos() -> 0 ->> 'youtube_id', 'dQw4w9WgXcQ', 'a signed-out visitor reads them');
reset role;
select ok(exists (select 1 from public.access_audit where action = 'settings.explainer_videos'), 'the change is audited');
select * from finish();
rollback;
