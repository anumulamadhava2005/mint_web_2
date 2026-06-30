import { create } from 'zustand';

export type ToolType =
  | 'select' | 'scale' | 'frame' | 'section' | 'slice'
  | 'rect' | 'ellipse' | 'line' | 'arrow' | 'polygon' | 'star'
  | 'pen' | 'pencil' | 'text' | 'hand' | 'comment';

export type EditorMode = 'design' | 'prototype' | 'dev';

export interface ColorStop {
  id: string;
  position: number;   // 0–1
  color: string;      // hex
  opacity: number;    // 0–1
}

export interface Fill {
  id: string;
  type: 'solid' | 'linear' | 'radial' | 'angular' | 'image' | 'none';
  color: string;
  opacity: number;
  visible: boolean;
  blendMode: string;
  stops?: ColorStop[];
  gradientAngle?: number;
  imageUrl?: string;
  imageFit?: 'fill' | 'fit' | 'crop' | 'tile';
}

export interface Stroke {
  id: string;
  color: string;
  opacity: number;
  weight: number;
  position: 'inside' | 'outside' | 'center';
  type: 'solid' | 'dashed' | 'dotted';
  visible: boolean;
}

export interface Effect {
  id: string;
  type: 'drop-shadow' | 'inner-shadow' | 'layer-blur' | 'background-blur';
  visible: boolean;
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
  opacity: number;
}

export interface ExportConfig {
  id: string;
  scale: number;
  format: 'png' | 'jpg' | 'svg' | 'pdf' | 'webp';
  suffix: string;
}

export interface VectorPoint {
  id: string;
  x: number;
  y: number;
  handleIn?: { x: number; y: number };
  handleOut?: { x: number; y: number };
  cornerType: 'sharp' | 'smooth' | 'asymmetric';
}

export interface LayoutGrid {
  id: string;
  type: 'grid' | 'columns' | 'rows';
  visible: boolean;
  color: string;
  opacity: number;
  count: number;
  size: number;
  gutter: number;
  margin: number;
}

export interface TextStyle {
  id: string;
  name: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fontStyle?: string;
  lineHeight?: number;
  letterSpacing?: number;
  textDecoration?: string;
  textTransform?: string;
  color: string;
}

export interface EffectStyleDef {
  id: string;
  name: string;
  effects: Effect[];
}

export interface AutoLayout {
  direction: 'horizontal' | 'vertical';
  gap: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  primaryAlign: 'start' | 'center' | 'end' | 'space-between';
  counterAlign: 'start' | 'center' | 'end';
  widthMode: 'fixed' | 'hug';
  heightMode: 'fixed' | 'hug';
  wrap: boolean;
}

export type InteractionTrigger =
  | 'click' | 'hover' | 'mouseLeave' | 'press' | 'drag'
  | 'afterDelay' | 'keyDown' | 'scroll';

export type InteractionAction =
  | 'navigate' | 'openOverlay' | 'swapOverlay' | 'closeOverlay'
  | 'scrollTo' | 'openUrl' | 'back';

export type TransitionType = 'instant' | 'dissolve' | 'slide-left' | 'slide-right' | 'push-left' | 'push-right' | 'smart-animate';

export type OverlayPosition = 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'origin' | 'manual';

export interface Interaction {
  id: string;
  trigger: InteractionTrigger;
  action: InteractionAction;
  targetFrameId?: string;
  transition: TransitionType;
  duration: number;
  easing: 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear';
  // afterDelay trigger
  delay?: number;
  // keyDown trigger
  keyCode?: string;
  // openUrl action
  url?: string;
  // overlay actions
  overlayPosition?: OverlayPosition;
  overlayX?: number;
  overlayY?: number;
  overlayBackground?: 'none' | 'dim' | 'blur';
  overlayBgColor?: string;
  overlayBgOpacity?: number;
  overlayCloseOnClickOutside?: boolean;
}

export interface ApiSource {
  id: string;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers: Record<string, string>;
  queryParams: Record<string, string>;
  bodyTemplate?: string;
  authType: 'none' | 'bearer' | 'apiKey' | 'basic';
  authValue?: string;
  authKeyName?: string;
  autoFetch: boolean;
  refetchInterval?: number;
  responsePath?: string;
}

export interface GlobalStateVar {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  defaultValue: string;
  scope: 'global' | 'page';
  description?: string;
}

export type ActionStepType =
  | 'navigate' | 'goBack' | 'openModal' | 'closeModal'
  | 'setState' | 'updateState' | 'resetState'
  | 'fetch' | 'mutate'
  | 'toast' | 'alert'
  | 'condition'
  | 'delay'
  | 'custom'
  | 'signIn' | 'signOut';

export interface ActionStep {
  id: string;
  type: ActionStepType;
  label?: string;
  navigateTo?: string;
  navigateReplace?: boolean;
  stateTarget?: string;
  stateValue?: string;
  apiSourceId?: string;
  apiResultBinding?: string;
  apiBody?: string;
  toastMessage?: string;
  toastType?: 'info' | 'success' | 'warning' | 'error';
  conditionExpr?: string;
  thenSteps?: ActionStep[];
  elseSteps?: ActionStep[];
  delayMs?: number;
  customCode?: string;
}

export interface ActionFlow {
  id: string;
  name: string;
  description?: string;
  steps: ActionStep[];
}

// ── Database ──────────────────────────────────────────────

export type DbFieldType =
  | 'uuid' | 'text' | 'integer' | 'float' | 'boolean'
  | 'date' | 'datetime' | 'timestamp' | 'json' | 'jsonb'
  | 'enum' | 'array' | 'binary';

export interface DbField {
  id: string;
  name: string;
  type: DbFieldType;
  primary?: boolean;
  nullable?: boolean;
  unique?: boolean;
  defaultValue?: string;
  enumValues?: string;
  references?: { table: string; field: string; onDelete: 'cascade' | 'set-null' | 'restrict' | 'no-action' };
}

export interface DbIndex {
  name: string;
  fields: string[];
  type: 'btree' | 'hash' | 'gin' | 'gist';
  unique: boolean;
}

export interface DbRelation {
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  targetTable: string;   // target table NAME
  foreignKey: string;    // column on this table
  targetKey?: string;    // defaults to "id"
  junctionTable?: string; // for many-to-many
  onDelete?: 'cascade' | 'set-null' | 'restrict' | 'no-action';
}

