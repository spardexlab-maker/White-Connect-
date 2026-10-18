// Captures real browser screenshots of the running app (dev server + local
// Supabase with synthetic seed data) at the target widths, and reports any
// horizontal page overflow. Usage: node scripts/screenshots.mjs [baseUrl]
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://127.0.0.1:5173';
const OUT = 'docs/screenshots';
const WIDTHS = [360, 390, 768, 1024, 1440];
const PASSWORD = 'Demo-Pass-2026!';
const A1 = '00000000-0000-4000-f000-0000000000a1';
const AHMED = '00000000-0000-4000-9000-000000000010';
mkdirSync(OUT, { recursive: true });

const exe = undefined; void existsSync;
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const problems = [];

async function shot(page, name, width) {
  await page.waitForTimeout(700);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) problems.push(`${name}@${width}: horizontal overflow ${overflow}px`);
  await page.screenshot({ path: `${OUT}/${name}-${width}.png`, fullPage: true });
}

async function newPage(width) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 768 ? 800 : 900 }, locale: 'ar-IQ', timezoneId: 'Asia/Baghdad' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) problems.push(`console: ${m.text().slice(0, 160)}`); });
  page.on('response', async (r) => {
    if (r.status() >= 400) problems.push(`HTTP ${r.status()} ${r.request().method()} ${r.url().replace(/^https?:\/\/[^/]+/, '').slice(0, 90)} ${(await r.text().catch(() => '')).slice(0, 140)}`);
  });
  return { ctx, page };
}

async function proLogin(page, email) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel('البريد الإلكتروني أو معرف الدخول').fill(email);
  await page.getByLabel('كلمة المرور').fill(PASSWORD);
  await page.getByRole('button', { name: 'دخول' }).click();
  await page.waitForURL(/workspace|platform-admin/);
}

for (const width of WIDTHS) {
  // ---------------- Patient (anonymous) ----------------
  {
    const { ctx, page } = await newPage(width);
    await page.goto(`${BASE}/patient`);
    await page.getByText('أقرب موعد').first().waitFor({ timeout: 10000 }).catch(() => {});
    await shot(page, '01-patient-home', width);
    await page.goto(`${BASE}/patient/provider/${A1}/${AHMED}`);
    await page.getByRole('heading', { level: 1 }).waitFor();
    await shot(page, '02-provider', width);
    await page.goto(`${BASE}/patient/book/${A1}/${AHMED}?service=00000000-0000-4000-6000-000000000001`);
    await page.locator('.slot-btn').first().waitFor({ timeout: 10000 }).catch(() => {});
    const day = page.locator('.day-btn:not([disabled])').first();
    if (await day.count()) await day.click();
    await page.locator('.slot-btn').first().click().catch(() => {});
    await shot(page, '03-booking-time', width);
    await ctx.close();
  }
  // ---------------- Patient (signed in) ----------------
  if (width === 390 || width === 1440) {
    const { ctx, page } = await newPage(width);
    await page.goto(`${BASE}/patient/account`);
    await page.getByLabel('البريد الإلكتروني').fill('hasan@demo.test');
    await page.getByLabel('كلمة المرور').fill(PASSWORD);
    await page.getByRole('button', { name: 'دخول' }).click();
    await page.locator('canvas').first().waitFor({ timeout: 10000 });
    await shot(page, '04-patient-card', width);
    await page.goto(`${BASE}/patient/appointments`);
    await page.locator('.list-item').first().waitFor({ timeout: 10000 }).catch(() => {});
    await shot(page, '05-my-appointments', width);
    // booking review step for a signed-in patient
    await page.goto(`${BASE}/patient/book/${A1}/${AHMED}?service=00000000-0000-4000-6000-000000000002`);
    await page.locator('.day-btn:not([disabled])').first().click({ timeout: 10000 }).catch(() => {});
    await page.locator('.slot-btn').first().click().catch(() => {});
    await page.getByRole('button', { name: 'التالي: مراجعة' }).click().catch(() => {});
    await shot(page, '06-booking-review', width);
    await ctx.close();
  }
  // ---------------- Reception ----------------
  if (width >= 390) {
    const { ctx, page } = await newPage(width);
    await proLogin(page, 'reception.a@demo.test');
    await page.waitForURL(/reception/);
    await page.locator('.appt-row').first().waitFor({ timeout: 10000 }).catch(() => {});
    await shot(page, '07-reception-board', width);
    await page.getByRole('button', { name: /حجز سريع/ }).click();
    await page.getByLabel('اسم المريض').fill('مريض تجريبي جديد');
    await page.locator('.sheet .slot-btn').first().waitFor({ timeout: 8000 }).catch(() => {});
    await shot(page, '08-reception-quick-book', width);
    await ctx.close();
  }
  // ---------------- Doctor (two locations → workspace picker) ----------------
  if (width === 1440 || width === 390) {
    const { ctx, page } = await newPage(width);
    await proLogin(page, 'dr.ahmed@demo.test');
    await page.locator('.list-item').first().waitFor();
    await shot(page, '09-workspace-picker', width);
    await page.getByRole('button', { name: /عيادات الرافدين.*طبيب/ }).first().click();
    await page.waitForURL(/doctor/);
    await page.locator('.queue-item, .state').first().waitFor({ timeout: 10000 }).catch(() => {});
    await shot(page, '10-doctor-today', width);
    await page.goto(`${BASE}/workspace/doctor/schedule`);
    await page.getByText('الجدول الأسبوعي').waitFor({ timeout: 10000 }).catch(() => {});
    await shot(page, '11-doctor-schedule', width);
    await ctx.close();
  }
  // ---------------- Platform admin ----------------
  if (width === 1440) {
    const { ctx, page } = await newPage(width);
    await proLogin(page, 'admin@demo.test');
    await page.goto(`${BASE}/platform-admin`);
    await page.locator('.kpi').first().waitFor({ timeout: 10000 }).catch(() => {});
    await shot(page, '12-admin-overview', width);
    await page.goto(`${BASE}/platform-admin/organizations`);
    await page.getByText('الهيكل').waitFor({ timeout: 10000 }).catch(() => {});
    await shot(page, '13-admin-organizations', width);
    await page.goto(`${BASE}/dev/components`);
    await shot(page, '14-component-gallery', width);
    await ctx.close();
  }
}

await browser.close();
console.log(problems.length ? `PROBLEMS:\n${[...new Set(problems)].join('\n')}` : 'OK: no horizontal overflow or page errors');
