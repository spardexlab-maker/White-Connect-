import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // build id shown next to error reports (Cloudflare Pages sets the commit)
  define: { __APP_VERSION__: JSON.stringify((process.env.CF_PAGES_COMMIT_SHA ?? 'dev').slice(0, 7)) },
  server: { port: 5173, strictPort: true },
  build: { sourcemap: false, target: 'es2022' },
});
