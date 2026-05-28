// ═══════════════════════════════════════════════════════════════
// Code Conversion Type System
// A robust, extensible type system for design-to-code conversion
// ═══════════════════════════════════════════════════════════════

export type UUID = string;

// ── Target Frameworks ─────────────────────────────────────────
export type TargetFramework =
  | "react"
  | "nextjs"
  | "vue"
  | "svelte"
  | "react-native"
  | "flutter"
  | "html";

// ── Design Node Types ─────────────────────────────────────────
export type NodeType =
  | "FRAME"
  | "GROUP"
  | "RECTANGLE"
  | "ELLIPSE"
  | "LINE"
  | "POLYGON"
  | "STAR"
  | "VECTOR"
  | "TEXT"
  | "IMAGE"
  | "COMPONENT"
  | "INSTANCE"
  | "BOOLEAN_OPERATION"
  | "SLICE";

// ── Fill Types ────────────────────────────────────────────────
export type FillType = "SOLID" | "GRADIENT_LINEAR" | "GRADIENT_RADIAL" | "GRADIENT_ANGULAR" | "IMAGE";

export interface GradientStop {
  position: number; // 0-1
  color: string;
  opacity?: number;
}

export interface Fill {
  type: FillType;
  visible?: boolean;
  opacity?: number;
  blendMode?: BlendMode;
  // Solid
  color?: string;
  // Gradient
  gradientStops?: GradientStop[];
  gradientAngle?: number; // degrees
  gradientTransform?: Matrix2D;
  // Image
  imageRef?: string;
  imageFit?: "fill" | "cover" | "contain" | "tile";
  imageFilters?: ImageFilters;
}

export interface ImageFilters {
  exposure?: number;
  contrast?: number;
  saturation?: number;
  temperature?: number;
  tint?: number;
  highlights?: number;
  shadows?: number;
}

// ── Stroke Types ──────────────────────────────────────────────
export type StrokeCap = "NONE" | "ROUND" | "SQUARE" | "ARROW_LINES" | "ARROW_EQUILATERAL";
export type StrokeJoin = "MITER" | "BEVEL" | "ROUND";
export type StrokeAlign = "CENTER" | "INSIDE" | "OUTSIDE";

export interface Stroke {
  color?: string;
  opacity?: number;
  weight?: number;
  align?: StrokeAlign;
  cap?: StrokeCap;
  join?: StrokeJoin;
  dashPattern?: number[];
  dashOffset?: number;
  miterLimit?: number;
}

// ── Corner Radius ─────────────────────────────────────────────
export interface CornerRadius {
  uniform?: number;
  topLeft?: number;
  topRight?: number;
  bottomRight?: number;
  bottomLeft?: number;
  smoothing?: number; // iOS-style corner smoothing (0-1)
}

// ── Effects ───────────────────────────────────────────────────
export type EffectType = "DROP_SHADOW" | "INNER_SHADOW" | "LAYER_BLUR" | "BACKGROUND_BLUR";

export interface Effect {
  type: EffectType;
  visible?: boolean;
  // Shadow properties
  color?: string;
  offsetX?: number;
  offsetY?: number;
  blur?: number;
  spread?: number;
  // Pre-computed CSS (optional optimization)
  boxShadow?: string;
  filter?: string;
  backdropFilter?: string;
}

// ── Typography ────────────────────────────────────────────────
export type TextAlign = "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
export type TextVerticalAlign = "TOP" | "MIDDLE" | "BOTTOM";
export type TextDecoration = "NONE" | "UNDERLINE" | "STRIKETHROUGH";
export type TextCase = "ORIGINAL" | "UPPER" | "LOWER" | "TITLE";

export interface TextStyle {
  characters?: string;
  fontFamily?: string;
  fontWeight?: number | string;
  fontSize?: number;
  lineHeight?: number | "AUTO";
  lineHeightUnit?: "PIXELS" | "PERCENT" | "AUTO";
  letterSpacing?: number;
  letterSpacingUnit?: "PIXELS" | "PERCENT";
  textAlign?: TextAlign;
  textAlignVertical?: TextVerticalAlign;
  textDecoration?: TextDecoration;
  textCase?: TextCase;
  color?: string;
  opacity?: number;
  paragraphSpacing?: number;
  paragraphIndent?: number;
  // Rich text segments
  segments?: TextSegment[];
}

