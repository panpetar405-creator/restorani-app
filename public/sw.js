// Shell iz keša (stale-while-revalidate); lista restorana mrežom, a keš samo kad nema veze.
const V = 'sto-v8';
const SHELL = ['/', '/styles.css', '/app.js', '/manifest.webmanifest', '/icons/icon-192.png'];

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
  const pub = u.pathname === '/api/restaurants' || u.pathname === '/api/offers';
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
