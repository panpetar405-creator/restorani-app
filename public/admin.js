'use strict';
const $app = document.getElementById('app'), $toast = document.getElementById('toast');
const MS = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'];
const KIND = { event: 'Događaj', beach: 'Plaža', culture: 'Kultura', food: 'Gastronomija' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let KEY = ''; try { KEY = sessionStorage.getItem('mp.admin') || ''; } catch { /* ignore */ }
let cur = null, months = [], busy = false;

function toast(msg, bad) {
  $toast.textContent = msg; $toast.className = 'toast' + (bad ? ' bad' : ''); $toast.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { $toast.hidden = true; }, bad ? 5000 : 2200);
}
async function api(method, path, body) {
  const init = { method, headers: { authorization: 'Bearer ' + KEY } };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) { init.headers['content-type'] = 'application/json'; init.body = JSON.stringify(body); }
  let r;
  try { r = await fetch('/api/admin' + path, init); } catch { throw new Error('Nema internet veze'); }
  if (r.status === 401) { logout(true); throw new Error('Neispravan ključ'); }
  if (r.status === 204) return null;
  let d = {}; try { d = await r.json(); } catch { /* ignore */ }
  if (!r.ok) throw new Error(d.error || 'Greška ' + r.status);
  return d;
}
function logout(silent) {
  KEY = ''; try { sessionStorage.removeItem('mp.admin'); } catch { /* ignore */ }
  if (!silent) toast('Odjavljen');
  location.hash = ''; viewLogin();
}

/* ---------- prijava ---------- */
function viewLogin(err) {
  $app.innerHTML = `<div class="login"><h1>Montepalm admin</h1><p>Unesi tajni ključ za izmjenu sadržaja.</p>
  <form id="lf"><div class="afld"><label for="k">Ključ</label><input id="k" type="password" autocomplete="current-password" required></div>
  ${err ? `<p style="color:#c0392b;font-weight:600">${esc(err)}</p>` : ''}
  <button class="btn p full" type="submit">Prijavi se</button></form></div>`;
  document.getElementById('lf').onsubmit = async (e) => {
    e.preventDefault(); KEY = document.getElementById('k').value.trim();
    try { const p = await api('GET', '/ping'); try { sessionStorage.setItem('mp.admin', KEY); } catch { /* ignore */ } if (!p.r2) setTimeout(() => toast('R2 skladište nije povezano: upload neće raditi', true), 400); route(); }
    catch (er) { viewLogin(er.message); }
  };
}

/* ---------- lista ---------- */
async function viewList() {
  $app.innerHTML = '<div class="atop"><div class="in"><h1>Sadržaj</h1><button class="ghost" id="lo">Odjava</button></div></div><div class="wrap"><div class="skb" style="height:60px;margin-top:16px"></div></div>';
  document.getElementById('lo').onclick = () => logout();
  let d; try { d = await api('GET', '/list'); } catch (e) { if (KEY) toast(e.message, true); return; }
  const all = [...d.items, ...d.restaurants];
  const draw = (q) => {
    const n = q.toLowerCase();
    const rows = all.filter((x) => !n || (x.title + ' ' + x.place).toLowerCase().includes(n));
    const groups = ['event', 'beach', 'culture', 'food'];
    return groups.map((g) => { const r = rows.filter((x) => x.kind === g); return r.length ? `<div class="agrp">${KIND[g]}</div><div class="alist">${r.map((x) => `<button class="arow${x.active ? '' : ' off'}" data-r="${esc(x.ref)}"><div class="t"><b>${esc(x.title)}</b><span>${esc(x.place)}</span></div>${x.active ? '' : '<span class="hid">Skriveno</span>'}</button>`).join('')}</div>` : ''; }).join('') || '<p class="m">Nema rezultata.</p>';
  };
  $app.innerHTML = `<div class="atop"><div class="in"><h1>Sadržaj</h1><button class="ghost" id="lo">Odjava</button></div></div>
  <div class="wrap" style="padding-top:14px"><div class="afld"><input type="search" id="q" placeholder="Traži po nazivu ili mjestu" aria-label="Traži"></div>
  <button class="btn p full" id="nw">+ Novi događaj ili lokacija</button><div id="rows">${draw('')}</div></div>`;
  document.getElementById('lo').onclick = () => logout();
  document.getElementById('nw').onclick = () => { location.hash = '#/new'; };
  document.getElementById('q').oninput = (e) => { document.getElementById('rows').innerHTML = draw(e.target.value); };
  document.getElementById('rows').onclick = (e) => { const b = e.target.closest('[data-r]'); if (b) location.hash = '#/e/' + b.getAttribute('data-r'); };
}

