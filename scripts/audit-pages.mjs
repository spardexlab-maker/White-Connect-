// Page audit: signs in as each role, opens every page in its navigation (phone and desktop width)
// and reports JS errors, failed API calls and sideways overflow. Local stack + dev server.
// Usage: node scripts/audit-pages.mjs [shots-dir]
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.BASE ?? 'http://127.0.0.1:5173';
const shots = process.argv[2];
if (shots) await mkdir(shots, { recursive: true });
const ROLES = [
  ['patient', 'hasan@demo.test', '/patient'],
  ['doctor', 'dr.ahmed@demo.test', '/workspace'],
  ['reception', 'reception.a@demo.test', '/workspace'],
  ['pharmacy', 'pharm.a@demo.test', '/workspace'],
  ['lab', 'lab.a@demo.test', '/workspace'],
  ['lab-approver', 'labapprover.a@demo.test', '/workspace'],
  ['admin', 'admin@demo.test', '/platform-admin'],
  ['guest', '', '/patient'],
];
const EXTRA = { guest: ['/doctors', '/labs', '/privacy', '/terms', '/account-deletion', '/login', '/join'], patient: ['/patient/assistant'] };
const browser = await chromium.launch();
let problems = 0, pages = 0;
for (const [role, email, home] of ROLES.filter(([r]) => !process.env.ROLE || r === process.env.ROLE)) {
  for (const width of [390, 1366]) {
    const ctx = await browser.newContext({ viewport: { width, height: width < 800 ? 844 : 900 }, locale: 'ar-IQ', timezoneId: 'Asia/Baghdad', reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    let issues = [];
    p.on('pageerror', (e) => issues.push(`JS error: ${e.message.slice(0, 160)}`));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) issues.push(`console: ${m.text().slice(0, 160)}`); });
    p.on('response', (r) => { if (r.status() >= 400 && /\/(rest|functions|auth)\/v1\//.test(r.url())) issues.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`); });
    if (email) {
      await p.goto(`${BASE}/login`);
      await p.getByLabel('البريد الإلكتروني').first().fill(email);
      await p.getByLabel('كلمة المرور').fill('Demo-Pass-2026!');
      await p.getByRole('button', { name: 'دخول', exact: true }).click();
      await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
    }
    await p.goto(`${BASE}${home}`);
    await p.waitForLoadState('networkidle').catch(() => undefined);
    // someone who works in several places picks one first
    if (await p.getByRole('heading', { name: 'اختر مساحة العمل' }).count()) {
      await p.locator('button, a').filter({ hasText: /عياد|صيدل|مختبر/ }).first().click();
      await p.waitForLoadState('networkidle').catch(() => undefined);
    }
    await p.waitForTimeout(800);
    const links = await p.evaluate(() => [...new Set([...document.querySelectorAll('nav a[href^="/"], aside a[href^="/"], header a[href^="/"]')].map((a) => a.getAttribute('href')))]);
    const todo = [...new Set([new URL(p.url()).pathname, ...links, ...(EXTRA[role] ?? [])])].filter((h) => h && !/logout/.test(h));
    for (const path of todo) {
      issues = [];
      await p.goto(`${BASE}${path}`).catch((e) => issues.push(`nav: ${e.message.slice(0, 80)}`));
      await p.waitForLoadState('networkidle').catch(() => undefined);
      await p.waitForTimeout(500);
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 2) issues.push(`sideways overflow ${overflow}px`);
      const crashed = await p.getByText(/صار خلل|حدث خطأ غير متوقع/).count();
      if (crashed) issues.push('error screen shown');
      pages++;
      if (issues.length) { problems++; console.log(`✗ ${role} @${width} ${path}\n    ${[...new Set(issues)].join('\n    ')}`); }
      if (shots) await p.screenshot({ path: `${shots}/${role}-${width}-${path.replace(/[^a-z0-9]+/gi, '_')}.png`, fullPage: true });
    }
    console.log(`· ${role} @${width}: ${todo.length} pages`);
    await ctx.close();
  }
}
await browser.close();
console.log(`${pages} page views, ${problems} with problems`);
