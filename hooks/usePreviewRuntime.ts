"use client";

// Preview runtime: eval context, API fetching, action flow execution.
// Used by PrototypePreview to evaluate bindings and run B5 action flows live.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useFigmaStore, type GlobalStateVar, type ApiSource, type ActionStep } from '@/lib/stores/figmaStore';
import { evalExpression } from '@/lib/runtime/expressions';

export type EvalCtx = Record<string, unknown>;

export interface ToastItem {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface PreviewRuntime {
  evalCtx: EvalCtx;
  /** Safely evaluate an expression. Returns undefined on parse/eval error. */
  evalExpr: (expr: string, local?: EvalCtx) => unknown;
  setVar: (dotPath: string, value: unknown) => void;
  dispatchFlow: (flowId: string, onNavigate: (target: string) => void) => Promise<void>;
  toasts: ToastItem[];
  dismissToast: (id: string) => void;
  apiStatus: Record<string, 'loading' | 'loaded' | 'error'>;
}

// ── Helpers ──────────────────────────────────────────────────

function buildInitialCtx(vars: GlobalStateVar[]): EvalCtx {
  const ctx: EvalCtx = { global: {}, page: {}, api: {} };
  for (const v of vars) {
    let parsed: unknown = null;
    try { if (v.defaultValue) parsed = JSON.parse(v.defaultValue); } catch { parsed = v.defaultValue || null; }
    (ctx[v.scope === 'global' ? 'global' : 'page'] as Record<string, unknown>)[v.name] = parsed;
  }
  return ctx;
}

function setAtPath(ctx: EvalCtx, dotPath: string, value: unknown): EvalCtx {
  const parts = dotPath.split('.');
  if (parts.length === 1) return { ...ctx, [dotPath]: value };
  const next = { ...ctx };
  let cur = next as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    cur[parts[i]] = typeof cur[parts[i]] === 'object' && cur[parts[i]] !== null
      ? { ...(cur[parts[i]] as object) } : {};
    cur = cur[parts[i]] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
  return next;
}

async function doFetch(source: ApiSource): Promise<unknown> {
  const headers: Record<string, string> = { ...source.headers };
  if (source.authType === 'bearer' && source.authValue) {
    headers['Authorization'] = `Bearer ${source.authValue}`;
  } else if (source.authType === 'apiKey' && source.authKeyName && source.authValue) {
    headers[source.authKeyName] = source.authValue;
  } else if (source.authType === 'basic' && source.authValue) {
    headers['Authorization'] = `Basic ${btoa(source.authValue)}`;
  }
  const url = new URL(source.url);
  for (const [k, v] of Object.entries(source.queryParams ?? {})) {
    if (k && v) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    method: source.method,
    headers,
    ...(source.bodyTemplate && ['POST', 'PUT', 'PATCH'].includes(source.method)
      ? { body: source.bodyTemplate } : {}),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!source.responsePath) return data;
  const parts = source.responsePath.split('.');
  let cur: unknown = data;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return cur;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

// ── Hook ─────────────────────────────────────────────────────

export function usePreviewRuntime(): PreviewRuntime {
  const { globalStateVars, apiSources, actionFlows } = useFigmaStore();

  const [evalCtx, setEvalCtx] = useState<EvalCtx>(() => buildInitialCtx(globalStateVars));
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [apiStatus, setApiStatus] = useState<Record<string, 'loading' | 'loaded' | 'error'>>({});

  // Refs avoid stale closures inside callbacks
  const evalCtxRef = useRef(evalCtx);
  evalCtxRef.current = evalCtx;
  const globalStateVarsRef = useRef(globalStateVars);
  globalStateVarsRef.current = globalStateVars;
  const apiSourcesRef = useRef(apiSources);
  apiSourcesRef.current = apiSources;
  const actionFlowsRef = useRef(actionFlows);
  actionFlowsRef.current = actionFlows;

  // Ref for recursive executeSteps (condition branches)
  const executeStepsRef = useRef<(steps: ActionStep[], onNavigate: (t: string) => void) => Promise<void>>(
    async () => {}
  );

  // Auto-fetch sources with autoFetch: true on mount
  useEffect(() => {
    for (const source of apiSources.filter(s => s.autoFetch && s.url)) {
      setApiStatus(p => ({ ...p, [source.name]: 'loading' }));
      doFetch(source)
        .then(data => {
          setEvalCtx(p => ({ ...p, api: { ...(p.api as object), [source.name]: data } }));
          setApiStatus(p => ({ ...p, [source.name]: 'loaded' }));
        })
        .catch(() => setApiStatus(p => ({ ...p, [source.name]: 'error' })));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const evalExpr = useCallback((expr: string, local?: EvalCtx): unknown => {
    try {
      return evalExpression(expr, local ? { ...evalCtxRef.current, ...local } : evalCtxRef.current);
    } catch { return undefined; }
  }, []); // reads from ref — always fresh, no deps needed

  const setVar = useCallback((dotPath: string, value: unknown) => {
    setEvalCtx(p => setAtPath(p, dotPath, value));
  }, []);

  const addToast = useCallback((message: string, type: ToastItem['type'] = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(p => p.filter(t => t.id !== id));
  }, []);

  const executeSteps = useCallback(async (
    steps: ActionStep[],
    onNavigate: (target: string) => void,
  ): Promise<void> => {
    for (const step of steps) {
      switch (step.type) {
        case 'navigate':
          if (step.navigateTo) onNavigate(step.navigateTo);
          break;
        case 'goBack':
          onNavigate('__back__');
          break;
        case 'setState':
          if (step.stateTarget != null) {
            const val: unknown = step.stateValue ?? null;
            setEvalCtx(p => setAtPath(p, step.stateTarget!, val));
          }
          break;
        case 'updateState':
          if (step.stateTarget && step.stateValue) {
            const expr = step.stateValue;
            setEvalCtx(p => {
              try { return setAtPath(p, step.stateTarget!, evalExpression(expr, p)); }
              catch { return p; }
            });
          }
          break;
        case 'resetState':
          setEvalCtx(() => buildInitialCtx(globalStateVarsRef.current));
          break;
        case 'fetch': {
          const source = apiSourcesRef.current.find(s => s.id === step.apiSourceId);
          if (source) {
            try {
              const data = await doFetch(source);
              const key = step.apiResultBinding || source.name;
              setEvalCtx(p => ({ ...p, api: { ...(p.api as object), [key]: data } }));
            } catch {}
          }
          break;
        }
        case 'toast':
        case 'alert':
          if (step.toastMessage) addToast(step.toastMessage, step.toastType ?? 'info');
          break;
        case 'delay':
          if (step.delayMs) await new Promise<void>(r => setTimeout(r, step.delayMs!));
          break;
        case 'condition': {
          let cond = false;
          try { cond = Boolean(step.conditionExpr && evalExpression(step.conditionExpr, evalCtxRef.current)); } catch {}
          const branch = cond ? (step.thenSteps ?? []) : (step.elseSteps ?? []);
          if (branch.length) await executeStepsRef.current(branch, onNavigate);
          break;
        }
      }
    }
  }, [addToast]);

  // Keep ref in sync for recursive calls
  executeStepsRef.current = executeSteps;

  const dispatchFlow = useCallback(async (flowId: string, onNavigate: (target: string) => void) => {
    const flow = actionFlowsRef.current.find(f => f.id === flowId);
    if (!flow?.steps.length) return;
    await executeSteps(flow.steps, onNavigate);
  }, [executeSteps]);

  return { evalCtx, evalExpr, setVar, dispatchFlow, toasts, dismissToast, apiStatus };
}
