// ═══════════════════════════════════════════════════════════════
// QuadTree — Spatial index for O(log n) hit testing
//
// Structure:
//   QuadTree
//    ├── NW (topLeft)
//    ├── NE (topRight)
//    ├── SW (bottomLeft)
//    └── SE (bottomRight)
//
// Each node stores items whose bounding boxes intersect it.
// Query reduces O(n) full scan to O(log n) spatial lookup.
// ═══════════════════════════════════════════════════════════════

export interface QTRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface QTItem {
  id: string;
  bounds: QTRect;
}

const DEFAULT_CAPACITY = 8;
const DEFAULT_MAX_DEPTH = 8;

// ── Geometry helpers ──────────────────────────────────────────

function rectsIntersect(a: QTRect, b: QTRect): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function rectContainsPoint(r: QTRect, px: number, py: number): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

// ── QuadTree Node ─────────────────────────────────────────────

class QTNode {
  bounds: QTRect;
  items: QTItem[] = [];
  children: QTNode[] | null = null;
  private capacity: number;
  private depth: number;
  private maxDepth: number;

  constructor(bounds: QTRect, capacity: number, depth: number, maxDepth: number) {
    this.bounds = bounds;
    this.capacity = capacity;
    this.depth = depth;
    this.maxDepth = maxDepth;
  }

  /** Split this node into 4 children */
  private subdivide(): void {
    const { x, y, w, h } = this.bounds;
    const hw = w / 2;
    const hh = h / 2;
    const d = this.depth + 1;
    this.children = [
      new QTNode({ x, y, w: hw, h: hh }, this.capacity, d, this.maxDepth),          // NW
      new QTNode({ x: x + hw, y, w: hw, h: hh }, this.capacity, d, this.maxDepth),  // NE
      new QTNode({ x, y: y + hh, w: hw, h: hh }, this.capacity, d, this.maxDepth),  // SW
      new QTNode({ x: x + hw, y: y + hh, w: hw, h: hh }, this.capacity, d, this.maxDepth), // SE
    ];
    // Re-insert existing items into children
    const existing = this.items;
    this.items = [];
    for (const item of existing) {
      this.insertIntoChildren(item);
    }
  }

  private insertIntoChildren(item: QTItem): void {
    if (!this.children) return;
    let inserted = false;
    for (const child of this.children) {
      if (rectsIntersect(child.bounds, item.bounds)) {
        child.insert(item);
        inserted = true;
      }
    }
    // If item doesn't fit in any child (shouldn't happen), keep it here
    if (!inserted) this.items.push(item);
  }

  insert(item: QTItem): void {
    // Don't insert if item doesn't intersect this node
    if (!rectsIntersect(this.bounds, item.bounds)) return;

    if (this.children) {
      this.insertIntoChildren(item);
      return;
    }

    this.items.push(item);

    if (this.items.length > this.capacity && this.depth < this.maxDepth) {
      this.subdivide();
    }
  }

  /** Query all items whose bounds intersect the given rect */
  queryRect(range: QTRect, result: Set<string>, seen: Set<string>): void {
    if (!rectsIntersect(this.bounds, range)) return;

    for (const item of this.items) {
      if (!seen.has(item.id) && rectsIntersect(item.bounds, range)) {
        result.add(item.id);
        seen.add(item.id);
      }
    }

    if (this.children) {
      for (const child of this.children) {
        child.queryRect(range, result, seen);
      }
    }
  }

  /** Query all items whose bounds contain the given point */
  queryPoint(px: number, py: number, result: Set<string>, seen: Set<string>): void {
    if (!rectContainsPoint(this.bounds, px, py)) return;

    for (const item of this.items) {
      if (!seen.has(item.id) && rectContainsPoint(item.bounds, px, py)) {
        result.add(item.id);
        seen.add(item.id);
      }
    }

    if (this.children) {
      for (const child of this.children) {
        child.queryPoint(px, py, result, seen);
      }
    }
  }

  /** Count total items (for debugging) */
  count(): number {
    let n = this.items.length;
    if (this.children) {
      for (const c of this.children) n += c.count();
    }
    return n;
  }
}

// ── Public QuadTree class ─────────────────────────────────────

export class QuadTree {
  private root: QTNode;
  private itemMap = new Map<string, QTItem>();
  private capacity: number;
  private maxDepth: number;

  constructor(
    bounds: QTRect = { x: -100000, y: -100000, w: 200000, h: 200000 },
    capacity = DEFAULT_CAPACITY,
    maxDepth = DEFAULT_MAX_DEPTH,
  ) {
    this.capacity = capacity;
    this.maxDepth = maxDepth;
    this.root = new QTNode(bounds, capacity, 0, maxDepth);
  }

  /** Insert an item. Replaces existing item with same id. */
  insert(item: QTItem): void {
    this.itemMap.set(item.id, item);
    this.root.insert(item);
  }

  /** Remove by id — requires a full rebuild (QuadTrees don't support efficient removal) */
  remove(id: string): boolean {
    if (!this.itemMap.has(id)) return false;
    this.itemMap.delete(id);
    this.rebuildFromMap();
    return true;
  }

  /** Query all items intersecting the given rectangle */
  queryRect(range: QTRect): string[] {
    const result = new Set<string>();
    const seen = new Set<string>();
    this.root.queryRect(range, result, seen);
    return Array.from(result);
  }

  /** Query all items whose bounds contain the given point */
  queryPoint(x: number, y: number): string[] {
    const result = new Set<string>();
    const seen = new Set<string>();
    this.root.queryPoint(x, y, result, seen);
    return Array.from(result);
  }

  /** Clear all items */
  clear(): void {
    this.itemMap.clear();
    this.root = new QTNode(this.root.bounds, this.capacity, 0, this.maxDepth);
  }

  /** Full rebuild from a list of items */
  rebuild(items: QTItem[]): void {
    this.clear();
    for (const item of items) {
      this.itemMap.set(item.id, item);
      this.root.insert(item);
    }
  }

  /** Get total item count */
  get size(): number {
    return this.itemMap.size;
  }

  private rebuildFromMap(): void {
    const items = Array.from(this.itemMap.values());
    this.root = new QTNode(this.root.bounds, this.capacity, 0, this.maxDepth);
    for (const item of items) {
      this.root.insert(item);
    }
  }
}
