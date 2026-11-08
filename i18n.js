'use strict';
/* Jezik: sr (crnogorski/srpski) ili en. Redoslijed: ?lang= iz linka, sačuvani izbor, jezik uređaja. */
const LANGS = ['sr', 'en'];
let LANG = 'en';
(() => {
  let q = '', st = '';
  try { q = new URLSearchParams(location.search).get('lang') || ''; } catch { /* ignore */ }
  try { st = localStorage.getItem('mp.lang') || ''; } catch { /* ignore */ }
  if (LANGS.includes(q)) { LANG = q; try { localStorage.setItem('mp.lang', q); history.replaceState(null, '', location.pathname + location.hash); } catch { /* ignore */ } }
  else if (LANGS.includes(st)) LANG = st;
  else {
    const nav = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en']).map((l) => String(l).toLowerCase());
    LANG = nav.some((l) => /^(sr|hr|bs|cnr|sh|me)/.test(l)) ? 'sr' : 'en';
  }
})();

const DICT = {
  sr: {
    heroTitle: 'Crna Gora<br>na dlanu', heroSub: 'Šta se dešava, gdje i kada. Izaberi mjesto i period.',
    where: 'Gdje', wherePh: 'Herceg Novi, Kotor, Žabljak…', place: 'Mjesto', placePh: 'Cijela Crna Gora',
    from: 'Od', to: 'Do', pickDate: 'Izaberi datum', pickStart: 'Izaberi početni datum', pickEndHint: ' · izaberi krajnji datum ili primijeni za jedan dan',
    search: 'Pretraži', soon: 'Uskoro', allEvents: 'Svi događaji', whatToday: 'Šta želiš danas?',
    explore: 'Istraži', myTrip: 'Moj put', sharePlan: 'Podijeli plan', home: 'Početna', mainNav: 'Glavna navigacija', category: 'Kategorija', all: 'Sve',
    clearPlace: 'Obriši mjesto', addPhoto: 'Dodaj fotografiju', changePhoto: 'Promijeni fotografiju', pickPeriod: 'Izaberi period', close: 'Zatvori',
    weekend: 'Vikend', days7: '7 dana', thisMonth: 'Ovaj mjesec', prevMonth: 'Prethodni mjesec', nextMonth: 'Sljedeći mjesec', clear: 'Očisti', apply: 'Primijeni',
    gallery: 'Galerija fotografija', prevPhoto: 'Prethodna fotografija', nextPhoto: 'Sljedeća fotografija', noscript: 'Za korištenje aplikacije Montepalm potreban je JavaScript.',
    pageTitle: 'Montepalm: šta ima u Crnoj Gori', langLabel: 'Jezik',
    wd: ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'], dayn: ['Ned', 'Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub'],
    ms: ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec'],
    months: ['januar', 'februar', 'mart', 'april', 'maj', 'jun', 'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar'],
    cats: { event: 'Događaji', beach: 'Plaže', food: 'Gastronomija', culture: 'Kultura' },
    kind: { event: 'Događaj', beach: 'Plaža', food: 'Gastronomija', culture: 'Kultura' },
    sub: { event: 'Šta se dešava i kada', beach: 'Plaže i uvale', food: 'Restorani i konobe', culture: 'Znamenitosti i baština' },
    status: { potvrdjeno: 'Potvrđeno', okvirno: 'Okvirno', provjeriti: 'Provjeriti' },
    wx: { sun: 'Vedro', cloudsun: 'Djelimično oblačno', cloud: 'Oblačno', fog: 'Magla', snow: 'Snijeg', storm: 'Grmljavina', rain: 'Kiša' },
    groups: { g: 'Glavna jela', d: 'Piće', p: 'Prilozi', z: 'Ostalo' },
    demo: 'Primjer', perPerson: ' po osobi', priceSoon: 'Cijena uskoro', inPlan: 'U planu', addPlan: 'Dodaj u plan', removePlan: 'Ukloni iz plana',
    verified: 'Provjereno ', offSeason: 'Van sezone u tom periodu',
    retry: 'Pokušaj ponovo', clearSearch: 'Očisti pretragu', offlineT: 'Nema internet veze', offlineD: 'Provjeri vezu. Pokušaćemo ponovo čim se vrati.', offBar: 'Nema internet veze',
    loadErrT: 'Podaci nisu učitani', loadErrD: 'Provjeri internet vezu i pokušaj ponovo.',
    noUpT: 'Nema nadolazećih događaja', noUpD: 'Pogledaj plaže, kulturu i gastronomiju.',
    found: 'Pronađeno: ', nothingT: 'Ništa nije pronađeno', nothingD: 'Probaj šire datume ili ukloni mjesto.',
    emptyPlanT: 'Plan je prazan', emptyPlanD: 'Dodaj događaje, plaže i restorane iz dijela Istraži.', goExplore: 'Idi na Istraži',
    shareHead: 'Moj put kroz Crnu Goru:\n', planCopied: 'Plan je kopiran.', copyFail: 'Kopiranje nije uspjelo.', linkCopied: 'Link kopiran',
    like: 'Sviđa mi se', unlike: 'Ukloni oznaku Sviđa mi se', share: 'Podijeli', zoom: 'Uvećaj fotografiju', vidToggle: 'Pokreni ili pauziraj video',
    soundOn: 'Uključi zvuk', soundOff: 'Isključi zvuk', playVideo: 'Pokreni video', photosVideo: 'Fotografije i video', photosSoon: 'Fotografije i video uskoro', photo: 'Fotografija', video: 'Video',
    back: 'Nazad', notFoundT: 'Stavka nije pronađena', notFoundLink: 'Link možda više ne važi.', notFoundGone: 'Možda je uklonjena ili link više ne važi.', detailErrT: 'Detalji nisu učitani',
    about: { event: 'O događaju', loc: 'O lokaciji', rest: 'O restoranu' }, whyHere: 'Zašto ovdje', info: 'Informacije', forecast: 'Vremenska prognoza', map: 'Mapa', menu: 'Meni',
    date: 'Datum', season: 'Sezona', location: 'Lokacija', website: 'Web stranica', reliab: 'Pouzdanost podataka', verifiedLc: ', provjereno ',
    placeLbl: 'Mjesto', phone: 'Telefon', rating: 'Ocjena', reviews: ' recenzija', billPer: 'Račun po osobi', pricesChecked: 'Cijene provjerene', allYear: 'Cijele godine',
    wxFail: 'Prognoza trenutno nije dostupna.', retry: 'Pokušaj ponovo', next7: 'Narednih 7 dana, ', next7b: '. Izaberi period da vidiš prognozu za svoj termin.',
    estNote: 'Dani sa isprekidanom ivicom su procjena na osnovu prethodnih godina. Stvarna prognoza je dostupna 16 dana unaprijed.', estAria: 'procjena, ', degrees: ' stepeni, ', data: 'Podaci: ',
    euroDec: ',',
  },
  en: {
    heroTitle: 'Montenegro<br>in your hand', heroSub: "What's on, where and when. Pick a place and your dates.",
    where: 'Where', wherePh: 'Herceg Novi, Kotor, Žabljak…', place: 'Place', placePh: 'All of Montenegro',
    from: 'From', to: 'To', pickDate: 'Pick a date', pickStart: 'Pick a start date', pickEndHint: ' · pick an end date, or apply for a single day',
    search: 'Search', soon: 'Coming up', allEvents: 'All events', whatToday: 'What would you like today?',
    explore: 'Explore', myTrip: 'My trip', sharePlan: 'Share plan', home: 'Home', mainNav: 'Main navigation', category: 'Category', all: 'All',
    clearPlace: 'Clear place', addPhoto: 'Add photo', changePhoto: 'Change photo', pickPeriod: 'Pick your dates', close: 'Close',
    weekend: 'Weekend', days7: '7 days', thisMonth: 'This month', prevMonth: 'Previous month', nextMonth: 'Next month', clear: 'Clear', apply: 'Apply',
    gallery: 'Photo gallery', prevPhoto: 'Previous photo', nextPhoto: 'Next photo', noscript: 'The Montepalm app needs JavaScript.',
    pageTitle: 'Montepalm: what to do in Montenegro', langLabel: 'Language',
    wd: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], dayn: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    ms: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    cats: { event: 'Events', beach: 'Beaches', food: 'Food & drink', culture: 'Culture' },
    kind: { event: 'Event', beach: 'Beach', food: 'Food & drink', culture: 'Culture' },
    sub: { event: "What's on and when", beach: 'Beaches and coves', food: 'Restaurants and taverns', culture: 'Sights and heritage' },
    status: { potvrdjeno: 'Confirmed', okvirno: 'Approximate', provjeriti: 'To be verified' },
    wx: { sun: 'Sunny', cloudsun: 'Partly cloudy', cloud: 'Cloudy', fog: 'Fog', snow: 'Snow', storm: 'Thunderstorm', rain: 'Rain' },
    groups: { g: 'Main dishes', d: 'Drinks', p: 'Sides', z: 'Other' },
    demo: 'Sample', perPerson: ' per person', priceSoon: 'Price coming soon', inPlan: 'In my trip', addPlan: 'Add to my trip', removePlan: 'Remove from my trip',
    verified: 'Verified ', offSeason: 'Out of season for those dates',
    retry: 'Try again', clearSearch: 'Clear search', offlineT: 'No internet connection', offlineD: 'Check your connection. We will retry as soon as it is back.', offBar: 'No internet connection',
    loadErrT: "Couldn't load data", loadErrD: 'Check your internet connection and try again.',
    noUpT: 'No upcoming events', noUpD: 'Have a look at beaches, culture and food.',
    found: 'Found: ', nothingT: 'Nothing found', nothingD: 'Try wider dates or clear the place.',
    emptyPlanT: 'Your trip is empty', emptyPlanD: 'Add events, beaches and restaurants from Explore.', goExplore: 'Go to Explore',
    shareHead: 'My trip through Montenegro:\n', planCopied: 'Plan copied.', copyFail: "Couldn't copy.", linkCopied: 'Link copied',
    like: 'Like', unlike: 'Remove like', share: 'Share', zoom: 'Enlarge photo', vidToggle: 'Play or pause video',
    soundOn: 'Turn sound on', soundOff: 'Turn sound off', playVideo: 'Play video', photosVideo: 'Photos and video', photosSoon: 'Photos and video coming soon', photo: 'Photo', video: 'Video',
    back: 'Back', notFoundT: 'Not found', notFoundLink: 'This link may no longer be valid.', notFoundGone: 'It may have been removed or the link is no longer valid.', detailErrT: "Couldn't load details",
    about: { event: 'About this event', loc: 'About this place', rest: 'About this restaurant' }, whyHere: 'Why here', info: 'Information', forecast: 'Weather forecast', map: 'Map', menu: 'Menu',
    date: 'Date', season: 'Season', location: 'Location', website: 'Website', reliab: 'Data reliability', verifiedLc: ', verified ',
    placeLbl: 'Place', phone: 'Phone', rating: 'Rating', reviews: ' reviews', billPer: 'Bill per person', pricesChecked: 'Prices verified', allYear: 'All year',
    wxFail: 'The forecast is not available right now.', retry: 'Try again', next7: 'Next 7 days, ', next7b: '. Pick dates to see the forecast for your trip.',
    estNote: 'Days with a dashed border are estimates based on previous years. The actual forecast is available 16 days ahead.', estAria: 'estimate, ', degrees: ' degrees, ', data: 'Data: ',
    euroDec: '.',
  },
};
const t = (k) => { const v = DICT[LANG][k]; return v !== undefined ? v : DICT.sr[k]; };
const tg = (g, k) => (DICT[LANG][g] && DICT[LANG][g][k]) || DICT.sr[g][k] || k;

