// ═══════════════════════════════════════════════════════════════
// Multi-Selection Transform Solver
//
// When multiple objects are selected in Figma, they behave as a
// temporary virtual group. Transforms (move, scale, rotate) are
// applied to the virtual group's transform, then each child's
// local transform is recalculated to maintain correct positioning.
//
// This enables:
//   - Rotating multiple objects around their shared center
//   - Scaling multiple objects proportionally
//   - Resizing the selection bounds correctly
//
// The math is non-trivial because each child's local transform
// must be recomputed relative to the virtual group.
// ═══════════════════════════════════════════════════════════════

import type { CanvasShape, Vec2, AABB } from "./canvasEngine";
import {
  Matrix3,
  mat3Identity,
  mat3Compose,
  mat3Multiply,
  mat3Inverse,
  mat3Decompose,
  mat3TransformPoint,
  mat3Rotate,
  mat3Scale,
  mat3Translate,
} from "./matrix3";
import type { SceneGraph } from "./sceneGraph";

// ── Virtual Group ─────────────────────────────────────────────

export interface VirtualGroup {
  /** Combined AABB of all selected shapes (world space) */
  bounds: AABB;
  /** Center of the virtual group (world space) */
  center: Vec2;
  /** World transform of the virtual group (initially identity positioned at center) */
  worldTransform: Matrix3;
  /** Map of child id → child's transform relative to virtual group */
  childRelativeTransforms: Map<string, Matrix3>;
  /** Original shapes snapshot (for undo) */
  originalShapes: Map<string, CanvasShape>;
}

/**
 * Multi-Selection Transform Solver.
 * Creates virtual groups and applies transforms to multiple selected objects.
 */
export class MultiSelectionSolver {
  /**
   * Create a virtual group from selected shapes.
   * Captures initial transforms relative to the group center.
   */
  createVirtualGroup(
    selectedIds: Set<string>,
    shapes: CanvasShape[],
    sceneGraph: SceneGraph,
  ): VirtualGroup {
    // 1. Compute combined AABB in world space
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const selectedShapes: CanvasShape[] = [];

    for (const s of shapes) {
      if (!selectedIds.has(s.id)) continue;
      selectedShapes.push(s);
      const wb = sceneGraph.getWorldBounds(s.id);
      if (wb.minX < minX) minX = wb.minX;
      if (wb.minY < minY) minY = wb.minY;
      if (wb.maxX > maxX) maxX = wb.maxX;
      if (wb.maxY > maxY) maxY = wb.maxY;
    }

    const bounds: AABB = { minX, minY, maxX, maxY };
    const center: Vec2 = {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
    };

    // 2. Virtual group transform: place at center (pure translation)
    const groupWorld = mat3Translate(center.x, center.y);
    const groupInverse = mat3Inverse(groupWorld);

    // 3. Compute each child's transform relative to virtual group
    const childRelativeTransforms = new Map<string, Matrix3>();
    const originalShapes = new Map<string, CanvasShape>();

    for (const s of selectedShapes) {
      const childWorld = sceneGraph.getWorldTransform(s.id);
      // relativeTransform = inverse(groupWorld) × childWorld
      const relative = mat3Multiply(groupInverse, childWorld);
      childRelativeTransforms.set(s.id, relative);
      originalShapes.set(s.id, { ...s });
    }

    return {
      bounds,
      center,
      worldTransform: groupWorld,
      childRelativeTransforms,
      originalShapes,
    };
  }

  /**
   * Apply a rotation to the virtual group.
   * Returns updated shapes with recalculated local transforms.
   *
   * @param group     The virtual group
   * @param angle     Rotation angle in radians
   * @param shapes    Current shapes array
   * @param sceneGraph Scene graph for parent lookups
   */
  applyRotation(
    group: VirtualGroup,
    angle: number, // radians, delta from start
    shapes: CanvasShape[],
    sceneGraph: SceneGraph,
  ): CanvasShape[] {
    // New group transform = T(center) × R(angle)
    const cx = group.center.x;
    const cy = group.center.y;
    const newGroupWorld = mat3Multiply(
      mat3Translate(cx, cy),
      mat3Rotate(angle),
    );

    return this.applyGroupTransform(group, newGroupWorld, shapes, sceneGraph);
  }

