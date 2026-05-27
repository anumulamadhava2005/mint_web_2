// ═══════════════════════════════════════════════════════════════
// Penpot-Inspired Shape Data Model & Core Types
// Mirrors: common/src/app/common/types/shape.cljc
// ═══════════════════════════════════════════════════════════════

export type UUID = string;

// ── Shape Types ───────────────────────────────────────────────
export type ShapeKind =
  | "frame"
  | "group"
  | "bool"
  | "rect"
  | "circle"
  | "path"
  | "text"
  | "image"
  | "svg-raw";

// ── Geometry ──────────────────────────────────────────────────
export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SelectionRect extends Rect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** 2D affine transform as [a,b,c,d,e,f] (standard SVG transform matrix) */
export type Matrix2D = [number, number, number, number, number, number];

// ── Fill & Stroke ─────────────────────────────────────────────
export interface Fill {
  fillColor?: string;
  fillOpacity?: number;
  fillColorGradient?: Gradient;
  fillColorRefId?: UUID;
  fillImage?: ImageData;
}

export interface Stroke {
  strokeColor?: string;
  strokeOpacity?: number;
  strokeWidth?: number;
  strokeAlignment?: "center" | "inner" | "outer";
  strokeCapStart?: "round" | "square" | "butt";
  strokeCapEnd?: "round" | "square" | "butt";
}

export interface Gradient {
  type: "linear" | "radial";
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  width?: number;
  stops: Array<{ color: string; opacity: number; offset: number }>;
}

// ── Shadows & Blur ────────────────────────────────────────────
export interface Shadow {
  id: UUID;
  type: "drop-shadow" | "inner-shadow";
  color: string;
  opacity: number;
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  hidden?: boolean;
}

export interface Blur {
  id: UUID;
  type: "layer-blur" | "background-blur";
  value: number;
  hidden?: boolean;
}

// ── Constraints ───────────────────────────────────────────────
export type HConstraint = "left" | "right" | "leftright" | "center" | "scale";
export type VConstraint = "top" | "bottom" | "topbottom" | "center" | "scale";

// ── Layout (Flex/Grid) ────────────────────────────────────────
export type LayoutType = "flex" | "grid";
export type FlexDirection = "row" | "column" | "row-reverse" | "column-reverse";
export type FlexAlign = "start" | "center" | "end" | "stretch";
export type FlexJustify = "start" | "center" | "end" | "space-between" | "space-around" | "space-evenly";
export type FlexWrap = "wrap" | "nowrap";

export interface LayoutProps {
  layout?: LayoutType;
  layoutFlexDir?: FlexDirection;
  layoutGap?: number;
  layoutGapRow?: number;
  layoutGapColumn?: number;
  layoutAlignItems?: FlexAlign;
  layoutAlignContent?: FlexAlign;
  layoutJustifyContent?: FlexJustify;
  layoutJustifyItems?: FlexAlign;
  layoutWrapType?: FlexWrap;
  layoutPaddingTop?: number;
  layoutPaddingRight?: number;
  layoutPaddingBottom?: number;
  layoutPaddingLeft?: number;
  // Grid-specific
  layoutGridDir?: "row" | "column";
  layoutGridRows?: Array<{ type: "fixed" | "flex" | "auto" | "percent"; value: number }>;
  layoutGridColumns?: Array<{ type: "fixed" | "flex" | "auto" | "percent"; value: number }>;
  layoutGridCells?: Record<string, any>;
}

export interface LayoutItemProps {
  layoutItemHSizing?: "auto" | "fill" | "fix";
  layoutItemVSizing?: "auto" | "fill" | "fix";
  layoutItemAlignSelf?: FlexAlign;
  layoutItemGrow?: number;
  layoutItemMinW?: number;
  layoutItemMaxW?: number;
  layoutItemMinH?: number;
  layoutItemMaxH?: number;
  layoutItemMargin?: { m1?: number; m2?: number; m3?: number; m4?: number };
  layoutItemMarginType?: "simple" | "multiple";
  layoutItemAbsolute?: boolean;
  layoutItemZIndex?: number;
}

