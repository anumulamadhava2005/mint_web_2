// ═══════════════════════════════════════════════════════════════
// RuntimeProvider — hosts the runtime engines for a live AppSchema
//
// Instantiates StateEngine + BindingEngine + ActionRegistry once per
// schema, seeds global (and screen-local) state, registers global +
// screen actions, and wires a navigation adapter. SchemaRenderer reads
// this via useRuntime() to fire events, resolve bindings, and re-render
// on state changes. This is the missing "host" that makes a rendered
// schema actually interactive (Phase 1 of schema-as-truth).
// ═══════════════════════════════════════════════════════════════
"use client";

import React, { createContext, useContext, useEffect, useMemo } from "react";
import type { AppSchema, ActionRef } from "@/lib/runtime/schema";
import { StateEngine } from "@/lib/runtime/state";
import { BindingEngine } from "@/lib/runtime/bindings";
import { ActionRegistry, type ActionContext, type NavigationAdapter } from "@/lib/runtime/actions";

export interface RuntimeHandle {
  state: StateEngine;
  bindingEngine: BindingEngine;
  actionRegistry: ActionRegistry;
  navigation: NavigationAdapter;
  /** Dispatch one or more action refs with an optional triggering event + extra params. */
  dispatch: (refs: ActionRef | ActionRef[], event?: unknown, params?: Record<string, unknown>) => Promise<void>;
}

const RuntimeContext = createContext<RuntimeHandle | null>(null);

/** Access the active runtime, or null when rendered outside a provider (e.g. static render/tests). */
export function useRuntime(): RuntimeHandle | null {
  return useContext(RuntimeContext);
}

export interface RuntimeProviderProps {
  schema: AppSchema;
  children: React.ReactNode;
  /** Called when an action navigates; the host (preview) switches the visible screen. */
  onNavigate?: (route: string, params?: Record<string, unknown>) => void;
  /** Called when an action requests back navigation. */
  onBack?: () => void;
}

export function RuntimeProvider({ schema, children, onNavigate, onBack }: RuntimeProviderProps) {
  // Stable callback refs so the engine memo doesn't rebuild on every render.
  const navCb = React.useRef(onNavigate);
  const backCb = React.useRef(onBack);
  navCb.current = onNavigate;
  backCb.current = onBack;

  const handle = useMemo<RuntimeHandle>(() => {
    const state = new StateEngine();

    // Seed global state, then every screen's local state (names are app-wide
    // in the flat state model; later screens override on collision).
    if (schema.globalState?.length) state.initFromSchema(schema.globalState);
    for (const screen of schema.screens ?? []) {
      if (screen.localState?.length) state.initFromSchema(screen.localState);
    }

    const bindingEngine = new BindingEngine(state);

    const actionRegistry = new ActionRegistry();
    if (schema.globalActions?.length) actionRegistry.registerSchemas(schema.globalActions);
    for (const screen of schema.screens ?? []) {
      if (screen.actions?.length) actionRegistry.registerSchemas(screen.actions);
    }

    const navigation: NavigationAdapter = {
      navigate: (route, params) => navCb.current?.(route, params),
      goBack: () => backCb.current?.(),
      replace: (route, params) => navCb.current?.(route, params),
      reset: (routes) => { if (routes[0]) navCb.current?.(routes[0]); },
    };

    const dispatch: RuntimeHandle["dispatch"] = async (refs, event, params) => {
      const list = Array.isArray(refs) ? refs : [refs];
      const ctx: ActionContext = { state, navigation, event, params };
      for (const ref of list) {
        try {
          await actionRegistry.dispatch(ref, ctx);
        } catch (e) {
          console.warn("[RuntimeProvider] action dispatch failed:", e);
        }
      }
    };

    return { state, bindingEngine, actionRegistry, navigation, dispatch };
    // Rebuild only when the schema object identity changes (zustand/immer gives
    // a new reference on edits) — fine for a preview session.
  }, [schema]);

  // Clean up engines when the schema changes or the provider unmounts.
  useEffect(() => {
    return () => {
      handle.actionRegistry.destroy();
      handle.bindingEngine.destroy();
      handle.state.destroy();
    };
  }, [handle]);

  return <RuntimeContext.Provider value={handle}>{children}</RuntimeContext.Provider>;
}
