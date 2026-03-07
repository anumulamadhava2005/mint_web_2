// ═══════════════════════════════════════════════════════════════
// Auto Layout Engine — Flexbox-like layout system for canvas
//
// This is the Figma-equivalent of CSS Flexbox, running inside
// the canvas engine. When a frame has autoLayout enabled, its
// children's positions are COMPUTED rather than manually set.
//
// Pipeline:
//   Layout Tree
//       ↓
//   Measure pass (intrinsic sizes)
//       ↓
//   Layout Solver (flex algorithm)
//       ↓
//   Write computed transforms to children
//       ↓
//   Continue to transform propagation
//
// Architecture:
//   - Each auto-layout frame acts as a flex container
//   - Children can have flex-grow, flex-shrink, alignSelf
//   - Supports row/column, spacing, padding, alignment
//   - Supports "hug contents" sizing mode
//   - Supports "fill container" sizing mode
// ═══════════════════════════════════════════════════════════════

import type {
  CanvasShape,
  AutoLayout,
  LayoutChildOverrides,
  LayoutDirection,
  LayoutAlign,
  LayoutJustify,
  SizingMode,
} from "./canvasEngine";

// ── Layout Node (intermediate representation) ─────────────────

interface LayoutNode {
  id: string;
  /** Intrinsic (measured) size */
  intrinsicWidth: number;
  intrinsicHeight: number;
  /** Computed position within parent (after layout) */
  computedX: number;
  computedY: number;
  /** Computed size (may differ from intrinsic after flex) */
  computedWidth: number;
  computedHeight: number;
  /** Child overrides */
  overrides: LayoutChildOverrides;
  /** Reference to original shape */
  shape: CanvasShape;
}

/** Default layout child overrides */
const DEFAULT_OVERRIDES: LayoutChildOverrides = {
  horizontalSizing: "fixed",
  verticalSizing: "fixed",
  flexGrow: 0,
  flexShrink: 1,
};

/**
 * The Auto Layout Engine computes positions for all children
 * of frames that have autoLayout enabled.
 */
