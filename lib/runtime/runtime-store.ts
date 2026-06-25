// ═══════════════════════════════════════════════════════════════
// Runtime Schema Store — Bridges the editor canvas to the runtime
//
// This Zustand store manages the runtime schema that gets bundled
// into exported apps. It translates canvas shapes into:
//   - State definitions
//   - Action schemas
//   - Data bindings
//   - Workflow graphs
//   - Database table schemas
//
// The schema is persisted alongside the design file and committed
// to the server when the user exports or deploys.
// ═══════════════════════════════════════════════════════════════

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  AppSchema,
  ScreenSchema,
  StateNodeSchema,
  ActionSchema,
  WorkflowSchema,
  WorkflowNode,
  WorkflowEdge,
  DatabaseConfigSchema,
  TableSchema,
  FieldSchema,
  RelationSchema,
  IndexSchema,
  PolicySchema,
  ComponentSchema,
  NavigationSchema,
  RouteSchema,
  ThemeSchema,
  AuthConfigSchema,
} from "../runtime/schema";

// ── Store State ──────────────────────────────────────────────

export interface RuntimeSchemaState {
  // The full app schema
  schema: AppSchema;
  // Dirty flag
  dirty: boolean;
  // Active tab in the runtime panel
  activeTab: "state" | "actions" | "workflows" | "database" | "settings";

  // ── State Actions ─────────────────────────────────────────

  // Initialize from saved schema or create default
  initSchema: (projectId: string, projectName: string, saved?: Partial<AppSchema>) => void;

  // State management
  addGlobalState: (state: StateNodeSchema) => void;
  updateGlobalState: (id: string, updates: Partial<StateNodeSchema>) => void;
  removeGlobalState: (id: string) => void;
  addScreenState: (screenId: string, state: StateNodeSchema) => void;

  // Action management
  addGlobalAction: (action: ActionSchema) => void;
  updateGlobalAction: (id: string, updates: Partial<ActionSchema>) => void;
  removeGlobalAction: (id: string) => void;
  addScreenAction: (screenId: string, action: ActionSchema) => void;

  // Screen management
  addScreen: (screen: ScreenSchema) => void;
  updateScreen: (id: string, updates: Partial<ScreenSchema>) => void;
  removeScreen: (id: string) => void;

  // Component (screen UI) management
  addComponent: (screenId: string, component: ComponentSchema) => void;
  updateComponent: (screenId: string, componentId: string, updates: Partial<ComponentSchema>) => void;
  removeComponent: (screenId: string, componentId: string) => void;
  moveComponent: (screenId: string, componentId: string, dir: -1 | 1) => void;

  // Workflow management
  addWorkflow: (workflow: WorkflowSchema) => void;
  updateWorkflow: (id: string, updates: Partial<WorkflowSchema>) => void;
  removeWorkflow: (id: string) => void;
  addWorkflowNode: (workflowId: string, node: WorkflowNode) => void;
  updateWorkflowNode: (workflowId: string, nodeId: string, updates: Partial<WorkflowNode>) => void;
  removeWorkflowNode: (workflowId: string, nodeId: string) => void;
  addWorkflowEdge: (workflowId: string, edge: WorkflowEdge) => void;
  removeWorkflowEdge: (workflowId: string, edgeId: string) => void;

  // Database management
  setDatabaseConfig: (config: DatabaseConfigSchema) => void;
  addTable: (table: TableSchema) => void;
  updateTable: (id: string, updates: Partial<TableSchema>) => void;
  removeTable: (id: string) => void;
  addField: (tableId: string, field: FieldSchema) => void;
  updateField: (tableId: string, fieldName: string, updates: Partial<FieldSchema>) => void;
  removeField: (tableId: string, fieldName: string) => void;
  // Relations / indexes / policies (RLS)
  addRelation: (tableId: string, relation: RelationSchema) => void;
  removeRelation: (tableId: string, index: number) => void;
  addIndex: (tableId: string, index: IndexSchema) => void;
  removeIndex: (tableId: string, indexName: string) => void;
  addPolicy: (tableId: string, policy: PolicySchema) => void;
  removePolicy: (tableId: string, policyName: string) => void;

  // Theme
  updateTheme: (theme: Partial<ThemeSchema>) => void;

