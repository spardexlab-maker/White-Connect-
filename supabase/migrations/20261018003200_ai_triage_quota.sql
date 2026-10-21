-- AI assistant «كيف نساعدك اليوم؟» (owner request, 20 Oct 2026): the patient
-- describes a complaint, the edge function `ai-triage` suggests which
-- specialty (from our list) and/or lab to visit, then the app shows the
-- nearest ones. Not a diagnosis.
-- This table keeps only WHO used it and WHEN (for the usage limit); the text
-- the patient typed is never stored.

create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null default 'triage',
  created_at timestamptz not null default now()
);
create index ai_usage_user_idx on public.ai_usage (user_id, created_at desc);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;

-- called by the edge function with the user's own token: takes one unit of
-- quota (10 per hour, 40 per day) and returns the active specialties to choose from
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
  if (select count(*) from public.ai_usage where user_id = uid and created_at > now() - interval '1 hour') >= 10
     or (select count(*) from public.ai_usage where user_id = uid and created_at > now() - interval '1 day') >= 40 then
    perform private.fail('ai_rate_limited');
  end if;
  insert into public.ai_usage (user_id) values (uid);
  return jsonb_build_object('specialties', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'code', s.code, 'name', s.name_ar) order by s.sort_order)
                                                       from public.specialties s where s.is_active), '[]'::jsonb));
end;
$$;

revoke execute on function public.ai_triage_begin() from public, anon;
grant execute on function public.ai_triage_begin() to authenticated;

-- the AI provider key lives in Supabase Vault (encrypted), named 'gemini_api_key';
-- only the service role (the edge function) can read it. An edge-function
-- secret GEMINI_API_KEY, when set, takes precedence.
create or replace function public.ai_provider_key()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'gemini_api_key' limit 1;
$$;
revoke execute on function public.ai_provider_key() from public, anon, authenticated;
grant execute on function public.ai_provider_key() to service_role;
