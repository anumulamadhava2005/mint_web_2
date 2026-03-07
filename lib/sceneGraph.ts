// ═══════════════════════════════════════════════════════════════
// Scene Graph — Transform hierarchy with matrix propagation,
//               spatial indexing, and dirty-flag optimisation
//
// Architecture:
//   CanvasShape (React state, source of truth)
//        ↕  sync
//   SceneGraph  ──→  transform cache   (Matrix3 per node)
//               ──→  QuadTree          (spatial index)
//               ──→  hit-test pipeline
//               ──→  reparenting engine
//
// The SceneGraph never mutates CanvasShape directly; it reads
// shapes and produces derived data (world transforms, bounds).
// ═══════════════════════════════════════════════════════════════

import {
  Matrix3,
  mat3Identity,
  mat3Compose,
  mat3Multiply,
  mat3Inverse,
  mat3TransformPoint,
  mat3TransformAABB,
  mat3Decompose,
  mat3WorldToLocal,
} from "./matrix3";
import { QuadTree, QTItem } from "./quadTree";
import type { CanvasShape, AABB, Vec2 } from "./canvasEngine";

// ── Types ─────────────────────────────────────────────────────

export interface SceneNodeData {
  id: string;
  parentId: string | null;
  children: string[];
  /** Local transform built from x, y, rotation, scaleX, scaleY */
  localTransform: Matrix3;
  /** Cached world transform = parent.world × local */
  worldTransform: Matrix3;
  /** Local bounds (0, 0, width, height) */
  localBounds: AABB;
  /** Cached world-space AABB */
  worldBounds: AABB;
  /** Dirty flag — true when local transform changed */
  dirty: boolean;
  /** Shape reference for quick access */
  zIndex: number;
  type: string;
  visible: boolean;
  locked: boolean;

  // ── Versioned Transform Cache ─────────────────────────
  /** Transform version — incremented when local transform changes */
  transformVersion: number;
  /** World version — tracks which parent version was used to compute world transform */
  parentWorldVersion: number;
  /** Computed world version = this transform version + contributions from ancestors */
  worldVersion: number;
}

// ── Build local transform from CanvasShape ────────────────────

function buildLocalTransform(s: CanvasShape): Matrix3 {
  const rotation = (s.rotation * Math.PI) / 180; // deg → rad
  // Compose: Translate → Rotate around center → Scale
  // We store x,y as position of top-left, so local transform =
  //   T(x, y) × T(cx, cy) × R(rot) × S(sx, sy) × T(-cx, -cy)
  // Simplified for the common case (rotation around center):
  if (s.rotation === 0 && s.scaleX === 1 && s.scaleY === 1) {
    // Fast path: pure translation
    return [1, 0, 0, 1, s.x, s.y];
  }
  const cx = s.width / 2;
  const cy = s.height / 2;
  // T(x+cx, y+cy) × R × S × T(-cx, -cy)
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const sx = s.scaleX;
  const sy = s.scaleY;
  // R × S
  const rs: Matrix3 = [cos * sx, sin * sx, -sin * sy, cos * sy, 0, 0];
  // T(-cx, -cy) applied first (rightmost)
  // Then R×S
  // Then T(x+cx, y+cy)
  const a = rs[0], b = rs[1], c = rs[2], d = rs[3];
  const tx = (s.x + cx) + a * (-cx) + c * (-cy);
  const ty = (s.y + cy) + b * (-cx) + d * (-cy);
  return [a, b, c, d, tx, ty];
}

function localBoundsFromShape(s: CanvasShape): AABB {
  return { minX: 0, minY: 0, maxX: s.width, maxY: s.height };
}

// ── SceneGraph class ──────────────────────────────────────────

export class SceneGraph {
  /** Node data cache, keyed by shape id */
  private nodes = new Map<string, SceneNodeData>();
  /** Quick parent → children lookup */
  private childrenMap = new Map<string, string[]>();
  /** Root node ids (parentId === null) */
  private roots: string[] = [];
  /** Spatial index */
  private quadTree = new QuadTree();
  /** Dirty set for lazy propagation */
  private dirtySet = new Set<string>();
  /** Full shape lookup */
  private shapeLookup = new Map<string, CanvasShape>();
  /** Global version counter for transform versioning */
  private globalVersion = 0;

  // ── Full rebuild ──────────────────────────────────────────