  // Navigation
  updateNavigation: (updates: Partial<NavigationSchema>) => void;
  addRoute: (route: RouteSchema) => void;
  removeRoute: (path: string) => void;

  // Auth
  setAuthConfig: (auth: AuthConfigSchema) => void;
  updateAuthConfig: (updates: Partial<AuthConfigSchema>) => void;

  // UI
  setActiveTab: (tab: RuntimeSchemaState["activeTab"]) => void;

  // Serialization
  getSchema: () => AppSchema;
  exportSchema: () => string;
  importSchema: (json: string) => boolean;

  // Link canvas frames to screens
  linkFrameToScreen: (frameId: string, frameName: string) => void;
  unlinkFrame: (frameId: string) => void;

  // Sync: merge canvas state into runtime schema
  syncFromCanvas: (frames: Array<{ id: string; name: string }>) => void;
}

// ── Default Schema ───────────────────────────────────────────

function createDefaultSchema(projectId: string, projectName: string): AppSchema {
  return {
    id: projectId,
    name: projectName,
    version: "1.0.0",
    schemaVersion: 1,
    theme: {
      colors: {
        primary: "#6366F1",
        secondary: "#8B5CF6",
        background: "#FFFFFF",
        surface: "#F9FAFB",
        text: "#111827",
        textSecondary: "#6B7280",
        error: "#EF4444",
        success: "#10B981",
        warning: "#F59E0B",
      },
      fonts: {
        heading: "Inter",
        body: "Inter",
        mono: "JetBrains Mono",
      },
      spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
      radii: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
      shadows: {},
    },
    screens: [],
    globalState: [],
    globalActions: [],
    workflows: [],
    navigation: {
      type: "stack",
      initialRoute: "/",
      routes: [],
    },
  };
}

// ── Store ─────────────────────────────────────────────────────

