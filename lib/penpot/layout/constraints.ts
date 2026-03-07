// ═══════════════════════════════════════════════════════════════
// Constraint System — Penpot-style constraint-based positioning
// Mirrors: common/src/app/common/geom/shapes/constraints.cljc
// ═══════════════════════════════════════════════════════════════

import type { UUID, PenpotShape, HConstraint, VConstraint } from "../types";
import type { Bounds, ModifTree, GeometricOp } from "./modifiers";
import {
  getOrCreateModifiers,
  moveModifiers,
  resizeModifiers,
  selectChildOps,
} from "./modifiers";

// ── Default Constraints ───────────────────────────────────────

/**
 * Get the default horizontal constraint for a child within a parent.
 * - Direct child of frame → "left"
 * - Child of group (non-frame) → "scale"
 */
export function defaultConstraintH(parent: PenpotShape): HConstraint {
  return parent.type === "frame" ? "left" : "scale";
}

export function defaultConstraintV(parent: PenpotShape): VConstraint {
  return parent.type === "frame" ? "top" : "scale";
}

// ── Constraint Calculation ────────────────────────────────────

interface ConstraintResult {
  dx: number;
  dy: number;
  scaleX: number;
  scaleY: number;
  originX: number;
  originY: number;
}

/**
 * Calculate the horizontal constraint modifier for a child shape.
 *
 * @param constraint - The horizontal constraint type
 * @param childBounds - Current child bounds
 * @param parentBefore - Parent bounds before the transformation
 * @param parentAfter - Parent bounds after the transformation
 */
function constraintModifierH(
  constraint: HConstraint,
  childBounds: Bounds,
  parentBefore: Bounds,
  parentAfter: Bounds
): { dx: number; scaleX: number; originX: number } {
  const oldPW = parentBefore.width;
  const newPW = parentAfter.width;
  const parentDX = parentAfter.x - parentBefore.x;

  // Relative positions within parent
  const childLeft = childBounds.x - parentBefore.x;
  const childRight = oldPW - (childLeft + childBounds.width);
  const childW = childBounds.width;

  switch (constraint) {
    case "left": {
      // Maintain distance from left edge
      const targetX = parentAfter.x + childLeft;
      return { dx: targetX - childBounds.x, scaleX: 1, originX: childBounds.x };
    }

    case "right": {
      // Maintain distance from right edge
      const targetX = parentAfter.x + newPW - childRight - childW;
      return { dx: targetX - childBounds.x, scaleX: 1, originX: childBounds.x };
    }

    case "leftright": {
      // Maintain both distances → stretches the child
      const targetX = parentAfter.x + childLeft;
      const targetW = newPW - childLeft - childRight;
      const scale = targetW / childW;
      return {
        dx: targetX - childBounds.x,
        scaleX: Math.max(0.01, scale),
        originX: childBounds.x,
      };
    }

    case "center": {
      // Maintain center position proportionally
      const childCenter = childLeft + childW / 2;
      const ratio = oldPW > 0 ? childCenter / oldPW : 0.5;
      const newCenter = ratio * newPW;
      const targetX = parentAfter.x + newCenter - childW / 2;
      return { dx: targetX - childBounds.x, scaleX: 1, originX: childBounds.x };
    }

    case "scale": {
      // Scale proportionally with parent
      const ratio = oldPW > 0 ? newPW / oldPW : 1;
      const relX = childLeft / (oldPW || 1);
      const targetX = parentAfter.x + relX * newPW;
      return {
        dx: targetX - childBounds.x,
        scaleX: Math.max(0.01, ratio),
        originX: parentAfter.x + relX * newPW,
      };
    }

    default:
      return { dx: parentDX, scaleX: 1, originX: childBounds.x };
  }
}

/**
 * Calculate the vertical constraint modifier for a child shape.
 */
function constraintModifierV(
  constraint: VConstraint,
  childBounds: Bounds,
  parentBefore: Bounds,
  parentAfter: Bounds
): { dy: number; scaleY: number; originY: number } {
  const oldPH = parentBefore.height;
  const newPH = parentAfter.height;
  const parentDY = parentAfter.y - parentBefore.y;

  const childTop = childBounds.y - parentBefore.y;
  const childBottom = oldPH - (childTop + childBounds.height);
  const childH = childBounds.height;

  switch (constraint) {
    case "top": {
      const targetY = parentAfter.y + childTop;
      return { dy: targetY - childBounds.y, scaleY: 1, originY: childBounds.y };
    }

    case "bottom": {
      const targetY = parentAfter.y + newPH - childBottom - childH;
      return { dy: targetY - childBounds.y, scaleY: 1, originY: childBounds.y };
    }

    case "topbottom": {
      const targetY = parentAfter.y + childTop;
      const targetH = newPH - childTop - childBottom;
      const scale = targetH / childH;
      return {
        dy: targetY - childBounds.y,
        scaleY: Math.max(0.01, scale),
        originY: childBounds.y,
      };
    }

    case "center": {
      const childCenter = childTop + childH / 2;
      const ratio = oldPH > 0 ? childCenter / oldPH : 0.5;
      const newCenter = ratio * newPH;
      const targetY = parentAfter.y + newCenter - childH / 2;
      return { dy: targetY - childBounds.y, scaleY: 1, originY: childBounds.y };
    }

    case "scale": {
      const ratio = oldPH > 0 ? newPH / oldPH : 1;
      const relY = childTop / (oldPH || 1);
      const targetY = parentAfter.y + relY * newPH;
      return {
        dy: targetY - childBounds.y,
        scaleY: Math.max(0.01, ratio),
        originY: parentAfter.y + relY * newPH,
      };
    }

    default:
      return { dy: parentDY, scaleY: 1, originY: childBounds.y };
  }
}

