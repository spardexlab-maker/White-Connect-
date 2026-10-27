// Records the doctor, reception, pharmacy and lab clips on the web app (one real visit
// for the demo patient «حسن علي», from the walk-in to the released result).
// Usage: node docs/film-screens/record-pro.mjs <clips-dir> [base-url]
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { preparePage, record, tap, type, scroll, pause } from './rec-lib.mjs';

const dir = process.argv[2];
const BASE = process.argv[3] ?? 'http://127.0.0.1:4173';
const PASSWORD = 'Demo-Pass-2026!';
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const b = await chromium.launch();
const ctxOpts = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, locale: 'ar-IQ', timezoneId: 'Asia/Baghdad', reducedMotion: 'no-preference' };

async function pro(email) {
  const page = await (await b.newContext(ctxOpts)).newPage();
  await preparePage(page);
  await page.goto(`${BASE}/login`);
  await page.getByLabel('البريد الإلكتروني أو معرف الدخول').fill(email);
  await page.getByLabel('كلمة المرور').fill(PASSWORD);
  await page.getByRole('button', { name: 'دخول', exact: true }).click();
  await page.waitForURL(/workspace/);
  await page.waitForTimeout(800);
  return page;
}
const clip = async (page, name, fn) => {
  try { return await (only && !only.includes(name) ? fn() : record(page, dir, name, fn)); }
  catch (e) { await page.screenshot({ path: `${dir}/_fail-${name}.png` }).catch(() => {}); console.log(`✗ ${name}: ${String(e.message).split('\n')[0]}`); }
};

// ---------- reception: walk-in for an existing patient ----------
const r = await pro('reception.a@demo.test');
await r.waitForURL(/reception/);
await r.waitForTimeout(1200);
await clip(r, 'w_reception', async () => {
  await pause(r, 900);
  await tap(r, r.getByRole('button', { name: /حجز سريع/ }));
  await tap(r, r.getByRole('button', { name: 'مريض موجود' }));
  await type(r, r.locator('#lookup'), 'PDEMO00050');
  await tap(r, r.getByRole('button', { name: 'بحث' }));
  await tap(r, r.locator('.lookup-result', { hasText: 'حسن علي' }));
  await tap(r, r.getByLabel(/إضافة إلى قائمة الانتظار/));
  await tap(r, r.getByRole('button', { name: 'إضافة إلى الانتظار' }));
  await r.getByText('أُضيف المريض إلى قائمة الانتظار').waitFor();
  await pause(r, 1500);
});

