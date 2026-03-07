// ═══════════════════════════════════════════════════════════════
// Penpot Snap Engine — Edge / Centre / Grid / Spacing snapping
//
// Works directly with the flat PenpotShape objects map, no
// external spatial-index dependency needed — the object count
// per page is small enough for brute-force within 1 ms budgets.
//
// ── Snap pipeline (runs every pointer-move during drag/resize):
//   1. Build snap-point set from *all visible* sibling shapes
//      (edges left / right / top / bottom + centre x / y).
//   2. Compute the current AABB of the selection being moved.
//   3. For each axis, find the closest snap-point within the
//      screen-space threshold.
//   4. Optionally compute equal-spacing snap between three or
//      more collinear objects.
//   5. Return { adjustedDx, adjustedDy, guides[] }.
//
// Guide objects are consumed by the viewport layer to render
// the magenta/cyan alignment lines.
// ═══════════════════════════════════════════════════════════════

import type { UUID, PenpotShape, Point } from "./types";
import { ROOT_FRAME_ID } from "./types";

// ── Public types ──────────────────────────────────────────────

/** A single visual guide line rendered on the canvas. */
export interface SnapGuide {
  axis: "x" | "y";
  /** World-space position of the guide line */
  position: number;
  /** Endpoints for rendering */
  start: Point;
  end: Point;
  /** Origin of the snap */
  kind: "edge" | "center" | "spacing" | "grid";
}

/** Result returned by the snap engine every pointer-move. */
export interface SnapResult {
  /** Delta correction to add to the raw dx/dy */
  snapDx: number;
  snapDy: number;
  /** Guide lines to render */
  guides: SnapGuide[];
}

// ── Internal helpers ──────────────────────────────────────────

interface SnapCandidate {
  axis: "x" | "y";
  /** The snap-target value (world) */
  target: number;
  /** The moving-object value that matched (world) */
  source: number;
  /** Absolute distance */
  distance: number;
  /** Visual guide for this candidate */
  guide: SnapGuide;
}

/** Simple AABB derived from PenpotShape fields. */
interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function shapeBounds(s: PenpotShape): AABB {
  return {
    minX: s.x,
    minY: s.y,
    maxX: s.x + s.width,
    maxY: s.y + s.height,
  };
}

function combinedBounds(shapes: PenpotShape[]): AABB {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const s of shapes) {
    if (s.x < minX) minX = s.x;
    if (s.y < minY) minY = s.y;
    if (s.x + s.width > maxX) maxX = s.x + s.width;
    if (s.y + s.height > maxY) maxY = s.y + s.height;
  }
  return { minX, minY, maxX, maxY };
}

// ── Configuration ─────────────────────────────────────────────

/** Default screen-space threshold in CSS pixels. */
const DEFAULT_THRESHOLD = 6;

const GUIDE_EXTENSION = 40; // extra world-units a guide extends past the shapes

// ── Snap Engine ───────────────────────────────────────────────

export interface SnapOptions {
  /** Enable snapping to other objects' edges & centres (default: true) */
  objectSnap?: boolean;
  /** Enable grid snapping (default: false) */
  gridSnap?: boolean;
  /** Grid cell size in world units (default: 10) */
  gridSize?: number;
  /** Screen-space pixel threshold (default: 6) */
  threshold?: number;
}

/**
 * Compute snap adjustment for a *move* operation.
 *
 * @param selectedIds   IDs of shapes being moved
 * @param rawDx         Raw delta X from the pointer (world space)
 * @param rawDy         Raw delta Y from the pointer (world space)
 * @param objects       The full page objects map
 * @param zoom          Current viewport zoom level
 * @param opts          Optional overrides
 */
