-- =====================================================================
-- 0014 Fixes from Supabase security/performance advisors.
--   * expire_pending_appointments: worker/cron only (Supabase default
--     privileges had granted it to authenticated).
--   * auth_rls_initplan: evaluate auth.uid() once per query.
--   * multiple_permissive_policies: catalog admin policies split per
--     command so SELECT has a single policy.
-- (Intentional, documented: RPCs are SECURITY DEFINER with internal
--  authorization; 4 public discovery/verification RPCs are anon-callable.)
-- =====================================================================

revoke execute on function public.expire_pending_appointments() from authenticated;

-- ---------- auth.uid() evaluated once ----------
alter policy profiles_self_read on public.profiles
  using (id = (select auth.uid()) or private.is_platform_admin());
alter policy profiles_self_update on public.profiles
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
alter policy platform_admins_read on public.platform_admins
  using (user_id = (select auth.uid()) or private.is_platform_admin());
alter policy organizations_read on public.organizations
  using (status = 'active'
         or private.is_platform_admin()
         or exists (select 1 from public.memberships m
                     where m.organization_id = organizations.id and m.user_id = (select auth.uid()) and m.status = 'active'));
alter policy practitioner_self on public.practitioner_profiles
  using (user_id = (select auth.uid())
         or private.is_platform_admin()
         or exists (select 1 from public.memberships m
                     where m.user_id = practitioner_profiles.user_id and m.role = 'doctor'
                       and m.status = 'active' and private.is_member_of_facility(m.facility_id)));
alter policy practitioner_self_update on public.practitioner_profiles
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy memberships_read on public.memberships
  using (user_id = (select auth.uid())
         or private.is_platform_admin()
         or private.is_org_admin(organization_id)
         or (facility_id is not null and private.can_admin_facility(facility_id)));
alter policy reception_scopes_read on public.reception_scopes
  using (exists (select 1 from public.memberships m where m.id = reception_scopes.membership_id
                  and (m.user_id = (select auth.uid()) or private.can_admin_facility(m.facility_id) or private.is_platform_admin())));
alter policy patient_links_read on public.patient_account_links
  using (user_id = (select auth.uid()));
alter policy notifications_own on public.notifications
  using (user_id = (select auth.uid()));
alter policy notifications_mark_read on public.notifications
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------- one SELECT policy per catalog ----------
drop policy cities_admin on public.cities;
create policy cities_admin_ins on public.cities for insert to authenticated with check (private.is_platform_admin());
create policy cities_admin_upd on public.cities for update to authenticated using (private.is_platform_admin()) with check (private.is_platform_admin());
create policy cities_admin_del on public.cities for delete to authenticated using (private.is_platform_admin());

drop policy specialties_admin on public.specialties;
create policy specialties_admin_ins on public.specialties for insert to authenticated with check (private.is_platform_admin());
create policy specialties_admin_upd on public.specialties for update to authenticated using (private.is_platform_admin()) with check (private.is_platform_admin());
create policy specialties_admin_del on public.specialties for delete to authenticated using (private.is_platform_admin());

drop policy med_catalog_admin on public.medication_catalog;
create policy med_catalog_admin_ins on public.medication_catalog for insert to authenticated with check (private.is_platform_admin());
create policy med_catalog_admin_upd on public.medication_catalog for update to authenticated using (private.is_platform_admin()) with check (private.is_platform_admin());

drop policy lab_catalog_write on public.lab_test_catalog;
create policy lab_catalog_ins on public.lab_test_catalog for insert to authenticated
  with check (private.has_facility_role(lab_facility_id, array['lab_approver', 'facility_admin']::public.member_role[]));
create policy lab_catalog_upd on public.lab_test_catalog for update to authenticated
  using (private.has_facility_role(lab_facility_id, array['lab_approver', 'facility_admin']::public.member_role[]))
  with check (private.has_facility_role(lab_facility_id, array['lab_approver', 'facility_admin']::public.member_role[]));
