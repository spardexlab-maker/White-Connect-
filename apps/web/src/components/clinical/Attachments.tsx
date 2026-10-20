import { useEffect, useRef, useState } from 'react';
import { FileText, Image as ImageIcon, Paperclip, ShieldAlert, Upload } from 'lucide-react';
import { errorMessage, formatDateTime } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { Badge, Button, useToast } from '../ui';

interface Att { id: string; file_name: string; mime: string; size: number; status: string; rejection_reason: string | null; created_at: string }
const statusBadge: Record<string, JSX.Element> = {
  pending_upload: <Badge tone="neutral">لم يكتمل الرفع</Badge>,
  quarantine: <Badge tone="warning">قيد الفحص</Badge>,
  rejected: <Badge tone="danger" icon={<ShieldAlert aria-hidden />}>مرفوض</Badge>,
  available: <Badge tone="success">متاح</Badge>,
};
const reasonText: Record<string, string> = { unrecognized_content: 'المحتوى لا يطابق PDF/صورة', type_mismatch: 'النوع لا يطابق المصرح', size_mismatch: 'الحجم غير مطابق' };

/** Private files: quarantine → content check → short-lived signed links (60 s). */
export function Attachments({ kind, refId, canUpload, onCount }: { kind: 'lab_result' | 'encounter'; refId: string; canUpload?: boolean; onCount?: (available: number) => void }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const list = useAsync(async () => (await unwrap(supabase.rpc('list_attachments', { p_kind: kind, p_ref_id: refId }))) as Att[], [kind, refId]);
  useEffect(() => { if (list.data) onCount?.(list.data.filter((a) => a.status === 'available').length); }, [list.data, onCount]);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const req = await supabase.rpc('request_attachment_upload', { p_kind: kind, p_ref_id: refId, p_file_name: file.name, p_mime: file.type, p_size: file.size });
      if (req.error) throw req.error;
      const { attachment_id, upload_path } = req.data as { attachment_id: string; upload_path: string };
      const up = await supabase.storage.from('clinical-files').upload(upload_path, file, { contentType: file.type });
      if (up.error) throw up.error;
      const sub = await supabase.rpc('submit_attachment', { p_id: attachment_id });
      if (sub.error) throw sub.error;
      await supabase.functions.invoke('attachment-scan', { body: {} });
      toast('رُفع الملف وفُحص محتواه', 'success');
    } catch (e) { toast(errorMessage(e), 'danger'); }
    setBusy(false); list.reload();
  };
  const open = async (a: Att) => {
    const { data, error } = await supabase.storage.from('clinical-files').createSignedUrl(`files/${a.id}`, 60);
    if (error || !data) { toast('لا تملك صلاحية فتح هذا الملف أو لم يُنشر بعد', 'danger'); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  if (!canUpload && !list.data?.length) return null;
  return (
    <div className="stack-sm">
      <h4 className="section-title row" style={{ fontSize: 'var(--f-body)' }}><Paperclip size={16} aria-hidden />المرفقات</h4>
      {list.data?.map((a) => (
        <div key={a.id} className="row" style={{ gap: 8 }}>
          {a.mime === 'application/pdf' ? <FileText size={16} aria-hidden /> : <ImageIcon size={16} aria-hidden />}
          <span className="grow small"><bdi dir="auto">{a.file_name}</bdi> · {Math.ceil(a.size / 1024)} KB · {formatDateTime(a.created_at)}</span>
          {statusBadge[a.status]}
          {a.status === 'rejected' && a.rejection_reason && <span className="small muted">{reasonText[a.rejection_reason] ?? a.rejection_reason}</span>}
          {a.status === 'available' && <Button size="sm" variant="ghost" onClick={() => open(a)}>فتح</Button>}
        </div>
      ))}
      {canUpload && (
        <>
          <input ref={input} type="file" accept="application/pdf,image/png,image/jpeg" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
          <Button size="sm" variant="secondary" icon={<Upload size={16} />} loading={busy} onClick={() => input.current?.click()}>رفع PDF أو صورة (حتى 10 MB)</Button>
          <span className="small muted">يُفحص محتوى الملف قبل إتاحته، ويظهر للمريض والطبيب بعد نشر النتيجة.</span>
        </>
      )}
    </div>
  );
}
