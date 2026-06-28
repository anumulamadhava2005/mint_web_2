# Engineering Review — B1-B5 (Bindings, Backend, Logic)

**Date:** 2026-06-28  
**Branch:** main  
**Reviewer:** gstack /plan-eng-review + independent outside voice  
**Scope:** B1 (binding fields in figmaStore), B2 (BindingPicker UI), B3 (RepeatFor UI in RightPanel), B4 (BackendPanel — API sources + global state), B5 (LogicPanel — action flow builder + layer events)

---

## Review Readiness Dashboard

```
Architecture     ████████░░  80%   4 issues found, all with clear fixes
Code Quality     ████████░░  80%   1 anti-pattern (ID generation), otherwise clean
Test Coverage    ██░░░░░░░░  20%   0% on new code; 3 targeted tests approved
Performance      ████████░░  85%   1 P1 (autosave gap), rest acceptable
Outside Voice    ✅ 6/6 severities confirmed, 1 nuance added
```

**Overall: Ship with P1 fixes applied. P2 fixes in next sprint.**

---

## Section 1 — Architecture Review

### Issue 1 — B4/B5 data not persisted (P1 — DATA LOSS)
**File:** `app/api/figma-file/route.ts` line 71-79, `lib/stores/figmaStore.ts:saveToServer` line 1108-1126  
**What breaks:** Every page reload silently discards all API sources, global state vars, and action flows. The entire B4 and B5 feature is session-only.  
**Fix:** Add `apiSources`, `globalStateVars`, `actionFlows` to the `figmaData` object in both the POST handler and the `saveToServer` payload. Also restore these fields in the GET handler's response spread.

### Issue 2 — figmaToSchema hardcodes `bindings: {}` (P1 — CORRECTNESS)
**File:** `lib/runtime/figmaToSchema.ts` — `figmaLayerToComponent()` line ~213  
**What breaks:** Runtime preview always shows static content. No binding expressions reach the evaluator. B1-B3 is entirely non-functional at runtime despite working in the UI.  
**Fix:** Copy `layer.bindings`, `layer.repeatFor`, `layer.conditionalRender` into the `ComponentSchema` output.

### Issue 3 — Bindings not in export pipeline (P1 — CORRECTNESS)
**File:** `lib/convert/adapters/figmaAdapter.ts` — `figmaLayerToDesignNode()`  
**What breaks:** All exported code (React, Next.js, React Native) is always static. Bindings, list rendering, and conditional rendering never survive export.  
**Fix:** Map `layer.bindings`, `layer.repeatFor`, `layer.conditionalRender`, `layer.layerEvents` onto the `DesignNode` output.

### Issue 4 — Runtime sync hash misses bindings (P2 — UX DEGRADATION)
**File:** `hooks/useFigmaRuntimeSync.ts` lines 20-22  
**What breaks:** User changes a binding; preview doesn't update until a structural layer change (move/resize) occurs.  
**Fix:** Append `JSON.stringify(l.bindings ?? {})`, `JSON.stringify(l.repeatFor ?? '')`, `l.conditionalRender ?? ''`, `JSON.stringify(l.layerEvents ?? {})` to the hash string.

---

## Section 2 — Code Quality Review

### Issue 5 — addActionFlow returns no ID (P2 — ANTI-PATTERN)
**File:** `lib/stores/figmaStore.ts:addActionFlow`, `components/figma/LogicPanel.tsx:createFlow`  
**What breaks:** `createFlow` in LogicPanel uses `setTimeout` + array-tail heuristic to discover the new flow's ID. Async race on slow state updates.  
**Fix:** Accept a pre-generated ID parameter in `addActionFlow`, `addApiSource`, `addGlobalStateVar`. Caller generates `const id = Math.random().toString(36).slice(2)` before the call.

---

## Section 3 — Test Coverage

