// Full product tour on the local stack (synthetic demo data): records a video
// per scene with an on-screen Arabic caption, and a clean screenshot per step
// for the presentation. Run after `supabase db reset` with the dev server up.
// Usage: node scripts/demo-tour.mjs <outDir> [baseUrl]
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const OUT = process.argv[2];
const BASE = process.argv[3] ?? 'http://127.0.0.1:5173';
if (!OUT) { console.error('usage: node scripts/demo-tour.mjs <outDir> [baseUrl]'); process.exit(2); }
const PASSWORD = 'Demo-Pass-2026!';
const A1 = '00000000-0000-4000-f000-0000000000a1';
const AHMED = '00000000-0000-4000-9000-000000000010';
const SVC = '00000000-0000-4000-6000-000000000002';
const DESK = { width: 1366, height: 820 };
const PHONE = { width: 390, height: 844 };
await mkdir(`${OUT}/video`, { recursive: true });
await mkdir(`${OUT}/shots`, { recursive: true });

const browser = await chromium.launch({ slowMo: 220 });
const manifest = { scenes: [], shots: [] };
let shotNo = 0;
const PACE = 1.7;                                  // reading time multiplier for the video
const hold = (p, ms = 1500) => p.waitForTimeout(ms * PACE);

/** Caption bar + click ripple, re-applied after every navigation. */
function overlay() {
  const css = `#__cap{position:fixed;z-index:2147483647;inset-inline:0;bottom:18px;margin:auto;width:fit-content;max-width:92vw;direction:rtl;
    background:rgba(14,30,46,.9);color:#fff;font:600 19px/1.5 'IBM Plex Sans Arabic',system-ui,sans-serif;padding:10px 20px;border-radius:14px;
    box-shadow:0 8px 30px rgba(0,0,0,.25);pointer-events:none;text-align:center}
    #__cap small{display:block;font-weight:400;font-size:15px;opacity:.85}
    #__cap .role{display:inline-block;background:#14a38b;border-radius:8px;padding:0 8px;margin-inline-end:8px;font-size:15px}
    @media (max-width:500px){#__cap{font-size:15px;bottom:10px;padding:8px 12px}#__cap small{font-size:12.5px}}
    .__ripple{position:fixed;z-index:2147483646;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:3px solid #f5a524;
      pointer-events:none;animation:__r .6s ease-out forwards}
    @keyframes __r{from{transform:scale(.4);opacity:1}to{transform:scale(1.6);opacity:0}}`;
  const render = () => {
    if (!document.getElementById('__capcss')) { const s = document.createElement('style'); s.id = '__capcss'; s.textContent = css; document.head.appendChild(s); }
    let raw = null; try { raw = sessionStorage.getItem('__cap'); } catch { return; }
    if (!raw) return;
    const c = JSON.parse(raw);
    let el = document.getElementById('__cap');
    if (!el) { el = document.createElement('div'); el.id = '__cap'; document.body.appendChild(el); }
    el.innerHTML = `<span class="role">${c.role}</span>${c.title}${c.sub ? `<small>${c.sub}</small>` : ''}`;
  };
  window.__cap = (c) => { try { sessionStorage.setItem('__cap', JSON.stringify(c)); } catch { /* blank page */ } render(); };
  document.addEventListener('DOMContentLoaded', render);
  window.addEventListener('mousedown', (e) => {
    const r = document.createElement('div'); r.className = '__ripple'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
    document.body.appendChild(r); setTimeout(() => r.remove(), 700);
  }, true);
}

async function scene(id, role, title, viewport, fn) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'ar-IQ', timezoneId: 'Asia/Baghdad',
    recordVideo: { dir: `${OUT}/video/${id}`, size: viewport } });
  await ctx.addInitScript(overlay);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const s = { id, role, title, steps: [] };
  const cap = async (t, sub = '') => {
    s.steps.push({ title: t, sub });
    await page.evaluate((c) => window.__cap?.(c), { role, title: t, sub }).catch(() => {});
    console.log(`  • ${t}`);
  };
  const shot = async (name, t, sub = '') => {
    shotNo += 1;
    const file = `shots/${String(shotNo).padStart(2, '0')}-${id}-${name}.png`;
    await page.evaluate(() => { const el = document.getElementById('__cap'); if (el) el.style.visibility = 'hidden'; });
    await page.screenshot({ path: `${OUT}/${file}` });
    await page.evaluate(() => { const el = document.getElementById('__cap'); if (el) el.style.visibility = 'visible'; });
    manifest.shots.push({ file, scene: id, role, title: t, sub, phone: viewport === PHONE });
  };
  console.log(`▶ ${role}: ${title}`);
  try { await fn({ page, cap, shot }); }
  finally {
    await hold(page, 1200);
    const video = page.video();
    await ctx.close();
    s.video = video ? await video.path() : null;
    manifest.scenes.push(s);
    if (errors.length) console.log('   page errors:', errors.join(' | '));
  }
}

