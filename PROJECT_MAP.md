# Mint Web 2 — Complete Project Dependency Map

> Navigation guide for AI-assisted work. Start at the entry point relevant to your task,
> follow the arrows to find files that need editing. Files listed under each node are **local
> project imports only** (no node_modules).

---

## Entry Points & Routing

```
app/page.tsx                  → redirects to /home (no local imports)
app/layout.tsx
  ├── components/GlobalProgressBar.tsx          (no local imports)
  └── components/runtime/ToastProvider.tsx
        └── components/runtime/ToastRenderer.tsx (no local imports)

proxy.ts (Next.js middleware)  → no local imports (direct DB_BRIDGE_URL fetch)
```

---

## App Routes

### Public / Marketing
```
app/home/page.tsx              → app/M.png (image asset, no ts imports)
app/docs/page.tsx              → app/M.png
app/waitlist-success/page.tsx  → (no local imports)
```

### Auth
```
app/login/page.tsx
  ├── components/TextInput.tsx  (no local imports)
  ├── components/Button.tsx     (no local imports)
  └── components/Card.tsx       (no local imports)

app/login/layout.tsx           → (no local imports, just globals.css)

app/signup/page.tsx            → (no local imports — all inline components)
app/signup/layout.tsx          → (no local imports)
```

### Projects Dashboard
```
app/projects/page.tsx
  ├── components/ProjectsContent.tsx
  │     ├── components/Card.tsx
  │     └── components/NewProjectDialog.tsx
  │           └── components/Button.tsx
  └── components/CommunityContent.tsx  (no local imports)

app/projects/layout.tsx        → (no local imports)
```

### Project Editor (main canvas)
```
app/projects/[id]/page.tsx
  ├── components/PenpotEditor.tsx      ← PRIMARY EDITOR ENTRY
  │     (see PenpotEditor tree below)
  ├── components/PrototypeViewer.tsx
  │     (see PrototypeViewer tree below)
  └── lib/editorStore.ts              (no local imports)

app/projects/[id]/layout.tsx   → (no local imports)
```

### Project Settings
```
app/projects/[id]/settings/page.tsx
  └── components/SchemaVisualizer.tsx  (loaded via next/dynamic, no local imports)
```

### Preview (mobile simulator)
```
app/preview/[projectId]/page.tsx
  ├── components/MobileRenderer.tsx
  │     └── lib/mobileConfig.ts        (no local imports)
  ├── components/SchemaRenderer.tsx    (see SchemaRenderer tree below)
  └── lib/runtime/state.ts             (see runtime tree below)
```

### Admin / Profile
```
app/admin/page.tsx             → app/M.png (no ts imports)
app/profile/page.tsx           → (no local imports)
```

---

## Component Trees

### PenpotEditor.tsx (components/PenpotEditor.tsx)
```
components/PenpotEditor.tsx
  ├── lib/penpot/store.ts              ← workspace Zustand store
  │     ├── lib/penpot/types.ts        ← shape/page/file types (no local imports)
  │     ├── lib/penpot/changes.ts
  │     │     └── lib/penpot/types.ts
  │     ├── lib/penpot/repo.ts
  │     │     ├── lib/penpot/types.ts
  │     │     └── lib/penpot/changes.ts
  │     ├── lib/penpot/geom.ts
  │     │     └── lib/penpot/types.ts
  │     └── lib/penpot/layout/index.ts ← layout barrel
  │           ├── lib/penpot/layout/modifiers.ts  → lib/penpot/types.ts
  │           ├── lib/penpot/layout/constraints.ts → modifiers.ts + types.ts
  │           ├── lib/penpot/layout/flexLayout.ts  → modifiers.ts + constraints.ts + types.ts
  │           ├── lib/penpot/layout/gridLayout.ts  → modifiers.ts + constraints.ts + types.ts
  │           ├── lib/penpot/layout/autoSizing.ts  → modifiers.ts + flexLayout.ts + types.ts
  │           ├── lib/penpot/layout/groupResize.ts → modifiers.ts + types.ts
  │           └── lib/penpot/layout/pipeline.ts    → modifiers.ts + types.ts + flexLayout.ts
  │                                                    + gridLayout.ts + autoSizing.ts
  │                                                    + groupResize.ts + constraints.ts
  ├── lib/editorStore.ts               (no local imports)
  ├── lib/runtime/runtime-store.ts
  │     └── lib/runtime/schema.ts      ← AppSchema types (no local imports)
  ├── components/penpot/SVGViewport.tsx
  │     ├── lib/penpot/store.ts
  │     ├── hooks/usePenpotCollaboration.ts
  │     │     ├── lib/penpot/store.ts
  │     │     ├── lib/penpot/changes.ts
  │     │     └── lib/penpot/types.ts
  │     ├── components/penpot/ShapeRenderers.tsx
  │     │     └── lib/penpot/types.ts
  │     ├── lib/penpot/types.ts
  │     ├── lib/penpot/geom.ts
  │     └── lib/penpot/snapping.ts     → lib/penpot/types.ts
  ├── components/ConvertDialog.tsx
  │     ├── lib/penpot/store.ts
  │     ├── lib/runtime/runtime-store.ts
  │     ├── lib/convert/suggest.ts     → lib/penpot/types.ts + lib/convert/types.ts
  │     ├── lib/convert/types.ts       (no local imports)
  │     └── lib/penpot/types.ts
  ├── components/BackendPanel.tsx      (referenced but not in main tree — see below)
  ├── lib/penpot/types.ts
  └── lib/devicePresets.ts             (no local imports)
```

