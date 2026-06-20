// ═══════════════════════════════════════════════════════════════
// reactNativeSchema — AppSchema → React Native (Expo) emitter
//
// SEPARATE path from reactNative.ts (which consumes DrawableNode[]).
// This consumes AppSchema.screens[].components[] (ComponentSchema) and
// emits flexbox RN JSX. Screens are STATIC codegen; only the approval
// "next step" lookup is dynamic at runtime (live workflow_steps query).
//
// Dispatch shape mirrors components/SchemaRenderer.tsx; behavior for
// dataTable/timeline/pipeline ported from lib/runtime/components/*.
// ═══════════════════════════════════════════════════════════════

import type {
  AppSchema,
  ScreenSchema,
  ComponentSchema,
} from "../../runtime/schema";

export interface GeneratedFile {
  path: string;
  content: string;
  type: "text";
}

export interface RNSchemaOptions {
  projectId: string;
  apiOrigin?: string;
  appName?: string;
  /** Project sync token — baked in so the app can call the managed DB/auth API. */
  authToken?: string;
}

// ── Helpers ──────────────────────────────────────────────────

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "screen";

const compName = (s: string) =>
  (s.replace(/[^a-zA-Z0-9]/g, " ").split(" ").filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1)).join("") || "Screen") + "Screen";

/** state path accessor: "$local.x" / "local.x" -> state.local?.x ; loop var passthrough */
function acc(expr: string, loopVar?: string): string {
  const path = expr.replace(/^\$/, "").trim();
  const parts = path.split(".");
  if (loopVar && parts[0] === loopVar) {
    return parts.length === 1 ? loopVar : loopVar + parts.slice(1).map((p) => `?.${p}`).join("");
  }
  return "state." + parts[0] + parts.slice(1).map((p) => `?.${p}`).join("");
}

