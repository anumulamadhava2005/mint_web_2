// ═══════════════════════════════════════════════════════════════
// reactNativeSchema — AppSchema → React Native (Expo) emitter
//
// SCHEMA-DRIVEN AT RUNTIME (mirrors reactWebSchema.ts): the AppSchema is
// baked as data (lib/schema.ts) and rendered by a generic RN SchemaRenderer
// against the SAME framework-agnostic engine as the web export
// (lib/runtime/bundle → createMintRuntime): expression bindings, two-way
// inputs, real action dispatch (signUp/dbQuery/navigate/…), repeaters.
// Screens are NOT static codegen — they just host their schema screen.
// ═══════════════════════════════════════════════════════════════

import type {
  AppSchema,
  ComponentSchema,
  StyleSchema,
} from "../../runtime/schema";
import { generateMintRuntimeBundle } from "../../runtime/bundle";

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

// ── Style conversion: StyleSchema → React Native style object ─
// RN styles differ from web CSS (numeric props, flex enums, per-corner
// radius, textDecorationLine, etc.), so we can't reuse styleToCss here.

type RNStyle = Record<string, unknown>;

function applyBox(out: RNStyle, prop: string, v: unknown): void {
  if (v == null) return;
  if (Array.isArray(v)) {
    out[prop + "Top"] = v[0]; out[prop + "Right"] = v[1];
    out[prop + "Bottom"] = v[2]; out[prop + "Left"] = v[3];
  } else out[prop] = v;
}

function styleToRN(style: StyleSchema | undefined): RNStyle {
  const out: RNStyle = {};
  if (!style) return out;
  const L = style.layout || {};
  if (L.position) out.position = L.position === "absolute" ? "absolute" : "relative";
  if (typeof L.left === "number") out.left = L.left;
  if (typeof L.top === "number") out.top = L.top;
  if (typeof L.right === "number") out.right = L.right;
  if (typeof L.bottom === "number") out.bottom = L.bottom;
  if (typeof L.zIndex === "number") out.zIndex = L.zIndex;
  if (L.display === "none") out.display = "none";
  if (L.direction) out.flexDirection = String(L.direction).startsWith("row") ? "row" : "column";
  const jmap: Record<string, string> = { start: "flex-start", center: "center", end: "flex-end", between: "space-between", around: "space-around", evenly: "space-evenly" };
  if (L.justify) out.justifyContent = jmap[L.justify] || "flex-start";
  const amap: Record<string, string> = { start: "flex-start", center: "center", end: "flex-end", stretch: "stretch", baseline: "baseline" };
  if (L.align) out.alignItems = amap[L.align] || "stretch";
  if (L.wrap) out.flexWrap = "wrap";
  if (typeof L.gap === "number") out.gap = L.gap;

  const SP = style.spacing || {};
  applyBox(out, "padding", SP.padding);
  applyBox(out, "margin", SP.margin);

  const SZ = style.sizing || {};
  if (SZ.width != null) out.width = SZ.width;
  if (SZ.height != null) out.height = SZ.height;
  if (SZ.minWidth != null) out.minWidth = SZ.minWidth;
  if (SZ.minHeight != null) out.minHeight = SZ.minHeight;
  if (SZ.maxWidth != null) out.maxWidth = SZ.maxWidth;
  if (SZ.maxHeight != null) out.maxHeight = SZ.maxHeight;
  if (typeof SZ.flex === "number") out.flex = SZ.flex;

  const BG = style.background || {};
  if (BG.color) out.backgroundColor = BG.color;
  if (typeof BG.opacity === "number") out.opacity = BG.opacity;

  const BR = style.border || {};
  if (typeof BR.width === "number") out.borderWidth = BR.width;
  if (BR.color) out.borderColor = BR.color;
  if (BR.radius != null) {
    if (Array.isArray(BR.radius)) {
      out.borderTopLeftRadius = BR.radius[0]; out.borderTopRightRadius = BR.radius[1];
      out.borderBottomRightRadius = BR.radius[2]; out.borderBottomLeftRadius = BR.radius[3];
    } else out.borderRadius = BR.radius;
  }

  const T = style.typography || {};
  if (T.color) out.color = T.color;
  if (typeof T.fontSize === "number") out.fontSize = T.fontSize;
  if (T.fontWeight) out.fontWeight = String(T.fontWeight);
  if (T.fontFamily) out.fontFamily = T.fontFamily;
  if (T.fontStyle) out.fontStyle = T.fontStyle;
  if (T.textAlign) out.textAlign = T.textAlign;
  if (typeof T.lineHeight === "number") out.lineHeight = T.lineHeight;
  if (typeof T.letterSpacing === "number") out.letterSpacing = T.letterSpacing;
  if (T.textDecoration && T.textDecoration !== "none") out.textDecorationLine = T.textDecoration;

  const E = style.effects || {};
  if (E.overflow) out.overflow = E.overflow;

  return out;
}

