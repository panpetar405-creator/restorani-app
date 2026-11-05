'use strict';
const $ = (i) => document.getElementById(i);
const CATS = { event: 'Događaji', beach: 'Plaže', food: 'Gastronomija', culture: 'Kultura' };
const ICON = { event: '🎭', beach: '🏖️', food: '🍽️', culture: '🏛️' };
const STATUS = { potvrdjeno: 'Potvrđeno', okvirno: 'Okvirno', provjeriti: 'Provjeriti' };
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (t) => String(t).toLowerCase().replace(/đ/g, 'd').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const fmt = (s) => { const a = String(s).slice(0, 10).split('-'); return `${+a[2]}. ${+a[1]}. ${a[0]}.`; };
const span = (x) => fmt(x.from) + (x.to && x.to !== x.from ? ' – ' + fmt(x.to) : '');
const today = new Date().toISOString().slice(0, 10);
const api = async (p) => { const r = await fetch('/api' + p); if (!r.ok) throw new Error('api'); return r.json(); };

let all = [], rests = [], shown = [], cat = 'all', plan = [], known = {};
try { plan = JSON.parse(localStorage.getItem('mp.plan') || '[]'); } catch { plan = []; }
const savePlan = () => { try { localStorage.setItem('mp.plan', JSON.stringify(plan)); } catch { /* ignore */ } };

/* ---- kartice ---- */
function itemCard(x) {
  const key = 'i:' + x.slug; known[key] = x;
  const meta = [];
  if (x.kind === 'event') meta.push(`<span class="when">${esc(span(x))}</span>`);
  if (x.offSeason) meta.push('<span class="warn">Van sezone u tom periodu</span>');
  if (x.status !== 'potvrdjeno') meta.push(`<span class="dm">${esc(STATUS[x.status])}</span>`);
  if (x.demo) meta.push('<span class="dm">Primjer</span>');
  if (x.verifiedAt) meta.push(`<span>Provjereno ${esc(fmt(x.verifiedAt))}</span>`);
  return card(key, x.kind, x.title, x.place, x.description, meta, x.offSeason);
}
function restCard(r) {
  const key = 'r:' + r.slug; known[key] = r;
  const meta = [];
  if (r.rating) meta.push(`<span class="star">★ ${esc(r.rating)} (${esc(r.reviews)})</span>`);
  meta.push(`<span>${r.price ? esc(r.price.lo) + ' – ' + esc(r.price.hi) + ' € po osobi' : 'Cijena uskoro'}</span>`);
  if (r.verifiedAt) meta.push(`<span>Provjereno ${esc(fmt(r.verifiedAt))}</span>`);
  return card(key, 'food', r.name, r.city, r.tags.join(', ') || r.ambience, meta, false);
}
function card(key, kind, title, place, desc, meta, off) {
  const inp = plan.includes(key);
  return `<div class="item${off ? ' off' : ''}"><div class="thumb ${kind}" aria-hidden="true">${ICON[kind]}</div><div><div class="t">${esc(title)}</div><div class="pl">${esc(place)}</div><p class="d">${esc(desc)}</p><div class="meta">${meta.join('')}</div></div><button type="button" class="add" aria-pressed="${inp}" data-k="${esc(key)}">${inp ? 'U planu' : '+ Dodaj u plan'}</button></div>`;
}

