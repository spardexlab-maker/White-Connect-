// Phase 6 UI journey: fees + receipt at reception → facility report and
// expense by the facility admin → platform system health.
import { chromium } from 'playwright';
const BASE = process.argv[2] ?? 'http://127.0.0.1:5173';
const PASSWORD = 'Demo-Pass-2026!';
const browser = await chromium.launch();
const ctx = { viewport: { width: 1366, height: 900 }, locale: 'ar-IQ', timezoneId: 'Asia/Baghdad' };
const step = (m) => console.log(`✓ ${m}`);
async function pro(email) {
  const p = await (await browser.newContext(ctx)).newPage();
  await p.goto(`${BASE}/login`);
  await p.getByLabel('البريد الإلكتروني أو معرف الدخول').fill(email);
  await p.getByLabel('كلمة المرور').fill(PASSWORD);
  await p.getByRole('button', { name: 'دخول' }).click();
  await p.waitForURL(/workspace|platform-admin/);
  return p;
}
const r = await pro('reception.a@demo.test');
await r.waitForURL(/reception/);
await r.locator('.appt-row', { hasText: 'PDEMO00060' }).getByRole('button', { name: 'رسوم' }).click();
await r.getByText(/فاتورة I/).waitFor();
await r.getByRole('button', { name: /تسجيل دفع/ }).click();
await r.getByText('سُجل الدفع').waitFor();
await r.getByText('مدفوعة').waitFor();
await r.getByRole('link', { name: 'طباعة الإيصال' }).click();
await r.getByText('إيصال رسوم').waitFor();
await r.getByRole('button', { name: 'رجوع' }).click();
await r.getByRole('heading', { name: 'لوحة اليوم' }).waitFor();
step('reception created the visit invoice from the price snapshot, recorded payment, opened the receipt');

const d = await pro('dr.ahmed@demo.test');
await d.getByRole('button', { name: /عيادات الرافدين.*مدير منشأة/ }).click();
await d.goto(`${BASE}/workspace/organization/reports`);
await d.getByText('المحصّل').first().waitFor();
await d.getByText('٢٥٬٠٠٠ د.ع').first().waitFor();
await d.getByLabel('الفئة').fill('مستلزمات');
await d.getByLabel('المبلغ (د.ع)').fill('15000');
await d.getByRole('button', { name: 'إضافة' }).click();
await d.getByText('سُجل المصروف').waitFor();
step('facility admin sees collected revenue and records an expense (no medical data in the report)');

const a = await pro('admin@demo.test');
await a.goto(`${BASE}/platform-admin/health`);
await a.getByText('المهام المجدولة').waitFor();
await a.getByText('expire-pending-appointments').waitFor();
step('platform admin sees scheduled jobs and backlogs');
await browser.close();
console.log('Operations E2E passed');