export interface TextSegment {
  start: number;
  end: number;
  style: Partial<TextStyle>;
}

// ── Layout ────────────────────────────────────────────────────
export type LayoutMode = "NONE" | "HORIZONTAL" | "VERTICAL" | "GRID";
export type LayoutAlign = "MIN" | "CENTER" | "MAX" | "STRETCH" | "BASELINE";
export type LayoutJustify = "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN" | "SPACE_AROUND" | "SPACE_EVENLY";
export type LayoutWrap = "NO_WRAP" | "WRAP";
export type LayoutSizing = "FIXED" | "HUG" | "FILL";

export interface LayoutProperties {
  mode?: LayoutMode;
  direction?: "ROW" | "COLUMN";
  wrap?: LayoutWrap;
  primaryAxisAlign?: LayoutJustify;
  counterAxisAlign?: LayoutAlign;
  gap?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  // Child properties
  layoutSizingHorizontal?: LayoutSizing;
  layoutSizingVertical?: LayoutSizing;
  layoutGrow?: number;
  layoutPositioning?: "AUTO" | "ABSOLUTE";
}

// ── Constraints ───────────────────────────────────────────────
export type HorizontalConstraint = "LEFT" | "RIGHT" | "LEFT_RIGHT" | "CENTER" | "SCALE";
export type VerticalConstraint = "TOP" | "BOTTOM" | "TOP_BOTTOM" | "CENTER" | "SCALE";

export interface Constraints {
  horizontal?: HorizontalConstraint;
  vertical?: VerticalConstraint;
}

// ── Blend Modes ───────────────────────────────────────────────
export type BlendMode =
  | "PASS_THROUGH"
  | "NORMAL"
  | "DARKEN"
  | "MULTIPLY"
  | "LINEAR_BURN"
  | "COLOR_BURN"
  | "LIGHTEN"
  | "SCREEN"
  | "LINEAR_DODGE"
  | "COLOR_DODGE"
  | "OVERLAY"
  | "SOFT_LIGHT"
  | "HARD_LIGHT"
  | "DIFFERENCE"
  | "EXCLUSION"
  | "HUE"
  | "SATURATION"
  | "COLOR"
  | "LUMINOSITY";

// ── Transforms ────────────────────────────────────────────────
export type Matrix2D = [number, number, number, number, number, number];

export interface Transform {
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  skewX?: number;
  skewY?: number;
}

// ── Interactions ──────────────────────────────────────────────
export type InteractionTrigger =
  | "ON_CLICK"
  | "ON_HOVER"
  | "ON_PRESS"
  | "ON_DRAG"
  | "MOUSE_ENTER"
  | "MOUSE_LEAVE"
  | "MOUSE_DOWN"
  | "MOUSE_UP"
  | "AFTER_TIMEOUT";

export type InteractionAction =
  | "NAVIGATE"
  | "OPEN_OVERLAY"
  | "CLOSE_OVERLAY"
  | "SWAP_OVERLAY"
  | "SCROLL_TO"
  | "OPEN_URL"
  | "BACK"
  | "SET_VARIABLE"
  | "UPDATE_MEDIA_RUNTIME";

export interface Animation {
  type: "INSTANT" | "DISSOLVE" | "MOVE_IN" | "MOVE_OUT" | "PUSH" | "SLIDE_IN" | "SLIDE_OUT" | "SMART_ANIMATE";
  direction?: "LEFT" | "RIGHT" | "TOP" | "BOTTOM";
  easing?: "LINEAR" | "EASE_IN" | "EASE_OUT" | "EASE_IN_OUT" | "EASE_IN_BACK" | "EASE_OUT_BACK" | "CUSTOM_BEZIER";
  duration?: number; // ms
  bezier?: [number, number, number, number];
}

export interface Interaction {
  id?: UUID;
  sourceId: UUID;
  trigger: InteractionTrigger;
  action: InteractionAction;
  targetId?: UUID;
  destinationUrl?: string;
  animation?: Animation;
  delay?: number;
  preserveScrollPosition?: boolean;
}

