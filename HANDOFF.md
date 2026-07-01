# HANDOFF — Mint Web: visual app builder (read this first, then start)

You are continuing an in-progress build. This file is the single source of truth for
context. **Trust it; do not re-explore what's documented here.** Read it once, then work.

## TOKEN DISCIPLINE (follow strictly)
- Do NOT re-read whole files to "understand the codebase" — this file + targeted `Grep`/`Glob` is enough.
- Read only the specific line ranges you need (use Grep to find them). Never read a file top-to-bottom unless editing it heavily.
- Delegate large multi-file reads or rewrites to subagents (Explore for search, a fork/general agent for big rewrites) so their output stays out of your context. Give them tight specs.
- Prefer `npx tsc --noEmit` over `npm run build` for validation. There is ONE known PRE-EXISTING error to IGNORE: `tests/runtime-store-nav.test.ts` (`'tab'` vs `'tabs'`). If that's the only error, you're clean.
- Don't re-verify things marked ✅ done below. Don't re-run the same check twice.
- Batch independent tool calls in one message. Make reasonable calls instead of asking.
- Keep changes scoped. Don't refactor unrelated code.

## WHAT THIS IS
A Figma-style visual builder: users design on a canvas, model a DB, wire variables/actions,
preview live, then **Commit** (versions the app for the runtime) or **Export** (standalone ZIP).
Priority target framework = **React Native** (Expo). Dev server runs at localhost:3000 (user starts it).

## THE ARCHITECTURE SPINE (most important mental model)
The **figma design is the source of truth**. It converts to a runtime `AppSchema`, which
BOTH the in-editor preview and the exported app render with the same engine.

```
figmaStore (canvas)  --buildAppSchemaFromFigma()-->  AppSchema
     |                                                  |
     |                          +-----------------------+------------------------+
     |                          v                        v                       v
  Live preview            Commit (/api/commit)     Export (/api/convert)   (all schema-driven)
  RuntimeProvider+         stores schema in          ZIP with embedded
  SchemaRenderer           project_commits           runtime (bundle.ts)
```

Two runtime engines that MUST stay behaviorally in sync:
- **Preview**: `lib/runtime/actions.ts` (ActionRegistry), `bindings.ts`, `state.ts`, `expressions.ts`. Rendered by `components/SchemaRenderer.tsx` via `components/runtime/RuntimeProvider.tsx`.
- **Export**: `lib/runtime/bundle.ts` — a generated STRING that becomes `mint-runtime.js` in exports. When you change action behavior in actions.ts, mirror it here.

## KEY FILES (don't read others unless needed)
- `lib/stores/figmaToRuntimeSchema.ts` — **the bridge**. `buildAppSchemaFromFigma(projectId)`; `stepToSchema` maps editor ActionStep → runtime ActionSchema (signUp/signIn/signOut/navigate/dbQuery/dbInsert/dbUpdate/dbDelete). Adds auth+database config, data-source load actions, auto-refetch after writes.
- `lib/runtime/figmaToSchema.ts` — `figmaLayerToComponent`/`figmaPageToScreenSchemas`: layer→ComponentSchema (bindings, repeatFor, events, input props). `normalizeExpr` rewrites editor `$global.x`/`$page.x` → flat `$x`. Text layers get NO background (fill = text color).
- `lib/runtime/schema.ts` — types: AppSchema, ScreenSchema (`requiresAuth`), ComponentSchema, ActionType (incl dbQuery/dbInsert/dbUpdate/dbDelete), AuthConfigSchema, NavigationSchema (`loginRoute`).
- `lib/runtime/actions.ts` — preview action handlers + `resolveConfig` (merges `ctx.params` = repeater loop item, so `$item.id` resolves).
- `lib/runtime/bundle.ts` — exported engine (mirror of actions.ts). Has `configureMint({storage,projectId})`, `hydrateSession`, CRUD, dbQuery, auth.
- `components/SchemaRenderer.tsx` — preview renderer. Wires: bound text, TextInput two-way (`state.set`), Pressable/button `onClick→dispatch`, `repeatFor`→rows with loop ctx, conditionalRender.
- `components/figma/RuntimeEditorPreview.tsx` — the "⚡ Live" preview overlay + runtime **console** (via `lib/runtime/previewLog.ts`), runs screen `onMount`, auth redirect.
- `components/figma/Canvas.tsx` — canvas: `input` primitive + auto-var; `@` inline data tokens in text edit; drag-into-frame reparenting; `onSetClickAction` (auth/CRUD/navigate), `onSetDataSource`, `onSetInputType`.
- `components/figma/CanvasBindingOverlay.tsx` — floating chips: input type+value bind; text Edit/Bind; **On-click action** (auth + Create/Update/Delete + table + "then go to"); **Repeat with data** (table→list); **🔒 Requires login** toggle on screen frames.
- `components/figma/BindingPicker.tsx` + `bindingExpr.ts` — `@`-token picker + `compileTextTemplate` (`@user.name`→`'..'+$user.name`).
- `components/figma/LeftPanel.tsx` — layers panel with drag-drop reparent/reorder.
- `components/figma/TopBar.tsx` — Commit + Export buttons + framework selector (react/nextjs/react-native only — those are schema-driven).
- `lib/stores/commitExport.ts` — `commitProjectFromFigma(framework)`, `exportProjectFromFigma(framework)`.
- `lib/convert/index.ts` (`convertDesign`) + `lib/convert/builders/reactNativeSchema.ts` (RN, **data-driven**), `reactWebSchema.ts`, `nextSchema.ts`.
- Endpoints: `app/api/commit/route.ts`, `app/api/convert/route.ts`, `app/api/app-auth/[projectId]/[action]/route.ts` (end-user signup/login/logout), `app/api/db/[projectId]/route.ts` (DML bridge), `app/api/mobile-config/route.ts`, `proxy.ts` (middleware allowlist — `/api/app-auth` and `/api/db` are public).
- `server/websocket.ts` — `config-update` push (live updates channel).

