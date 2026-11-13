import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createDecipheriv, createECDH, hkdfSync, generateKeyPairSync, createPublicKey, verify } from 'node:crypto';
import worker from '../src/index.js';
import { b64u, unb64u, encryptPayload, vapidHeader, pushConfigured, cleanCampaign, tick, OPSTINE_IDS } from '../src/push.js';

// D1 shim nad SQLite-om
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
    async batch(stmts) {
      db.exec('BEGIN');
      try { const o = []; for (const s of stmts) o.push(await s.run()); db.exec('COMMIT'); return o; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}

// VAPID par ključeva za test
const kp = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const jwk = kp.privateKey.export({ format: 'jwk' });
const PUB = b64u(Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]));

// „Uređaj” korisnika: ima svoj par ključeva i auth tajnu
function device() {
  const ecdh = createECDH('prime256v1'); ecdh.generateKeys();
  const auth = Buffer.from(crypto.getRandomValues(new Uint8Array(16)));
  return { ecdh, auth, sub: { p256dh: b64u(ecdh.getPublicKey()), auth: b64u(auth) } };
}
// Nezavisno dešifrovanje po RFC 8291 (node:crypto), da test ne ovisi o istom kodu kao šifrovanje
function decrypt(dev, body) {
  const salt = body.subarray(0, 16), idlen = body[20], asPub = body.subarray(21, 21 + idlen), ct = body.subarray(21 + idlen);
  assert.equal(body.readUInt32BE(16), 4096);
  const secret = dev.ecdh.computeSecret(asPub);
  const ikm = Buffer.from(hkdfSync('sha256', secret, dev.auth, Buffer.concat([Buffer.from('WebPush: info\0'), dev.ecdh.getPublicKey(), asPub]), 32));
  const cek = Buffer.from(hkdfSync('sha256', ikm, salt, 'Content-Encoding: aes128gcm\0', 16));
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, 'Content-Encoding: nonce\0', 12));
  const d = createDecipheriv('aes-128-gcm', cek, nonce);
  d.setAuthTag(ct.subarray(ct.length - 16));
  const pt = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  assert.equal(pt[pt.length - 1], 2); // delimiter posljednjeg zapisa
  return pt.subarray(0, pt.length - 1).toString('utf8');
}

let db, env, sent;
const EP = (n) => `https://fcm.googleapis.com/fcm/send/dev-${n}`;
const devs = {};
const post = (path, body, method = 'POST') => worker.fetch(new Request('https://mp.test/api' + path, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), env);
const sub = async (n, extra = {}) => { devs[n] = device(); return post('/push/subscribe', { endpoint: EP(n), keys: devs[n].sub, ...extra }); };
const count = (sql, ...a) => db.prepare(sql).get(...a).n;

before(() => {
  db = new DatabaseSync(':memory:');
  for (const f of readdirSync(new URL('../migrations/', import.meta.url)).sort()) {
    if (!/^(0007|0008|0009|0011|0012|0013|0014|0015|0016)_/.test(f)) continue;
    db.exec(readFileSync(new URL('../migrations/' + f, import.meta.url), 'utf8').replace(/^ALTER TABLE restaurants.*$/m, ''));
  }
  sent = [];
  env = {
    DB: d1(db), RL: null, RL_AUTH: null, ADMIN_KEY: 'x'.repeat(24),
    VAPID_PUBLIC: PUB, VAPID_PRIVATE: jwk.d, VAPID_SUBJECT: 'mailto:test@example.com',
    PUSH_FETCH: async (url, init) => { sent.push({ url, init }); return new Response(null, { status: url.endsWith('dev-gone') ? 410 : 201 }); },
  };
});

test('šifrovanje: uređaj može da dešifruje poruku (RFC 8291)', async () => {
  const dev = device();
  const msg = JSON.stringify({ title: 'Fašinada u Perastu', body: 'Sutra · Perast ✓' });
  const body = await encryptPayload(dev.sub, new TextEncoder().encode(msg));
  assert.equal(decrypt(dev, Buffer.from(body)), msg);
});

test('VAPID: potpis se provjerava javnim ključem, aud je origin push servisa', async () => {
  const h = await vapidHeader(env, 'https://fcm.googleapis.com/fcm/send/abc', 1_800_000_000);
  const m = /^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=(.+)$/.exec(h);
  assert.ok(m && m[4] === PUB);
  assert.deepEqual(JSON.parse(Buffer.from(m[2], 'base64url')), { aud: 'https://fcm.googleapis.com', exp: 1_800_000_000 + 43200, sub: 'mailto:test@example.com' });
  const ok = verify('sha256', Buffer.from(m[1] + '.' + m[2]), { key: createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y }, format: 'jwk' }), dsaEncoding: 'ieee-p1363' }, Buffer.from(m[3], 'base64url'));
  assert.ok(ok);
});

