# Moj FERI urnik

Lokalna aplikacija za osebno filtriranje javnega urnika FERI. Nova namestitev nima vnaprej izbranih predmetov; uporabnik jih doda s šifro predmeta iz aktualnega Wise kataloga. Vsak predmet ima lastno izbiro vrst izvedbe in skupin, ki ostane shranjena v brskalniku.

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
- `public/storage.js`: verzionirane nastavitve `localStorage` z avtomatsko lokalno varnostno kopijo in obnovo poškodovanega glavnega zapisa
- `public/cache-db.js`: IndexedDB predpomnilnik nefiltriranih tednov
- `public/api.js`: enotna meja med UI in backend API-jem
- `public/app.js`: modali, upravljanje predmetov in časovni prikaz s samodejnim razporejanjem prekrivanj
- `server/scheduler.js`: sinhronizacija ob 08:00 in 16:00 v `Europe/Ljubljana`

Možnosti vrst in skupin se zbirajo iz omejenega okna trenutnega tedna in enega tedna naprej, ne samo iz trenutno odprtega tedna. Podrobnosti dogodkov imajo daljši predpomnilnik in največ štiri zahteve tečejo sočasno, vendar prvi obisk lahko vseeno traja nekaj sekund. Če Wise spremeni HTML, bo treba prilagoditi selektorje. Brez omrežja se uporabi zadnji strežniški predpomnilnik, če obstaja; aplikacija nikoli ne predstavi izmišljenih podatkov kot živih. Ni baze, prijave ali deploya.

Frontend dodatno hrani nefiltrirane tedne v IndexedDB za trenutni teden in en teden naprej. Podatkovni predpomnilnik lahko počistimo brez brisanja osebnih filtrov. Backend med delovanjem preverja termina 08:00 in 16:00 po ljubljanskem času; po zagonu izvede zamujeni dnevni termin. Brskalnik ob odprtju najprej pokaže lokalni predpomnilnik, nato preveri svežino. Več zavihkov ne povzroči več backend schedulerjev, ker scheduler teče samo enkrat v procesu strežnika.

Na telefonu je sidebar skrit v modalnem meniju. Urnik uporablja enoten vodoravno drsljiv tedenski pogled s fiksno časovno osjo in samodejnim pomikom na današnji dan. Mobilne kartice uporabljajo stabilne kratice iz `server/config.js`, polni podatki pa so vedno dostopni z dotikom dogodka. Backend ob prvem obisku nastavi anonimen naključni cookie `feri_schedule_user` (`HttpOnly`, `SameSite=Lax`, `Secure` v produkciji); cookie ne vsebuje urnika ali dovoljenj. Osebne nastavitve ostanejo v lokalnem storage adapterju, zato lahko kasnejša strežniška baza zamenja adapter brez spremembe UI.
