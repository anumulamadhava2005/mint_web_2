// ═══════════════════════════════════════════════════════════════
// Modifier Pipeline — Full propagation pipeline for shape layout
// Mirrors: common/src/app/common/geom/modifiers.cljc
//   — set-objects-modifiers
// ═══════════════════════════════════════════════════════════════

import type { UUID, PenpotShape } from "../types";
import { ROOT_FRAME_ID } from "../types";
import type { Bounds, ModifTree, Modifiers, StructureOp } from "./modifiers";
import {
  createModifTree,
  shapeToBounds,
  applyModifiersToShape,
  applyGeometricOps,
  mergeModifTrees,
  getOrCreateModifiers,
  addReflow,
  addMoveChild,
  addResizeChild,
  resetOrderCounter,
} from "./modifiers";
import { propagateConstraints, isAbsolutelyPositioned, calcChildConstraintModifiers } from "./constraints";
import { calcFlexLayoutModifiers } from "./flexLayout";
import { calcGridLayoutModifiers } from "./gridLayout";
import { findAutoLayouts, sizingAutoModifiers } from "./autoSizing";
import { resizeGroupParents } from "./groupResize";

// ── Pipeline Parameters ───────────────────────────────────────

export interface PipelineParams {
  ignoreConstraints?: boolean;
  snapPixel?: boolean;
  snapPrecision?: number;
}

// ── Tree Traversal ────────────────────────────────────────────

/**
 * Resolve the shape tree: from a set of changed shape IDs, find the
 * common roots and produce a depth-first traversal sequence.
 *
 * Mirrors: common/src/app/common/geom/shapes/tree_seq.cljc
 */
function resolveTree(
  changedIds: UUID[],
  objects: Record<UUID, PenpotShape>
): UUID[] {
  // Find reflow roots: walk up from each changed shape until hitting
  // a non-layout frame or an auto-sized layout ancestor
  const roots = searchCommonRoots(changedIds, objects);

  // Depth-first traversal from each root
  const sequence: UUID[] = [];
  const visited = new Set<UUID>();

  for (const rootId of roots) {
    depthFirstTraverse(rootId, objects, sequence, visited);
  }

  return sequence;
}

/**
 * Search for common root frames that need recalculation.
 * Walk up from each changed shape, collecting the highest ancestor
 * that is either a non-layout frame or root.
 */
function searchCommonRoots(
  changedIds: UUID[],
  objects: Record<UUID, PenpotShape>
): UUID[] {
  const roots = new Set<UUID>();

  for (const id of changedIds) {
    let current = objects[id];
    let rootCandidate = id;

    while (current?.parentId && current.parentId !== ROOT_FRAME_ID) {
      const parent = objects[current.parentId];
      if (!parent) break;

      // If parent is a layout frame, we need to go higher
      // (because layout changes can propagate upward for auto-sizing)
      if (parent.type === "frame" && parent.layoutProps?.layout) {
        // If parent is auto-sized, include it too
        if (
          parent.layoutItemProps?.layoutItemHSizing === "auto" ||
          parent.layoutItemProps?.layoutItemVSizing === "auto"
        ) {
          rootCandidate = parent.id;
        } else {
          rootCandidate = parent.id;
          break; // Non-auto layout frame → this is our root
        }
      } else if (parent.type === "frame") {
        rootCandidate = parent.id;
        break; // Non-layout frame → this is our root
      } else {
        // Groups pass through
        rootCandidate = parent.id;
      }

      current = parent;
    }

    roots.add(rootCandidate);
  }

  return [...roots];
}

/**
 * Depth-first traversal of the shape tree.
 * Respects reverse order for reversed flex layouts.
 */
function depthFirstTraverse(
  id: UUID,
  objects: Record<UUID, PenpotShape>,
  sequence: UUID[],
  visited: Set<UUID>
): void {
  if (visited.has(id)) return;
  visited.add(id);
  sequence.push(id);

  const shape = objects[id];
  if (!shape?.shapes) return;

  // Determine child order
  let childIds = [...shape.shapes];

  // For reversed flex layouts, reverse the traversal
  const dir = shape.layoutProps?.layoutFlexDir;
  if (dir === "row-reverse" || dir === "column-reverse") {
    childIds = childIds.reverse();
  }

  for (const childId of childIds) {
    depthFirstTraverse(childId, objects, sequence, visited);
  }
}

