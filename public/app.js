'use strict';
const $ = (i) => document.getElementById(i);
const CATS = { event: 'Događaji', beach: 'Plaže', food: 'Gastronomija', culture: 'Kultura' };
const KIND = { event: 'Događaj', beach: 'Plaža', food: 'Gastronomija', culture: 'Kultura' };
const GLYPH = { event: 'ticket', beach: 'umbrella', food: 'fork', culture: 'columns' };
const STATUS = { potvrdjeno: 'Potvrđeno', okvirno: 'Okvirno', provjeriti: 'Provjeriti' };
const MS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec'];
const MONTHS = ['januar', 'februar', 'mart', 'april', 'maj', 'jun', 'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar'];
const ic = (n, c = '') => `<svg class="ic ${c}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (t) => String(t).toLowerCase().replace(/đ/g, 'd').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/* ---- datumi (lokalno vrijeme, bez UTC pomaka) ---- */
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const a = String(s).slice(0, 10).split('-'); return new Date(+a[0], +a[1] - 1, +a[2]); };
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const fmt = (s) => { const a = String(s).slice(0, 10).split('-'); return `${+a[2]}. ${+a[1]}. ${a[0]}.`; };
const span = (x) => fmt(x.from) + (x.to && x.to !== x.from ? ' – ' + fmt(x.to) : '');
const nice = (s) => { const d = parse(s); return d.getDate() + '. ' + MS[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''); };
const today = iso(new Date());
const api = async (p) => { const r = await fetch('/api' + p); if (!r.ok) throw Object.assign(new Error('api'), { status: r.status }); return r.json(); };

let all = [], rests = [], places = [], cat = 'all', plan = [], known = {};
const D = { h: { f: '', t: '' }, x: { f: '', t: '' } };
try { plan = JSON.parse(localStorage.getItem('mp.plan') || '[]'); } catch { plan = []; }
const savePlan = () => { try { localStorage.setItem('mp.plan', JSON.stringify(plan)); } catch { /* ignore */ } };

/* ---- kartice ---- */
function itemCard(x) {
  const key = 'i:' + x.slug; known[key] = x;
  const meta = [], pills = [];
  if (x.kind === 'event') meta.push(`<li class="w">${ic('cal')}${esc(span(x))}</li>`);
  if (x.offSeason) meta.push(`<li class="warn">${ic('alert')}Van sezone u tom periodu</li>`);
  if (x.status !== 'potvrdjeno') pills.push(`<span class="pill">${esc(STATUS[x.status])}</span>`);
  if (x.demo) pills.push('<span class="pill demo">Primjer</span>');
  if (x.verifiedAt) meta.push(`<li>${ic('shield')}Provjereno ${esc(fmt(x.verifiedAt))}</li>`);
  return card(key, x.kind, x.title, x.place, x.description, meta, pills, x.offSeason);
}
function restCard(r) {
  const key = 'r:' + r.slug; known[key] = r;
  const meta = [];
  if (r.rating) meta.push(`<li class="star">${ic('star', 'f')}${esc(r.rating)} <span class="m">(${esc(r.reviews)})</span></li>`);
  meta.push(`<li class="w">${r.price ? '€ ' + esc(r.price.lo) + ' – ' + esc(r.price.hi) + ' po osobi' : 'Cijena uskoro'}</li>`);
  if (r.verifiedAt) meta.push(`<li>${ic('shield')}Provjereno ${esc(fmt(r.verifiedAt))}</li>`);
  return card(key, 'food', r.name, r.city, r.tags.join(', ') || r.ambience, meta, [], false);
}
function card(key, kind, title, place, desc, meta, pills, off) {
  const inp = plan.includes(key);
  return `<article class="card${off ? ' off' : ''}" data-c="${kind}"><div class="ch"><span class="bd">${ic(GLYPH[kind])}</span><div class="cm"><div class="kd">${KIND[kind]}</div><div class="pl">${ic('pin')}<span>${esc(place)}</span></div></div>${pills.join('')}</div><h3 class="t"><a class="lk" href="#d/${esc(key)}">${esc(title)}</a>${ic('right')}</h3>${desc ? `<p class="d">${esc(desc)}</p>` : ''}<ul class="meta">${meta.join('')}</ul><button type="button" class="btn s add" aria-pressed="${inp}" data-k="${esc(key)}">${inp ? ic('check') + 'U planu' : ic('plus') + 'Dodaj u plan'}</button></article>`;
}
const emptyBox = (g, title, text, extra = '') => `<div class="empty"><span class="bd">${ic(g)}</span><b>${title}</b><p>${text}</p>${extra}</div>`;
function railCard(x) {
  known['i:' + x.slug] = x;
  const d = parse(x.from);
  return `<a class="ev" href="#d/i:${esc(x.slug)}"><span class="dt"><b>${d.getDate()}</b><span>${MS[d.getMonth()]}</span></span><span class="tx"><span class="tt">${esc(x.title)}</span><span class="pl">${ic('pin')}<span>${esc(x.place)}</span></span><span class="rng">${esc(span(x))}</span></span></a>`;
}

/* ---- podaci ---- */
async function loadAll() {
  try {
    const [a, b] = await Promise.all([api('/items'), api('/restaurants?limit=100')]);
    all = a.items; rests = b.restaurants;
  } catch { all = []; rests = []; $('rail').innerHTML = emptyBox('alert', 'Podaci nisu učitani', 'Provjeri internet vezu i pokušaj ponovo.'); }
  places = [...new Set([...all.map((x) => x.place), ...rests.map((r) => r.city)])].sort((a, b) => a.localeCompare(b, 'sr'));
  const up = all.filter((x) => x.kind === 'event' && (x.to || x.from) >= today).sort((a, b) => (a.from < b.from ? -1 : 1)).slice(0, 6);
  if (up.length) $('rail').innerHTML = up.map(railCard).join('');
  else if (all.length) $('rail').innerHTML = emptyBox('cal', 'Nema nadolazećih događaja', 'Pogledaj plaže, kulturu i gastronomiju.');
  planView();
}
let timer;
const later = () => { clearTimeout(timer); timer = setTimeout(search, 250); };
async function search() {
  const place = $('p').value.trim(), { f, t } = D.x;
  const qs = new URLSearchParams();
  if (place) qs.set('place', place);
  if (f) qs.set('from', f);
  if (t || f) qs.set('to', t || f);
  if (cat !== 'all' && cat !== 'food') qs.set('kind', cat);
  let items = [];
  if (cat !== 'food') { try { items = (await api('/items?' + qs)).items; } catch { $('count').textContent = ''; $('out').innerHTML = emptyBox('alert', 'Podaci nisu učitani', 'Provjeri internet vezu i pokušaj ponovo.'); return; } }
  const q = norm(place);
  const rs = cat === 'all' || cat === 'food' ? rests.filter((r) => !q || norm(r.city).includes(q)) : [];
  const list = items.sort((a, b) => (a.offSeason - b.offSeason)).map(itemCard).concat(rs.map(restCard));
  $('count').textContent = list.length ? 'Pronađeno: ' + list.length : '';
  $('out').innerHTML = list.length ? list.join('') : emptyBox('search', 'Ništa nije pronađeno', 'Probaj šire datume ili ukloni mjesto.');
}

/* ---- plan ---- */
function planView() {
  const l = plan.filter((k) => known[k]);
  $('pout').innerHTML = l.length ? l.map((k) => (k[0] === 'i' ? itemCard(known[k]) : restCard(known[k]))).join('') : emptyBox('route', 'Plan je prazan', 'Dodaj događaje, plaže i restorane iz dijela Istraži.', '<a class="btn p" href="#istrazi" style="text-decoration:none">Idi na Istraži</a>');
  $('share').style.display = l.length ? 'inline-flex' : 'none';
  $('pb').textContent = plan.length; $('pb').hidden = !plan.length;
}
const setAdd = (a, on) => { a.setAttribute('aria-pressed', on); a.innerHTML = on ? ic('check') + 'U planu' : ic('plus') + 'Dodaj u plan'; };
document.addEventListener('click', (e) => {
  const b = e.target.closest('.add'); if (!b) return;
  const k = b.getAttribute('data-k'), i = plan.indexOf(k);
  if (i >= 0) plan.splice(i, 1); else plan.push(k);
  savePlan();
  document.querySelectorAll('.add').forEach((a) => { if (a.getAttribute('data-k') === k) setAdd(a, plan.includes(k)); });
  $('pb').textContent = plan.length; $('pb').hidden = !plan.length;
  if (location.hash === '#plan') planView();
});
$('share').onclick = async () => {
  const txt = 'Moj put kroz Crnu Goru:\n' + plan.filter((k) => known[k]).map((k) => { const x = known[k]; return '- ' + (x.title || x.name) + ' (' + (x.place || x.city) + ')'; }).join('\n');
  try {
    if (navigator.share) { await navigator.share({ text: txt }); return; }
    await navigator.clipboard.writeText(txt); $('sh').textContent = 'Plan je kopiran.';
  } catch { $('sh').textContent = 'Kopiranje nije uspjelo.'; }
};

/* ---- polje „Gdje“ sa prijedlozima ---- */
function bindPlace(id, sid, onChange) {
  const inp = $(id), box = $(sid), clr = inp.closest('.fld').querySelector('.clr');
  let idx = -1;
  const hide = () => { box.hidden = true; idx = -1; inp.setAttribute('aria-expanded', 'false'); };
  const mark = () => [...box.children].forEach((b, i) => b.setAttribute('aria-selected', i === idx));
  const show = () => {
    const q = norm(inp.value.trim());
    const l = places.filter((p) => !q || norm(p).includes(q)).slice(0, 7);
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
    el.textContent = v ? nice(v) : 'Izaberi datum'; el.classList.toggle('e', !v);
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
    h += `<button type="button" class="${c.join(' ')}" data-d="${s}" aria-label="${d}. ${MONTHS[m]} ${y}." aria-pressed="${c.includes('sel')}"><span>${d}</span></button>`;
  }
  $('days').innerHTML = h;
  const e = !cal.f;
  $('sum').className = 'sum' + (e ? ' e' : '');
  $('sum').textContent = e ? 'Izaberi početni datum' : cal.t && cal.t !== cal.f ? nice(cal.f) + ' – ' + nice(cal.t) : nice(cal.f) + (cal.step === 't' ? ' · izaberi krajnji datum ili primijeni za jedan dan' : '');
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
function applyPhoto(u) { const h = $('hero'); h.style.backgroundImage = 'url(' + u + ')'; h.classList.add('has'); $('pbtn').setAttribute('aria-label', 'Promijeni fotografiju'); $('pbtn').title = 'Promijeni fotografiju'; }
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
const DAYN = ['Ned', 'Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub'];
const wxIcon = (c) => (c == null ? 'cloudsun' : c === 0 ? 'sun' : c <= 2 ? 'cloudsun' : c === 3 ? 'cloud' : c === 45 || c === 48 ? 'fog' : (c >= 71 && c <= 77) || c === 85 || c === 86 ? 'snow' : c >= 95 ? 'storm' : (c >= 51 && c <= 67) || (c >= 80 && c <= 82) ? 'rain' : 'cloud');
const wxText = { sun: 'Vedro', cloudsun: 'Djelimično oblačno', cloud: 'Oblačno', fog: 'Magla', snow: 'Snijeg', storm: 'Grmljavina', rain: 'Kiša' };
const climIcon = (wet) => (wet >= 50 ? 'rain' : wet >= 25 ? 'cloudsun' : 'sun');
const GROUPS = { g: 'Glavna jela', d: 'Piće', p: 'Prilozi', z: 'Ostalo' };
const euro = (n) => '€ ' + String(Math.round(n * 100) / 100).replace('.', ',');
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
let detailTok = 0, lbList = [], lbPos = 0, saved = { hash: '', y: 0 }, navs = 0;

function monthsLabel(ms) {
  const m = [...new Set(ms)].sort((a, b) => a - b);
  if (!m.length || m.length === 12) return 'Cijele godine';
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

function galleryHtml(title, kind, media) {
  if (!media.length) return `<div class="gal" data-c="${kind}"><div class="gempty">${ic(GLYPH[kind])}<span>Fotografije uskoro</span></div></div>`;
  lbList = [];
  const sl = media.map((m, i) => {
    if (m.type === 'image') {
      const zi = lbList.push(m) - 1;
      const cap = m.caption || m.credit ? `<div class="cap">${esc(m.caption)}${m.credit ? `<i>${esc(m.credit)}</i>` : ''}</div>` : '';
      return `<div class="sl"><img src="${esc(m.url)}" alt="${esc(m.caption || title)}" ${i ? 'loading="lazy"' : ''} decoding="async"><button type="button" class="zoom" data-z="${zi}" aria-label="Uvećaj fotografiju"></button>${cap}</div>`;
    }
    if (m.type === 'video') return `<div class="sl"><video src="${esc(m.url)}" controls playsinline preload="metadata"${m.poster ? ` poster="${esc(m.poster)}"` : ''}></video></div>`;
    return `<div class="sl"><button type="button" class="vp" data-yt="${esc(m.id)}" aria-label="Pokreni video${m.caption ? ': ' + esc(m.caption) : ''}"><img src="${esc(m.poster)}" alt="" loading="lazy"><span class="pl2">${ic('play')}</span></button></div>`;
  }).join('');
  return `<div class="gal" data-c="${kind}"><div class="gtrack" id="gtrack">${sl}</div>${media.length > 1 ? `<div class="gcount" id="gcount">1 / ${media.length}</div>` : ''}</div>`;
}

function infoRows(x, isI) {
  const r = [];
  const row = (g, label, html) => r.push(`<li>${ic(g)}<div><b>${label}</b>${html}</div></li>`);
  if (isI) {
    if (x.kind === 'event') row('cal', 'Datum', esc(span(x)));
    else row('cal', 'Sezona', esc(monthsLabel(x.months)));
    row('pin', 'Lokacija', esc([x.address, x.place, x.region].filter(Boolean).join(', ')));
    if (x.website) row('globe', 'Web stranica', `<a href="${esc(x.website)}" target="_blank" rel="noopener">${esc(host(x.website))}</a>`);
    row('shield', 'Pouzdanost podataka', esc(STATUS[x.status]) + (x.verifiedAt ? ', provjereno ' + esc(fmt(x.verifiedAt)) : '') + (x.sourceUrl ? ` (<a href="${esc(x.sourceUrl)}" target="_blank" rel="noopener">${esc(x.source || host(x.sourceUrl))}</a>)` : x.source ? ' (' + esc(x.source) + ')' : ''));
  } else {
    row('pin', 'Mjesto', esc(x.city));
    if (x.phone) row('phone', 'Telefon', `<a href="tel:${esc(x.phone.replace(/ /g, ''))}">${esc(x.phone)}</a>`);
    if (x.rating) row('star', 'Ocjena', `${esc(x.rating)} (${esc(x.reviews)} recenzija)`);
    row('fork', 'Račun po osobi', x.price ? euro(x.price.lo) + ' – ' + euro(x.price.hi) : 'Cijena uskoro');
    if (x.verifiedAt) row('shield', 'Cijene provjerene', esc(fmt(x.verifiedAt)));
  }
  return `<ul class="info">${r.join('')}</ul>`;
}

function menuHtml(menu) {
  if (!menu || !menu.length) return '';
  const by = {}; menu.forEach((m) => (by[m.kind] = by[m.kind] || []).push(m));
  const body = Object.keys(GROUPS).filter((k) => by[k]).map((k) => `<h3>${GROUPS[k]}</h3><ul class="menu">${by[k].map((m) => `<li><div>${esc(m.name)}${m.description ? `<small>${esc(m.description)}</small>` : ''}</div><b>${euro(m.price)}</b></li>`).join('')}</ul>`).join('');
  return `<section class="sec"><h2>Meni</h2><div class="box">${body}</div></section>`;
}

async function showDetail(key) {
  const tok = ++detailTok, box = $('dt');
  const back = '<button type="button" class="btn s" data-back style="margin-top:12px">Nazad</button>';
  if (!/^[ir]:[a-z0-9-]{1,60}$/.test(key)) { box.innerHTML = `<div class="wrap top">${emptyBox('search', 'Stavka nije pronađena', 'Link možda više ne važi.', back)}</div>`; return; }
  const isI = key[0] === 'i';
  box.innerHTML = '<div class="wrap top" style="display:grid;gap:14px"><div class="skb" style="height:240px"></div><div class="skb" style="width:70%;height:32px"></div><div class="skb"></div><div class="skb" style="width:85%"></div></div>';
  let d;
  try { d = await api((isI ? '/items/' : '/restaurants/') + key.slice(2)); }
  catch (err) { if (tok === detailTok) box.innerHTML = `<div class="wrap top">${err.status === 404 ? emptyBox('search', 'Stavka nije pronađena', 'Možda je uklonjena ili link više ne važi.', back) : emptyBox('alert', 'Detalji nisu učitani', 'Provjeri internet vezu i pokušaj ponovo.', back)}</div>`; return; }
  if (tok !== detailTok) return;
  const x = isI ? d.item : d, kind = isI ? x.kind : 'food', title = isI ? x.title : x.name, place = isI ? x.place : x.city;
  known[key] = x; document.title = title + ' | Montepalm';
  const pills = [];
  if (isI && x.status !== 'potvrdjeno') pills.push(`<span class="pill">${esc(STATUS[x.status])}</span>`);
  if (isI && x.demo) pills.push('<span class="pill demo">Primjer</span>');
  const text = isI ? [x.description, x.details].filter(Boolean).join('\n\n') : x.ambience;
  const tags = isI ? [] : [...(x.tags || []), ...(x.amenities || [])];
  const dest = x.lat != null && x.lng != null ? `${x.lat},${x.lng}` : '';
  const maps = 'https://www.google.com/maps/' + (dest ? 'dir/?api=1&destination=' + dest : 'search/?api=1&query=' + encodeURIComponent(title + ' ' + place));
  const inp = plan.includes(key);
  box.innerHTML = `<div data-c="${kind}">
    <button type="button" class="dback l" data-back aria-label="Nazad">${ic('left')}</button>
    <button type="button" class="dback r" data-share aria-label="Podijeli">${ic('share')}</button>
    ${galleryHtml(title, kind, d.media || [])}
    <div class="wrap">
      <div class="dh"><div class="row"><span class="bd">${ic(GLYPH[kind])}</span><div class="cm"><div class="kd">${KIND[kind]}</div><div class="pl">${ic('pin')}<span>${esc(place)}</span></div></div>${pills.join('')}</div><h1>${esc(title)}</h1></div>
      <div class="acts2"><button type="button" class="btn s add" aria-pressed="${inp}" data-k="${esc(key)}">${inp ? ic('check') + 'U planu' : ic('plus') + 'Dodaj u plan'}</button><a class="btn s" href="${esc(maps)}" target="_blank" rel="noopener">${ic('nav')}Mapa</a></div>
      <section class="sec"><h2>Vremenska prognoza</h2><p class="sub" id="wsub"></p><div id="wbody"><div class="skb" style="height:132px"></div></div></section>
      ${text ? `<section class="sec"><h2>O ${isI ? (kind === 'event' ? 'događaju' : 'lokaciji') : 'restoranu'}</h2><div class="box"><p class="prose">${esc(text)}</p></div></section>` : ''}
      ${!isI && x.why && x.why.length ? `<section class="sec"><h2>Zašto ovdje</h2><div class="box"><ul class="why">${x.why.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div></section>` : ''}
      ${tags.length ? `<section class="sec"><div class="tags">${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div></section>` : ''}
      ${isI ? '' : menuHtml(x.menu)}
      <section class="sec"><h2>Informacije</h2><div class="box">${infoRows(x, isI)}</div></section>
    </div></div>`;
  const tr = $('gtrack');
  if (tr && $('gcount')) tr.addEventListener('scroll', () => { $('gcount').textContent = Math.round(tr.scrollLeft / tr.clientWidth) + 1 + ' / ' + tr.children.length; }, { passive: true });
  loadWeather(key, x, tok);
}

async function loadWeather(key, x, tok) {
  const per = weatherPeriod(x), qs = new URLSearchParams({ ref: key });
  if (per) { qs.set('from', per.f); qs.set('to', per.t); }
  let w;
  try { w = await api('/weather?' + qs); }
  catch { if (tok === detailTok && $('wbody')) { $('wsub').textContent = ''; $('wbody').innerHTML = '<p class="m" style="margin:0 0 8px">Prognoza trenutno nije dostupna.</p><button type="button" class="btn s" data-retry>Pokušaj ponovo</button>'; } return; }
  if (tok !== detailTok || !$('wbody')) return;
  if (!w.available) { $('wbody').closest('.sec').remove(); return; }
  const attr = '<p class="note">Podaci: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a></p>';
  if (w.mode === 'monthly') {
    $('wsub').textContent = `${w.place}, ${rangeText(w.from, w.to)}`;
    $('wbody').innerHTML = `<div class="box mrows">${w.months.map((m) => `<div class="mrow"><b>${MONTHS[+m.month.slice(5) - 1]}</b><span><b>${m.tmax}°</b> <span class="m2">/ ${m.tmin}°</span></span><span class="m2">${m.wetDays ? '~' + m.wetDays + ' kišnih dana' : 'bez kiše'}</span></div>`).join('')}</div><p class="note">Prosjek istih datuma iz prethodne tri godine. Stvarna prognoza je dostupna 16 dana unaprijed.</p>${attr}`;
    return;
  }
  $('wsub').textContent = per ? `${w.place}, ${rangeText(w.from, w.to)}` : `Narednih 7 dana, ${w.place}. Izaberi period da vidiš prognozu za svoj termin.`;
  const est = w.days.some((d) => d.src === 'climate');
  $('wbody').innerHTML = `<div class="wxr">${w.days.map((dd) => {
    const dt = parse(dd.date), cl = dd.src === 'climate', g = cl ? climIcon(dd.wet) : wxIcon(dd.code), pr = cl ? dd.wet : dd.prob;
    return `<div class="wx${cl ? ' cl' : ''}" role="group" aria-label="${DAYN[dt.getDay()]} ${nice(dd.date)}, ${cl ? 'procjena, ' : ''}${dd.tmax} stepeni, ${wxText[g]}"><span class="dn">${DAYN[dt.getDay()]}</span><span class="dd">${dt.getDate()}. ${MS[dt.getMonth()]}</span>${ic(g)}<span class="tp">${cl ? '~' : ''}${dd.tmax}° <span>${dd.tmin}°</span></span>${pr != null ? `<span class="rn">${ic('drop')}${pr}%</span>` : ''}</div>`;
  }).join('')}</div>${est ? '<p class="note">Dani sa isprekidanom ivicom su procjena na osnovu prethodnih godina. Stvarna prognoza je dostupna 16 dana unaprijed.</p>' : ''}${attr}`;
}

/* lightbox */
function lbShow(i) {
  lbPos = (i + lbList.length) % lbList.length;
  const m = lbList[lbPos];
  $('lbi').src = m.url; $('lbi').alt = m.caption || '';
  $('lbc').innerHTML = `${lbPos + 1} / ${lbList.length}${m.caption ? '<br>' + esc(m.caption) : ''}${m.credit ? '<br><small>' + esc(m.credit) + '</small>' : ''}`;
  $('lbp').hidden = $('lbn').hidden = lbList.length < 2;
}
const lbOpen = (i) => { lbShow(i); $('lb').hidden = false; document.body.classList.add('lock'); $('lbx').focus(); };
const lbClose = () => { $('lb').hidden = true; $('lbi').src = ''; document.body.classList.remove('lock'); };
$('lbx').onclick = lbClose; $('lbp').onclick = () => lbShow(lbPos - 1); $('lbn').onclick = () => lbShow(lbPos + 1);
let tx = 0;
$('lb').addEventListener('touchstart', (e) => { tx = e.touches[0].clientX; }, { passive: true });
$('lb').addEventListener('touchend', (e) => { const dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 50 && lbList.length > 1) lbShow(lbPos + (dx < 0 ? 1 : -1)); }, { passive: true });
document.addEventListener('keydown', (e) => {
  if ($('lb').hidden) return;
  if (e.key === 'Escape') lbClose(); else if (e.key === 'ArrowLeft') lbShow(lbPos - 1); else if (e.key === 'ArrowRight') lbShow(lbPos + 1);
});

$('dt').addEventListener('click', async (e) => {
  const t = e.target;
  if (t.closest('[data-back]')) { if (navs > 0) history.back(); else location.hash = '#istrazi'; return; }
  const z = t.closest('[data-z]'); if (z) { lbOpen(+z.getAttribute('data-z')); return; }
  const yt = t.closest('[data-yt]');
  if (yt) { yt.parentNode.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${esc(yt.getAttribute('data-yt'))}?autoplay=1&rel=0&playsinline=1" title="Video" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`; return; }
  if (t.closest('[data-retry]')) { const k = decodeURIComponent(location.hash.slice(3)); $('wbody').innerHTML = '<div class="skb" style="height:132px"></div>'; if (known[k]) loadWeather(k, known[k], detailTok); return; }
  if (t.closest('[data-share]')) {
    const k = decodeURIComponent(location.hash.slice(3)), x = known[k] || {}, data = { title: x.title || x.name || 'Montepalm', url: location.href };
    try { if (navigator.share) await navigator.share(data); else await navigator.clipboard.writeText(location.href); } catch { /* otkazano */ }
  }
});
document.addEventListener('click', (e) => { if (e.target.closest('.lk, a.ev')) saved = { hash: location.hash || '#pocetna', y: window.scrollY }; });

