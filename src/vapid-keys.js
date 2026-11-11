// Pravi VAPID par ključeva za Web Push. Pokretanje: npm run vapid
// Javni ključ ide u aplikaciju, privatni je tajna i nikad se ne objavljuje (ne ide u git).
import { generateKeyPairSync } from 'node:crypto';

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const jwk = privateKey.export({ format: 'jwk' });
const b64u = (b) => Buffer.from(b).toString('base64url');
const pub = b64u(Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]));

console.log('VAPID_PUBLIC  =', pub);
console.log('VAPID_PRIVATE =', jwk.d);
console.log('\nUpiši ih u Cloudflare (svaka komanda traži vrijednost):');
console.log('  npx wrangler secret put VAPID_PUBLIC');
console.log('  npx wrangler secret put VAPID_PRIVATE');
console.log('  npx wrangler secret put VAPID_SUBJECT      # npr. mailto:kontakt@tvoj-domen.me');
console.log('\nZa lokalni rad napravi fajl .dev.vars (nije u git-u) sa ta tri reda: IME=vrijednost');
