// Stranica za dijeljenje: /s/i/<slug> ili /s/r/<slug>
// Bot (WhatsApp, Viber, Instagram, Facebook...) pročita naslov, opis i sliku, a korisnik se odmah prebaci u aplikaciju.
import { shapeMedia } from './lib.js';

const SLUG = /^[a-z0-9-]{1,60}$/;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (s) => { const a = String(s || '').slice(0, 10).split('-'); return a.length === 3 ? `${+a[2]}. ${+a[1]}. ${a[0]}.` : ''; };
const clip = (s, n) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; };

export async function sharePage(env, url) {
  const m = /^\/s\/([ir])\/([^/]+)\/?$/.exec(url.pathname);
  if (!m || !SLUG.test(m[2])) return null;
  const [, t, slug] = m, ref = `${t}:${slug}`, origin = url.origin;
  const en = url.searchParams.get('lang') === 'en';
  let title, desc;
  if (t === 'i') {
    const r = await env.DB.prepare('SELECT * FROM items WHERE active = 1 AND slug = ?').bind(slug).first();
    if (!r) return null;
    title = (en && r.title_en) || r.title;
    const when = r.date_from ? (r.date_to && r.date_to !== r.date_from ? `${fmt(r.date_from)} – ${fmt(r.date_to)}` : fmt(r.date_from)) : '';
    desc = [[r.place, when].filter(Boolean).join(' · '), (en && (r.description_en || r.details_en)) || r.description || r.details].filter(Boolean).join('. ');
  } else {
    const r = await env.DB.prepare('SELECT * FROM restaurants WHERE active = 1 AND slug = ?').bind(slug).first();
    if (!r) return null;
    title = r.name;
    desc = [r.city, (en && r.ambience_en) || r.ambience].filter(Boolean).join('. ');
  }
  const { results } = await env.DB.prepare('SELECT * FROM media WHERE ref = ? ORDER BY sort, id').bind(ref).all();
  let img = '';
  for (const row of results) {
    const s = shapeMedia(row);
    const u = s && (s.type === 'image' ? s.url : s.poster);
    if (u) { img = new URL(u, origin).href; break; }
  }
  const custom = !!img;
  if (!img) img = `${origin}/og.png`;
  const pageTitle = `${title} · Montepalm`;
  const d = clip(desc || (en ? 'Events, beaches, culture and food in Montenegro.' : 'Događaji, plaže, kultura i gastronomija u Crnoj Gori.'), 200);
  const target = `/${en ? '?lang=en' : ''}#d/${ref}`;
  const html = `<!DOCTYPE html>
<html lang="${en ? 'en' : 'sr-Latn-ME'}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(pageTitle)}</title>
<meta name="description" content="${esc(d)}">
<meta name="robots" content="noindex,follow">
<meta property="og:site_name" content="Montepalm">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(pageTitle)}">
<meta property="og:description" content="${esc(d)}">
<meta property="og:url" content="${esc(origin + url.pathname)}">
<meta property="og:image" content="${esc(img)}">
${custom ? '' : '<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n'}<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(pageTitle)}">
<meta name="twitter:description" content="${esc(d)}">
<meta name="twitter:image" content="${esc(img)}">
<meta http-equiv="refresh" content="0;url=${esc(target)}">
</head><body><p><a href="${esc(target)}">${esc(title)}: ${en ? 'open in the Montepalm app' : 'otvori u aplikaciji Montepalm'}</a></p></body></html>`;
  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
    },
  });
}
