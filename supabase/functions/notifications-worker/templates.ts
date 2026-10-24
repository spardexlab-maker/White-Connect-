// Generic, lock-screen-safe texts: no medication, diagnosis or other
// patients' names. Details are visible only inside the authenticated app.
export interface Rendered { title: string; body: string; link: string | null }

export function render(template: string, payload: Record<string, unknown>): Rendered {
  const num = typeof payload.booking_number === 'string' ? payload.booking_number : '';
  const req = typeof payload.request_number === 'string' ? payload.request_number : '';
  const when = typeof payload.starts_at === 'string' ? baghdad(payload.starts_at) : '';
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
    case 'appointment.followup':
      return { title: 'موعد مراجعة جديد', body: `حدّد طبيبك موعد مراجعتك${when ? ` ${when}` : ''}. رقم الحجز ${num}.`, link: '/patient/appointments' };
    case 'appointment.reminder_day':
      return { title: 'تذكير بموعدك غداً', body: `موعدك${when ? ` ${when}` : ''}. رقم الحجز ${num}.`, link: '/patient/appointments' };
    case 'appointment.reminder_soon':
      return { title: 'موعدك بعد قليل', body: `موعدك${when ? ` ${when}` : ''} — رقم الحجز ${num}.`, link: '/patient/appointments' };
    case 'homelab.new':
      return { title: 'طلب سحب منزلي جديد', body: `طلب ${req} — افتح «السحب المنزلي» لتحديد الموعد.`, link: '/workspace/lab/home' };
    case 'homelab.cancelled':
      return { title: 'أُلغي طلب سحب منزلي', body: `ألغى المريض الطلب ${req}.`, link: '/workspace/lab/home' };
    case 'homelab.scheduled':
      return { title: 'تحدد موعد السحب المنزلي', body: `يزورك المختبر${when ? ` ${when}` : ''}. طلب ${req}.`, link: '/patient/home-lab' };
    case 'homelab.on_the_way':
      return { title: 'المختص بالطريق إليك', body: `طلب السحب المنزلي ${req}.`, link: '/patient/home-lab' };
    case 'homelab.collected':
      return { title: 'سُحبت العينة', body: 'تظهر النتيجة في التطبيق حال جهوزها.', link: '/patient/home-lab' };
    case 'homelab.rejected':
      return { title: 'تعذّر تنفيذ طلب السحب المنزلي', body: `اعتذر المختبر عن الطلب ${req}. افتح التطبيق للتفاصيل.`, link: '/patient/home-lab' };
    case 'application.new':
      return { title: 'طلب انضمام جديد', body: `استمارة ${typeof payload.application_number === 'string' ? payload.application_number : ''} بانتظار المراجعة.`, link: '/platform-admin/applications' };
    case 'queue.called':
      return { title: 'حان دورك 🔔', body: `تفضّل إلى غرفة الطبيب${typeof payload.doctor === 'string' && payload.doctor ? ` — ${payload.doctor}` : ''}.`, link: '/patient/appointments' };
    case 'medication.reminder':
      return { title: 'تذكير', body: 'حان موعد جرعتك حسب خطتك. افتح التطبيق للتفاصيل.', link: '/patient/meds' };
    case 'prescription.approved':
      return { title: 'وصفة جديدة', body: 'أصدر طبيبك وصفة معتمدة. افتح التطبيق لعرضها.', link: '/patient/journey' };
    case 'prescription.cancelled':
      return { title: 'تحديث على وصفة', body: 'أُلغيت إحدى وصفاتك. افتح التطبيق للتفاصيل.', link: '/patient/journey' };
    case 'prescription.dispensed':
      return { title: 'تم الصرف', body: 'سُجل صرف من الصيدلية. افتح التطبيق للتفاصيل.', link: '/patient/journey' };
    case 'prescription.clarification':
      return { title: 'طلب توضيح من صيدلية', body: 'تطلب صيدلية توضيحاً على وصفة أصدرتها. افتح «ملاحظات الصيدلية» للرد.', link: '/workspace/doctor/pharmacy-notes' };
    case 'prescription.not_available':
      return { title: 'دواء غير متوفر', body: 'أبلغت صيدلية أن دواءً في وصفتك غير متوفر. افتح «ملاحظات الصيدلية».', link: '/workspace/doctor/pharmacy-notes' };
    case 'prescription.clarification_reply':
      return { title: 'ردّ الطبيب على طلب التوضيح', body: 'وصل رد الطبيب — افتح الوصفة في «وارد الوصفات».', link: '/workspace/pharmacy' };
    case 'lab.open_order':
      return { title: 'طلب تحاليل من طبيبك', body: `اعرض الرمز ${typeof payload.code === 'string' ? payload.code : ''} في أي مختبر — صالح 7 أيام.`, link: '/patient/lab-orders' };
    case 'lab.open_claimed':
      return { title: 'استلم المختبر طلب التحاليل', body: 'تظهر النتيجة في التطبيق حال جهوزها.', link: '/patient/lab-orders' };
    case 'lab.patient_entered':
      return { title: 'نتيجة أدخلها المريض', body: 'أدخل مريضك نتيجة تحليل من مختبر خارجي. افتح بطاقته الطبية.', link: '/workspace/doctor' };
    case 'lab.released':
      return { title: 'نتيجة تحليلك جاهزة', body: 'صدرت نتيجة تحاليل. افتح التطبيق لعرضها.', link: '/patient/journey' };
    case 'lab.corrected':
      return { title: 'تصحيح نتيجة', body: 'صحّح المختبر نتيجة سابقة. افتح التطبيق للتفاصيل.', link: '/patient/journey' };
    case 'lab.released_for_doctor':
    case 'lab.corrected_for_doctor':
      return { title: 'نتيجة تحتاج مراجعة', body: 'لديك نتيجة تحليل معتمدة بانتظار المراجعة.', link: '/workspace/doctor' };
    default:
      return { title: 'إشعار جديد', body: 'لديك تحديث في حسابك.', link: null };
  }
}

/** «الأحد 26 تشرين الأول، 4:30 م» in Baghdad time. */
function baghdad(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('ar-IQ', { timeZone: 'Asia/Baghdad', weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }).format(d);
  } catch { return ''; }
}
