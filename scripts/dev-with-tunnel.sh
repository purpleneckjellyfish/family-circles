#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-43127}"
mkdir -p /tmp

# Start Next if not already listening
if ! curl -sf -o /dev/null "http://127.0.0.1:${PORT}/"; then
  echo "Starting Next on 0.0.0.0:${PORT}..."
  npm run dev > /tmp/next-dev.log 2>&1 &
  echo $! > /tmp/next-dev.pid
  for i in $(seq 1 60); do
    curl -sf -o /dev/null "http://127.0.0.1:${PORT}/" && break
    sleep 0.5
  done
fi

# Start/refresh cloudflared quick tunnel
pkill -f 'cloudflared tunnel --url' 2>/dev/null || true
sleep 1
npx --yes cloudflared tunnel --url "http://127.0.0.1:${PORT}" > /tmp/cloudflared.log 2>&1 &
echo $! > /tmp/cloudflared.pid

PUBLIC_URL=""
for i in $(seq 1 60); do
  PUBLIC_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cloudflared.log | head -1 || true)
  if [[ -n "$PUBLIC_URL" ]]; then break; fi
  sleep 0.5
done

if [[ -z "$PUBLIC_URL" ]]; then
  echo "Failed to obtain Cloudflare tunnel URL. See /tmp/cloudflared.log" >&2
  exit 1
fi

# Point Auth.js at the public origin
python3 - "$PUBLIC_URL" <<'PY'
import re, sys
from pathlib import Path
url = sys.argv[1]
p = Path('.env')
text = p.read_text() if p.exists() else ''
for key in ('APP_URL', 'AUTH_URL'):
    if re.search(rf'^{key}=', text, re.M):
        text = re.sub(rf'^{key}=.*$', f'{key}={url}', text, flags=re.M)
    else:
        text += f'\n{key}={url}\n'
p.write_text(text)
print(url)
PY

echo "$PUBLIC_URL" | tee /tmp/family-circles-public-url.txt
echo "Public URL: $PUBLIC_URL"
echo "Local:      http://127.0.0.1:${PORT}/"
echo "Demo:       demo@familycircles.local / demo1234"
