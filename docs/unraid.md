# Deploy Family Circles on Unraid

Self-host Family Circles with Docker on Unraid. Photos stay on a mapped share; the app needs **HTTPS** in production for web push and federation.

**Preferred path:** GitHub Actions builds the image → Unraid **pulls** it with Compose (no build on the tower).

## Install from Unraid Docker tab (Compose Manager)

Do **not** use **Add Container** for Family Circles — you need the app **and** Postgres as one stack.

### One-time prep (SSH or Unraid terminal)

```bash
mkdir -p /mnt/user/appdata/family-circles/{data,pgdata,compose}
cd /mnt/user/appdata/family-circles/compose

# Grab the single-file stack + env template from GitHub
curl -fsSL -o docker-compose.yml \
  https://raw.githubusercontent.com/purpleneckjellyfish/family-circles/main/docker-compose.unraid-stack.yml
curl -fsSL -o .env.example \
  https://raw.githubusercontent.com/purpleneckjellyfish/family-circles/main/env.unraid.example
cp .env.example .env
nano .env   # set AUTH_SECRET, APP_URL, AUTH_URL, POSTGRES_PASSWORD, VAPID_*, CRON_SECRET
```

If `docker pull ghcr.io/purpleneckjellyfish/family-circles:latest` fails with `denied`, log in once:

```bash
echo YOUR_PAT_WITH_read_packages | docker login ghcr.io -u purpleneckjellyfish --password-stdin
```

