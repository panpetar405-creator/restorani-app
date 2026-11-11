import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/index.js';
import { sniff } from '../src/adminapi.js';

function d1(db) {
  return {
    prepare(sql) {
      let args = [];
      const st = {
        bind: (...a) => ((args = a), st),
        all: async () => ({ results: db.prepare(sql).all(...args).map((r) => ({ ...r })) }),
        first: async () => { const r = db.prepare(sql).get(...args); return r ? { ...r } : null; },
        run: async () => ({ meta: { changes: db.prepare(sql).run(...args).changes } }),
      };
      return st;
    },
  };
}
function r2() {
  const m = new Map();
  return {
    m,
    put: async (k, blob, o) => { m.set(k, { buf: new Uint8Array(await blob.arrayBuffer()), type: o.httpMetadata.contentType }); },
    delete: async (k) => { m.delete(k); },
    get: async (k, o) => {
      const e = m.get(k); if (!e) return null;
      let body = e.buf, range;
      if (o && o.range) { const mm = /bytes=(\d+)-(\d*)/.exec(o.range.get('range')); const off = +mm[1], end = mm[2] ? +mm[2] : e.buf.length - 1; body = e.buf.slice(off, end + 1); range = { offset: off, length: body.length }; }
      return { body, size: e.buf.length, httpEtag: '"x"', range };
    },
  };
}
const KEY = 'test-admin-key-1234567890';
let env, bucket;
before(() => {
  const db = new DatabaseSync(':memory:');
  for (const f of ['0007_items.sql', '0008_demo_items.sql', '0009_detalji_mediji.sql', '0011_engleski.sql']) db.exec(readFileSync(new URL('../migrations/' + f, import.meta.url), 'utf8').replace(/^ALTER TABLE restaurants.*$/m, ''));
  db.exec("CREATE TABLE restaurants (id INTEGER PRIMARY KEY, slug TEXT, name TEXT, city TEXT, phone TEXT, ambience TEXT, ambience_en TEXT NOT NULL DEFAULT '', tags TEXT, amenities TEXT, why TEXT, lat REAL, lng REAL, verified_at TEXT, active INTEGER)");
  db.exec("INSERT INTO restaurants (slug,name,city,tags,amenities,why,ambience,active) VALUES ('konoba','Konoba','Kotor','[]','[]','[]','',1)");
  bucket = r2();
  env = { DB: d1(db), RL: null, RL_AUTH: null, ADMIN_KEY: KEY, MEDIA: bucket };
});
const call = (method, path, body, key = KEY) => {
  const init = { method, headers: key ? { authorization: 'Bearer ' + key } : {} };
  if (body instanceof FormData) init.body = body; else if (body) { init.headers['content-type'] = 'application/json'; init.body = JSON.stringify(body); }
  return worker.fetch(new Request('https://mp.test/api' + path, init), env);
};
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
const upload = (ref, bytes, name = 'a.jpg', extra = {}) => { const fd = new FormData(); fd.append('ref', ref); fd.append('file', new File([bytes], name)); for (const [k, x] of Object.entries(extra)) fd.append(k, x); return call('POST', '/admin/media', fd); };

test('admin: bez ključa i sa pogrešnim ključem je 401, bez podešenog ključa 503', async () => {
  assert.equal((await call('GET', '/admin/list', null, '')).status, 401);
  assert.equal((await call('GET', '/admin/list', null, 'pogresan-kljuc-12345')).status, 401);
  const saved = env.ADMIN_KEY; env.ADMIN_KEY = '';
  assert.equal((await call('GET', '/admin/list')).status, 503);
  env.ADMIN_KEY = saved;
  assert.equal((await call('GET', '/admin/list')).status, 200);
});

test('izmjena opisa i podataka događaja', async () => {
  const cur = await (await call('GET', '/admin/entry/i:skijaska-sezona')).json();
  assert.equal(cur.kind, 'event');
  const r = await call('PUT', '/admin/entry/i:skijaska-sezona', { ...cur, description: 'Novi opis', details: 'Pasus 1\n\nPasus 2', website: 'https://kolasin1600.me', verified: true, demo: false });
  assert.equal(r.status, 200);
  const pub = await (await call('GET', '/items/skijaska-sezona', null, '')).json();
  assert.equal(pub.item.description, 'Novi opis');
  assert.equal(pub.item.details, 'Pasus 1\n\nPasus 2');
  assert.equal(pub.item.demo, false);
  assert.ok(pub.item.verifiedAt);
});

