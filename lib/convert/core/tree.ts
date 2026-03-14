// ═══════════════════════════════════════════════════════════════
// Tree Builder — Transforms Design Nodes → Drawable Nodes
// Handles position normalization, fill resolution, and UX detection
// ═══════════════════════════════════════════════════════════════

import type {
  DesignNode,
  DrawableNode,
  Fill,
  Stroke,
  Effect,
  UXEnhancements,
  Interaction,
  BlendMode,
  ScrollViewProperties,
  OverflowBehavior,
} from "../types";

// ── Build Drawable Tree ───────────────────────────────────────

/**
 * Converts a flat or hierarchical design node structure into
 * a normalized drawable tree with computed absolute positions.
 */
export function buildDrawableTree(
  nodes: DesignNode[],
  parentAX = 0,
  parentAY = 0,
  interactions?: Interaction[]
): DrawableNode[] {
  return nodes.map((node) => {
    // Compute absolute position
    const ax = node.absoluteX ?? parentAX + node.x;
    const ay = node.absoluteY ?? parentAY + node.y;

    // Normalize fill (pick best fill from array)
    const fill = normalizeFill(node.fills);

    // Normalize stroke (pick primary stroke)
    const stroke = normalizeStroke(node.strokes);

    // Process effects
    const effects = normalizeEffects(node.effects);

    // Find interactions for this node
    const nodeInteractions = interactions?.filter((i) => i.sourceId === node.id);

    // Build scroll properties from design node
    const scroll = buildScrollProperties(node);

    // Build drawable node
    const drawable: DrawableNode = {
      id: node.id,
      name: sanitizeName(node.name || node.type),
      type: node.type,
      x: node.x,
      y: node.y,
      ax,
      ay,
      w: node.width,
      h: node.height,
      fill,
      stroke,
      effects,
      corners: node.corners,
      opacity: node.opacity,
      mixBlendMode: blendModeToCSS(node.blendMode),
      text: node.text,
      layout: node.layout,
      scroll,
      transform: node.rotation ? { rotation: node.rotation } : undefined,
      interactions: nodeInteractions?.length ? nodeInteractions : undefined,
      originalNode: node,
    };

    // Process children recursively
    if (node.children?.length) {
      drawable.children = buildDrawableTree(node.children, ax, ay, interactions);
    }

    return drawable;
  });
}

// ── Fill Normalization ────────────────────────────────────────

/**
 * Selects the most appropriate fill from an array.
 * Priority: IMAGE > GRADIENT > SOLID (visible fills only)
 */
function normalizeFill(fills?: Fill[]): Fill | undefined {
  if (!fills?.length) return undefined;

  // Filter visible fills
  const visible = fills.filter((f) => f.visible !== false);
  if (!visible.length) return undefined;

  // Priority: IMAGE > GRADIENT > SOLID
  const image = visible.find((f) => f.type === "IMAGE" && f.imageRef);
  if (image) return image;

  const gradient = visible.find((f) => f.type.startsWith("GRADIENT"));
  if (gradient) return gradient;

  const solid = visible.find((f) => f.type === "SOLID" && f.color);
  if (solid) return solid;

  return visible[0];
}

// ── Stroke Normalization ──────────────────────────────────────

function normalizeStroke(strokes?: Stroke[]): Stroke | undefined {
  if (!strokes?.length) return undefined;

  // Pick first stroke with weight > 0
  return strokes.find((s) => s.weight && s.weight > 0);
}

// ── Effect Normalization ──────────────────────────────────────

function normalizeEffects(effects?: Effect[]): Effect[] | undefined {
  if (!effects?.length) return undefined;

  return effects
    .filter((e) => e.visible !== false)
    .map((e) => ({
      ...e,
      // Pre-compute CSS values for optimization
      boxShadow: computeBoxShadow(e),
      filter: computeFilter(e),
      backdropFilter: computeBackdropFilter(e),
    }));
}

function computeBoxShadow(effect: Effect): string | undefined {
  if (effect.type !== "DROP_SHADOW" && effect.type !== "INNER_SHADOW") {
    return undefined;
  }

  const inset = effect.type === "INNER_SHADOW" ? "inset " : "";
  const x = effect.offsetX ?? 0;
  const y = effect.offsetY ?? 0;
  const blur = effect.blur ?? 0;
  const spread = effect.spread ?? 0;
  const color = effect.color ?? "rgba(0,0,0,0.25)";

  return `${inset}${x}px ${y}px ${blur}px ${spread}px ${color}`;
}

function computeFilter(effect: Effect): string | undefined {
  if (effect.type !== "LAYER_BLUR") return undefined;
  return `blur(${effect.blur ?? 0}px)`;
}

function computeBackdropFilter(effect: Effect): string | undefined {
  if (effect.type !== "BACKGROUND_BLUR") return undefined;
  return `blur(${effect.blur ?? 0}px)`;
}

// ── Blend Mode Mapping ────────────────────────────────────────

