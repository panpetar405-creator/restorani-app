# Montepalm: šta ima u Crnoj Gori

PWA u kojoj korisnik izabere mjesto i period, pa vidi događaje, plaže, kulturu i gastronomiju. Frontend je statički, API je Cloudflare Worker, podaci su u Cloudflare D1. Nastao je preradom STO? aplikacije (restorani), pa su infrastruktura, rate limiting, testovi i automatski deploy ostali isti.

```
public/            PWA: index.html, app.js, styles.css, sw.js, manifest, ikone, _headers (CSP)
src/index.js       Worker: /api/items, /api/restaurants, vlasnički API (restorani)
src/lib.js         validacija, JSON odgovori, oblikovanje stavki i restorana
migrations/        0001-0006 restorani (STO?), 0007 tabela items, 0008 DEMO događaji
test/              api.test.js (restorani), items.test.js (događaji i period)
```

## Kako radi pretraga po periodu
- **Događaji** se prikažu ako se njihovi datumi preklapaju sa izabranim periodom.
- **Plaže i kultura** imaju mjesece sezone. Ako period ne pada u sezonu, stavka se ne skriva nego se označi „Van sezone u tom periodu”.
- **Gastronomija** su restorani iz tabele `restaurants` (sa računom po osobi), filtrirani po mjestu.
- Svaka stavka ima `status` (potvrdjeno, okvirno, provjeriti), izvor i datum provjere.

## Lokalno
```bash
npm install
npm run db:local        # sve migracije u lokalni D1
npm run dev             # http://localhost:8787
npm test                # 17 testova, Node 22+
```

## Objavljivanje
Isto kao prije: `npx wrangler deploy`, ili push u `main` (GitHub Actions radi testove, migracije i deploy). Baza je ista kao u STO? projektu (`database_id` u `wrangler.jsonc`), pa migracije 0007 i 0008 samo dodaju novu tabelu. Worker se sada zove `montepalm`, što znači nova `*.workers.dev` adresa. Stari Worker `sto` možeš obrisati kad prebaciš domenu.

## Prije javnog lansiranja
- **DEMO događaji.** `0008_demo_items.sql` ima izmišljene primjere sa okvirnim datumima (obilježeni su kao „Primjer”). Obriši ih: `DELETE FROM items WHERE demo = 1;` i unesi prave.
- **Demo restorani.** `0002_demo_seed.sql` i dalje sadrži izmišljene restorane (README stare aplikacije).
- **Unos pravih događaja** za sada ide SQL-om (`INSERT INTO items ...`). Sljedeći korak je admin stranica ili obrazac za organizatore.
- **Fotografije.** Hero fotografiju korisnik bira na uređaju. Za slike kartica dodaj polje `image` i R2 bucket.
- **Mapa** nije uključena u ovoj verziji. Za nju dopuni `img-src` u `public/_headers`.
