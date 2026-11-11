'use strict';
/* Jezik: sr (crnogorski/srpski), en, de, ru, it. Redoslijed: ?lang= iz linka, sačuvani izbor, jezik uređaja. */
const LANGS = ['sr', 'en', 'de', 'ru', 'it'];
const LANG_NAMES = { sr: 'Crnogorski', en: 'English', de: 'Deutsch', ru: 'Русский', it: 'Italiano' };
const HTML_LANG = { sr: 'sr-Latn-ME', en: 'en', de: 'de', ru: 'ru', it: 'it' };
let LANG = 'en';
(() => {
  let q = '', st = '';
  try { q = new URLSearchParams(location.search).get('lang') || ''; } catch { /* ignore */ }
  try { st = localStorage.getItem('mp.lang') || ''; } catch { /* ignore */ }
  if (LANGS.includes(q)) { LANG = q; try { localStorage.setItem('mp.lang', q); history.replaceState(null, '', location.pathname + location.hash); } catch { /* ignore */ } }
  else if (LANGS.includes(st)) LANG = st;
  else {
    const nav = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en']).map((l) => String(l).toLowerCase());
    const pick = (l) => (/^(sr|hr|bs|cnr|sh|me)/.test(l) ? 'sr' : /^(de|ru|it)/.test(l) ? l.slice(0, 2) : /^en/.test(l) ? 'en' : '');
    LANG = nav.map(pick).find(Boolean) || 'en';
  }
})();

