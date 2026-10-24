// Home sample collection, end to end in the browser:
// lab switches it on → patient asks for a visit → lab schedules, goes, collects
// → the patient follows every step and the order joins the lab's worklist.
// Usage: node scripts/e2e-home-lab.mjs [base-url]   (SHOTS=<dir> to save screenshots)
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

// 1) the lab switches home collection on
const lab = await pro('lab.a@demo.test');
await lab.getByRole('link', { name: 'السحب المنزلي' }).click();
await lab.getByRole('button', { name: 'الإعدادات' }).click();
await lab.getByLabel('استقبال طلبات السحب المنزلي').check();
await lab.getByLabel('أجور الزيارة (دينار)').fill('5000');
await lab.getByLabel('ملاحظة للمرضى').fill('نغطي الكرادة والجادرية والمنصور');
await lab.getByRole('button', { name: 'حفظ' }).click();
await lab.getByText('يستقبل طلبات السحب المنزلي').waitFor();
step('lab switches home collection on');

// 2) the patient asks for a visit
const p = await (await browser.newContext(ctxOpts)).newPage();
p.on('pageerror', (e) => errors.push(e.message));
await p.goto(`${BASE}/patient/account`);
await p.getByLabel('البريد الإلكتروني').fill('hasan@demo.test');
await p.getByLabel('كلمة المرور').fill(PASSWORD);
await p.getByRole('button', { name: 'دخول', exact: true }).click();
await p.locator('canvas').first().waitFor();
await p.goto(`${BASE}/patient`);
await p.getByRole('link', { name: /تحليل منزلي/ }).click();
await p.getByRole('button', { name: 'طلب سحب منزلي' }).click();
await p.getByLabel('المختبر').selectOption({ label: /مختبر الرافدين/ }).catch(async () => {
  const opt = await p.getByLabel('المختبر').locator('option', { hasText: 'مختبر الرافدين' }).getAttribute('value');
  await p.getByLabel('المختبر').selectOption(opt);
});
await p.getByRole('button', { name: /صورة دم كاملة/ }).click();
await p.getByRole('button', { name: /سكر صائم/ }).click();
await p.getByText(/صيام 8 ساعات/).waitFor();
await p.getByLabel('العنوان بالتفصيل').fill('بغداد، الكرادة، شارع 62، دار 14، قرب جامع الرحمن');
await p.getByLabel('رقم الهاتف للتواصل').fill('07701234567');
await p.getByText(/المجموع التقريبي/).waitFor();
await shot(p, 'homelab-1-request');
await p.getByRole('button', { name: 'إرسال الطلب' }).click();
await p.getByText('وصل طلبك للمختبر — بانتظار تحديد الموعد').waitFor();
step('patient sends a home-collection request (tests, address, phone, day)');

// 3) the lab schedules, goes and collects
await lab.reload();
await lab.getByRole('tab', { name: /جديدة \(1\)/ }).waitFor();
await lab.locator('.list-item', { hasText: 'حسن' }).first().click();
await lab.getByLabel('اسم المختص').fill('علي');
await shot(lab, 'homelab-2-lab-request');
await lab.getByRole('button', { name: 'قبول وتحديد الموعد' }).last().click();
await lab.getByText('حُدّد الموعد — وصل إشعار للمريض').waitFor();
step('lab accepts and sets the visit time');

await p.reload();
await p.getByText(/حُدّد موعد الزيارة/).waitFor();
await p.getByText(/علي/).first().waitFor();
await p.getByText(/٩:٠٠ ص|9:00 ص/).first().waitFor();   // the lab's 09:00 is the patient's 09:00 (Baghdad)
await shot(p, 'homelab-3-patient-scheduled');
step('patient sees the visit time and who is coming');

await lab.getByRole('tab', { name: /مجدولة/ }).click();
await lab.locator('.list-item', { hasText: 'حسن' }).first().click();
await lab.getByRole('button', { name: 'بالطريق للمريض' }).click();
await lab.getByText('حُدّثت الحالة — وصل إشعار للمريض').waitFor();
await lab.getByRole('tab', { name: /بالطريق/ }).click();
await lab.locator('.list-item', { hasText: 'حسن' }).first().click();
await lab.getByRole('button', { name: 'تم سحب العينة' }).click();
await lab.getByText('سُجل السحب — الطلب صار في «طلبات المختبر»').waitFor();
step('lab: on the way → sample collected');

await lab.getByRole('link', { name: 'طلبات المختبر' }).click();
await lab.getByText(/حسن/).first().waitFor();
step('the order joins the lab worklist');

await p.reload();
await p.getByText('سُحبت العينة — النتيجة تظهر هنا حال جهوزها').waitFor();
await p.getByRole('link', { name: /حالة التحليل/ }).waitFor();
await shot(p, 'homelab-4-patient-collected');
step('patient follows every step to «سُحبت العينة» and can open the order');

await browser.close();
if (errors.length) { console.log('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('Home lab E2E journey passed');
