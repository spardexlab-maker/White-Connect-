import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const dir = process.argv[2], out = process.argv[3], FPS = 25;
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto(`file://${dir}/film.html`); await p.evaluate(() => document.fonts.ready);
const meta = await p.evaluate(() => ({ total: window.TOTAL, audio: window.AUDIO, dings: window.DINGS }));
writeFileSync(`${dir}/timeline.json`, JSON.stringify(meta));
const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
const n = Math.ceil(meta.total * FPS);
for (let i = 0; i < n; i++) {
  await p.evaluate((t) => window.seek(t), i / FPS);
  const buf = await p.screenshot({ type: 'jpeg', quality: 93 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if (i % 250 === 0) console.log(`frame ${i}/${n}`);
}
ff.stdin.end(); await new Promise((r) => ff.on('close', r)); await b.close(); console.log('done', n);