/**
 * Filter tree sequence to only include layout-relevant shapes
 * (excluding root frames that only have move modifiers).
 */
function resolveLayoutTree(
  modifTree: ModifTree,
  objects: Record<UUID, PenpotShape>
): UUID[] {
  const layoutIds: UUID[] = [];

  for (const [id, mods] of modifTree) {
    const shape = objects[id];
    if (!shape) continue;

    // Include any shape that is a layout container or has structure ops
    if (
      shape.layoutProps?.layout ||
      mods.structureParent.length > 0 ||
      mods.structureChild.length > 0 ||
      shape.type === "group" ||
      shape.type === "bool"
    ) {
      layoutIds.push(id);
    }
  }

  return resolveTree(layoutIds, objects);
}

// ── Bounds Map ────────────────────────────────────────────────

/**
 * Build a bounds map from all objects.
 * Uses lazy evaluation for efficiency — wraps bounds in a getter.
 */
function buildBoundsMap(objects: Record<UUID, PenpotShape>): Map<UUID, Bounds> {
  const boundsMap = new Map<UUID, Bounds>();

  for (const [id, shape] of Object.entries(objects)) {
    boundsMap.set(id, shapeToBounds(shape));
  }

  return boundsMap;
}

/**
 * Update bounds map entries that are affected by modifiers.
 */
function transformBoundsMap(
  boundsMap: Map<UUID, Bounds>,
  objects: Record<UUID, PenpotShape>,
  modifTree: ModifTree
): void {
  for (const [id, mods] of modifTree) {
    const currentBounds = boundsMap.get(id);
    if (!currentBounds) continue;

    const allOps = [...mods.geometryParent, ...mods.geometryChild];
    if (allOps.length === 0) continue;

    const newBounds = applyGeometricOps(currentBounds, allOps);
    boundsMap.set(id, newBounds);
  }
}

// ── Structure Modifier Application ────────────────────────────

/**
 * Apply structure modifiers (add/remove children, reflow) to objects.
 * Returns a new objects map.
 */
function applyStructureModifiers(
  objects: Record<UUID, PenpotShape>,
  modifTree: ModifTree
): Record<UUID, PenpotShape> {
  let result = objects;
  let modified = false;

  for (const [id, mods] of modifTree) {
    const allStructure = [...mods.structureParent, ...mods.structureChild];
    if (allStructure.length === 0) continue;

    for (const op of allStructure) {
      switch (op.type) {
        case "add-children": {
          const parent = result[id];
          if (parent) {
            if (!modified) {
              result = { ...result };
              modified = true;
            }
            const shapes = parent.shapes ? [...parent.shapes] : [];
            const idsToAdd = op.ids.filter((cid) => !shapes.includes(cid));
            if (idsToAdd.length > 0) {
              if (op.index !== undefined) {
                shapes.splice(op.index, 0, ...idsToAdd);
              } else {
                shapes.push(...idsToAdd);
              }
              result[id] = { ...parent, shapes };
            }
          }
          break;
        }

        case "remove-children": {
          const parent = result[id];
          if (parent?.shapes) {
            if (!modified) {
              result = { ...result };
              modified = true;
            }
            const removeSet = new Set(op.ids);
            result[id] = {
              ...parent,
              shapes: parent.shapes.filter((cid) => !removeSet.has(cid)),
            };
          }
          break;
        }

        case "change-property": {
          const shape = result[id];
          if (shape) {
            if (!modified) {
              result = { ...result };
              modified = true;
            }
            result[id] = { ...shape, [op.attr]: op.val };
          }
          break;
        }

        case "reflow":
        case "scale-content":
          // These are handled during the layout pass
          break;
      }
    }
  }

  return result;
}

// ── Layout Propagation ────────────────────────────────────────

/**
 * Propagate layout modifiers (flex/grid) for all layout frames in the tree.
 */
