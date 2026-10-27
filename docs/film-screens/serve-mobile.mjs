// Serves the mobile app's web export (single-page fallback) for recording.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json', '.ico': 'image/x-icon' };
export function serveMobile(dir, port = 8099) {
  return createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    try { const body = await readFile(join(dir, path)); res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' }); res.end(body); }
    catch { res.writeHead(200, { 'content-type': 'text/html' }); res.end(await readFile(join(dir, 'index.html'))); }
  }).listen(port);
}