test('validacija: prazan naziv, loš link, loši datumi', async () => {
  const cur = await (await call('GET', '/admin/entry/i:skijaska-sezona')).json();
  assert.equal((await call('PUT', '/admin/entry/i:skijaska-sezona', { ...cur, title: '  ' })).status, 400);
  assert.equal((await call('PUT', '/admin/entry/i:skijaska-sezona', { ...cur, website: 'javascript:alert(1)' })).status, 400);
  assert.equal((await call('PUT', '/admin/entry/i:skijaska-sezona', { ...cur, date_to: '2020-01-01' })).status, 400);
  assert.equal((await call('PUT', '/admin/entry/i:skijaska-sezona', { ...cur, lat: 42 })).status, 400);
  assert.equal((await call('PUT', '/admin/entry/i:nema-takve', cur)).status, 404);
});

test('nova stavka dobija slug iz naziva, plaža čuva mjesece', async () => {
  const a = await (await call('POST', '/admin/items', { kind: 'beach', title: 'Plaža Šćepanović', place: 'Sutomore', months: [7, 6, 6, 13] })).json();
  assert.equal(a.slug, 'plaza-scepanovic');
  assert.deepEqual(a.months, [6, 7]);
  const b = await (await call('POST', '/admin/items', { kind: 'beach', title: 'Plaža Šćepanović', place: 'Sutomore' })).json();
  assert.equal(b.slug, 'plaza-scepanovic-2');
});

test('restoran: izmjena opisa i liste', async () => {
  const r = await call('PUT', '/admin/entry/r:konoba', { name: 'Konoba Ribar', city: 'Kotor', ambience: 'Mirno', why: ['Svježa riba'], tags: ['Riba'] });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.deepEqual(d.why, ['Svježa riba']);
});

test('upload: slika, prikaz u javnom API-ju, Range, poredak, brisanje', async () => {
  const r = await upload('i:skijaska-sezona', JPG, 'foto.jpg', { caption: 'Staze' });
  assert.equal(r.status, 201);
  const m = await r.json();
  assert.match(m.url, /^\/api\/m\/[0-9a-f-]{36}\.jpg$/);
  assert.equal(bucket.m.size, 1);

  const pub = await (await call('GET', '/items/skijaska-sezona', null, '')).json();
  assert.equal(pub.media[0].url, m.url);
  assert.equal(pub.media[0].caption, 'Staze');

  const file = await call('GET', m.url.slice(4), null, '');
  assert.equal(file.status, 200);
  assert.equal(file.headers.get('content-type'), 'image/jpeg');
  assert.equal(file.headers.get('x-content-type-options'), 'nosniff');
  const part = await worker.fetch(new Request('https://mp.test' + m.url, { headers: { range: 'bytes=0-3' } }), env);
  assert.equal(part.status, 206);
  assert.equal(part.headers.get('content-range'), 'bytes 0-3/' + JPG.length);

  const m2 = await (await upload('i:skijaska-sezona', JPG, 'b.jpg')).json();
  const yt = await (await call('POST', '/admin/media/link', { ref: 'i:skijaska-sezona', type: 'youtube', url: 'https://youtu.be/dQw4w9WgXcQ' })).json();
  assert.equal((await call('POST', '/admin/media/link', { ref: 'i:skijaska-sezona', type: 'youtube', url: 'https://example.com' })).status, 400);

  const ord = await (await call('PUT', '/admin/media/order', { ref: 'i:skijaska-sezona', ids: [yt.id, m2.id, m.id] })).json();
  assert.deepEqual(ord.media.map((x) => x.id), [yt.id, m2.id, m.id]);

  const p = await (await call('PATCH', '/admin/media/' + m.id, { caption: 'Nova', credit: 'Foto: A' })).json();
  assert.equal(p.caption, 'Nova');

  assert.equal((await call('DELETE', '/admin/media/' + m.id)).status, 204);
  assert.equal(bucket.m.size, 1);
});

test('upload: odbija HTML/SVG, HEIC i neispravnu stavku, prepoznaje video', async () => {
  const html = new TextEncoder().encode('<script>alert(1)</script>');
  assert.equal((await upload('i:skijaska-sezona', html, 'x.jpg')).status, 415);
  const heic = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0, 0, 0]);
  assert.equal((await upload('i:skijaska-sezona', heic, 'x.heic')).status, 415);
  assert.equal((await upload('i:nema-takve', JPG)).status, 404);
  assert.equal((await upload('../etc', JPG)).status, 400);
  const mp4 = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0]);
  const v = await (await upload('i:skijaska-sezona', mp4, 'v.mp4', { poster: new File([JPG], 'p.jpg') })).json();
  assert.equal(v.type, 'video');
  assert.match(v.poster, /^\/api\/m\//);
  assert.equal(sniff(mp4).ext, 'mp4');
  assert.equal(sniff(new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20, 0, 0, 0, 0])).ext, 'mov');
});