async function proLogin(page, email) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel('البريد الإلكتروني أو معرف الدخول').fill(email);
  await page.getByLabel('كلمة المرور').fill(PASSWORD);
  await page.getByRole('button', { name: 'دخول' }).click();
  await page.waitForURL(/workspace|platform-admin/);
}
async function patientLogin(page) {
  await page.goto(`${BASE}/patient/account`);
  await page.getByLabel('البريد الإلكتروني').fill('hasan@demo.test');
  await page.getByLabel('كلمة المرور').fill(PASSWORD);
  await page.getByRole('button', { name: 'دخول' }).click();
  await page.locator('canvas').first().waitFor();
}
async function doctorLogin(page) {
  await proLogin(page, 'dr.ahmed@demo.test');
  await page.getByRole('button', { name: /عيادات الرافدين.*طبيب/ }).first().click();
  await page.waitForURL(/doctor$/);
}

let bookingNo = '';
let slotText = '';

// 1) patient books from the phone ------------------------------------------
await scene('patient-book', 'المريض', 'الحجز من الهاتف', PHONE, async ({ page, cap, shot }) => {
  await page.goto(`${BASE}/patient`);
  await cap('الصفحة الرئيسية للمريض', 'بحث عن طبيب أو تخصص وأقرب موعد متاح');
  await hold(page, 2200); await shot('home', 'الصفحة الرئيسية للمريض', 'بحث عن طبيب أو تخصص، وأقرب موعد متاح');
  await patientLogin(page);
  await cap('حساب المريض وبطاقته', 'رمز QR شخصي يُبرز عند الاستقبال');
  await hold(page, 1800); await shot('account', 'حساب المريض وبطاقة QR', 'رمز شخصي يُبرز عند الاستقبال ويمكن تجديده');
  await page.goto(`${BASE}/patient/provider/${A1}/${AHMED}`);
  await cap('صفحة الطبيب', 'التخصص والخدمات والأسعار والأوقات المتاحة');
  await hold(page, 2000); await shot('provider', 'صفحة الطبيب', 'التخصص والخدمات والأسعار والأوقات المتاحة');
  await page.goto(`${BASE}/patient/book/${A1}/${AHMED}?service=${SVC}`);
  await cap('اختيار اليوم والوقت', 'تظهر الأوقات الفارغة فقط — لا حجز مزدوج');
  await page.locator('.day-btn:not([disabled])').first().click();
  const slot = page.locator('.slot-btn').last();
  slotText = (await slot.innerText()).trim();
  await slot.click();
  await hold(page); await shot('slots', 'اختيار اليوم والوقت', 'تظهر الأوقات الفارغة فقط، والنظام يمنع الحجز المزدوج');
  await page.getByRole('button', { name: 'التالي: مراجعة' }).click();
  await cap('مراجعة الحجز قبل الإرسال');
  await hold(page); await shot('review', 'مراجعة الحجز', 'الطبيب، الخدمة، الوقت والسعر قبل الإرسال');
  await page.getByRole('button', { name: 'إرسال طلب الحجز' }).click();
  await page.getByText(/تم إرسال طلبك|تم تأكيد موعدك/).waitFor();
  bookingNo = (await page.locator('.code-pill').innerText()).trim();
  await cap('أُرسل طلب الحجز', `رقم الحجز ${bookingNo} — بانتظار تأكيد السكرتير`);
  await hold(page, 2200); await shot('booked', 'أُرسل طلب الحجز', 'رقم حجز فريد، والحالة «بانتظار التأكيد»');
});