> **BackendPanel** is the database/schema editor panel. It's imported by PenpotEditor — check
> for it in the worktree if needed; the main branch appears to have it at components/BackendPanel.tsx.

### PrototypeViewer.tsx (components/PrototypeViewer.tsx)
```
components/PrototypeViewer.tsx
  ├── lib/penpot/store.ts
  ├── lib/editorStore.ts
  ├── components/penpot/ShapeRenderers.tsx → lib/penpot/types.ts
  ├── lib/penpot/types.ts
  ├── lib/penpot/geom.ts
  └── lib/penpot/prototypeEngine.ts    → lib/penpot/types.ts
```

### SchemaRenderer.tsx (components/SchemaRenderer.tsx)
```
components/SchemaRenderer.tsx
  ├── lib/runtime/schema.ts
  ├── lib/runtime/state.ts
  │     ├── lib/runtime/dependency-graph.ts (no local imports)
  │     └── lib/runtime/expressions.ts      (no local imports)
  ├── lib/runtime/bindings.ts
  │     ├── lib/runtime/expressions.ts
  │     ├── lib/runtime/state.ts
  │     └── lib/runtime/schema.ts
  └── components/runtime/DataTable.tsx
        └── lib/runtime/components/data-table.ts
              └── lib/runtime/components/configs.ts (no local imports)
```

### CollaborativeCanvas.tsx (legacy/example, not used by main editor)
```
components/CollaborativeCanvas.tsx
  ├── hooks/useCollaboration.ts        (no local imports — uses socket.io-client)
  └── components/CursorOverlay.tsx
        └── hooks/useCollaboration.ts
```

### DashboardSection.tsx
```
components/DashboardSection.tsx
  └── components/SchemaVisualizer.tsx  (via next/dynamic, no local ts imports)
```

---

## API Routes → Library Dependencies

### Auth API
```
app/api/login/route.ts          → lib/auth.ts + lib/db.ts + lib/cache.ts + lib/clientIp.ts
app/api/logout/route.ts         → lib/db.ts + lib/cache.ts
app/api/signup/route.ts         → lib/auth.ts + lib/db.ts + lib/cache.ts + lib/email.ts + lib/clientIp.ts
app/api/otp/send/route.ts       → lib/db.ts + lib/email.ts
app/api/otp/verify/route.ts     → lib/db.ts
app/api/validate-token/route.ts → lib/auth.ts + lib/cache.ts + lib/clientIp.ts
app/api/profile/route.ts        → lib/auth.ts + lib/db.ts
app/api/onboarding/route.ts     → lib/auth.ts + lib/db.ts
```

### Projects & Files API
```
app/api/projects/route.ts              → lib/auth.ts + lib/db.ts
app/api/projects/[id]/route.ts         → lib/auth.ts + lib/db.ts
app/api/projects/[id]/settings/route.ts → lib/auth.ts + lib/db.ts
app/api/projects/[id]/dashboard/route.ts → lib/auth.ts + lib/db.ts
app/api/projects/[id]/publish/route.ts  → lib/auth.ts + lib/db.ts
app/api/projects/community/route.ts     → lib/db.ts
app/api/files/route.ts                  → lib/auth.ts + lib/db.ts
app/api/files/changes/route.ts          → lib/auth.ts + lib/db.ts + lib/cache.ts
app/api/comments/route.ts               → lib/auth.ts + lib/db.ts
app/api/viewer/route.ts                 → lib/auth.ts + lib/db.ts
app/api/upload/route.ts                 → lib/db.ts
```

