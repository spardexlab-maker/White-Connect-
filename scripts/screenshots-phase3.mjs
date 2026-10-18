// Screenshots of Phase 3 screens. Run right after scripts/e2e-clinical-journey.mjs
// (it leaves a session, prescription, lab order and results behind).
import { chromium } from 'playwright';
const BASE = process.argv[2] ?? 'http://127.0.0.1:5173';
const OUT = 'docs/screenshots';
const PASSWORD = 'Demo-Pass-2026!';
const browser = await chromium.launch();
const problems = [];

async function page(width) {
  const p = await (await browser.newContext({ viewport: { width, height: width < 768 ? 820 : 900 }, locale: 'ar-IQ', timezoneId: 'Asia/Baghdad' })).newPage();
  p.on('pageerror', (e) => problems.push(e.message));
  return p;
}
async function login(p, email) {
  await p.goto(`${BASE}/login`);
  await p.getByLabel('البريد الإلكتروني أو معرف الدخول').fill(email);
  await p.getByLabel('كلمة المرور').fill(PASSWORD);
  await p.getByRole('button', { name: 'دخول' }).click();
  await p.waitForURL(/workspace|platform-admin/);
}
async function shot(p, name, width) {
  await p.waitForTimeout(800);
  const o = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (o > 1) problems.push(`${name}@${width}: overflow ${o}px`);
  await p.screenshot({ path: `${OUT}/${name}-${width}.png`, fullPage: true });
}

for (const width of [390, 1440]) {
  const d = await page(width);
  await login(d, 'dr.ahmed@demo.test');
  await d.getByRole('button', { name: /عيادات الرافدين.*طبيب/ }).first().click();
  await d.waitForURL(/doctor$/);
  await d.getByText('نتائج تحتاج مراجعة').waitFor();
  await shot(d, '15-doctor-tasks', width);
  await d.getByRole('link', { name: 'الجلسة' }).first().click();
  await d.waitForURL(/session/);
  await d.getByText(/حساسية/).first().waitFor();
  await shot(d, '16-doctor-session', width);
  await d.getByRole('tab', { name: 'وصفة' }).click();
  const revise = d.getByRole('button', { name: /تعديل \(إصدار جديد\)/ });
  await d.locator('.rx-row, .alert').first().waitFor();
  if (await revise.count()) await revise.click();
  await d.locator('.rx-row').first().waitFor();
  await shot(d, '17-rx-builder', width);
  const ph = await page(width);
  await login(ph, 'pharm.a@demo.test');
  await ph.locator('tr', { hasText: 'حسن علي' }).first().waitFor();
  await shot(ph, '18-pharmacy-inbox', width);
  await ph.locator('tr', { hasText: 'حسن علي' }).first().getByRole('button', { name: 'فتح' }).click();
  await ph.getByText('سجل الأحداث').waitFor();
  await shot(ph, '19-pharmacy-detail', width);
  await ph.keyboard.press('Escape');
  for (const [path, name, wait] of [['stock', '25-pharmacy-stock', 'المخزون والدفعات'], ['sales', '26-pharmacy-sales', 'المبيعات والمرتجعات'], ['reports', '27-pharmacy-reports', 'الوصف مقابل الصرف']]) {
    await ph.goto(`${BASE}/workspace/pharmacy/${path}`);
    await ph.getByRole('heading', { name: wait }).first().waitFor();
    await shot(ph, name, width);
  }
  const lab = await page(width);
  await login(lab, 'labapprover.a@demo.test');
  await lab.locator('tr', { hasText: 'حسن علي' }).first().waitFor();
  await shot(lab, '20-lab-worklist', width);
  await lab.locator('tr', { hasText: 'حسن علي' }).first().getByRole('button', { name: 'فتح' }).click();
  await lab.getByText(/العينة: S/).waitFor();
  await shot(lab, '21-lab-order', width);
  const pt = await page(width);
  await pt.goto(`${BASE}/patient/account`);
  await pt.getByLabel('البريد الإلكتروني').fill('hasan@demo.test');
  await pt.getByLabel('كلمة المرور').fill(PASSWORD);
  await pt.getByRole('button', { name: 'دخول' }).click();
  await pt.locator('canvas').first().waitFor();
  await pt.goto(`${BASE}/patient/journey`);
  await pt.getByText(/^وصفة RX/).first().waitFor();
  await shot(pt, '22-patient-journey', width);
  await pt.locator('.card', { hasText: /^تحاليل/ }).first().getByRole('link', { name: 'التفاصيل' }).click();
  await pt.getByText('92').waitFor();
  await shot(pt, '23-patient-lab-result', width);
  await pt.goBack(); await pt.locator('.card', { hasText: /^وصفة RX/ }).first().getByRole('link', { name: 'التفاصيل' }).click();
  await pt.getByText('ثلاث مرات يومياً').waitFor();
  await shot(pt, '24-patient-prescription', width);
}
await browser.close();
console.log(problems.length ? 'PROBLEMS:\n' + [...new Set(problems)].join('\n') : 'OK: no overflow or page errors');
