// ═══════════════════════════════════════════════════════════════
// figmaStore → runtime AppSchema assembler.
//
// Bridges the editor's live state into the schema the runtime engine
// (StateEngine + BindingEngine + ActionRegistry) consumes, so the
// in-editor preview runs the real runtime — the same one that powers
// exported apps. Built fresh on each preview open.
// ═══════════════════════════════════════════════════════════════

import { useFigmaStore, type ActionFlow, type ActionStep, type GlobalStateVar, type FigmaLayer } from './figmaStore';
import { figmaPageToScreenSchemas, figmaLayerToComponent } from '@/lib/runtime/figmaToSchema';
import type {
  AppSchema, ScreenSchema, StateNodeSchema, StateScope, StateType,
  ActionSchema, ActionType, ActionRef,
} from '@/lib/runtime/schema';

const EMPTY_THEME = { colors: {}, fonts: {}, spacing: {}, radii: {}, shadows: {} };

function parseDefault(v: GlobalStateVar): unknown {
  if (!v.defaultValue) return v.type === 'object' ? {} : v.type === 'array' ? [] : null;
  try { return JSON.parse(v.defaultValue); } catch { return v.defaultValue; }
}

function varsToState(vars: GlobalStateVar[]): StateNodeSchema[] {
  const nodes: StateNodeSchema[] = vars.map(v => ({
    id: v.id,
    name: v.name,
    scope: (v.scope === 'global' ? 'global' : 'local') as StateScope,
    defaultValue: parseDefault(v),
    type: v.type as StateType,
  }));
  // The signed-in user lives at $user (matches the runtime signUp default and
  // the binding picker's Auth group). Ensure it exists for display bindings.
  if (!nodes.some(n => n.name === 'user')) {
    nodes.push({ id: 'state-user', name: 'user', scope: 'global', defaultValue: null, type: 'object' });
  }
  if (!nodes.some(n => n.name === 'form')) {
    nodes.push({ id: 'state-form', name: 'form', scope: 'global', defaultValue: {}, type: 'object' });
  }
  return nodes;
}

// ── ActionFlow → ActionSchema[] ──────────────────────────────
// A flow's steps run sequentially. We register each step as its own action and
// chain them via onSuccess; the flow's entry action keeps the flow id so layer
// events can reference it. Branching (condition) is kept shallow for the slice.

function stepToSchema(step: ActionStep, id: string, projectId: string): ActionSchema {
  const base = { id, name: step.label ?? step.type } as ActionSchema;
  switch (step.type) {
    case 'navigate':
      return { ...base, type: 'navigate', config: { route: step.navigateTo ?? '/', replace: !!step.navigateReplace } };
    case 'goBack':
      return { ...base, type: 'goBack', config: {} };
    case 'setState':
      return { ...base, type: 'setState', config: { path: step.stateTarget ?? '', value: step.stateValue ?? '' } };
    case 'updateState':
      return { ...base, type: 'updateState', config: { path: step.stateTarget ?? '', value: step.stateValue ?? '' } };
    case 'resetState':
      return { ...base, type: 'resetState', config: { path: step.stateTarget ?? '' } };
    case 'toast':
      return { ...base, type: 'toast', config: { message: step.toastMessage ?? '', type: step.toastType ?? 'info' } };
    case 'signUp':
      return {
        ...base, type: 'signUp',
        config: {
          url: `/api/app-auth/${projectId}/signup`,
          email: '$form.email', password: '$form.password', name: '$form.username',
          userPath: 'user', tokenPath: 'token',
        },
      };
    case 'signIn':
      return {
        ...base, type: 'signIn',
        config: {
          url: `/api/app-auth/${projectId}/login`,
          email: '$form.email', password: '$form.password',
          userPath: 'user', tokenPath: 'token',
        },
      };
    case 'signOut':
      return { ...base, type: 'signOut', config: { url: `/api/app-auth/${projectId}/logout`, userPath: 'user', tokenPath: 'token' } };
    case 'delay':
      return { ...base, type: 'delay', config: { ms: step.delayMs ?? 0 } };
    default:
      // Unsupported in the slice — no-op custom action.
      return { ...base, type: 'custom' as ActionType, config: {} };
  }
}