/* statični tekstovi iz HTML-a: data-i18n (tekst), data-i18n-html, data-i18n-ph, data-i18n-aria, data-i18n-title */
function applyStatic() {
  document.documentElement.lang = LANG === 'en' ? 'en' : 'sr-Latn-ME';
  document.querySelectorAll('[data-i18n]').forEach((e) => { e.textContent = t(e.getAttribute('data-i18n')); });
  document.querySelectorAll('[data-i18n-html]').forEach((e) => { e.innerHTML = t(e.getAttribute('data-i18n-html')); });
  document.querySelectorAll('[data-i18n-ph]').forEach((e) => { e.setAttribute('placeholder', t(e.getAttribute('data-i18n-ph'))); });
  document.querySelectorAll('[data-i18n-aria]').forEach((e) => { e.setAttribute('aria-label', t(e.getAttribute('data-i18n-aria'))); });
  document.querySelectorAll('[data-i18n-title]').forEach((e) => { e.setAttribute('title', t(e.getAttribute('data-i18n-title'))); });
  document.querySelectorAll('.wd span').forEach((e, i) => { e.textContent = DICT[LANG].wd[i]; });
  const lb = document.getElementById('lbtn');
  if (lb) { lb.setAttribute('aria-label', t('langLabel')); lb.innerHTML = LANGS.map((l) => `<span class="${l === LANG ? 'on' : ''}">${l.toUpperCase()}</span>`).join(''); }
  document.title = t('pageTitle');
}
function setLang(l) {
  if (!LANGS.includes(l) || l === LANG) return;
  try { localStorage.setItem('mp.lang', l); } catch { /* ignore */ }
  location.reload();
}
