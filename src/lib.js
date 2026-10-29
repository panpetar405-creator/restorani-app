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

export const norm = (t) =>
  String(t).toLowerCase().replace(/đ/g, 'd').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

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

const parseList = (s) => {
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

export function shapeRestaurant(row, items) {
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
    ambience: row.ambience,
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
