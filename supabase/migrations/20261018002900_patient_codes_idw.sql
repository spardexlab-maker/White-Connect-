-- Short, readable patient numbers (owner request, 20 Oct 2026): every new
-- patient gets «ID-W<n>» from a sequence (ID-W1, ID-W2, …). Existing codes
-- stay valid; renumbering existing records is a data step
-- (supabase/cloud/renumber-patient-codes.sql), not part of this migration.
-- Staff lookup accepts ID-W12, idw12 or id-w 12.

create sequence if not exists public.patient_code_seq;
select setval('public.patient_code_seq',
              greatest(1, coalesce((select max(substring(public_code from '^ID-W([0-9]+)$')::bigint) from public.patients), 0)),
              exists (select 1 from public.patients where public_code ~ '^ID-W[0-9]+$'));
alter table public.patients alter column public_code set default ('ID-W' || nextval('public.patient_code_seq'));

-- normalise what staff type or scan into the canonical form
create or replace function private.normalize_patient_code(p text)
returns text language sql immutable set search_path = '' as $$
  select case
    when upper(regexp_replace(coalesce(p, ''), '\s', '', 'g')) ~ '^ID-?W[0-9]+$'
      then 'ID-W' || (regexp_match(upper(regexp_replace(p, '\s', '', 'g')), '^ID-?W0*([0-9]+)$'))[1]
    else upper(trim(coalesce(p, '')))
  end;
$$;

create or replace function public.lookup_patients(
  p_facility_id uuid,
  p_query text,
  p_kind text default 'auto'   -- auto | phone | code | qr | name
) returns table (
  patient_id uuid,
  public_code text,
  full_name text,
  sex public.patient_sex,
  birth_year int,
  phone_masked text,
  is_provisional boolean,
  has_account boolean,
  known_here boolean
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  q text := trim(coalesce(p_query, ''));
  kind text := p_kind;
  limit_per_min int;
begin
  if not private.has_facility_role(p_facility_id,
       array['receptionist', 'doctor', 'facility_admin', 'lab_technician', 'lab_approver', 'pharmacist', 'pharmacy_staff']::public.member_role[]) then
    perform private.fail('forbidden');
  end if;
  if length(q) < 3 then
    perform private.fail('query_too_short');
  end if;
  select lookup_rate_limit_per_minute into limit_per_min from public.platform_settings;
  perform private.enforce_rate_limit('patient_lookup', limit_per_min);

  if kind = 'auto' then
    kind := case
      when upper(regexp_replace(q, '\s', '', 'g')) ~ '^ID-?W[0-9]+$' or q ~ '^P[0-9A-Z]{9}$' then 'code'
      when q ~ '^[+0-9 ()-]{6,}$' then 'phone'
      when q ~ '^qr_' then 'qr'
      else 'name' end;
  end if;

  perform private.audit('patient.lookup', 'facility', p_facility_id, p_facility_id, null, null,
                        jsonb_build_object('kind', kind));

  return query
  select p.id, p.public_code, p.full_name, p.sex,
         coalesce(p.birth_year, extract(year from p.birth_date)::int),
         private.mask_phone(p.phone), p.is_provisional,
         exists (select 1 from public.patient_account_links l where l.patient_id = p.id and l.revoked_at is null),
         exists (select 1 from public.care_relationships c where c.patient_id = p.id and c.facility_id = p_facility_id and c.ended_at is null)
    from public.patients p
   where p.status = 'active'
     and case kind
           when 'code'  then p.public_code = private.normalize_patient_code(q)
           when 'phone' then regexp_replace(p.phone, '[^0-9]', '', 'g') = regexp_replace(q, '[^0-9]', '', 'g')
           when 'qr'    then p.id = (select t.patient_id from public.patient_qr_tokens t
                                       where t.token_hash = private.sha256_hex(q) and t.revoked_at is null)
           -- name search is restricted to patients already known to this facility
           else lower(p.full_name) like '%' || lower(q) || '%'
                and exists (select 1 from public.care_relationships c
                             where c.patient_id = p.id and c.facility_id = p_facility_id and c.ended_at is null)
         end
   order by p.full_name
   limit 20;
end;
$$;