/* ---------- forma ---------- */
const fld = (id, label, val, o = {}) => `<div class="afld"><label for="${id}">${label}${o.max ? `<span class="cnt2" data-cnt="${id}"></span>` : ''}</label>${o.area ? `<textarea id="${id}" ${o.max ? `maxlength="${o.max}"` : ''} ${o.rows ? `rows="${o.rows}"` : ''}>${esc(val)}</textarea>` : `<input id="${id}" type="${o.type || 'text'}" value="${esc(val)}" ${o.max ? `maxlength="${o.max}"` : ''} ${o.step ? `step="${o.step}"` : ''} ${o.inputmode ? `inputmode="${o.inputmode}"` : ''}>`}${o.hint ? `<small>${o.hint}</small>` : ''}</div>`;
const v = (id) => { const e = document.getElementById(id); return e ? e.value : ''; };

function formItem(x, isNew) {
  const ev = x.kind === 'event';
  return `${fld('f-title', 'Naziv', x.title, { max: 120 })}
  <div class="afld"><label for="f-kind">Vrsta</label><select id="f-kind"><option value="event">Događaj</option><option value="beach">Plaža</option><option value="culture">Kultura</option></select></div>
  <div class="two">${fld('f-place', 'Mjesto', x.place, { max: 80 })}${fld('f-region', 'Region', x.region, { max: 60 })}</div>
  ${fld('f-desc', 'Kratak opis (vidi se na kartici)', x.description, { area: 1, max: 500, rows: 3 })}
  ${fld('f-details', 'Duži opis (vidi se na stranici)', x.details, { area: 1, max: 4000, rows: 8, hint: 'Prazan red pravi novi pasus.' })}
  <div id="f-when">${ev ? `<div class="two">${fld('f-from', 'Početak', x.date_from || '', { type: 'date' })}${fld('f-to', 'Kraj (nije obavezno)', x.date_to || '', { type: 'date' })}</div>` : `<div class="afld"><span class="lb2">Mjeseci sezone</span><div class="mchips" id="f-months">${MS.map((m, i) => `<button type="button" data-m="${i + 1}" aria-pressed="${months.includes(i + 1)}">${m}</button>`).join('')}</div></div>`}</div>
  ${fld('f-addr', 'Adresa', x.address, { max: 120 })}
  ${fld('f-web', 'Web stranica', x.website, { type: 'url', max: 300, hint: 'Počinje sa https://' })}
  <div class="two">${fld('f-lat', 'Širina (lat)', x.lat ?? '', { type: 'number', step: 'any', inputmode: 'decimal' })}${fld('f-lng', 'Dužina (lng)', x.lng ?? '', { type: 'number', step: 'any', inputmode: 'decimal' })}</div>
  <div class="afld"><label for="f-status">Pouzdanost podataka</label><select id="f-status"><option value="potvrdjeno">Potvrđeno</option><option value="okvirno">Okvirno</option><option value="provjeriti">Provjeriti</option></select></div>
  <div class="two">${fld('f-src', 'Izvor', x.source, { max: 120 })}${fld('f-srcu', 'Link izvora', x.source_url, { type: 'url', max: 300 })}</div>
  <label class="chk"><input type="checkbox" id="f-ver"> Provjereno danas${x.verified_at ? ` <small style="font-weight:400;color:var(--mute)">(posljednje: ${esc(x.verified_at)})</small>` : ''}</label>
  <label class="chk"><input type="checkbox" id="f-demo"> Primjer (prikazuje oznaku „Primjer")</label>
  <label class="chk"><input type="checkbox" id="f-act"> Vidljivo u aplikaciji</label>`;
}
function formRest(x) {
  return `${fld('f-name', 'Naziv', x.name, { max: 80 })}
  <div class="two">${fld('f-city', 'Mjesto', x.city, { max: 60 })}${fld('f-phone', 'Telefon', x.phone, { max: 30 })}</div>
  ${fld('f-amb', 'Opis', x.ambience, { area: 1, max: 600, rows: 5 })}
  ${fld('f-why', 'Zašto ovdje (svaka stavka u novom redu)', (x.why || []).join('\n'), { area: 1, rows: 4 })}
  ${fld('f-tags', 'Oznake (odvojene zarezom)', (x.tags || []).join(', '))}
  ${fld('f-am', 'Sadržaji (odvojeni zarezom)', (x.amenities || []).join(', '))}
  <div class="two">${fld('f-lat', 'Širina (lat)', x.lat ?? '', { type: 'number', step: 'any', inputmode: 'decimal' })}${fld('f-lng', 'Dužina (lng)', x.lng ?? '', { type: 'number', step: 'any', inputmode: 'decimal' })}</div>
  <label class="chk"><input type="checkbox" id="f-act"> Vidljivo u aplikaciji</label>
  <p class="m" style="font-size:.85rem">Cijene i meni mijenja vlasnik restorana preko svog ključa.</p>`;
}

