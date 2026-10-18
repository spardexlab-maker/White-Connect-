import { FlaskConical, Pill } from 'lucide-react';
import { EmptyState, PageHead } from '../../components/ui';
import { useWorkspace } from '../../lib/workspace';

/**
 * Pharmacy and laboratory workspaces belong to Phases 3–4. Rather than
 * shipping placeholder buttons or fake inbox data (§26-7), the page states
 * plainly what is not yet available and what already works for this role.
 */
export function PendingModule({ module }: { module: 'pharmacy' | 'lab' }) {
  const { current } = useWorkspace();
  const isPharmacy = module === 'pharmacy';
  return (
    <div className="stack">
      <PageHead title={isPharmacy ? 'وارد الوصفات' : 'طلبات المختبر'} subtitle={current?.facility_name} />
      <div className="card">
        <EmptyState icon={isPharmacy ? <Pill /> : <FlaskConical />} title={isPharmacy ? 'وحدة الصيدلية لم تُفعّل بعد' : 'وحدة المختبر لم تُفعّل بعد'}>
          {isPharmacy
            ? 'استلام الوصفات الإلكترونية والتحضير والصرف والمخزون ضمن المرحلة الرابعة. حسابك وعضويتك وصلاحيات العزل جاهزة ومختبرة.'
            : 'الطلبات والعينات وإدخال النتائج واعتمادها ضمن المرحلة الثالثة. حسابك وعضويتك وصلاحيات العزل جاهزة ومختبرة، وتوجد بالفعل خدمات سحب العينات ومحطة السحب في الجدول.'}
        </EmptyState>
      </div>
    </div>
  );
}
