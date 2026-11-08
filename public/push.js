'use strict';
/* Obavještenja (Web Push): kartica u „Moj put”. Uključivanje, izbor vrsta obavještenja i sinhronizacija sačuvanih događaja.
   Server šalje (1) promocije i akcije, (2) podsjetnik dan prije događaja koji je u „Moj put”. */
(() => {
  const P = {
    sr: { h: 'Obavještenja', d: 'Promocije i akcije, i podsjetnik dan prije događaja koje si sačuvao.', on: 'Uključi obavještenja', off: 'Isključi obavještenja',
      promo: 'Promocije i akcije', remind: 'Podsjetnik dan prije događaja iz „Moj put”', blocked: 'Obavještenja su blokirana. Dozvoli ih u podešavanjima telefona ili preglednika za ovaj sajt.',
      ios: 'Na iPhone-u prvo dodaj aplikaciju na početni ekran (Dijeli, pa „Dodaj na početni ekran”), otvori je odatle i tek onda uključi obavještenja.', err: 'Nije uspjelo. Pokušaj ponovo.', done: 'Obavještenja su uključena', gone: 'Obavještenja su isključena' },
    en: { h: 'Notifications', d: 'Deals and offers, plus a reminder the day before events you saved.', on: 'Turn on notifications', off: 'Turn off notifications',
      promo: 'Deals and offers', remind: 'Reminder the day before events in My trip', blocked: 'Notifications are blocked. Allow them for this site in your phone or browser settings.',
      ios: 'On iPhone, first add the app to your Home Screen (Share, then “Add to Home Screen”), open it from there, then turn on notifications.', err: 'Something went wrong. Try again.', done: 'Notifications are on', gone: 'Notifications are off' },
    de: { h: 'Benachrichtigungen', d: 'Angebote und Aktionen sowie eine Erinnerung am Tag vor gespeicherten Veranstaltungen.', on: 'Benachrichtigungen aktivieren', off: 'Benachrichtigungen deaktivieren',
      promo: 'Angebote und Aktionen', remind: 'Erinnerung am Vortag für Veranstaltungen in „Meine Reise“', blocked: 'Benachrichtigungen sind blockiert. Erlaube sie für diese Seite in den Einstellungen deines Handys oder Browsers.',
      ios: 'Auf dem iPhone füge die App zuerst zum Home-Bildschirm hinzu (Teilen, dann „Zum Home-Bildschirm“), öffne sie dort und aktiviere dann die Benachrichtigungen.', err: 'Das hat nicht geklappt. Versuche es erneut.', done: 'Benachrichtigungen sind aktiv', gone: 'Benachrichtigungen sind aus' },
    ru: { h: 'Уведомления', d: 'Акции и предложения, а также напоминание за день до сохранённых событий.', on: 'Включить уведомления', off: 'Выключить уведомления',
      promo: 'Акции и предложения', remind: 'Напоминание за день до событий из «Моего маршрута»', blocked: 'Уведомления заблокированы. Разрешите их для этого сайта в настройках телефона или браузера.',
      ios: 'На iPhone сначала добавьте приложение на экран «Домой» (Поделиться, затем «На экран Домой»), откройте его оттуда и включите уведомления.', err: 'Не получилось. Попробуйте ещё раз.', done: 'Уведомления включены', gone: 'Уведомления выключены' },
    it: { h: 'Notifiche', d: 'Offerte e promozioni, più un promemoria il giorno prima degli eventi salvati.', on: 'Attiva le notifiche', off: 'Disattiva le notifiche',
      promo: 'Offerte e promozioni', remind: 'Promemoria il giorno prima degli eventi in «Il mio viaggio»', blocked: 'Le notifiche sono bloccate. Consentile per questo sito nelle impostazioni del telefono o del browser.',
      ios: 'Su iPhone aggiungi prima l’app alla schermata Home (Condividi, poi «Aggiungi alla schermata Home»), aprila da lì e poi attiva le notifiche.', err: 'Non è andata a buon fine. Riprova.', done: 'Notifiche attive', gone: 'Notifiche disattivate' },
  };
  const tx = (k) => (P[typeof LANG === 'string' && P[LANG] ? LANG : 'en'] || P.en)[k];
  const box = () => document.getElementById('pushbox');
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const toastMsg = (m) => { if (typeof toast === 'function') toast(m); };

  let cfg = null;       // { enabled, key } sa servera
  let sub = null;       // PushSubscription ili null
  let prefs = { promo: true, remind: true };
  try { Object.assign(prefs, JSON.parse(localStorage.getItem('mp.push') || '{}')); } catch { /* ignore */ }
  const savePrefs = () => { try { localStorage.setItem('mp.push', JSON.stringify(prefs)); } catch { /* ignore */ } };

  const slugs = () => {
    try { return (JSON.parse(localStorage.getItem('mp.plan') || '[]') || []).filter((k) => /^i:[a-z0-9-]{1,60}$/.test(k)).map((k) => k.slice(2)); } catch { return []; }
  };
  const call = (method, path, body) => fetch('/api/push' + path, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  const b64uToBytes = (s) => { const t = s.replace(/-/g, '+').replace(/_/g, '/'); return Uint8Array.from(atob(t + '='.repeat((4 - (t.length % 4)) % 4)), (c) => c.charCodeAt(0)); };

  async function load() {
    if (!supported) return;
    try { cfg = await (await fetch('/api/push/key')).json(); } catch { cfg = null; }
    try { const reg = await navigator.serviceWorker.ready; sub = await reg.pushManager.getSubscription(); } catch { sub = null; }
    if (sub && Notification.permission === 'granted') register(); // upis je idempotentan: popravlja i izgubljenu pretplatu na serveru
    render();
  }
  const body = () => ({ endpoint: sub.endpoint, keys: sub.toJSON().keys, lang: LANG, promo: prefs.promo, remind: prefs.remind, saved: slugs() });
  const register = () => call('POST', '/subscribe', body()).catch(() => {});

  async function enable() {
    if (!cfg || !cfg.enabled) return;
    const b = box().querySelector('[data-pon]'); if (b) b.disabled = true;
    try {
      if ((await Notification.requestPermission()) !== 'granted') { render(); return; }
      const reg = await navigator.serviceWorker.ready;
      sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(cfg.key) }));
      const r = await call('POST', '/subscribe', body());
      if (!r.ok) throw new Error('subscribe');
      toastMsg(tx('done'));
    } catch { try { if (sub) await sub.unsubscribe(); } catch { /* ignore */ } sub = null; toastMsg(tx('err')); }
    render();
  }
  async function disable() {
    const s = sub; sub = null; render();
    try { if (s) { await call('POST', '/unsubscribe', { endpoint: s.endpoint }); await s.unsubscribe(); } toastMsg(tx('gone')); } catch { /* ignore */ }
  }

  function render() {
    const el = box(); if (!el) return;
    if (!supported && !(ios && !standalone)) { el.hidden = true; return; }
    if (supported && (!cfg || !cfg.enabled)) { el.hidden = true; return; }
    el.hidden = false;
    let inner;
    if (!supported || (ios && !standalone && !sub)) inner = `<p class="pd">${tx('ios')}</p>`;
    else if (Notification.permission === 'denied') inner = `<p class="pd">${tx('blocked')}</p>`;
    else if (!sub) inner = `<p class="pd">${tx('d')}</p><button class="btn p full" type="button" data-pon>${tx('on')}</button>`;
    else {
      inner = `<label class="pr"><input type="checkbox" data-pk="promo" ${prefs.promo ? 'checked' : ''}><span>${tx('promo')}</span></label>
        <label class="pr"><input type="checkbox" data-pk="remind" ${prefs.remind ? 'checked' : ''}><span>${tx('remind')}</span></label>
        <button class="btn s full" type="button" data-poff>${tx('off')}</button>`;
    }
    el.innerHTML = `<h2>${tx('h')}</h2>${inner}`;
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-pon]')) enable();
    else if (e.target.closest('[data-poff]')) disable();
  });
  document.addEventListener('change', (e) => {
    const k = e.target && e.target.getAttribute && e.target.getAttribute('data-pk');
    if (!k || !sub) return;
    prefs[k] = e.target.checked; savePrefs();
    call('PUT', '/prefs', { endpoint: sub.endpoint, lang: LANG, promo: prefs.promo, remind: prefs.remind, saved: slugs() }).catch(() => {});
  });

  /* app.js zove ovo kad se plan promijeni, i kad se otvori „Moj put” */
  let timer;
  window.mpPushSync = () => {
    clearTimeout(timer);
    timer = setTimeout(() => { if (sub) call('PUT', '/prefs', { endpoint: sub.endpoint, lang: LANG, saved: slugs() }).catch(() => {}); }, 1500);
  };
  window.mpPushRender = render;
  load();
})();
