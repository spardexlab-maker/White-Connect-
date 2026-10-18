// Renders the mobile app icon / adaptive icon / splash PNGs (no external design tools).
import { chromium } from 'playwright';
const out = 'apps/mobile/assets';
const mark = (fg) => `<svg viewBox="0 0 100 100" width="100%" height="100%"><rect x="38" y="14" width="24" height="72" rx="7" fill="${fg}"/><rect x="14" y="38" width="72" height="24" rx="7" fill="${fg}"/><circle cx="50" cy="50" r="9" fill="#0F766E"/></svg>`;
const page = (bg, inner, pad) => `<html><body style="margin:0;background:${bg};display:flex;align-items:center;justify-content:center;width:100vw;height:100vh"><div style="width:${100 - pad * 2}vw;height:${100 - pad * 2}vh">${inner}</div></body></html>`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1024, height: 1024 } });
for (const [file, html, transparent] of [
  ['icon.png', page('#123B5D', mark('#FFFFFF'), 20), false],
  ['adaptive-icon.png', page('transparent', mark('#FFFFFF'), 30), true],
  ['splash.png', page('transparent', mark('#FFFFFF'), 10), true],
  ['favicon.png', page('#123B5D', mark('#FFFFFF'), 16), false],
]) {
  await p.setContent(html);
  await p.screenshot({ path: `${out}/${file}`, omitBackground: transparent });
}
await b.close();
console.log('assets written');
