-- «شرح أبيض بالفيديو» (owner request, 27 Oct 2026): the explainer films go on
-- YouTube and show inside the app and the website. The super admin pastes each
-- film's YouTube link; patients see the patient film, and the professional
-- films (doctor, lab, pharmacy) show to staff and on the public sign-in page.

alter table public.platform_settings add column if not exists explainer_videos jsonb not null default '[]'::jsonb;

-- Anyone (signed in or not) may read the list: titles and YouTube ids only.
create or replace function public.explainer_videos()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select explainer_videos from public.platform_settings limit 1), '[]'::jsonb);
$$;

-- [{audience: patient|doctor|lab|pharmacy, title, youtube_id}] — ids are checked, links are reduced to their id by the app.
create or replace function public.admin_set_explainer_videos(p_videos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v jsonb;
  clean jsonb := '[]'::jsonb;
begin
  if not private.is_platform_admin() then perform private.fail('forbidden'); end if;
  if jsonb_typeof(p_videos) <> 'array' or jsonb_array_length(p_videos) > 12 then perform private.fail('invalid_input'); end if;
  for v in select * from jsonb_array_elements(p_videos) loop
    if coalesce(v ->> 'audience', '') not in ('patient', 'doctor', 'lab', 'pharmacy')
       or coalesce(v ->> 'youtube_id', '') !~ '^[A-Za-z0-9_-]{11}$'
       or length(coalesce(trim(v ->> 'title'), '')) not between 1 and 120 then
      perform private.fail('invalid_video');
    end if;
    clean := clean || jsonb_build_array(jsonb_build_object('audience', v ->> 'audience', 'title', trim(v ->> 'title'), 'youtube_id', v ->> 'youtube_id'));
  end loop;
  update public.platform_settings set explainer_videos = clean, updated_at = now() where id is not null;
  perform private.audit('settings.explainer_videos', 'platform', null, null, null, null, jsonb_build_object('count', jsonb_array_length(clean)));
  return clean;
end;
$$;

revoke execute on function public.explainer_videos(), public.admin_set_explainer_videos(jsonb) from public;
grant execute on function public.explainer_videos() to anon, authenticated;
grant execute on function public.admin_set_explainer_videos(jsonb) to authenticated;