export interface DbPolicy {
  name: string;
  operation: 'select' | 'insert' | 'update' | 'delete' | 'all';
  role?: string;
  condition?: string; // SQL USING expression
  check?: string;     // SQL WITH CHECK expression
}

export interface DbTable {
  id: string;
  name: string;
  fields: DbField[];
  timestamps: boolean;
  softDelete: boolean;
  indexes: DbIndex[];
  relations: DbRelation[];
  policies: DbPolicy[];
}

export type DbProvider = 'mint' | 'supabase' | 'firebase' | 'custom';

export interface DatabaseConfig {
  provider: DbProvider;
  connectionString?: string;
  tables: DbTable[];
}

// ── Auth ──────────────────────────────────────────────────

export type AuthProviderType = 'email' | 'google' | 'github' | 'apple' | 'facebook' | 'magic-link';

export interface AuthProviderConfig {
  type: AuthProviderType;
  enabled: boolean;
  clientId?: string;
  clientSecret?: string;
}

export interface AuthConfig {
  enabled: boolean;
  providers: AuthProviderConfig[];
  sessionType: 'jwt' | 'cookie' | 'session';
  tokenExpiry: number;
  refresh: boolean;
  roles: string[];
  defaultRole: string;
  mfaEnabled: boolean;
  mfaType: 'totp' | 'sms' | 'email';
}

// ── Navigation ────────────────────────────────────────────

export interface NavRoute {
  id: string;
  name: string;
  path: string;
  screenId?: string;
  requiresAuth: boolean;
  roles: string[];
}

export type NavType = 'stack' | 'tabs' | 'drawer' | 'custom';

export interface NavigationConfig {
  type: NavType;
  routes: NavRoute[];
}

// ── App-level Workflows ───────────────────────────────────

export type WorkflowTriggerType = 'schedule' | 'webhook' | 'stateChange' | 'event' | 'action';

export interface WorkflowTrigger {
  type: WorkflowTriggerType;
  cron?: string;
  webhookPath?: string;
  stateKey?: string;
  eventName?: string;
  actionId?: string;
}

export interface AppWorkflow {
  id: string;
  name: string;
  description?: string;
  trigger: WorkflowTrigger;
  steps: ActionStep[];
  enabled: boolean;
}

export type LayerType =
  | 'frame' | 'section' | 'group' | 'rect' | 'ellipse'
  | 'line' | 'text' | 'image' | 'component' | 'instance' | 'vector' | 'comment';

export interface FigmaLayer {
  id: string;
  name: string;
  type: LayerType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: string;
  fills: Fill[];
  strokes: Stroke[];
  effects: Effect[];
  exports: ExportConfig[];
  children?: FigmaLayer[];
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: string;
  clipContent?: boolean;
  cornerRadius?: number;
  fontStyle?: string;
  textDecoration?: 'none' | 'underline' | 'line-through';
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  textResize?: 'auto-width' | 'auto-height' | 'fixed';
  paragraphSpacing?: number;
  layoutGrids?: LayoutGrid[];
  points?: VectorPoint[];
  pathClosed?: boolean;
  componentId?: string;
  autoLayout?: AutoLayout;
  layoutSizing?: { horizontal: 'fixed' | 'fill' | 'hug'; vertical: 'fixed' | 'fill' | 'hug' };
  interactions?: Interaction[];
  scrollDirection?: 'none' | 'vertical' | 'horizontal' | 'both';
  scrollBehavior?: 'scrolls' | 'fixed';
  bindings?: Record<string, string>;
  repeatFor?: { items: string; as: string; key?: string };
  conditionalRender?: string;
  layerEvents?: Record<string, string[]>;
}

export interface FigmaPage {
  id: string;
  name: string;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

interface FigmaState {
  fileName: string;
  pages: FigmaPage[];
  activePageId: string;
  layers: Record<string, FigmaLayer[]>;
  selection: string[];
  hoveredId: string | null;
  activeTool: ToolType;
  viewport: Viewport;
  leftPanelWidth: number;
  rightPanelWidth: number;
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  leftPanelTab: 'layers' | 'assets';
  rightPanelTab: 'design' | 'prototype' | 'inspect';
  editorMode: EditorMode;
  clipboard: FigmaLayer[];

  setFileName: (name: string) => void;
  addPage: () => void;
  renamePage: (id: string, name: string) => void;
  deletePage: (id: string) => void;
  reorderPage: (from: number, to: number) => void;
  setActivePage: (id: string) => void;
  setActiveTool: (tool: ToolType) => void;
  setViewport: (partial: Partial<Viewport>) => void;
  setSelection: (ids: string[]) => void;
  setHovered: (id: string | null) => void;
  addLayer: (layer: FigmaLayer) => void;
  addLayerToParent: (layer: FigmaLayer, parentId: string) => void;
  updateLayer: (id: string, partial: Partial<FigmaLayer>) => void;
  deleteLayer: (id: string) => void;
  duplicateLayer: (id: string) => void;
  setLeftPanelTab: (tab: 'layers' | 'assets') => void;
  setRightPanelTab: (tab: 'design' | 'prototype' | 'inspect') => void;
  setEditorMode: (mode: EditorMode) => void;
  setLeftPanelCollapsed: (v: boolean) => void;
  setRightPanelCollapsed: (v: boolean) => void;
  setLeftPanelWidth: (w: number) => void;
  setRightPanelWidth: (w: number) => void;
  setCopied: (layers: FigmaLayer[]) => void;
  paste: () => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  recentColors: string[];
  colorStyles: { id: string; name: string; color: string }[];
  addRecentColor: (color: string) => void;
  addColorStyle: (name: string, color: string) => void;
  removeColorStyle: (id: string) => void;

  textStyles: TextStyle[];
  effectStyles: EffectStyleDef[];
  addLayoutGrid: (layerId: string) => void;
  updateLayoutGrid: (layerId: string, gridId: string, partial: Partial<LayoutGrid>) => void;
  removeLayoutGrid: (layerId: string, gridId: string) => void;
  saveTextStyle: (name: string, layer: FigmaLayer) => void;
  deleteTextStyle: (id: string) => void;
  applyTextStyle: (layerId: string, styleId: string) => void;
  saveEffectStyle: (name: string, effects: Effect[]) => void;
  deleteEffectStyle: (id: string) => void;
  applyEffectStyle: (layerId: string, styleId: string) => void;

