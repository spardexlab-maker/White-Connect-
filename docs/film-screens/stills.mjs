// Quick look at a built film: stills at the given seconds.  node stills.mjs <work-dir> <out-dir> 1 5.5 12 …
import { chromium } from 'playwright';
const [dir, out, ...ts] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto(`file://${dir}/film.html`);
await p.evaluate(async () => { await Promise.all([...document.fonts].map((f) => f.load().catch(() => {}))); });
for (const t of ts) { await p.evaluate((t) => window.seek(t), +t); await p.screenshot({ path: `${out}/s${t}.jpg`, type: 'jpeg', quality: 85 }); }
await b.close();
