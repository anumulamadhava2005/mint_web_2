// ═══════════════════════════════════════════════════════════════
// Runtime Schema Types — The contract between editor and runtime
//
// Every screen, component, state variable, action, and workflow
// is described as a schema. The editor produces schemas, the
// runtime consumes them.
// ═══════════════════════════════════════════════════════════════

// ── App Schema ───────────────────────────────────────────────

export interface AppSchema {
  id: string;
  name: string;
  version: string;
  schemaVersion: number; // for migration compatibility
  theme: ThemeSchema;
  screens: ScreenSchema[];
  globalState: StateNodeSchema[];
  globalActions: ActionSchema[];
  workflows: WorkflowSchema[];
  navigation: NavigationSchema;
  auth?: AuthConfigSchema;
  database?: DatabaseConfigSchema;
}

// ── Screen Schema ────────────────────────────────────────────

export interface ScreenSchema {
  id: string;
  name: string;
  route: string;
  components: ComponentSchema[];
  localState: StateNodeSchema[];
  actions: ActionSchema[];
  onMount?: ActionRef[];
  onUnmount?: ActionRef[];
  meta?: { title?: string; description?: string };
}

// ── Component Schema ─────────────────────────────────────────

export interface ComponentSchema {
  id: string;
  type: ComponentType;
  props: Record<string, PropValue>;
  bindings: Record<string, string>; // prop → expression
  children?: ComponentSchema[];
  conditionalRender?: string; // expression
  repeatFor?: { items: string; as: string; key?: string }; // list rendering
  style: StyleSchema;
  events?: Record<string, ActionRef[]>; // "onPress" → actions
  requiredRoles?: string[]; // role-based visibility: ["admin", "manager"]
}

export type ComponentType =
  | "view" | "text" | "button" | "input" | "image"
  | "scroll" | "list" | "grid" | "card" | "modal"
  | "form" | "select" | "checkbox" | "radio" | "switch"
  | "icon" | "divider" | "spacer" | "loading"
  | "video" | "map" | "webview" | "custom"
  // Data components
  | "dataTable" | "timeline" | "fileUpload"
  // UX components
  | "tabs" | "drawer" | "accordion"
  | "avatar" | "badge" | "statusChip"
  | "datePicker" | "searchInput"
  // State components
  | "stateStore" | "setState" | "updateState" | "resetState" | "removeState"
  // Logic components
  | "ifCondition" | "elseCondition" | "switchCondition"
  | "forEach" | "mapItems" | "filterItems"
  | "delayNode" | "debounceNode" | "transformNode";

export type PropValue = string | number | boolean | null | PropValue[] | { [key: string]: PropValue };

// ── Style Schema ─────────────────────────────────────────────

export interface StyleSchema {
  layout?: LayoutStyle;
  spacing?: SpacingStyle;
  sizing?: SizingStyle;
  background?: BackgroundStyle;
  border?: BorderStyle;
  typography?: TypographyStyle;
  effects?: EffectStyle;
  responsive?: ResponsiveOverride[];
}

export interface LayoutStyle {
  display?: "flex" | "grid" | "none";
  direction?: "row" | "column" | "row-reverse" | "column-reverse";
  justify?: "start" | "center" | "end" | "between" | "around" | "evenly";
  align?: "start" | "center" | "end" | "stretch" | "baseline";
  wrap?: boolean;
  gap?: number;
  position?: "relative" | "absolute" | "fixed" | "sticky";
  top?: number; right?: number; bottom?: number; left?: number;
  zIndex?: number;
}

export interface SpacingStyle {
  padding?: number | [number, number, number, number];
  margin?: number | [number, number, number, number];
}

export interface SizingStyle {
  width?: number | string; // number = px, string = "100%" | "auto"
  height?: number | string;
  minWidth?: number | string;
  minHeight?: number | string;
  maxWidth?: number | string;
  maxHeight?: number | string;
  flex?: number;
}

export interface BackgroundStyle {
  color?: string;
  gradient?: { type: "linear" | "radial"; colors: string[]; angle?: number };
  image?: { uri: string; fit?: "cover" | "contain" | "fill" | "none" };
  opacity?: number;
}

export interface BorderStyle {
  width?: number;
  color?: string;
  radius?: number | [number, number, number, number];
  style?: "solid" | "dashed" | "dotted";
}

export interface TypographyStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: "normal" | "bold" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900";
  fontStyle?: "normal" | "italic";
  color?: string;
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: "left" | "center" | "right" | "justify";
  textDecoration?: "none" | "underline" | "line-through";
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
}

export interface EffectStyle {
  shadow?: { x: number; y: number; blur: number; spread?: number; color: string }[];
  blur?: number;
  overflow?: "visible" | "hidden" | "scroll";
  transform?: { rotate?: number; scale?: number; translateX?: number; translateY?: number };
  transition?: { property: string; duration: number; easing?: string }[];
}

export interface ResponsiveOverride {
  breakpoint: "sm" | "md" | "lg" | "xl";
  minWidth: number;
  style: Partial<StyleSchema>;
}

// ── State Schema ─────────────────────────────────────────────

export interface StateNodeSchema {
  id: string;
  name: string; // e.g., "user", "form", "cache"
  scope: StateScope;
  defaultValue: unknown;
  type?: StateType;
  group?: string; // visual grouping: "user", "cart", "form"
  derived?: string; // expression to compute from other state
  async?: AsyncStateConfig;
  persist?: PersistConfig;
  validation?: ValidationRule[];
}

export type StateScope = "local" | "global" | "session" | "persisted";
export type StateType = "string" | "number" | "boolean" | "object" | "array" | "any";

export interface AsyncStateConfig {
  source: string; // API endpoint or action ref
  params?: Record<string, string>; // param → expression
  autoFetch?: boolean;
  refetchInterval?: number; // ms
  staleTime?: number; // ms
}