// ── Interactions (Prototyping) ─────────────────────────────────
export type InteractionEventType =
  | "click"
  | "mouse-press"
  | "mouse-over"
  | "mouse-enter"
  | "mouse-leave"
  | "mouse-down"
  | "mouse-up"
  | "after-delay"
  | "key-down";

export type InteractionActionType =
  | "navigate"
  | "open-overlay"
  | "toggle-overlay"
  | "swap-overlay"
  | "close-overlay"
  | "prev-screen"
  | "open-url"
  | "scroll-to"
  | "swap-variant";

export type AnimationType = "dissolve" | "slide" | "push" | "move-in" | "move-out" | "smart-animate" | "instant";
export type EasingType = "linear" | "ease" | "ease-in" | "ease-out" | "ease-in-out" | "spring";
export type DirectionType = "right" | "left" | "up" | "down";

export type OverlayPositioning =
  | "manual"
  | "center"
  | "top-left"
  | "top-right"
  | "top-center"
  | "bottom-left"
  | "bottom-right"
  | "bottom-center";

export interface InteractionAnimation {
  animationType: AnimationType;
  duration: number;
  easing: EasingType;
  direction?: DirectionType;
}

export interface Interaction {
  id: UUID;
  eventType: InteractionEventType;
  actionType: InteractionActionType;
  destination?: UUID; // target frame ID
  delay?: number; // ms for after-delay
  preserveScroll?: boolean;
  overlayPosType?: OverlayPositioning;
  overlayPosition?: Point;
  closeClickOutside?: boolean;
  backgroundOverlay?: boolean;
  animation?: InteractionAnimation;
  url?: string; // for open-url
  scrollTargetId?: UUID; // for scroll-to: which element to scroll to
  key?: string; // for key-down: which key triggers the interaction
  variantProperties?: Record<string, string>; // for swap-variant
}

// ── Scroll Behavior (Frame-level) ─────────────────────────────
export type ScrollBehavior = "none" | "vertical" | "horizontal" | "both";

export interface ScrollConfig {
  behavior: ScrollBehavior;
  /** Fixed elements that don't scroll with content */
  fixedElements?: UUID[];
  /** Overflow: clip content to frame bounds */
  overflow: "hidden" | "scroll";
}

