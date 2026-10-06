#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Zaženi kot root znotraj Jarvis LXC containerja." >&2
  exit 1
fi

app_dir=${1:-/opt/jarvis-schedule}
server_name=${2:-urnik.jarvis}
required_node_major=22
node_major=$(node -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || echo 0)
if (( node_major < required_node_major )); then
  echo "Potreben je Node.js 22.13 ali novejši; najden: $(node --version 2>/dev/null || echo ni nameščen)." >&2
  exit 1
fi

id -u jarvis-schedule >/dev/null 2>&1 || useradd --system --home-dir /nonexistent --shell /usr/sbin/nologin jarvis-schedule
install -d -o jarvis-schedule -g jarvis-schedule -m 0750 /var/lib/jarvis-schedule /var/backups/jarvis-schedule

cd "$app_dir"
npm ci
npm run build
npm prune --omit=dev
chown -R root:root "$app_dir"
chmod -R a+rX "$app_dir"

install -m 0644 deploy/lxc/jarvis-schedule.service /etc/systemd/system/jarvis-schedule.service
install -m 0644 deploy/lxc/jarvis-schedule-backup.service /etc/systemd/system/jarvis-schedule-backup.service
install -m 0644 deploy/lxc/jarvis-schedule-backup.timer /etc/systemd/system/jarvis-schedule-backup.timer
sed "s/__SERVER_NAME__/${server_name//\//\\\/}/g" deploy/lxc/nginx.conf.template > /etc/nginx/sites-available/jarvis-schedule
ln -sfn /etc/nginx/sites-available/jarvis-schedule /etc/nginx/sites-enabled/jarvis-schedule

systemctl daemon-reload
nginx -t
systemctl enable --now jarvis-schedule.service jarvis-schedule-backup.timer
systemctl reload nginx

curl --fail --silent http://127.0.0.1:4173/api/health
echo
echo "Moj FERI urnik je pripravljen na http://${server_name}"
