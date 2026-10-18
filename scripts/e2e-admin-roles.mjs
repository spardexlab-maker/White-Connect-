// Super admin runs administration (no complex-manager role); complex is optional;
// pharmacy staff see the doctors of their complex.
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
  await p.getByRole('button', { name: /دخول/ }).click();
  await p.waitForURL((u) => !u.pathname.startsWith('/login'));
  return p;
}
try {
  const a = await login('admin@demo.test');
  // 1) independent clinic without a complex
  await a.goto(`${BASE}/platform-admin/organizations`);
  await a.getByLabel('اسم الجهة').fill('عيادة مستقلة للاختبار');
  await a.getByLabel('المدينة').selectOption({ index: 1 });
  await a.getByRole('button', { name: 'إضافة الجهة' }).click();
  await a.getByText('أُضيفت الجهة وفُعّلت').waitFor();
  await a.getByText('عيادة مستقلة للاختبار').first().waitFor();
  await a.getByText('جهة مستقلة').first().waitFor();
  step('super admin added a clinic without a complex (independent, active)');
  if (out) await a.screenshot({ path: `${out}/admin-orgs.png`, fullPage: true });
  // 2) invitations offer staff roles only; staff list with suspend
  await a.goto(`${BASE}/platform-admin/members`);
  await a.getByLabel('المجمع').first().selectOption({ label: 'مجمع الرافدين الطبي (تجريبي)' });
  await a.getByLabel('الجهة').first().selectOption({ label: 'عيادات الرافدين' });
  const opts = await a.getByLabel('الدور').locator('option').allTextContents();
  if (opts.some((o) => /مدير/.test(o))) throw new Error('admin roles still offered: ' + opts.join(','));
  step(`invite roles: ${opts.filter((o) => o !== 'اختر').join('، ')} (no manager roles)`);
  await a.getByText('موظفو الجهة').waitFor();
  await a.getByRole('button', { name: 'تعليق' }).first().waitFor();
  step('super admin sees each facility’s staff with suspend');
  // 3) reports for any complex / facility
  await a.goto(`${BASE}/platform-admin/reports`);
  await a.getByText('المحصّل').first().waitFor();
  await a.getByLabel('المجمع').selectOption({ label: 'مجمع الرافدين الطبي (تجريبي)' });
  await a.getByText('المجمع — حسب الجهة').waitFor();
  step('super admin opens facility and complex reports');
  if (out) await a.screenshot({ path: `${out}/admin-reports.png`, fullPage: true });
  // 4) pharmacist sees complex doctors
  const ph = await login('pharm.a@demo.test');
  await ph.goto(`${BASE}/workspace/pharmacy/doctors`);
  await ph.getByText('د. أحمد سالم (تجريبي)').waitFor();
  const n = await ph.locator('.list-item').count();
  if (await ph.getByText('د. ليلى عباس').count()) throw new Error('doctor from another complex shown');
  step(`pharmacist sees ${n} doctors of their complex only`);
  if (out) await ph.screenshot({ path: `${out}/pharm-doctors.png`, fullPage: true });
  console.log('ADMIN ROLES E2E PASSED');
} catch (e) { console.error('FAILED:', e.message); process.exitCode = 1; }
finally { await b.close(); }