// ---------- doctor ----------
const d = await pro('dr.ahmed@demo.test');
await d.getByRole('button', { name: /عيادات الرافدين.*طبيب/ }).first().click();
await d.waitForURL(/doctor$/);
await d.waitForTimeout(1200);
await clip(d, 'w_doc_today', async () => {
  await pause(d, 1200);
  await scroll(d, 300, 900); await scroll(d, -300, 700);
  const qi = d.locator('.queue-item', { hasText: 'حسن علي' }).filter({ hasText: 'عابر' }).last();
  await tap(d, qi.getByRole('button', { name: 'بدء الجلسة' }));
  await tap(d, d.getByRole('button', { name: 'تأكيد الهوية وبدء الجلسة' }));
  await d.waitForURL(/session/);
  await d.getByText(/حساسية/).first().waitFor();
  await pause(d, 1500);
});
await clip(d, 'w_doc_card', async () => {
  await pause(d, 800);
  await scroll(d, 500, 1400);
  for (const t of [/الفحوصات/, /الوصفات/, /الزيارات/]) {
    const tab = d.getByRole('tab', { name: t }).first();
    if (await tab.count()) { await tap(d, tab, { after: 1300 }); }
  }
  await scroll(d, -500, 900);
});
await clip(d, 'w_doc_dx', async () => {
  const dx = d.getByLabel('التشخيص', { exact: false }).first();
  await dx.fill('');
  await type(d, dx, 'التهاب بلعوم حاد', 80);
  await d.getByText(/محفوظ/).first().waitFor({ timeout: 10000 });
  await pause(d, 1500);
});
await clip(d, 'w_doc_rx', async () => {
  await tap(d, d.getByRole('tab', { name: 'وصفة' }));
  await type(d, d.getByLabel('بحث بالمادة الفعالة أو الاسم التجاري'), 'Paracet', 110);
  await tap(d, d.locator('.combo-list button', { hasText: '500 mg' }).first());
  await type(d, d.getByLabel('الكمية بكل جرعة'), '1');
  await d.getByLabel('الوحدة').selectOption('حبة'); await pause(d, 400);
  await d.getByLabel('كم مرة باليوم').selectOption('8'); await pause(d, 400);
  await type(d, d.getByLabel('المدة (أيام)'), '5');
  await type(d, d.getByLabel('كمية الصرف'), '15');
  await tap(d, d.getByRole('button', { name: 'اعتماد الوصفة' }));
  await tap(d, d.getByRole('alertdialog').getByRole('button', { name: 'اعتماد', exact: true }));
  await d.getByText(/معتمدة — إصدار/).waitFor();
  await pause(d, 700);
  await tap(d, d.getByRole('button', { name: 'إرسال', exact: true }));
  await d.getByText(/أُرسلت أيضاً إلى/).waitFor();
  await pause(d, 1500);
});
await clip(d, 'w_doc_lab', async () => {
  await tap(d, d.getByRole('button', { name: 'التحاليل والنتائج' }).first());
  await tap(d, d.locator('.radio-card', { hasText: 'سكر صائم' }).first());
  await tap(d, d.getByRole('button', { name: /إرسال الطلب إلى/ }));
  await d.getByText(/أُرسل طلب التحاليل/).waitFor();
  await pause(d, 1200);
  await tap(d, d.getByRole('button', { name: 'انتظار النتائج واستقبال التالي' }));
  await tap(d, d.getByRole('alertdialog').getByRole('button', { name: 'تأكيد' }));
  await d.waitForURL(/doctor$/);
  await pause(d, 1500);
});

