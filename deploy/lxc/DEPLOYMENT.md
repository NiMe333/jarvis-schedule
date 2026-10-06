# Namestitev v Jarvis LXC

Ta način je prilagojen obstoječemu Jarvis LXC okolju z Nginx in systemd. Docker in Caddy znotraj LXC nista potrebna.

## 1. Poišči ID containerja

Na Proxmox gostitelju:

```bash
ssh -t jarvis 'sudo /usr/sbin/pct list'
```

V nadaljevanju zamenjaj `<CTID>` z ID-jem LXC-ja na naslovu `192.168.0.31`.

## 2. Prenesi projekt

Na Macu iz korena projekta:

```bash
tar --exclude=.git --exclude=node_modules --exclude=dist --exclude=data --exclude=backups \
  -czf /tmp/jarvis-schedule.tar.gz .
scp /tmp/jarvis-schedule.tar.gz jarvis:/tmp/jarvis-schedule.tar.gz
```

Na Proxmox gostitelju potisni arhiv v LXC in ga razširi:

```bash
ssh -t jarvis
sudo /usr/sbin/pct exec <CTID> -- mkdir -p /opt/jarvis-schedule
sudo /usr/sbin/pct push <CTID> /tmp/jarvis-schedule.tar.gz /tmp/jarvis-schedule.tar.gz
sudo /usr/sbin/pct exec <CTID> -- tar -xzf /tmp/jarvis-schedule.tar.gz -C /opt/jarvis-schedule
sudo /usr/sbin/pct exec <CTID> -- bash /opt/jarvis-schedule/deploy/lxc/install.sh /opt/jarvis-schedule urnik.jarvis
```

Installer preveri Node.js 22.13+, zgradi frontend, ustvari uporabnika `jarvis-schedule`, namesti systemd storitev, Nginx virtual host in dnevni backup timer. SQLite je zunaj aplikacijske kode v `/var/lib/jarvis-schedule`.

## 3. Lokalni DNS

Ime `urnik.jarvis` mora kazati na `192.168.0.31`. Dodaj ga v lokalni DNS ali začasno v `/etc/hosts`:

```text
192.168.0.31 urnik.jarvis
```

Nato odpri `http://urnik.jarvis` oziroma `http://192.168.0.31`.

## 4. Preverjanje

```bash
sudo /usr/sbin/pct exec <CTID> -- systemctl status jarvis-schedule --no-pager
sudo /usr/sbin/pct exec <CTID> -- systemctl status jarvis-schedule-backup.timer --no-pager
sudo /usr/sbin/pct exec <CTID> -- curl -fsS http://127.0.0.1:4173/api/health
curl -fsS http://urnik.jarvis/api/health
```

Logi:

```bash
sudo /usr/sbin/pct exec <CTID> -- journalctl -u jarvis-schedule -n 100 --no-pager
```

## Posodobitev

Ponovno prenesi in razširi arhiv v `/opt/jarvis-schedule`, nato zaženi:

```bash
sudo /usr/sbin/pct exec <CTID> -- bash /opt/jarvis-schedule/deploy/lxc/update.sh
```

Posodobitev ne briše `/var/lib/jarvis-schedule` ali `/var/backups/jarvis-schedule`.

## HTTPS

Za samo lokalni `urnik.jarvis` lahko ostane HTTP; systemd storitev zato uporablja `COOKIE_SECURE=false`. Če ime dobi javni DNS in je LXC dosegljiv prek obstoječega HTTPS reverse proxyja, spremeni nastavitev v `COOKIE_SECURE=true`, izvedi `systemctl daemon-reload` in ponovno zaženi storitev. Javna domena mora biti dostopna samo prek HTTPS.