function propagateLayoutModifiers(
  objects: Record<UUID, PenpotShape>,
  boundsMap: Map<UUID, Bounds>,
  shapeSequence: UUID[],
  ignoreConstraints: boolean
): ModifTree {
  const layoutModifTree = createModifTree();

  for (const parentId of shapeSequence) {
    const parent = objects[parentId];
    if (!parent) continue;

    const layoutType = parent.layoutProps?.layout;
    if (!layoutType) continue;

    const parentBounds = boundsMap.get(parentId) || shapeToBounds(parent);

    let childModifs: ModifTree;

    if (layoutType === "flex") {
      childModifs = calcFlexLayoutModifiers(parent, objects, boundsMap, parentBounds);
    } else if (layoutType === "grid") {
      childModifs = calcGridLayoutModifiers(parent, objects, boundsMap, parentBounds);
    } else {
      continue;
    }

    // Merge child modifiers into layout modif tree
    for (const [childId, childMods] of childModifs) {
      const existing = getOrCreateModifiers(layoutModifTree, childId);
      existing.geometryChild.push(...childMods.geometryChild);
      existing.geometryParent.push(...childMods.geometryParent);
    }

    // For absolutely-positioned children in layout frames, apply constraints
    if (parent.shapes) {
      for (const childId of parent.shapes) {
        const child = objects[childId];
        if (!child || !isAbsolutelyPositioned(child)) continue;

        const childBounds = boundsMap.get(childId) || shapeToBounds(child);
        const parentBefore = shapeToBounds(parent);
        // Here parentAfter = current parentBounds (already transformed)
        const result = calcChildConstraintModifiers(
          parent,
          child,
          childBounds,
          parentBefore,
          parentBounds,
          ignoreConstraints
        );

        if (Math.abs(result.dx) > 0.001 || Math.abs(result.dy) > 0.001) {
          addMoveChild(layoutModifTree, childId, result.dx, result.dy);
        }
        if (Math.abs(result.scaleX - 1) > 0.001 || Math.abs(result.scaleY - 1) > 0.001) {
          addResizeChild(layoutModifTree, childId, result.scaleX, result.scaleY, result.originX, result.originY);
        }
      }
    }
  }

  return layoutModifTree;
}

// ── Pixel Snapping ────────────────────────────────────────────

function snapToPixel(value: number, precision: number = 1): number {
  return Math.round(value / precision) * precision;
}

function snapBoundsToPixel(bounds: Bounds, precision: number): Bounds {
  const x = snapToPixel(bounds.x, precision);
  const y = snapToPixel(bounds.y, precision);
  const x2 = snapToPixel(bounds.x + bounds.width, precision);
  const y2 = snapToPixel(bounds.y + bounds.height, precision);
  return { x, y, width: x2 - x, height: y2 - y };
}

// ═══════════════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════════════

/**
 * The full auto-adjustment pipeline — the core algorithm that runs
 * whenever any geometric or structural change occurs.
 *
 * This mirrors `set-objects-modifiers` from Penpot's Clojure codebase.
 *
 * Pipeline steps:
 *   1. Apply structure modifiers (add/remove children, reflow)
 *   2. Build shape traversal sequences
 *   3. Compute initial bounds map
 *   4. Optionally snap to pixel grid
 *   5. Propagate modifiers via CONSTRAINTS (for all shapes)
 *   6. Update bounds after constraint propagation
 *   7. Propagate modifiers via LAYOUTS (flex/grid)
 *   8. Update bounds after layout propagation
 *   9. Auto-sizing pass (hug content)
 *  10. Group/bool auto-resize
 *
 * @param modifTree - Initial modifiers (from user interaction)
 * @param objects - All page objects
 * @param params - Pipeline parameters
 * @returns The final updated objects map with all shapes adjusted
 */
export function setObjectsModifiers(
  modifTree: ModifTree,
  objects: Record<UUID, PenpotShape>,
  params: PipelineParams = {}
): Record<UUID, PenpotShape> {
  const ignoreConstraints = params.ignoreConstraints ?? false;

  // STEP 1: Apply structure modifiers
  let updatedObjects = applyStructureModifiers(objects, modifTree);

  // STEP 2: Build shape traversal sequences
  const changedIds = [...modifTree.keys()];
  const shapesTreeAll = resolveTree(changedIds, updatedObjects);
  const shapesTreeLayout = resolveLayoutTree(modifTree, updatedObjects);

  // STEP 3: Compute initial bounds map
  const boundsMap = buildBoundsMap(updatedObjects);

  // STEP 4: Optionally snap to pixel grid
  // (Applied at the end for cleanliness)

  // STEP 5: Propagate modifiers via CONSTRAINTS
  propagateConstraints(
    updatedObjects,
    boundsMap,
    modifTree,
    shapesTreeAll,
    ignoreConstraints
  );

  // STEP 6: Update bounds after constraint propagation
  transformBoundsMap(boundsMap, updatedObjects, modifTree);

  // STEP 7: Propagate modifiers via LAYOUTS (flex/grid)
  const layoutModifTree = propagateLayoutModifiers(
    updatedObjects,
    boundsMap,
    shapesTreeLayout,
    ignoreConstraints
  );

  // Merge layout modifiers into main tree
  const combinedTree = mergeModifTrees(modifTree, layoutModifTree);

  // STEP 8: Update bounds after layout propagation
  transformBoundsMap(boundsMap, updatedObjects, layoutModifTree);

  // STEP 9: Auto-sizing pass (hug content)
  const autoLayoutIds = findAutoLayouts(updatedObjects, shapesTreeLayout);
  if (autoLayoutIds.length > 0) {
    sizingAutoModifiers(combinedTree, autoLayoutIds, updatedObjects, boundsMap);
  }

  // STEP 10: Group/bool auto-resize
  resizeGroupParents(changedIds, updatedObjects, boundsMap, combinedTree);

  // Apply all modifiers to shapes
  const result = applyAllModifiers(updatedObjects, combinedTree, params);

  return result;
}

