# أبيض على App Store — كل شي جاهز للنسخ واللصق

لقطات الشاشة بمجلد `graphics/` (1290×2796، مقاس iPhone 6.7"/6.9" وهو المقاس الإجباري).
تُعاد بالأمر:
`node scripts/e2e-mobile.mjs apps/mobile/dist-local <مجلد> && node scripts/make_play_assets.mjs <مجلد> docs/app-store/graphics 1290x2796`

---

## ٠. قبل كل شي: شنو ناقص حتى ننشر

| # | الشي | الحالة |
|---|---|---|
| 1 | **حساب Apple Developer نوع Organization** (99$ بالسنة) — التطبيقات الطبية ما تنقبل من حساب فردي (القاعدة 5.1.1 ix) | ينتظر الشركة ورقم D-U-N-S |
| 2 | **Sign in with Apple** — إجباري لأي تطبيق بيه دخول Google (القاعدة 4.8) | ينضاف بعد فتح الحساب. لحد ذاك الوقت نسخة المتجر تخفي زر Google (الدخول برمز واتساب أو بالبريد) |
| 3 | **إشعارات الخادم (APNs)** — هسه الآيفون يوصله تذكير الدواء فقط (محلي). إشعارات المواعيد والنتائج تحتاج مفتاح APNs من الحساب المدفوع | ينضاف بعد فتح الحساب |
| 4 | **توقيع ورفع النسخة** — يحتاج App Store Connect API key (Issuer ID + Key ID + ملف p8) كأسرار بالمستودع | ينضاف بعد فتح الحساب |

الجاهز من هسه: إعدادات التطبيق (`app.json`): رقم البناء، إقرار التشفير، بيان الخصوصية (Privacy Manifest)، نصوص أذونات الموقع والمايكروفون؛ ولقطات الشاشة؛ وكل النصوص تحت.

## ١. معلومات التطبيق (App Information)

| الخانة | الجواب |
|---|---|
| Name (30 حرف) | `أبيض - ABYAD` |
| Subtitle (30 حرف) | `احجز طبيبك وتابع صحتك` |
| Bundle ID | `com.spardexlab.abyad` |
| SKU | `abyad-ios` |
| Primary language | Arabic |
| Primary category | Medical |
| Secondary category | Health & Fitness |
| Content rights | لا يحتوي محتوى طرف ثالث |
| Age rating | 4+ (كل الأسئلة «None»؛ «Medical/Treatment Information»: Infrequent/Mild) |

## ٢. صفحة المتجر (Version Information)

**Promotional text (170 حرف):**
```
احجز عند طبيبك أو المختبر بدون اتصال، واستلم وصفتك ونتائج تحاليلك على هاتفك، وخلّي أبيض يذكّرك بدوائك في وقته.
```

**Description:** نفس «الوصف الكامل» في `docs/play-store/README.md` (ينتهي بتنبيه «أبيض ليس جهازاً طبياً…»).

**Keywords (100 حرف، بفواصل بدون مسافات):**
```
طبيب,حجز,موعد,عيادة,مختبر,تحاليل,وصفة,دواء,تذكير,صحة,كربلاء,العراق,doctor,clinic
```

| الخانة | الجواب |
|---|---|
| Support URL | `https://white.spardexlab.site` |
| Marketing URL | `https://white.spardexlab.site` |
| Privacy Policy URL | `https://white.spardexlab.site/privacy` |
| Copyright | `2026 Spardex Lab` (يتبدل لاسم الشركة بعد التسجيل) |
| Screenshots — iPhone 6.7"/6.9" | `graphics/screenshot-1.png` … `screenshot-6.png` بالترتيب |

## ٣. خصوصية التطبيق (App Privacy — Nutrition Labels)

- **Tracking:** لا. التطبيق ما يتتبع المستخدم وما بيه إعلانات.
- كل البيانات **Linked to the user**، والغرض **App Functionality** فقط (إلا الأعطال: + Analytics).

| Data type | يُجمع؟ | ملاحظة |
|---|---|---|
| Contact Info → Name | نعم | مطلوب |
| Contact Info → Email Address | نعم | للدخول |
| Contact Info → Phone Number | نعم | للدخول برمز واتساب |
| Contact Info → Physical Address | نعم | لطلب السحب من البيت |
| Health & Fitness → Health | نعم | الزيارات والوصفات والتحاليل والحساسية والأمراض |
| Location → Coarse Location | نعم | لترتيب الأقرب ولطلب السحب من البيت |
| User Content → Other User Content | نعم | ما يكتبه للمساعد الذكي (يُعالج لحظياً ولا يُحفظ) |
| User Content → Audio Data | نعم | رسالة صوتية للمساعد (لا تُحفظ) |
| Identifiers → Device ID | نعم | رمز الإشعارات |
| Diagnostics → Crash Data، Performance Data | نعم | App Functionality + Analytics |
| Sensitive Info، Financial Info، Contacts، Photos، Browsing/Search History، Purchases | لا | |

## ٤. ملاحظات المراجعة (App Review Information)

- **Sign-in required:** Yes
- **User name / Password:** حساب مريض تجريبي بالبريد (يُكتب في App Store Connect فقط، لا يُحفظ هنا)
- **Contact:** `info@spardexlab.site` · `+964 788 317 3489`
- **Notes:**
```
ABYAD connects patients in Iraq with licensed doctors, laboratories and pharmacies: search and booking, visit summaries, prescriptions written by the doctor, lab results, and medication reminders.

How to sign in: open the «حسابي» (Account) tab → «الدخول بالبريد الإلكتروني» → enter the demo email and password above. The WhatsApp code sign-in only works with Iraqi mobile numbers.

Regulated content: the app is not a medical device and gives no diagnosis or treatment. Prescriptions and diagnoses are entered only by licensed doctors through the web portal for professionals; each doctor's licence is reviewed by our team before the clinic is listed. The AI assistant only suggests which specialty to visit; it does not diagnose, prescribe or change doses, and says so in the app.

Payments: there are no in-app purchases and no online payments. Fees are shown for information and paid in person at the clinic or lab (physical services, guideline 3.1.3(e)).

Account deletion: Account tab → «حذف الحساب», or https://white.spardexlab.site/account-deletion

Location is optional (nearest providers, home sample collection). The microphone is used only when the user taps the mic button in the assistant; audio is not stored.
```

## ٥. الترتيب بعد فتح حساب Apple

1. App Store Connect ← Users and Access ← Integrations ← **App Store Connect API** ← Generate key (دور App Manager). ترسل لي ثلاث قيم تنحفظ كأسرار بالمستودع (ما تنكتب بالمحادثة): Issuer ID، Key ID، وملف `.p8`.
2. أضيف: التوقيع والرفع التلقائي لـ TestFlight، Sign in with Apple، وإشعارات APNs.
3. TestFlight داخلي (فريقك) ← بعدها الإرسال للمراجعة بالنصوص أعلاه.