export class AutoLayoutEngine {
  /**
   * Run layout for a single auto-layout frame.
   * Returns updated children with computed positions.
   */
  layout(
    parent: CanvasShape,
    children: CanvasShape[],
    lookup: Map<string, CanvasShape>,
  ): CanvasShape[] {
    const al = parent.autoLayout;
    if (!al) return children;

    // Filter to direct children only, sorted by zIndex
    const directChildren = children
      .filter(c => c.parentId === parent.id && c.visible)
      .sort((a, b) => a.zIndex - b.zIndex);

    if (directChildren.length === 0) return children;

    // Build layout nodes
    const nodes: LayoutNode[] = directChildren.map(child => ({
      id: child.id,
      intrinsicWidth: child.width,
      intrinsicHeight: child.height,
      computedX: 0,
      computedY: 0,
      computedWidth: child.width,
      computedHeight: child.height,
      overrides: child.layoutChildOverrides ?? DEFAULT_OVERRIDES,
      shape: child,
    }));

    // Determine main and cross axes
    const isRow = al.direction === "row";

    // Available space (after padding)
    const availableMain = isRow
      ? parent.width - al.paddingLeft - al.paddingRight
      : parent.height - al.paddingTop - al.paddingBottom;
    const availableCross = isRow
      ? parent.height - al.paddingTop - al.paddingBottom
      : parent.width - al.paddingLeft - al.paddingRight;

    // ── Measure pass ──────────────────────────────────────
    // Compute initial main-axis size for each child
    const totalSpacing = Math.max(0, (nodes.length - 1)) * al.spacing;
    let totalFixedMain = totalSpacing;
    let totalFlexGrow = 0;
    let totalFlexShrink = 0;

    for (const node of nodes) {
      const mainSizing = isRow ? node.overrides.horizontalSizing : node.overrides.verticalSizing;
      const mainSize = isRow ? node.intrinsicWidth : node.intrinsicHeight;

      if (mainSizing === "fill") {
        totalFlexGrow += Math.max(node.overrides.flexGrow, 1);
      } else {
        totalFixedMain += mainSize;
        totalFlexShrink += node.overrides.flexShrink;
      }
    }

    // ── Flex resolve ──────────────────────────────────────
    const remainingSpace = availableMain - totalFixedMain;

    for (const node of nodes) {
      const mainSizing = isRow ? node.overrides.horizontalSizing : node.overrides.verticalSizing;
      const crossSizing = isRow ? node.overrides.verticalSizing : node.overrides.horizontalSizing;

      // Main axis sizing
      if (mainSizing === "fill" && remainingSpace > 0 && totalFlexGrow > 0) {
        const grow = Math.max(node.overrides.flexGrow, 1);
        const flexSize = (grow / totalFlexGrow) * remainingSpace;
        if (isRow) {
          node.computedWidth = Math.max(1, flexSize);
        } else {
          node.computedHeight = Math.max(1, flexSize);
        }
      } else if (mainSizing !== "fill" && remainingSpace < 0 && totalFlexShrink > 0) {
        // Shrink
        const mainSize = isRow ? node.intrinsicWidth : node.intrinsicHeight;
        const shrinkRatio = node.overrides.flexShrink / totalFlexShrink;
        const shrinkAmount = Math.abs(remainingSpace) * shrinkRatio;
        if (isRow) {
          node.computedWidth = Math.max(1, mainSize - shrinkAmount);
        } else {
          node.computedHeight = Math.max(1, mainSize - shrinkAmount);
        }
      }

      // Cross axis sizing
      if (crossSizing === "fill" || (node.overrides.alignSelf ?? al.alignItems) === "stretch") {
        if (isRow) {
          node.computedHeight = availableCross;
        } else {
          node.computedWidth = availableCross;
        }
      }
    }

    // ── Position pass ─────────────────────────────────────
    // Compute main-axis positions
    const totalComputedMain = nodes.reduce(
      (sum, n) => sum + (isRow ? n.computedWidth : n.computedHeight),
      0,
    ) + totalSpacing;

    let mainOffset = this.computeJustifyOffset(
      al.justifyContent,
      availableMain,
      totalComputedMain,
      nodes.length,
    );

    const mainStart = isRow ? al.paddingLeft : al.paddingTop;
    const crossStart = isRow ? al.paddingTop : al.paddingLeft;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const mainSize = isRow ? node.computedWidth : node.computedHeight;
      const crossSize = isRow ? node.computedHeight : node.computedWidth;

      // Main axis position
      const mainPos = mainStart + mainOffset;

      // Cross axis alignment
      const alignment = node.overrides.alignSelf ?? al.alignItems;
      const crossPos = this.computeCrossOffset(alignment, availableCross, crossSize) + crossStart;

      if (isRow) {
        node.computedX = mainPos;
        node.computedY = crossPos;
      } else {
        node.computedX = crossPos;
        node.computedY = mainPos;
      }

      mainOffset += mainSize;

      // Add spacing (and/or justify gap)
      if (i < nodes.length - 1) {
        mainOffset += this.computeItemSpacing(
          al.justifyContent,
          al.spacing,
          availableMain,
          totalComputedMain,
          nodes.length,
        );
      }
    }

    // ── Write results back to shapes ──────────────────────
    const updatedMap = new Map<string, Partial<CanvasShape>>();
    for (const node of nodes) {
      updatedMap.set(node.id, {
        x: node.computedX,
        y: node.computedY,
        width: node.computedWidth,
        height: node.computedHeight,
        layoutPositioned: true,
      });
    }

