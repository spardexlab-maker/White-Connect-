// Lab order «for any lab», end to end in the browser:
// doctor (no lab) orders tests from the session → the patient sees the code / QR →
// the patient enters one result from an outside lab → a lab on the platform enters
// the code and takes the rest → the patient's own entry shows in «صحتي» marked as such.
// Needs a doctor session for حسن (run e2e:clinical first on a fresh reset; ENCOUNTER=<id> to name it).
// Usage: node scripts/e2e-open-lab.mjs [base-url]   (SHOTS=<dir> to save screenshots)
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://127.0.0.1:5173';
const PASSWORD = 'Demo-Pass-2026!';
const SHOTS = process.env.SHOTS;
const browser = await chromium.launch();
const ctxOpts = { locale: 'ar', viewport: { width: 1280, height: 900 } };
const errors = [];
const step = (s) => console.log('✓ ' + s);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); };

async function pro(email) {
  const page = await (await browser.newContext(ctxOpts)).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}/login`);
  await page.getByLabel('البريد الإلكتروني أو معرف الدخول').fill(email);
  await page.getByLabel('كلمة المرور').fill(PASSWORD);
  await page.getByRole('button', { name: 'دخول', exact: true }).click();
  await page.waitForURL(/workspace/);
  return page;
}

// 1) the doctor orders tests for any lab from the patient's session
const doc = await pro('dr.ahmed@demo.test');
await doc.getByRole('button', { name: /عيادات الرافدين.*طبيب/ }).first().click();
await doc.waitForURL(/doctor$/);
const sessionLink = doc.locator('a[href*="/workspace/doctor/session/"]').first();
const href = process.env.ENCOUNTER ? `/workspace/doctor/session/${process.env.ENCOUNTER}` : await sessionLink.getAttribute('href', { timeout: 5000 }).catch(() => null);
if (!href) throw new Error('no doctor session found — run e2e:clinical first');
await doc.goto(`${BASE}${href}`);
await doc.getByRole('tab', { name: /^تحاليل/ }).click();
await doc.getByRole('button', { name: 'أي مختبر (رمز للمريض)' }).click();
await doc.getByRole('button', { name: 'سكر صائم', exact: true }).click();
await doc.getByRole('button', { name: 'السكر التراكمي HbA1c', exact: true }).click();
await doc.getByLabel('تحليل غير موجود بالقائمة').fill('فحص الغدة الجار درقية PTH');
await doc.getByRole('button', { name: 'إضافة' }).click();
await doc.getByLabel('ملاحظة للمختبر').fill('صائم 8 ساعات');
await doc.getByRole('button', { name: 'إصدار الطلب للمريض' }).click();
await doc.getByText('صدر طلب التحاليل').waitFor();
const code = (await doc.locator('.open-code').first().textContent()).trim();
await shot(doc, 'open-1-doctor');
step(`doctor issues an open order with code ${code}`);

// 2) the patient sees it with its code and enters one result from an outside lab
const p = await (await browser.newContext(ctxOpts)).newPage();
p.on('pageerror', (e) => errors.push(e.message));
await p.goto(`${BASE}/patient/account`);
await p.getByRole('button', { name: /الدخول بالبريد الإلكتروني/ }).click();
await p.getByLabel('البريد الإلكتروني').fill('hasan@demo.test');
await p.getByLabel('كلمة المرور').fill(PASSWORD);
await p.getByRole('button', { name: 'دخول', exact: true }).click();
await p.locator('canvas').first().waitFor();
await p.goto(`${BASE}/patient`);
await p.getByRole('link', { name: /طلبات التحاليل/ }).click();
await p.getByText(code).first().waitFor();
await shot(p, 'open-2-patient');
await p.getByRole('button', { name: /أدخل نتيجة فحص الغدة/ }).click();
await p.getByLabel('النتيجة').fill('48');
await p.getByLabel('الوحدة').fill('pg/mL');
await p.getByLabel('المجال الطبيعي').fill('15-65');
await p.getByLabel('اسم المختبر').fill('مختبر خارجي');
await p.getByRole('button', { name: 'حفظ النتيجة' }).click();
await p.getByText('حُفظت النتيجة').waitFor();
await p.getByText('نتائج أدخلتها').waitFor();
step('patient sees the code / QR and enters a result from an outside lab');

// 3) a lab on the platform enters the code and takes the rest
const lab = await pro('lab.a@demo.test');
await lab.getByRole('link', { name: 'طلب برمز (QR)' }).click();
await lab.getByLabel('رمز الطلب').fill(code);
await lab.getByRole('button', { name: 'عرض الطلب' }).click();
await lab.getByText('حسن').first().waitFor();
await lab.getByText('أدخله المريض').waitFor();
const sugar = lab.getByLabel('يقابل سكر صائم');
if (!(await sugar.inputValue())) throw new Error('fasting sugar was not matched to the lab catalogue');
await shot(lab, 'open-3-lab');
await lab.getByRole('button', { name: /استلام \d+ تحليل/ }).click();
await lab.getByText(/أُضيف الطلب — رقم/).waitFor();
step('lab enters the code, the matching tests are pre-selected and join its worklist');

// 4) the patient's order card shows where each test is; the own entry is in «صحتي»
await p.reload();
await p.getByText('مختبر الرافدين').first().waitFor();
await p.goto(`${BASE}/patient/health`);
await p.getByText('أدخلها المريض').first().waitFor();
await shot(p, 'open-4-health');
step('patient sees the lab taking the rest, and the own result in «صحتي» marked «أدخلها المريض»');

// 5) a phone camera on the QR link: lab staff land on the claim page
await lab.goto(`${BASE}/lab-order?code=${code}`);
await lab.waitForURL(/workspace\/lab\/open\?code=/);
step('the QR link takes lab staff straight to the claim page');

await browser.close();
if (errors.length) { console.error('page errors:', errors); process.exit(1); }
console.log('Open lab order E2E journey passed');
