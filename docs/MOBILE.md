# تطبيق المريض للهاتف (Android / iOS)

`apps/mobile` — تطبيق Expo (SDK 58، React Native 0.88، expo-router) للمريض. يعيد استخدام `packages/shared`
(الأنواع المولدة، التحقق، التنسيقات، رسائل الأخطاء، ألوان نظام التصميم) ويستدعي **نفس الـRPC** التي يستخدمها الويب،
فلا تتكرر أي قاعدة عمل في التطبيق: التداخل، الصلاحيات، التحقق من الحالة كلها في قاعدة البيانات.

## الشاشات
| الشاشة | المسار | RPC / جدول |
|---|---|---|
| الرئيسية: بحث، أطباء/مختبرات، تخصصات، مدن، «استخدم موقعي» (اختياري) وأقرب موعد | `(tabs)/index` | `search_providers`, `get_provider_profile`, `get_available_slots` |
| ملف مقدم الخدمة: الخدمات والأسعار، أيام العمل، سياسة الإلغاء، الاتصال والخريطة، زر حجز ثابت | `provider/[facilityId]` | `get_provider_profile` |
| الحجز بأربع مراحل؛ الدخول/إنشاء الملف داخل نفس الشاشة دون فقدان الوقت المختار؛ مفتاح idempotency لكل محاولة؛ عند `slot_unavailable` يُحدَّث التوفر | `book/[facilityId]` | `book_appointment(p_source='app')` |
| حجوزاتي: القادمة/السابقة، مهلة التأكيد، إلغاء بسبب | `(tabs)/appointments` | `my_appointments`, `change_appointment_status` |
| رحلتي: خط زمني للمواعيد والزيارات والوصفات المعتمدة والنتائج المنشورة فقط | `(tabs)/journey` | `patient_journey` |
| الوصفة: نسخة المريض كما كتبها الطبيب، مشاركة رابط التحقق، تفعيل التذكيرات بأوقات يختارها المريض صراحةً | `rx/[id]` | `prescription_document`, `create_medication_plan` |
| نتائج التحليل: القيم والوحدات والمدى والعلامات كما أدخلها المختبر، النسخ المصححة | `lab/[orderId]` | `lab_order_detail` |
| خطة الدواء: أخذت/تخطي/تأجيل، إيقاف مؤقت/استئناف/إيقاف | `meds` | `my_medication_plans`, `record_dose`, `set_medication_plan_status` |
| الإشعارات | `(tabs)/notifications` | `notifications` (RLS) |
| حسابي: دخول/حساب جديد، إكمال الملف (الاسم فقط مطلوب)، بطاقة QR لكل مريض مرتبط، عرض كبير للمسح، تغيير الرمز، رمز ربط سجل العيادة، تذكيرات الهاتف | `(tabs)/account`, `card/[patientId]` | `register_self_patient`, `my_patient_card`, `rotate_patient_qr`, `create_account_link_code` |

أدوات المهنيين (طبيب، استقبال، صيدلية، مختبر، إدارة) تبقى في بوابة الويب؛ التطبيق يعرض لهم زر «فتح بوابة المهنيين».

## الأمان والخصوصية
* المفتاح المستخدم هو **publishable** فقط (`EXPO_PUBLIC_*`). مفتاح secret لا يدخل التطبيق أبداً.
* الجلسة تُحفظ في Keychain/Keystore عبر `expo-secure-store` (مقسمة لأجزاء)، ويتوقف تحديث التوكن والتطبيق في الخلفية.
* رمز QR يحمل التوكن العشوائي فقط — لا اسم ولا هاتف ولا بيانات صحية.
* إشعارات التذكير المحلية نصها عام («حان موعد دوائك») ولا تذكر اسم الدواء، وتُحذف كلها عند تسجيل الخروج.
* الموقع: إذن تقريبي فقط (`ACCESS_COARSE_LOCATION`)، اختياري، والدقيق/الخلفي محظوران في `app.json`.
* RTL مفروض من أول تشغيل (`expo-localization` `forcesRTL`) وخط IBM Plex Sans Arabic.

## التشغيل للتطوير
```bash
cp apps/mobile/.env.example apps/mobile/.env   # قيم عامة فقط
pnpm mobile                                    # ثم امسح رمز QR بتطبيق Expo Go على الهاتف
```
للعمل على قاعدة البيانات المحلية ضع `EXPO_PUBLIC_SUPABASE_URL=http://<IP-جهازك>:54321` ومفتاح publishable المحلي.

## الاختبار
```bash
pnpm --filter @app/mobile typecheck
pnpm --filter @app/mobile export:android      # يتحقق أن حزمة Hermes تُبنى
pnpm mobile:export:web && pnpm e2e:mobile      # رحلة كاملة بحجم هاتف 390×844 على قاعدة البيانات المحلية
```
`scripts/e2e-mobile.mjs` يغطي: البحث → ملف الطبيب → اختيار الخدمة والوقت → الدخول داخل شاشة الحجز → الإرسال →
ظهوره في «حجوزاتي» → بطاقة QR → الرحلة، ويتحقق من RTL وعدم وجود تمرير أفقي وعدم وجود أخطاء صفحة.
لقطات: `docs/screenshots/mobile-*.png`.

## بناء ملف التثبيت والنشر في المتاجر (يتطلب حسابك)
البناء يتم على خوادم Expo (EAS) — لا يلزم Android Studio أو Mac:
```bash
cd apps/mobile
npx eas-cli login                                  # حساب Expo مجاني
npx eas-cli init                                   # يربط المشروع ويضيف projectId إلى app.json
npx eas-cli build -p android --profile preview     # ملف APK للتجربة المباشرة على أي هاتف Android
npx eas-cli build -p android --profile production  # AAB لمتجر Google Play
npx eas-cli build -p ios --profile production      # يتطلب حساب Apple Developer (99$ سنوياً)
npx eas-cli submit -p android                      # الرفع للمتجر بعد إنشاء التطبيق في Play Console (25$ مرة واحدة)
```
قبل النشر العام: معرف الحزمة `com.whiteconnect.patient` واسم التطبيق والأيقونة مؤقتة وتُستبدل بالعلامة النهائية؛
مطلوب سياسة خصوصية منشورة ونموذج «Data safety» (Google) و«Privacy Nutrition Label» (Apple).

## ما لم يُنفذ بعد
* Push من الخادم (FCM/APNs): يتطلب جدول رموز الأجهزة وحساب Firebase/Apple — التذكيرات المحلية والإشعارات داخل التطبيق تعمل.
* الدخول برقم الهاتف ورمز SMS: يتطلب مزود رسائل مدفوع.
* رفع المرفقات من التطبيق: متاح في الويب فقط حالياً.