// ── Design Node (Input) ───────────────────────────────────────
export interface DesignNode {
  id: UUID;
  name?: string;
  type: NodeType;
  visible?: boolean;
  locked?: boolean;
  // Geometry
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  // Absolute position (canvas coordinates)
  absoluteX?: number;
  absoluteY?: number;
  // Styling
  fills?: Fill[];
  strokes?: Stroke[];
  effects?: Effect[];
  corners?: CornerRadius;
  opacity?: number;
  blendMode?: BlendMode;
  // Text
  text?: TextStyle;
  // Layout
  layout?: LayoutProperties;
  constraints?: Constraints;
  // Hierarchy
  children?: DesignNode[];
  parentId?: UUID;
  // Scroll / Overflow
  clipContent?: boolean;
  overflowBehavior?: OverflowBehavior;
  fixedWhenScrolling?: boolean;
  // Component
  componentId?: UUID;
  componentSetId?: UUID;
  // Export settings
  exportSettings?: ExportSetting[];
  // Plugin data
  pluginData?: Record<string, unknown>;
  sharedPluginData?: Record<string, Record<string, unknown>>;
}

export interface ExportSetting {
  format: "PNG" | "JPG" | "SVG" | "PDF";
  suffix?: string;
  constraint?: { type: "SCALE" | "WIDTH" | "HEIGHT"; value: number };
}

// ── Drawable Node (Processed) ─────────────────────────────────
export interface DrawableNode {
  id: UUID;
  name: string;
  type: NodeType;
  // Computed positions
  x: number; // Local position relative to parent
  y: number;
  ax: number; // Absolute X (canvas coordinates)
  ay: number; // Absolute Y (canvas coordinates)
  w: number;
  h: number;
  // Normalized fill (single best fill)
  fill?: Fill;
  // Normalized stroke (single best stroke)
  stroke?: Stroke;
  // Effects
  effects?: Effect[];
  // Corner radius
  corners?: CornerRadius;
  // Opacity
  opacity?: number;
  // Blend mode CSS value
  mixBlendMode?: string;
  // Text properties
  text?: TextStyle;
  // Layout
  layout?: LayoutProperties;
  // Children
  children?: DrawableNode[];
  // UX enhancements added during processing
  ux?: UXEnhancements;
  // Scroll / overflow properties
  scroll?: ScrollViewProperties;
  // Interactions attached to this node
  interactions?: Interaction[];
  // Transform
  transform?: Transform;
  // Runtime bindings (connects UI to backend state/actions/DB)
  bindings?: RuntimeBindings;
  // Original node reference
  originalNode?: DesignNode;
}

// ── Runtime Bindings ──────────────────────────────────────────
export interface RuntimeBindings {
  textBind?: string;       // e.g. "$currentUser" — binds text to state
  visibleBind?: string;    // e.g. "$isLoggedIn" — conditional visibility
  dataSource?: string;     // e.g. "todos" — table name for data fetching
  dataQuery?: Record<string, any>;
  onClick?: string;        // action name, e.g. "addTodo"
  onSubmit?: string;       // action name for form submission
  inputBind?: string;      // two-way bind for input: "$form.email"
  repeatFor?: string;      // "$todos" — repeat for each item
  repeatAs?: string;       // "todo" — variable name for iteration
  onMount?: string;        // action name to call on component mount
}

// ── Scroll / Overflow ─────────────────────────────────────────
/**
 * Defines how a frame's overflow content is handled.
 *   "none"       — Clip without scrolling (overflow: hidden)
 *   "vertical"   — Only vertical scrolling
 *   "horizontal" — Only horizontal scrolling
 *   "both"       — Scroll in both axes
 */
export type OverflowBehavior = "none" | "vertical" | "horizontal" | "both";

export interface ScrollViewProperties {
  /** Whether the frame clips its children (overflow hidden / scroll). */
  clipContent?: boolean;
  /** Explicit overflow/scroll direction set in the design tool. */
  overflowBehavior?: OverflowBehavior;
  /**
   * This element stays fixed in place while its parent scrolls.
   * Maps to `position: sticky` (web) or sticky headers (native).
   */
  fixedWhenScrolling?: boolean;
  /**
   * For SCROLL_TO interactions — the target element id to scroll into view.
   */
  scrollToTargetId?: string;
}

