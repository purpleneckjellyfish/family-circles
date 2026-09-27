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

## Try Phase 1–2

1. **Create account** at `/signup`.
2. **Create a circle** (Home → New circle).
3. **People** → add kids/relatives (no account needed) for tags.
4. **Albums** (optional) → create an album.
5. **New memory** → caption and/or photos; memory date prefills from EXIF when present (editable); tag people / pick album.
6. **Home feed** shows posts from memberships + follows.
7. As owner/adult, **Hide** or **Remove** collaborator (follower) posts from the post card.
8. **Throwbacks** (`/throwbacks` or Home banner): prior-year memories for today’s month/day (memory date, else posted date). Birthdays from People; anniversaries from circle **Milestones**.

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

Phase 3+: throwbacks, PWA/push, browse/export polish, video UI, ActivityPub federation.
