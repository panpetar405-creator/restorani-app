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
const api = async (p) => { const r = await fetch('/api' + p); if (!r.ok) throw new Error('api'); return r.json(); };

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
  return `<article class="card${off ? ' off' : ''}" data-c="${kind}"><div class="ch"><span class="bd">${ic(GLYPH[kind])}</span><div class="cm"><div class="kd">${KIND[kind]}</div><div class="pl">${ic('pin')}<span>${esc(place)}</span></div></div>${pills.join('')}</div><h3 class="t">${esc(title)}</h3>${desc ? `<p class="d">${esc(desc)}</p>` : ''}<ul class="meta">${meta.join('')}</ul><button type="button" class="btn s add" aria-pressed="${inp}" data-k="${esc(key)}">${inp ? ic('check') + 'U planu' : ic('plus') + 'Dodaj u plan'}</button></article>`;
}
const emptyBox = (g, title, text, extra = '') => `<div class="empty"><span class="bd">${ic(g)}</span><b>${title}</b><p>${text}</p>${extra}</div>`;
function railCard(x) {
  known['i:' + x.slug] = x;
  const d = parse(x.from);
  return `<button type="button" class="ev" data-s="${esc(x.slug)}"><span class="dt"><b>${d.getDate()}</b><span>${MS[d.getMonth()]}</span></span><span class="tx"><span class="tt">${esc(x.title)}</span><span class="pl">${ic('pin')}<span>${esc(x.place)}</span></span><span class="rng">${esc(span(x))}</span></span></button>`;
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
document.addEventListener('click', (e) => {
  const b = e.target.closest('.add'); if (!b) return;
  const k = b.getAttribute('data-k'), i = plan.indexOf(k);
  if (i >= 0) plan.splice(i, 1); else plan.push(k);
  savePlan(); planView();
  if (location.hash === '#istrazi') search();
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

/* ---- navigacija ---- */
function setCat(k) { cat = k; [...$('chips').children].forEach((c) => c.setAttribute('aria-pressed', c.getAttribute('data-cat') === k)); search(); }
$('tiles').innerHTML = Object.keys(CATS).map((k) => `<button class="tile" type="button" data-c="${k}" data-cat="${k}"><span class="bd">${ic(GLYPH[k])}</span>${CATS[k]}</button>`).join('');
['all', ...Object.keys(CATS)].forEach((k) => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = k === 'all' ? 'Sve' : CATS[k];
  b.setAttribute('data-cat', k); b.setAttribute('aria-pressed', k === 'all'); b.onclick = () => setCat(k); $('chips').appendChild(b);
});
$('tiles').onclick = (e) => { const b = e.target.closest('.tile'); if (!b) return; setCat(b.getAttribute('data-cat')); location.hash = '#istrazi'; };
$('allev').onclick = () => { setCat('event'); location.hash = '#istrazi'; };
$('rail').onclick = (e) => {
  const b = e.target.closest('.ev'); if (!b) return;
  const x = known['i:' + b.getAttribute('data-s')]; if (!x) return;
  $('p').value = x.place; D.x = { f: x.from, t: x.to || x.from }; showDates(); setCat('event'); location.hash = '#istrazi';
};
$('sf').addEventListener('submit', (e) => e.preventDefault());
$('hgo').onclick = () => { $('p').value = $('hp').value; D.x = { ...D.h }; showDates(); search(); location.hash = '#istrazi'; };
$('hp').addEventListener('keydown', (e) => { if (e.key === 'Enter' && $('hs').hidden) $('hgo').click(); });

const VIEWS = ['pocetna', 'istrazi', 'plan'];
function route() {
  let h = (location.hash || '#pocetna').slice(1); if (!VIEWS.includes(h)) h = 'pocetna';
  VIEWS.forEach((v) => { $('v-' + v).className = 'view' + (v === h ? ' on' : ''); });
  document.querySelectorAll('.tabs a').forEach((a) => (a.getAttribute('href') === '#' + h ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  if (h === 'istrazi') { $('p').closest('.fld').querySelector('.clr').hidden = !$('p').value; search(); }
  if (h === 'plan') planView();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
showDates();
loadAll().then(route);