test('serveMedia: nepoznat ili nevaljan ključ je 404', async () => {
  assert.equal((await call('GET', '/m/nije-kljuc.jpg', null, '')).status, 404);
  assert.equal((await call('GET', '/m/00000000-0000-0000-0000-000000000000.jpg', null, '')).status, 404);
});

test('link na sliku iz repoa (/media/...) i https; loši linkovi odbijeni', async () => {
  const a = await call('POST', '/admin/media/link', { ref: 'i:zanjic', type: 'image', url: '/media/zanjic-1.jpg' });
  assert.equal(a.status, 201);
  assert.equal((await call('POST', '/admin/media/link', { ref: 'i:zanjic', type: 'video', url: '/media/zanjic.mp4' })).status, 201);
  assert.equal((await call('POST', '/admin/media/link', { ref: 'i:zanjic', type: 'image', url: '/media/../x.jpg' })).status, 400);
  assert.equal((await call('POST', '/admin/media/link', { ref: 'i:zanjic', type: 'image', url: 'http://x.me/a.jpg' })).status, 400);
  const pub = await (await call('GET', '/items/zanjic', null, '')).json();
  assert.deepEqual(pub.media.map((m) => m.type), ['image', 'video']);
});

test('engleski: admin čuva prevod, javni API ga vraća samo za lang=en, bez prevoda je crnogorski', async () => {
  const cur = await (await call('GET', '/admin/entry/i:skijaska-sezona')).json();
  const r = await call('PUT', '/admin/entry/i:skijaska-sezona', { ...cur, title_en: 'Ski season', description_en: 'Skiing at Kolasin 1600.', details_en: 'Long text' });
  assert.equal(r.status, 200);
  const en = await (await call('GET', '/items/skijaska-sezona?lang=en', null, '')).json();
  assert.equal(en.item.title, 'Ski season');
  assert.equal(en.item.description, 'Skiing at Kolasin 1600.');
  assert.equal(en.item.details, 'Long text');
  const sr = await (await call('GET', '/items/skijaska-sezona', null, '')).json();
  assert.notEqual(sr.item.title, 'Ski season');
  const list = await (await call('GET', '/items?lang=en', null, '')).json();
  assert.equal(list.items.find((x) => x.slug === 'skijaska-sezona').title, 'Ski season');
  const other = list.items.find((x) => x.slug !== 'skijaska-sezona');
  const otherSr = (await (await call('GET', '/items', null, '')).json()).items.find((x) => x.slug === other.slug);
  assert.equal(other.title, otherSr.title);
  assert.equal((await call('PUT', '/admin/entry/i:skijaska-sezona', { ...cur, title_en: 'x'.repeat(121) })).status, 400);
  const rr = await call('PUT', '/admin/entry/r:konoba', { name: 'Konoba', city: 'Kotor', ambience: 'Mirno', ambience_en: 'Quiet and cosy' });
  assert.equal((await rr.json()).ambience_en, 'Quiet and cosy');
});

test('de/ru/it: javni API vraća engleski prevod (ako postoji), nepoznat jezik je crnogorski; ćirilica u pretrazi mjesta', async () => {
  const cur = await (await call('GET', '/admin/entry/i:skijaska-sezona')).json();
  await call('PUT', '/admin/entry/i:skijaska-sezona', { ...cur, title_en: 'Ski season', description_en: 'Skiing at Kolasin 1600.', details_en: 'Long text' });
  for (const lang of ['de', 'ru', 'it']) {
    const d = await (await call('GET', `/items/skijaska-sezona?lang=${lang}`, null, '')).json();
    assert.equal(d.item.title, 'Ski season');
    assert.equal(d.item.details, 'Long text');
    const list = await (await call('GET', `/items?lang=${lang}`, null, '')).json();
    assert.equal(list.items.find((x) => x.slug === 'skijaska-sezona').title, 'Ski season');
  }
  const fr = await (await call('GET', '/items/skijaska-sezona?lang=fr', null, '')).json();
  assert.notEqual(fr.item.title, 'Ski season');
  const place = cur.place || '';
  if (place) {
    const cyr = [...place.toLowerCase()].map((c) => ({ a:'а',b:'б',v:'в',d:'д',e:'е',i:'и',k:'к',l:'л',m:'м',n:'н',o:'о',p:'п',r:'р',s:'с',t:'т',u:'у' }[c] || c)).join('');
    const hits = await (await call('GET', `/items?place=${encodeURIComponent(cyr)}`, null, '')).json();
    assert.ok(hits.items.some((x) => x.slug === 'skijaska-sezona'), 'ćirilica: ' + cyr);
  }
});
