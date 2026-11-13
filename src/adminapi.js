// Admin API: izmjena opisa i podataka, te upload slika i videa (Cloudflare R2).
// Zaštita: jedan tajni ključ (secret ADMIN_KEY), šalje se kao "Authorization: Bearer ...".
import { adminPush } from './push.js';
import { adminPartners } from './partners.js';
import { HttpError, KINDS, isDate, json, norm, parseList, readJson, sha256, shapeMedia } from './lib.js';

const REF = /^[ir]:[a-z0-9-]{1,60}$/;
const STATUSES = ['potvrdjeno', 'okvirno', 'provjeriti'];
const MAX_IMAGE = 8 * 1024 * 1024;
const MAX_VIDEO = 60 * 1024 * 1024;
const MAX_MEDIA = 30;
export const MEDIA_KEY = /^[0-9a-f-]{36}\.(jpg|png|gif|webp|mp4|webm|mov)$/;
const MIME = { jpg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' };

/* ---------- auth ---------- */
async function requireAdmin(env, request) {
  if (!env.ADMIN_KEY || String(env.ADMIN_KEY).length < 16) throw new HttpError(503, 'Admin nije podešen (nedostaje ADMIN_KEY)');
  const m = /^Bearer (.{8,200})$/.exec(request.headers.get('authorization') || '');
  if (!m) throw new HttpError(401, 'Neispravan ključ');
  const [a, b] = await Promise.all([sha256(m[1]), sha256(String(env.ADMIN_KEY))]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  if (diff) throw new HttpError(401, 'Neispravan ključ');
}

/* ---------- validacija ---------- */
const str = (v, max, name, req = false) => {
  const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
  if (req && !s) throw new HttpError(400, `Polje "${name}" je obavezno`);
  if (s.length > max) throw new HttpError(400, `Polje "${name}" je predugo (najviše ${max} znakova)`);
  return s;
};
const url = (v, name) => {
  const s = str(v, 300, name);
  if (s && !/^https?:\/\/[^\s"'<>]+$/.test(s)) throw new HttpError(400, `Polje "${name}" mora početi sa http:// ili https://`);
  return s;
};
const coord = (v, lo, hi, name) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < lo || n > hi) throw new HttpError(400, `Neispravna vrijednost: ${name}`);
  return n;
};
const list = (v, maxN, maxLen, name) => {
  if (!Array.isArray(v)) return [];
  return v.map((x) => str(x, maxLen, name)).filter(Boolean).slice(0, maxN);
};

export function cleanItem(b) {
  const kind = KINDS.includes(b.kind) ? b.kind : null;
  if (!kind) throw new HttpError(400, 'Izaberi vrstu (događaj, plaža ili kultura)');
  const o = {
    kind,
    title: str(b.title, 120, 'Naziv', true),
    place: str(b.place, 80, 'Mjesto', true),
    region: str(b.region, 60, 'Region'),
    description: str(b.description, 500, 'Kratak opis'),
    title_en: str(b.title_en, 120, 'Naziv (EN)'),
    description_en: str(b.description_en, 500, 'Kratak opis (EN)'),
    details_en: str(b.details_en, 4000, 'Duži opis (EN)'),
    details: str(b.details, 4000, 'Duži opis'),
    address: str(b.address, 120, 'Adresa'),
    website: url(b.website, 'Web stranica'),
    source: str(b.source, 120, 'Izvor'),
    source_url: url(b.source_url, 'Link izvora'),
    status: STATUSES.includes(b.status) ? b.status : 'okvirno',
    lat: coord(b.lat, -90, 90, 'širina'),
    lng: coord(b.lng, -180, 180, 'dužina'),
    demo: b.demo ? 1 : 0,
    active: b.active === false || b.active === 0 ? 0 : 1,
    verify: !!b.verified,
  };
  if ((o.lat === null) !== (o.lng === null)) throw new HttpError(400, 'Unesi i širinu i dužinu, ili nijednu');
  if (kind === 'event') {
    if (!isDate(b.date_from)) throw new HttpError(400, 'Događaj mora imati datum početka');
    o.date_from = b.date_from;
    o.date_to = b.date_to ? b.date_to : null;
    if (o.date_to && (!isDate(o.date_to) || o.date_to < o.date_from)) throw new HttpError(400, 'Datum završetka mora biti poslije početka');
    o.months = '[]';
  } else {
    o.date_from = null;
    o.date_to = null;
    const m = [...new Set((Array.isArray(b.months) ? b.months : []).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 12))].sort((x, y) => x - y);
    o.months = JSON.stringify(m);
  }
  return o;
}

export function cleanRestaurant(b) {
  const o = {
    name: str(b.name, 80, 'Naziv', true),
    city: str(b.city, 60, 'Mjesto', true),
    phone: str(b.phone, 30, 'Telefon'),
    ambience: str(b.ambience, 600, 'Opis'),
    ambience_en: str(b.ambience_en, 600, 'Opis (EN)'),
    tags: JSON.stringify(list(b.tags, 12, 30, 'Oznake')),
    amenities: JSON.stringify(list(b.amenities, 12, 30, 'Sadržaji')),
    why: JSON.stringify(list(b.why, 8, 200, 'Zašto ovdje')),
    lat: coord(b.lat, -90, 90, 'širina'),
    lng: coord(b.lng, -180, 180, 'dužina'),
    active: b.active === false || b.active === 0 ? 0 : 1,
  };
  if ((o.lat === null) !== (o.lng === null)) throw new HttpError(400, 'Unesi i širinu i dužinu, ili nijednu');
  return o;
}

async function uniqueSlug(db, title) {
  const base = norm(title).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'stavka';
  for (let n = 1; n < 50; n++) {
    const s = n === 1 ? base : `${base}-${n}`;
    if (!(await db.prepare('SELECT 1 AS x FROM items WHERE slug = ?').bind(s).first())) return s;
  }
  throw new HttpError(409, 'Ne mogu napraviti jedinstven slug');
}

/* ---------- prepoznavanje fajla po sadržaju (ne vjerujemo imenu ni Content-Type) ---------- */
export function sniff(b) {
  const eq = (o, s) => [...s].every((c, i) => b[o + i] === c.charCodeAt(0));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { kind: 'image', ext: 'jpg' };
  if (b[0] === 0x89 && eq(1, 'PNG')) return { kind: 'image', ext: 'png' };
  if (eq(0, 'GIF8')) return { kind: 'image', ext: 'gif' };
  if (eq(0, 'RIFF') && eq(8, 'WEBP')) return { kind: 'image', ext: 'webp' };
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { kind: 'video', ext: 'webm' };
  if (eq(4, 'ftyp')) {
    const brand = String.fromCharCode(...b.slice(8, 12));
    if (/^(heic|heix|hevc|hevx|mif1|msf1|avif)/.test(brand)) return { kind: 'heic' };
    return { kind: 'video', ext: brand === 'qt  ' ? 'mov' : 'mp4' };
  }
  return null;
}

async function storeFile(env, file, expect) {
  if (!env.MEDIA) throw new HttpError(503, 'R2 skladište nije podešeno (binding MEDIA)');
  if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') throw new HttpError(400, 'Fajl nije primljen');
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const t = sniff(head);
  if (!t) throw new HttpError(415, 'Dozvoljeno: JPG, PNG, WebP, GIF, MP4, WebM, MOV');
  if (t.kind === 'heic') throw new HttpError(415, 'HEIC/HEIF nije podržan u pregledačima. Snimi kao JPG ili pošalji običnu fotografiju.');
  if (expect && t.kind !== expect) throw new HttpError(415, 'Ovaj fajl nije ' + (expect === 'image' ? 'slika' : 'video'));
  if (file.size > (t.kind === 'image' ? MAX_IMAGE : MAX_VIDEO)) {
    throw new HttpError(413, t.kind === 'image' ? 'Slika je veća od 8 MB' : 'Video je veći od 60 MB');
  }
  const key = `${crypto.randomUUID()}.${t.ext}`;
  await env.MEDIA.put(key, file, { httpMetadata: { contentType: MIME[t.ext] } });
  return { key, url: `/api/m/${key}`, kind: t.kind };
}

const ownKey = (u) => (typeof u === 'string' && u.startsWith('/api/m/') && MEDIA_KEY.test(u.slice(7)) ? u.slice(7) : '');
async function dropFile(env, u) {
  const k = ownKey(u);
  if (k && env.MEDIA) { try { await env.MEDIA.delete(k); } catch { /* ignore */ } }
}

/* ---------- javno posluživanje fajlova iz R2 (sa Range podrškom za video) ---------- */
export async function serveMedia(env, request, key) {
  if (!env.MEDIA || !MEDIA_KEY.test(key)) return new Response('Not found', { status: 404 });
  const ranged = request.headers.has('range');
  const o = await env.MEDIA.get(key, ranged ? { range: request.headers } : undefined);
  if (!o) return new Response('Not found', { status: 404 });
  const h = new Headers();
  h.set('content-type', MIME[key.split('.').pop()]);
  h.set('etag', o.httpEtag || '');
  h.set('accept-ranges', 'bytes');
  h.set('cache-control', 'public, max-age=31536000, immutable');
  h.set('x-content-type-options', 'nosniff');
  let status = 200;
  if (ranged && o.range) {
    const off = o.range.suffix != null ? o.size - o.range.suffix : o.range.offset || 0;
    const len = o.range.suffix != null ? o.range.suffix : o.range.length != null ? o.range.length : o.size - off;
    h.set('content-range', `bytes ${off}-${off + len - 1}/${o.size}`);
    h.set('content-length', String(len));
    status = 206;
  } else h.set('content-length', String(o.size));
  return new Response(o.body, { status, headers: h });
}

/* ---------- pomoćno ---------- */
async function refExists(db, ref) {
  const [t, slug] = [ref[0], ref.slice(2)];
  const row = await db.prepare(`SELECT 1 AS x FROM ${t === 'i' ? 'items' : 'restaurants'} WHERE slug = ?`).bind(slug).first();
  if (!row) throw new HttpError(404, 'Stavka nije pronađena');
}
const mediaCount = async (db, ref) => (await db.prepare('SELECT COUNT(*) AS n FROM media WHERE ref = ?').bind(ref).first()).n;
const nextSort = async (db, ref) => ((await db.prepare('SELECT MAX(sort) AS m FROM media WHERE ref = ?').bind(ref).first()).m || 0) + 1;

async function insertMedia(env, ref, m) {
  if ((await mediaCount(env.DB, ref)) >= MAX_MEDIA) throw new HttpError(400, `Najviše ${MAX_MEDIA} slika i videa po stavci`);
  const sort = await nextSort(env.DB, ref);
  await env.DB.prepare('INSERT INTO media (ref,type,url,poster,caption,credit,sort) VALUES (?,?,?,?,?,?,?)')
    .bind(ref, m.type, m.url, m.poster || '', m.caption || '', m.credit || '', sort).run();
  return env.DB.prepare('SELECT * FROM media WHERE ref = ? AND sort = ? ORDER BY id DESC').bind(ref, sort).first();
}

const adminMedia = (r) => {
  const s = shapeMedia(r);
  return { id: r.id, type: r.type, url: r.url, poster: r.poster, caption: r.caption, credit: r.credit, sort: r.sort, thumb: s ? (s.type === 'image' ? s.url : s.poster || '') : '', valid: !!s };
};

async function entry(env, ref) {
  if (!REF.test(ref)) throw new HttpError(404, 'Stavka nije pronađena');
  const slug = ref.slice(2);
  let data;
  if (ref[0] === 'i') {
    const r = await env.DB.prepare('SELECT * FROM items WHERE slug = ?').bind(slug).first();
    if (!r) throw new HttpError(404, 'Stavka nije pronađena');
    data = { ref, type: 'item', slug, kind: r.kind, title: r.title, place: r.place, region: r.region, description: r.description, details: r.details, title_en: r.title_en || '', description_en: r.description_en || '', details_en: r.details_en || '', address: r.address, website: r.website, date_from: r.date_from, date_to: r.date_to, months: parseList(r.months), status: r.status, source: r.source, source_url: r.source_url, lat: r.lat, lng: r.lng, verified_at: r.verified_at, demo: !!r.demo, active: !!r.active };
  } else {
    const r = await env.DB.prepare('SELECT * FROM restaurants WHERE slug = ?').bind(slug).first();
    if (!r) throw new HttpError(404, 'Stavka nije pronađena');
    data = { ref, type: 'restaurant', slug, kind: 'food', name: r.name, city: r.city, phone: r.phone || '', ambience: r.ambience, ambience_en: r.ambience_en || '', tags: parseList(r.tags), amenities: parseList(r.amenities), why: parseList(r.why), lat: r.lat, lng: r.lng, verified_at: r.verified_at, active: !!r.active };
  }
  const { results } = await env.DB.prepare('SELECT * FROM media WHERE ref = ? ORDER BY sort, id').bind(ref).all();
  return { ...data, media: results.map(adminMedia) };
}

/* ---------- ruta ---------- */
export async function adminRoute(request, env, pathname, method) {
  await requireAdmin(env, request);
  const seg = pathname.split('/').filter(Boolean); // ['api','admin',...]
  const what = seg[2];

  if (what === 'ping' && method === 'GET') return json({ ok: true, r2: !!env.MEDIA });

  if (what === 'push') return adminPush(request, env, seg, method);
  if (what === 'partners') return adminPartners(request, env, seg, method);

  if (what === 'list' && method === 'GET') {
    const a = await env.DB.prepare('SELECT slug, kind, title, place, active, date_from FROM items ORDER BY kind, date_from IS NULL, date_from, title').all();
    const b = await env.DB.prepare('SELECT slug, name, city, active FROM restaurants ORDER BY name').all();
    return json({
      items: a.results.map((r) => ({ ref: 'i:' + r.slug, kind: r.kind, title: r.title, place: r.place, active: !!r.active })),
      restaurants: b.results.map((r) => ({ ref: 'r:' + r.slug, kind: 'food', title: r.name, place: r.city, active: !!r.active })),
    });
  }

  if (what === 'entry' && seg.length === 4) {
    const ref = decodeURIComponent(seg[3]);
    if (method === 'GET') return json(await entry(env, ref));
    if (method === 'PUT') {
      if (!REF.test(ref)) throw new HttpError(404, 'Stavka nije pronađena');
      await refExists(env.DB, ref);
      const body = await readJson(request, 30000);
      if (ref[0] === 'i') {
        const o = cleanItem(body);
        await env.DB.prepare(`UPDATE items SET kind=?, title=?, place=?, region=?, description=?, details=?, title_en=?, description_en=?, details_en=?, address=?, website=?, date_from=?, date_to=?, months=?, status=?, source=?, source_url=?, lat=?, lng=?, demo=?, active=?, verified_at = CASE WHEN ? THEN date('now') ELSE verified_at END WHERE slug=?`)
          .bind(o.kind, o.title, o.place, o.region, o.description, o.details, o.title_en, o.description_en, o.details_en, o.address, o.website, o.date_from, o.date_to, o.months, o.status, o.source, o.source_url, o.lat, o.lng, o.demo, o.active, o.verify ? 1 : 0, ref.slice(2)).run();
      } else {
        const o = cleanRestaurant(body);
        await env.DB.prepare('UPDATE restaurants SET name=?, city=?, phone=?, ambience=?, ambience_en=?, tags=?, amenities=?, why=?, lat=?, lng=?, active=? WHERE slug=?')
          .bind(o.name, o.city, o.phone || null, o.ambience, o.ambience_en, o.tags, o.amenities, o.why, o.lat, o.lng, o.active, ref.slice(2)).run();
      }
      return json(await entry(env, ref));
    }
  }

  if (what === 'items' && seg.length === 3 && method === 'POST') {
    const o = cleanItem(await readJson(request, 30000));
    const slug = await uniqueSlug(env.DB, o.title);
    await env.DB.prepare(`INSERT INTO items (slug,kind,title,place,region,description,details,title_en,description_en,details_en,address,website,date_from,date_to,months,status,source,source_url,lat,lng,demo,active,verified_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, CASE WHEN ? THEN date('now') ELSE NULL END)`)
      .bind(slug, o.kind, o.title, o.place, o.region, o.description, o.details, o.title_en, o.description_en, o.details_en, o.address, o.website, o.date_from, o.date_to, o.months, o.status, o.source, o.source_url, o.lat, o.lng, o.demo, o.active, o.verify ? 1 : 0).run();
    return json(await entry(env, 'i:' + slug), 201);
  }

  if (what === 'media') {
    // upload: multipart (ref, file, poster?)
    if (seg.length === 3 && method === 'POST') {
      if (Number(request.headers.get('content-length') || 0) > MAX_VIDEO + 4 * 1024 * 1024) throw new HttpError(413, 'Fajl je prevelik');
      let form;
      try { form = await request.formData(); } catch { throw new HttpError(400, 'Neispravan zahtjev'); }
      const ref = String(form.get('ref') || '');
      if (!REF.test(ref)) throw new HttpError(400, 'Neispravna stavka');
      await refExists(env.DB, ref);
      if ((await mediaCount(env.DB, ref)) >= MAX_MEDIA) throw new HttpError(400, `Najviše ${MAX_MEDIA} slika i videa po stavci`);
      const f = await storeFile(env, form.get('file'));
      let poster = '';
      const pf = form.get('poster');
      if (f.kind === 'video' && pf && typeof pf !== 'string' && pf.size) {
        try { poster = (await storeFile(env, pf, 'image')).url; } catch { poster = ''; }
      }
      let row;
      try {
        row = await insertMedia(env, ref, { type: f.kind, url: f.url, poster, caption: str(form.get('caption'), 200, 'Opis'), credit: str(form.get('credit'), 120, 'Autor') });
      } catch (e) { await dropFile(env, f.url); await dropFile(env, poster); throw e; }
      return json(adminMedia(row), 201);
    }
    // link: YouTube ili vanjski https URL
    if (seg.length === 4 && seg[3] === 'link' && method === 'POST') {
      const b = await readJson(request, 3000);
      const ref = String(b.ref || '');
      if (!REF.test(ref)) throw new HttpError(400, 'Neispravna stavka');
      await refExists(env.DB, ref);
      const type = ['youtube', 'image', 'video'].includes(b.type) ? b.type : 'youtube';
      const m = { type, url: str(b.url, 300, 'Link', true), poster: type === 'video' ? str(b.poster, 300, 'Poster') : '', caption: str(b.caption, 200, 'Opis'), credit: str(b.credit, 120, 'Autor') };
      if (!shapeMedia(m)) throw new HttpError(400, type === 'youtube' ? 'Neispravan YouTube link' : 'Link mora počinjati sa https:// ili /media/');
      return json(adminMedia(await insertMedia(env, ref, m)), 201);
    }
    // redoslijed
    if (seg.length === 4 && seg[3] === 'order' && method === 'PUT') {
      const b = await readJson(request, 3000);
      const ref = String(b.ref || '');
      if (!REF.test(ref) || !Array.isArray(b.ids) || b.ids.length > MAX_MEDIA) throw new HttpError(400, 'Neispravan zahtjev');
      let i = 1;
      for (const id of b.ids) {
        if (!Number.isInteger(id)) throw new HttpError(400, 'Neispravan zahtjev');
        await env.DB.prepare('UPDATE media SET sort = ? WHERE id = ? AND ref = ?').bind(i++, id, ref).run();
      }
      return json(await entry(env, ref));
    }
    // opis / autor / brisanje
    if (seg.length === 4 && /^\d{1,9}$/.test(seg[3])) {
      const id = Number(seg[3]);
      const row = await env.DB.prepare('SELECT * FROM media WHERE id = ?').bind(id).first();
      if (!row) throw new HttpError(404, 'Medij nije pronađen');
      if (method === 'PATCH') {
        const b = await readJson(request, 3000);
        await env.DB.prepare('UPDATE media SET caption = ?, credit = ? WHERE id = ?').bind(str(b.caption, 200, 'Opis'), str(b.credit, 120, 'Autor'), id).run();
        return json(adminMedia(await env.DB.prepare('SELECT * FROM media WHERE id = ?').bind(id).first()));
      }
      if (method === 'DELETE') {
        await env.DB.prepare('DELETE FROM media WHERE id = ?').bind(id).run();
        await dropFile(env, row.url);
        await dropFile(env, row.poster);
        return new Response(null, { status: 204 });
      }
    }
  }
  throw new HttpError(404, 'Nepoznata ruta');
}
