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
const D = { x: { f: '', t: '' } };
let Q = '', sortNear = false, here = null; // Q = slobodan tekst sa početne; lokacija se drži samo u memoriji, nikad se ne šalje ni ne čuva
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

/* ---- Istraži: velika kartica sa fotografijom (sekcija 2 po dizajnu) ---- */
const kfmt = (n) => { n = +n; if (!(n >= 1000)) return String(n); const v = n / 1000; return (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10) + 'k'; };
function xCard(x, rest) {
  const key = (rest ? 'r:' : 'i:') + x.slug; known[key] = x;
  const kind = rest ? 'food' : x.kind, title = rest ? x.name : x.title, place = rest ? x.city : x.place;
  const desc = rest ? ((x.tags || []).join(', ') || x.ambience) : x.description;
  const dist = here && hasLoc(x) ? ' • ' + fmtKm(kmBetween(here, { lat: +x.lat, lng: +x.lng })) : '';
  let badge = '';
  if (!rest && x.featured) badge = `<span class="xb">${ic('check')}${t('popular')}</span>`;
  else if (rest ? x.verifiedAt : x.status === 'potvrdjeno') badge = `<span class="xb">${ic('check')}${t('confirmedB')}</span>`;
  else if (!rest && STATUS[x.status]) badge = `<span class="xb w">${ic('alert')}${esc(STATUS[x.status])}</span>`;
  let fi = 'clock', fb = '', fs = '', warn = false;
  if (rest) { fi = 'fork'; fb = x.price ? '€ ' + esc(x.price.lo) + ' – ' + esc(x.price.hi) : t('priceSoon'); fs = x.price ? t('perPerson').trim() : ''; }
  else if (x.kind === 'event') { fi = 'cal'; fb = esc(rangeShort(x)); if (x.offSeason) { fs = t('offSeason'); warn = true; } }
  else if (x.offSeason) { fi = 'alert'; fb = t('offSeason'); warn = true; }
  else { fb = t('openB'); fs = !x.months || !x.months.length || new Set(x.months).size === 12 ? t('allYearL') : monthsLabel(x.months); }
  const img = x.cover ? `<img src="${esc(x.cover)}" alt="" loading="lazy" decoding="async">` : `<span class="xph" aria-hidden="true">${ic(GLYPH[kind])}</span>`;
  const rate = rest && x.rating ? `<span class="xr">${ic('star', 'f')}<b>${esc(x.rating)}</b>${x.reviews ? ` <span>(${kfmt(x.reviews)})</span>` : ''}</span>` : '';
  return `<article class="xc${x.offSeason ? ' off' : ''}" data-c="${kind}"><div class="xi">${img}${badge}${heartBtn(key)}</div><div class="xbd"><h3 class="xt"><a class="lk" href="#d/${esc(key)}">${esc(title)}</a></h3><div class="xm"><span class="xp">${ic('pin')}<span>${esc(place)}${dist}</span></span>${rate}</div>${desc ? `<p class="xd">${esc(desc)}</p>` : ''}<div class="xf"><div class="xo${warn ? ' w' : ''}">${ic(fi)}<span><b>${fb}</b>${fs ? `<small>${esc(fs)}</small>` : ''}</span></div><span class="xdt" aria-hidden="true">${t('detailsB')}${ic('arrow')}</span></div></div></article>`;
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
const dm = (s) => { const a = String(s).slice(0, 10).split('-'); return `${a[2]}.${a[1]}.`; };
// 30.08. – 01.09.2025. (kao na dizajnu); engleski zadržava „30 Aug 2025”
function rangeShort(x) {
  if (!x.from) return '';
  if (LANG === 'en') return span(x);
  const multi = x.to && x.to !== x.from, end = multi ? x.to : x.from;
  return multi ? `${dm(x.from)} – ${dm(x.to)}${end.slice(0, 4)}.` : `${dm(x.from)}${end.slice(0, 4)}.`;
}
const heartBtn = (key) => { const on = likes.includes(key); return `<button type="button" class="sch" data-lk="${esc(key)}" aria-pressed="${on}" aria-label="${on ? t('unlike') : t('like')}">${ic('heart', on ? 'f' : '')}</button>`; };
/* Uskoro = hibrid: "stories" red (brz pregled) + feed velikih kartica (slika, datum bedž, srce, podijeli) */
let seen = [];
try { seen = JSON.parse(localStorage.getItem('mp.seen') || '[]'); } catch { seen = []; }
const dayLabel = (x) => (LANG === 'sr' ? dm(x.from) : nice(x.from));
function storyItem(x) {
  const key = 'i:' + x.slug; known[key] = x;
  const inner = x.cover ? `<img src="${esc(x.cover)}" alt="" loading="lazy" decoding="async">` : ic(GLYPH.event);
  return `<a class="st${seen.includes(key) ? ' seen' : ''}" role="listitem" href="#d/${esc(key)}" data-seen="${esc(key)}"><span class="stp"><span class="sti">${inner}</span></span><b class="stt">${esc(x.title)}</b><span class="std">${esc(dayLabel(x))}</span></a>`;
}
function soonCard(x) {
  const key = 'i:' + x.slug; known[key] = x;
  const img = x.cover ? `<img src="${esc(x.cover)}" alt="" loading="lazy" decoding="async" draggable="false">` : `<span class="fph" aria-hidden="true">${ic(GLYPH.event)}</span>`;
  const like = heartBtn(key).replace('class="sch"', 'class="fa"');
  return `<article class="fc" data-c="event"><div class="fi" data-open="${esc(key)}">${img}<span class="fdate">${esc(dayLabel(x))}</span>${x.featured ? `<span class="spill fpop">${t('popular')}</span>` : ''}</div><div class="fbar">${like}<button type="button" class="fa" data-sharek="${esc(key)}" aria-label="${t('share')}">${ic('share')}</button></div><div class="fcap"><h3 class="sct"><a class="lk" href="#d/${esc(key)}">${esc(x.title)}</a></h3><div class="scl">${ic('pin')}<span>${esc(x.place)}</span></div><div class="scl">${ic('cal')}<span>${esc(rangeShort(x))}</span></div></div></article>`;
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
  const up = all.filter((x) => x.kind === 'event' && (x.to || x.from) >= today).sort((a, b) => (a.from < b.from ? -1 : 1)).slice(0, 8);
  $('stories').hidden = up.length < 2;
  if (up.length) { $('stories').innerHTML = up.map(storyItem).join(''); $('rail').innerHTML = up.slice(0, 4).map(soonCard).join(''); }
  else if (all.length) $('rail').innerHTML = emptyBox('cal', t('noUpT'), t('noUpD'), `<a class="btn s" href="#istrazi" style="text-decoration:none">${t('goExplore')}</a>`);
  saveSnap();
  planView();
}
let timer;
const later = () => { clearTimeout(timer); timer = setTimeout(search, 250); };
async function search() {
  if (typeof xDot === 'function') xDot();
  const place = $('p').value.trim(), { f, t: to } = D.x;
  const qs = new URLSearchParams();
  if (place) qs.set('place', place);
  if (f) qs.set('from', f);
  if (to || f) qs.set('to', to || f);
  if (cat !== 'all' && cat !== 'food') qs.set('kind', cat);
  let items = [];
  if (cat !== 'food') { try { items = (await api('/items?' + qs)).items; } catch { $('count').textContent = ''; $('out').innerHTML = errBox('search'); return; } }
  const q = norm(place), tq = norm(Q);
  const hit = (...p) => !tq || norm(p.join(' ')).includes(tq);
  items = items.filter((x) => hit(x.title, x.place, x.region, x.description));
  const rs = cat === 'all' || cat === 'food' ? rests.filter((r) => (!q || norm(r.city).includes(q)) && hit(r.name, r.city, (r.tags || []).join(' '))) : [];
  const pool = items.sort((a, b) => (a.offSeason - b.offSeason)).map((x) => ({ x, r: false })).concat(rs.map((x) => ({ x, r: true })));
  const near = sortNear && here;
  if (near) {
    pool.forEach((o) => { o.d = hasLoc(o.x) ? kmBetween(here, { lat: +o.x.lat, lng: +o.x.lng }) : null; });
    pool.sort((a, b) => (a.d === null) - (b.d === null) || a.d - b.d);
  }
  const list = pool.map((o) => xCard(o.x, o.r));
  $('count').textContent = list.length ? t('found') + list.length + (Q ? ' · „' + Q + '“' : '') + (near ? ' · ' + t('nNear') : '') : '';
  $('out').innerHTML = list.length ? list.join('') : emptyBox('search', t('nothingT'), t('nothingD'), `<button type="button" class="btn s" data-clear-search>${t('clearSearch')}</button>`);
}

/* ---- plan ---- */
/* ---- Danas i u blizini ---- */
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
const resetFilters = () => { Q = ''; sortNear = false; D.x = { f: '', t: '' }; $('p').value = ''; $('xq').value = ''; showDates(); };
const syncCat = (k) => { cat = k; [...$('chips').children].forEach((c) => c.setAttribute('aria-pressed', c.getAttribute('data-cat') === k)); };
// brzi izbori sa početne: Danas, Vikend, U blizini -> Istraži sa tim filterom
document.addEventListener('click', async (e) => {
  const b = e.target.closest('#nchips [data-n]'); if (!b) return;
  const m = b.getAttribute('data-n');
  if (m === 'near' && !here) {
    b.disabled = true; here = await askLoc(); b.disabled = false;
    if (!here) { toast(t('locDenied')); return; }
  }
  resetFilters(); syncCat('all');
  if (m === 'today') D.x = { f: today, t: today };
  else if (m === 'weekend') { const [f, to] = weekendRange(); D.x = { f, t: to }; }
  else sortNear = true;
  showDates();
  location.hash = '#istrazi';
});

/* ---- izvoz u kalendar (.ics) ---- */
const icsEsc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsFold = (l) => { let o = ''; while (l.length > 70) { o += l.slice(0, 70) + '\r\n '; l = l.slice(70); } return o + l; };
const icsDay = (s) => s.replace(/-/g, '');
const icsNext = (s) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10).replace(/-/g, ''); };
function icsFor(list) {
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const ev = list.filter((x) => x && x.kind === 'event' && x.from).map((x) => {
    const link = `${location.origin}/s/${x.pr || 'i'}/${x.slug}`;
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
/* ---- Moj put (sekcija 4): dani, uređivanje, mapa, kalendar, PDF ---- */
let planDays = {}, planMeta = { name: '', start: '' };
try { planDays = JSON.parse(localStorage.getItem('mp.planDays') || '{}') || {}; } catch { planDays = {}; }
try { planMeta = Object.assign({ name: '', start: '' }, JSON.parse(localStorage.getItem('mp.planMeta') || '{}')); } catch { /* ignore */ }
const saveDays = () => { try { localStorage.setItem('mp.planDays', JSON.stringify(planDays)); localStorage.setItem('mp.planMeta', JSON.stringify(planMeta)); } catch { /* ignore */ } };
const plur = (n, f) => { const k = (LANG === 'sr' || LANG === 'ru') ? ((n % 10 === 1 && n % 100 !== 11) ? 0 : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) ? 1 : 2) : (n === 1 ? 0 : 1); return n + ' ' + f[k]; };
const validDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
const tripTitle = () => planMeta.name || t('tripDef');
const itemTitle = (x) => x.title || x.name, itemPlace = (x) => x.place || x.city || '';
function dayDate(d) { return validDay(planMeta.start) ? nice(iso(addDays(parse(planMeta.start), d - 1))) : ''; }
function planModel() {
  plan.forEach((k) => { if (!known[k] && snap[k]) known[k] = snap[k]; });
  const l = plan.filter((k) => known[k]), live = new Set(plan);
  Object.keys(planDays).forEach((k) => { if (!live.has(k)) delete planDays[k]; });
  let cur = Math.max(1, ...l.map((k) => planDays[k] || 0));
  l.forEach((k) => {
    if (planDays[k] > 0) return;
    const x = known[k]; let d = cur;
    if (x.kind === 'event' && x.from && validDay(planMeta.start)) d = Math.max(1, Math.round((parse(x.from) - parse(planMeta.start)) / 864e5) + 1);
    planDays[k] = d;
  });
  saveDays();
  const byDay = {}; l.forEach((k) => (byDay[planDays[k]] = byDay[planDays[k]] || []).push(k));
  const days = Object.keys(byDay).map(Number).sort((a, b) => a - b);
  return { l, byDay, days, span: days.length ? days[days.length - 1] : 0 };
}
function planRow(k) {
  const x = known[k], kind = k[0] === 'i' ? x.kind : 'food', cover = x.cover;
  const sub = [itemPlace(x), kind === 'event' && x.from ? rangeShort(x) : ''].filter(Boolean).join(' • ');
  const th = cover ? `<img src="${esc(cover)}" alt="" loading="lazy" decoding="async">` : `<span class="tph" aria-hidden="true">${ic(GLYPH[kind])}</span>`;
  return `<li class="tr" data-c="${kind}"><a class="trl" href="#d/${esc(k)}"><span class="tth">${th}</span><span class="ttx"><b>${esc(itemTitle(x))}</b><small>${esc(sub)}</small></span></a><button type="button" class="tmore" data-pm="${esc(k)}" aria-label="${t('optsB')}">${ic('more')}</button></li>`;
}
function planView() {
  const { l, byDay, days, span } = planModel();
  $('ptitle').textContent = tripTitle();
  $('psub').textContent = l.length ? plur(span, t('dayF')) + ' • ' + plur(l.length, t('locF')) : '';
  const cov = (l.map((k) => known[k].cover).find(Boolean)) || '';
  $('phero').style.backgroundImage = cov ? 'url(' + JSON.stringify(cov) + ')' : '';
  $('pout').innerHTML = l.length
    ? `<ol class="tl">${days.map((d) => `<li class="td"><div class="tdh"><span class="tnode" aria-hidden="true"></span><b>${t('dayW')} ${d}</b>${dayDate(d) ? `<span>• ${esc(dayDate(d))}</span>` : ''}</div><ul class="tli">${byDay[d].map(planRow).join('')}</ul></li>`).join('')}</ol>`
    : emptyBox('route', t('emptyPlanT'), t('emptyPlanD'), `<a class="btn p" href="#istrazi" style="text-decoration:none">${t('goExplore')}</a>`);
  $('pacts').hidden = !l.length; $('pmap').hidden = !l.length;
  $('pb').textContent = plan.length; $('pb').hidden = !plan.length;
}
const setAdd = (a, on) => { a.setAttribute('aria-pressed', on); const g = on ? ic('check') : ic('plus'), l = on ? t('inPlan') : t('addPlan'); a.innerHTML = a.classList.contains('dact') ? `<span class="dci">${g}</span><span class="dl">${l}</span>` : g + l; };
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

function planDayLines() {
  const { byDay, days } = planModel();
  return days.map((d) => ({ d, keys: byDay[d] }));
}
function mapsRoute() {
  const pts = planDayLines().flatMap((g) => g.keys).map((k) => known[k]).filter(hasLoc).map((x) => `${x.lat},${x.lng}`);
  if (!pts.length) { toast(t('noMapPts')); return; }
  const u = pts.length === 1 ? 'https://www.google.com/maps/search/?api=1&query=' + pts[0]
    : 'https://www.google.com/maps/dir/?api=1&origin=' + pts[0] + '&destination=' + pts[pts.length - 1] + (pts.length > 2 ? '&waypoints=' + pts.slice(1, -1).slice(0, 9).join('|') : '');
  window.open(u, '_blank', 'noopener');
}
function icsPlanList() {
  const out = [];
  planDayLines().forEach((g) => g.keys.forEach((k) => {
    const x = known[k], rest = k[0] === 'r';
    if (x.kind === 'event' && x.from) out.push(x);
    else if (validDay(planMeta.start)) { const d = iso(addDays(parse(planMeta.start), g.d - 1)); out.push({ slug: k.slice(2), pr: rest ? 'r' : 'i', kind: 'event', from: d, to: d, title: itemTitle(x), place: itemPlace(x), description: (rest ? (x.tags || []).join(', ') : x.description) || '' }); }
  }));
  return out;
}
function printPlan() {
  const g = planDayLines(); if (!g.length) return;
  let el = $('pprint'); if (!el) { el = document.createElement('div'); el.id = 'pprint'; document.body.appendChild(el); }
  const { l, span } = planModel();
  el.innerHTML = `<h1>${esc(tripTitle())}</h1><p class="pps">${esc(plur(span, t('dayF')) + ' • ' + plur(l.length, t('locF')))}</p>` + g.map((x) => `<h2>${esc(t('dayW') + ' ' + x.d + (dayDate(x.d) ? ' • ' + dayDate(x.d) : ''))}</h2><ul>${x.keys.map((k) => { const o = known[k]; return `<li><b>${esc(itemTitle(o))}</b> — ${esc([itemPlace(o), o.kind === 'event' && o.from ? rangeShort(o) : ''].filter(Boolean).join(' • '))}</li>`; }).join('')}</ul>`).join('') + `<p class="ppf">Montepalm · ${esc(location.origin)}</p>`;
  document.body.classList.add('printing'); window.print();
}
window.addEventListener('afterprint', () => document.body.classList.remove('printing'));
$('share').onclick = async () => {
  const txt = t('shareHead') + planDayLines().map((g) => `${t('dayW')} ${g.d}${dayDate(g.d) ? ' • ' + dayDate(g.d) : ''}:\n` + g.keys.map((k) => { const x = known[k]; return '- ' + itemTitle(x) + ' (' + itemPlace(x) + ')'; }).join('\n')).join('\n\n');
  try {
    if (navigator.share) { await navigator.share({ text: txt }); return; }
    await navigator.clipboard.writeText(txt); $('sh').textContent = t('planCopied');
  } catch { $('sh').textContent = t('copyFail'); }
};
$('ics').onclick = () => { const l = icsPlanList(); if (!l.length) { toast(t('icsNone')); return; } saveIcs(l, 'montepalm-plan.ics'); };
$('ppdf').onclick = printPlan;
$('pmap').onclick = mapsRoute;
/* potvrda u stilu aplikacije (umjesto sistemskog prozora): askConfirm({ text, ok, icon }) vraća Promise<boolean> */
function askConfirm({ text, ok, icon = 'trash' }) {
  return new Promise((res) => {
    const prev = document.activeElement;
    const el = document.createElement('div');
    el.className = 'cdlg';
    el.innerHTML = `<div class="scrim" data-no></div><div class="cbox" role="alertdialog" aria-modal="true" aria-labelledby="cdt"><span class="cico" aria-hidden="true">${ic(icon)}</span><h2 id="cdt">${esc(text)}</h2><div class="cact"><button type="button" class="btn s" data-no>${esc(t('cancel'))}</button><button type="button" class="btn d" data-yes>${esc(ok)}</button></div></div>`;
    document.body.appendChild(el); document.body.classList.add('lock');
    const done = (v) => { document.removeEventListener('keydown', key, true); el.remove(); document.body.classList.remove('lock'); if (prev && prev.focus) prev.focus(); res(v); };
    const key = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); } };
    document.addEventListener('keydown', key, true);
    el.addEventListener('click', (e) => { if (e.target.closest('[data-yes]')) done(true); else if (e.target.closest('[data-no]')) done(false); });
    el.querySelector('[data-no].btn').focus();
  });
}
$('pclr').onclick = async () => {
  if (!plan.length || !(await askConfirm({ text: t('clearPlanQ'), ok: t('pClear') }))) return;
  plan.length = 0; planDays = {}; savePlan(); saveDays(); planView();
};
$('pback').onclick = () => { if (navs > 0) history.back(); else location.hash = '#pocetna'; };
const psClose = () => { $('psheet').hidden = true; };
function openPSheet(mode, key) {
  const body = $('psb'), ttl = $('ps-t');
  if (mode === 'edit') {
    ttl.textContent = t('editTrip');
    body.innerHTML = `<label class="plb">${t('tripName')}<input id="pn" maxlength="60" value="${esc(planMeta.name)}" placeholder="${esc(t('tripDef'))}" autocomplete="off"></label><label class="plb">${t('tripStart')}<input id="pst" type="date" value="${esc(validDay(planMeta.start) ? planMeta.start : '')}"></label><div class="pfa"><button type="button" class="btn g" data-pcd>${t('clear')}</button><button type="button" class="btn p" data-psave>${t('pSave')}</button></div>`;
  } else if (mode === 'item') {
    const x = known[key]; if (!x) return;
    const { span } = planModel(), cur = planDays[key] || 1, top = Math.min(span + 1, 30);
    ttl.textContent = itemTitle(x);
    body.innerHTML = `<div class="plb">${t('moveDay')}</div><div class="pdays">${Array.from({ length: top }, (_, i) => `<button type="button" class="chip" data-day="${i + 1}" data-k="${esc(key)}" aria-pressed="${i + 1 === cur}">${i + 1}</button>`).join('')}</div><a class="btn s full" href="#d/${esc(key)}" data-x style="text-decoration:none;margin-top:14px">${ic('arrow')}${t('openItem')}</a><button type="button" class="btn s full pdanger" data-rm="${esc(key)}" style="margin-top:10px">${ic('trash')}${t('removePlan')}</button>`;
  } else {
    ttl.textContent = t('myTrip');
    const row = (id, g, l) => `<button type="button" class="btn s full prow" data-act="${id}">${ic(g)}${t(l)}</button>`;
    body.innerHTML = row('pmap', 'map', 'planMapB') + row('share', 'share', 'shareB') + row('ics', 'cal', 'pCal') + row('ppdf', 'file', 'pPdf') + row('pclr', 'trash', 'pClear');
  }
  $('psheet').hidden = false;
}
$('pedit').onclick = () => openPSheet('edit');
$('pmenu').onclick = () => { if (plan.length) openPSheet('trip'); else openPSheet('edit'); };
$('pout').addEventListener('click', (e) => { const b = e.target.closest('[data-pm]'); if (b) { e.preventDefault(); openPSheet('item', b.getAttribute('data-pm')); } });
$('psheet').addEventListener('click', (e) => {
  const a = e.target.closest('[data-act]'); if (a) { psClose(); $(a.getAttribute('data-act')).click(); return; }
  const dy = e.target.closest('[data-day]'); if (dy) { planDays[dy.getAttribute('data-k')] = +dy.getAttribute('data-day'); saveDays(); psClose(); planView(); return; }
  const rm = e.target.closest('[data-rm]'); if (rm) { const k = rm.getAttribute('data-rm'), i = plan.indexOf(k); if (i >= 0) plan.splice(i, 1); delete planDays[k]; savePlan(); saveDays(); psClose(); planView(); return; }
  if (e.target.closest('[data-pcd]')) { $('pst').value = ''; return; }
  if (e.target.closest('[data-psave]')) { planMeta.name = $('pn').value.trim().slice(0, 60); planMeta.start = validDay($('pst').value) ? $('pst').value : ''; saveDays(); psClose(); planView(); return; }
  if (e.target.closest('[data-x]')) psClose();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('psheet').hidden) psClose(); });

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
bindPlace('p', 'xs', later);

