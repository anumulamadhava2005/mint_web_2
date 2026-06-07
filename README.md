# Mint Web

Mint Web is a runtime-driven visual application builder. It combines a Penpot-style design canvas, schema-based application runtime, backend/data tooling, prototype preview, real-time collaboration, and multi-framework code export in a Next.js app.

At a high level, the editor produces design and runtime schemas. The server persists project/file state, generated commits, database metadata, and collaboration history. Export builders turn the same source data into runnable React, Next.js, Vue, Svelte, React Native, Flutter, or HTML projects.

## Documentation

This README is the entry point for developers. The detailed references live in `docs/`:

- [Architecture](docs/ARCHITECTURE.md) - system shape, module boundaries, and data flow.
- [Features](docs/FEATURES.md) - product and editor feature catalog.
- [API Reference](docs/API_REFERENCE.md) - route-by-route backend summary.
- [Development](docs/DEVELOPMENT.md) - local setup, scripts, environment, and troubleshooting.
- [Conversion Architecture](docs/CONVERSION_ARCHITECTURE.md) - deeper design-to-code conversion reference.
- [User Guide](docs/USER_GUIDE.md) - user-facing walkthrough.
- [Actions Config Guide](docs/ACTIONS_CONFIG_GUIDE.md) - action/runtime configuration guide.

## Product Surface

Mint Web currently includes:

- Marketing and waitlist pages under `/home`, `/signup`, `/login`, and `/waitlist-success`.
- Authenticated projects dashboard at `/projects`.
- Project editor at `/projects/[id]`, backed by `PenpotEditor`, editor state stores, file persistence, comments, preview, and collaboration.
- Project settings, profile, community/public projects, and an admin user approval portal.
- Prototype and mobile/runtime preview routes through `/preview/[projectId]` and public runtime-data APIs.
- Backend panel concepts for state, actions, workflows, database config, and runtime schemas.
- Conversion/export APIs that generate code for multiple frameworks and can store versioned commits for sync.

## Quick Start

### Prerequisites

- Node.js compatible with Next.js 16 and React 19.
- npm, using the checked-in `package-lock.json`.
- Redis for session/cache/collaboration features when running the full stack.
- Access to a Mint DB bridge endpoint, or a local compatible endpoint set through `DB_PROXY_URL`.

### Install

```bash
npm install
```

### Environment

Create a local `.env` file as needed. Common variables:

```bash
DB_PROXY_URL=https://api.mintit.pro/api/mint-db
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_WEBSOCKET_URL=http://localhost:3002
NEXT_PUBLIC_WS_URL=http://localhost:3002
SESSION_SECRET=replace-me
JWT_SECRET=replace-me
CONVERT_CONCURRENCY=2
WEBSOCKET_PORT=3002
WS_MAX_ROOM_SIZE=50
```

Important: `lib/db.ts` does not open a direct `pg` connection. It sends SQL through `DB_PROXY_URL`, defaulting to `https://api.mintit.pro/api/mint-db`, and only allows `api.mintit.pro`, `localhost`, or `127.0.0.1` as DB bridge hosts. For local database work, run or point to a compatible bridge on `localhost` or `127.0.0.1`.

### Run

```bash
npm run dev
```

Run the collaboration server separately:

```bash
npm run ws
```

Or start both:

```bash
npm run dev:all
```

