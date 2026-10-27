import { useState } from 'react';
import { Building2, Lock, MailOpen, ShieldAlert, Trash2, UserCheck } from 'lucide-react';
import { errorMessage } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { Alert, Button, ConfirmDialog, ErrorState, PageHead, SkeletonList, TextField, useToast } from '../../components/ui';

interface Overview { organizations: Record<string, number> | null; facilities: Record<string, number> | null; pending_facilities: number; active_memberships: number; open_invitations: number; suspended_accounts: number }

/** Real operational counters only — the platform admin has no access to medical records (§3). */
export function AdminOverview() {
  const data = useAsync(async () => (await unwrap(supabase.rpc('platform_overview'))) as unknown as Overview, []);
  return (
    <div className="stack">
      <PageHead title="نظرة عامة على المنصة" subtitle="مؤشرات تشغيلية — بلا بيانات طبية" />
      {data.status === 'loading' && <SkeletonList />}
      {data.status === 'error' && <ErrorState error={data.error} onRetry={data.reload} />}
      {data.data && (
        <>
          <div className="kpi-strip">
            <div className="kpi"><Building2 size={22} aria-hidden /><div><div className="kpi-v num">{data.data.organizations?.active ?? 0}</div><div className="kpi-l">مجمعات فعّالة</div></div></div>
            <div className="kpi"><ShieldAlert size={22} aria-hidden /><div><div className="kpi-v num">{data.data.pending_facilities}</div><div className="kpi-l">جهات بانتظار التحقق</div></div></div>
            <div className="kpi"><UserCheck size={22} aria-hidden /><div><div className="kpi-v num">{data.data.active_memberships}</div><div className="kpi-l">عضويات فعّالة</div></div></div>
            <div className="kpi"><MailOpen size={22} aria-hidden /><div><div className="kpi-v num">{data.data.open_invitations}</div><div className="kpi-l">دعوات مفتوحة</div></div></div>
          </div>
          <Alert tone="info" title="حدود صلاحيات الإدارة">
            لا تمنح هذه اللوحة قراءة السجلات الطبية. أي وصول استثنائي مستقبلي يجب أن يكون مقيداً ومسبباً ومؤقتاً ومسجلاً (غير مفعّل في هذه النسخة).
          </Alert>
          <div className="card">
            <h2 className="section-title">الجهات حسب النوع</h2>
            <p className="small">عيادات: {data.data.facilities?.clinic ?? 0} · صيدليات: {data.data.facilities?.pharmacy ?? 0} · مختبرات: {data.data.facilities?.laboratory ?? 0} · حسابات موقوفة: {data.data.suspended_accounts}</p>
          </div>
        </>
      )}
      <ResetDemoData onDone={data.reload} />
    </div>
  );
}

const PHRASE = 'احذف كل البيانات التجريبية';
const LABELS: Record<string, string> = { organizations: 'مجمعات وجهات مستقلة', facilities: 'عيادات وصيدليات ومختبرات', practitioner_profiles: 'أطباء',
  patients: 'مرضى', appointments: 'حجوزات', encounters: 'زيارات', prescriptions: 'وصفات', lab_orders: 'طلبات تحاليل', sales: 'عمليات بيع' };
interface Preview { counts: Record<string, number>; accounts: number; admins_kept: number; locked_at: string | null }

/** Before launch: empty the platform of the demo data in one step; then lock this for good. */
function ResetDemoData({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const preview = useAsync(async () => (await unwrap(supabase.rpc('admin_reset_preview'))) as unknown as Preview, []);
  const [phrase, setPhrase] = useState('');
  const [ask, setAsk] = useState<'reset' | 'lock' | null>(null);
  const [busy, setBusy] = useState(false);
  const p = preview.data;

  const run = async () => {
    setBusy(true);
    const { error } = ask === 'reset'
      ? await supabase.rpc('admin_reset_platform', { p_confirm: phrase })
      : await supabase.rpc('admin_lock_reset');
    setBusy(false);
    if (error) { toast(errorMessage(error), 'danger'); return; }
    toast(ask === 'reset' ? 'انمسحت كل البيانات التجريبية — المنصة جاهزة للبيانات الحقيقية' : 'انقفلت أداة المسح نهائياً', 'success');
    setAsk(null); setPhrase(''); preview.reload(); onDone();
  };

  if (preview.status === 'error') return null;
  return (
    <section className="card stack danger-zone" aria-labelledby="reset-title">
      <h2 id="reset-title" className="section-title row" style={{ gap: 8 }}><Trash2 size={18} aria-hidden />قبل الإطلاق: مسح البيانات التجريبية</h2>
      {!p && <SkeletonList rows={2} />}
      {p?.locked_at && <Alert tone="success" title="الأداة مقفولة">انقفلت بتاريخ {new Date(p.locked_at).toLocaleDateString('ar-IQ')}، وما تكدر تشتغل مرة ثانية. هذا يحمي البيانات الحقيقية.</Alert>}
      {p && !p.locked_at && (
        <>
          <p className="small">يمسح كل البيانات الوهمية مرة وحدة، حتى تبدي المنصة نظيفة للبيانات الحقيقية. <b>ما يرجع.</b></p>
          <div className="reset-grid">
            {Object.entries(p.counts).map(([k, n]) => <div key={k}><b className="num">{n}</b><span className="small muted">{LABELS[k] ?? k}</span></div>)}
            <div><b className="num">{p.accounts}</b><span className="small muted">حسابات (غير المدير)</span></div>
          </div>
          <p className="small muted">يبقى: حسابات مدير المنصة ({p.admins_kept}) · المدن والاختصاصات · قائمة التحاليل الأساسية وقائمة الأدوية · إعدادات المنصة · سجل التدقيق · سجل المراقبة.</p>
          <TextField label={`حتى تأكد، اكتب: ${PHRASE}`} value={phrase} onChange={(e) => setPhrase(e.target.value)} autoComplete="off" />
          <div className="row" style={{ gap: 'var(--s-2)', flexWrap: 'wrap' }}>
            <Button variant="danger" icon={<Trash2 size={16} aria-hidden />} disabled={phrase.trim() !== PHRASE} onClick={() => setAsk('reset')}>مسح كل البيانات التجريبية</Button>
            <Button variant="secondary" icon={<Lock size={16} aria-hidden />} onClick={() => setAsk('lock')}>قفل الأداة نهائياً</Button>
          </div>
          <p className="small muted">اقفل الأداة أول ما تدخل البيانات الحقيقية، حتى محد يكدر يمسحها بالغلط.</p>
        </>
      )}
      <ConfirmDialog open={ask !== null} tone={ask === 'reset' ? 'danger' : 'primary'} loading={busy} onCancel={() => setAsk(null)} onConfirm={run}
                     title={ask === 'reset' ? 'متأكد تمسح كل البيانات التجريبية؟' : 'قفل أداة المسح نهائياً؟'}
                     confirmLabel={ask === 'reset' ? 'نعم، امسح' : 'نعم، اقفلها'}>
        {ask === 'reset' ? 'كل المجمعات والأطباء والمرضى والحجوزات والوصفات والحسابات (عدا المدير) تنمسح هسه، وما ترجع.' : 'بعد القفل ما يكدر أحد، حتى المدير، يشغّل المسح مرة ثانية.'}
      </ConfirmDialog>
    </section>
  );
}
