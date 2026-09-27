# Family Circles

Self-hosted family memory app. Private circles for photos and stories you keep on your own server (Unraid / Docker). Product name: **Family Circles**.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- Auth.js (email + password)
- Postgres + Drizzle ORM
- Docker Compose (`app` + `db`, media volume at `/data`)

## Run locally

```bash
cp .env.example .env
# set AUTH_SECRET to a long random string
npm install
# Start Postgres (Docker) or use a local Postgres matching DATABASE_URL
docker compose up -d db
npm run db:migrate
npm run dev
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127).

### Try Phase 1 (auth & circles)

1. **Create account** at `/signup` (email + password, 8+ chars).
2. **Create a circle** from Home → New circle (you become **owner**).
3. On the circle page, **Create invite link** as family member (adult) or collaborator (follower).
4. Open the invite URL in another browser/profile, sign up or sign in, **Accept invite**.
5. Or **Browse** circles and **Follow as collaborator** on a circle you do not own.

Required env vars: `.env.example` (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL` / `APP_URL`, `DATA_DIR`, VAPID placeholders).

## Run with Docker Compose

```bash
cp .env.example .env
# set AUTH_SECRET (and optionally APP_URL / VAPID keys)
docker compose up --build
```

- App: [http://127.0.0.1:43127](http://127.0.0.1:43127)
- Media originals: Docker volume `media` mounted at `/data` in the app container
- Database: Postgres 16 on port `5432`

## Project layout

| Path | Purpose |
| --- | --- |
| `app/` | Next.js routes and pages |
| `auth.ts` | Auth.js configuration |
| `components/` | UI (shadcn under `components/ui/`) |
| `db/` | Drizzle schema + client |
| `lib/actions/` | Server actions (auth, families) |
| `AGENTS.md` | Architecture map for agents / IDEs |

## What’s next

Phase 2+: memories/posts, throwbacks, PWA, export, video UI, ActivityPub federation. Schema already reserves `media.kind` and remote actor fields.
