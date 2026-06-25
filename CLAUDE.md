# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available gstack skills:
/office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review, /design-consultation, /design-shotgun, /design-html, /review, /ship, /land-and-deploy, /canary, /benchmark, /browse, /connect-chrome, /qa, /qa-only, /design-review, /setup-browser-cookies, /setup-deploy, /setup-gbrain, /retro, /investigate, /document-release, /document-generate, /codex, /cso, /autoplan, /plan-devex-review, /devex-review, /careful, /freeze, /guard, /unfreeze, /gstack-upgrade, /learn

## gstack (REQUIRED — global install)

**Before doing ANY work, verify gstack is installed:**

```bash
test -d ~/.claude/skills/gstack/bin && echo "GSTACK_OK" || echo "GSTACK_MISSING"
```

If GSTACK_MISSING: STOP. Do not proceed. Tell the user:

> gstack is required for all AI-assisted work in this repo.
> Install it:
> ```bash
> git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
> cd ~/.claude/skills/gstack && ./setup --team
> ```
> Then restart your AI coding tool.

Do not skip skills, ignore gstack errors, or work around missing gstack.

Using gstack skills: After install, skills like /qa, /ship, /review, /investigate,
and /browse are available. Use /browse for all web browsing.
Use ~/.claude/skills/gstack/... for gstack file paths (the global path).

# Commands

```bash
npm install          # install deps
npm run dev          # Next.js dev server (port 3000)
npm run ws           # standalone Socket.IO collaboration server (port 3002)
npm run dev:all      # both servers together via concurrently
npm run build        # production build
npm run lint         # ESLint
```

There is no test runner declared in `package.json`. Use `npm run lint` and `npm run build` to validate changes. **Known gap:** no automated tests exist — manually verify auth, conversion pipeline, and DB-bridge paths before shipping security-sensitive changes.

# Environment

Copy these into `.env.local` for local development:

```bash
DB_PROXY_URL=https://api.mintit.pro/api/mint-db   # or localhost bridge
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_WEBSOCKET_URL=http://localhost:3002
NEXT_PUBLIC_WS_URL=http://localhost:3002
SESSION_SECRET=dev-secret
JWT_SECRET=dev-secret
CONVERT_CONCURRENCY=2
WEBSOCKET_PORT=3002
```

`lib/db.ts` never opens a direct `pg` connection. It posts `{ text, params }` JSON to `DB_PROXY_URL`. Only `api.mintit.pro`, `localhost`, and `127.0.0.1` are allowed as bridge hosts — this is enforced at runtime.

Redis is optional locally but required for collaboration scaling, session cache, and Socket.IO pub-sub.

# Architecture

Mint Web is a **runtime-driven visual application builder**: users design on a Penpot-style canvas, wire up state/actions/workflows, model a backend/database, then export to React/Next.js/Vue/Svelte/React Native/Flutter/HTML.

## System shape

```
Browser (React + Zustand)
  └─ Next.js App Router  (app/)
       ├─ API routes: auth, projects, files, runtime, convert, sync
       └─ DB bridge (lib/db.ts) → PostgreSQL via HTTP proxy

Socket.IO server  (server/websocket.ts)
  └─ Redis adapter/presence (optional)
```

## Key subsystems

### Editor & canvas
- `app/projects/[id]/page.tsx` — loads project/file and mounts the editor
- `components/PenpotEditor.tsx` — top-level editor surface
- `lib/editorStore.ts` — primary Zustand store (document + UI state)
- `lib/penpot/` — Penpot-style document types, store, changes, geometry, snapping, layout, prototype engine
- `lib/canvasEngine.ts`, `lib/canvasRenderer.ts`, `lib/webglRenderer.ts`, `lib/vectorEngine.ts` — rendering stack
- `components/penpot/` — shape renderers

### Runtime layer
The runtime is the schema contract between the editor and generated apps. All modules live in `lib/runtime/`:
- `schema.ts` — app/screen/component/state/action/workflow/auth/database schemas
- `state.ts`, `expressions.ts`, `actions.ts`, `bindings.ts`, `workflow.ts` — evaluation engine
- `dependency-graph.ts`, `validator.ts`, `database.ts`, `bundle.ts` — supporting runtime behavior

Runtime schema CRUD lives at `/api/runtime-schema/[projectId]`; public endpoints (`/api/design-data`, `/api/project-data`, `/api/mobile-config`, `/api/sync`) serve preview/mobile clients.

### Conversion pipeline
`lib/convert/index.ts` exports `convertDesign()` — the entry point for design-to-code. Flow:
1. Build drawable tree from design nodes + runtime schema
2. Apply UX enhancements, collect/remap images, filter interactions
3. Delegate to a framework builder (`lib/convert/builders/*`)
4. Return generated files or a ZIP

`/api/convert` returns a ZIP directly. `/api/commit` runs conversion, versions the output in `project_commits`, and records diff against the previous version.

Concurrency is capped by `CONVERT_CONCURRENCY` through `lib/convertWorker.ts`.

### Auth & route protection
- `lib/auth.ts` — scrypt hashing, timing-safe verify, session rows, Redis session cache
- `proxy.ts` — middleware protecting `/projects`, `/admin`, and most `/api/*` routes
- Public exceptions: token validation, mobile config, design data, sync, community projects, login, signup

### Collaboration
`server/websocket.ts` is a **standalone** Socket.IO process (not a Next.js API route). It validates session tokens (Redis → `/api/validate-token` fallback), checks project access via the DB bridge, and broadcasts cursor/selection/file-change events to file rooms.

### Database & migrations
SQL migrations are in `migrations/001–005`. There is no migration CLI; apply them through your DB bridge/admin tooling. `lib/db.ts` auto-initializes core tables at module import.

## Important cross-cutting notes
- The worktree may contain generated/experimental files — treat unrecognized files as user-owned before modifying.
- Design tokens live in `design-tokens.json` at the root.
- `components/studio/` and `components/runtime/` hold editor panel and runtime preview components respectively.
- `hooks/` contains collaboration hooks used by the editor file session.
- `docs/` has deeper references: ARCHITECTURE.md, API_REFERENCE.md, FEATURES.md, DEVELOPMENT.md, CONVERSION_ARCHITECTURE.md.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