// 2) reception -----------------------------------------------------------------
await scene('reception', 'السكرتير', 'لوحة اليوم والطابور', DESK, async ({ page, cap, shot }) => {
  await proLogin(page, 'reception.a@demo.test');
  await page.waitForURL(/reception/);
  await cap('لوحة اليوم', 'المواعيد مقسمة: بانتظار التأكيد، مؤكد، حاضر — ولكل سكرتير طبيبه فقط');
  await hold(page, 2400); await shot('board', 'لوحة السكرتير', 'المواعيد مقسمة حسب الحالة، والسكرتير يرى طبيبه فقط');
  for (let i = 0; i < 21 && !(await page.locator('.appt-row', { hasText: 'حسن علي' }).filter({ hasText: slotText }).count()); i++) {
    await page.getByRole('button', { name: 'اليوم التالي' }).click();
    await page.waitForTimeout(400);
  }
  const row = page.locator('.appt-row', { hasText: 'حسن علي' }).filter({ hasText: slotText });
  await row.scrollIntoViewIfNeeded();
  await cap('تأكيد طلب المريض', 'يصل للمريض إشعار فوراً');
  await row.getByRole('button', { name: 'تأكيد' }).click();
  await row.getByText('مؤكد').waitFor();
  await hold(page); await shot('confirmed', 'تأكيد الحجز', 'بضغطة واحدة، ويصل للمريض إشعار');
  await page.getByRole('button', { name: /^اليوم$|العودة لليوم/ }).first().click().catch(() => {});
  await page.goto(`${BASE}/workspace/reception`);
  await cap('حجز سريع لمراجع حاضر', 'بحث بمعرّف المريض أو إضافة مريض جديد بالاسم فقط');
  await page.getByRole('button', { name: /حجز سريع/ }).click();
  await page.getByRole('button', { name: 'مريض موجود' }).click();
  await page.locator('#lookup').pressSequentially('PDEMO00050', { delay: 60 });
  await page.getByRole('button', { name: 'بحث' }).click();
  await page.locator('.lookup-result', { hasText: 'حسن علي' }).click();
  await page.getByLabel(/إضافة إلى قائمة الانتظار/).check();
  await hold(page); await shot('quick-book', 'حجز سريع', 'مريض موجود بمعرّفه، أو مريض جديد بالاسم فقط');
  await page.getByRole('button', { name: 'إضافة إلى الانتظار' }).click();
  await page.getByText('أُضيف المريض إلى قائمة الانتظار').waitFor();
  await cap('أُضيف المريض إلى طابور الطبيب', 'ترتيب الطابور ووقت الانتظار المتوقع');
  await hold(page, 2000); await shot('queue', 'الطابور', 'المريض في طابور الطبيب مع ترتيبه');
});