test('konfiguracija: bez ključeva ili bez kontakta push nije uključen', () => {
  assert.equal(pushConfigured(env), true);
  assert.equal(pushConfigured({ ...env, VAPID_SUBJECT: '' }), false);
  assert.equal(pushConfigured({ ...env, VAPID_PRIVATE: 'abc' }), false);
  assert.equal(pushConfigured({}), false);
});

test('pretplata: javni ključ se vraća, a loši zahtjevi se odbijaju', async () => {
  const k = await (await worker.fetch(new Request('https://mp.test/api/push/key'), env)).json();
  assert.deepEqual(k, { enabled: true, key: PUB });
  const d = device();
  assert.equal((await post('/push/subscribe', { endpoint: 'https://evil.example/x', keys: d.sub })).status, 400);
  assert.equal((await post('/push/subscribe', { endpoint: 'http://fcm.googleapis.com/x', keys: d.sub })).status, 400);
  assert.equal((await post('/push/subscribe', { endpoint: 'https://fcm.googleapis.com.evil.com/x', keys: d.sub })).status, 400);
  assert.equal((await post('/push/subscribe', { endpoint: EP('bad'), keys: { p256dh: 'AAAA', auth: 'AAAA' } })).status, 400);
  assert.equal((await post('/push/prefs', { endpoint: EP('nema') }, 'PUT')).status, 404);
});

test('pretplata: upis, izmjena izbora i odjava', async () => {
  assert.equal((await sub('a', { lang: 'en', saved: ['fasinada', 'x y', 5] })).status, 200);
  let r = db.prepare('SELECT * FROM push_subs WHERE endpoint = ?').get(EP('a'));
  assert.equal(r.lang, 'en'); assert.equal(r.promo, 1); assert.deepEqual(JSON.parse(r.saved), ['fasinada']);
  assert.equal((await post('/push/prefs', { endpoint: EP('a'), promo: false, saved: ['fasinada', 'bokeljska-noc'] }, 'PUT')).status, 200);
  r = db.prepare('SELECT * FROM push_subs WHERE endpoint = ?').get(EP('a'));
  assert.equal(r.promo, 0); assert.equal(r.remind, 1); assert.deepEqual(JSON.parse(r.saved), ['fasinada', 'bokeljska-noc']);
  await sub('b'); await sub('c', { lang: 'sr', saved: ['fasinada'] });
  assert.equal((await post('/push/unsubscribe', { endpoint: EP('b') })).status, 204);
  assert.equal(count('SELECT COUNT(*) n FROM push_subs'), 2);
});

test('pretplata: nova adresa preuzima izbor stare (replaces)', async () => {
  await sub('old', { lang: 'de', promo: false, saved: ['fasinada'] });
  devs.nw = device();
  await post('/push/subscribe', { endpoint: EP('nw'), keys: devs.nw.sub, replaces: EP('old') });
  const r = db.prepare('SELECT * FROM push_subs WHERE endpoint = ?').get(EP('nw'));
  assert.equal(r.lang, 'de'); assert.equal(r.promo, 0); assert.deepEqual(JSON.parse(r.saved), ['fasinada']);
  assert.equal(count('SELECT COUNT(*) n FROM push_subs WHERE endpoint = ?', EP('old')), 0);
  await post('/push/unsubscribe', { endpoint: EP('nw') });
});

test('podsjetnik: dan prije događaja, samo onima koji su ga sačuvali, jednom', async () => {
  // fasinada je 2027-07-22; „sada” je 21.7. u 11:00 po crnogorskom vremenu
  env.NOW = '2027-07-21T09:00:00Z';
  sent.length = 0;
  await tick(env); // red + slanje
  const bodies = sent.map((s) => ({ ep: s.url, msg: JSON.parse(decrypt(devs[s.url.split('dev-')[1]], Buffer.from(s.init.body))) }));
  assert.deepEqual(bodies.map((b) => b.ep).sort(), [EP('a'), EP('c')]);
  const en = bodies.find((b) => b.ep === EP('a')).msg, sr = bodies.find((b) => b.ep === EP('c')).msg;
  assert.equal(sr.body, 'Sutra · Perast'); assert.equal(en.body, 'Tomorrow · Perast');
  assert.equal(sr.url, '/#d/i%3Afasinada'); assert.equal(sr.tag, 'ev-fasinada');
  assert.ok(sent[0].init.headers.authorization.startsWith('vapid t='));
  sent.length = 0;
  await tick(env);
  assert.equal(sent.length, 0); // nema duplog podsjetnika
});

