-- =====================================================================
-- 0015 Normalize table privileges (found while verifying the cloud
-- project against the advisors).
--
-- Supabase Cloud's default privileges grant anon/authenticated ALL on
-- new public tables, and both environments grant TRUNCATE / TRIGGER /
-- REFERENCES (TRUNCATE ignores RLS). Rows were still protected by RLS,
-- but table-level UPDATE silently widened the column-level grants (e.g.
-- a facility admin could have changed facilities.status directly).
--
-- This migration makes the privileges identical everywhere: revoke all
-- non-SELECT rights (and anon SELECT), then re-grant exactly the intended
-- set, and stop future tables from being exposed by default.
-- Note: revoking a table privilege also revokes its column privileges,
-- so the column grants are re-applied below.
-- =====================================================================

do $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke insert, update, delete, truncate, trigger, references on public.%I from anon, authenticated', t.tablename);
    execute format('revoke select on public.%I from anon', t.tablename);
  end loop;
end $$;

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;

-- public read (discovery) — rows still filtered by RLS
grant select on public.booking_policies, public.branches, public.cities, public.clinic_services, public.delay_notices,
  public.facilities, public.lab_test_catalog, public.organizations, public.schedules, public.specialties to anon;

-- catalog administration (RLS limits to platform admin / lab approver)
grant insert, update, delete on public.cities, public.specialties to authenticated;
grant insert, update on public.medication_catalog, public.lab_test_catalog to authenticated;

-- column-level self-service updates
grant update (display_name, locale) on public.profiles to authenticated;
grant update (title, bio, photo_path) on public.practitioner_profiles to authenticated;
grant update (description, phone, opening_hours_note, is_public, default_pharmacy_id, default_lab_id) on public.facilities to authenticated;
grant update (read_at) on public.notifications to authenticated;
