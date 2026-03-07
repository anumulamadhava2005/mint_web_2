// ═══════════════════════════════════════════════════════════════
// Auto-Sizing Pass — Hug Content / Auto-Size for layout frames
// Mirrors: common/src/app/common/geom/modifiers.cljc
//   — calc-auto-modifiers, sizing-auto-modifiers
// ═══════════════════════════════════════════════════════════════

import type { UUID, PenpotShape } from "../types";
import type { Bounds, ModifTree } from "./modifiers";
import { getOrCreateModifiers, resizeModifiers, applyGeometricOps, shapeToBounds } from "./modifiers";
import { flexLayoutContentBounds } from "./flexLayout";
import { gridLayoutContentBounds } from "./gridLayout";

// ── Auto Layout Detection ─────────────────────────────────────

/**
 * Determine if a shape is an auto-sized layout frame on a given axis.
 */
export function isAutoWidth(shape: PenpotShape): boolean {
  return shape.layoutItemProps?.layoutItemHSizing === "auto" || false;
}

export function isAutoHeight(shape: PenpotShape): boolean {
  return shape.layoutItemProps?.layoutItemVSizing === "auto" || false;
}

export function isLayoutFrame(shape: PenpotShape): boolean {
  return shape.type === "frame" && !!shape.layoutProps?.layout;
}

/**
 * Find all auto-sized layout frames in a shape tree sequence.
 * Returns them ordered bottom-up (innermost first) for correct processing.
 */
export function findAutoLayouts(
  objects: Record<UUID, PenpotShape>,
  shapeSequence: UUID[]
): UUID[] {
  const autoIds: UUID[] = [];

  for (const id of shapeSequence) {
    const shape = objects[id];
    if (!shape) continue;
    if (!isLayoutFrame(shape)) continue;
    if (!isAutoWidth(shape) && !isAutoHeight(shape)) continue;
    autoIds.push(id);
  }

  // Sort by depth (deepest first) for bottom-up processing
  const depthCache = new Map<UUID, number>();
  function getDepth(id: UUID): number {
    if (depthCache.has(id)) return depthCache.get(id)!;
    const shape = objects[id];
    if (!shape?.parentId) {
      depthCache.set(id, 0);
      return 0;
    }
    const d = 1 + getDepth(shape.parentId);
    depthCache.set(id, d);
    return d;
  }

  autoIds.sort((a, b) => getDepth(b) - getDepth(a));

  return autoIds;
}

// ── Auto-Size Modifier Calculation ────────────────────────────

/**
 * Calculate resize modifiers for a single auto-sized layout frame.
 *
 * @param parent - The auto-sized frame
 * @param objects - All page objects
 * @param boundsMap - Current bounds of all shapes
 * @returns Object with resize modifiers, or null if no resize needed
 */
export function calcAutoModifiers(
  parent: PenpotShape,
  objects: Record<UUID, PenpotShape>,
  boundsMap: Map<UUID, Bounds>
): { scaleX: number; scaleY: number; originX: number; originY: number } | null {
  const parentBounds = boundsMap.get(parent.id) || shapeToBounds(parent);

  const autoW = isAutoWidth(parent);
  const autoH = isAutoHeight(parent);

  if (!autoW && !autoH) return null;

  // Calculate content bounds based on layout type
  let contentBounds: Bounds;

  const layoutType = parent.layoutProps?.layout;
  if (layoutType === "flex") {
    contentBounds = flexLayoutContentBounds(parent, objects, boundsMap, parentBounds);
  } else if (layoutType === "grid") {
    contentBounds = gridLayoutContentBounds(parent, objects, boundsMap, parentBounds);
  } else {
    return null; // Only layout frames auto-size
  }

  let scaleX = 1;
  let scaleY = 1;
  let changed = false;

  if (autoW && contentBounds.width > 0 && parentBounds.width > 0) {
    scaleX = contentBounds.width / parentBounds.width;
    if (Math.abs(scaleX - 1) > 0.001) changed = true;
  }

  if (autoH && contentBounds.height > 0 && parentBounds.height > 0) {
    scaleY = contentBounds.height / parentBounds.height;
    if (Math.abs(scaleY - 1) > 0.001) changed = true;
  }

  if (!changed) return null;

  return {
    scaleX,
    scaleY,
    originX: parentBounds.x,
    originY: parentBounds.y,
  };
}

/**
 * Run the full auto-sizing pass over all auto-sized layouts.
 *
 * Processes bottom-up (innermost first). After resizing each frame,
 * updates the bounds map so parent frames see the correct child sizes.
 *
 * @param modifTree - The modifier tree to extend
 * @param autoLayoutIds - Auto-sized layout frame IDs (bottom-up order)
 * @param objects - All page objects
 * @param boundsMap - Mutable bounds map (updated in place)
 * @returns Modified modifTree with auto-resize modifiers
 */
export function sizingAutoModifiers(
  modifTree: ModifTree,
  autoLayoutIds: UUID[],
  objects: Record<UUID, PenpotShape>,
  boundsMap: Map<UUID, Bounds>
): ModifTree {
  for (const parentId of autoLayoutIds) {
    const parent = objects[parentId];
    if (!parent) continue;

    const result = calcAutoModifiers(parent, objects, boundsMap);
    if (!result) continue;

    // Add resize modifier to the parent (geometry-parent, not recursive)
    const mods = getOrCreateModifiers(modifTree, parentId);
    const resizeOp = resizeModifiers(result.scaleX, result.scaleY, result.originX, result.originY);
    mods.geometryParent.push(resizeOp);

    // Update bounds map for this parent
    const currentBounds = boundsMap.get(parentId) || shapeToBounds(parent);
    const newBounds = applyGeometricOps(currentBounds, [resizeOp]);
    boundsMap.set(parentId, newBounds);
  }

  return modifTree;
}
