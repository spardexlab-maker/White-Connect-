# حالات الانتقال

## الموعد (`appointment_status`)

```mermaid
stateDiagram-v2
  [*] --> awaiting_confirmation: حجز مريض (تأكيد يدوي)
  [*] --> confirmed: حجز استقبال / تأكيد تلقائي
  [*] --> checked_in: تخصيص وقت لمريض عابر حاضر
  awaiting_confirmation --> confirmed: سكرتير (قبل المهلة)
  awaiting_confirmation --> rejected: سكرتير + سبب
  awaiting_confirmation --> cancelled: مريض/سكرتير + سبب
  awaiting_confirmation --> expired: انتهاء المهلة (ذري)
  confirmed --> checked_in: يوم الموعد فقط
  confirmed --> cancelled: + سبب
  confirmed --> no_show: + سبب
  checked_in --> fulfilled: تسجيل مغادرة
  checked_in --> cancelled: + سبب
```

* الحالات الحاجزة للوقت: `awaiting_confirmation`, `confirmed`, `checked_in`, `fulfilled` (عمود مولد `holds_slot`).
* `awaiting_confirmation` يحجز الفترة فعلاً؛ مهلته = `min(now + confirmation_timeout, start)` وتظهر للمريض.
* التأكيد بعد المهلة يعيد `expired` ولا يؤكد؛ وأي تأكيد لاحق لموعد `expired` يرفض بـ `invalid_transition`.
* إعادة الجدولة = إلغاء القديم + إدراج الجديد في معاملة واحدة؛ عند التعارض تُلغى المعاملة كلها ويبقى القديم كما هو.
* كل انتقال يُسجل في `appointment_events` (من، إلى، المنفذ، السبب).

## الطابور (`queue_status`) — منفصل عن الموعد
`waiting → called → in_session → done` و`waiting|called → left|cancelled`.
الترتيب: الأولوية (بسبب مسجل) ثم وقت الموعد أو وقت الوصول للعابر. التقدير يُعرض كتقدير وليس وعداً، ويضيف آخر إشعار تأخير.

## صندوق الإشعارات (`outbox_status`)
`pending → processing → sent` ؛ عند الفشل `failed` مع backoff أُسّي (حد ساعة) ثم `dead` بعد `max_attempts` لمراجعة المشغل. الـlease المنتهي يعاد التقاطه؛ الإكمال idempotent.

## الجلسة الطبية (`encounter_status`)
`in_progress → awaiting_results → ready_for_review → completed → closed` و`in_progress|awaiting_results → completed`. تبدأ فقط بـ`start_encounter` بعد تأكيد الهوية (لا بمرور الوقت)، جلسة جارية واحدة للطبيب. `awaiting_results` يحرر الطابور ويجعل الموعد `fulfilled`؛ اعتماد النتيجة ينقلها إلى `ready_for_review` وينشئ مهمة.

## الملاحظة السريرية
`draft → signed → superseded` (التصحيح ينشئ إصداراً `signed` جديداً بسبب). trigger يمنع تعديل المعتمد أو حذفه.

## الوصفة
رأس: `draft → active → cancelled`. إصدار: `draft → approved → superseded|cancelled` (إصدار معتمد واحد). أحداث منفصلة: approved/revised/sent/received/printed/…؛ الإرسال لكل صيدلية سجل واحد (`unique(prescription, pharmacy)`).

## طلب المختبر (`lab_status`)
`ordered → checked_in → sample_collected → pending_review → released`، مع `sample_rejected` (إعادة سحب) و`processing` للنشر الجزئي. النتيجة: `draft → released → superseded`.