export function snapMove(
  selectedIds: Set<UUID>,
  rawDx: number,
  rawDy: number,
  objects: Record<UUID, PenpotShape>,
  zoom: number,
  opts: SnapOptions = {},
): SnapResult {
  const threshold = (opts.threshold ?? DEFAULT_THRESHOLD) / zoom;
  const objectSnap = opts.objectSnap ?? true;
  const gridSnap = opts.gridSnap ?? false;
  const gridSize = opts.gridSize ?? 10;

  // 1. Compute the *proposed* AABB of the selection after applying rawDx/rawDy
  const selectedShapes = [...selectedIds]
    .map((id) => objects[id])
    .filter(Boolean) as PenpotShape[];
  if (selectedShapes.length === 0) return { snapDx: 0, snapDy: 0, guides: [] };

  const origBounds = combinedBounds(selectedShapes);
  const proposed: AABB = {
    minX: origBounds.minX + rawDx,
    minY: origBounds.minY + rawDy,
    maxX: origBounds.maxX + rawDx,
    maxY: origBounds.maxY + rawDy,
  };

  const candidates = collectMoveCandidates(
    proposed,
    selectedIds,
    objects,
    threshold,
    objectSnap,
    gridSnap,
    gridSize,
  );

  return resolveSnap(proposed, rawDx, rawDy, candidates, threshold);
}

/**
 * Compute snap adjustment for a *resize* operation.
 *
 * Only the edges corresponding to the active handle are snapped.
 *
 * @param handle        E.g. "top-left", "right", "bottom-right"
 * @param selectedIds   IDs of shapes being resized
 * @param rawDx         Raw world-space delta X
 * @param rawDy         Raw world-space delta Y
 * @param origShapes    Original shapes before resize started
 * @param objects       Current page objects
 * @param zoom          Current zoom
 * @param opts          Snap options
 */
