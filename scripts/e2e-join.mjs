// «استمارة انضمام طبيب»: a visitor fills the public form, the super admin sees it,
// marks it contacted, and the form also prints as a paper form.
// Usage: node scripts/e2e-join.mjs [base-url]   (SHOTS=<dir> to save screenshots + the printed PDF)
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://127.0.0.1:5173';
const SHOTS = process.env.SHOTS;
const step = (m) => console.log('✓', m);
const b = await chromium.launch();
const errors = [];

const v = await (await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ar-IQ' })).newPage();
v.on('pageerror', (e) => errors.push(e.message));
await v.goto(`${BASE}/login`);
await v.getByRole('link', { name: 'املأ استمارة الانضمام' }).click();
await v.getByRole('heading', { name: /استمارة انضمام طبيب/ }).waitFor();
if (SHOTS) await v.pdf({ path: `${SHOTS}/join-form-print.pdf`, format: 'A4', printBackground: true }).catch(() => undefined);
await v.getByLabel('الاسم الكامل (كما يظهر للمرضى)').fill('سارة محمد علي');
await v.getByLabel('الاختصاص', { exact: true }).selectOption({ index: 1 });
await v.getByLabel('رقم إجازة ممارسة المهنة / هوية النقابة').fill('IQ-55821');
await v.getByLabel('سنوات الخبرة').fill('9');
await v.getByLabel('الشهادات والمؤهلات').fill('بكالوريوس طب وجراحة — بغداد، البورد العربي');
await v.getByLabel('رقم الهاتف').fill('07805550101');
await v.getByLabel('البريد الإلكتروني').fill('dr.sara@example.com');
await v.getByLabel('اسم العيادة / المجمع').fill('عيادة النور التخصصية');
await v.getByLabel('العنوان بالتفصيل').fill('بغداد، المنصور، شارع 14 رمضان، بناية الأطباء، ط2');
await v.getByLabel('أيام وساعات الدوام').fill('السبت–الخميس 4–9 مساءً');
await v.getByLabel('سعر الكشفية (دينار)').fill('25000');
await v.getByLabel('سعر الخدمة 1').fill('25000');
await v.getByLabel('سعر الخدمة 2').fill('10000');
await v.getByLabel('نبذة عنك').fill('أخصائية باطنية بخبرة 9 سنوات في السكري والضغط.');
const send = v.getByRole('button', { name: 'إرسال الاستمارة' });
if (await send.isEnabled()) throw new Error('the form must need the confirmation first');
await v.getByText(/أقرّ بأن المعلومات أعلاه صحيحة/).click();
if (SHOTS) await v.screenshot({ path: `${SHOTS}/join-form.png`, fullPage: true });
await send.click();
await v.getByText('وصلتنا استمارتك، شكراً لك').waitFor();
const num = (await v.locator('strong[dir=ltr]').first().innerText()).trim();
step(`a visitor without an account submitted the doctor form (${num})`);

const a = await (await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ar-IQ' })).newPage();
a.on('pageerror', (e) => errors.push(e.message));
await a.goto(`${BASE}/login`);
await a.getByLabel('البريد الإلكتروني').fill('admin@demo.test');
await a.getByLabel('كلمة المرور').fill('Demo-Pass-2026!');
await a.getByRole('button', { name: /دخول/ }).click();
await a.waitForURL((u) => !u.pathname.startsWith('/login'));
await a.goto(`${BASE}/platform-admin/applications`);
await a.getByText('سارة محمد علي').first().click();
await a.getByText('IQ-55821').waitFor();
await a.getByText('عيادة النور التخصصية').first().waitFor();
if (SHOTS) await a.screenshot({ path: `${SHOTS}/join-admin.png`, fullPage: true });
await a.getByLabel('ملاحظة').fill('اتصلت بها، تزورنا الأحد بالشهادات');
await a.getByRole('button', { name: 'تم التواصل' }).click();
await a.getByText('حُدّث الطلب').waitFor();
await a.getByRole('tab', { name: /تم التواصل \(1\)/ }).waitFor();
step('the super admin reviews the application and marks it contacted');

await b.close();
if (errors.length) { console.log('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('Join form E2E passed');
