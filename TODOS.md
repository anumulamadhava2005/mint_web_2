# TODOS

Items identified during engineering review of the CLAUDE.md documentation pass.

---

## T1 — Add DB bridge server context to CLAUDE.md

**What:** Add a one-line note to the Environment section explaining that `api.mintit.pro` is a personal DB bridge server hosted on a separate machine (not a third-party service).

**Why:** `lib/db.ts` line 3 lists `api.mintit.pro` in `ALLOWED_DB_HOSTS`. Without context, a future AI agent may question this configuration or attempt to change it, not knowing it is the owner's own server.

**Pros:** Prevents AI agent confusion about an intentional architectural choice. Costs nothing at runtime.

**Cons:** Adds one line to CLAUDE.md (negligible).

**Context:** The DB bridge pattern posts `{ text, params }` JSON to `DB_PROXY_URL`. `api.mintit.pro/api/mint-db` is a personal server on a separate laptop running a PostgreSQL-backed bridge. This is the production DB endpoint. The allowlist in `lib/db.ts` enforces that only trusted hosts are used; without documentation, the inclusion of a `.pro` domain looks like an external dependency.

**Depends on / blocked by:** Nothing. Small addition to the `# Environment` section of CLAUDE.md.

---

## T2 — Clarify NEXT_PUBLIC_WEBSOCKET_URL vs NEXT_PUBLIC_WS_URL in CLAUDE.md

**What:** Add inline comments to the `.env.local` block in CLAUDE.md's `# Environment` section explaining that the two WebSocket env vars serve different consumers.

**Why:** Both vars are currently listed with the same value (`http://localhost:3002`) and no explanation. Per `docs/DEVELOPMENT.md`: `NEXT_PUBLIC_WEBSOCKET_URL` is consumed by collaboration hooks; `NEXT_PUBLIC_WS_URL` is consumed by the preview/runtime route. An AI agent editing either one without knowing they serve different subsystems could break one.

**Pros:** Prevents "these look like duplicates, I'll remove one" rationalization by an AI agent. Zero runtime cost.

**Cons:** Adds ~2 characters of inline comments.

**Context:** See `docs/DEVELOPMENT.md` env var table for the authoritative description. The CLAUDE.md env section is intentionally minimal (quick-start only) — the fix is inline comments like `# collaboration hooks` and `# preview/runtime`, not moving the full descriptions into CLAUDE.md.

**Depends on / blocked by:** Nothing.

---

## T4 — Extend Next.js builder to consume runtime schema (auth, database, navigation, workflows)

**What:** Add a schema-driven code generation path to `lib/convert/builders/next.ts` that reads `auth`, `database`, `navigation`, and `workflows` from `options.runtimeSchema`, mirroring what `buildReactNativeFromSchema` already does for the React Native path.

**Why:** The studio panels (AuthEditor, DatabaseEditor, NavigationEditor, ActionsEditor) write rich schema data to the runtime store. Today that data is authored but not consumed by the Next.js export — the Next.js builder is design-shape-driven (`DrawableNode[]`), not schema-driven. Users who wire up auth providers, database tables, or navigation routes expect those to appear in the generated Next.js code. They don't, silently.

**Pros:** Closes the gap between "what the studio lets you author" and "what the export produces." Makes the studio genuinely useful for the Next.js target. Fulfills the user's explicit requirement: "make sure the conversion flow architecture supports each change."

**Cons:** Large implementation surface (~60 min CC, several files in `lib/convert/`). Risk of generating non-idiomatic Next.js code for complex schema combinations.

**Context:** The React Native builder at `lib/convert/builders/reactNativeSchema.ts` already has the pattern: it receives `AppSchema` and generates typed Expo Router files, auth middleware stubs, and schema.ts. The Next.js equivalent would generate Next.js middleware for auth, an ORM-adjacent database layer, and route-config from the navigation schema.

**Depends on / blocked by:** tokenExpiry unit standardization (seconds, with JSDoc in schema.ts) should be done first so the auth schema is clean before the builder reads it.

---

## T5 — Build shared schema-to-code layer (lib/convert/core/schemaGen.ts)

**What:** Extract a shared `lib/convert/core/schemaGen.ts` that reads `auth`, `navigation`, `database`, and `workflows` from `AppSchema` and produces framework-agnostic code stubs. Each builder (Next.js, React, Vue, Svelte, Flutter, React Native) calls it rather than each extending the gap independently.

**Why:** All 6 builders currently ignore auth/navigation/database/workflow schema. The gap is systemic, not Next.js-specific. Fixing it per-builder 6× is expensive and creates diverging implementations. A shared layer means one fix covers all targets.

**Pros:** Single source of truth for schema-to-code mapping. Framework builders stay thin. React Native can drop its hardcoded CRM-specific stubs. Future schema additions (e.g. a new `notifications` schema field) are added once.

