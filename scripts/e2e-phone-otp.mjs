// WhatsApp sign-in, end to end in the browser, with a local test number (fixed code,
// nothing is sent): number → code → first-time profile with the verified number filled in;
// a wrong number is refused before anything is sent.
// Usage: node scripts/e2e-phone-otp.mjs [base-url]   (SHOTS=<dir> to save screenshots)
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://127.0.0.1:5173';
const SHOTS = process.env.SHOTS;
// local test numbers (supabase/config.toml); one number can ask again only after 60 s
const N = process.env.TEST_PHONE ?? '2';
const browser = await chromium.launch();
const errors = [];
const step = (s) => console.log('✓ ' + s);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); };

const p = await (await browser.newContext({ locale: 'ar', viewport: { width: 420, height: 900 } })).newPage();
p.on('pageerror', (e) => errors.push(e.message));
await p.goto(`${BASE}/patient/account`);

await p.getByLabel('رقم الموبايل').fill('0612 345 678');
await p.getByRole('button', { name: 'أرسل الرمز على واتساب' }).click();
await p.getByText('اكتب رقم موبايل عراقي صحيح').waitFor();
step('a non-Iraqi-mobile number is refused before sending');

await p.getByLabel('رقم الموبايل').fill(`0770 000 000${N}`);
await shot(p, 'otp-1-phone');
await p.getByRole('button', { name: 'أرسل الرمز على واتساب' }).click();
await p.getByText('بعثنا رمزاً من 6 أرقام على واتساب الرقم').waitFor();
await p.getByText('إعادة الإرسال بعد').waitFor();
step('the code is requested and resend waits 60 seconds');

await p.getByLabel('رمز الدخول').fill('111111');
await p.getByRole('button', { name: 'دخول', exact: true }).first().click();
await p.getByText('الرمز غير صحيح أو انتهت صلاحيته').waitFor();
step('a wrong code is refused in Arabic');

await p.getByLabel('رمز الدخول').fill('123456');
await shot(p, 'otp-2-code');
await p.getByRole('button', { name: 'دخول', exact: true }).first().click();
const phoneField = p.getByLabel('رقم الهاتف');
await phoneField.waitFor();
if ((await phoneField.inputValue()) !== `0770000000${N}`) throw new Error(`verified number not prefilled: ${await phoneField.inputValue()}`);
await shot(p, 'otp-3-profile');
step('signed in; the first-time profile already has the verified number');

await browser.close();
if (errors.length) { console.error('page errors:', errors); process.exit(1); }
console.log('WhatsApp sign-in E2E passed');