test('podsjetnik: ne šalje se prije 10h, ni za događaje koji nisu sutra', async () => {
  await sub('d', { saved: ['bokeljska-noc', 'fasinada'] });
  sent.length = 0;
  env.NOW = '2027-07-21T05:00:00Z'; // 07:00 lokalno
  await tick(env);
  assert.equal(sent.length, 0);
  env.NOW = '2027-07-20T09:00:00Z'; // fasinada je za dva dana
  await tick(env);
  assert.equal(sent.length, 0);
  env.NOW = '2027-07-21T09:00:00Z'; // novi uređaj sačuvao događaj kasnije: dobija podsjetnik
  await tick(env);
  assert.deepEqual(sent.map((s) => s.url), [EP('d')]);
});

test('promocija: admin je pravi, zakazana ide tek kad dospije, poštuje izbor korisnika i jezik', async () => {
  const admin = (path, body, method = 'POST') => worker.fetch(new Request('https://mp.test/api/admin' + path, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + 'x'.repeat(24) }, body: body && JSON.stringify(body) }), env);
  assert.equal((await worker.fetch(new Request('https://mp.test/api/admin/push', { method: 'GET' }), env)).status, 401);
  assert.equal((await admin('/push/campaign', { title: 'Popust', body: 'Akcija', url: '//evil.com' })).status, 400);
  assert.equal((await admin('/push/campaign', { title: '', body: 'x' })).status, 400);
  env.NOW = '2027-03-01T10:00:00Z';
  const r = await admin('/push/campaign', { title: 'Vikend akcija', body: '20% popusta u restoranima', title_en: 'Weekend deal', body_en: '20% off', url: '/#istrazi', send_at: '2027-03-01T12:00:00Z' });
  assert.equal(r.status, 201);
  const { id } = await r.json();
  sent.length = 0;
  await tick(env);
  assert.equal(sent.length, 0); // još nije vrijeme
  env.NOW = '2027-03-01T12:00:30Z';
  await tick(env);
  const got = sent.map((s) => ({ ep: s.url, msg: JSON.parse(decrypt(devs[s.url.split('dev-')[1]], Buffer.from(s.init.body))) }));
  // „a” je isključio promocije; ostali (c: sr, d: sr) primaju crnogorski tekst
  assert.deepEqual(got.map((g) => g.ep).sort(), [EP('c'), EP('d')]);
  assert.equal(got[0].msg.title, 'Vikend akcija');
  assert.equal(got[0].msg.tag, 'promo-' + id);
  const list = await (await admin('/push', undefined, 'GET')).json();
  assert.equal(list.subs.total, 3); assert.ok(list.subs.langs.sr.total >= 1 && Object.values(list.subs.langs).reduce((n, x) => n + x.total, 0) === 3); assert.equal(list.campaigns[0].recipients, 2); assert.equal(list.campaigns[0].pending, 0);
  assert.equal((await admin('/push/campaign/' + id, undefined, 'DELETE')).status, 204); // poslata se briše iz istorije
  assert.equal((await admin('/push/campaign/' + id, undefined, 'DELETE')).status, 404);
  assert.ok(!(await (await admin('/push', undefined, 'GET')).json()).campaigns.some((c) => c.id === id));
});

test('promocija: test šalje samo na najnoviji uređaj, a zakazanu je moguće otkazati', async () => {
  const admin = (path, body, method = 'POST') => worker.fetch(new Request('https://mp.test/api/admin' + path, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + 'x'.repeat(24) }, body: body && JSON.stringify(body) }), env);
  env.NOW = '2027-03-02T10:00:00Z'; sent.length = 0;
  await admin('/push/campaign', { title: 'Test', body: 'Samo ja', audience: 'test' });
  await tick(env);
  assert.deepEqual(sent.map((s) => s.url), [EP('d')]);
  const { id } = await (await admin('/push/campaign', { title: 'Kasnije', body: 'x', send_at: '2027-03-05T10:00:00Z' })).json();
  assert.equal((await admin('/push/campaign/' + id, undefined, 'DELETE')).status, 204);
  sent.length = 0; env.NOW = '2027-03-06T10:00:00Z'; await tick(env);
  assert.equal(sent.length, 0);
});

