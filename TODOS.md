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
