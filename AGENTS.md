<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Family Circles — agent / IDE guide

Self-hosted family memory app. Brand name is **Family Circles** (never “Kin”).

## Where to edit what

| Concern | Path |
| --- | --- |
| Routes / pages | `app/` |
| Landing | `app/page.tsx` |
| Auth pages | `app/login`, `app/signup`, `app/api/auth/[...nextauth]` |
| Auth.js config | `auth.ts`, `types/next-auth.d.ts` |
| Authed home / browse | `app/home`, `app/browse` |
| Families & invites | `app/families/*`, `app/invite/[token]` |
| Server actions | `lib/actions/auth.ts`, `lib/actions/families.ts` |
| Design tokens / fonts | `app/globals.css`, `app/layout.tsx` |
| shadcn primitives | `components/ui/` |
| Shared UI | `components/` (`site-header`, forms) |
| Drizzle schema (source of truth) | `db/schema.ts` |
| DB client | `db/index.ts` (`getDb`, `closeDb` for scripts) |
| Env helpers | `lib/env.ts` |
| Docker | `Dockerfile`, `docker-compose.yml` |
| Env template | `.env.example` |

## Conventions

- **TypeScript + App Router** only. Prefer server components; add `"use client"` only for interactivity.
- **Auth.js (next-auth v5)** with Credentials + JWT. Email is stored lowercased; passwords hashed with bcrypt (`lib/password.ts`).
- **Roles**: `owner` (creator), `adult` (family member invite), `follower` (collaborator invite or same-instance follow). Owners/adults mint invites.
- **Drizzle schema first** — add columns/tables in `db/schema.ts`, then `npm run db:generate` / `db:migrate`.
- **Media** lives under `DATA_DIR` (Compose: `/data`). Do not store binaries in Postgres.
- **Federation hooks** (`remoteUri`, `instanceHost`, actor inbox/outbox) are reserved from Phase 0; do not remove them. Full ActivityPub is Phase 8.
- **Video**: `media.kind` is `image | video` already; upload/transcode UI is Phase 7.
- Comment **why** on non-obvious choices; skip noise comments.
- Product copy and UI must say **Family Circles**.

## Design bar

Editorial photo-album: warm paper + ink + deep forest accent, Fraunces (display) + Source Sans 3 (body). No purple gradients, no Inter-default SaaS look, no feature-dump heroes.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Next dev server (`:43127`) |
| `npm run build` / `start` | Production |
| `npm run lint` | ESLint |
| `npm run db:generate` | Drizzle Kit generate migrations |
| `npm run db:migrate` | Apply migrations |
| `npm run db:studio` | Drizzle Studio |

## Phase map

Phase 0 foundation + Phase 1 people/circles are in. Do not implement Phase 2+ (posts, throwbacks, PWA, federation) unless asked.