/* ---- kalendar ---- */
const cal = { pair: 'h', f: '', t: '', view: new Date(), step: 'f' };
function showDates() {
  [['x', 'f'], ['x', 't']].forEach(([p, k]) => {
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

/* ---- detalj stavke ---- */
const wxLink = (x) => { const s = window.wxSlug && window.wxSlug(x.place || x.city); return s ? `<a class="wxlnk" href="#vrijeme/${s}">${t('wxDetail')}${ic('right')}</a>` : ''; };
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
  const n = media.length; lbList = media;
  const liked = likes.includes(key), conf = isI ? x.status === 'potvrdjeno' : !!x.verifiedAt;
  const pill = conf ? `<span class="dpill">${ic('check')}${t('confirmedB')}</span>` : isI && STATUS[x.status] ? `<span class="dpill w">${ic('alert')}${esc(STATUS[x.status])}</span>` : '';
  const rows = [['pin', esc(place)]];
  if (isI) rows.push(['cal', esc(kind === 'event' && x.from ? rangeShort(x) : monthsLabel(x.months))]);
  else { if (x.rating) rows.push(['star', `${esc(x.rating)} (${esc(x.reviews)}${t('reviews')})`]); rows.push(['fork', x.price ? euro(x.price.lo) + ' – ' + euro(x.price.hi) + t('perPerson') : t('priceSoon')]); }
  const rowsH = rows.map((r, i) => `<li>${ic(r[0])}<span>${r[1]}</span>${i === rows.length - 1 ? pill : ''}</li>`).join('');
  const lead = isI ? x.description : x.ambience, more = isI ? x.details : '';
  const hero = n
    ? `<div class="gtrack" id="gtrack">${media.map((m, i) => slideHtml(m, i, title)).join('')}</div>${n > 1 ? `<div class="gcount" id="gcount">1 / ${n}</div><div class="dots" id="dots" aria-hidden="true">${media.map((_, i) => `<i${i ? '' : ' class="on"'}></i>`).join('')}</div>` : ''}<span class="burst" id="burst" aria-hidden="true">${ic('heart', 'f')}</span>`
    : `<div class="gempty">${ic(GLYPH[kind])}<span>${t('photosSoon')}</span></div>`;
  const cur = media[0], cap = cur && (cur.caption || cur.credit) ? `<p class="pcr" id="pcr">${esc(cur.caption)}${cur.credit ? `<i>${esc(cur.credit)}</i>` : ''}</p>` : '';
  const tickets = isI && x.kind === 'event' && /^https?:\/\//.test(x.website || '') ? x.website : '';
  box.innerHTML = `<div class="xd3" data-c="${kind}">
    <div class="dtop"><button type="button" class="dib dl2" data-back aria-label="${t('back')}">${ic('left')}</button><div class="dr"><button type="button" class="dib" data-share aria-label="${t('share')}">${ic('share')}</button>${heartBtn(key).replace('class="sch"', 'class="sch dib"')}</div></div>
    <div class="dhero pm">${hero}</div>
    <div class="dsheet">
      <span class="dkind">${KIND[kind]}</span>
      <h1 class="dtt">${esc(title)}</h1>
      <ul class="drows">${rowsH}</ul>
      ${lead ? `<p class="dlead">${esc(lead)}</p>` : ''}
      <div class="dacts">
        <button type="button" class="dact add" aria-pressed="${inp}" data-k="${esc(key)}"><span class="dci">${inp ? ic('check') : ic('plus')}</span><span class="dl">${inp ? t('inPlan') : t('addPlan')}</span></button>
        <a class="dact" href="${esc(maps)}" target="_blank" rel="noopener"><span class="dci">${ic('nav')}</span><span class="dl">${t('navB')}</span></a>
        ${isI && x.kind === 'event' && x.from ? `<button type="button" class="dact" data-ics><span class="dci">${ic('cal')}</span><span class="dl">${t('calB')}</span></button>` : ''}
        <button type="button" class="dact" data-share><span class="dci">${ic('share')}</span><span class="dl">${t('shareB')}</span></button>
      </div>
      <section class="wcard" id="wsec"><button type="button" class="wmain" id="wmain" data-wx aria-expanded="false"><span class="skb" style="height:44px;width:100%"></span></button><div class="wmore" id="wmore" hidden><p class="sub" id="wsub"></p><div id="wbody"></div>${wxLink(x)}</div></section>
      ${more ? `<section class="sec dabout"><h2>${kind === 'event' ? t('about').event : t('about').loc}</h2><p class="prose dclamp" id="dprose">${esc(more)}</p><button type="button" class="dmore" id="dmorebtn" data-more aria-expanded="false" hidden>${t('readMore')}${ic('down')}</button></section>` : ''}
      ${cap}
      ${gridHtml(media)}
      ${!isI && x.why && x.why.length ? `<section class="sec"><h2>${t('whyHere')}</h2><div class="box"><ul class="why">${x.why.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div></section>` : ''}
      ${tags.length ? `<section class="sec"><div class="tags">${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div></section>` : ''}
      ${isI ? '' : menuHtml(x.menu)}
      <section class="sec"><h2>${t('info')}</h2><div class="box">${infoRows(x, isI)}</div></section>
    </div>
    ${tickets ? `<div class="dcta"><a class="btn p" href="${esc(tickets)}" target="_blank" rel="noopener noreferrer">${t('tickets')}${ic('ext')}</a></div>` : ''}
  </div>`;
  const pr = $('dprose'), mb = $('dmorebtn'); if (pr && mb) mb.hidden = pr.scrollHeight <= pr.clientHeight + 1;
  initGallery();
  loadWeather(key, x, tok);
}

async function loadWeather(key, x, tok) {
  const per = weatherPeriod(x), qs = new URLSearchParams({ ref: key });
  if (per) { qs.set('from', per.f); qs.set('to', per.t); }
  let w;
  try { w = await api('/weather?' + qs); }
  catch { if (tok === detailTok && $('wbody')) { $('wsub').textContent = ''; $('wmain').hidden = true; $('wmore').hidden = false; $('wbody').innerHTML = `<p class="m" style="margin:0 0 8px">${t('wxFail')}</p><button type="button" class="btn s" data-retry>${t('retry')}</button>`; } return; }
  if (tok !== detailTok || !$('wbody')) return;
  if (!w.available) { $('wsec').remove(); return; }
  const attr = `<p class="note">${t('data')}<a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a></p>`;
  $('wsub').textContent = per ? `${w.place}, ${rangeText(w.from, w.to)}` : `${t('next7')}${w.place}${t('next7b')}`;
  const est = w.days.some((d) => d.src === 'climate');
  { const d0 = w.days[0], cl0 = d0 && d0.src === 'climate', g0 = d0 ? (cl0 ? climIcon(d0.wet) : wxIcon(d0.code)) : 'cloudsun'; $('wmain').innerHTML = d0 ? `<span class="wi" data-w="${g0}">${ic(g0)}</span><span class="wt"><b>${d0.tmax}°C</b><span>${wxText[g0]}</span></span><span class="wsrc">${cl0 ? t('wxEst') : t('wxBased')}${ic('down')}</span>` : ''; }
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

function syncHearts() {
  document.querySelectorAll('[data-lk]').forEach((b) => { const on = likes.includes(b.getAttribute('data-lk')); b.setAttribute('aria-pressed', on); b.setAttribute('aria-label', on ? t('unlike') : t('like')); b.innerHTML = ic('heart', on ? 'f' : ''); });
}
document.addEventListener('click', (e) => {
  const h = e.target.closest('[data-lk]'); if (!h) return;
  e.preventDefault(); toggleLike(h.getAttribute('data-lk'));
  if (likes.includes(h.getAttribute('data-lk'))) bump(h, 'pop');
});
function toggleLike(k, forceOn) {
  const i = likes.indexOf(k);
  if (i >= 0 && !forceOn) likes.splice(i, 1); else if (i < 0) likes.push(k);
  saveLikes();
  document.querySelectorAll('[data-like]').forEach((b) => { if (b.getAttribute('data-like') === k) setLike(b, likes.includes(k)); });
  syncHearts();
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
    resetFilters();
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
  const el = e.target;
  if (el.closest('[data-back]')) { if (navs > 0) history.back(); else location.hash = '#istrazi'; return; }
  const wx = el.closest('[data-wx]'); if (wx) { const on = wx.getAttribute('aria-expanded') !== 'true'; wx.setAttribute('aria-expanded', on); $('wmore').hidden = !on; return; }
  const mo = el.closest('[data-more]'); if (mo) { const pe = $('dprose'), on = !pe.classList.contains('open'); pe.classList.toggle('open', on); mo.setAttribute('aria-expanded', on); mo.innerHTML = (on ? t('readLess') : t('readMore')) + ic('down'); return; }
  const lk = el.closest('[data-like]'); if (lk) { toggleLike(lk.getAttribute('data-like')); return; }
  if (el.closest('[data-ics]')) { const x = known[decodeURIComponent(location.hash.slice(3))]; if (x) saveIcs([x], (x.slug || 'dogadjaj') + '.ics'); return; }
  const bm = el.closest('[data-bm]'); if (bm) { const a = document.querySelector('.acts2 .add'); if (a) a.click(); return; }
  const vt = el.closest('[data-vt]');
  if (vt) { const v = vt.parentNode.querySelector('video'); if (v.paused) v.play().catch(() => {}); else v.pause(); return; }
  const mu = el.closest('[data-mute]');
  if (mu) { const v = mu.parentNode.querySelector('video'); v.muted = !v.muted; mu.innerHTML = ic(v.muted ? 'mute' : 'vol'); mu.setAttribute('aria-label', v.muted ? t('soundOn') : t('soundOff')); return; }
  const z = el.closest('[data-z]'); if (z) { lbOpen(+z.getAttribute('data-z')); return; }
  const yt = el.closest('[data-yt]');
  if (yt) { yt.parentNode.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${esc(yt.getAttribute('data-yt'))}?autoplay=1&rel=0&playsinline=1" title="Video" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`; return; }
  if (el.closest('[data-retry]')) { const k = decodeURIComponent(location.hash.slice(3)); $('wbody').innerHTML = '<div class="skb" style="height:132px"></div>'; if (known[k]) loadWeather(k, known[k], detailTok); return; }
  if (el.closest('[data-share]')) {
    const k = decodeURIComponent(location.hash.slice(3)), x = known[k] || {}, link = /^[ir]:[a-z0-9-]+$/.test(k) ? `${location.origin}/s/${k[0]}/${k.slice(2)}${LANG === 'sr' ? '' : '?lang=' + LANG}` : location.href, data = { title: x.title || x.name || 'Montepalm', url: link };
    try { if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(link); toast(t('linkCopied')); } } catch { /* otkazano */ }
  }
});
document.addEventListener('click', (e) => { if (e.target.closest('.lk, a.ev')) saved = { hash: location.hash || '#pocetna', y: window.scrollY }; });

/* Uskoro: stories označeni kao viđeni, dupli dodir na sliku = srce, jedan dodir = detalji, podijeli */
document.addEventListener('click', (e) => {
  const st = e.target.closest('[data-seen]');
  if (st) { const k = st.getAttribute('data-seen'); if (!seen.includes(k)) { seen.push(k); try { localStorage.setItem('mp.seen', JSON.stringify(seen.slice(-100))); } catch { /* ignore */ } } saved = { hash: location.hash || '#pocetna', y: window.scrollY }; }
});
let feedTap = { k: '', at: 0, tm: 0 };
$('rail').addEventListener('click', (e) => {
  const fi = e.target.closest('[data-open]'); if (!fi) return;
  const k = fi.getAttribute('data-open'), now = Date.now();
  if (feedTap.k === k && now - feedTap.at < 320) {
    clearTimeout(feedTap.tm); feedTap = { k: '', at: 0, tm: 0 };
    toggleLike(k, true);
    const b = document.createElement('span'); b.className = 'fburst'; b.innerHTML = ic('heart', 'f'); fi.appendChild(b); setTimeout(() => b.remove(), 800);
    return;
  }
  clearTimeout(feedTap.tm);
  feedTap = { k, at: now, tm: setTimeout(() => { feedTap = { k: '', at: 0, tm: 0 }; saved = { hash: location.hash || '#pocetna', y: window.scrollY }; location.hash = '#d/' + k; }, 330) };
});
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-sharek]'); if (!b) return;
  const k = b.getAttribute('data-sharek'), x = known[k] || {};
  const link = /^[ir]:[a-z0-9-]+$/.test(k) ? `${location.origin}/s/${k[0]}/${k.slice(2)}${LANG === 'sr' ? '' : '?lang=' + LANG}` : location.href;
  try { if (navigator.share) await navigator.share({ title: x.title || x.name || 'Montepalm', url: link }); else { await navigator.clipboard.writeText(link); toast(t('linkCopied')); } } catch { /* otkazano */ }
});

/* Pitaj: pomoćnik odgovara samo iz sadržaja aplikacije; kartice dolaze sa servera, ne iz teksta modela */
const askOpen = () => { $('asksheet').hidden = false; document.body.classList.add('lock'); if ($('askout').hidden) setTimeout(() => $('askq').focus(), 60); };
const askClose = () => { if ($('asksheet').hidden) return; $('asksheet').hidden = true; document.body.classList.remove('lock'); };
$('askfab').onclick = askOpen;
$('asksheet').addEventListener('click', (e) => { if (e.target.closest('[data-x]')) askClose(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') askClose(); });
$('askx').innerHTML = [t('askEx1'), t('askEx2'), t('askEx3')].map((x) => `<button type="button" class="askc" data-ask="${esc(x)}">${esc(x)}</button>`).join('');
async function askSend(q) {
  const out = $('askout'), btn = $('askb');
  out.hidden = false; out.innerHTML = `<div class="askld">${esc(t('askLoad'))}</div>`; btn.disabled = true;
  try {
    const r = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ q, lang: LANG }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error('ask'), { status: r.status });
    const rs = d.results || [];
    out.innerHTML = (rs.length ? `<div class="askrec"><span class="askrb">${ic('spark')}${esc(t('askRec'))}</span><p class="askrp">${esc(d.reply || '')}</p></div><div class="xlist askl">${rs.map((x) => xCard(x, x.type === 'rest')).join('')}</div>` : `<p class="askrp">${esc(d.reply || '')}</p>`);
  } catch (e) {
    out.innerHTML = `<div class="askerr">${esc(t(e.status === 429 ? 'askBusy' : e.status === 400 ? 'askShort' : 'askErr'))}</div>`;
  } finally { btn.disabled = false; }
}
$('askf').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = $('askq').value.trim();
  if (q.length < 2) { $('askq').focus(); return; }
  $('askq').blur(); askSend(q);
});
$('askx').addEventListener('click', (e) => {
  const b = e.target.closest('[data-ask]'); if (!b) return;
  $('askq').value = b.getAttribute('data-ask'); $('askf').requestSubmit();
});

