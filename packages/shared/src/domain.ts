import type { Database } from './database.types';

type Enums = Database['public']['Enums'];
export type AppointmentStatus = Enums['appointment_status'];
export type MemberRole = Enums['member_role'];
export type FacilityType = Enums['facility_type'];
export type QueueStatus = Enums['queue_status'];
export type BookingSource = Enums['booking_source'];

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent';

/** One label + tone per status, used by every screen (consistent naming, §26-6). */
export const appointmentStatus: Record<AppointmentStatus, { label: string; tone: Tone }> = {
  awaiting_confirmation: { label: 'بانتظار التأكيد', tone: 'warning' },
  confirmed: { label: 'مؤكد', tone: 'success' },
  checked_in: { label: 'حاضر', tone: 'info' },
  fulfilled: { label: 'تمت الزيارة', tone: 'neutral' },
  cancelled: { label: 'ملغى', tone: 'neutral' },
  rejected: { label: 'مرفوض', tone: 'danger' },
  no_show: { label: 'لم يحضر', tone: 'danger' },
  expired: { label: 'انتهت مهلة التأكيد', tone: 'neutral' },
};

export const queueStatus: Record<QueueStatus, { label: string; tone: Tone }> = {
  waiting: { label: 'ينتظر', tone: 'warning' },
  called: { label: 'تم النداء', tone: 'info' },
  in_session: { label: 'داخل الجلسة', tone: 'accent' },
  done: { label: 'انتهى', tone: 'neutral' },
  left: { label: 'غادر', tone: 'neutral' },
  cancelled: { label: 'ملغى', tone: 'neutral' },
};

export const bookingSource: Record<BookingSource, string> = {
  app: 'تطبيق',
  web: 'ويب',
  reception: 'استقبال',
};

export const roleLabel: Record<MemberRole, string> = {
  doctor: 'طبيب',
  receptionist: 'سكرتير',
  pharmacist: 'صيدلاني',
  pharmacy_staff: 'موظف صيدلية',
  lab_technician: 'موظف المختبر',
  lab_approver: 'معتمد نتائج',
  facility_admin: 'مدير منشأة (ملغى)',
  organization_admin: 'مدير مجمع',
};

export const facilityTypeLabel: Record<FacilityType, string> = {
  clinic: 'عيادة',
  pharmacy: 'صيدلية',
  laboratory: 'مختبر',
};

/** Which professional area a membership opens (routes are organizational only — the server authorizes). */
export function workspaceArea(role: MemberRole): 'doctor' | 'reception' | 'pharmacy' | 'lab' | 'organization' {
  switch (role) {
    case 'doctor': return 'doctor';
    case 'receptionist': return 'reception';
    case 'pharmacist':
    case 'pharmacy_staff': return 'pharmacy';
    case 'lab_technician':
    case 'lab_approver': return 'lab';
    default: return 'organization';
  }
}

export const weekdayLabel = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export type EncounterStatus = Enums['encounter_status'];
export type LabStatus = Enums['lab_status'];
export type RxStatus = Enums['rx_status'];

export const encounterStatus: Record<EncounterStatus, { label: string; tone: Tone }> = {
  not_started: { label: 'لم تبدأ', tone: 'neutral' },
  in_progress: { label: 'جارية', tone: 'accent' },
  awaiting_results: { label: 'بانتظار النتائج', tone: 'warning' },
  ready_for_review: { label: 'جاهزة للمراجعة', tone: 'info' },
  completed: { label: 'مكتملة', tone: 'success' },
  closed: { label: 'مغلقة', tone: 'neutral' },
};

export const labStatus: Record<LabStatus, { label: string; tone: Tone }> = {
  ordered: { label: 'مطلوب', tone: 'neutral' },
  scheduled: { label: 'مجدول', tone: 'info' },
  checked_in: { label: 'حضر', tone: 'info' },
  sample_collected: { label: 'سُحبت العينة', tone: 'accent' },
  processing: { label: 'قيد المعالجة / جزئي', tone: 'warning' },
  pending_review: { label: 'بانتظار الاعتماد', tone: 'warning' },
  released: { label: 'معتمد ومنشور', tone: 'success' },
  cancelled: { label: 'ملغى', tone: 'neutral' },
  sample_rejected: { label: 'عينة مرفوضة — يلزم سحب جديد', tone: 'danger' },
};
/** what the patient sees: no lab workflow words — the result is simply ready or not yet */
export const patientLabStatus: Record<LabStatus, { label: string; tone: Tone }> = {
  ...labStatus,
  processing: { label: 'قيد التحضير', tone: 'warning' },
  pending_review: { label: 'قيد التحضير', tone: 'warning' },
  released: { label: 'النتيجة جاهزة', tone: 'success' },
};

export const rxDispatchStatus: Record<string, { label: string; tone: Tone }> = {
  sent: { label: 'جديدة', tone: 'info' },
  received: { label: 'مستلمة', tone: 'accent' },
  preparing: { label: 'قيد التحضير', tone: 'warning' },
  ready: { label: 'جاهزة', tone: 'success' },
  partially_dispensed: { label: 'مصروفة جزئياً', tone: 'warning' },
  dispensed: { label: 'مصروفة', tone: 'success' },
  not_available: { label: 'غير متوفرة', tone: 'danger' },
  cancelled: { label: 'ملغاة', tone: 'neutral' },
};

export const labFlag: Record<string, string> = { low: 'منخفض', high: 'مرتفع', abnormal: 'غير طبيعي', critical: 'حرج' };
