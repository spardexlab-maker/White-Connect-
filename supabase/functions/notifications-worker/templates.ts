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
    case 'medication.reminder':
      return { title: 'تذكير', body: 'حان موعد جرعتك حسب خطتك. افتح التطبيق للتفاصيل.', link: '/patient/meds' };
    case 'prescription.approved':
      return { title: 'وصفة جديدة', body: 'أصدر طبيبك وصفة معتمدة. افتح التطبيق لعرضها.', link: '/patient/journey' };
    case 'prescription.cancelled':
      return { title: 'تحديث على وصفة', body: 'أُلغيت إحدى وصفاتك. افتح التطبيق للتفاصيل.', link: '/patient/journey' };
    case 'prescription.dispensed':
      return { title: 'تم الصرف', body: 'سُجل صرف من الصيدلية. افتح التطبيق للتفاصيل.', link: '/patient/journey' };
    case 'prescription.clarification':
      return { title: 'طلب توضيح من صيدلية', body: 'تطلب صيدلية توضيحاً على وصفة أصدرتها.', link: '/workspace/doctor' };
    case 'lab.released':
      return { title: 'نتائج جاهزة', body: 'اعتُمدت نتائج تحاليل. افتح التطبيق لعرضها.', link: '/patient/journey' };
    case 'lab.corrected':
      return { title: 'تصحيح نتيجة', body: 'صحّح المختبر نتيجة سابقة. افتح التطبيق للتفاصيل.', link: '/patient/journey' };
    case 'lab.released_for_doctor':
    case 'lab.corrected_for_doctor':
      return { title: 'نتيجة تحتاج مراجعة', body: 'لديك نتيجة تحليل معتمدة بانتظار المراجعة.', link: '/workspace/doctor' };
    default:
      return { title: 'إشعار جديد', body: 'لديك تحديث في حسابك.', link: null };
  }
}