/* ---- navigacija ---- */
function setCat(k) { cat = k; [...$('chips').children].forEach((c) => c.setAttribute('aria-pressed', c.getAttribute('data-cat') === k)); search(); }
const TG = { ...GLYPH, event: 'calstar' };
// sr: gotove fotografije sa ikonicom i nazivom (media/cat-*.webp); ostali jezici zadržavaju sliku iz baze sa prevedenim nazivom
let TILE_ART = LANG === 'sr';
function renderTiles() {
  if (TILE_ART) {
    $('tiles').innerHTML = Object.keys(CATS).map((k) => `<button class="tile art" type="button" data-c="${k}" data-cat="${k}" aria-label="${esc(CATS[k])}"><img class="tbg" src="/media/cat-${k}.webp" alt="" width="692" height="427" loading="lazy" decoding="async"></button>`).join('');
    // ako slika ne postoji na serveru, vrati se na raniji prikaz umjesto praznih pločica
    $('tiles').addEventListener('error', () => { if (TILE_ART) { TILE_ART = false; renderTiles(); } }, { capture: true, once: true });
    return;
  }
  const cov = (k) => (k === 'food' ? (rests.find((r) => r.cover) || {}).cover : (all.find((x) => x.kind === k && x.cover) || {}).cover) || '';
  $('tiles').innerHTML = Object.keys(CATS).map((k) => { const c = cov(k); return `<button class="tile${c ? ' hasbg' : ''}" type="button" data-c="${k}" data-cat="${k}">${c ? `<img class="tbg" src="${esc(c)}" alt="" loading="lazy" decoding="async">` : ''}<span class="bd">${ic(TG[k])}</span><span class="tl">${CATS[k]}</span></button>`; }).join('');
}
renderTiles();
['all', ...Object.keys(CATS)].forEach((k) => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; if (k === 'all') b.innerHTML = t('all') + ic('down'); else b.textContent = CATS[k];
  b.setAttribute('data-cat', k); b.setAttribute('aria-pressed', k === 'all'); b.onclick = () => setCat(k); $('chips').appendChild(b);
});
$('tiles').onclick = (e) => { const b = e.target.closest('.tile'); if (!b) return; resetFilters(); setCat(b.getAttribute('data-cat')); location.hash = '#istrazi'; };
$('allev').onclick = () => { resetFilters(); setCat('event'); location.hash = '#istrazi'; };
$('allcat').onclick = () => { resetFilters(); setCat('all'); location.hash = '#istrazi'; };
$('sf').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('hq').value.trim();
  resetFilters(); syncCat('all'); Q = v;
  $('hq').blur();
  location.hash = '#istrazi';
});

