// End-to-end UI journey against the running app + local Supabase:
// patient books → reception confirms + checks in → doctor calls the patient.
// Usage: node scripts/e2e-booking-journey.mjs [baseUrl]
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://127.0.0.1:5173';
const PASSWORD = 'Demo-Pass-2026!';
const A1 = '00000000-0000-4000-f000-0000000000a1';
const AHMED = '00000000-0000-4000-9000-000000000010';
const SVC = '00000000-0000-4000-6000-000000000002'; // 15-min review
const browser = await chromium.launch();
const step = (m) => console.log(`✓ ${m}`);
const ctxOpts = { viewport: { width: 1280, height: 900 }, locale: 'ar-IQ', timezoneId: 'Asia/Baghdad' };

// 1) Patient books via the web
const p = await (await browser.newContext(ctxOpts)).newPage();
await p.goto(`${BASE}/patient/account`);
await p.getByLabel('البريد الإلكتروني').fill('hasan@demo.test');
await p.getByLabel('كلمة المرور').fill(PASSWORD);
await p.getByRole('button', { name: 'دخول' }).click();
await p.locator('canvas').first().waitFor();
await p.goto(`${BASE}/patient/book/${A1}/${AHMED}?service=${SVC}`);
await p.locator('.day-btn:not([disabled])').first().click();
const dayLabel = await p.locator('.day-btn[aria-pressed="true"]').getAttribute('aria-label');
const isToday = (await p.locator('.day-btn').first().getAttribute('aria-pressed')) === 'true';
const slotBtn = p.locator('.slot-btn').last();
const slotText = (await slotBtn.innerText()).trim();
await slotBtn.click();
await p.getByRole('button', { name: 'التالي: مراجعة' }).click();
await p.getByRole('button', { name: 'إرسال طلب الحجز' }).click();
await p.getByText(/تم إرسال طلبك|تم تأكيد موعدك/).waitFor();
const bookingNo = (await p.locator('.code-pill').innerText()).trim();
await p.getByText('بانتظار التأكيد').first().waitFor();
step(`patient booked ${bookingNo} (${dayLabel}, ${slotText}) — status awaiting confirmation`);

// 2) Reception confirms (and checks in when the visit is today)
const r = await (await browser.newContext(ctxOpts)).newPage();
await r.goto(`${BASE}/login`);
await r.getByLabel('البريد الإلكتروني أو معرف الدخول').fill('reception.a@demo.test');
await r.getByLabel('كلمة المرور').fill(PASSWORD);
await r.getByRole('button', { name: 'دخول' }).click();
await r.waitForURL(/reception/);
if (!isToday) {
  // navigate forward day by day until the booked slot appears
  for (let i = 0; i < 21 && !(await r.locator('.appt-row', { hasText: slotText }).filter({ hasText: 'حسن علي' }).count()); i++) {
    await r.getByRole('button', { name: 'اليوم التالي' }).click();
    await r.waitForTimeout(500);
  }
}
const row = r.locator('.appt-row', { hasText: 'حسن علي' }).filter({ hasText: slotText }).filter({ hasText: 'بانتظار التأكيد' });
await row.getByRole('button', { name: 'تأكيد' }).click();
await r.locator('.appt-row', { hasText: 'حسن علي' }).filter({ hasText: slotText }).getByText('مؤكد').waitFor();
step('reception confirmed the request');

// patient sees the confirmation (status + in-app notification queued by the transaction)
await p.goto(`${BASE}/patient/appointments`);
await p.locator('.list-item', { hasText: bookingNo }).getByText('مؤكد').waitFor();
step('patient sees status "مؤكد" in My appointments');

if (isToday) {
  await r.locator('.appt-row', { hasText: 'حسن علي' }).filter({ hasText: slotText }).getByRole('button', { name: 'تسجيل حضور' }).click();
  await r.locator('.queue-item', { hasText: 'حسن علي' }).first().waitFor();
  step('reception checked the patient in → appears in the queue');

  // 3) Doctor sees the arrival at the current location and calls the patient
  const d = await (await browser.newContext(ctxOpts)).newPage();
  await d.goto(`${BASE}/login`);
  await d.getByLabel('البريد الإلكتروني أو معرف الدخول').fill('dr.ahmed@demo.test');
  await d.getByLabel('كلمة المرور').fill(PASSWORD);
  await d.getByRole('button', { name: 'دخول' }).click();
  await d.getByRole('button', { name: /عيادات الرافدين.*طبيب/ }).first().click();
  await d.waitForURL(/doctor/);
  const q = d.locator('.queue-item', { hasText: 'حسن علي' });
  await q.getByRole('button', { name: 'نداء' }).click();
  await d.getByText('تم نداء').waitFor();
  step('doctor sees the patient among arrivals and calls them');
} else {
  console.log('… booked slot is not today, so check-in / doctor call were skipped (check-in is allowed on the visit day only)');
}

await browser.close();
console.log('E2E journey passed');
