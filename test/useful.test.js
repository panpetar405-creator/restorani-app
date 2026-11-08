import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const USEFUL = new Function(readFileSync(new URL('../public/korisno.js', import.meta.url), 'utf8') + '; return USEFUL;')();
const LANGS = ['sr', 'en', 'de', 'ru', 'it'];

test('korisno: svih pet jezika ima iste grupe, iste brojeve i isti broj napomena', () => {
  assert.deepEqual(Object.keys(USEFUL).sort(), [...LANGS].sort());
  const shape = (l) => USEFUL[l].groups.map((g) => [g.id, g.icon, (g.calls || []).map((c) => c[0]).join(','), (g.notes || []).length].join('|'));
  for (const l of LANGS) assert.deepEqual(shape(l), shape('sr'), l);
});

test('korisno: hitni brojevi su tačni i nijedan tekst nije prazan', () => {
  const nums = USEFUL.sr.groups.find((g) => g.id === 'emergency').calls.map((c) => c[0]);
  assert.deepEqual(nums, ['112', '122', '123', '124', '129', '19807']);
  for (const l of LANGS) {
    assert.ok(USEFUL[l].updated.length > 10, l);
    for (const g of USEFUL[l].groups) {
      assert.ok(g.title, l + g.id);
      for (const c of g.calls || []) assert.ok(/^\d+$/.test(c[0]) && c[1], l + g.id);
      for (const n of g.notes || []) assert.ok(n.length > 10, l + g.id);
    }
  }
});

test('korisno: i18n ima naslov taba za svaki jezik', () => {
  const src = readFileSync(new URL('../public/i18n.js', import.meta.url), 'utf8');
  assert.equal((src.match(/useful: '/g) || []).length, 5);
  assert.equal((src.match(/usefulSub: '/g) || []).length, 5);
});