export interface UXEnhancements {
  scrollX?: boolean;
  scrollY?: boolean;
  snap?: boolean;
  peek?: boolean;
  elevate?: boolean;
  carousel?: boolean;
  isClickable?: boolean;
}

// ── Design Snapshot (Full Export) ─────────────────────────────
export interface DesignSnapshot {
  version: number;
  name?: string;
  exportedAt?: string;
  payload: {
    roots: DesignNode[];
  };
  // Reference frame dimensions
  referenceFrame?: {
    id: UUID;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  // All interactions in the design
  interactions?: Interaction[];
  // Design tokens / variables
  variables?: DesignVariable[];
  // Component definitions
  components?: ComponentDefinition[];
  // Styles
  styles?: StyleDefinition[];
}

export interface DesignVariable {
  id: UUID;
  name: string;
  type: "COLOR" | "NUMBER" | "STRING" | "BOOLEAN";
  value: string | number | boolean;
  scope?: "LOCAL" | "GLOBAL";
}

export interface ComponentDefinition {
  id: UUID;
  name: string;
  description?: string;
  rootNode: DesignNode;
  variants?: VariantProperty[];
}

export interface VariantProperty {
  name: string;
  values: string[];
}

export interface StyleDefinition {
  id: UUID;
  name: string;
  type: "FILL" | "STROKE" | "TEXT" | "EFFECT" | "GRID";
  properties: Fill | Stroke | TextStyle | Effect;
}

// ── Conversion Request/Response ───────────────────────────────
export interface ConversionRequest {
  target: TargetFramework;
  fileName: string;
  nodes: DesignNode[];
  referenceFrame?: {
    id: UUID;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  interactions?: Interaction[];
  options?: ConversionOptions;
}

export interface ConversionOptions {
  // Project options
  fileName?: string;
  
  // Output options
  generateTypeScript?: boolean;
  includeComments?: boolean;
  cssFramework?: "tailwind" | "styled-components" | "css-modules" | "inline";
  // Image handling
  embedImages?: boolean;
  imageQuality?: number;
  // Code style
  indentSize?: number;
  useSemicolons?: boolean;
  singleQuotes?: boolean;
  // Framework-specific
  nextjsAppRouter?: boolean;
  vueCompositionApi?: boolean;
  reactUseHooks?: boolean;
  // Live features
  enableLiveSync?: boolean;
  fileKey?: string;
  projectId?: string;
  userId?: string;
  /** Auth token for private project API access (injected server-side) */
  authToken?: string;
  // Runtime schema (state, actions, database, workflows)
  runtimeSchema?: {
    globalState?: Array<{ id: string; name: string; type: string; defaultValue: any }>;
    globalActions?: Array<{ id: string; name: string; type: string; config: any }>;
    database?: { provider: string; connectionUrl?: string; tables?: any[] };
    workflows?: any[];
  };
}

export interface ConversionResult {
  success: boolean;
  files: GeneratedFile[];
  warnings?: string[];
  errors?: string[];
  manifest?: ImageManifest;
}

export interface GeneratedFile {
  path: string;
  content: string | Uint8Array;
  type: "text" | "binary";
}

export interface ImageManifest {
  images: Map<string, string>; // originalRef → localPath
  blobs: Map<string, Uint8Array>;
}

// ── Builder Interface ─────────────────────────────────────────
export interface FrameworkBuilder {
  name: TargetFramework;
  displayName: string;
  version: string;
  build(
    nodes: DrawableNode[],
    options: ConversionOptions,
    manifest: ImageManifest,
    interactions: Interaction[]
  ): Promise<GeneratedFile[]>;
}

// ── Plugin System ─────────────────────────────────────────────
export interface ConversionPlugin {
  name: string;
  version: string;
  // Transform nodes before conversion
  preProcess?(nodes: DrawableNode[]): DrawableNode[];
  // Transform generated files
  postProcess?(files: GeneratedFile[]): GeneratedFile[];
  // Add additional files
  generateFiles?(nodes: DrawableNode[], options: ConversionOptions): GeneratedFile[];
}