### Runtime Schema API
```
app/api/runtime-schema/[projectId]/route.ts → lib/auth.ts + lib/db.ts
```

### Conversion & Commit API
```
app/api/convert/route.ts     → lib/convert/index.ts + lib/convert/liveSyncFiles.ts + lib/auth.ts
app/api/commit/route.ts      → lib/auth.ts + lib/db.ts + lib/convertWorker.ts + lib/convert/types.ts
```

### Database / Mobile API
```
app/api/db/[projectId]/route.ts          → lib/db.ts
app/api/db/migrate/[projectId]/route.ts  → lib/auth.ts + lib/db.ts + lib/runtime/database.ts + lib/runtime/schema.ts
app/api/sync/[projectId]/route.ts        → lib/db.ts
app/api/design-data/[projectId]/route.ts → lib/auth.ts + lib/db.ts
app/api/project-data/[projectId]/route.ts → lib/auth.ts + lib/db.ts
app/api/mobile-config/route.ts           → lib/db.ts
```

### Admin API
```
app/api/admin/projects/route.ts → lib/auth.ts + lib/db.ts
app/api/admin/users/route.ts    → lib/auth.ts + lib/db.ts
app/api/seed-crm/route.ts       → lib/db.ts
```

---

## Library Module Dependency Graph

### lib/auth.ts
```
lib/auth.ts → lib/db.ts + lib/cache.ts
```

### lib/db.ts
```
lib/db.ts → (no local imports — HTTP proxy to DB_PROXY_URL)
```

### lib/cache.ts
```
lib/cache.ts → (no local imports — wraps redis client)
```

### lib/email.ts
```
lib/email.ts → (no local imports — HTTP to resend API)
```

### lib/clientIp.ts
```
lib/clientIp.ts → (no local imports)
```

### lib/metrics.ts
```
lib/metrics.ts → (no local imports)
```

### lib/convertWorker.ts
```
lib/convertWorker.ts → (no local imports — spawns worker_thread running lib/convert/index.ts)
```

### lib/mobileConfig.ts
```
lib/mobileConfig.ts → (no local imports — type definitions only)
```

### lib/configGenerator.ts
```
lib/configGenerator.ts
  ├── lib/penpot/types.ts
  └── lib/mobileConfig.ts
```

### lib/devicePresets.ts
```
lib/devicePresets.ts → (no local imports)
```

### lib/editorStore.ts
```
lib/editorStore.ts → (no local imports)
```

### lib/editorState.ts
```
lib/editorState.ts → lib/canvasEngine.ts
```

### lib/canvasEngine.ts
```
lib/canvasEngine.ts → lib/matrix3.ts  (no other local imports)
```

### lib/canvasRenderer.ts
```
lib/canvasRenderer.ts → (no local imports — standalone Canvas2D renderer)
```

### lib/webglRenderer.ts
```
lib/webglRenderer.ts → (no local imports — standalone WebGL renderer)
```

### lib/vectorEngine.ts
```
lib/vectorEngine.ts → (no local imports)
```

### lib/matrix3.ts
```
lib/matrix3.ts → (no local imports)
```

### lib/quadTree.ts
```
lib/quadTree.ts → (no local imports)
```

### lib/autoLayoutEngine.ts
```
lib/autoLayoutEngine.ts → (no local imports — standalone flex algorithm)
```

### lib/commandHistory.ts
```
lib/commandHistory.ts → lib/canvasEngine.ts
```

### lib/interactionStateMachine.ts
```
lib/interactionStateMachine.ts → (no local imports)
```

### lib/multiSelectionSolver.ts
```
lib/multiSelectionSolver.ts → (no local imports)
```

### lib/constraintSolver.ts
```
lib/constraintSolver.ts → (no local imports)
```

### lib/floatingOrigin.ts
```
lib/floatingOrigin.ts → (no local imports)
```

### lib/crdtSync.ts
```
lib/crdtSync.ts → (no local imports — standalone CRDT implementation)
```

---

## lib/penpot/ Module Tree

