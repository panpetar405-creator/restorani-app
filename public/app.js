'use strict';
document.documentElement.classList.add('js');
// slike se otkrivaju tek kad se učitaju (blur-up), a pri grešci se ne ostavlja prazan prostor
const imgDone = (e) => { if (e.target && e.target.tagName === 'IMG') e.target.classList.add('ld'); };
document.addEventListener('load', imgDone, true);
document.addEventListener('error', imgDone, true);
const buzz = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* ignore */ } };
const bump = (el, cls) => { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
const $ = (i) => document.getElementById(i);
const CATS = DICT[LANG].cats, KIND = DICT[LANG].kind;
const GLYPH = { event: 'ticket', beach: 'umbrella', food: 'fork', culture: 'columns' };
const STATUS = DICT[LANG].status, MS = DICT[LANG].ms, MONTHS = DICT[LANG].months, MONTHS_G = DICT[LANG].monthsG || MONTHS;
const DOT = LANG === 'sr' || LANG === 'de'; // iza dana ide tačka (1. maj / 1. Mai)
const ic = (n, c = '') => `<svg class="ic ${c}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CYR = { 'а':'a','б':'b','в':'v','г':'g','д':'d','ђ':'d','е':'e','ё':'e','ж':'z','з':'z','и':'i','й':'j','ј':'j','к':'k','л':'l','љ':'lj','м':'m','н':'n','њ':'nj','о':'o','п':'p','р':'r','с':'s','т':'t','ћ':'c','у':'u','ф':'f','х':'h','ц':'c','ч':'c','џ':'dz','ш':'s','щ':'sc','ъ':'','ы':'i','ь':'','э':'e','ю':'ju','я':'ja' };
const norm = (t) => String(t).toLowerCase().replace(/[\u0400-\u04ff]/g, (c) => (c in CYR ? CYR[c] : c)).replace(/gerceg/g, 'herceg').replace(/cetine\b/g, 'cetinje').replace(/đ/g, 'd').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/* ---- datumi (lokalno vrijeme, bez UTC pomaka) ---- */
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const a = String(s).slice(0, 10).split('-'); return new Date(+a[0], +a[1] - 1, +a[2]); };
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const fmt = (s) => { const a = String(s).slice(0, 10).split('-'); return LANG === 'sr' ? `${+a[2]}. ${+a[1]}. ${a[0]}.` : `${+a[2]}${DOT ? '.' : ''} ${MS[+a[1] - 1]} ${a[0]}`; };
const span = (x) => fmt(x.from) + (x.to && x.to !== x.from ? ' – ' + fmt(x.to) : '');
const nice = (s) => { const d = parse(s); return d.getDate() + (DOT ? '. ' : ' ') + MS[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''); };
const today = iso(new Date());
const api = async (p) => { const r = await fetch('/api' + p + (p.includes('?') ? '&' : '?') + 'lang=' + LANG); if (!r.ok) throw Object.assign(new Error('api'), { status: r.status }); return r.json(); };

/* ---- mjesta u Crnoj Gori za prijedloge u polju „Gdje” (opštine, gradovi i poznata turistička mjesta; mjesta sa sadržajem u bazi se dodaju automatski) ---- */
const CG_PLACES = [
  // opštine
  'Andrijevica', 'Bar', 'Berane', 'Bijelo Polje', 'Budva', 'Cetinje', 'Danilovgrad', 'Gusinje', 'Herceg Novi', 'Kolašin', 'Kotor', 'Mojkovac', 'Nikšić', 'Petnjica', 'Plav', 'Pljevlja', 'Plužine', 'Podgorica', 'Rožaje', 'Šavnik', 'Tivat', 'Tuzi', 'Ulcinj', 'Zeta', 'Žabljak',
  // Boka kotorska i Luštica
  'Baošići', 'Bigova', 'Bijela', 'Dobrota', 'Đenovići', 'Igalo', 'Kamenari', 'Kostanjica', 'Krašići', 'Kumbor', 'Lepetane', 'Luštica', 'Meljine', 'Morinj', 'Muo', 'Njivice', 'Orahovac', 'Perast', 'Porto Montenegro', 'Prčanj', 'Radovići', 'Risan', 'Rose', 'Stoliv', 'Zelenika',
  // primorje: Budva, Bar, Ulcinj
  'Bečići', 'Buljarica', 'Čanj', 'Kamenovo', 'Miločer', 'Petrovac', 'Pržno', 'Rafailovići', 'Sveti Stefan', 'Sutomore', 'Šušanj', 'Stari Bar', 'Utjeha', 'Ada Bojana', 'Velika plaža',
  // Skadarsko jezero i centralni dio
  'Virpazar', 'Rijeka Crnojevića', 'Skadarsko jezero', 'Golubovci', 'Spuž', 'Ostrog', 'Njeguši', 'Lovćen',
  // sjever i planine
  'Bjelasica', 'Biogradska gora', 'Crno jezero', 'Durmitor', 'Komovi', 'Prokletije', 'Sinjajevina', 'Piva', 'Tara', 'Plavsko jezero', 'Grnčar', 'Vusanje', 'Kolašin 1600', 'Savin Kuk'
];
let all = [], rests = [], places = [], dataPlaces = [], cat = 'all', plan = [], known = {};
const D = { h: { f: '', t: '' }, x: { f: '', t: '' } };
try { plan = JSON.parse(localStorage.getItem('mp.plan') || '[]'); } catch { plan = []; }
/* kopija sačuvanih stavki plana: plan se vidi i bez interneta */
let snap = {};
try { snap = JSON.parse(localStorage.getItem('mp.planData') || '{}') || {}; } catch { snap = {}; }
const saveSnap = () => {
  const o = {};
  plan.forEach((k) => { const v = known[k] || snap[k]; if (v) o[k] = v; });
  snap = o;
  try { localStorage.setItem('mp.planData', JSON.stringify(o)); } catch { /* ignore */ }
};
const savePlan = () => { try { localStorage.setItem('mp.plan', JSON.stringify(plan)); } catch { /* ignore */ } saveSnap(); if (window.mpPushSync) window.mpPushSync(); };

/* ---- kartice ---- */
function itemCard(x) {
  const key = 'i:' + x.slug; known[key] = x;
  const meta = [], pills = [];
  if (x.kind === 'event') meta.push(`<li class="w">${ic('cal')}${esc(span(x))}</li>`);
  if (x.offSeason) meta.push(`<li class="warn">${ic('alert')}${t('offSeason')}</li>`);
  if (x.status !== 'potvrdjeno') pills.push(`<span class="pill">${esc(STATUS[x.status])}</span>`);
  if (x.demo) pills.push(`<span class="pill demo">${t('demo')}</span>`);
  if (x.verifiedAt) meta.push(`<li>${ic('shield')}${t('verified')}${esc(fmt(x.verifiedAt))}</li>`);
  return card(key, x.kind, x.title, x.place, x.description, meta, pills, x.offSeason, x.cover);
}
function restCard(r) {
  const key = 'r:' + r.slug; known[key] = r;
  const meta = [];
  if (r.rating) meta.push(`<li class="star">${ic('star', 'f')}${esc(r.rating)} <span class="m">(${esc(r.reviews)})</span></li>`);
  meta.push(`<li class="w">${r.price ? '€ ' + esc(r.price.lo) + ' – ' + esc(r.price.hi) + t('perPerson') : t('priceSoon')}</li>`);
  if (r.verifiedAt) meta.push(`<li>${ic('shield')}${t('verified')}${esc(fmt(r.verifiedAt))}</li>`);
  return card(key, 'food', r.name, r.city, r.tags.join(', ') || r.ambience, meta, [], false, r.cover);
}
function card(key, kind, title, place, desc, meta, pills, off, cover) {
  const inp = plan.includes(key);
  return `<article class="card${off ? ' off' : ''}${cover ? ' hascv' : ''}" data-c="${kind}">${cover ? `<div class="cv" aria-hidden="true"><img src="${esc(cover)}" alt="" loading="lazy" decoding="async"></div>` : ''}<div class="ch"><span class="bd">${ic(GLYPH[kind])}</span><div class="cm"><div class="kd">${KIND[kind]}</div><div class="pl">${ic('pin')}<span>${esc(place)}</span></div></div>${pills.join('')}</div><h3 class="t"><a class="lk" href="#d/${esc(key)}">${esc(title)}</a>${ic('right')}</h3>${desc ? `<p class="d">${esc(desc)}</p>` : ''}<ul class="meta">${meta.join('')}</ul><button type="button" class="btn p add" aria-pressed="${inp}" data-k="${esc(key)}">${inp ? ic('check') + t('inPlan') : ic('plus') + t('addPlan')}</button></article>`;
}
const emptyBox = (g, title, text, extra = '') => `<div class="empty${g === 'alert' ? ' err' : ''}"><span class="bd">${ic(g)}</span><b>${title}</b><p>${text}</p>${extra}</div>`;
// greška pri učitavanju: razlikuje nema interneta od greške servera i nudi ponovni pokušaj
const retryBtn = (what) => `<button type="button" class="btn p" data-retry="${what}">${t('retry')}</button>`;
const errBox = (what, extra = '') => navigator.onLine === false
  ? emptyBox('alert', t('offlineT'), t('offlineD'), retryBtn(what) + extra)
  : emptyBox('alert', t('loadErrT'), t('loadErrD'), retryBtn(what) + extra);
function railCard(x) {
  known['i:' + x.slug] = x;
  const d = parse(x.from);
  return `<a class="ev" href="#d/i:${esc(x.slug)}">${x.cover ? `<span class="evi"><img src="${esc(x.cover)}" alt="" loading="lazy" decoding="async"></span>` : `<span class="evi ph" aria-hidden="true">${ic(GLYPH.event)}</span>`}<span class="evr"><span class="dt"><b>${d.getDate()}</b><span>${MS[d.getMonth()]}</span></span><span class="tx"><span class="tt">${esc(x.title)}</span><span class="pl">${ic('pin')}<span>${esc(x.place)}</span></span><span class="rng">${esc(span(x))}</span></span></span></a>`;
}

/* ---- podaci ---- */
async function loadAll() {
  try {
    const [a, b] = await Promise.all([api('/items'), api('/restaurants?limit=100')]);
    all = a.items; rests = b.restaurants;
    if (typeof renderTiles === 'function') renderTiles();
  } catch { all = []; rests = []; $('rail').innerHTML = errBox('home'); }
  dataPlaces = [...new Set([...all.map((x) => x.place), ...rests.map((r) => r.city)])].filter(Boolean).sort((a, b) => a.localeCompare(b, 'sr'));
  // za prijedloge: sva mjesta iz baze + spisak mjesta u Crnoj Gori, bez duplikata (poređenje bez dijakritike)
  const seen = new Set(); places = [];
  for (const p of [...dataPlaces, ...CG_PLACES]) { const k = norm(p); if (!seen.has(k)) { seen.add(k); places.push(p); } }
  const up = all.filter((x) => x.kind === 'event' && (x.to || x.from) >= today).sort((a, b) => (a.from < b.from ? -1 : 1)).slice(0, 6);
  if (up.length) $('rail').innerHTML = up.map(railCard).join('');
  else if (all.length) $('rail').innerHTML = emptyBox('cal', t('noUpT'), t('noUpD'), `<a class="btn s" href="#istrazi" style="text-decoration:none">${t('goExplore')}</a>`);
  saveSnap();
  renderNear();
  planView();
}
let timer;
const later = () => { clearTimeout(timer); timer = setTimeout(search, 250); };
async function search() {
  const place = $('p').value.trim(), { f, t: to } = D.x;
  const qs = new URLSearchParams();
  if (place) qs.set('place', place);
  if (f) qs.set('from', f);
  if (to || f) qs.set('to', to || f);
  if (cat !== 'all' && cat !== 'food') qs.set('kind', cat);
  let items = [];
  if (cat !== 'food') { try { items = (await api('/items?' + qs)).items; } catch { $('count').textContent = ''; $('out').innerHTML = errBox('search'); return; } }
  const q = norm(place);
  const rs = cat === 'all' || cat === 'food' ? rests.filter((r) => !q || norm(r.city).includes(q)) : [];
  const list = items.sort((a, b) => (a.offSeason - b.offSeason)).map(itemCard).concat(rs.map(restCard));
  $('count').textContent = list.length ? t('found') + list.length : '';
  $('out').innerHTML = list.length ? list.join('') : emptyBox('search', t('nothingT'), t('nothingD'), `<button type="button" class="btn s" data-clear-search>${t('clearSearch')}</button>`);
}

/* ---- plan ---- */
/* ---- Danas i u blizini ---- */
let nearMode = 'today', here = null; // lokacija se drži samo u memoriji, nikad se ne šalje ni ne čuva
const isoPlus = (s, n) => iso(addDays(parse(s), n));
function weekendRange() {
  const d = parse(today), w = d.getDay(); // 0 = nedjelja
  if (w === 0) return [today, today];
  if (w === 6) return [today, isoPlus(today, 1)];
  return [isoPlus(today, 6 - w), isoPlus(today, 7 - w)];
}
const hasLoc = (x) => Number.isFinite(+x.lat) && Number.isFinite(+x.lng) && x.lat !== null && x.lng !== null && x.lat !== '' && x.lng !== '';
function kmBetween(a, b) {
  const r = Math.PI / 180, dla = (b.lat - a.lat) * r, dlo = (b.lng - a.lng) * r;
  const h = Math.sin(dla / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dlo / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
function fmtKm(k) {
  if (k < 1) return Math.max(50, Math.round(k * 20) * 50) + ' m';
  const s = k < 10 ? k.toFixed(1) : String(Math.round(k));
  return (LANG === 'en' ? s : s.replace('.', ',')) + ' km';
}
const askLoc = () => new Promise((res) => {
  if (!navigator.geolocation) { res(null); return; }
  navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res(null), { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
});
function nearList() {
  const run = (x, f, to) => x.from <= to && (x.to || x.from) >= f;
  const pool = [...all.map((x) => ({ x, r: false })), ...rests.map((x) => ({ x, r: true }))];
  let list;
  if (nearMode === 'near') list = pool.filter(({ x, r }) => hasLoc(x) && (r || x.kind !== 'event' || (x.from && run(x, today, isoPlus(today, 30)))));
  else { const [f, to] = nearMode === 'today' ? [today, today] : weekendRange(); list = pool.filter(({ x, r }) => !r && x.kind === 'event' && x.from && run(x, f, to)); }
  list.forEach((o) => { o.d = here && hasLoc(o.x) ? kmBetween(here, { lat: +o.x.lat, lng: +o.x.lng }) : null; });
  if (here) list.sort((p, q) => (p.d === null) - (q.d === null) || p.d - q.d);
  return list.slice(0, 10);
}
function nearCard({ x, r, d }) {
  const key = (r ? 'r:' : 'i:') + x.slug; known[key] = x;
  const kind = r ? 'food' : x.kind, title = r ? x.name : x.title, place = r ? x.city : x.place;
  const sub = !r && x.kind === 'event' && x.from ? span(x) : (KIND[kind] || '');
  const img = x.cover ? `<span class="evi"><img src="${esc(x.cover)}" alt="" loading="lazy" decoding="async"></span>` : `<span class="evi ph" aria-hidden="true">${ic(GLYPH[kind] || GLYPH.event)}</span>`;
  return `<a class="ev nc" data-c="${esc(kind)}" href="#d/${esc(key)}">${img}<span class="evr"><span class="tx"><span class="tt">${esc(title)}</span><span class="pl">${ic('pin')}<span>${esc(place)}</span></span><span class="rng">${esc(sub)}</span>${d !== null ? `<span class="dst">${ic('nav')}${fmtKm(d)}</span>` : ''}</span></span></a>`;
}
function renderNear() {
  const sec = $('nsec'); if (!sec) return;
  sec.hidden = !(all.length || rests.length);
  const list = nearList();
  $('nrail').innerHTML = list.length ? list.map(nearCard).join('')
    : nearMode === 'near' ? emptyBox('pin', t('nearNoLocT'), t('nearNoLocD'))
      : emptyBox('cal', t('nearNoneT'), t('nearNoneD'), `<button type="button" class="btn s" data-n="near">${t('nNear')}</button>`);
}
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-n]'); if (!b) return;
  const m = b.getAttribute('data-n');
  if (m === 'near' && !here) {
    b.disabled = true; here = await askLoc(); b.disabled = false;
    if (!here) { toast(t('locDenied')); return; }
  }
  nearMode = m;
  document.querySelectorAll('#nchips [data-n]').forEach((c) => c.setAttribute('aria-pressed', c.getAttribute('data-n') === m));
  renderNear();
});

/* ---- izvoz u kalendar (.ics) ---- */
const icsEsc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsFold = (l) => { let o = ''; while (l.length > 70) { o += l.slice(0, 70) + '\r\n '; l = l.slice(70); } return o + l; };
const icsDay = (s) => s.replace(/-/g, '');
const icsNext = (s) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10).replace(/-/g, ''); };
function icsFor(list) {
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const ev = list.filter((x) => x && x.kind === 'event' && x.from).map((x) => {
    const link = `${location.origin}/s/i/${x.slug}`;
    return ['BEGIN:VEVENT', `UID:${x.slug}@montepalm`, `DTSTAMP:${now}`, `DTSTART;VALUE=DATE:${icsDay(x.from)}`, `DTEND;VALUE=DATE:${icsNext(x.to || x.from)}`,
      `SUMMARY:${icsEsc(x.title)}`, `LOCATION:${icsEsc(x.place)}`, `DESCRIPTION:${icsEsc((x.description ? x.description + '\n' : '') + link)}`, `URL:${link}`, 'END:VEVENT'].map(icsFold).join('\r\n');
  });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Montepalm//SR', 'CALSCALE:GREGORIAN', ...ev, 'END:VCALENDAR'].join('\r\n') + '\r\n';
}
async function saveIcs(list, name) {
  const file = new File([icsFor(list)], name, { type: 'text/calendar' });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  const u = URL.createObjectURL(file), el = document.createElement('a');
  el.href = u; el.download = name; document.body.appendChild(el); el.click(); el.remove();
  setTimeout(() => URL.revokeObjectURL(u), 4000);
}
$('ics').onclick = () => saveIcs(plan.map((k) => known[k]), 'montepalm-plan.ics');
function planMapUrl(list) {
  const points = list.map((k) => { const x = known[k] || snap[k] || {}; return [x.title || x.name, x.place || x.city].filter(Boolean).join(', '); }).filter(Boolean);
  if (!points.length) return '';
  const origin = encodeURIComponent(points[0]), destination = encodeURIComponent(points[points.length - 1]);
  const waypoints = points.slice(1, -1).map(encodeURIComponent).join('%7C');
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? '&waypoints=' + waypoints : ''}&travelmode=driving`;
}
function planView() {
  plan.forEach((k) => { if (!known[k] && snap[k]) known[k] = snap[k]; });
  const l = plan.filter((k) => known[k]);
  $('pout').innerHTML = l.length ? `<div class="plan-tools"><p class="plan-hint">${t('routeHint')}</p><a class="btn p" href="${esc(planMapUrl(l))}" target="_blank" rel="noopener">${ic('nav')}${t('planMap')}</a></div><div class="plan-stops">${l.map((k) => {
    const x = known[k], title = x.title || x.name, place = x.place || x.city || '';
    const cardHtml = k[0] === 'i' ? itemCard(x) : restCard(x);
    const i = plan.indexOf(k);
    return `<section class="plan-stop"><div class="stop-tools"><span>${t('stopLabel')} ${i + 1}</span><div><button type="button" class="ib stop-move" data-move="up" data-k="${esc(k)}" aria-label="${t('stopUp')}" ${i === 0 ? 'disabled' : ''}>${ic('down', 'flip-y')}</button><button type="button" class="ib stop-move" data-move="down" data-k="${esc(k)}" aria-label="${t('stopDown')}" ${i === l.length - 1 ? 'disabled' : ''}>${ic('down')}</button></div></div>${cardHtml}</section>`;
  }).join('')}</div>` : emptyBox('route', t('emptyPlanT'), t('emptyPlanD'), `<a class="btn p" href="#istrazi" style="text-decoration:none">${t('goExplore')}</a>`);
  $('share').style.display = l.length ? 'inline-flex' : 'none';
  $('ics').hidden = !l.some((k) => known[k].kind === 'event' && known[k].from);
  $('pb').textContent = plan.length; $('pb').hidden = !plan.length;
}
$('pout').addEventListener('click', (e) => {
  const b = e.target.closest('[data-move]'); if (!b) return;
  const i = plan.indexOf(b.getAttribute('data-k')); if (i < 0) return;
  const j = b.getAttribute('data-move') === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= plan.length) return;
  [plan[i], plan[j]] = [plan[j], plan[i]]; savePlan(); planView();
});
const setAdd = (a, on) => { a.setAttribute('aria-pressed', on); a.innerHTML = on ? ic('check') + t('inPlan') : ic('plus') + t('addPlan'); };
document.addEventListener('click', (e) => {
  const b = e.target.closest('.add'); if (!b) return;
  const k = b.getAttribute('data-k'), i = plan.indexOf(k);
  if (i >= 0) plan.splice(i, 1); else plan.push(k);
  savePlan();
  document.querySelectorAll('.add').forEach((a) => { if (a.getAttribute('data-k') === k) setAdd(a, plan.includes(k)); });
  if (plan.includes(k)) { buzz(14); bump(b, 'pop'); bump($('pb'), 'bump'); }
  document.querySelectorAll('[data-bm]').forEach((a) => { if (a.getAttribute('data-bm') === k) { const on = plan.includes(k); a.setAttribute('aria-pressed', on); a.setAttribute('aria-label', on ? t('removePlan') : t('addPlan')); a.innerHTML = ic('bookmark', on ? 'f' : ''); } });
  $('pb').textContent = plan.length; $('pb').hidden = !plan.length;
  if (location.hash === '#plan') planView();
});
$('share').onclick = async () => {
  const txt = t('shareHead') + plan.filter((k) => known[k]).map((k) => { const x = known[k]; return '- ' + (x.title || x.name) + ' (' + (x.place || x.city) + ')'; }).join('\n');
  try {
    if (navigator.share) { await navigator.share({ text: txt }); return; }
    await navigator.clipboard.writeText(txt); $('sh').textContent = t('planCopied');
  } catch { $('sh').textContent = t('copyFail'); }
};

