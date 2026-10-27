import { useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, CircleDollarSign, Clock, CreditCard, Pencil, XCircle } from 'lucide-react';
import { errorMessage, facilityTypeLabel, type FacilityType } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { Alert, Badge, Button, EmptyState, ErrorState, PageHead, SelectField, Sheet, SkeletonList, TextField, TextareaField, useToast } from '../../components/ui';

export type SubState = 'none' | 'active' | 'expiring' | 'expired' | 'unpaid';
type Plan = 'trial' | 'monthly' | 'yearly' | 'custom';
interface Item {
  organization_id: string; name: string; kind: 'medical_complex' | 'independent'; status: string;
  facilities: number; facility_types: FacilityType[];
  plan: Plan | null; starts_on: string | null; ends_on: string | null; paid: boolean | null;
  amount_iqd: number | null; note: string | null; updated_at: string | null; days_left: number | null; state: SubState;
}
interface Data { today: string; notice_days: number; items: Item[] }

const PLAN_LABEL: Record<Plan, string> = { trial: 'فترة مجانية', monthly: 'شهري', yearly: 'سنوي', custom: 'خاص' };
const PLAN_MONTHS: Record<Plan, number> = { trial: 3, monthly: 1, yearly: 12, custom: 1 };
const STATE: Record<SubState, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral'; icon: JSX.Element }> = {
  active: { label: 'فعّال', tone: 'success', icon: <CheckCircle2 size={14} aria-hidden /> },
  expiring: { label: 'يخلص قريباً', tone: 'warning', icon: <Clock size={14} aria-hidden /> },
  unpaid: { label: 'غير مدفوع', tone: 'warning', icon: <CircleDollarSign size={14} aria-hidden /> },
  expired: { label: 'منتهي', tone: 'danger', icon: <XCircle size={14} aria-hidden /> },
  none: { label: 'بلا اشتراك', tone: 'neutral', icon: <AlertTriangle size={14} aria-hidden /> },
};
type Filter = 'all' | 'attention' | SubState;