/* ---- podaci ---- */
async function loadAll() {
  try {
    const [a, b] = await Promise.all([api('/items'), api('/restaurants?limit=100')]);
    all = a.items; rests = b.restaurants;
  } catch { all = []; rests = []; $('rail').innerHTML = '<div class="empty">Ne mogu učitati podatke. Provjeri vezu.</div>'; }
  const places = [...new Set([...all.map((x) => x.place), ...rests.map((r) => r.city)])].sort();
  $('pl').innerHTML = places.map((p) => `<option value="${esc(p)}">`).join('');
  const up = all.filter((x) => x.kind === 'event' && (x.to || x.from) >= today).sort((a, b) => (a.from < b.from ? -1 : 1)).slice(0, 6);
  $('rail').innerHTML = up.length ? up.map((x) => `<div class="ev"><span class="when">${esc(span(x))}</span><b>${esc(x.title)}</b><span class="m">${esc(x.place)}</span></div>`).join('') : '<div class="empty">Trenutno nema nadolazećih događaja.</div>';
  planView();
}
let timer;
const later = () => { clearTimeout(timer); timer = setTimeout(search, 250); };
async function search() {
  const place = $('p').value.trim(), f = $('f').value, t = $('t').value;
  const qs = new URLSearchParams();
  if (place) qs.set('place', place); if (f) qs.set('from', f); if (t) qs.set('to', t);
  if (cat !== 'all' && cat !== 'food') qs.set('kind', cat);
  let items = [];
  if (cat !== 'food') { try { items = (await api('/items?' + qs)).items; } catch { $('out').innerHTML = '<div class="empty">Ne mogu učitati podatke. Provjeri vezu.</div>'; return; } }
  const q = norm(place);
  const rs = cat === 'all' || cat === 'food' ? rests.filter((r) => !q || norm(r.city).includes(q)) : [];
  const list = items.sort((a, b) => (a.offSeason - b.offSeason)).map(itemCard).concat(rs.map(restCard));
  $('count').textContent = list.length ? 'Pronađeno: ' + list.length : '';
  $('out').innerHTML = list.length ? list.join('') : '<div class="empty">Ništa nije pronađeno. Probaj šire datume ili ukloni mjesto.</div>';
}

/* ---- plan ---- */
function planView() {
  const l = plan.filter((k) => known[k]);
  $('pout').innerHTML = l.length ? l.map((k) => (k[0] === 'i' ? itemCard(known[k]) : restCard(known[k]))).join('') : '<div class="empty">Plan je prazan. Dodaj lokacije u dijelu Istraži.</div>';
  $('share').style.display = l.length ? 'block' : 'none';
  $('pb').textContent = plan.length ? '(' + plan.length + ')' : '';
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

/* ---- fotografija u heroju ---- */
function applyPhoto(u) { const h = $('hero'); h.style.backgroundImage = 'url(' + u + ')'; h.classList.add('has'); $('pbtn').textContent = 'Promijeni fotografiju'; }
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
$('tiles').innerHTML = Object.keys(CATS).map((k) => `<button class="tile" type="button" data-cat="${k}"><span>${ICON[k]}</span>${CATS[k]}</button>`).join('');
['all', ...Object.keys(CATS)].forEach((k) => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = k === 'all' ? 'Sve' : CATS[k];
  b.setAttribute('data-cat', k); b.setAttribute('aria-pressed', k === 'all'); b.onclick = () => setCat(k); $('chips').appendChild(b);
});
['p', 'f', 't'].forEach((i) => $(i).addEventListener('input', later));
$('tiles').onclick = (e) => { const b = e.target.closest('.tile'); if (!b) return; setCat(b.getAttribute('data-cat')); location.hash = '#istrazi'; };
$('sf').addEventListener('submit', (e) => e.preventDefault());
$('hgo').onclick = () => { $('p').value = $('hp').value; $('f').value = $('hf').value; $('t').value = $('ht').value; search(); location.hash = '#istrazi'; };

const VIEWS = ['pocetna', 'istrazi', 'plan'];
function route() {
  let h = (location.hash || '#pocetna').slice(1); if (!VIEWS.includes(h)) h = 'pocetna';
  VIEWS.forEach((v) => { $('v-' + v).className = 'view' + (v === h ? ' on' : ''); });
  document.querySelectorAll('.tabs a').forEach((a) => (a.getAttribute('href') === '#' + h ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  if (h === 'istrazi') search();
  if (h === 'plan') planView();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
loadAll().then(route);