/** styleToRN for every component id across all screens (recurses children). */
function collectRNStyles(schema: AppSchema): Record<string, RNStyle> {
  const out: Record<string, RNStyle> = {};
  const walk = (comps: ComponentSchema[] | undefined) => {
    for (const c of comps ?? []) {
      const st = styleToRN(c.style);
      if (Object.keys(st).length) out[c.id] = st;
      if (c.children?.length) walk(c.children);
    }
  };
  for (const s of schema.screens ?? []) walk(s.components);
  return out;
}

// ── schema.ts — baked AppSchema + maps + config ──────────────

function schemaFile(schema: AppSchema, opts: RNSchemaOptions, routesMap: Record<string, string>, themeBg: string): string {
  return `// Auto-generated — the runtime AppSchema this app is driven by.
export const SCHEMA = ${JSON.stringify(schema)};
export const ROUTES = ${JSON.stringify(routesMap)};
export const THEME_BG = ${JSON.stringify(themeBg)};
export const STYLES = ${JSON.stringify(collectRNStyles(schema))};
export const PROJECT_ID = ${JSON.stringify(opts.projectId)};
export const API_ORIGIN_DEFAULT = ${JSON.stringify(opts.apiOrigin || "https://mintweb.mintit.pro")};
export const AUTH_TOKEN_DEFAULT = ${JSON.stringify(opts.authToken || "")};
`;
}

// ── MintProvider.tsx — wires the runtime to React + expo-router ─

function providerFile(): string {
  return `import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createMintRuntime, configureMint, hydrateSession } from "./mint-runtime";
import { SCHEMA, ROUTES, PROJECT_ID as _PID, API_ORIGIN_DEFAULT, AUTH_TOKEN_DEFAULT } from "./schema";

// Backend origin + project token. Override per-environment with a .env file
// (Expo inlines EXPO_PUBLIC_* at build time); falls back to the values baked
// at export. On a phone/Android emulator "localhost" is the DEVICE — point
// EXPO_PUBLIC_API_ORIGIN at your machine's LAN IP.
export const API_ORIGIN =
  (typeof process !== "undefined" && process.env && process.env.EXPO_PUBLIC_API_ORIGIN) || API_ORIGIN_DEFAULT;
export const AUTH_TOKEN =
  (typeof process !== "undefined" && process.env && process.env.EXPO_PUBLIC_MINT_TOKEN) || AUTH_TOKEN_DEFAULT;
export const PROJECT_ID = _PID;
// Persist the signed-in session across app launches via AsyncStorage.
const _rnStorage = {
  getItem: (k) => AsyncStorage.getItem(k),
  setItem: (k, v) => AsyncStorage.setItem(k, v),
  removeItem: (k) => AsyncStorage.removeItem(k),
};
// Must run before createMintRuntime so the DB/auth client picks up base + token.
configureMint({ apiOrigin: API_ORIGIN, authToken: AUTH_TOKEN, projectId: PROJECT_ID, storage: _rnStorage });

const Ctx = createContext(null);
export function useMint() { return useContext(Ctx); }

function routeFor(target) {
  if (!target) return "/";
  if (ROUTES[target]) return ROUTES[target];            // screenId → path
  return String(target)[0] === "/" ? String(target) : "/" + target;
}

export function MintProvider({ children }) {
  const ref = useRef(null);
  if (!ref.current) ref.current = createMintRuntime(SCHEMA);
  const runtime = ref.current;
  const [, force] = useReducer((x) => x + 1, 0);
  const [hydrated, setHydrated] = useState(false);

  // Restore a persisted session before rendering, then re-render on any change.
  useEffect(() => { Promise.resolve(hydrateSession(runtime, { userPath: "user" })).finally(() => setHydrated(true)); }, []);
  useEffect(() => runtime.state.subscribe("", () => force()), []);

  const navigation = useMemo(() => ({
    navigate: (r) => router.push(routeFor(r)),
    goBack: () => router.back(),
    replace: (r) => router.replace(routeFor(r)),
    reset: (routes) => { if (routes && routes[0]) router.replace(routeFor(routes[0])); },
  }), []);

  const dispatch = useMemo(() => (refs, event) => {
    const list = Array.isArray(refs) ? refs : [refs];
    for (const r of list) Promise.resolve(runtime.actions.dispatch(r, { navigation, event })).catch((e) => {
      const msg = (e && e.message) || String(e);
      console.error("[mint] action failed:", msg);
      runtime.state.set("_lastError", msg); // bind a component to $_lastError to surface it
    });
  }, [navigation]);

  const value = useMemo(() => ({ runtime, dispatch, navigation }), [dispatch, navigation]);
  return React.createElement(Ctx.Provider, { value }, hydrated ? children : null);
}
`;
}

