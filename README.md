# Moj FERI urnik

Lokalna aplikacija za osebno filtriranje javnega urnika FERI. Nova namestitev nima vnaprej izbranih predmetov; uporabnik jih doda s šifro predmeta iz aktualnega Wise kataloga. Vsak predmet ima lastno izbiro vrst izvedbe in skupin, ki ostane shranjena v brskalniku.

## Zagon na macOS

Potrebuješ Node.js 22.13 ali novejši (zaradi vgrajenega SQLite modula).

```bash
npm install
npm run dev
```

Odpri `http://localhost:4173`. Razvojni zagon uporablja Vite hot reload za frontend; po spremembi backenda ponovno zaženi ukaz. Produkcijski lokalni zagon je `npm start`, produkcijski frontend pa lahko zgradiš z `npm run build`. Vrata lahko spremeniš z `PORT=8080 npm start`, trajanje predpomnilnika pa z `CACHE_MS=600000 npm start`. Testi: `npm test`.

## Linux in Fedora

Aplikacija je podprta na Linuxu. Fedora, Debian/Ubuntu in drugi sistemi so podprti, če imajo Node.js 22.13 ali novejši. Strežnik potrebuje tudi izhodni HTTPS dostop do `www.wise-tt.com`; uporabniki do aplikacije dostopajo prek brskalnika.

### Hiter zagon na Fedori

Za razvoj ali testiranje:

```bash
sudo dnf install -y git nodejs npm
node --version                 # mora biti v22.13 ali novejši
npm --version
git clone <URL-REPOZITORIJA> jarvis-schedule
cd jarvis-schedule
npm ci
npm test
npm run dev
```

Odpri `http://127.0.0.1:4173`. Za dostop iz druge naprave zaženi aplikacijo za reverse proxyjem; samega razvojnega strežnika ne izpostavljaj neposredno v internet.

Če Fedora namesti prestaro različico Node.js, uporabi upravljalnik različic (na primer `nvm`) ali uradni vir za Node.js in nato ponovno preveri `node --version`. Vgrajeni SQLite v Node.js je razlog, da je zahtevan Node.js 22.13 ali novejši; dodatnega sistemskega SQLite strežnika ni treba namestiti.

### Produkcija brez Dockerja: systemd + Nginx

Za stalni strežnik uporabi systemd enoto in Nginx iz imenika `deploy/lxc/`. Ime `lxc` je zgodovinsko; postopek deluje tudi na navadnem Fedora strežniku ali VM-ju.

```bash
sudo dnf install -y git nodejs npm nginx firewalld
sudo systemctl enable --now firewalld nginx

sudo mkdir -p /opt/jarvis-schedule
sudo git clone <URL-REPOZITORIJA> /opt/jarvis-schedule
sudo useradd --system --home-dir /nonexistent --shell /sbin/nologin jarvis-schedule 2>/dev/null || true
sudo install -d -o jarvis-schedule -g jarvis-schedule -m 0750 \
  /var/lib/jarvis-schedule /var/backups/jarvis-schedule

cd /opt/jarvis-schedule
sudo npm ci
sudo npm run build
sudo npm prune --omit=dev
sudo chown -R root:root /opt/jarvis-schedule
sudo chmod -R a+rX /opt/jarvis-schedule

sudo install -m 0644 deploy/lxc/jarvis-schedule.service /etc/systemd/system/
sudo install -m 0644 deploy/lxc/jarvis-schedule-backup.service /etc/systemd/system/
sudo install -m 0644 deploy/lxc/jarvis-schedule-backup.timer /etc/systemd/system/
sudo sed 's/__SERVER_NAME__/urnik.example.lan/g' \
  deploy/lxc/nginx.conf.template | sudo tee /etc/nginx/conf.d/jarvis-schedule.conf >/dev/null

sudo systemctl daemon-reload
sudo nginx -t
sudo systemctl enable --now jarvis-schedule.service jarvis-schedule-backup.timer
sudo systemctl reload nginx
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
curl -fsS http://127.0.0.1:4173/api/health
```

Za lokalno omrežje zamenjaj `urnik.example.lan` z DNS imenom ali IP-naslovom strežnika. Če DNS še ni nastavljen, dodaj ime v lokalni DNS ali v datoteko `/etc/hosts` na odjemalskih računalnikih. Nginx streže statični frontend, zahtevke `/api/` pa posreduje Node.js procesu na `127.0.0.1:4173`.

Preverjanje in logi:

```bash
systemctl status jarvis-schedule --no-pager
systemctl status jarvis-schedule-backup.timer --no-pager
journalctl -u jarvis-schedule -n 100 --no-pager
curl -fsS http://127.0.0.1:4173/api/health
```

Na Fedori je običajno vključen SELinux. Pri namestitvi v `/opt` uporabi `restorecon -Rv /opt/jarvis-schedule /var/lib/jarvis-schedule` in preveri `ausearch -m AVC -ts recent`, če Nginx ali systemd javi zavrnitev. Podatkovne mape ne briši: `/var/lib/jarvis-schedule` vsebuje SQLite podatke, `/var/backups/jarvis-schedule` pa varnostne kopije.

