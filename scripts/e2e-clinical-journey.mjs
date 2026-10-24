// Phase 3 end-to-end UI journey (local stack + dev server, synthetic data):
// reception walk-in (existing patient by code) → doctor session: note,
// prescription to the visit-location pharmacy, lab order → pharmacy
// receives → lab collects / drafts / approver releases → doctor review
// task → patient sees prescription + released result in the journey.
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://127.0.0.1:5173';
const PASSWORD = 'Demo-Pass-2026!';
const browser = await chromium.launch();
const ctxOpts = { viewport: { width: 1366, height: 900 }, locale: 'ar-IQ', timezoneId: 'Asia/Baghdad' };
const step = (m) => console.log(`✓ ${m}`);
const errors = [];

async function pro(email) {
  const page = await (await browser.newContext(ctxOpts)).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}/login`);
  await page.getByLabel('البريد الإلكتروني أو معرف الدخول').fill(email);
  await page.getByLabel('كلمة المرور').fill(PASSWORD);
  await page.getByRole('button', { name: 'دخول', exact: true }).click();
  await page.waitForURL(/workspace|platform-admin/);
  return page;
}

// 1) reception: existing patient (lookup by public code) → waiting list
const r = await pro('reception.a@demo.test');
await r.waitForURL(/reception/);
await r.getByRole('button', { name: /حجز سريع/ }).click();
await r.getByRole('button', { name: 'مريض موجود' }).click();
await r.locator('#lookup').fill('PDEMO00050');
await r.getByRole('button', { name: 'بحث' }).click();
await r.locator('.lookup-result', { hasText: 'حسن علي' }).click();
await r.getByLabel(/إضافة إلى قائمة الانتظار/).check();
await r.getByRole('button', { name: 'إضافة إلى الانتظار' }).click();
await r.getByText('أُضيف المريض إلى قائمة الانتظار').waitFor();
step('reception found the patient by code and added a walk-in');

// 2) doctor session
const d = await pro('dr.ahmed@demo.test');
await d.getByRole('button', { name: /عيادات الرافدين.*طبيب/ }).first().click();
await d.waitForURL(/doctor$/);
const qi = d.locator('.queue-item', { hasText: 'حسن علي' }).filter({ hasText: 'عابر' }).first();
await qi.getByRole('button', { name: 'بدء الجلسة' }).click();
await d.getByRole('button', { name: 'تأكيد الهوية وبدء الجلسة' }).click();
await d.waitForURL(/session/);
await d.getByText('حساسية: Penicillin').first().waitFor();
step('session started after identity confirmation; documented allergy shown in the header');
if (await d.getByRole('tab', { name: 'الجلسة الحالية' }).count()) throw new Error('the note tab must be hidden');
await d.getByRole('tab', { name: 'البطاقة الطبية', selected: true }).waitFor();
await d.getByLabel('التشخيص', { exact: false }).first().fill('تقييم تجريبي');
await d.getByText(/محفوظ/).first().waitFor({ timeout: 10000 });
step('session opens on the medical card; diagnosis autosaved from the side panel');

await d.getByRole('tab', { name: /الفحوصات/ }).waitFor();
await d.getByText('حساسية موثّقة').waitFor();
step('medical card opens inside the session (visits / tests / prescriptions)');

await d.getByRole('button', { name: 'إيقاف مؤقت واستقبال مريض آخر' }).click();
await d.getByRole('alertdialog').getByRole('button', { name: 'إيقاف مؤقت' }).click();
await d.waitForURL(/doctor$/);
const pausedRow = d.locator('.list-item', { hasText: 'حسن علي' }).filter({ hasText: 'متوقفة مؤقتاً' });
await pausedRow.waitFor();
await pausedRow.getByRole('button', { name: 'استئناف' }).click();
await d.waitForURL(/session/);
await d.getByLabel('التشخيص', { exact: false }).first().waitFor();
if ((await d.getByLabel('التشخيص', { exact: false }).first().inputValue()) !== 'تقييم تجريبي') throw new Error('note lost after pause/resume');
step('session paused (patient sent out), listed as paused, resumed with the note intact');

await d.getByRole('tab', { name: 'وصفة' }).click();
await d.getByLabel('بحث بالمادة الفعالة أو الاسم التجاري').fill('Paracet');
await d.locator('.combo-list button', { hasText: '500 mg' }).click();
await d.getByLabel('الكمية بكل جرعة').fill('1');
await d.getByLabel('الوحدة').selectOption('حبة');
await d.getByLabel('كم مرة باليوم').selectOption('8');
await d.getByLabel('المدة (أيام)').fill('5');
await d.getByLabel('كمية الصرف').fill('15');
await d.getByRole('button', { name: 'اعتماد الوصفة' }).click();
await d.getByRole('alertdialog').getByText('حسن علي').waitFor();
await d.getByRole('alertdialog').getByRole('button', { name: 'اعتماد', exact: true }).click();
await d.getByText(/معتمدة — إصدار 1/).waitFor();
await d.getByRole('link', { name: 'طباعة للمريض' }).waitFor();
step('prescription approved for printing (sending is optional)');
const dest = await d.getByLabel('الصيدلية').locator('option:checked').innerText();
if (!dest.includes('صيدلية الرافدين')) throw new Error(`default pharmacy should be the visit location, got ${dest}`);
await d.getByRole('button', { name: 'إرسال', exact: true }).click();
await d.getByText(/أُرسلت أيضاً إلى: صيدلية الرافدين/).waitFor();
step('approved prescription then sent to the visit-location pharmacy');

await d.getByRole('tab', { name: /تحاليل/ }).click();
await d.locator('.radio-card', { hasText: 'سكر صائم' }).click();
await d.getByRole('button', { name: /إرسال الطلب إلى/ }).click();
await d.getByText(/أُرسل طلب التحاليل/).waitFor();
step('lab order sent');

await d.getByRole('button', { name: 'انتظار النتائج واستقبال التالي' }).click();
await d.getByRole('alertdialog').getByRole('button', { name: 'تأكيد' }).click();
await d.waitForURL(/doctor$/);
step('note signed and locked; session moved to awaiting results, doctor back on the day list');

// 3) pharmacy receives
const ph = await pro('pharm.a@demo.test');
await ph.waitForURL(/pharmacy/);
const row = ph.locator('tr', { hasText: 'حسن علي' }).first();
await row.getByText('جديدة').waitFor();
await row.getByRole('button', { name: 'فتح' }).click();
await ph.getByText('حساسية موثقة: Penicillin').waitFor();
await ph.getByRole('button', { name: 'تسجيل الاستلام' }).click();
await ph.getByText('سُجل الاستلام').waitFor();
step('pharmacy sees the prescription (with documented allergy) and records receipt');
// the pharmacist asks the doctor — typed letter by letter, the focus must stay in the box
await ph.getByRole('button', { name: 'طلب توضيح من الطبيب' }).first().click();
const noteBox = ph.getByRole('alertdialog').getByLabel('ملاحظة');
await noteBox.click();
await noteBox.pressSequentially('هل المقصود 500 ملغ؟', { delay: 20 });
if ((await noteBox.inputValue()) !== 'هل المقصود 500 ملغ؟') throw new Error('typing in the note lost focus: ' + await noteBox.inputValue());
await ph.getByRole('alertdialog').getByRole('button', { name: 'حفظ' }).click();
await ph.getByText('أُرسل طلب التوضيح للطبيب').waitFor();
step('pharmacist typed a clarification request without the focus jumping away');
await d.goto(`${BASE}/workspace/doctor`);
await d.getByText(/ملاحظات من الصيدلية \(1\)/).waitFor();
await d.getByRole('link', { name: 'عرض والرد' }).click();
await d.getByText('هل المقصود 500 ملغ؟').waitFor();
await d.getByRole('button', { name: 'الرد', exact: true }).click();
await d.getByLabel('ردك للصيدلي').fill('نعم 500 ملغ كل 8 ساعات');
await d.getByRole('button', { name: 'إرسال الرد' }).click();
await d.getByText('أُرسل ردك للصيدلية').waitFor();
await d.goto(`${BASE}/workspace/doctor`);
step('doctor sees the pharmacist\'s note and replies');
await ph.reload();
await row.getByRole('button', { name: 'فتح' }).click();
await ph.getByText(/رد الطبيب:/).waitFor();
await ph.getByText('نعم 500 ملغ كل 8 ساعات').waitFor();
step('pharmacist sees the doctor\'s reply under the line');
await ph.getByText('التحضير والصرف').waitFor();
const qtyField = ph.getByLabel('الكمية', { exact: true }).first();
let qv = '';
for (let i = 0; i < 20 && qv !== '15'; i++) { qv = await qtyField.inputValue(); if (qv !== '15') await ph.waitForTimeout(250); }
if (qv !== '15') throw new Error(`expected default quantity = remaining prescribed (15), got "${qv}"`);
await qtyField.fill('10');
await ph.getByRole('button', { name: 'تحضير (حجز الكمية)' }).click();
await ph.getByText('تم حجز الكميات للتحضير').waitFor();
await ph.getByRole('button', { name: 'صرف', exact: true }).click();
await ph.getByRole('alertdialog').getByRole('button', { name: 'صرف الآن' }).click();
await ph.getByText('صرف جزئي — بقيت كميات').waitFor();
await ph.getByRole('button', { name: 'تسجيل الدفع نقداً' }).click();
await ph.getByText('سُجل الدفع').waitFor();
step('pharmacy reserved, partially dispensed 10/15 (FEFO), and recorded payment');
await ph.getByText('تفعيل تذكيرات الدواء للمريض').click();
await ph.getByLabel('وقت متفق عليه').fill('09:00');
await ph.getByRole('button', { name: 'إضافة', exact: true }).click();
await ph.getByLabel('وقت متفق عليه').fill('21:00');
await ph.getByRole('button', { name: 'إضافة', exact: true }).click();
await ph.getByLabel('وافق المريض على تلقي التذكيرات').check();
await ph.getByRole('button', { name: 'تفعيل', exact: true }).click();
await ph.getByText('فُعّلت التذكيرات حتى نهاية مدة العلاج').waitFor();
step('pharmacist activated reminders at agreed times with patient consent');
await ph.goto(`${BASE}/workspace/pharmacy/stock`);
const prow = ph.locator('tr', { hasText: 'باراسيتامول 500' });
await prow.getByText('250 قرص').waitFor();
step('stock page shows 250 available (260 − 10), expired batch reported separately');

// 4) lab: ONE lab member checks in, collects, saves a draft, then releases
const lt = await pro('lab.a@demo.test');
await lt.waitForURL(/lab/);
await lt.locator('tr', { hasText: 'حسن علي' }).first().getByRole('button', { name: 'فتح' }).click();
await lt.getByRole('button', { name: 'استقبال المراجع وبدء الفحص' }).click();
await lt.getByText('استُقبل المراجع وسُجلت العينة').waitFor();
await lt.getByText(/تم الاستقبال · العينة S/).waitFor();
await lt.getByLabel('القيمة').fill('92');
await lt.getByLabel('المجال المرجعي').fill('70-100 (مختبر تجريبي)');
await lt.getByRole('button', { name: 'حفظ بدون نشر' }).click();
await lt.getByText('حُفظت القيم (غير منشورة بعد)').waitFor();
step('lab member received the patient (check-in + barcoded sample in one step) and saved the value unpublished');

await lt.getByRole('button', { name: 'إكمال التحليل ونشر النتيجة' }).click();
await lt.getByRole('alertdialog').getByText(/والطبيب/).waitFor();
await lt.getByRole('alertdialog').getByRole('button', { name: 'إكمال ونشر' }).click();
await lt.getByText('اكتمل التحليل ونُشرت النتيجة للمريض والطبيب').waitFor();
step('one action completed the order and published it to the patient and the doctor');

// 5) doctor review task
await d.reload();
await d.getByText('نتائج تحتاج مراجعة').waitFor();
await d.locator('.list-item', { hasText: 'حسن علي' }).getByRole('link', { name: 'عرض النتيجة' }).click();
await d.getByText('92').waitFor();
step('doctor got a review task and sees the released value (no automatic interpretation)');

// 6) patient journey
const p = await (await browser.newContext(ctxOpts)).newPage();
await p.goto(`${BASE}/patient/account`);
await p.getByLabel('البريد الإلكتروني').fill('hasan@demo.test');
await p.getByLabel('كلمة المرور').fill(PASSWORD);
await p.getByRole('button', { name: 'دخول', exact: true }).click();
await p.locator('canvas').first().waitFor();
await p.goto(`${BASE}/patient/journey`);
await p.getByText(/^وصفة RX/).first().waitFor();
await p.getByText(/النتيجة جاهزة/).first().waitFor();
await p.locator('.card', { hasText: /^وصفة RX/ }).first().getByRole('link', { name: 'التفاصيل' }).click();
await p.getByText('3 مرات يومياً').first().waitFor();
step('patient journey shows the approved prescription and released results');
await p.goto(`${BASE}/patient/meds`);
await p.getByText('الأوقات: 09:00، 21:00').waitFor();
await p.getByText(/حددها .* لتغييرها راجع طبيبك/).first().waitFor();
if (await p.getByRole('button', { name: 'إيقاف مؤقت' }).count()) throw new Error('prescribed plan must not be pausable by the patient');
await p.getByRole('button', { name: 'أخذت' }).first().click();
await p.getByText('أخذتها').first().waitFor();
if (process.env.SHOTS) await p.screenshot({ path: `${process.env.SHOTS}/patient-meds.png`, fullPage: true });
step('patient sees the medication plan (locked to the doctor) and records a dose');

await browser.close();
if (errors.length) { console.log('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('Phase 3 E2E journey passed');
