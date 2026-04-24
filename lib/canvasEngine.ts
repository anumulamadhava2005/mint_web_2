// ═══════════════════════════════════════════════════════════════
// Canvas Engine — Core types, math, hit‑testing, transforms
//
// Re-exports Matrix3 system and integrates with SceneGraph.
// ═══════════════════════════════════════════════════════════════

// ── Re-exports from Matrix3 system ────────────────────────────
export type { Matrix3 } from "./matrix3";
export {
  mat3Identity,
  mat3Translate,
  mat3Rotate,
  mat3Scale,
  mat3Skew,
  mat3Compose,
  mat3Decompose,
  mat3Multiply,
  mat3Inverse,
  mat3Determinant,
  mat3Equals,
  mat3TransformPoint,
  mat3TransformVector,
  mat3WorldToLocal,
  mat3LocalToWorld,
  mat3TransformAABB,
  mat3ApplyToContext,
  mat3ConcatToContext,
} from "./matrix3";

// ── Re-exports from QuadTree ──────────────────────────────────
export { QuadTree } from "./quadTree";
export type { QTRect, QTItem } from "./quadTree";

// ── Re-exports from SceneGraph ────────────────────────────────
export { SceneGraph } from "./sceneGraph";
export type { SceneNodeData } from "./sceneGraph";

// ── Re-exports from Command History ───────────────────────────
export {
  CommandHistory,
  MoveCommand,
  AddShapeCommand,
  DeleteShapesCommand,
  UpdateShapeCommand,
  ReparentCommand,
  BatchCommand,
  GroupShapesCommand,
  UngroupShapesCommand,
} from "./commandHistory";
export type { Command, SyncOperation } from "./commandHistory";

// ── Re-exports from Constraint System ─────────────────────────
export { ConstraintSolver } from "./constraintSolver";

// ── Re-exports from Auto Layout Engine ────────────────────────
export { AutoLayoutEngine } from "./autoLayoutEngine";

// ── Re-exports from Multi-Selection Transform Solver ──────────
export { MultiSelectionSolver } from "./multiSelectionSolver";

// ── Re-exports from Snapping Engine ───────────────────────────
export { SnappingEngine } from "./snappingEngine";
export type { SnapResult, SnapGuide } from "./snappingEngine";

// ── Re-exports from Interaction State Machine ─────────────────
export { InteractionStateMachine } from "./interactionStateMachine";
export type { InteractionState, InteractionEvent, InteractionContext } from "./interactionStateMachine";

// ── Re-exports from Editor State ──────────────────────────────
export { EditorState } from "./editorState";

// ── Re-exports from Floating Origin ───────────────────────────
export { FloatingOrigin } from "./floatingOrigin";

// ── Re-exports from CRDT Sync ─────────────────────────────────
export { CRDTDocument, LamportClock } from "./crdtSync";
export type { CRDTOperation, LamportTimestamp } from "./crdtSync";

// ── Re-exports from WebGL Renderer ───────────────────────────
export { WebGLRenderer } from "./webglRenderer";

// ── Vector & Matrix helpers ────────────────────────────────────
export interface Vec2 {
  x: number;
  y: number;
}

export function vec(x = 0, y = 0): Vec2 { return { x, y }; }
export function vadd(a: Vec2, b: Vec2): Vec2 { return { x: a.x + b.x, y: a.y + b.y }; }
export function vsub(a: Vec2, b: Vec2): Vec2 { return { x: a.x - b.x, y: a.y - b.y }; }
export function vmul(v: Vec2, s: number): Vec2 { return { x: v.x * s, y: v.y * s }; }
export function vlen(v: Vec2): number { return Math.sqrt(v.x * v.x + v.y * v.y); }
export function vdist(a: Vec2, b: Vec2): number { return vlen(vsub(a, b)); }
export function vlerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
export function vrot(v: Vec2, angle: number, origin: Vec2 = vec()): Vec2 {
  const dx = v.x - origin.x;
  const dy = v.y - origin.y;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  };
}
export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
export function deg2rad(d: number): number { return (d * Math.PI) / 180; }
export function rad2deg(r: number): number { return (r * 180) / Math.PI; }

