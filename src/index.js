import {
  EVENT_TYPES, HttpError, KINDS, MOODS, clamp, addDaysISO, climateDays, dailyRows, dateList, isDate, json, monthSummary, monthsBetween, norm, parseList, readJson, sha256, shapeItem,
  shapeMedia, shapeRestaurant, shiftYears,
} from './lib.js';
import { adminRoute, serveMedia } from './admin.js';

const SLUG = /^[a-z0-9-]{1,60}$/;

async function limited(binding, key) {
  if (!binding) return false; // lokalno / bez bindinga
  const { success } = await binding.limit({ key });
  return !success;
}

async function loadMenus(db, ids) {
  if (!ids.length) return new Map();
  const { results } = await db
    .prepare(`SELECT * FROM menu_items WHERE restaurant_id IN (${ids.map(() => '?').join(',')}) ORDER BY restaurant_id, sort, id`)
    .bind(...ids)
    .all();
  const map = new Map(ids.map((i) => [i, []]));
  for (const m of results) map.get(m.restaurant_id).push(m);
  return map;
}

async function listRestaurants(env, url) {
  const p = url.searchParams;
  const city = (p.get('city') || '').slice(0, 40);
  const cat = norm((p.get('cat') || '').slice(0, 30));
  const q = norm((p.get('q') || '').slice(0, 60));
  const mood = MOODS.includes(p.get('mood')) ? p.get('mood') : '';
  const max = clamp(p.get('max'), 0, 500, 500);
  const limit = clamp(p.get('limit'), 1, 100, 50) | 0;

  const stmt = city
    ? env.DB.prepare('SELECT * FROM restaurants WHERE active = 1 AND city = ? ORDER BY review_count DESC').bind(city)
    : env.DB.prepare('SELECT * FROM restaurants WHERE active = 1 ORDER BY review_count DESC');
  const { results: rows } = await stmt.all();
  const menus = await loadMenus(env.DB, rows.map((r) => r.id));

  const out = rows
    .map((r) => shapeRestaurant(r, menus.get(r.id)))
    .filter((r) => !cat || r.tags.some((t) => norm(t) === cat))
    .filter((r) => !mood || r.moods.includes(mood))
    .filter((r) => (r.price ? r.price.lo : 0) <= max)
    .filter((r) => !q || norm([r.name, ...r.tags, ...r.menu.map((m) => m.name)].join(' ')).includes(q))
    .slice(0, limit);
  return json({ restaurants: out });
}

async function listItems(env, url) {
  const p = url.searchParams;
  const place = norm((p.get('place') || '').slice(0, 40));
  const kind = KINDS.includes(p.get('kind')) ? p.get('kind') : '';
  let from = isDate(p.get('from')) ? p.get('from') : '';
  let to = isDate(p.get('to')) ? p.get('to') : '';
  if (from && to && from > to) [from, to] = [to, from];
  const limit = clamp(p.get('limit'), 1, 500, 200) | 0;
  const { results } = await env.DB
    .prepare('SELECT * FROM items WHERE active = 1 ORDER BY date_from IS NULL, date_from, title')
    .all();
  const ms = from && to ? monthsBetween(from, to) : null;
  const out = [];
  for (const r of results) {
    if (kind && r.kind !== kind) continue;
    if (place && !norm(r.place + ' ' + r.region).includes(place)) continue;
    let off = false;
    if (r.kind === 'event') {
      if (from && (r.date_to || r.date_from) < from) continue;
      if (to && r.date_from > to) continue;
    } else if (ms) {
      const m = parseList(r.months);
      off = m.length > 0 && !m.some((x) => ms.has(x));
    }
    out.push(shapeItem(r, off));
  }
  return json({ items: out.slice(0, limit) });
}

async function loadMedia(db, ref) {
  const { results } = await db.prepare('SELECT * FROM media WHERE ref = ? ORDER BY sort, id').bind(ref).all();
  return results.map(shapeMedia).filter(Boolean).slice(0, 30);
}

async function getItem(env, slug) {
  if (!SLUG.test(slug)) throw new HttpError(404, 'Stavka nije pronađena');
  const row = await env.DB.prepare('SELECT * FROM items WHERE active = 1 AND slug = ?').bind(slug).first();
  if (!row) throw new HttpError(404, 'Stavka nije pronađena');
  const site = /^https?:\/\//.test(row.website) ? row.website : '';
  return { item: { ...shapeItem(row), details: row.details, address: row.address, website: site }, media: await loadMedia(env.DB, 'i:' + slug) };
}

/* ---- prognoza (Open-Meteo): do 16 dana unaprijed stvarna, dalje prosjek istih datuma iz 3 prethodne godine ---- */
const TZ = 'Europe/Podgorica';
const todayLocal = (env) => env.TODAY || new Date().toLocaleDateString('sv-SE', { timeZone: TZ });

async function omJson(env, url) {
  try {
    const r = await (env.FETCH || fetch)(url, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) throw new Error('status ' + r.status);
    return await r.json();
  } catch {
    throw new HttpError(502, 'Prognoza trenutno nije dostupna');
  }
}