/**
 * Apply all computed modifiers to the objects map,
 * producing the final updated shapes.
 */
function applyAllModifiers(
  objects: Record<UUID, PenpotShape>,
  modifTree: ModifTree,
  params: PipelineParams
): Record<UUID, PenpotShape> {
  const result = { ...objects };

  for (const [id, mods] of modifTree) {
    const shape = result[id];
    if (!shape) continue;

    const updates = applyModifiersToShape(shape, mods);

    if (Object.keys(updates).length === 0) continue;

    let updatedShape = { ...shape, ...updates };

    // Snap to pixel grid if requested
    if (params.snapPixel) {
      const precision = params.snapPrecision ?? 1;
      updatedShape.x = snapToPixel(updatedShape.x, precision);
      updatedShape.y = snapToPixel(updatedShape.y, precision);
      updatedShape.width = Math.max(1, snapToPixel(updatedShape.width, precision));
      updatedShape.height = Math.max(1, snapToPixel(updatedShape.height, precision));
    }

    // Update selrect
    updatedShape.selrect = {
      x: updatedShape.x,
      y: updatedShape.y,
      width: updatedShape.width,
      height: updatedShape.height,
      x1: updatedShape.x,
      y1: updatedShape.y,
      x2: updatedShape.x + updatedShape.width,
      y2: updatedShape.y + updatedShape.height,
    };

    result[id] = updatedShape;
  }

  return result;
}

// ── Convenience: Run pipeline for specific change scenarios ───

/**
 * Run the adjustment pipeline when shapes are moved.
 */
export function adjustForMove(
  shapeIds: UUID[],
  dx: number,
  dy: number,
  objects: Record<UUID, PenpotShape>,
  params?: PipelineParams
): Record<UUID, PenpotShape> {
  const modifTree = createModifTree();

  for (const id of shapeIds) {
    addMoveChild(modifTree, id, dx, dy);
  }

  return setObjectsModifiers(modifTree, objects, params);
}

/**
 * Run the adjustment pipeline when shapes are resized.
 */
export function adjustForResize(
  shapeId: UUID,
  scaleX: number,
  scaleY: number,
  originX: number,
  originY: number,
  objects: Record<UUID, PenpotShape>,
  params?: PipelineParams
): Record<UUID, PenpotShape> {
  const modifTree = createModifTree();

  addResizeChild(modifTree, shapeId, scaleX, scaleY, originX, originY);

  return setObjectsModifiers(modifTree, objects, params);
}

/**
 * Run the adjustment pipeline for a reflow (layout recalculation).
 */
export function adjustForReflow(
  parentIds: UUID[],
  objects: Record<UUID, PenpotShape>,
  params?: PipelineParams
): Record<UUID, PenpotShape> {
  const modifTree = createModifTree();

  for (const id of parentIds) {
    addReflow(modifTree, id);
  }

  return setObjectsModifiers(modifTree, objects, params);
}

/**
 * Run the adjustment pipeline after structural changes
 * (add children, remove children, move between parents).
 */
export function adjustForStructure(
  parentIds: UUID[],
  objects: Record<UUID, PenpotShape>,
  params?: PipelineParams
): Record<UUID, PenpotShape> {
  const modifTree = createModifTree();

  for (const id of parentIds) {
    addReflow(modifTree, id);
  }

  return setObjectsModifiers(modifTree, objects, params);
}
