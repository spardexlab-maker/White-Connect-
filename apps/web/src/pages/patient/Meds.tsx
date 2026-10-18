import { Check, Clock, Pause, Pill, Play, SkipForward, Square } from 'lucide-react';
import { errorMessage, formatDate, formatTime } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { useAuth } from '../../lib/auth';
import { Alert, Badge, Button, EmptyState, ErrorState, SkeletonList, useToast } from '../../components/ui';
import { SignInPrompt } from './Account';

interface Dose { id: string; scheduled_at: string; status: string; dose_status: string | null; snooze_count: number }
interface Plan { id: string; display_name: string; instructions: string | null; start_date: string; end_date: string | null; times: string[]; as_needed: boolean;
  status: string; status_reason: string | null; source: string; patient_name: string; doses: Dose[] }
const statusLabel: Record<string, { l: string; t: 'success' | 'warning' | 'neutral' | 'danger' }> = {
  active: { l: 'فعّالة', t: 'success' }, paused: { l: 'متوقفة مؤقتاً', t: 'warning' }, stopped: { l: 'أوقفتها', t: 'neutral' },
  cancelled: { l: 'أُلغيت (تغيّرت الوصفة)', t: 'danger' }, completed: { l: 'انتهت مدة العلاج', t: 'neutral' },
};

/** Medication plan: approved info, times, end of course, taken/skip/snooze (self-report). */
export function Meds() {
  const { session } = useAuth();
  const toast = useToast();
  const plans = useAsync(async () => (session ? ((await unwrap(supabase.rpc('my_medication_plans'))) as unknown as Plan[]) : []), [session?.user.id]);
  if (!session) return <SignInPrompt title="خطة الدواء" />;
  const act = async (p: PromiseLike<{ error: unknown }>, ok: string) => { const { error } = await p; if (error) toast(errorMessage(error), 'danger'); else { toast(ok, 'success'); plans.reload(); } };

  return (
    <div className="stack">
      <h1 style={{ fontSize: 'var(--f-h2)' }}>خطة الدواء</h1>
      {plans.status === 'loading' && !plans.data && <SkeletonList />}
      {plans.status === 'error' && <ErrorState error={plans.error} onRetry={plans.reload} />}
      {plans.data?.length === 0 && <div className="card"><EmptyState icon={<Pill />} title="لا توجد خطط دواء">تُفعّل التذكيرات من الصيدلية عند الصرف، أو من صفحة الوصفة إذا حصلت على الدواء من مكان آخر.</EmptyState></div>}
      {plans.data?.map((p) => (
        <section key={p.id} className="card stack-sm">
          <div className="row-between"><strong><bdi dir="ltr">{p.display_name}</bdi></strong><Badge tone={statusLabel[p.status].t}>{statusLabel[p.status].l}</Badge></div>
          <span className="small muted">{p.patient_name} · من {formatDate(p.start_date + 'T12:00:00Z')}{p.end_date ? ` حتى ${formatDate(p.end_date + 'T12:00:00Z')}` : ''}</span>
          {p.instructions && <span className="small">التعليمات المعتمدة: {p.instructions}</span>}
          {p.as_needed ? <span className="small">عند اللزوم — بدون جدول ثابت.</span> : <span className="small">الأوقات: {p.times.map((t) => t.slice(0, 5)).join('، ')}</span>}
          {p.doses.length > 0 && (
            <ul className="list" style={{ margin: 0, padding: 0 }}>
              {p.doses.map((d) => (
                <li key={d.id} className="list-item" style={{ paddingInline: 0 }}>
                  <Clock size={16} aria-hidden />
                  <span className="grow num">{formatDate(d.scheduled_at)} — {formatTime(d.scheduled_at)}</span>
                  {d.dose_status === 'taken' ? <Badge tone="success">أخذتها</Badge> : d.dose_status === 'skipped' ? <Badge tone="neutral">تخطيت</Badge> : p.status === 'active' && (
                    <span className="row" style={{ gap: 4 }}>
                      <Button size="sm" variant="accent" icon={<Check size={14} />} onClick={() => act(supabase.rpc('record_dose', { p_job_id: d.id, p_status: 'taken' }), 'سُجلت')}>أخذت</Button>
                      <Button size="sm" variant="ghost" icon={<SkipForward size={14} />} onClick={() => act(supabase.rpc('record_dose', { p_job_id: d.id, p_status: 'skipped' }), 'سُجل التخطي')}>تخطي</Button>
                      {d.snooze_count < 3 && <Button size="sm" variant="ghost" onClick={() => act(supabase.rpc('record_dose', { p_job_id: d.id, p_status: 'snoozed' }), 'سيُذكّرك بعد 15 دقيقة')}>تأجيل</Button>}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {['active', 'paused'].includes(p.status) && (
            <div className="row">
              {p.status === 'active'
                ? <Button size="sm" variant="secondary" icon={<Pause size={14} />} onClick={() => act(supabase.rpc('set_medication_plan_status', { p_plan_id: p.id, p_status: 'paused' }), 'أُوقفت التذكيرات مؤقتاً')}>إيقاف مؤقت</Button>
                : <Button size="sm" variant="secondary" icon={<Play size={14} />} onClick={() => act(supabase.rpc('set_medication_plan_status', { p_plan_id: p.id, p_status: 'active' }), 'استؤنفت التذكيرات')}>استئناف</Button>}
              <Button size="sm" variant="ghost" icon={<Square size={14} />} onClick={() => act(supabase.rpc('set_medication_plan_status', { p_plan_id: p.id, p_status: 'stopped' }), 'أُوقفت التذكيرات')}>إيقاف التذكيرات</Button>
            </div>
          )}
        </section>
      ))}
      <Alert tone="info">إذا فاتتك جرعة فلا تضاعف الجرعة التالية؛ اتبع تعليمات طبيبك أو الصيدلي. تسجيلك للجرعات لا يُعتبر إثباتاً طبياً للالتزام.</Alert>
    </div>
  );
}
