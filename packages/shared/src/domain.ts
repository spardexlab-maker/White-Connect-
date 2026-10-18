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
  lab_technician: 'فني مختبر',
  lab_approver: 'معتمد نتائج',
  facility_admin: 'مدير منشأة',
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