  editingVectorId: string | null;
  nodeSelection: string[];
  setEditingVector: (id: string | null) => void;
  setNodeSelection: (ids: string[]) => void;
  updateVectorPoint: (layerId: string, pointId: string, partial: Partial<VectorPoint>) => void;
  deleteVectorPoints: (layerId: string, pointIds: string[]) => void;

  components: Record<string, FigmaLayer>;
  createComponent: (ids: string[]) => void;
  createInstance: (componentId: string) => void;
  detachInstance: (layerId: string) => void;
  deleteComponent: (componentId: string) => void;

  setAutoLayout: (layerId: string, al: AutoLayout | null) => void;
  updateAutoLayout: (layerId: string, partial: Partial<AutoLayout>) => void;
  setLayoutSizing: (layerId: string, sizing: FigmaLayer['layoutSizing']) => void;

  previewMode: boolean;
  prototypeStartFrameId: string | null;
  prototypeDevice: string;
  setPreviewMode: (on: boolean) => void;
  setPrototypeStartFrame: (id: string | null) => void;
  setPrototypeDevice: (device: string) => void;
  addInteraction: (layerId: string, interaction: Interaction) => void;
  updateInteraction: (layerId: string, interactionId: string, partial: Partial<Interaction>) => void;
  removeInteraction: (layerId: string, interactionId: string) => void;

  _history: Record<string, FigmaLayer[]>[];
  _historyIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  showRulers: boolean;
  showGrid: boolean;
  toggleRulers: () => void;
  toggleGrid: () => void;

  projectId: string | null;
  fileId: string | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  setProjectContext: (projectId: string, fileId: string) => void;
  loadFromServer: (projectId: string) => Promise<void>;
  saveToServer: () => Promise<void>;
  applyRemoteLayers: (pageId: string, layers: FigmaLayer[]) => void;

  setBinding: (layerId: string, prop: string, expression: string) => void;
  removeBinding: (layerId: string, prop: string) => void;
  clearAllBindings: (layerId: string) => void;
  setRepeatFor: (layerId: string, config: FigmaLayer['repeatFor'] | null) => void;
  setConditionalRender: (layerId: string, expression: string | null) => void;

  apiSources: ApiSource[];
  globalStateVars: GlobalStateVar[];
  addApiSource: (source: Omit<ApiSource, 'id'>) => void;
  updateApiSource: (id: string, patch: Partial<ApiSource>) => void;
  deleteApiSource: (id: string) => void;
  addGlobalStateVar: (v: Omit<GlobalStateVar, 'id'>) => void;
  updateGlobalStateVar: (id: string, patch: Partial<GlobalStateVar>) => void;
  deleteGlobalStateVar: (id: string) => void;

  actionFlows: ActionFlow[];
  addActionFlow: (flow: Omit<ActionFlow, 'id'>) => void;
  updateActionFlow: (id: string, patch: Partial<Omit<ActionFlow, 'id'>>) => void;
  deleteActionFlow: (id: string) => void;
  addActionStep: (flowId: string, step: Omit<ActionStep, 'id'>) => void;
  updateActionStep: (flowId: string, stepId: string, patch: Partial<ActionStep>) => void;
  deleteActionStep: (flowId: string, stepId: string) => void;
  reorderActionSteps: (flowId: string, fromIdx: number, toIdx: number) => void;
  setLayerEvent: (layerId: string, eventName: string, flowIds: string[]) => void;

  database: DatabaseConfig;
  setDatabaseProvider: (provider: DbProvider) => void;
  addTable: (name: string) => void;
  updateTable: (id: string, patch: Partial<Omit<DbTable, 'id'>>) => void;
  deleteTable: (id: string) => void;
  addField: (tableId: string, field: Omit<DbField, 'id'>) => void;
  updateField: (tableId: string, fieldId: string, patch: Partial<DbField>) => void;
  deleteField: (tableId: string, fieldId: string) => void;
  addRelation: (tableId: string, rel: DbRelation) => void;
  deleteRelation: (tableId: string, index: number) => void;
  addPolicy: (tableId: string, policy: DbPolicy) => void;
  updatePolicy: (tableId: string, index: number, patch: Partial<DbPolicy>) => void;
  deletePolicy: (tableId: string, index: number) => void;
  addIndex: (tableId: string, index: DbIndex) => void;
  deleteIndex: (tableId: string, name: string) => void;

  auth: AuthConfig;
  setAuthConfig: (patch: Partial<AuthConfig>) => void;
  toggleAuthProvider: (type: AuthProviderType) => void;
  updateAuthProvider: (type: AuthProviderType, patch: Partial<AuthProviderConfig>) => void;

  navigation: NavigationConfig;
  setNavigationType: (type: NavType) => void;
  addRoute: (route: Omit<NavRoute, 'id'>) => void;
  updateRoute: (id: string, patch: Partial<NavRoute>) => void;
  deleteRoute: (id: string) => void;

