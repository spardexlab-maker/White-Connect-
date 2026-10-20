/**
 * Server errors arrive as `app:<code>` (see private.fail in migrations).
 * Map them to clear Arabic messages; unknown errors get a generic text
 * (raw database messages are never shown to users).
 */
const messages: Record<string, string> = {
  account_not_found: 'لا يوجد حساب بهذا البريد. اطلب من الطبيب إنشاء حساب أولاً ثم أعد المحاولة.',
  invalid_input: 'تحقق من الحقول المطلوبة.',
  role_retired: 'هذا الدور أُلغي ولا يمكن منحه أو تفعيله.',
  slot_unavailable: 'هذا الوقت لم يعد متاحاً. اختر وقتاً آخر.',
  slot_in_past: 'لا يمكن الحجز في وقت مضى.',
  slot_too_soon: 'الوقت قريب جداً؛ اختر وقتاً لاحقاً.',
  slot_outside_window: 'هذا التاريخ خارج نافذة الحجز المتاحة.',
  outside_working_hours: 'الوقت خارج ساعات العمل.',
  practitioner_unavailable: 'الطبيب غير متاح في هذا الوقت (استراحة أو إجازة).',
  practitioner_not_at_facility: 'الطبيب لا يعمل في هذه المنشأة.',
  service_unavailable: 'الخدمة غير متاحة.',
  service_required: 'اختر نوع الزيارة.',
  facility_unavailable: 'المنشأة غير متاحة حالياً.',
  forbidden: 'ليست لديك صلاحية لهذا الإجراء.',
  not_authenticated: 'يلزم تسجيل الدخول.',
  name_required: 'الاسم مطلوب.',
  reason_required: 'يرجى كتابة السبب.',
  invalid_transition: 'لا يمكن تنفيذ هذا الإجراء على الحالة الحالية.',
  stale_version: 'تغيّرت البيانات من مستخدم آخر. حدّث الصفحة ثم أعد المحاولة.',
  check_in_not_today: 'تسجيل الحضور متاح في يوم الموعد فقط.',
  past_cancellation_cutoff: 'انتهت مهلة التعديل المسموح بها؛ تواصل مع العيادة.',
  patient_not_attached: 'يلزم التحقق من هوية المريض وربطه بالمنشأة أولاً.',
  patient_not_found: 'السجل غير موجود.',
  query_too_short: 'اكتب 3 أحرف على الأقل.',
  rate_limited: 'عدد كبير من عمليات البحث. انتظر دقيقة ثم أعد المحاولة.',
  invalid_or_expired_code: 'الرمز غير صحيح أو منتهي الصلاحية.',
  verification_required: 'سجّل طريقة التحقق من الهوية.',
  self_record_exists: 'لديك ملف مريض بالفعل.',
  invalid_or_expired_invitation: 'الدعوة غير صالحة أو منتهية.',
  invitation_email_mismatch: 'هذه الدعوة مرسلة إلى بريد آخر.',
  idempotency_key_required: 'تعذّر إرسال الطلب. أعد المحاولة.',
  capacity_resource_required: 'الخدمة تحتاج تحديد محطة أو مورد.',
  membership_revoked: 'العضوية ملغاة.',
  cannot_change_self: 'لا يمكنك تغيير حالة حسابك.',
  invalid_timezone: 'المنطقة الزمنية غير صحيحة.',
  not_found: 'العنصر غير موجود.',
  another_session_in_progress: 'لديك جلسة جارية؛ أوقفها مؤقتاً أو أنهِها أولاً.',
  no_draft: 'لا توجد مسودة قابلة للتعديل.',
  signed_record_locked: 'السجل معتمد ومقفل؛ استخدم التصحيح بإصدار جديد.',
  delete_not_allowed: 'لا يمكن حذف السجلات المعتمدة.',
  encounter_closed: 'الجلسة مغلقة.',
  items_required: 'أضف بنداً واحداً على الأقل.',
  medication_required: 'اختر الدواء من القائمة أو اكتب اسمه.',
  invalid_pharmacy: 'الصيدلية المختارة غير متاحة.',
  already_dispensed: 'لا يمكن الإلغاء بعد الصرف.',
  not_printable: 'لا توجد نسخة معتمدة للطباعة.',
  invalid_lab: 'المختبر المختار غير متاح.',
  invalid_test: 'فحص غير متاح في هذا المختبر.',
  nothing_to_release: 'لا توجد نتائج مسودة محددة للاعتماد.',
};

export function errorCode(err: unknown): string | null {
  const msg = typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : '';
  return msg.startsWith('app:') ? msg.slice(4) : null;
}

export function errorMessage(err: unknown): string {
  const code = errorCode(err);
  if (code && messages[code]) return messages[code];
  const msg = typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : '';
  if (/fetch|network|Failed to fetch/i.test(msg)) return 'تعذّر الاتصال بالخادم. تحقق من الشبكة ثم أعد المحاولة.';
  if (/Invalid login credentials/i.test(msg)) return 'بيانات الدخول غير صحيحة.';
  return 'حدث خطأ غير متوقع. أعد المحاولة.';
}
