# Family Circles

Self-hosted family memory app. Private circles for photos and stories you keep on your own server (Unraid / Docker). Product name: **Family Circles**.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- Auth.js (email + password)
- Postgres + Drizzle ORM
- PWA (`app/manifest.ts` + `public/sw.js`) + Web Push (`web-push` + VAPID)
- Docker Compose (`app` + `db`, media volume at `/data`)

## Run locally

```bash
cp .env.example .env
# set AUTH_SECRET to a long random string
npx web-push generate-vapid-keys   # paste into VAPID_* in .env
# optional: CRON_SECRET for digest flush
npm install
docker compose up -d db   # or local Postgres matching DATABASE_URL
npm run db:migrate
npm run dev
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127) on the same machine.

### Cloud Agent / remote preview

`127.0.0.1` on your laptop is not the Cloud Agent VM. From a remote agent session, expose the app with a quick tunnel (updates `APP_URL` / `AUTH_URL` automatically):

```bash
./scripts/dev-with-tunnel.sh
```

Use the printed `https://….trycloudflare.com` URL in your browser. Demo login: `demo@familycircles.local` / `demo1234`.

## Deploy on Unraid

Repo: [github.com/purpleneckjellyfish/family-circles](https://github.com/purpleneckjellyfish/family-circles).

**GitHub Actions** builds and pushes `ghcr.io/purpleneckjellyfish/family-circles:latest` on every `main` push. Unraid **pulls** that image (no build on the tower).

See **[docs/unraid.md](docs/unraid.md)**. Short version (Compose Manager / Docker tab):

```bash
mkdir -p /mnt/user/appdata/family-circles/{data,pgdata,compose}
cd /mnt/user/appdata/family-circles/compose
curl -fsSL -o docker-compose.yml \
  https://raw.githubusercontent.com/purpleneckjellyfish/family-circles/main/docker-compose.unraid-stack.yml
curl -fsSL -o .env \
  https://raw.githubusercontent.com/purpleneckjellyfish/family-circles/main/env.unraid.example
# edit .env — AUTH_SECRET, APP_URL/AUTH_URL (https://…), POSTGRES_PASSWORD, VAPID_*, CRON_SECRET
```

Then in Unraid: Docker → Compose Manager → add stack pointing at that `compose` folder → Up (pull only, no build). App on **43127**.

## PWA install & web push

1. Generate VAPID keys and set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` in `.env` (see `.env.example`).
2. Open the app over **HTTPS** in production (or `localhost` / `127.0.0.1` for dev). Push and “Add to Home Screen” need a secure context.
3. Sign in → **Alerts** (`/settings/notifications`).
4. Tap **Enable push on this device** and allow notifications.
5. Choose **Instant**, **Daily digest**, and optional **quiet hours** + timezone / digest hour.
6. Install on a phone: browser menu → **Add to Home Screen** / **Install app** (uses the web manifest).

When someone posts a memory in a circle you belong to or follow, members get a push (or a queued digest item). Digests and quiet-hours queues flush via:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/digest"
```

Run that **hourly** from Unraid / cron. Delivery happens when the user’s local hour equals their digest hour and they are outside quiet hours.

## Try the product

1. **Create account** at `/signup`.
2. **Create a circle** — add adults/kids on the roster; adults with email get invite links (copy or mailto).
3. **Home feed** — inline composer (photo / video / people / occasion). Followers are quiet by default; owners grant **Can add photos** per person.
4. **React** with 👍 ❤️ 😂 😮 😢; everyone who can see the circle can comment and react. Comments notify the post author (and other recent commenters).
5. **Throwbacks** appear in the home feed on matching days (Throwbacks tab still available).
6. **Browse** by person, year, occasion (e.g. Christmas 2026), or album.
7. Videos **autoplay muted** when scrolled into view; tap for sound.
8. **Alerts** → enable push + quiet hours / digest.
9. **Export** (`/families/<slug>/export`) → Download ZIP.
10. **Federation** → Follow a remote circle. See [docs/federation.md](docs/federation.md).

Video needs **ffmpeg** on the host (dev) or in the Docker image (see [docs/unraid.md](docs/unraid.md)).

## Run with Docker Compose

```bash
cp .env.example .env
# set AUTH_SECRET, VAPID_*, APP_URL (https://…), CRON_SECRET
docker compose up --build
```

- App: [http://127.0.0.1:43127](http://127.0.0.1:43127) (map HTTPS reverse proxy in production — see [docs/unraid.md](docs/unraid.md))
- Media: volume `media` → `/data` (or bind-mount a share)
- Database: Postgres 16 on `5432`

## Project layout

| Path | Purpose |
| --- | --- |
| `app/` | Next.js routes and pages |
| `auth.ts` | Auth.js configuration |
| `public/sw.js` | Service worker (PWA + push) |
| `lib/push.ts` | Web push + quiet hours / digest |
| `lib/browse.ts` / `lib/export-zip.ts` | Browse queries + ZIP export |
| `components/` | UI (photo-first cards, empty/loading states) |
| `docs/unraid.md` | Unraid volumes, HTTPS, VAPID, cron |
| `docs/federation.md` | Cross-instance ActivityPub follow / media / comments |
| `db/` | Drizzle schema + client |
| `AGENTS.md` | Architecture map for agents / IDEs |

## What’s next

Product phases 0–8 are implemented. Further work is polish, hardening HTTP signature strictness, and richer remote contribute flows.
