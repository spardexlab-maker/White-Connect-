-- Defence in depth (security review, 27 Oct 2026): reviewing join applications is an
-- admin action; the function already refuses non-admins, and signed-out callers no longer
-- reach it at all.
revoke execute on function public.review_provider_application(uuid, text, text) from public, anon;
grant execute on function public.review_provider_application(uuid, text, text) to authenticated;
