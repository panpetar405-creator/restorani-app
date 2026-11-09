// Web Push (RFC 8030 + 8291 aes128gcm + VAPID RFC 8292) bez vanjskih biblioteka, samo WebCrypto.
// Tokovi:
//  1) korisnik uključi obavještenja u aplikaciji -> /api/push/subscribe
//  2) admin napravi promociju (odmah ili zakazanu) -> tabela push_campaigns
//  3) cron (svake minute) -> tick(): zakazane promocije i podsjetnici idu u push_queue, pa se red šalje u paketima
import { HttpError, addDaysISO, json, readJson, sha256 } from './lib.js';

const SLUG = /^[a-z0-9-]{1,60}$/;
const LANGS = ['sr', 'en', 'de', 'ru', 'it'];
const TZ = 'Europe/Podgorica';
// Samo poznati push servisi: server nikad ne šalje na proizvoljnu adresu koju pošalje klijent.
const PUSH_HOSTS = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'push.services.mozilla.com', 'push.apple.com', 'notify.windows.com'];

const enc = new TextEncoder();
const concat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
export const b64u = (buf) => { let s = ''; for (const x of new Uint8Array(buf)) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
export const unb64u = (s) => {
  const t = String(s).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(t + '='.repeat((4 - (t.length % 4)) % 4)), (c) => c.charCodeAt(0));
};

/* ---------------- šifrovanje poruke (RFC 8291) ---------------- */
async function hkdf(salt, ikm, info, len) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8));
}

/** sub = { p256dh, auth } (base64url). opts.keys i opts.salt služe samo za testove. */
export async function encryptPayload(sub, plaintext, opts = {}) {
  const uaPub = unb64u(sub.p256dh), auth = unb64u(sub.auth);
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const pair = opts.keys || (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']));
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, pair.privateKey, 256));
  const salt = opts.salt || crypto.getRandomValues(new Uint8Array(16));
  const ikm = await hkdf(auth, secret, concat(enc.encode('WebPush: info\0'), uaPub, asPub), 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const body = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, concat(plaintext, new Uint8Array([2]))));
  return concat(salt, new Uint8Array([0, 0, 0x10, 0]), new Uint8Array([asPub.length]), asPub, body);
}

/* ---------------- VAPID ---------------- */
export function pushConfigured(env) {
  try {
    return unb64u(env.VAPID_PUBLIC || '').length === 65
      && unb64u(env.VAPID_PRIVATE || '').length === 32
      && /^(mailto:[^\s@]+@[^\s@]+|https:\/\/\S+)$/.test(env.VAPID_SUBJECT || '');
  } catch { return false; }
}

let keyCache = { id: '', key: null };
async function signingKey(env) {
  const id = env.VAPID_PUBLIC + env.VAPID_PRIVATE;
  if (keyCache.id === id) return keyCache.key;
  const pub = unb64u(env.VAPID_PUBLIC);
  const jwk = { kty: 'EC', crv: 'P-256', x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), d: env.VAPID_PRIVATE, ext: true };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  keyCache = { id, key };
  return key;
}

export async function vapidHeader(env, endpoint, nowSec = Math.floor(Date.now() / 1000)) {
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: nowSec + 12 * 3600, sub: env.VAPID_SUBJECT })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, await signingKey(env), enc.encode(head + '.' + claims));
  return `vapid t=${head}.${claims}.${b64u(sig)}, k=${env.VAPID_PUBLIC}`;
}

/** Šalje jednu poruku. Vraća 'ok' | 'gone' (pretplata ne postoji) | 'retry' | 'fail'. */
export async function sendOne(env, sub, payload, ttl = 86400) {
  const body = await encryptPayload(sub, enc.encode(payload));
  const res = await (env.PUSH_FETCH || fetch)(sub.endpoint, {
    method: 'POST',
    headers: {
      authorization: await vapidHeader(env, sub.endpoint),
      'content-encoding': 'aes128gcm',
      'content-type': 'application/octet-stream',
      ttl: String(ttl),
      urgency: 'normal',
    },
    body,
    signal: AbortSignal.timeout(8000),
  });
  if (res.status >= 200 && res.status < 300) return 'ok';
  if (res.status === 404 || res.status === 410) return 'gone';
  console.error('push', res.status, new URL(sub.endpoint).hostname, (await res.text().catch(() => '')).slice(0, 200));
  return res.status === 429 || res.status >= 500 ? 'retry' : 'fail';
}

