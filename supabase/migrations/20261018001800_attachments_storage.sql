-- =====================================================================
-- 0018 Private clinical attachments (spec §12, §16).
--   * Private bucket `clinical-files`; public clinic photos live in a
--     separate public bucket `public-media` (no medical content).
--   * Upload flow: request (type/size allow-list, permission on the
--     record) → upload into quarantine/<id> → the `attachment-scan` Edge
--     Function verifies the real content (magic bytes, size), moves it to
--     files/<id> and marks it available. A virus-scanning provider plugs
--     into that function; without one, files are content-checked only
--     (documented limitation).
--   * Read: storage RLS allows a signed URL only when the caller may read
--     the linked record; URLs are short-lived (set by the client, 60 s).
--   * Knowing an attachment id grants nothing.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('clinical-files', 'clinical-files', false, 10485760, array['application/pdf', 'image/png', 'image/jpeg']),
       ('public-media', 'public-media', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id),
  kind text not null check (kind in ('lab_result', 'encounter')),
  lab_order_id uuid references public.lab_orders (id),
  encounter_id uuid references public.encounters (id),
  file_name text not null,
  declared_mime text not null check (declared_mime in ('application/pdf', 'image/png', 'image/jpeg')),
  declared_size int not null check (declared_size between 1 and 10485760),
  detected_mime text,
  status text not null default 'pending_upload' check (status in ('pending_upload', 'quarantine', 'available', 'rejected')),
  rejection_reason text,
  storage_path text,
  uploaded_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  available_at timestamptz,
  check ((kind = 'lab_result') = (lab_order_id is not null)),
  check ((kind = 'encounter') = (encounter_id is not null))
);
create index attachments_lab_idx on public.attachments (lab_order_id);
create index attachments_enc_idx on public.attachments (encounter_id);

create or replace function private.can_read_attachment(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.attachments a
     where a.id = p_id and a.status = 'available'
       and ((a.kind = 'lab_result' and (
               private.is_lab_staff((select lab_facility_id from public.lab_orders where id = a.lab_order_id))
               -- doctor / patient only once the order has released results
               or (exists (select 1 from public.lab_order_items i where i.order_id = a.lab_order_id and i.status = 'released')
                   and private.can_read_lab_order(a.lab_order_id))))
         or (a.kind = 'encounter' and private.can_read_encounter(a.encounter_id))));
$$;

alter table public.attachments enable row level security;
create policy attachments_read on public.attachments for select to authenticated
  using (private.can_read_attachment(id)
         or (uploaded_by = (select auth.uid()) and status in ('pending_upload', 'quarantine', 'rejected')));
grant select on public.attachments to authenticated;

-- Storage RLS -----------------------------------------------------------
create policy clinical_upload_quarantine on storage.objects for insert to authenticated
  with check (bucket_id = 'clinical-files'
              and (storage.foldername(name))[1] = 'quarantine'
              and exists (select 1 from public.attachments a
                           where a.id::text = storage.filename(name) and a.status = 'pending_upload'
                             and a.uploaded_by = (select auth.uid())));
create policy clinical_read_available on storage.objects for select to authenticated
  using (bucket_id = 'clinical-files'
         and (storage.foldername(name))[1] = 'files'
         and private.can_read_attachment((storage.filename(name))::uuid));
create policy public_media_read on storage.objects for select using (bucket_id = 'public-media');
create policy public_media_write on storage.objects for insert to authenticated
  with check (bucket_id = 'public-media' and (storage.foldername(name))[1] = 'facilities'
              and private.can_admin_facility(((storage.foldername(name))[2])::uuid));

-- RPCs ------------------------------------------------------------------
create or replace function public.request_attachment_upload(
  p_kind text,
  p_ref_id uuid,
  p_file_name text,
  p_mime text,
  p_size int
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.attachments;
  pid uuid;
begin
  if p_kind = 'lab_result' then
    select patient_id into pid from public.lab_orders o where o.id = p_ref_id and private.is_lab_staff(o.lab_facility_id);
  elsif p_kind = 'encounter' then
    select patient_id into pid from public.encounters e where e.id = p_ref_id and private.is_encounter_author(e.id);
  end if;
  if pid is null then perform private.fail('forbidden'); end if;
  if p_mime not in ('application/pdf', 'image/png', 'image/jpeg') then perform private.fail('file_type_not_allowed'); end if;
  if p_size is null or p_size <= 0 or p_size > 10485760 then perform private.fail('file_too_large'); end if;
  insert into public.attachments (patient_id, kind, lab_order_id, encounter_id, file_name, declared_mime, declared_size, uploaded_by)
  values (pid, p_kind, case when p_kind = 'lab_result' then p_ref_id end, case when p_kind = 'encounter' then p_ref_id end,
          left(regexp_replace(p_file_name, '[^[:alnum:]._ -]', '_', 'g'), 120), p_mime, p_size, auth.uid())
  returning * into a;
  return jsonb_build_object('attachment_id', a.id, 'upload_path', 'quarantine/' || a.id);
end;
$$;

-- after the client uploaded: hand over to the scanner (quarantine)
create or replace function public.submit_attachment(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.attachments set status = 'quarantine'
   where id = p_id and uploaded_by = auth.uid() and status = 'pending_upload'
     and exists (select 1 from storage.objects o where o.bucket_id = 'clinical-files' and o.name = 'quarantine/' || p_id);
  if not found then perform private.fail('upload_missing'); end if;
  perform private.audit('attachment.submitted', 'attachment', p_id);
end;
$$;

-- scanner verdict (service role only)
create or replace function public.attachment_scan_result(p_id uuid, p_ok boolean, p_detected_mime text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.attachments
     set status = case when p_ok then 'available' else 'rejected' end,
         detected_mime = p_detected_mime, rejection_reason = p_reason,
         storage_path = case when p_ok then 'files/' || p_id end,
         available_at = case when p_ok then now() end
   where id = p_id and status = 'quarantine';
end;
$$;

create or replace function public.list_attachments(p_kind text, p_ref_id uuid)
returns table (id uuid, file_name text, mime text, size int, status text, rejection_reason text, created_at timestamptz, storage_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.file_name, coalesce(a.detected_mime, a.declared_mime), a.declared_size, a.status, a.rejection_reason, a.created_at, a.storage_path
    from public.attachments a
   where ((p_kind = 'lab_result' and a.lab_order_id = p_ref_id) or (p_kind = 'encounter' and a.encounter_id = p_ref_id))
     and (private.can_read_attachment(a.id) or (a.uploaded_by = auth.uid() and a.status <> 'available'))
   order by a.created_at;
$$;

revoke execute on function public.request_attachment_upload(text, uuid, text, text, int), public.submit_attachment(uuid),
  public.list_attachments(text, uuid) from public, anon;
grant execute on function public.request_attachment_upload(text, uuid, text, text, int), public.submit_attachment(uuid),
  public.list_attachments(text, uuid) to authenticated;
revoke execute on function public.attachment_scan_result(uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.attachment_scan_result(uuid, boolean, text, text) to service_role;

-- scanner queue (service role only)
create or replace function public.attachment_scan_queue(p_limit int default 20)
returns table (id uuid, declared_mime text, declared_size int)
language sql
security definer
set search_path = ''
as $$
  select a.id, a.declared_mime, a.declared_size from public.attachments a
   where a.status = 'quarantine' order by a.created_at limit p_limit;
$$;
revoke execute on function public.attachment_scan_queue(int) from public, anon, authenticated;
grant execute on function public.attachment_scan_queue(int) to service_role;
