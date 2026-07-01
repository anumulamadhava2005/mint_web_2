// ═══════════════════════════════════════════════════════════════
// Universal Action Runtime
//
//   Action Dispatcher → Action Registry → Action Executor → Middleware
//
// Supports: UI actions, Data actions, Logic actions, Device actions
//           Middleware pipeline, conditional execution,
//           debounce/throttle, parallel/sequence execution
// ═══════════════════════════════════════════════════════════════

import type { ActionSchema, ActionType, ActionRef } from "./schema";
import { parse, evaluate, type EvalContext } from "./expressions";
import { StateEngine } from "./state";
import { previewLog } from "./previewLog";

// ── Types ────────────────────────────────────────────────────

export interface ActionContext {
  state: StateEngine;
  params?: Record<string, unknown>;
  event?: unknown; // the triggering event (e.g., click event)
  navigation?: NavigationAdapter;
  api?: ApiAdapter;
  storage?: StorageAdapter;
  device?: DeviceAdapter;
}

export type ActionHandler = (
  config: Record<string, unknown>,
  ctx: ActionContext
) => Promise<unknown> | unknown;

export type MiddlewareFn = (
  action: ActionSchema,
  ctx: ActionContext,
  next: () => Promise<unknown>
) => Promise<unknown>;

// ── Platform Adapters ────────────────────────────────────────
// These are injected by the platform (React Native, Web, etc.)

export interface NavigationAdapter {
  navigate(route: string, params?: Record<string, unknown>): void;
  goBack(): void;
  replace(route: string, params?: Record<string, unknown>): void;
  reset(routes: string[]): void;
}

export interface ApiAdapter {
  fetch(url: string, options?: RequestInit): Promise<Response>;
  graphql(query: string, variables?: Record<string, unknown>): Promise<unknown>;
}

export interface StorageAdapter {
  upload(file: Blob | string, path: string): Promise<{ url: string }>;
  getSignedUrl(path: string): Promise<string>;
  delete(path: string): Promise<void>;
}

export interface DeviceAdapter {
  camera?: { takePicture(): Promise<{ uri: string }>; pickImage(): Promise<{ uri: string }> };
  notifications?: { requestPermission(): Promise<boolean>; send(title: string, body: string): Promise<void> };
  location?: { getCurrentPosition(): Promise<{ lat: number; lng: number }> };
  biometrics?: { authenticate(reason: string): Promise<boolean> };
  haptics?: { impact(style?: "light" | "medium" | "heavy"): void };
  clipboard?: { getString(): Promise<string>; setString(text: string): Promise<void> };
  share?: { share(content: { title?: string; message: string; url?: string }): Promise<void> };
}

// ── Action Registry ──────────────────────────────────────────

export class ActionRegistry {
  private handlers = new Map<string, ActionHandler>();
  private schemas = new Map<string, ActionSchema>();
  private middleware: MiddlewareFn[] = [];
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private throttleTimestamps = new Map<string, number>();

  constructor() {
    this.registerBuiltins();
  }

  /** Register a custom action handler */
  register(type: string, handler: ActionHandler): void {
    this.handlers.set(type, handler);
  }

  /** Register action schemas from app config */
  registerSchemas(schemas: ActionSchema[]): void {
    for (const schema of schemas) {
      this.schemas.set(schema.id, schema);
    }
  }

  /** Add middleware */
  use(middleware: MiddlewareFn): void {
    this.middleware.push(middleware);
  }