// 3) doctor session ----------------------------------------------------------
await scene('doctor', 'الطبيب', 'الجلسة والبطاقة الطبية والوصفة', DESK, async ({ page, cap, shot }) => {
  await doctorLogin(page);
  await cap('اليوم والطابور', 'مرضى اليوم، الحاضرون، والجلسات المفتوحة');
  await hold(page, 2200); await shot('today', 'يوم الطبيب', 'مرضى اليوم، الحاضرون، والجلسات المفتوحة');
  const qi = page.locator('.queue-item', { hasText: 'حسن علي' }).filter({ hasText: 'عابر' }).first();
  await cap('البطاقة الطبية قبل الدخول', 'زيارات وفحوصات ووصفات المريض عند كل الأطباء');
  await qi.getByRole('button', { name: 'البطاقة الطبية' }).click();
  await page.getByRole('tab', { name: /الزيارات/ }).waitFor();
  await hold(page, 1800); await shot('card', 'البطاقة الطبية', 'الحساسية والزيارات والفحوصات والوصفات — كل فتح يُسجَّل');
  await page.getByRole('button', { name: 'إغلاق' }).click();
  await cap('بدء الجلسة بعد التحقق من الهوية');
  await qi.getByRole('button', { name: 'بدء الجلسة' }).click();
  await hold(page, 900); await shot('identity', 'التحقق من الهوية', 'لا تبدأ الجلسة إلا بضغط الطبيب بعد تأكيد الهوية');
  await page.getByRole('button', { name: 'تأكيد الهوية وبدء الجلسة' }).click();
  await page.waitForURL(/session/);
  await page.getByText('حساسية: Penicillin').first().waitFor();
  await cap('ملف الجلسة', 'الحساسية ظاهرة دائماً أعلى الشاشة، والحفظ تلقائي');
  await page.getByLabel('النبض').pressSequentially('82', { delay: 80 });
  await page.getByLabel('سبب الزيارة').pressSequentially('صداع متكرر منذ أسبوع', { delay: 35 });
  await page.getByLabel('التقييم / التشخيص').pressSequentially('صداع توتري (تجريبي)', { delay: 35 });
  await page.getByLabel('الخطة').pressSequentially('مسكن عند اللزوم وفحص سكر صائم', { delay: 35 });
  await page.getByText(/محفوظ/).first().waitFor({ timeout: 10000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await hold(page); await shot('session', 'ملف الجلسة', 'العلامات الحيوية والملاحظات المنظّمة مع حفظ تلقائي');

  await cap('إيقاف مؤقت', 'المريض ذهب لفحص — الطبيب يستقبل مريضاً آخر ثم يعود');
  await page.getByRole('button', { name: 'إيقاف مؤقت واستقبال مريض آخر' }).click();
  await hold(page, 900); await shot('pause', 'إيقاف الجلسة مؤقتاً', 'يختار السبب، ويبقى كل ما كُتب محفوظاً');
  await page.getByRole('alertdialog').getByRole('button', { name: 'إيقاف مؤقت' }).click();
  await page.waitForURL(/doctor$/);
  const paused = page.locator('.list-item', { hasText: 'حسن علي' }).filter({ hasText: 'متوقفة مؤقتاً' });
  await paused.waitFor();
  await cap('جلسة متوقفة في «جلسات مفتوحة»', 'يمكن بدء جلسة مريض آخر الآن');
  await paused.scrollIntoViewIfNeeded();
  await hold(page, 1800); await shot('paused-list', 'جلسات مفتوحة', 'الجلسة المتوقفة مع سببها وزر الاستئناف');
  await cap('عاد المريض — استئناف الجلسة');
  await paused.getByRole('button', { name: 'استئناف' }).click();
  await page.waitForURL(/session/);
  await page.getByLabel('التقييم / التشخيص').waitFor();
  await hold(page);

  await page.getByRole('tab', { name: 'وصفة' }).click();
  await cap('كتابة الوصفة', 'بحث بالمادة الفعالة، والجرعة كما يكتبها الطبيب دون تفسير آلي');
  await page.getByLabel('بحث بالمادة الفعالة أو الاسم التجاري').pressSequentially('Paracet', { delay: 70 });
  await page.locator('.combo-list button', { hasText: '500 mg' }).click();
  await page.getByLabel('الجرعة', { exact: true }).fill('1');
  await page.getByLabel('وحدة الجرعة').fill('قرص');
  await page.getByLabel('عدد المرات / الفاصل (كما تكتبه)').pressSequentially('ثلاث مرات يومياً', { delay: 35 });
  await page.getByLabel('المدة (أيام)').fill('5');
  await page.getByLabel('كمية الصرف').fill('15');
  await hold(page); await shot('rx-edit', 'كتابة الوصفة', 'محرر الوصفة مع معاينة الطباعة جنبه');
  await page.getByRole('button', { name: 'اعتماد الوصفة' }).click();
  await hold(page, 900); await shot('rx-confirm', 'تأكيد اعتماد الوصفة', 'اسم المريض وعدد الأدوية قبل الاعتماد');
  await page.getByRole('alertdialog').getByRole('button', { name: 'اعتماد', exact: true }).click();
  await page.getByText(/معتمدة — إصدار 1/).waitFor();
  await cap('الوصفة معتمدة', 'تُطبع وتُختم وتُسلَّم للمريض — والإرسال للصيدلية اختياري');
  await hold(page); await shot('rx-approved', 'الوصفة معتمدة', 'طباعة للمريض، والإرسال الإلكتروني للصيدلية اختياري');
  await page.getByRole('button', { name: 'إرسال', exact: true }).click();
  await page.getByText(/أُرسلت أيضاً إلى/).waitFor();
  await cap('أُرسلت نسخة للصيدلية');
  await hold(page);
  const [print] = await Promise.all([page.waitForEvent('popup', { timeout: 3000 }).catch(() => null),
    page.getByRole('link', { name: 'طباعة للمريض' }).click()]);
  const pr = print ?? page;
  await pr.getByText(/RX/).first().waitFor();
  await cap('نسخة الطباعة', 'رمز QR للتحقق من صحة الوصفة');
  await hold(pr, 1800);
  if (pr === page) { await shot('rx-print', 'نسخة الطباعة', 'رمز QR للتحقق من صحة الوصفة'); await page.goBack(); }

  await page.getByRole('tab', { name: /تحاليل/ }).click();
  await cap('طلب تحليل', 'يُرسل للمختبر مباشرة');
  await page.locator('.radio-card', { hasText: 'سكر صائم' }).click();
  await hold(page); await shot('lab-order', 'طلب تحليل', 'اختيار المختبر والتحاليل');
  await page.getByRole('button', { name: /إرسال الطلب إلى/ }).click();
  await page.getByText(/أُرسل طلب التحاليل/).waitFor();
  await page.getByRole('tab', { name: 'الجلسة الحالية' }).click();
  await cap('اعتماد الملاحظة وقفلها', 'أي تصحيح لاحق يُضاف كإصدار جديد مع السبب');
  await page.getByRole('button', { name: 'اعتماد الملاحظة' }).click();
  await page.getByRole('button', { name: 'اعتماد وقفل' }).click();
  await page.getByText(/الملاحظة معتمدة/).waitFor();
  await hold(page);
  await cap('انتظار النتائج واستقبال التالي');
  await page.getByRole('button', { name: 'انتظار النتائج واستقبال التالي' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'تأكيد' }).click();
  await page.waitForURL(/doctor$/);
  await hold(page, 1600);
});

// 4) pharmacy -----------------------------------------------------------------
await scene('pharmacy', 'الصيدلية', 'الاستلام والصرف والمخزون', DESK, async ({ page, cap, shot }) => {
  await proLogin(page, 'pharm.a@demo.test');
  await page.waitForURL(/pharmacy/);
  await cap('وارد الوصفات', 'الوصفات المرسلة لهذه الصيدلية فقط');
  await hold(page, 2000); await shot('inbox', 'وارد الوصفات', 'الوصفات المرسلة لهذه الصيدلية مع حالتها');
  const row = page.locator('tr', { hasText: 'حسن علي' }).first();
  await row.getByRole('button', { name: 'فتح' }).click();
  await page.getByText('حساسية موثقة: Penicillin').waitFor();
  await cap('تفاصيل الوصفة', 'الحساسية أولاً، ثم التحضير والصرف');
  await page.getByRole('button', { name: 'تسجيل الاستلام' }).click();
  await page.getByText('سُجل الاستلام').waitFor();
  await page.getByRole('heading', { name: 'التحضير والصرف' }).waitFor();
  await hold(page); await shot('rx-open', 'تفاصيل الوصفة', 'لوحة كبيرة: الحساسية، التحضير والصرف، ونسخة الوصفة');
  const expand = page.getByRole('button', { name: 'تكبير اللوحة' });
  if (await expand.isVisible()) {
    await cap('تكبير اللوحة', 'تصبح نافذة كبيرة في وسط الشاشة');
    await expand.click(); await hold(page); await shot('rx-expanded', 'اللوحة مكبّرة', 'زر التكبير يحوّلها لنافذة كبيرة في الوسط');
  }
  const qty = page.getByLabel('الكمية', { exact: true }).first();
  for (let i = 0; i < 20 && (await qty.inputValue()) !== '15'; i++) await page.waitForTimeout(250);
  await qty.fill('10');
  await cap('تحضير وصرف جزئي', 'المخزون يُخصم من الأقرب انتهاءً (FEFO)');
  await page.getByRole('button', { name: 'تحضير (حجز الكمية)' }).click();
  await page.getByText('تم حجز الكميات للتحضير').waitFor();
  await page.getByRole('button', { name: 'صرف', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'صرف الآن' }).click();
  await page.getByText('صرف جزئي — بقيت كميات').waitFor();
  await page.getByRole('button', { name: 'تسجيل الدفع نقداً' }).click();
  await page.getByText('سُجل الدفع').waitFor();
  await hold(page); await shot('dispensed', 'صرف جزئي ودفع', 'صُرف 10 من 15 وسُجل الدفع، والباقي ينتظر');
  await cap('تذكيرات الدواء للمريض', 'بأوقات متفق عليها وبموافقة المريض');
  await page.getByText('تفعيل تذكيرات الدواء للمريض').click();
  await page.getByLabel('وقت متفق عليه').fill('09:00');
  await page.getByRole('button', { name: 'إضافة', exact: true }).click();
  await page.getByLabel('وقت متفق عليه').fill('21:00');
  await page.getByRole('button', { name: 'إضافة', exact: true }).click();
  await page.getByLabel('وافق المريض على تلقي التذكيرات').check();
  await page.getByRole('button', { name: 'تفعيل', exact: true }).click();
  await page.getByText('فُعّلت التذكيرات حتى نهاية مدة العلاج').waitFor();
  await hold(page); await shot('reminders', 'تذكيرات الدواء', 'أوقات متفق عليها بموافقة المريض');
  await page.keyboard.press('Escape');
  await page.goto(`${BASE}/workspace/pharmacy/stock`);
  await cap('المخزون والدفعات', 'الكميات المتاحة، الدفعات، وتواريخ الانتهاء');
  await hold(page, 2000); await shot('stock', 'المخزون والدفعات', 'الكميات والدفعات وتواريخ الانتهاء');
  await page.goto(`${BASE}/workspace/pharmacy/doctors`);
  await cap('أطباء المجمع', 'أسماء الأطباء في نفس المجمع وتخصصاتهم');
  await hold(page, 1800); await shot('doctors', 'أطباء المجمع', 'الصيدلي يرى أطباء مجمعه وتخصصاتهم');
});

// 5) lab ------------------------------------------------------------------------
await scene('lab', 'المختبر', 'العينة والنتيجة والنشر', DESK, async ({ page, cap, shot }) => {
  await proLogin(page, 'lab.a@demo.test');
  await page.waitForURL(/lab/);
  await cap('طلبات المختبر', 'موظف واحد يدير المختبر كاملاً');
  await hold(page, 1800); await shot('orders', 'طلبات المختبر', 'الطلبات الواردة من الأطباء والمراجعين المباشرين');
  await page.locator('tr', { hasText: 'حسن علي' }).first().getByRole('button', { name: 'فتح' }).click();
  await cap('استقبال المراجع', 'ضغطة واحدة: الحضور والعينة برقم وباركود');
  await page.getByRole('button', { name: 'استقبال المراجع وبدء الفحص' }).click();
  await page.getByText('استُقبل المراجع وسُجلت العينة').waitFor();
  await hold(page); await shot('specimen', 'استقبال المراجع', 'الحضور والعينة بضغطة واحدة');
  await cap('النتيجة', 'كتابة القيمة أو رفع ملف النتيجة (PDF أو صورة)');
  await page.getByLabel('القيمة').pressSequentially('92', { delay: 90 });
  await page.getByLabel('المجال المرجعي').fill('70-100');
  await hold(page); await shot('draft', 'إدخال النتيجة', 'قيمة مكتوبة أو ملف مرفوع، أو الاثنين');
  await cap('إكمال التحليل ونشر النتيجة', 'تصل للمريض وللطبيب الطالب');
  await page.getByRole('button', { name: 'إكمال التحليل ونشر النتيجة' }).click();
  await page.getByRole('alertdialog').getByText(/والطبيب/).waitFor();
  await hold(page, 900); await shot('release', 'تأكيد النشر', 'يُعرض المريض والعينة ومن ستصلهم النتيجة');
  await page.getByRole('alertdialog').getByRole('button', { name: 'إكمال ونشر' }).click();
  await page.getByText('اكتمل التحليل ونُشرت النتيجة للمريض والطبيب').waitFor();
  await hold(page, 1800);
});

// 6) doctor review ---------------------------------------------------------
await scene('doctor-review', 'الطبيب', 'مراجعة النتيجة', DESK, async ({ page, cap, shot }) => {
  await doctorLogin(page);
  await page.getByText('نتائج تحتاج مراجعة').waitFor();
  await cap('مهمة مراجعة نتيجة جديدة', 'تظهر للطبيب عند نشر النتيجة');
  await hold(page, 1800); await shot('task', 'نتائج تحتاج مراجعة', 'مهمة تلقائية للطبيب عند نشر نتيجة طلبها');
  await page.locator('.list-item', { hasText: 'حسن علي' }).getByRole('link', { name: 'عرض النتيجة' }).click();
  await page.getByText('92').first().waitFor();
  await cap('النتيجة كما أصدرها المختبر', 'دون أي تفسير أو تشخيص آلي');
  await hold(page, 2000); await shot('result', 'عرض النتيجة', 'القيمة والمرجع كما أصدرها المختبر');
});

// 7) patient follow-up ----------------------------------------------------------
await scene('patient-follow', 'المريض', 'متابعة الرحلة والأدوية', PHONE, async ({ page, cap, shot }) => {
  await patientLogin(page);
  await page.goto(`${BASE}/patient/appointments`);
  await cap('مواعيدي', 'الحالة محدّثة: مؤكد');
  await page.locator('.list-item', { hasText: bookingNo }).first().waitFor().catch(() => {});
  await hold(page, 1800); await shot('appointments', 'مواعيدي', 'الحجز صار «مؤكد» بعد تأكيد السكرتير');
  await page.goto(`${BASE}/patient/journey`);
  await page.getByText(/^وصفة RX/).first().waitFor();
  await cap('رحلتي العلاجية', 'الزيارات، الوصفات، والنتائج المعتمدة');
  await hold(page, 2000); await shot('journey', 'رحلتي العلاجية', 'الزيارة والوصفة والنتيجة في خط زمني واحد');
  await page.locator('.card', { hasText: /^وصفة RX/ }).first().getByRole('link', { name: 'التفاصيل' }).click();
  await page.getByText('ثلاث مرات يومياً').first().waitFor();
  await cap('الوصفة كما كتبها الطبيب');
  await hold(page, 1800); await shot('rx', 'وصفة المريض', 'الوصفة كما كتبها الطبيب، مع رمز التحقق');
  await page.goto(`${BASE}/patient/meds`);
  await page.getByText('الأوقات: 09:00، 21:00').waitFor();
  await cap('أدويتي', 'تذكير بالأوقات المتفق عليها، وتسجيل الجرعة');
  await page.getByRole('button', { name: 'أخذت' }).first().click();
  await page.getByText('أخذتها').first().waitFor();
  await hold(page, 1800); await shot('meds', 'أدويتي', 'تذكير بالأوقات، وتسجيل «أخذت» لكل جرعة');
  await page.goto(`${BASE}/patient/notifications`);
  await cap('الإشعارات', 'تأكيد الحجز، الوصفة، والنتيجة');
  await hold(page, 1800); await shot('notifications', 'الإشعارات', 'تأكيد الحجز والوصفة والنتيجة');
});

// 8) super admin ------------------------------------------------------------------
await scene('admin', 'المدير العام', 'إدارة المنصة', DESK, async ({ page, cap, shot }) => {
  await proLogin(page, 'admin@demo.test');
  await page.goto(`${BASE}/platform-admin`);
  await cap('نظرة عامة على المنصة', 'الجهات، الحسابات، والطلبات المعلقة');
  await hold(page, 2000); await shot('overview', 'لوحة المدير العام', 'نظرة عامة على المنصة');
  await page.goto(`${BASE}/platform-admin/organizations`);
  await cap('الجهات', 'عيادة أو صيدلية أو مختبر — المجمع اختياري');
  await hold(page, 2000); await shot('orgs', 'الجهات والمجمعات', 'إضافة جهة مستقلة أو ضمن مجمع');
  await page.goto(`${BASE}/platform-admin/members`);
  await cap('الحسابات والعضويات', 'دعوة الموظفين، تعليقهم، وربط السكرتير بطبيبه');
  await hold(page, 2000); await shot('members', 'الحسابات والعضويات', 'دعوة موظف، تعليق، وربط السكرتير بطبيبه');
  await page.goto(`${BASE}/platform-admin/reports`);
  await page.getByLabel('المجمع').selectOption({ label: 'مجمع الرافدين الطبي (تجريبي)' });
  await page.getByText('المحصّل').first().waitFor();
  await cap('التقارير والمالية', 'المواعيد، الإيرادات، المصاريف — بلا بيانات طبية');
  await hold(page, 2000); await shot('reports', 'التقارير والمالية', 'أرقام تشغيلية ومالية بلا بيانات طبية');
  await page.goto(`${BASE}/platform-admin/audit`);
  await cap('سجل التدقيق', 'من فتح ماذا ومتى — بما فيها البطاقة الطبية');
  await hold(page, 2000); await shot('audit', 'سجل التدقيق', 'كل وصول حساس مسجّل: من، ماذا، متى');
  await page.goto(`${BASE}/platform-admin/health`);
  await cap('صحة النظام', 'المهام المجدولة والطوابير');
  await hold(page, 1800); await shot('health', 'صحة النظام', 'المهام المجدولة والطوابير والتنبيهات');
});

await writeFile(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 2));
await browser.close();
console.log(`Tour done: ${manifest.scenes.length} scenes, ${manifest.shots.length} screenshots`);