const blank = { type: 'item', kind: 'event', title: '', place: '', region: '', description: '', details: '', address: '', website: '', date_from: '', date_to: '', months: [], status: 'okvirno', source: '', source_url: '', lat: null, lng: null, demo: false, active: true, media: [] };

async function viewEdit(ref) {
  const isNew = ref === 'new';
  $app.innerHTML = '<div class="atop"><div class="in"><button class="ghost" id="bk">‹ Nazad</button></div></div><div class="wrap"><div class="skb" style="height:200px;margin-top:16px"></div></div>';
  document.getElementById('bk').onclick = () => { location.hash = '#/'; };
  try { cur = isNew ? { ...blank, ref: '' } : await api('GET', '/entry/' + encodeURIComponent(ref)); } catch (e) { if (KEY) { toast(e.message, true); location.hash = '#/'; } return; }
  months = [...(cur.months || [])];
  render();
}

function render() {
  const x = cur, isR = x.type === 'restaurant', isNew = !x.ref;
  const title = isR ? x.name : x.title;
  $app.innerHTML = `<div class="atop"><div class="in"><button class="ghost" id="bk">‹ Nazad</button><h1>${isNew ? 'Nova stavka' : esc(title)}</h1>${isNew ? '' : `<a class="ghost" href="/#d/${esc(x.ref)}" target="_blank" rel="noopener">Pogledaj</a>`}</div></div>
  <div class="wrap" style="padding-top:16px"><form id="ef" novalidate>${isR ? formRest(x) : formItem(x, isNew)}</form>
  ${isNew ? '<p class="m">Slike i video možeš dodati nakon prvog snimanja.</p>' : mediaSection()}</div>
  <div class="savebar"><div class="in"><button class="btn p" id="sv" type="button">${isNew ? 'Napravi' : 'Sačuvaj izmjene'}</button></div></div>`;
  document.getElementById('bk').onclick = () => { location.hash = '#/'; };
  if (!isR) {
    document.getElementById('f-kind').value = x.kind; document.getElementById('f-status').value = x.status;
    document.getElementById('f-ver').checked = false; document.getElementById('f-demo').checked = !!x.demo;
    document.getElementById('f-kind').onchange = (e) => { cur = { ...collect(), kind: e.target.value }; render(); };
    const mc = document.getElementById('f-months');
    if (mc) mc.onclick = (e) => { const b = e.target.closest('[data-m]'); if (!b) return; const n = +b.getAttribute('data-m'); months = months.includes(n) ? months.filter((m) => m !== n) : [...months, n]; b.setAttribute('aria-pressed', months.includes(n)); };
  }
  document.getElementById('f-act').checked = x.active !== false;
  document.querySelectorAll('[data-cnt]').forEach((c) => { const el = document.getElementById(c.getAttribute('data-cnt')); const u = () => { c.textContent = el.value.length + '/' + el.maxLength; }; el.addEventListener('input', u); u(); });
  document.getElementById('sv').onclick = save;
  if (!isNew) bindMedia();
}

function collect() {
  const x = cur;
  if (x.type === 'restaurant') {
    const sp = (s, re) => s.split(re).map((t) => t.trim()).filter(Boolean);
    return { ...x, name: v('f-name'), city: v('f-city'), phone: v('f-phone'), ambience: v('f-amb'), why: sp(v('f-why'), /\n/), tags: sp(v('f-tags'), ','), amenities: sp(v('f-am'), ','), lat: v('f-lat'), lng: v('f-lng'), active: document.getElementById('f-act').checked };
  }
  const kind = v('f-kind');
  return { ...x, kind, title: v('f-title'), place: v('f-place'), region: v('f-region'), description: v('f-desc'), details: v('f-details'), date_from: v('f-from') || null, date_to: v('f-to') || null, months: [...months], address: v('f-addr'), website: v('f-web'), lat: v('f-lat'), lng: v('f-lng'), status: v('f-status'), source: v('f-src'), source_url: v('f-srcu'), verified: document.getElementById('f-ver').checked, demo: document.getElementById('f-demo').checked, active: document.getElementById('f-act').checked };
}

