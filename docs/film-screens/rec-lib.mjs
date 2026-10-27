// Screen-recording helpers for the explainer films: real app screens captured with the
// Chrome DevTools screencast (sharp frames, not a compressed video), a visible touch dot
// that glides to each tap, and human pacing for typing.
import { mkdirSync, writeFileSync } from 'node:fs';

export const FPS = 25;

// a finger/cursor dot that follows the (synthetic) mouse and ripples on press
const CURSOR = `(() => {
  const add = () => {
    if (document.getElementById('__dot')) return;
    const s = document.createElement('style');
    s.textContent = '#__dot{position:fixed;z-index:2147483647;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;background:rgba(15,118,110,.28);border:2.5px solid rgba(255,255,255,.95);box-shadow:0 2px 10px rgba(0,0,0,.35);pointer-events:none;left:-60px;top:-60px;transition:transform .12s}#__dot.down{transform:scale(.72);background:rgba(15,118,110,.55)}.__rip{position:fixed;z-index:2147483646;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:3px solid rgba(94,234,212,.9);pointer-events:none;animation:__r .5s ease-out forwards}@keyframes __r{to{transform:scale(2.6);opacity:0}}';
    document.documentElement.appendChild(s);
    const d = document.createElement('div'); d.id = '__dot'; document.documentElement.appendChild(d);
    addEventListener('mousemove', (e) => { d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', (e) => { d.classList.add('down'); const r = document.createElement('div'); r.className = '__rip'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'; document.documentElement.appendChild(r); setTimeout(() => r.remove(), 600); }, true);
    addEventListener('mouseup', () => d.classList.remove('down'), true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
})();`;

export async function preparePage(page) {
  await page.addInitScript(CURSOR);
  page.__pos = { x: 200, y: 400 };
}

/** Glide the dot to the element, then tap it. */
export async function tap(page, locator, opts = {}) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error('tap: element not visible');
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y, { steps: 18 });
  page.__pos = { x, y };
  await page.waitForTimeout(opts.before ?? 260);
  await page.mouse.down(); await page.waitForTimeout(90); await page.mouse.up();
  await page.waitForTimeout(opts.after ?? 450);
}

/** Tap a field and type like a person. */
export async function type(page, locator, text, delay = 70) {
  await tap(page, locator, { after: 150 });
  await locator.fill('');
  await locator.pressSequentially(text, { delay });
  await page.waitForTimeout(350);
}

/** Smooth scroll of the page (or the scrollable element under the dot). */
export async function scroll(page, dy, ms = 900) {
  const steps = Math.max(8, Math.round(ms / 30));
  for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, dy / steps); await page.waitForTimeout(ms / steps); }
  await page.waitForTimeout(250);
}

export const pause = (page, ms) => page.waitForTimeout(ms);

/**
 * Record one clip: frames from the DevTools screencast, resampled to a constant 25 fps
 * JPEG sequence in <dir>/<name>/. Returns { frames, seconds }.
 */
export async function record(page, dir, name, run, { maxWidth = 2160, maxHeight = 2160 } = {}) {
  const cdp = await page.context().newCDPSession(page);
  const got = [];
  cdp.on('Page.screencastFrame', async (f) => {
    got.push({ t: f.metadata.timestamp, data: f.data });
    try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch { /* closing */ }
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth, maxHeight, everyNthFrame: 1 });
  const t0 = Date.now() / 1000;
  await page.waitForTimeout(400);
  await run();
  await page.waitForTimeout(500);
  const t1 = Date.now() / 1000;
  await cdp.send('Page.stopScreencast');
  await cdp.detach();
  const out = `${dir}/${name}`;
  mkdirSync(out, { recursive: true });
  // the screencast only sends a frame when something changes: hold the last one between frames
  let j = 0, n = 0;
  if (!got.length) throw new Error(`record ${name}: no frames`);
  for (let t = t0; t <= t1; t += 1 / FPS) {
    while (j + 1 < got.length && got[j + 1].t <= t) j++;
    writeFileSync(`${out}/${String(n++).padStart(5, '0')}.jpg`, Buffer.from(got[j].data, 'base64'));
  }
  writeFileSync(`${out}/meta.json`, JSON.stringify({ frames: n, seconds: n / FPS }));
  console.log(`● ${name}: ${(n / FPS).toFixed(1)} s`);
  return { frames: n, seconds: n / FPS };
}
