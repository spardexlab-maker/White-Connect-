// Legal pages are public; a patient deletes their account and can no longer sign in.
import { chromium } from 'playwright';
const BASE = process.argv[2] ?? 'http://127.0.0.1:5173';
const out = process.argv[3];
const step = (m) => console.log('✓', m);
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ar-IQ' })).newPage();
try {
  for (const [path, h] of [['/privacy', 'سياسة الخصوصية'], ['/terms', 'شروط الاستخدام'], ['/account-deletion', 'حذف الحساب']]) {
    await p.goto(`${BASE}${path}`);
    await p.getByRole('heading', { level: 1, name: h }).waitFor();
    if (out) await p.screenshot({ path: `${out}/legal${path.replace('/', '-')}.png`, fullPage: true });
  }
  step('privacy, terms and account-deletion pages open without signing in');

  const signIn = async () => {
    await p.goto(`${BASE}/patient/account`);
    await p.getByRole('button', { name: /طرق دخول أخرى/ }).click();
    await p.getByLabel('البريد الإلكتروني').fill('mona@demo.test');
    await p.getByLabel('كلمة المرور').fill('Demo-Pass-2026!');
    await p.getByRole('button', { name: 'دخول', exact: true }).first().click();
  };
  await signIn();
  await p.getByRole('heading', { name: 'حذف الحساب' }).waitFor();
  await p.getByRole('button', { name: 'احذف حسابي' }).click();
  const dlg = p.getByRole('alertdialog');
  await dlg.getByRole('button', { name: 'احذف حسابي' }).click();
  await dlg.getByText('اكتب كلمة «حذف» للتأكيد.').waitFor();
  await dlg.getByLabel('للتأكيد اكتب: حذف').fill('حذف');
  if (out) await p.screenshot({ path: `${out}/delete-confirm.png` });
  await dlg.getByRole('button', { name: 'احذف حسابي' }).click();
  await p.getByText('حُذف حسابك').waitFor();
  step('the patient confirmed by typing «حذف» and the account was deleted');

  await signIn();
  await p.getByText('بيانات الدخول غير صحيحة').waitFor();
  step('the deleted account can no longer sign in');
} finally { await b.close(); }