// ── Text-specific types ───────────────────────────────────────
export type TextAlign = "left" | "center" | "right" | "justified";
export type VerticalAlign = "top" | "center" | "bottom";
export type TextResizeMode = "autoWidth" | "autoHeight" | "fixed";
export type TextDecoration = "none" | "underline" | "strikethrough";
export type TextCase = "none" | "uppercase" | "lowercase" | "titleCase";
export type ListType = "none" | "bullet" | "numbered";

// ── Shape types ───────────────────────────────────────────────
export type ShapeType =
  | "rectangle"
  | "ellipse"
  | "line"
  | "polygon"
  | "star"
  | "text"
  | "frame"
  | "path";

// ── Constraint types (Figma-style) ────────────────────────────
export type HorizontalConstraint = "LEFT" | "RIGHT" | "CENTER" | "STRETCH" | "SCALE";
export type VerticalConstraint = "TOP" | "BOTTOM" | "CENTER" | "STRETCH" | "SCALE";

export interface Constraints {
  horizontal: HorizontalConstraint;
  vertical: VerticalConstraint;
}

// ── Auto Layout types (Flexbox-like) ──────────────────────────
export type LayoutDirection = "row" | "column";
export type LayoutAlign = "start" | "center" | "end" | "stretch";
export type LayoutJustify = "start" | "center" | "end" | "space-between" | "space-around";
export type SizingMode = "fixed" | "hug" | "fill";

export interface AutoLayout {
  direction: LayoutDirection;
  spacing: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  alignItems: LayoutAlign;
  justifyContent: LayoutJustify;
  /** Whether children wrap when they exceed container size */
  wrap: boolean;
}

export interface LayoutChildOverrides {
  /** How this child sizes itself within the parent auto-layout */
  horizontalSizing: SizingMode;
  verticalSizing: SizingMode;
  /** Flex grow factor (0 = don't grow) */
  flexGrow: number;
  /** Flex shrink factor (1 = allow shrink) */
  flexShrink: number;
  /** Alignment override for this specific child */
  alignSelf?: LayoutAlign;
}

export interface CanvasShape {
  id: string;
  type: ShapeType;
  name: string;
  // Transform
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;   // degrees
  scaleX: number;
  scaleY: number;
  // Style
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  cornerRadius: number;
  // Layer
  zIndex: number;
  visible: boolean;
  locked: boolean;
  // Group / Frame
  parentId: string | null;
  children: string[];  // ids for frames
  // Type-specific
  points?: Vec2[];           // polygon / path nodes
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;       // 100-900 (default 400)
  fontStyle?: "normal" | "italic";
  lineHeight?: number;       // px value, 0 = auto (~1.2×fontSize)
  letterSpacing?: number;    // px value
  paragraphSpacing?: number; // px between paragraphs
  textAlign?: TextAlign;
  verticalAlign?: VerticalAlign;
  textResizeMode?: TextResizeMode;
  textDecoration?: TextDecoration;
  textCase?: TextCase;
  listType?: ListType;
  starInnerRadius?: number;  // 0-1 ratio for star
  sides?: number;            // polygon side count
  // Page
  pageId: string;

  // ── Constraint System ───────────────────────────────────
  /** Constraint anchoring within parent frame on resize */
  constraints: Constraints;
  /** Stored offsets from parent edges (computed at constraint setup) */
  constraintOffsets?: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };

  // ── Auto Layout ─────────────────────────────────────────
  /** If set, this frame uses auto-layout (replaces manual positioning) */
  autoLayout?: AutoLayout;
  /** Per-child overrides when inside an auto-layout parent */
  layoutChildOverrides?: LayoutChildOverrides;
  /** Whether position is driven by layout engine (computed, not stored) */
  layoutPositioned?: boolean;
}

