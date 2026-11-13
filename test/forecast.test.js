import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

const days = (a, n) => Array.from({ length: n }, (_, i) => new Date(Date.parse(a + 'T00:00:00Z') + i * 864e5).toISOString().slice(0, 10));
const fakeFetch = async (url) => {
  const u = new URL(url);
  if (u.hostname.startsWith('archive')) {
    const time = days(u.searchParams.get('start_date'), 7);
    return { ok: true, json: async () => ({ daily: { time, temperature_2m_max: time.map(() => 18.4), temperature_2m_min: time.map(() => 9.6), precipitation_sum: time.map((_, i) => (i === 0 ? 4 : 0)) } }) };
  }
  const time = days('2026-11-14', 7);
  const hours = Array.from({ length: 24 * 7 }, (_, i) => `2026-11-${String(14 + Math.floor(i / 24)).padStart(2, '0')}T${String(i % 24).padStart(2, '0')}:00`);
  return { ok: true, json: async () => ({
    current: { time: '2026-11-14T15:45', temperature_2m: 17.6, apparent_temperature: 16.2, relative_humidity_2m: 62, weather_code: 2, wind_speed_10m: 11.4, is_day: 1 },
    hourly: { time: hours, temperature_2m: hours.map((_, i) => 10 + (i % 24)), weather_code: hours.map(() => 1), is_day: hours.map((_, i) => (i % 24 >= 7 && i % 24 <= 17 ? 1 : 0)) },
    daily: { time, temperature_2m_max: time.map(() => 19.2), temperature_2m_min: time.map(() => 11.1), precipitation_sum: time.map(() => 0), precipitation_probability_max: time.map(() => 20), weather_code: time.map(() => 3), wind_gusts_10m_max: time.map(() => 44.4), uv_index_max: time.map(() => 3.26) },
  }) };
};
const env = { DB: null, RL: null, RL_AUTH: null, FETCH: fakeFetch, TODAY: '2026-11-14' };
const api = (p) => worker.fetch(new Request('https://mp.test/api' + p), env);

test('forecast: trenutno stanje, sati od sada, 7 dana i prosjek', async () => {
  const r = await (await api('/forecast?lat=42.4247&lng=18.7712')).json();
  assert.equal(r.available, true);
  assert.deepEqual([r.lat, r.lng], [42.42, 18.77]);
  assert.deepEqual(r.now, { temp: 18, feels: 16, hum: 62, wind: 11, code: 2, day: true, time: '2026-11-14T15:45' });
  assert.equal(r.hours.length, 24);
  assert.equal(r.hours[0].h, 15);
  assert.equal(r.days.length, 7);
  assert.deepEqual([r.days[0].tmax, r.days[0].tmin, r.days[0].gust, r.days[0].uv], [19, 11, 44, 3.3]);
  assert.equal(r.avg.length, 7);
  assert.deepEqual([r.avg[0].tmax, r.avg[0].tmin], [18, 10]);
});
test('forecast: neispravna ili strana lokacija se odbija', async () => {
  for (const q of ['', '?lat=abc&lng=19', '?lat=48.8&lng=2.3', '?lat=42.4']) assert.equal((await api('/forecast' + q)).status, 400, q);
});
test('forecast: prosjek nije obavezan, greška arhive ne ruši odgovor', async () => {
  const bad = { ...env, FETCH: async (url) => (new URL(url).hostname.startsWith('archive') ? { ok: false, status: 500 } : fakeFetch(url)) };
  const r = await (await worker.fetch(new Request('https://mp.test/api/forecast?lat=42.44&lng=19.26'), bad)).json();
  assert.equal(r.days.length, 7);
  assert.deepEqual(r.avg, []);
});