/* ---- polje „Gdje“ sa prijedlozima ---- */
function bindPlace(id, sid, onChange) {
  const inp = $(id), box = $(sid), clr = inp.closest('.fld').querySelector('.clr');
  let idx = -1;
  const hide = () => { box.hidden = true; idx = -1; inp.setAttribute('aria-expanded', 'false'); };
  const mark = () => [...box.children].forEach((b, i) => b.setAttribute('aria-selected', i === idx));
  const show = () => {
    const q = norm(inp.value.trim());
    // bez unosa: mjesta koja imaju sadržaj; sa unosom: sva mjesta, prvo ona koja počinju unosom, pa ona sa sadržajem
    const has = new Set(dataPlaces.map(norm));
    const l = (q ? places.filter((p) => norm(p).includes(q)) : dataPlaces)
      .sort((a, b) => q ? (norm(b).startsWith(q) - norm(a).startsWith(q)) || (has.has(norm(b)) - has.has(norm(a))) || a.localeCompare(b, 'sr') : 0)
      .slice(0, q ? 10 : 7);
    clr.hidden = !inp.value;
    if (!l.length) { hide(); return; }
    box.innerHTML = l.map((p) => `<button type="button" role="option" aria-selected="false" data-p="${esc(p)}">${ic('pin')}${esc(p)}</button>`).join('');
    box.hidden = false; idx = -1; inp.setAttribute('aria-expanded', 'true');
  };
  const pick = (v) => { inp.value = v; clr.hidden = !v; hide(); onChange(); };
  inp.addEventListener('input', () => { show(); onChange(); });
  inp.addEventListener('focus', show);
  inp.addEventListener('blur', () => setTimeout(hide, 150));
  inp.addEventListener('keydown', (e) => {
    const n = box.children.length;
    if (e.key === 'Escape') hide();
    else if (e.key === 'ArrowDown' && n) { e.preventDefault(); idx = (idx + 1) % n; mark(); }
    else if (e.key === 'ArrowUp' && n) { e.preventDefault(); idx = (idx - 1 + n) % n; mark(); }
    else if (e.key === 'Enter' && idx >= 0) { e.preventDefault(); pick(box.children[idx].getAttribute('data-p')); }
  });
  box.addEventListener('pointerdown', (e) => e.preventDefault());
  box.addEventListener('click', (e) => { const b = e.target.closest('[data-p]'); if (b) pick(b.getAttribute('data-p')); });
  clr.addEventListener('click', () => { inp.value = ''; clr.hidden = true; inp.focus(); onChange(); });
}
bindPlace('hp', 'hs', () => {});
bindPlace('p', 'xs', later);