### Issue 6 — Vitest picks up .claude/worktrees tests (P1 — CI)
**File:** `vitest.config.ts`  
**What breaks:** 48-60 spurious test failures in CI (12 agent worktrees × 4-5 test files each). Masks 2 real pre-existing failures.  
**Fix:** Add `exclude: ['.claude/**', 'node_modules/**']` to `vitest.config.ts`.

### Issue 7 — Zero tests for new B1-B5 code (P2 — QUALITY)
**What breaks:** No regression safety net for the 13+ new critical paths.  
**Approved approach:** 3 targeted tests:
1. `tests/figma-file-auth.test.ts` — GET without token returns 401
2. `tests/figmaStore-bindings.test.ts` — `setBinding` / `removeBinding` roundtrip
3. `tests/figmaToSchema-bindings.test.ts` — `figmaLayerToComponent()` copies `layer.bindings` (post Fix 2)

---

## Section 4 — Performance Review

| Path | Observation | Severity |
|------|-------------|----------|
| `FigmaEditor.tsx:52` — autosave subscription | Only watches `state.layers`. B4/B5 mutations never trigger autosave timer. Combined with Issue 1, B4/B5 data cannot be saved. | **P1** |
| `auth.ts:findUserByToken` | DB join on every API request. Redis caches token existence in proxy middleware, but not the user record. | P2 (acceptable at current scale) |
| `figmaStore.ts:updateLayerInTree` | O(n) recursive tree map on every binding/event change. | P3 (fine ≤500 nodes) |
| `figma-file POST` | Full canvas payload serialized + written on every 2s autosave. No diffing, no size guard. | P3 (fine at current scale) |

**Performance P1 fix** (rolled into T1): FigmaEditor autosave subscription must also watch `apiSources`, `globalStateVars`, `actionFlows`.

---

## Section 5 — Outside Voice

Independent review by a fresh subagent (zero context from prior analysis).

**Verdict:** All 6 severity labels confirmed. One addition: Issue 5 (autosave subscription gap) identified as a **distinct code change** from the API route fix — requires changing `FigmaEditor.tsx:52` subscription condition, not just `figma-file/route.ts`. This is already addressed in T1 scope.

---

## Implementation Tasks

| ID | Title | Priority | Files | Est. |
|----|-------|----------|-------|------|
| **T1a** | Extend figma-file POST/GET to include apiSources, globalStateVars, actionFlows | P1 | `app/api/figma-file/route.ts`, `lib/stores/figmaStore.ts` | 20 min |
| **T1b** | Fix autosave subscription to also watch B4/B5 store keys | P1 | `components/figma/FigmaEditor.tsx` | 10 min |
| **T2** | Fix figmaToSchema bindings copy | P1 | `lib/runtime/figmaToSchema.ts` | 15 min |
| **T3** | Map bindings in figmaAdapter export | P1 | `lib/convert/adapters/figmaAdapter.ts` | 20 min |
| **T4** | Extend useFigmaRuntimeSync hash | P2 | `hooks/useFigmaRuntimeSync.ts` | 10 min |
| **T5** | Pre-generate IDs in add* actions | P2 | `lib/stores/figmaStore.ts`, `components/figma/LogicPanel.tsx` | 20 min |
| **T6** | Add vitest exclude for .claude/** | P1 | `vitest.config.ts` | 5 min |
| **T7** | Write 3 targeted tests | P2 | `tests/` | 45 min |

**Recommended sequence:** T6 → T1a+T1b → T2+T3 (parallel) → T4 → T5 → T7

**Total estimated time:** ~2.5 hours (CC-assisted), ~5 hours (manual)

---

## NOT in Scope (this review)

- B6 runtime preview evaluation (live binding execution)
- Export pipeline end-to-end output validation (B6 scope)
- Collaboration / CRDT conflict resolution
- Canvas rendering performance (WebGL renderer)
- Auth hardening beyond the existing design
- Dangling action ref cleanup (flow deleted after wiring to event — needs B6 validation pass)
