'use strict';
/* ---- Mapa Crne Gore (sekcija 5): mala vlastita mapa na OpenStreetMap pločicama, bez biblioteka ----
   Ponaša se kao standardna mapa: prevlačenje, zumiranje dva prsta, dupli dodir, točkić miša i dugmad +/−.
   Stavke bez tačnih koordinata prikazuju se okvirno na mjestu (opštini) i označe se isprekidanim rubom. */
(() => {
  const TS = 256, ZMIN = 6, ZMAX = 17;
  const PLACE_XY = {
    andrijevica: [42.7367, 19.7878], bar: [42.0937, 19.1003], berane: [42.8431, 19.8661], 'bijelo polje': [43.0383, 19.7478],
    budva: [42.2864, 18.84], cetinje: [42.3931, 18.9236], danilovgrad: [42.5533, 19.1458], gusinje: [42.5592, 19.8325],
    'herceg novi': [42.4531, 18.5375], kolasin: [42.8219, 19.5178], kotor: [42.4247, 18.7712], mojkovac: [42.9603, 19.5833],
    niksic: [42.7731, 18.9445], plav: [42.5967, 19.9411], pljevlja: [43.3567, 19.3586], podgorica: [42.4411, 19.2636],
    rozaje: [42.8397, 20.1669], savnik: [42.9567, 19.0967], tivat: [42.4361, 18.6961], ulcinj: [41.9294, 19.2244],
    zabljak: [43.1547, 19.1217], perast: [42.4872, 18.6975], 'sveti stefan': [42.2547, 18.8928], petrovac: [42.2069, 18.9453],
    sutomore: [42.1442, 19.0494], virpazar: [42.2453, 19.0928], 'rijeka crnojevica': [42.3592, 19.0231], igalo: [42.4545, 18.5115],
    becici: [42.2817, 18.8625], buljarica: [42.2281, 18.9547], risan: [42.5164, 18.6931], dobrota: [42.4417, 18.7681],
    prcanj: [42.4614, 18.7586], muo: [42.4403, 18.7686], 'porto montenegro': [42.4339, 18.6969], kumbor: [42.4411, 18.6125],
    prozno: [42.2667, 18.8667], rafailovici: [42.2733, 18.8556], utjeha: [41.9786, 19.1608], 'ada bojana': [41.8672, 19.3669],
    'velika plaza': [41.9, 19.29], ostrog: [42.6772, 19.03], 'crno jezero': [43.1286, 19.0889], durmitor: [43.1333, 19.0333],
    'skadarsko jezero': [42.2, 19.2], lovcen: [42.4, 18.8333], bjelasica: [42.85, 19.65], 'biogradska gora': [42.9, 19.6]
  };
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const S = (z) => TS * 2 ** (z === undefined ? st.z : z);
  const lng2u = (lng) => (lng + 180) / 360;
  const lat2v = (lat) => { const s = Math.sin((lat * Math.PI) / 180); return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI); };
  const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };
  const placeXY = (place) => {
    const n = norm(place || '');
    if (PLACE_XY[n]) return PLACE_XY[n];
    const k = Object.keys(PLACE_XY).find((p) => n.includes(p));
    return k ? PLACE_XY[k] : null;
  };

  const wrap = $('mp'), surf = $('mp-surf'), pane = $('mp-pane'), tilesEl = $('mp-tiles'), mkEl = $('mp-marks'), card = $('mp-card'), chipsEl = $('mp-chips');
  if (!wrap) return;
  let st = { u: 0.5, v: 0.5, z: 8 }, base = { x: 0, y: 0 }, W = 0, H = 0;
  let mcat = 'all', sel = '', pts = [], inited = false, keepNext = false, moved = false;
  const tiles = new Map();

  const size = () => { W = surf.clientWidth; H = surf.clientHeight; return W > 0 && H > 0; };
  const cx = () => st.u * S(), cy = () => st.v * S();

  function setPane(s = 1, ax = 0, ay = 0) {
    const tx = W / 2 - (cx() - base.x), ty = H / 2 - (cy() - base.y);
    pane.style.transform = s === 1 ? `translate(${tx}px,${ty}px)` : `translate(${ax}px,${ay}px) scale(${s}) translate(${-ax}px,${-ay}px) translate(${tx}px,${ty}px)`;
  }
  // ishodište (base) se povremeno pomjera da koordinate u pikselima ostanu male
  function rebase() {
    base = { x: Math.round(cx()), y: Math.round(cy()) };
    tiles.forEach((im) => { im.style.left = im._x - base.x + 'px'; im.style.top = im._y - base.y + 'px'; });
    [...mkEl.children].forEach((m) => { m.style.left = +m.dataset.wx - base.x + 'px'; m.style.top = +m.dataset.wy - base.y + 'px'; });
  }
  function loadTiles() {
    if (!W) return;
    if (Math.abs(cx() - base.x) > 3000 || Math.abs(cy() - base.y) > 3000) { rebase(); setPane(); }
    const z = st.z, n = 2 ** z;
    const x0 = Math.floor((cx() - W / 2) / TS), x1 = Math.floor((cx() + W / 2) / TS);
    const y0 = Math.floor((cy() - H / 2) / TS), y1 = Math.floor((cy() + H / 2) / TS);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (tx < 0 || ty < 0 || tx >= n || ty >= n) continue;
        const k = z + '/' + tx + '/' + ty;
        if (tiles.has(k)) continue;
        const im = new Image();
        im.className = 'mpt'; im.alt = ''; im.draggable = false; im.decoding = 'async';
        im._x = tx * TS; im._y = ty * TS;
        im.style.left = im._x - base.x + 'px'; im.style.top = im._y - base.y + 'px';
        im.onload = () => im.classList.add('on');
        im.onerror = () => im.remove();
        im.src = `https://tile.openstreetmap.org/${k}.png`;
        tilesEl.appendChild(im); tiles.set(k, im);
      }
    }
    tiles.forEach((im, k) => {
      const [kz, kx, ky] = k.split('/').map(Number);
      if (kz !== z || kx < x0 - 2 || kx > x1 + 2 || ky < y0 - 2 || ky > y1 + 2) { im.remove(); tiles.delete(k); }
    });
  }
  let raf = 0;
  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; setPane(); loadTiles(); }); };

  /* ---- tačke ---- */
  function points() {
    const q = norm(Q), pl = norm($('p').value.trim()), out = [];
    const add = (x, rest) => {
      const kind = rest ? 'food' : x.kind, title = rest ? x.name : x.title, place = rest ? x.city : x.place;
      if (mcat !== 'all' && mcat !== kind) return;
      if (pl && !norm(place || '').includes(pl)) return;
      if (q && !norm([title, place, x.region, rest ? (x.tags || []).join(' ') : x.description].join(' ')).includes(q)) return;
      const end = !rest && kind === 'event' ? (x.to || x.from) : '';
      if (end && end < today) return;
      let lat, lng, approx = false;
      if (hasLoc(x)) { lat = +x.lat; lng = +x.lng; }
      else {
        const p = placeXY(place); if (!p) return;
        const h = hash(x.slug || title || '');
        lat = p[0] + (((h >> 3) % 100) / 100) * 0.008; lng = p[1] + (((h >> 11) % 100) / 100) * 0.008; approx = true;
      }
      out.push({ key: (rest ? 'r:' : 'i:') + x.slug, x, kind, title, place, lat, lng, approx, u: lng2u(lng), v: lat2v(lat) });
    };
    all.forEach((x) => add(x, false));
    rests.forEach((x) => add(x, true));
    return out;
  }

  /* ---- oznake i grupisanje ---- */
  function build() {
    if (!W) return;
    const z = st.z, s = S(z);
    let groups = [];
    if (z >= ZMAX) groups = pts.map((p) => ({ list: [p], x: p.u * s, y: p.v * s }));
    else {
      const g = new Map(), cell = 46;
      pts.forEach((p) => {
        const x = p.u * s, y = p.v * s, k = Math.floor(x / cell) + ':' + Math.floor(y / cell);
        let o = g.get(k); if (!o) g.set(k, (o = { list: [], x: 0, y: 0 }));
        o.list.push(p); o.x += x; o.y += y;
      });
      g.forEach((o) => { o.x /= o.list.length; o.y /= o.list.length; groups.push(o); });
    }
    groups.sort((a, b) => (a.list.some((p) => p.key === sel) ? 1 : 0) - (b.list.some((p) => p.key === sel) ? 1 : 0));
    const pos = (x, y) => `data-wx="${x}" data-wy="${y}" style="left:${x - base.x}px;top:${y - base.y}px"`;
    let html = groups.map((o) => {
      if (o.list.length > 1) return `<button type="button" class="mpk cl" data-cz="1" ${pos(o.x, o.y)} aria-label="${o.list.length}">${o.list.length}</button>`;
      const p = o.list[0];
      return `<button type="button" class="mpk${p.approx ? ' ap' : ''}${p.key === sel ? ' sel' : ''}" data-c="${p.kind}" data-k="${esc(p.key)}" ${pos(o.x, o.y)} aria-label="${esc(p.title)}">${ic(GLYPH[p.kind])}</button>`;
    }).join('');
    if (typeof here === 'object' && here && Number.isFinite(here.lat)) html += `<span class="mpyou" ${pos(lng2u(here.lng) * s, lat2v(here.lat) * s)} aria-hidden="true"></span>`;
    mkEl.innerHTML = html;
  }

  /* ---- kartica odabrane stavke ---- */
  function showCard(p) {
    if (!p) { card.hidden = true; card.innerHTML = ''; return; }
    const dist = typeof here === 'object' && here && Number.isFinite(here.lat) ? ' • ' + fmtKm(kmBetween(here, { lat: p.lat, lng: p.lng })) : '';
    const img = p.x.cover ? `<img src="${esc(p.x.cover)}" alt="" decoding="async">` : `<span class="xph" aria-hidden="true">${ic(GLYPH[p.kind])}</span>`;
    card.innerHTML = `<a class="mpcl" data-c="${p.kind}" href="#d/${esc(p.key)}"><span class="mpci">${img}</span><span class="mpcb"><small>${esc(KIND[p.kind])}</small><b>${esc(p.title)}</b><span class="mpcp">${ic('pin')}<span>${esc(p.place || '')}${dist}${p.approx ? ' • ' + esc(t('approxLoc')) : ''}</span></span></span><span class="mpca" aria-hidden="true">${ic('arrow')}</span></a>`;
    card.hidden = false;
  }
  function unsel() {
    sel = ''; showCard(null);
    const e = mkEl.querySelector('.sel'); if (e) e.classList.remove('sel');
  }
  function select(key) {
    const p = pts.find((o) => o.key === key); if (!p) return;
    sel = key;
    // ako je oznaka ispod kartice ili ispod gornje trake, pomjeri mapu
    const sy = H / 2 + (p.v * S() - cy());
    if (sy > H - 230 || sy < 90) { st.v = clamp(p.v - (H * 0.4 - H / 2) / S(), 0, 1); st.u = p.u; }
    build(); setPane(); loadTiles(); showCard(p);
  }

  /* ---- kretanje i zum ---- */
  function refresh() {
    tiles.forEach((im) => im.remove()); tiles.clear();
    rebase(); build(); setPane(); loadTiles();
  }
  function jump(u, v, z) { st = { u, v: clamp(v, 0, 1), z: clamp(z, ZMIN, ZMAX) }; refresh(); }
  function zoomAt(z, ax = W / 2, ay = H / 2) {
    z = clamp(z, ZMIN, ZMAX);
    if (z === st.z) { setPane(); return; }
    const s0 = S(), dx = ax - W / 2, dy = ay - H / 2, u = st.u + dx / s0, v = st.v + dy / s0;
    st.z = z; const s1 = S();
    st.u = u - dx / s1; st.v = clamp(v - dy / s1, 0, 1);
    refresh();
  }
  function fit() {
    if (!pts.length) { jump(lng2u(19.25), lat2v(42.75), W < 500 ? 8 : 9); return; }
    let u0 = 1, u1 = 0, v0 = 1, v1 = 0;
    pts.forEach((p) => { u0 = Math.min(u0, p.u); u1 = Math.max(u1, p.u); v0 = Math.min(v0, p.v); v1 = Math.max(v1, p.v); });
    const aw = Math.max(120, W - 90), ah = Math.max(120, H - 250);
    const z = Math.floor(Math.log2(Math.min(aw / (Math.max(u1 - u0, 1e-9) * TS), ah / (Math.max(v1 - v0, 1e-9) * TS))));
    jump((u0 + u1) / 2, (v0 + v1) / 2, clamp(z, 7, 14));
  }
  function apply(refit) {
    pts = points(); pts.forEach((p) => { known[p.key] = p.x; });
    $('mp-empty').hidden = pts.length > 0;
    if (!pts.some((p) => p.key === sel)) sel = '';
    if (refit) fit(); else refresh();
    showCard(sel ? pts.find((p) => p.key === sel) : null);
  }
  function renderChips() {
    chipsEl.innerHTML = ['all', ...Object.keys(CATS)].map((k) => `<button type="button" class="mpchip" data-cat="${k}" aria-pressed="${k === mcat}">${k === 'all' ? esc(t('all')) : esc(CATS[k])}</button>`).join('');
  }

  /* ---- dodiri ---- */
  const ptrs = new Map();
  let pinch = null, lastTap = { t: 0, x: 0, y: 0 }, wheelT = 0;
  const rel = (e) => { const r = surf.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  surf.addEventListener('pointerdown', (e) => {
    if (ptrs.size === 0) moved = false;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()], r = surf.getBoundingClientRect();
      pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, ax: (a.x + b.x) / 2 - r.left, ay: (a.y + b.y) / 2 - r.top, s: 1 };
      moved = true;
    }
  });
  surf.addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId); if (!p) return;
    if (ptrs.size >= 2 && pinch) {
      p.x = e.clientX; p.y = e.clientY;
      const [a, b] = [...ptrs.values()];
      pinch.s = clamp(Math.hypot(a.x - b.x, a.y - b.y) / pinch.d0, 0.45, 4);
      setPane(pinch.s, pinch.ax, pinch.ay);
      return;
    }
    if (!moved && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < 6) return;
    if (!moved) { moved = true; try { surf.setPointerCapture(e.pointerId); } catch { /* ignore */ } }
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    st.u -= dx / S(); st.v = clamp(st.v - dy / S(), 0, 1);
    schedule();
  });
  const up = (e) => {
    if (!ptrs.has(e.pointerId)) return;
    const wasPinch = !!pinch;
    ptrs.delete(e.pointerId);
    if (wasPinch && ptrs.size < 2) {
      const f = pinch; pinch = null;
      const dz = Math.round(Math.log2(f.s));
      if (dz) zoomAt(st.z + dz, f.ax, f.ay); else setPane();
      return;
    }
    if (ptrs.size === 0 && e.type === 'pointerup') {
      if (!moved && !e.target.closest('.mpk')) {
        const now = performance.now(), r = rel(e);
        if (now - lastTap.t < 320 && Math.hypot(r.x - lastTap.x, r.y - lastTap.y) < 30) { lastTap.t = 0; zoomAt(st.z + 1, r.x, r.y); }
        else { lastTap = { t: now, x: r.x, y: r.y }; unsel(); }
      } else if (moved) { schedule(); }
    }
  };
  surf.addEventListener('pointerup', up);
  surf.addEventListener('pointercancel', up);
  surf.addEventListener('wheel', (e) => {
    e.preventDefault();
    const n = performance.now(); if (n - wheelT < 220) return; wheelT = n;
    const r = rel(e); zoomAt(st.z + (e.deltaY < 0 ? 1 : -1), r.x, r.y);
  }, { passive: false });

  mkEl.addEventListener('click', (e) => {
    const b = e.target.closest('.mpk'); if (!b || moved) return;
    if (b.dataset.cz) { jump(+b.dataset.wx / S(), +b.dataset.wy / S(), st.z + 2); return; }
    select(b.dataset.k);
  });
  card.addEventListener('click', (e) => { if (e.target.closest('a')) keepNext = true; });
  chipsEl.addEventListener('click', (e) => {
    const b = e.target.closest('.mpchip'); if (!b) return;
    mcat = b.getAttribute('data-cat'); sel = '';
    [...chipsEl.children].forEach((c) => c.setAttribute('aria-pressed', c === b));
    apply(true);
  });
  $('mp-in').onclick = () => zoomAt(st.z + 1);
  $('mp-out').onclick = () => zoomAt(st.z - 1);
  $('mp-back').onclick = () => { if (navs > 0) history.back(); else location.hash = '#istrazi'; };
  $('mp-list').onclick = () => { location.hash = '#istrazi'; };
  $('mp-loc').onclick = async () => {
    const b = $('mp-loc'); b.disabled = true;
    const p = await askLoc(); b.disabled = false;
    if (!p) { toast(t('locDenied')); return; }
    here = p;
    jump(lng2u(p.lng), lat2v(p.lat), Math.max(st.z, 13));
    if (sel) { const pp = pts.find((o) => o.key === sel); showCard(pp); }
  };
  if (window.ResizeObserver) new ResizeObserver(() => { const ow = W, oh = H; if (size() && inited && (ow !== W || oh !== H)) refresh(); }).observe(surf);

  /* ulaz iz rutera (app.js) */
  window.mapView = () => {
    const keep = keepNext && inited; keepNext = false;
    if (!keep) { mcat = typeof cat === 'string' && cat in CATS ? cat : 'all'; sel = ''; }
    renderChips();
    requestAnimationFrame(() => {
      if (!size()) return;
      inited = true;
      apply(!keep);
    });
  };
  if (location.hash === '#mapa' && $('v-mapa').classList.contains('on')) window.mapView(); // direktno otvaranje linka #mapa
})();