/* ---- kalendar ---- */
const cal = { pair: 'h', f: '', t: '', view: new Date(), step: 'f' };
function showDates() {
  [['h', 'f'], ['h', 't'], ['x', 'f'], ['x', 't']].forEach(([p, k]) => {
    const v = D[p][k], el = $(p + k).querySelector('.v');
    el.textContent = v ? nice(v) : t('pickDate'); el.classList.toggle('e', !v);
  });
}
function renderCal() {
  const y = cal.view.getFullYear(), m = cal.view.getMonth();
  $('mt').textContent = MONTHS[m] + ' ' + y;
  const lead = (new Date(y, m, 1).getDay() + 6) % 7, n = new Date(y, m + 1, 0).getDate();
  let h = '<span></span>'.repeat(lead);
  for (let d = 1; d <= n; d++) {
    const s = `${y}-${pad(m + 1)}-${pad(d)}`, c = ['dy'];
    if (s === today) c.push('today');
    if (cal.f && s === cal.f) c.push('sel', 'rs');
    if (cal.t && s === cal.t) c.push('sel', 're');
    if (cal.f && cal.t && s > cal.f && s < cal.t) c.push('ri');
    h += `<button type="button" class="${c.join(' ')}" data-d="${s}" aria-label="${d} ${MONTHS_G[m]} ${y}" aria-pressed="${c.includes('sel')}"><span>${d}</span></button>`;
  }
  $('days').innerHTML = h;
  const e = !cal.f;
  $('sum').className = 'sum' + (e ? ' e' : '');
  $('sum').textContent = e ? t('pickStart') : cal.t && cal.t !== cal.f ? nice(cal.f) + ' – ' + nice(cal.t) : nice(cal.f) + (cal.step === 't' ? t('pickEndHint') : '');
  $('capp').disabled = e;
}
function openCal(pair, which) {
  cal.pair = pair; cal.f = D[pair].f; cal.t = D[pair].t;
  cal.step = which === 't' && cal.f ? 't' : 'f';
  cal.view = cal.f ? parse(cal.f) : new Date();
  cal.opener = document.activeElement;
  renderCal(); $('cal').hidden = false; document.body.classList.add('lock');
  $('capp').focus({ preventScroll: true });
}
function closeCal() { $('cal').hidden = true; document.body.classList.remove('lock'); if (cal.opener && cal.opener.focus) cal.opener.focus(); }
function applyCal() {
  D[cal.pair] = { f: cal.f, t: cal.t || cal.f };
  showDates(); closeCal();
  if (cal.pair === 'x') search();
}
document.querySelectorAll('.df').forEach((b) => b.addEventListener('click', () => openCal(b.getAttribute('data-pair'), b.getAttribute('data-f'))));
$('days').addEventListener('click', (e) => {
  const b = e.target.closest('[data-d]'); if (!b) return;
  const s = b.getAttribute('data-d');
  if (cal.step === 'f' || !cal.f) { cal.f = s; cal.t = ''; cal.step = 't'; }
  else if (s < cal.f) { cal.f = s; cal.t = ''; }
  else { cal.t = s; cal.step = 'f'; }
  renderCal();
});
$('presets').addEventListener('click', (e) => {
  const b = e.target.closest('[data-pre]'); if (!b) return;
  const n = new Date(), dow = n.getDay(), k = b.getAttribute('data-pre');
  let f, t;
  if (k === 'we') { f = dow === 0 ? n : addDays(n, 6 - dow); t = dow === 0 ? n : addDays(f, 1); }
  else if (k === 'w') { f = n; t = addDays(n, 6); }
  else { f = n; t = new Date(n.getFullYear(), n.getMonth() + 1, 0); }
  cal.f = iso(f); cal.t = iso(t); cal.step = 'f'; cal.view = f; renderCal();
});
$('prev').onclick = () => { cal.view = new Date(cal.view.getFullYear(), cal.view.getMonth() - 1, 1); renderCal(); };
$('next').onclick = () => { cal.view = new Date(cal.view.getFullYear(), cal.view.getMonth() + 1, 1); renderCal(); };
$('cclr').onclick = () => { cal.f = ''; cal.t = ''; cal.step = 'f'; renderCal(); };
$('capp').onclick = applyCal;
$('cal').addEventListener('click', (e) => { if (e.target.closest('[data-x]')) closeCal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('cal').hidden) closeCal(); });

