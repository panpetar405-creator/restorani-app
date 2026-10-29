import {
  EVENT_TYPES, HttpError, MOODS, clamp, json, norm, readJson, sha256, shapeRestaurant,
} from './lib.js';

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

  if (await limited(env.RL, ip)) throw new HttpError(429, 'Previše zahtjeva, pokušaj ponovo za minut');

  if (seg[1] === 'restaurants') {
    if (seg.length === 2 && method === 'GET') return listRestaurants(env, url);
    if (seg.length === 3 && method === 'GET') return json(await getRestaurant(env, seg[2]));
    if (seg.length === 4 && seg[3] === 'event' && method === 'POST') return recordEvent(env, request, seg[2]);
  }

  if (pathname === '/api/offers' && method === 'GET') {
    const { results } = await env.DB
      .prepare('SELECT o.title, r.name AS restaurant, r.slug FROM offers o JOIN restaurants r ON r.id = o.restaurant_id WHERE o.active = 1 AND r.active = 1 ORDER BY o.id')
      .all();
    return json({ offers: results });
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
