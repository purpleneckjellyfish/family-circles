#!/usr/bin/env bash
# Pull the GHCR image from GitHub Actions and (re)start on Unraid.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "Missing .env — copy .env.example and set AUTH_SECRET, APP_URL, AUTH_URL, VAPID_*, CRON_SECRET" >&2
  exit 1
fi

mkdir -p /mnt/user/appdata/family-circles/data /mnt/user/appdata/family-circles/pgdata 2>/dev/null || true

# Optional: authenticate to GHCR when the package is private or anonymous pull is blocked.
GHCR_USER="${GHCR_USER:-purpleneckjellyfish}"
GHCR_PASS="${GHCR_TOKEN:-${GITHUB_TOKEN:-}}"
if [[ -n "$GHCR_PASS" ]]; then
  echo "Logging in to ghcr.io as ${GHCR_USER}…"
  echo "$GHCR_PASS" | docker login ghcr.io -u "$GHCR_USER" --password-stdin
fi

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.unraid.yml)

echo "Pulling ${FAMILY_CIRCLES_IMAGE:-ghcr.io/purpleneckjellyfish/family-circles:latest}…"
"${COMPOSE[@]}" pull app
"${COMPOSE[@]}" up -d
"${COMPOSE[@]}" ps
echo
echo "App: http://$(hostname -I 2>/dev/null | awk '{print $1}'):43127  (or your reverse-proxy HTTPS URL)"
echo "Logs: ${COMPOSE[*]} logs -f app"
