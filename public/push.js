'use strict';
/* Obavještenja (Web Push): kartica u „Moj put”. Uključivanje, izbor vrsta obavještenja i sinhronizacija sačuvanih događaja.
   Server šalje (1) promocije i akcije, (2) podsjetnik dan prije događaja koji je u „Moj put”. */
(() => {
  const P = {
    sr: { pl: 'Opštine koje me zanimaju', pld: 'Ako ništa ne izabereš, dobijaš promocije iz cijele Crne Gore.', h: 'Obavještenja', d: 'Promocije i akcije, i podsjetnik dan prije događaja koje si sačuvao.', on: 'Uključi obavještenja', off: 'Isključi obavještenja',
      promo: 'Promocije i akcije', remind: 'Podsjetnik dan prije događaja iz „Moj put”', blocked: 'Obavještenja su blokirana. Dozvoli ih u podešavanjima telefona ili preglednika za ovaj sajt.',
      ios: 'Na iPhone-u prvo dodaj aplikaciju na početni ekran (Dijeli, pa „Dodaj na početni ekran”), otvori je odatle i tek onda uključi obavještenja.', err: 'Nije uspjelo. Pokušaj ponovo.', done: 'Obavještenja su uključena', st: 'Uključena', gone: 'Obavještenja su isključena' },
    en: { pl: 'Places I am interested in', pld: 'If you choose none, you get offers from all over Montenegro.', h: 'Notifications', d: 'Deals and offers, plus a reminder the day before events you saved.', on: 'Turn on notifications', off: 'Turn off notifications',
      promo: 'Deals and offers', remind: 'Reminder the day before events in My trip', blocked: 'Notifications are blocked. Allow them for this site in your phone or browser settings.',
      ios: 'On iPhone, first add the app to your Home Screen (Share, then “Add to Home Screen”), open it from there, then turn on notifications.', err: 'Something went wrong. Try again.', done: 'Notifications are on', st: 'On', gone: 'Notifications are off' },
    de: { pl: 'Orte, die mich interessieren', pld: 'Wenn du nichts auswählst, erhältst du Angebote aus ganz Montenegro.', h: 'Benachrichtigungen', d: 'Angebote und Aktionen sowie eine Erinnerung am Tag vor gespeicherten Veranstaltungen.', on: 'Benachrichtigungen aktivieren', off: 'Benachrichtigungen deaktivieren',
      promo: 'Angebote und Aktionen', remind: 'Erinnerung am Vortag für Veranstaltungen in „Meine Reise“', blocked: 'Benachrichtigungen sind blockiert. Erlaube sie für diese Seite in den Einstellungen deines Handys oder Browsers.',
      ios: 'Auf dem iPhone füge die App zuerst zum Home-Bildschirm hinzu (Teilen, dann „Zum Home-Bildschirm“), öffne sie dort und aktiviere dann die Benachrichtigungen.', err: 'Das hat nicht geklappt. Versuche es erneut.', done: 'Benachrichtigungen sind aktiv', st: 'Aktiv', gone: 'Benachrichtigungen sind aus' },
    ru: { pl: 'Интересующие меня муниципалитеты', pld: 'Если ничего не выбрать, вы будете получать предложения со всей Черногории.', h: 'Уведомления', d: 'Акции и предложения, а также напоминание за день до сохранённых событий.', on: 'Включить уведомления', off: 'Выключить уведомления',
      promo: 'Акции и предложения', remind: 'Напоминание за день до событий из «Моего маршрута»', blocked: 'Уведомления заблокированы. Разрешите их для этого сайта в настройках телефона или браузера.',
      ios: 'На iPhone сначала добавьте приложение на экран «Домой» (Поделиться, затем «На экран Домой»), откройте его оттуда и включите уведомления.', err: 'Не получилось. Попробуйте ещё раз.', done: 'Уведомления включены', st: 'Включены', gone: 'Уведомления выключены' },
    it: { pl: 'Comuni che mi interessano', pld: 'Se non scegli nulla, ricevi offerte da tutto il Montenegro.', h: 'Notifiche', d: 'Offerte e promozioni, più un promemoria il giorno prima degli eventi salvati.', on: 'Attiva le notifiche', off: 'Disattiva le notifiche',
      promo: 'Offerte e promozioni', remind: 'Promemoria il giorno prima degli eventi in «Il mio viaggio»', blocked: 'Le notifiche sono bloccate. Consentile per questo sito nelle impostazioni del telefono o del browser.',
      ios: 'Su iPhone aggiungi prima l’app alla schermata Home (Condividi, poi «Aggiungi alla schermata Home»), aprila da lì e poi attiva le notifiche.', err: 'Non è andata a buon fine. Riprova.', done: 'Notifiche attive', st: 'Attive', gone: 'Notifiche disattivate' },
  };
  const tx = (k) => (P[typeof LANG === 'string' && P[LANG] ? LANG : 'en'] || P.en)[k];
  const box = () => document.getElementById('pushbox');
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const toastMsg = (m) => { if (typeof toast === 'function') toast(m); };

  let cfg = null;       // { enabled, key } sa servera
  let sub = null;       // PushSubscription ili null
  let prefs = { promo: true, remind: true, places: [] };
  try { Object.assign(prefs, JSON.parse(localStorage.getItem('mp.push') || '{}')); } catch { /* ignore */ }
  if (!Array.isArray(prefs.places)) prefs.places = [];
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
  const body = () => ({ endpoint: sub.endpoint, keys: sub.toJSON().keys, lang: LANG, promo: prefs.promo, remind: prefs.remind, saved: slugs(), places: prefs.places });
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

  let pnOpen = false; // zapamti da li su podešavanja otvorena kad se kartica ponovo iscrta
  document.addEventListener('toggle', (e) => { if (e.target.classList && e.target.classList.contains('pn')) pnOpen = e.target.open; }, true);
  function render() {
    document.dispatchEvent(new Event('mp-push')); // profil prati stanje prekidača
    const el = box(); if (!el) return;
    if (!supported && !(ios && !standalone)) { el.hidden = true; return; }
    if (supported && (!cfg || !cfg.enabled)) { el.hidden = true; return; }
    el.hidden = false;
    let inner, single = false;
    if (!supported || (ios && !standalone && !sub)) inner = `<p class="pd">${tx('ios')}</p>`;
    else if (Notification.permission === 'denied') inner = `<p class="pd">${tx('blocked')}</p>`;
    else if (!sub) inner = `<p class="pd">${tx('d')}</p><button class="btn p full" type="button" data-pon>${tx('on')}</button>`;
    else {
      const body = `<label class="pr"><input type="checkbox" data-pk="promo" ${prefs.promo ? 'checked' : ''}><span>${tx('promo')}</span></label>
        <label class="pr"><input type="checkbox" data-pk="remind" ${prefs.remind ? 'checked' : ''}><span>${tx('remind')}</span></label>
        <details class="pp"><summary>${tx('pl')}${prefs.places.length ? ' (' + prefs.places.length + ')' : ''}</summary><p class="pd">${tx('pld')}</p>
          <div class="pg">${(typeof OPSTINE !== 'undefined' ? OPSTINE : []).map(([id, n]) => `<label class="pr"><input type="checkbox" data-pp="${id}" ${prefs.places.includes(id) ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div></details>
        <button class="btn s full" type="button" data-poff>${tx('off')}</button>`;
      // uključeno: samo jedan red sa statusom, podešavanja se otvaraju dodirom (ne zauzimaju stalno ekran)
      inner = `<details class="pn" ${pnOpen ? 'open' : ''}><summary><span class="pnt"><b>${tx('h')}</b><small class="pns">✓ ${tx('st')}</small></span></summary><div class="pnb">${body}</div></details>`;
      single = true;
    }
    const dx = /[?&]dx=1/.test(location.search) ? '<button class="btn s full" type="button" data-pdx>Dijagnostika i probno obavještenje</button><pre id="pdxout" style="white-space:pre-wrap;font-size:.8rem;margin:0"></pre>' : '';
    el.innerHTML = single ? `${inner}${dx}` : `<h2>${tx('h')}</h2>${inner}${dx}`;
  }

  /* Dijagnostika (samo uz ?dx=1 u adresi): pokazuje stanje i prikazuje probno obavještenje direktno, bez servera. */
  async function diagnose() {
    const out = document.getElementById('pdxout'); if (!out) return;
    const L = [];
    const add = (t) => { L.push(t); out.textContent = L.join('\n'); };
    try {
      add('Dozvola: ' + Notification.permission);
      const reg = await navigator.serviceWorker.ready;
      try { await reg.update(); add('Provjera nove verzije: ok'); } catch (e) { add('Provjera nove verzije: ' + e.message); }
      add('Aktivni worker: ' + (reg.active ? reg.active.scriptURL.split('/').pop() + ' (' + reg.active.state + ')' : 'nema') + (reg.waiting ? ', čeka novi' : '') + (reg.installing ? ', instalira novi' : ''));
      const src = await (await fetch('/sw.js', { cache: 'no-store' })).text();
      add('sw.js na serveru: ' + ((src.match(/montepalm-v\d+/) || ['?'])[0]) + (src.includes("'push'") ? ', ima push' : ', NEMA push'));
      const s = await reg.pushManager.getSubscription();
      add('Pretplata: ' + (s ? 'da (' + new URL(s.endpoint).hostname + ')' : 'ne'));
      await reg.showNotification('Probno obavještenje', { body: 'Ako ovo vidiš, telefon prikazuje obavještenja.', icon: '/icons/icon-192.png', tag: 'dx' });
      add('Probno obavještenje poslato telefonu: da li je stiglo u traku?');
    } catch (e) { add('Greška: ' + e.message); }
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-pdx]')) diagnose();
    else if (e.target.closest('[data-pon]')) enable();
    else if (e.target.closest('[data-poff]')) disable();
  });
  document.addEventListener('change', (e) => {
    const t = e.target, get = (a) => (t && t.getAttribute ? t.getAttribute(a) : null);
    const k = get('data-pk'), pp = get('data-pp');
    if ((!k && !pp) || !sub) return;
    if (k) prefs[k] = t.checked;
    else prefs.places = t.checked ? [...new Set([...prefs.places, pp])] : prefs.places.filter((x) => x !== pp);
    savePrefs();
    call('PUT', '/prefs', { endpoint: sub.endpoint, lang: LANG, promo: prefs.promo, remind: prefs.remind, saved: slugs(), places: prefs.places }).catch(() => {});
    if (pp) { const sm = box() && box().querySelector('.pp summary'); if (sm) sm.textContent = tx('pl') + (prefs.places.length ? ' (' + prefs.places.length + ')' : ''); }
  });

  /* app.js zove ovo kad se plan promijeni, i kad se otvori „Moj put” */
  let timer;
  window.mpPushSync = () => {
    clearTimeout(timer);
    timer = setTimeout(() => { if (sub) call('PUT', '/prefs', { endpoint: sub.endpoint, lang: LANG, saved: slugs() }).catch(() => {}); }, 1500);
  };
  window.mpPushRender = render;
  /* profil (profil.js): stanje i prekidač obavještenja */
  window.mpPushInfo = () => {
    const blocked = supported && Notification.permission === 'denied';
    const needIos = !supported || (ios && !standalone && !sub);
    return { on: !!sub && !blocked, can: !!(supported && cfg && cfg.enabled && !blocked && !needIos), msg: needIos ? tx('ios') : blocked ? tx('blocked') : '' };
  };
  window.mpPushToggle = () => (sub ? disable() : enable());
  load();
})();