### Docker ali Podman

Repozitorij vsebuje `Dockerfile` in `compose.yaml`. Docker image uporablja Node.js 24 Alpine, zato na gostitelju Node.js ni potreben. Za Docker:

```bash
cp .env.example .env
# DOMAIN nastavi na pravo DNS ime, na primer urnik.example.si
docker compose up -d --build
docker compose ps
curl -fsS https://urnik.example.si/api/health
```

Na Fedori lahko uporabiš tudi Podman, če imaš nameščen združljiv Compose ponudnik; ukazi so praviloma `podman compose ...`. Pri SELinux ohrani imenovane volume-e iz `compose.yaml` oziroma pri lastnih bind mountih uporabi ustrezno oznako `:Z`. Podatki aplikacije so v volume-u `schedule-data`, certifikati Caddyja pa v `caddy-data` in `caddy-config`. Za javni HTTPS mora DNS kazati na strežnik in morata biti odprta vrata 80 ter 443.

Pri reverse proxyju s HTTPS mora biti piškotek nastavljen varno (`COOKIE_SECURE=true`). Pri samo lokalnem HTTP dostopu ostane `COOKIE_SECURE=false`, kot v priloženi systemd enoti. Ne uporabljaj obeh načinov (native Nginx in Compose Caddy) hkrati na istih vratih 80/443.

### Posodobitve na Linuxu

Native namestitev posodobi tako:

```bash
cd /opt/jarvis-schedule
sudo git pull --ff-only
sudo bash deploy/lxc/update.sh /opt/jarvis-schedule
```

Skripta ponovno namesti odvisnosti, zgradi frontend, odstrani razvojne odvisnosti in ponovno zažene systemd storitev. Ne briše `/var/lib/jarvis-schedule` ali `/var/backups/jarvis-schedule`. Pri Compose namestitvi uporabi `docker compose up -d --build` oziroma ustrezni `podman compose` ukaz.

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

### Trenutna postavitev na Jarvisu

Produkcijski scheduler teče v namenskem Debian 13 LXC containerju:

```text
Container: feri-schedule (CT 102)
LAN naslov: 192.168.0.31
Aplikacija: /opt/jarvis-schedule
SQLite: /var/lib/jarvis-schedule/user-settings.sqlite
Backupi: /var/backups/jarvis-schedule/
Proces: systemd/jarvis-schedule.service
Lokalni proxy: Nginx → 127.0.0.1:4173
```

Storitev teče kot uporabnik `jarvis-schedule`, scheduler pa osvežuje podatke ob 08:00 in 16:00 po ljubljanskem času. Backup timer vsak dan naredi kopijo SQLite baze. Stanje preveriš z:

```bash
ssh root@192.168.0.31
systemctl status jarvis-schedule --no-pager
systemctl status jarvis-schedule-backup.timer --no-pager
journalctl -u jarvis-schedule -n 100 --no-pager
curl -fsS http://127.0.0.1:4173/api/health
```

### Dostop prek Tailscale MagicDNS

Container je prijavljen v isti Tailscale tailnet kot `jarvis-dashboard` in ima ime `feri-schedule`. Nginx na portu 80 streže zgrajeni `dist`, Tailscale Serve pa HTTPS promet na 443 posreduje v Nginx:

```text
https://feri-schedule.taile46e9c.ts.net/
http://feri-schedule/
http://100.115.171.25/
```

Naslovi delujejo samo na napravah v istem tailnetu. Tailscale šifrira HTTPS povezavo, javni internetni porti pa niso odprti. Za HTTPS mora Tailscale ACL dovoliti `tcp:443` od tvojih naprav do `feri-schedule`; za neposredni HTTP dostop se uporablja `tcp:80`. Konfiguracijo preveriš z:

```bash
tailscale status
tailscale serve status
```

Konfiguracija Serve za HTTPS:

```bash
tailscale serve reset
tailscale serve --bg --yes --https=443 http://127.0.0.1:4173
```

Pri trenutnem lokalnem HTTP dostopu je v systemd enoti `COOKIE_SECURE=false`. Pri javnem HTTPS reverse proxyju mora biti `COOKIE_SECURE=true`.

### Posodobitev na strežniku

Iz korena projekta na Macu prenesi samo kodo; imenikov z uporabniškimi podatki ne prepisuj:

```bash
rsync -av --exclude '.git/' --exclude 'node_modules/' --exclude 'dist/' \
  --exclude 'data/' --exclude 'backups/' \
  ./ root@192.168.0.31:/opt/jarvis-schedule/

ssh root@192.168.0.31 \
  'bash /opt/jarvis-schedule/deploy/lxc/update.sh /opt/jarvis-schedule'
```

`update.sh` ponovno zgradi frontend in zažene systemd storitev, ne izbriše `/var/lib/jarvis-schedule` ali `/var/backups/jarvis-schedule`.

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