test('slanje: neispravna pretplata (410) se briše, a greške servisa se ponavljaju najviše tri puta', async () => {
  await sub('gone', { saved: [] });
  const admin = (path, body) => worker.fetch(new Request('https://mp.test/api/admin' + path, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + 'x'.repeat(24) }, body: JSON.stringify(body) }), env);
  env.NOW = '2027-04-01T10:00:00Z';
  await admin('/push/campaign', { title: 'Svima', body: 'x' });
  await tick(env);
  assert.equal(count('SELECT COUNT(*) n FROM push_subs WHERE endpoint = ?', EP('gone')), 0);
  const real = env.PUSH_FETCH;
  env.PUSH_FETCH = async () => new Response(null, { status: 503 });
  await admin('/push/campaign', { title: 'Opet', body: 'x' });
  for (let i = 0; i < 5; i++) await tick(env);
  assert.equal(count('SELECT COUNT(*) n FROM push_queue'), 0);
  assert.ok(count('SELECT COUNT(*) n FROM push_subs') >= 3); // 503 ne briše pretplate
  env.PUSH_FETCH = real;
});

test('cleanCampaign: duži tekstovi i datum u prošlosti se odbijaju', () => {
  assert.throws(() => cleanCampaign({ title: 'x'.repeat(61), body: 'b' }), /predugo/);
  assert.throws(() => cleanCampaign({ title: 't', body: 'b', send_at: '2020-01-01T00:00:00Z' }, Date.parse('2027-01-01')), /prošlosti/);
  assert.equal(cleanCampaign({ title: 't', body: 'b' }).url, '/');
});

test('okidač: /api/push/tick traži tajni ključ i pokreće slanje', async () => {
  const call = (headers = {}, qs = '') => worker.fetch(new Request('https://mp.test/api/push/tick' + qs, { headers }), env);
  assert.equal((await call()).status, 503); // PUSH_TICK_KEY nije podešen
  env.PUSH_TICK_KEY = 'k'.repeat(20);
  assert.equal((await call()).status, 401);
  assert.equal((await call({ authorization: 'Bearer ' + 'x'.repeat(20) })).status, 401);
  const admin = (b) => worker.fetch(new Request('https://mp.test/api/admin/push/campaign', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + 'x'.repeat(24) }, body: JSON.stringify(b) }), env);
  env.NOW = '2027-05-01T10:00:00Z';
  await admin({ title: 'Preko okidača', body: 'x', audience: 'test' });
  sent.length = 0;
  const r = await call({ authorization: 'Bearer ' + 'k'.repeat(20) });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, configured: true, sent: 1 });
  assert.equal(sent.length, 1);
  assert.equal((await call({}, '?key=' + 'k'.repeat(20))).status, 200); // i preko ?key=
});

test('promocija: gost dobija tekst na svom jeziku, a ako ga nema engleski pa crnogorski', async () => {
  const admin = (path, body) => worker.fetch(new Request('https://mp.test/api/admin' + path, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + 'x'.repeat(24) }, body: JSON.stringify(body) }), env);
  for (const l of ['de', 'ru', 'it', 'en']) await sub('l-' + l, { lang: l, saved: [] });
  env.NOW = '2027-04-01T10:00:00Z';
  const r = await admin('/push/campaign', { title: 'Akcija', body: 'Popust', title_en: 'Deal', body_en: 'Discount', title_de: 'Angebot', body_de: 'Rabatt', title_it: 'Offerta', body_it: 'Sconto', send_at: '2027-04-01T10:00:00Z' });
  assert.equal(r.status, 201);
  sent.length = 0;
  await tick(env);
  const by = {};
  for (const s of sent) { const n = s.url.split('dev-')[1]; if (n.startsWith('l-')) by[n.slice(2)] = JSON.parse(decrypt(devs[n], Buffer.from(s.init.body))); }
  assert.equal(by.de.title, 'Angebot'); assert.equal(by.de.body, 'Rabatt');
  assert.equal(by.it.title, 'Offerta');
  assert.equal(by.ru.title, 'Deal'); // nema ruskog: engleski
  assert.equal(by.en.title, 'Deal');
  assert.equal((await admin('/push/campaign', { title: 'x', body: 'y', title_de: 'x'.repeat(61) })).status, 400);
});

