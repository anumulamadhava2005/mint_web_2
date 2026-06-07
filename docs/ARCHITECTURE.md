# Mint Web Architecture

Mint Web is a Next.js App Router application with a schema-driven editor/runtime core, DB-backed project persistence, multi-framework code generation, and a separate Socket.IO collaboration service.

## System Shape

```text
Client
  |
  | React pages, editor components, Zustand stores, collaboration hooks
  v
Next.js app
  |
  | API routes: auth, projects, files, runtime data, conversion, sync
  v
DB bridge
  |
  | SQL JSON payloads
  v
PostgreSQL

Socket.IO server
  |
  | file rooms, presence, cursor/selection, file-change broadcast
  v
Redis adapter/cache when available
```

The browser talks to the Next.js app for normal product actions and to the Socket.IO server for real-time file sessions. The Next.js backend uses `lib/db.ts`, which posts SQL to a DB bridge URL instead of opening a direct local `pg` pool.

## Frontend Layers

- App shell and routes live in `app/`.
- Product surfaces are mostly client components: marketing, auth forms, projects dashboard, admin, profile, editor, and preview.
- Shared UI lives in `components/`, including `Button`, `Card`, `TextInput`, dashboard content, dialogs, canvas/editor components, and prototype viewers.
- Editor state is centralized through `lib/editorStore.ts` and supporting modules such as `lib/editorState.ts`, `lib/interactionStateMachine.ts`, `lib/commandHistory.ts`, and selection/layout solvers.

## Editor And Canvas

The project editor route loads project metadata, fetches or creates a file, and mounts `components/PenpotEditor.tsx`. The editor combines:

- Penpot-style document/file concepts in `lib/penpot/*`.
- Shape renderers in `components/penpot/*`.
- Layout systems in `lib/penpot/layout/*`, including flex, grid, auto-sizing, group resize, and constraints.
- Canvas/rendering engines in `lib/canvasEngine.ts`, `lib/canvasRenderer.ts`, `lib/webglRenderer.ts`, `lib/vectorEngine.ts`, and related geometry utilities.
- Prototype behavior in `components/PrototypeViewer.tsx` and `lib/penpot/prototypeEngine.ts`.

Files and changes are persisted through `/api/files` and `/api/files/changes`, with revision metadata stored in `files` and `file_changes`.

## Runtime Layer

The runtime is the contract between the editor and generated/running apps. Core modules under `lib/runtime/` define:

- `schema.ts`: app, screen, component, style, state, action, workflow, navigation, auth, and database schemas.
- `state.ts`: runtime state engine and evaluation context.
- `expressions.ts`: expression parsing/evaluation for bindings and action configs.
- `actions.ts`: action registry, middleware, conditional execution, debounce/throttle, and platform adapters.
- `bindings.ts`, `workflow.ts`, `dependency-graph.ts`, `validator.ts`, `database.ts`, and `bundle.ts`: support for dynamic app behavior and runtime delivery.

Runtime schemas are saved and loaded through `/api/runtime-schema/[projectId]`. Public runtime data endpoints such as `/api/design-data/[projectId]`, `/api/project-data/[projectId]`, `/api/mobile-config`, and `/api/sync/[projectId]` support preview and live client updates.

## Conversion Pipeline

The design-to-code system lives under `lib/convert/`.

```text
Design nodes + runtime schema + interactions
  |
  v
convertDesign()
  |
  | build drawable tree
  | apply UX enhancements
  | collect/process/remap images
  | filter interactions
  v
framework builder
  |
  v
generated project files or ZIP response
```

Important modules:

- `lib/convert/index.ts`: main `convertDesign()` entry point.
- `lib/convert/types.ts`: conversion request/result and design node types.
- `lib/convert/core/*`: tree, rendering, style, routing, transitions, overlays, images, and Mint runtime helpers.
- `lib/convert/builders/*`: React, Next.js, Vue, Svelte, React Native, Flutter, and builder registry.
- `lib/convert/liveSyncFiles.ts`: optional sync client files and package patching.
- `lib/convertWorker.ts`: concurrency-limited worker queue used by commits.

`/api/convert` validates a conversion request and returns a generated ZIP. `/api/commit` runs conversion, stores generated text files in `project_commits`, computes changed files against the previous version, and keeps design data for runtime/sync consumers.

## Backend And Data

`lib/db.ts` validates `DB_PROXY_URL` and uses `fetch()` to post `{ text, params }` SQL payloads to the bridge. It also initializes many core tables when imported, including users, projects, teams, files, file changes, comments, runtime schemas, commits, database metadata, and audit-related tables.

Database evolution also exists in `migrations/`:

- `001_collaboration.sql`
- `002_penpot_schema.sql`
- `003_create_sessions_table.sql`
- `004_indexes_and_schema.sql`
- `005_audit_log.sql`

Auth lives in `lib/auth.ts` and uses scrypt password hashing, timing-safe verification, session rows, and Redis session cache writes when available.

## Route Protection

`proxy.ts` protects:

- `/projects` and nested routes.
- `/admin` and `/api/admin`.
- Most `/api/*` routes.

Public API exceptions include token validation, mobile config, design data, sync, project data, community projects, login, and signup. Product routes require a valid session; protected page access also checks user approval unless the user is an admin.

## Collaboration

`server/websocket.ts` is a standalone Socket.IO server. It supports:

- File subscription/unsubscription.
- Session token validation, first through Redis session cache, then through `/api/validate-token`.
- Project read/edit access checks through the DB bridge.
- Presence storage in Redis when connected.
- Cursor/selection/viewport broadcasts.
- File changes, config updates, and code update events.
- Subscribe rate limits and max room size control.

Redis is optional for local development, but without it the server runs without the Redis adapter and some presence/cache behavior is local-only.

## Deployment Topology

`docker-compose.yml` describes a horizontally scaled deployment:

- Nginx reverse proxy.
- Three Next.js web containers.
- One WebSocket container.
- Redis.
- PostgreSQL.

Before deploying from compose, verify the referenced `Dockerfile`, `Dockerfile.ws`, `nginx.conf`, and cert assets exist in the deployment context.
