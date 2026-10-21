-- Clinic photos, doctor's photo and certificates (owner request, 20 Oct 2026),
-- shown on the public provider page. Files live in the public bucket
-- `public-media`:
--   facilities/<facility_id>/<file>      clinic photos   (doctors of that clinic, platform admin)
--   practitioners/<practitioner_id>/<file> photo and certificates (the doctor, platform admin)
-- Only images (png/jpeg/webp, ≤ 5 MB — bucket limits). Removal is soft (kept for the record).

create table public.provider_media (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('clinic_photo', 'certificate', 'profile_photo')),
  facility_id uuid references public.facilities (id),
  practitioner_id uuid references public.practitioner_profiles (id),
  storage_path text not null unique,
  caption text check (length(caption) <= 200),
  uploaded_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  check ((kind = 'clinic_photo') = (facility_id is not null)),
  check ((kind <> 'clinic_photo') = (practitioner_id is not null))
);
create index provider_media_facility_idx on public.provider_media (facility_id) where removed_at is null;
create index provider_media_practitioner_idx on public.provider_media (practitioner_id) where removed_at is null;
alter table public.provider_media enable row level security;
revoke all on public.provider_media from anon, authenticated;

create or replace function private.can_manage_media(p_folder text, p_target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_platform_admin()
      or (p_folder = 'facilities' and private.has_facility_role(p_target, array['doctor']::public.member_role[]))
      or (p_folder = 'practitioners' and p_target = private.current_practitioner_id());
$$;

create policy public_media_write_staff on storage.objects for insert to authenticated
  with check (bucket_id = 'public-media' and (storage.foldername(name))[1] in ('facilities', 'practitioners')
              and private.can_manage_media((storage.foldername(name))[1], ((storage.foldername(name))[2])::uuid));

create or replace function public.add_provider_media(p_kind text, p_target_id uuid, p_storage_path text, p_caption text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  folder text := case when p_kind = 'clinic_photo' then 'facilities' else 'practitioners' end;
  new_id uuid;
begin
  if p_kind not in ('clinic_photo', 'certificate', 'profile_photo') then perform private.fail('invalid_input'); end if;
  if not private.can_manage_media(folder, p_target_id) then perform private.fail('forbidden'); end if;
  if split_part(p_storage_path, '/', 1) <> folder or split_part(p_storage_path, '/', 2) <> p_target_id::text
     or not exists (select 1 from storage.objects o where o.bucket_id = 'public-media' and o.name = p_storage_path) then
    perform private.fail('invalid_input');
  end if;
  if p_kind = 'profile_photo' then
    update public.provider_media set removed_at = now() where practitioner_id = p_target_id and kind = 'profile_photo' and removed_at is null;
    update public.practitioner_profiles set photo_path = p_storage_path where id = p_target_id;
  end if;
  insert into public.provider_media (kind, facility_id, practitioner_id, storage_path, caption, uploaded_by)
  values (p_kind, case when p_kind = 'clinic_photo' then p_target_id end, case when p_kind <> 'clinic_photo' then p_target_id end,
          p_storage_path, nullif(trim(coalesce(p_caption, '')), ''), auth.uid())
  returning provider_media.id into new_id;
  perform private.audit('provider_media.added', 'provider_media', new_id, case when p_kind = 'clinic_photo' then p_target_id end, null, null,
                        jsonb_build_object('kind', p_kind));
  return new_id;
end;
$$;

create or replace function public.remove_provider_media(p_media_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.provider_media;
begin
  select * into m from public.provider_media where id = p_media_id;
  if m.id is null or not private.can_manage_media(case when m.kind = 'clinic_photo' then 'facilities' else 'practitioners' end,
                                                  coalesce(m.facility_id, m.practitioner_id)) then
    perform private.fail('forbidden');
  end if;
  update public.provider_media set removed_at = now() where id = m.id and removed_at is null;
  if m.kind = 'profile_photo' then
    update public.practitioner_profiles set photo_path = null where id = m.practitioner_id and photo_path = m.storage_path;
  end if;
end;
$$;

-- public: what the provider page shows (active, public facilities only)
create or replace function public.provider_media(p_facility_id uuid, p_practitioner_id uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'clinic_photos', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'path', m.storage_path, 'caption', m.caption) order by m.created_at)
                                 from public.provider_media m join public.facilities f on f.id = m.facility_id and f.status = 'active'
                                where m.facility_id = p_facility_id and m.kind = 'clinic_photo' and m.removed_at is null), '[]'::jsonb),
    'certificates', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'path', m.storage_path, 'caption', m.caption) order by m.created_at)
                                from public.provider_media m join public.practitioner_profiles pp on pp.id = m.practitioner_id and pp.status = 'active'
                               where m.practitioner_id = p_practitioner_id and m.kind = 'certificate' and m.removed_at is null), '[]'::jsonb),
    'photo', (select m.storage_path from public.provider_media m
               where m.practitioner_id = p_practitioner_id and m.kind = 'profile_photo' and m.removed_at is null order by m.created_at desc limit 1)
  );
$$;

revoke execute on function public.add_provider_media(text, uuid, text, text), public.remove_provider_media(uuid) from public, anon;
grant execute on function public.add_provider_media(text, uuid, text, text), public.remove_provider_media(uuid) to authenticated;
grant execute on function public.provider_media(uuid, uuid) to anon, authenticated;