**Cons:** Larger upfront design investment. The abstraction needs to accommodate very different framework idioms (Next.js middleware vs Expo Router tabs vs Flutter Navigator).

**Context:** The React Native schema builder (`lib/convert/builders/reactNativeSchema.ts`) hardcodes table names and auth endpoints for a specific CRM schema rather than reading generically from `AppSchema`. This should be the reference implementation to refactor first.

**Depends on / blocked by:** T4 (understanding the Next.js target) should be prototyped first to inform the shared layer's API surface.

---

## T6 — ThemeDesigner: align token export filename with design-tokens.json

**What:** Change ThemeDesigner's export download from `theme-tokens.json` to `design-tokens.json` (matching the file at repo root that the conversion pipeline reads from). Or: wire ThemeDesigner changes to update the Zustand theme schema and ensure the conversion pipeline reads from schema, not from the file.

**Why:** The repo has `design-tokens.json` at root. If builders read it at build time, ThemeDesigner edits never feed into code generation — the theme editor is decorative. The filename mismatch is the visible symptom of the disconnect.

**Pros:** Theme changes the user makes in the studio actually affect exported code. Closes another studio↔export gap.

**Cons:** Requires understanding where the builders currently read design tokens from (may be hardcoded, may be the file, may not be read at all).

**Context:** Discovered during outside-voice review. Check `lib/convert/builders/next.ts` and `lib/convert/core/render.ts` for any `design-tokens.json` reads before fixing.

**Depends on / blocked by:** T5 (shared schema-to-code layer) — theme tokens should flow through the same schema layer.

---

## T7 — NavigationEditor: persist drag positions to store or localStorage

**What:** Move screen card positions from component-local `useState` to either the runtime store (`schema.navigation` extended with UI layout metadata) or a separate `localStorage` key per projectId. Currently positions are lost on tab switch.

**Why:** Users drag screens into a meaningful layout to understand the navigation graph. Losing that layout on every tab switch makes the editor frustrating to use. The positions are UI layout data, not schema data — they don't belong in AppSchema, but they do need persistence.

**Pros:** Layout is preserved across tab switches and page reloads. The navigation graph remains readable session-to-session.

**Cons:** Storing UI layout state introduces a new persistence concern separate from the schema. `schema.navigation.routes[].uiPosition` is one approach but pollutes the schema contract.

**Context:** Discovered during outside-voice review. Recommended approach: localStorage keyed by `mint:nav-layout:${projectId}`, separate from the schema. On mount, read positions from localStorage; on drag end, write back.

**Depends on / blocked by:** Nothing. Independent fix.

---

## T8 — SettingsPanel: PATCH /api/projects vs runtime-schema persistence bifurcation

**What:** SettingsPanel's "Save Changes" PATCHes `/api/projects` with app config fields (name, slug, description). These fields are separate from the runtime schema the builders consume. Document which fields live where, or consolidate so the schema is the single source of truth for all app-level config.

**Why:** Two persistence models (projects table + runtime schema) with no reconciliation creates confusion: which one wins on export? Does a name change in SettingsPanel appear in the exported `package.json`? Currently it depends on which code path the builder reads.

**Pros:** Clarity on what data lives where. Prevents "I changed the app name but the export still shows the old name" user confusion.

**Cons:** Consolidating may require migrating fields out of the projects row or adding a schema → projects sync step.

**Context:** Discovered during outside-voice review. The immediate fix is documentation: add a comment in SettingsPanel clarifying that `handleSave` updates project metadata (display name, slug) and is separate from the schema Publish action.

**Depends on / blocked by:** Nothing for the documentation fix. Full consolidation depends on T5.

---

## T9 — Design system: document --st-* token semantics and normalize type scale

**What:** (a) Create `DESIGN.md` documenting the `--st-*` CSS custom property system: token names, color semantics (`--st-brand`, `--st-warning`, `--st-success`, `--st-error`, `--st-text`, `--st-text-2`, `--st-text-3`), spacing scale, and 3-level type scale (11px / 12.5px / 13px). (b) Run `/design-consultation` to review and validate the system before adding panels.

**Why:** The `--st-*` token system is the de facto design language for all studio panels, but it exists only in CSS with no semantic documentation. Every new panel risks slight typographic or spacing divergence. Already visible: the original top bar had 5 different font sizes before the Pass 5 normalization during the 2026-06-26 design review.

**Pros:** Single source of truth for design decisions. Future panels stay consistent without explicit enforcement.

**Cons:** ~30 min to write. No runtime cost.

**Context:** Identified in Pass 5 of /plan-design-review on 2026-06-26. Font size sprawl (10px, 12px, 12.5px, 13px in top bar) was fixed as part of that review. The 3-scale system (11px metadata / 12.5px body / 13px primary) is now the implicit standard — documenting it makes it explicit.

**Depends on / blocked by:** Nothing. Can be done any time.