// Bounding box
export interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function shapeAABB(s: CanvasShape): AABB {
  return { minX: s.x, minY: s.y, maxX: s.x + s.width, maxY: s.y + s.height };
}

export function aabbContains(box: AABB, p: Vec2): boolean {
  return p.x >= box.minX && p.x <= box.maxX && p.y >= box.minY && p.y <= box.maxY;
}

export function aabbIntersects(a: AABB, b: AABB): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

export function aabbFromPoints(pts: Vec2[]): AABB {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

// Rotated bounding box corners
export function shapeCorners(s: CanvasShape): Vec2[] {
  const cx = s.x + s.width / 2;
  const cy = s.y + s.height / 2;
  const origin = vec(cx, cy);
  const angle = deg2rad(s.rotation);
  return [
    vrot(vec(s.x, s.y), angle, origin),
    vrot(vec(s.x + s.width, s.y), angle, origin),
    vrot(vec(s.x + s.width, s.y + s.height), angle, origin),
    vrot(vec(s.x, s.y + s.height), angle, origin),
  ];
}

// ── Hit‑testing ───────────────────────────────────────────────
/** pointInShape — works with LOCAL coordinates (the shape's own x/y).
 *  For scene‑graph aware hit‑testing, use pointInShapeGlobal instead. */
export function pointInShape(p: Vec2, s: CanvasShape): boolean {
  if (!s.visible) return false;
  // Un-rotate the point around shape center
  const cx = s.x + s.width / 2;
  const cy = s.y + s.height / 2;
  const origin = vec(cx, cy);
  const angle = -deg2rad(s.rotation);
  const rp = vrot(p, angle, origin);

  switch (s.type) {
    case "rectangle":
    case "frame":
    case "text":
      return aabbContains(shapeAABB(s), rp);

    case "ellipse": {
      const rx = s.width / 2;
      const ry = s.height / 2;
      const dx = (rp.x - cx) / rx;
      const dy = (rp.y - cy) / ry;
      return dx * dx + dy * dy <= 1;
    }

    case "line": {
      const a = vec(s.x, s.y);
      const b = vec(s.x + s.width, s.y + s.height);
      const d = distPointToSegment(rp, a, b);
      return d <= Math.max(s.strokeWidth / 2, 5);
    }

    case "polygon":
    case "star": {
      const pts = getShapeVertices(s);
      return pointInPolygon(rp, pts);
    }

    case "path": {
      if (!s.points || s.points.length < 3) return false;
      return pointInPolygon(rp, s.points.map(pt => vec(s.x + pt.x, s.y + pt.y)));
    }

    default:
      return aabbContains(shapeAABB(s), rp);
  }
}

function distPointToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const ab = vsub(b, a);
  const ap = vsub(p, a);
  const len2 = ab.x * ab.x + ab.y * ab.y;
  if (len2 === 0) return vdist(p, a);
  let t = (ap.x * ab.x + ap.y * ab.y) / len2;
  t = clamp(t, 0, 1);
  const proj = vadd(a, vmul(ab, t));
  return vdist(p, proj);
}