/* ---------- Korisno: statične informacije (korisno.js), jezik kao u aplikaciji ---------- */
function usefulView() {
  const u = USEFUL[LANG] || USEFUL.en;
  $('kout').innerHTML = `<div class="kgrid">${u.groups.map((g) => `<button type="button" class="ktile" data-kg="${esc(g.id)}"><span class="kti">${ic(g.icon)}</span><span class="ktt"><b>${esc(g.title)}</b><small>${esc(g.sub || '')}</small></span>${ic('right')}</button>`).join('')}</div>`
    + `<a class="khelp" href="tel:112">${ic('phone')}<span>${t('needHelp')}</span></a><p class="note">${esc(u.updated)}</p>`;
}
function usefulOpen(id) {
  const g = (USEFUL[LANG] || USEFUL.en).groups.find((x) => x.id === id); if (!g) return;
  const calls = (g.calls || []).map(([n, d]) => `<a class="call" href="tel:${esc(n)}"><b>${esc(n)}</b><span>${esc(d)}</span>${ic('phone')}</a>`).join('');
  const notes = (g.notes || []).map((x) => `<li>${esc(x)}</li>`).join('');
  $('ks-t').textContent = g.title;
  $('ks-b').innerHTML = (calls ? `<div class="calls">${calls}</div>` : '') + `<ul class="unotes">${notes}</ul>`;
  $('ksheet').hidden = false;
}
$('kout').addEventListener('click', (e) => { const b = e.target.closest('[data-kg]'); if (b) usefulOpen(b.getAttribute('data-kg')); });
$('ksheet').addEventListener('click', (e) => { if (e.target.closest('[data-x]')) $('ksheet').hidden = true; });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('ksheet').hidden) $('ksheet').hidden = true; });

