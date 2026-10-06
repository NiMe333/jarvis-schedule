#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Zaženi kot root znotraj Jarvis LXC containerja." >&2
  exit 1
fi

cd "${1:-/opt/jarvis-schedule}"
npm ci
npm run build
npm prune --omit=dev
chown -R root:root .
chmod -R a+rX .
systemctl restart jarvis-schedule
curl --fail --silent http://127.0.0.1:4173/api/health
echo
