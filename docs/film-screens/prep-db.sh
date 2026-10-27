#!/usr/bin/env bash
# Local demo data for the films: fresh seed, a few days of real activity (the e2e journeys),
# then names without the «(تجريبي)» marker. Needs the local stack and a web build on :4173.
set -euo pipefail
cd "$(dirname "$0")/../.."
BASE="${BASE:-http://127.0.0.1:4173}"; P=postgresql://postgres:postgres@127.0.0.1:54322/postgres
npx supabase db reset >/dev/null 2>&1
for e in booking-journey operations home-lab; do node scripts/e2e-$e.mjs "$BASE" >/dev/null; echo "populated: $e"; done
psql $P -Atc "select table_name||'|'||column_name from information_schema.columns c join information_schema.tables t using (table_schema, table_name)
              where c.table_schema='public' and c.data_type='text' and t.table_type='BASE TABLE'" |
while IFS='|' read t c; do
  psql $P -qc "update public.$t set $c = trim(replace(replace(replace(replace($c,' (تجريبي)',''),'(تجريبي)',''),'تقييم تجريبي','التهاب بلعوم حاد'),'مختبر تجريبي','المختبر')) where $c like '%تجريبي%'" 2>/dev/null || true
done
psql $P -qc "update public.practitioner_profiles set bio = 'استشاري باطنية بخبرة ١٥ سنة في متابعة السكري والضغط وأمراض الجهاز الهضمي.' where bio ilike '%تطوير%' or bio ilike '%لأغراض%'"
echo "film data ready"