/* ---- fotografija u heroju ---- */
function applyPhoto(u) { const h = $('hero'); h.style.backgroundImage = 'url(' + u + ')'; h.classList.add('has'); $('pbtn').setAttribute('aria-label', t('changePhoto')); $('pbtn').title = t('changePhoto'); }
try { const sv = localStorage.getItem('mp.hero'); if (sv) applyPhoto(sv); } catch { /* ignore */ }
$('pbtn').onclick = () => $('pfile').click();
$('pfile').onchange = function () {
  const f = this.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    const im = new Image();
    im.onload = () => {
      const s = Math.min(1, 1100 / im.width), c = document.createElement('canvas');
      c.width = im.width * s; c.height = im.height * s;
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      const u = c.toDataURL('image/jpeg', 0.82);
      try { localStorage.setItem('mp.hero', u); } catch { /* ignore */ }
      applyPhoto(u);
    };
    im.src = r.result;
  };
  r.readAsDataURL(f);
};

/* ---- detalj stavke ---- */
const DAYN = DICT[LANG].dayn;
const wxIcon = (c) => (c == null ? 'cloudsun' : c === 0 ? 'sun' : c <= 2 ? 'cloudsun' : c === 3 ? 'cloud' : c === 45 || c === 48 ? 'fog' : (c >= 71 && c <= 77) || c === 85 || c === 86 ? 'snow' : c >= 95 ? 'storm' : (c >= 51 && c <= 67) || (c >= 80 && c <= 82) ? 'rain' : 'cloud');
const wxText = DICT[LANG].wx;
const climIcon = (wet) => (wet >= 50 ? 'rain' : wet >= 25 ? 'cloudsun' : 'sun');
const GROUPS = DICT[LANG].groups;
const euro = (n) => '€ ' + String(Math.round(n * 100) / 100).replace('.', t('euroDec'));
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
let detailTok = 0, lbList = [], lbPos = 0, saved = { hash: '', y: 0 }, navs = 0;

