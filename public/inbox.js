'use strict';
/* Sanduče obavještenja: sw.js čuva svako primljeno obavještenje u IndexedDB, a ovdje ih prikazujemo (zvonce u heroju + lista). */
(() => {
  const X = {
    sr: { h: 'Obavještenja', empty: 'Još nema obavještenja. Kad stigne akcija ili podsjetnik, vidjećeš je ovdje.', clear: 'Obriši sva', close: 'Zatvori' },
    en: { h: 'Notifications', empty: 'No notifications yet. Deals and reminders will show up here.', clear: 'Clear all', close: 'Close' },
    de: { h: 'Benachrichtigungen', empty: 'Noch keine Benachrichtigungen. Angebote und Erinnerungen erscheinen hier.', clear: 'Alle löschen', close: 'Schließen' },
    ru: { h: 'Уведомления', empty: 'Пока нет уведомлений. Акции и напоминания появятся здесь.', clear: 'Очистить всё', close: 'Закрыть' },
    it: { h: 'Notifiche', empty: 'Ancora nessuna notifica. Offerte e promemoria appariranno qui.', clear: 'Cancella tutto', close: 'Chiudi' },
  };
  const tx = (k) => (X[typeof LANG === 'string' && X[LANG] ? LANG : 'en'])[k];
  const $ = (i) => document.getElementById(i);
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const open = () => new Promise((ok, no) => {
    if (!('indexedDB' in window)) { no(new Error('idb')); return; }
    const r = indexedDB.open('mp-inbox', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('n', { keyPath: 'id', autoIncrement: true });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => no(r.error);
  });
  const run = async (mode, fn) => {
    const db = await open();
    try {
      return await new Promise((ok, no) => {
        const tx = db.transaction('n', mode), st = tx.objectStore('n');
        const out = fn(st);
        tx.oncomplete = () => ok(out && 'result' in out ? out.result : undefined);
        tx.onerror = tx.onabort = () => no(tx.error);
      });
    } finally { db.close(); }
  };
  const list = () => run('readonly', (st) => st.getAll()).then((a) => (a || []).sort((x, y) => y.t - x.t)).catch(() => []);
  const markRead = () => run('readwrite', (st) => { st.openCursor().onsuccess = (e) => { const c = e.target.result; if (c) { if (!c.value.read) c.update({ ...c.value, read: 1 }); c.continue(); } }; }).catch(() => {});
  const wipe = () => run('readwrite', (st) => st.clear()).catch(() => {});

  const when = (t) => { try { return new Date(t).toLocaleString((typeof HTML_LANG === 'object' && HTML_LANG[LANG]) || 'en', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
  let items = [];
  // kucanje na promociju u zvoncu se računa kao otvaranje (najviše jednom po uređaju, to čuva server)
  const track = async (n) => {
    if (!n || !n.c || !('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.ready, s = await reg.pushManager.getSubscription();
      if (s) fetch('/api/push/event', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ c: n.c, kind: 'click', endpoint: s.endpoint }) }).catch(() => {});
    } catch { /* nije bitno */ }
  };

  function paint() {
    const un = items.filter((n) => !n.read).length, b = $('nbd');
    b.textContent = un > 9 ? '9+' : un; b.hidden = !un;
    $('nbtn').setAttribute('aria-label', tx('h') + (un ? ' (' + un + ')' : ''));
    $('nbtn').title = tx('h');
    $('inb-t').textContent = tx('h');
    $('inbx').setAttribute('aria-label', tx('close'));
    $('inbc').textContent = tx('clear'); $('inbc').hidden = !items.length;
    $('inbl').innerHTML = items.length
      ? items.map((n, i) => `<button class="nit${n.read ? '' : ' un'}" type="button" data-i="${i}"><b>${esc(n.title)}</b>${n.body ? `<span>${esc(n.body)}</span>` : ''}<time datetime="${new Date(n.t).toISOString()}">${esc(when(n.t))}</time></button>`).join('')
      : `<p class="em">${esc(tx('empty'))}</p>`;
  }
  const refresh = async () => { items = await list(); paint(); };

  async function show() {
    items = await list(); paint();
    $('inbox').hidden = false; $('inbx').focus();
    if (items.some((n) => !n.read)) { await markRead(); items = items.map((n) => ({ ...n, read: 1 })); const b = $('nbd'); b.hidden = true; $('nbtn').setAttribute('aria-label', tx('h')); }
  }
  function hide() { $('inbox').hidden = true; $('nbtn').focus(); refresh(); }

  $('nbtn').addEventListener('click', (e) => { e.stopPropagation(); show(); });
  $('inbox').addEventListener('click', (e) => {
    if (e.target.closest('[data-x]')) { hide(); return; }
    if (e.target.closest('#inbc')) { wipe().then(() => { items = []; paint(); }); return; }
    const b = e.target.closest('.nit'); if (!b) return;
    const n = items[+b.getAttribute('data-i')]; if (!n) return;
    $('inbox').hidden = true;
    track(n);
    try { const u = new URL(n.url || '/', location.origin); if (u.origin === location.origin) location.hash = u.hash || '#pocetna'; } catch { /* ostaje gdje jest */ }
    refresh();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('inbox').hidden) hide(); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.type === 'inbox') (!$('inbox').hidden ? show() : refresh()); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
  window.addEventListener('focus', refresh);
  window.mpInboxRender = paint; // app.js/i18n.js može pozvati pri promjeni jezika
  document.addEventListener('click', (e) => { if (e.target.closest('[data-lang]')) setTimeout(paint, 50); });
  refresh();
})();
