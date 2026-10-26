import { chromium } from 'playwright';
const [dir, outDir] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto(`file://${dir}/film.html`); if (process.env.NOCAP) await p.evaluate(() => { window.NOCAP = 1; }); await p.evaluate(() => document.fonts.ready);
const info = await p.evaluate(() => ({ total: window.TOTAL, a: window.AUDIO, s: window.SCRIPT.map((x) => x.dur) }));
console.log('total', info.total.toFixed(1));
for (let i = 0; i < info.a.length; i++) { const t = info.a[i].at + info.s[i] * 0.85;
  await p.evaluate((t) => window.seek(t), t); await p.screenshot({ path: `${outDir}/${String(i).padStart(2, '0')}-${info.a[i].id}.jpg`, type: 'jpeg', quality: 70 }); }
await b.close();