const DICT = {
  sr: {
    heroTitle: 'Crna Gora<br>na dlanu', heroSub: 'Šta se dešava, gdje i kada. Izaberi mjesto i period.',
    where: 'Gdje', wherePh: 'Herceg Novi, Kotor, Žabljak…', place: 'Mjesto', placePh: 'Cijela Crna Gora',
    from: 'Od', to: 'Do', pickDate: 'Izaberi datum', pickStart: 'Izaberi početni datum', pickEndHint: ' · izaberi krajnji datum ili primijeni za jedan dan',
    search: 'Pretraži', soon: 'Uskoro', allEvents: 'Svi događaji', whatToday: 'Šta želiš danas?',
    explore: 'Istraži', myTrip: 'Moj put', sharePlan: 'Podijeli plan', addCal: 'Dodaj u kalendar', home: 'Početna', mainNav: 'Glavna navigacija', category: 'Kategorija', all: 'Sve',
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
    nearTitle: 'Danas i u blizini', nToday: 'Danas', nWeekend: 'Vikend', nNear: 'Blizu mene', nearNoneT: 'Nema događaja u ovom periodu', nearNoneD: 'Probaj „Blizu mene“ za mjesta oko tebe.', nearNoLocT: 'Nema ničega u blizini', nearNoLocD: 'Za ova mjesta još nemamo lokaciju.', locDenied: 'Lokacija nije dostupna. Provjeri dozvolu za lokaciju.',
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
    useful: 'Korisno', usefulSub: 'Brojevi, prevoz, novac i običaji na jednom mjestu.',
    euroDec: ',',
  },
  en: {
    heroTitle: 'Montenegro<br>in your hand', heroSub: "What's on, where and when. Pick a place and your dates.",
    where: 'Where', wherePh: 'Herceg Novi, Kotor, Žabljak…', place: 'Place', placePh: 'All of Montenegro',
    from: 'From', to: 'To', pickDate: 'Pick a date', pickStart: 'Pick a start date', pickEndHint: ' · pick an end date, or apply for a single day',
    search: 'Search', soon: 'Coming up', allEvents: 'All events', whatToday: 'What would you like today?',
    explore: 'Explore', myTrip: 'My trip', sharePlan: 'Share plan', addCal: 'Add to calendar', home: 'Home', mainNav: 'Main navigation', category: 'Category', all: 'All',
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
    nearTitle: 'Today & nearby', nToday: 'Today', nWeekend: 'Weekend', nNear: 'Near me', nearNoneT: 'No events in this period', nearNoneD: 'Try “Near me” for places around you.', nearNoLocT: 'Nothing nearby', nearNoLocD: 'We do not have a location for these places yet.', locDenied: 'Location unavailable. Check the location permission.',
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
    useful: 'Useful', usefulSub: 'Numbers, transport, money and local customs in one place.',
    euroDec: '.',
  },
  de: {
    heroTitle: 'Montenegro<br>in deiner Hand', heroSub: 'Was los ist, wo und wann. Wähle Ort und Reisezeitraum.',
    where: 'Wo', wherePh: 'Herceg Novi, Kotor, Žabljak…', place: 'Ort', placePh: 'Ganz Montenegro',
    from: 'Von', to: 'Bis', pickDate: 'Datum wählen', pickStart: 'Startdatum wählen', pickEndHint: ' · Enddatum wählen oder für einen Tag übernehmen',
    search: 'Suchen', soon: 'Demnächst', allEvents: 'Alle Veranstaltungen', whatToday: 'Was möchtest du heute?',
    explore: 'Entdecken', myTrip: 'Meine Reise', sharePlan: 'Plan teilen', addCal: 'Zum Kalender hinzufügen', home: 'Start', mainNav: 'Hauptnavigation', category: 'Kategorie', all: 'Alle',
    clearPlace: 'Ort löschen', addPhoto: 'Foto hinzufügen', changePhoto: 'Foto ändern', pickPeriod: 'Zeitraum wählen', close: 'Schließen',
    weekend: 'Wochenende', days7: '7 Tage', thisMonth: 'Dieser Monat', prevMonth: 'Vorheriger Monat', nextMonth: 'Nächster Monat', clear: 'Löschen', apply: 'Übernehmen',
    gallery: 'Fotogalerie', prevPhoto: 'Vorheriges Foto', nextPhoto: 'Nächstes Foto', noscript: 'Die Montepalm-App benötigt JavaScript.',
    pageTitle: 'Montepalm: was es in Montenegro zu erleben gibt', langLabel: 'Sprache',
    wd: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'], dayn: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
    ms: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
    months: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
    cats: { event: 'Veranstaltungen', beach: 'Strände', food: 'Essen & Trinken', culture: 'Kultur' },
    kind: { event: 'Veranstaltung', beach: 'Strand', food: 'Essen & Trinken', culture: 'Kultur' },
    sub: { event: 'Was los ist und wann', beach: 'Strände und Buchten', food: 'Restaurants und Konobas', culture: 'Sehenswürdigkeiten und Kulturerbe' },
    status: { potvrdjeno: 'Bestätigt', okvirno: 'Ungefähr', provjeriti: 'Zu prüfen' },
    wx: { sun: 'Sonnig', cloudsun: 'Teils bewölkt', cloud: 'Bewölkt', fog: 'Nebel', snow: 'Schnee', storm: 'Gewitter', rain: 'Regen' },
    groups: { g: 'Hauptgerichte', d: 'Getränke', p: 'Beilagen', z: 'Sonstiges' },
    demo: 'Beispiel', perPerson: ' pro Person', priceSoon: 'Preis folgt', inPlan: 'In meiner Reise', addPlan: 'Zur Reise hinzufügen', removePlan: 'Aus der Reise entfernen',
    verified: 'Geprüft ', offSeason: 'In diesem Zeitraum außerhalb der Saison',
    retry: 'Erneut versuchen', clearSearch: 'Suche zurücksetzen', offlineT: 'Keine Internetverbindung', offlineD: 'Prüfe deine Verbindung. Wir versuchen es erneut, sobald sie wieder da ist.', offBar: 'Keine Internetverbindung',
    nearTitle: 'Heute & in der Nähe', nToday: 'Heute', nWeekend: 'Wochenende', nNear: 'In meiner Nähe', nearNoneT: 'Keine Veranstaltungen in diesem Zeitraum', nearNoneD: 'Probiere „In meiner Nähe“ für Orte um dich herum.', nearNoLocT: 'Nichts in der Nähe', nearNoLocD: 'Für diese Orte haben wir noch keinen Standort.', locDenied: 'Standort nicht verfügbar. Prüfe die Standortfreigabe.',
    loadErrT: 'Daten konnten nicht geladen werden', loadErrD: 'Prüfe deine Internetverbindung und versuche es erneut.',
    noUpT: 'Keine kommenden Veranstaltungen', noUpD: 'Schau dir Strände, Kultur und Gastronomie an.',
    found: 'Gefunden: ', nothingT: 'Nichts gefunden', nothingD: 'Versuche einen größeren Zeitraum oder entferne den Ort.',
    emptyPlanT: 'Deine Reise ist leer', emptyPlanD: 'Füge Veranstaltungen, Strände und Restaurants unter „Entdecken“ hinzu.', goExplore: 'Zu „Entdecken“',
    shareHead: 'Meine Reise durch Montenegro:\n', planCopied: 'Plan kopiert.', copyFail: 'Kopieren fehlgeschlagen.', linkCopied: 'Link kopiert',
    like: 'Gefällt mir', unlike: '„Gefällt mir“ entfernen', share: 'Teilen', zoom: 'Foto vergrößern', vidToggle: 'Video abspielen oder pausieren',
    soundOn: 'Ton einschalten', soundOff: 'Ton ausschalten', playVideo: 'Video abspielen', photosVideo: 'Fotos und Video', photosSoon: 'Fotos und Video folgen bald', photo: 'Foto', video: 'Video',
    back: 'Zurück', notFoundT: 'Nicht gefunden', notFoundLink: 'Dieser Link ist möglicherweise nicht mehr gültig.', notFoundGone: 'Der Eintrag wurde möglicherweise entfernt oder der Link ist nicht mehr gültig.', detailErrT: 'Details konnten nicht geladen werden',
    about: { event: 'Über die Veranstaltung', loc: 'Über den Ort', rest: 'Über das Restaurant' }, whyHere: 'Warum hier', info: 'Informationen', forecast: 'Wettervorhersage', map: 'Karte', menu: 'Speisekarte',
    date: 'Datum', season: 'Saison', location: 'Standort', website: 'Webseite', reliab: 'Zuverlässigkeit der Daten', verifiedLc: ', geprüft ',
    placeLbl: 'Ort', phone: 'Telefon', rating: 'Bewertung', reviews: ' Bewertungen', billPer: 'Rechnung pro Person', pricesChecked: 'Preise geprüft', allYear: 'Ganzjährig',
    wxFail: 'Die Vorhersage ist derzeit nicht verfügbar.', next7: 'Nächste 7 Tage, ', next7b: '. Wähle einen Zeitraum, um die Vorhersage für deine Reise zu sehen.',
    estNote: 'Tage mit gestricheltem Rand sind Schätzungen auf Grundlage früherer Jahre. Die tatsächliche Vorhersage gibt es 16 Tage im Voraus.', estAria: 'Schätzung, ', degrees: ' Grad, ', data: 'Daten: ',
    useful: 'Wissenswert', usefulSub: 'Nummern, Verkehr, Geld und Bräuche an einem Ort.',
    euroDec: ',',
  },
  ru: {
    heroTitle: 'Черногория<br>на ладони', heroSub: 'Что, где и когда. Выберите место и даты.',
    where: 'Где', wherePh: 'Герцег-Нови, Котор, Жабляк…', place: 'Место', placePh: 'Вся Черногория',
    from: 'С', to: 'По', pickDate: 'Выберите дату', pickStart: 'Выберите дату начала', pickEndHint: ' · выберите дату окончания или примените для одного дня',
    search: 'Найти', soon: 'Скоро', allEvents: 'Все события', whatToday: 'Что хотите сегодня?',
    explore: 'Обзор', myTrip: 'Моя поездка', sharePlan: 'Поделиться планом', addCal: 'Добавить в календарь', home: 'Главная', mainNav: 'Главная навигация', category: 'Категория', all: 'Все',
    clearPlace: 'Очистить место', addPhoto: 'Добавить фото', changePhoto: 'Изменить фото', pickPeriod: 'Выберите даты', close: 'Закрыть',
    weekend: 'Выходные', days7: '7 дней', thisMonth: 'Этот месяц', prevMonth: 'Предыдущий месяц', nextMonth: 'Следующий месяц', clear: 'Очистить', apply: 'Применить',
    gallery: 'Галерея фотографий', prevPhoto: 'Предыдущее фото', nextPhoto: 'Следующее фото', noscript: 'Для работы приложения Montepalm нужен JavaScript.',
    pageTitle: 'Montepalm: что посмотреть в Черногории', langLabel: 'Язык',
    wd: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'], dayn: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
    ms: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
    months: ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'],
    monthsG: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
    cats: { event: 'События', beach: 'Пляжи', food: 'Еда и напитки', culture: 'Культура' },
    kind: { event: 'Событие', beach: 'Пляж', food: 'Еда и напитки', culture: 'Культура' },
    sub: { event: 'Что и когда проходит', beach: 'Пляжи и бухты', food: 'Рестораны и конобы', culture: 'Достопримечательности и наследие' },
    status: { potvrdjeno: 'Подтверждено', okvirno: 'Примерно', provjeriti: 'Требует проверки' },
    wx: { sun: 'Ясно', cloudsun: 'Переменная облачность', cloud: 'Облачно', fog: 'Туман', snow: 'Снег', storm: 'Гроза', rain: 'Дождь' },
    groups: { g: 'Основные блюда', d: 'Напитки', p: 'Гарниры', z: 'Прочее' },
    demo: 'Пример', perPerson: ' на человека', priceSoon: 'Цена скоро появится', inPlan: 'В поездке', addPlan: 'Добавить в поездку', removePlan: 'Убрать из поездки',
    verified: 'Проверено ', offSeason: 'Вне сезона в эти даты',
    retry: 'Повторить', clearSearch: 'Сбросить поиск', offlineT: 'Нет подключения к интернету', offlineD: 'Проверьте соединение. Мы повторим попытку, как только оно появится.', offBar: 'Нет подключения к интернету',
    nearTitle: 'Сегодня и рядом', nToday: 'Сегодня', nWeekend: 'Выходные', nNear: 'Рядом со мной', nearNoneT: 'В этот период событий нет', nearNoneD: 'Попробуйте «Рядом со мной», чтобы увидеть места вокруг.', nearNoLocT: 'Поблизости ничего нет', nearNoLocD: 'Для этих мест у нас пока нет геолокации.', locDenied: 'Местоположение недоступно. Проверьте разрешение на геолокацию.',
    loadErrT: 'Не удалось загрузить данные', loadErrD: 'Проверьте интернет-соединение и повторите попытку.',
    noUpT: 'Нет предстоящих событий', noUpD: 'Посмотрите пляжи, культуру и гастрономию.',
    found: 'Найдено: ', nothingT: 'Ничего не найдено', nothingD: 'Попробуйте более широкий период или уберите место.',
    emptyPlanT: 'Поездка пуста', emptyPlanD: 'Добавьте события, пляжи и рестораны из раздела «Обзор».', goExplore: 'Перейти к обзору',
    shareHead: 'Моя поездка по Черногории:\n', planCopied: 'План скопирован.', copyFail: 'Не удалось скопировать.', linkCopied: 'Ссылка скопирована',
    like: 'Нравится', unlike: 'Убрать отметку «Нравится»', share: 'Поделиться', zoom: 'Увеличить фото', vidToggle: 'Запустить или остановить видео',
    soundOn: 'Включить звук', soundOff: 'Выключить звук', playVideo: 'Запустить видео', photosVideo: 'Фото и видео', photosSoon: 'Фото и видео скоро появятся', photo: 'Фото', video: 'Видео',
    back: 'Назад', notFoundT: 'Не найдено', notFoundLink: 'Возможно, ссылка больше не действует.', notFoundGone: 'Возможно, запись удалена или ссылка больше не действует.', detailErrT: 'Не удалось загрузить подробности',
    about: { event: 'О событии', loc: 'О месте', rest: 'О ресторане' }, whyHere: 'Почему здесь', info: 'Информация', forecast: 'Прогноз погоды', map: 'Карта', menu: 'Меню',
    date: 'Дата', season: 'Сезон', location: 'Расположение', website: 'Сайт', reliab: 'Достоверность данных', verifiedLc: ', проверено ',
    placeLbl: 'Место', phone: 'Телефон', rating: 'Рейтинг', reviews: ' отзывов', billPer: 'Счёт на человека', pricesChecked: 'Цены проверены', allYear: 'Круглый год',
    wxFail: 'Прогноз сейчас недоступен.', next7: 'Ближайшие 7 дней, ', next7b: '. Выберите даты, чтобы увидеть прогноз на время поездки.',
    estNote: 'Дни с пунктирной рамкой — оценка по данным прошлых лет. Фактический прогноз доступен за 16 дней.', estAria: 'оценка, ', degrees: ' градусов, ', data: 'Данные: ',
    useful: 'Полезное', usefulSub: 'Номера, транспорт, деньги и обычаи в одном месте.',
    euroDec: ',',
  },
  it: {
    heroTitle: 'Montenegro<br>a portata di mano', heroSub: 'Cosa succede, dove e quando. Scegli il luogo e le date.',
    where: 'Dove', wherePh: 'Herceg Novi, Kotor, Žabljak…', place: 'Luogo', placePh: 'Tutto il Montenegro',
    from: 'Dal', to: 'Al', pickDate: 'Scegli una data', pickStart: 'Scegli la data di inizio', pickEndHint: ' · scegli la data di fine oppure applica per un solo giorno',
    search: 'Cerca', soon: 'In arrivo', allEvents: 'Tutti gli eventi', whatToday: 'Cosa ti va oggi?',
    explore: 'Esplora', myTrip: 'Il mio viaggio', sharePlan: 'Condividi il piano', addCal: 'Aggiungi al calendario', home: 'Home', mainNav: 'Navigazione principale', category: 'Categoria', all: 'Tutto',
    clearPlace: 'Cancella luogo', addPhoto: 'Aggiungi foto', changePhoto: 'Cambia foto', pickPeriod: 'Scegli le date', close: 'Chiudi',
    weekend: 'Weekend', days7: '7 giorni', thisMonth: 'Questo mese', prevMonth: 'Mese precedente', nextMonth: 'Mese successivo', clear: 'Cancella', apply: 'Applica',
    gallery: 'Galleria fotografica', prevPhoto: 'Foto precedente', nextPhoto: 'Foto successiva', noscript: "L'app Montepalm richiede JavaScript.",
    pageTitle: 'Montepalm: cosa fare in Montenegro', langLabel: 'Lingua',
    wd: ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'], dayn: ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'],
    ms: ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'],
    months: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
    cats: { event: 'Eventi', beach: 'Spiagge', food: 'Cibo e bevande', culture: 'Cultura' },
    kind: { event: 'Evento', beach: 'Spiaggia', food: 'Cibo e bevande', culture: 'Cultura' },
    sub: { event: 'Cosa succede e quando', beach: 'Spiagge e calette', food: 'Ristoranti e konobe', culture: 'Monumenti e patrimonio' },
    status: { potvrdjeno: 'Confermato', okvirno: 'Indicativo', provjeriti: 'Da verificare' },
    wx: { sun: 'Sereno', cloudsun: 'Parzialmente nuvoloso', cloud: 'Nuvoloso', fog: 'Nebbia', snow: 'Neve', storm: 'Temporale', rain: 'Pioggia' },
    groups: { g: 'Piatti principali', d: 'Bevande', p: 'Contorni', z: 'Altro' },
    demo: 'Esempio', perPerson: ' a persona', priceSoon: 'Prezzo in arrivo', inPlan: 'Nel mio viaggio', addPlan: 'Aggiungi al viaggio', removePlan: 'Rimuovi dal viaggio',
    verified: 'Verificato ', offSeason: 'Fuori stagione in queste date',
    retry: 'Riprova', clearSearch: 'Cancella la ricerca', offlineT: 'Nessuna connessione internet', offlineD: 'Controlla la connessione. Riproveremo appena torna disponibile.', offBar: 'Nessuna connessione internet',
    nearTitle: 'Oggi e nelle vicinanze', nToday: 'Oggi', nWeekend: 'Weekend', nNear: 'Vicino a me', nearNoneT: 'Nessun evento in questo periodo', nearNoneD: 'Prova «Vicino a me» per vedere i luoghi intorno a te.', nearNoLocT: 'Niente nelle vicinanze', nearNoLocD: 'Per questi luoghi non abbiamo ancora la posizione.', locDenied: 'Posizione non disponibile. Controlla il permesso di localizzazione.',
    loadErrT: 'Impossibile caricare i dati', loadErrD: 'Controlla la connessione internet e riprova.',
    noUpT: 'Nessun evento in programma', noUpD: 'Dai un’occhiata a spiagge, cultura e gastronomia.',
    found: 'Trovati: ', nothingT: 'Nessun risultato', nothingD: 'Prova con date più ampie o rimuovi il luogo.',
    emptyPlanT: 'Il tuo viaggio è vuoto', emptyPlanD: 'Aggiungi eventi, spiagge e ristoranti dalla sezione Esplora.', goExplore: 'Vai a Esplora',
    shareHead: 'Il mio viaggio in Montenegro:\n', planCopied: 'Piano copiato.', copyFail: 'Copia non riuscita.', linkCopied: 'Link copiato',
    like: 'Mi piace', unlike: 'Rimuovi Mi piace', share: 'Condividi', zoom: 'Ingrandisci la foto', vidToggle: 'Avvia o metti in pausa il video',
    soundOn: 'Attiva l’audio', soundOff: 'Disattiva l’audio', playVideo: 'Avvia il video', photosVideo: 'Foto e video', photosSoon: 'Foto e video in arrivo', photo: 'Foto', video: 'Video',
    back: 'Indietro', notFoundT: 'Non trovato', notFoundLink: 'Questo link potrebbe non essere più valido.', notFoundGone: 'Potrebbe essere stato rimosso o il link non è più valido.', detailErrT: 'Impossibile caricare i dettagli',
    about: { event: 'Sull’evento', loc: 'Sul luogo', rest: 'Sul ristorante' }, whyHere: 'Perché qui', info: 'Informazioni', forecast: 'Previsioni del tempo', map: 'Mappa', menu: 'Menù',
    date: 'Data', season: 'Stagione', location: 'Posizione', website: 'Sito web', reliab: 'Affidabilità dei dati', verifiedLc: ', verificato ',
    placeLbl: 'Luogo', phone: 'Telefono', rating: 'Valutazione', reviews: ' recensioni', billPer: 'Conto a persona', pricesChecked: 'Prezzi verificati', allYear: 'Tutto l’anno',
    wxFail: 'Le previsioni non sono al momento disponibili.', next7: 'Prossimi 7 giorni, ', next7b: '. Scegli le date per vedere le previsioni del tuo viaggio.',
    estNote: 'I giorni con bordo tratteggiato sono stime basate sugli anni precedenti. Le previsioni effettive sono disponibili 16 giorni prima.', estAria: 'stima, ', degrees: ' gradi, ', data: 'Dati: ',
    useful: 'Utile', usefulSub: 'Numeri, trasporti, denaro e usanze in un unico posto.',
    euroDec: ',',
  },
};
const t = (k) => { const v = DICT[LANG][k]; return v !== undefined ? v : DICT.en[k] !== undefined ? DICT.en[k] : DICT.sr[k]; };
const tg = (g, k) => (DICT[LANG][g] && DICT[LANG][g][k]) || (DICT.en[g] && DICT.en[g][k]) || DICT.sr[g][k] || k;

