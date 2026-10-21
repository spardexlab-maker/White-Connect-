-- One-off (test phase): give every existing patient an «ID-W<n>» number.
-- ID-W1 is the patient on the owner's phone (spardexlab+patient@gmail.com),
-- the rest follow in registration order. The sequence then continues from
-- the highest number. Re-running keeps codes that are already ID-W.
-- A fresh numbering for launch can restart the sequence later.
with first as (
  select l.patient_id from public.patient_account_links l join auth.users u on u.id = l.user_id
   where lower(u.email) = 'spardexlab+patient@gmail.com' and l.relationship = 'self' limit 1
), ordered as (
  select p.id, row_number() over (order by (p.id = (select patient_id from first)) desc, p.created_at, p.id) as n
    from public.patients p
)
update public.patients p
   set public_code = 'ID-W' || o.n
  from ordered o
 where o.id = p.id and p.public_code !~ '^ID-W[0-9]+$';

select setval('public.patient_code_seq', (select max(substring(public_code from '^ID-W([0-9]+)$')::bigint) from public.patients));
select public_code, full_name from public.patients where public_code ~ '^ID-W[0-9]+$' order by substring(public_code from '^ID-W([0-9]+)$')::bigint limit 10;
