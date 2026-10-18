-- Platform admin creates/updates a doctor's professional identity for an
-- existing account identified by its email (the admin UI has no user ids).
-- The account must already exist (the doctor signs up first); nothing is
-- created for unknown emails and the lookup result is not exposed.
create or replace function public.admin_upsert_practitioner_by_email(
  p_email text,
  p_full_name text,
  p_specialty_id uuid default null,
  p_title text default null,
  p_license_number text default null,
  p_bio text default null,
  p_mark_license_verified boolean default false
) returns public.practitioner_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  rec public.practitioner_profiles;
begin
  if not private.is_platform_admin() then perform private.fail('forbidden'); end if;
  if coalesce(trim(p_full_name), '') = '' then perform private.fail('invalid_input'); end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then perform private.fail('account_not_found'); end if;
  insert into public.practitioner_profiles (user_id, full_name, specialty_id, title, license_number, bio,
                                            license_verified_at, license_verified_by)
  values (uid, trim(p_full_name), p_specialty_id, nullif(trim(p_title), ''), nullif(trim(p_license_number), ''), nullif(trim(p_bio), ''),
          case when p_mark_license_verified then now() end,
          case when p_mark_license_verified then auth.uid() end)
  on conflict (user_id) do update
    set full_name = excluded.full_name,
        specialty_id = excluded.specialty_id,
        title = excluded.title,
        license_number = excluded.license_number,
        bio = excluded.bio,
        license_verified_at = coalesce(excluded.license_verified_at, public.practitioner_profiles.license_verified_at),
        license_verified_by = coalesce(excluded.license_verified_by, public.practitioner_profiles.license_verified_by)
  returning * into rec;
  perform private.audit('practitioner.upserted', 'practitioner', rec.id);
  return rec;
end;
$$;

revoke execute on function public.admin_upsert_practitioner_by_email(text, text, uuid, text, text, text, boolean) from public, anon;
grant execute on function public.admin_upsert_practitioner_by_email(text, text, uuid, text, text, text, boolean) to authenticated;
