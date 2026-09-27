# Family Circles

Self-hosted family memory app. Private circles for photos and stories you keep on your own server (Unraid / Docker). Product name: **Family Circles**.

Phase 0 ships the foundation: Next.js app shell, Postgres + Drizzle schema (video-ready and federation-ready), Docker Compose, and design tokens.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- Postgres + Drizzle ORM
- Docker Compose (`app` + `db`, media volume at `/data`)

## Run locally

```bash
cp .env.example .env
npm install
# Start Postgres (Docker) or point DATABASE_URL at your own instance
docker compose up -d db
npm run db:generate   # optional after schema edits
npm run db:migrate    # when migrations exist
npm run dev -- -p 43127
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127).

Required env vars are listed in `.env.example` (`DATABASE_URL`, `AUTH_SECRET`, `APP_URL`, `DATA_DIR`, VAPID placeholders).

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
| `components/` | UI (shadcn under `components/ui/`) |
| `db/` | Drizzle schema + client |
| `lib/` | Shared utilities and env helpers |
| `AGENTS.md` | Architecture map for agents / IDEs |

## Phases (not in this commit)

Auth, invites, posts, throwbacks, PWA, export, video UI, and ActivityPub federation are later phases. Schema already reserves `media.kind` (`image` \| `video`) and remote actor fields (`remoteUri`, `instanceHost`, inbox/outbox).
