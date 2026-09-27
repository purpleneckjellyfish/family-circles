#!/bin/sh
set -eu

echo "Family Circles: waiting for Postgres and applying migrations…"
i=0
until node /app/scripts/migrate.mjs; do
  i=$((i + 1))
  if [ "$i" -ge 40 ]; then
    echo "Migrations failed after retries" >&2
    exit 1
  fi
  echo "DB not ready (attempt $i) — retrying in 2s…"
  sleep 2
done

exec "$@"