  /**
   * Rebuild the entire scene graph from a flat array of shapes.
   * Call this when shapes change (add/remove/reorder).
   */
  rebuild(shapes: CanvasShape[]): void {
    this.nodes.clear();
    this.childrenMap.clear();
    this.roots = [];
    this.shapeLookup.clear();

    // 1. Index all shapes
    for (const s of shapes) {
      this.shapeLookup.set(s.id, s);
    }

    // 2. Build node data (local transforms only)
    for (const s of shapes) {
      this.globalVersion++;
      const node: SceneNodeData = {
        id: s.id,
        parentId: s.parentId,
        children: [...s.children],
        localTransform: buildLocalTransform(s),
        worldTransform: mat3Identity(),
        localBounds: localBoundsFromShape(s),
        worldBounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
        dirty: true,
        zIndex: s.zIndex,
        type: s.type,
        visible: s.visible,
        locked: s.locked,
        // Versioned transform cache
        transformVersion: this.globalVersion,
        parentWorldVersion: 0,
        worldVersion: 0,
      };
      this.nodes.set(s.id, node);

      // Track children
      if (!this.childrenMap.has(s.parentId ?? "__root__")) {
        this.childrenMap.set(s.parentId ?? "__root__", []);
      }
      this.childrenMap.get(s.parentId ?? "__root__")!.push(s.id);

      if (s.parentId === null) {
        this.roots.push(s.id);
      }
    }

    // 3. Propagate transforms (depth-first from roots)
    for (const rootId of this.roots) {
      this.propagateTransform(rootId, mat3Identity());
    }

    // 4. Build spatial index from world bounds
    this.rebuildQuadTree();
  }

  // ── Incremental update ────────────────────────────────────

  /**
   * Mark a node (and its subtree) as dirty.
   * Call markDirty then flushDirty before querying.
   */
  markDirty(id: string): void {
    this.dirtySet.add(id);
    const node = this.nodes.get(id);
    if (node) {
      node.dirty = true;
      for (const childId of node.children) {
        this.markDirty(childId);
      }
    }
  }

  /**
   * Update a single node's local transform from shape data
   * without full rebuild. Marks subtree dirty.
   */
  updateNode(shape: CanvasShape): void {
    const node = this.nodes.get(shape.id);
    if (!node) return;
    node.localTransform = buildLocalTransform(shape);
    node.localBounds = localBoundsFromShape(shape);
    node.zIndex = shape.zIndex;
    node.visible = shape.visible;
    node.locked = shape.locked;
    // Increment transform version — triggers lazy world recalculation
    this.globalVersion++;
    node.transformVersion = this.globalVersion;
    this.shapeLookup.set(shape.id, shape);
    this.markDirty(shape.id);
  }

  /**
   * Flush all dirty nodes: recalculate world transforms + update QuadTree.
   * Uses lazy evaluation — only recalcs when queried.
   */
  flushDirty(): void {
    if (this.dirtySet.size === 0) return;

    // Find topmost dirty nodes (those whose parent is NOT dirty)
    const topDirty: string[] = [];
    for (const id of this.dirtySet) {
      const node = this.nodes.get(id);
      if (!node) continue;
      if (node.parentId && this.dirtySet.has(node.parentId)) continue;
      topDirty.push(id);
    }

    // Propagate from each topmost dirty node
    for (const id of topDirty) {
      const node = this.nodes.get(id);
      if (!node) continue;
      const parentWorld = node.parentId
        ? (this.nodes.get(node.parentId)?.worldTransform ?? mat3Identity())
        : mat3Identity();
      this.propagateTransform(id, parentWorld);
    }

    // Update QuadTree for dirty nodes
    this.rebuildQuadTree(); // Full rebuild is simpler and fast enough for <10k shapes
    this.dirtySet.clear();
  }

  // ── Transform propagation ─────────────────────────────────

  private propagateTransform(nodeId: string, parentWorld: Matrix3, parentVersion?: number): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    const pv = parentVersion ?? 0;

    // Version check: skip if parent hasn't changed and local hasn't changed
    if (!node.dirty && node.parentWorldVersion === pv) {
      // Neither parent nor local changed — world transform is still valid
      // But still recurse to check children (they might have changed independently)
      for (const childId of node.children) {
        this.propagateTransform(childId, node.worldTransform, node.worldVersion);
      }
      return;
    }

    // worldTransform = parentWorld × localTransform
    node.worldTransform = mat3Multiply(parentWorld, node.localTransform);

