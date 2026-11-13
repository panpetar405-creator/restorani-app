'use strict';
/* ---- Vremenska prognoza (sekcija 7): ekran #vrijeme, podaci sa /api/forecast (Open-Meteo) ---- */
(() => {
  const WXP = [
    ['kotor', 'Kotor', 42.42, 18.77], ['budva', 'Budva', 42.29, 18.84], ['tivat', 'Tivat', 42.44, 18.7], ['herceg-novi', 'Herceg Novi', 42.45, 18.54],
    ['bar', 'Bar', 42.09, 19.1], ['ulcinj', 'Ulcinj', 41.93, 19.22], ['podgorica', 'Podgorica', 42.44, 19.26], ['cetinje', 'Cetinje', 42.39, 18.92],
    ['niksic', 'Nikšić', 42.77, 18.94], ['kolasin', 'Kolašin', 42.82, 19.52], ['zabljak', 'Žabljak', 43.15, 19.12], ['plav', 'Plav', 42.6, 19.94]
  ];
  const KEY = 'mp.wx';
  const out = $('wx-out'), sel = $('wx-place'), tabs = $('wx-tabs');
  if (!out) return;
  let slug = 'kotor', tab = 'f', data = null, more = false, tok = 0;
  try { const s = localStorage.getItem(KEY); if (WXP.some((p) => p[0] === s)) slug = s; } catch { /* ignore */ }

  // slug za mjesto stavke (koristi se za vezu iz detalja); prazno ako mjesto nije na spisku
  window.wxSlug = (place) => { const n = norm(place || ''); const p = WXP.find((x) => norm(x[1]) === n); return p ? p[0] : ''; };

  const iconOf = (code, day) => (day === false && (code === 0 || code === 1) ? 'moon' : wxIcon(code));
  const txt = (g) => wxText[g === 'moon' ? 'sun' : g] || '';
  const sky = (g) => (g === 'moon' ? 'night' : g);
  const dayLbl = (d, i) => (i === 0 ? t('wxToday') : DAYN[parse(d.date).getDay()]);
  const dateLbl = (s) => { const d = parse(s); return d.getDate() + (DOT ? '. ' : ' ') + MS[d.getMonth()]; };
  const KMH = ' km/h';

  function alerts() {
    const o = [];
    data.days.forEach((d, i) => {
      const add = (k, v) => o.push({ i, d, k, v });
      if (d.tmax >= 35) add('aHeat', d.tmax + '°C');
      if (d.gust >= 60) add('aWind', d.gust + KMH);
      if (d.rain >= 30) add('aRain', d.rain + ' mm');
      if (d.code >= 95) add('aStorm', '');
      if ((d.code >= 71 && d.code <= 77) || d.code === 85 || d.code === 86) add('aSnow', '');
      if (d.tmin <= 0) add('aFrost', d.tmin + '°C');
      if (d.uv >= 8) add('aUv', 'UV ' + Math.round(d.uv));
    });
    return o;
  }

  function hero() {
    const n = data.now, g = iconOf(n.code, n.day);
    const hrs = data.hours.filter((h) => h.h % 3 === 0).slice(0, 4);
    return `<section class="wxh" data-sk="${sky(g)}"><div class="wxh1"><span class="wxhi">${ic(g)}</span><div class="wxht"><b>${n.temp}°C</b><span>${esc(txt(g))}</span></div></div>`
      + `<p class="wxhs"><span>${t('wxFeels')}: ${n.feels}°C</span><span>${t('wxHum')}: ${n.hum}%</span><span>${t('wxWind')}: ${n.wind}${KMH}</span></p>`
      + `<div class="wxhr">${hrs.map((h) => `<div><span>${pad(h.h)}:00</span>${ic(iconOf(h.code, h.day))}<b>${h.temp}°</b></div>`).join('')}</div></section>`;
  }
  function row(d, i) {
    const g = wxIcon(d.code);
    return `<li class="wxd"><span class="wxdn"><b>${esc(dayLbl(d, i))}</b><small>${esc(dateLbl(d.date))}</small></span><span class="wxdi" title="${esc(wxText[g] || '')}">${ic(g)}</span><span class="wxdp">${d.prob != null ? ic('drop') + d.prob + '%' : ''}</span><span class="wxdt"><b>${d.tmax}°</b> ${d.tmin}°</span></li>`;
  }
  const attr = () => `<p class="note">${t('data')}<a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a></p>`;

  function render() {
    if (!data) return;
    let h = '';
    if (tab === 'f') {
      const list = more ? data.days : data.days.slice(0, 3);
      h = hero() + `<div class="hd"><h2>${t('wxNext')}</h2>${data.days.length > 3 ? `<button class="lnk" type="button" id="wx-more" aria-expanded="${more}"><span>${t('seeAllLink')}</span>${ic(more ? 'down' : 'right')}</button>` : ''}</div><ul class="wxdl">${list.map(row).join('')}</ul>`;
    } else if (tab === 'p') {
      h = data.avg.length
        ? `<div class="hd"><h2>${t('wxTabA')}</h2></div><ul class="wxdl wxavg"><li class="wxd wxdh"><span></span><span>${t('wxTabF')}</span><span>${t('wxAvgTyp')}</span></li>${data.days.map((d, i) => {
          const a = data.avg.find((x) => x.date === d.date); if (!a) return '';
          return `<li class="wxd"><span class="wxdn"><b>${esc(dayLbl(d, i))}</b><small>${esc(dateLbl(d.date))}</small></span><span class="wxdt"><b>${d.tmax}°</b> ${d.tmin}°</span><span class="wxdt a"><b>${a.tmax}°</b> ${a.tmin}°</span></li>`;
        }).join('')}</ul><p class="note">${t('wxAvgNote')}</p>`
        : emptyBox('alert', t('wxFail'), '', retryBtn('wx'));
    } else {
      const al = alerts();
      h = (al.length
        ? `<ul class="wxdl">${al.map((a) => `<li class="wxa"><span class="wxai">${ic('alert')}</span><span class="wxat"><b>${esc(t(a.k))}</b><small>${esc(dayLbl(a.d, a.i))}, ${esc(dateLbl(a.d.date))}${a.v ? ' • ' + esc(a.v) : ''}</small></span></li>`).join('')}</ul>`
        : emptyBox('shield', t('wxNone'), ''))
        + `<p class="note">${t('wxAlertNote')}</p>`;
    }
    out.innerHTML = h + attr();
  }

  async function load() {
    const my = ++tok, p = WXP.find((x) => x[0] === slug);
    out.innerHTML = '<div class="skb" style="height:236px;border-radius:24px"></div><div class="skb" style="height:150px;margin-top:16px;border-radius:18px"></div>';
    try { data = await api(`/forecast?lat=${p[2]}&lng=${p[3]}`); }
    catch { data = null; if (my === tok) out.innerHTML = errBox('wx'); return; }
    if (my === tok) render();
  }
  const setTab = (k) => { tab = k; [...tabs.children].forEach((b) => b.setAttribute('aria-pressed', b.getAttribute('data-t') === k)); render(); };

  sel.innerHTML = WXP.map((p) => `<option value="${p[0]}">${esc(p[1])}</option>`).join('');
  sel.addEventListener('change', () => {
    slug = sel.value; more = false;
    try { localStorage.setItem(KEY, slug); } catch { /* ignore */ }
    history.replaceState(null, '', '#vrijeme/' + slug);
    load();
  });
  tabs.addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (b) setTab(b.getAttribute('data-t')); });
  out.addEventListener('click', (e) => { if (e.target.closest('#wx-more')) { more = !more; render(); } });
  $('wx-back').onclick = () => { if (navs > 0) history.back(); else location.hash = '#pocetna'; };

  window.weatherView = (s) => {
    if (s && WXP.some((p) => p[0] === s)) { slug = s; try { localStorage.setItem(KEY, slug); } catch { /* ignore */ } }
    sel.value = slug; more = false; setTab('f');
    load();
  };
  if (location.hash.startsWith('#vrijeme') && $('v-vrijeme').classList.contains('on')) window.weatherView(location.hash.slice(9));
})();