const VIEWS = ['pocetna', 'istrazi', 'plan', 'korisno', 'mapa', 'vrijeme', 'profil', 'detalj'];
function route() {
  const raw = (location.hash || '#pocetna').slice(1);
  let h = raw, dkey = '', wkey = '';
  if (raw.startsWith('d/')) { h = 'detalj'; dkey = decodeURIComponent(raw.slice(2)); }
  else if (raw === 'vrijeme' || raw.startsWith('vrijeme/')) { h = 'vrijeme'; wkey = raw.slice(8); }
  else if (!VIEWS.includes(h) || h === 'detalj') h = 'pocetna';
  if (!$('lb').hidden) lbClose();
  $('ksheet').hidden = true; askClose();
  VIEWS.forEach((v) => { $('v-' + v).className = 'view' + (v === h ? ' on' : ''); });
  const tab = h === 'detalj' || h === 'mapa' ? 'istrazi' : h === 'vrijeme' || h === 'profil' ? 'pocetna' : h;
  document.querySelectorAll('.tabs a').forEach((a) => (a.getAttribute('href') === '#' + tab ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  document.body.classList.toggle('isdet', h === 'detalj');
  document.body.classList.toggle('ismap', h === 'mapa');
  if (h !== 'detalj') document.title = t('pageTitle');
  const back = saved.hash === '#' + h ? saved.y : null;
  if (back !== null) saved = { hash: '', y: 0 };
  let done = Promise.resolve();
  if (h === 'istrazi') { $('xq').value = Q; $('xnear').setAttribute('aria-pressed', sortNear); if ($('p').value.trim() || D.x.f || sortNear) xFilOpen(true); $('p').closest('.fld').querySelector('.clr').hidden = !$('p').value; done = search(); }
  if (h === 'plan') { planView(); if (window.mpPushRender) window.mpPushRender(); }
  if (h === 'korisno') usefulView();
  if (h === 'profil' && window.profilView) window.profilView();
  if (h === 'mapa' && window.mapView) window.mapView();
  if (h === 'vrijeme' && window.weatherView) window.weatherView(wkey);
  if (h === 'detalj') showDetail(dkey);
  window.scrollTo(0, 0);
  if (back !== null) done.then(() => window.scrollTo(0, back));
}
window.addEventListener('hashchange', () => { navs++; route(); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
applyStatic();
const lbtn = $('lbtn'), lmenu = $('lmenu');
if (lbtn && lmenu) {
  const lopen = (on) => { lmenu.hidden = !on; lbtn.setAttribute('aria-expanded', on); };
  lbtn.onclick = (e) => { e.stopPropagation(); lopen(lmenu.hidden); if (!lmenu.hidden) { const c = lmenu.querySelector('[aria-current]'); if (c) c.focus(); } };
  lmenu.onclick = (e) => { const b = e.target.closest('[data-lang]'); if (b) setLang(b.getAttribute('data-lang')); };
  document.addEventListener('click', () => { if (!lmenu.hidden) lopen(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !lmenu.hidden) { lopen(false); lbtn.focus(); } });
}
/* ---- Istraži: zaglavlje, pretraga, Lista/Mapa ---- */
const xFilOpen = (on) => { $('xfil').hidden = !on; $('xpin').setAttribute('aria-expanded', on); };
function xDot() { $('xpin').querySelector('.xdot').hidden = !($('p').value.trim() || D.x.f || sortNear); }
$('xback').onclick = () => { if (navs > 0) history.back(); else location.hash = '#pocetna'; };
$('xpin').onclick = () => xFilOpen($('xfil').hidden);
$('xq').addEventListener('input', () => { Q = $('xq').value.trim(); later(); });
$('xq').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('xq').blur(); } });
$('xmap').onclick = () => { location.hash = '#mapa'; };
/* prekidač Lista / Mreža (izbor se pamti) */
function xView(g) {
  $('out').classList.toggle('grid', g);
  $('xgrid').setAttribute('aria-pressed', g); $('xlist').setAttribute('aria-pressed', !g);
  try { localStorage.setItem('mp.xgrid', g ? '1' : '0'); } catch { /* ignore */ }
}
$('xlist').onclick = () => xView(false);
$('xgrid').onclick = () => xView(true);
{ let g = false; try { g = localStorage.getItem('mp.xgrid') === '1'; } catch { /* ignore */ } xView(g); }
$('xnear').onclick = async () => {
  const b = $('xnear');
  if (!sortNear) {
    if (!here) { b.disabled = true; here = await askLoc(); b.disabled = false; if (!here) { toast(t('locDenied')); return; } }
    sortNear = true;
  } else sortNear = false;
  b.setAttribute('aria-pressed', sortNear); search();
};
showDates();
loadAll().then(route);
