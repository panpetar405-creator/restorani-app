'use strict';
const $app = document.getElementById('app'), $toast = document.getElementById('toast');
const MS = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'];
const KIND = { event: 'Događaj', beach: 'Plaža', culture: 'Kultura', food: 'Gastronomija' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let KEY = ''; try { KEY = sessionStorage.getItem('mp.admin') || ''; } catch { /* ignore */ }
let cur = null, months = [], busy = false, R2 = null;

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
    try { const p = await api('GET', '/ping'); try { sessionStorage.setItem('mp.admin', KEY); } catch { /* ignore */ } R2 = !!p.r2; route(); }
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
  <button class="btn p full" id="nw">+ Novi događaj ili lokacija</button><button class="btn s full" id="pu" style="margin-top:10px">Obavještenja korisnicima</button><div id="rows">${draw('')}</div></div>`;
  document.getElementById('lo').onclick = () => logout();
  document.getElementById('nw').onclick = () => { location.hash = '#/new'; };
  document.getElementById('pu').onclick = () => { location.hash = '#/push'; };
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
  <h2 style="font-size:1.05rem;margin:22px 0 6px">English (nije obavezno)</h2><p class="m" style="font-size:.82rem;margin:0 0 12px">Ako ostaviš prazno, strani turisti vide tekst na crnogorskom.</p>
  ${fld('f-title-en', 'Naziv (EN)', x.title_en, { max: 120 })}
  ${fld('f-desc-en', 'Kratak opis (EN)', x.description_en, { area: 1, max: 500, rows: 3 })}
  ${fld('f-details-en', 'Duži opis (EN)', x.details_en, { area: 1, max: 4000, rows: 7 })}
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
  ${fld('f-amb-en', 'Opis (EN, nije obavezno)', x.ambience_en, { area: 1, max: 600, rows: 4 })}
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
  if (R2 === null) { try { R2 = !!(await api('GET', '/ping')).r2; } catch { R2 = false; } }
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
    return { ...x, name: v('f-name'), city: v('f-city'), phone: v('f-phone'), ambience: v('f-amb'), ambience_en: v('f-amb-en'), why: sp(v('f-why'), /\n/), tags: sp(v('f-tags'), ','), amenities: sp(v('f-am'), ','), lat: v('f-lat'), lng: v('f-lng'), active: document.getElementById('f-act').checked };
  }
  const kind = v('f-kind');
  return { ...x, kind, title: v('f-title'), place: v('f-place'), region: v('f-region'), description: v('f-desc'), details: v('f-details'), title_en: v('f-title-en'), description_en: v('f-desc-en'), details_en: v('f-details-en'), date_from: v('f-from') || null, date_to: v('f-to') || null, months: [...months], address: v('f-addr'), website: v('f-web'), lat: v('f-lat'), lng: v('f-lng'), status: v('f-status'), source: v('f-src'), source_url: v('f-srcu'), verified: document.getElementById('f-ver').checked, demo: document.getElementById('f-demo').checked, active: document.getElementById('f-act').checked };
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
  const up = R2 ? `<label class="drop" for="mf"><b>+ Dodaj slike i video</b><span>Izaberi jedan ili više fajlova (JPG, PNG, WebP, MP4, WebM, MOV)</span></label>
  <input type="file" id="mf" multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" hidden>
  <div class="up" id="up"></div>` : '<div class="up" id="up"></div>';
  return `<section class="msec"><h2>Slike i video <span class="cnt">${m.length}/30</span></h2>${up}
  <div class="afld" style="margin-top:12px"><label for="yl">Dodaj link na sliku, video ili YouTube</label><div class="lnkrow"><input id="yl" type="text" inputmode="url" autocapitalize="off" placeholder="/media/foto.jpg ili https://…"><button class="btn s" type="button" id="yb" style="min-height:48px">Dodaj</button></div>
  <small>Fajl koji si dodao u GitHub folder <b>public/media</b> upiši kao <b>/media/ime.jpg</b>. Radi i bilo koji https link, kao i YouTube.</small></div>
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
  if (mf) mf.onchange = () => { const fs = [...mf.files]; mf.value = ''; if (fs.length) uploadFiles(fs); };
  document.getElementById('yb').onclick = async () => {
    const inp = document.getElementById('yl'), u = inp.value.trim(); if (!u) return;
    const type = /youtu\.?be/i.test(u) ? 'youtube' : /\.(mp4|webm|mov)(\?|#|$)/i.test(u) ? 'video' : 'image';
    try { const m = await api('POST', '/media/link', { ref: cur.ref, type, url: u }); cur.media.push(m); toast('Dodano'); refreshMedia(); } catch (e) { toast(e.message, true); }
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
/* ---------- obavještenja (push) ---------- */
const fmtT = (iso) => { try { return new Date(iso).toLocaleString('sr-Latn-ME', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; } };
const LANG_LBL = { sr: 'crnogorski', en: 'engleski', de: 'njemački', ru: 'ruski', it: 'italijanski' };
const langLine = (m) => { const e = Object.entries(m || {}).sort((a, b) => b[1].total - a[1].total); return e.length ? e.map(([l, x]) => `${LANG_LBL[l] || l}: <b>${x.total}</b> (${x.promo})`).join(', ') : 'još nema uređaja'; };
async function viewPush() {
  $app.innerHTML = '<div class="atop"><div class="in"><button class="ghost" id="bk">← Nazad</button><h1>Obavještenja</h1></div></div><div class="wrap"><div class="skb" style="height:60px;margin-top:16px"></div></div>';
  document.getElementById('bk').onclick = () => { location.hash = '#/'; };
  let d; try { d = await api('GET', '/push'); } catch (e) { if (KEY) toast(e.message, true); return; }
  const rows = d.campaigns.map((c) => {
    const st = !c.enqueued_at ? `zakazano za ${fmtT(c.send_at)}` : c.pending ? `šalje se (čeka još ${c.pending})` : `poslato ${c.recipients}`;
    return `<div class="arow" style="cursor:default"><span style="flex:1"><b>${esc(c.title)}</b><br><small>${esc(c.body)}<br>${esc(st)}${c.audience === 'test' ? ' · test' : ''}</small></span><button class="ghost" data-del="${c.id}" data-st="${!c.enqueued_at ? 'plan' : c.pending ? 'busy' : 'done'}">${!c.enqueued_at ? 'Otkaži' : c.pending ? 'Zaustavi' : 'Obriši'}</button></div>`;
  }).join('');
  $app.innerHTML = `<div class="atop"><div class="in"><button class="ghost" id="bk">← Nazad</button><h1>Obavještenja</h1></div></div>
  <div class="wrap" style="padding-top:14px">
    ${d.configured ? '' : '<p class="afld"><b>Slanje nije podešeno.</b> <small>Dodaj tajne VAPID_PUBLIC, VAPID_PRIVATE i VAPID_SUBJECT (vidi README, dio „Obavještenja”).</small></p>'}
    <p class="afld"><small>Uređaja sa uključenim obavještenjima: <b>${d.subs.total}</b> (promocije: ${d.subs.promo}, podsjetnici: ${d.subs.remind}). Podsjetnik dan prije događaja šalje se automatski u 10:00 svima kojima je događaj u „Moj put”.</small></p>
    <p class="afld"><small>Po jezicima (uređaja, od toga primaju promocije): ${langLine(d.subs.langs)}. Broji se uređaj, ne osoba: ista osoba sa dva telefona ili preglednika je dva uređaja. Imena i nalozi se ne čuvaju.</small></p>
    <div class="afld"><label for="pt">Naslov <span class="cnt2" id="ptc"></span></label><input type="text" id="pt" maxlength="60" placeholder="Vikend akcija na primorju"></div>
    <div class="afld"><label for="pb">Tekst <span class="cnt2" id="pbc"></span></label><textarea id="pb" maxlength="180" style="min-height:80px" placeholder="20% popusta u restoranima do nedjelje"></textarea></div>
    <div class="afld"><label for="pte">Naslov na engleskom (nije obavezno)</label><input type="text" id="pte" maxlength="60"></div>
    <div class="afld"><label for="pbe">Tekst na engleskom (nije obavezno)</label><textarea id="pbe" maxlength="180" style="min-height:80px"></textarea></div>
    ${[['de', 'njemačkom'], ['ru', 'ruskom'], ['it', 'italijanskom']].map(([l, n]) => `<details class="afld"><summary>Na ${n} (nije obavezno)</summary><div class="afld"><label for="pt${l}">Naslov na ${n}</label><input type="text" id="pt${l}" maxlength="60"></div><div class="afld"><label for="pb${l}">Tekst na ${n}</label><textarea id="pb${l}" maxlength="180" style="min-height:80px"></textarea></div></details>`).join('')}
    <div class="afld"><button class="btn s full" type="button" id="ptr">Prevedi sa crnogorskog (EN, DE, RU, IT)</button><small>Popuni sva jezička polja iz naslova i teksta gore. Pregledaj prevod prije slanja; ručne izmjene se prepisuju pri novom prevođenju.</small></div>
    <p class="afld"><small>Gost dobija tekst na svom jeziku. Ako ga nema, dobija engleski, a ako nema ni njega, crnogorski.</small></p>
    <div class="afld"><label for="pu2">Šta se otvara dodirom</label><input type="text" id="pu2" value="/" maxlength="200"><small>Početna: <code>/</code> · pretraga: <code>/#istrazi</code> · događaj: <code>/#d/i%3Afasinada</code> (slug iz adrese u adminu)</small></div>
    <div class="afld"><label for="pw">Kada</label><select id="pw"><option value="now">Pošalji odmah</option><option value="later">Zakaži</option></select></div>
    <div class="afld" id="pwl" hidden><label for="pd">Datum i sat slanja</label><input type="datetime-local" id="pd" style="min-height:48px;padding:0 12px;border:1.5px solid var(--line);border-radius:var(--r-md);background:var(--bg)"></div>
    <label class="afld" style="grid-auto-flow:column;justify-content:start;align-items:center;gap:10px"><input type="checkbox" id="ptest"><span>Samo test: pošalji samo na posljednji uređaj koji je uključio obavještenja</span></label>
    <button class="btn p full" id="psend" ${d.configured ? '' : 'disabled'}>Pošalji</button>
    <h2 style="margin:26px 0 10px;font-size:1.05rem">Poslednje promocije</h2>
    ${d.campaigns.some((c) => c.enqueued_at && !c.pending) ? '<button class="btn s full" type="button" id="pdelall" style="margin-bottom:10px">Obriši sve poslate iz istorije</button>' : ''}
    <div class="alist" id="prows">${rows || '<small>Još ništa nije poslato.</small>'}</div>
  </div>`;
  document.getElementById('bk').onclick = () => { location.hash = '#/'; };
  const cnt = (i, o) => { const f = () => { document.getElementById(o).textContent = document.getElementById(i).value.length + '/' + document.getElementById(i).maxLength; }; document.getElementById(i).oninput = f; f(); };
  cnt('pt', 'ptc'); cnt('pb', 'pbc');
  document.getElementById('pw').onchange = (e) => { document.getElementById('pwl').hidden = e.target.value !== 'later'; };
  document.getElementById('prows').onclick = async (e) => {
    const b = e.target.closest('[data-del]'); if (!b) return;
    const st = b.getAttribute('data-st');
    if (st === 'busy' && !confirm('Zaustaviti slanje? Onima koji su već dobili obavještenje ono ostaje na telefonu.')) return;
    if (st === 'done' && !confirm('Obrisati iz istorije? Obavještenja koja su već stigla ostaju na telefonima i u njihovom zvoncu.')) return;
    try { await api('DELETE', '/push/campaign/' + b.getAttribute('data-del')); toast(st === 'plan' ? 'Otkazano' : st === 'busy' ? 'Zaustavljeno' : 'Obrisano'); viewPush(); } catch (er) { toast(er.message, true); }
  };
  const da = document.getElementById('pdelall');
  if (da) da.onclick = async () => {
    if (!confirm('Obrisati sve poslate promocije iz istorije? Zakazane i one koje se još šalju ostaju. Obavještenja koja su već stigla ostaju na telefonima.')) return;
    try { const r = await api('DELETE', '/push/campaign/sent'); toast('Obrisano: ' + r.deleted); viewPush(); } catch (er) { toast(er.message, true); }
  };
  document.getElementById('ptr').onclick = async () => {
    if (busy) return;
    if (!v('pt') || !v('pb')) { toast('Prvo upiši naslov i tekst', true); return; }
    busy = true; const b = document.getElementById('ptr'); b.disabled = true; const lbl = b.textContent; b.textContent = 'Prevodim…';
    try {
      const r = await api('POST', '/push/translate', { title: v('pt'), body: v('pb') });
      const set = (id, val) => { document.getElementById(id).value = val || ''; };
      set('pte', r.title_en); set('pbe', r.body_en);
      ['de', 'ru', 'it'].forEach((l) => { set('pt' + l, r['title_' + l]); set('pb' + l, r['body_' + l]); document.getElementById('pt' + l).closest('details').open = true; });
      toast('Prevedeno, provjeri tekst');
    } catch (er) { toast(er.message, true); } finally { busy = false; b.disabled = false; b.textContent = lbl; }
  };
  document.getElementById('psend').onclick = async () => {
    if (busy) return;
    const later = v('pw') === 'later';
    const body = { title: v('pt'), body: v('pb'), title_en: v('pte'), body_en: v('pbe'), title_de: v('ptde'), body_de: v('pbde'), title_ru: v('ptru'), body_ru: v('pbru'), title_it: v('ptit'), body_it: v('pbit'), url: v('pu2') || '/', audience: document.getElementById('ptest').checked ? 'test' : 'all' };
    if (later) { if (!v('pd')) { toast('Izaberi datum i sat', true); return; } body.send_at = new Date(v('pd')).toISOString(); }
    if (body.audience === 'all' && !confirm(later ? 'Zakazati obavještenje za sve korisnike?' : `Poslati obavještenje na ${d.subs.promo} uređaja?`)) return;
    busy = true;
    try { await api('POST', '/push/campaign', body); toast(later ? 'Zakazano' : 'Šalje se'); viewPush(); } catch (er) { toast(er.message, true); } finally { busy = false; }
  };
}

function route() {
  if (!KEY) { viewLogin(); return; }
  const h = location.hash.slice(2);
  if (h === 'push') viewPush();
  else if (h === 'new') viewEdit('new');
  else if (h.startsWith('e/')) viewEdit(decodeURIComponent(h.slice(2)));
  else viewList();
}
window.addEventListener('hashchange', route);
route();