export function snapResize(
  handle: string,
  selectedIds: Set<UUID>,
  rawDx: number,
  rawDy: number,
  origShapes: Record<UUID, { x: number; y: number; width: number; height: number }>,
  objects: Record<UUID, PenpotShape>,
  zoom: number,
  opts: SnapOptions = {},
): SnapResult {
  const threshold = (opts.threshold ?? DEFAULT_THRESHOLD) / zoom;
  const objectSnap = opts.objectSnap ?? true;
  const gridSnap = opts.gridSnap ?? false;
  const gridSize = opts.gridSize ?? 10;

  // Compute combined original AABB
  const origShapeList = Object.values(origShapes);
  if (origShapeList.length === 0) return { snapDx: 0, snapDy: 0, guides: [] };

  let oMinX = Infinity,
    oMinY = Infinity,
    oMaxX = -Infinity,
    oMaxY = -Infinity;
  for (const s of origShapeList) {
    if (s.x < oMinX) oMinX = s.x;
    if (s.y < oMinY) oMinY = s.y;
    if (s.x + s.width > oMaxX) oMaxX = s.x + s.width;
    if (s.y + s.height > oMaxY) oMaxY = s.y + s.height;
  }

  // Compute the *proposed* position of the dragged edge(s)
  const candidates: SnapCandidate[] = [];

  const hasLeft = handle.includes("left");
  const hasRight = handle.includes("right");
  const hasTop = handle.includes("top");
  const hasBottom = handle.includes("bottom");

  // The snapping only targets the edge(s) being dragged
  const draggedEdgeX = hasRight
    ? oMaxX + rawDx
    : hasLeft
      ? oMinX + rawDx
      : undefined;
  const draggedEdgeY = hasBottom
    ? oMaxY + rawDy
    : hasTop
      ? oMinY + rawDy
      : undefined;

  if (objectSnap) {
    // Collect snap targets from non-selected shapes
    const excludeAll = expandDescendants(selectedIds, objects);
    for (const [id, shape] of Object.entries(objects)) {
      if (excludeAll.has(id as UUID)) continue;
      if (id === ROOT_FRAME_ID) continue;
      if (shape.hidden || shape.locked) continue;

      const tb = shapeBounds(shape);

      if (draggedEdgeX !== undefined) {
        // Snap dragged edge X against target edges
        trySnapX(candidates, draggedEdgeX, tb.minX, "edge", threshold, oMinY, oMaxY, tb);
        trySnapX(candidates, draggedEdgeX, tb.maxX, "edge", threshold, oMinY, oMaxY, tb);
        trySnapX(candidates, draggedEdgeX, (tb.minX + tb.maxX) / 2, "center", threshold, oMinY, oMaxY, tb);
      }

      if (draggedEdgeY !== undefined) {
        trySnapY(candidates, draggedEdgeY, tb.minY, "edge", threshold, oMinX, oMaxX, tb);
        trySnapY(candidates, draggedEdgeY, tb.maxY, "edge", threshold, oMinX, oMaxX, tb);
        trySnapY(candidates, draggedEdgeY, (tb.minY + tb.maxY) / 2, "center", threshold, oMinX, oMaxX, tb);
      }
    }
  }

  if (gridSnap && gridSize > 0) {
    if (draggedEdgeX !== undefined) {
      const gx = Math.round(draggedEdgeX / gridSize) * gridSize;
      const dist = Math.abs(draggedEdgeX - gx);
      if (dist <= threshold) {
        candidates.push({
          axis: "x",
          target: gx,
          source: draggedEdgeX,
          distance: dist,
          guide: {
            axis: "x",
            position: gx,
            start: { x: gx, y: oMinY - GUIDE_EXTENSION },
            end: { x: gx, y: oMaxY + GUIDE_EXTENSION },
            kind: "grid",
          },
        });
      }
    }
    if (draggedEdgeY !== undefined) {
      const gy = Math.round(draggedEdgeY / gridSize) * gridSize;
      const dist = Math.abs(draggedEdgeY - gy);
      if (dist <= threshold) {
        candidates.push({
          axis: "y",
          target: gy,
          source: draggedEdgeY,
          distance: dist,
          guide: {
            axis: "y",
            position: gy,
            start: { x: oMinX - GUIDE_EXTENSION, y: gy },
            end: { x: oMaxX + GUIDE_EXTENSION, y: gy },
            kind: "grid",
          },
        });
      }
    }
  }

  // Resolve best per axis
  let bestX: SnapCandidate | null = null;
  let bestY: SnapCandidate | null = null;
  for (const c of candidates) {
    if (c.axis === "x") {
      if (!bestX || c.distance < bestX.distance) bestX = c;
    } else {
      if (!bestY || c.distance < bestY.distance) bestY = c;
    }
  }

  let snapDx = 0;
  let snapDy = 0;
  const guides: SnapGuide[] = [];

  if (bestX) {
    snapDx = bestX.target - bestX.source;
    guides.push(bestX.guide);
  }
  if (bestY) {
    snapDy = bestY.target - bestY.source;
    guides.push(bestY.guide);
  }

  return { snapDx, snapDy, guides };
}

// ── Equal-spacing snap ────────────────────────────────────────

/**
 * Detects when a dragged selection would create equal spacing
 * between three or more objects along an axis.
 *
 * Returns additional guides & delta correction if a match is found.
 */
export function snapSpacing(
  proposedBounds: AABB,
  selectedIds: Set<UUID>,
  objects: Record<UUID, PenpotShape>,
  zoom: number,
  opts: SnapOptions = {},
): { snapDx: number; snapDy: number; guides: SnapGuide[] } {
  const threshold = (opts.threshold ?? DEFAULT_THRESHOLD) / zoom;
  const excludeAll = expandDescendants(selectedIds, objects);
  const result = { snapDx: 0, snapDy: 0, guides: [] as SnapGuide[] };

  // Collect non-excluded shapes that are close to the proposed bounds
  const nearby: AABB[] = [];
  const expansion = (proposedBounds.maxX - proposedBounds.minX + proposedBounds.maxY - proposedBounds.minY) * 2;
  for (const [id, shape] of Object.entries(objects)) {
    if (excludeAll.has(id as UUID) || id === ROOT_FRAME_ID) continue;
    if (shape.hidden || shape.locked) continue;
    const b = shapeBounds(shape);
    // Only consider shapes within a reasonable distance
    if (
      b.maxX < proposedBounds.minX - expansion ||
      b.minX > proposedBounds.maxX + expansion ||
      b.maxY < proposedBounds.minY - expansion ||
      b.minY > proposedBounds.maxY + expansion
    ) continue;
    nearby.push(b);
  }

  if (nearby.length < 2) return result;

  // Try X-axis spacing
  const spacingX = trySpacingSnap(proposedBounds, nearby, "x", threshold);
  if (spacingX) {
    result.snapDx = spacingX.delta;
    result.guides.push(...spacingX.guides);
  }

  // Try Y-axis spacing
  const spacingY = trySpacingSnap(proposedBounds, nearby, "y", threshold);
  if (spacingY) {
    result.snapDy = spacingY.delta;
    result.guides.push(...spacingY.guides);
  }

  return result;
}