The app starts at [http://localhost:3000](http://localhost:3000). The Socket.IO collaboration server defaults to port `3002`.

### Validate

```bash
npm run lint
npm run build
```

## Application Map

Main routes:

- `/` redirects to `/home`.
- `/home` is the public marketing page.
- `/docs` is the in-app product documentation page.
- `/signup`, `/login`, `/logout`, `/waitlist-success` cover account access and approval flow.
- `/projects` lists recent and community projects.
- `/projects/[id]` opens the editor and prototype viewer overlay.
- `/projects/[id]/settings` edits project publication/settings.
- `/preview/[projectId]` renders a project preview/runtime view.
- `/profile` and `/admin` handle account and admin workflows.

Main API groups:

- Auth/profile: `/api/signup`, `/api/login`, `/api/logout`, `/api/validate-token`, `/api/profile`, `/api/onboarding`.
- Projects/files: `/api/projects`, `/api/projects/[id]`, `/api/projects/community`, `/api/projects/[id]/settings`, `/api/projects/[id]/publish`, `/api/files`, `/api/files/changes`.
- Runtime/data: `/api/runtime-schema/[projectId]`, `/api/design-data/[projectId]`, `/api/project-data/[projectId]`, `/api/mobile-config`, `/api/viewer`.
- Backend/database: `/api/db/[projectId]`, `/api/db/migrate/[projectId]`, `/api/projects/[id]/dashboard`.
- Export/sync: `/api/convert`, `/api/commit`, `/api/sync/[projectId]`.
- Collaboration/comments: `/api/comments` plus the Socket.IO server in `server/websocket.ts`.
- Admin/tools: `/api/admin/users`, `/api/seed-crm`.

## Architecture Overview

```text
Browser UI
  |
  | Next.js App Router pages and React components
  v
Editor and runtime state
  |-- components/PenpotEditor.tsx
  |-- lib/editorStore.ts
  |-- lib/runtime/*
  |-- lib/penpot/*
  |
  | HTTP
  v
Next.js API routes
  |-- auth, projects, files, comments
  |-- runtime schema and design data
  |-- conversion, commit, sync
  |
  | SQL over DB bridge
  v
DB proxy / PostgreSQL

Socket.IO collaboration server
  |-- server/websocket.ts
  |-- optional Redis adapter
  v
Other connected editor clients
```

The editor side is schema-oriented. Visual files store Penpot-style document data and file changes. Runtime modules define app schemas, state, expressions, actions, bindings, workflows, dependency graphs, and database abstractions. Conversion modules normalize design nodes into drawable trees, apply UX enhancements, collect assets, and delegate to framework-specific builders.

For the deeper subsystem breakdown, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Key Directories

- `app/` - Next.js App Router pages, layouts, proxy-protected routes, and API handlers.
- `components/` - UI primitives, dashboard content, editor panels, canvas/prototype components, and Penpot renderers.
- `hooks/` - collaboration hooks for editor/file sessions.
- `lib/runtime/` - schema, expression, state, action, binding, workflow, validation, database, and bundle logic.
- `lib/convert/` - design-to-code conversion pipeline and framework builders.
- `lib/penpot/` - Penpot-inspired document types, repository helpers, changes, geometry, snapping, prototyping, and layout.
- `lib/` - editor store, canvas/rendering engines, layout/constraint utilities, auth, cache, DB bridge, and config generation.
- `server/` - standalone Socket.IO collaboration server.
- `migrations/` - SQL migrations for collaboration, files, sessions, indexes/schema, and audit logging.
- `scripts/` - CRM seed utilities.
- `docs/` - developer and product documentation.

## Development Notes

- The worktree may contain generated or experimental files. Treat unrelated changes as user-owned.
- `proxy.ts` protects `/projects`, admin pages, and most API routes. Some runtime-data routes are intentionally public for preview/mobile sync.
- `lib/db.ts` initializes core tables at module load through the DB bridge. Missing bridge access will affect most authenticated APIs.
- Redis is optional for some paths but improves session validation, cache behavior, rate limits, and collaboration scaling.
- The conversion worker is concurrency-limited through `CONVERT_CONCURRENCY`; `/api/commit` applies back-pressure when queue depth is high.

## Deployment Shape

`docker-compose.yml` describes a production-oriented shape with:

- Nginx reverse proxy.
- Three Next.js web instances.
- One standalone WebSocket service.
- Redis for cache/pub-sub.
- PostgreSQL.

The repository currently references Dockerfiles and Nginx config expected by that compose file; verify they exist in the target deployment environment before using it directly.