const esc = (s: string) => String(s).replace(/`/g, "\\`").replace(/\$/g, "\\$");

// ── Component emission ───────────────────────────────────────

function emit(c: ComponentSchema, indent: number, loopVar?: string): string {
  const pad = "  ".repeat(indent);
  const p = (c.props || {}) as Record<string, any>;
  const b = (c.bindings || {}) as Record<string, string>;

  // role visibility (auth-guard.ts) — wrap with user-role check
  let roleOpen = "", roleClose = "";
  if (c.requiredRoles?.length) {
    const roles = JSON.stringify(c.requiredRoles);
    roleOpen = `${pad}{(${roles}).includes(state.user?.role) && (\n`;
    roleClose = `\n${pad})}`;
    indent += 1;
  }
  const ip = "  ".repeat(indent);

  // visibleBind
  let visOpen = "", visClose = "";
  if (b.visibleBind) {
    visOpen = `${ip}{${acc(b.visibleBind, loopVar)} && (\n`;
    visClose = `\n${ip})}`;
    indent += 1;
  }
  const body = emitInner(c, indent, loopVar);
  return roleOpen + visOpen + body + visClose + roleClose;
}

function emitInner(c: ComponentSchema, indent: number, loopVar?: string): string {
  const pad = "  ".repeat(indent);
  const p = (c.props || {}) as Record<string, any>;
  const b = (c.bindings || {}) as Record<string, string>;
  const kids = () => (c.children || []).map((k) => emit(k, indent + 1, loopVar)).join("\n");

  switch (c.type) {
    case "text": {
      const txt = b.textBind
        ? `{String(${acc(b.textBind, loopVar)} ?? "")}`
        : `{\`${esc(p.text ?? p.value ?? "")}\`}`;
      return `${pad}<Text style={s.text}>${txt}</Text>`;
    }
    case "button": {
      const label = b.textBind ? `{String(${acc(b.textBind, loopVar)} ?? "")}` : `{\`${esc(p.text ?? p.label ?? "Button")}\`}`;
      const onPress = b.onClick ? ` onPress={() => actions(${JSON.stringify(b.onClick)}, ${loopVar || "{}"})}` : "";
      return `${pad}<Pressable style={s.button}${onPress}><Text style={s.buttonText}>${label}</Text></Pressable>`;
    }
    case "input":
    case "searchInput": {
      const key = (b.inputBind || "").replace(/^\$/, "");
      const val = b.inputBind ? `${acc(b.inputBind, loopVar)} ?? ""` : `""`;
      const onCh = b.inputBind ? ` onChangeText={(t) => setState(${JSON.stringify(key)}, t)}` : "";
      const multi = p.multiline ? ` multiline numberOfLines={4}` : "";
      const st = p.multiline ? `[s.input, s.textArea]` : `s.input`;
      return `${pad}<TextInput style={${st}}${multi} value={${val}}${onCh} placeholder={\`${esc(p.placeholder ?? "")}\`} placeholderTextColor="#9CA3AF" />`;
    }
    case "select": {
      const opts = JSON.stringify(p.options || p.enumValues || []);
      const key = (b.inputBind || "").replace(/^\$/, "");
      return `${pad}<SelectInput options={${opts}} value={${b.inputBind ? acc(b.inputBind, loopVar) : "undefined"}} onChange={(v) => setState(${JSON.stringify(key)}, v)} placeholder={\`${esc(p.placeholder ?? "Select")}\`} />`;
    }
    case "datePicker": {
      const key = (b.inputBind || "").replace(/^\$/, "");
      return `${pad}<DateField value={${b.inputBind ? acc(b.inputBind, loopVar) : "undefined"}} onChange={(v) => setState(${JSON.stringify(key)}, v)} />`;
    }
    case "statusChip": {
      const v = b.textBind ? acc(b.textBind, loopVar) : `\`${esc(p.value ?? "")}\``;
      return `${pad}<StatusChip value={${v}} />`;
    }
    case "fileUpload":
      return `${pad}<FileUpload projectId={PROJECT_ID} onUploaded={(url) => setState(${JSON.stringify((p.storePath||"local.receipt_url").replace(/^\$/,""))}, url)} />`;
    case "timeline": {
      const data = b.dataSource || p.dataSource || "$local.events";
      return `${pad}<Timeline data={${acc(data, loopVar)} || []} config={${JSON.stringify(p)}} activeStepValue={${p.activeMatchKey ? acc(p.activeStepExpression || "$local.activeExpense.current_step_key", loopVar) : "undefined"}} />`;
    }
    case "dataTable": {
      const data = b.dataSource || p.dataSource || "$local.rows";
      return `${pad}<DataTable data={${acc(data, loopVar)} || []} config={${JSON.stringify(p)}} />`;
    }
    case "image": {
      const src = b.src ? acc(b.src, loopVar) : `\`${esc(p.src ?? "")}\``;
      return `${pad}<MintImage src={${src}} config={${JSON.stringify(p)}} />`;
    }
    case "camera": {
      const key = String(p.storePath || "local.photo").replace(/^\$/, "");
      return `${pad}<Camera config={${JSON.stringify(p)}} projectId={PROJECT_ID} onCaptured={(url) => setState(${JSON.stringify(key)}, url)} />`;
    }
    case "chart": {
      const data = b.dataSource || p.dataSource || "$local.series";
      return `${pad}<Chart data={${acc(data, loopVar)} || []} config={${JSON.stringify(p)}} />`;
    }
    case "statCard": {
      const value = b.value ? acc(b.value, loopVar) : `\`${esc(p.value ?? "")}\``;
      const delta = b.delta ? acc(b.delta, loopVar) : (p.delta != null ? `\`${esc(p.delta)}\`` : "undefined");
      return `${pad}<StatCard value={${value}} delta={${delta}} config={${JSON.stringify(p)}} />`;
    }
    case "list":
    case "grid": {
      if (c.repeatFor) {
        const listExpr = acc(c.repeatFor.items, loopVar);
        const itemVar = c.repeatFor.as;
        const inner = (c.children || []).map((k) => emit(k, indent + 3, itemVar)).join("\n");
        return `${pad}<FlatList
${pad}  data={${listExpr} || []}
${pad}  keyExtractor={(_, i) => String(i)}
${pad}  renderItem={({ item: ${itemVar} }) => (
${pad}    <View style={s.row}>
${inner}
${pad}    </View>
${pad}  )}
${pad}/>`;
      }
      return `${pad}<View style={s.col}>\n${kids()}\n${pad}</View>`;
    }
    case "card":
      return `${pad}<View style={s.card}>\n${kids()}\n${pad}</View>`;
    case "scroll":
      return `${pad}<ScrollView style={s.flex} contentContainerStyle={s.col}>\n${kids()}\n${pad}</ScrollView>`;
    default: // view, container, form, modal
      return `${pad}<View style={s.col}>\n${kids()}\n${pad}</View>`;
  }
}

// ── Screen file ──────────────────────────────────────────────

function emitScreen(screen: ScreenSchema, isHome: boolean): string {
  const onMount = screen.onMount?.length
    ? screen.onMount.map((a) => `    actions(${JSON.stringify(typeof a === "string" ? a : a.actionId)}, {});`).join("\n")
    : "";
  const tree = (screen.components || []).map((c) => emit(c, 4)).join("\n");
  return `import React from "react";
import { View, Text, Pressable, TextInput, ScrollView, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMint, PROJECT_ID } from "../lib/mint-runtime";
import { DataTable, Timeline, StatusChip, SelectInput, DateField, FileUpload, MintImage, Camera, Chart, StatCard } from "../components/MintComponents";
import { s } from "../lib/styles";

export default function ${compName(screen.name)}() {
  const { state, setState, actions } = useMint();
${onMount ? `  React.useEffect(() => {\n${onMount}\n  }, []);` : ""}
  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={s.screenContent}>
${tree}
      </ScrollView>
    </SafeAreaView>
  );
}
`;
}

// ── Runtime provider (self-contained; live DB bridge) ────────

function runtimeFile(
  opts: RNSchemaOptions,
  routesMap: Record<string, string> = {},
  navAfter: Record<string, string> = {}
): string {
  const origin = opts.apiOrigin || "https://mintweb.mintit.pro";
  return `import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { router } from "expo-router";

export const PROJECT_ID = ${JSON.stringify(opts.projectId)};
// API origin. The baked default is the editor you exported from. On a phone
// or Android emulator "localhost" is the DEVICE, not your computer — set
// EXPO_PUBLIC_API_ORIGIN to your machine's LAN IP (e.g. http://192.168.1.20:3001)
// in a .env file and restart Metro (no re-export needed).
export const API_ORIGIN =
  (typeof process !== "undefined" && process.env && process.env.EXPO_PUBLIC_API_ORIGIN) ||
  ${JSON.stringify(origin)};
// Project sync token — authenticates managed-DB calls from this app.
export const AUTH_TOKEN =
  (typeof process !== "undefined" && process.env && process.env.EXPO_PUBLIC_MINT_TOKEN) ||
  ${JSON.stringify(opts.authToken || "")};
const DB_BRIDGE = API_ORIGIN + "/api/db/" + PROJECT_ID;
const AUTH_HEADERS = AUTH_TOKEN ? { Authorization: "Bearer " + AUTH_TOKEN } : {};

// ── Navigation ───────────────────────────────────────────────
// ROUTES: screenId -> expo-router path (home screen is "/").
// NAV_AFTER: actionName -> screenId to navigate to once the action
//            succeeds (skipped when the action returns false).
const ROUTES = ${JSON.stringify(routesMap)};
const NAV_AFTER = ${JSON.stringify(navAfter)};
function routeFor(target) {
  if (!target) return "/";
  if (ROUTES[target]) return ROUTES[target];
  return target.charAt(0) === "/" ? target : "/" + target;
}

// Live SQL against the project's hosted DB. Tables are project-scoped
// server-side, so unprefixed names are used here.
export async function dbQuery(sql, params = []) {
  const res = await fetch(DB_BRIDGE, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...AUTH_HEADERS },
    body: JSON.stringify({ sql, params }),
  });
  if (!res.ok) throw new Error("DB query failed: " + res.status);
  const j = await res.json();
  return j.rows || j.result || [];
}

// ── THE one dynamic-at-runtime piece ─────────────────────────
// Next approval step is read FRESH from workflow_steps every call —
// never a baked-in sequence. Add a step in the DB and this changes
// with no re-export.
export async function getNextStep(currentStepKey) {
  const rows = await dbQuery(
    "SELECT step_key, label, approver_role, position FROM workflow_steps WHERE active = true ORDER BY position ASC"
  );
  if (!rows.length) return null;
  if (!currentStepKey) return rows[0];
  const idx = rows.findIndex((r) => r.step_key === currentStepKey);
  if (idx === -1 || idx >= rows.length - 1) return null; // none left → approved
  return rows[idx + 1];
}

const Ctx = createContext(null);

export function MintProvider({ children }) {
  const [version, setVersion] = useState(0);
  const stateRef = useRef({ user: { role: "employee" }, local: {}, global: {} });
  const rerender = useCallback(() => setVersion((v) => v + 1), []);

  const setState = useCallback((path, value) => {
    const parts = String(path).split(".");
    let o = stateRef.current;
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof o[parts[i]] !== "object" || o[parts[i]] == null) o[parts[i]] = {};
      o = o[parts[i]];
    }
    o[parts[parts.length - 1]] = value;
    rerender();
  }, [rerender]);

  // Action dispatcher — see ACTIONS map below.
  // Handles the "navigate:<screenId>" button convention, runs the named
  // action, then navigates if NAV_AFTER declares a target (unless the
  // action returned false, e.g. failed sign-in).
  const actions = useCallback(async (name, ctx) => {
    if (typeof name === "string" && name.indexOf("navigate:") === 0) {
      router.push(routeFor(name.slice("navigate:".length)));
      return;
    }
    const fn = ACTIONS[name];
    if (!fn) { console.warn("Unknown action: " + name); return; }
    const result = await fn({ state: stateRef.current, setState, dbQuery, getNextStep, ctx: ctx || {} });
    if (result !== false && NAV_AFTER[name]) router.replace(routeFor(NAV_AFTER[name]));
    return result;
  }, [setState]);

  return React.createElement(Ctx.Provider, { value: { state: stateRef.current, setState, actions, _v: version } }, children);
}

export function useMint() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useMint outside MintProvider");
  return c;
}

// ── Action library (data-access via dbQuery / getNextStep) ───
const ACTIONS = {
  // Load active expenses into local.expenses
  loadExpenses: async ({ setState }) => {
    const rows = await dbQuery("SELECT * FROM expenses ORDER BY created_at DESC");
    setState("local.expenses", rows);
  },
  // Load workflow steps for the builder screen
  loadSteps: async ({ setState }) => {
    const rows = await dbQuery("SELECT * FROM workflow_steps ORDER BY position ASC");
    setState("local.steps", rows);
  },
  // Load approval events for the active expense (Timeline)
  loadEvents: async ({ state, setState }) => {
    const id = state.local?.activeExpense?.id;
    if (!id) return;
    const rows = await dbQuery("SELECT * FROM approval_events WHERE expense_id = $1 ORDER BY created_at ASC", [id]);
    setState("local.events", rows);
  },
  // Submit a new expense — first step computed LIVE
  submitExpense: async ({ state, setState }) => {
    const f = state.local?.form || {};
    const first = await getNextStep(null);
    const status = first ? "pending_" + first.step_key : "approved";
    const rows = await dbQuery(
      "INSERT INTO expenses (title, description, amount, category, receipt_url, status, current_step_key, employee_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
      [f.title || "", f.description || "", Number(f.amount) || 0, f.category || null, state.local?.receipt_url || null, status, first ? first.step_key : null, null]
    );
    setState("local.form", {});
    return rows[0];
  },
  // Approve current step — advance using LIVE next-step lookup
  approveExpense: async ({ state }) => {
    const exp = state.local?.activeExpense;
    if (!exp) return;
    const next = await getNextStep(exp.current_step_key);
    const status = next ? "pending_" + next.step_key : "approved";
    await dbQuery("UPDATE expenses SET status=$1, current_step_key=$2 WHERE id=$3", [status, next ? next.step_key : null, exp.id]);
    await dbQuery("INSERT INTO approval_events (expense_id, step_key, label, status) VALUES ($1,$2,$3,$4)", [exp.id, exp.current_step_key, "Approved", "completed"]);
  },
  // Workflow Builder: add a step row LIVE — re-fetch reflects it everywhere
  addWorkflowStep: async ({ state, setState }) => {
    const f = state.local?.newStep || {};
    const cnt = await dbQuery("SELECT COALESCE(MAX(position),0)+1 AS pos FROM workflow_steps");
    const pos = cnt[0] ? Number(cnt[0].pos) : 1;
    await dbQuery(
      "INSERT INTO workflow_steps (step_key, label, approver_role, position, active) VALUES ($1,$2,$3,$4,true)",
      [f.step_key || "dept_head", f.label || "Department Head Approval", f.approver_role || "department_head", pos]
    );
    const rows = await dbQuery("SELECT * FROM workflow_steps ORDER BY position ASC");
    setState("local.steps", rows);
  },
  // Dashboard: load role-conditional counts
  loadDashboard: async ({ state, setState }) => {
    const all = await dbQuery("SELECT status, amount FROM expenses");
    const pending = all.filter((r) => r.status && r.status.startsWith("pending_")).length;
    const approved = all.filter((r) => r.status === "approved" || r.status === "reimbursed").length;
    const total = all.reduce((s, r) => s + Number(r.amount || 0), 0);
    setState("local.pendingCount", String(pending));
    setState("local.approvedCount", String(approved));
    setState("local.totalAmount", "$" + total.toFixed(2));
  },
  // Manager Approvals: load expenses pending manager step
  loadPendingManager: async ({ setState }) => {
    const rows = await dbQuery("SELECT * FROM expenses WHERE status = $1 ORDER BY created_at DESC", ["pending_manager"]);
    setState("local.pendingExpenses", rows);
  },
  // Finance Approvals: load expenses pending finance step
  loadPendingFinance: async ({ setState }) => {
    const rows = await dbQuery("SELECT * FROM expenses WHERE status = $1 ORDER BY created_at DESC", ["pending_finance"]);
    setState("local.pendingExpenses", rows);
  },
  // Approve from list view (Manager/Finance) — sets activeExpense then delegates
  approveExpenseFromList: async ({ state, setState, ctx }) => {
    const exp = ctx; // the loop item
    if (!exp?.id) return;
    const next = await getNextStep(exp.current_step_key);
    const status = next ? "pending_" + next.step_key : "approved";
    await dbQuery("UPDATE expenses SET status=$1, current_step_key=$2 WHERE id=$3", [status, next ? next.step_key : null, exp.id]);
    await dbQuery("INSERT INTO approval_events (expense_id, step_key, label, status) VALUES ($1,$2,$3,$4)", [exp.id, exp.current_step_key, "Approved", "completed"]);
    // Refresh the list
    const role = state.user?.role;
    if (role === "finance") {
      const rows = await dbQuery("SELECT * FROM expenses WHERE status = $1 ORDER BY created_at DESC", ["pending_finance"]);
      setState("local.pendingExpenses", rows);
    } else {
      const rows = await dbQuery("SELECT * FROM expenses WHERE status = $1 ORDER BY created_at DESC", ["pending_manager"]);
      setState("local.pendingExpenses", rows);
    }
  },
  // Reject from list view
  rejectExpenseFromList: async ({ state, setState, ctx }) => {
    const exp = ctx;
    if (!exp?.id) return;
    await dbQuery("UPDATE expenses SET status=$1, current_step_key=$2 WHERE id=$3", ["rejected", null, exp.id]);
    await dbQuery("INSERT INTO approval_events (expense_id, step_key, label, status) VALUES ($1,$2,$3,$4)", [exp.id, exp.current_step_key || "unknown", "Rejected", "failed"]);
    const role = state.user?.role;
    const statusFilter = role === "finance" ? "pending_finance" : "pending_manager";
    const rows = await dbQuery("SELECT * FROM expenses WHERE status = $1 ORDER BY created_at DESC", [statusFilter]);
    setState("local.pendingExpenses", rows);
  },
  // Mark expense as reimbursed (Finance)
  markReimbursed: async ({ setState, ctx }) => {
    const exp = ctx;
    if (!exp?.id) return;
    await dbQuery("UPDATE expenses SET status=$1 WHERE id=$2", ["reimbursed", exp.id]);
    await dbQuery("INSERT INTO approval_events (expense_id, step_key, label, status) VALUES ($1,$2,$3,$4)", [exp.id, "finance", "Reimbursed", "completed"]);
    const rows = await dbQuery("SELECT * FROM expenses WHERE status = $1 ORDER BY created_at DESC", ["pending_finance"]);
    setState("local.pendingExpenses", rows);
  },
  // ── Auth (real platform endpoints) ─────────────────────────
  signIn: async ({ state, setState }) => {
    const f = state.local?.form || {};
    const res = await fetch(API_ORIGIN + "/api/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: f.email, password: f.password }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setState("local.authError", j.error || "Sign in failed"); return false; }
    if (j.user) setState("user", j.user);
    if (j.token) setState("session.token", j.token);
    setState("local.authError", "");
    setState("local.form", {});
  },
  signUp: async ({ state, setState }) => {
    const f = state.local?.form || {};
    const res = await fetch(API_ORIGIN + "/api/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: f.email, password: f.password, name: f.name }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setState("local.authError", j.error || "Sign up failed"); return false; }
    if (j.user) setState("user", j.user);
    if (j.token) setState("session.token", j.token);
    setState("local.authError", "");
    setState("local.form", {});
  },
  signOut: async ({ setState }) => {
    try { await fetch(API_ORIGIN + "/api/logout", { method: "POST" }); } catch (e) {}
    setState("user", null);
    setState("session.token", null);
  },
  navigate: async ({ ctx }) => { if (ctx && ctx.to) router.push(routeFor(ctx.to)); },
};
`;
}

// ── Shared components (ported behavior) ──────────────────────

function mintComponentsFile(): string {
  return `import React, { useState, useMemo } from "react";
import { View, Text, Pressable, TextInput, FlatList, Image } from "react-native";
import { s } from "../lib/styles";

// ── StatusChip (configs.ts DEFAULT_STATUS_COLORS/LABELS) ─────
const STATUS_COLORS = { draft:"#6B7280", pending_manager:"#F59E0B", pending_department_head:"#F59E0B", pending_finance:"#3B82F6", approved:"#10B981", rejected:"#EF4444", reimbursed:"#8B5CF6", active:"#3B82F6", completed:"#10B981" };
export function StatusChip({ value }) {
  const v = String(value || "");
  const color = STATUS_COLORS[v] || "#6B7280";
  const label = v.replace(/_/g, " ").replace(/\\b\\w/g, (l) => l.toUpperCase());
  return <View style={[s.chip, { backgroundColor: color + "22", borderColor: color }]}><Text style={[s.chipText, { color }]}>{label}</Text></View>;
}

// ── formatCellValue (data-table.ts) ──────────────────────────
function formatCell(value, col) {
  if (value == null) return "—";
  switch (col.type) {
    case "currency": return new Intl.NumberFormat("en-US", { style: "currency", currency: col.format || "USD" }).format(Number(value));
    case "number": return Number(value).toLocaleString();
    case "status": return String(value).replace(/_/g, " ").replace(/\\b\\w/g, (l) => l.toUpperCase());
    default: return String(value);
  }
}

// ── DataTable: search → sort → render (ported) ───────────────
export function DataTable({ data, config }) {
  const cols = config.columns || [];
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState(config.defaultSort?.key || null);
  const [dir, setDir] = useState(config.defaultSort?.direction || "asc");
  const rows = useMemo(() => {
    let r = [...(data || [])];
    if (q && config.searchable) {
      const fields = config.searchFields || cols.map((c) => c.key);
      r = r.filter((row) => fields.some((f) => row[f] != null && String(row[f]).toLowerCase().includes(q.toLowerCase())));
    }
    if (sortKey) {
      const col = cols.find((c) => c.key === sortKey);
      const mul = dir === "asc" ? 1 : -1;
      r.sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey];
        if (col && (col.type === "number" || col.type === "currency")) return (Number(av) - Number(bv)) * mul;
        return String(av).localeCompare(String(bv)) * mul;
      });
    }
    return r;
  }, [data, q, sortKey, dir]);
  return (
    <View style={s.table}>
      {config.searchable && <TextInput style={s.input} placeholder={config.searchPlaceholder || "Search…"} placeholderTextColor="#9CA3AF" value={q} onChangeText={setQ} />}
      <View style={[s.tableRow, s.tableHead]}>
        {cols.map((c) => (
          <Pressable key={c.key} style={s.tableCell} onPress={() => { if (sortKey === c.key) setDir(dir === "asc" ? "desc" : "asc"); else setSortKey(c.key); }}>
            <Text style={s.tableHeadText}>{c.label}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList data={rows} keyExtractor={(_, i) => String(i)} renderItem={({ item }) => (
        <View style={s.tableRow}>
          {cols.map((c) => <View key={c.key} style={s.tableCell}><Text style={s.tableCellText}>{formatCell(item[c.key], c)}</Text></View>)}
        </View>
      )} ListEmptyComponent={<Text style={s.muted}>{config.emptyMessage || "No data"}</Text>} />
    </View>
  );
}

// ── Timeline: step active/completed logic (timeline.ts) ──────
function mapStatus(v) {
  const l = String(v || "").toLowerCase();
  if (["completed","done","approved","reimbursed","success"].includes(l)) return "completed";
  if (["active","running","current","pending_manager","pending_finance","pending_department_head"].includes(l)) return "active";
  if (["failed","error","rejected"].includes(l)) return "failed";
  return "pending";
}
export function Timeline({ data, config, activeStepValue }) {
  let activeIndex = -1;
  const items = (data || []).map((row, i) => {
    let status = "pending";
    if (activeStepValue != null && config.activeMatchKey) {
      if (row[config.activeMatchKey] === activeStepValue) { status = "active"; activeIndex = i; }
      else if (activeIndex >= 0) status = "pending"; else status = "completed";
    } else if (config.statusKey) status = mapStatus(row[config.statusKey]);
    else status = "completed";
    return { key: String(row.id || row.step_key || i), title: String(row[config.titleKey] || ""), subtitle: config.subtitleKey ? String(row[config.subtitleKey] || "") : "", comment: config.commentKey ? row[config.commentKey] : "", status };
  });
  const dot = { completed: "#10B981", active: "#3B82F6", pending: "#9CA3AF", failed: "#EF4444" };
  return (
    <View style={s.col}>
      {items.map((it) => (
        <View key={it.key} style={s.timelineItem}>
          <View style={[s.timelineDot, { backgroundColor: dot[it.status] || "#9CA3AF" }]} />
          <View style={s.flex}>
            <Text style={s.timelineTitle}>{it.title}</Text>
            {!!it.subtitle && <Text style={s.muted}>{it.subtitle}</Text>}
            {!!it.comment && <Text style={s.muted}>{String(it.comment)}</Text>}
          </View>
        </View>
      ))}
    </View>
  );
}

// ── SelectInput (minimal RN picker) ──────────────────────────
export function SelectInput({ options, value, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const opts = (options || []).map((o) => typeof o === "string" ? { label: o, value: o } : o);
  const cur = opts.find((o) => o.value === value);
  return (
    <View>
      <Pressable style={s.input} onPress={() => setOpen(!open)}><Text style={cur ? s.text : s.muted}>{cur ? cur.label : (placeholder || "Select")}</Text></Pressable>
      {open && opts.map((o) => (
        <Pressable key={String(o.value)} style={s.selectOption} onPress={() => { onChange(o.value); setOpen(false); }}>
          <Text style={s.text}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ── DateField (text date entry; avoids extra native dep) ─────
export function DateField({ value, onChange }) {
  return <TextInput style={s.input} placeholder="YYYY-MM-DD" placeholderTextColor="#9CA3AF" value={value || ""} onChangeText={onChange} />;
}

// ── FileUpload (expo-image-picker) ───────────────────────────
export function FileUpload({ projectId, onUploaded }) {
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const pick = async () => {
    try {
      setBusy(true);
      const ImagePicker = require("expo-image-picker");
      const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
      if (r.canceled) return;
      const asset = r.assets[0];
      const fd = new FormData();
      fd.append("projectId", projectId);
      fd.append("file", { uri: asset.uri, name: asset.fileName || "upload.jpg", type: asset.mimeType || "image/jpeg" });
      const origin = require("../lib/mint-runtime").API_ORIGIN || "";
      const res = await fetch(origin + "/api/upload", { method: "POST", body: fd });
      const j = await res.json();
      if (j.url) { setName(asset.fileName || "uploaded"); onUploaded(j.url); }
    } catch (e) { console.warn(e); } finally { setBusy(false); }
  };
  return <Pressable style={s.button} onPress={pick}><Text style={s.buttonText}>{busy ? "Uploading…" : name ? ("✓ " + name) : "Upload Receipt"}</Text></Pressable>;
}

// ── MintImage (physique / food / avatar) ─────────────────────
export function MintImage({ src, config }) {
  const cfg = config || {};
  const h = cfg.height || 160;
  const radius = cfg.radius != null ? cfg.radius : 8;
  if (!src) return <View style={[s.imagePlaceholder, { height: h, borderRadius: radius }]}><Text style={s.muted}>No image</Text></View>;
  return <Image source={{ uri: String(src) }} style={{ width: "100%", height: h, borderRadius: radius }} resizeMode={cfg.fit === "contain" ? "contain" : "cover"} />;
}

// ── Camera (capture via expo-image-picker, upload, return URL) ─
export function Camera({ config, projectId, onCaptured }) {
  const cfg = config || {};
  const [busy, setBusy] = useState(false);
  const [uri, setUri] = useState("");
  const shoot = async () => {
    try {
      setBusy(true);
      const ImagePicker = require("expo-image-picker");
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { console.warn("Camera permission denied"); return; }
      const r = await ImagePicker.launchCameraAsync({ quality: cfg.quality || 0.7, cameraType: cfg.facing === "front" ? "front" : "back" });
      if (r.canceled) return;
      const asset = r.assets[0];
      setUri(asset.uri);
      const fd = new FormData();
      fd.append("projectId", projectId);
      fd.append("file", { uri: asset.uri, name: asset.fileName || "photo.jpg", type: asset.mimeType || "image/jpeg" });
      const origin = require("../lib/mint-runtime").API_ORIGIN || "";
      const res = await fetch(origin + (cfg.uploadUrl || "/api/upload"), { method: "POST", body: fd });
      const j = await res.json();
      if (j.url) onCaptured(j.url);
    } catch (e) { console.warn(e); } finally { setBusy(false); }
  };
  return (
    <View style={s.col}>
      {cfg.previewEnabled !== false && !!uri && <Image source={{ uri }} style={{ width: "100%", height: 200, borderRadius: 10 }} />}
      <Pressable style={s.button} onPress={shoot}><Text style={s.buttonText}>{busy ? "Uploading…" : ("📷 " + (cfg.label || "Take Photo"))}</Text></Pressable>
    </View>
  );
}

// ── Chart (line / bar / area — pure RN Views, no native dep) ──
export function Chart({ data, config }) {
  const cfg = config || {};
  const rows = (cfg.maxPoints ? (data || []).slice(-cfg.maxPoints) : (data || [])).map((r) => Number(r[cfg.yKey] ?? 0));
  const H = cfg.height || 180;
  const color = cfg.color || "#6366F1";
  if (!rows.length) return <View style={[s.card, { height: H, alignItems: "center", justifyContent: "center" }]}><Text style={s.muted}>{(cfg.title ? cfg.title + ": " : "") + "No data"}</Text></View>;
  const min = Math.min(...rows, 0), max = Math.max(...rows, 1), span = (max - min) || 1;
  return (
    <View style={s.card}>
      {!!cfg.title && <Text style={s.muted}>{cfg.title}</Text>}
      <View style={{ flexDirection: "row", alignItems: "flex-end", height: H, gap: 4 }}>
        {rows.map((y, i) => (
          <View key={i} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
            {cfg.showValues && <Text style={[s.muted, { fontSize: 9 }]}>{y}</Text>}
            <View style={{ width: "70%", height: Math.max(2, ((y - min) / span) * (H - 16)), backgroundColor: color, borderRadius: 3, opacity: cfg.type === "area" ? 0.5 : 1 }} />
          </View>
        ))}
      </View>
    </View>
  );
}

// ── StatCard (metric tile) ───────────────────────────────────
export function StatCard({ value, delta, config }) {
  const cfg = config || {};
  const dn = delta != null ? Number(delta) : NaN;
  const goodDown = cfg.deltaDirection === "down-good";
  const deltaColor = isNaN(dn) ? "#9CA3AF" : ((dn < 0) === goodDown ? "#10B981" : "#EF4444");
  return (
    <View style={s.statCard}>
      <View style={s.row}>
        {!!cfg.icon && <Text style={s.muted}>{cfg.icon}</Text>}
        <Text style={s.muted}>{cfg.label}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
        <Text style={[s.statValue, cfg.color ? { color: cfg.color } : null]}>{String(value ?? "")}</Text>
        {!!cfg.unit && <Text style={s.muted}>{cfg.unit}</Text>}
      </View>
      {delta != null && String(delta) !== "" && <Text style={{ color: deltaColor, fontSize: 12 }}>{!isNaN(dn) && dn > 0 ? "▲ " : !isNaN(dn) && dn < 0 ? "▼ " : ""}{String(delta)}</Text>}
    </View>
  );
}
`;
}

function stylesFile(): string {
  return `import { StyleSheet } from "react-native";
export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0B0B0F" },
  screenContent: { padding: 16, gap: 12 },
  flex: { flex: 1 },
  col: { flexDirection: "column", gap: 8 },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  text: { color: "#E5E7EB", fontSize: 15 },
  muted: { color: "#9CA3AF", fontSize: 13 },
  button: { backgroundColor: "#6366F1", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  input: { borderWidth: 1, borderColor: "#2A2A35", borderRadius: 10, padding: 12, color: "#E5E7EB", backgroundColor: "#15151C" },
  textArea: { minHeight: 90, textAlignVertical: "top" },
  card: { backgroundColor: "#15151C", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#23232E", gap: 8 },
  chip: { alignSelf: "flex-start", borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  chipText: { fontSize: 12, fontWeight: "600" },
  table: { gap: 4 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#23232E", paddingVertical: 8 },
  tableHead: { borderBottomWidth: 2 },
  tableHeadText: { color: "#9CA3AF", fontWeight: "700", fontSize: 12 },
  tableCell: { flex: 1, paddingHorizontal: 4 },
  tableCellText: { color: "#E5E7EB", fontSize: 13 },
  selectOption: { padding: 12, borderWidth: 1, borderColor: "#2A2A35", borderTopWidth: 0 },
  timelineItem: { flexDirection: "row", gap: 10, paddingVertical: 6 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  timelineTitle: { color: "#E5E7EB", fontSize: 15, fontWeight: "600" },
  imagePlaceholder: { backgroundColor: "#15151C", borderWidth: 1, borderColor: "#23232E", alignItems: "center", justifyContent: "center" },
  statCard: { backgroundColor: "#15151C", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#23232E", gap: 4, minWidth: 120 },
  statValue: { color: "#E5E7EB", fontSize: 26, fontWeight: "700" },
});
`;
}

// ── Public entry ─────────────────────────────────────────────

export function buildReactNativeFromSchema(
  schema: AppSchema,
  opts: RNSchemaOptions
): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const screens = schema.screens || [];

  // Routes: first screen is index
  const routes = screens.map((sc, i) => ({
    screen: sc,
    isHome: i === 0,
    route: i === 0 ? "index" : slug(sc.name),
  }));

  // screenId -> expo-router path (home is "/"), used by the runtime to
  // resolve "navigate:<screenId>" and post-action navigation.
  const routesMap: Record<string, string> = {};
  for (const r of routes) routesMap[r.screen.id] = r.isHome ? "/" : "/" + r.route;

  // actionName -> screenId to navigate to after the action succeeds,
  // declared per-action via config.navigateTo in the runtime schema.
  const navAfter: Record<string, string> = {};
  for (const a of (schema.globalActions || []) as any[]) {
    const target = a?.config?.navigateTo;
    if (target) navAfter[a.name] = String(target);
  }

  // app/_layout.tsx
  files.push({
    path: "app/_layout.tsx",
    type: "text",
    content: `import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { MintProvider } from "../lib/mint-runtime";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <MintProvider>
        <Stack screenOptions={{ headerStyle: { backgroundColor: "#0B0B0F" }, headerTintColor: "#fff", contentStyle: { backgroundColor: "#0B0B0F" } }}>
${routes.map((r) => `          <Stack.Screen name="${r.route}" options={{ title: ${JSON.stringify(r.screen.name)} }} />`).join("\n")}
        </Stack>
      </MintProvider>
    </SafeAreaProvider>
  );
}
`,
  });

  // screen files
  for (const r of routes) {
    files.push({
      path: r.isHome ? "app/index.tsx" : `app/${r.route}.tsx`,
      type: "text",
      content: emitScreen(r.screen, r.isHome),
    });
  }

  files.push({ path: "lib/mint-runtime.tsx", type: "text", content: runtimeFile(opts, routesMap, navAfter) });
  files.push({ path: "components/MintComponents.tsx", type: "text", content: mintComponentsFile() });
  files.push({ path: "lib/styles.ts", type: "text", content: stylesFile() });

  // package.json — pinned to the Expo SDK 54 lockstep so `npm i` resolves
  // cleanly. react AND react-dom must share an exact version (expo-router
  // pulls react-dom transitively via its web deps; an unpinned react-dom
  // floats to a newer patch and conflicts with react@19.1.0). TypeScript +
  // @types/react are declared so `expo start` never prompts a side-install.
  files.push({
    path: "package.json",
    type: "text",
    content: JSON.stringify({
      name: slug(opts.appName || schema.name || "expense-rn"),
      main: "expo-router/entry",
      version: "1.0.0",
      scripts: {
        start: "expo start",
        android: "expo start --android",
        ios: "expo start --ios",
        web: "expo start --web",
        lint: "expo lint",
      },
      dependencies: {
        "expo": "~54.0.33",
        "expo-constants": "~18.0.13",
        "expo-image-picker": "~17.0.8",
        "expo-linking": "~8.0.11",
        "expo-router": "~6.0.23",
        "expo-status-bar": "~3.0.9",
        "react": "19.1.0",
        "react-dom": "19.1.0",
        "react-native": "0.81.5",
        "react-native-safe-area-context": "~5.6.0",
        "react-native-screens": "~4.16.0",
        "react-native-web": "~0.21.0",
      },
      devDependencies: {
        "@types/react": "~19.1.10",
        "typescript": "~5.9.2",
        "eslint": "^9.25.0",
        "eslint-config-expo": "~10.0.0",
      },
      private: true,
    }, null, 2),
  });

  // app.json
  const appName = opts.appName || schema.name || "Mint App";
  const appSlug = slug(appName);
  const baseOrigin = opts.apiOrigin || "https://mintweb.mintit.pro";
  files.push({
    path: "app.json",
    type: "text",
    content: JSON.stringify({
      expo: {
        name: appName,
        slug: appSlug,
        version: "1.0.0",
        orientation: "portrait",
        scheme: appSlug,
        userInterfaceStyle: "automatic",
        newArchEnabled: true,
        ios: { supportsTablet: true, infoPlist: { NSCameraUsageDescription: "This app uses the camera to capture photos.", NSPhotoLibraryUsageDescription: "This app accesses your photos to upload images." } },
        android: { edgeToEdgeEnabled: true },
        plugins: [
          "expo-router",
          ["expo-image-picker", { cameraPermission: "Allow $(PRODUCT_NAME) to access your camera." }],
        ],
        experiments: { typedRoutes: true },
      },
    }, null, 2),
  });

  // tsconfig.json
  files.push({
    path: "tsconfig.json",
    type: "text",
    content: JSON.stringify({
      extends: "expo/tsconfig.base",
      compilerOptions: { strict: true, paths: { "@/*": ["./*"] } },
      include: ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"],
    }, null, 2),
  });

  // .gitignore
  files.push({
    path: ".gitignore",
    type: "text",
    content: `node_modules/
.expo/
dist/
web-build/
expo-env.d.ts
*.orig.*
.metro-health-check*
npm-debug.*
yarn-debug.*
yarn-error.*
.DS_Store
*.pem
.env*.local
*.tsbuildinfo
/ios
/android
`,
  });

  // eslint.config.js (matches the create-expo-app template)
  files.push({
    path: "eslint.config.js",
    type: "text",
    content: `// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
]);
`,
  });

  // README.md
  files.push({
    path: "README.md",
    type: "text",
    content: `# ${appName}

Generated by Mint — an Expo (React Native) app driven by your runtime schema.
Screens live in \`app/\` (Expo Router); shared widgets in \`components/MintComponents.tsx\`;
the state/actions/navigation runtime in \`lib/mint-runtime.tsx\`.

## Run

\`\`\`bash
npm install
npm run start      # then press i / a, or scan the QR with Expo Go
\`\`\`

## Connecting to the backend (important)

This app talks to the Mint API at \`API_ORIGIN\` (baked to the editor you exported
from). On a **physical phone or Android emulator, \`localhost\` is the device itself**,
not your computer — so a \`localhost\` origin fails with "Network request failed".

Point the app at a host the device can reach by creating a \`.env\` file
(see \`.env.example\`) and restarting Metro — **no re-export needed**:

\`\`\`bash
# .env  — use your computer's LAN IP (run \`ifconfig\` / \`ipconfig\`)
EXPO_PUBLIC_API_ORIGIN=http://192.168.1.20:3001
\`\`\`

- iOS simulator: \`http://localhost:3001\` works (it shares the host network).
- Android emulator: use \`http://10.0.2.2:3001\`.
- Physical device: use your computer's LAN IP, and make sure the phone is on the
  same Wi-Fi and your dev server is reachable (firewall allowing the port).

## Live Sync (optional)

If exported with Live Sync enabled, \`npm run start\` also launches \`mint-connector.mjs\`,
which polls the editor and writes new commits to disk so Metro hot-reloads your changes.
Re-point it any time without re-exporting:

\`\`\`bash
MINT_EDITOR_ORIGIN=http://localhost:3001 MINT_AUTH_TOKEN=<token> npm run sync
\`\`\`
`,
  });

  // .env.example — Expo inlines EXPO_PUBLIC_* vars at build time.
  files.push({
    path: ".env.example",
    type: "text",
    content: `# Copy to .env and restart Metro (npm run start) to apply.

# API host the device can reach. On a phone/emulator this is NOT localhost:
#   iOS simulator:    same as the editor (localhost works)
#   Android emulator: replace the host with 10.0.2.2
#   Physical device:  replace the host with your computer's LAN IP
# Baked default (the editor you exported from):
EXPO_PUBLIC_API_ORIGIN=${baseOrigin}

# Optional: override the baked project sync token used for managed-DB calls.
# EXPO_PUBLIC_MINT_TOKEN=
`,
  });

  // The emitted .ts/.tsx is machine-generated (and regenerated on every
  // export/commit), so it is intentionally written in a loose, untyped style.
  // Exclude it from the project's strict TypeScript checking with @ts-nocheck
  // so the editor and `tsc` don't flag the generated files — the user's own
  // hand-written code stays fully type-checked. Metro/Babel ignore types and
  // run the code regardless; this only silences static analysis of generated files.
  for (const f of files) {
    if (
      f.type === "text" &&
      typeof f.content === "string" &&
      /\.(ts|tsx)$/.test(f.path) &&
      !f.content.startsWith("// @ts-nocheck")
    ) {
      f.content = "// @ts-nocheck\n" + f.content;
    }
  }

  return files;
}