test('prevod: admin dobija prevod za sva četiri jezika, skraćen na dozvoljenu dužinu; bez AI vezanja javlja 503', async () => {
  const admin = (body) => worker.fetch(new Request('https://mp.test/api/admin/push/translate', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + 'x'.repeat(24) }, body: JSON.stringify(body) }), env);
  assert.equal((await admin({ title: 'Akcija', body: 'Popust' })).status, 503);
  const calls = [];
  env.AI = { run: async (m, p) => { calls.push(p); return { translated_text: p.target_lang === 'ru' ? 'слово '.repeat(40) : `${p.target_lang}: ${p.text}` }; } };
  try {
    const r = await admin({ title: 'Akcija', body: 'Popust' });
    assert.equal(r.status, 200);
    const o = await r.json();
    assert.equal(o.title_de, 'de: Akcija'); assert.equal(o.body_it, 'it: Popust'); assert.equal(o.title_en, 'en: Akcija');
    assert.ok(o.title_ru.length <= 60 && o.body_ru.length <= 180 && o.title_ru.endsWith('…'));
    assert.equal(calls.length, 8); assert.ok(calls.every((c) => c.source_lang === 'hr'));
    assert.equal((await admin({ title: '', body: 'x' })).status, 400);
    env.AI = { run: async () => { throw new Error('boom'); } };
    assert.equal((await admin({ title: 'a', body: 'b' })).status, 502);
  } finally { delete env.AI; }
});

test('prevod: emoji se ne šalju modelu nego se vraćaju netaknuti', async () => {
  const admin = (body) => worker.fetch(new Request('https://mp.test/api/admin/push/translate', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + 'x'.repeat(24) }, body: JSON.stringify(body) }), env);
  const seen = [];
  env.AI = { run: async (m, p) => { seen.push(p.text); return { translated_text: `${p.target_lang}: ${p.text}` }; } };
  try {
    const o = await (await admin({ title: '🎉 Akcija', body: 'Popust 20% na ručak 🍽️🥳' })).json();
    assert.ok(seen.every((t) => !/\p{Extended_Pictographic}/u.test(t)));
    assert.equal(o.title_de, '🎉 de: Akcija');
    assert.equal(o.body_ru, 'ru: Popust 20% na ručak 🍽️🥳');
  } finally { delete env.AI; }
});

test('istorija: poslate se brišu pojedinačno i skupno, a zaustavljanje čisti red za slanje', async () => {
  const admin = (path, body, method = 'POST') => worker.fetch(new Request('https://mp.test/api/admin' + path, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + 'x'.repeat(24) }, body: body && JSON.stringify(body) }), env);
  env.NOW = '2027-05-01T10:00:00Z';
  const mk = async (t, extra = {}) => (await (await admin('/push/campaign', { title: t, body: 'x', send_at: '2027-05-01T10:00:00Z', ...extra })).json()).id;
  const one = await mk('Prva', { audience: 'test' });
  await tick(env); // test promocija ide jednom uređaju i odmah je poslata
  const busy = await mk('Duga');
  env.PUSH_BATCH = 1;
  try { await tick(env); } finally { delete env.PUSH_BATCH; }
  const list = await (await admin('/push', undefined, 'GET')).json();
  assert.equal(list.campaigns.find((c) => c.id === one).pending, 0);
  assert.ok(list.campaigns.find((c) => c.id === busy).pending > 0);
  const r = await admin('/push/campaign/sent', undefined, 'DELETE');
  assert.equal(r.status, 200); assert.ok((await r.json()).deleted >= 1);
  const after = (await (await admin('/push', undefined, 'GET')).json()).campaigns;
  assert.ok(!after.some((c) => c.id === one)); // poslata obrisana
  assert.ok(after.some((c) => c.id === busy)); // ona koja se još šalje ostaje
  assert.equal((await admin('/push/campaign/' + busy, undefined, 'DELETE')).status, 204);
  const left = await env.DB.prepare('SELECT COUNT(*) AS n FROM push_queue WHERE campaign_id = ?').bind(busy).first();
  assert.equal(left.n, 0);
});