  /** Dispatch an action */
  async dispatch(ref: ActionRef, ctx: ActionContext): Promise<unknown> {
    const schema = typeof ref === "string"
      ? this.schemas.get(ref)
      : this.schemas.get(ref.actionId);

    if (!schema) {
      console.warn(`[ActionRuntime] Unknown action: ${typeof ref === "string" ? ref : ref.actionId}`);
      return undefined;
    }

    // Merge params
    if (typeof ref !== "string" && ref.params) {
      const evalCtx = ctx.state.getEvalContext();
      ctx = {
        ...ctx,
        params: {
          ...ctx.params,
          ...Object.fromEntries(
            Object.entries(ref.params).map(([k, v]) => {
              try { return [k, evaluate(parse(v), evalCtx)]; }
              catch { return [k, v]; }
            })
          ),
        },
      };
    }

    // Condition check
    if (schema.condition) {
      try {
        const result = evaluate(parse(schema.condition), ctx.state.getEvalContext());
        if (!result) return undefined;
      } catch (e) {
        console.warn(`[ActionRuntime] Condition error for '${schema.name}':`, e);
        return undefined;
      }
    }

    // Debounce
    if (schema.debounce) {
      return new Promise((resolve) => {
        const existing = this.debounceTimers.get(schema.id);
        if (existing) clearTimeout(existing);
        this.debounceTimers.set(
          schema.id,
          setTimeout(async () => {
            this.debounceTimers.delete(schema.id);
            resolve(await this.executeWithMiddleware(schema, ctx));
          }, schema.debounce)
        );
      });
    }

    // Throttle
    if (schema.throttle) {
      const lastRun = this.throttleTimestamps.get(schema.id) || 0;
      if (Date.now() - lastRun < schema.throttle) return undefined;
      this.throttleTimestamps.set(schema.id, Date.now());
    }

    return this.executeWithMiddleware(schema, ctx);
  }

  /** Dispatch multiple actions in sequence */
  async dispatchSequence(refs: ActionRef[], ctx: ActionContext): Promise<unknown[]> {
    const results: unknown[] = [];
    for (const ref of refs) {
      results.push(await this.dispatch(ref, ctx));
    }
    return results;
  }

  /** Dispatch multiple actions in parallel */
  async dispatchParallel(refs: ActionRef[], ctx: ActionContext): Promise<unknown[]> {
    return Promise.all(refs.map((ref) => this.dispatch(ref, ctx)));
  }

  private async executeWithMiddleware(schema: ActionSchema, ctx: ActionContext): Promise<unknown> {
    let index = 0;
    const chain = this.middleware;

    const next = async (): Promise<unknown> => {
      if (index < chain.length) {
        return chain[index++](schema, ctx, next);
      }
      return this.execute(schema, ctx);
    };

    try {
      const result = await next();
      // Run onSuccess
      if (schema.onSuccess?.length) {
        await this.dispatchSequence(schema.onSuccess, ctx);
      }
      return result;
    } catch (error) {
      // Run onError
      if (schema.onError?.length) {
        ctx = { ...ctx, params: { ...ctx.params, error } };
        await this.dispatchSequence(schema.onError, ctx);
      }
      throw error;
    }
  }

  private async execute(schema: ActionSchema, ctx: ActionContext): Promise<unknown> {
    const handler = this.handlers.get(schema.type);
    if (!handler) {
      throw new Error(`[ActionRuntime] No handler for action type: ${schema.type}`);
    }

    const resolvedConfig = this.resolveConfig(schema.config, ctx);
    return handler(resolvedConfig, ctx);
  }

