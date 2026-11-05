import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/index.js';

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
let env;
before(() => {
  const db = new DatabaseSync(':memory:');
  for (const f of ['0007_items.sql', '0008_demo_items.sql', '0009_detalji_mediji.sql']) db.exec(readFileSync(new URL('../migrations/' + f, import.meta.url), 'utf8'));
  env = { DB: d1(db), RL: null, RL_AUTH: null };
});
const get = async (qs = '') => (await (await worker.fetch(new Request('https://mp.test/api/items' + qs), env)).json()).items;

test('lista vraća sve stavke', async () => {
  assert.equal((await get()).length, 12);
});
test('period: događaji se filtriraju po preklapanju datuma', async () => {
  const t = (await get('?kind=event&from=2027-07-10&to=2027-07-17')).map((x) => x.slug);
  assert.deepEqual(t, ['grad-teatar']);
  const u = (await get('?kind=event&from=2027-07-20&to=2027-07-25')).map((x) => x.slug).sort();
  assert.deepEqual(u, ['fasinada', 'grad-teatar']);
});
test('sezona: plaže se označe kao van sezone, a ne uklanjaju', async () => {
  const b = await get('?kind=beach&from=2027-01-05&to=2027-01-10');
  assert.equal(b.length, 3);
  assert.ok(b.every((x) => x.offSeason));
  assert.ok((await get('?kind=beach&from=2027-07-05&to=2027-07-10')).every((x) => !x.offSeason));
});
test('mjesto, regija i dijakritici', async () => {
  assert.deepEqual((await get('?place=herceg')).map((x) => x.slug).sort(), ['mimosa-festival', 'zanjic']);
  assert.ok((await get('?place=Skijaska')).length === 0);
  assert.ok((await get('?place=boka')).length >= 5);
});
test('neispravni datumi i parametri se ignorišu', async () => {
  assert.equal((await get('?from=bla&to=2027-99-99&kind=x')).length, 12);
  assert.equal((await get('?from=2027-07-17&to=2027-07-10&kind=event')).length, 1);
});