test('statistika: stiglo i otvoreno se računaju po uređaju najviše jednom, tuđa adresa ne mijenja brojke, brisanje čisti statistiku', async () => {
  const admin = (path, body, method = 'POST') => worker.fetch(new Request('https://mp.test/api/admin' + path, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + 'x'.repeat(24) }, body: body && JSON.stringify(body) }), env);
  for (const n of ['s1', 's2', 's3']) await sub('st-' + n, { lang: 'sr', saved: [] });
  env.NOW = '2027-06-01T10:00:00Z';
  const id = (await (await admin('/push/campaign', { title: 'Stat', body: 'x', send_at: '2027-06-01T10:00:00Z' })).json()).id;
  sent.length = 0;
  for (let i = 0; i < 30 && count('SELECT COUNT(*) AS n FROM push_queue WHERE campaign_id = ?', id) !== 0 || i === 0; i++) await tick(env);
  const total = count('SELECT COUNT(*) AS n FROM push_stats WHERE campaign_id = ?', id);
  assert.ok(total >= 3);
  // poruka nosi id promocije
  const mine = sent.find((s) => s.url.endsWith('dev-st-s1'));
  assert.equal(JSON.parse(decrypt(devs['st-s1'], Buffer.from(mine.init.body))).c, id);
  // dva uređaja prikazano, jedan kucnuo; ponavljanje se ne računa dvaput
  for (let k = 0; k < 2; k++) assert.equal((await post('/push/event', { c: id, kind: 'shown', endpoint: EP('st-s1') })).status, 204);
  assert.equal((await post('/push/event', { c: id, kind: 'shown', endpoint: EP('st-s2') })).status, 204);
  for (let k = 0; k < 2; k++) assert.equal((await post('/push/event', { c: id, kind: 'click', endpoint: EP('st-s3') })).status, 204); // klik znači i da je prikazano
  // nepoznata adresa i nepostojeća promocija ne mijenjaju ništa
  assert.equal((await post('/push/event', { c: id, kind: 'click', endpoint: 'https://fcm.googleapis.com/fcm/send/nepoznat' })).status, 204);
  assert.equal((await post('/push/event', { c: id + 999, kind: 'click', endpoint: EP('st-s1') })).status, 204);
  assert.equal((await post('/push/event', { c: 'x', kind: 'click', endpoint: EP('st-s1') })).status, 400);
  assert.equal((await post('/push/event', { c: id, kind: 'nesto', endpoint: EP('st-s1') })).status, 400);
  const row = (await (await admin('/push', undefined, 'GET')).json()).campaigns.find((c) => c.id === id);
  assert.equal(row.tracked, total); assert.equal(row.shown, 3); assert.equal(row.clicked, 1);
  assert.ok(row.shown <= row.recipients && row.clicked <= row.shown);
  assert.equal((await admin('/push/campaign/' + id, undefined, 'DELETE')).status, 204);
  assert.equal(count('SELECT COUNT(*) AS n FROM push_stats WHERE campaign_id = ?', id), 0);
});

test('izvještaj za partnera: ukupno i po jezicima, 404 za nepostojeću promociju', async () => {
  const admin = (path, body, method = 'POST') => worker.fetch(new Request('https://mp.test/api/admin' + path, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + 'x'.repeat(24) }, body: body && JSON.stringify(body) }), env);
  for (const [n, l] of [['r1', 'sr'], ['r2', 'de'], ['r3', 'de']]) await sub('rp-' + n, { lang: l, saved: [] });
  env.NOW = '2027-07-01T10:00:00Z';
  const id = (await (await admin('/push/campaign', { title: 'Izvještaj', body: 'x', send_at: '2027-07-01T10:00:00Z' })).json()).id;
  for (let i = 0; i < 30 && (i === 0 || count('SELECT COUNT(*) AS n FROM push_queue WHERE campaign_id = ?', id) !== 0); i++) await tick(env);
  await post('/push/event', { c: id, kind: 'shown', endpoint: EP('rp-r2') });
  await post('/push/event', { c: id, kind: 'click', endpoint: EP('rp-r3') });
  const r = await (await admin('/push/report/' + id, undefined, 'GET')).json();
  assert.equal(r.campaign.title, 'Izvještaj');
  assert.equal(r.totals.sent, count('SELECT COUNT(*) AS n FROM push_stats WHERE campaign_id = ?', id));
  assert.equal(r.totals.shown, 2); assert.equal(r.totals.clicked, 1);
  assert.equal(r.langs.reduce((n, x) => n + x.sent, 0), r.totals.sent);
  assert.equal(r.langs.reduce((n, x) => n + x.shown, 0), 2);
  const de = r.langs.find((x) => x.lang === 'de');
  assert.ok(de.sent >= 2 && de.shown === 2 && de.clicked === 1);
  assert.ok(Number.isInteger(r.totals.h1) && Number.isInteger(r.totals.h24));
  assert.equal((await admin('/push/report/' + (id + 999), undefined, 'GET')).status, 404);
  assert.equal((await admin('/push/report/abc', undefined, 'GET')).status, 404);
});