/* statični tekstovi iz HTML-a: data-i18n (tekst), data-i18n-html, data-i18n-ph, data-i18n-aria, data-i18n-title */
function applyStatic() {
  document.documentElement.lang = HTML_LANG[LANG];
  document.querySelectorAll('[data-i18n]').forEach((e) => { e.textContent = t(e.getAttribute('data-i18n')); });
  document.querySelectorAll('[data-i18n-html]').forEach((e) => { e.innerHTML = t(e.getAttribute('data-i18n-html')); });
  document.querySelectorAll('[data-i18n-ph]').forEach((e) => { e.setAttribute('placeholder', t(e.getAttribute('data-i18n-ph'))); });
  document.querySelectorAll('[data-i18n-aria]').forEach((e) => { e.setAttribute('aria-label', t(e.getAttribute('data-i18n-aria'))); });
  document.querySelectorAll('[data-i18n-title]').forEach((e) => { e.setAttribute('title', t(e.getAttribute('data-i18n-title'))); });
  document.querySelectorAll('.wd span').forEach((e, i) => { e.textContent = DICT[LANG].wd[i]; });
  const lb = document.getElementById('lbtn');
  if (lb) {
    lb.setAttribute('aria-label', t('langLabel')); lb.setAttribute('aria-haspopup', 'true'); lb.setAttribute('aria-expanded', 'false');
    lb.innerHTML = `<span class="on">${LANG.toUpperCase()}</span><svg class="ic" aria-hidden="true"><use href="#i-down"/></svg>`;
    let m = document.getElementById('lmenu');
    if (!m) { m = document.createElement('div'); m.id = 'lmenu'; m.className = 'lmenu'; m.hidden = true; lb.insertAdjacentElement('afterend', m); }
    m.innerHTML = LANGS.map((l) => `<button type="button" data-lang="${l}" lang="${HTML_LANG[l]}"${l === LANG ? ' aria-current="true"' : ''}><b>${l.toUpperCase()}</b> ${LANG_NAMES[l]}</button>`).join('');
  }
  document.title = t('pageTitle');
}
function setLang(l) {
  if (!LANGS.includes(l) || l === LANG) return;
  try { localStorage.setItem('mp.lang', l); } catch { /* ignore */ }
  location.reload();
}