function trySpacingSnap(
  proposed: AABB,
  nearby: AABB[],
  axis: "x" | "y",
  threshold: number,
): { delta: number; guides: SnapGuide[] } | null {
  const lo = axis === "x" ? "minX" : "minY";
  const hi = axis === "x" ? "maxX" : "maxY";
  const oLo = axis === "x" ? "minY" : "minX";
  const oHi = axis === "x" ? "maxY" : "maxX";

  // Sort nearby shapes by their lo edge
  const sorted = [...nearby].sort((a, b) => a[lo] - b[lo]);

  // For each pair of consecutive nearby shapes, check if the drag
  // object placed at the same gap distance would be within threshold
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const gap = b[lo] - a[hi];
    if (gap <= 0) continue; // overlapping

    const dragSize = proposed[hi] - proposed[lo];

    // Option 1: place *before* shape a at the same gap
    const beforePos = a[lo] - gap - dragSize;
    const beforeDist = Math.abs(proposed[lo] - beforePos);
    if (beforeDist <= threshold) {
      const delta = beforePos - proposed[lo];
      const perpMid = (proposed[oLo] + proposed[oHi]) / 2;
      const guides: SnapGuide[] = [
        {
          axis,
          position: beforePos + dragSize,
          kind: "spacing",
          start:
            axis === "x"
              ? { x: beforePos + dragSize, y: perpMid - 10 }
              : { x: perpMid - 10, y: beforePos + dragSize },
          end:
            axis === "x"
              ? { x: a[lo], y: perpMid - 10 }
              : { x: perpMid - 10, y: a[lo] },
        },
        {
          axis,
          position: a[hi],
          kind: "spacing",
          start:
            axis === "x"
              ? { x: a[hi], y: perpMid - 10 }
              : { x: perpMid - 10, y: a[hi] },
          end:
            axis === "x"
              ? { x: b[lo], y: perpMid - 10 }
              : { x: perpMid - 10, y: b[lo] },
        },
      ];
      return { delta, guides };
    }

    // Option 2: place *after* shape b at the same gap
    const afterPos = b[hi] + gap;
    const afterDist = Math.abs(proposed[lo] - afterPos);
    if (afterDist <= threshold) {
      const delta = afterPos - proposed[lo];
      const perpMid = (proposed[oLo] + proposed[oHi]) / 2;
      const guides: SnapGuide[] = [
        {
          axis,
          position: a[hi],
          kind: "spacing",
          start:
            axis === "x"
              ? { x: a[hi], y: perpMid - 10 }
              : { x: perpMid - 10, y: a[hi] },
          end:
            axis === "x"
              ? { x: b[lo], y: perpMid - 10 }
              : { x: perpMid - 10, y: b[lo] },
        },
        {
          axis,
          position: b[hi],
          kind: "spacing",
          start:
            axis === "x"
              ? { x: b[hi], y: perpMid - 10 }
              : { x: perpMid - 10, y: b[hi] },
          end:
            axis === "x"
              ? { x: afterPos, y: perpMid - 10 }
              : { x: perpMid - 10, y: afterPos },
        },
      ];
      return { delta, guides };
    }

    // Option 3: place *between* a and b with equal gaps
    const betweenGap = (gap - dragSize) / 2;
    if (betweenGap > 0) {
      const betweenPos = a[hi] + betweenGap;
      const betweenDist = Math.abs(proposed[lo] - betweenPos);
      if (betweenDist <= threshold) {
        const delta = betweenPos - proposed[lo];
        const perpMid = (proposed[oLo] + proposed[oHi]) / 2;
        const guides: SnapGuide[] = [
          {
            axis,
            position: a[hi],
            kind: "spacing",
            start:
              axis === "x"
                ? { x: a[hi], y: perpMid - 10 }
                : { x: perpMid - 10, y: a[hi] },
            end:
              axis === "x"
                ? { x: betweenPos, y: perpMid - 10 }
                : { x: perpMid - 10, y: betweenPos },
          },
          {
            axis,
            position: betweenPos + dragSize,
            kind: "spacing",
            start:
              axis === "x"
                ? { x: betweenPos + dragSize, y: perpMid - 10 }
                : { x: perpMid - 10, y: betweenPos + dragSize },
            end:
              axis === "x"
                ? { x: b[lo], y: perpMid - 10 }
                : { x: perpMid - 10, y: b[lo] },
          },
        ];
        return { delta, guides };
      }
    }
  }

  return null;
}

