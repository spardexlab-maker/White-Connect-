import { useState } from 'react';
import { Pill, Stethoscope } from 'lucide-react';
import { formatDate, formatDateTime } from '@app/shared';
import { supabase } from '../../lib/supabase';
import { unwrap, useAsync } from '../../lib/useAsync';
import { Alert, Badge, EmptyState, ErrorState, Ltr, Sheet, SkeletonList, Tabs } from '../ui';
import { HealthSummary, LabTrends, useHealth } from './HealthSummary';

interface Visit {
  encounter_id: string; started_at: string; status: string; facility: string; doctor: string; specialty: string | null;
  reason_for_visit: string | null; assessment: string | null; plan: string | null; follow_up: string | null;
  vitals: Record<string, number | string> | null; signed_at: string | null;
}
interface Lab {
  test: string; value_text: string | null; value_numeric: number | null; unit: string | null; reference_range: string | null;
  lab_flag: string | null; notes: string | null; released_at: string; lab: string; ordered_by: string | null;
}
interface Rx {
  prescription_id: string; rx_number: string; approved_at: string; doctor: string; facility: string;
  items: { name: string; dose: number | null; dose_unit: string | null; frequency: string | null; duration_days: number | null; instructions: string | null }[] | null;
}
export interface MedicalCardData {
  patient: { id: string; public_code: string; full_name: string; sex: string | null; birth_year: number | null };
  allergies_recorded: boolean; allergies: { substance: string; reaction: string | null; severity: string | null }[];
  visits: Visit[]; labs: Lab[]; prescriptions: Rx[];
}

const vitalLabels: Record<string, string> = { bp_sys: 'ضغط انقباضي', bp_dia: 'ضغط انبساطي', pulse: 'النبض', temp_c: 'الحرارة', spo2: 'الأوكسجين', weight_kg: 'الوزن', height_cm: 'الطول' };

/**
 * The patient's medical card as seen by a treating doctor: visits (signed
 * notes only), released lab results and approved prescriptions from every
 * doctor. Shown as recorded — no interpretation. Each opening is audited.
 */