    return children.map(child => {
      const update = updatedMap.get(child.id);
      if (update) {
        return { ...child, ...update };
      }
      return child;
    });
  }

  /**
   * Compute the "hug contents" size for an auto-layout frame.
   * Returns the minimum size needed to contain all children.
   */
  computeHugSize(
    parent: CanvasShape,
    children: CanvasShape[],
  ): { width: number; height: number } {
    const al = parent.autoLayout;
    if (!al) return { width: parent.width, height: parent.height };

    const directChildren = children
      .filter(c => c.parentId === parent.id && c.visible)
      .sort((a, b) => a.zIndex - b.zIndex);

    if (directChildren.length === 0) {
      return {
        width: al.paddingLeft + al.paddingRight,
        height: al.paddingTop + al.paddingBottom,
      };
    }

    const isRow = al.direction === "row";
    const totalSpacing = Math.max(0, directChildren.length - 1) * al.spacing;

    if (isRow) {
      const totalWidth = directChildren.reduce((sum, c) => sum + c.width, 0) + totalSpacing;
      const maxHeight = Math.max(...directChildren.map(c => c.height));
      return {
        width: al.paddingLeft + totalWidth + al.paddingRight,
        height: al.paddingTop + maxHeight + al.paddingBottom,
      };
    } else {
      const maxWidth = Math.max(...directChildren.map(c => c.width));
      const totalHeight = directChildren.reduce((sum, c) => sum + c.height, 0) + totalSpacing;
      return {
        width: al.paddingLeft + maxWidth + al.paddingRight,
        height: al.paddingTop + totalHeight + al.paddingBottom,
      };
    }
  }

  /**
   * Solve layout for the entire shape tree.
   * Processes auto-layout frames bottom-up (children first),
   * then applies constraint solving and writes transforms.
   */
  solveAll(shapes: CanvasShape[]): CanvasShape[] {
    const lookup = new Map<string, CanvasShape>();
    for (const s of shapes) lookup.set(s.id, s);

    // Find all auto-layout frames, process bottom-up
    const alFrames = shapes.filter(s => s.type === "frame" && s.autoLayout);

    // Sort by depth (deepest first) for bottom-up processing
    const depthCache = new Map<string, number>();
    const getDepth = (id: string): number => {
      if (depthCache.has(id)) return depthCache.get(id)!;
      const s = lookup.get(id);
      if (!s || !s.parentId) {
        depthCache.set(id, 0);
        return 0;
      }
      const d = 1 + getDepth(s.parentId);
      depthCache.set(id, d);
      return d;
    };

    alFrames.sort((a, b) => getDepth(b.id) - getDepth(a.id));

    let result = [...shapes];
    for (const frame of alFrames) {
      const currentFrame = result.find(s => s.id === frame.id);
      if (!currentFrame?.autoLayout) continue;

      result = this.layout(currentFrame, result, lookup);
    }

    return result;
  }

  // ── Private helpers ─────────────────────────────────────

  private computeJustifyOffset(
    justify: LayoutJustify,
    available: number,
    totalContent: number,
    itemCount: number,
  ): number {
    const freeSpace = available - totalContent;
    switch (justify) {
      case "start": return 0;
      case "center": return Math.max(0, freeSpace / 2);
      case "end": return Math.max(0, freeSpace);
      case "space-between": return 0; // Handled in spacing
      case "space-around": return itemCount > 0 ? Math.max(0, freeSpace / (itemCount * 2)) : 0;
      default: return 0;
    }
  }

  private computeItemSpacing(
    justify: LayoutJustify,
    baseSpacing: number,
    available: number,
    totalContent: number,
    itemCount: number,
  ): number {
    const freeSpace = available - totalContent + (itemCount - 1) * baseSpacing;
    switch (justify) {
      case "space-between":
        return itemCount > 1 ? Math.max(baseSpacing, freeSpace / (itemCount - 1)) : baseSpacing;
      case "space-around":
        return itemCount > 0 ? Math.max(baseSpacing, freeSpace / itemCount) : baseSpacing;
      default:
        return baseSpacing;
    }
  }

  private computeCrossOffset(
    alignment: LayoutAlign,
    availableCross: number,
    childCross: number,
  ): number {
    switch (alignment) {
      case "start": return 0;
      case "center": return Math.max(0, (availableCross - childCross) / 2);
      case "end": return Math.max(0, availableCross - childCross);
      case "stretch": return 0; // Size already stretched
      default: return 0;
    }
  }
}