// ── Internals ─────────────────────────────────────────────────

/** Build a set that includes `ids` and all their descendants. */
function expandDescendants(
  ids: Set<UUID>,
  objects: Record<UUID, PenpotShape>,
): Set<UUID> {
  const result = new Set<UUID>();
  const recurse = (id: UUID) => {
    result.add(id);
    const s = objects[id];
    if (s?.shapes) for (const c of s.shapes) recurse(c);
  };
  for (const id of ids) recurse(id);
  return result;
}

/** Collect all move-snap candidates. */
function collectMoveCandidates(
  proposed: AABB,
  selectedIds: Set<UUID>,
  objects: Record<UUID, PenpotShape>,
  threshold: number,
  objectSnap: boolean,
  gridSnap: boolean,
  gridSize: number,
): SnapCandidate[] {
  const candidates: SnapCandidate[] = [];
  const w = proposed.maxX - proposed.minX;
  const h = proposed.maxY - proposed.minY;

  // Proposed edges & center
  const pLeft = proposed.minX;
  const pRight = proposed.maxX;
  const pCenterX = (proposed.minX + proposed.maxX) / 2;
  const pTop = proposed.minY;
  const pBottom = proposed.maxY;
  const pCenterY = (proposed.minY + proposed.maxY) / 2;

  if (objectSnap) {
    const excludeAll = expandDescendants(selectedIds, objects);

    for (const [id, shape] of Object.entries(objects)) {
      if (excludeAll.has(id as UUID)) continue;
      if (id === ROOT_FRAME_ID) continue;
      if (shape.hidden || shape.locked) continue;

      const tb = shapeBounds(shape);

      // X-axis: try all edge-to-edge & center-to-center
      trySnapX(candidates, pLeft, tb.minX, "edge", threshold, proposed.minY, proposed.maxY, tb);
      trySnapX(candidates, pLeft, tb.maxX, "edge", threshold, proposed.minY, proposed.maxY, tb);
      trySnapX(candidates, pRight, tb.minX, "edge", threshold, proposed.minY, proposed.maxY, tb);
      trySnapX(candidates, pRight, tb.maxX, "edge", threshold, proposed.minY, proposed.maxY, tb);
      trySnapX(candidates, pCenterX, (tb.minX + tb.maxX) / 2, "center", threshold, proposed.minY, proposed.maxY, tb);

      // Y-axis
      trySnapY(candidates, pTop, tb.minY, "edge", threshold, proposed.minX, proposed.maxX, tb);
      trySnapY(candidates, pTop, tb.maxY, "edge", threshold, proposed.minX, proposed.maxX, tb);
      trySnapY(candidates, pBottom, tb.minY, "edge", threshold, proposed.minX, proposed.maxX, tb);
      trySnapY(candidates, pBottom, tb.maxY, "edge", threshold, proposed.minX, proposed.maxX, tb);
      trySnapY(candidates, pCenterY, (tb.minY + tb.maxY) / 2, "center", threshold, proposed.minX, proposed.maxX, tb);
    }
  }

  if (gridSnap && gridSize > 0) {
    // Snap top-left corner to grid
    const gx = Math.round(pLeft / gridSize) * gridSize;
    const dxg = Math.abs(pLeft - gx);
    if (dxg <= threshold) {
      candidates.push({
        axis: "x",
        target: gx,
        source: pLeft,
        distance: dxg,
        guide: {
          axis: "x",
          position: gx,
          start: { x: gx, y: pTop - GUIDE_EXTENSION },
          end: { x: gx, y: pBottom + GUIDE_EXTENSION },
          kind: "grid",
        },
      });
    }

    const gy = Math.round(pTop / gridSize) * gridSize;
    const dyg = Math.abs(pTop - gy);
    if (dyg <= threshold) {
      candidates.push({
        axis: "y",
        target: gy,
        source: pTop,
        distance: dyg,
        guide: {
          axis: "y",
          position: gy,
          start: { x: pLeft - GUIDE_EXTENSION, y: gy },
          end: { x: pRight + GUIDE_EXTENSION, y: gy },
          kind: "grid",
        },
      });
    }
  }

  return candidates;
}

