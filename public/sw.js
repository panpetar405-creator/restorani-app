// Shell iz keša (stale-while-revalidate); lista restorana mrežom, a keš samo kad nema veze.
const V = 'montepalm-v32';
const SHELL = ['/', '/styles.css', '/app.js', '/i18n.js', '/korisno.js', '/push.js', '/manifest.webmanifest', '/icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.startsWith('/admin') || u.pathname.startsWith('/s/')) return; // admin i stranice za dijeljenje uvijek sa mreže
  const pub = u.pathname === '/api/restaurants' || u.pathname === '/api/offers' || u.pathname === '/api/items';
  if (u.pathname.startsWith('/api/') && !pub) return; // vlasnički i ostali API nikad iz keša
  if (pub) {
    e.respondWith(
      fetch(r)
        .then((res) => {
          if (res.ok) { const c = res.clone(); caches.open(V).then((x) => x.put(r, c)); }
          return res;
        })
        .catch(() => caches.match(r)),
    );
    return;
  }
  e.respondWith(
    caches.match(r).then((hit) => {
      const net = fetch(r)
        .then((res) => {
          if (res.ok) { const c = res.clone(); caches.open(V).then((x) => x.put(r, c)); }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    }),
  );
});

/* ---- push obavještenja ---- */
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = {}; }
  e.waitUntil(self.registration.showNotification(String(d.title || 'Montepalm').slice(0, 80), {
    body: String(d.body || '').slice(0, 200),
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: typeof d.tag === 'string' ? d.tag.slice(0, 60) : undefined,
    data: { url: typeof d.url === 'string' ? d.url : '/' },
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  let url = new URL('/', self.location.origin).href;
  try { const u = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin); if (u.origin === self.location.origin) url = u.href; } catch { /* ostaje početna */ }
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const c = list.find((x) => 'focus' in x);
      if (!c) return self.clients.openWindow(url);
      return c.focus().then(() => ('navigate' in c ? c.navigate(url).catch(() => c) : c));
    }),
  );
});
/* preglednik je promijenio ili obnovio pretplatu: javi serveru novu adresu, uz izbor sa stare */
self.addEventListener('pushsubscriptionchange', (e) => {
  e.waitUntil((async () => {
    const old = e.oldSubscription;
    const ns = e.newSubscription || (old ? await self.registration.pushManager.subscribe(old.options) : null);
    if (!ns) return;
    const j = ns.toJSON();
    await fetch('/api/push/subscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: j.endpoint, keys: j.keys, replaces: old ? old.endpoint : undefined }) });
  })().catch(() => {}));
});