export interface PersistConfig {
  storage: "localStorage" | "sessionStorage" | "asyncStorage" | "secureStorage";
  key?: string; // custom storage key
  encrypt?: boolean;
}

export interface ValidationRule {
  type: "required" | "minLength" | "maxLength" | "min" | "max" | "pattern" | "custom";
  value?: unknown;
  message: string;
  expression?: string; // for "custom" type
}

// ── Action Schema ────────────────────────────────────────────

export interface ActionSchema {
  id: string;
  name: string;
  type: ActionType;
  config: Record<string, unknown>;
  condition?: string; // expression — only execute if true
  debounce?: number;
  throttle?: number;
  onSuccess?: ActionRef[];
  onError?: ActionRef[];
}

export type ActionRef = string | { actionId: string; params?: Record<string, string> };

export type ActionType =
  // UI
  | "navigate" | "goBack" | "openModal" | "closeModal"
  | "toast" | "alert" | "animate" | "scroll" | "focus"
  // Data
  | "fetch" | "mutate" | "setState" | "resetState"
  | "updateState" | "removeState"
  | "cacheSet" | "cacheInvalidate" | "sync" | "upload"
  // Logic
  | "condition" | "loop" | "sequence" | "parallel"
  | "delay" | "debounce" | "throttle"
  | "forEach" | "map" | "filter" | "transform"
  // Device
  | "camera" | "notifications" | "location" | "biometrics"
  | "haptics" | "share" | "clipboard" | "openUrl"
  // Custom
  | "custom" | "workflow";

// ── Workflow Schema ──────────────────────────────────────────

export interface WorkflowSchema {
  id: string;
  name: string;
  trigger: WorkflowTrigger;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface WorkflowTrigger {
  type: "event" | "action" | "schedule" | "webhook" | "stateChange";
  config: Record<string, unknown>;
}

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  label?: string;
  config: Record<string, unknown>;
  position?: { x: number; y: number }; // for visual editor
  retryPolicy?: { maxRetries: number; backoff: "linear" | "exponential"; delayMs: number };
}

export type WorkflowNodeType =
  // Logic
  | "condition" | "switch" | "loop" | "transform" | "delay" | "parallel"
  | "forEach" | "map" | "filter" | "debounce"
  // State
  | "setState" | "resetState" | "removeState"
  // Backend
  | "apiCall" | "dbQuery" | "dbMutate" | "authCheck"
  // UI
  | "navigate" | "showModal" | "updateState" | "toast"
  // Utility
  | "timer" | "formatter" | "parser" | "logger" | "email" | "notification";

export interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
  condition?: string; // expression
  label?: string;
}

// ── Navigation Schema ────────────────────────────────────────

export interface NavigationSchema {
  type: "stack" | "tabs" | "drawer" | "custom";
  initialRoute: string;
  routes: RouteSchema[];
}

export interface RouteSchema {
  path: string;
  screenId: string;
  params?: Record<string, StateType>;
  auth?: boolean; // requires authentication
  roles?: string[];
}

// ── Theme Schema ─────────────────────────────────────────────

export interface ThemeSchema {
  colors: Record<string, string>;
  fonts: Record<string, string>;
  spacing: Record<string, number>;
  radii: Record<string, number>;
  shadows: Record<string, EffectStyle["shadow"]>;
  darkMode?: { colors: Record<string, string> };
}

// ── Auth Config Schema ───────────────────────────────────────

export interface AuthConfigSchema {
  providers: AuthProvider[];
  sessionType: "jwt" | "cookie" | "session";
  tokenExpiry: number;
  refreshEnabled: boolean;
  rbac?: { roles: string[]; defaultRole: string };
  mfa?: { enabled: boolean; methods: ("totp" | "sms" | "email")[] };
  userStatePath?: string;  // state path for user object, default "user"
  roleField?: string;      // field name for role in user object, default "role"
}

export interface AuthProvider {
  type: "email" | "google" | "github" | "apple" | "facebook" | "magic-link";
  enabled: boolean;
  config?: Record<string, string>;
}

// ── Database Config Schema ───────────────────────────────────

export interface DatabaseConfigSchema {
  provider: "mint" | "supabase" | "firebase" | "custom";
  connectionUrl?: string; // for custom — {project_id}_{user_id}.mintit.pro for mint
  tables: TableSchema[];
}

export interface TableSchema {
  id: string;
  name: string;
  fields: FieldSchema[];
  relations: RelationSchema[];
  indexes: IndexSchema[];
  policies: PolicySchema[];
  timestamps?: boolean; // auto created_at, updated_at
  softDelete?: boolean; // auto deleted_at
}

export interface FieldSchema {
  name: string;
  type: FieldType;
  required: boolean;
  unique: boolean;
  default?: unknown;
  enumValues?: string[];
  description?: string;
}

export type FieldType =
  | "uuid" | "text" | "integer" | "float" | "boolean"
  | "date" | "datetime" | "timestamp" | "json" | "jsonb"
  | "enum" | "array" | "binary";

export interface RelationSchema {
  type: "one-to-one" | "one-to-many" | "many-to-many";
  targetTable: string;
  foreignKey: string;
  targetKey?: string; // defaults to "id"
  junctionTable?: string; // for many-to-many
  onDelete?: "cascade" | "set-null" | "restrict" | "no-action";
}

export interface IndexSchema {
  name: string;
  fields: string[];
  unique: boolean;
  type?: "btree" | "hash" | "gin" | "gist";
}

export interface PolicySchema {
  name: string;
  operation: "select" | "insert" | "update" | "delete" | "all";
  role?: string;
  condition?: string; // SQL expression
  check?: string;
}