const formatNumber = (n: number) => n.toLocaleString('en-US');
const dayWord = (n: number) => (n >= 3 && n <= 10 ? 'أيام' : 'يوم');
const fmtDay = (d: string) => new Intl.DateTimeFormat('ar-IQ', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`));
const addMonths = (d: string, n: number) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCMonth(x.getUTCMonth() + n); return x.toISOString().slice(0, 10); };

function daysText(it: Item) {
  if (it.days_left == null) return '—';
  if (it.days_left < 0) return `منتهي من ${formatNumber(-it.days_left)} ${dayWord(-it.days_left)}`;
  if (it.days_left === 0) return 'يخلص اليوم';
  return `باقي ${formatNumber(it.days_left)} ${dayWord(it.days_left)}`;
}

/** Every complex / independent facility: plan, end date, paid or not. Staff get a reminder banner; nothing is switched off. */
export function AdminSubscriptions() {
  const data = useAsync(async () => (await unwrap(supabase.rpc('admin_subscriptions'))) as unknown as Data, []);
  const [filter, setFilter] = useState<Filter>('all');
  const [edit, setEdit] = useState<Item | null>(null);
  const d = data.data;
  const count = (s: SubState) => d?.items.filter((i) => i.state === s).length ?? 0;
  const items = (d?.items ?? []).filter((i) => filter === 'all' || (filter === 'attention' ? i.state !== 'active' : i.state === filter));

  return (
    <div className="stack">
      <PageHead title="اشتراكات الجهات" subtitle="الباقة، ومتى يخلص الاشتراك، ومدفوع لو لا — لكل مجمع أو جهة مستقلة" />
      {data.status === 'loading' && !d && <SkeletonList />}
      {data.status === 'error' && <ErrorState error={data.error} onRetry={data.reload} />}
      {d && (
        <>
          <div className="kpi-strip">
            <button className="kpi kpi-btn" onClick={() => setFilter('active')} aria-pressed={filter === 'active'}><CheckCircle2 size={22} aria-hidden /><div><div className="kpi-v num">{count('active')}</div><div className="kpi-l">فعّال</div></div></button>
            <button className="kpi kpi-btn" onClick={() => setFilter('expiring')} aria-pressed={filter === 'expiring'}><Clock size={22} aria-hidden /><div><div className="kpi-v num">{count('expiring')}</div><div className="kpi-l">يخلص خلال {formatNumber(d.notice_days)} {dayWord(d.notice_days)}</div></div></button>
            <button className="kpi kpi-btn" onClick={() => setFilter('unpaid')} aria-pressed={filter === 'unpaid'}><CircleDollarSign size={22} aria-hidden /><div><div className="kpi-v num">{count('unpaid')}</div><div className="kpi-l">غير مدفوع</div></div></button>
            <button className="kpi kpi-btn" onClick={() => setFilter('expired')} aria-pressed={filter === 'expired'}><XCircle size={22} aria-hidden /><div><div className="kpi-v num">{count('expired')}</div><div className="kpi-l">منتهي</div></div></button>
            <button className="kpi kpi-btn" onClick={() => setFilter('none')} aria-pressed={filter === 'none'}><AlertTriangle size={22} aria-hidden /><div><div className="kpi-v num">{count('none')}</div><div className="kpi-l">بلا اشتراك</div></div></button>
          </div>
          <Alert tone="info" title="شلون يشتغل التنبيه">
            قبل نهاية الاشتراك بـ {formatNumber(d.notice_days)} {dayWord(d.notice_days)} يطلع لموظفي الجهة شريط أصفر بمساحة العمل. إذا خلص أو ما مدفوع يصير الشريط أحمر «اشتراككم منتهي، تواصلوا ويانا».
            ما ينطفي شي — يكدرون يشتغلون عادي. الفترة المجانية ما تحتاج دفع.
          </Alert>

          <section className="card card-flush">
            <div className="card-header row-between" style={{ flexWrap: 'wrap', gap: 'var(--s-2)' }}>
              <h2 className="row" style={{ gap: 8 }}><CreditCard size={20} aria-hidden />الجهات ({formatNumber(items.length)})</h2>
              <div style={{ minWidth: 200 }}>
                <SelectField label="عرض" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
                  <option value="all">الكل</option>
                  <option value="attention">تحتاج متابعة</option>
                  {(Object.keys(STATE) as SubState[]).map((s) => <option key={s} value={s}>{STATE[s].label}</option>)}
                </SelectField>
              </div>
            </div>
            {items.length === 0 ? (
              <EmptyState icon={<CreditCard />} title={d.items.length ? 'ماكو جهات بهذا الفلتر' : 'ماكو جهات بعد'}>{d.items.length ? 'اختار «الكل» حتى تشوف كل الجهات.' : 'أضف مجمع أو جهة من «المجمعات والجهات».'}</EmptyState>
            ) : (
              <div className="table-wrap" role="region" aria-label="اشتراكات الجهات" tabIndex={0}>
                <table className="table">
                  <thead><tr><th>الجهة</th><th>الباقة</th><th>ينتهي</th><th>الدفع</th><th>الحالة</th><th><span className="sr-only">تعديل</span></th></tr></thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.organization_id}>
                        <td>
                          <strong>{it.name}</strong>
                          <div className="small muted">{it.kind === 'independent' ? 'جهة مستقلة' : `مجمع · ${formatNumber(it.facilities)} جهات`}{it.facility_types.length ? ` · ${it.facility_types.map((t) => facilityTypeLabel[t]).join('، ')}` : ''}</div>
                        </td>
                        <td>{it.plan ? PLAN_LABEL[it.plan] : '—'}{it.amount_iqd ? <div className="small muted num">{formatNumber(it.amount_iqd)} د.ع</div> : null}</td>
                        <td>{it.ends_on ? <>{fmtDay(it.ends_on)}<div className="small muted">{daysText(it)}</div></> : '—'}</td>
                        <td>{it.plan == null ? '—' : it.plan === 'trial' ? <span className="small muted">ما يحتاج</span> : it.paid ? <Badge tone="success">مدفوع</Badge> : <Badge tone="warning">غير مدفوع</Badge>}</td>
                        <td><Badge tone={STATE[it.state].tone} icon={STATE[it.state].icon}>{STATE[it.state].label}</Badge></td>
                        <td><Button size="sm" variant="secondary" icon={<Pencil size={14} aria-hidden />} onClick={() => setEdit(it)}>{it.plan ? 'تعديل' : 'إضافة'}</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <NoticeDays days={d.notice_days} onSaved={data.reload} />
        </>
      )}
      {edit && d && <EditSheet item={edit} today={d.today} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); data.reload(); }} />}
    </div>
  );
}

function EditSheet({ item, today, onClose, onSaved }: { item: Item; today: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [plan, setPlan] = useState<Plan>(item.plan ?? 'trial');
  const [starts, setStarts] = useState(item.starts_on ?? today);
  const [ends, setEnds] = useState(item.ends_on ?? addMonths(today, PLAN_MONTHS.trial));
  const [paid, setPaid] = useState(item.paid ?? false);
  const [amount, setAmount] = useState(item.amount_iqd != null ? String(item.amount_iqd) : '');
  const [note, setNote] = useState(item.note ?? '');
  const [busy, setBusy] = useState(false);
  const badDates = !starts || !ends || ends < starts;
  const badAmount = amount.trim() !== '' && !/^\d+$/.test(amount.replace(/[,،\s]/g, ''));

  const pickPlan = (p: Plan) => { setPlan(p); if (p !== 'custom') setEnds(addMonths(starts, PLAN_MONTHS[p])); if (p === 'trial') setPaid(false); };
  // renew: the new period starts where the old one ends (or today if it already ended)
  const renew = () => {
    const from = item.ends_on && item.ends_on >= today ? item.ends_on : today;
    const p = plan === 'trial' ? 'monthly' : plan;
    setPlan(p); setStarts(from); setEnds(addMonths(from, PLAN_MONTHS[p])); setPaid(false);
  };

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('admin_set_subscription', {
      p_organization_id: item.organization_id, p_plan: plan, p_starts_on: starts, p_ends_on: ends, p_paid: plan === 'trial' ? false : paid,
      p_amount_iqd: amount.trim() ? Number(amount.replace(/[,،\s]/g, '')) : undefined, p_note: note.trim() || undefined,
    });
    setBusy(false);
    if (error) { toast(errorMessage(error), 'danger'); return; }
    toast(`انحفظ اشتراك ${item.name}`, 'success');
    onSaved();
  };

  return (
    <Sheet open onClose={onClose} title={`اشتراك: ${item.name}`}
           footer={<><Button variant="ghost" onClick={onClose}>إلغاء</Button><Button loading={busy} disabled={badDates || badAmount} onClick={() => void save()}>حفظ</Button></>}>
      <div className="stack">
        {item.plan && <div><Button size="sm" variant="secondary" icon={<CalendarClock size={14} aria-hidden />} onClick={renew}>تجديد لفترة جديدة</Button></div>}
        <SelectField label="الباقة" value={plan} onChange={(e) => pickPlan(e.target.value as Plan)}>
          {(Object.keys(PLAN_LABEL) as Plan[]).map((p) => <option key={p} value={p}>{PLAN_LABEL[p]}{p === 'trial' ? ' (٣ أشهر)' : p === 'monthly' ? ' (شهر)' : p === 'yearly' ? ' (سنة)' : ''}</option>)}
        </SelectField>
        <div className="two-col">
          <TextField label="يبدي من" type="date" ltr value={starts} onChange={(e) => { setStarts(e.target.value); if (plan !== 'custom' && e.target.value) setEnds(addMonths(e.target.value, PLAN_MONTHS[plan])); }} />
          <TextField label="ينتهي بتاريخ" type="date" ltr value={ends} onChange={(e) => setEnds(e.target.value)} error={badDates ? 'تاريخ النهاية لازم يكون بعد البداية' : undefined} />
        </div>
        {plan !== 'trial' && (
          <>
            <label className="check"><input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} /> <span>استلمنا المبلغ (مدفوع)</span></label>
            <TextField label="المبلغ (دينار)" optional inputMode="numeric" ltr value={amount} onChange={(e) => setAmount(e.target.value)} error={badAmount ? 'أرقام بس' : undefined} />
          </>
        )}
        <TextareaField label="ملاحظة" optional maxLength={300} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثلاً: دفع نقداً لعلي — وصل رقم 12" />
        <p className="small muted">الملاحظة والمبلغ يشوفهن بس مدير المنصة. الجهة تشوف الحالة والتاريخ بس.</p>
      </div>
    </Sheet>
  );
}

function NoticeDays({ days, onSaved }: { days: number; onSaved: () => void }) {
  const toast = useToast();
  const [v, setV] = useState(String(days));
  const [busy, setBusy] = useState(false);
  const n = Number(v);
  const bad = !Number.isInteger(n) || n < 1 || n > 60;
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('admin_set_subscription_notice_days', { p_days: n });
    setBusy(false);
    toast(error ? errorMessage(error) : 'انحفظ', error ? 'danger' : 'success');
    if (!error) onSaved();
  };
  return (
    <section className="card row" style={{ gap: 'var(--s-3)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <div style={{ maxWidth: 260 }}>
        <TextField label="التنبيه يبدي قبل النهاية بكم يوم؟" inputMode="numeric" ltr value={v} onChange={(e) => setV(e.target.value.replace(/\D/g, ''))} error={bad ? 'من ١ إلى ٦٠' : undefined} />
      </div>
      <Button variant="secondary" loading={busy} disabled={bad || n === days} onClick={() => void save()}>حفظ</Button>
    </section>
  );
}
