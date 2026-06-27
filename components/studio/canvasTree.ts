// ═══════════════════════════════════════════════════════════════
// canvasTree — pure helpers for the SchemaCanvas component tree
//
// SchemaCanvas treats a screen's components[] as a nestable tree of
// absolutely-positioned frames. All mutations are immutable (clone →
// mutate → return) so the canvas can snapshot for undo and commit the
// whole tree via useRuntimeStore.updateScreen({ components }). Keeping
// this canvas-side and pure leaves lib/runtime untouched and testable.
// ═══════════════════════════════════════════════════════════════

import type { ComponentSchema } from "@/lib/runtime/schema";

/** Component types that accept nested children on the canvas. */
export const CONTAINER_TYPES = new Set(["view", "card", "form", "scroll", "modal"]);

export function isContainer(c: ComponentSchema): boolean {
  return CONTAINER_TYPES.has(c.type);
}

export interface Box { left: number; top: number; width: number; height: number; }

export function boxOf(c: ComponentSchema): Box {
  const left = (c.style?.layout?.left as number) ?? 0;
  const top = (c.style?.layout?.top as number) ?? 0;
  const width = typeof c.style?.sizing?.width === "number" ? (c.style.sizing.width as number) : 120;
  const height = typeof c.style?.sizing?.height === "number" ? (c.style.sizing.height as number) : 40;
  return { left, top, width, height };
}

export function clone<T>(v: T): T {
  return structuredClone(v);
}

/** True when a component carries an explicit absolute position (canvas-placed). */
export function isAbsolute(c: ComponentSchema): boolean {
  const l = c.style?.layout;
  return l?.position === "absolute" && (typeof l.left === "number" || typeof l.top === "number");
}

/** Default rendered height per component type, used by the flow fallback. */
export function defaultHeight(type: string): number {
  switch (type) {
    case "text": return 26;
    case "statusChip": return 28;
    case "checkbox": return 28;
    case "switch": return 30;
    case "divider": return 10;
    case "button": case "input": case "select": case "datePicker": case "searchInput": return 46;
    case "fileUpload": return 48;
    case "statCard": return 100;
    case "image": return 160;
    case "timeline": return 160;
    case "chart": return 200;
    case "dataTable": return 220;
    default: return 48;
  }
}

/**
 * Lay components out in a vertical flow (parent-relative boxes), so schemas
 * authored without absolute positions (export-style / programmatic) render
 * readably on the canvas instead of collapsing to (0,0). Components that DO
 * carry an absolute position are honored as-is (canvas-dragged ones). Returns
 * a flat Map of every node id → parent-relative box, plus the total height.
 */
export function flowLayout(
  nodes: ComponentSchema[],
  innerWidth: number,
  pad = 14,
  gap = 10
): { boxes: Map<string, Box>; height: number } {
  const boxes = new Map<string, Box>();
  let y = pad;
  for (const n of nodes) {
    const explicitW = typeof n.style?.sizing?.width === "number" ? (n.style.sizing.width as number) : undefined;
    const explicitH = typeof n.style?.sizing?.height === "number" ? (n.style.sizing.height as number) : undefined;
    const w = explicitW ?? Math.max(40, innerWidth - pad * 2);

    let h: number;
    if (isContainer(n) && n.children?.length) {
      const sub = flowLayout(n.children, w, pad, gap);
      for (const [k, v] of sub.boxes) boxes.set(k, v);
      h = explicitH ?? Math.max(sub.height, 48);
    } else {
      h = explicitH ?? defaultHeight(n.type);
    }

    if (isAbsolute(n)) {
      boxes.set(n.id, boxOf(n)); // honor canvas-placed components
    } else {
      boxes.set(n.id, { left: pad, top: y, width: w, height: h });
      y += h + gap;
    }
  }
  return { boxes, height: y - gap + pad };
}

/** Depth-first find by id. */
export function findNode(nodes: ComponentSchema[], id: string): ComponentSchema | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children?.length) {
      const found = findNode(n.children, id);
      if (found) return found;
    }
  }
  return null;
}

/** Path of nodes root→target (inclusive), or null. */
export function findPath(nodes: ComponentSchema[], id: string, trail: ComponentSchema[] = []): ComponentSchema[] | null {
  for (const n of nodes) {
    const next = [...trail, n];
    if (n.id === id) return next;
    if (n.children?.length) {
      const found = findPath(n.children, id, next);
      if (found) return found;
    }
  }
  return null;
}

/** Sum of ancestor left/top — converts parent-relative coords to artboard coords. */
export function absoluteOffset(nodes: ComponentSchema[], id: string): { x: number; y: number } {
  const path = findPath(nodes, id);
  if (!path) return { x: 0, y: 0 };
  let x = 0, y = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const b = boxOf(path[i]);
    x += b.left; y += b.top;
  }
  return { x, y };
}

