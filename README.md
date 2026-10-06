# Moj FERI urnik

Lokalna demo aplikacija za osebno filtriranje javnega urnika FERI. Vsak predmet ima lastno izbiro vrst izvedbe in skupin; nastavitve ostanejo v brskalniku. Predmet se doda z njegovim preverjenim številčnim Wise ID-jem.

## Zagon na macOS

Potrebuješ Node.js 20 ali novejši.

```bash
npm install
npm run dev
```

Odpri `http://localhost:4173`. Razvojni zagon uporablja Vite hot reload za frontend; po spremembi backenda ponovno zaženi ukaz. Produkcijski lokalni zagon je `npm start`, produkcijski frontend pa lahko zgradiš z `npm run build`. Vrata lahko spremeniš z `PORT=8080 npm start`, trajanje predpomnilnika pa z `CACHE_MS=600000 npm start`. Testi: `npm test`.

## Dejanski podatkovni vir

Adapter bere javni HTML, ne uradnega Wise REST API-ja in ne uporablja iframe-a.

- Tedenski pogled in katalog: `GET https://www.wise-tt.com/web/feri/?date=YYYY-MM-DD&lang=sl&match=all&c=ID_ID_...`
- Podrobnosti dogodka: `GET https://www.wise-tt.com/web/feri/event/S1234?lang=sl`

Na tedenski strani adapter z DOM parserjem Cheerio prebere `.day`, `.day-date`, `article.card`, `.card-title`, `.card-sub`, `.card-time` in `.card-open[data-event]`. Katalog prebere iz obrazca za izbiro predmetov (`input[name="pick[]"]` ter pripadajoča oznaka z imenom in šifro). Datum objave prebere iz `.foot-published time`.

Stran podrobnosti vsebuje `.evfacts` (prostor, predavatelji, vrsta izvedbe in šifra) ter `.evgroup-list` s polnimi izvornimi imeni skupin. Javni HTML ne razkriva stabilnega ID-ja skupine, zato aplikacija uporablja dokumentiran sestavljen ključ `ID-predmeta:normalizirana-vrsta:polno-ime-skupine`. `RV-NA DALJAVO` se normalizira v vrsto `RV`, izvirna oznaka pa ostane na dogodku.

Uradni Wise REST API v2 zahteva API račun. Aplikacija ga ne uporablja; javni JSON endpoint za ta pogled ni bil potrjen. Backend dovoljuje samo fiksno domeno in poti FERI, datum oblike ISO ter največ 30 številčnih ID-jev, zato ni splošen proxy.

## Arhitektura in omejitve

- `server/wise-adapter.js`: pridobivanje in DOM-parsanje javnega Wise HTML-ja
- `server/normalize.js`: normalizacija vrst ter ključi skupin
- `server/cache.js`: 8-minutni predpomnilnik tednov, 24-urni katalog/podrobnosti in združevanje sočasnih zahtev
- `public/filter.js`: čista filtrirna funkcija
- `public/storage.js`: verzionirane nastavitve `localStorage` (`moj-feri-urnik:v1`, podatkovna shema v2 z migracijo)
- `public/cache-db.js`: IndexedDB predpomnilnik nefiltriranih tednov
- `public/api.js`: enotna meja med UI in backend API-jem
- `public/app.js`: modali, upravljanje predmetov in časovni prikaz s samodejnim razporejanjem prekrivanj
- `server/scheduler.js`: sinhronizacija ob 08:00 in 16:00 v `Europe/Ljubljana`

Možnosti vrst in skupin se zbirajo iz omejenega okna treh tednov (izbrani datum ter ±28 dni), ne samo iz trenutno odprtega tedna. Podrobnosti dogodkov imajo daljši predpomnilnik in največ štiri zahteve tečejo sočasno, vendar prvi obisk lahko vseeno traja nekaj sekund. Če Wise spremeni HTML, bo treba prilagoditi selektorje. Brez omrežja se uporabi zadnji strežniški predpomnilnik, če obstaja; aplikacija nikoli ne predstavi izmišljenih podatkov kot živih. Ni baze, prijave ali deploya.

Frontend dodatno hrani nefiltrirane tedne v IndexedDB: privzeto 2 tedna nazaj in 3 naprej. Nastavitev je mogoče spremeniti, podatkovni predpomnilnik pa počistiti brez brisanja osebnih filtrov. Backend med delovanjem preverja termina 08:00 in 16:00 po ljubljanskem času; po zagonu izvede zamujeni dnevni termin. Brskalnik ob odprtju najprej pokaže lokalni predpomnilnik, nato preveri svežino. Več zavihkov ne povzroči več backend schedulerjev, ker scheduler teče samo enkrat v procesu strežnika.

Na telefonu je sidebar skrit v modalnem meniju. Urnik privzeto uporablja berljiv vodoravno drsljiv tedenski pogled s fiksno časovno osjo in samodejnim pomikom na današnji dan; gumb »Cel teden« preklopi na vseh pet dni hkrati. Mobilne kartice uporabljajo stabilne kratice iz `server/config.js`, polni podatki pa so vedno dostopni z dotikom dogodka.
