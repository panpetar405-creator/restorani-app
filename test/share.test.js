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
  for (const f of ['0007_items.sql', '0008_demo_items.sql', '0009_detalji_mediji.sql', '0011_engleski.sql']) db.exec(readFileSync(new URL('../migrations/' + f, import.meta.url), 'utf8').replace(/^ALTER TABLE restaurants.*$/m, ''));
  db.exec("UPDATE items SET title = 'Skijaška <sezona>', description = 'Skijanje \"na\" Kolašinu 1600.' WHERE slug = 'skijaska-sezona'");
  db.prepare('INSERT INTO media (ref,type,url,caption,credit,sort) VALUES (?,?,?,?,?,?)').run('i:skijaska-sezona', 'image', '/media/kolasin-1.jpg', '', '', 1);
  env = { DB: d1(db), RL: null, RL_AUTH: null, ASSETS: { fetch: async () => new Response('asset') } };
});
const get = (p) => worker.fetch(new Request('https://mp.test' + p), env);

test('dijeljenje: naslov, opis i slika iz galerije, sa escape-om', async () => {
  const r = await get('/s/i/skijaska-sezona');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /text\/html/);
  const h = await r.text();
  assert.match(h, /og:title" content="Skijaška &lt;sezona&gt; · Montepalm"/);
  assert.match(h, /Kolašin/);
  assert.match(h, /&quot;na&quot;/);
  assert.match(h, /og:image" content="https:\/\/mp\.test\/media\/kolasin-1\.jpg"/);
  assert.match(h, /refresh" content="0;url=\/#d\/i:skijaska-sezona"/);
  assert.doesNotMatch(h, /<sezona>/);
});

test('dijeljenje: bez slike koristi og.png, nepoznata stavka vraća na početnu', async () => {
  const h = await (await get('/s/i/stari-grad-kotor')).text();
  assert.match(h, /og:image" content="https:\/\/mp\.test\/og\.png"/);
  const nf = await get('/s/i/nema-takve');
  assert.equal(nf.status, 302);
  assert.equal(nf.headers.get('location'), 'https://mp.test/');
  assert.equal((await get('/s/x/abc')).status, 302);
  assert.equal((await get('/s/i/..%2Fetc')).status, 302);
});

test('dijeljenje: engleski naslov, opis i prebacivanje na engleski jezik', async () => {
  const h0 = await (await get('/s/i/skijaska-sezona?lang=en')).text();
  assert.match(h0, /html lang="en"/);
  assert.match(h0, /refresh" content="0;url=\/\?lang=en#d\/i:skijaska-sezona"/);
  assert.match(h0, /open in the Montepalm app/);
  await env.DB.prepare("UPDATE items SET title_en = 'Ski <season>', description_en = 'Skiing at Kolasin.' WHERE slug = 'skijaska-sezona'").run();
  const h1 = await (await get('/s/i/skijaska-sezona?lang=en')).text();
  assert.match(h1, /og:title" content="Ski &lt;season&gt; · Montepalm"/);
  assert.match(h1, /Skiing at Kolasin/);
  const sr = await (await get('/s/i/skijaska-sezona')).text();
  assert.doesNotMatch(sr, /Ski &lt;season/);
});
