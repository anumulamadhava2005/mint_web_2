// ═══════════════════════════════════════════════════════════════
// Mint Runtime Generator
// Generates a React context provider that bundles:
//   • Global state (useState for each variable)
//   • Actions (setState, fetch, navigate, etc.)
//   • Database proxy (query helper via mint-db bridge)
// ═══════════════════════════════════════════════════════════════

import type { ConversionOptions } from "../types";

interface StateVar {
  id: string;
  name: string;
  type: string;
  defaultValue: any;
}

interface ActionDef {
  id: string;
  name: string;
  type: string;
  config: any;
}

/**
 * Generates the MintRuntime provider + useMint hook as a React file.
 */
export function generateMintRuntimeProvider(
  options: ConversionOptions,
  isNative: boolean = false
): string {
  const schema = options.runtimeSchema;
  const states: StateVar[] = schema?.globalState ?? [];
  const actions: ActionDef[] = schema?.globalActions ?? [];
  const projectId = options.projectId ?? "UNKNOWN_PROJECT";
  const sanitizedId = projectId.replace(/[^a-zA-Z0-9_]/g, "");
  const tablePrefix = "mint_proj_" + sanitizedId + "_";
  const bridgeUrl = "https://api.mintit.pro/api/mint-db";

  // Build initial state object
  const initialState: Record<string, any> = {};
  for (const s of states) {
    initialState[s.name] = s.defaultValue ?? getDefaultForType(s.type);
  }

  // Auto-initialize parent objects for nested state paths referenced in actions
  // e.g. if an action uses $form.username, ensure form: {} exists in initial state
  const nestedParents = new Set<string>();
  for (const a of actions) {
    const cfg = a.config || {};
    const params: any[] = cfg.params ?? cfg.body?.params ?? [];
    for (const p of params) {
      if (typeof p === "string" && p.startsWith("$")) {
        const fullPath = p.slice(1);
        const parts = fullPath.split(".");
        if (parts.length > 1) nestedParents.add(parts[0]);
      }
    }
  }
  for (const parent of Array.from(nestedParents)) {
    if (!(parent in initialState)) {
      initialState[parent] = {};
    }
  }

  // Collect action names that are "fetch" type for loadTodosRef-style chaining
  const fetchActionNames = actions.filter((a) => a.type === "fetch").map((a) => a.name);

  // Build action function bodies
  const actionFns = actions
    .map((a) => buildActionFunction(a, fetchActionNames, isNative))
    .join("\n\n");

  // Build action refs for chaining (allows CALL from onSuccess)
  const actionRefs = fetchActionNames
    .map((n) => "  const " + n + "Ref = useRef<() => void>(() => {});\n  " + n + "Ref.current = " + n + ";")
    .join("\n");

  // ─── Build the output file ──────────────────────────────
  const lines: string[] = [];
  const L = (s: string) => lines.push(s);

  L('"use client";');
  L("// ═══════════════════════════════════════════════════════════════");
  L("// MintRuntime — Auto-generated state & actions provider");
  L("// Project: " + projectId);
  L("// ═══════════════════════════════════════════════════════════════");
  L('import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";');
  if (isNative) {
    L('import { useRouter } from "expo-router";');
  }
  L("");
  L("// ── Types ─────────────────────────────────────────────────────");
  L("interface MintState { [key: string]: any; }");
  L("interface MintActions { [key: string]: (...args: any[]) => void | Promise<void>; }");
  L("interface MintContextValue {");
  L("  state: MintState;");
  L('  setState: (key: string, value: any) => void;');
  L("  actions: MintActions;");
  L("  db: { query: (sql: string, params?: any[]) => Promise<any>; };");
  L("  updateSchema?: (schema: any, version: number) => void;");
  L("}");
  L("");
  L("const MintContext = createContext<MintContextValue | null>(null);");
  L("");
  L("// ── Constants ─────────────────────────────────────────────────");
  L('const DB_BRIDGE = "' + bridgeUrl + '";');
  L('const TABLE_PREFIX = "' + tablePrefix + '";');
  L("");
  L("// ── Table name prefixer ───────────────────────────────────────");
  L("function nsSQL(sql: string): string {");
  L("  let result = sql;");
  L("  result = result.replace(");
  L('    /\\b(FROM|JOIN|UPDATE|INTO|TABLE|EXISTS|ON)\\s+"([a-zA-Z][a-zA-Z0-9_]*)"/gi,');
  L("    (match: string, keyword: string, name: string) => {");
  L('      if (name.startsWith("pg_") || name.startsWith("mint_")) return match;');
  L("      return keyword + ' \"' + TABLE_PREFIX + name + '\"';");
  L("    }");
  L("  );");
  L("  return result;");
  L("}");
  L("");
  L("// ── DB query helper ───────────────────────────────────────────");
  L("async function dbQuery(sql: string, params: any[] = []): Promise<any> {");
  L("  const res = await fetch(DB_BRIDGE, {");
  L('    method: "POST",');
  L('    headers: { "Content-Type": "application/json" },');
  L("    body: JSON.stringify({ text: nsSQL(sql), params }),");
  L("  });");
  L("  if (!res.ok) {");
  L('    const errText = await res.text().catch(() => "");');
  L('    throw new Error("DB query failed (" + res.status + "): " + errText);');
  L("  }");
  L("  return res.json();");
  L("}");
  L("");
  L("// ── Initial State ─────────────────────────────────────────────");
  L("const INITIAL_STATE: MintState = " + JSON.stringify(initialState, null, 2) + ";");
  L("");
  L("// ── Provider ──────────────────────────────────────────────────");
  L("export function MintProvider({ children }: { children: React.ReactNode }) {");
  if (isNative) {
    L("  const router = useRouter();");
  }
  L("  const [state, _setState] = useState<MintState>({ ...INITIAL_STATE });");
  L("  const stateRef = useRef(state);");
  L("  stateRef.current = state;");
  L("");
  L('  const setState = useCallback((key: string, value: any) => {');
  L("    _setState((prev) => {");
  L('      if (key.includes(".")) {');
  L('        const parts = key.split(".");');
  L("        const newState = { ...prev };");
  L("        let obj: any = newState;");
  L("        for (let i = 0; i < parts.length - 1; i++) {");
  L("          obj[parts[i]] = { ...(obj[parts[i]] || {}) };");
  L("          obj = obj[parts[i]];");
  L("        }");
  L("        obj[parts[parts.length - 1]] = value;");
  L("        return newState;");
  L("      }");
  L("      return { ...prev, [key]: value };");
  L("    });");
  L("  }, []);");
  L("");
  L("  // ── Database proxy ────────────────────────────────────────");
  L("  const db = useCallback(() => ({ query: dbQuery }), []);");
  L("");
  L("  // ── Actions ───────────────────────────────────────────────");
  L(actionFns);
  L("");
  if (actionRefs) {
    L("  // ── Action refs (for chaining) ─────────────────────────");
    L(actionRefs);
    L("");
  }

  // NOTE: load* actions are NOT auto-fired on provider mount.
  // Use the onMount binding on individual screen frames instead.

  L("  const actions: MintActions = {");
  if (actions.length > 0) {
    L("    " + actions.map((a) => a.name).join(",\n    "));
  }
  L("  };");
  L("");
  L("  // ── Dynamic schema updates (for SDUI live sync) ──────────");
  L("  const [dynamicActions, setDynamicActions] = useState<MintActions | null>(null);");
  L("  const schemaVersionRef = useRef(0);");
  L("");
  L("  const updateSchema = useCallback((schema: any, version: number) => {");
  L("    if (!schema || version <= schemaVersionRef.current) return;");
  L("    schemaVersionRef.current = version;");
  L("");
  L("    // Merge new state defaults (only add missing keys)");
  L("    if (schema.globalState) {");
  L("      _setState((prev) => {");
  L("        const next = { ...prev };");
  L("        for (const s of schema.globalState) {");
  L("          if (!(s.name in next)) {");
  L('            next[s.name] = s.defaultValue ?? (s.type === "array" ? [] : s.type === "number" ? 0 : s.type === "boolean" ? false : "");');
  L("          }");
  L("        }");
  L("        // Auto-initialize parent objects for nested param refs (e.g. $form.username -> form: {})");
  L("        if (schema.globalActions) {");
  L("          for (const a of schema.globalActions) {");
  L("            const cfg = a.config || {};");
  L("            const ps = cfg.params || cfg.body?.params || [];");
  L("            for (const p of ps) {");
  L('              if (typeof p === "string" && p.startsWith("$")) {');
  L('                const parts = p.slice(1).split(".");');
  L('                if (parts.length > 1 && !(parts[0] in next)) { next[parts[0]] = {}; }');
  L("              }");
  L("            }");
  L("          }");
  L("        }");
  L("        return next;");
  L("      });");
  L("    }");
  L("");
  L("    // Build dynamic actions from schema definitions");
  L("    if (schema.globalActions) {");
  L("      const built: MintActions = {};");
  L("      for (const a of schema.globalActions) {");
  L("        built[a.name] = buildDynamicAction(a, stateRef, setState, dbQuery, built);");
  L("      }");
  L("      setDynamicActions(built);");
  L("    }");
  L("  }, [setState]);");
  L("");
  L("  const mergedActions = dynamicActions ? { ...actions, ...dynamicActions } : actions;");
  L("  const value: MintContextValue = { state, setState, actions: mergedActions, db: db(), updateSchema };");
  L("");

  // For React Native: auto-navigate when currentScreen state changes
  if (isNative) {
    L("  // ── Auto-navigate when currentScreen changes (for dynamic actions) ──");
    L("  const prevScreenRef = useRef<string | null>(null);");
    L("  useEffect(() => {");
    L("    const screen = state.currentScreen || state.CurrentScreen;");
    L("    if (!screen || screen === prevScreenRef.current) return;");
    L("    prevScreenRef.current = screen;");
    L('    const route = "/" + String(screen).toLowerCase().replace(/\\s+/g, "-");');
    L("    try { router.push(route as any); } catch (e) { console.warn(\"Navigation failed:\", e); }");
    L("  }, [state.currentScreen, state.CurrentScreen, router]);");
    L("");
  }

  L("  return <MintContext.Provider value={value}>{children}</MintContext.Provider>;");
  L("}");
  L("");
  L("// ── Hook ──────────────────────────────────────────────────────");
  L("export function useMint(): MintContextValue {");
  L("  const ctx = useContext(MintContext);");
  L('  if (!ctx) throw new Error("useMint must be used within <MintProvider>");');
  L("  return ctx;");
  L("}");
  L("");
  L("// ── Utility ───────────────────────────────────────────────────");
  L("function getNestedValue(obj: any, path: string): any {");
  L('  if (!path) return obj;');
  L('  return path.split(".").reduce((o, k) => o?.[k], obj);');
  L("}");
  L("");
  L("function resolveActionParam(pStr: string, state: any, args: any[]): any {");
  L('  if (pStr.startsWith("$args.")) {');
  L('    const idx = parseInt(pStr.split(".")[1], 10) || 0;');
  L('    return args[idx];');
  L('  }');
  L('  const fullPath = pStr.slice(1);');
  L('  const stateVal = getNestedValue(state, fullPath);');
  L('  if (stateVal !== undefined) return stateVal;');
  L('  ');
  L('  if (args.length > 0 && args[0] && typeof args[0] === "object") {');
  L('    const parts = fullPath.split(".");');
  L('    if (parts.length > 1) {');
  L('      return getNestedValue(args[0], parts.slice(1).join("."));');
  L('    } else {');
  L('      return args[0];');
  L('    }');
  L('  }');
  L('  return undefined;');
  L("}");
  L("");
  L("function resolveParamsObject(obj: any, state: any, args: any[]): any {");
  L('  if (typeof obj === "string" && obj.startsWith("$")) {');
  L('    return resolveActionParam(obj, state, args);');
  L('  }');
  L('  if (obj && typeof obj === "object" && !Array.isArray(obj)) {');
  L('    const res: any = {};');
  L('    for (const [k, v] of Object.entries(obj)) {');
  L('      res[k] = resolveParamsObject(v, state, args);');
  L('    }');
  L('    return res;');
  L('  }');
  L('  if (Array.isArray(obj)) {');
  L('    return obj.map((x) => resolveParamsObject(x, state, args));');
  L('  }');
  L('  return obj;');
  L("}");
  L("");
  L("function resolveUrl(urlTemplate: string, state: any, args: any[]): string {");
  L("  return urlTemplate.replace(/:([a-zA-Z0-9_]+)/g, (match, paramName) => {");
  L('    const resolved = resolveActionParam("$" + paramName, state, args);');
  L("    if (resolved !== undefined) return String(resolved);");
  L('    if (args.length > 0 && args[0] && typeof args[0] === "object") {');
  L("      if (args[0][paramName] !== undefined) return String(args[0][paramName]);");
  L("    }");
  L("    return match;");
  L("  });");
  L("}");
  L("");
  L("// ── Dynamic action builder (for live schema updates) ─────────");
  L("function buildDynamicAction(");
  L("  actionDef: any,");
  L("  stateRef: React.MutableRefObject<any>,");
  L("  setState: (key: string, value: any) => void,");
  L("  dbQueryFn: (sql: string, params?: any[]) => Promise<any>,");
  L("  allActions: Record<string, (...args: any[]) => void>");
  L("): (...args: any[]) => void {");
  L("  const { name, type, config = {} } = actionDef;");
  L("");
  L('  if (type === "setState") {');
  L("    return (...args: any[]) => {");
  L("      setState(config.path || \"\", config.value);");
  L('      if (/current.?screen/i.test(String(config.path)) && config.value !== undefined) {');
  L('        const route = \"/\" + String(config.value).toLowerCase().replace(/\\s+/g, \"-\");');
  L("        window.location.href = route;");
  L("      }");
  L('      if (config.also) handleAlso(config.also, allActions, setState, stateRef, dbQueryFn);');
  L("    };");
  L("  }");
  L("");
  L('  if (type === "fetch" || type === "mutate") {');
  L("    return async (...args: any[]) => {");
  L("      try {");
  L("        let result;");
  L("        if (config.url) {");
  L("          const resolvedUrl = resolveUrl(config.url, stateRef.current, args);");
  L("          const reqBody = config.body ? resolveParamsObject(config.body, stateRef.current, args) : undefined;");
  L("          const res = await fetch(resolvedUrl, {");
  L("            method: (config.method || 'GET').toUpperCase(),");
  L("            headers: { 'Content-Type': 'application/json' },");
  L("            body: reqBody ? JSON.stringify(reqBody) : undefined,");
  L("          });");
  L("          if (!res.ok) throw new Error('API call failed: ' + res.statusText);");
  L("          result = await res.json();");
  L("        } else {");
  L("          const params = (config.params || config.body?.params || []).map((p: any) =>");
  L('            typeof p === "string" && p.startsWith("$") ? resolveActionParam(p, stateRef.current, args) : p');
  L("          );");
  L("          result = await dbQueryFn(config.sql || config.body?.sql || \"\", params);");
  L("        }");
  L("        if (config.storePath) {");
  L("          setState(config.storePath, result);");
  L("        }");
  L('        if (config.onSuccess) handleOnSuccess(config.onSuccess, result, setState, stateRef, allActions);');
  L("      } catch (err) {");
  L('        console.error("Dynamic action " + name + " failed:", err);');
  L('        if (config.onError) handleOnSuccess(config.onError, undefined, setState, stateRef, allActions);');
  L("      }");
  L("    };");
  L("  }");
  L("");
  L('  if (type === "navigate") {');
  L("    return () => { window.location.href = config.target || \"/\"; };");
  L("  }");
  L("");
  L('  if (type === "custom") {');
  L("    return async (...args: any[]) => {");
  L("      try {");
  L('        if (config.onSuccess) handleOnSuccess(config.onSuccess, undefined, setState, stateRef, allActions);');
  L('        if (config.also) await handleAlso(config.also, allActions, setState, stateRef, dbQueryFn);');
  L("      } catch (err) {");
  L('        console.error("Dynamic action " + name + " failed:", err);');
  L("      }");
  L("    };");
  L("  }");
  L("");
  L('  return () => console.log("Unknown action type:", type, name);');
  L("}");
  L("");
  L("function handleOnSuccess(expr: string, result: any, setState: (k: string, v: any) => void, stateRef: any, allActions: Record<string, (...a: any[]) => void>) {");
  L('  if (!expr) return;');
  L('  var stmts = expr.split(";").map(function(l: string) { return l.trim(); }).filter(Boolean);');
  L('  for (var i = 0; i < stmts.length; i++) {');
  L('    var stmt = stmts[i];');
  L('    var setMatch = stmt.match(/^SET\\s+\\$(\\w[\\w.]*)\\s*=\\s*(.+)$/);');
  L('    if (setMatch) {');
  L('      var key = setMatch[1];');
  L('      var rawVal = setMatch[2].trim();');
  L('      var val: any = rawVal;');
  L('      var rv = rawVal.replace(/^\\$/, "");');
  L('      if (rv === "result") val = result;');
  L('      else if (rv === "result.rows") val = result && result.rows ? result.rows : [];');
  L('      else if (rv.indexOf("result.rows[") === 0) {');
  L('        var bm = rv.match(/result\\.rows\\[(\\d+)\\]\\.?(.*)/);');
  L('        if (bm && result && result.rows) { val = bm[2] ? (result.rows[parseInt(bm[1])] || {})[bm[2]] : result.rows[parseInt(bm[1])]; }');
  L('      }');
  L(`      else if (rawVal === '""' || rawVal === "''" ) val = "";`);
  L('      else if (rawVal === "[]") val = [];');
  L('      else if (rawVal === "true") val = true;');
  L('      else if (rawVal === "false") val = false;');
  L('      else if (!isNaN(Number(rawVal))) val = Number(rawVal);');
  L('      else if ((rawVal[0] === "\'" && rawVal[rawVal.length-1] === "\'") || (rawVal[0] === \'\"\' && rawVal[rawVal.length-1] === \'\"\')) val = rawVal.slice(1, -1);');
  L('      setState(key, val);');
  L('      continue;');
  L('    }');
  L('    var callMatch = stmt.match(/^CALL\\s+(\\w+)/);');
  L('    if (callMatch && allActions[callMatch[1]]) {');
  L('      allActions[callMatch[1]]();');
  L('    }');
  L('  }');
  L("}");
  L("");
  L("async function handleAlso(expr: string, allActions: Record<string, (...a: any[]) => void>, setState: (k: string, v: any) => void, stateRef: any, dbQueryFn: (sql: string, params?: any[]) => Promise<any>) {");
  L('  if (!expr) return;');
  L('  var stmts = expr.split(";").map(function(l: string) { return l.trim(); }).filter(Boolean);');
  L('  for (var i = 0; i < stmts.length; i++) {');
  L('    var stmt = stmts[i];');
  L('    var setMatch = stmt.match(/^SET\\s+\\$(\\w[\\w.]*)\\s*=\\s*(.+)$/);');
  L('    if (setMatch) {');
  L('      var key = setMatch[1];');
  L('      var rawVal = setMatch[2].trim();');
  L('      var val: any = rawVal;');
  L('      // Handle dbQuery(...) calls');
  L('      var dbMatch = rawVal.match(/^dbQuery\\((.+)\\)$/);');
  L('      if (dbMatch) {');
  L('        try {');
  L('          var inner = dbMatch[1];');
  L('          // Parse SQL string and params array');
  L("          var sqlMatch = inner.match(/^['\"](.+?)['\"]\\s*,\\s*\\[(.*)\\]$/);");
  L('          if (sqlMatch) {');
  L('            var sql = sqlMatch[1];');
  L('            var paramStrs = sqlMatch[2].split(",").map(function(s: string) { return s.trim(); }).filter(Boolean);');
  L('            var params = paramStrs.map(function(p: string) {');
  L('              if (p.startsWith("$")) return getNestedValue(stateRef.current, p.slice(1));');
  L("              if ((p[0] === \"'\" && p[p.length-1] === \"'\") || (p[0] === '\"' && p[p.length-1] === '\"')) return p.slice(1, -1);");
  L('              if (!isNaN(Number(p))) return Number(p);');
  L('              return p;');
  L('            });');
  L('            val = await dbQueryFn(sql, params);');
  L('          }');
  L('        } catch (err) {');
  L('          console.error("handleAlso dbQuery failed:", err);');
  L('          continue;');
  L('        }');
  L('      }');
  L('      else {');
  L('        var rv = rawVal.replace(/^\\$/, "");');
  L('        if (rawVal.startsWith("$")) val = getNestedValue(stateRef.current, rv);');
  L(`        else if (rawVal === '""' || rawVal === "''") val = "";`);
  L('        else if (rawVal === "[]") val = [];');
  L('        else if (rawVal === "true") val = true;');
  L('        else if (rawVal === "false") val = false;');
  L('        else if (!isNaN(Number(rawVal))) val = Number(rawVal);');
  L("        else if ((rawVal[0] === \"'\" && rawVal[rawVal.length-1] === \"'\") || (rawVal[0] === '\"' && rawVal[rawVal.length-1] === '\"')) val = rawVal.slice(1, -1);");
  L('      }');
  L('      setState(key, val);');
  L('      continue;');
  L('    }');
  L('    var callMatch = stmt.match(/^CALL\\s+(\\w+)/);');
  L('    if (callMatch && allActions[callMatch[1]]) {');
  L('      try { await allActions[callMatch[1]](); } catch (e) { console.error("CALL " + callMatch[1] + " failed:", e); }');
  L('    }');
  L('  }');
  L("}");
  L("");

  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════
// Action code generator — uses dbQuery() helper
// ═══════════════════════════════════════════════════════════════

function buildActionFunction(
  action: ActionDef,
  fetchActionNames: string[],
  isNative: boolean
): string {
  const { name, type, config } = action;
  const cfg = config || {};

  switch (type) {
    case "fetch":
    case "mutate": {
      const url = cfg.url ?? "";
      const method = cfg.method ?? "GET";
      const body = cfg.body;
      const storePath = cfg.storePath ?? "";
      const onSuccess = cfg.onSuccess ?? "";
      const onError = cfg.onError ?? "";

      if (url) {
        // Generate REST API call
        const lines: string[] = [];
        lines.push("  const " + name + " = useCallback(async (...args: any[]) => {");
        lines.push("    try {");
        lines.push("      const resolvedUrl = resolveUrl(" + JSON.stringify(url) + ", stateRef.current, args);");
        if (body) {
          lines.push("      const reqBody = resolveParamsObject(" + JSON.stringify(body) + ", stateRef.current, args);");
        }
        lines.push("      const res = await fetch(resolvedUrl, {");
        lines.push("        method: " + JSON.stringify(method.toUpperCase()) + ",");
        lines.push('        headers: { "Content-Type": "application/json" },');
        if (body) {
          lines.push("        body: JSON.stringify(reqBody),");
        }
        lines.push("      });");
        lines.push("      if (!res.ok) throw new Error(`API call failed: ${res.statusText}`);");
        lines.push("      const result = await res.json();");
        if (storePath) {
          lines.push('      setState("' + storePath + '", result);');
        }
        const successCode = generateOnSuccess(onSuccess, fetchActionNames, isNative);
        if (successCode) lines.push(successCode);
        lines.push("    } catch (err) {");
        lines.push('      console.error("Action ' + name + ' failed:", err);');
        const errorCode = generateOnError(onError);
        if (errorCode) lines.push(errorCode);
        lines.push("    }");
        lines.push("  }, [setState]);");
        return lines.join("\n");
      } else {
        // Standard SQL query via dbQuery
        const sql = cfg.sql ?? cfg.body?.sql ?? "";
        const rawParams: any[] = cfg.params ?? cfg.body?.params ?? [];

        // Build param resolution lines
        const paramLines = rawParams.map((p: any) => {
          if (typeof p === "string" && p.startsWith("$")) {
            return '      resolveActionParam("' + p + '", stateRef.current, args)';
          }
          return "      " + JSON.stringify(p);
        });

        const lines: string[] = [];
        lines.push("  const " + name + " = useCallback(async (...args: any[]) => {");
        lines.push("    try {");

        if (paramLines.length > 0) {
          lines.push("      const params = [");
          lines.push(paramLines.join(",\n"));
          lines.push("      ];");
        } else {
          lines.push("      const params: any[] = [];");
        }

        lines.push('      const result = await dbQuery(' + JSON.stringify(sql) + ', params);');
        if (storePath) {
          lines.push('      setState("' + storePath + '", result);');
        }
        const successCode = generateOnSuccess(onSuccess, fetchActionNames, isNative);
        if (successCode) lines.push(successCode);
        lines.push("    } catch (err) {");
        lines.push('      console.error("Action ' + name + ' failed:", err);');
        const errorCode = generateOnError(onError);
        if (errorCode) lines.push(errorCode);
        lines.push("    }");
        lines.push("  }, [setState]);");

        return lines.join("\n");
      }
    }

    case "setState": {
      const path = cfg.path ?? "";
      const value = cfg.value !== undefined ? JSON.stringify(cfg.value) : "undefined";
      const also = cfg.also ?? "";

      const lines: string[] = [];
      lines.push("  const " + name + " = useCallback((...args: any[]) => {");
      lines.push('    setState("' + path + '", ' + value + ");");
      // If this sets currentScreen, also navigate to the corresponding route
      if (/current.?screen/i.test(String(path)) && cfg.value !== undefined) {
        const route = screenNameToRoute(String(cfg.value));
        if (isNative) {
          lines.push('    router.push("' + route + '");');
        } else {
          lines.push('    window.location.href = "' + route + '";');
        }
      }
      const alsoCode = generateAlsoStatements(also, fetchActionNames, isNative);
      if (alsoCode) lines.push(alsoCode);
      lines.push("  }, [setState]);");
      return lines.join("\n");
    }

    case "custom": {
      const onSuccess = cfg.onSuccess ?? "";
      const onError = cfg.onError ?? "";
      const also = cfg.also ?? "";

      const lines: string[] = [];
      lines.push("  const " + name + " = useCallback(async (...args: any[]) => {");
      lines.push("    try {");
      
      const successCode = generateOnSuccess(onSuccess, fetchActionNames, isNative);
      if (successCode) lines.push(successCode);

      const alsoCode = generateAlsoStatements(also, fetchActionNames, isNative);
      if (alsoCode) lines.push(alsoCode);

      lines.push("    } catch (err) {");
      lines.push('      console.error("Action ' + name + ' failed:", err);');
      const errorCode = generateOnError(onError);
      if (errorCode) lines.push(errorCode);
      lines.push("    }");
      lines.push("  }, [setState]);");

      return lines.join("\n");
    }

    case "navigate": {
      const target = cfg.target ?? "/";
      const navCode = isNative
        ? '    router.push("' + target + '");'
        : '    window.location.href = "' + target + '";';
      return [
        "  const " + name + " = useCallback((...args: any[]) => {",
        navCode,
        "  }, []);",
      ].join("\n");
    }

    default: {
      return [
        "  const " + name + " = useCallback(() => {",
        '    console.log("Action: ' + name + '", ' + JSON.stringify(cfg) + ");",
        "  }, []);",
      ].join("\n");
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// onSuccess / onError / also statement parsers
// ═══════════════════════════════════════════════════════════════

function parseActionExpr(expr: string): string {
  let val = expr.trim();
  val = val.replace(/\$result/g, "result");
  // Replace $varName refs with stateRef.current.varName
  // BUT skip $1, $2, etc. (SQL positional parameters) — they start with a digit
  val = val.replace(/\$([a-zA-Z_][a-zA-Z0-9_.]*)/g, "stateRef.current.$1");
  return val;
}

function formatStateValue(val: string): string {
  if (
    ["true", "false", "null", "undefined", "result"].includes(val) ||
    /^["'].*["']$/.test(val) ||
    val.includes("stateRef") ||
    val.includes("result") ||
    val.startsWith("dbQuery") ||
    /^\d+$/.test(val)
  ) {
    return val;
  }
  return `"${val}"`;
}

function generateOnSuccess(
  onSuccess: string,
  fetchActionNames: string[],
  isNative: boolean
): string {
  if (!onSuccess) return "";
  const statements = onSuccess.split(";").map((s) => s.trim()).filter(Boolean);
  return statements
    .map((stmt) => {
      // SET $varName = expression
      const setMatch = stmt.match(/^SET\s+\$(\S+)\s*=\s*(.+)$/i);
      if (setMatch) {
        const [, key, expr] = setMatch;
        const rawVal = parseActionExpr(expr);
        const val = formatStateValue(rawVal);
        let code = '      setState("' + key + '", ' + val + ");";
        if (/current.?screen/i.test(key)) {
          const screenVal = expr.trim().replace(/['"`]/g, "");
          if (!/stateRef|result/.test(screenVal)) {
            const route = screenNameToRoute(screenVal);
            if (isNative) {
              code += '\n      router.push("' + route + '");';
            } else {
              code += '\n      window.location.href = "' + route + '";';
            }
          }
        }
        return code;
      }
      // CALL actionName — chain to another action via ref
      const callMatch = stmt.match(/^CALL\s+(\w+)/i);
      if (callMatch) {
        const callee = callMatch[1];
        if (fetchActionNames.includes(callee)) {
          return "      " + callee + "Ref.current();";
        }
        return "      " + callee + "();";
      }
      // Handle "TODO: chain call X" or "chain call X" patterns
      const todoCallMatch = stmt.match(/^(?:TODO:?\s*)?chain\s+call\s+(\w+)/i);
      if (todoCallMatch) {
        const callee = todoCallMatch[1];
        if (fetchActionNames.includes(callee)) {
          return "      " + callee + "Ref.current();";
        }
        return "      " + callee + "();";
      }
      return "      // " + stmt;
    })
    .join("\n");
}

function generateOnError(onError: string): string {
  if (!onError) return "";
  const statements = onError.split(";").map((s) => s.trim()).filter(Boolean);
  return statements
    .map((stmt) => {
      const setMatch = stmt.match(/^SET\s+\$(\S+)\s*=\s*(.+)$/i);
      if (setMatch) {
        const [, key, expr] = setMatch;
        const rawVal = parseActionExpr(expr);
        const val = formatStateValue(rawVal);
        return '      setState("' + key + '", ' + val + ");";
      }
      return "      // " + stmt;
    })
    .join("\n");
}

function generateAlsoStatements(
  also: string,
  fetchActionNames: string[],
  isNative: boolean
): string {
  if (!also) return "";
  const statements = also.split(";").map((s) => s.trim()).filter(Boolean);
  return statements
    .map((stmt) => {
      const setMatch = stmt.match(/^SET\s+\$(\S+)\s*=\s*(.+)$/i);
      if (setMatch) {
        const [, key, expr] = setMatch;
        const rawVal = parseActionExpr(expr);
        const val = formatStateValue(rawVal);
        let code = '    setState("' + key + '", ' + val + ");";
        if (/current.?screen/i.test(key)) {
          const screenVal = expr.trim().replace(/['"`]/g, "");
          if (!/stateRef|result/.test(screenVal)) {
            const route = screenNameToRoute(screenVal);
            if (isNative) {
              code += '\n    router.push("' + route + '");';
            } else {
              code += '\n    window.location.href = "' + route + '";';
            }
          }
        }
        return code;
      }
      const callMatch = stmt.match(/^CALL\s+(\w+)/i);
      if (callMatch) {
        const callee = callMatch[1];
        if (fetchActionNames.includes(callee)) {
          return "    " + callee + "Ref.current();";
        }
        return "    " + callee + "();";
      }
      // Handle "TODO: chain call X" or "chain call X" patterns
      const todoCallMatch = stmt.match(/^(?:TODO:?\s*)?chain\s+call\s+(\w+)/i);
      if (todoCallMatch) {
        const callee = todoCallMatch[1];
        if (fetchActionNames.includes(callee)) {
          return "    " + callee + "Ref.current();";
        }
        return "    " + callee + "();";
      }
      return "    // " + stmt;
    })
    .join("\n");
}

function getDefaultForType(type: string): any {
  switch (type) {
    case "string":
      return "";
    case "number":
      return 0;
    case "boolean":
      return false;
    case "array":
      return [];
    case "object":
      return {};
    default:
      return null;
  }
}

/**
 * Maps a screen name (from currentScreen state) to a URL route.
 * The first/home/login screen maps to "/", others to "/slug".
 */
function screenNameToRoute(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (["login", "loginscreen", "home", "homescreen", "main"].includes(slug)) {
    return "/";
  }
  return "/" + slug;
}