async function save() {
  if (busy) return; busy = true;
  const b = document.getElementById('sv'); b.disabled = true; b.textContent = 'Snimam…';
  try {
    const { media: _m, ...body } = collect();
    const isNew = !cur.ref;
    const d = isNew ? await api('POST', '/items', body) : await api('PUT', '/entry/' + encodeURIComponent(cur.ref), body);
    cur = d; months = [...(d.months || [])]; toast(isNew ? 'Napravljeno' : 'Sačuvano');
    if (isNew) { location.hash = '#/e/' + d.ref; return; }
    render();
  } catch (e) { toast(e.message, true); b.disabled = false; b.textContent = cur.ref ? 'Sačuvaj izmjene' : 'Napravi'; }
  busy = false;
}

/* ---------- mediji ---------- */
function mediaSection() {
  const m = cur.media || [];
  return `<section class="msec"><h2>Slike i video <span class="cnt">${m.length}/30</span></h2>
  <label class="drop" for="mf"><b>+ Dodaj slike i video</b><span>Izaberi jedan ili više fajlova (JPG, PNG, WebP, MP4, WebM, MOV)</span></label>
  <input type="file" id="mf" multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" hidden>
  <div class="up" id="up"></div>
  <div class="afld" style="margin-top:12px"><label for="yl">Ili dodaj YouTube link</label><div class="lnkrow"><input id="yl" type="url" placeholder="https://youtu.be/…"><button class="btn s" type="button" id="yb" style="min-height:48px">Dodaj</button></div></div>
  <div class="mgrid" id="mg">${m.map((it, i) => mcard(it, i, m.length)).join('')}</div>
  ${m.length ? '<p class="m" style="font-size:.82rem">Prva stavka je naslovna. Opis i autor se snimaju kad napustiš polje.</p>' : ''}</section>`;
}
const mcard = (it, i, n) => `<div class="mcard" data-id="${it.id}"><div class="mth">${it.thumb ? `<img src="${esc(it.thumb)}" alt="" loading="lazy">` : '<span>Video</span>'}<span class="tg">${it.type === 'image' ? 'Slika' : it.type === 'youtube' ? 'YouTube' : 'Video'}</span></div>
<div class="mmeta"><input data-f="caption" type="text" maxlength="200" placeholder="Opis" aria-label="Opis" value="${esc(it.caption)}"><input data-f="credit" type="text" maxlength="120" placeholder="Autor / izvor" aria-label="Autor" value="${esc(it.credit)}">
<div class="mact"><button type="button" data-mv="-1" aria-label="Pomjeri ranije" ${i === 0 ? 'disabled' : ''}>↑</button><button type="button" data-mv="1" aria-label="Pomjeri kasnije" ${i === n - 1 ? 'disabled' : ''}>↓</button><button type="button" class="del" data-del>Obriši</button></div></div></div>`;

