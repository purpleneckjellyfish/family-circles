#!/bin/sh
set -eu

# Unraid / Docker bind mounts are often root or nobody-owned.
# Fix /data ownership then drop privileges (gosu). Defaults match the
# upstream `node` user (1000:1000). Override with PUID/PGID (e.g. 99:100 on Unraid).
PUID="${PUID:-1000}"
PGID="${PGID:-1000}"

if [ "$(id -u)" = "0" ]; then
  mkdir -p /data
  chown -R "${PUID}:${PGID}" /data || true
  run() { gosu "${PUID}:${PGID}" "$@"; }
else
  run() { "$@"; }
fi

echo "Family Circles: waiting for Postgres and applying migrations…"
i=0
until run node /app/scripts/migrate.mjs; do
  i=$((i + 1))
  if [ "$i" -ge 40 ]; then
    echo "Migrations failed after retries" >&2
    exit 1
  fi
  echo "DB not ready (attempt $i) — retrying in 2s…"
  sleep 2
done

if [ "$(id -u)" = "0" ]; then
  exec gosu "${PUID}:${PGID}" "$@"
fi
exec "$@"
