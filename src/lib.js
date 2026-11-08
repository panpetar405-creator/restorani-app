export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const ART_KEYS = ['terasa', 'zaliv', 'riva', 'kafic', 'orada', 'salata', 'tuna', 'pasta', 'pizza'];
export const MOODS = ['rom', 'fam'];
export const EVENT_TYPES = ['view', 'call', 'nav'];

export const clamp = (v, lo, hi, d) => {
  if (v === null || v === undefined || v === '') return d;
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

// Ćirilica (ruski, srpski) se pretvara u latinicu da bi pretraga mjesta radila i kad se kuca ćirilicom.
const CYR = { 'а':'a','б':'b','в':'v','г':'g','д':'d','ђ':'d','е':'e','ё':'e','ж':'z','з':'z','и':'i','й':'j','ј':'j','к':'k','л':'l','љ':'lj','м':'m','н':'n','њ':'nj','о':'o','п':'p','р':'r','с':'s','т':'t','ћ':'c','у':'u','ф':'f','х':'h','ц':'c','ч':'c','џ':'dz','ш':'s','щ':'sc','ъ':'','ы':'i','ь':'','э':'e','ю':'ju','я':'ja' };
export const norm = (t) =>
  String(t).toLowerCase().replace(/[\u0400-\u04ff]/g, (c) => (c in CYR ? CYR[c] : c)).replace(/gerceg/g, 'herceg').replace(/cetine\b/g, 'cetinje')
    .replace(/đ/g, 'd').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });

export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function readJson(request, maxBytes = 20000) {
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, 'Zahtjev je prevelik');
  try {
    const data = JSON.parse(text);
    if (data === null || typeof data !== 'object') throw new Error();
    return data;
  } catch {
    throw new HttpError(400, 'Neispravan JSON');
  }
}

export const parseList = (s) => {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

/**
 * Račun po osobi = glavno jelo + piće + pola priloga (prilog se dijeli na dvoje).
 * Raspon ide od najjeftinije do najskuplje kombinacije. Računa se iz menija,
 * pa se mijenja čim vlasnik promijeni cijene.
 */
export function estimate(menu) {
  const by = (k) => menu.filter((m) => m.kind === k).map((m) => m.price);
  const g = by('g'), d = by('d'), p = by('p'), z = by('z');
  const price = g.length
    ? {
        lo: Math.round(Math.min(...g) + (d.length ? Math.min(...d) : 0) + (p.length ? Math.min(...p) / 2 : 0)),
        hi: Math.round(Math.max(...g) + (d.length ? Math.max(...d) : 0) + (p.length ? Math.max(...p) / 2 : 0)),
      }
    : null;
  return { price, calc: [avg(g), avg(d), avg(p), avg(z)].map(Math.round) };
}

export function shapeRestaurant(row, items, lang = 'sr') {
  const menu = items.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    price: m.price_cents / 100,
    art: m.art,
    kind: m.kind,
  }));
  const { price, calc } = estimate(menu);
  return {
    slug: row.slug,
    name: row.name,
    city: row.city,
    rating: row.rating,
    reviews: row.review_count,
    tags: parseList(row.tags),
    amenities: parseList(row.amenities),
    moods: parseList(row.moods),
    why: parseList(row.why),
    ambience: (foreign(lang) && row.ambience_en) || row.ambience,
    art: ART_KEYS.includes(row.art) ? row.art : 'terasa',
    km: row.km,
    phone: row.phone && /^\+?[0-9 ]{6,20}$/.test(row.phone) ? row.phone : null,
    lat: row.lat,
    lng: row.lng,
    verifiedAt: row.verified_at,
    price,
    calc,
    menu,
  };
}

export const KINDS = ['event', 'beach', 'culture'];

export const isDate = (s) => typeof s === 'string' && /^\d{4}-\d\d-\d\d$/.test(s) && !Number.isNaN(Date.parse(s));

