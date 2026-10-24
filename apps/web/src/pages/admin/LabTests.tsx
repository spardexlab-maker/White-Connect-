import { useMemo, useState } from 'react';
import { FlaskConical, Plus } from 'lucide-react';
import { errorMessage } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { Badge, Button, EmptyState, ErrorState, Ltr, PageHead, Sheet, SkeletonList, TextField, useToast } from '../../components/ui';

interface Test { id: string; code: string; name_ar: string; name_en: string | null; category: string | null; specimen_type: string | null;
  unit: string | null; reference_range: string | null; sort_order: number; is_active: boolean }
const blank = { code: '', name_ar: '', name_en: '', category: '', specimen_type: '', unit: '', reference_range: '', sort_order: '100', is_active: true };
type Form = typeof blank & { id?: string };

/** «دليل التحاليل»: the platform-wide test names, units and normal ranges that doctors order from and patients' entries are compared to. */
export function AdminLabTests() {
  const toast = useToast();
  const list = useAsync(async () => ((await unwrap(supabase.from('lab_test_master').select('*').order('sort_order').order('name_ar'))) ?? []) as Test[], []);
  const [q, setQ] = useState('');
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const groups = useMemo(() => {
    const by = new Map<string, Test[]>();
    (list.data ?? []).filter((t) => !q.trim() || `${t.name_ar} ${t.name_en ?? ''} ${t.code}`.toLowerCase().includes(q.trim().toLowerCase()))
      .forEach((t) => by.set(t.category ?? 'أخرى', [...(by.get(t.category ?? 'أخرى') ?? []), t]));
    return [...by.entries()];
  }, [list.data, q]);
  const save = async () => {
    if (!form) return;
    setBusy(true);
    const { error } = await supabase.rpc('upsert_lab_test_master', { p: { ...form, sort_order: Number(form.sort_order) || 100 } });
    setBusy(false);
    if (error) { toast(errorMessage(error), 'danger'); return; }
    toast('حُفظ التحليل', 'success'); setForm(null); list.reload();
  };
  const edit = (t: Test) => setForm({ id: t.id, code: t.code, name_ar: t.name_ar, name_en: t.name_en ?? '', category: t.category ?? '', specimen_type: t.specimen_type ?? '',
    unit: t.unit ?? '', reference_range: t.reference_range ?? '', sort_order: String(t.sort_order), is_active: t.is_active });
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(form && { ...form, [k]: e.target.value });
  return (
    <div className="stack">
      <PageHead title="دليل التحاليل" subtitle="أسماء التحاليل ووحداتها ومجالاتها الطبيعية — منها يطلب الطبيب، وعليها تُقارن النتائج التي يدخلها المريض."
                actions={<Button icon={<Plus size={18} />} onClick={() => setForm({ ...blank })}>تحليل جديد</Button>} />
      <TextField label="بحث" value={q} onChange={(e) => setQ(e.target.value)} placeholder="الاسم أو الرمز" />
      {list.status === 'loading' && !list.data && <SkeletonList />}
      {list.status === 'error' && <ErrorState error={list.error} onRetry={list.reload} />}
      {list.data && groups.length === 0 && <div className="card"><EmptyState icon={<FlaskConical />} title="لا توجد تحاليل" /></div>}
      {groups.map(([cat, tests]) => (
        <section key={cat} className="card card-flush">
          <h3 className="section-title" style={{ padding: 'var(--s-3) var(--s-4) 0' }}>{cat}</h3>
          <table className="table">
            <thead><tr><th>التحليل</th><th>الرمز</th><th>الوحدة</th><th>المجال الطبيعي</th><th /></tr></thead>
            <tbody>
              {tests.map((t) => (
                <tr key={t.id}>
                  <td>{t.name_ar}{t.name_en ? <span className="small muted"> · <Ltr>{t.name_en}</Ltr></span> : null} {!t.is_active && <Badge tone="neutral">موقوف</Badge>}</td>
                  <td><Ltr>{t.code}</Ltr></td>
                  <td><Ltr>{t.unit ?? '—'}</Ltr></td>
                  <td><Ltr>{t.reference_range ?? '—'}</Ltr></td>
                  <td><Button size="sm" variant="ghost" onClick={() => edit(t)}>تعديل</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      <Sheet open={!!form} onClose={() => setForm(null)} title={form?.id ? 'تعديل تحليل' : 'تحليل جديد'}>
        {form && (
          <div className="stack-sm">
            <TextField label="الاسم بالعربي" value={form.name_ar} onChange={set('name_ar')} />
            <TextField label="الاسم بالإنكليزي" optional ltr value={form.name_en} onChange={set('name_en')} />
            <TextField label="الرمز" ltr hint="حروف إنكليزية وأرقام، مثل FBS أو HBA1C" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            <TextField label="التصنيف" optional placeholder="سكر، دهون، كلى…" value={form.category} onChange={set('category')} />
            <TextField label="نوع العينة" optional placeholder="دم، إدرار…" value={form.specimen_type} onChange={set('specimen_type')} />
            <TextField label="الوحدة" optional ltr placeholder="mg/dL" value={form.unit} onChange={set('unit')} />
            <TextField label="المجال الطبيعي" optional ltr placeholder="70-100 أو < 200" hint="يُستعمل لتلوين النتيجة: مرتفع / طبيعي / منخفض" value={form.reference_range} onChange={set('reference_range')} />
            <TextField label="الترتيب" optional ltr inputMode="numeric" value={form.sort_order} onChange={set('sort_order')} />
            <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> فعّال (يظهر للأطباء)</label>
            <Button loading={busy} disabled={form.name_ar.trim().length < 2 || !/^[A-Z0-9_]{1,20}$/.test(form.code.trim())} onClick={() => void save()}>حفظ</Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