export const useRuntimeStore = create<RuntimeSchemaState>()(
  immer((set, get) => ({
    schema: createDefaultSchema("", "Untitled"),
    dirty: false,
    activeTab: "state",

    // ── Init ─────────────────────────────────────────────────
    initSchema: (projectId, projectName, saved) => {
      set((s) => {
        if (saved && saved.id) {
          s.schema = { ...createDefaultSchema(projectId, projectName), ...saved } as any;
        } else {
          s.schema = createDefaultSchema(projectId, projectName) as any;
        }
        s.dirty = false;
      });
    },

    // ── Global State ─────────────────────────────────────────
    addGlobalState: (state) => {
      set((s) => {
        s.schema.globalState.push(state as any);
        s.dirty = true;
      });
    },

    updateGlobalState: (id, updates) => {
      set((s) => {
        const idx = s.schema.globalState.findIndex((st: any) => st.id === id);
        if (idx >= 0) {
          Object.assign(s.schema.globalState[idx], updates);
          s.dirty = true;
        }
      });
    },

    removeGlobalState: (id) => {
      set((s) => {
        s.schema.globalState = s.schema.globalState.filter((st: any) => st.id !== id) as any;
        s.dirty = true;
      });
    },

    addScreenState: (screenId, state) => {
      set((s) => {
        const screen = s.schema.screens.find((sc: any) => sc.id === screenId);
        if (screen) {
          (screen as any).localState.push(state);
          s.dirty = true;
        }
      });
    },

    // ── Global Actions ───────────────────────────────────────
    addGlobalAction: (action) => {
      set((s) => {
        s.schema.globalActions.push(action as any);
        s.dirty = true;
      });
    },

    updateGlobalAction: (id, updates) => {
      set((s) => {
        const idx = s.schema.globalActions.findIndex((a: any) => a.id === id);
        if (idx >= 0) {
          Object.assign(s.schema.globalActions[idx], updates);
          s.dirty = true;
        }
      });
    },

    removeGlobalAction: (id) => {
      set((s) => {
        s.schema.globalActions = s.schema.globalActions.filter((a: any) => a.id !== id) as any;
        s.dirty = true;
      });
    },

    addScreenAction: (screenId, action) => {
      set((s) => {
        const screen = s.schema.screens.find((sc: any) => sc.id === screenId);
        if (screen) {
          (screen as any).actions.push(action);
          s.dirty = true;
        }
      });
    },

    // ── Screens ──────────────────────────────────────────────
    addScreen: (screen) => {
      set((s) => {
        s.schema.screens.push(screen as any);
        s.dirty = true;
      });
    },

    updateScreen: (id, updates) => {
      set((s) => {
        const idx = s.schema.screens.findIndex((sc: any) => sc.id === id);
        if (idx >= 0) {
          Object.assign(s.schema.screens[idx], updates);
          s.dirty = true;
        }
      });
    },

    removeScreen: (id) => {
      set((s) => {
        s.schema.screens = s.schema.screens.filter((sc: any) => sc.id !== id) as any;
        s.dirty = true;
      });
    },

    // ── Components (screen UI tree) ──────────────────────────
    addComponent: (screenId, component) => {
      set((s) => {
        const screen = s.schema.screens.find((sc: any) => sc.id === screenId);
        if (screen) {
          if (!(screen as any).components) (screen as any).components = [];
          (screen as any).components.push(component);
          s.dirty = true;
        }
      });
    },

    updateComponent: (screenId, componentId, updates) => {
      set((s) => {
        const screen = s.schema.screens.find((sc: any) => sc.id === screenId);
        if (!screen) return;
        const idx = ((screen as any).components || []).findIndex((c: any) => c.id === componentId);
        if (idx >= 0) {
          Object.assign((screen as any).components[idx], updates);
          s.dirty = true;
        }
      });
    },

    removeComponent: (screenId, componentId) => {
      set((s) => {
        const screen = s.schema.screens.find((sc: any) => sc.id === screenId);
        if (!screen) return;
        (screen as any).components = ((screen as any).components || []).filter((c: any) => c.id !== componentId);
        s.dirty = true;
      });
    },

    moveComponent: (screenId, componentId, dir) => {
      set((s) => {
        const screen = s.schema.screens.find((sc: any) => sc.id === screenId);
        if (!screen) return;
        const comps = (screen as any).components || [];
        const idx = comps.findIndex((c: any) => c.id === componentId);
        const next = idx + dir;
        if (idx < 0 || next < 0 || next >= comps.length) return;
        [comps[idx], comps[next]] = [comps[next], comps[idx]];
        s.dirty = true;
      });
    },

    // ── Workflows ────────────────────────────────────────────
    addWorkflow: (workflow) => {
      set((s) => {
        s.schema.workflows.push(workflow as any);
        s.dirty = true;
      });
    },

    updateWorkflow: (id, updates) => {
      set((s) => {
        const idx = s.schema.workflows.findIndex((w: any) => w.id === id);
        if (idx >= 0) {
          Object.assign(s.schema.workflows[idx], updates);
          s.dirty = true;
        }
      });
    },

    removeWorkflow: (id) => {
      set((s) => {
        s.schema.workflows = s.schema.workflows.filter((w: any) => w.id !== id) as any;
        s.dirty = true;
      });
    },

    addWorkflowNode: (workflowId, node) => {
      set((s) => {
        const wf = s.schema.workflows.find((w: any) => w.id === workflowId);
        if (wf) { (wf as any).nodes.push(node); s.dirty = true; }
      });
    },

    updateWorkflowNode: (workflowId, nodeId, updates) => {
      set((s) => {
        const wf = s.schema.workflows.find((w: any) => w.id === workflowId);
        if (wf) {
          const idx = (wf as any).nodes.findIndex((n: any) => n.id === nodeId);
          if (idx >= 0) { Object.assign((wf as any).nodes[idx], updates); s.dirty = true; }
        }
      });
    },

    removeWorkflowNode: (workflowId, nodeId) => {
      set((s) => {
        const wf = s.schema.workflows.find((w: any) => w.id === workflowId);
        if (wf) {
          (wf as any).nodes = (wf as any).nodes.filter((n: any) => n.id !== nodeId);
          (wf as any).edges = (wf as any).edges.filter((e: any) => e.from !== nodeId && e.to !== nodeId);
          s.dirty = true;
        }
      });
    },

    addWorkflowEdge: (workflowId, edge) => {
      set((s) => {
        const wf = s.schema.workflows.find((w: any) => w.id === workflowId);
        if (wf) { (wf as any).edges.push(edge); s.dirty = true; }
      });
    },

    removeWorkflowEdge: (workflowId, edgeId) => {
      set((s) => {
        const wf = s.schema.workflows.find((w: any) => w.id === workflowId);
        if (wf) {
          (wf as any).edges = (wf as any).edges.filter((e: any) => e.id !== edgeId);
          s.dirty = true;
        }
      });
    },

    // ── Database ─────────────────────────────────────────────
    setDatabaseConfig: (config) => {
      set((s) => {
        s.schema.database = config as any;
        s.dirty = true;
      });
    },

    addTable: (table) => {
      set((s) => {
        if (!s.schema.database) {
          s.schema.database = { provider: "mint", tables: [] } as any;
        }
        (s.schema.database as any).tables.push(table);
        s.dirty = true;
      });
    },

    updateTable: (id, updates) => {
      set((s) => {
        if (!s.schema.database) return;
        const idx = (s.schema.database as any).tables.findIndex((t: any) => t.id === id);
        if (idx >= 0) {
          Object.assign((s.schema.database as any).tables[idx], updates);
          s.dirty = true;
        }
      });
    },

    removeTable: (id) => {
      set((s) => {
        if (!s.schema.database) return;
        (s.schema.database as any).tables = (s.schema.database as any).tables.filter((t: any) => t.id !== id);
        s.dirty = true;
      });
    },

    addField: (tableId, field) => {
      set((s) => {
        if (!s.schema.database) return;
        const table = (s.schema.database as any).tables.find((t: any) => t.id === tableId);
        if (table) {
          table.fields.push(field);
          s.dirty = true;
        }
      });
    },

    updateField: (tableId, fieldName, updates) => {
      set((s) => {
        if (!s.schema.database) return;
        const table = (s.schema.database as any).tables.find((t: any) => t.id === tableId);
        if (!table) return;
        const field = table.fields.find((f: any) => f.name === fieldName);
        if (field) {
          Object.assign(field, updates);
          s.dirty = true;
        }
      });
    },

    removeField: (tableId, fieldName) => {
      set((s) => {
        if (!s.schema.database) return;
        const table = (s.schema.database as any).tables.find((t: any) => t.id === tableId);
        if (table) {
          table.fields = table.fields.filter((f: any) => f.name !== fieldName);
          s.dirty = true;
        }
      });
    },

    // ── Relations ────────────────────────────────────────────
    addRelation: (tableId, relation) => {
      set((s) => {
        if (!s.schema.database) return;
        const table = (s.schema.database as any).tables.find((t: any) => t.id === tableId);
        if (table) {
          if (!table.relations) table.relations = [];
          table.relations.push(relation);
          s.dirty = true;
        }
      });
    },

    removeRelation: (tableId, index) => {
      set((s) => {
        if (!s.schema.database) return;
        const table = (s.schema.database as any).tables.find((t: any) => t.id === tableId);
        if (table?.relations) {
          table.relations.splice(index, 1);
          s.dirty = true;
        }
      });
    },

    // ── Indexes ──────────────────────────────────────────────
    addIndex: (tableId, index) => {
      set((s) => {
        if (!s.schema.database) return;
        const table = (s.schema.database as any).tables.find((t: any) => t.id === tableId);
        if (table) {
          if (!table.indexes) table.indexes = [];
          table.indexes.push(index);
          s.dirty = true;
        }
      });
    },

    removeIndex: (tableId, indexName) => {
      set((s) => {
        if (!s.schema.database) return;
        const table = (s.schema.database as any).tables.find((t: any) => t.id === tableId);
        if (table?.indexes) {
          table.indexes = table.indexes.filter((i: any) => i.name !== indexName);
          s.dirty = true;
        }
      });
    },

    // ── Policies (RLS) ───────────────────────────────────────
    addPolicy: (tableId, policy) => {
      set((s) => {
        if (!s.schema.database) return;
        const table = (s.schema.database as any).tables.find((t: any) => t.id === tableId);
        if (table) {
          if (!table.policies) table.policies = [];
          table.policies.push(policy);
          s.dirty = true;
        }
      });
    },

    removePolicy: (tableId, policyName) => {
      set((s) => {
        if (!s.schema.database) return;
        const table = (s.schema.database as any).tables.find((t: any) => t.id === tableId);
        if (table?.policies) {
          table.policies = table.policies.filter((p: any) => p.name !== policyName);
          s.dirty = true;
        }
      });
    },

    // ── Theme ────────────────────────────────────────────────
    updateTheme: (theme) => {
      set((s) => {
        Object.assign(s.schema.theme, theme);
        s.dirty = true;
      });
    },

    // ── Navigation ───────────────────────────────────────────
    updateNavigation: (updates) => {
      set((s) => {
        Object.assign(s.schema.navigation, updates);
        s.dirty = true;
      });
    },

    addRoute: (route) => {
      set((s) => {
        const exists = s.schema.navigation.routes.some((r: any) => r.path === route.path);
        if (!exists) s.schema.navigation.routes.push(route as any);
        s.dirty = true;
      });
    },

    removeRoute: (path) => {
      set((s) => {
        s.schema.navigation.routes = s.schema.navigation.routes.filter((r: any) => r.path !== path) as any;
        s.dirty = true;
      });
    },

    // ── Auth ─────────────────────────────────────────────────
    setAuthConfig: (auth) => {
      set((s) => {
        s.schema.auth = auth as any;
        s.dirty = true;
      });
    },

    updateAuthConfig: (updates) => {
      set((s) => {
        if (!s.schema.auth) {
          s.schema.auth = {
            providers: [],
            sessionType: "jwt",
            tokenExpiry: 3600,
            refreshEnabled: true,
          } as any;
        }
        Object.assign(s.schema.auth as any, updates);
        s.dirty = true;
      });
    },

    // ── UI ───────────────────────────────────────────────────
    setActiveTab: (tab) => set((s) => { s.activeTab = tab; }),

    // ── Serialization ────────────────────────────────────────
    getSchema: () => get().schema,

    exportSchema: () => JSON.stringify(get().schema, null, 2),

    importSchema: (json) => {
      try {
        const parsed = JSON.parse(json);
        if (!parsed.id || !parsed.screens) return false;
        set((s) => {
          s.schema = parsed as any;
          s.dirty = true;
        });
        return true;
      } catch {
        return false;
      }
    },

    // ── Canvas Linking ───────────────────────────────────────
    linkFrameToScreen: (frameId, frameName) => {
      set((s) => {
        const existing = s.schema.screens.find((sc: any) => sc.id === frameId);
        if (!existing) {
          const slug = frameName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
          const screen: ScreenSchema = {
            id: frameId,
            name: frameName,
            route: `/${slug}`,
            components: [],
            localState: [],
            actions: [],
          };
          s.schema.screens.push(screen as any);
          s.schema.navigation.routes.push({
            path: `/${slug}`,
            screenId: frameId,
          } as any);
        }
        s.dirty = true;
      });
    },

    unlinkFrame: (frameId) => {
      set((s) => {
        s.schema.screens = s.schema.screens.filter((sc: any) => sc.id !== frameId) as any;
        s.schema.navigation.routes = s.schema.navigation.routes.filter(
          (r: any) => r.screenId !== frameId
        ) as any;
        s.dirty = true;
      });
    },

    syncFromCanvas: (frames) => {
      set((s) => {
        const existingIds = new Set(s.schema.screens.map((sc: any) => sc.id));

        for (const frame of frames) {
          if (!existingIds.has(frame.id)) {
            const slug = frame.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
            s.schema.screens.push({
              id: frame.id,
              name: frame.name,
              route: `/${slug}`,
              components: [],
              localState: [],
              actions: [],
            } as any);
          } else {
            // Update name if changed
            const screen = s.schema.screens.find((sc: any) => sc.id === frame.id);
            if (screen && (screen as any).name !== frame.name) {
              (screen as any).name = frame.name;
            }
          }
        }

        // Update navigation
        s.schema.navigation.routes = s.schema.screens.map((sc: any) => ({
          path: sc.route,
          screenId: sc.id,
        })) as any;

        if (s.schema.screens.length > 0 && !s.schema.navigation.initialRoute) {
          s.schema.navigation.initialRoute = (s.schema.screens[0] as any).route;
        }
      });
    },
  }))
);
