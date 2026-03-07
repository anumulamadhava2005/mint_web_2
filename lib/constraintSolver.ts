// ═══════════════════════════════════════════════════════════════
// Constraint Solver — Figma-style constraint system
//
// Constraints define how children reposition when their parent
// frame is resized. This runs BEFORE transform propagation.
//
// Pipeline:
//   Parent resize detected
//       ↓
//   For each child with constraints:
//       ↓
//   Solve horizontal constraint (LEFT/RIGHT/CENTER/STRETCH/SCALE)
//       ↓
//   Solve vertical constraint (TOP/BOTTOM/CENTER/STRETCH/SCALE)
//       ↓
//   Write new x, y, width, height to child
//       ↓
//   Continue to transform propagation
// ═══════════════════════════════════════════════════════════════

import type {
  CanvasShape,
  HorizontalConstraint,
  VerticalConstraint,
  Constraints,
} from "./canvasEngine";

/** Offsets captured when a constraint is first applied */
export interface ConstraintOffsets {
  left: number;      // distance from child left edge to parent left edge
  right: number;     // distance from child right edge to parent right edge
  top: number;       // distance from child top edge to parent top edge
  bottom: number;    // distance from child bottom edge to parent bottom edge
  /** Proportional position (0..1) for SCALE mode */
  proportionalX: number;
  proportionalY: number;
  proportionalW: number;
  proportionalH: number;
}

/**
 * Compute the constraint offsets for a child within its parent.
 * Call this when:
 *  - A child is first placed in a frame
 *  - A child is manually repositioned
 *  - Constraints are changed
 */
export function computeConstraintOffsets(
  child: CanvasShape,
  parentWidth: number,
  parentHeight: number,
): ConstraintOffsets {
  return {
    left: child.x,
    right: parentWidth - (child.x + child.width),
    top: child.y,
    bottom: parentHeight - (child.y + child.height),
    proportionalX: parentWidth > 0 ? child.x / parentWidth : 0,
    proportionalY: parentHeight > 0 ? child.y / parentHeight : 0,
    proportionalW: parentWidth > 0 ? child.width / parentWidth : 0,
    proportionalH: parentHeight > 0 ? child.height / parentHeight : 0,
  };
}

/**
 * The Constraint Solver processes parent resize events and
 * repositions/resizes children according to their constraints.
 */
export class ConstraintSolver {
  /**
   * Solve constraints for all children of a resized parent.
   *
   * @param parent        The parent frame after resize
   * @param oldWidth      Parent width before resize
   * @param oldHeight     Parent height before resize
   * @param children      Children to reposition
   * @param shapeLookup   Full shape lookup for nested resolution
   * @returns             Updated children with new positions/sizes
   */
  solve(
    parent: CanvasShape,
    oldWidth: number,
    oldHeight: number,
    children: CanvasShape[],
    shapeLookup: Map<string, CanvasShape>,
  ): CanvasShape[] {
    const newWidth = parent.width;
    const newHeight = parent.height;

    // No change — skip
    if (newWidth === oldWidth && newHeight === oldHeight) {
      return children;
    }

    return children.map(child => {
      if (child.parentId !== parent.id) return child;

      // Skip auto-layout positioned children — layout engine handles them
      if (child.layoutPositioned) return child;

      const offsets = child.constraintOffsets
        ? {
            left: child.constraintOffsets.left,
            right: child.constraintOffsets.right,
            top: child.constraintOffsets.top,
            bottom: child.constraintOffsets.bottom,
            proportionalX: oldWidth > 0 ? child.x / oldWidth : 0,
            proportionalY: oldHeight > 0 ? child.y / oldHeight : 0,
            proportionalW: oldWidth > 0 ? child.width / oldWidth : 0,
            proportionalH: oldHeight > 0 ? child.height / oldHeight : 0,
          }
        : computeConstraintOffsets(child, oldWidth, oldHeight);

      const constraints = child.constraints || { horizontal: "LEFT" as HorizontalConstraint, vertical: "TOP" as VerticalConstraint };

      // Solve horizontal
      const h = this.solveHorizontal(
        constraints.horizontal,
        offsets,
        child,
        oldWidth,
        newWidth,
      );

      // Solve vertical
      const v = this.solveVertical(
        constraints.vertical,
        offsets,
        child,
        oldHeight,
        newHeight,
      );

      return {
        ...child,
        x: h.x,
        width: h.width,
        y: v.y,
        height: v.height,
        // Update stored offsets for next resize
        constraintOffsets: {
          left: h.x,
          right: newWidth - (h.x + h.width),
          top: v.y,
          bottom: newHeight - (v.y + v.height),
        },
      };
    });
  }