  /** Resolve expression values in config */
  private resolveConfig(
    config: Record<string, unknown>,
    ctx: ActionContext
  ): Record<string, unknown> {
    // Merge event/loop context (ctx.params, e.g. the repeater's `item`) over
    // state, so per-row expressions like $item.id resolve in an action's config.
    const evalCtx = { ...ctx.state.getEvalContext(), ...(ctx.params as Record<string, unknown> ?? {}) };
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(config)) {
      if (typeof value === "string" && value.startsWith("$")) {
        try {
          resolved[key] = evaluate(parse(value), evalCtx);
        } catch {
          resolved[key] = value;
        }
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  // ── Built-in Handlers ──────────────────────────────────

  private registerBuiltins(): void {
    // ── UI Actions ────────────────────────────────────
    this.register("navigate", (config, ctx) => {
      ctx.navigation?.navigate(String(config.route), config.params as Record<string, unknown>);
    });

    this.register("goBack", (_config, ctx) => {
      ctx.navigation?.goBack();
    });

    this.register("openModal", (config, ctx) => {
      ctx.state.set("_modals." + String(config.modalId), { open: true, data: config.data });
    });

    this.register("closeModal", (config, ctx) => {
      ctx.state.set("_modals." + String(config.modalId), { open: false, data: null });
    });

    this.register("toast", (config, ctx) => {
      ctx.state.set("_toasts", [
        ...((ctx.state.get("_toasts") as unknown[]) || []),
        { id: Date.now(), message: config.message, type: config.type || "info", duration: config.duration || 3000 },
      ]);
    });

    this.register("animate", (config) => {
      // Platform-specific — handled by UI layer
      return { type: "animate", ...config };
    });

    this.register("scroll", (config) => {
      return { type: "scroll", ...config };
    });

    this.register("focus", (config) => {
      return { type: "focus", elementId: config.elementId };
    });

    // ── Data Actions ──────────────────────────────────
    this.register("setState", (config, ctx) => {
      ctx.state.set(String(config.path), config.value);
    });

    this.register("resetState", (config, ctx) => {
      ctx.state.reset(String(config.path), config.defaultValue);
    });

    this.register("fetch", async (config, ctx) => {
      const url = String(config.url);
      const method = String(config.method || "GET").toUpperCase();
      const headers = (config.headers || {}) as Record<string, string>;
      const body = config.body ? JSON.stringify(config.body) : undefined;

      const response = ctx.api
        ? await ctx.api.fetch(url, { method, headers, body })
        : await fetch(url, { method, headers, body });

      const data = await response.json();

      if (config.storePath) {
        ctx.state.set(String(config.storePath), data);
      }

      return data;
    });

    // Read rows from the project's managed database via the DML bridge endpoint.
    // Stores the rows array (not the envelope) at storePath so a repeater can
    // bind repeatFor.items = "$<storePath>".
    this.register("dbQuery", async (config, ctx) => {
      const projectId = String(config.projectId || "");
      const url = `/api/db/${projectId}`;
      const sql = String(config.sql || "");
      const init = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql, params: (config.params as unknown[]) || [] }),
      };
      if (previewLog.active) previewLog.push("info", "db", `query → ${sql}`);
      const response = ctx.api
        ? await ctx.api.fetch(url, init)
        : await fetch(url, { ...init, credentials: "include" });
      const data = (await response.json().catch(() => ({}))) as { rows?: unknown[]; error?: string };
      if (!response.ok || data.error) {
        const err = data.error || `HTTP ${response.status}`;
        if (previewLog.active) previewLog.push("error", "db", `query failed: ${err}`);
        if (config.storePath) ctx.state.set(String(config.storePath), []);
        return [];
      }
      const rows = Array.isArray(data.rows) ? data.rows : [];
      if (previewLog.active) {
        previewLog.push("success", "db", `${rows.length} row(s) → $${String(config.storePath ?? "")}`,
          rows.length ? JSON.stringify(rows[0]) : undefined);
      }
      if (config.storePath) ctx.state.set(String(config.storePath), rows);
      return rows;
    });

