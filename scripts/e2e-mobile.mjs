// Mobile patient app journey on its web build at phone size (390×844):
// search → provider → book (sign in inline) → my appointments → QR card → journey.
// Usage: node scripts/e2e-mobile.mjs <expo-web-export-dir> [screenshots-dir]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const dir = process.argv[2];
const shots = process.argv[3];
if (!dir) { console.error('usage: node scripts/e2e-mobile.mjs <export-dir> [shots-dir]'); process.exit(2); }
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json', '.ico': 'image/x-icon' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try { const body = await readFile(join(dir, path)); res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(200, { 'content-type': 'text/html' }); res.end(await readFile(join(dir, 'index.html'))); }
}).listen(8099);
const BASE = 'http://127.0.0.1:8099';
const step = (m) => console.log('✓', m);
const shot = async (p, name) => { if (shots) await p.screenshot({ path: `${shots}/${name}.png` }); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ar-IQ', timezoneId: 'Asia/Baghdad' });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
try {
  await p.goto(BASE);
  await p.getByText('كيف نساعدك اليوم').waitFor();
  await p.getByText('أقرب موعد').first().waitFor({ timeout: 15000 });
  const dir_ = await p.evaluate(() => document.documentElement.dir);
  if (dir_ !== 'rtl') throw new Error('document is not RTL');
  step('home lists doctors with next free slot (RTL)');
  await shot(p, 'm01-home');

  await p.getByRole('button', { name: 'عرض المواعيد والحجز' }).first().click();
  await p.getByText('الخدمات').first().waitFor();
  step('provider profile opens');
  await shot(p, 'm02-provider');

  await p.getByRole('button', { name: 'احجز موعداً' }).click();
  await p.getByText('اختر نوع الزيارة').waitFor();
  await p.getByRole('radio').first().click();
  await p.getByRole('button', { name: 'التالي: اختيار الموعد' }).click();
  await p.getByText('اختر اليوم والوقت').waitFor();
  await p.waitForTimeout(800);
  await shot(p, 'm03-slots');
  // pick the first free time on the selected day
  await p.getByRole('button', { name: /^[٠-٩0-9]{1,2}[:٫][٠-٩0-9]{2}/ }).first().click();
  await p.getByRole('button', { name: 'التالي: مراجعة' }).click();
  await p.getByText('راجع تفاصيل الحجز').waitFor();
  step('service + slot chosen, review shown');

  await p.getByLabel('البريد الإلكتروني').fill('mona@demo.test');
  await p.getByLabel('كلمة المرور').fill('Demo-Pass-2026!');
  await shot(p, 'm04-review-signin');
  await p.getByRole('button', { name: 'دخول' }).click();
  await p.getByRole('button', { name: 'إرسال طلب الحجز' }).waitFor({ timeout: 15000 });
  step('signed in inline without losing the chosen slot');
  await p.getByRole('button', { name: 'إرسال طلب الحجز' }).click();
  await p.getByText('تم تسجيل طلبك').waitFor({ timeout: 15000 });
  await shot(p, 'm05-booked');
  step('booking submitted');

  await p.getByRole('button', { name: 'عرض حجوزاتي' }).click();
  await p.getByText(/القادمة \(\d+\)/).waitFor();
  await p.getByRole('button', { name: 'إلغاء الموعد' }).first().waitFor();
  await shot(p, 'm06-appointments');
  step('appointment visible in My appointments');

  await p.goto(`${BASE}/account`);
  await p.getByLabel('رمز QR للتعريف في العيادة').first().waitFor({ timeout: 15000 });
  await shot(p, 'm07-account-qr');
  step('QR identity card rendered');

  await p.goto(`${BASE}/journey`);
  await p.getByText('عن هذه الصفحة').waitFor();
  await shot(p, 'm08-journey');
  step('journey timeline loads');

  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (overflow) throw new Error('horizontal overflow at 390px');
  if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
  console.log('MOBILE E2E PASSED');
} catch (e) {
  await p.screenshot({ path: `${shots ?? '.'}/m-failure.png` }).catch(() => {});
  console.error('FAILED:', e.message, errors);
  process.exitCode = 1;
} finally {
  await browser.close(); server.close();
}
