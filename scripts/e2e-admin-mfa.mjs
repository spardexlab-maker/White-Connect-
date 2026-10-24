// Admin MFA journey: platform admin without a factor is sent to enroll,
// enrolls TOTP, reaches the admin panel; a new login requires the code.
// Requires platform_settings.require_admin_mfa = true on the target DB.
import { chromium } from 'playwright';
import { createHmac } from 'node:crypto';

const BASE = process.argv[2] ?? 'http://127.0.0.1:5173';
function totp(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of secret.replace(/=+$/, '').toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac('sha1', key).update(counter).digest();
  const o = h[h.length - 1] & 15;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, '0');
}
const browser = await chromium.launch();
const ctx = { viewport: { width: 1280, height: 900 }, locale: 'ar-IQ' };
async function login(page) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel('البريد الإلكتروني أو معرف الدخول').fill('admin@demo.test');
  await page.getByLabel('كلمة المرور').fill('Demo-Pass-2026!');
  await page.getByRole('button', { name: 'دخول', exact: true }).click();
  await page.waitForURL(/workspace/);
}
const p = await (await browser.newContext(ctx)).newPage();
await login(p);
await p.goto(`${BASE}/platform-admin`);
await p.waitForURL(/security/);
await p.getByText('أو أدخل المفتاح يدوياً').waitFor();
const secret = (await p.locator('.code-pill').innerText()).trim();
console.log('✓ admin without MFA is redirected to enrollment (QR shown)');
await p.getByLabel('رمز التحقق').fill(totp(secret));
await p.getByRole('button', { name: 'تفعيل' }).click();
await p.waitForURL(/platform-admin$/);
await p.locator('.kpi').first().waitFor();
console.log('✓ after verifying the code the admin panel opens (aal2)');

const p2 = await (await browser.newContext(ctx)).newPage();
await login(p2);
await p2.goto(`${BASE}/platform-admin`);
await p2.waitForURL(/security/);
await p2.getByText('أدخل الرمز الحالي').waitFor();
await p2.getByLabel('رمز التحقق').fill('000000');
await p2.getByRole('button', { name: 'تحقق' }).click();
await p2.getByText('الرمز غير صحيح').waitFor();
console.log('✓ new login: wrong code rejected');
await p2.getByLabel('رمز التحقق').fill(totp(secret));
await p2.getByRole('button', { name: 'تحقق' }).click();
await p2.waitForURL(/platform-admin$/);
await p2.locator('.kpi').first().waitFor();
console.log('✓ new login: correct code grants access');
await browser.close();
console.log('Admin MFA E2E passed');
