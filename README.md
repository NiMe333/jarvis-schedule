# Moj FERI urnik

Lokalna aplikacija za osebno filtriranje javnega urnika FERI. Nova namestitev nima vnaprej izbranih predmetov; uporabnik jih doda s šifro predmeta iz aktualnega Wise kataloga. Vsak predmet ima lastno izbiro vrst izvedbe in skupin, ki ostane shranjena v brskalniku.

## Zagon na macOS

Potrebuješ Node.js 22.13 ali novejši (zaradi vgrajenega SQLite modula).

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

Stran podrobnosti vsebuje `.evfacts` (prostor, predavatelji, vrsta izvedbe in šifra) ter `.evgroup-list` s polnimi izvornimi imeni skupin. Javni HTML ne razkriva stabilnega ID-ja skupine, zato aplikacija uporablja dokumentiran sestavljen ključ `ID-predmeta:normalizirana-vrsta:polno-ime-skupine`. `RV-NA DALJAVO` se normalizira v vrsto `RV` in `remote: true`. Enako se oddaljena izvedba prepozna, kadar je prostor označen kot `E-PREDAVALNICA`; izvorna vrsta in prostor ostaneta v podatkih dogodka.

Uradni Wise REST API v2 zahteva API račun. Aplikacija ga ne uporablja; javni JSON endpoint za ta pogled ni bil potrjen. Backend dovoljuje samo fiksno domeno in poti FERI, datum oblike ISO ter največ 30 številčnih ID-jev, zato ni splošen proxy.

## Arhitektura in omejitve

- `server/wise-adapter.js`: pridobivanje in DOM-parsanje javnega Wise HTML-ja
- `server/normalize.js`: normalizacija vrst ter ključi skupin
- `server/cache.js`: 8-minutni predpomnilnik tednov, 24-urni katalog/podrobnosti in združevanje sočasnih zahtev
- `server/settings-store.js`: SQLite shramba osebnih nastavitev, vezana na anonimen UUID cookie
- `public/filter.js`: čista filtrirna funkcija
- `public/date-utils.js` in `public/calendar-layout.js`: datumska geometrija in razporejanje prekrivajočih dogodkov
- `public/storage.js`: verzionirane nastavitve `localStorage` z avtomatsko lokalno varnostno kopijo in obnovo poškodovanega glavnega zapisa
- `public/cache-db.js`: IndexedDB predpomnilnik nefiltriranih tednov
- `public/api.js`: enotna meja med UI in backend API-jem
- `public/app.js`: modali, upravljanje predmetov in časovni prikaz s samodejnim razporejanjem prekrivanj
- `server/scheduler.js`: sinhronizacija ob 08:00 in 16:00 v `Europe/Ljubljana`

Možnosti vrst in skupin se zbirajo iz omejenega okna trenutnega tedna in enega tedna naprej, ne samo iz trenutno odprtega tedna. Podrobnosti dogodkov imajo daljši predpomnilnik in največ štiri zahteve tečejo sočasno, vendar prvi obisk lahko vseeno traja nekaj sekund. Če Wise spremeni HTML, bo treba prilagoditi selektorje. Brez omrežja se uporabi zadnji strežniški predpomnilnik, če obstaja; aplikacija nikoli ne predstavi izmišljenih podatkov kot živih.

Frontend dodatno hrani nefiltrirane tedne v IndexedDB za trenutni teden in en teden naprej. Podatkovni predpomnilnik lahko počistimo brez brisanja osebnih filtrov. Backend med delovanjem preverja termina 08:00 in 16:00 po ljubljanskem času; po zagonu izvede zamujeni dnevni termin. Brskalnik ob odprtju najprej pokaže lokalni predpomnilnik, nato preveri svežino. Več zavihkov ne povzroči več backend schedulerjev, ker scheduler teče samo enkrat v procesu strežnika.

Na telefonu je sidebar skrit v modalnem meniju. Urnik uporablja enoten vodoravno drsljiv tedenski pogled s fiksno časovno osjo in začetkom na ponedeljku. Mobilne kartice uporabljajo stabilne kratice iz `server/config.js`, polni podatki pa so vedno dostopni z dotikom dogodka. Backend ob prvem obisku nastavi anonimen naključni cookie `feri_schedule_user` (`HttpOnly`, `SameSite=Lax`, `Secure` v produkciji); cookie vsebuje samo naključni identifikator. Nastavitve se hranijo v `data/user-settings.sqlite`, lokalni `localStorage` in njegova varnostna kopija pa omogočata takojšnje ter offline delovanje. Ob zagonu zmaga novejši zapis glede na `updatedAt`. Brisanje cookieja ustvari novo anonimno identiteto, obstoječo izbiro pa je mogoče povezati z obnovitvenim ključem.

## Obnovitev in upravljanje podatkov

V splošnih nastavitvah lahko uporabnik ustvari obnovitveni ključ, izvozi nastavitve v JSON ali uvozi prejšnji izvoz. Strežnik v SQLite shrani samo SHA-256 hash obnovitvenega ključa; ključ v čisti obliki se pokaže samo ob nastanku. Nov ključ razveljavi prejšnjega. Obnovitev v drugem brskalniku zamenja anonimni UUID cookie in naloži pripadajoče nastavitve. »Ponastavi vse moje nastavitve« izbriše lokalni zapis, lokalno varnostno kopijo in SQLite zapis trenutnega anonimnega uporabnika.

API uporablja omejevanje števila zahtev, največ 30 predmetov, omejitev telesa zahteve 32 kB, strogo preverjanje strukture nastavitev ter varnostne glave CSP, `nosniff`, `DENY`, `no-referrer` in Permissions Policy. V produkciji sta cookie in HSTS vezana na HTTPS.

## Produkcijski zagon in HTTPS

Za obstoječi Jarvis LXC z Nginx in systemd uporabi [deploy/lxc/DEPLOYMENT.md](deploy/lxc/DEPLOYMENT.md). Ta postavitev shrani SQLite v `/var/lib/jarvis-schedule`, namesti storitev `jarvis-schedule` in dnevni backup timer. Docker spodaj je alternativa za samostojen strežnik.

Kopiraj `.env.example` v `.env`, nastavi `DOMAIN` na domeno, katere DNS kaže na strežnik, nato zaženi:

```bash
docker compose up -d --build
```

Caddy samodejno pridobi in obnavlja TLS certifikat. SQLite je na trajnem Docker volumnu `schedule-data`, zato ga redeploy aplikacije ne izbriše. Vrati 80 in 443 morata biti javno dosegljivi. Pred javno objavo nastavi redno zunanjo kopiranje backupov in spremljanje prostega prostora.

Za lokalno varnostno kopijo SQLite uporabi:

```bash
npm run backup
```

Ukaz naredi konsistentno kopijo z `VACUUM INTO` v imenik `backups/`. V produkcijskem Docker okolju je treba isti postopek izvajati znotraj app kontejnerja ali varnostno kopirati volume z orodjem ponudnika. Backup in `data/` sta izključena iz Gita.
