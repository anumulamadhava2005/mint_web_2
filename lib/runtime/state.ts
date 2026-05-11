// ═══════════════════════════════════════════════════════════════
// Universal State Engine — Runtime state management
//
// Supports: local, global, session, persisted scopes
//           derived/computed state, async state,
//           subscriptions, batched updates, undo/redo,
//           optimistic mutations, state hydration
//
// Works as both:
//   - Bundled JS library in exported apps
//   - Server-side interpreter for live updates
// ═══════════════════════════════════════════════════════════════

import { DependencyGraph } from "./dependency-graph";
import { parse, evaluate, extractDependencies, type ASTNode, type EvalContext } from "./expressions";
import type { StateNodeSchema, StateScope } from "./schema";

// ── Types ────────────────────────────────────────────────────

export interface StateSubscription {
  id: string;
  path: string; // "" = root, "user" = $user, "user.name" = $user.name
  callback: (value: unknown, prev: unknown) => void;
}

export interface AsyncStateEntry {
  data: unknown;
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
  staleTime: number;
}

interface StateSnapshot {
  values: Record<string, unknown>;
  timestamp: number;
}

interface OptimisticEntry {
  id: string;
  path: string;
  optimisticValue: unknown;
  previousValue: unknown;
  resolve: () => void;
  reject: (error: Error) => void;
}

// ── State Engine ─────────────────────────────────────────────

export class StateEngine {
  private values: Record<string, unknown> = {};
  private scopes: Record<string, StateScope> = {};
  private derivedExpressions: Record<string, ASTNode> = {};
  private depGraph = new DependencyGraph<string>();
  private subscriptions: StateSubscription[] = [];
  private nextSubId = 1;

  // Batching
  private batchDepth = 0;
  private pendingNotifications = new Set<string>();

  // Undo/Redo
  private undoStack: StateSnapshot[] = [];
  private redoStack: StateSnapshot[] = [];
  private maxUndoSize = 50;

  // Optimistic
  private optimisticEntries = new Map<string, OptimisticEntry>();

  // Async state cache
  private asyncStates = new Map<string, AsyncStateEntry>();

  // Persistence adapters
  private persistenceAdapter: PersistenceAdapter | null = null;

  // ── Initialization ─────────────────────────────────────

  /** Initialize state from schema definitions */
  initFromSchema(schemas: StateNodeSchema[]): void {
    for (const schema of schemas) {
      this.scopes[schema.name] = schema.scope;
      this.values[schema.name] = schema.defaultValue;

      if (schema.derived) {
        const ast = parse(schema.derived);
        this.derivedExpressions[schema.name] = ast;
        const deps = extractDependencies(ast);
        this.depGraph.setDependencies(schema.name, deps);
      }

      if (schema.async) {
        this.asyncStates.set(schema.name, {
          data: schema.defaultValue,
          loading: false,
          error: null,
          lastFetched: null,
          staleTime: schema.async.staleTime ?? 60_000,
        });
      }
    }

    // Check for circular dependencies
    const cycle = this.depGraph.detectCycle();
    if (cycle) {
      console.error(`[StateEngine] Circular dependency detected: ${cycle.join(" → ")}`);
    }

    // Compute initial derived values
    this.recomputeDerived();
  }

  /** Hydrate state from persistence */
  async hydrate(): Promise<void> {
    if (!this.persistenceAdapter) return;

    for (const [name, scope] of Object.entries(this.scopes)) {
      if (scope === "persisted" || scope === "session") {
        const stored = await this.persistenceAdapter.get(name);
        if (stored !== undefined) {
          this.values[name] = stored;
        }
      }
    }

    this.recomputeDerived();
  }

  /** Set persistence adapter */
  setPersistenceAdapter(adapter: PersistenceAdapter): void {
    this.persistenceAdapter = adapter;
  }

  // ── Get / Set ──────────────────────────────────────────

