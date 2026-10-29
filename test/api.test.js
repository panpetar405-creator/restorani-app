import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/index.js';
import { sha256 } from '../src/lib.js';

// Minimalni D1 shim nad SQLite-om (isti SQL kao na Cloudflareu)
function d1(db) {
  return {
    prepare(sql) {
      let args = [];
      const st = {
        bind: (...a) => ((args = a), st),
        all: async () => ({ results: db.prepare(sql).all(...args).map((r) => ({ ...r })) }),
        first: async () => {
          const r = db.prepare(sql).get(...args);
          return r ? { ...r } : null;
        },
        run: async () => ({ meta: { changes: db.prepare(sql).run(...args).changes } }),
      };
      return st;
    },
    async batch(stmts) {
      db.exec('BEGIN');
      try {
        const out = [];
        for (const s of stmts) out.push(await s.run());
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

const KEY = 'test-owner-key-0123456789abcdef';
let env;

before(async () => {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../migrations/0002_demo_seed.sql', import.meta.url), 'utf8'));
  db.prepare('UPDATE restaurants SET owner_key_hash = ? WHERE slug = ?').run(await sha256(KEY), 'konoba-akustik');
  env = { DB: d1(db), RL: null, RL_AUTH: null };
});

const call = (path, init = {}, e = env) => worker.fetch(new Request('https://sto.test' + path, init), e);
const bearer = (k) => ({ authorization: 'Bearer ' + k });

test('health', async () => {
  const r = await call('/api/health');
  assert.equal(r.status, 200);
});

test('lista vraća sve restorane sa procijenjenim računom iz menija', async () => {
  const { restaurants } = await (await call('/api/restaurants')).json();
  assert.equal(restaurants.length, 4);
  const a = restaurants.find((r) => r.slug === 'konoba-akustik');
  // glavno 10–18, piće 3, pola priloga 3–3,5 -> 16 do 24,5 (zaokruženo 25)
  assert.deepEqual(a.price, { lo: 16, hi: 25 });
  assert.equal(a.menu.length, 8);
});

test('filteri: grad, kategorija, cijena, upit, raspoloženje', async () => {
  const get = async (qs) => (await (await call('/api/restaurants?' + qs)).json()).restaurants.map((r) => r.slug);
  assert.deepEqual(await get('city=Kotor'), ['restaurant-riva']);
  assert.equal((await get('cat=pizza')).length, 1);
  assert.deepEqual(await get('max=15'), ['caffe-bar-konoba']);
  assert.ok((await get('q=orada')).includes('konoba-akustik'));
  assert.ok((await get('q=PASTA%20SA%20PLODOVIMA')).length > 0);
  assert.ok((await get('mood=fam')).includes('caffe-bar-konoba'));
});

test('neispravni parametri se ograničavaju, ne ruše server', async () => {
  const r = await call('/api/restaurants?max=abc&limit=-5&mood=<script>&city=' + 'x'.repeat(500));
  assert.equal(r.status, 200);
  const r2 = await call('/api/restaurants?limit=9999');
  assert.equal((await r2.json()).restaurants.length, 4);
});

test('detalj restorana i 404', async () => {
  assert.equal((await call('/api/restaurants/konoba-akustik')).status, 200);
  assert.equal((await call('/api/restaurants/ne-postoji')).status, 404);
  assert.equal((await call("/api/restaurants/x';DROP TABLE restaurants;--")).status, 404);
});

test('događaji: validacija i brojanje', async () => {
  const post = (body) =>
    call('/api/restaurants/konoba-akustik/event', { method: 'POST', body: JSON.stringify(body) });
  assert.equal((await post({ type: 'view' })).status, 204);
  assert.equal((await post({ type: 'view' })).status, 204);
  assert.equal((await post({ type: 'nav' })).status, 204);
  assert.equal((await post({ type: 'hack' })).status, 400);
  assert.equal((await call('/api/restaurants/konoba-akustik/event', { method: 'POST', body: 'nije json' })).status, 400);
  const me = await (await call('/api/owner/me', { headers: bearer(KEY) })).json();
  assert.deepEqual(me.stats, { view: 2, call: 0, nav: 1 });
});

test('vlasnik: bez ključa ili s pogrešnim ključem je 401', async () => {
  assert.equal((await call('/api/owner/me')).status, 401);
  assert.equal((await call('/api/owner/me', { headers: bearer('pogresan-kljuc-0123456789abcdef') })).status, 401);
});

test('vlasnik: izmjena cijena mijenja račun i postavlja datum provjere', async () => {
  const before = await (await call('/api/owner/me', { headers: bearer(KEY) })).json();
  assert.equal(before.restaurant.verifiedAt, null);
  const orada = before.restaurant.menu.find((m) => m.name === 'Grilovana orada');
  const r = await call('/api/owner/prices', {
    method: 'PUT',
    headers: bearer(KEY),
    body: JSON.stringify({ items: [{ id: orada.id, price: 30.5 }] }),
  });
  assert.equal(r.status, 200);
  const after = await r.json();
  assert.ok(after.restaurant.verifiedAt);
  assert.equal(after.restaurant.menu.find((m) => m.id === orada.id).price, 30.5);
  assert.equal(after.restaurant.price.hi, Math.round(30.5 + 3 + 3.5));
});

test('vlasnik: ne može mijenjati tuđe stavke niti slati loše cijene', async () => {
  const other = await (await call('/api/restaurants/restaurant-riva')).json();
  const put = (items) =>
    call('/api/owner/prices', { method: 'PUT', headers: bearer(KEY), body: JSON.stringify({ items }) });
  assert.equal((await put([{ id: other.menu[0].id, price: 1 }])).status, 200); // ignorira se (WHERE restaurant_id)
  const still = await (await call('/api/restaurants/restaurant-riva')).json();
  assert.equal(still.menu[0].price, other.menu[0].price);
  assert.equal((await put([{ id: 1, price: -3 }])).status, 400);
  assert.equal((await put([{ id: 1, price: 99999 }])).status, 400);
  assert.equal((await put([{ id: 'a', price: 5 }])).status, 400);
  assert.equal((await put([])).status, 400);
});

test('vlasnik: potvrda cijena', async () => {
  const r = await call('/api/owner/confirm', { method: 'POST', headers: bearer(KEY) });
  assert.equal(r.status, 200);
  assert.ok((await r.json()).restaurant.verifiedAt);
});

test('rate limiting vraća 429', async () => {
  const deny = { limit: async () => ({ success: false }) };
  const r = await call('/api/restaurants', {}, { ...env, RL: deny });
  assert.equal(r.status, 429);
  const r2 = await call('/api/owner/me', { headers: bearer(KEY) }, { ...env, RL_AUTH: deny });
  assert.equal(r2.status, 429);
  assert.equal((await call('/api/health', {}, { ...env, RL: deny })).status, 200);
});

test('nepoznata ruta je 404', async () => {
  assert.equal((await call('/api/nesto')).status, 404);
});