function monthsLabel(ms) {
  const m = [...new Set(ms)].sort((a, b) => a - b);
  if (!m.length || m.length === 12) return t('allYear');
  return m[m.length - 1] - m[0] === m.length - 1 ? (m.length === 1 ? MONTHS[m[0] - 1] : MONTHS[m[0] - 1] + ' – ' + MONTHS[m[m.length - 1] - 1]) : m.map((n) => MONTHS[n - 1]).join(', ');
}
function weatherPeriod(x) {
  const f = D.x.f, t = D.x.t || D.x.f;
  if (x.kind === 'event' && x.from) {
    const ef = x.from, et = x.to || x.from;
    if (f) { const a = f > ef ? f : ef, b = t < et ? t : et; if (a <= b) return { f: a, t: b }; }
    return { f: ef, t: et };
  }
  return f ? { f, t } : null;
}
const rangeText = (f, t) => nice(f) + (t && t !== f ? ' – ' + nice(t) : '');

function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
  t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 2200);
}

/* ---- objava u stilu društvene mreže: karusel (slike i video), srce, plan, mreža sličica ---- */
let likes = [], vio = null;
try { likes = JSON.parse(localStorage.getItem('mp.likes') || '[]'); } catch { likes = []; }
const saveLikes = () => { try { localStorage.setItem('mp.likes', JSON.stringify(likes)); } catch { /* ignore */ } };
const setLike = (b, on) => { b.setAttribute('aria-pressed', on); b.setAttribute('aria-label', on ? t('unlike') : t('like')); b.innerHTML = ic('heart', on ? 'f' : '') + `<span>${t('like')}</span>`; };

function slideHtml(m, i, title) {
  if (m.type === 'image') return `<div class="sl"><img src="${esc(m.url)}" alt="${esc(m.caption || title)}" ${i ? 'loading="lazy"' : ''} decoding="async"><button type="button" class="zoom" data-z="${i}" aria-label="${t('zoom')}"></button></div>`;
  if (m.type === 'video') return `<div class="sl vid"><video src="${esc(m.url)}" muted loop playsinline preload="metadata"${m.poster ? ` poster="${esc(m.poster)}"` : ''}></video><button type="button" class="vtap" data-vt aria-label="${t('vidToggle')}"></button><button type="button" class="mute" data-mute aria-label="${t('soundOn')}">${ic('mute')}</button><span class="rbadge">${ic('reel')}</span></div>`;
  return `<div class="sl"><button type="button" class="vp" data-yt="${esc(m.id)}" aria-label="${t('playVideo')}${m.caption ? ': ' + esc(m.caption) : ''}"><img src="${esc(m.poster)}" alt="" loading="lazy"></button><span class="pl2">${ic('play')}</span><span class="rbadge">${ic('reel')}</span></div>`;
}

function postHtml(x, key, kind, title, place, pills, media) {
  lbList = media;
  const inp = plan.includes(key), liked = likes.includes(key), n = media.length;
  const head = `<header class="ph"><span class="bd">${ic(GLYPH[kind])}</span><div class="cm"><div class="pt">${esc(title)}</div><div class="pl">${ic('pin')}<span>${esc(place)}</span></div></div>${pills.join('')}</header>`;
  const body = n
    ? `<div class="pm"><div class="gtrack" id="gtrack">${media.map((m, i) => slideHtml(m, i, title)).join('')}</div>${n > 1 ? `<div class="gcount" id="gcount">1 / ${n}</div>` : ''}<span class="burst" id="burst" aria-hidden="true">${ic('heart', 'f')}</span></div>${n > 1 ? `<div class="dots" id="dots" aria-hidden="true">${media.map((_, i) => `<i${i ? '' : ' class="on"'}></i>`).join('')}</div>` : ''}`
    : `<div class="pm"><div class="gempty">${ic('camera')}<span>${t('photosSoon')}</span></div></div>`;
  const acts = `<div class="pa"><button type="button" class="pab like" data-like="${esc(key)}" aria-pressed="${liked}" aria-label="${liked ? t('unlike') : t('like')}">${ic('heart', liked ? 'f' : '')}<span>${t('like')}</span></button></div>`;
  const cur = media[0], cap = cur && (cur.caption || cur.credit) ? `<p class="pcr" id="pcr">${esc(cur.caption)}${cur.credit ? `<i>${esc(cur.credit)}</i>` : ''}</p>` : '';
  return `<article class="post">${head}${body}${acts}${cap}</article>`;
}

function gridHtml(media) {
  if (media.length < 2) return '';
  return `<section class="sec"><h2>${t('photosVideo')} <span class="cnt">${media.length}</span></h2><div class="pgrid">${media.map((m, i) => `<button type="button" class="gt" data-z="${i}" aria-label="${m.type === 'image' ? t('photo') : t('video')} ${i + 1}${m.caption ? ': ' + esc(m.caption) : ''}"><img src="${esc(m.type === 'image' ? m.url : m.poster || '')}" alt="" loading="lazy" decoding="async">${m.type === 'image' ? '' : `<span class="rbadge">${ic('reel')}</span>`}</button>`).join('')}</div></section>`;
}