/** id → parent id (null = top level). */
export function parentIdOf(nodes: ComponentSchema[], id: string): string | null {
  const path = findPath(nodes, id);
  if (!path || path.length < 2) return null;
  return path[path.length - 2].id;
}

/** Immutable: mutate the node with `id` via `fn`, return a new tree. */
export function mutate(nodes: ComponentSchema[], id: string, fn: (n: ComponentSchema) => void): ComponentSchema[] {
  const copy = clone(nodes);
  const target = findNode(copy, id);
  if (target) fn(target);
  return copy;
}

/** Immutable: mutate every node in `ids` via `fn`, return a new tree. */
export function mutateMany(nodes: ComponentSchema[], ids: Set<string>, fn: (n: ComponentSchema) => void): ComponentSchema[] {
  const copy = clone(nodes);
  const visit = (arr: ComponentSchema[]) => {
    for (const n of arr) {
      if (ids.has(n.id)) fn(n);
      if (n.children?.length) visit(n.children);
    }
  };
  visit(copy);
  return copy;
}

/** Immutable: remove all nodes in `ids` (and their subtrees), return a new tree. */
export function removeNodes(nodes: ComponentSchema[], ids: Set<string>): ComponentSchema[] {
  const filter = (arr: ComponentSchema[]): ComponentSchema[] =>
    arr
      .filter((n) => !ids.has(n.id))
      .map((n) => (n.children?.length ? { ...n, children: filter(n.children) } : n));
  return filter(clone(nodes));
}

/** Immutable: insert `node` under `parentId` (null = top level). */
export function insertNode(nodes: ComponentSchema[], parentId: string | null, node: ComponentSchema): ComponentSchema[] {
  if (parentId === null) return [...clone(nodes), clone(node)];
  return mutate(nodes, parentId, (p) => {
    if (!p.children) p.children = [];
    p.children.push(clone(node));
  });
}

/**
 * Immutable: move `id` to `newParentId` (null = top) at artboard position
 * (absX, absY). Converts the absolute drop point to coords relative to the
 * new parent. Returns the new tree (no-op if it would nest a node in itself).
 */
export function reparentNode(
  nodes: ComponentSchema[],
  id: string,
  newParentId: string | null,
  absX: number,
  absY: number
): ComponentSchema[] {
  if (id === newParentId) return nodes;
  // Guard: cannot move a node into its own descendant.
  if (newParentId && findNode([findNodeOrEmpty(nodes, id)], newParentId)) return nodes;

  const moving = findNode(nodes, id);
  if (!moving) return nodes;
  const node = clone(moving);

  const without = removeNodes(nodes, new Set([id]));
  const parentOffset = newParentId ? absoluteOffset(without, newParentId) : { x: 0, y: 0 };
  // Parent's own box also offsets its content origin.
  const parentBox = newParentId ? boxOf(findNodeOrEmpty(without, newParentId)) : { left: 0, top: 0 };
  const relLeft = Math.round(absX - parentOffset.x - (newParentId ? parentBox.left : 0));
  const relTop = Math.round(absY - parentOffset.y - (newParentId ? parentBox.top : 0));

  node.style = {
    ...node.style,
    layout: { ...(node.style?.layout || {}), position: "absolute", left: Math.max(0, relLeft), top: Math.max(0, relTop) },
  };
  return insertNode(without, newParentId, node);
}

function findNodeOrEmpty(nodes: ComponentSchema[], id: string): ComponentSchema {
  return findNode(nodes, id) ?? ({ id, type: "view", props: {}, bindings: {}, style: {}, children: [] } as ComponentSchema);
}

/** Deep clone a subtree with fresh ids on every node (for copy/paste/duplicate). */
export function regenIds(node: ComponentSchema): ComponentSchema {
  const fresh = (n: ComponentSchema): ComponentSchema => ({
    ...clone(n),
    id: `${n.type}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    children: n.children?.length ? n.children.map(fresh) : n.children,
  });
  return fresh(node);
}

/**
 * Hit-test: deepest container whose absolute box contains (absX, absY),
 * excluding `exclude` ids (the nodes being dragged). null = artboard/top.
 */
export function containerAt(
  nodes: ComponentSchema[],
  absX: number,
  absY: number,
  exclude: Set<string>
): string | null {
  let best: string | null = null;
  let bestDepth = -1;
  const visit = (arr: ComponentSchema[], offX: number, offY: number, depth: number) => {
    for (const n of arr) {
      const b = boxOf(n);
      const x = offX + b.left;
      const y = offY + b.top;
      const inside = absX >= x && absX <= x + b.width && absY >= y && absY <= y + b.height;
      if (isContainer(n) && !exclude.has(n.id) && inside && depth > bestDepth) {
        best = n.id;
        bestDepth = depth;
      }
      if (n.children?.length) visit(n.children, x, y, depth + 1);
    }
  };
  visit(nodes, 0, 0, 0);
  return best;
}
