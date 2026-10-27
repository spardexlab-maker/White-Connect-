// Google Play store graphics: framed phone screenshots (1080×1920) with Arabic captions,
// the feature graphic (1024×500) and the 512×512 icon.
// Usage: node scripts/make_play_assets.mjs <raw-screens-dir> <out-dir>
// (raw screens come from: node scripts/e2e-mobile.mjs apps/mobile/dist-local <raw-screens-dir>)
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const [raw, out] = process.argv.slice(2).map((p) => resolve(p));
if (!raw || !out) { console.error('usage: node scripts/make_play_assets.mjs <raw-dir> <out-dir>'); process.exit(2); }
await mkdir(out, { recursive: true });
const font = (pkg, file) => `data:font/woff2;base64,${readFileSync(resolve('apps/web/node_modules/@fontsource', pkg, 'files', file)).toString('base64')}`;
const data = async (p) => `data:image/png;base64,${(await readFile(p)).toString('base64')}`;
const css = `
@font-face { font-family: Display; font-weight: 700; src: url(${font('alexandria', 'alexandria-arabic-700-normal.woff2')}); }
@font-face { font-family: DisplayLatin; font-weight: 700; src: url(${font('alexandria', 'alexandria-latin-700-normal.woff2')}); }
@font-face { font-family: BodyLatin; font-weight: 500; src: url(${font('ibm-plex-sans-arabic', 'ibm-plex-sans-arabic-latin-500-normal.woff2')}); }
@font-face { font-family: Body; font-weight: 500; src: url(${font('ibm-plex-sans-arabic', 'ibm-plex-sans-arabic-arabic-500-normal.woff2')}); }
* { margin: 0; box-sizing: border-box; }
body { direction: rtl; font-family: Body, BodyLatin, sans-serif; color: #fff; overflow: hidden;
  background: radial-gradient(900px 700px at 85% 8%, #1B4E78 0%, transparent 60%), radial-gradient(700px 600px at 0% 100%, #0F766E55 0%, transparent 60%), linear-gradient(160deg, #123B5D, #0B2A43); }
.brand { display: flex; align-items: center; gap: 14px; font-family: Display, DisplayLatin; font-size: 34px; opacity: .95; }
.brand img { height: 46px; }
h1 { font-family: Display, DisplayLatin; font-weight: 700; line-height: 1.25; }
p { color: #CDEAE4; line-height: 1.5; }
.phone { border-radius: 64px; padding: 16px; background: #08192A; box-shadow: 0 40px 90px rgba(0,0,0,.45), inset 0 0 0 2px #24435f; }
.phone img { display: block; border-radius: 50px; }
`;
const shots = [
  ['m01-home', 'طبيبك أقرب مما تتصور', 'ابحث بالاسم أو الاختصاص، أو اسأل المساعد الذكي'],
  ['m03-slots', 'احجز موعدك بثوانٍ', 'اختر اليوم والوقت المناسب لك'],
  ['m02-provider', 'اعرف طبيبك قبل الزيارة', 'الاختصاص والخدمات والأسعار وأيام العمل'],
  ['m05-booked', 'تأكيد واضح لحجزك', 'رقم حجز وحالة الطلب، والعيادة تؤكد موعدك'],
  ['m08-journey', 'كل رحلتك الطبية هنا', 'زياراتك ووصفاتك وتحاليلك وتذكير أدويتك'],
  ['m07-account-qr', 'بطاقتك الطبية برمز QR', 'اعرضها في الاستقبال وسجّل حضورك بسرعة'],
];
const logo = await data('apps/web/public/logo-symbol.png');
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1080, height: 1920 } });
let i = 0;
for (const [file, title, sub] of shots) {
  const img = await data(`${raw}/${file}.png`);
  await page.setContent(`<style>${css}
    body { width: 1080px; height: 1920px; padding: 72px 80px 0; display: flex; flex-direction: column; align-items: center; }
    .top { align-self: stretch; } h1 { font-size: 76px; margin-top: 44px; } p { font-size: 38px; margin-top: 18px; }
    .phone { margin-top: 64px; } .phone img { width: 640px; }</style>
    <div class="top"><div class="brand"><img src="${logo}">أبيض</div><h1>${title}</h1><p>${sub}</p></div>
    <div class="phone"><img src="${img}"></div>`);
  await page.evaluate(async () => { await Promise.all([...document.fonts].map((f) => f.load())); await document.fonts.ready; });
  await page.screenshot({ path: `${out}/screenshot-${++i}.png` });
}
// feature graphic
await page.setViewportSize({ width: 1024, height: 500 });
const home = await data(`${raw}/m01-home.png`);
await page.setContent(`<style>${css}
  body { width: 1024px; height: 500px; display: flex; align-items: center; padding: 0 64px; gap: 40px; }
  .txt { flex: 1; } h1 { font-size: 54px; margin-top: 18px; white-space: nowrap; } p { font-size: 27px; margin-top: 14px; }
  .brand { font-size: 30px; } .brand img { height: 52px; }
  .phone { padding: 10px; border-radius: 40px; transform: rotate(-6deg) translateY(150px); align-self: flex-start; } .phone img { width: 300px; border-radius: 32px; }</style>
  <div class="txt"><div class="brand"><img src="${logo}">أبيض · ABYAD</div><h1>صحتك في مكان واحد</h1>
  <p>احجز عند طبيبك أو المختبر، وتابع نتائجك ووصفاتك وتذكير أدويتك</p></div>
  <div class="phone"><img src="${home}"></div>`);
await page.evaluate(async () => { await Promise.all([...document.fonts].map((f) => f.load())); await document.fonts.ready; });
await page.screenshot({ path: `${out}/feature-graphic.png` });
await b.close();
await copyFile('apps/web/public/icon-512.png', `${out}/icon-512.png`);
console.log('done', out);
