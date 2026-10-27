// Renders film.html frame by frame (25 fps, 1920×1080) into a silent H.264 file.
// Usage: node docs/film-screens/render.mjs <work-dir> <out.mp4> [from-s to-s]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const [dir, out, from, to] = process.argv.slice(2);
const FPS = 25;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto(`file://${dir}/film.html`);
await p.evaluate(async () => { await Promise.all([...document.fonts].map((f) => f.load().catch(() => {}))); await document.fonts.ready; });
const total = await p.evaluate(() => window.TOTAL);
const f0 = Math.round((from ? +from : 0) * FPS), f1 = Math.round((to ? +to : total) * FPS);
const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
for (let i = f0; i < f1; i++) {
  await p.evaluate((t) => window.seek(t), i / FPS);
  const buf = await p.screenshot({ type: 'jpeg', quality: 94 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if ((i - f0) % 250 === 0) console.log(`frame ${i - f0}/${f1 - f0}`);
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
await b.close();
console.log('rendered', out);