## CONVENTIONS / GOTCHAS (hard-won — don't relearn these)
1. **Per-project DB isolation**: every table is prefixed `mint_proj_<sanitizedProjectId>_`. The DML endpoint (`/api/db/[projectId]`) namespaces bare table names in SQL, blocks DDL + injection patterns, 5s timeout. Send bare names (`SELECT * FROM users`).
2. **End-user auth is a DEDICATED store**: `mint_proj_<id>_auth_users` / `_auth_sessions` — NEVER the builder's own `users` table. scrypt hashing reused from `lib/auth.ts`. Endpoint is public (in proxy.ts allowlist), scoped to an existing project.
3. **Expression convention**: flat state paths — `$form.email`, `$user.username`, `$item.email`. `resolveConfig` only auto-evaluates TOP-LEVEL `$`-string config values; nested `values`/`where` maps are resolved inside the handler (see actions.ts dbInsert/dbUpdate/dbDelete).
4. **Testing exporters headlessly**: `npx tsx` a temp script that does `const m = await import("@/lib/convert/builders/reactNativeSchema")` — a **dynamic** import (static named import fails under tsx due to circular-init). Feed a representative AppSchema, write files, inspect. Delete the temp script after.
5. **DB bridge is REAL Postgres** (`mint_web` db behind https://api.mintit.pro/api/mint-db). Test project `69fef54b-6de6-4bbe-bf86-7dfd4b20b56a`, demo user `rbet-demo@example.com`. Destructive DB ops need explicit user OK.
6. **CLAUDE.md mentions gstack** (/browse etc.); it's fine to use direct tools. Don't block on gstack.
7. Generated screen files carry `// @ts-nocheck` (Expo typechecks separately).

## DONE ✅ (do not rebuild)
Design canvas + input primitive; `@` inline bindings; typed two-way inputs; data-source lists
(repeaters via dbQuery); CRUD actions (create/update/delete) in preview AND export; end-user
auth + session lifecycle (persist/hydrate/logout, protected screens); RN export is data-driven
(bundle+RN renderer wire everything); Commit + Export from canvas (figma schema = truth);
framework selector; layer reparenting (panel DnD, canvas drag, Ctrl+[ / Ctrl+]); Live preview +
runtime console; fixed a missing `dbQuery` handler in bundle.ts (affected web+RN).

## REMAINING PHASES (priority order — start at 0)
- **0. Per-row CRUD in EXPORTED apps.** Delete/Update-in-a-list use `where:{id:$item.id}`. Preview already threads the repeater loop item into config resolution (actions.ts `resolveConfig`/`resolveMap` merge `ctx.params`). MIRROR this in `bundle.ts` (`_resolveConfig` + CRUD resolveMap merge the passed loop ctx) AND make the generated renderers' `fire()`/dispatch pass loop ctx — in BOTH `reactWebSchema.ts` (SchemaRenderer.jsx) and `reactNativeSchema.ts` (SchemaRenderer.tsx). Then regen + inspect. Small/mechanical.
- **6. Verify export runs standalone.** NO exported app has actually been run end-to-end. Generate an RN export, unzip, `npm install`, `npx expo start`, set `EXPO_PUBLIC_API_ORIGIN` to LAN IP, confirm it renders + signup/login + list load + write work against the live backend. Fix whatever breaks. Also: image/asset export.
- **7. Commit → live update.** Commit stores figma schema; WebSocket `config-update` exists. Make a RUNNING exported app re-fetch `runtimeSchema` (from `/api/mobile-config`) and re-render on `config-update` so commits appear live without rebuild.
- **4b. Events + action editor.** More events (explicit onChange, onSubmit, onBlur/Focus, screen onLoad); canvas-native multi-step action editor (flow model + runtime exist; only single-action chip is exposed).
- **8. Efficient rendering.** Preview/exports re-render whole tree on any state change (`subscribeAll`). Switch to per-binding subscriptions (engine supports it) + memo; virtualize long lists.
- **9. Data UX.** Loading/empty/error states; filters/search/sort/pagination; single-record fetch for detail screens.
- **3. Variable manager.** Canvas panel to view/rename/type/scope vars; computed/derived; persisted; screen-local scope.
- **5b. Auth hardening (post-MVP).** Per-user token + RLS (exports currently use the project sync token → no per-user row security); password reset; OAuth/MFA.
- **1b/2b. Fidelity.** Components/instances + images in export; DB seed data.

**Critical chain to first users: 0 → 6 → 7.** Then 8, 9. Rest is polish.

## HOW TO START (first message in the new session)
1. Read this file (done). 2. `git log --oneline -5` + `git status` to see recent state.
3. Start Phase 0: mirror the loop-context fix into `bundle.ts` + both generated renderers, regen an RN export (dynamic-import tsx script), confirm a per-row Delete wires `$item.id`. Then move to Phase 6.
Validate with `npx tsc --noEmit` (ignore the one known test error). Keep turns tight.
