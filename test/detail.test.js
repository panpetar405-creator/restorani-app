import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/index.js';
import { shapeMedia, shiftYears, climateDays, monthSummary } from '../src/lib.js';

function d1(db) {
  return {
    prepare(sql) {
      let args = [];
      const st = {
        bind: (...a) => ((args = a), st),
        all: async () => ({ results: db.prepare(sql).all(...args).map((r) => ({ ...r })) }),
        first: async () => { const r = db.prepare(sql).get(...args); return r ? { ...r } : null; },
      };
      return st;
    },
  };
}
const calls = [];
// lažni Open-Meteo: svaki dan u traženom rasponu ima 20/10 °C, a kiša samo 1. dana
const fakeFetch = async (url) => {
  calls.push(url);
  const u = new URL(url);
  if (u.hostname.startsWith('geocoding')) return { ok: true, json: async () => ({ results: [{ latitude: 42.8, longitude: 19.5 }] }) };
  const a = u.searchParams.get('start_date'), b = u.searchParams.get('end_date');
  const time = [];
  for (let d = new Date(a + 'T00:00:00Z'); d <= new Date(b + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) time.push(d.toISOString().slice(0, 10));
  const daily = {
    time, temperature_2m_max: time.map(() => 20.4), temperature_2m_min: time.map(() => 10.2), precipitation_sum: time.map((_, i) => (i === 0 ? 5 : 0)),
    ...(u.hostname.startsWith('api.') ? { weather_code: time.map(() => 3), precipitation_probability_max: time.map(() => 30) } : {}),
  };
  return { ok: true, json: async () => ({ daily }) };
};
let env;
before(() => {
  const db = new DatabaseSync(':memory:');
  for (const f of ['0007_items.sql', '0008_demo_items.sql', '0009_detalji_mediji.sql']) db.exec(readFileSync(new URL('../migrations/' + f, import.meta.url), 'utf8'));
  db.exec("UPDATE items SET lat = 42.4, lng = 18.7, details = 'Duži opis', website = 'javascript:alert(1)' WHERE slug = 'stari-grad-kotor'");
  const ins = db.prepare('INSERT INTO media (ref,type,url,caption,credit,sort) VALUES (?,?,?,?,?,?)');
  ins.run('i:stari-grad-kotor', 'image', 'https://cdn.test/a.jpg', 'Zidine', 'Foto: A. B.', 2);
  ins.run('i:stari-grad-kotor', 'image', 'http://cdn.test/nije-https.jpg', '', '', 1);
  ins.run('i:stari-grad-kotor', 'youtube', 'https://youtu.be/dQw4w9WgXcQ', 'Video', '', 3);
  env = { DB: d1(db), RL: null, RL_AUTH: null, FETCH: fakeFetch, TODAY: '2026-11-06' };
});
const api = async (p) => worker.fetch(new Request('https://mp.test/api' + p), env);

test('detalj: opis, mediji sortirani, nesigurni URL-ovi izbačeni', async () => {
  const r = await (await api('/items/stari-grad-kotor')).json();
  assert.equal(r.item.details, 'Duži opis');
  assert.equal(r.item.website, '');
  assert.deepEqual(r.media.map((m) => m.type), ['image', 'youtube']);
  assert.equal(r.media[1].id, 'dQw4w9WgXcQ');
  assert.equal((await api('/items/nema-takve')).status, 404);
});
test('shapeMedia i shiftYears', () => {
  assert.equal(shapeMedia({ type: 'video', url: 'javascript:x' }), null);
  assert.equal(shapeMedia({ type: 'youtube', url: 'dQw4w9WgXcQ' }).id, 'dQw4w9WgXcQ');
  assert.equal(shiftYears('2028-02-29', 1), '2027-02-28');
});
test('prognoza: blizu je stvarna prognoza, daleko je prosjek iz prethodnih godina', async () => {
  calls.length = 0;
  const near = await (await api('/weather?ref=i:stari-grad-kotor&from=2026-11-08&to=2026-11-10')).json();
  assert.equal(near.mode, 'daily');
  assert.deepEqual(near.days.map((d) => d.src), ['forecast', 'forecast', 'forecast']);
  assert.equal(near.days[0].tmax, 20);
  assert.equal(near.days[0].prob, 30);
  const far = await (await api('/weather?ref=i:stari-grad-kotor&from=2027-07-10&to=2027-07-12')).json();
  assert.deepEqual(far.days.map((d) => d.src), ['climate', 'climate', 'climate']);
  assert.equal(far.days[0].wet, 100);
  assert.ok(calls.some((c) => c.includes('archive-api') && c.includes('2026-07-10')));
});
test('prognoza: dug period daje mjesečni sažetak, bez perioda sedam dana, bez koordinata geokodiranje', async () => {
  const long = await (await api('/weather?ref=i:stari-grad-kotor&from=2026-12-15&to=2027-03-31')).json();
  assert.equal(long.mode, 'monthly');
  assert.deepEqual(long.months.map((m) => m.month), ['2026-12', '2027-01', '2027-02', '2027-03']);
  const none = await (await api('/weather?ref=i:plaza-jaz')).json();
  assert.equal(none.days.length, 7);
  assert.ok(calls.some((c) => c.includes('geocoding-api')));
  assert.equal((await api('/weather?ref=x')).status, 400);
});
test('climateDays prosječi godine', () => {
  const m = (y, v) => new Map([[`${y}-07-10`, v]]);
  const d = climateDays(['2027-07-10'], [m(2026, { tmax: 30, tmin: 20, rain: 0 }), m(2025, { tmax: 32, tmin: 22, rain: 2 })]);
  assert.equal(d[0].tmax, 31);
  assert.equal(d[0].wet, 50);
  assert.equal(monthSummary(d)[0].wetDays, 1);
});
