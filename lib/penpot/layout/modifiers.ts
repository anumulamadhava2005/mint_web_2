// ═══════════════════════════════════════════════════════════════
// Modifier Algebra — Declarative transformation system
// Mirrors: common/src/app/common/types/modifiers.cljc
//          common/src/app/common/geom/modif_tree.cljc
// ═══════════════════════════════════════════════════════════════

import type { UUID, Point, PenpotShape, Rect } from "../types";

// ── Geometric Operations ──────────────────────────────────────

export interface MoveOp {
  type: "move";
  x: number;
  y: number;
  order: number;
}

export interface ResizeOp {
  type: "resize";
  scaleX: number;
  scaleY: number;
  originX: number;
  originY: number;
  order: number;
}

export interface RotationOp {
  type: "rotation";
  angle: number;
  centerX: number;
  centerY: number;
  order: number;
}

export type GeometricOp = MoveOp | ResizeOp | RotationOp;

// ── Structure Operations ──────────────────────────────────────

export interface AddChildrenOp {
  type: "add-children";
  ids: UUID[];
  index?: number;
}

export interface RemoveChildrenOp {
  type: "remove-children";
  ids: UUID[];
}

export interface ReflowOp {
  type: "reflow";
}

export interface ScaleContentOp {
  type: "scale-content";
  scaleX: number;
  scaleY: number;
}

export interface ChangePropertyOp {
  type: "change-property";
  attr: string;
  val: any;
}

export type StructureOp =
  | AddChildrenOp
  | RemoveChildrenOp
  | ReflowOp
  | ScaleContentOp
  | ChangePropertyOp;

// ── Modifiers Record ──────────────────────────────────────────

/**
 * Modifiers for a single shape.
 *
 * - geometryParent: affects only this shape (non-recursive)
 * - geometryChild: propagated to children transitively
 * - structureParent: structural ops on this shape only
 * - structureChild: structural ops propagated to children
 */
export interface Modifiers {
  lastOrder: number;
  geometryParent: GeometricOp[];
  geometryChild: GeometricOp[];
  structureParent: StructureOp[];
  structureChild: StructureOp[];
}

export function emptyModifiers(): Modifiers {
  return {
    lastOrder: 0,
    geometryParent: [],
    geometryChild: [],
    structureParent: [],
    structureChild: [],
  };
}

// ── Modifier Tree ─────────────────────────────────────────────

/**
 * ModifTree: map of shape-id → Modifiers.
 * Built up incrementally, then batch-applied.
 */
export type ModifTree = Map<UUID, Modifiers>;

export function createModifTree(): ModifTree {
  return new Map();
}

export function getOrCreateModifiers(tree: ModifTree, id: UUID): Modifiers {
  let m = tree.get(id);
  if (!m) {
    m = emptyModifiers();
    tree.set(id, m);
  }
  return m;
}

// ── Builder helpers ───────────────────────────────────────────

let _globalOrder = 0;
function nextOrder(): number {
  return ++_globalOrder;
}

/** Reset the global order counter (for testing) */
export function resetOrderCounter(): void {
  _globalOrder = 0;
}

// Move modifiers
export function moveModifiers(dx: number, dy: number): GeometricOp {
  return { type: "move", x: dx, y: dy, order: nextOrder() };
}

export function moveParentModifiers(dx: number, dy: number): GeometricOp {
  return { type: "move", x: dx, y: dy, order: nextOrder() };
}

// Resize modifiers
export function resizeModifiers(
  scaleX: number,
  scaleY: number,
  originX: number,
  originY: number
): GeometricOp {
  return { type: "resize", scaleX, scaleY, originX, originY, order: nextOrder() };
}

export function resizeParentModifiers(
  scaleX: number,
  scaleY: number,
  originX: number,
  originY: number
): GeometricOp {
  return { type: "resize", scaleX, scaleY, originX, originY, order: nextOrder() };
}

// Rotation modifiers
export function rotationModifiers(angle: number, cx: number, cy: number): GeometricOp {
  return { type: "rotation", angle, centerX: cx, centerY: cy, order: nextOrder() };
}

// Structure modifiers
export function reflowModifiers(): StructureOp {
  return { type: "reflow" };
}

export function addChildrenModifiers(ids: UUID[], index?: number): StructureOp {
  return { type: "add-children", ids, index };
}

export function removeChildrenModifiers(ids: UUID[]): StructureOp {
  return { type: "remove-children", ids };
}

// ── Add modifiers to tree ─────────────────────────────────────

export function addMoveChild(tree: ModifTree, id: UUID, dx: number, dy: number): void {
  const m = getOrCreateModifiers(tree, id);
  m.geometryChild.push(moveModifiers(dx, dy));
  m.lastOrder = _globalOrder;
}