/* ---- navigacija ---- */
function setCat(k) { cat = k; [...$('chips').children].forEach((c) => c.setAttribute('aria-pressed', c.getAttribute('data-cat') === k)); search(); }
$('tiles').innerHTML = Object.keys(CATS).map((k) => `<button class="tile" type="button" data-c="${k}" data-cat="${k}"><span class="bd">${ic(GLYPH[k])}</span>${CATS[k]}</button>`).join('');
['all', ...Object.keys(CATS)].forEach((k) => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = k === 'all' ? 'Sve' : CATS[k];
  b.setAttribute('data-cat', k); b.setAttribute('aria-pressed', k === 'all'); b.onclick = () => setCat(k); $('chips').appendChild(b);
});
$('tiles').onclick = (e) => { const b = e.target.closest('.tile'); if (!b) return; setCat(b.getAttribute('data-cat')); location.hash = '#istrazi'; };
$('allev').onclick = () => { setCat('event'); location.hash = '#istrazi'; };
$('sf').addEventListener('submit', (e) => e.preventDefault());
$('hgo').onclick = () => { $('p').value = $('hp').value; D.x = { ...D.h }; showDates(); search(); location.hash = '#istrazi'; };
$('hp').addEventListener('keydown', (e) => { if (e.key === 'Enter' && $('hs').hidden) $('hgo').click(); });