test('ciljanje po opštini: izabrana opština, opciono i oni bez izbora; pogrešna šifra se odbija; doseg; probna ignoriše ciljanje', async () => {
  const admin = (path, body, method = 'POST') => worker.fetch(new Request('https://mp.test/api/admin' + path, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + 'x'.repeat(24) }, body: body && JSON.stringify(body) }), env);
  await sub('t-k', { lang: 'sr', saved: [], places: ['kotor', 'atlantida'] }); // nepoznata šifra se izbacuje
  await sub('t-b', { lang: 'sr', saved: [], places: ['budva'] });
  await sub('t-u', { lang: 'sr', saved: [] });
  assert.deepEqual(JSON.parse(db.prepare('SELECT places FROM push_subs WHERE endpoint = ?').get(EP('t-k')).places), ['kotor']);
  // izmjena izbora preko postavki; kad se ne pošalje, izbor ostaje
  assert.equal((await post('/push/prefs', { endpoint: EP('t-b'), places: ['budva', 'tivat'] }, 'PUT')).status, 200);
  assert.deepEqual(JSON.parse(db.prepare('SELECT places FROM push_subs WHERE endpoint = ?').get(EP('t-b')).places), ['budva', 'tivat']);
  assert.equal((await post('/push/prefs', { endpoint: EP('t-b'), promo: true }, 'PUT')).status, 200);
  assert.deepEqual(JSON.parse(db.prepare('SELECT places FROM push_subs WHERE endpoint = ?').get(EP('t-b')).places), ['budva', 'tivat']);
  assert.equal((await post('/push/subscribe', { endpoint: EP('t-b'), keys: devs['t-b'].sub, lang: 'sr' })).status, 200); // ponovna prijava bez izbora ga ne briše
  assert.deepEqual(JSON.parse(db.prepare('SELECT places FROM push_subs WHERE endpoint = ?').get(EP('t-b')).places), ['budva', 'tivat']);

  env.NOW = '2027-08-01T10:00:00Z';
  const run = async (body) => {
    const r = await admin('/push/campaign', { title: 'Opština', body: 'x', send_at: '2027-08-01T10:00:00Z', ...body });
    assert.equal(r.status, 201);
    const id = (await r.json()).id;
    sent.length = 0;
    for (let i = 0; i < 30 && (i === 0 || count('SELECT COUNT(*) AS n FROM push_queue WHERE campaign_id = ?', id) !== 0); i++) await tick(env);
    return new Set(sent.map((x) => x.url.split('dev-')[1]).filter((n) => n.startsWith('t-')));
  };
  const only = await run({ places: ['kotor'], and_unset: false });
  assert.deepEqual([...only], ['t-k']);
  const withUnset = await run({ places: ['kotor'], and_unset: true });
  assert.ok(withUnset.has('t-k') && withUnset.has('t-u') && !withUnset.has('t-b'));
  const both = await run({ places: ['tivat', 'kotor'], and_unset: false });
  assert.deepEqual([...both].sort(), ['t-b', 't-k']);
  const everyone = await run({});
  assert.ok(everyone.has('t-k') && everyone.has('t-b') && everyone.has('t-u'));
  // probna promocija ide na posljednji uređaj bez obzira na ciljanje
  const test = await run({ places: ['kotor'], audience: 'test' });
  assert.equal(sent.length, 1); assert.ok(test.has('t-u'));

  assert.equal((await admin('/push/campaign', { title: 'x', body: 'y', places: ['atlantida'] })).status, 400);
  const n = async (q) => (await (await admin('/push/reach?' + q, undefined, 'GET')).json()).n;
  assert.equal(await n('places=kotor&unset=0'), 1);
  assert.equal(await n('places=kotor,budva&unset=0'), 2);
  assert.ok((await n('places=kotor&unset=1')) > 1);
  assert.equal((await admin('/push/reach?places=atlantida', undefined, 'GET')).status, 400);
  const list = await (await admin('/push', undefined, 'GET')).json();
  assert.equal(list.subs.places.by.kotor, 1); assert.equal(list.subs.places.by.budva, 1); assert.ok(list.subs.places.unset >= 1);
});