/* ---------------- pretplate (javni API) ---------------- */
const hostOk = (h) => PUSH_HOSTS.some((d) => h === d || h.endsWith('.' + d));

function cleanEndpoint(v) {
  let u;
  try { u = new URL(String(v)); } catch { throw new HttpError(400, 'Neispravna pretplata'); }
  if (u.protocol !== 'https:' || !hostOk(u.hostname) || String(v).length > 600) throw new HttpError(400, 'Neispravna pretplata');
  return u.href;
}

function cleanKeys(k) {
  try {
    const p = unb64u(k && k.p256dh), a = unb64u(k && k.auth);
    if (p.length === 65 && p[0] === 4 && a.length === 16) return { p256dh: b64u(p), auth: b64u(a) };
  } catch { /* neispravan base64 */ }
  throw new HttpError(400, 'Neispravni ključevi pretplate');
}

const cleanSaved = (v) => (Array.isArray(v) ? [...new Set(v.filter((s) => typeof s === 'string' && SLUG.test(s)))].slice(0, 200) : null);
const flag = (v, d) => (v === undefined ? d : v ? 1 : 0);

async function subscribe(env, request) {
  if (!pushConfigured(env)) throw new HttpError(503, 'Obavještenja još nisu uključena na serveru');
  const b = await readJson(request, 8000);
  const endpoint = cleanEndpoint(b.endpoint);
  const keys = cleanKeys(b.keys);
  // pretplata je istekla/zamijenjena: nova preuzima izbor stare
  const old = b.replaces ? await env.DB.prepare('SELECT * FROM push_subs WHERE endpoint = ?').bind(cleanEndpoint(b.replaces)).first() : null;
  const lang = LANGS.includes(b.lang) ? b.lang : old ? old.lang : 'sr';
  const saved = cleanSaved(b.saved);
  await env.DB
    .prepare(
      `INSERT INTO push_subs (endpoint, p256dh, auth, lang, promo, remind, saved) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, lang = excluded.lang,
         promo = excluded.promo, remind = excluded.remind, saved = excluded.saved, seen_at = datetime('now')`,
    )
    .bind(endpoint, keys.p256dh, keys.auth, lang, flag(b.promo, old ? old.promo : 1), flag(b.remind, old ? old.remind : 1), JSON.stringify(saved || (old ? JSON.parse(old.saved || '[]') : [])))
    .run();
  if (old && old.endpoint !== endpoint) await env.DB.prepare('DELETE FROM push_subs WHERE id = ?').bind(old.id).run();
  return json({ ok: true });
}

async function updatePrefs(env, request) {
  const b = await readJson(request, 8000);
  const endpoint = cleanEndpoint(b.endpoint);
  const row = await env.DB.prepare('SELECT * FROM push_subs WHERE endpoint = ?').bind(endpoint).first();
  if (!row) throw new HttpError(404, 'Pretplata nije pronađena');
  const saved = cleanSaved(b.saved);
  await env.DB
    .prepare("UPDATE push_subs SET lang = ?, promo = ?, remind = ?, saved = ?, seen_at = datetime('now') WHERE id = ?")
    .bind(LANGS.includes(b.lang) ? b.lang : row.lang, flag(b.promo, row.promo), flag(b.remind, row.remind), saved ? JSON.stringify(saved) : row.saved, row.id)
    .run();
  return json({ ok: true });
}

async function unsubscribe(env, request) {
  const b = await readJson(request, 2000);
  const endpoint = cleanEndpoint(b.endpoint);
  const row = await env.DB.prepare('SELECT id FROM push_subs WHERE endpoint = ?').bind(endpoint).first();
  if (row) await dropSubs(env, [row.id]);
  return new Response(null, { status: 204 });
}