```
lib/penpot/
  types.ts          ← base, no local imports (UUID, PenpotShape, Page, PenpotFile, etc.)
  geom.ts           → types.ts
  snapping.ts       → types.ts
  changes.ts        → types.ts
  repo.ts           → types.ts + changes.ts
  prototypeEngine.ts → types.ts
  store.ts          → types.ts + changes.ts + repo.ts + geom.ts + layout/index.ts

  layout/
    modifiers.ts    → types.ts
    constraints.ts  → types.ts + modifiers.ts
    flexLayout.ts   → types.ts + modifiers.ts + constraints.ts
    gridLayout.ts   → types.ts + modifiers.ts + constraints.ts
    autoSizing.ts   → types.ts + modifiers.ts + flexLayout.ts
    groupResize.ts  → types.ts + modifiers.ts
    pipeline.ts     → types.ts + modifiers.ts + flexLayout.ts + gridLayout.ts
                       + autoSizing.ts + groupResize.ts + constraints.ts
    index.ts        → re-exports all above (barrel)
```

---

## lib/runtime/ Module Tree

```
lib/runtime/
  schema.ts           ← base, no local imports (AppSchema, ScreenSchema, ComponentSchema, etc.)
  expressions.ts      ← no local imports (tokenizer + AST evaluator)
  dependency-graph.ts ← no local imports
  state.ts            → dependency-graph.ts + expressions.ts
  bindings.ts         → expressions.ts + state.ts + schema.ts
  actions.ts          → schema.ts + expressions.ts + state.ts
  workflow.ts         → schema.ts + expressions.ts + state.ts + actions.ts
  auth-guard.ts       → schema.ts + state.ts
  database.ts         → schema.ts
  validator.ts        → schema.ts
  bundle.ts           → (no local imports — generates bundled JS string for exported apps)
  runtime-store.ts    → schema.ts
  index.ts            → re-exports all above (barrel)

  components/
    configs.ts          ← no local imports (DataTableConfig, TimelineConfig, etc.)
    data-table.ts       → configs.ts
    timeline.ts         → configs.ts
    pipeline-editor.ts  → schema.ts (WorkflowSchema, WorkflowNode, WorkflowEdge)
    index.ts            → re-exports all above (barrel)
```

---

## lib/convert/ Module Tree

```
lib/convert/
  types.ts            ← no local imports (DesignNode, DrawableNode, TargetFramework, etc.)
  liveSyncFiles.ts    → types.ts
  suggest.ts          → lib/penpot/types.ts + types.ts
  buildDesignPayload.ts → lib/penpot/types.ts
  index.ts            → types.ts + liveSyncFiles.ts + core/tree.ts + core/images.ts
                         + builders/index.ts + builders/reactNativeSchema.ts

  core/
    tree.ts        → types.ts
    styles.ts      → types.ts
    images.ts      → types.ts
    render.ts      → types.ts + styles.ts + transitions.ts
    routing.ts     → types.ts
    transitions.ts → types.ts
    overlays.ts    → types.ts
    mintRuntime.ts → types.ts
    index.ts       → re-exports tree + styles + images + render

  builders/
    react.ts          → types.ts + lib/runtime/bundle.ts + core/render.ts + core/images.ts + core/routing.ts
    nextjs (next.ts)  → types.ts + core/* (similar to react.ts)
    vue.ts            → types.ts + core/*
    svelte.ts         → types.ts + core/*
    reactNative.ts    → types.ts + assets/mintIcons.ts + core/*
    flutter.ts        → types.ts + core/*
    reactNativeSchema.ts → lib/runtime/schema.ts
    index.ts          → re-exports all builders

  assets/
    mintIcons.ts      ← no local imports (base64-encoded PNG assets)
```

---

## Server Process

```
server/websocket.ts  → (no local imports — standalone Socket.IO process)
                        Validates sessions via HTTP: /api/validate-token
                        Checks project access via DB bridge (direct HTTP fetch)
                        Redis adapter for pub/sub
```

---

## Hooks

```
hooks/useCollaboration.ts        → (no local imports — uses socket.io-client)
hooks/usePenpotCollaboration.ts  → lib/penpot/store.ts + lib/penpot/changes.ts + lib/penpot/types.ts
```

---

## Standalone Components (no local imports)