function infoRows(x, isI) {
  const r = [];
  const row = (g, label, html) => r.push(`<li>${ic(g)}<div><b>${label}</b>${html}</div></li>`);
  if (isI) {
    if (x.kind === 'event') row('cal', t('date'), esc(span(x)));
    else row('cal', t('season'), esc(monthsLabel(x.months)));
    row('pin', t('location'), esc([x.address, x.place, x.region].filter(Boolean).join(', ')));
    if (x.website) row('globe', t('website'), `<a href="${esc(x.website)}" target="_blank" rel="noopener">${esc(host(x.website))}</a>`);
    row('shield', t('reliab'), esc(STATUS[x.status]) + (x.verifiedAt ? t('verifiedLc') + esc(fmt(x.verifiedAt)) : '') + (x.sourceUrl ? ` (<a href="${esc(x.sourceUrl)}" target="_blank" rel="noopener">${esc(x.source || host(x.sourceUrl))}</a>)` : x.source ? ' (' + esc(x.source) + ')' : ''));
  } else {
    row('pin', t('placeLbl'), esc(x.city));
    if (x.phone) row('phone', t('phone'), `<a href="tel:${esc(x.phone.replace(/ /g, ''))}">${esc(x.phone)}</a>`);
    if (x.rating) row('star', t('rating'), `${esc(x.rating)} (${esc(x.reviews)}${t('reviews')})`);
    row('fork', t('billPer'), x.price ? euro(x.price.lo) + ' – ' + euro(x.price.hi) : t('priceSoon'));
    if (x.verifiedAt) row('shield', t('pricesChecked'), esc(fmt(x.verifiedAt)));
  }
  return `<ul class="info">${r.join('')}</ul>`;
}

function menuHtml(menu) {
  if (!menu || !menu.length) return '';
  const by = {}; menu.forEach((m) => (by[m.kind] = by[m.kind] || []).push(m));
  const body = Object.keys(GROUPS).filter((k) => by[k]).map((k) => `<h3>${GROUPS[k]}</h3><ul class="menu">${by[k].map((m) => `<li><div>${esc(m.name)}${m.description ? `<small>${esc(m.description)}</small>` : ''}</div><b>${euro(m.price)}</b></li>`).join('')}</ul>`).join('');
  return `<section class="sec"><h2>${t('menu')}</h2><div class="box">${body}</div></section>`;
}

