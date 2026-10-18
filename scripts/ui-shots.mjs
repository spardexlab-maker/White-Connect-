// Screenshots of the v2 UI at several widths. Usage:
//   node scripts/ui-shots.mjs <outDir> <name> <path> [email] [widths]
// e.g. node scripts/ui-shots.mjs /tmp/out home /patient "" 390,1440
import { chromium } from 'playwright';
const [out, name, path, email = '', widthsArg = '390,1440'] = process.argv.slice(2);
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173';
const browser = await chromium.launch();
const errors = [];
for (const w of widthsArg.split(',').map(Number)) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 800 ? 844 : 900 }, deviceScaleFactor: w < 800 ? 2 : 1, locale: 'ar-IQ', timezoneId: 'Asia/Baghdad', reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  if (email) {
    await p.goto(`${BASE}/login`);
    await p.getByLabel('البريد الإلكتروني').fill(email);
    await p.getByLabel('كلمة المرور').fill('Demo-Pass-2026!');
    await p.getByRole('button', { name: /دخول/ }).click();
    await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 });
  }
  await p.goto(`${BASE}${path}`);
  await p.waitForLoadState('networkidle');
  await p.waitForTimeout(600);
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await p.screenshot({ path: `${out}/${name}-${w}.png`, fullPage: true });
  console.log(`${name}-${w}${overflow > 1 ? `  ⚠ horizontal overflow ${overflow}px` : ''}`);
  await ctx.close();
}
if (errors.length) console.log('page errors:', errors);
await browser.close();
