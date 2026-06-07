# Mint Web Development Guide

## Local Setup

Install dependencies:

```bash
npm install
```

Start the Next.js app:

```bash
npm run dev
```

Start the collaboration server:

```bash
npm run ws
```

Start both in one terminal:

```bash
npm run dev:all
```

Run checks:

```bash
npm run lint
npm run build
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js dev server. |
| `npm run ws` | Start `server/websocket.ts` with `tsx`. |
| `npm run dev:all` | Run app and WebSocket server together with `concurrently`. |
| `npm run build` | Build the Next.js app. |
| `npm run start` | Start the production Next.js server. |
| `npm run lint` | Run ESLint. |
| `npm run reddit:drafts` | Generate review-ready Reddit post drafts for Mint Web problem statements. |

Additional standalone scripts:

- `scripts/seed-crm.js`
- `scripts/seed-crm-full.js`
- `scripts/reddit-post-drafts.js`
- root-level seed/test utilities such as `db_seed_*.js`, `test-db.js`, and `test-api.js`.

## Environment Variables

| Variable | Used by | Notes |
| --- | --- | --- |
| `DB_PROXY_URL` | `lib/db.ts`, `proxy.ts`, `server/websocket.ts` | SQL bridge endpoint. Allowed hosts are `api.mintit.pro`, `localhost`, and `127.0.0.1`. |
| `REDIS_URL` | `lib/cache.ts`, `server/websocket.ts` | Session cache, rate-limit fallback support, Socket.IO adapter/presence. |
| `NEXT_PUBLIC_APP_URL` | API routes, conversion builders, WebSocket validation | Base app URL, usually `http://localhost:3000`. |
| `NEXT_PUBLIC_WEBSOCKET_URL` | collaboration hooks | Browser URL for Socket.IO collaboration. |
| `NEXT_PUBLIC_WS_URL` | preview route | Preview/runtime WebSocket URL. |
| `SESSION_SECRET` | `lib/auth.ts` | Used for project sync token derivation. |
| `JWT_SECRET` | `lib/auth.ts` | Fallback secret for project sync token derivation. |
| `RESEND_API_KEY` | `lib/email.ts` | Enables waitlist confirmation emails through Resend. |
| `WAITLIST_EMAIL_FROM` | `lib/email.ts` | Sender address for waitlist confirmation emails. Defaults to `Mint Web <waitlist@mintit.pro>`. |
| `CONVERT_CONCURRENCY` | `lib/convertWorker.ts` | Conversion worker concurrency. |
| `WEBSOCKET_PORT` | `server/websocket.ts` | Socket.IO server port; defaults to `3002`. |
| `WS_MAX_ROOM_SIZE` | `server/websocket.ts` | Max users per collaboration room; defaults to `50`. |
| `MINT_AUTH_TOKEN` | generated live sync files | Used by exported live-sync clients. |
| `NODE_ENV` | auth/db/Next config | Enables production-specific cookie and DB bridge checks. |

Example `.env.local`:

```bash
DB_PROXY_URL=https://api.mintit.pro/api/mint-db
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_WEBSOCKET_URL=http://localhost:3002
NEXT_PUBLIC_WS_URL=http://localhost:3002
SESSION_SECRET=dev-secret
JWT_SECRET=dev-secret
RESEND_API_KEY=
WAITLIST_EMAIL_FROM=Mint Web <waitlist@mintit.pro>
CONVERT_CONCURRENCY=2
WEBSOCKET_PORT=3002
```

## Database Bridge

The app's `db` helper posts SQL to a bridge endpoint:

```json
{
  "text": "SELECT * FROM projects WHERE id = $1",
  "params": ["project-id"]
}
```

This means local development needs a compatible bridge service if you want authenticated routes, projects, files, commits, comments, or admin pages to work. The default bridge is `https://api.mintit.pro/api/mint-db`.

For a local database, run a compatible bridge service on `localhost` or `127.0.0.1` and set `DB_PROXY_URL` to that bridge URL. The repository does not currently define a local `/api/mint-db` route.

`lib/db.ts` initializes core tables at import time. If the bridge is unavailable, many routes will fail with internal DB errors.

## Redis

Redis is used for:

