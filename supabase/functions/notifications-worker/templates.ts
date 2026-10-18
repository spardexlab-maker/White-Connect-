// Generic, lock-screen-safe texts: no medication, diagnosis or other
// patients' names. Details are visible only inside the authenticated app.
export interface Rendered { title: string; body: string; link: string | null }

export function render(template: string, payload: Record<string, unknown>): Rendered {
  const num = typeof payload.booking_number === 'string' ? payload.booking_number : '';
  switch (template) {
    case 'appointment.requested':
      return { title: 'تم استلام طلب الحجز', body: `رقم الحجز ${num} — بانتظار تأكيد العيادة.`, link: '/patient/appointments' };
    case 'appointment.confirmed':
      return { title: 'تم تأكيد موعدك', body: `رقم الحجز ${num}. افتح التطبيق لعرض التفاصيل.`, link: '/patient/appointments' };
    case 'appointment.rejected':
      return { title: 'تعذّر تأكيد طلب الحجز', body: `رقم الحجز ${num}. يمكنك اختيار وقت آخر.`, link: '/patient/appointments' };
    case 'appointment.cancelled':
      return { title: 'تم إلغاء موعد', body: `رقم الحجز ${num}.`, link: '/patient/appointments' };
    case 'appointment.delay':
      return { title: 'تحديث على وقت الانتظار', body: 'هناك تأخير تقديري في العيادة اليوم. افتح التطبيق للتفاصيل.', link: '/patient/appointments' };
    default:
      return { title: 'إشعار جديد', body: 'لديك تحديث في حسابك.', link: null };
  }
}
