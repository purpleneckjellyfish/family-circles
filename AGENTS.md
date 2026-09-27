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
| Auth | `auth.ts`, `app/login`, `app/signup`, `app/api/auth/[...nextauth]` |
| Home feed | `app/home`, `lib/feed.ts` |
| Throwbacks | `app/throwbacks`, `lib/throwbacks.ts`, `components/throwbacks-panel.tsx` |
| Milestones (anniversaries) | `app/families/[slug]/milestones`, `lib/actions/milestones.ts` |
| Families / invites | `app/families/*`, `app/invite/[token]` |
| Memories (posts) | `app/families/[slug]/posts/*`, `lib/actions/posts.ts`, `components/compose-post-form.tsx`, `components/post-card.tsx` |
| Browse (person / year / album) | `app/families/[slug]/browse/*`, `lib/browse.ts` |
| ZIP export | `app/families/[slug]/export`, `app/api/families/[slug]/export`, `lib/export-zip.ts` |
| Empty / loading / error UI | `components/ui-states.tsx`, `app/**/loading.tsx`, `app/error.tsx`, `app/not-found.tsx` |
| Unraid deploy | `docs/unraid.md`, `docker-compose.yml`, `Dockerfile` |
| Albums / people | `app/families/[slug]/albums/*`, `.../people`, `lib/actions/albums.ts`, `lib/actions/people.ts` |
| Comments | `lib/actions/comments.ts`, `components/comment-form.tsx` |
| PWA / push | `app/manifest.ts`, `public/sw.js`, `lib/push.ts`, `app/settings/notifications`, `app/api/push/*`, `app/api/cron/digest` |
| Media files | `DATA_DIR` via `lib/media-storage.ts`; served at `app/api/media/[id]` |
| EXIF helpers | `lib/exif.ts` (client + server) |
| Permissions | `lib/permissions.ts` |
| Server actions | `lib/actions/*` |
| Design tokens / fonts | `app/globals.css`, `app/layout.tsx` |
| shadcn primitives | `components/ui/` |
| Drizzle schema | `db/schema.ts` |
| DB client | `db/index.ts` |
| Env | `lib/env.ts`, `.env.example` |

## Conventions

- **TypeScript + App Router**. Prefer server components; `"use client"` only for interactivity.
- **Auth.js** Credentials + JWT; emails lowercased; bcrypt in `lib/password.ts`.
- **Roles**: `owner` / `adult` moderate + invite; `follower` can contribute/comment. Adults/owners may **hide** or **remove** follower posts only.
- **Memories**: `posts.memoryDate` (when it happened) vs `posts.postedAt` (when shared). EXIF prefills memory date (editable). Photos under `DATA_DIR/families/...` — never in Postgres.
- **Throwbacks**: on-this-day matches `memory_date` month/day (else `posted_at` date), prior years only. Birthdays from `people.birthday`; anniversaries from `milestones`.
- **PWA / push**: installable via manifest + `public/sw.js`. New posts call `notifyNewFamilyPost`. Quiet hours / digest queue into `notification_digest_items`; flush with `/api/cron/digest` + `CRON_SECRET`. Needs VAPID env + HTTPS (or localhost).
- **Browse / export**: `/families/[slug]/browse` lists people, years (memory date else posted), albums. ZIP at `/families/[slug]/export` → `/api/families/[slug]/export` (originals + `memories.json` / `memories.csv`).
- **Polish**: photo-first post cards, intentional motion (`animate-fc-*`, reduced-motion safe), empty / loading / error states. Deploy notes in `docs/unraid.md`.
- **Drizzle schema first**, then `db:generate` / `db:migrate`.
- **Federation/video hooks** stay in schema; do not implement Phase 7+ unless asked.
- Comment **why**; brand **Family Circles**.

## Design bar

Warm paper + ink + forest accent; Fraunces + Source Sans 3. Photo-first album feel — no purple SaaS chrome.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server `:43127` |
| `npm run build` / `start` | Production |
| `npm run lint` | ESLint |
| `npm run db:generate` / `db:migrate` / `db:studio` | Drizzle |

## Phase map

Phases 0–6 are in (foundation through Unraid polish). Do not start video / federation unless asked.
