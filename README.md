# STO? — Račun prije stola

Aplikacija (PWA) za izbor restorana prema stvarnom računu po osobi. Frontend je statički, API je Cloudflare Worker, podaci su u Cloudflare D1. Deploy ide automatski iz GitHuba.

```
public/            PWA: index.html, app.js, styles.css, sw.js, manifest, ikone, _headers (CSP)
src/index.js       Worker: API rute, rate limiting, pristup vlasnika
src/lib.js         validacija, JSON odgovori, procjena računa
migrations/        0001 shema, 0002 DEMO podaci (izmišljeni restorani iz prototipa)
scripts/owner-key.js   generira ključ za vlasnika restorana
test/              testovi API-ja (node --test, bez ovisnosti)
.github/workflows/deploy.yml   test, migracije, deploy na push u main
```

## Kako radi račun
Račun po osobi = glavno jelo + piće + pola priloga. Raspon (od–do) računa Worker iz menija, pa se mijenja čim vlasnik promijeni cijene. Dok vlasnik ne potvrdi cijene, aplikacija piše „Cijene još nisu potvrđene”.

## Lokalno
```bash
npm install
npm run db:local                 # shema + demo podaci u lokalni D1
npm run dev                      # http://localhost:8787
npm test                         # testovi API-ja (Node 22+)
```

## Prvo objavljivanje

**1. GitHub**
```bash
git init -b main && git add . && git commit -m "STO? v1"
gh repo create sto --private --source=. --push
```

**2. Cloudflare (jednom, ručno)**
```bash
npx wrangler login
npx wrangler d1 create sto-db     # kopiraj database_id u wrangler.jsonc
npm run db:remote                 # migracije na produkcijsku bazu
npx wrangler deploy               # prvi deploy; ispiše adresu *.workers.dev
```

**3. Automatski deploy**
Na Cloudflareu napravi API token (šablon „Edit Cloudflare Workers” + dozvola *D1: Edit*), pa u GitHub repozitorij dodaj:
```bash
gh secret set CLOUDFLARE_API_TOKEN
gh secret set CLOUDFLARE_ACCOUNT_ID
```
Od tada svaki push u `main` pokreće testove, primjenjuje nove migracije i radi deploy.

**4. Domena** (opcionalno): Cloudflare → Workers → `sto` → Settings → Domains & Routes.

## Ključ za vlasnika restorana
```bash
npm run owner-key -- konoba-akustik
```
Ispiše ključ (pošalji ga vlasniku) i naredbu koja u bazu upisuje samo njegov hash. Vlasnik se u aplikaciji prijavi preko *Još → Za restorane*, ažurira cijene i potvrdi ih; time se postavlja datum provjere.

## Prije javnog lansiranja
- **Demo podaci.** `migrations/0002_demo_seed.sql` sadrži izmišljene restorane, cijene i ocjene. Obriši tu migraciju (i redove iz baze) prije nego unesete prave podatke. Tekst na ekranu *Još* također kaže da su primjeri izmišljeni.
- **Mapa** koristi pločice openstreetmap.org. Njihova pravila ograničavaju veću upotrebu; za veći promet pređi na vlastiti ili plaćeni provajder pločica i dopuni `img-src` u `public/_headers`.
- **Fotografije restorana** su za sada ilustracije iz koda. Za prave fotografije dodaj R2 bucket.
- **Ocjene i recenzije** su polja u bazi bez vlastitog toka za unos; povući ih iz Googlea ili uvesti vlastiti sistem.
- **Sačuvani restorani** žive u pregledniku (localStorage); nema korisničkih naloga.
- **Rate limiting** koristi Cloudflare *Rate Limiting* binding (`RL`, `RL_AUTH` u `wrangler.jsonc`). Ako ga na računu nema, ukloni `ratelimits` blok ili ga zamijeni pravilima u Cloudflare WAF-u.
- Lista restorana se trenutno učitava cijela (do 100) i filtrira u aplikaciji; API već podržava `city`, `cat`, `max`, `mood`, `q`, `limit` za kasnije prebacivanje filtriranja na server.
