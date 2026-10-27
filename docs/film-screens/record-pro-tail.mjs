// Records the doctor, reception, pharmacy and lab clips on the web app (one real visit
// for the demo patient «حسن علي», from the walk-in to the released result).
// Usage: node docs/film-screens/record-pro.mjs <clips-dir> [base-url]
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { preparePage, record, tap, type, scroll, pause } from './rec-lib.mjs';

const dir = process.argv[2];
const BASE = process.argv[3] ?? 'http://127.0.0.1:4173';
const PASSWORD = 'Demo-Pass-2026!';
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const b = await chromium.launch();
const ctxOpts = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, locale: 'ar-IQ', timezoneId: 'Asia/Baghdad', reducedMotion: 'no-preference' };

async function pro(email) {
  const page = await (await b.newContext(ctxOpts)).newPage();
  await preparePage(page);
  await page.goto(`${BASE}/login`);
  await page.getByLabel('البريد الإلكتروني أو معرف الدخول').fill(email);
  await page.getByLabel('كلمة المرور').fill(PASSWORD);
  await page.getByRole('button', { name: 'دخول', exact: true }).click();
  await page.waitForURL(/workspace/);
  await page.waitForTimeout(800);
  return page;
}
const clip = async (page, name, fn) => {
  try { return await (only && !only.includes(name) ? fn() : record(page, dir, name, fn)); }
  catch (e) { await page.screenshot({ path: `${dir}/_fail-${name}.png` }).catch(() => {}); console.log(`✗ ${name}: ${String(e.message).split('\n')[0]}`); }
};

const d = await pro('dr.ahmed@demo.test');
await d.getByRole('button', { name: /عيادات الرافدين.*طبيب/ }).first().click();
await d.waitForURL(/doctor$/);
const lt = await pro('lab.a@demo.test');
await lt.waitForURL(/lab/);
// an open order ("any lab") issued by the doctor, claimed by the lab with its code
const enc = await d.locator('a[href*="/workspace/doctor/session/"]').first().getAttribute('href').catch(() => null);
let code = null;
if (enc) {
  await d.goto(`${BASE}${enc}`);
  await d.getByRole('tab', { name: /^تحاليل/ }).click();
  await d.getByRole('button', { name: 'أي مختبر (رمز للمريض)' }).click();
  await d.getByRole('button', { name: 'السكر التراكمي HbA1c', exact: true }).click();
  await d.getByRole('button', { name: 'إصدار الطلب للمريض' }).click();
  await d.getByText('صدر طلب التحاليل').waitFor();
  code = (await d.locator('.open-code').first().textContent()).trim();
}
if (code) {
  await lt.getByRole('link', { name: 'طلب برمز (QR)' }).click();
  await lt.waitForTimeout(1000);
  await clip(lt, 'w_lab_qr', async () => {
    await pause(lt, 800);
    await type(lt, lt.getByLabel('رمز الطلب'), code, 110);
    await tap(lt, lt.getByRole('button', { name: 'عرض الطلب' }));
    await lt.getByText('حسن').first().waitFor();
    await pause(lt, 1500);
    await tap(lt, lt.getByRole('button', { name: /استلام \d+ تحليل/ }));
    await lt.getByText(/أُضيف الطلب/).waitFor();
    await pause(lt, 1500);
  });
}
await lt.goto(`${BASE}/workspace/lab/home`); await lt.waitForTimeout(1500);
await clip(lt, 'w_lab_home', async () => {
  await pause(lt, 1000);
  const tabs = lt.getByRole('tab');
  for (let i = 0; i < Math.min(4, await tabs.count()); i++) await tap(lt, tabs.nth(i), { after: 1000 });
  const open = lt.getByRole('button', { name: /فتح|التفاصيل|عرض/ }).first();
  if (await open.count()) { await tap(lt, open, { after: 2000 }); }
});
await lt.goto(`${BASE}/workspace/lab/doctors`); await lt.waitForTimeout(1500);
await clip(lt, 'w_lab_doctors', async () => { await pause(lt, 1500); await scroll(lt, 400, 1500); await pause(lt, 800); });

// ---------- doctor: result review, schedule, profile ----------
await d.goto(`${BASE}/workspace/doctor`); await d.waitForTimeout(1500);
await clip(d, 'w_doc_result', async () => {
  await pause(d, 800);
  await d.getByText('نتائج تحتاج مراجعة').first().waitFor();
  await tap(d, d.locator('.list-item', { hasText: 'حسن علي' }).getByRole('link', { name: 'عرض النتيجة' }).first());
  await d.getByText('104').first().waitFor();
  await pause(d, 1500);
  await scroll(d, 400, 1200);
  await pause(d, 800);
});
await d.goto(`${BASE}/workspace/doctor/schedule`); await d.waitForTimeout(1500);
await clip(d, 'w_doc_schedule', async () => {
  await pause(d, 1200); await scroll(d, 500, 1600); await pause(d, 600);
  await d.goto(`${BASE}/workspace/doctor/profile`); await d.waitForTimeout(1500);
  await scroll(d, 500, 1600); await pause(d, 800);
});

await b.close();
console.log('pro clips recorded');
