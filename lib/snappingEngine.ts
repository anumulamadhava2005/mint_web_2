// ═══════════════════════════════════════════════════════════════
// Snapping Engine — Real-time snap guides for canvas objects
//
// When dragging, Figma constantly computes snap distances to:
//   - Other object edges (left, right, top, bottom)
//   - Other object centers
//   - Parent frame bounds
//   - Grid lines
//
// Pipeline:
//   drag move event
//       ↓
//   collect snap targets (spatial index)
//       ↓
//   project distances along X and Y axes
//       ↓
//   find minimum distance within threshold
//       ↓
//   modify transform to snap
//       ↓
//   return snap guides for rendering
//
// Uses the QuadTree spatial index for efficient candidate lookup.
// ═══════════════════════════════════════════════════════════════

import type { CanvasShape, Vec2, AABB } from "./canvasEngine";
import type { SceneGraph } from "./sceneGraph";

// ── Types ─────────────────────────────────────────────────────

export interface SnapGuide {
  /** Axis of the guide line */
  axis: "x" | "y";
  /** Position of the guide line in world space */
  position: number;
  /** Start and end points for rendering the guide line */
  start: Vec2;
  end: Vec2;
  /** Source snap type (what generated this guide) */
  type: "edge" | "center" | "spacing" | "grid";
}

export interface SnapResult {
  /** Adjusted position after snapping */
  snappedX: number;
  snappedY: number;
  /** Delta applied by snapping */
  deltaX: number;
  deltaY: number;
  /** Active snap guides to render */
  guides: SnapGuide[];
  /** Whether snapping occurred on each axis */
  snappedOnX: boolean;
  snappedOnY: boolean;
}

interface SnapCandidate {
  axis: "x" | "y";
  /** Position of the snap target */
  target: number;
  /** Position of the dragged object edge/center to snap */
  source: number;
  /** Distance to snap */
  distance: number;
  /** Guide for rendering */
  guide: SnapGuide;
}

// ── Configuration ─────────────────────────────────────────────

const SNAP_THRESHOLD = 8; // pixels (screen space) threshold for snapping
const SNAP_GRID_SIZE = 10; // grid snap size
const SNAP_EXPANSION = 500; // how far guide lines extend

/**
 * The Snapping Engine computes snap positions during drag operations.
 */
export class SnappingEngine {
  private threshold: number;
  private gridSize: number;
  private gridEnabled: boolean;
  private objectSnapEnabled: boolean;

  constructor(options?: {
    threshold?: number;
    gridSize?: number;
    gridEnabled?: boolean;
    objectSnapEnabled?: boolean;
  }) {
    this.threshold = options?.threshold ?? SNAP_THRESHOLD;
    this.gridSize = options?.gridSize ?? SNAP_GRID_SIZE;
    this.gridEnabled = options?.gridEnabled ?? false;
    this.objectSnapEnabled = options?.objectSnapEnabled ?? true;
  }

  setGridEnabled(enabled: boolean): void { this.gridEnabled = enabled; }
  setObjectSnapEnabled(enabled: boolean): void { this.objectSnapEnabled = enabled; }
  setThreshold(t: number): void { this.threshold = t; }
  setGridSize(s: number): void { this.gridSize = s; }

