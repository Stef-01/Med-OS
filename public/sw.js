/* sw.js - MDosce's Daily reminders (js/osce/reminders.mjs). PUSH ONLY: no fetch handler, so the worker never caches or
   serves the app; every load still comes from the network. The sender (Supabase edge function pup-push) posts
   { title, body, kind } encrypted with the VAPID key; a tap opens MDosce. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(String(d.title || 'MDosce').slice(0, 80), {
    body: String(d.body || '').slice(0, 240),
    tag: 'mdosce-' + (d.kind === 'sad' ? 'sad' : 'quote'), icon: './js/vendor/pup-duel/pup/rig/icons/pip.png', badge: './js/vendor/pup-duel/pup/rig/icons/pip.png',
    data: { url: './' }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) if ('focus' in c) return c.focus();
    return self.clients.openWindow(url);
  }));
});