  private solveHorizontal(
    constraint: HorizontalConstraint,
    offsets: ConstraintOffsets,
    child: CanvasShape,
    oldParentW: number,
    newParentW: number,
  ): { x: number; width: number } {
    switch (constraint) {
      case "LEFT":
        // Fixed distance from left edge, width unchanged
        return { x: offsets.left, width: child.width };

      case "RIGHT":
        // Fixed distance from right edge, width unchanged
        return {
          x: newParentW - offsets.right - child.width,
          width: child.width,
        };

      case "CENTER": {
        // Center position proportional to parent width
        const oldCenter = offsets.left + child.width / 2;
        const ratio = oldParentW > 0 ? oldCenter / oldParentW : 0.5;
        const newCenter = ratio * newParentW;
        return {
          x: newCenter - child.width / 2,
          width: child.width,
        };
      }

      case "STRETCH":
        // Fixed distance from both edges, width changes
        return {
          x: offsets.left,
          width: Math.max(1, newParentW - offsets.left - offsets.right),
        };

      case "SCALE": {
        // Position and size scale proportionally
        const x = offsets.proportionalX * newParentW;
        const w = offsets.proportionalW * newParentW;
        return { x, width: Math.max(1, w) };
      }

      default:
        return { x: child.x, width: child.width };
    }
  }

  private solveVertical(
    constraint: VerticalConstraint,
    offsets: ConstraintOffsets,
    child: CanvasShape,
    oldParentH: number,
    newParentH: number,
  ): { y: number; height: number } {
    switch (constraint) {
      case "TOP":
        return { y: offsets.top, height: child.height };

      case "BOTTOM":
        return {
          y: newParentH - offsets.bottom - child.height,
          height: child.height,
        };

      case "CENTER": {
        const oldCenter = offsets.top + child.height / 2;
        const ratio = oldParentH > 0 ? oldCenter / oldParentH : 0.5;
        const newCenter = ratio * newParentH;
        return {
          y: newCenter - child.height / 2,
          height: child.height,
        };
      }

      case "STRETCH":
        return {
          y: offsets.top,
          height: Math.max(1, newParentH - offsets.top - offsets.bottom),
        };

      case "SCALE": {
        const y = offsets.proportionalY * newParentH;
        const h = offsets.proportionalH * newParentH;
        return { y, height: Math.max(1, h) };
      }

      default:
        return { y: child.y, height: child.height };
    }
  }

  /**
   * Batch solve: process a full shapes array when a parent resizes.
   * Returns new shapes array with children updated.
   */
  solveForResize(
    parentId: string,
    oldWidth: number,
    oldHeight: number,
    shapes: CanvasShape[],
  ): CanvasShape[] {
    const lookup = new Map<string, CanvasShape>();
    for (const s of shapes) lookup.set(s.id, s);

    const parent = lookup.get(parentId);
    if (!parent) return shapes;

    const children = shapes.filter(s => s.parentId === parentId);
    const updated = this.solve(parent, oldWidth, oldHeight, children, lookup);
    const updatedMap = new Map(updated.map(u => [u.id, u]));

    return shapes.map(s => updatedMap.get(s.id) ?? s);
  }
}