function blendModeToCSS(mode?: BlendMode): string | undefined {
  if (!mode || mode === "PASS_THROUGH" || mode === "NORMAL") {
    return undefined;
  }

  const map: Record<BlendMode, string> = {
    PASS_THROUGH: "normal",
    NORMAL: "normal",
    DARKEN: "darken",
    MULTIPLY: "multiply",
    LINEAR_BURN: "color-burn",
    COLOR_BURN: "color-burn",
    LIGHTEN: "lighten",
    SCREEN: "screen",
    LINEAR_DODGE: "color-dodge",
    COLOR_DODGE: "color-dodge",
    OVERLAY: "overlay",
    SOFT_LIGHT: "soft-light",
    HARD_LIGHT: "hard-light",
    DIFFERENCE: "difference",
    EXCLUSION: "exclusion",
    HUE: "hue",
    SATURATION: "saturation",
    COLOR: "color",
    LUMINOSITY: "luminosity",
  };

  return map[mode];
}

// ── Scroll Property Detection ─────────────────────────────────

/**
 * Builds ScrollViewProperties from a DesignNode.
 * Maps Figma/Penpot clip + overflow settings into our normalized model.
 */
function buildScrollProperties(
  node: DesignNode
): ScrollViewProperties | undefined {
  const hasClip = node.clipContent === true;
  const overflow = node.overflowBehavior as OverflowBehavior | undefined;
  const fixed = node.fixedWhenScrolling === true;

  if (!hasClip && !overflow && !fixed) return undefined;

  return {
    clipContent: hasClip || undefined,
    overflowBehavior: overflow || undefined,
    fixedWhenScrolling: fixed || undefined,
  };
}

// ── Name Sanitization ─────────────────────────────────────────

/**
 * Converts design layer names to valid identifiers
 */
function sanitizeName(name: string): string {
  // Remove special characters, keep alphanumeric and spaces
  let clean = name.replace(/[^\w\s-]/g, "");
  // Replace spaces with camelCase
  clean = clean.replace(/\s+(.)/g, (_, c) => c.toUpperCase());
  // Ensure starts with letter
  if (/^\d/.test(clean)) {
    clean = "_" + clean;
  }
  return clean || "Element";
}

// ═══════════════════════════════════════════════════════════════
// UX Enhancement Detection
// Automatically detects and applies UX patterns
// ═══════════════════════════════════════════════════════════════

/**
 * Analyzes a drawable tree and applies UX enhancements:
 * - Horizontal scroll strips
 * - Carousels with snap scrolling
 * - Elevated cards
 * - Clickable elements
 */
export function applyUXEnhancements(
  nodes: DrawableNode[],
  referenceWidth: number,
  referenceHeight: number
): DrawableNode[] {
  return nodes.map((node) => enhanceNode(node, referenceWidth, referenceHeight));
}

function enhanceNode(
  node: DrawableNode,
  refWidth: number,
  refHeight: number
): DrawableNode {
  const enhanced = { ...node };
  const ux: UXEnhancements = {};
  const explicitHorizontalScroll =
    node.scroll?.overflowBehavior === "horizontal" ||
    node.scroll?.overflowBehavior === "both";
  const isHorizontalAutoLayout =
    node.layout?.mode === "HORIZONTAL" || node.layout?.direction === "ROW";

  // ── Explicit scroll from design tool overrides auto-detection ──
  if (node.scroll?.overflowBehavior && node.scroll.overflowBehavior !== "none") {
    const ob = node.scroll.overflowBehavior;
    if (ob === "horizontal" || ob === "both") ux.scrollX = true;
    if (ob === "vertical" || ob === "both") ux.scrollY = true;
  }

  // Check for horizontal/vertical overflow (scroll strip)
  // Only auto-detect scroll when clipContent is ON — matching Figma's model
  // where "Clip Content" + overflowing children implies a scrollable viewport.
  if (node.children?.length) {
    const childrenWidth = calculateChildrenSpan(node.children, "horizontal");
    const childrenHeight = calculateChildrenSpan(node.children, "vertical");

    // Figma-style carousel pattern:
    // horizontal auto layout + clip content + (explicit horizontal overflow OR content wider than viewport)
    if (
      node.children.length >= 2 &&
      node.scroll?.clipContent &&
      isHorizontalAutoLayout &&
      (explicitHorizontalScroll || childrenWidth > node.w * 1.02)
    ) {
      ux.scrollX = true;
      ux.carousel = true;
      ux.snap = true;
      if (childrenWidth > node.w) {
        ux.peek = true;
      }
    }

    if (childrenWidth > node.w * 1.1 && node.scroll?.clipContent) {
      // Only auto-set scrollX if not explicitly "none" in the design
      if (!node.scroll.overflowBehavior || node.scroll.overflowBehavior !== "none") {
        ux.scrollX = true;
      }

      // Check for carousel pattern (3+ large items)
      if (isCarouselPattern(node.children, node.w)) {
        ux.carousel = true;
        ux.snap = true;
        ux.peek = true;
      }
    }

    if (childrenHeight > node.h * 1.1 && node.scroll?.clipContent) {
      if (!node.scroll.overflowBehavior || node.scroll.overflowBehavior !== "none") {
        ux.scrollY = true;
      }
    }

    // Apply elevation to middle cards only in carousel patterns
    if (ux.carousel) {
      enhanced.children = applyCardElevation(node.children);
    }
  }

  // If clipContent is set but no scroll direction, ensure hidden overflow
  if (node.scroll?.clipContent && !ux.scrollX && !ux.scrollY) {
    // clipContent without scroll is just overflow:hidden — cssFromUX stays empty,
    // but we preserve the scroll.clipContent flag for the style generator.
  }

  // Detect clickable elements
  if (node.interactions?.length || isLikelyButton(node)) {
    ux.isClickable = true;
  }

  if (Object.keys(ux).length > 0) {
    enhanced.ux = { ...enhanced.ux, ...ux };
  }

  // Recurse into children
  if (enhanced.children) {
    enhanced.children = enhanced.children.map((child) =>
      enhanceNode(child, refWidth, refHeight)
    );
  }

  return enhanced;
}