async function geocode(env, place) {
  const d = await omJson(env, 'https://geocoding-api.open-meteo.com/v1/search?count=1&language=sr&country_code=ME&name=' + encodeURIComponent(place));
  const r = d.results && d.results[0];
  return r ? { lat: r.latitude, lng: r.longitude } : null;
}

async function getWeather(env, url) {
  const p = url.searchParams;
  const m = /^([ir]):([a-z0-9-]{1,60})$/.exec(p.get('ref') || '');
  if (!m) throw new HttpError(400, 'Neispravna stavka');
  const sql = m[1] === 'i' ? 'SELECT place, lat, lng FROM items WHERE active = 1 AND slug = ?' : 'SELECT city AS place, lat, lng FROM restaurants WHERE active = 1 AND slug = ?';
  const row = await env.DB.prepare(sql).bind(m[2]).first();
  if (!row) throw new HttpError(404, 'Stavka nije pronađena');
  let { lat, lng } = row;
  if (lat == null || lng == null) ({ lat, lng } = (await geocode(env, row.place)) || {});
  if (lat == null || lng == null) return json({ available: false });
  lat = Math.round(lat * 100) / 100; lng = Math.round(lng * 100) / 100;

  const today = todayLocal(env), lastFc = addDaysISO(today, 15);
  let from = isDate(p.get('from')) ? p.get('from') : '', to = isDate(p.get('to')) ? p.get('to') : '';
  if (!from && !to) { from = today; to = addDaysISO(today, 6); }
  if (!from) from = to;
  if (!to) to = from;
  if (from > to) [from, to] = [to, from];
  if (from < today) from = today;
  if (to < from) to = from;
  if (to > addDaysISO(from, 365)) to = addDaysISO(from, 365);

  const key = `https://weather.montepalm.internal/${m[0]}/${from}/${to}/${today}`;
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  if (cache) { const hit = await cache.match(key); if (hit) return json(await hit.json()); }

  const dates = dateList(from, to), long = dates.length > 14;
  const fdates = long ? [] : dates.filter((d) => d <= lastFc);
  const cdates = long ? dates : dates.filter((d) => d > lastFc);
  const loc = `latitude=${lat}&longitude=${lng}&timezone=${encodeURIComponent(TZ)}`;

  const fc = fdates.length
    ? dailyRows(
        (await omJson(env, `https://api.open-meteo.com/v1/forecast?${loc}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&start_date=${fdates[0]}&end_date=${fdates.at(-1)}`)).daily,
        'forecast',
      )
    : [];

  let cl = [];
  if (cdates.length) {
    const cutoff = addDaysISO(today, -7);
    const reqs = [1, 2, 3].map(async (k) => {
      const a = shiftYears(cdates[0], k), b = shiftYears(cdates.at(-1), k);
      if (b > cutoff) return new Map();
      const d = await omJson(env, `https://archive-api.open-meteo.com/v1/archive?${loc}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&start_date=${a}&end_date=${b}`);
      return new Map(dailyRows(d.daily, 'archive').map((r) => [r.date, r]));
    });
    const got = await Promise.allSettled(reqs);
    if (got.every((g) => g.status === 'rejected')) throw new HttpError(502, 'Prognoza trenutno nije dostupna');
    cl = climateDays(cdates, got.map((g) => (g.status === 'fulfilled' ? g.value : new Map())));
  }

  const out = long
    ? { available: true, place: row.place, from, to, mode: 'monthly', months: monthSummary(cl) }
    : { available: true, place: row.place, from, to, mode: 'daily', days: [...fc, ...cl].sort((a, b) => (a.date < b.date ? -1 : 1)) };
  if (cache) {
    const ttl = fdates.length ? 1800 : 86400;
    await cache.put(key, new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json', 'cache-control': `max-age=${ttl}` } }));
  }
  return json(out);
}

async function getRestaurant(env, slug) {
  if (!SLUG.test(slug)) throw new HttpError(404, 'Restoran nije pronađen');
  const row = await env.DB.prepare('SELECT * FROM restaurants WHERE active = 1 AND slug = ?').bind(slug).first();
  if (!row) throw new HttpError(404, 'Restoran nije pronađen');
  const menus = await loadMenus(env.DB, [row.id]);
  return shapeRestaurant(row, menus.get(row.id));
}

async function recordEvent(env, request, slug) {
  if (!SLUG.test(slug)) throw new HttpError(404, 'Restoran nije pronađen');
  const { type } = await readJson(request, 200);
  if (!EVENT_TYPES.includes(type)) throw new HttpError(400, 'Nepoznat tip događaja');
  const row = await env.DB.prepare('SELECT id FROM restaurants WHERE active = 1 AND slug = ?').bind(slug).first();
  if (!row) throw new HttpError(404, 'Restoran nije pronađen');
  await env.DB
    .prepare(
      `INSERT INTO events (restaurant_id, day, type, n) VALUES (?, date('now'), ?, 1)
       ON CONFLICT(restaurant_id, day, type) DO UPDATE SET n = n + 1`,
    )
    .bind(row.id, type)
    .run();
  return new Response(null, { status: 204 });
}

async function ownerFromRequest(env, request) {
  const m = /^Bearer (.{20,100})$/.exec(request.headers.get('authorization') || '');
  if (!m) throw new HttpError(401, 'Neispravan ključ');
  const row = await env.DB
    .prepare('SELECT * FROM restaurants WHERE owner_key_hash = ? AND active = 1')
    .bind(await sha256(m[1]))
    .first();
  if (!row) throw new HttpError(401, 'Neispravan ključ');
  return row;
}

async function ownerView(env, row) {
  const menus = await loadMenus(env.DB, [row.id]);
  const { results } = await env.DB
    .prepare("SELECT type, SUM(n) AS total FROM events WHERE restaurant_id = ? AND day >= date('now', '-30 day') GROUP BY type")
    .bind(row.id)
    .all();
  const stats = { view: 0, call: 0, nav: 0 };
  for (const s of results) stats[s.type] = s.total;
  return { restaurant: shapeRestaurant(row, menus.get(row.id)), stats };
}

async function updatePrices(env, request, row) {
  const body = await readJson(request);
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 100) {
    throw new HttpError(400, 'Pošalji listu stavki (1–100)');
  }
  const stmts = [];
  for (const it of body.items) {
    const price = Number(it && it.price);
    if (!Number.isInteger(it && it.id) || !Number.isFinite(price) || price < 0 || price > 1000) {
      throw new HttpError(400, 'Neispravna stavka ili cijena (0–1000 €)');
    }
    // restaurant_id u WHERE sprječava izmjenu tuđih stavki
    stmts.push(
      env.DB.prepare('UPDATE menu_items SET price_cents = ? WHERE id = ? AND restaurant_id = ?').bind(Math.round(price * 100), it.id, row.id),
    );
  }
  stmts.push(env.DB.prepare("UPDATE restaurants SET verified_at = datetime('now') WHERE id = ?").bind(row.id));
  await env.DB.batch(stmts);
  const fresh = await env.DB.prepare('SELECT * FROM restaurants WHERE id = ?').bind(row.id).first();
  return json(await ownerView(env, fresh));
}

