// Evidencija partnera u adminu: restorani/biznisi, turističke organizacije (TO) i institucije.
// Partner se može vezati za promociju, pa admin dobija zbirni izvještaj po partneru (sve njegove promocije).
import { HttpError, json, readJson } from './lib.js';

export const PARTNER_TYPES = ['restoran', 'to', 'institucija', 'ostalo'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const str = (v, max, name, req = false) => {
  const s = typeof v === 'string' ? v.trim() : '';
  if (req && !s) throw new HttpError(400, `Polje "${name}" je obavezno`);
  if (s.length > max) throw new HttpError(400, `Polje "${name}" je predugo (najviše ${max} znakova)`);
  return s;
};
const day = (v, name) => {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string' || !DATE.test(v) || Number.isNaN(Date.parse(v))) throw new HttpError(400, `Polje "${name}" nije ispravan datum`);
  return v;
};

export function cleanPartner(b) {
  if (b.type !== undefined && !PARTNER_TYPES.includes(b.type)) throw new HttpError(400, 'Nepoznata vrsta partnera');
  const o = {
    name: str(b.name, 80, 'Naziv', true),
    type: b.type || 'restoran',
    contact: str(b.contact, 200, 'Kontakt'),
    package: str(b.package, 120, 'Paket'),
    starts_on: day(b.starts_on, 'Početak'),
    ends_on: day(b.ends_on, 'Kraj'),
    note: str(b.note, 500, 'Napomena'),
  };
  if (o.starts_on && o.ends_on && o.ends_on < o.starts_on) throw new HttpError(400, 'Kraj ne može biti prije početka');
  return o;
}

export async function adminPartners(request, env, seg, method) {
  // seg: ['api', 'admin', 'partners', id?, 'report'?]
  if (seg.length === 3 && method === 'GET') {
    const { results } = await env.DB
      .prepare("SELECT p.*, (SELECT COUNT(*) FROM push_campaigns c WHERE c.partner_id = p.id AND c.enqueued_at IS NOT NULL AND c.audience != 'test') AS promos FROM partners p ORDER BY p.name COLLATE NOCASE")
      .all();
    return json({ partners: results });
  }
  if (seg.length === 3 && method === 'POST') {
    const o = cleanPartner(await readJson(request, 4000));
    const r = await env.DB
      .prepare('INSERT INTO partners (name, type, contact, package, starts_on, ends_on, note) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id')
      .bind(o.name, o.type, o.contact, o.package, o.starts_on, o.ends_on, o.note)
      .first();
    return json({ id: r.id }, 201);
  }
  if (seg.length >= 4 && /^\d{1,9}$/.test(seg[3])) {
    const id = Number(seg[3]);
    const p = await env.DB.prepare('SELECT * FROM partners WHERE id = ?').bind(id).first();
    if (!p) throw new HttpError(404, 'Partner nije pronađen');
    if (seg.length === 4 && method === 'GET') return json({ partner: p });
    if (seg.length === 4 && method === 'PUT') {
      const o = cleanPartner({ ...p, ...(await readJson(request, 4000)) });
      await env.DB
        .prepare('UPDATE partners SET name = ?, type = ?, contact = ?, package = ?, starts_on = ?, ends_on = ?, note = ? WHERE id = ?')
        .bind(o.name, o.type, o.contact, o.package, o.starts_on, o.ends_on, o.note, id)
        .run();
      return new Response(null, { status: 204 });
    }
    if (seg.length === 4 && method === 'DELETE') {
      // promocije ostaju u istoriji, samo se odvajaju od partnera
      await env.DB.batch([
        env.DB.prepare('UPDATE push_campaigns SET partner_id = NULL WHERE partner_id = ?').bind(id),
        env.DB.prepare('DELETE FROM partners WHERE id = ?').bind(id),
      ]);
      return new Response(null, { status: 204 });
    }
    if (seg.length === 5 && seg[4] === 'report' && method === 'GET') {
      const { results } = await env.DB
        .prepare(
          `SELECT c.id, c.title, c.places, c.enqueued_at, c.recipients,
            (SELECT COUNT(*) FROM push_stats t WHERE t.campaign_id = c.id) AS tracked,
            (SELECT COUNT(t.shown_at) FROM push_stats t WHERE t.campaign_id = c.id) AS shown,
            (SELECT COUNT(t.clicked_at) FROM push_stats t WHERE t.campaign_id = c.id) AS clicked
           FROM push_campaigns c WHERE c.partner_id = ? AND c.audience != 'test' AND c.enqueued_at IS NOT NULL
           ORDER BY c.enqueued_at DESC LIMIT 100`,
        )
        .bind(id)
        .all();
      // procenti se računaju samo nad promocijama koje su imale praćenje (starije nemaju statistiku)
      const t = { promos: results.length, sent: 0, tracked_sent: 0, shown: 0, clicked: 0 };
      for (const c of results) {
        t.sent += c.recipients;
        if (c.tracked > 0) { t.tracked_sent += c.recipients; t.shown += c.shown; t.clicked += c.clicked; }
      }
      return json({ partner: p, totals: t, campaigns: results });
    }
  }
  throw new HttpError(404, 'Nepoznata ruta');
}