```
components/Button.tsx
components/Card.tsx
components/TextInput.tsx
components/GlobalProgressBar.tsx
components/runtime/ToastRenderer.tsx
components/penpot/ShapeRenderers.tsx  → lib/penpot/types.ts only
components/SchemaVisualizer.tsx       → (no local ts imports, standalone ERD canvas)
components/DesignCanvas.tsx           → (no local imports, standalone Canvas2D demo)
components/FigmaCanvas.tsx            → (no local imports, standalone Canvas2D demo)
components/studio/CommandPalette.tsx  → (no local imports)
components/studio/primitives.tsx      → (no local imports)
```

---

## Cross-Cutting Data Flow

### Design → Code export path
```
User clicks Convert/Commit
  → app/projects/[id]/page.tsx
  → components/PenpotEditor.tsx (handleCommit / ConvertDialog)
  → lib/penpot/store.ts (reads current file/page state)
  → lib/convert/buildDesignPayload.ts (shapes → DesignNode[])
  → POST /api/convert OR /api/commit
  → app/api/convert/route.ts OR app/api/commit/route.ts
  → lib/convertWorker.ts (worker thread)
  → lib/convert/index.ts (convertDesign)
       → lib/convert/core/tree.ts (buildDrawableTree)
       → lib/convert/core/images.ts
       → lib/convert/builders/{framework}.ts
       → lib/convert/liveSyncFiles.ts
  → ZIP returned to client
```

### Auth flow
```
POST /api/signup → lib/auth.ts (createUser) → lib/db.ts → lib/email.ts (welcome)
POST /api/login  → lib/auth.ts (findUser + verifyPassword + issueToken) → lib/db.ts + lib/cache.ts
All protected routes → proxy.ts (reads cookie) → lib/auth.ts (findUserByToken) → lib/db.ts
```

### Collaboration flow
```
Browser opens editor
  → components/penpot/SVGViewport.tsx
  → hooks/usePenpotCollaboration.ts
  → socket.io connects to server/websocket.ts (port 3002)
  → server validates token via /api/validate-token
  → joins file room, broadcasts cursor/change events
  → client receives changes → lib/penpot/store.ts (applyChanges)
  → POST /api/files/changes → lib/db.ts (persists revisions)
```

### Runtime schema persist flow
```
components/studio/StateManager.tsx (or other studio panels)
  → lib/runtime/runtime-store.ts (Zustand mutations)
  → POST /api/runtime-schema/[projectId]
  → lib/db.ts (saves to project_runtime_schemas table)
```

---

## File Count Reference

| Subsystem              | Files |
|------------------------|-------|
| app/ routes (pages)    | 12    |
| app/ API routes        | 28    |
| components/            | 28    |
| lib/penpot/            | 11    |
| lib/runtime/           | 13    |
| lib/convert/           | 18    |
| lib/ (root)            | 22    |
| hooks/                 | 2     |
| server/                | 1     |
| proxy.ts               | 1     |
| **Total project files**| **136** |

---

## Quick Navigation Index

| Task | Start here |
|------|-----------|
| Canvas rendering bug | `components/penpot/SVGViewport.tsx` → `lib/penpot/store.ts` → `lib/penpot/types.ts` |
| Shape/layout logic   | `lib/penpot/layout/pipeline.ts` (orchestrates all layout passes) |
| Code export bug      | `lib/convert/index.ts` → `lib/convert/core/tree.ts` + relevant builder |
| Auth bug             | `lib/auth.ts` + `proxy.ts` + relevant API route |
| Runtime state/bindings | `lib/runtime/state.ts` → `lib/runtime/bindings.ts` → `lib/runtime/expressions.ts` |
| Collaboration sync   | `hooks/usePenpotCollaboration.ts` → `server/websocket.ts` → `app/api/files/changes/route.ts` |
| Database schema      | `lib/runtime/database.ts` → `app/api/db/migrate/[projectId]/route.ts` |
| Toast notifications  | `components/runtime/ToastProvider.tsx` → `components/runtime/ToastRenderer.tsx` |
| Mobile preview       | `app/preview/[projectId]/page.tsx` → `components/MobileRenderer.tsx` → `lib/mobileConfig.ts` |
| Project dashboard    | `app/projects/page.tsx` → `components/ProjectsContent.tsx` → `components/NewProjectDialog.tsx` |
| Signup flow          | `app/signup/page.tsx` → `app/api/otp/send/route.ts` → `app/api/otp/verify/route.ts` → `app/api/signup/route.ts` |
| Admin panel          | `app/admin/page.tsx` → `app/api/admin/projects/route.ts` + `app/api/admin/users/route.ts` |