async function prepImage(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 1.2 * 1024 * 1024) return file;
  try {
    const bm = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const s = Math.min(1, 2000 / Math.max(bm.width, bm.height));
    const c = document.createElement('canvas'); c.width = Math.round(bm.width * s); c.height = Math.round(bm.height * s);
    c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
    return blob && blob.size < file.size ? new File([blob], 'foto.jpg', { type: 'image/jpeg' }) : file;
  } catch { return file; }
}
function videoPoster(file) {
  return new Promise((res) => {
    const vd = document.createElement('video'), u = URL.createObjectURL(file);
    let fin = false; const done = (b) => { if (fin) return; fin = true; URL.revokeObjectURL(u); res(b); };
    vd.muted = true; vd.playsInline = true; vd.preload = 'metadata';
    vd.onloadeddata = () => { vd.currentTime = Math.min(0.5, (vd.duration || 1) / 2); };
    vd.onseeked = () => { const s = Math.min(1, 1000 / Math.max(vd.videoWidth, 1)); const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(vd.videoWidth * s)); c.height = Math.max(1, Math.round(vd.videoHeight * s)); c.getContext('2d').drawImage(vd, 0, 0, c.width, c.height); c.toBlob((b) => done(b ? new File([b], 'poster.jpg', { type: 'image/jpeg' }) : null), 'image/jpeg', 0.8); };
    vd.onerror = () => done(null); setTimeout(() => done(null), 8000); vd.src = u;
  });
}
function xhrUpload(form, onp) {
  return new Promise((res, rej) => {
    const x = new XMLHttpRequest(); x.open('POST', '/api/admin/media'); x.setRequestHeader('authorization', 'Bearer ' + KEY);
    x.upload.onprogress = (e) => { if (e.lengthComputable) onp(e.loaded / e.total); };
    x.onload = () => { let d = {}; try { d = JSON.parse(x.responseText); } catch { /* ignore */ } if (x.status === 401) { logout(true); rej(new Error('Neispravan ključ')); } else if (x.status >= 200 && x.status < 300) res(d); else rej(new Error(d.error || 'Greška ' + x.status)); };
    x.onerror = () => rej(new Error('Nema internet veze')); x.send(form);
  });
}
async function uploadFiles(files) {
  const box = document.getElementById('up'); let ok = 0;
  for (const [i, f0] of files.entries()) {
    const row = document.createElement('div'); row.className = 'upi'; row.innerHTML = `<span>${i + 1}/${files.length}: ${esc(f0.name)}</span><div class="bar"><i></i></div>`; box.appendChild(row);
    try {
      let f = f0, poster = null;
      if (f0.type.startsWith('image/')) f = await prepImage(f0); else if (f0.type.startsWith('video/')) poster = await videoPoster(f0);
      const fd = new FormData(); fd.append('ref', cur.ref); fd.append('file', f, f.name); if (poster) fd.append('poster', poster, 'poster.jpg');
      const m = await xhrUpload(fd, (p) => { row.querySelector('i').style.width = Math.round(p * 100) + '%'; });
      cur.media.push(m); ok++; row.remove();
    } catch (e) { row.classList.add('err'); row.innerHTML = esc(f0.name) + ': ' + esc(e.message); }
  }
  if (ok) { toast(ok === 1 ? 'Dodano' : 'Dodano ' + ok); refreshMedia(); }
}
function refreshMedia() {
  const keep = document.getElementById('up').innerHTML, sec = document.querySelector('.msec');
  sec.outerHTML = mediaSection(); document.getElementById('up').innerHTML = keep; bindMedia();
}
function bindMedia() {
  const mf = document.getElementById('mf');
  mf.onchange = () => { const fs = [...mf.files]; mf.value = ''; if (fs.length) uploadFiles(fs); };
  document.getElementById('yb').onclick = async () => {
    const inp = document.getElementById('yl'), u = inp.value.trim(); if (!u) return;
    try { const m = await api('POST', '/media/link', { ref: cur.ref, type: 'youtube', url: u }); cur.media.push(m); toast('Dodano'); refreshMedia(); } catch (e) { toast(e.message, true); }
  };
  const mg = document.getElementById('mg');
  mg.onfocusout = async (e) => {
    const f = e.target.getAttribute && e.target.getAttribute('data-f'); if (!f) return;
    const card = e.target.closest('.mcard'), id = +card.getAttribute('data-id'), it = cur.media.find((m) => m.id === id);
    if (!it || it[f] === e.target.value.trim()) return;
    const body = { caption: card.querySelector('[data-f=caption]').value, credit: card.querySelector('[data-f=credit]').value };
    try { const m = await api('PATCH', '/media/' + id, body); Object.assign(it, m); toast('Sačuvano'); } catch (er) { toast(er.message, true); }
  };
  mg.onclick = async (e) => {
    const card = e.target.closest('.mcard'); if (!card) return;
    const id = +card.getAttribute('data-id'), i = cur.media.findIndex((m) => m.id === id);
    const mv = e.target.closest('[data-mv]');
    if (mv) {
      const j = i + +mv.getAttribute('data-mv'); if (j < 0 || j >= cur.media.length) return;
      const a = [...cur.media]; [a[i], a[j]] = [a[j], a[i]];
      try { const d = await api('PUT', '/media/order', { ref: cur.ref, ids: a.map((m) => m.id) }); cur.media = d.media; refreshMedia(); } catch (er) { toast(er.message, true); }
      return;
    }
    if (e.target.closest('[data-del]')) {
      if (!confirm('Obrisati ovaj fajl? Ovo se ne može poništiti.')) return;
      try { await api('DELETE', '/media/' + id); cur.media.splice(i, 1); toast('Obrisano'); refreshMedia(); } catch (er) { toast(er.message, true); }
    }
  };
}

/* ---------- rute ---------- */
function route() {
  if (!KEY) { viewLogin(); return; }
  const h = location.hash.slice(2);
  if (h === 'new') viewEdit('new');
  else if (h.startsWith('e/')) viewEdit(decodeURIComponent(h.slice(2)));
  else viewList();
}
window.addEventListener('hashchange', route);
route();
