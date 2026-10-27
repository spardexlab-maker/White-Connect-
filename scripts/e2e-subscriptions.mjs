// Super admin records a subscription; the facility's staff see the reminder banner;
// the growth numbers show on the overview.
import { chromium } from 'playwright';
const BASE = process.argv[2] ?? 'http://127.0.0.1:5173';
const out = process.argv[3];
const step = (m) => console.log('✓', m);
const b = await chromium.launch();
async function login(email) {
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ar-IQ', reducedMotion: 'reduce' })).newPage();
  await p.goto(`${BASE}/login`);
  await p.getByLabel('البريد الإلكتروني').fill(email);
  await p.getByLabel('كلمة المرور').fill('Demo-Pass-2026!');
  await p.getByRole('button', { name: 'دخول', exact: true }).click();
  await p.waitForURL((u) => !u.pathname.startsWith('/login'));
  return p;
}
try {
  const a = await login('admin@demo.test');
  await a.goto(`${BASE}/platform-admin`);
  await a.getByText('حجوزات اليوم').waitFor();
  await a.getByText('أكثر الأطباء حجزاً هذا الشهر').waitFor();
  step('overview shows the growth numbers');
  if (out) await a.screenshot({ path: `${out}/admin-growth.png`, fullPage: true });

  await a.goto(`${BASE}/platform-admin/subscriptions`);
  const row = a.locator('tr', { hasText: 'مجمع الرافدين' });
  await row.getByRole('button', { name: /إضافة|تعديل/ }).click();
  const dlg = a.getByRole('dialog');
  await dlg.getByLabel('الباقة').selectOption('monthly');
  const d = new Date(); d.setDate(d.getDate() - 28);
  await dlg.getByLabel('يبدي من').fill(d.toISOString().slice(0, 10));   // a month from 28 days ago: ends in 2–3 days
  await dlg.getByLabel('استلمنا المبلغ (مدفوع)').check();
  await dlg.getByRole('button', { name: 'حفظ' }).click();
  await a.getByText('انحفظ اشتراك').waitFor();
  await row.getByText('يخلص قريباً').first().waitFor();
  step('super admin records a paid month ending in a few days → «يخلص قريباً»');
  if (out) await a.screenshot({ path: `${out}/admin-subscriptions.png`, fullPage: true });

  const r = await login('reception.a@demo.test');
  const banner = r.locator('.sub-banner');
  await banner.waitFor();
  if (!/اشتراككم يخلص/.test(await banner.innerText())) throw new Error('unexpected banner: ' + await banner.innerText());
  await r.getByRole('button', { name: 'حجز سريع بالاسم فقط' }).waitFor();
  step('staff see the reminder banner and keep working (nothing switched off)');

  await row.getByRole('button', { name: 'تعديل' }).click();
  await dlg.getByLabel('يبدي من').fill(new Date().toISOString().slice(0, 10));
  await dlg.getByRole('button', { name: 'حفظ' }).click();
  await row.getByText('فعّال').first().waitFor();
  await r.reload();
  await r.getByRole('button', { name: 'حجز سريع بالاسم فقط' }).waitFor();
  if (await r.locator('.sub-banner').count()) throw new Error('banner still shown after renewal');
  step('after renewal the banner disappears');
} finally {
  await b.close();
}