  /** Get a state value by path */
  get(path: string): unknown {
    const parts = path.split(".");
    let current: unknown = this.values;

    for (const part of parts) {
      if (current == null || typeof current !== "object") return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /** Get async state metadata */
  getAsync(name: string): AsyncStateEntry | undefined {
    return this.asyncStates.get(name);
  }

  /** Set a state value */
  set(path: string, value: unknown): void {
    const prev = this.get(path);
    if (Object.is(prev, value)) return; // No change

    this.saveUndoSnapshot();
    this.setInternal(path, value);
    this.recomputeAffected(path.split(".")[0]);
    this.persistIfNeeded(path.split(".")[0]);
    this.flushNotifications();
  }

  /** Set multiple values at once (batched) */
  setMany(updates: Record<string, unknown>): void {
    this.saveUndoSnapshot();
    this.batch(() => {
      for (const [path, value] of Object.entries(updates)) {
        this.setInternal(path, value);
        this.pendingNotifications.add(path.split(".")[0]);
      }

      // Recompute all affected derived states
      const roots = new Set(Object.keys(updates).map((p) => p.split(".")[0]));
      for (const root of roots) {
        this.recomputeAffected(root);
        this.persistIfNeeded(root);
      }
    });
  }

  /** Merge partial object into an existing state */
  merge(path: string, partial: Record<string, unknown>): void {
    const current = this.get(path);
    if (typeof current !== "object" || current == null) {
      this.set(path, partial);
    } else {
      this.set(path, { ...current as object, ...partial });
    }
  }

  /** Reset state to its default value */
  reset(name: string, defaultValue?: unknown): void {
    this.set(name, defaultValue ?? null);
  }

  private setInternal(path: string, value: unknown): void {
    const parts = path.split(".");

    if (parts.length === 1) {
      this.values[parts[0]] = value;
      this.pendingNotifications.add(parts[0]);
      return;
    }

    // Deep set
    const root = parts[0];
    let current = this.values[root] as Record<string, unknown> | undefined;
    if (current == null || typeof current !== "object") {
      current = {};
      this.values[root] = current;
    }

    for (let i = 1; i < parts.length - 1; i++) {
      if (current[parts[i]] == null || typeof current[parts[i]] !== "object") {
        current[parts[i]] = {};
      }
      current = current[parts[i]] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
    this.pendingNotifications.add(root);
  }

  // ── Derived State ──────────────────────────────────────

  private recomputeDerived(): void {
    const sorted = this.depGraph.topologicalSort();
    const context = this.getEvalContext();

    for (const name of sorted) {
      const ast = this.derivedExpressions[name];
      if (ast) {
        try {
          this.values[name] = evaluate(ast, context);
        } catch (e) {
          console.warn(`[StateEngine] Error computing derived state '${name}':`, e);
        }
      }
    }
  }

  private recomputeAffected(changedRoot: string): void {
    const affected = this.depGraph.getAffected(changedRoot);
    const context = this.getEvalContext();

    for (const name of affected) {
      if (name === changedRoot) continue;
      const ast = this.derivedExpressions[name];
      if (ast) {
        try {
          const newVal = evaluate(ast, context);
          if (!Object.is(this.values[name], newVal)) {
            this.values[name] = newVal;
            this.pendingNotifications.add(name);
          }
        } catch (e) {
          console.warn(`[StateEngine] Error recomputing '${name}':`, e);
        }
      }
    }
  }

  // ── Batching ───────────────────────────────────────────

  /** Execute a function with batched notifications */
  batch(fn: () => void): void {
    this.batchDepth++;
    try {
      fn();
    } finally {
      this.batchDepth--;
      if (this.batchDepth === 0) {
        this.flushNotifications();
      }
    }
  }

  private flushNotifications(): void {
    if (this.batchDepth > 0) return;

    const changed = new Set(this.pendingNotifications);
    this.pendingNotifications.clear();

    for (const path of changed) {
      const value = this.values[path];
      for (const sub of this.subscriptions) {
        if (sub.path === "" || sub.path === path || path.startsWith(sub.path + ".") || sub.path.startsWith(path + ".")) {
          try {
            sub.callback(this.get(sub.path || path), undefined);
          } catch (e) {
            console.warn(`[StateEngine] Subscription error:`, e);
          }
        }
      }
    }
  }

  // ── Subscriptions ──────────────────────────────────────

  /** Subscribe to state changes */
  subscribe(path: string, callback: (value: unknown, prev: unknown) => void): () => void {
    const id = `sub_${this.nextSubId++}`;
    const sub: StateSubscription = { id, path, callback };
    this.subscriptions.push(sub);

    return () => {
      this.subscriptions = this.subscriptions.filter((s) => s.id !== id);
    };
  }

  /** Subscribe to all changes */
  subscribeAll(callback: (changed: Set<string>) => void): () => void {
    const id = `sub_all_${this.nextSubId++}`;
    const wrappedCallback = (value: unknown) => {
      callback(new Set(this.pendingNotifications));
    };
    const sub: StateSubscription = { id, path: "", callback: wrappedCallback };
    this.subscriptions.push(sub);

    return () => {
      this.subscriptions = this.subscriptions.filter((s) => s.id !== id);
    };
  }

  // ── Undo/Redo ──────────────────────────────────────────

  private saveUndoSnapshot(): void {
    this.undoStack.push({
      values: structuredClone(this.values),
      timestamp: Date.now(),
    });
    if (this.undoStack.length > this.maxUndoSize) {
      this.undoStack.shift();
    }
    this.redoStack = []; // Clear redo on new change
  }

  undo(): boolean {
    const snapshot = this.undoStack.pop();
    if (!snapshot) return false;

    this.redoStack.push({
      values: structuredClone(this.values),
      timestamp: Date.now(),
    });

    this.values = snapshot.values;
    this.recomputeDerived();

    // Notify all
    for (const key of Object.keys(this.values)) {
      this.pendingNotifications.add(key);
    }
    this.flushNotifications();

    return true;
  }

  redo(): boolean {
    const snapshot = this.redoStack.pop();
    if (!snapshot) return false;

    this.undoStack.push({
      values: structuredClone(this.values),
      timestamp: Date.now(),
    });

    this.values = snapshot.values;
    this.recomputeDerived();

    for (const key of Object.keys(this.values)) {
      this.pendingNotifications.add(key);
    }
    this.flushNotifications();

    return true;
  }

  // ── Optimistic State ───────────────────────────────────

  /** Apply optimistic update — returns rollback function */
  optimistic(path: string, optimisticValue: unknown): { commit: () => void; rollback: () => void } {
    const previousValue = this.get(path);
    const id = `opt_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    this.setInternal(path, optimisticValue);
    this.flushNotifications();

    const entry: OptimisticEntry = {
      id,
      path,
      optimisticValue,
      previousValue,
      resolve: () => {},
      reject: () => {},
    };
    this.optimisticEntries.set(id, entry);

    return {
      commit: () => {
        this.optimisticEntries.delete(id);
      },
      rollback: () => {
        this.optimisticEntries.delete(id);
        this.setInternal(path, previousValue);
        this.flushNotifications();
      },
    };
  }

  // ── Async State ────────────────────────────────────────

  /** Fetch async state */
  async fetchAsync(
    name: string,
    fetcher: () => Promise<unknown>,
    options?: { force?: boolean }
  ): Promise<unknown> {
    const entry = this.asyncStates.get(name);
    if (!entry) {
      throw new Error(`[StateEngine] No async state configured for '${name}'`);
    }

    // Check staleness
    if (!options?.force && entry.lastFetched && Date.now() - entry.lastFetched < entry.staleTime) {
      return entry.data;
    }

    // Set loading
    entry.loading = true;
    entry.error = null;
    this.asyncStates.set(name, { ...entry });
    this.pendingNotifications.add(name);
    this.flushNotifications();

    try {
      const data = await fetcher();
      entry.data = data;
      entry.loading = false;
      entry.lastFetched = Date.now();
      this.values[name] = data;
      this.asyncStates.set(name, { ...entry });
      this.recomputeAffected(name);
      this.flushNotifications();
      return data;
    } catch (e) {
      entry.loading = false;
      entry.error = e instanceof Error ? e.message : String(e);
      this.asyncStates.set(name, { ...entry });
      this.pendingNotifications.add(name);
      this.flushNotifications();
      throw e;
    }
  }

  // ── Persistence ────────────────────────────────────────

  private async persistIfNeeded(name: string): Promise<void> {
    if (!this.persistenceAdapter) return;
    const scope = this.scopes[name];
    if (scope === "persisted" || scope === "session") {
      await this.persistenceAdapter.set(name, this.values[name]);
    }
  }

  // ── Context ────────────────────────────────────────────

  /** Get all state as an evaluation context for expressions */
  getEvalContext(): EvalContext {
    return { ...this.values };
  }

  /** Get all state values (shallow copy) */
  getAll(): Record<string, unknown> {
    return { ...this.values };
  }

  /** Serialize state for transport/storage */
  serialize(): string {
    return JSON.stringify({
      values: this.values,
      scopes: this.scopes,
    });
  }

  /** Restore from serialized state */
  deserialize(json: string): void {
    const data = JSON.parse(json);
    this.values = data.values;
    this.scopes = data.scopes;
    this.recomputeDerived();
  }

  /** Destroy and clean up */
  destroy(): void {
    this.subscriptions = [];
    this.undoStack = [];
    this.redoStack = [];
    this.optimisticEntries.clear();
    this.asyncStates.clear();
    this.depGraph.clear();
  }
}

// ── Persistence Adapter Interface ────────────────────────────

export interface PersistenceAdapter {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
}

/** Browser localStorage adapter */
export class LocalStoragePersistence implements PersistenceAdapter {
  private prefix: string;
  constructor(prefix = "mint_state_") { this.prefix = prefix; }

  async get(key: string): Promise<unknown> {
    if (typeof localStorage === "undefined") return undefined;
    const raw = localStorage.getItem(this.prefix + key);
    return raw ? JSON.parse(raw) : undefined;
  }

  async set(key: string, value: unknown): Promise<void> {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(this.prefix + key, JSON.stringify(value));
  }

  async remove(key: string): Promise<void> {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(this.prefix + key);
  }
}
