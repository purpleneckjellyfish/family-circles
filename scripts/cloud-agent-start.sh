#!/usr/bin/env bash
# Cloud Agent per-boot start: Postgres → migrate → Next.js on :43127
set -euo pipefail
cd "$(dirname "$0")/.."

# System Postgres (default Cloud Agent / Unraid-dev image pattern)
if command -v pg_ctlcluster >/dev/null 2>&1; then
  pg_ctlcluster 16 main start >/dev/null 2>&1 || true
elif command -v service >/dev/null 2>&1; then
  service postgresql start >/dev/null 2>&1 || true
fi

# Wait for Postgres
for i in $(seq 1 60); do
  if pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done
pg_isready -h 127.0.0.1 -p 5432

# Ensure role + database exist (idempotent; snapshot usually already has them)
if command -v sudo >/dev/null 2>&1 && id postgres >/dev/null 2>&1; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 <<'SQL' >/dev/null 2>&1 || true
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'familycircles') THEN
    CREATE ROLE familycircles LOGIN PASSWORD 'familycircles';
  END IF;
END
$$;
SELECT 'CREATE DATABASE familycircles OWNER familycircles'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'familycircles')\gexec
SQL
fi

# Local env for agents (never commit real secrets; regenerate if missing)
if [[ ! -f .env ]]; then
  cp .env.example .env
  SECRET=$(openssl rand -base64 32 | tr -d '\n')
  # Portable in-place replace for AUTH_SECRET / URLs
  python3 - <<'PY'
from pathlib import Path
import os, re, secrets
p = Path(".env")
text = p.read_text()
auth = secrets.token_urlsafe(32)
repl = {
  "AUTH_SECRET": auth,
  "DATABASE_URL": "postgres://familycircles:familycircles@127.0.0.1:5432/familycircles",
  "APP_URL": "http://127.0.0.1:43127",
  "AUTH_URL": "http://127.0.0.1:43127",
  "DATA_DIR": "./data",
}
for k, v in repl.items():
  if re.search(rf"^{k}=", text, re.M):
    text = re.sub(rf"^{k}=.*$", f"{k}={v}", text, flags=re.M)
  else:
    text += f"\n{k}={v}\n"
p.write_text(text)
print("Wrote .env for Cloud Agent")
PY
fi

mkdir -p data
npm run db:migrate
exec npm run dev
