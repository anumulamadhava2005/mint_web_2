// ═══════════════════════════════════════════════════════════════
// figmaStore → runtime AppSchema assembler.
//
// Bridges the editor's live state into the schema the runtime engine
// (StateEngine + BindingEngine + ActionRegistry) consumes, so the
// in-editor preview runs the real runtime — the same one that powers
// exported apps. Built fresh on each preview open.
// ═══════════════════════════════════════════════════════════════

import { useFigmaStore, type ActionFlow, type ActionStep, type GlobalStateVar, type FigmaLayer, type AuthConfig } from './figmaStore';
import { figmaPageToScreenSchemas, figmaLayerToComponent } from '@/lib/runtime/figmaToSchema';
import { dbConfigToRuntimeSchema } from './figmaDbToSchema';
import type {
  AppSchema, ScreenSchema, StateNodeSchema, StateScope, StateType,
  ActionSchema, ActionType, ActionRef, AuthConfigSchema,
} from '@/lib/runtime/schema';

// figmaStore.AuthConfig → runtime AuthConfigSchema (only when auth is enabled).
function authToSchema(a: AuthConfig | undefined): AuthConfigSchema | undefined {
  if (!a || !a.enabled) return undefined;
  return {
    providers: (a.providers ?? []).map(p => ({ type: p.type, enabled: p.enabled })),
    sessionType: a.sessionType,
    tokenExpiry: a.tokenExpiry,
    refreshEnabled: a.refresh,
    ...(a.roles?.length ? { rbac: { roles: a.roles, defaultRole: a.defaultRole } } : {}),
    ...(a.mfaEnabled ? { mfa: { enabled: true, methods: [a.mfaType] } } : {}),
    userStatePath: 'user',
    roleField: 'role',
  };
}

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

// Columns to populate from $form for a create/update on a table (skip PK + auto).
function formColumns(table: string): string[] {
  const t = useFigmaStore.getState().database?.tables?.find(tb => tb.name === table);
  if (!t) return [];
  return t.fields
    .filter(f => !f.primary && f.name !== 'created_at' && f.name !== 'updated_at' && f.name !== 'deleted_at')
    .map(f => f.name);
}

function stepToSchema(step: ActionStep, id: string, projectId: string): ActionSchema {
  const base = { id, name: step.label ?? step.type } as ActionSchema;
  switch (step.type) {
    case 'dbInsert': {
      const table = step.dbTable ?? '';
      const values = step.dbValues && Object.keys(step.dbValues).length
        ? step.dbValues
        : Object.fromEntries(formColumns(table).map(c => [c, `$form.${c}`]));
      return { ...base, type: 'dbInsert', config: { projectId, table, values } };
    }
    case 'dbUpdate': {
      const table = step.dbTable ?? '';
      const values = step.dbValues && Object.keys(step.dbValues).length
        ? step.dbValues
        : Object.fromEntries(formColumns(table).map(c => [c, `$form.${c}`]));
      const where = step.dbWhere && Object.keys(step.dbWhere).length
        ? step.dbWhere
        : { id: '$item.id' };
      return { ...base, type: 'dbUpdate', config: { projectId, table, values, where } };
    }
    case 'dbDelete': {
      const where = step.dbWhere && Object.keys(step.dbWhere).length
        ? step.dbWhere
        : { id: '$item.id' };
      return { ...base, type: 'dbDelete', config: { projectId, table: step.dbTable ?? '', where } };
    }
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
    case 'signUp': {
      const ab = step.authBindings ?? {};
      return {
        ...base, type: 'signUp',
        config: {
          url: `/api/app-auth/${projectId}/signup`,
          email: ab.email || '$form.email',
          password: ab.password || '$form.password',
          name: ab.name || '$form.username',
          userPath: 'user', tokenPath: 'token',
        },
      };
    }
    case 'signIn': {
      const ab = step.authBindings ?? {};
      return {
        ...base, type: 'signIn',
        config: {
          url: `/api/app-auth/${projectId}/login`,
          email: ab.email || '$form.email',
          password: ab.password || '$form.password',
          userPath: 'user', tokenPath: 'token',
        },
      };
    }
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
    const requiresAuth = !!root?.requiresAuth;
    const withMount = tables.size
      ? { ...screen, onMount: [...(screen.onMount ?? []), ...[...tables].map(t => ({ actionId: loadActionId(t) } as ActionRef))] }
      : { ...screen };
    if (requiresAuth) withMount.requiresAuth = true;
    return withMount;
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

  // After a write, refresh the affected table's list (if that table is shown
  // via a data source) so the UI reflects the change without a manual reload.
  for (const a of globalActions) {
    if ((a.type === 'dbInsert' || a.type === 'dbUpdate' || a.type === 'dbDelete') && !a.onSuccess) {
      const table = String((a.config as { table?: string }).table ?? '');
      if (table && allTables.has(table)) {
        a.onSuccess = [{ actionId: loadActionId(table) } as ActionRef];
      }
    }
  }

  // Login route = the screen that hosts a sign-in / sign-up action (protected
  // screens redirect here when no user is signed in).
  const authActionIds = new Set(globalActions.filter(a => a.type === 'signIn' || a.type === 'signUp').map(a => a.id));
  const screenHasAuth = (comps: AppSchema['screens'][number]['components']): boolean => {
    for (const c of comps ?? []) {
      for (const refs of Object.values(c.events ?? {})) {
        for (const r of refs) { const id = typeof r === 'string' ? r : r.actionId; if (authActionIds.has(id)) return true; }
      }
      if (c.children && screenHasAuth(c.children)) return true;
    }
    return false;
  };
  const loginRoute = screens.find(sc => screenHasAuth(sc.components))?.route ?? screens[0]?.route ?? '/';

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
      loginRoute,
    },
    ...(authToSchema(s.auth) ? { auth: authToSchema(s.auth) } : {}),
    ...(s.database?.tables?.length ? { database: dbConfigToRuntimeSchema(s.database) } : {}),
  };
}
