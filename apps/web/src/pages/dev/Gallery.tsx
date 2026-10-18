import { useState } from 'react';
import { CalendarPlus, Inbox, Save } from 'lucide-react';
import { appointmentStatus, color, queueStatus, type AppointmentStatus, type QueueStatus } from '@app/shared';
import {
  Alert, AppointmentStatusBadge, Badge, Button, ConfirmDialog, EmptyState, ErrorState, Ltr, PermissionDenied, QueueStatusBadge,
  SelectField, Sheet, SkeletonList, Tabs, TextField, ToastProvider, useToast,
} from '../../components/ui';

/** Living component reference for DESIGN_SYSTEM.md (success / error / loading / disabled states). */
export function ComponentGallery() {
  return <ToastProvider><GalleryInner /></ToastProvider>;
}

function GalleryInner() {
  const toast = useToast();
  const [sheet, setSheet] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [tab, setTab] = useState<'a' | 'b'>('a');
  return (
    <main className="p-main stack" style={{ paddingBlockEnd: 'var(--s-10)' }}>
      <h1>مكتبة المكونات</h1>
      <p className="muted">صفحة مرجعية للمطورين — لا تحتوي بيانات حقيقية.</p>
      <div className="gallery-grid">
        <section className="card stack"><h2 className="section-title">الألوان</h2>
          <div className="row">{Object.entries(color).map(([k, v]) => (
            <div key={k} className="stack-sm" style={{ width: 92, gap: 2 }}>
              <div style={{ height: 36, borderRadius: 8, background: v, border: '1px solid var(--c-border)' }} />
              <span className="small">{k}</span><Ltr className="small muted">{v}</Ltr>
            </div>))}</div>
        </section>
        <section className="card stack"><h2 className="section-title">الأزرار</h2>
          <div className="row"><Button>أساسي</Button><Button variant="accent">تأكيد</Button><Button variant="secondary">ثانوي</Button></div>
          <div className="row"><Button variant="ghost">خفيف</Button><Button variant="danger">خطر</Button><Button disabled>معطّل</Button></div>
          <div className="row"><Button loading>جارٍ الحفظ…</Button><Button size="sm" icon={<Save size={16} />}>صغير</Button></div>
        </section>
        <section className="card stack"><h2 className="section-title">الحقول</h2>
          <TextField label="اسم المريض" required />
          <TextField label="الهاتف" optional ltr hint="يُعرض من اليسار لليمين" defaultValue="07801234567" />
          <TextField label="حقل بخطأ" error="هذا الحقل مطلوب" />
          <SelectField label="القائمة"><option>خيار</option></SelectField>
          <TextField label="معطّل" disabled defaultValue="غير قابل للتعديل" />
        </section>
        <section className="card stack"><h2 className="section-title">حالات المواعيد والطابور</h2>
          <div className="row">{(Object.keys(appointmentStatus) as AppointmentStatus[]).map((s) => <AppointmentStatusBadge key={s} status={s} />)}</div>
          <div className="row">{(Object.keys(queueStatus) as QueueStatus[]).map((s) => <QueueStatusBadge key={s} status={s} />)}</div>
          <div className="row"><Badge tone="accent">تمييز</Badge><Badge tone="info">معلومة</Badge></div>
        </section>
        <section className="card stack"><h2 className="section-title">التنبيهات</h2>
          <Alert tone="info" title="معلومة">نص توضيحي.</Alert>
          <Alert tone="success" title="تم الحفظ">تم تثبيت العملية على الخادم.</Alert>
          <Alert tone="warning" title="تنبيه">الوقت قريب من نهاية المهلة.</Alert>
          <Alert tone="danger" title="فشل">هذا الوقت لم يعد متاحاً.</Alert>
        </section>
        <section className="card card-flush"><div className="card-header"><h2>التحميل / فارغ / خطأ / ممنوع</h2></div>
          <SkeletonList rows={2} />
          <EmptyState icon={<Inbox />} title="لا توجد عناصر" action={<Button size="sm" icon={<CalendarPlus size={16} />}>إضافة</Button>}>اشرح الخطوة التالية هنا.</EmptyState>
          <ErrorState error={{ message: 'app:slot_unavailable' }} onRetry={() => toast('إعادة المحاولة')} />
          <PermissionDenied />
        </section>
        <section className="card stack"><h2 className="section-title">تبويب / لوحة / حوار / إشعار</h2>
          <Tabs label="مثال" value={tab} onChange={setTab} tabs={[{ id: 'a', label: 'الأول' }, { id: 'b', label: 'الثاني' }]} />
          <div className="row">
            <Button variant="secondary" onClick={() => setSheet(true)}>لوحة جانبية</Button>
            <Button variant="secondary" onClick={() => setDialog(true)}>حوار تأكيد</Button>
            <Button variant="secondary" onClick={() => toast('تم الحفظ', 'success')}>إشعار</Button>
          </div>
        </section>
      </div>
      <Sheet open={sheet} onClose={() => setSheet(false)} title="لوحة جانبية" footer={<Button block>حفظ</Button>}><p>محتوى اللوحة.</p></Sheet>
      <ConfirmDialog open={dialog} title="إلغاء الموعد؟" confirmLabel="تأكيد الإلغاء" tone="danger" onCancel={() => setDialog(false)} onConfirm={() => setDialog(false)}>
        يوضح الحوار أثر الإجراء قبل تنفيذه.
      </ConfirmDialog>
    </main>
  );
}
