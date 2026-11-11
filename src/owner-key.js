// Upotreba: npm run owner-key -- konoba-akustik
// Generira ključ za vlasnika i ispisuje naredbu koja u bazu upisuje samo njegov hash.
import { randomBytes, createHash } from 'node:crypto';

const slug = process.argv[2];
if (!slug || !/^[a-z0-9-]{1,60}$/.test(slug)) {
  console.error('Upotreba: npm run owner-key -- <slug restorana>');
  process.exit(1);
}
const key = randomBytes(24).toString('base64url');
const hash = createHash('sha256').update(key).digest('hex');
const sql = `UPDATE restaurants SET owner_key_hash='${hash}' WHERE slug='${slug}'`;

console.log(`\nKljuč za vlasnika (pošalji ga samo njemu, ne čuva se nigdje u čitljivom obliku):\n\n  ${key}\n`);
console.log('Upiši hash u bazu:\n');
console.log(`  npx wrangler d1 execute DB --remote --command "${sql}"`);
console.log(`  npx wrangler d1 execute DB --local  --command "${sql}"   # za lokalni razvoj\n`);