Or set the [package](https://github.com/users/purpleneckjellyfish/packages/container/package/family-circles) visibility to **Public**.

### Compose Manager (Docker tab)

1. Install **Compose Manager** from Community Apps (if you don’t already have it).
2. Docker tab → **Compose** → **Add New Stack** (wording varies slightly by plugin version).
3. Point the stack at `/mnt/user/appdata/family-circles/compose` (the folder that contains `docker-compose.yml` + `.env`).
4. **Compose Up** / Start — it should **pull** `ghcr.io/.../family-circles:latest` and `postgres:16-alpine` (no build).
5. Confirm two containers: `family-circles` and `family-circles-db`.
6. Open `http://TOWER_IP:43127` → sign up. Then put Nginx Proxy Manager / SWAG on that port with HTTPS and set `APP_URL` / `AUTH_URL` to that HTTPS origin.

### Updates

After a green [Actions build](https://github.com/purpleneckjellyfish/family-circles/actions) on `main`:

- In Compose Manager: **Pull** then **Up**, or  
- SSH: `cd /mnt/user/appdata/family-circles/compose && docker compose pull && docker compose up -d`

### Alternative (git clone + two-file compose)

If you prefer the full repo on disk:

```bash
git clone https://github.com/purpleneckjellyfish/family-circles.git /mnt/user/appdata/family-circles/src
cd /mnt/user/appdata/family-circles/src
cp .env.example .env   # edit
./scripts/unraid-up.sh
```

That uses `docker-compose.yml` + `docker-compose.unraid.yml` (same images/volumes).

## Image (GitHub Actions → GHCR)

On every push to `main`, [`.github/workflows/docker.yml`](../.github/workflows/docker.yml) builds and pushes:

`ghcr.io/purpleneckjellyfish/family-circles:latest`

(also `sha-<commit>` tags). After the first successful run:

1. Open [github.com/purpleneckjellyfish/family-circles/pkgs](https://github.com/purpleneckjellyfish/family-circles/pkgs/container/family-circles) (or **Packages** on your profile).
2. Confirm the package is **Public** (the workflow tries to set this; if pull fails with `denied`, set visibility to Public once in the UI).

Unraid then needs **no** `docker login` for pulls when the package is Public.

If `docker pull` returns `denied`, either open the [package settings](https://github.com/users/purpleneckjellyfish/packages/container/package/family-circles) → **Package settings** → **Change visibility** → Public, or log in once on the tower:

```bash
# Fine-grained or classic PAT with read:packages
echo YOUR_GHCR_PAT | docker login ghcr.io -u purpleneckjellyfish --password-stdin
```

(`scripts/unraid-up.sh` will use `GHCR_TOKEN` / `GITHUB_TOKEN` from the environment automatically when set.)

## Get the code

```bash
# On Unraid (SSH)
git clone https://github.com/purpleneckjellyfish/family-circles.git
cd family-circles
```

## What you need

- Unraid 6.12+ with Docker Compose
- A share for media originals (e.g. `appdata/family-circles/data`)
- A reverse proxy with TLS (SWAG, Nginx Proxy Manager, Caddy, Traefik, …) — or Tailscale HTTPS for LAN-only
- Optional: User Scripts / cron for digest flush

## Volumes

| Host path (example) | Container | Purpose |
| --- | --- | --- |
| `/mnt/user/appdata/family-circles/data` | `/data` | Original photos + videos (`DATA_DIR`) |
| `/mnt/user/appdata/family-circles/pgdata` | Postgres data | Database |

Keep `/data` on a share you back up. Do **not** put originals only inside an ephemeral container layer.

## Environment

Copy `.env.example` → `.env` next to Compose.

| Variable | Notes |
| --- | --- |
| `AUTH_SECRET` | Long random string (session signing) |
| `APP_URL` / `AUTH_URL` | Public **HTTPS** URL, e.g. `https://circles.example.com` |
| `DATABASE_URL` | Set by Compose to `postgres://familycircles:familycircles@db:5432/familycircles` |
| `DATA_DIR` | `/data` in the container |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Required for web push |
| `CRON_SECRET` | Bearer token for `/api/cron/digest` |
| `FAMILY_CIRCLES_IMAGE` | Optional pin, e.g. `ghcr.io/purpleneckjellyfish/family-circles:sha-abc1234` |

Generate VAPID keys:

```bash
npx web-push generate-vapid-keys
```

Change the default Postgres password in production and keep `AUTH_SECRET` out of git.

## Bring it up (pull from GHCR)

1. Wait until the **Build and push image** Action on `main` is green.

2. On Unraid:

```bash
mkdir -p /mnt/user/appdata/family-circles/{data,pgdata}
cd /path/to/family-circles
cp .env.example .env
# Edit .env — AUTH_SECRET, APP_URL, AUTH_URL (https://…), VAPID_*, CRON_SECRET

chmod +x scripts/unraid-up.sh
./scripts/unraid-up.sh
```

Or manually:

```bash
docker compose -f docker-compose.yml -f docker-compose.unraid.yml pull
docker compose -f docker-compose.yml -f docker-compose.unraid.yml up -d
docker compose -f docker-compose.yml -f docker-compose.unraid.yml logs -f app
```

Do **not** pass `--build` on Unraid — that rebuilds on the tower instead of using Actions.

The app container **auto-migrates** on start. You should see `Migrations applied`, then the app on host **`43127`**.

LAN smoke test: `http://TOWER_IP:43127` → sign up. Then put NPM/SWAG in front with TLS.

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

## Updates

After Actions finishes a new `main` build:

```bash
git pull   # refresh compose/.env.example only; image comes from GHCR
./scripts/unraid-up.sh
```

Or:

```bash
docker compose -f docker-compose.yml -f docker-compose.unraid.yml pull
docker compose -f docker-compose.yml -f docker-compose.unraid.yml up -d
```

Migrations run automatically on container start. Back up `/data` and Postgres before major upgrades.

## Local build (optional)

If you are not using GHCR (dev machine):

```bash
docker compose up --build -d
```

## LAN-only / Tailscale

You can skip public DNS and use Tailscale HTTPS or a local CA. Push still requires a secure context (HTTPS or `localhost`). Plain `http://192.168.…` will not enable web push in modern browsers.

## Video (ffmpeg)

Phase 7 video upload **requires ffmpeg + ffprobe** in the app container. The published image includes ffmpeg.

- Uploads are stored under `/data`, transcoded to H.264/AAC MP4 (`+faststart`), and a JPEG poster is extracted.
- Limits: up to **3** videos per memory, **200 MB** each; server action body limit **256 MB**.

| Symptom | Check |
| --- | --- |
| “ffmpeg is not installed” | Confirm you pulled the GHCR image (not an old local build) |
| Video upload times out | Slow disks / large files — wait, or raise reverse-proxy timeouts |
| Player won’t seek | Ensure `/api/media` is not stripping `Range` headers at the proxy |

## Federation (cross-instance)

See [`docs/federation.md`](./federation.md). Set `APP_URL` to the public **HTTPS** origin on both hosts.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `pull access denied` for ghcr.io | Package not public yet — set container package visibility to Public |
| Actions build red | Open the failed job log; fix Dockerfile / build, re-push `main` |
| Cannot enable push | HTTPS? VAPID env set? Recreate container after env change |
| Uploads fail | Proxy `client_max_body_size` (≥ 260m for video); disk space on `/data` |
| Login loops | `AUTH_URL` / `APP_URL` must match the browser origin |
| Empty media | Volume mounted at `/data`; file permissions for the `node` user |
| Digest never sends | Cron hitting `/api/cron/digest` with correct `CRON_SECRET` |

## Related

- Local development: root [`README.md`](../README.md)
- Architecture for agents: [`AGENTS.md`](../AGENTS.md)
- Compose + Dockerfile in the repo root