  /**
   * Compute snap for a dragged selection.
   *
   * @param dragBounds   Current AABB of the dragged selection (world space)
   * @param targetX      Desired X position (world space, top-left of bounds)
   * @param targetY      Desired Y position (world space, top-left of bounds)
   * @param excludeIds   IDs of shapes being dragged (exclude from snap targets)
   * @param sceneGraph   Scene graph for spatial queries
   * @param zoom         Current camera zoom (for screen-space threshold)
   */
  snap(
    dragBounds: AABB,
    targetX: number,
    targetY: number,
    excludeIds: Set<string>,
    sceneGraph: SceneGraph,
    zoom: number,
  ): SnapResult {
    const candidates: SnapCandidate[] = [];
    const worldThreshold = this.threshold / zoom;

    const dragW = dragBounds.maxX - dragBounds.minX;
    const dragH = dragBounds.maxY - dragBounds.minY;

    // Dragged edges and center
    const dragEdges = {
      left: targetX,
      right: targetX + dragW,
      centerX: targetX + dragW / 2,
      top: targetY,
      bottom: targetY + dragH,
      centerY: targetY + dragH / 2,
    };

    // ── Object snapping ───────────────────────────────────
    if (this.objectSnapEnabled) {
      // Query a region around the drag position for potential snap targets
      const queryRegion: AABB = {
        minX: targetX - worldThreshold * 10,
        minY: targetY - worldThreshold * 10,
        maxX: targetX + dragW + worldThreshold * 10,
        maxY: targetY + dragH + worldThreshold * 10,
      };

      const nearbyIds = sceneGraph.hitTestRect(queryRegion);

      for (const id of nearbyIds) {
        if (excludeIds.has(id)) continue;

        const wb = sceneGraph.getWorldBounds(id);
        if (!wb) continue;

        const targetEdges = {
          left: wb.minX,
          right: wb.maxX,
          centerX: (wb.minX + wb.maxX) / 2,
          top: wb.minY,
          bottom: wb.maxY,
          centerY: (wb.minY + wb.maxY) / 2,
        };

        // ── X-axis snap candidates ──
        // Left edge → left/right/center of target
        this.addCandidateX(candidates, dragEdges.left, targetEdges.left, "edge", dragEdges, targetEdges, worldThreshold);
        this.addCandidateX(candidates, dragEdges.left, targetEdges.right, "edge", dragEdges, targetEdges, worldThreshold);
        this.addCandidateX(candidates, dragEdges.right, targetEdges.left, "edge", dragEdges, targetEdges, worldThreshold);
        this.addCandidateX(candidates, dragEdges.right, targetEdges.right, "edge", dragEdges, targetEdges, worldThreshold);
        this.addCandidateX(candidates, dragEdges.centerX, targetEdges.centerX, "center", dragEdges, targetEdges, worldThreshold);

        // ── Y-axis snap candidates ──
        this.addCandidateY(candidates, dragEdges.top, targetEdges.top, "edge", dragEdges, targetEdges, worldThreshold);
        this.addCandidateY(candidates, dragEdges.top, targetEdges.bottom, "edge", dragEdges, targetEdges, worldThreshold);
        this.addCandidateY(candidates, dragEdges.bottom, targetEdges.top, "edge", dragEdges, targetEdges, worldThreshold);
        this.addCandidateY(candidates, dragEdges.bottom, targetEdges.bottom, "edge", dragEdges, targetEdges, worldThreshold);
        this.addCandidateY(candidates, dragEdges.centerY, targetEdges.centerY, "center", dragEdges, targetEdges, worldThreshold);
      }
    }

    // ── Grid snapping ─────────────────────────────────────
    if (this.gridEnabled && this.gridSize > 0) {
      const gridSnapX = Math.round(targetX / this.gridSize) * this.gridSize;
      const gridSnapY = Math.round(targetY / this.gridSize) * this.gridSize;

      const gridDistX = Math.abs(targetX - gridSnapX);
      const gridDistY = Math.abs(targetY - gridSnapY);

      if (gridDistX <= worldThreshold) {
        candidates.push({
          axis: "x",
          target: gridSnapX,
          source: dragEdges.left,
          distance: gridDistX,
          guide: {
            axis: "x",
            position: gridSnapX,
            start: { x: gridSnapX, y: targetY - SNAP_EXPANSION },
            end: { x: gridSnapX, y: targetY + dragH + SNAP_EXPANSION },
            type: "grid",
          },
        });
      }

      if (gridDistY <= worldThreshold) {
        candidates.push({
          axis: "y",
          target: gridSnapY,
          source: dragEdges.top,
          distance: gridDistY,
          guide: {
            axis: "y",
            position: gridSnapY,
            start: { x: targetX - SNAP_EXPANSION, y: gridSnapY },
            end: { x: targetX + dragW + SNAP_EXPANSION, y: gridSnapY },
            type: "grid",
          },
        });
      }
    }

    // ── Find best snap per axis ───────────────────────────
    let bestX: SnapCandidate | null = null;
    let bestY: SnapCandidate | null = null;

    for (const c of candidates) {
      if (c.axis === "x") {
        if (!bestX || c.distance < bestX.distance) bestX = c;
      } else {
        if (!bestY || c.distance < bestY.distance) bestY = c;
      }
    }

    // ── Compute result ────────────────────────────────────
    let snappedX = targetX;
    let snappedY = targetY;
    let deltaX = 0;
    let deltaY = 0;
    const guides: SnapGuide[] = [];

    if (bestX && bestX.distance <= worldThreshold) {
      deltaX = bestX.target - bestX.source;
      snappedX = targetX + deltaX;
      guides.push(bestX.guide);
    }

    if (bestY && bestY.distance <= worldThreshold) {
      deltaY = bestY.target - bestY.source;
      snappedY = targetY + deltaY;
      guides.push(bestY.guide);
    }

    return {
      snappedX,
      snappedY,
      deltaX,
      deltaY,
      guides,
      snappedOnX: deltaX !== 0,
      snappedOnY: deltaY !== 0,
    };
  }