export function addMoveParent(tree: ModifTree, id: UUID, dx: number, dy: number): void {
  const m = getOrCreateModifiers(tree, id);
  m.geometryParent.push(moveParentModifiers(dx, dy));
  m.lastOrder = _globalOrder;
}

export function addResizeChild(
  tree: ModifTree,
  id: UUID,
  sx: number,
  sy: number,
  ox: number,
  oy: number
): void {
  const m = getOrCreateModifiers(tree, id);
  m.geometryChild.push(resizeModifiers(sx, sy, ox, oy));
  m.lastOrder = _globalOrder;
}

export function addResizeParent(
  tree: ModifTree,
  id: UUID,
  sx: number,
  sy: number,
  ox: number,
  oy: number
): void {
  const m = getOrCreateModifiers(tree, id);
  m.geometryParent.push(resizeParentModifiers(sx, sy, ox, oy));
  m.lastOrder = _globalOrder;
}

export function addReflow(tree: ModifTree, id: UUID): void {
  const m = getOrCreateModifiers(tree, id);
  m.structureParent.push(reflowModifiers());
}

// ── Apply modifiers to shape geometry ─────────────────────────

/** Bounds: represented as an axis-aligned bounding rect */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function shapeToBounds(shape: PenpotShape): Bounds {
  return { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
}

/**
 * Apply a sequence of geometric operations to a bounds rect.
 */
export function applyGeometricOps(bounds: Bounds, ops: GeometricOp[]): Bounds {
  // Sort by order to process in correct sequence
  const sorted = [...ops].sort((a, b) => a.order - b.order);

  let { x, y, width, height } = bounds;

  for (const op of sorted) {
    switch (op.type) {
      case "move":
        x += op.x;
        y += op.y;
        break;

      case "resize": {
        const newWidth = width * op.scaleX;
        const newHeight = height * op.scaleY;
        // origin-relative resize: shift to maintain origin point
        x = op.originX + (x - op.originX) * op.scaleX;
        y = op.originY + (y - op.originY) * op.scaleY;
        width = Math.max(1, newWidth);
        height = Math.max(1, newHeight);
        break;
      }

      case "rotation":
        // For axis-aligned bounds, rotation is a no-op on the bounding rect
        // (the rotation angle is stored separately on the shape)
        break;
    }
  }

  return { x, y, width, height };
}

/**
 * Apply all modifiers (both parent and child geometry) to a shape,
 * returning the updated shape attributes.
 */
export function applyModifiersToShape(
  shape: PenpotShape,
  modifiers: Modifiers
): Partial<PenpotShape> {
  const bounds = shapeToBounds(shape);

  // Apply parent modifiers first (non-recursive, just this shape)
  let result = applyGeometricOps(bounds, modifiers.geometryParent);

  // Then apply child modifiers
  result = applyGeometricOps(result, modifiers.geometryChild);

  const updates: Partial<PenpotShape> = {};

  if (result.x !== shape.x) updates.x = result.x;
  if (result.y !== shape.y) updates.y = result.y;
  if (result.width !== shape.width) updates.width = result.width;
  if (result.height !== shape.height) updates.height = result.height;

  // Handle rotation from rotation ops
  const parentRotations = modifiers.geometryParent.filter(
    (op): op is RotationOp => op.type === "rotation"
  );
  const childRotations = modifiers.geometryChild.filter(
    (op): op is RotationOp => op.type === "rotation"
  );
  const totalRotation =
    [...parentRotations, ...childRotations].reduce((sum, r) => sum + r.angle, 0);

  if (totalRotation !== 0) {
    updates.rotation = ((shape.rotation || 0) + totalRotation) % 360;
  }

  return updates;
}

/**
 * Merge two ModifTrees. Operations from `b` are appended to `a`.
 */
export function mergeModifTrees(a: ModifTree, b: ModifTree): ModifTree {
  const result = new Map(a);

  for (const [id, bMods] of b) {
    const existing = result.get(id);
    if (existing) {
      existing.geometryParent.push(...bMods.geometryParent);
      existing.geometryChild.push(...bMods.geometryChild);
      existing.structureParent.push(...bMods.structureParent);
      existing.structureChild.push(...bMods.structureChild);
      existing.lastOrder = Math.max(existing.lastOrder, bMods.lastOrder);
    } else {
      result.set(id, { ...bMods });
    }
  }

  return result;
}

/**
 * Select only the child-propagated operations from a Modifiers record.
 * Used when passing parent modifiers down to children.
 */
export function selectChildOps(modifiers: Modifiers): Modifiers {
  return {
    lastOrder: modifiers.lastOrder,
    geometryParent: [],
    geometryChild: [...modifiers.geometryChild],
    structureParent: [],
    structureChild: [...modifiers.structureChild],
  };
}
