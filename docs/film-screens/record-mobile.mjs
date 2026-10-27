// Records the patient clips on the phone app (its web build, 390×844 @2x) as «حسن علي»,
// after record-pro.mjs gave him a visit, a prescription, a released result and a med plan.
// The AI assistant's answer is a fixed, realistic reply (the local stack has no AI key).
// Usage: node docs/film-screens/record-mobile.mjs <clips-dir> [mobile-web-export-dir]
import { chromium } from 'playwright';
import { serveMobile } from './serve-mobile.mjs';
import { preparePage, record, tap, type, scroll, pause } from './rec-lib.mjs';

const dir = process.argv[2];
const srv = serveMobile(process.argv[3] ?? 'apps/mobile/dist-local');
const BASE = 'http://127.0.0.1:8099';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ar-IQ', timezoneId: 'Asia/Baghdad', hasTouch: false })).newPage();
await preparePage(p);

const ANSWER = [
  'سلامتك. ', 'الصداع اللي صارله أسبوع ويا حرارة ', 'يحتاج تقييم من طبيب. ',
  'أنصحك تراجع طبيب باطنية ', 'حتى يفحصك ويشوف السبب، ', 'وممكن يطلب منك تحليل بسيط مثل صورة الدم. ',
  'وإذا صار عندك تيبّس بالرقبة أو تقيؤ شديد، روح للطوارئ فوراً.',
];
await p.route('**/functions/v1/ai-chat', async (route) => {
  const ev = (o) => `data: ${JSON.stringify(o)}\n\n`;
  const body = ANSWER.map((t) => ev({ t })).join('') + ev({ done: true, specialty: { id: '00000000-0000-4000-d000-000000000001', name: 'باطنية' }, labs: ['صورة دم كاملة (CBC)'], emergency: false });
  await new Promise((r) => setTimeout(r, 1400));
  await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' }, body });
});

const tabBar = (label) => p.getByText(label, { exact: true }).last();
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const clip = async (name, fn) => {
  if (only && !only.includes(name)) return;
  try { await record(p, dir, name, fn, { maxWidth: 780, maxHeight: 1688 }); }
  catch (e) { await p.screenshot({ path: `${dir}/_fail-${name}.png` }).catch(() => {}); console.log(`✗ ${name}: ${String(e.message).split('\n')[0]}`); }
};

// sign in once (not recorded)
await p.goto(`${BASE}/account`);
await p.getByRole('button', { name: /الدخول بالبريد الإلكتروني/ }).click();
await p.getByLabel('البريد الإلكتروني').fill('hasan@demo.test');
await p.getByLabel('كلمة المرور', { exact: true }).fill('Demo-Pass-2026!');
await p.getByRole('button', { name: 'دخول', exact: true }).click();
await p.getByText('خروج').first().waitFor({ timeout: 15000 });
await p.goto(`${BASE}/`);
await p.getByText('كيف نساعدك اليوم').waitFor();
await p.getByText('أقرب موعد').first().waitFor({ timeout: 15000 });

await clip('m_home', async () => {
  await pause(p, 2600);                      // the animated hero
  await tap(p, p.getByText('باطنية', { exact: true }).first(), { after: 1000 });
  await scroll(p, 520, 1500);
  await pause(p, 700);
  await scroll(p, -520, 1100);
  await tap(p, p.getByText('مختبرات', { exact: true }).first(), { after: 1300 });
  await tap(p, p.getByText('أطباء', { exact: true }).first(), { after: 900 });
});

await clip('m_ai', async () => {
  const input = p.getByPlaceholder(/مثال: عندي صداع/).first();
  await type(p, input, 'عندي صداع من أسبوع ويا حرارة', 75);
  await p.keyboard.press('Enter');
  await pause(p, 800);
  if (!/assistant/.test(p.url())) {
    const send = p.getByRole('button', { name: /إرسال|اسأل/ }).first();
    if (await send.count()) await tap(p, send);
  }
  await p.getByText(/باطنية/).last().waitFor({ timeout: 15000 });
  await pause(p, 2500);
  await scroll(p, 500, 1400);
  await pause(p, 1800);
});

