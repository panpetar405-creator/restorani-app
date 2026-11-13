'use strict';
/* Moj profil (sekcija 8): lokalni profil bez naloga. Ime, mjesto i fotografija ostaju samo na uređaju (localStorage).
   Redovi: Moji planovi, Omiljene lokacije, Push obavještenja, Jezik, Tamni režim, Pomoć i podrška, O aplikaciji. */
(() => {
  let prof = { name: '', city: '', photo: '' };
  try { Object.assign(prof, JSON.parse(localStorage.getItem('mp.profile') || '{}')); } catch { /* ignore */ }
  const saveProf = () => { try { localStorage.setItem('mp.profile', JSON.stringify(prof)); return true; } catch { return false; } };

  /* ---- tema ---- */
  const sysDark = () => !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const isDark = () => { const v = document.documentElement.getAttribute('data-theme'); return v ? v === 'dark' : sysDark(); };
  const setTheme = (v) => {
    document.documentElement.setAttribute('data-theme', v);
    try { localStorage.setItem('mp.theme', v); } catch { /* ignore */ }
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', v === 'dark' ? '#0b1c26' : '#0b5aa8');
  };

  /* ---- avatar ---- */
  const initials = () => prof.name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => Array.from(w)[0].toUpperCase()).join('');
  function paintHead() {
    const av = $('pravat');
    if (prof.photo) av.innerHTML = `<img src="${esc(prof.photo)}" alt="" decoding="async">`;
    else av.innerHTML = initials() ? `<span>${esc(initials())}</span>` : ic('user');
    $('prname').textContent = prof.name || t('profNoName');
    $('prname').classList.toggle('e', !prof.name);
    $('prsub').textContent = prof.city || t('profNoCity');
    $('prsub').classList.toggle('e', !prof.city);
  }

  /* ---- lista ---- */
  const chev = ic('right', 'prch');
  const row = (id, g, label, right) => `<li><button type="button" class="prrow" data-pr="${id}"><span class="pri">${ic(g)}</span><span class="prl">${label}</span>${right || ''}${chev}</button></li>`;
  const sw = (id, g, label, on, off) => `<li><button type="button" class="prrow" data-pr="${id}" role="switch" aria-checked="${on}"${off ? ' aria-disabled="true"' : ''}><span class="pri">${ic(g)}</span><span class="prl">${label}</span><span class="prsw${off ? ' off' : ''}" aria-hidden="true"></span></button></li>`;
  const cnt = (n) => (n > 0 ? `<span class="prn">${n}</span>` : '');
  function paintList() {
    const pi = window.mpPushInfo ? window.mpPushInfo() : { on: false, can: false };
    $('prlist').innerHTML =
      row('plans', 'cal', t('profPlans'), cnt(plan.length)) +
      row('favs', 'heart-o', t('profFavs'), cnt(likes.length)) +
      sw('push', 'bell', t('profPush'), pi.on, !pi.can && !pi.on) +
      row('lang', 'globe', t('profLang'), `<span class="prv">${esc(LANG_NAMES[LANG])}</span>`) +
      sw('dark', 'moon', t('profDark'), isDark(), false) +
      row('help', 'help', t('profHelp')) +
      row('about', 'info', t('profAbout'));
  }
  window.profilView = () => { paintHead(); paintList(); };
  document.addEventListener('mp-push', () => { if (!$('v-profil').classList.contains('on')) return; paintList(); });

  /* ---- sheet (koristi ksheet iz Korisno) ---- */
  const openSheet = (title, html) => { $('ks-t').textContent = title; $('ks-b').innerHTML = html; $('ksheet').hidden = false; };
  const lookup = (k) => known[k] || (k[0] === 'i' ? all.find((x) => 'i:' + x.slug === k) : rests.find((x) => 'r:' + x.slug === k));
  function favsSheet() {
    const list = likes.map((k) => ({ k, x: lookup(k) }));
    const body = list.length
      ? `<ul class="prfavs">${list.map(({ k, x }) => {
        const kind = k[0] === 'i' ? (x ? x.kind : 'culture') : 'food';
        const title = x ? (x.title || x.name) : k.slice(2).replace(/-/g, ' '), place = x ? (x.place || x.city || '') : '';
        const th = x && x.cover ? `<img src="${esc(x.cover)}" alt="" loading="lazy" decoding="async">` : `<span class="tph" aria-hidden="true">${ic(GLYPH[kind] || 'pin')}</span>`;
        return `<li class="prf"><a class="trl" href="#d/${esc(k)}" data-x><span class="tth">${th}</span><span class="ttx"><b>${esc(title)}</b><small>${esc(place)}</small></span></a><button type="button" class="tmore prun" data-prs="unlike" data-k="${esc(k)}" aria-label="${esc(t('unlike'))}">${ic('heart', 'f')}</button></li>`;
      }).join('')}</ul>`
      : `<p class="prmsg">${esc(t('profFavsEmpty'))}</p>`;
    openSheet(t('profFavs'), body);
  }
  const langSheet = () => openSheet(t('profLang'), `<div class="prlangs">${LANGS.map((l) => `<button type="button" class="prrow" data-prs="lang" data-l="${l}" lang="${HTML_LANG[l]}"><span class="prl"><b>${l.toUpperCase()}</b> ${esc(LANG_NAMES[l])}</span>${l === LANG ? ic('check', 'prok') : ''}</button>`).join('')}</div>`);
  const helpSheet = () => openSheet(t('profHelp'), `<p class="prmsg">${esc(t('profHelpIntro'))}</p><a class="khelp" href="tel:112">${ic('phone')}<span>${esc(t('needHelp'))}</span></a><a class="btn s full" href="#korisno" data-x style="text-decoration:none;margin-top:10px">${ic('info')}${esc(t('useful'))}</a>`);
  const aboutSheet = () => openSheet(t('profAbout'), `<p class="prmsg"><b>Montepalm</b><br>${esc(t('profAboutBody'))}</p><p class="note">${esc(t('profAboutData'))}</p>`);
  function editSheet() {
    openSheet(t('profEdit'), `<label class="plb">${esc(t('profName'))}<input id="prin" maxlength="40" value="${esc(prof.name)}" autocomplete="name"></label><label class="plb">${esc(t('profCity'))}<input id="pric" maxlength="40" value="${esc(prof.city)}" autocomplete="address-level2"></label>${prof.photo ? `<button type="button" class="btn s full pdanger" data-prs="rmphoto" style="margin-top:10px">${ic('trash')}${esc(t('profRemovePhoto'))}</button>` : ''}<div class="pfa"><button type="button" class="btn p" data-prs="save">${esc(t('profSave'))}</button></div>`);
  }

  /* ---- fotografija: smanji na 256 px i sačuvaj kao JPEG ---- */
  function pickPhoto(file) {
    if (!file || !/^image\//.test(file.type)) return;
    const fr = new FileReader();
    fr.onerror = () => toast(t('profPhotoErr'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => toast(t('profPhotoErr'));
      img.onload = () => {
        const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
        const m = Math.min(img.width, img.height), sx = (img.width - m) / 2, sy = (img.height - m) / 2;
        c.getContext('2d').drawImage(img, sx, sy, m, m, 0, 0, S, S);
        const old = prof.photo; prof.photo = c.toDataURL('image/jpeg', 0.82);
        if (!saveProf()) { prof.photo = old; toast(t('profPhotoErr')); return; }
        paintHead();
      };
      img.src = String(fr.result);
    };
    fr.readAsDataURL(file);
  }

  /* ---- događaji ---- */
  $('prback').onclick = () => { if (navs > 0) history.back(); else location.hash = '#pocetna'; };
  $('predit').onclick = editSheet;
  $('prcam').onclick = () => $('prfile').click();
  $('prfile').onchange = (e) => { pickPhoto(e.target.files && e.target.files[0]); e.target.value = ''; };
  $('prlist').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-pr]'); if (!b) return;
    const id = b.getAttribute('data-pr');
    if (id === 'plans') location.hash = '#plan';
    else if (id === 'favs') favsSheet();
    else if (id === 'lang') langSheet();
    else if (id === 'help') helpSheet();
    else if (id === 'about') aboutSheet();
    else if (id === 'dark') { setTheme(isDark() ? 'light' : 'dark'); paintList(); }
    else if (id === 'push') {
      const pi = window.mpPushInfo ? window.mpPushInfo() : null;
      if (!pi || (!pi.can && !pi.on)) { toast((pi && pi.msg) || t('profPushNA')); return; }
      b.disabled = true; try { await window.mpPushToggle(); } finally { paintList(); }
    }
  });
  $('ks-b').addEventListener('click', (e) => {
    const b = e.target.closest('[data-prs]'); if (!b) return;
    const a = b.getAttribute('data-prs');
    if (a === 'lang') setLang(b.getAttribute('data-l'));
    else if (a === 'unlike') { toggleLike(b.getAttribute('data-k')); favsSheet(); paintList(); }
    else if (a === 'rmphoto') { prof.photo = ''; saveProf(); paintHead(); $('ksheet').hidden = true; }
    else if (a === 'save') {
      prof.name = $('prin').value.trim().slice(0, 40); prof.city = $('pric').value.trim().slice(0, 40);
      saveProf(); paintHead(); $('ksheet').hidden = true;
    }
  });
})();