/** Skup mjeseci (1-12) koje period od-do dodiruje. */
export function monthsBetween(from, to) {
  const out = new Set();
  const d = new Date(from + 'T00:00:00Z');
  const e = new Date(to + 'T00:00:00Z');
  for (let n = 0; d <= e && n < 400; n++) {
    out.add(d.getUTCMonth() + 1);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export const LANGS = ['sr', 'en', 'de', 'ru', 'it'];
export const pickLang = (url) => { const l = url && url.searchParams && url.searchParams.get('lang'); return LANGS.includes(l) ? l : 'sr'; };
// Sadržaj u bazi je crnogorski + engleski. Za de/ru/it se prikazuje engleski prevod (ako postoji), inače crnogorski.
export const foreign = (lang) => lang !== 'sr';

export function shapeItem(row, offSeason = false, lang = 'sr') {
  const en = foreign(lang);
  return {
    slug: row.slug,
    kind: row.kind,
    title: (en && row.title_en) || row.title,
    place: row.place,
    region: row.region,
    description: (en && row.description_en) || row.description,
    from: row.date_from,
    to: row.date_to,
    months: parseList(row.months),
    source: row.source,
    sourceUrl: /^https?:\/\//.test(row.source_url) ? row.source_url : '',
    status: row.status,
    verifiedAt: row.verified_at,
    demo: !!row.demo,
    lat: row.lat,
    lng: row.lng,
    offSeason,
  };
}

/* ---------- mediji ---------- */
const httpsOnly = (u) => (typeof u === 'string' && (/^https:\/\/[^\s"'<>]+$/.test(u) || /^\/api\/m\/[0-9a-f-]{36}\.[a-z0-9]{3,4}$/.test(u) || /^\/media\/[A-Za-z0-9._-]{1,100}$/.test(u)) ? u : '');

export function shapeMedia(row) {
  const base = { caption: row.caption || '', credit: row.credit || '' };
  if (row.type === 'youtube') {
    const m = /(?:^|v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})(?:[?&#]|$)/.exec(String(row.url));
    if (!m) return null;
    return { type: 'youtube', id: m[1], poster: `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg`, ...base };
  }
  const url = httpsOnly(row.url);
  if (!url) return null;
  return { type: row.type === 'video' ? 'video' : 'image', url, poster: httpsOnly(row.poster), ...base };
}

/* ---------- prognoza ---------- */
const pad2 = (n) => String(n).padStart(2, '0');

export const addDaysISO = (s, n) => {
  const d = new Date(s + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function dateList(from, to) {
  const out = [];
  for (let d = from; d <= to && out.length < 400; d = addDaysISO(d, 1)) out.push(d);
  return out;
}

/** Isti dan prije k godina (29. 2. se spušta na 28. 2.). */
export function shiftYears(s, k) {
  const [y, m, d] = s.split('-').map(Number);
  const last = new Date(Date.UTC(y - k, m, 0)).getUTCDate();
  return `${y - k}-${pad2(m)}-${pad2(Math.min(d, last))}`;
}

/** Red-po-red iz Open-Meteo "daily" objekta. */
export function dailyRows(daily, src) {
  const t = (daily && daily.time) || [];
  return t.map((date, i) => ({
    date,
    tmax: Math.round(daily.temperature_2m_max[i]),
    tmin: Math.round(daily.temperature_2m_min[i]),
    rain: Math.round((daily.precipitation_sum[i] || 0) * 10) / 10,
    prob: daily.precipitation_probability_max ? daily.precipitation_probability_max[i] : null,
    code: daily.weather_code ? daily.weather_code[i] : null,
    src,
  }));
}

/** Prosjek istih datuma iz prethodnih godina. yearMaps[i]: Map(datum -> red) za godinu k = i + 1. */
export function climateDays(dates, yearMaps) {
  const out = [];
  for (const date of dates) {
    const v = yearMaps.map((m, i) => m.get(shiftYears(date, i + 1))).filter((r) => r && Number.isFinite(r.tmax) && Number.isFinite(r.tmin));
    if (!v.length) continue;
    out.push({
      date,
      tmax: Math.round(avg(v.map((r) => r.tmax))),
      tmin: Math.round(avg(v.map((r) => r.tmin))),
      rain: Math.round(avg(v.map((r) => r.rain)) * 10) / 10,
      wet: Math.round((v.filter((r) => r.rain >= 1).length / v.length) * 100),
      src: 'climate',
    });
  }
  return out;
}

export function monthSummary(days) {
  const g = new Map();
  for (const d of days) {
    const k = d.date.slice(0, 7);
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(d);
  }
  return [...g].map(([month, l]) => ({
    month,
    days: l.length,
    tmax: Math.round(avg(l.map((d) => d.tmax))),
    tmin: Math.round(avg(l.map((d) => d.tmin))),
    wetDays: Math.round(l.reduce((s, d) => s + d.wet / 100, 0)),
  }));
}
