import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/index.js';
import { parseModel, safeReply, weekend, score } from '../src/ask.js';

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
let base;
before(() => {
  const db = new DatabaseSync(':memory:');
  for (const f of ['0001_init.sql', '0002_demo_seed.sql', '0007_items.sql', '0008_demo_items.sql', '0009_detalji_mediji.sql', '0011_engleski.sql', '0017_featured.sql']) {
    try { db.exec(readFileSync(new URL('../migrations/' + f, import.meta.url), 'utf8')); } catch { /* neke migracije su već primijenjene kroz druge */ }
  }
  base = { DB: d1(db), RL: null, RL_AUTH: null, TODAY: '2026-11-14' };
});
const post = (env, body) => worker.fetch(new Request('https://mp.test/api/ask', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }), env);

test('pomoćne funkcije: parseModel, safeReply, vikend, score', () => {
  assert.deepEqual(parseModel('Evo: {"refs":["i:a","i:b"],"reply":"Ok"} hvala'), { refs: ['i:a', 'i:b'], pick: '', reply: 'Ok' });
  assert.equal(parseModel('nema jsona'), null);
  assert.equal(parseModel('{"refs":"x"}'), null);
  assert.equal(safeReply('Počinje 15.12. u Kolašinu'), '');
  assert.equal(safeReply('Vidi www.x.me'), '');
  assert.equal(safeReply('Evo prijedloga za tebe!'), 'Evo prijedloga za tebe!');
  assert.deepEqual(weekend('2026-11-14'), { sat: '2026-11-14', sun: '2026-11-15' });
  assert.deepEqual(weekend('2026-11-11'), { sat: '2026-11-14', sun: '2026-11-15' });
  assert.ok(score('plaže u Budvi', 'plaza budva more') >= 2);
});
test('bez AI-ja: pretraga po riječima vraća stavke iz baze', async () => {
  const r = await (await post(base, { q: 'plaža', lang: 'sr' })).json();
  assert.equal(r.ai, false);
  assert.ok(r.results.length > 0 && r.results.length <= 4);
  assert.ok(r.results.every((x) => x.kind === 'beach'));
});
test('AI bira samo stavke sa liste; izmišljene se odbacuju', async () => {
  let seen = '';
  const AI = { run: async (_m, args) => { seen = args.messages[1].content; return { response: '{"refs":["i:grad-teatar","i:izmisljeno","r:ne-postoji"],"reply":"Evo prijedloga!"}' }; } };
  const r = await (await post({ ...base, AI }, { q: 'nešto za veče', lang: 'sr' })).json();
  assert.equal(r.ai, true);
  assert.deepEqual(r.results.map((x) => x.slug), ['grad-teatar']);
  assert.equal(r.reply, 'Evo prijedloga!');
  assert.ok(seen.includes('i:grad-teatar') && seen.includes('QUESTION: nešto za veče'));
});
test('AI: uvodna rečenica sa brojevima se zamjenjuje, činjenice samo sa kartica', async () => {
  const AI = { run: async () => ({ response: '{"refs":["i:grad-teatar"],"reply":"Počinje 1.7. i košta 20 eura"}' }) };
  const r = await (await post({ ...base, AI }, { q: 'teatar', lang: 'en' })).json();
  assert.equal(r.reply, 'I recommend: Grad teatar (Budva).');
  assert.equal(r.results[0].from, '2027-07-01');
});
test('AI zakaže ili vrati smeće: pada na pretragu po riječima', async () => {
  for (const AI of [{ run: async () => { throw new Error('x'); } }, { run: async () => ({ response: 'ne znam' }) }]) {
    const r = await (await post({ ...base, AI }, { q: 'plaža' })).json();
    assert.equal(r.ai, false);
    assert.ok(r.results.length > 0);
  }
});
test('prošli događaji se ne nude modelu', async () => {
  let seen = '';
  const AI = { run: async (_m, a) => { seen = a.messages[1].content; return { response: '{"refs":[],"reply":""}' }; } };
  await post({ ...base, AI, TODAY: '2028-01-01' }, { q: 'teatar' });
  assert.ok(!seen.includes('i:grad-teatar'));
  await post({ ...base, AI, TODAY: '2026-11-14' }, { q: 'teatar' });
  assert.ok(seen.includes('i:grad-teatar'));
});
test('hitni slučajevi: bez AI-ja, upućuje na 112', async () => {
  let called = false;
  const r = await (await post({ ...base, AI: { run: async () => { called = true; return {}; } } }, { q: 'treba mi hitna pomoć', lang: 'sr' })).json();
  assert.equal(called, false);
  assert.deepEqual(r.results, []);
  assert.ok(r.reply.includes('112'));
});
test('neispravan unos i ograničenje broja pitanja', async () => {
  assert.equal((await post(base, { q: ' ' })).status, 400);
  assert.equal((await post(base, { q: 'x'.repeat(201) })).status, 400);
  assert.equal((await post(base, 'nije json')).status, 400);
  assert.equal((await post({ ...base, RL_ASK: { limit: async () => ({ success: false }) } }, { q: 'plaža' })).status, 429);
});
test('preporuka je uvijek prva, čak i kad je model navede drugu', async () => {
  const AI = { run: async () => ({ response: '{"pick":"i:grad-teatar","refs":["i:skijaska-sezona","i:grad-teatar"],"reply":"Grad teatar je dobar izbor za veče."}' }) };
  const r = await (await post({ ...base, AI }, { q: 'nešto za veče' })).json();
  assert.equal(r.results[0].slug, 'grad-teatar');
  assert.equal(r.reply, 'Grad teatar je dobar izbor za veče.');
});
test('svako pitanje dobija preporuku: i kad ništa ne odgovara', async () => {
  const r = await (await post(base, { q: 'qwzxv', lang: 'sr' })).json();
  assert.ok(r.results.length >= 1);
  assert.ok(r.reply.startsWith('Nisam našao tačno to, ali preporučujem:'));
  const rr = await (await post({ ...base, AI: { run: async () => ({ response: '{"refs":[],"reply":"Nema ništa."}' }) } }, { q: 'gdje na večeru uz more', lang: 'sr' })).json();
  assert.ok(rr.results.length >= 1 && rr.reply.length > 0);
});
test('bez AI-ja pitanje o večeri daje samo restorane, o plaži samo plaže, o događajima samo događaje', async () => {
  const kinds = async (q) => (await (await post(base, { q, lang: 'sr' })).json()).results;
  const food = await kinds('Gdje na večeru uz more?');
  assert.ok(food.length > 0 && food.every((x) => x.type === 'rest'));
  const beach = await kinds('Plaža za porodicu');
  assert.ok(beach.length > 0 && beach.every((x) => x.type === 'item' && x.kind === 'beach'));
  const ev = await kinds('Šta ima ovaj vikend?');
  assert.ok(ev.length > 0 && ev.every((x) => x.type === 'item' && x.kind === 'event'));
});
test('svih 8 primjera pitanja dobija preporuku, a vrsta odgovara pitanju', async () => {
  const ask = async (q) => (await (await post(base, { q, lang: 'sr' })).json()).results;
  const rest = await ask('Najbolji restoran u Budvi');
  assert.ok(rest.length > 0 && rest.every((x) => x.type === 'rest'));
  const ev = await ask('Koncerti i festivali');
  assert.ok(ev.length > 0 && ev.every((x) => x.kind === 'event'));
  const cult = await ask('Muzeji i znamenitosti');
  assert.ok(cult.length > 0);
  const rain = await ask('Šta raditi kad pada kiša?');
  assert.ok(rain.length > 0);
  const ski = await ask('Skijanje i zimske aktivnosti');
  assert.ok(ski.length > 0 && ski[0].slug.startsWith('skij'));
});
test('parking: odgovor su napomene iz vodiča Korisno, bez kartica i bez AI-ja', async () => {
  let called = false;
  const AI = { run: async () => { called = true; return {}; } };
  for (const [q, lang] of [['Gdje parkirati?', 'sr'], ['Where can I park?', 'en'], ['Wo kann ich parken?', 'de'], ['Где припарковаться?', 'ru'], ['Dove parcheggiare?', 'it']]) {
    const r = await (await post({ ...base, AI }, { q, lang })).json();
    assert.equal(r.guide, 'parking', q);
    assert.deepEqual(r.results, []);
  }
  assert.equal(called, false);
});
test('pitanje o djeci dobija preporuku (stop riječi ne prave šum)', async () => {
  const r = await (await post(base, { q: 'Šta raditi s djecom?', lang: 'sr' })).json();
  assert.ok(r.results.length > 0);
  assert.ok(r.reply.length > 0);
});
test('ruska i ćirilična pitanja pogađaju namjeru (norm prevodi ćirilicu u latinicu)', async () => {
  const kinds = async (q, lang) => (await (await post(base, { q, lang })).json()).results;
  const food = await kinds('Ужин у моря?', 'ru');
  assert.ok(food.length > 0 && food.every((x) => x.type === 'rest'));
  const ev = await kinds('Что на этих выходных?', 'ru');
  assert.ok(ev.length > 0 && ev.every((x) => x.kind === 'event'));
});