function pointInPolygon(p: Vec2, polygon: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if (((yi > p.y) !== (yj > p.y)) && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// Get vertices for polygon / star shape
export function getShapeVertices(s: CanvasShape): Vec2[] {
  const cx = s.x + s.width / 2;
  const cy = s.y + s.height / 2;
  const rx = s.width / 2;
  const ry = s.height / 2;

  if (s.type === "star") {
    const spikes = s.sides || 5;
    const inner = (s.starInnerRadius ?? 0.4) * Math.min(rx, ry);
    const pts: Vec2[] = [];
    for (let i = 0; i < spikes * 2; i++) {
      const angle = (Math.PI * i) / spikes - Math.PI / 2;
      const r = i % 2 === 0 ? Math.min(rx, ry) : inner;
      pts.push(vec(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r));
    }
    return pts;
  }

  // Regular polygon
  const sides = s.sides || 5;
  const pts: Vec2[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (2 * Math.PI * i) / sides - Math.PI / 2;
    pts.push(vec(cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry));
  }
  return pts;
}

// ── Resize handle locations ───────────────────────────────────
export type HandlePosition =
  | "tl" | "tc" | "tr"
  | "ml" | "mr"
  | "bl" | "bc" | "br"
  | "rotate";

export interface Handle {
  position: HandlePosition;
  x: number;
  y: number;
}

export function getHandles(s: CanvasShape): Handle[] {
  const { x, y, width: w, height: h } = s;
  return [
    { position: "tl", x, y },
    { position: "tc", x: x + w / 2, y },
    { position: "tr", x: x + w, y },
    { position: "ml", x, y: y + h / 2 },
    { position: "mr", x: x + w, y: y + h / 2 },
    { position: "bl", x, y: y + h },
    { position: "bc", x: x + w / 2, y: y + h },
    { position: "br", x: x + w, y: y + h },
    { position: "rotate", x: x + w / 2, y: y - 24 },
  ];
}

export function handleCursor(pos: HandlePosition): string {
  switch (pos) {
    case "tl": case "br": return "nwse-resize";
    case "tr": case "bl": return "nesw-resize";
    case "tc": case "bc": return "ns-resize";
    case "ml": case "mr": return "ew-resize";
    case "rotate": return "grab";
    default: return "default";
  }
}

/** Hit‑test using world‑space point against a shape that may have a parent.
 *  This resolves the global position first so scene‑graph children work. */
export function pointInShapeGlobal(worldP: Vec2, s: CanvasShape, lookup: Map<string, CanvasShape>): boolean {
  if (!s.visible) return false;
  const g = getGlobalPosition(s, lookup);
  // Create a temporary shape at global position for the standard hit test
  const globalS: CanvasShape = { ...s, x: g.x, y: g.y };
  return pointInShape(worldP, globalS);
}

/** Get the world-space AABB for a shape that may have a parent */
export function shapeAABBGlobal(s: CanvasShape, lookup: Map<string, CanvasShape>): AABB {
  const g = getGlobalPosition(s, lookup);
  return { minX: g.x, minY: g.y, maxX: g.x + s.width, maxY: g.y + s.height };
}

// ── Selection helpers ─────────────────────────────────────────
export function shapesInRect(shapes: CanvasShape[], rect: AABB, lookup?: Map<string, CanvasShape>): CanvasShape[] {
  return shapes.filter(s => {
    if (!s.visible || s.locked) return false;
    const sBox = lookup ? shapeAABBGlobal(s, lookup) : shapeAABB(s);
    return aabbIntersects(rect, sBox);
  });
}

// ── Collision / distance ──────────────────────────────────────
export function shapesOverlap(a: CanvasShape, b: CanvasShape): boolean {
  return aabbIntersects(shapeAABB(a), shapeAABB(b));
}
export function shapeDistance(a: CanvasShape, b: CanvasShape): number {
  const ac = vec(a.x + a.width / 2, a.y + a.height / 2);
  const bc = vec(b.x + b.width / 2, b.y + b.height / 2);
  return vdist(ac, bc);
}

// ── Camera / viewport ─────────────────────────────────────────
export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export function screenToWorld(screen: Vec2, cam: Camera): Vec2 {
  return {
    x: (screen.x - cam.x) / cam.zoom,
    y: (screen.y - cam.y) / cam.zoom,
  };
}
export function worldToScreen(world: Vec2, cam: Camera): Vec2 {
  return {
    x: world.x * cam.zoom + cam.x,
    y: world.y * cam.zoom + cam.y,
  };
}

/** Zoom centred on a focal point (e.g. mouse position) */
export function zoomAtPoint(cam: Camera, focal: Vec2, delta: number): Camera {
  const newZoom = clamp(cam.zoom + delta, 0.05, 64);
  const wx = (focal.x - cam.x) / cam.zoom;
  const wy = (focal.y - cam.y) / cam.zoom;
  return {
    x: focal.x - wx * newZoom,
    y: focal.y - wy * newZoom,
    zoom: newZoom,
  };
}

// ── Scene Graph ───────────────────────────────────────────────

/** Build a lookup map from id → shape for O(1) access */
export function buildShapeMap(shapes: CanvasShape[]): Map<string, CanvasShape> {
  const m = new Map<string, CanvasShape>();
  for (const s of shapes) m.set(s.id, s);
  return m;
}

/** Walk up the parent chain and accumulate position offsets.
 *  Returns the world‑space position of a shape whose x/y are local. */
export function getGlobalPosition(s: CanvasShape, lookup: Map<string, CanvasShape>): Vec2 {
  let gx = s.x;
  let gy = s.y;
  let pid = s.parentId;
  while (pid) {
    const parent = lookup.get(pid);
    if (!parent) break;
    gx += parent.x;
    gy += parent.y;
    pid = parent.parentId;
  }
  return vec(gx, gy);
}

/** Convert a world‑space position to local coordinates inside a parent frame */
export function worldToLocal(worldPos: Vec2, parentId: string | null, lookup: Map<string, CanvasShape>): Vec2 {
  if (!parentId) return worldPos;
  const parent = lookup.get(parentId);
  if (!parent) return worldPos;
  const pg = getGlobalPosition(parent, lookup);
  return vec(worldPos.x - pg.x, worldPos.y - pg.y);
}

/** Find the deepest frame that contains the given world‑space point.
 *  Skips any shape in `excludeIds` (the shapes being dragged).
 *  Returns null when the point is on the root canvas. */
export function getDropTarget(
  worldPoint: Vec2,
  shapes: CanvasShape[],
  lookup: Map<string, CanvasShape>,
  excludeIds: Set<string>,
): CanvasShape | null {
  // We want the topmost (highest zIndex) frame that contains the point.
  // Among overlapping frames, prefer the deepest child frame.
  const frames = shapes
    .filter(s => s.type === "frame" && s.visible && !excludeIds.has(s.id))
    .sort((a, b) => b.zIndex - a.zIndex); // topmost first

  for (const frame of frames) {
    const g = getGlobalPosition(frame, lookup);
    if (
      worldPoint.x >= g.x &&
      worldPoint.x <= g.x + frame.width &&
      worldPoint.y >= g.y &&
      worldPoint.y <= g.y + frame.height
    ) {
      // Check children frames for a deeper match
      const childFrames = frame.children
        .map(id => lookup.get(id))
        .filter((c): c is CanvasShape => !!c && c.type === "frame" && c.visible && !excludeIds.has(c.id))
        .sort((a, b) => b.zIndex - a.zIndex);
      for (const child of childFrames) {
        const cg = getGlobalPosition(child, lookup);
        if (
          worldPoint.x >= cg.x &&
          worldPoint.x <= cg.x + child.width &&
          worldPoint.y >= cg.y &&
          worldPoint.y <= cg.y + child.height
        ) {
          return child;
        }
      }
      return frame;
    }
  }
  return null;
}

/** Reparent a shape into a new parent (or null for root).
 *  Returns a **new** array of shapes with the hierarchy updated and
 *  coordinates converted so the shape does not visually jump. */
export function reparentShape(
  shapeId: string,
  newParentId: string | null,
  shapes: CanvasShape[],
): CanvasShape[] {
  const lookup = buildShapeMap(shapes);
  const shape = lookup.get(shapeId);
  if (!shape) return shapes;
  if (shape.parentId === newParentId) return shapes;
  // Prevent reparenting into self or descendant
  if (newParentId && isDescendant(newParentId, shapeId, lookup)) return shapes;

  // 1. Compute current world position
  const worldPos = getGlobalPosition(shape, lookup);

  // 2. Remove from old parent
  let next = shapes.map(s => {
    if (s.id === shape.parentId) {
      return { ...s, children: s.children.filter(c => c !== shapeId) };
    }
    return s;
  });

  // 3. Convert coordinates to new parent local space
  const localPos = worldToLocal(worldPos, newParentId, buildShapeMap(next));

  // 4. Update the shape
  next = next.map(s => {
    if (s.id === shapeId) {
      return { ...s, x: localPos.x, y: localPos.y, parentId: newParentId };
    }
    return s;
  });

  // 5. Add to new parent's children
  if (newParentId) {
    next = next.map(s => {
      if (s.id === newParentId && !s.children.includes(shapeId)) {
        return { ...s, children: [...s.children, shapeId] };
      }
      return s;
    });
  }

  return next;
}

/** Check if `candidateId` is a descendant of `ancestorId` */
function isDescendant(candidateId: string, ancestorId: string, lookup: Map<string, CanvasShape>): boolean {
  let current = lookup.get(candidateId);
  while (current) {
    if (current.parentId === ancestorId) return true;
    if (!current.parentId) return false;
    current = lookup.get(current.parentId);
  }
  return false;
}

/** Get tree depth (for indentation in layer panel) */
export function getNodeDepth(shapeId: string, lookup: Map<string, CanvasShape>): number {
  let depth = 0;
  let s = lookup.get(shapeId);
  while (s?.parentId) {
    depth++;
    s = lookup.get(s.parentId);
  }
  return depth;
}

/** Flatten the scene tree in render order (parent first, then sorted children) */
export function flattenSceneTree(
  shapes: CanvasShape[],
  parentId: string | null = null,
): CanvasShape[] {
  const children = shapes
    .filter(s => s.parentId === parentId)
    .sort((a, b) => a.zIndex - b.zIndex);
  const result: CanvasShape[] = [];
  for (const child of children) {
    result.push(child);
    if (child.children.length > 0) {
      result.push(...flattenSceneTree(shapes, child.id));
    }
  }
  return result;
}

// ── Factory ───────────────────────────────────────────────────
let _shapeCounter = 0;
export function createShape(
  type: ShapeType,
  x: number,
  y: number,
  w: number,
  h: number,
  pageId: string,
  overrides?: Partial<CanvasShape>,
): CanvasShape {
  _shapeCounter++;
  const base: CanvasShape = {
    id: `shape_${Date.now()}_${_shapeCounter}`,
    type,
    name: type.charAt(0).toUpperCase() + type.slice(1),
    x, y,
    width: w,
    height: h,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    fill: type === "text" ? "#FFFFFF" : "#818CF8",
    stroke: "",
    strokeWidth: 0,
    opacity: 1,
    cornerRadius: 0,
    zIndex: _shapeCounter,
    visible: true,
    locked: false,
    parentId: null,
    children: [],
    pageId,
    sides: type === "polygon" ? 6 : type === "star" ? 5 : undefined,
    starInnerRadius: type === "star" ? 0.4 : undefined,
    // Text defaults
    ...(type === "text" ? {
      text: "Text",
      fontSize: 16,
      fontFamily: "Inter",
      fontWeight: 400,
      fontStyle: "normal" as const,
      lineHeight: 0,
      letterSpacing: 0,
      paragraphSpacing: 0,
      textAlign: "left" as TextAlign,
      verticalAlign: "top" as VerticalAlign,
      textResizeMode: "autoWidth" as TextResizeMode,
      textDecoration: "none" as TextDecoration,
      textCase: "none" as TextCase,
      listType: "none" as ListType,
    } : {}),
    // Constraint defaults
    constraints: { horizontal: "LEFT", vertical: "TOP" },
  };
  return { ...base, ...overrides };
}