export function actionFlowToSchemas(flow: ActionFlow, projectId: string): ActionSchema[] {
  const steps = flow.steps ?? [];
  if (steps.length === 0) return [{ id: flow.id, name: flow.name, type: 'custom', config: {} }];

  const schemas = steps.map((step, i) => stepToSchema(step, `${flow.id}__${i}`, projectId));
  // Chain sequential execution via onSuccess.
  for (let i = 0; i < schemas.length - 1; i++) {
    schemas[i].onSuccess = [{ actionId: schemas[i + 1].id } as ActionRef];
  }
  // The entry action keeps the flow id so layerEvents can reference it directly.
  schemas[0] = { ...schemas[0], id: flow.id };
  return schemas;
}

// ── Data sources ─────────────────────────────────────────────
// A container bound to a table (layer.dataSource) becomes a live list: the
// table's rows load into $<table> on screen mount, and the frame repeats per row.

function collectTables(layer: FigmaLayer, out: Set<string>): void {
  if (layer.dataSource?.table) out.add(layer.dataSource.table);
  for (const c of layer.children ?? []) collectTables(c, out);
}

function loadActionId(table: string): string {
  return `load_${table}`;
}

function dbQueryAction(table: string, projectId: string): ActionSchema {
  return {
    id: loadActionId(table),
    name: `Load ${table}`,
    type: 'dbQuery',
    config: {
      projectId,
      sql: `SELECT * FROM ${table} ORDER BY 1 DESC LIMIT 100`,
      storePath: table,
    },
  };
}

// ── Full AppSchema ───────────────────────────────────────────

export function buildAppSchemaFromFigma(projectId: string): AppSchema {
  const s = useFigmaStore.getState();
  const page = s.pages.find(p => p.id === s.activePageId) ?? s.pages[0];
  const pageLayers = (page && s.layers[page.id]) || [];

  let screens: ScreenSchema[] = page ? figmaPageToScreenSchemas(page, pageLayers) : [];

  // Fallback: if the design has no frames, wrap top-level layers in one screen
  // so there's always something to preview.
  if (screens.length === 0 && pageLayers.length > 0) {
    screens = [{
      id: 'screen-root', name: 'Screen', route: '/',
      components: pageLayers.filter(l => l.type !== 'comment').map(figmaLayerToComponent),
      localState: [], actions: [], backgroundColor: '#ffffff',
    }];
  }

  const globalActions = (s.actionFlows ?? []).flatMap(f => actionFlowToSchemas(f, projectId));

  // Data sources: find tables bound to containers on each screen, add a list
  // state var + a dbQuery load action per table, and run the loads on mount.
  const frameById = new Map(pageLayers.map(f => [f.id, f]));
  const allTables = new Set<string>();
  screens = screens.map(screen => {
    const root = frameById.get(screen.id);
    const tables = new Set<string>();
    if (root) collectTables(root, tables);
    else pageLayers.forEach(l => collectTables(l, tables)); // synthetic screen
    tables.forEach(t => allTables.add(t));
    return tables.size
      ? { ...screen, onMount: [...(screen.onMount ?? []), ...[...tables].map(t => ({ actionId: loadActionId(t) } as ActionRef))] }
      : screen;
  });

  const globalState = varsToState(s.globalStateVars ?? []);
  for (const t of allTables) {
    if (!globalState.some(n => n.name === t)) {
      globalState.push({ id: `ds-${t}`, name: t, scope: 'global', defaultValue: [], type: 'array' });
    }
    if (!globalActions.some(a => a.id === loadActionId(t))) {
      globalActions.push(dbQueryAction(t, projectId));
    }
  }

  return {
    id: projectId,
    name: s.fileName || 'App',
    version: '1.0.0',
    schemaVersion: 1,
    theme: EMPTY_THEME,
    screens,
    globalState,
    globalActions,
    workflows: [],
    navigation: {
      type: 'stack',
      initialRoute: screens[0]?.route ?? '/',
      routes: screens.map(sc => ({ path: sc.route, screenId: sc.id })),
    },
  };
}