test('opštine: spisak u public/opstine.js isti je kao na serveru', () => {
  const ids = [...readFileSync(new URL('../public/opstine.js', import.meta.url), 'utf8').matchAll(/\['([a-z-]+)', '/g)].map((m) => m[1]);
  assert.deepEqual(ids, OPSTINE_IDS);
  assert.equal(OPSTINE_IDS.length, 25);
});

test('partneri: validacija, veza sa promocijom, zbirni izvještaj bez probnih, brisanje odvaja promocije', async () => {
  const admin = (path, body, method = 'POST') => worker.fetch(new Request('https://mp.test/api/admin' + path, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + 'x'.repeat(24) }, body: body && JSON.stringify(body) }), env);
  assert.equal((await admin('/partners', { name: '' })).status, 400);
  assert.equal((await admin('/partners', { name: 'X', type: 'banka' })).status, 400);
  assert.equal((await admin('/partners', { name: 'X', starts_on: '2027-05-01', ends_on: '2027-04-01' })).status, 400);
  assert.equal((await admin('/partners', { name: 'X', ends_on: 'sutra' })).status, 400);
  const r = await admin('/partners', { name: 'TO Kotor', type: 'to', contact: 'Ana 067 000 000', package: 'Istaknuto + 2 push', starts_on: '2027-09-01', ends_on: '2027-12-31', note: 'pilot' });
  assert.equal(r.status, 201);
  const id = (await r.json()).id;
  let list = (await (await admin('/partners', undefined, 'GET')).json()).partners;
  assert.equal(list.find((p) => p.id === id).promos, 0);
  assert.equal((await admin('/partners/' + id, { name: 'TO Kotor (opština)' }, 'PUT')).status, 204);
  assert.equal((await (await admin('/partners/' + id, undefined, 'GET')).json()).partner.name, 'TO Kotor (opština)');
  assert.equal((await (await admin('/partners/' + id, undefined, 'GET')).json()).partner.package, 'Istaknuto + 2 push'); // izmjena jednog polja ne briše ostala

  // promocija: nepostojeći partner se odbija
  env.NOW = '2027-09-10T10:00:00Z';
  const mk = async (extra) => admin('/push/campaign', { title: 'Partner promo', body: 'x', send_at: '2027-09-10T10:00:00Z', ...extra });
  assert.equal((await mk({ partner_id: id + 999 })).status, 400);
  assert.equal((await mk({ partner_id: 'abc' })).status, 400);
  const c1 = (await (await mk({ partner_id: id })).json()).id;
  for (let i = 0; i < 30 && (i === 0 || count('SELECT COUNT(*) AS n FROM push_queue WHERE campaign_id = ?', c1) !== 0); i++) await tick(env);
  await post('/push/event', { c: c1, kind: 'click', endpoint: EP('t-u') });
  const c2 = (await (await mk({ partner_id: id, audience: 'test' })).json()).id; // probna se ne računa partneru
  await tick(env);
  const rep = await (await admin('/partners/' + id + '/report', undefined, 'GET')).json();
  assert.equal(rep.partner.name, 'TO Kotor (opština)');
  assert.equal(rep.totals.promos, 1); assert.equal(rep.campaigns[0].id, c1);
  assert.equal(rep.totals.sent, rep.campaigns[0].recipients); assert.equal(rep.totals.tracked_sent, rep.totals.sent);
  assert.equal(rep.totals.clicked, 1); assert.ok(rep.totals.shown >= 1 && rep.totals.shown <= rep.totals.sent);
  list = (await (await admin('/partners', undefined, 'GET')).json()).partners;
  assert.equal(list.find((p) => p.id === id).promos, 1);
  const push = await (await admin('/push', undefined, 'GET')).json();
  assert.ok(push.partners.some((p) => p.id === id));
  assert.equal(push.campaigns.find((c) => c.id === c1).partner_name, 'TO Kotor (opština)');
  assert.equal((await (await admin('/push/report/' + c1, undefined, 'GET')).json()).campaign.partner_name, 'TO Kotor (opština)');

  // brisanje partnera: promocije ostaju, bez partnera
  assert.equal((await admin('/partners/' + id, undefined, 'DELETE')).status, 204);
  assert.equal((await admin('/partners/' + id, undefined, 'GET')).status, 404);
  const after = (await (await admin('/push', undefined, 'GET')).json()).campaigns;
  assert.equal(after.find((c) => c.id === c1).partner_id, null);
  assert.ok(after.some((c) => c.id === c2));
});