async function showDetail(key) {
  const tok = ++detailTok, box = $('dt');
  const back = `<button type="button" class="btn s" data-back style="margin-top:12px">${t('back')}</button>`;
  if (!/^[ir]:[a-z0-9-]{1,60}$/.test(key)) { box.innerHTML = `<div class="wrap top">${emptyBox('search', t('notFoundT'), t('notFoundLink'), back)}</div>`; return; }
  const isI = key[0] === 'i';
  box.innerHTML = '<div class="wrap top" style="display:grid;gap:14px"><div class="skb" style="height:240px"></div><div class="skb" style="width:70%;height:32px"></div><div class="skb"></div><div class="skb" style="width:85%"></div></div>';
  let d;
  try { d = await api((isI ? '/items/' : '/restaurants/') + key.slice(2)); }
  catch (err) {
    const s = err.status !== 404 && (known[key] || snap[key]);
    if (s) d = isI ? { item: s } : s;
    else { if (tok === detailTok) box.innerHTML = `<div class="wrap top">${err.status === 404 ? emptyBox('search', t('notFoundT'), t('notFoundGone'), back) : (navigator.onLine === false ? emptyBox('alert', t('offlineT'), t('offlineD'), retryBtn('detail') + back) : emptyBox('alert', t('detailErrT'), t('loadErrD'), retryBtn('detail') + back))}</div>`; return; }
  }
  if (tok !== detailTok) return;
  const x = isI ? d.item : d, kind = isI ? x.kind : 'food', title = isI ? x.title : x.name, place = isI ? x.place : x.city;
  known[key] = x; if (plan.includes(key)) saveSnap(); document.title = title + ' | Montepalm';
  const pills = [];
  if (isI && x.status !== 'potvrdjeno') pills.push(`<span class="pill">${esc(STATUS[x.status])}</span>`);
  if (isI && x.demo) pills.push(`<span class="pill demo">${t('demo')}</span>`);
  const text = isI ? [x.description, x.details].filter(Boolean).join('\n\n') : x.ambience;
  const tags = isI ? [] : [...(x.tags || []), ...(x.amenities || [])];
  const dest = x.lat != null && x.lng != null ? `${x.lat},${x.lng}` : '';
  const maps = 'https://www.google.com/maps/' + (dest ? 'dir/?api=1&destination=' + dest : 'search/?api=1&query=' + encodeURIComponent(title + ' ' + place));
  const inp = plan.includes(key), media = d.media || [];
  box.innerHTML = `<div data-c="${kind}">
    <div class="dbar"><button type="button" class="ib" data-back aria-label="${t('back')}">${ic('left')}</button><span class="dk">${KIND[kind]}</span><button type="button" class="ib" data-share aria-label="${t('share')}">${ic('share')}</button></div>
    ${postHtml(x, key, kind, title, place, pills, media)}
    <div class="wrap">
      <div class="dh"><h1>${esc(title)}</h1></div>
      <div class="acts2"><button type="button" class="btn p add" aria-pressed="${inp}" data-k="${esc(key)}">${inp ? ic('check') + t('inPlan') : ic('plus') + t('addPlan')}</button><a class="btn s" href="${esc(maps)}" target="_blank" rel="noopener">${ic('nav')}${t('map')}</a>${isI && x.kind === 'event' && x.from ? `<button type="button" class="btn s" data-ics style="grid-column:1/-1">${ic('cal')}${t('addCal')}</button>` : ''}</div>
      ${gridHtml(media)}
      <section class="sec"><h2>${t('forecast')}</h2><p class="sub" id="wsub"></p><div id="wbody"><div class="skb" style="height:132px"></div></div></section>
      ${text ? `<section class="sec"><h2>${isI ? (kind === 'event' ? t('about').event : t('about').loc) : t('about').rest}</h2><div class="box"><p class="prose">${esc(text)}</p></div></section>` : ''}
      ${!isI && x.why && x.why.length ? `<section class="sec"><h2>${t('whyHere')}</h2><div class="box"><ul class="why">${x.why.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div></section>` : ''}
      ${tags.length ? `<section class="sec"><div class="tags">${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div></section>` : ''}
      ${isI ? '' : menuHtml(x.menu)}
      <section class="sec"><h2>${t('info')}</h2><div class="box">${infoRows(x, isI)}</div></section>
    </div></div>`;
  initGallery();
  loadWeather(key, x, tok);
}

async function loadWeather(key, x, tok) {
  const per = weatherPeriod(x), qs = new URLSearchParams({ ref: key });
  if (per) { qs.set('from', per.f); qs.set('to', per.t); }
  let w;
  try { w = await api('/weather?' + qs); }
  catch { if (tok === detailTok && $('wbody')) { $('wsub').textContent = ''; $('wbody').innerHTML = `<p class="m" style="margin:0 0 8px">${t('wxFail')}</p><button type="button" class="btn s" data-retry>${t('retry')}</button>`; } return; }
  if (tok !== detailTok || !$('wbody')) return;
  if (!w.available) { $('wbody').closest('.sec').remove(); return; }
  const attr = `<p class="note">${t('data')}<a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a></p>`;
  $('wsub').textContent = per ? `${w.place}, ${rangeText(w.from, w.to)}` : `${t('next7')}${w.place}${t('next7b')}`;
  const est = w.days.some((d) => d.src === 'climate');
  let lastM = -1;
  $('wbody').innerHTML = `<div class="wxr">${w.days.map((dd) => {
    const dt = parse(dd.date), cl = dd.src === 'climate', g = cl ? climIcon(dd.wet) : wxIcon(dd.code), pr = cl ? dd.wet : dd.prob;
    const mh = dt.getMonth() !== lastM ? `<div class="wxm" aria-hidden="true"><span>${MONTHS[dt.getMonth()]}</span></div>` : '';
    lastM = dt.getMonth();
    return `${mh}<div class="wx${cl ? ' cl' : ''}" data-w="${g}" role="group" aria-label="${DAYN[dt.getDay()]} ${nice(dd.date)}, ${cl ? t('estAria') : ''}${dd.tmax}${t('degrees')}${wxText[g]}"><span class="dn">${DAYN[dt.getDay()]}</span><span class="dd">${dt.getDate()}${DOT ? '. ' : ' '}${MS[dt.getMonth()]}</span>${ic(g)}<span class="tp">${dd.tmax}° <span>${dd.tmin}°</span></span>${pr != null ? `<span class="rn">${ic('drop')}${pr}%</span>` : ''}</div>`;
  }).join('')}</div>${est ? `<p class="note">${t('estNote')}</p>` : ''}${attr}`;
}

function initGallery() {
  if (vio) { vio.disconnect(); vio = null; }
  const tr = $('gtrack'); if (!tr) return;
  const n = tr.children.length;
  const upd = () => {
    const i = Math.min(n - 1, Math.round(tr.scrollLeft / tr.clientWidth));
    if ($('gcount')) $('gcount').textContent = i + 1 + ' / ' + n;
    const dots = $('dots'); if (dots) [...dots.children].forEach((d, j) => d.classList.toggle('on', j === i));
    const m = lbList[i], c = $('pcr');
    if (c) c.innerHTML = m && (m.caption || m.credit) ? `${esc(m.caption)}${m.credit ? `<i>${esc(m.credit)}</i>` : ''}` : '';
  };
  if (n > 1) tr.addEventListener('scroll', upd, { passive: true });
  const vids = tr.querySelectorAll('video');
  if (vids.length && 'IntersectionObserver' in window) {
    vio = new IntersectionObserver((es) => es.forEach((en) => {
      const v = en.target;
      if (en.isIntersecting && en.intersectionRatio >= 0.6) v.play().catch(() => {}); else v.pause();
    }), { root: tr, threshold: [0, 0.6] });
    vids.forEach((v) => vio.observe(v));
  }
}

/* lightbox */
function lbShow(i) {
  lbPos = (i + lbList.length) % lbList.length;
  const m = lbList[lbPos], box = $('lbm');
  if (m.type === 'image') box.innerHTML = `<img src="${esc(m.url)}" alt="${esc(m.caption || '')}">`;
  else if (m.type === 'video') box.innerHTML = `<video src="${esc(m.url)}" controls autoplay playsinline${m.poster ? ` poster="${esc(m.poster)}"` : ''}></video>`;
  else box.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${esc(m.id)}?autoplay=1&rel=0&playsinline=1" title="Video" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
  $('lbc').innerHTML = `${lbPos + 1} / ${lbList.length}${m.caption ? '<br>' + esc(m.caption) : ''}${m.credit ? '<br><small>' + esc(m.credit) + '</small>' : ''}`;
  $('lbp').hidden = $('lbn').hidden = lbList.length < 2;
}
const lbOpen = (i) => { lbShow(i); $('lb').hidden = false; document.querySelectorAll('#gtrack video').forEach((v) => v.pause()); document.body.classList.add('lock'); $('lbx').focus(); };
const lbClose = () => { $('lb').hidden = true; $('lbm').innerHTML = ''; document.body.classList.remove('lock'); };
$('lbx').onclick = lbClose; $('lbp').onclick = () => lbShow(lbPos - 1); $('lbn').onclick = () => lbShow(lbPos + 1);
let tx = 0;
$('lb').addEventListener('touchstart', (e) => { tx = e.touches[0].clientX; }, { passive: true });
$('lb').addEventListener('touchend', (e) => { const dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 50 && lbList.length > 1) lbShow(lbPos + (dx < 0 ? 1 : -1)); }, { passive: true });
document.addEventListener('keydown', (e) => {
  if ($('lb').hidden) return;
  if (e.key === 'Escape') lbClose(); else if (e.key === 'ArrowLeft') lbShow(lbPos - 1); else if (e.key === 'ArrowRight') lbShow(lbPos + 1);
});

function toggleLike(k, forceOn) {
  const i = likes.indexOf(k);
  if (i >= 0 && !forceOn) likes.splice(i, 1); else if (i < 0) likes.push(k);
  saveLikes();
  document.querySelectorAll('[data-like]').forEach((b) => { if (b.getAttribute('data-like') === k) setLike(b, likes.includes(k)); });
  if (likes.includes(k)) { buzz(10); document.querySelectorAll('[data-like]').forEach((b) => { if (b.getAttribute('data-like') === k) bump(b, 'pop'); }); }
}
/* dupli dodir na fotografiju = srce, kao na Instagramu */
let lastTap = 0;
$('dt').addEventListener('click', (e) => {
  const z = e.target.closest('.zoom'); if (!z) return;
  const now = Date.now();
  if (now - lastTap < 320) {
    e.stopImmediatePropagation(); lastTap = 0;
    const k = decodeURIComponent(location.hash.slice(3)); toggleLike(k, true);
    const b = $('burst'); if (b) { b.classList.remove('go'); void b.offsetWidth; b.classList.add('go'); }
  } else lastTap = now;
}, true);

document.addEventListener('click', (e) => {
  const r = e.target.closest('[data-retry]');
  if (r) {
    const w = r.getAttribute('data-retry');
    r.disabled = true;
    if (w === 'home') loadAll(); else if (w === 'search') search(); else route();
    return;
  }
  if (e.target.closest('[data-clear-search]')) {
    $('p').value = ''; D.x = { f: '', t: '' }; showDates();
    $('p').closest('.fld').querySelector('.clr').hidden = true;
    search();
  }
});
/* traka „nema interneta“ + automatski ponovni pokušaj čim se veza vrati */
const offBar = document.createElement('div');
offBar.className = 'offbar'; offBar.setAttribute('role', 'status'); offBar.hidden = true;
document.body.appendChild(offBar);
const syncOnline = () => { offBar.textContent = t('offBar'); offBar.hidden = navigator.onLine !== false; };
window.addEventListener('offline', syncOnline);
window.addEventListener('online', () => {
  syncOnline();
  if (document.querySelector('.empty.err')) { if (!all.length) loadAll(); route(); }
});
syncOnline();

$('dt').addEventListener('click', async (e) => {
  const t = e.target;
  if (t.closest('[data-back]')) { if (navs > 0) history.back(); else location.hash = '#istrazi'; return; }
  const lk = t.closest('[data-like]'); if (lk) { toggleLike(lk.getAttribute('data-like')); return; }
  if (t.closest('[data-ics]')) { const x = known[decodeURIComponent(location.hash.slice(3))]; if (x) saveIcs([x], (x.slug || 'dogadjaj') + '.ics'); return; }
  const bm = t.closest('[data-bm]'); if (bm) { const a = document.querySelector('.acts2 .add'); if (a) a.click(); return; }
  const vt = t.closest('[data-vt]');
  if (vt) { const v = vt.parentNode.querySelector('video'); if (v.paused) v.play().catch(() => {}); else v.pause(); return; }
  const mu = t.closest('[data-mute]');
  if (mu) { const v = mu.parentNode.querySelector('video'); v.muted = !v.muted; mu.innerHTML = ic(v.muted ? 'mute' : 'vol'); mu.setAttribute('aria-label', v.muted ? t('soundOn') : t('soundOff')); return; }
  const z = t.closest('[data-z]'); if (z) { lbOpen(+z.getAttribute('data-z')); return; }
  const yt = t.closest('[data-yt]');
  if (yt) { yt.parentNode.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${esc(yt.getAttribute('data-yt'))}?autoplay=1&rel=0&playsinline=1" title="Video" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`; return; }
  if (t.closest('[data-retry]')) { const k = decodeURIComponent(location.hash.slice(3)); $('wbody').innerHTML = '<div class="skb" style="height:132px"></div>'; if (known[k]) loadWeather(k, known[k], detailTok); return; }
  if (t.closest('[data-share]')) {
    const k = decodeURIComponent(location.hash.slice(3)), x = known[k] || {}, link = /^[ir]:[a-z0-9-]+$/.test(k) ? `${location.origin}/s/${k[0]}/${k.slice(2)}${LANG === 'sr' ? '' : '?lang=' + LANG}` : location.href, data = { title: x.title || x.name || 'Montepalm', url: link };
    try { if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(link); toast(t('linkCopied')); } } catch { /* otkazano */ }
  }
});
document.addEventListener('click', (e) => { if (e.target.closest('.lk, a.ev')) saved = { hash: location.hash || '#pocetna', y: window.scrollY }; });

/* ---- navigacija ---- */
function setCat(k) { cat = k; [...$('chips').children].forEach((c) => c.setAttribute('aria-pressed', c.getAttribute('data-cat') === k)); search(); }
const SUB = DICT[LANG].sub;
function renderTiles() {
  const cov = (k) => (k === 'food' ? (rests.find((r) => r.cover) || {}).cover : (all.find((x) => x.kind === k && x.cover) || {}).cover) || '';
  $('tiles').innerHTML = Object.keys(CATS).map((k) => { const c = cov(k); return `<button class="tile${c ? ' hasbg' : ''}" type="button" data-c="${k}" data-cat="${k}">${c ? `<img class="tbg" src="${esc(c)}" alt="" loading="lazy" decoding="async">` : ''}<span class="bd">${ic(GLYPH[k])}</span>${ic(GLYPH[k], 'deco')}<span class="tl">${CATS[k]}<small>${SUB[k]}</small></span></button>`; }).join('');
}
renderTiles();
['all', ...Object.keys(CATS)].forEach((k) => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = k === 'all' ? t('all') : CATS[k];
  b.setAttribute('data-cat', k); b.setAttribute('aria-pressed', k === 'all'); b.onclick = () => setCat(k); $('chips').appendChild(b);
});
$('tiles').onclick = (e) => { const b = e.target.closest('.tile'); if (!b) return; setCat(b.getAttribute('data-cat')); location.hash = '#istrazi'; };
$('allev').onclick = () => { setCat('event'); location.hash = '#istrazi'; };
$('sf').addEventListener('submit', (e) => e.preventDefault());
$('hgo').onclick = () => { $('p').value = $('hp').value; D.x = { ...D.h }; showDates(); search(); location.hash = '#istrazi'; };
$('hp').addEventListener('keydown', (e) => { if (e.key === 'Enter' && $('hs').hidden) $('hgo').click(); });