await p.goto(`${BASE}/`);
await p.getByText('أقرب موعد').first().waitFor({ timeout: 15000 });
await clip('m_book', async () => {
  await pause(p, 700);
  await tap(p, p.getByRole('link', { name: /عرض المواعيد والحجز/ }).first());
  await p.getByText('الخدمات').first().waitFor();
  await pause(p, 1200);
  await scroll(p, 400, 1100);
  await tap(p, p.getByRole('button', { name: 'احجز موعداً' }));
  await p.getByText('اختر نوع الزيارة').waitFor();
  await tap(p, p.getByRole('radio').first());
  await tap(p, p.getByRole('button', { name: 'التالي: اختيار الموعد' }));
  await p.getByText('اختر اليوم والوقت').waitFor();
  await pause(p, 600);
  const days = p.getByRole('button', { name: /الخميس|الأربعاء/ });
  if (await days.count()) await tap(p, days.first(), { after: 900 });
  await tap(p, p.getByRole('button', { name: /^[٠-٩0-9]{1,2}[:٫][٠-٩0-9]{2}/ }).first());
  await tap(p, p.getByRole('button', { name: 'التالي: مراجعة' }));
  await p.getByText('راجع تفاصيل الحجز').waitFor();
  await pause(p, 900);
  await tap(p, p.getByRole('button', { name: 'إرسال طلب الحجز' }));
  await p.getByText(/تم إرسال طلبك|تم تأكيد موعدك/).waitFor({ timeout: 15000 });
  await pause(p, 1800);
});

await clip('m_card', async () => {
  await tap(p, p.getByRole('button', { name: 'عرض حجوزاتي' }));
  await p.getByText(/القادمة \(\d+\)/).waitFor();
  await pause(p, 1600);
  await tap(p, tabBar('حسابي'));
  await p.getByLabel('رمز QR للتعريف في العيادة').first().waitFor({ timeout: 15000 });
  await pause(p, 700);
  await scroll(p, 380, 1200);
  await pause(p, 1800);
});

await clip('m_journey', async () => {
  await tap(p, tabBar('رحلتي'));
  await p.getByText('عن هذه الصفحة').waitFor();
  await pause(p, 1000);
  await tap(p, p.getByText('الوصفات', { exact: true }).first(), { after: 1200 });
  await tap(p, p.getByText('الزيارات', { exact: true }).first(), { after: 1200 });
  await tap(p, p.getByText('زيارة — التشخيص والتعليمات').first().locator('xpath=ancestor::*[.//*[text()="التفاصيل"]][1]').getByText('التفاصيل', { exact: true }).first(), { after: 1800 });
  await scroll(p, 600, 1800);
  await pause(p, 1200);
});

await clip('m_labs', async () => {
  await tap(p, tabBar('صحتي'));
  await p.getByText('تحاليلي').first().waitFor();
  await scroll(p, 260, 900);
  await pause(p, 2200);
  await p.goto(`${BASE}/lab-orders`);
  await p.getByText('طلبات التحاليل').first().waitFor();
  await pause(p, 2200);
});

await p.goto(`${BASE}/home-lab`);
await p.getByText(/سحب منزلي/).first().waitFor();
await clip('m_homelab', async () => {
  await pause(p, 1800);
  await tap(p, p.getByText(/طلب سحب منزلي جديد/).first(), { after: 1500 });
  await scroll(p, 400, 1200);
  await pause(p, 1200);
});

await p.goto(`${BASE}/meds`);
await p.getByText(/Paracetamol|باراسيتامول/).first().waitFor();
await clip('m_meds', async () => {
  await pause(p, 1500);
  await tap(p, p.getByRole('button', { name: /^أخذت/ }).first());
  await pause(p, 1800);
  await scroll(p, 300, 1000);
  await pause(p, 800);
});

await b.close(); srv.close();
console.log('mobile clips recorded');
