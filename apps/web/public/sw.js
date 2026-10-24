// Web Push for منصة الرعاية: shows the (generic) notification and opens the
// right page when it is tapped. Nothing is cached here — the app stays online-first.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = { title: 'منصة الرعاية', body: 'لديك تحديث جديد.', link: '/' };
  try { data = { ...data, ...event.data.json() }; } catch { /* keep the default text */ }
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body, dir: 'rtl', lang: 'ar',
    data: { link: data.link || '/' }, tag: data.link || undefined, renotify: true,
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.link || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (new URL(c.url).origin === self.location.origin) { await c.focus(); return c.navigate(url); }
    }
    return self.clients.openWindow(url);
  })());
});