/* ---------- Korisno: statične informacije (korisno.js), jezik kao u aplikaciji ---------- */
function usefulView() {
  const u = USEFUL[LANG] || USEFUL.en;
  $('kout').innerHTML = u.groups.map((g) => {
    const calls = (g.calls || []).map(([n, d]) => `<a class="call" href="tel:${esc(n)}"><b>${esc(n)}</b><span>${esc(d)}</span>${ic('phone')}</a>`).join('');
    const notes = (g.notes || []).map((x) => `<li>${esc(x)}</li>`).join('');
    return `<section class="sec" id="k-${esc(g.id)}"><h2 class="uh">${ic(g.icon)}${esc(g.title)}</h2><div class="box">${calls ? `<div class="calls">${calls}</div>` : ''}<ul class="unotes">${notes}</ul></div></section>`;
  }).join('') + `<p class="note">${esc(u.updated)}</p>`;
}

const VIEWS = ['pocetna', 'istrazi', 'plan', 'korisno', 'detalj'];
function route() {
  const raw = (location.hash || '#pocetna').slice(1);
  let h = raw, dkey = '';
  if (raw.startsWith('d/')) { h = 'detalj'; dkey = decodeURIComponent(raw.slice(2)); }
  else if (!VIEWS.includes(h) || h === 'detalj') h = 'pocetna';
  if (!$('lb').hidden) lbClose();
  VIEWS.forEach((v) => { $('v-' + v).className = 'view' + (v === h ? ' on' : ''); });
  const tab = h === 'detalj' ? 'istrazi' : h;
  document.querySelectorAll('.tabs a').forEach((a) => (a.getAttribute('href') === '#' + tab ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  if (h !== 'detalj') document.title = t('pageTitle');
  const back = saved.hash === '#' + h ? saved.y : null;
  if (back !== null) saved = { hash: '', y: 0 };
  let done = Promise.resolve();
  if (h === 'istrazi') { $('p').closest('.fld').querySelector('.clr').hidden = !$('p').value; done = search(); }
  if (h === 'plan') { planView(); if (window.mpPushRender) window.mpPushRender(); }
  if (h === 'korisno') usefulView();
  if (h === 'detalj') showDetail(dkey);
  window.scrollTo(0, 0);
  if (back !== null) done.then(() => window.scrollTo(0, back));
}
window.addEventListener('hashchange', () => { navs++; route(); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
applyStatic();
const lbtn = $('lbtn'), lmenu = $('lmenu');
const lopen = (on) => { lmenu.hidden = !on; lbtn.setAttribute('aria-expanded', on); };
lbtn.onclick = (e) => { e.stopPropagation(); lopen(lmenu.hidden); if (!lmenu.hidden) { const c = lmenu.querySelector('[aria-current]'); if (c) c.focus(); } };
lmenu.onclick = (e) => { const b = e.target.closest('[data-lang]'); if (b) setLang(b.getAttribute('data-lang')); };
document.addEventListener('click', () => { if (!lmenu.hidden) lopen(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !lmenu.hidden) { lopen(false); lbtn.focus(); } });
showDates();
loadAll().then(route);