  /**
   * Apply a scale to the virtual group.
   * Scales from the group center.
   *
   * @param group     The virtual group
   * @param sx        Scale factor X
   * @param sy        Scale factor Y
   * @param shapes    Current shapes array
   * @param sceneGraph Scene graph for parent lookups
   */
  applyScale(
    group: VirtualGroup,
    sx: number,
    sy: number,
    shapes: CanvasShape[],
    sceneGraph: SceneGraph,
  ): CanvasShape[] {
    const cx = group.center.x;
    const cy = group.center.y;
    // T(center) × S(sx,sy)
    const newGroupWorld = mat3Multiply(
      mat3Translate(cx, cy),
      mat3Scale(sx, sy),
    );

    return this.applyGroupTransform(group, newGroupWorld, shapes, sceneGraph);
  }

  /**
   * Apply a translation to the virtual group.
   *
   * @param group     The virtual group
   * @param dx        Delta X in world space
   * @param dy        Delta Y in world space
   * @param shapes    Current shapes array
   * @param sceneGraph Scene graph for parent lookups
   */
  applyTranslation(
    group: VirtualGroup,
    dx: number,
    dy: number,
    shapes: CanvasShape[],
    sceneGraph: SceneGraph,
  ): CanvasShape[] {
    const cx = group.center.x + dx;
    const cy = group.center.y + dy;
    const newGroupWorld = mat3Translate(cx, cy);

    return this.applyGroupTransform(group, newGroupWorld, shapes, sceneGraph);
  }

  /**
   * Apply a combined transform to the virtual group.
   * Each child's new world transform = newGroupWorld × childRelativeTransform
   * Then decompose to get new local coordinates.
   */
  private applyGroupTransform(
    group: VirtualGroup,
    newGroupWorld: Matrix3,
    shapes: CanvasShape[],
    sceneGraph: SceneGraph,
  ): CanvasShape[] {
    const updates = new Map<string, Partial<CanvasShape>>();

    for (const [childId, relativeTransform] of group.childRelativeTransforms) {
      // New child world = newGroupWorld × relativeTransform
      const newChildWorld = mat3Multiply(newGroupWorld, relativeTransform);

      // Get parent's world transform
      const shape = shapes.find(s => s.id === childId);
      if (!shape) continue;

      const parentWorld = shape.parentId
        ? sceneGraph.getWorldTransform(shape.parentId)
        : mat3Identity();

      // New local = inverse(parentWorld) × newChildWorld
      const newLocal = mat3Multiply(mat3Inverse(parentWorld), newChildWorld);

      // Decompose to get position, rotation, scale
      const decomposed = mat3Decompose(newLocal);

      updates.set(childId, {
        x: decomposed.tx,
        y: decomposed.ty,
        rotation: (decomposed.rotation * 180) / Math.PI,
        scaleX: decomposed.scaleX,
        scaleY: decomposed.scaleY,
      });
    }

    return shapes.map(s => {
      const update = updates.get(s.id);
      return update ? { ...s, ...update } : s;
    });
  }

  /**
   * Get the combined selection bounds in world space.
   */
  getSelectionBounds(
    selectedIds: Set<string>,
    sceneGraph: SceneGraph,
  ): AABB | null {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let found = false;

    for (const id of selectedIds) {
      const wb = sceneGraph.getWorldBounds(id);
      if (!wb) continue;
      found = true;
      if (wb.minX < minX) minX = wb.minX;
      if (wb.minY < minY) minY = wb.minY;
      if (wb.maxX > maxX) maxX = wb.maxX;
      if (wb.maxY > maxY) maxY = wb.maxY;
    }

    return found ? { minX, minY, maxX, maxY } : null;
  }
}