  private addCandidateX(
    candidates: SnapCandidate[],
    source: number,
    target: number,
    type: "edge" | "center",
    dragEdges: Record<string, number>,
    targetEdges: Record<string, number>,
    threshold: number,
  ): void {
    const dist = Math.abs(source - target);
    if (dist > threshold) return;

    const minY = Math.min(dragEdges.top, targetEdges.top) - 20;
    const maxY = Math.max(dragEdges.bottom, targetEdges.bottom) + 20;

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
        type,
      },
    });
  }

  private addCandidateY(
    candidates: SnapCandidate[],
    source: number,
    target: number,
    type: "edge" | "center",
    dragEdges: Record<string, number>,
    targetEdges: Record<string, number>,
    threshold: number,
  ): void {
    const dist = Math.abs(source - target);
    if (dist > threshold) return;

    const minX = Math.min(dragEdges.left, targetEdges.left) - 20;
    const maxX = Math.max(dragEdges.right, targetEdges.right) + 20;

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
        type,
      },
    });
  }

  /**
   * Compute spacing snap (equal spacing between objects).
   * This is an advanced snap that detects when objects are equally spaced.
   */
  computeSpacingSnap(
    dragBounds: AABB,
    nearbyBounds: AABB[],
    axis: "x" | "y",
    threshold: number,
  ): { snapPosition: number; guide: SnapGuide } | null {
    if (nearbyBounds.length < 2) return null;

    // Sort by position on the axis
    const sorted = [...nearbyBounds].sort((a, b) =>
      axis === "x" ? a.minX - b.minX : a.minY - b.minY,
    );

    // Compute gaps between consecutive objects
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const gap = axis === "x"
        ? sorted[i].minX - sorted[i - 1].maxX
        : sorted[i].minY - sorted[i - 1].maxY;
      gaps.push(gap);
    }

    // Check if drag position creates equal spacing with any pair
    for (let i = 0; i < gaps.length; i++) {
      const gap = gaps[i];
      // Check if placing drag object before sorted[0]
      const beforePos = axis === "x"
        ? sorted[0].minX - gap - (dragBounds.maxX - dragBounds.minX)
        : sorted[0].minY - gap - (dragBounds.maxY - dragBounds.minY);

      const beforeDist = Math.abs(
        (axis === "x" ? dragBounds.minX : dragBounds.minY) - beforePos,
      );

      if (beforeDist <= threshold) {
        return {
          snapPosition: beforePos,
          guide: {
            axis,
            position: beforePos,
            start: axis === "x"
              ? { x: beforePos, y: dragBounds.minY - 50 }
              : { x: dragBounds.minX - 50, y: beforePos },
            end: axis === "x"
              ? { x: beforePos, y: dragBounds.maxY + 50 }
              : { x: dragBounds.maxX + 50, y: beforePos },
            type: "spacing",
          },
        };
      }
    }

    return null;
  }
}
