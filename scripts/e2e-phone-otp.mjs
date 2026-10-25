// WhatsApp sign-in and number linking, end to end in the browser, with local test numbers
// (supabase/config.toml: fixed code 123456, nothing is sent):
//  1. a new number signs up: code boxes → wrong code shakes back → right code → check mark
//     → first-time profile with the verified number filled in;
//  2. signing in again with that number opens the same account;
//  3. an email account links a number (code to the NEW number) and then signs in by phone
//     into that same account; a number that belongs to another account is refused.
// Usage: node scripts/e2e-phone-otp.mjs [base-url]   (SHOTS=<dir> to save screenshots)
// Needs a fresh `supabase db reset` (the test numbers must not exist yet).
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://127.0.0.1:5173';
const SHOTS = process.env.SHOTS;
const browser = await chromium.launch();
const errors = [];
const step = (s) => console.log('✓ ' + s);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); };

async function page() {
  const p = await (await browser.newContext({ locale: 'ar', viewport: { width: 420, height: 900 } })).newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`${BASE}/patient/account`);
  return p;
}
const typeCode = async (p, code) => {
  const first = p.getByLabel('الرقم 1');
  await first.waitFor();
  await first.click();
  await p.keyboard.type(code, { delay: 60 });
};
async function phoneSignIn(p, local) {
  await p.getByLabel('رقم الموبايل', { exact: true }).fill(local);
  await p.getByRole('button', { name: 'أرسل الرمز على واتساب' }).click();
  await p.getByText('أدخل رمز الدخول').waitFor();
  await typeCode(p, '123456');
  await p.getByText('تم التحقق').first().waitFor();
}

// 1) a new number signs up
const p = await page();
await p.getByLabel('رقم الموبايل', { exact: true }).fill('0612 345 678');
await p.getByRole('button', { name: 'أرسل الرمز على واتساب' }).click();
await p.getByText('اكتب رقم موبايل عراقي صحيح').waitFor();
step('a non-Iraqi-mobile number is refused before anything is sent');
await p.getByLabel('رقم الموبايل', { exact: true }).fill('0770 000 0003');
await shot(p, 'otp-1-phone');
await p.getByRole('button', { name: 'أرسل الرمز على واتساب' }).click();
await p.getByText('أدخل رمز الدخول').waitFor();
await p.getByText('إعادة الإرسال بعد').waitFor();
await shot(p, 'otp-2-boxes');
await typeCode(p, '111111');
await p.getByText('الرمز غير صحيح أو انتهت صلاحيته').waitFor();
step('a wrong code shakes back with an Arabic message');
await typeCode(p, '123456');
await p.getByText('جارٍ التحقق…').waitFor();
await shot(p, 'otp-3-verifying');
await p.getByText('أهلاً بك، جارٍ فتح حسابك…').waitFor();
await p.waitForTimeout(500);
await shot(p, 'otp-4-granted');
const phoneField = p.getByLabel('رقم الهاتف');
await phoneField.waitFor();
if ((await phoneField.inputValue()) !== '07700000003') throw new Error(`verified number not prefilled: ${await phoneField.inputValue()}`);
await p.getByLabel('الاسم الكامل').fill('زينب حيدر');
await p.getByRole('button', { name: 'حفظ الملف' }).click();
await p.getByText('مربوط بالرقم').waitFor();
step('code boxes → verifying ring → check mark → profile with the verified number → signed in');

// 2) signing in again with that number opens the same account
await p.getByRole('button', { name: 'خروج' }).click();
await p.waitForTimeout(61_000);                       // one number may ask for a new code once a minute
await phoneSignIn(p, '07700000003');
await p.getByText('زينب حيدر').first().waitFor();
if (await p.getByText('أكمل ملفك كمريض').count()) throw new Error('a second account was made for the same number');
step('signing in again with the same number opens the same account');

// 3) an email account links a number, then signs in by phone into the same account
const h = await page();
await h.getByRole('button', { name: /الدخول بالبريد الإلكتروني/ }).click();
await h.getByLabel('البريد الإلكتروني').fill('hasan@demo.test');
await h.getByLabel('كلمة المرور').fill('Demo-Pass-2026!');
await h.getByRole('button', { name: 'دخول', exact: true }).click();
await h.getByRole('button', { name: 'ربط رقم الموبايل' }).click();
await h.getByLabel('رقم الموبايل', { exact: true }).fill('0770 000 0003');
await h.getByRole('button', { name: 'أرسل رمز التأكيد على واتساب' }).click();
await h.getByText('هذا الرقم مربوط بحساب ثاني').waitFor();
step('a number that belongs to another account is refused (no merge, no takeover)');
await h.getByLabel('رقم الموبايل', { exact: true }).fill('0770 000 0004');
await h.getByRole('button', { name: 'أرسل رمز التأكيد على واتساب' }).click();
await typeCode(h, '123456');
await h.getByText('مربوط بالرقم').waitFor();
await shot(h, 'otp-5-linked');
step('the email account links 0770 000 0004 with a WhatsApp code');
await h.getByRole('button', { name: 'خروج' }).click();
await h.waitForTimeout(61_000);
await phoneSignIn(h, '07700000004');
await h.getByText('hasan@demo.test').first().waitFor();
if (await h.getByText('أكمل ملفك كمريض').count()) throw new Error('phone sign-in did not reach the linked account');
step('signing in with the linked number opens the same email account');

await browser.close();
if (errors.length) { console.error('page errors:', errors); process.exit(1); }
console.log('WhatsApp sign-in and linking E2E passed');