  appWorkflows: AppWorkflow[];
  addAppWorkflow: (wf: Omit<AppWorkflow, 'id'>) => void;
  updateAppWorkflow: (id: string, patch: Partial<Omit<AppWorkflow, 'id'>>) => void;
  deleteAppWorkflow: (id: string) => void;
}

function findLayerById(layers: FigmaLayer[], id: string): FigmaLayer | null {
  for (const l of layers) {
    if (l.id === id) return l;
    if (l.children) {
      const found = findLayerById(l.children, id);
      if (found) return found;
    }
  }
  return null;
}

function addChildToParent(layers: FigmaLayer[], parentId: string, child: FigmaLayer): FigmaLayer[] {
  return layers.map(l => {
    if (l.id === parentId) return { ...l, children: [...(l.children ?? []), child] };
    if (l.children) return { ...l, children: addChildToParent(l.children, parentId, child) };
    return l;
  });
}

function updateLayerById(layers: FigmaLayer[], id: string, partial: Partial<FigmaLayer>): FigmaLayer[] {
  return layers.map(l => {
    if (l.id === id) return { ...l, ...partial };
    if (l.children) return { ...l, children: updateLayerById(l.children, id, partial) };
    return l;
  });
}

function deleteLayerById(layers: FigmaLayer[], id: string): FigmaLayer[] {
  return layers.filter(l => l.id !== id).map(l => {
    if (l.children) return { ...l, children: deleteLayerById(l.children, id) };
    return l;
  });
}

function updateLayerInTree(
  layers: FigmaLayer[],
  id: string,
  updater: (l: FigmaLayer) => FigmaLayer
): FigmaLayer[] {
  return layers.map(l => {
    if (l.id === id) return updater(l);
    if (l.children) return { ...l, children: updateLayerInTree(l.children, id, updater) };
    return l;
  });
}

export const useFigmaStore = create<FigmaState>((set, get) => ({
  fileName: 'Untitled',
  pages: [{ id: 'page-1', name: 'Page 1' }],
  activePageId: 'page-1',
  layers: { 'page-1': [] },
  selection: [],
  hoveredId: null,
  activeTool: 'select',
  viewport: { x: 0, y: 0, zoom: 1 },
  leftPanelWidth: 240,
  rightPanelWidth: 240,
  leftPanelCollapsed: false,
  rightPanelCollapsed: false,
  leftPanelTab: 'layers',
  rightPanelTab: 'design',
  editorMode: 'design',
  clipboard: [],
  recentColors: [],
  colorStyles: [],
  textStyles: [],
  effectStyles: [],
  editingVectorId: null,
  nodeSelection: [],
  components: {},
  previewMode: false,
  prototypeStartFrameId: null,
  prototypeDevice: 'none',
  _history: [],
  _historyIndex: -1,
  canUndo: false,
  canRedo: false,
  showRulers: true,
  showGrid: true,
  projectId: null,
  fileId: null,
  saveStatus: 'idle',
  apiSources: [],
  globalStateVars: [],
  actionFlows: [],
  database: { provider: 'mint', tables: [] },
  auth: {
    enabled: false,
    providers: [
      { type: 'email', enabled: true },
      { type: 'google', enabled: false },
      { type: 'github', enabled: false },
      { type: 'apple', enabled: false },
      { type: 'facebook', enabled: false },
      { type: 'magic-link', enabled: false },
    ],
    sessionType: 'jwt',
    tokenExpiry: 3600,
    refresh: true,
    roles: ['user'],
    defaultRole: 'user',
    mfaEnabled: false,
    mfaType: 'totp',
  },
  navigation: { type: 'stack', routes: [] },
  appWorkflows: [],

  setFileName: (name) => set({ fileName: name }),

  addPage: () => {
    const id = `page-${Date.now()}`;
    const name = `Page ${get().pages.length + 1}`;
    set(s => ({
      pages: [...s.pages, { id, name }],
      layers: { ...s.layers, [id]: [] },
      activePageId: id,
      selection: [],
    }));
  },

  renamePage: (id, name) =>
    set(s => ({ pages: s.pages.map(p => p.id === id ? { ...p, name } : p) })),

  deletePage: (id) => {
    const { pages, activePageId, layers } = get();
    if (pages.length <= 1) return;
    const remaining = pages.filter(p => p.id !== id);
    const newActive = activePageId === id ? remaining[0].id : activePageId;
    const newLayers = { ...layers };
    delete newLayers[id];
    set({ pages: remaining, activePageId: newActive, layers: newLayers, selection: [] });
  },

  reorderPage: (from, to) =>
    set(s => {
      const pages = [...s.pages];
      const [moved] = pages.splice(from, 1);
      pages.splice(to, 0, moved);
      return { pages };
    }),

  setActivePage: (id) => set({ activePageId: id, selection: [] }),

  setActiveTool: (tool) => set({ activeTool: tool }),

  setViewport: (partial) => set(s => ({ viewport: { ...s.viewport, ...partial } })),

  setSelection: (ids) => set({ selection: ids }),

  setHovered: (id) => set({ hoveredId: id }),

  addLayer: (layer) => {
    get().pushHistory();
    set(s => {
      const pageId = s.activePageId;
      return { layers: { ...s.layers, [pageId]: [...(s.layers[pageId] ?? []), layer] } };
    });
  },

  addLayerToParent: (layer, parentId) => {
    get().pushHistory();
    set(s => {
      const pageId = s.activePageId;
      return { layers: { ...s.layers, [pageId]: addChildToParent(s.layers[pageId] ?? [], parentId, layer) } };
    });
  },

  updateLayer: (id, partial) => {
    get().pushHistory();
    set(s => {
      const pageId = s.activePageId;
      return { layers: { ...s.layers, [pageId]: updateLayerById(s.layers[pageId] ?? [], id, partial) } };
    });
  },

  deleteLayer: (id) => {
    get().pushHistory();
    set(s => {
      const pageId = s.activePageId;
      return {
        layers: { ...s.layers, [pageId]: deleteLayerById(s.layers[pageId] ?? [], id) },
        selection: s.selection.filter(sid => sid !== id),
      };
    });
  },

  duplicateLayer: (id) => {
    get().pushHistory();
    const { layers, activePageId } = get();
    const layer = findLayerById(layers[activePageId] ?? [], id);
    if (!layer) return;
    const newLayer: FigmaLayer = { ...layer, id: `layer-${Date.now()}`, x: layer.x + 20, y: layer.y + 20, name: layer.name + ' copy' };
    set(s => {
      const pageId = s.activePageId;
      return {
        layers: { ...s.layers, [pageId]: [...(s.layers[pageId] ?? []), newLayer] },
        selection: [newLayer.id],
      };
    });
  },

  setLeftPanelTab: (tab) => set({ leftPanelTab: tab }),
  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
  setEditorMode: (mode) => set({ editorMode: mode }),
  setLeftPanelCollapsed: (v) => set({ leftPanelCollapsed: v }),
  setRightPanelCollapsed: (v) => set({ rightPanelCollapsed: v }),
  setLeftPanelWidth: (w) => set({ leftPanelWidth: Math.max(200, Math.min(480, w)) }),
  setRightPanelWidth: (w) => set({ rightPanelWidth: Math.max(200, Math.min(360, w)) }),

  setCopied: (layers) => {
    const cloned: FigmaLayer[] = JSON.parse(JSON.stringify(layers));
    set({ clipboard: cloned });
  },

  paste: () => {
    get().pushHistory();
    const { clipboard, activePageId } = get();
    if (!clipboard.length) return;
    const newLayers: FigmaLayer[] = clipboard.map(l => ({
      ...JSON.parse(JSON.stringify(l)),
      id: `layer-${Math.random().toString(36).slice(2, 9)}`,
      x: l.x + 10,
      y: l.y + 10,
      name: l.name + ' copy',
    }));
    const newIds = newLayers.map(l => l.id);
    set(s => ({
      layers: { ...s.layers, [activePageId]: [...(s.layers[activePageId] ?? []), ...newLayers] },
      selection: newIds,
    }));
  },

  bringForward: (id) =>
    set(s => {
      const pageId = s.activePageId;
      const arr = [...(s.layers[pageId] ?? [])];
      const idx = arr.findIndex(l => l.id === id);
      if (idx < 0 || idx >= arr.length - 1) return s;
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      return { layers: { ...s.layers, [pageId]: arr } };
    }),

  sendBackward: (id) =>
    set(s => {
      const pageId = s.activePageId;
      const arr = [...(s.layers[pageId] ?? [])];
      const idx = arr.findIndex(l => l.id === id);
      if (idx <= 0) return s;
      [arr[idx], arr[idx - 1]] = [arr[idx - 1], arr[idx]];
      return { layers: { ...s.layers, [pageId]: arr } };
    }),

  bringToFront: (id) =>
    set(s => {
      const pageId = s.activePageId;
      const arr = [...(s.layers[pageId] ?? [])];
      const idx = arr.findIndex(l => l.id === id);
      if (idx < 0) return s;
      const [layer] = arr.splice(idx, 1);
      arr.push(layer);
      return { layers: { ...s.layers, [pageId]: arr } };
    }),

  sendToBack: (id) =>
    set(s => {
      const pageId = s.activePageId;
      const arr = [...(s.layers[pageId] ?? [])];
      const idx = arr.findIndex(l => l.id === id);
      if (idx < 0) return s;
      const [layer] = arr.splice(idx, 1);
      arr.unshift(layer);
      return { layers: { ...s.layers, [pageId]: arr } };
    }),

  addRecentColor: (color) =>
    set(s => {
      const cleaned = color.toLowerCase();
      const without = s.recentColors.filter(c => c !== cleaned);
      return { recentColors: [cleaned, ...without].slice(0, 8) };
    }),

  addColorStyle: (name, color) =>
    set(s => ({
      colorStyles: [...s.colorStyles, { id: `cs-${Date.now()}`, name, color }],
    })),

  removeColorStyle: (id) =>
    set(s => ({
      colorStyles: s.colorStyles.filter(c => c.id !== id),
    })),

  addLayoutGrid: (layerId) => set((s) => {
    const grid: LayoutGrid = {
      id: `grid-${Date.now()}`,
      type: 'columns', visible: true, color: '#0d99ff',
      opacity: 0.1, count: 12, size: 8, gutter: 20, margin: 40,
    };
    return {
      layers: {
        ...s.layers,
        [s.activePageId]: updateLayerInTree(s.layers[s.activePageId] ?? [], layerId, l => ({
          ...l, layoutGrids: [...(l.layoutGrids ?? []), grid],
        })),
      },
    };
  }),

  updateLayoutGrid: (layerId, gridId, partial) => set((s) => ({
    layers: {
      ...s.layers,
      [s.activePageId]: updateLayerInTree(s.layers[s.activePageId] ?? [], layerId, l => ({
        ...l,
        layoutGrids: (l.layoutGrids ?? []).map(g => g.id === gridId ? { ...g, ...partial } : g),
      })),
    },
  })),

  removeLayoutGrid: (layerId, gridId) => set((s) => ({
    layers: {
      ...s.layers,
      [s.activePageId]: updateLayerInTree(s.layers[s.activePageId] ?? [], layerId, l => ({
        ...l,
        layoutGrids: (l.layoutGrids ?? []).filter(g => g.id !== gridId),
      })),
    },
  })),

  saveTextStyle: (name, layer) => set((s) => ({
    textStyles: [...s.textStyles, {
      id: `ts-${Date.now()}`, name,
      fontFamily: layer.fontFamily ?? 'Inter',
      fontSize: layer.fontSize ?? 14,
      fontWeight: layer.fontWeight ?? '400',
      fontStyle: layer.fontStyle,
      lineHeight: layer.lineHeight,
      letterSpacing: layer.letterSpacing,
      textDecoration: layer.textDecoration,
      textTransform: layer.textTransform,
      color: layer.fills[0]?.color ?? '#000000',
    }],
  })),

  deleteTextStyle: (id) => set((s) => ({ textStyles: s.textStyles.filter(t => t.id !== id) })),

  applyTextStyle: (layerId, styleId) => set((s) => {
    const style = s.textStyles.find(t => t.id === styleId);
    if (!style) return s;
    return {
      layers: {
        ...s.layers,
        [s.activePageId]: updateLayerInTree(s.layers[s.activePageId] ?? [], layerId, l => ({
          ...l,
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          fontStyle: style.fontStyle,
          lineHeight: style.lineHeight,
          letterSpacing: style.letterSpacing,
          textDecoration: style.textDecoration as FigmaLayer['textDecoration'],
          textTransform: style.textTransform as FigmaLayer['textTransform'],
          fills: l.fills.map((f, i) => i === 0 ? { ...f, color: style.color } : f),
        })),
      },
    };
  }),

  saveEffectStyle: (name, effects) => set((s) => ({
    effectStyles: [...s.effectStyles, { id: `es-${Date.now()}`, name, effects: JSON.parse(JSON.stringify(effects)) }],
  })),

  deleteEffectStyle: (id) => set((s) => ({ effectStyles: s.effectStyles.filter(e => e.id !== id) })),

  applyEffectStyle: (layerId, styleId) => set((s) => {
    const style = s.effectStyles.find(e => e.id === styleId);
    if (!style) return s;
    return {
      layers: {
        ...s.layers,
        [s.activePageId]: updateLayerInTree(s.layers[s.activePageId] ?? [], layerId, l => ({
          ...l, effects: JSON.parse(JSON.stringify(style.effects)),
        })),
      },
    };
  }),

  setEditingVector: (id) => set({ editingVectorId: id, nodeSelection: [] }),
  setNodeSelection: (ids) => set({ nodeSelection: ids }),

  updateVectorPoint: (layerId, pointId, partial) => set(s => ({
    layers: {
      ...s.layers,
      [s.activePageId]: updateLayerInTree(s.layers[s.activePageId] ?? [], layerId, l => ({
        ...l,
        points: (l.points ?? []).map(p => p.id === pointId ? { ...p, ...partial } : p),
      })),
    },
  })),

  deleteVectorPoints: (layerId, pointIds) => set(s => ({
    layers: {
      ...s.layers,
      [s.activePageId]: updateLayerInTree(s.layers[s.activePageId] ?? [], layerId, l => ({
        ...l,
        points: (l.points ?? []).filter(p => !pointIds.includes(p.id)),
        pathClosed: pointIds.length > 0 ? false : l.pathClosed,
      })),
    },
  })),

  createComponent: (ids) => {
    get().pushHistory();
    const { layers, activePageId } = get();
    const pageLayers = layers[activePageId] ?? [];

    const toLayers: FigmaLayer[] = [];
    const collectAll = (arr: FigmaLayer[]) => {
      for (const l of arr) {
        if (ids.includes(l.id)) { toLayers.push(l); continue; }
        if (l.children) collectAll(l.children);
      }
    };
    collectAll(pageLayers);
    if (toLayers.length === 0) return;

    const xs = toLayers.flatMap(l => [l.x, l.x + l.width]);
    const ys = toLayers.flatMap(l => [l.y, l.y + l.height]);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    const maxX = Math.max(...xs), maxY = Math.max(...ys);

    const compId = `comp-${Date.now()}`;
    const compLayer: FigmaLayer = {
      id: compId,
      name: toLayers.length === 1 ? toLayers[0].name : 'Component',
      type: 'component',
      x: minX, y: minY,
      width: maxX - minX, height: maxY - minY,
      rotation: 0, visible: true, locked: false, opacity: 1, blendMode: 'normal',
      fills: toLayers[0]?.fills ?? [],
      strokes: toLayers[0]?.strokes ?? [],
      effects: toLayers[0]?.effects ?? [],
      exports: [],
      children: toLayers.map(l => ({ ...JSON.parse(JSON.stringify(l)), x: l.x - minX, y: l.y - minY })),
      clipContent: true,
      cornerRadius: toLayers[0]?.cornerRadius,
      text: toLayers[0]?.text,
      fontFamily: toLayers[0]?.fontFamily,
      fontSize: toLayers[0]?.fontSize,
      fontWeight: toLayers[0]?.fontWeight,
      lineHeight: toLayers[0]?.lineHeight,
    };

    const removeIds = new Set(ids);
    const filtered = pageLayers.filter(l => !removeIds.has(l.id));

    set(s => ({
      components: { ...s.components, [compId]: JSON.parse(JSON.stringify(compLayer)) },
      layers: { ...s.layers, [activePageId]: [...filtered, compLayer] },
      selection: [compId],
    }));
  },

  createInstance: (componentId) => {
    get().pushHistory();
    const { components, layers, activePageId, viewport } = get();
    const master = components[componentId];
    if (!master) return;

    const centerX = (-viewport.x + 400) / viewport.zoom;
    const centerY = (-viewport.y + 300) / viewport.zoom;

    const instanceId = `inst-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const instance: FigmaLayer = {
      ...JSON.parse(JSON.stringify(master)),
      id: instanceId,
      name: master.name,
      type: 'instance',
      componentId,
      x: centerX - master.width / 2,
      y: centerY - master.height / 2,
    };

    set(s => ({
      layers: {
        ...s.layers,
        [activePageId]: [...(s.layers[activePageId] ?? []), instance],
      },
      selection: [instanceId],
    }));
  },

  detachInstance: (layerId) => {
    get().pushHistory();
    set(s => ({
      layers: {
        ...s.layers,
        [s.activePageId]: updateLayerById(s.layers[s.activePageId] ?? [], layerId, {
          type: 'frame' as LayerType,
          componentId: undefined,
        }),
      },
    }));
  },

  deleteComponent: (componentId) => set(s => {
    const { [componentId]: _removed, ...rest } = s.components;
    return { components: rest };
  }),

  setAutoLayout: (layerId, al) => {
    get().pushHistory();
    set(s => ({
      layers: {
        ...s.layers,
        [s.activePageId]: updateLayerInTree(s.layers[s.activePageId] ?? [], layerId, l => {
          if (al) return { ...l, autoLayout: al };
          const { autoLayout: _al, ...rest } = l;
          return rest;
        }),
      },
    }));
  },

  updateAutoLayout: (layerId, partial) => {
    get().pushHistory();
    set(s => ({
      layers: {
        ...s.layers,
        [s.activePageId]: updateLayerInTree(s.layers[s.activePageId] ?? [], layerId, l =>
          l.autoLayout ? { ...l, autoLayout: { ...l.autoLayout, ...partial } } : l
        ),
      },
    }));
  },

  setLayoutSizing: (layerId, sizing) => set(s => ({
    layers: {
      ...s.layers,
      [s.activePageId]: updateLayerInTree(s.layers[s.activePageId] ?? [], layerId, l => ({ ...l, layoutSizing: sizing })),
    },
  })),

  setPreviewMode: (on) => set({ previewMode: on }),
  setPrototypeStartFrame: (id) => set({ prototypeStartFrameId: id }),
  setPrototypeDevice: (device) => set({ prototypeDevice: device }),

  addInteraction: (layerId, interaction) => set(s => ({
    layers: {
      ...s.layers,
      [s.activePageId]: updateLayerById(s.layers[s.activePageId] ?? [], layerId, {
        interactions: [
          ...((findLayerById(s.layers[s.activePageId] ?? [], layerId)?.interactions) ?? []),
          interaction,
        ],
      }),
    },
  })),

  updateInteraction: (layerId, interactionId, partial) => set(s => ({
    layers: {
      ...s.layers,
      [s.activePageId]: updateLayerInTree(s.layers[s.activePageId] ?? [], layerId, l => ({
        ...l,
        interactions: (l.interactions ?? []).map(i =>
          i.id === interactionId ? { ...i, ...partial } : i
        ),
      })),
    },
  })),

  removeInteraction: (layerId, interactionId) => set(s => ({
    layers: {
      ...s.layers,
      [s.activePageId]: updateLayerInTree(s.layers[s.activePageId] ?? [], layerId, l => ({
        ...l,
        interactions: (l.interactions ?? []).filter(i => i.id !== interactionId),
      })),
    },
  })),

  pushHistory: () => {
    const { layers, _history, _historyIndex } = get();
    const snapshot = JSON.parse(JSON.stringify(layers));
    const newHistory = [..._history.slice(0, _historyIndex + 1), snapshot].slice(-50);
    set({ _history: newHistory, _historyIndex: newHistory.length - 1, canUndo: newHistory.length > 1, canRedo: false });
  },

  undo: () => {
    const { _history, _historyIndex } = get();
    if (_historyIndex <= 0) return;
    const newIndex = _historyIndex - 1;
    set({
      layers: JSON.parse(JSON.stringify(_history[newIndex])),
      _historyIndex: newIndex,
      selection: [],
      canUndo: newIndex > 0,
      canRedo: true,
    });
  },

  redo: () => {
    const { _history, _historyIndex } = get();
    if (_historyIndex >= _history.length - 1) return;
    const newIndex = _historyIndex + 1;
    set({
      layers: JSON.parse(JSON.stringify(_history[newIndex])),
      _historyIndex: newIndex,
      selection: [],
      canUndo: true,
      canRedo: newIndex < _history.length - 1,
    });
  },

  toggleRulers: () => set(s => ({ showRulers: !s.showRulers })),
  toggleGrid: () => set(s => ({ showGrid: !s.showGrid })),

  setProjectContext: (projectId, fileId) => set({ projectId, fileId }),

  loadFromServer: async (projectId) => {
    try {
      const res = await fetch(`/api/figma-file?projectId=${encodeURIComponent(projectId)}`);
      if (!res.ok) return;
      const data = await res.json();

      // Always apply the project name — use fileName from file if set, else fall back to projectName
      const resolvedName: string = data.fileName || data.projectName || 'Untitled';
      set({ projectId, fileName: resolvedName });

      if (!data.fileId) return; // No canvas file yet — name is set, nothing else to restore

      const { pages, layers, components, colorStyles, textStyles, effectStyles, apiSources, globalStateVars, actionFlows, database, auth, navigation, appWorkflows } = data;
      set({
        fileId: data.fileId,
        ...(pages && Array.isArray(pages) && { pages }),
        ...(layers && { layers }),
        ...(components && { components }),
        ...(colorStyles && { colorStyles }),
        ...(textStyles && { textStyles }),
        ...(effectStyles && { effectStyles }),
        ...(Array.isArray(apiSources) && { apiSources }),
        ...(Array.isArray(globalStateVars) && { globalStateVars }),
        ...(Array.isArray(actionFlows) && { actionFlows }),
        ...(database && typeof database === 'object' && { database }),
        ...(auth && typeof auth === 'object' && { auth }),
        ...(navigation && typeof navigation === 'object' && { navigation }),
        ...(Array.isArray(appWorkflows) && { appWorkflows }),
      });
    } catch (e) {
      console.error('Failed to load figma file:', e);
    }
  },

  applyRemoteLayers: (pageId, incomingLayers) => set(s => ({
    layers: { ...s.layers, [pageId]: incomingLayers },
  })),

  setBinding: (layerId, prop, expression) => set(s => ({
    layers: {
      ...s.layers,
      [s.activePageId]: updateLayerInTree(s.layers[s.activePageId] ?? [], layerId, l => ({
        ...l,
        bindings: { ...(l.bindings ?? {}), [prop]: expression },
      })),
    },
  })),

  removeBinding: (layerId, prop) => set(s => {
    return {
      layers: {
        ...s.layers,
        [s.activePageId]: updateLayerInTree(s.layers[s.activePageId] ?? [], layerId, l => {
          const { [prop]: _removed, ...rest } = l.bindings ?? {};
          return { ...l, bindings: Object.keys(rest).length > 0 ? rest : undefined };
        }),
      },
    };
  }),

  clearAllBindings: (layerId) => set(s => ({
    layers: {
      ...s.layers,
      [s.activePageId]: updateLayerInTree(s.layers[s.activePageId] ?? [], layerId, l => {
        const { bindings: _b, repeatFor: _r, conditionalRender: _c, ...rest } = l;
        return rest;
      }),
    },
  })),

  setRepeatFor: (layerId, config) => set(s => ({
    layers: {
      ...s.layers,
      [s.activePageId]: updateLayerInTree(s.layers[s.activePageId] ?? [], layerId, l => {
        if (config) return { ...l, repeatFor: config };
        const { repeatFor: _r, ...rest } = l;
        return rest;
      }),
    },
  })),

  setConditionalRender: (layerId, expression) => set(s => ({
    layers: {
      ...s.layers,
      [s.activePageId]: updateLayerInTree(s.layers[s.activePageId] ?? [], layerId, l => {
        if (expression) return { ...l, conditionalRender: expression };
        const { conditionalRender: _cr, ...rest } = l;
        return rest;
      }),
    },
  })),

  addApiSource: (source) => set(s => ({
    apiSources: [...s.apiSources, { id: Math.random().toString(36).slice(2), ...source }],
  })),
  updateApiSource: (id, patch) => set(s => ({
    apiSources: s.apiSources.map(a => a.id === id ? { ...a, ...patch } : a),
  })),
  deleteApiSource: (id) => set(s => ({
    apiSources: s.apiSources.filter(a => a.id !== id),
  })),
  addGlobalStateVar: (v) => set(s => ({
    globalStateVars: [...s.globalStateVars, { id: Math.random().toString(36).slice(2), ...v }],
  })),
  updateGlobalStateVar: (id, patch) => set(s => ({
    globalStateVars: s.globalStateVars.map(v => v.id === id ? { ...v, ...patch } : v),
  })),
  deleteGlobalStateVar: (id) => set(s => ({
    globalStateVars: s.globalStateVars.filter(v => v.id !== id),
  })),

  addActionFlow: (flow) => set(s => ({
    actionFlows: [...s.actionFlows, { id: Math.random().toString(36).slice(2), ...flow }],
  })),
  updateActionFlow: (id, patch) => set(s => ({
    actionFlows: s.actionFlows.map(f => f.id === id ? { ...f, ...patch } : f),
  })),
  deleteActionFlow: (id) => set(s => ({
    actionFlows: s.actionFlows.filter(f => f.id !== id),
  })),
  addActionStep: (flowId, step) => set(s => ({
    actionFlows: s.actionFlows.map(f => f.id === flowId
      ? { ...f, steps: [...f.steps, { id: Math.random().toString(36).slice(2), ...step }] }
      : f),
  })),
  updateActionStep: (flowId, stepId, patch) => set(s => ({
    actionFlows: s.actionFlows.map(f => f.id === flowId
      ? { ...f, steps: f.steps.map(st => st.id === stepId ? { ...st, ...patch } : st) }
      : f),
  })),
  deleteActionStep: (flowId, stepId) => set(s => ({
    actionFlows: s.actionFlows.map(f => f.id === flowId
      ? { ...f, steps: f.steps.filter(st => st.id !== stepId) }
      : f),
  })),
  reorderActionSteps: (flowId, fromIdx, toIdx) => set(s => ({
    actionFlows: s.actionFlows.map(f => {
      if (f.id !== flowId) return f;
      const steps = [...f.steps];
      const [item] = steps.splice(fromIdx, 1);
      steps.splice(toIdx, 0, item);
      return { ...f, steps };
    }),
  })),
  setLayerEvent: (layerId, eventName, flowIds) => set(s => ({
    layers: {
      ...s.layers,
      [s.activePageId]: updateLayerInTree(s.layers[s.activePageId] ?? [], layerId, l => ({
        ...l,
        layerEvents: { ...(l.layerEvents ?? {}), [eventName]: flowIds },
      })),
    },
  })),

  // ── Database actions ──────────────────────────────────
  setDatabaseProvider: (provider) => set(s => ({ database: { ...s.database, provider } })),

  addTable: (name) => set(s => ({
    database: {
      ...s.database,
      tables: [...s.database.tables, {
        id: Math.random().toString(36).slice(2),
        name,
        fields: [{ id: Math.random().toString(36).slice(2), name: 'id', type: 'uuid' as DbFieldType, primary: true, nullable: false }],
        timestamps: true,
        softDelete: false,
        indexes: [],
        relations: [],
        policies: [],
      }],
    },
  })),

  updateTable: (id, patch) => set(s => ({
    database: {
      ...s.database,
      tables: s.database.tables.map(t => t.id === id ? { ...t, ...patch } : t),
    },
  })),

  deleteTable: (id) => set(s => ({
    database: { ...s.database, tables: s.database.tables.filter(t => t.id !== id) },
  })),

  addField: (tableId, field) => set(s => ({
    database: {
      ...s.database,
      tables: s.database.tables.map(t => t.id === tableId
        ? { ...t, fields: [...t.fields, { id: Math.random().toString(36).slice(2), ...field }] }
        : t),
    },
  })),

  updateField: (tableId, fieldId, patch) => set(s => ({
    database: {
      ...s.database,
      tables: s.database.tables.map(t => t.id === tableId
        ? { ...t, fields: t.fields.map(f => f.id === fieldId ? { ...f, ...patch } : f) }
        : t),
    },
  })),

  deleteField: (tableId, fieldId) => set(s => ({
    database: {
      ...s.database,
      tables: s.database.tables.map(t => t.id === tableId
        ? { ...t, fields: t.fields.filter(f => f.id !== fieldId) }
        : t),
    },
  })),

  addRelation: (tableId, rel) => set(s => ({
    database: {
      ...s.database,
      tables: s.database.tables.map(t => t.id === tableId
        ? { ...t, relations: [...(t.relations ?? []), rel] }
        : t),
    },
  })),

  deleteRelation: (tableId, index) => set(s => ({
    database: {
      ...s.database,
      tables: s.database.tables.map(t => t.id === tableId
        ? { ...t, relations: (t.relations ?? []).filter((_, i) => i !== index) }
        : t),
    },
  })),

  // ── Auth actions ──────────────────────────────────────
  setAuthConfig: (patch) => set(s => ({ auth: { ...s.auth, ...patch } })),

  toggleAuthProvider: (type) => set(s => ({
    auth: {
      ...s.auth,
      providers: s.auth.providers.map(p => p.type === type ? { ...p, enabled: !p.enabled } : p),
    },
  })),

  updateAuthProvider: (type, patch) => set(s => ({
    auth: {
      ...s.auth,
      providers: s.auth.providers.map(p => p.type === type ? { ...p, ...patch } : p),
    },
  })),

  // ── Navigation actions ────────────────────────────────
  setNavigationType: (type) => set(s => ({ navigation: { ...s.navigation, type } })),

  addRoute: (route) => set(s => ({
    navigation: {
      ...s.navigation,
      routes: [...s.navigation.routes, { id: Math.random().toString(36).slice(2), ...route }],
    },
  })),

  updateRoute: (id, patch) => set(s => ({
    navigation: {
      ...s.navigation,
      routes: s.navigation.routes.map(r => r.id === id ? { ...r, ...patch } : r),
    },
  })),

  deleteRoute: (id) => set(s => ({
    navigation: { ...s.navigation, routes: s.navigation.routes.filter(r => r.id !== id) },
  })),

  // ── App Workflow actions ──────────────────────────────
  addAppWorkflow: (wf) => set(s => ({
    appWorkflows: [...s.appWorkflows, { id: Math.random().toString(36).slice(2), ...wf }],
  })),

  updateAppWorkflow: (id, patch) => set(s => ({
    appWorkflows: s.appWorkflows.map(w => w.id === id ? { ...w, ...patch } : w),
  })),

  deleteAppWorkflow: (id) => set(s => ({
    appWorkflows: s.appWorkflows.filter(w => w.id !== id),
  })),

  saveToServer: async () => {
    const { projectId, fileId, pages, layers, components, colorStyles, textStyles, effectStyles, fileName, apiSources, globalStateVars, actionFlows, database, auth, navigation, appWorkflows } = get();
    if (!projectId) return;
    set({ saveStatus: 'saving' });
    try {
      const body = { projectId, fileId, pages, layers, components, colorStyles, textStyles, effectStyles, fileName, apiSources, globalStateVars, actionFlows, database, auth, navigation, appWorkflows };
      const res = await fetch('/api/figma-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Save failed');
      const result = await res.json();
      set({ saveStatus: 'saved', fileId: result.fileId });
      setTimeout(() => set({ saveStatus: 'idle' }), 2000);
    } catch (e) {
      set({ saveStatus: 'error' });
      setTimeout(() => set({ saveStatus: 'idle' }), 3000);
    }
  },
}));
