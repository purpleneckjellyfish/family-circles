# Deploy Family Circles on Unraid

Self-host Family Circles with Docker on Unraid. Photos stay on a mapped share; the app needs **HTTPS** in production for web push and (later) federation.

## What you need

- Unraid 6.12+ (or any Docker host)
- A share for media originals (e.g. `appdata/family-circles/data` or a dedicated photos share)
- A reverse proxy with TLS (SWAG, Nginx Proxy Manager, Caddy, Traefik, …)
- Optional: User Scripts / cron for digest flush

## Volumes

| Host path (example) | Container | Purpose |
| --- | --- | --- |
| `/mnt/user/appdata/family-circles/data` | `/data` | Original photos + videos (`DATA_DIR`) |
| Docker volume `pgdata` (or bind mount) | Postgres data dir | Database |

Keep `/data` on a share you back up. Do **not** put originals only inside an ephemeral container layer.

### Compose bind-mount example

In `docker-compose.yml`, replace the named `media` volume with a host path:

```yaml
  app:
    volumes:
      - /mnt/user/appdata/family-circles/data:/data
```

Postgres can stay on a named volume, or:

```yaml
  db:
    volumes:
      - /mnt/user/appdata/family-circles/pgdata:/var/lib/postgresql/data
```

## Environment

Copy `.env.example` → `.env` next to Compose (or set variables in the Unraid template).

| Variable | Notes |
| --- | --- |
| `AUTH_SECRET` | Long random string (session signing) |
| `APP_URL` / `AUTH_URL` | Public **HTTPS** URL, e.g. `https://circles.example.com` |
| `DATABASE_URL` | Inside Compose: `postgres://familycircles:familycircles@db:5432/familycircles` |
| `DATA_DIR` | `/data` in the container |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Required for web push |
| `CRON_SECRET` | Bearer token for `/api/cron/digest` |

Generate VAPID keys on any machine with Node:

```bash
npx web-push generate-vapid-keys
```

Set `VAPID_SUBJECT` to a contact `mailto:` (or `https://` URL).

Change the default Postgres password in production and keep `AUTH_SECRET` out of git.

## Bring it up

From the project directory:

```bash
docker compose up --build -d
docker compose exec app node -e "require('fs').accessSync('/data')"
```

App listens on container port `3000`, mapped to host **`43127`** by default (`43127:3000`). Point your reverse proxy at the container (or `http://TOWER:43127`).

On first boot, run migrations if your image does not auto-migrate:

```bash
docker compose exec app npx drizzle-kit migrate
```

(Or build with a start wrapper that migrates — current image expects you to migrate via Compose exec / CI.)

## HTTPS reverse proxy

Web push and installable PWA need a secure context. Terminate TLS at the proxy; forward to the app over HTTP on the Docker network.

### Checklist

1. DNS A/AAAA → your Unraid public IP (or Tailscale / local DNS for LAN-only).
2. Proxy host: `circles.example.com` → `http://family-circles:3000` (or host `43127`).
3. Enable WebSocket support if your proxy template asks (not strictly required for v1).
4. Forward headers: `Host`, `X-Forwarded-Proto=https`, `X-Forwarded-For`.
5. Set `APP_URL=https://circles.example.com` and `AUTH_URL` to the same origin so invites and Auth.js cookies match.

### Nginx Proxy Manager (typical)

- Domain: `circles.example.com`
- Scheme: `http`, Forward hostname: Unraid IP or container name, port `43127` (or `3000` on Docker network)
- SSL: Let's Encrypt, force SSL
- Custom locations: none required for Phase 6

### SWAG / nginx snippet (conceptual)

```nginx
location / {
  proxy_pass http://family-circles:3000;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  client_max_body_size 260m;  # photos + video uploads (app limit ~256 MB)
}
```

Raise upload body size above the app’s ~32 MB server-action limit so large albums do not fail at the proxy.

## VAPID & notifications

1. Generate keys → set env → recreate the app container.
2. Open the site over **HTTPS**.
3. Sign in → **Alerts** → Enable push → allow the browser prompt.
4. Choose Instant or Daily digest; optional quiet hours + timezone.

Without VAPID keys, the UI still loads; push enable returns an error until keys exist.

## Digest / quiet-hours cron

Call hourly (User Scripts plugin, systemd, or external cron):

```bash
curl -fsS -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  "https://circles.example.com/api/cron/digest"
```

Delivery runs when the user’s local hour matches their digest hour and they are outside quiet hours.

## Updates

```bash
git pull
docker compose build --pull
docker compose up -d
docker compose exec app npx drizzle-kit migrate
```

Back up `/data` and Postgres before major upgrades.

## LAN-only / Tailscale

You can skip public DNS and use Tailscale HTTPS or a local CA. Push still requires a secure context (HTTPS or `localhost`). Plain `http://192.168.…` will not enable web push in modern browsers.

## Video (ffmpeg)

Phase 7 video upload **requires ffmpeg + ffprobe** in the app container. The project `Dockerfile` installs `ffmpeg` in the runner image.

- Uploads are stored under `/data`, transcoded to H.264/AAC MP4 (`+faststart`), and a JPEG poster is extracted.
- Limits: up to **3** videos per memory, **200 MB** each; server action body limit **256 MB**.
- Local `npm run dev` also needs host ffmpeg (`apt install ffmpeg` / brew).

If ffmpeg is missing, the compose form returns a clear error instead of saving a broken file.

| Symptom | Check |
| --- | --- |
| “ffmpeg is not installed” | Rebuild the Docker image; confirm `ffmpeg -version` inside the container |
| Video upload times out | Slow disks / large files — wait, or raise reverse-proxy timeouts |
| Player won’t seek | Ensure `/api/media` is not stripping `Range` headers at the proxy |

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Cannot enable push | HTTPS? VAPID env set? Recreate container after env change |
| Uploads fail | Proxy `client_max_body_size` (≥ 260m for video); disk space on `/data` |
| Login loops | `AUTH_URL` / `APP_URL` must match the browser origin |
| Empty media | Volume mounted at `/data`; file permissions for the `node` user |
| Digest never sends | Cron hitting `/api/cron/digest` with correct `CRON_SECRET` |

## Related

- Local development: root [`README.md`](../README.md)
- Architecture for agents: [`AGENTS.md`](../AGENTS.md)
- Compose + Dockerfile in the repo root
