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
- **Mapa** (`public/map.js`, ekran `#mapa`, dugme „Mapa” u Istraži) koristi besplatne OpenStreetMap pločice (`tile.openstreetmap.org`). To je u redu za testiranje i manji saobraćaj, ali OSM-ova pravila ne dozvoljavaju veliko opterećenje. Prije većeg lansiranja pređi na pružaoca pločica (MapTiler, Stadia, Thunderforest) tako što promijeniš URL u `loadTiles()`. `img-src https:` u `_headers` već dozvoljava pločice. Stavke bez koordinata (`lat`/`lng`) prikažu se okvirno na mjestu i označe isprekidanim rubom; za tačnu poziciju unesi koordinate u adminu.

## Obavještenja (push)
Korisnik koji je instalirao aplikaciju uključi obavještenja u kartici **Moj put**. Šalju se dvije vrste:
- **Promocije i akcije.** Admin ih piše na `/admin` (dugme „Obavještenja korisnicima”): odmah ili zakazano, sa tekstom na crnogorskom i (opciono) engleskom, i linkom koji se otvara dodirom. „Samo test” šalje samo na posljednji uređaj koji je uključio obavještenja.
- **Podsjetnik prije događaja.** Automatski, dan prije početka događaja, u 10:00 po crnogorskom vremenu (`REMIND_HOUR`), svima kojima je događaj u „Moj put”. Događaji imaju samo datum bez sata, pa je to „dan prije”, a ne tačno 24 sata. Za tačan sat treba dodati vrijeme početka u tabelu `items`.

### Podešavanje (jednom)
```bash
npm run vapid                      # ispiše javni i privatni ključ
npx wrangler secret put VAPID_PUBLIC
npx wrangler secret put VAPID_PRIVATE
npx wrangler secret put VAPID_SUBJECT   # mailto:kontakt@tvoj-domen.me
npx wrangler secret put PUSH_TICK_KEY   # nasumičan niz od najmanje 16 znakova
npm run db:remote                  # migracija 0012
npx wrangler deploy
```
Privatni ključ nikad ne ide u git. Ako ga promijeniš, svi korisnici moraju ponovo uključiti obavještenja.

### Okidač (svake minute)
Besplatni Cloudflare nalog dozvoljava samo 5 cron okidača. Zato slanje pokreće vanjski cron: na cron-job.org napravi posao koji svake minute otvara `https://TVOJ-SAJT/api/push/tick` sa zaglavljem `Authorization: Bearer <PUSH_TICK_KEY>`. (Ako imaš slobodan Cloudflare cron, možeš umjesto toga dodati `triggers.crons` u `wrangler.jsonc`.)

### Kako radi slanje
Svake minute (1) stavlja dospjele promocije i podsjetnike u red (`push_queue`) i (2) šalje najviše `PUSH_BATCH` poruka iz reda (podrazumijevano 40, zbog ograničenja broja zahtjeva u jednom pozivu na besplatnom Cloudflare planu). Za 1.000 uređaja to je oko 25 minuta; na plaćenom planu postavi `PUSH_BATCH` na 500 i isto traje oko 2 minuta. Pretplate koje je push servis odbacio (404/410) brišu se same.

### Napomene
- **iPhone:** obavještenja rade tek kad se aplikacija doda na početni ekran (iOS 16.4+) i otvori odatle. Aplikacija to objašnjava korisniku.
- **Obavezno uz promocije:** korisnik mora moći da ih isključi (kartica „Moj put”). Ne šalji u sate kad ljudi spavaju, a za promocije u EU provjeri pravila o direktnom marketingu.
- Demo događaji (`demo = 1`) takođe šalju podsjetnike ako ih neko sačuva, pa ih obriši prije lansiranja.