// ── Shape-level constraint calculation ────────────────────────

export interface ChildConstraintModifiers {
  dx: number;
  dy: number;
  scaleX: number;
  scaleY: number;
  originX: number;
  originY: number;
}

/**
 * Calculate the constraint-based modifiers for a child within its parent.
 *
 * @param parent - The parent shape
 * @param child - The child shape
 * @param childBounds - Current child bounds
 * @param parentBefore - Parent bounds before transformation
 * @param parentAfter - Parent bounds after transformation
 * @param ignoreConstraints - If true, use "scale" for both axes
 */
export function calcChildConstraintModifiers(
  parent: PenpotShape,
  child: PenpotShape,
  childBounds: Bounds,
  parentBefore: Bounds,
  parentAfter: Bounds,
  ignoreConstraints: boolean
): ChildConstraintModifiers {
  // Determine effective constraints
  let hConstraint: HConstraint;
  let vConstraint: VConstraint;

  if (ignoreConstraints) {
    hConstraint = "scale";
    vConstraint = "scale";
  } else if (isLayoutChild(parent, child)) {
    // Children managed by layout get default positioning constraints
    hConstraint = "left";
    vConstraint = "top";
  } else {
    hConstraint = child.constraintsH || defaultConstraintH(parent);
    vConstraint = child.constraintsV || defaultConstraintV(parent);
  }

  // If both are scale, the parent's child transform can pass through directly
  // (handled at a higher level; here we still compute it)

  const h = constraintModifierH(hConstraint, childBounds, parentBefore, parentAfter);
  const v = constraintModifierV(vConstraint, childBounds, parentBefore, parentAfter);

  return {
    dx: h.dx,
    dy: v.dy,
    scaleX: h.scaleX,
    scaleY: v.scaleY,
    originX: h.originX,
    originY: v.originY,
  };
}

/**
 * Check if a child is managed by the parent's layout engine
 * (non-absolute child of a layout container).
 */
function isLayoutChild(parent: PenpotShape, child: PenpotShape): boolean {
  if (!parent.layoutProps?.layout) return false;
  // Absolutely positioned children are NOT managed by layout
  if (child.layoutItemProps?.layoutItemAbsolute) return false;
  return true;
}

/**
 * Check if a shape is absolutely positioned within a layout parent.
 */
export function isAbsolutelyPositioned(child: PenpotShape): boolean {
  return !!child.layoutItemProps?.layoutItemAbsolute;
}

/**
 * Propagate constraint-based modifiers down a shape tree.
 * For each parent in the tree, computes how its children should
 * reposition/resize when the parent changes.
 */
export function propagateConstraints(
  objects: Record<UUID, PenpotShape>,
  boundsMap: Map<UUID, Bounds>,
  modifTree: ModifTree,
  shapeSequence: UUID[],
  ignoreConstraints: boolean
): ModifTree {
  const transformedBounds = new Map(boundsMap);

  for (const parentId of shapeSequence) {
    const parent = objects[parentId];
    if (!parent?.shapes || parent.shapes.length === 0) continue;

    const parentMods = modifTree.get(parentId);
    if (!parentMods) continue;

    // Compute parent bounds before and after
    const parentBefore = transformedBounds.get(parentId) || shapeToBoundsLocal(parent);
    const allOps = [...parentMods.geometryParent, ...parentMods.geometryChild];
    if (allOps.length === 0) continue;

    const parentAfter = applyGeomOps(parentBefore, allOps);

    // Update the transformed bounds for the parent
    transformedBounds.set(parentId, parentAfter);

    // Process each child
    for (const childId of parent.shapes) {
      const child = objects[childId];
      if (!child) continue;

      const childBounds = transformedBounds.get(childId) || shapeToBoundsLocal(child);

      const result = calcChildConstraintModifiers(
        parent,
        child,
        childBounds,
        parentBefore,
        parentAfter,
        ignoreConstraints
      );

      // Add constraint modifiers to the child in modif-tree
      const childMods = getOrCreateModifiers(modifTree, childId);

      if (result.dx !== 0 || result.dy !== 0) {
        childMods.geometryChild.push(moveModifiers(result.dx, result.dy));
      }

      if (result.scaleX !== 1 || result.scaleY !== 1) {
        childMods.geometryChild.push(
          resizeModifiers(result.scaleX, result.scaleY, result.originX, result.originY)
        );
      }

      // Update child's transformed bounds
      const newChildBounds = {
        x: childBounds.x + result.dx,
        y: childBounds.y + result.dy,
        width: childBounds.width * result.scaleX,
        height: childBounds.height * result.scaleY,
      };
      transformedBounds.set(childId, newChildBounds);
    }
  }

  return modifTree;
}

// ── Helpers ───────────────────────────────────────────────────

function shapeToBoundsLocal(shape: PenpotShape): Bounds {
  return { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
}

function applyGeomOps(bounds: Bounds, ops: GeometricOp[]): Bounds {
  const sorted = [...ops].sort((a, b) => a.order - b.order);
  let { x, y, width, height } = bounds;

  for (const op of sorted) {
    switch (op.type) {
      case "move":
        x += op.x;
        y += op.y;
        break;
      case "resize": {
        const newW = width * op.scaleX;
        const newH = height * op.scaleY;
        x = op.originX + (x - op.originX) * op.scaleX;
        y = op.originY + (y - op.originY) * op.scaleY;
        width = Math.max(1, newW);
        height = Math.max(1, newH);
        break;
      }
      case "rotation":
        break;
    }
  }

  return { x, y, width, height };
}