function calculateChildrenSpan(
  children: DrawableNode[],
  direction: "horizontal" | "vertical"
): number {
  if (!children.length) return 0;

  if (direction === "horizontal") {
    // Find rightmost edge
    return Math.max(...children.map((c) => c.x + c.w));
  } else {
    // Find bottommost edge
    return Math.max(...children.map((c) => c.y + c.h));
  }
}

function isCarouselPattern(children: DrawableNode[], containerWidth: number): boolean {
  if (children.length < 3) return false;

  // Check if items are similarly sized and horizontally arranged
  const avgWidth = children.reduce((sum, c) => sum + c.w, 0) / children.length;
  const avgHeight = children.reduce((sum, c) => sum + c.h, 0) / children.length;

  // Items should be large (>30% of container width) and similar in size
  const isLarge = avgWidth > containerWidth * 0.3;
  const isSimilarSize = children.every(
    (c) => Math.abs(c.w - avgWidth) < avgWidth * 0.2 && Math.abs(c.h - avgHeight) < avgHeight * 0.2
  );

  // Check horizontal arrangement
  const isHorizontal = children.every((c, i, arr) => {
    if (i === 0) return true;
    return c.x >= arr[i - 1].x;
  });

  return isLarge && isSimilarSize && isHorizontal;
}

function applyCardElevation(children: DrawableNode[]): DrawableNode[] {
  // If we have an odd number of items arranged horizontally,
  // elevate the middle one
  if (children.length >= 3 && children.length % 2 === 1) {
    const middleIndex = Math.floor(children.length / 2);
    return children.map((child, i) => {
      if (i === middleIndex) {
        return { ...child, ux: { ...child.ux, elevate: true } };
      }
      return child;
    });
  }
  return children;
}

function isLikelyButton(node: DrawableNode): boolean {
  const name = node.name.toLowerCase();
  const buttonKeywords = ["button", "btn", "cta", "submit", "action", "link", "click"];

  // Check name for button keywords
  if (buttonKeywords.some((kw) => name.includes(kw))) {
    return true;
  }

  // Small rectangle with text child
  if (
    (node.type === "FRAME" || node.type === "RECTANGLE") &&
    node.w < 300 &&
    node.h < 80 &&
    node.children?.some((c) => c.type === "TEXT")
  ) {
    return true;
  }

  return false;
}

// ═══════════════════════════════════════════════════════════════
// Tree Utilities
// ═══════════════════════════════════════════════════════════════

/**
 * Flattens a tree into a single array
 */
export function flattenTree(nodes: DrawableNode[]): DrawableNode[] {
  const result: DrawableNode[] = [];

  function traverse(node: DrawableNode) {
    result.push(node);
    node.children?.forEach(traverse);
  }

  nodes.forEach(traverse);
  return result;
}

/**
 * Finds a node by ID in the tree
 */
export function findNodeById(
  nodes: DrawableNode[],
  id: string
): DrawableNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Calculates the bounding box of all nodes
 */
export function calculateBoundingBox(nodes: DrawableNode[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (!nodes.length) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  function traverse(node: DrawableNode) {
    minX = Math.min(minX, node.ax);
    minY = Math.min(minY, node.ay);
    maxX = Math.max(maxX, node.ax + node.w);
    maxY = Math.max(maxY, node.ay + node.h);
    node.children?.forEach(traverse);
  }

  nodes.forEach(traverse);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Groups nodes by component
 */
export function groupByComponent(
  nodes: DrawableNode[]
): Map<string, DrawableNode[]> {
  const groups = new Map<string, DrawableNode[]>();

  function traverse(node: DrawableNode) {
    const componentId = node.originalNode?.componentId;
    if (componentId) {
      const existing = groups.get(componentId) || [];
      existing.push(node);
      groups.set(componentId, existing);
    }
    node.children?.forEach(traverse);
  }

  nodes.forEach(traverse);
  return groups;
}