// ── SchemaRenderer.tsx — generic RN renderer (ports the web one) ─

function rendererFile(): string {
  return `import React from "react";
import { View, Text, TextInput, Pressable, ScrollView, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMint, PROJECT_ID } from "../lib/MintProvider";
import { STYLES, SCHEMA } from "../lib/schema";
import { DataTable, Timeline, StatusChip, SelectInput, DateField, FileUpload, MintImage, Camera, Chart, StatCard } from "./MintComponents";

// Screen = the top-level components for a route, in a scrollable safe area.
export function Screen({ components, background }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: background || "#0B0B0F" }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 16 }}>
        <View style={{ flex: 1, position: "relative" }}>
          {(components || []).map((c) => <Node key={c.id} comp={c} />)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ScreenHost runs the screen's onMount actions (e.g. dbQuery loads), then renders it.
export function ScreenHost({ screen, background }) {
  const { dispatch, runtime, navigation } = useMint();
  React.useEffect(() => {
    // Protected screen: redirect to login when there's no authenticated user.
    if (screen.requiresAuth) {
      const u = runtime.state.get("user");
      const login = (SCHEMA.navigation && SCHEMA.navigation.loginRoute) || "/";
      if ((!u || !u.id) && screen.route !== login) { navigation.navigate(login); return; }
    }
    (screen.onMount || []).forEach((a) => dispatch([a]));
    (screen.localState || []).forEach((d) => { if (d.async && d.async.autoFetch && d.async.source) dispatch([d.async.source]); });
    // eslint-disable-next-line
  }, [screen.id]);
  return <Screen components={screen.components} background={background} />;
}

// Row height for repeaters = the children's bounding box, so absolutely
// positioned children don't stack on top of each other (per-row context).
function rowHeightOf(children) {
  let h = 0;
  for (const ch of children || []) {
    const st = STYLES[ch.id] || {};
    const t = Number(st.top) || 0;
    const hh = Number(st.height) || 0;
    if (t + hh > h) h = t + hh;
  }
  return h || undefined;
}

function Node({ comp, loopCtx }) {
  const { runtime, dispatch } = useMint();
  const ctx = { ...runtime.state.getContext(), ...(loopCtx || {}) };

  // visibility (role + conditionalRender)
  if (comp.requiredRoles && comp.requiredRoles.length) {
    const role = ctx.user && ctx.user.role;
    if (!role || comp.requiredRoles.indexOf(role) === -1) return null;
  }
  if (comp.conditionalRender) {
    try { if (!runtime.evalExpr(comp.conditionalRender, ctx)) return null; } catch {}
  }

  // resolve bound props
  const props = { ...(comp.props || {}) };
  const b = comp.bindings || {};
  for (const k in b) { try { props[k] = runtime.evalExpr(b[k], ctx); } catch {} }

  const style = STYLES[comp.id] || {};
  const ev = comp.events || {};
  const fire = (refs) => { if (refs && refs.length) dispatch(refs); };
  const setBound = (key, v) => { const expr = b[key]; if (expr) runtime.state.set(String(expr).replace(/^\\$/, ""), v); };
  const kids = (lc) => (comp.children || []).map((ch) => <Node key={ch.id} comp={ch} loopCtx={lc || loopCtx} />);

  const bindVal = b.value || b.inputBind;
  const setVal = (v) => { if (bindVal) runtime.state.set(String(bindVal).replace(/^\\$/, ""), v); fire(ev.onChange); };
  const it = props.inputType ? String(props.inputType) : null;
  const kbType = (t) => (t === "email" ? "email-address" : t === "number" ? "numeric" : t === "tel" ? "phone-pad" : "default");

  switch (comp.type) {
    case "text":
      return <Text style={style}>{String(props.text ?? props.value ?? "")}</Text>;

    case "button": {
      const label = String(props.text ?? props.label ?? "Button");
      const textStyle = { color: style.color || "#fff", fontSize: style.fontSize || 15, fontWeight: style.fontWeight || "600", textAlign: "center" };
      return (
        <Pressable style={style} disabled={!!props.disabled} onPress={() => fire(ev.onClick || ev.onPress)}>
          <Text style={textStyle}>{label}</Text>
        </Pressable>
      );
    }

    case "input":
    case "searchInput":
      return (
        <TextInput
          style={style}
          value={props.value != null ? String(props.value) : ""}
          onChangeText={setVal}
          placeholder={props.placeholder != null ? String(props.placeholder) : ""}
          placeholderTextColor="#9CA3AF"
          secureTextEntry={it === "password"}
          keyboardType={kbType(it)}
          autoCapitalize={(it === "email" || it === "password") ? "none" : "sentences"}
        />
      );

    case "select":
      return <SelectInput options={props.options || props.enumValues || []} value={props.value} onChange={(v) => setVal(v)} placeholder={props.placeholder} />;

    case "datePicker":
      return <DateField value={props.value} onChange={(v) => setVal(v)} />;

    case "statusChip": return <StatusChip value={props.value} />;
    case "dataTable": return <DataTable data={Array.isArray(props.dataSource) ? props.dataSource : []} config={props} />;
    case "timeline": return <Timeline data={Array.isArray(props.dataSource) ? props.dataSource : []} config={props} activeStepValue={props.activeStepValue} />;
    case "chart": return <Chart data={Array.isArray(props.dataSource) ? props.dataSource : []} config={props} />;
    case "statCard": return <StatCard value={props.value} delta={props.delta} config={props} />;
    case "fileUpload": return <FileUpload projectId={PROJECT_ID} onUploaded={(url) => setBound("value", url)} />;
    case "camera": return <Camera config={props} projectId={PROJECT_ID} onCaptured={(url) => setBound("value", url)} />;
    case "image":
      return props.src ? <MintImage src={String(props.src)} config={props} /> : <View style={style} />;

    default: {
      // frame-as-input (LayerContent.inputType on a frame)
      if (it && comp.type === "frame") {
        if (it === "textarea")
          return <TextInput style={style} multiline numberOfLines={4} value={props.value != null ? String(props.value) : ""} onChangeText={setVal} placeholder={props.placeholder ? String(props.placeholder) : ""} placeholderTextColor="#9CA3AF" />;
        if (it === "select")
          return <SelectInput options={props.selectOptions || props.options || []} value={props.value} onChange={(v) => setVal(v)} placeholder={props.placeholder} />;
        if (it === "checkbox")
          return <Pressable style={style} onPress={() => setVal(!props.value)}><Text style={{ color: style.color || "#E5E7EB" }}>{props.value ? "☑" : "☐"} {props.placeholder || ""}</Text></Pressable>;
        return <TextInput style={style} value={props.value != null ? String(props.value) : ""} onChangeText={setVal} placeholder={props.placeholder ? String(props.placeholder) : ""} placeholderTextColor="#9CA3AF" secureTextEntry={it === "password"} keyboardType={kbType(it)} autoCapitalize={(it === "email" || it === "password") ? "none" : "sentences"} />;
      }

      // repeater (list / grid / frame with repeatFor)
      if (comp.repeatFor) {
        let items = [];
        try { const v = runtime.evalExpr(comp.repeatFor.items, ctx); items = Array.isArray(v) ? v : []; } catch {}
        const as = comp.repeatFor.as || "item";
        const rh = rowHeightOf(comp.children);
        const rows = items.map((row, i) => (
          <View key={i} style={rh ? { position: "relative", height: rh } : { position: "relative" }}>
            {(comp.children || []).map((ch) => <Node key={ch.id} comp={ch} loopCtx={{ ...loopCtx, [as]: row }} />)}
          </View>
        ));
        return ev.onClick
          ? <Pressable style={style} onPress={() => fire(ev.onClick)}>{rows}</Pressable>
          : <View style={style}>{rows}</View>;
      }

      return ev.onClick
        ? <Pressable style={style} onPress={() => fire(ev.onClick)}>{kids()}</Pressable>
        : <View style={style}>{kids()}</View>;
    }
  }
}
`;
}