function trySnapX(
  candidates: SnapCandidate[],
  source: number,
  target: number,
  kind: "edge" | "center",
  threshold: number,
  proposedMinY: number,
  proposedMaxY: number,
  targetBounds: AABB,
): void {
  const dist = Math.abs(source - target);
  if (dist > threshold) return;

  const minY = Math.min(proposedMinY, targetBounds.minY) - GUIDE_EXTENSION;
  const maxY = Math.max(proposedMaxY, targetBounds.maxY) + GUIDE_EXTENSION;

  candidates.push({
    axis: "x",
    target,
    source,
    distance: dist,
    guide: {
      axis: "x",
      position: target,
      start: { x: target, y: minY },
      end: { x: target, y: maxY },
      kind,
    },
  });
}

function trySnapY(
  candidates: SnapCandidate[],
  source: number,
  target: number,
  kind: "edge" | "center",
  threshold: number,
  proposedMinX: number,
  proposedMaxX: number,
  targetBounds: AABB,
): void {
  const dist = Math.abs(source - target);
  if (dist > threshold) return;

  const minX = Math.min(proposedMinX, targetBounds.minX) - GUIDE_EXTENSION;
  const maxX = Math.max(proposedMaxX, targetBounds.maxX) + GUIDE_EXTENSION;

  candidates.push({
    axis: "y",
    target,
    source,
    distance: dist,
    guide: {
      axis: "y",
      position: target,
      start: { x: minX, y: target },
      end: { x: maxX, y: target },
      kind,
    },
  });
}

/** Given candidates, pick the best per axis and compute final delta correction. */
function resolveSnap(
  proposed: AABB,
  rawDx: number,
  rawDy: number,
  candidates: SnapCandidate[],
  threshold: number,
): SnapResult {
  let bestX: SnapCandidate | null = null;
  let bestY: SnapCandidate | null = null;

  for (const c of candidates) {
    if (c.axis === "x") {
      if (!bestX || c.distance < bestX.distance) bestX = c;
    } else {
      if (!bestY || c.distance < bestY.distance) bestY = c;
    }
  }

  let snapDx = 0;
  let snapDy = 0;
  const guides: SnapGuide[] = [];

  if (bestX && bestX.distance <= threshold) {
    snapDx = bestX.target - bestX.source;
    guides.push(bestX.guide);
  }

  if (bestY && bestY.distance <= threshold) {
    snapDy = bestY.target - bestY.source;
    guides.push(bestY.guide);
  }

  return { snapDx, snapDy, guides };
}