async function dropSubs(env, ids) {
  if (!ids.length) return;
  const q = ids.map(() => '?').join(',');
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM push_queue WHERE sub_id IN (${q})`).bind(...ids),
    env.DB.prepare(`DELETE FROM push_log WHERE sub_id IN (${q})`).bind(...ids),
    env.DB.prepare(`DELETE FROM push_subs WHERE id IN (${q})`).bind(...ids),
  ]);
}

/* Okidač za slanje: koristi ga vanjski besplatni cron (npr. cron-job.org) kad Cloudflare cron nije dostupan.
   Ključ ide u zaglavlju „Authorization: Bearer ...” (ili ?key=...) i mora biti jednak tajni PUSH_TICK_KEY. */
async function tickRoute(request, env) {
  const secret = String(env.PUSH_TICK_KEY || '');
  if (secret.length < 16) throw new HttpError(503, 'Nedostaje PUSH_TICK_KEY');
  const m = /^Bearer (.{16,200})$/.exec(request.headers.get('authorization') || '');
  const given = m ? m[1] : new URL(request.url).searchParams.get('key') || '';
  const [a, b] = await Promise.all([sha256(given), sha256(secret)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  if (diff) throw new HttpError(401, 'Neispravan ključ');
  return json({ ok: true, ...(await tick(env)) });
}

export async function pushRoute(request, env, seg, method) {
  const what = seg[2];
  if (what === 'tick' && (method === 'GET' || method === 'POST')) return tickRoute(request, env);
  if (what === 'key' && method === 'GET') return json({ enabled: pushConfigured(env), key: pushConfigured(env) ? env.VAPID_PUBLIC : '' });
  if (what === 'subscribe' && method === 'POST') return subscribe(env, request);
  if (what === 'prefs' && method === 'PUT') return updatePrefs(env, request);
  if (what === 'unsubscribe' && method === 'POST') return unsubscribe(env, request);
  throw new HttpError(404, 'Nepoznata ruta');
}

/* ---------------- admin: promocije ---------------- */
const text = (v, max, name, req = false) => {
  const s = typeof v === 'string' ? v.trim() : '';
  if (req && !s) throw new HttpError(400, `Polje "${name}" je obavezno`);
  if (s.length > max) throw new HttpError(400, `Polje "${name}" je predugo (najviše ${max} znakova)`);
  return s;
};

export function cleanCampaign(b, nowMs = Date.now()) {
  const url = text(b.url, 200, 'Link') || '/';
  if (!/^\/(?!\/)[^\s"'<>]*$/.test(url)) throw new HttpError(400, 'Link mora početi sa / (npr. /#d/i:fasinada ili /#istrazi)');
  let sendAt = new Date(nowMs);
  if (b.send_at) {
    sendAt = new Date(b.send_at);
    if (Number.isNaN(sendAt.getTime())) throw new HttpError(400, 'Neispravan datum slanja');
    if (sendAt.getTime() < nowMs - 5 * 60000) throw new HttpError(400, 'Vrijeme slanja je u prošlosti');
    if (sendAt.getTime() > nowMs + 366 * 86400000) throw new HttpError(400, 'Vrijeme slanja je predaleko');
  }
  return {
    title: text(b.title, 60, 'Naslov', true),
    body: text(b.body, 180, 'Tekst', true),
    title_en: text(b.title_en, 60, 'Naslov (EN)'),
    body_en: text(b.body_en, 180, 'Tekst (EN)'),
    title_de: text(b.title_de, 60, 'Naslov (DE)'),
    body_de: text(b.body_de, 180, 'Tekst (DE)'),
    title_ru: text(b.title_ru, 60, 'Naslov (RU)'),
    body_ru: text(b.body_ru, 180, 'Tekst (RU)'),
    title_it: text(b.title_it, 60, 'Naslov (IT)'),
    body_it: text(b.body_it, 180, 'Tekst (IT)'),
    url,
    audience: b.audience === 'test' ? 'test' : 'all',
    send_at: sendAt.toISOString(),
  };
}


/* ---------------- admin: automatski prevod (Cloudflare Workers AI, binding „AI”) ---------------- */
const TR_MODEL = '@cf/meta/m2m100-1.2b';
const TR_LANGS = ['en', 'de', 'ru', 'it'];
function clip(v, max) {
  const s = String(v || '').trim();
  if (s.length <= max) return s;
  let cut = s.slice(0, max - 1);
  if (/[\uD800-\uDBFF]$/.test(cut)) cut = cut.slice(0, -1); // ne presijecaj emoji na pola
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.-]+$/, '') + '…';
}
/* Model za prevod kvari emoji, pa ih izdvajamo prije prevoda i vraćamo nepromijenjene (početni ostaju na početku, ostali idu na kraj). */
const EMOJI = /(?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:\uFE0F|\u200D|\p{Emoji_Modifier}|\p{Extended_Pictographic})*/gu;
const EMOJI_LEAD = new RegExp(`^(?:${EMOJI.source}\\s*)+`, 'u');
export function splitEmoji(v) {
  const t = String(v || '').trim();
  const lead = (t.match(EMOJI_LEAD) || [''])[0].trim();
  const rest = t.slice(lead.length);
  return { lead, tail: (rest.match(EMOJI) || []).join(''), clean: rest.replace(EMOJI, '').replace(/\s{2,}/g, ' ').trim() };
}
export async function translateCampaign(env, b) {
  if (!env.AI || typeof env.AI.run !== 'function') throw new HttpError(503, 'Prevođenje nije uključeno (u wrangler.jsonc treba dodati "ai": { "binding": "AI" })');
  const title = text(b.title, 60, 'Naslov', true), body = text(b.body, 180, 'Tekst', true);
  const one = async (src, lang, max) => {
    const { lead, tail, clean } = splitEmoji(src);
    if (!clean) return clip(src, max);
    const r = await env.AI.run(TR_MODEL, { text: clean, source_lang: 'hr', target_lang: lang });
    const t = r && typeof r.translated_text === 'string' ? r.translated_text.trim() : '';
    if (!t) throw new Error('prazan prevod');
    return clip([lead, t, tail].filter(Boolean).join(' '), max);
  };
  try {
    const out = {};
    await Promise.all(TR_LANGS.map(async (l) => {
      const [t, x] = await Promise.all([one(title, l, 60), one(body, l, 180)]);
      out['title_' + l] = t; out['body_' + l] = x;
    }));
    return json(out);
  } catch (e) {
    console.error('prevod', e && e.message);
    throw new HttpError(502, 'Prevođenje nije uspjelo. Pokušaj ponovo ili upiši tekst ručno.');
  }
}

export async function adminPush(request, env, seg, method) {
  const nowMs = env.NOW ? new Date(env.NOW).getTime() : Date.now();
  if (seg.length === 3 && method === 'GET') {
    const c = await env.DB.prepare('SELECT COUNT(*) AS total, COALESCE(SUM(promo), 0) AS promo, COALESCE(SUM(remind), 0) AS remind FROM push_subs').first();
    const { results: langRows } = await env.DB.prepare('SELECT lang, COUNT(*) AS total, COALESCE(SUM(promo), 0) AS promo FROM push_subs GROUP BY lang').all();
    c.langs = Object.fromEntries(langRows.map((r) => [r.lang, { total: r.total, promo: r.promo }]));
    const { results } = await env.DB
      .prepare('SELECT c.id, c.title, c.body, c.url, c.audience, c.send_at, c.enqueued_at, c.recipients, (SELECT COUNT(*) FROM push_queue q WHERE q.campaign_id = c.id) AS pending FROM push_campaigns c ORDER BY c.id DESC LIMIT 20')
      .all();
    return json({ configured: pushConfigured(env), subs: c, campaigns: results });
  }
  if (seg[3] === 'translate' && seg.length === 4 && method === 'POST') return translateCampaign(env, await readJson(request, 4000));
  if (seg[3] === 'campaign' && seg.length === 4 && method === 'POST') {
    if (!pushConfigured(env)) throw new HttpError(503, 'Podesi VAPID_PUBLIC, VAPID_PRIVATE i VAPID_SUBJECT (vidi README)');
    const o = cleanCampaign(await readJson(request, 4000), nowMs);
    const r = await env.DB
      .prepare('INSERT INTO push_campaigns (title, body, title_en, body_en, title_de, body_de, title_ru, body_ru, title_it, body_it, url, audience, send_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id')
      .bind(o.title, o.body, o.title_en, o.body_en, o.title_de, o.body_de, o.title_ru, o.body_ru, o.title_it, o.body_it, o.url, o.audience, o.send_at)
      .first();
    return json({ id: r.id, send_at: o.send_at }, 201);
  }
  // brisanje cijele istorije poslatih (one koje se još šalju ostaju)
  if (seg[3] === 'campaign' && seg.length === 5 && seg[4] === 'sent' && method === 'DELETE') {
    const r = await env.DB.prepare('DELETE FROM push_campaigns WHERE enqueued_at IS NOT NULL AND id NOT IN (SELECT DISTINCT campaign_id FROM push_queue WHERE campaign_id IS NOT NULL)').run();
    return json({ deleted: r.meta.changes || 0 });
  }
  // otkazivanje zakazane, zaustavljanje promocije koja se još šalje, ili brisanje iz istorije poslate
  if (seg[3] === 'campaign' && seg.length === 5 && method === 'DELETE' && /^\d{1,9}$/.test(seg[4])) {
    const id = Number(seg[4]);
    const row = await env.DB.prepare('SELECT id FROM push_campaigns WHERE id = ?').bind(id).first();
    if (!row) throw new HttpError(404, 'Promocija nije pronađena');
    await env.DB.batch([
      env.DB.prepare('DELETE FROM push_queue WHERE campaign_id = ?').bind(id),
      env.DB.prepare('DELETE FROM push_campaigns WHERE id = ?').bind(id),
    ]);
    return new Response(null, { status: 204 });
  }
  throw new HttpError(404, 'Nepoznata ruta');
}

/* ---------------- cron ---------------- */
function nowLocal(env) {
  const d = env.NOW ? new Date(env.NOW) : new Date();
  const [day, time] = d.toLocaleString('sv-SE', { timeZone: TZ, hourCycle: 'h23' }).split(' ');
  return { day, hour: Number(time.slice(0, 2)), iso: d.toISOString() };
}

const TOMORROW = { sr: 'Sutra', en: 'Tomorrow', de: 'Morgen', ru: 'Завтра', it: 'Domani' };
const pick = (lang, sr, en) => (lang === 'sr' ? sr : en || sr);
const chunks = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

/** Zakazane promocije koje su dospjele idu u red za sve (ili samo za test uređaj). */
async function dueCampaigns(env, iso) {
  const { results } = await env.DB.prepare('SELECT * FROM push_campaigns WHERE enqueued_at IS NULL AND send_at <= ? ORDER BY id LIMIT 5').bind(iso).all();
  for (const c of results) {
    const test = c.audience === 'test' ? ' AND id = (SELECT MAX(id) FROM push_subs)' : '';
    const ins = (cond, title, body) =>
      env.DB
        .prepare(`INSERT INTO push_queue (sub_id, campaign_id, payload, ttl) SELECT id, ?, ?, 172800 FROM push_subs WHERE promo = 1 AND ${cond}${test}`)
        .bind(c.id, JSON.stringify({ title, body, url: c.url, tag: 'promo-' + c.id }));
    await env.DB.batch([
      ins("lang = 'sr'", c.title, c.body),
      ins("lang NOT IN ('sr', 'de', 'ru', 'it')", c.title_en || c.title, c.body_en || c.body),
      // njemački, ruski, italijanski: svoj tekst, a ako ga nema engleski, pa crnogorski
      ...['de', 'ru', 'it'].map((l) => ins(`lang = '${l}'`, c['title_' + l] || c.title_en || c.title, c['body_' + l] || c.body_en || c.body)),
      env.DB.prepare('UPDATE push_campaigns SET enqueued_at = ?, recipients = (SELECT COUNT(*) FROM push_queue WHERE campaign_id = ?) WHERE id = ?').bind(iso, c.id, c.id),
    ]);
  }
}

/** Dan prije početka događaja (od REMIND_HOUR po crnogorskom vremenu) podsjetnik ide svima kojima je događaj u „Moj put”. */
async function queueReminders(env, now) {
  const h = env.REMIND_HOUR === undefined || env.REMIND_HOUR === '' ? NaN : Number(env.REMIND_HOUR);
  if (now.hour < (h >= 0 && h <= 23 ? h : 10)) return;
  const tomorrow = addDaysISO(now.day, 1);
  const { results: events } = await env.DB
    .prepare("SELECT slug, title, title_en, place FROM items WHERE active = 1 AND kind = 'event' AND date_from = ?")
    .bind(tomorrow)
    .all();
  for (const ev of events) {
    const ref = `remind:${ev.slug}:${tomorrow}`;
    const { results: subs } = await env.DB
      .prepare(
        `SELECT s.id, s.lang FROM push_subs s
         WHERE s.remind = 1
           AND EXISTS (SELECT 1 FROM json_each(s.saved) j WHERE j.value = ?)
           AND NOT EXISTS (SELECT 1 FROM push_log l WHERE l.sub_id = s.id AND l.ref = ?)
         LIMIT 400`,
      )
      .bind(ev.slug, ref)
      .all();
    for (const part of chunks(subs, 40)) {
      const st = [];
      for (const s of part) {
        const payload = JSON.stringify({
          title: pick(s.lang, ev.title, ev.title_en),
          body: `${TOMORROW[s.lang] || TOMORROW.en} · ${ev.place}`,
          url: `/#d/${encodeURIComponent('i:' + ev.slug)}`,
          tag: 'ev-' + ev.slug,
        });
        st.push(env.DB.prepare('INSERT INTO push_queue (sub_id, payload, ttl) VALUES (?, ?, 43200)').bind(s.id, payload));
        st.push(env.DB.prepare('INSERT OR IGNORE INTO push_log (sub_id, ref) VALUES (?, ?)').bind(s.id, ref));
      }
      await env.DB.batch(st);
    }
  }
}