const VIEWS = ['pocetna', 'istrazi', 'plan', 'detalj'];
function route() {
  const raw = (location.hash || '#pocetna').slice(1);
  let h = raw, dkey = '';
  if (raw.startsWith('d/')) { h = 'detalj'; dkey = decodeURIComponent(raw.slice(2)); }
  else if (!VIEWS.includes(h) || h === 'detalj') h = 'pocetna';
  if (!$('lb').hidden) lbClose();
  VIEWS.forEach((v) => { $('v-' + v).className = 'view' + (v === h ? ' on' : ''); });
  const tab = h === 'detalj' ? 'istrazi' : h;
  document.querySelectorAll('.tabs a').forEach((a) => (a.getAttribute('href') === '#' + tab ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  if (h !== 'detalj') document.title = 'Montepalm: šta ima u Crnoj Gori';
  const back = saved.hash === '#' + h ? saved.y : null;
  if (back !== null) saved = { hash: '', y: 0 };
  let done = Promise.resolve();
  if (h === 'istrazi') { $('p').closest('.fld').querySelector('.clr').hidden = !$('p').value; done = search(); }
  if (h === 'plan') planView();
  if (h === 'detalj') showDetail(dkey);
  window.scrollTo(0, 0);
  if (back !== null) done.then(() => window.scrollTo(0, back));
}
window.addEventListener('hashchange', () => { navs++; route(); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
showDates();
loadAll().then(route);