- Session validation cache.
- General cache helpers.
- Rate-limit fallback coordination.
- Socket.IO Redis adapter.
- Collaboration presence.

The app can tolerate Redis being unavailable in some places, but collaboration scaling and cache performance will be reduced. For local development:

```bash
redis-server
```

or use Docker:

```bash
docker run --rm -p 6379:6379 redis:7-alpine
```

## Waitlist Confirmation Email

`/api/signup` sends a non-blocking confirmation email after a user successfully joins the waitlist. The request still succeeds if email delivery fails.

Email delivery uses the Resend HTTP API directly, so no extra npm package is required. Configure:

```bash
RESEND_API_KEY=re_xxx
WAITLIST_EMAIL_FROM="Mint Web <waitlist@mintit.pro>"
NEXT_PUBLIC_APP_URL=https://mintweb.mintit.pro
```

If `RESEND_API_KEY` is missing, the email helper logs a warning and skips sending.

## Migrations And Seeds

SQL migrations live in `migrations/`:

- `001_collaboration.sql`
- `002_penpot_schema.sql`
- `003_create_sessions_table.sql`
- `004_indexes_and_schema.sql`
- `005_audit_log.sql`

There is no single migration CLI declared in `package.json`. Apply migrations through your DB bridge/admin tooling or the project-specific migration endpoint where appropriate.

Seed utilities:

- `scripts/seed-crm.js`
- `scripts/seed-crm-full.js`
- `/api/seed-crm`
- root-level `db_seed_*.js` scripts for local/demo data experiments.

## Working With The Editor

Useful entry points:

- `app/projects/[id]/page.tsx` loads project/file data and mounts the editor.
- `components/PenpotEditor.tsx` is the main editor surface.
- `lib/editorStore.ts` holds editor UI/document state.
- `lib/penpot/types.ts`, `lib/penpot/store.ts`, `lib/penpot/changes.ts`, and `lib/penpot/repo.ts` define Penpot-style document behavior.
- `components/PrototypeViewer.tsx` and `lib/penpot/prototypeEngine.ts` cover preview behavior.

When debugging file persistence, inspect `/api/files` and `/api/files/changes` first.

## Working With Runtime Schemas

Runtime schema entry points:

- `lib/runtime/schema.ts`
- `lib/runtime/actions.ts`
- `lib/runtime/state.ts`
- `lib/runtime/expressions.ts`
- `lib/runtime/workflow.ts`
- `app/api/runtime-schema/[projectId]/route.ts`

Runtime schema is used by the editor/backend panel, conversion pipeline, design-data APIs, and generated runtime-driven clients.

## Working With Conversion

Conversion entry points:

- `app/api/convert/route.ts`
- `app/api/commit/route.ts`
- `lib/convert/index.ts`
- `lib/convert/builders/*`
- `lib/convert/core/*`
- `lib/convertWorker.ts`

Use `/api/convert` for direct ZIP generation. Use `/api/commit` when changes should become a versioned project commit for sync and history.

## Troubleshooting

- `Unauthorized`: confirm the `token` cookie exists and is valid in the `sessions` table.
- `Forbidden` on admin routes: confirm the user has `role = 'admin'`.
- Approved users redirected to waitlist: check `users.approved` and proxy logic.
- DB errors: confirm `DB_PROXY_URL` is reachable and uses an allowed hostname.
- Redis warnings: confirm `REDIS_URL` and Redis availability; local-only fallback may still work.
- Collaboration does not connect: confirm `npm run ws`, WebSocket URL env vars, CORS origin, token validation, and project access.
- Conversion fails: check target framework, non-empty nodes, image downloads, and `CONVERT_CONCURRENCY` queue pressure.
- Live sync shows stale data: inspect latest `/api/commit`, `/api/sync/[projectId]`, and `/api/design-data/[projectId]` responses.

## Documentation Maintenance

When adding features:

- Update [FEATURES.md](FEATURES.md) for product behavior.
- Update [API_REFERENCE.md](API_REFERENCE.md) for route contract changes.
- Update [ARCHITECTURE.md](ARCHITECTURE.md) for new subsystems or data flows.
- Update this guide for setup, scripts, env vars, migrations, or troubleshooting changes.