// ── Screen file — just hosts its schema screen (no static JSX) ─

function screenFile(name: string, index: number): string {
  return `import React from "react";
import { ScreenHost } from "../components/SchemaRenderer";
import { SCHEMA, THEME_BG } from "../lib/schema";

export default function ${compName(name)}() {
  return <ScreenHost screen={SCHEMA.screens[${index}]} background={THEME_BG} />;
}
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
      const origin = require("../lib/MintProvider").API_ORIGIN || "";
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
      const origin = require("../lib/MintProvider").API_ORIGIN || "";
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

  // Routes: first screen is index ("/"), the rest are slugged paths.
  const routes = screens.map((sc, i) => ({
    screen: sc,
    index: i,
    isHome: i === 0,
    route: i === 0 ? "index" : slug(sc.name),
  }));

  // screenId -> expo-router path (home is "/") — used by navigate-by-id.
  const routesMap: Record<string, string> = {};
  for (const r of routes) routesMap[r.screen.id] = r.isHome ? "/" : "/" + r.route;

  const themeBg = (schema.theme?.colors?.background as string) || "#0B0B0F";

  // app/_layout.tsx — wraps the app in MintProvider + the expo-router Stack.
  files.push({
    path: "app/_layout.tsx",
    type: "text",
    content: `import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { MintProvider } from "../lib/MintProvider";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <MintProvider>
        <Stack screenOptions={{ headerStyle: { backgroundColor: ${JSON.stringify(themeBg)} }, headerTintColor: "#fff", contentStyle: { backgroundColor: ${JSON.stringify(themeBg)} } }}>
${routes.map((r) => `          <Stack.Screen name="${r.route}" options={{ title: ${JSON.stringify(r.screen.name)} }} />`).join("\n")}
        </Stack>
      </MintProvider>
    </SafeAreaProvider>
  );
}
`,
  });

  // Screen files — each just hosts its schema screen (data-driven at runtime).
  for (const r of routes) {
    files.push({
      path: r.isHome ? "app/index.tsx" : `app/${r.route}.tsx`,
      type: "text",
      content: screenFile(r.screen.name, r.index),
    });
  }

  // Runtime + renderer + baked schema (mirrors the web export).
  files.push({ path: "lib/mint-runtime.js", type: "text", content: generateMintRuntimeBundle() });
  files.push({ path: "lib/schema.ts", type: "text", content: schemaFile(schema, opts, routesMap, themeBg) });
  files.push({ path: "lib/MintProvider.tsx", type: "text", content: providerFile() });
  files.push({ path: "components/SchemaRenderer.tsx", type: "text", content: rendererFile() });
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
        "@react-native-async-storage/async-storage": "2.1.2",
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
