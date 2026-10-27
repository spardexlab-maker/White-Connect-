// Voice-over script for a recorded narrator: one PDF per film with each line, its time
// window in the film and what is on screen. Reads the timing the build wrote (data.js).
// Usage: node docs/film-screens/voice-script.mjs <work-dir> <out.pdf> <video-file-name>
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const [dir, out, video] = process.argv.slice(2);
const F = JSON.parse(readFileSync(`${dir}/data.js`, 'utf8').trim().replace(/^window\.FILM=/, '').replace(/;$/, ''));
const NAMES = { patient: 'المريض', doctor: 'الطبيب', lab: 'المختبر', pharmacy: 'الصيدلية' };
const CODE = { patient: 'P', doctor: 'D', lab: 'L', pharmacy: 'F' }[F.name];
const font = (w) => `@font-face{font-family:'Plex';font-weight:${w};src:url(data:font/woff2;base64,${readFileSync(`apps/web/node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-${w}-normal.woff2`).toString('base64')})}`;
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const rows = F.scenes.map((s, i) => {
  const from = s.start + s.audioOffset, to = s.start + s.dur - 0.4;
  const screen = s.layout === 'title' ? `افتتاحية: «${s.title}»` : s.layout === 'outro' ? 'الخاتمة: الشعار ومعلومات التواصل' : `${s.tag}: ${s.head}`;
  return `<tr><td class="n">${i + 1}</td><td class="t"><b>${mmss(from)} – ${mmss(to)}</b><span>${(to - from).toFixed(1)} ثانية</span></td>
    <td class="s">${screen}</td><td class="x">${s.text}</td><td class="f">${CODE}${i + 1}</td></tr>`;
}).join('');
const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
  ${font(400)}${font(500)}${font(700)}
  @page { size: A4; margin: 16mm 14mm; }
  body { font-family: 'Plex', sans-serif; color: #152536; font-size: 13px; }
  h1 { font-size: 22px; margin: 0 0 4px; color: #123B5D; } .sub { color: #526171; margin-bottom: 14px; }
  .tips { background: #E6F4F1; border-radius: 10px; padding: 10px 14px; margin-bottom: 14px; line-height: 1.8; }
  .tips b { color: #0F766E; }
  table { width: 100%; border-collapse: collapse; } th { background: #123B5D; color: #fff; padding: 8px; font-size: 12px; text-align: right; }
  td { border-bottom: 1px solid #DCE3EB; padding: 9px 8px; vertical-align: top; }
  td.n { width: 22px; font-weight: 700; color: #0F766E; } td.t { width: 88px; } td.t span { display: block; color: #526171; font-size: 11px; }
  td.s { width: 130px; color: #526171; font-size: 12px; } td.x { font-size: 15px; line-height: 1.7; font-weight: 500; } td.f { width: 34px; direction: ltr; color: #526171; }
  tr { page-break-inside: avoid; }
</style></head><body>
  <h1>أبيض — فيديو ${NAMES[F.name]}: نص التعليق الصوتي</h1>
  <div class="sub">ملف الفيديو: ${video} · المدة ${mmss(F.total)} · ${F.scenes.length} جمل</div>
  <div class="tips">
    <b>طريقة التسجيل:</b> مكان هادئ بدون صدى، والموبايل على بعد شبر من الفم. سجّل <b>كل جملة بملف وحدها</b> وسمّه بالرمز اللي بآخر السطر (مثلاً ${CODE}1).<br>
    <b>السرعة:</b> كل جملة لازم تخلص ضمن «الوقت المتاح» يمّها. إذا طوّلت، اختصر الكلام شوية بنفس المعنى، ولا تسرّع كلش.<br>
    <b>النبرة:</b> عراقية طبيعية، ودودة وواثقة، مثل واحد يشرح لصديقه. بعدها دزلي الملفات وأركّبها على الفيديو ويا الموسيقى والكتابة.
  </div>
  <table><thead><tr><th>#</th><th>الوقت بالفيديو</th><th>على الشاشة</th><th>الكلام</th><th>الملف</th></tr></thead><tbody>${rows}</tbody></table>
</body></html>`;
const b = await chromium.launch();
const p = await b.newPage();
await p.setContent(html);
await p.pdf({ path: out, format: 'A4', printBackground: true, margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' } });
await b.close();
console.log('script:', out);
