-- The assistant became a conversation (owner request, 21 Oct 2026): each
-- message — and each voice note's transcription — takes one unit, so the
-- per-user limit rises to 30 per hour and 150 per day. Still no text stored.
create or replace function public.ai_triage_begin()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then perform private.fail('not_authenticated'); end if;
  if (select count(*) from public.ai_usage where user_id = uid and created_at > now() - interval '1 hour') >= 30
     or (select count(*) from public.ai_usage where user_id = uid and created_at > now() - interval '1 day') >= 150 then
    perform private.fail('ai_rate_limited');
  end if;
  insert into public.ai_usage (user_id) values (uid);
  return jsonb_build_object('specialties', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'code', s.code, 'name', s.name_ar) order by s.sort_order)
                                                       from public.specialties s where s.is_active), '[]'::jsonb));
end;
$$;
