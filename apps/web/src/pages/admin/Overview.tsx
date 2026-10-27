import { useState } from 'react';
import { Building2, Lock, MailOpen, PlayCircle, ShieldAlert, Trash2, UserCheck } from 'lucide-react';
import { errorMessage, videoAudienceLabel, youtubeId, youtubeThumb, type ExplainerVideo, type VideoAudience } from '@app/shared';
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
      <VideoLinks />
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

const AUDIENCES: VideoAudience[] = ['patient', 'doctor', 'lab', 'pharmacy'];
const DEFAULT_TITLES: Record<VideoAudience, string> = { patient: 'شرح أبيض للمرضى', doctor: 'أبيض للأطباء', lab: 'أبيض للمختبرات', pharmacy: 'أبيض للصيدليات' };

/** One YouTube link per audience; they show in the app, on the patient home and on /videos. */
function VideoLinks() {
  const toast = useToast();
  const [links, setLinks] = useState<Record<VideoAudience, string> | null>(null);
  const [busy, setBusy] = useState(false);
  useAsync(async () => {
    const list = ((await unwrap(supabase.rpc('explainer_videos'))) ?? []) as unknown as ExplainerVideo[];
    const m = { patient: '', doctor: '', lab: '', pharmacy: '' } as Record<VideoAudience, string>;
    for (const v of list) m[v.audience] = `https://youtu.be/${v.youtube_id}`;
    setLinks(m);
    return list;
  }, []);
  if (!links) return null;
  const bad = AUDIENCES.filter((a) => links[a].trim() && !youtubeId(links[a]));

  const save = async () => {
    setBusy(true);
    const videos = AUDIENCES.filter((a) => youtubeId(links[a])).map((a) => ({ audience: a, title: DEFAULT_TITLES[a], youtube_id: youtubeId(links[a])! }));
    const { error } = await supabase.rpc('admin_set_explainer_videos', { p_videos: videos });
    setBusy(false);
    toast(error ? errorMessage(error) : 'انحفظت روابط الفيديوهات — تظهر هسه بالتطبيق والموقع', error ? 'danger' : 'success');
  };

  return (
    <section className="card stack" aria-labelledby="vid-title">
      <h2 id="vid-title" className="section-title row" style={{ gap: 8 }}><PlayCircle size={18} aria-hidden />فيديوهات الشرح (YouTube)</h2>
      <p className="small muted">ارفع الفيديو على YouTube، انسخ رابطه والصقه هنا. فيديو المرضى يطلع بالصفحة الرئيسية للتطبيق والموقع، وفيديوهات المهنيين بصفحة «/videos» وصفحة دخول المهنيين. خانة فارغة = الفيديو ما يطلع.</p>
      <div className="video-links">
        {AUDIENCES.map((a) => {
          const id = youtubeId(links[a]);
          return (
            <div key={a} className="row" style={{ gap: 'var(--s-3)', alignItems: 'flex-end' }}>
              {id ? <img src={youtubeThumb(id)} alt="" width={96} height={54} style={{ borderRadius: 8, objectFit: 'cover' }} /> : <span className="video-slot" aria-hidden />}
              <div className="grow">
                <TextField label={`${DEFAULT_TITLES[a]} — ${videoAudienceLabel[a]}`} ltr placeholder="https://youtu.be/…" value={links[a]}
                           error={links[a].trim() && !id ? 'هذا مو رابط YouTube' : undefined}
                           onChange={(e) => setLinks({ ...links, [a]: e.target.value })} />
              </div>
            </div>
          );
        })}
      </div>
      <div><Button loading={busy} disabled={bad.length > 0} onClick={() => void save()}>حفظ الروابط</Button></div>
    </section>
  );
}
