// ═══════════════════════════════════════════════════════════════
// Group Auto-Resize — Groups & bools resize to wrap children
// Mirrors: common/src/app/common/files/changes_builder.cljc
//   — resize-parents
// ═══════════════════════════════════════════════════════════════

import type { UUID, PenpotShape, Rect } from "../types";
import type { Bounds, ModifTree } from "./modifiers";
import { getOrCreateModifiers, resizeModifiers, moveModifiers, shapeToBounds } from "./modifiers";

/**
 * Calculate group/bool auto-resize modifiers.
 * Groups always resize their bounding box to tightly wrap their children.
 *
 * @param parent - A group or bool shape
 * @param objects - All page objects
 * @param boundsMap - Current bounds of all shapes
 * @returns Object with the resize and move modifiers, or null if unchanged
 */
export function calcGroupResizeModifiers(
  parent: PenpotShape,
  objects: Record<UUID, PenpotShape>,
  boundsMap: Map<UUID, Bounds>
): { dx: number; dy: number; scaleX: number; scaleY: number } | null {
  if (parent.type !== "group" && parent.type !== "bool") return null;

  const childIds = parent.shapes || [];
  if (childIds.length === 0) return null;

  // Compute bounding box of all children
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const childId of childIds) {
    const child = objects[childId];
    if (!child || child.hidden) continue;

    const cb = boundsMap.get(childId) || shapeToBounds(child);
    minX = Math.min(minX, cb.x);
    minY = Math.min(minY, cb.y);
    maxX = Math.max(maxX, cb.x + cb.width);
    maxY = Math.max(maxY, cb.y + cb.height);
  }

  if (!isFinite(minX)) return null;

  const parentBounds = boundsMap.get(parent.id) || shapeToBounds(parent);

  const newWidth = maxX - minX;
  const newHeight = maxY - minY;

  const dx = minX - parentBounds.x;
  const dy = minY - parentBounds.y;
  const scaleX = parentBounds.width > 0 ? newWidth / parentBounds.width : 1;
  const scaleY = parentBounds.height > 0 ? newHeight / parentBounds.height : 1;

  const movedOrScaled =
    Math.abs(dx) > 0.001 ||
    Math.abs(dy) > 0.001 ||
    Math.abs(scaleX - 1) > 0.001 ||
    Math.abs(scaleY - 1) > 0.001;

  if (!movedOrScaled) return null;

  return { dx, dy, scaleX, scaleY };
}

/**
 * Apply group/bool auto-resize for all affected parent groups in the tree.
 * Processes leaf-to-root (bottom-up).
 *
 * @param changedIds - IDs of shapes that changed
 * @param objects - All page objects
 * @param boundsMap - Mutable bounds map
 * @param modifTree - The modifier tree to extend
 */
export function resizeGroupParents(
  changedIds: UUID[],
  objects: Record<UUID, PenpotShape>,
  boundsMap: Map<UUID, Bounds>,
  modifTree: ModifTree
): void {
  // Collect all group/bool ancestors of changed shapes
  const groupParents = new Set<UUID>();
  const visited = new Set<UUID>();

  for (const id of changedIds) {
    let current = objects[id];
    while (current?.parentId) {
      if (visited.has(current.parentId)) break;
      visited.add(current.parentId);

      const parent = objects[current.parentId];
      if (!parent) break;

      if (parent.type === "group" || parent.type === "bool") {
        groupParents.add(parent.id);
      }

      current = parent;
    }
  }

  if (groupParents.size === 0) return;

  // Sort by depth (deepest first) for bottom-up
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

  const sortedParents = [...groupParents].sort((a, b) => getDepth(b) - getDepth(a));

  for (const parentId of sortedParents) {
    const parent = objects[parentId];
    if (!parent) continue;

    const result = calcGroupResizeModifiers(parent, objects, boundsMap);
    if (!result) continue;

    const mods = getOrCreateModifiers(modifTree, parentId);

    // Move the group origin to match children's origin
    if (Math.abs(result.dx) > 0.001 || Math.abs(result.dy) > 0.001) {
      mods.geometryParent.push(moveModifiers(result.dx, result.dy));
    }

    // Resize the group to match children's bounds
    if (Math.abs(result.scaleX - 1) > 0.001 || Math.abs(result.scaleY - 1) > 0.001) {
      const pb = boundsMap.get(parentId) || shapeToBounds(parent);
      mods.geometryParent.push(
        resizeModifiers(result.scaleX, result.scaleY, pb.x + result.dx, pb.y + result.dy)
      );
    }

    // Update bounds map
    const pb = boundsMap.get(parentId) || shapeToBounds(parent);
    const childBounds = calcChildrenBounds(parent, objects, boundsMap);
    if (childBounds) {
      boundsMap.set(parentId, childBounds);
    }
  }
}

/**
 * Calculate the bounding box of a group's children.
 */
function calcChildrenBounds(
  parent: PenpotShape,
  objects: Record<UUID, PenpotShape>,
  boundsMap: Map<UUID, Bounds>
): Bounds | null {
  const childIds = parent.shapes || [];
  if (childIds.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const childId of childIds) {
    const child = objects[childId];
    if (!child || child.hidden) continue;

    const cb = boundsMap.get(childId) || shapeToBounds(child);
    minX = Math.min(minX, cb.x);
    minY = Math.min(minY, cb.y);
    maxX = Math.max(maxX, cb.x + cb.width);
    maxY = Math.max(maxY, cb.y + cb.height);
  }

  if (!isFinite(minX)) return null;

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