    // ── CRUD writes to the managed DB ──────────────────────────
    // Nested value/where maps hold expressions ($form.email); resolveConfig
    // only evaluates top-level $strings, so we resolve them here against state.
    const resolveMap = (m: unknown, ctx: ActionContext): Record<string, unknown> => {
      const out: Record<string, unknown> = {};
      // Include ctx.params (repeater loop item) so where:{id:'$item.id'} resolves.
      const evalCtx = { ...ctx.state.getEvalContext(), ...(ctx.params as Record<string, unknown> ?? {}) };
      for (const [k, v] of Object.entries((m as Record<string, unknown>) || {})) {
        if (typeof v === "string" && v.startsWith("$")) {
          try { out[k] = evaluate(parse(v), evalCtx); } catch { out[k] = v; }
        } else out[k] = v;
      }
      return out;
    };
    const runDml = async (ctx: ActionContext, projectId: string, sql: string, params: unknown[]): Promise<Record<string, unknown>[]> => {
      const url = `/api/db/${projectId}`;
      const init = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sql, params }) };
      if (previewLog.active) previewLog.push("info", "db", sql);
      const response = ctx.api ? await ctx.api.fetch(url, init) : await fetch(url, { ...init, credentials: "include" });
      const data = (await response.json().catch(() => ({}))) as { rows?: Record<string, unknown>[]; error?: string };
      if (!response.ok || data.error) {
        const err = data.error || `HTTP ${response.status}`;
        if (previewLog.active) previewLog.push("error", "db", `mutation failed: ${err}`);
        throw new Error(err);
      }
      if (previewLog.active) previewLog.push("success", "db", `ok · ${(data.rows?.length ?? 0)} row(s) affected`);
      return data.rows || [];
    };

    this.register("dbInsert", async (config, ctx) => {
      const projectId = String(config.projectId || "");
      const table = String(config.table || "");
      const values = resolveMap(config.values, ctx);
      const cols = Object.keys(values);
      if (!table || cols.length === 0) return null;
      const sql = `INSERT INTO ${table} (${cols.map(c => `"${c}"`).join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING *`;
      const rows = await runDml(ctx, projectId, sql, cols.map(c => values[c]));
      if (config.storePath) ctx.state.set(String(config.storePath), rows[0] ?? null);
      return rows[0] ?? null;
    });

    this.register("dbUpdate", async (config, ctx) => {
      const projectId = String(config.projectId || "");
      const table = String(config.table || "");
      const values = resolveMap(config.values, ctx);
      const where = resolveMap(config.where, ctx);
      const cols = Object.keys(values);
      const wcols = Object.keys(where);
      if (!table || cols.length === 0 || wcols.length === 0) return null;
      const sets = cols.map((c, i) => `"${c}" = $${i + 1}`).join(", ");
      const conds = wcols.map((c, i) => `"${c}" = $${cols.length + i + 1}`).join(" AND ");
      const sql = `UPDATE ${table} SET ${sets} WHERE ${conds} RETURNING *`;
      const rows = await runDml(ctx, projectId, sql, [...cols.map(c => values[c]), ...wcols.map(c => where[c])]);
      if (config.storePath) ctx.state.set(String(config.storePath), rows[0] ?? null);
      return rows[0] ?? null;
    });

    this.register("dbDelete", async (config, ctx) => {
      const projectId = String(config.projectId || "");
      const table = String(config.table || "");
      const where = resolveMap(config.where, ctx);
      const wcols = Object.keys(where);
      if (!table || wcols.length === 0) return null;
      const conds = wcols.map((c, i) => `"${c}" = $${i + 1}`).join(" AND ");
      const sql = `DELETE FROM ${table} WHERE ${conds}`;
      await runDml(ctx, projectId, sql, wcols.map(c => where[c]));
      return true;
    });

    this.register("mutate", async (config, ctx) => {
      const opt = ctx.state.optimistic(
        String(config.optimisticPath || config.storePath),
        config.optimisticValue
      );

      try {
        const result = await this.execute(
          { ...({} as ActionSchema), type: "fetch", config } as ActionSchema,
          ctx
        );
        opt.commit();
        return result;
      } catch (e) {
        opt.rollback();
        throw e;
      }
    });

    this.register("upload", async (config, ctx) => {
      if (!ctx.storage) throw new Error("Storage adapter not configured");
      return ctx.storage.upload(config.file as Blob, String(config.path));
    });

    // ── Logic Actions ─────────────────────────────────
    this.register("condition", async (config, ctx) => {
      const evalCtx = ctx.state.getEvalContext();
      const result = evaluate(parse(String(config.expression)), evalCtx);
      const branch = result ? config.then : config.else;
      if (branch && Array.isArray(branch)) {
        return this.dispatchSequence(branch as ActionRef[], ctx);
      }
    });

    this.register("loop", async (config, ctx) => {
      const items = ctx.state.get(String(config.items)) as unknown[];
      if (!Array.isArray(items)) return;

      const actions = config.actions as ActionRef[];
      if (!actions) return;

      for (let i = 0; i < items.length; i++) {
        ctx.state.set("_loop.item", items[i]);
        ctx.state.set("_loop.index", i);
        await this.dispatchSequence(actions, ctx);
      }
    });

    this.register("sequence", async (config, ctx) => {
      return this.dispatchSequence(config.actions as ActionRef[], ctx);
    });

    this.register("parallel", async (config, ctx) => {
      return this.dispatchParallel(config.actions as ActionRef[], ctx);
    });

    this.register("delay", (config) => {
      return new Promise((resolve) => setTimeout(resolve, Number(config.ms || 1000)));
    });

    // ── Device Actions ────────────────────────────────
    this.register("camera", async (config, ctx) => {
      if (!ctx.device?.camera) throw new Error("Camera not available");
      return config.mode === "pick"
        ? ctx.device.camera.pickImage()
        : ctx.device.camera.takePicture();
    });

    this.register("notifications", async (config, ctx) => {
      if (!ctx.device?.notifications) throw new Error("Notifications not available");
      if (config.action === "request") return ctx.device.notifications.requestPermission();
      return ctx.device.notifications.send(String(config.title), String(config.body));
    });

    this.register("location", async (_config, ctx) => {
      if (!ctx.device?.location) throw new Error("Location not available");
      return ctx.device.location.getCurrentPosition();
    });

    this.register("biometrics", async (config, ctx) => {
      if (!ctx.device?.biometrics) throw new Error("Biometrics not available");
      return ctx.device.biometrics.authenticate(String(config.reason || "Authenticate"));
    });

    this.register("haptics", (config, ctx) => {
      ctx.device?.haptics?.impact(config.style as "light" | "medium" | "heavy");
    });

    this.register("clipboard", async (config, ctx) => {
      if (!ctx.device?.clipboard) throw new Error("Clipboard not available");
      if (config.action === "get") return ctx.device.clipboard.getString();
      return ctx.device.clipboard.setString(String(config.text));
    });

    this.register("share", async (config, ctx) => {
      if (!ctx.device?.share) throw new Error("Share not available");
      return ctx.device.share.share({
        title: config.title as string,
        message: String(config.message),
        url: config.url as string,
      });
    });

    this.register("openUrl", (config) => {
      if (typeof window !== "undefined") {
        window.open(String(config.url), String(config.target || "_blank"));
      }
    });

    // ── Auth Actions ──────────────────────────────────
    const postJson = async (ctx: ActionContext, url: string, body: unknown) => {
      const init = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
      const res = ctx.api ? await ctx.api.fetch(url, init) : await fetch(url, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string })?.error || "Request failed");
      return data as Record<string, unknown>;
    };
    const storeSession = (config: Record<string, unknown>, ctx: ActionContext, data: Record<string, unknown>) => {
      if (data.user !== undefined) ctx.state.set(String(config.userPath || "user"), data.user);
      if (data.token !== undefined) ctx.state.set(String(config.tokenPath || "session.token"), data.token);
    };

    this.register("signIn", async (config, ctx) => {
      const data = await postJson(ctx, String(config.url || "/api/login"), {
        email: config.email,
        password: config.password,
      });
      storeSession(config, ctx, data);
      return data;
    });

    this.register("signUp", async (config, ctx) => {
      const body = (config.body as Record<string, unknown>) || {
        email: config.email,
        password: config.password,
        name: config.name,
      };
      const data = await postJson(ctx, String(config.url || "/api/signup"), body);
      storeSession(config, ctx, data);
      return data;
    });

    this.register("signOut", async (config, ctx) => {
      const url = String(config.url || "/api/logout");
      try {
        if (ctx.api) await ctx.api.fetch(url, { method: "POST" });
        else await fetch(url, { method: "POST" });
      } catch {
        // Clear local session regardless of network outcome.
      }
      ctx.state.set(String(config.userPath || "user"), null);
      ctx.state.set(String(config.tokenPath || "session.token"), null);
    });
  }

  /** Destroy and clean up timers */
  destroy(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.throttleTimestamps.clear();
  }
}

// ── Logging Middleware ────────────────────────────────────────

export const loggingMiddleware: MiddlewareFn = async (action, _ctx, next) => {
  const start = Date.now();
  console.log(`[Action] ▶ ${action.name} (${action.type})`);
  try {
    const result = await next();
    console.log(`[Action] ✓ ${action.name} (${Date.now() - start}ms)`);
    return result;
  } catch (e) {
    console.error(`[Action] ✗ ${action.name} (${Date.now() - start}ms)`, e);
    throw e;
  }
};

// ── Performance Middleware ────────────────────────────────────

export const performanceMiddleware: MiddlewareFn = async (action, _ctx, next) => {
  const start = performance.now();
  const result = await next();
  const duration = performance.now() - start;
  if (duration > 100) {
    console.warn(`[Action] Slow action: ${action.name} took ${duration.toFixed(1)}ms`);
  }
  return result;
};