// ---------- pharmacy ----------
const ph = await pro('pharm.a@demo.test');
await ph.waitForURL(/pharmacy/);
await ph.waitForTimeout(1200);
const phRow = () => ph.locator('tr', { hasText: 'حسن علي' }).filter({ hasText: 'جديدة' }).first();
await clip(ph, 'w_ph_inbox', async () => {
  await pause(ph, 1200);
  await tap(ph, phRow().getByRole('button', { name: 'فتح' }));
  await ph.getByText(/حساسية موثقة/).first().waitFor();
  await pause(ph, 1500);
  await tap(ph, ph.getByRole('button', { name: 'تسجيل الاستلام' }));
  await ph.getByText('سُجل الاستلام').waitFor();
  await pause(ph, 1200);
});
await clip(ph, 'w_ph_clarify', async () => {
  await tap(ph, ph.getByRole('button', { name: 'طلب توضيح من الطبيب' }).first());
  await type(ph, ph.getByRole('alertdialog').getByLabel('ملاحظة'), 'هل المقصود 500 ملغ كل 8 ساعات؟', 60);
  await tap(ph, ph.getByRole('alertdialog').getByRole('button', { name: 'حفظ' }));
  await ph.getByText('أُرسل طلب التوضيح للطبيب').waitFor();
  await pause(ph, 1500);
});
// the doctor answers
await d.goto(`${BASE}/workspace/doctor`);
await d.waitForTimeout(1200);
await clip(d, 'w_doc_note', async () => {
  await pause(d, 800);
  await d.getByText(/ملاحظات من الصيدلية/).first().waitFor();
  await tap(d, d.getByRole('link', { name: 'عرض والرد' }).first());
  await pause(d, 1000);
  await tap(d, d.getByRole('button', { name: 'الرد', exact: true }).first());
  await type(d, d.getByLabel('ردك للصيدلي'), 'نعم، 500 ملغ كل 8 ساعات لمدة 5 أيام', 55);
  await tap(d, d.getByRole('button', { name: 'إرسال الرد' }));
  await d.getByText('أُرسل ردك للصيدلية').waitFor();
  await pause(d, 1400);
});
await ph.reload();
await ph.waitForTimeout(1200);
await clip(ph, 'w_ph_dispense', async () => {
  const row = ph.locator('tr', { hasText: 'حسن علي' }).filter({ hasText: /مستلمة|مسلمة/ }).first();
  await tap(ph, (await row.count()) ? row.getByRole('button', { name: 'فتح' }) : ph.locator('tr', { hasText: 'حسن علي' }).first().getByRole('button', { name: 'فتح' }));
  await ph.getByText(/رد الطبيب:/).first().waitFor();
  await pause(ph, 1400);
  const qty = ph.getByLabel('الكمية', { exact: true }).first();
  await qty.fill(''); await type(ph, qty, '10');
  await tap(ph, ph.getByRole('button', { name: 'تحضير (حجز الكمية)' }));
  await ph.getByText('تم حجز الكميات للتحضير').waitFor();
  await tap(ph, ph.getByRole('button', { name: 'صرف', exact: true }));
  await tap(ph, ph.getByRole('alertdialog').getByRole('button', { name: 'صرف الآن' }));
  await ph.getByText(/صرف جزئي/).first().waitFor();
  await tap(ph, ph.getByRole('button', { name: 'تسجيل الدفع نقداً' }));
  await ph.getByText('سُجل الدفع').waitFor();
  await pause(ph, 1200);
});
await clip(ph, 'w_ph_remind', async () => {
  await tap(ph, ph.getByText('تفعيل تذكيرات الدواء للمريض'));
  await tap(ph, ph.getByLabel('وقت متفق عليه')); await ph.getByLabel('وقت متفق عليه').fill('09:00'); await pause(ph, 500);
  await tap(ph, ph.getByRole('button', { name: 'إضافة', exact: true }));
  await tap(ph, ph.getByLabel('وقت متفق عليه')); await ph.getByLabel('وقت متفق عليه').fill('21:00'); await pause(ph, 500);
  await tap(ph, ph.getByRole('button', { name: 'إضافة', exact: true }));
  await tap(ph, ph.getByLabel('وافق المريض على تلقي التذكيرات'));
  await tap(ph, ph.getByRole('button', { name: 'تفعيل', exact: true }));
  await ph.getByText(/فُعّلت التذكيرات/).waitFor();
  await pause(ph, 1500);
});
await ph.goto(`${BASE}/workspace/pharmacy/stock`); await ph.waitForTimeout(1500);
await clip(ph, 'w_ph_stock', async () => {
  await pause(ph, 1500);
  await type(ph, ph.getByPlaceholder(/بحث/).first(), 'باراسيتامول', 90);
  await pause(ph, 1500);
  await ph.getByPlaceholder(/بحث/).first().fill('');
  await pause(ph, 1200);
});
await ph.goto(`${BASE}/workspace/pharmacy/sales`); await ph.waitForTimeout(1500);
await clip(ph, 'w_ph_sales', async () => {
  await pause(ph, 1000);
  await tap(ph, ph.getByRole('button', { name: /بيع مباشر/ }));
  await pause(ph, 2500);
  await ph.keyboard.press('Escape');
  await pause(ph, 800);
});
await ph.goto(`${BASE}/workspace/pharmacy/reports`); await ph.waitForTimeout(1500);
await clip(ph, 'w_ph_reports', async () => {
  await pause(ph, 1200);
  await scroll(ph, 700, 2200);
  await pause(ph, 800);
  await scroll(ph, -700, 1200);
});

// ---------- lab ----------
const lt = await pro('lab.a@demo.test');
await lt.waitForURL(/lab/);
await lt.waitForTimeout(1200);
await clip(lt, 'w_lab_list', async () => {
  await pause(lt, 1200);
  const chips = lt.getByRole('button', { name: /بانتظار|قيد|منشورة/ });
  for (let i = 0; i < Math.min(3, await chips.count()); i++) await tap(lt, chips.nth(i), { after: 900 });
  await tap(lt, lt.getByRole('button', { name: /^الكل/ }).first(), { after: 900 });
});
await clip(lt, 'w_lab_receive', async () => {
  const num = execSync(`psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -Atc "select order_number from public.lab_orders order by created_at desc limit 1"`).toString().trim();
  await tap(lt, lt.locator('tr', { hasText: num }).first().getByRole('button', { name: 'فتح' }));
  await pause(lt, 1000);
  await tap(lt, lt.getByRole('button', { name: 'استقبال المراجع وبدء الفحص' }));
  await lt.getByText('استُقبل المراجع وسُجلت العينة').waitFor();
  await pause(lt, 1500);
});
await clip(lt, 'w_lab_result', async () => {
  await type(lt, lt.getByLabel('القيمة').first(), '104');
  await type(lt, lt.getByLabel('المجال المرجعي').first(), '70-100 mg/dL', 60);
  await tap(lt, lt.getByRole('button', { name: 'حفظ بدون نشر' }));
  await lt.getByText(/حُفظت القيم/).waitFor();
  await pause(lt, 1300);
});
await clip(lt, 'w_lab_publish', async () => {
  await tap(lt, lt.getByRole('button', { name: 'إكمال التحليل ونشر النتيجة' }));
  await pause(lt, 900);
  await tap(lt, lt.getByRole('alertdialog').getByRole('button', { name: 'إكمال ونشر' }));
  await lt.getByText(/نُشرت النتيجة للمريض والطبيب/).waitFor();
  await pause(lt, 1600);
});