// ── Path Segments ─────────────────────────────────────────────
export type PathCommand =
  | { command: "M"; x: number; y: number }
  | { command: "L"; x: number; y: number }
  | { command: "C"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { command: "Q"; x1: number; y1: number; x: number; y: number }
  | { command: "Z" };

// ── Bool Operations ───────────────────────────────────────────
export type BoolType = "union" | "difference" | "exclude" | "intersection";

// ── Text Content (simplified ProseMirror-like) ─────────────────
export interface TextContent {
  type: "root";
  children: TextParagraph[];
}

export interface TextParagraph {
  type: "paragraph";
  children: TextRun[];
  textAlign?: "left" | "center" | "right" | "justify";
}

export interface TextRun {
  text: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  fontStyle?: "normal" | "italic";
  fill?: string;
  textDecoration?: "none" | "underline" | "line-through";
  letterSpacing?: number;
  lineHeight?: number;
}

// ── The Shape ─────────────────────────────────────────────────
export interface PenpotShape {
  id: UUID;
  name: string;
  type: ShapeKind;

  // Geometry
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // degrees

  selrect?: SelectionRect;
  points?: Point[]; // 4-corner bounding points
  transform?: Matrix2D;
  transformInverse?: Matrix2D;

  // Hierarchy
  parentId: UUID | null;
  frameId: UUID;
  shapes?: UUID[]; // child IDs (for frames, groups)

  // Visual
  fills: Fill[];
  strokes: Stroke[];
  opacity: number;
  blendMode?: string;
  shadow?: Shadow[];
  blur?: Blur;

  // Constraints & Layout
  constraintsH?: HConstraint;
  constraintsV?: VConstraint;
  layoutProps?: LayoutProps;
  layoutItemProps?: LayoutItemProps;

  // Corner radius
  rx?: number;
  ry?: number;

  // Frame-specific
  showContent?: boolean; // clip children
  guides?: any[];
  scrollConfig?: ScrollConfig;

  // Text-specific
  content?: TextContent;
  growType?: "auto-width" | "auto-height" | "fixed";

  // Path-specific
  pathContent?: PathCommand[];

  // Bool-specific
  boolType?: BoolType;

  // Image-specific
  imageMetadata?: { width: number; height: number; mtype: string; url?: string };

  // Interactions
  interactions?: Interaction[];

  // Organizational
  blocked?: boolean;
  hidden?: boolean;
  locked?: boolean;
  collapsed?: boolean;

  // Component (simplified)
  componentId?: UUID;
  componentRoot?: boolean;
  mainInstance?: boolean;

  // Runtime bindings (connects UI to backend)
  runtimeBindings?: {
    textBind?: string;       // e.g. "$user.name" — binds text content to state
    visibleBind?: string;    // e.g. "$isLoggedIn" — conditional visibility
    dataSource?: string;     // e.g. "todos" — table name for list rendering
    dataQuery?: Record<string, any>; // query options (where, orderBy, etc.)
    onClick?: string;        // action ID or expression
    onSubmit?: string;       // action ID for form submission
    inputBind?: string;      // two-way bind for input fields: "$form.email"
    repeatFor?: string;      // "$items" — repeat this shape for each item
    repeatAs?: string;       // "item" — variable name for each iteration
    onMount?: string;        // action name to call when this screen mounts
    style?: Record<string, string>; // dynamic style bindings
  };
}

// ── Page ──────────────────────────────────────────────────────
export interface Page {
  id: UUID;
  name: string;
  objects: Record<UUID, PenpotShape>;
  flows?: Flow[];
  guides?: any[];
}

// ── Flow (Prototype entry point) ──────────────────────────────
export interface Flow {
  id: UUID;
  name: string;
  startingFrame: UUID;
}

// ── File (Document) ───────────────────────────────────────────
export interface PenpotFile {
  id: UUID;
  name: string;
  projectId: UUID;
  revn: number;
  pages: UUID[]; // ordered page IDs
  pagesIndex: Record<UUID, Page>;
  colors?: Record<UUID, LibraryColor>;
  typographies?: Record<UUID, LibraryTypography>;
  components?: Record<UUID, any>;
  createdAt?: string;
  modifiedAt?: string;
}

// ── Library items ─────────────────────────────────────────────
export interface LibraryColor {
  id: UUID;
  name: string;
  color: string;
  opacity: number;
}

export interface LibraryTypography {
  id: UUID;
  name: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: string;
  lineHeight: number;
  letterSpacing: number;
}

// ── Root frame ID (uuid/zero equivalent) ──────────────────────
export const ROOT_FRAME_ID = "00000000-0000-0000-0000-000000000000";

// ── Helper: create blank page ─────────────────────────────────
export function createBlankPage(id: UUID, name = "Page 1"): Page {
  return {
    id,
    name,
    objects: {
      [ROOT_FRAME_ID]: {
        id: ROOT_FRAME_ID,
        type: "frame",
        name: "Root Frame",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
        parentId: null,
        frameId: ROOT_FRAME_ID,
        shapes: [],
        fills: [],
        strokes: [],
        opacity: 1,
      },
    },
    flows: [],
  };
}

// ── Helper: create default shape ──────────────────────────────
export function createDefaultShape(
  type: ShapeKind,
  overrides: Partial<PenpotShape> = {}
): PenpotShape {
  const base: PenpotShape = {
    id: crypto.randomUUID(),
    name: type.charAt(0).toUpperCase() + type.slice(1),
    type,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    parentId: null,
    frameId: ROOT_FRAME_ID,
    fills: [{ fillColor: "#D8D8D8", fillOpacity: 1 }],
    strokes: [],
    opacity: 1,
  };

  if (type === "frame") {
    base.shapes = [];
    base.showContent = true;
    base.fills = [{ fillColor: "#FFFFFF", fillOpacity: 1 }];
    base.frameId = base.id; // frames reference themselves
  }

  if (type === "text") {
    base.width = 200;
    base.height = 40;
    base.fills = [{ fillColor: "#000000", fillOpacity: 1 }];
    base.content = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [{ text: "Text", fontFamily: "Inter", fontSize: 16, fontWeight: 400, fontStyle: "normal" }],
        },
      ],
    };
    base.growType = "auto-height";
  }

  if (type === "circle") {
    base.name = "Ellipse";
  }

  return { ...base, ...overrides };
}