async function route(request, env, url) {
  const { pathname } = url;
  const method = request.method;
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  const seg = pathname.split('/').filter(Boolean); // ['api', ...]

  if (pathname === '/api/health') return json({ ok: true });

  if (seg[1] === 'm' && seg.length === 3 && method === 'GET') return serveMedia(env, request, seg[2]);

  if (await limited(env.RL, ip)) throw new HttpError(429, 'Previše zahtjeva, pokušaj ponovo za minut');

  if (pathname === '/api/items' && method === 'GET') return listItems(env, url);
  if (seg[1] === 'items' && seg.length === 3 && method === 'GET') return json(await getItem(env, seg[2]));
  if (pathname === '/api/weather' && method === 'GET') return getWeather(env, url);

  if (seg[1] === 'restaurants') {
    if (seg.length === 2 && method === 'GET') return listRestaurants(env, url);
    if (seg.length === 3 && method === 'GET') return json({ ...(await getRestaurant(env, seg[2])), media: await loadMedia(env.DB, 'r:' + seg[2]) });
    if (seg.length === 4 && seg[3] === 'event' && method === 'POST') return recordEvent(env, request, seg[2]);
  }

  if (pathname === '/api/offers' && method === 'GET') {
    const { results } = await env.DB
      .prepare('SELECT o.title, r.name AS restaurant, r.slug FROM offers o JOIN restaurants r ON r.id = o.restaurant_id WHERE o.active = 1 AND r.active = 1 ORDER BY o.id')
      .all();
    return json({ offers: results });
  }

  if (seg[1] === 'admin') {
    if (await limited(env.RL_AUTH, ip)) throw new HttpError(429, 'Previše pokušaja, pokušaj ponovo za minut');
    return adminRoute(request, env, pathname, method);
  }

  if (seg[1] === 'owner') {
    if (await limited(env.RL_AUTH, ip)) throw new HttpError(429, 'Previše pokušaja, pokušaj ponovo za minut');
    const row = await ownerFromRequest(env, request);
    if (pathname === '/api/owner/me' && method === 'GET') return json(await ownerView(env, row));
    if (pathname === '/api/owner/prices' && method === 'PUT') return updatePrices(env, request, row);
    if (pathname === '/api/owner/confirm' && method === 'POST') {
      await env.DB.prepare("UPDATE restaurants SET verified_at = datetime('now') WHERE id = ?").bind(row.id).run();
      const fresh = await env.DB.prepare('SELECT * FROM restaurants WHERE id = ?').bind(row.id).first();
      return json(await ownerView(env, fresh));
    }
  }

  throw new HttpError(404, 'Nepoznata ruta');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      return await route(request, env, url);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: 'Greška na serveru' }, 500);
    }
  },
};