// an open order ("any lab") issued by the doctor, claimed by the lab with its code
const enc = await d.locator('a[href*="/workspace/doctor/session/"]').first().getAttribute('href').catch(() => null);
let code = null;
if (enc) {
  await d.goto(`${BASE}${enc}`);
  await d.getByRole('tab', { name: /^تحاليل/ }).click();
  await d.getByRole('button', { name: 'أي مختبر (رمز للمريض)' }).click();
  await d.getByRole('button', { name: 'السكر التراكمي HbA1c', exact: true }).click();
  await d.getByRole('button', { name: 'إصدار الطلب للمريض' }).click();
  await d.getByText('صدر طلب التحاليل').waitFor();
  code = (await d.locator('.open-code').first().textContent()).trim();
}
if (code) {
  await lt.getByRole('link', { name: 'طلب برمز (QR)' }).click();
  await lt.waitForTimeout(1000);
  await clip(lt, 'w_lab_qr', async () => {
    await pause(lt, 800);
    await type(lt, lt.getByLabel('رمز الطلب'), code, 110);
    await tap(lt, lt.getByRole('button', { name: 'عرض الطلب' }));
    await lt.getByText('حسن').first().waitFor();
    await pause(lt, 1500);
    await tap(lt, lt.getByRole('button', { name: /استلام \d+ تحليل/ }));
    await lt.getByText(/أُضيف الطلب/).waitFor();
    await pause(lt, 1500);
  });
}
await lt.goto(`${BASE}/workspace/lab/home`); await lt.waitForTimeout(1500);
await clip(lt, 'w_lab_home', async () => {
  await pause(lt, 1000);
  const tabs = lt.getByRole('tab');
  for (let i = 0; i < Math.min(4, await tabs.count()); i++) await tap(lt, tabs.nth(i), { after: 1000 });
  const open = lt.getByRole('button', { name: /فتح|التفاصيل|عرض/ }).first();
  if (await open.count()) { await tap(lt, open, { after: 2000 }); }
});
await lt.goto(`${BASE}/workspace/lab/doctors`); await lt.waitForTimeout(1500);
await clip(lt, 'w_lab_doctors', async () => { await pause(lt, 1500); await scroll(lt, 400, 1500); await pause(lt, 800); });

// ---------- doctor: result review, schedule, profile ----------
await d.goto(`${BASE}/workspace/doctor`); await d.waitForTimeout(1500);
await clip(d, 'w_doc_result', async () => {
  await pause(d, 800);
  await d.getByText('نتائج تحتاج مراجعة').first().waitFor();
  await tap(d, d.locator('.list-item', { hasText: 'حسن علي' }).getByRole('link', { name: 'عرض النتيجة' }).first());
  await d.getByText('104').first().waitFor();
  await pause(d, 1500);
  await scroll(d, 400, 1200);
  await pause(d, 800);
});
await d.goto(`${BASE}/workspace/doctor/schedule`); await d.waitForTimeout(1500);
await clip(d, 'w_doc_schedule', async () => {
  await pause(d, 1200); await scroll(d, 500, 1600); await pause(d, 600);
  await d.goto(`${BASE}/workspace/doctor/profile`); await d.waitForTimeout(1500);
  await scroll(d, 500, 1600); await pause(d, 800);
});

await b.close();
console.log('pro clips recorded');
