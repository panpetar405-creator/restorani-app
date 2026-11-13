// Shell iz keša (stale-while-revalidate); lista restorana mrežom, a keš samo kad nema veze.
const V = 'montepalm-v45';
const SHELL = ['/', '/styles.css', '/app.js', '/i18n.js', '/korisno.js', '/opstine.js', '/push.js', '/inbox.js', '/manifest.webmanifest', '/icons/icon-192.png'];

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
/* sanduče: svako primljeno obavještenje se čuva u IndexedDB da ga aplikacija može prikazati (najviše 50) */
const inboxDb = () => new Promise((ok, no) => {
  const r = indexedDB.open('mp-inbox', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('n', { keyPath: 'id', autoIncrement: true });
  r.onsuccess = () => ok(r.result);
  r.onerror = () => no(r.error);
});
async function inboxAdd(rec) {
  const db = await inboxDb();
  await new Promise((ok, no) => {
    const tx = db.transaction('n', 'readwrite'), st = tx.objectStore('n');
    st.add(rec);
    st.getAllKeys().onsuccess = (e) => { const k = e.target.result; k.slice(0, Math.max(0, k.length - 50)).forEach((x) => st.delete(x)); };
    tx.oncomplete = ok; tx.onerror = () => no(tx.error); tx.onabort = () => no(tx.error);
  });
  db.close();
  const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  list.forEach((c) => c.postMessage({ type: 'inbox' }));
}
/* statistika promocija: javi serveru da je obavještenje prikazano ili da je korisnik kucnuo na njega (brojke su donja granica: bez mreže se ne računa) */
async function track(c, kind) {
  if (!c) return;
  try {
    const s = await self.registration.pushManager.getSubscription();
    if (s) await fetch('/api/push/event', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ c, kind, endpoint: s.endpoint }), keepalive: true });
  } catch { /* nije bitno */ }
}
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = {}; }
  const title = String(d.title || 'Montepalm').slice(0, 80), body = String(d.body || '').slice(0, 200);
  const url = typeof d.url === 'string' ? d.url : '/';
  const cid = Number.isInteger(d.c) && d.c > 0 ? d.c : 0;
  e.waitUntil(Promise.all([
    inboxAdd({ t: Date.now(), title, body, url, c: cid, read: 0 }).catch(() => {}),
    self.registration.showNotification(title, {
      body,
      icon: '/icons/notif-192.png',
      badge: '/icons/badge-96.png',
      tag: typeof d.tag === 'string' ? d.tag.slice(0, 60) : undefined,
      data: { url, c: cid },
    }),
    track(cid, 'shown'),
  ]));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  let url = new URL('/', self.location.origin).href;
  try { const u = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin); if (u.origin === self.location.origin) url = u.href; } catch { /* ostaje početna */ }
  e.waitUntil(Promise.all([
    track(e.notification.data && e.notification.data.c, 'click'),
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const c = list.find((x) => 'focus' in x);
      if (!c) return self.clients.openWindow(url);
      return c.focus().then(() => ('navigate' in c ? c.navigate(url).catch(() => c) : c));
    }),
  ]));
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