/** Šalje najviše PUSH_BATCH poruka iz reda (zbog ograničenja broja zahtjeva po pozivu; na plaćenom planu povećaj). */
export async function drain(env) {
  const n = Math.min(Math.max(Number(env.PUSH_BATCH) || 40, 1), 500);
  const { results } = await env.DB
    .prepare('SELECT q.id, q.payload, q.ttl, q.attempts, s.id AS sid, s.endpoint, s.p256dh, s.auth FROM push_queue q JOIN push_subs s ON s.id = q.sub_id ORDER BY q.id LIMIT ?')
    .bind(n)
    .all();
  if (!results.length) return { sent: 0 };
  const out = await Promise.all(
    results.map((r) => sendOne(env, r, r.payload, r.ttl).catch((e) => { console.error('push greška', e && e.message); return 'retry'; })),
  );
  const done = [], retry = [], gone = [];
  results.forEach((r, i) => {
    if (out[i] === 'gone') gone.push(r.sid);
    else if ((out[i] === 'retry' || out[i] === 'fail') && r.attempts < 2) retry.push(r.id);
    else done.push(r.id);
  });
  const st = [];
  if (done.length) st.push(env.DB.prepare(`DELETE FROM push_queue WHERE id IN (${done.map(() => '?').join(',')})`).bind(...done));
  if (retry.length) st.push(env.DB.prepare(`UPDATE push_queue SET attempts = attempts + 1 WHERE id IN (${retry.map(() => '?').join(',')})`).bind(...retry));
  if (st.length) await env.DB.batch(st);
  await dropSubs(env, [...new Set(gone)]);
  return { sent: out.filter((x) => x === 'ok').length, gone: gone.length };
}

export async function tick(env) {
  if (!pushConfigured(env)) return { configured: false };
  const now = nowLocal(env);
  await dueCampaigns(env, now.iso);
  await queueReminders(env, now);
  const r = await drain(env);
  await env.DB.prepare("DELETE FROM push_queue WHERE created_at < datetime('now', '-3 day')").run();
  await env.DB.prepare("DELETE FROM push_log WHERE created_at < datetime('now', '-60 day')").run();
  return { configured: true, sent: r.sent };
}