    // worldBounds = transform localBounds by worldTransform
    node.worldBounds = mat3TransformAABB(node.worldTransform, {
      x: node.localBounds.minX,
      y: node.localBounds.minY,
      width: node.localBounds.maxX - node.localBounds.minX,
      height: node.localBounds.maxY - node.localBounds.minY,
    });

    // Update version tracking
    node.parentWorldVersion = pv;
    node.worldVersion = node.transformVersion + pv;
    node.dirty = false;

    // Recurse into children with our new world version
    for (const childId of node.children) {
      this.propagateTransform(childId, node.worldTransform, node.worldVersion);
    }
  }

  private rebuildQuadTree(): void {
    const items: QTItem[] = [];
    for (const [id, node] of this.nodes) {
      if (!node.visible) continue;
      const wb = node.worldBounds;
      items.push({
        id,
        bounds: {
          x: wb.minX,
          y: wb.minY,
          w: wb.maxX - wb.minX,
          h: wb.maxY - wb.minY,
        },
      });
    }
    this.quadTree.rebuild(items);
  }

  // ── Queries ───────────────────────────────────────────────

  /** Get cached world transform for a node */
  getWorldTransform(id: string): Matrix3 {
    return this.nodes.get(id)?.worldTransform ?? mat3Identity();
  }

  /** Get cached world bounds for a node */
  getWorldBounds(id: string): AABB {
    return this.nodes.get(id)?.worldBounds ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  /** Get world-space center of a node */
  getWorldCenter(id: string): Vec2 {
    const node = this.nodes.get(id);
    if (!node) return { x: 0, y: 0 };
    const cx = (node.localBounds.minX + node.localBounds.maxX) / 2;
    const cy = (node.localBounds.minY + node.localBounds.maxY) / 2;
    return mat3TransformPoint(node.worldTransform, { x: cx, y: cy });
  }

  /** Get local transform for a node */
  getLocalTransform(id: string): Matrix3 {
    return this.nodes.get(id)?.localTransform ?? mat3Identity();
  }

  /** Get node data */
  getNode(id: string): SceneNodeData | undefined {
    return this.nodes.get(id);
  }

  /** Get shape from lookup */
  getShape(id: string): CanvasShape | undefined {
    return this.shapeLookup.get(id);
  }

  /** Get all root ids */
  getRoots(): string[] {
    return this.roots;
  }

  /** Get children of a node (or roots if null) */
  getChildren(parentId: string | null): string[] {
    if (parentId === null) return this.roots;
    return this.nodes.get(parentId)?.children ?? [];
  }

  /** Get depth (for layer panel indentation) */
  getDepth(id: string): number {
    let depth = 0;
    let node = this.nodes.get(id);
    while (node?.parentId) {
      depth++;
      node = this.nodes.get(node.parentId);
    }
    return depth;
  }

  // ── Hit Testing Pipeline ──────────────────────────────────
  //
  //  Mouse Move
  //     ↓
  //  Convert screen → world coords
  //     ↓
  //  Query spatial index (QuadTree)        ← O(log n)
  //     ↓
  //  Get candidate nodes
  //     ↓
  //  Sort by z-index (reverse)
  //     ↓
  //  Check precise bounds (rotated point-in-shape)
  //     ↓
  //  Select topmost valid shape

  /**
   * Hit test a world-space point.
   * Returns candidate shape IDs sorted by z-index (topmost first).
   * Uses the QuadTree for O(log n) broad-phase.
   */
  hitTestPoint(worldPoint: Vec2): string[] {
    // 1. Broad phase: QuadTree query
    const candidateIds = this.quadTree.queryPoint(worldPoint.x, worldPoint.y);

    // 2. Narrow phase: precise check using world transforms
    const hits: { id: string; zIndex: number; depth: number }[] = [];

    for (const id of candidateIds) {
      const node = this.nodes.get(id);
      if (!node || !node.visible || node.locked) continue;

      // Transform worldPoint into the node's local space
      const localPoint = mat3TransformPoint(
        mat3Inverse(node.worldTransform),
        worldPoint,
      );

      // Check against local bounds
      if (
        localPoint.x >= node.localBounds.minX &&
        localPoint.x <= node.localBounds.maxX &&
        localPoint.y >= node.localBounds.minY &&
        localPoint.y <= node.localBounds.maxY
      ) {
        hits.push({ id, zIndex: node.zIndex, depth: this.getDepth(id) });
      }
    }

    // 3. Sort: highest z-index first, deepest nesting wins ties
    hits.sort((a, b) => b.zIndex - a.zIndex || b.depth - a.depth);

    return hits.map(h => h.id);
  }

  /**
   * Hit test a world-space rectangle (marquee selection).
   * Returns all shape IDs whose world bounds intersect.
   */
  hitTestRect(worldRect: AABB): string[] {
    const range = {
      x: worldRect.minX,
      y: worldRect.minY,
      w: worldRect.maxX - worldRect.minX,
      h: worldRect.maxY - worldRect.minY,
    };
    const ids = this.quadTree.queryRect(range);
    return ids.filter(id => {
      const node = this.nodes.get(id);
      return node && node.visible && !node.locked;
    });
  }

  // ── Drop Target Resolution ────────────────────────────────
  //
  //  Rules:
  //    - Must be a frame
  //    - Must be visible
  //    - Must not be locked
  //    - Must not be the dragged shape or its descendant
  //    - Prefer deepest (most nested) frame
  //    - Sort by depth descending, then z-index descending

  findDropTarget(
    worldPoint: Vec2,
    excludeIds: Set<string>,
  ): string | null {
    const candidateIds = this.quadTree.queryPoint(worldPoint.x, worldPoint.y);

    const validFrames: { id: string; depth: number; zIndex: number }[] = [];

    for (const id of candidateIds) {
      if (excludeIds.has(id)) continue;

      const node = this.nodes.get(id);
      if (!node) continue;
      if (node.type !== "frame") continue;
      if (!node.visible) continue;
      if (node.locked) continue;

      // Check that none of the excluded ids are ancestors of this frame
      let isDescendantOfExcluded = false;
      for (const exId of excludeIds) {
        if (this.isDescendantOf(id, exId)) {
          isDescendantOfExcluded = true;
          break;
        }
      }
      if (isDescendantOfExcluded) continue;

      // Precise hit test in local space
      const localPoint = mat3TransformPoint(
        mat3Inverse(node.worldTransform),
        worldPoint,
      );
      if (
        localPoint.x >= node.localBounds.minX &&
        localPoint.x <= node.localBounds.maxX &&
        localPoint.y >= node.localBounds.minY &&
        localPoint.y <= node.localBounds.maxY
      ) {
        validFrames.push({
          id,
          depth: this.getDepth(id),
          zIndex: node.zIndex,
        });
      }
    }

    if (validFrames.length === 0) return null;

    // Prefer deepest frame, then highest z-index
    validFrames.sort((a, b) => b.depth - a.depth || b.zIndex - a.zIndex);
    return validFrames[0].id;
  }

  /** Check if candidateId is a descendant of ancestorId */
  isDescendantOf(candidateId: string, ancestorId: string): boolean {
    let current = this.nodes.get(candidateId);
    while (current) {
      if (current.parentId === ancestorId) return true;
      if (!current.parentId) return false;
      current = this.nodes.get(current.parentId);
    }
    return false;
  }

  // ── Reparenting Engine ────────────────────────────────────
  //
  //  Transaction steps:
  //    1. Capture world transform (before reparent)
  //    2. Change parentId
  //    3. Compute new local transform:
  //         local = inverse(newParent.world) × oldWorldTransform
  //    4. Update children arrays
  //
  //  This preserves visual position — no jump.

  /**
   * Reparent a shape to a new parent.
   * Returns a new shapes array with hierarchy + coordinates updated.
   * The shape's visual position is preserved.
   */
  reparent(
    shapeId: string,
    newParentId: string | null,
    shapes: CanvasShape[],
  ): CanvasShape[] {
    const node = this.nodes.get(shapeId);
    if (!node) return shapes;
    if (node.parentId === newParentId) return shapes;

    // Prevent reparenting into self or own descendant
    if (newParentId && this.isDescendantOf(newParentId, shapeId)) return shapes;

    // Step 1: Capture current world transform
    const oldWorldTransform = node.worldTransform;

    // Step 2+3: Compute new local transform
    //   newLocal = inverse(newParentWorld) × oldWorldTransform
    const newParentWorld = newParentId
      ? (this.nodes.get(newParentId)?.worldTransform ?? mat3Identity())
      : mat3Identity();
    const newLocalTransform = mat3Multiply(
      mat3Inverse(newParentWorld),
      oldWorldTransform,
    );

    // Decompose to get new x, y, rotation, scaleX, scaleY
    const decomposed = mat3Decompose(newLocalTransform);

    // Step 4: Update shapes array
    let next = shapes.map(s => {
      // Remove from old parent's children
      if (s.id === node.parentId) {
        return { ...s, children: s.children.filter(c => c !== shapeId) };
      }
      return s;
    });

    // Update the shape itself
    next = next.map(s => {
      if (s.id === shapeId) {
        return {
          ...s,
          x: decomposed.tx,
          y: decomposed.ty,
          rotation: (decomposed.rotation * 180) / Math.PI,
          scaleX: decomposed.scaleX,
          scaleY: decomposed.scaleY,
          parentId: newParentId,
        };
      }
      return s;
    });

    // Add to new parent's children
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

  // ── Traversal ─────────────────────────────────────────────

  /**
   * Depth-first traversal in render order (parent then children, sorted by zIndex).
   * Calls visitor with (shapeId, worldTransform, depth).
   */
  traverse(
    visitor: (id: string, worldTransform: Matrix3, depth: number) => void,
    parentId: string | null = null,
    depth = 0,
  ): void {
    const childIds = parentId === null
      ? this.roots
      : (this.nodes.get(parentId)?.children ?? []);

    // Sort children by zIndex
    const sorted = childIds
      .map(id => this.nodes.get(id))
      .filter((n): n is SceneNodeData => !!n && n.visible)
      .sort((a, b) => a.zIndex - b.zIndex);

    for (const node of sorted) {
      visitor(node.id, node.worldTransform, depth);
      if (node.children.length > 0) {
        this.traverse(visitor, node.id, depth + 1);
      }
    }
  }

  /**
   * Flatten tree into render-order array (for layer panel).
   * Returns shapes in depth-first order (parent before children).
   */
  flattenForLayerPanel(): Array<{ id: string; depth: number }> {
    const result: Array<{ id: string; depth: number }> = [];
    this.traverse((id, _wt, depth) => {
      result.push({ id, depth });
    });
    return result;
  }

  // ── Coordinate Spaces ─────────────────────────────────────
  //
  //  Screen Space → Viewport Space → World Space → Local Space
  //
  //  Screen:    raw mouse coordinates
  //  Viewport:  offset by canvas element position
  //  World:     camera transform applied (pan + zoom)
  //  Local:     relative to parent's transform

  /** Convert world point to a node's local space */
  worldToNodeLocal(nodeId: string, worldPoint: Vec2): Vec2 {
    const wt = this.getWorldTransform(nodeId);
    return mat3TransformPoint(mat3Inverse(wt), worldPoint);
  }

  /** Convert a node's local point to world space */
  nodeLocalToWorld(nodeId: string, localPoint: Vec2): Vec2 {
    const wt = this.getWorldTransform(nodeId);
    return mat3TransformPoint(wt, localPoint);
  }

  // ── Advanced Hit Testing (Shape Geometry) ─────────────────
  //
  //  Instead of just checking bounding boxes, test against actual
  //  vector geometry for precise selection:
  //    - Ellipses: point-in-ellipse equation
  //    - Polygons/Stars: point-in-polygon (ray casting)
  //    - Lines: distance-to-segment
  //    - Paths: point-in-polygon for closed paths

  /**
   * Precise hit test using actual shape geometry.
   * Returns shape IDs sorted by z-index (topmost first).
   * Unlike hitTestPoint, this uses actual vector geometry
   * instead of just AABB bounding boxes.
   */
  hitTestPointPrecise(worldPoint: Vec2): string[] {
    // 1. Broad phase: QuadTree query (AABB)
    const candidateIds = this.quadTree.queryPoint(worldPoint.x, worldPoint.y);

    // 2. Narrow phase: precise geometry check
    const hits: { id: string; zIndex: number; depth: number }[] = [];

    for (const id of candidateIds) {
      const node = this.nodes.get(id);
      if (!node || !node.visible || node.locked) continue;

      const shape = this.shapeLookup.get(id);
      if (!shape) continue;

      // Transform worldPoint into the node's local space
      const localPoint = mat3TransformPoint(
        mat3Inverse(node.worldTransform),
        worldPoint,
      );

      // Precise geometry test in local space
      if (this.pointInShapeGeometry(localPoint, shape, node)) {
        hits.push({ id, zIndex: node.zIndex, depth: this.getDepth(id) });
      }
    }

    // 3. Sort: highest z-index first, deepest nesting wins ties
    hits.sort((a, b) => b.zIndex - a.zIndex || b.depth - a.depth);
    return hits.map(h => h.id);
  }

  /**
   * Test if a local-space point is inside the shape's actual geometry.
   * Local space means (0, 0) is the top-left of the shape's bounding box.
   */
  private pointInShapeGeometry(
    localPoint: Vec2,
    shape: CanvasShape,
    node: SceneNodeData,
  ): boolean {
    const { minX, minY, maxX, maxY } = node.localBounds;
    const w = maxX - minX;
    const h = maxY - minY;
    const px = localPoint.x;
    const py = localPoint.y;

    // Quick AABB reject
    if (px < minX || px > maxX || py < minY || py > maxY) {
      return false;
    }

    switch (shape.type) {
      case "rectangle":
      case "frame":
      case "text":
        // AABB is exact for axis-aligned rectangles
        return true;

      case "ellipse": {
        // Point-in-ellipse equation: ((x-cx)/rx)^2 + ((y-cy)/ry)^2 <= 1
        const cx = w / 2;
        const cy = h / 2;
        const rx = w / 2;
        const ry = h / 2;
        if (rx === 0 || ry === 0) return false;
        const dx = (px - cx) / rx;
        const dy = (py - cy) / ry;
        return dx * dx + dy * dy <= 1;
      }

      case "line": {
        // Distance from point to line segment
        const x1 = 0, y1 = 0;
        const x2 = w, y2 = h;
        const dist = distPointToSegment2D(
          px, py, x1, y1, x2, y2,
        );
        return dist <= Math.max(shape.strokeWidth / 2, 5);
      }

      case "polygon":
      case "star": {
        // Generate vertices in local space and test point-in-polygon
        const vertices = this.generateLocalVertices(shape);
        return pointInPolygon2D(px, py, vertices);
      }

      case "path": {
        if (!shape.points || shape.points.length < 3) {
          // Not enough points for a polygon — use distance check
          if (shape.points && shape.points.length >= 2) {
            let minDist = Infinity;
            for (let i = 0; i < shape.points.length - 1; i++) {
              const d = distPointToSegment2D(
                px, py,
                shape.points[i].x, shape.points[i].y,
                shape.points[i + 1].x, shape.points[i + 1].y,
              );
              minDist = Math.min(minDist, d);
            }
            return minDist <= Math.max(shape.strokeWidth / 2, 5);
          }
          return false;
        }
        // Closed path — point-in-polygon
        const pathPts = shape.points.map(p => ({ x: p.x, y: p.y }));
        return pointInPolygon2D(px, py, pathPts);
      }

      default:
        return true; // Fall back to AABB
    }
  }

  /**
   * Generate polygon/star vertices in local space (0,0 origin).
   */
  private generateLocalVertices(shape: CanvasShape): Vec2[] {
    const cx = shape.width / 2;
    const cy = shape.height / 2;
    const rx = shape.width / 2;
    const ry = shape.height / 2;

    if (shape.type === "star") {
      const spikes = shape.sides || 5;
      const inner = (shape.starInnerRadius ?? 0.4) * Math.min(rx, ry);
      const pts: Vec2[] = [];
      for (let i = 0; i < spikes * 2; i++) {
        const angle = (Math.PI * i) / spikes - Math.PI / 2;
        const r = i % 2 === 0 ? Math.min(rx, ry) : inner;
        pts.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
      }
      return pts;
    }

    // Regular polygon
    const sides = shape.sides || 5;
    const pts: Vec2[] = [];
    for (let i = 0; i < sides; i++) {
      const angle = (2 * Math.PI * i) / sides - Math.PI / 2;
      pts.push({ x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry });
    }
    return pts;
  }
}

// ── Geometry Helpers (module-level) ───────────────────────────

/** Distance from point (px, py) to line segment (x1,y1)→(x2,y2) */
function distPointToSegment2D(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const ex = px - x1, ey = py - y1;
    return Math.sqrt(ex * ex + ey * ey);
  }
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  const ex = px - projX, ey = py - projY;
  return Math.sqrt(ex * ex + ey * ey);
}

/** Ray-casting point-in-polygon test */
function pointInPolygon2D(px: number, py: number, polygon: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if (((yi > py) !== (yj > py)) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}