export function MedicalCard({ patientId, excludeEncounterId }: { patientId: string; excludeEncounterId?: string }) {
  const card = useAsync(async () => (await unwrap(supabase.rpc('patient_medical_card', { p_patient_id: patientId }))) as unknown as MedicalCardData, [patientId]);
  const health = useHealth(patientId);
  const [tab, setTab] = useState<'health' | 'visits' | 'labs' | 'rx'>('health');
  if (card.status === 'loading' && !card.data) return <SkeletonList rows={4} />;
  if (card.status === 'error') return <ErrorState error={card.error} onRetry={card.reload} />;
  const c = card.data!;
  const visits = c.visits.filter((v) => v.encounter_id !== excludeEncounterId);
  return (
    <div className="stack medical-card">
      <div className="row-between">
        <div>
          <strong style={{ fontSize: 'var(--f-h3)' }}>{c.patient.full_name}</strong>
          <div className="small muted"><Ltr>{c.patient.public_code}</Ltr>{c.patient.birth_year ? ` · مواليد ${c.patient.birth_year}` : ''}{c.patient.sex === 'male' ? ' · ذكر' : c.patient.sex === 'female' ? ' · أنثى' : ''}</div>
        </div>
        <div className="row" style={{ gap: 'var(--s-2)' }}>
          <Badge tone="neutral">{visits.length} زيارة</Badge><Badge tone="neutral">{c.labs.length} نتيجة</Badge><Badge tone="neutral">{c.prescriptions.length} وصفة</Badge>
        </div>
      </div>
      {c.allergies.length > 0
        ? <Alert tone="danger" title="حساسية موثّقة">{c.allergies.map((a) => `${a.substance}${a.reaction ? ` (${a.reaction})` : ''}`).join('، ')}</Alert>
        : <p className="small muted">{c.allergies_recorded ? 'لا توجد حساسية فعّالة موثّقة.' : 'لم تُسجَّل معلومات حساسية — هذا لا يعني عدم وجودها.'}</p>}
      <Tabs label="البطاقة الطبية" value={tab} onChange={setTab}
            tabs={[{ id: 'health', label: 'الملف الصحي' }, { id: 'visits', label: `الزيارات (${visits.length})` }, { id: 'labs', label: `الفحوصات (${c.labs.length})` }, { id: 'rx', label: `الوصفات (${c.prescriptions.length})` }]} />

      {tab === 'health' && (health.data ? <HealthSummary h={health.data} /> : health.status === 'error' ? <ErrorState error={health.error} onRetry={health.reload} /> : <SkeletonList rows={3} />)}

      {tab === 'visits' && (visits.length === 0
        ? <EmptyState icon={<Stethoscope />} title="لا توجد زيارات سابقة" />
        : <ol className="timeline">
            {visits.map((v) => (
              <li key={v.encounter_id}>
                <span className="dot" aria-hidden />
                <div className="label-text">{formatDateTime(v.started_at)} · {v.doctor}{v.specialty ? ` (${v.specialty})` : ''} · {v.facility}</div>
                <div className="card stack-sm" style={{ padding: 'var(--s-3)' }}>
                  {!v.signed_at && <p className="small muted">لا توجد ملاحظة معتمدة لهذه الزيارة.</p>}
                  {v.reason_for_visit && <p className="small"><strong>سبب الزيارة:</strong> {v.reason_for_visit}</p>}
                  {v.assessment && <p className="small"><strong>التقييم:</strong> {v.assessment}</p>}
                  {v.plan && <p className="small"><strong>الخطة:</strong> {v.plan}</p>}
                  {v.follow_up && <p className="small"><strong>المتابعة:</strong> {v.follow_up}</p>}
                  {v.vitals && Object.keys(v.vitals).length > 0 && (
                    <p className="small muted">{Object.entries(v.vitals).filter(([, x]) => x !== '' && x != null).map(([k, x]) => `${vitalLabels[k] ?? k}: ${x}`).join(' · ')}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>)}

      {tab === 'labs' && (health.data ? <LabTrends trends={health.data.lab_trends} linkBase="/workspace/doctor/lab/" /> : <SkeletonList rows={3} />)}

      {tab === 'rx' && (c.prescriptions.length === 0
        ? <EmptyState icon={<Pill />} title="لا توجد وصفات معتمدة" />
        : <div className="stack-sm">
            {c.prescriptions.map((r) => (
              <div key={r.prescription_id} className="card stack-sm" style={{ padding: 'var(--s-3)' }}>
                <div className="row-between"><strong>وصفة <Ltr>{r.rx_number}</Ltr></strong><span className="small muted">{formatDate(r.approved_at)} · {r.doctor} · {r.facility}</span></div>
                <ul className="small" style={{ margin: 0, paddingInlineStart: 'var(--s-5)' }}>
                  {r.items?.map((it, i) => (
                    <li key={i}><bdi dir="ltr" style={{ fontWeight: 600 }}>{it.name}</bdi>
                      {[it.dose != null ? `${Number(it.dose)} ${it.dose_unit ?? ''}` : null, it.frequency, it.duration_days ? `${it.duration_days} يوم` : null].filter(Boolean).map((x) => ` · ${x}`).join('')}
                      {it.instructions ? <span className="muted"> — {it.instructions}</span> : null}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>)}
      <p className="small muted">تُعرض البيانات كما سجّلها الأطباء والمختبرات دون أي تفسير آلي. كل فتح لهذه البطاقة يُسجَّل في سجل التدقيق.</p>
    </div>
  );
}

export function MedicalCardSheet({ patientId, onClose }: { patientId: string | null; onClose: () => void }) {
  if (!patientId) return null;
  return <Sheet open size="lg" onClose={onClose} title="البطاقة الطبية"><MedicalCard patientId={patientId} /></Sheet>;
}
