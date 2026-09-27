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

Open [http://127.0.0.1:43127](http://127.0.0.1:43127).

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

## Try the product (Phases 1–5)

1. **Create account** at `/signup`.
2. **Create a circle** (Home → New circle).
3. **People** / **Albums** / **Milestones** as needed.
4. **New memory** → caption and/or photos; EXIF can prefill memory date; tag people / albums.
5. **Home feed** + **Throwbacks**.
6. **Alerts** → enable push + quiet hours / digest.
7. **Browse** (`/families/<slug>/browse`) → by person, year, or album.
8. **Export** (`/families/<slug>/export`) → Download ZIP (originals + captions/dates in JSON/CSV).

## Run with Docker Compose

```bash
cp .env.example .env
# set AUTH_SECRET, VAPID_*, APP_URL (https://…), CRON_SECRET
docker compose up --build
```

- App: [http://127.0.0.1:43127](http://127.0.0.1:43127) (map HTTPS reverse proxy in production)
- Media: volume `media` → `/data`
- Database: Postgres 16 on `5432`

## Project layout

| Path | Purpose |
| --- | --- |
| `app/` | Next.js routes and pages |
| `auth.ts` | Auth.js configuration |
| `public/sw.js` | Service worker (PWA + push) |
| `lib/push.ts` | Web push + quiet hours / digest |
| `lib/browse.ts` / `lib/export-zip.ts` | Browse queries + ZIP export |
| `components/` | UI |
| `db/` | Drizzle schema + client |
| `AGENTS.md` | Architecture map for agents / IDEs |

## What’s next

Phase 6+: Unraid polish, video UI, ActivityPub federation.
