// ═══════════════════════════════════════════════════════════════
// Flex Layout Engine — Penpot-style flex layout for frames
// Mirrors: common/src/app/common/geom/shapes/flex_layout/
// ═══════════════════════════════════════════════════════════════

import type { UUID, PenpotShape, FlexDirection, FlexAlign, FlexJustify } from "../types";
import type { Bounds, ModifTree } from "./modifiers";
import { getOrCreateModifiers, moveModifiers, resizeModifiers } from "./modifiers";
import { isAbsolutelyPositioned } from "./constraints";

// ── Layout Data Structures ────────────────────────────────────

interface ChildLayoutData {
  id: UUID;
  bounds: Bounds;
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  hSizing: "auto" | "fill" | "fix";
  vSizing: "auto" | "fill" | "fix";
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  alignSelf?: FlexAlign;
  grow: number;
}

interface LayoutLine {
  children: ChildLayoutData[];
  lineWidth: number;
  lineHeight: number;
  lineMinWidth: number;
  lineMinHeight: number;
  /** Total main-axis size of fixed + auto children */
  totalFixedMain: number;
  /** Total fill-grow units */
  totalFillGrow: number;
  /** Number of fill children */
  numFillChildren: number;
}

interface FlexLayoutData {
  layoutBounds: Bounds;
  isRow: boolean;
  isReverse: boolean;
  gap: { row: number; col: number };
  alignItems: FlexAlign;
  alignContent: FlexAlign;
  justifyContent: FlexJustify;
  wrap: boolean;
  lines: LayoutLine[];
}

// ── Main Entry Point ──────────────────────────────────────────

/**
 * Calculate flex layout modifiers for all non-absolute children of a parent frame.
 *
 * @param parent - Parent shape with layout props
 * @param objects - All page objects
 * @param boundsMap - Current bounds of all shapes
 * @param parentBounds - Current parent bounds
 * @returns ModifTree with position/resize modifiers for children
 */
export function calcFlexLayoutModifiers(
  parent: PenpotShape,
  objects: Record<UUID, PenpotShape>,
  boundsMap: Map<UUID, Bounds>,
  parentBounds: Bounds
): ModifTree {
  const modifTree: ModifTree = new Map();
  const lp = parent.layoutProps;
  if (!lp?.layout || lp.layout !== "flex") return modifTree;

  // Gather non-absolute direct children
  const childIds = (parent.shapes || []).filter((cid) => {
    const child = objects[cid];
    return child && !child.hidden && !isAbsolutelyPositioned(child);
  });

  if (childIds.length === 0) return modifTree;

  // Parse layout properties
  const layoutData = buildFlexLayoutData(parent, parentBounds, childIds, objects, boundsMap);

  // Position children within each line
  applyFlexPositions(layoutData, modifTree, objects, boundsMap);

  return modifTree;
}

// ── Build Layout Data ─────────────────────────────────────────

function buildFlexLayoutData(
  parent: PenpotShape,
  parentBounds: Bounds,
  childIds: UUID[],
  objects: Record<UUID, PenpotShape>,
  boundsMap: Map<UUID, Bounds>
): FlexLayoutData {
  const lp = parent.layoutProps!;
  const dir = lp.layoutFlexDir || "row";
  const isRow = dir === "row" || dir === "row-reverse";
  const isReverse = dir === "row-reverse" || dir === "column-reverse";

  const padTop = lp.layoutPaddingTop || 0;
  const padRight = lp.layoutPaddingRight || 0;
  const padBottom = lp.layoutPaddingBottom || 0;
  const padLeft = lp.layoutPaddingLeft || 0;

  const layoutBounds: Bounds = {
    x: parentBounds.x + padLeft,
    y: parentBounds.y + padTop,
    width: Math.max(0, parentBounds.width - padLeft - padRight),
    height: Math.max(0, parentBounds.height - padTop - padBottom),
  };

  const gap = {
    row: lp.layoutGapRow ?? lp.layoutGap ?? 0,
    col: lp.layoutGapColumn ?? lp.layoutGap ?? 0,
  };

  const alignItems = lp.layoutAlignItems || "start";
  const justifyContent = lp.layoutJustifyContent || "start";
  const wrap = lp.layoutWrapType === "wrap";
  const alignContent = (lp as any).layoutAlignContent || "start";

  // Build child data
  const childrenData = buildChildrenData(childIds, objects, boundsMap, isRow);

  // Order children
  const orderedChildren = isReverse ? [...childrenData].reverse() : childrenData;

  // Build lines
  const mainGap = isRow ? gap.col : gap.row;
  const lines = buildLines(orderedChildren, layoutBounds, isRow, wrap, mainGap);

  return {
    layoutBounds,
    isRow,
    isReverse,
    gap,
    alignItems,
    alignContent: alignContent as FlexAlign,
    justifyContent,
    wrap,
    lines,
  };
}

function buildChildrenData(
  childIds: UUID[],
  objects: Record<UUID, PenpotShape>,
  boundsMap: Map<UUID, Bounds>,
  isRow: boolean
): ChildLayoutData[] {
  return childIds.map((id) => {
    const child = objects[id];
    const bounds = boundsMap.get(id) || {
      x: child.x,
      y: child.y,
      width: child.width,
      height: child.height,
    };

    const lip = child.layoutItemProps;
    const margin = (lip as any)?.layoutItemMargin || {};

    return {
      id,
      bounds,
      minWidth: (lip as any)?.layoutItemMinW ?? 0.01,
      maxWidth: (lip as any)?.layoutItemMaxW ?? Infinity,
      minHeight: (lip as any)?.layoutItemMinH ?? 0.01,
      maxHeight: (lip as any)?.layoutItemMaxH ?? Infinity,
      hSizing: lip?.layoutItemHSizing || "fix",
      vSizing: lip?.layoutItemVSizing || "fix",
      marginTop: margin.m1 || 0,
      marginRight: margin.m2 || 0,
      marginBottom: margin.m3 || 0,
      marginLeft: margin.m4 || 0,
      alignSelf: lip?.layoutItemAlignSelf,
      grow: lip?.layoutItemGrow ?? 1,
    };
  });
}

/**
 * Distribute children into layout lines (wrapping support).
 */
function buildLines(
  children: ChildLayoutData[],
  layoutBounds: Bounds,
  isRow: boolean,
  wrap: boolean,
  mainGap: number
): LayoutLine[] {
  const availableMain = isRow ? layoutBounds.width : layoutBounds.height;
  const lines: LayoutLine[] = [];
  let currentLine: LayoutLine = createEmptyLine();
  let accMain = 0;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const childMainSize = getChildMainSize(child, isRow);
    const childCrossSize = getChildCrossSize(child, isRow);
    const childMainMargin = isRow
      ? child.marginLeft + child.marginRight
      : child.marginTop + child.marginBottom;

    const needed = childMainSize + childMainMargin + (currentLine.children.length > 0 ? mainGap : 0);

    // Should wrap?
    if (wrap && currentLine.children.length > 0 && accMain + needed > availableMain + 0.5) {
      lines.push(currentLine);
      currentLine = createEmptyLine();
      accMain = 0;
    }

    currentLine.children.push(child);

    const isFixOrAuto = isRow
      ? child.hSizing !== "fill"
      : child.vSizing !== "fill";

    if (isFixOrAuto) {
      currentLine.totalFixedMain += childMainSize + childMainMargin;
    } else {
      currentLine.totalFillGrow += child.grow;
      currentLine.numFillChildren++;
    }

    accMain += needed;

    // Track line cross size
    const childCrossMargin = isRow
      ? child.marginTop + child.marginBottom
      : child.marginLeft + child.marginRight;
    currentLine.lineHeight = isRow
      ? Math.max(currentLine.lineHeight, childCrossSize + childCrossMargin)
      : currentLine.lineHeight; // main axis is column → lineHeight = main
    currentLine.lineWidth = isRow
      ? currentLine.lineWidth
      : Math.max(currentLine.lineWidth, childCrossSize + childCrossMargin); // cross for column

    if (isRow) {
      currentLine.lineWidth = accMain;
    } else {
      currentLine.lineHeight = accMain;
    }
  }

  if (currentLine.children.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}

function createEmptyLine(): LayoutLine {
  return {
    children: [],
    lineWidth: 0,
    lineHeight: 0,
    lineMinWidth: 0,
    lineMinHeight: 0,
    totalFixedMain: 0,
    totalFillGrow: 0,
    numFillChildren: 0,
  };
}

function getChildMainSize(child: ChildLayoutData, isRow: boolean): number {
  return isRow ? child.bounds.width : child.bounds.height;
}

function getChildCrossSize(child: ChildLayoutData, isRow: boolean): number {
  return isRow ? child.bounds.height : child.bounds.width;
}

// ── Apply Flex Positions ──────────────────────────────────────

function applyFlexPositions(
  layoutData: FlexLayoutData,
  modifTree: ModifTree,
  objects: Record<UUID, PenpotShape>,
  boundsMap: Map<UUID, Bounds>
): void {
  const {
    layoutBounds,
    isRow,
    gap,
    alignItems,
    alignContent,
    justifyContent,
    lines,
  } = layoutData;

  const mainGap = isRow ? gap.col : gap.row;
  const crossGap = isRow ? gap.row : gap.col;

  const availableMain = isRow ? layoutBounds.width : layoutBounds.height;
  const availableCross = isRow ? layoutBounds.height : layoutBounds.width;

  // Calculate total cross size of all lines
  const totalLineCross = lines.reduce((sum, line) => {
    return sum + getLineCrossSize(line, isRow);
  }, 0) + Math.max(0, lines.length - 1) * crossGap;

  // Calculate cross-axis start based on align-content
  let crossOffset = calcAlignContentOffset(alignContent, availableCross, totalLineCross, lines.length, crossGap);
  const crossBetween = calcAlignContentBetween(alignContent, availableCross, totalLineCross, lines.length, crossGap);

  // Process each line
  for (const line of lines) {
    const lineCross = getLineCrossSize(line, isRow);

    // Calculate total main size of this line's children (after fill sizing)
    const totalGaps = Math.max(0, line.children.length - 1) * mainGap;
    const fixedAndAutoMain = line.totalFixedMain + totalGaps;
    const remainingMain = Math.max(0, availableMain - fixedAndAutoMain);

    // Size fill children
    for (const child of line.children) {
      const isFillMain = isRow ? child.hSizing === "fill" : child.vSizing === "fill";
      const isFillCross = isRow ? child.vSizing === "fill" : child.hSizing === "fill";

      if (isFillMain && line.totalFillGrow > 0) {
        const share = (child.grow / line.totalFillGrow) * remainingMain;
        const mainMargin = isRow
          ? child.marginLeft + child.marginRight
          : child.marginTop + child.marginBottom;
        const targetMainSize = Math.max(
          isRow ? child.minWidth : child.minHeight,
          Math.min(
            isRow ? child.maxWidth : child.maxHeight,
            share - mainMargin
          )
        );
        applyFillResize(child, modifTree, isRow, true, targetMainSize);
      }

      // Cross-axis fill
      const effectiveAlign = child.alignSelf || alignItems;
      if (isFillCross || effectiveAlign === "stretch") {
        const crossMargin = isRow
          ? child.marginTop + child.marginBottom
          : child.marginLeft + child.marginRight;
        const targetCrossSize = Math.max(
          isRow ? child.minHeight : child.minWidth,
          Math.min(
            isRow ? child.maxHeight : child.maxWidth,
            lineCross - crossMargin
          )
        );
        applyFillResize(child, modifTree, isRow, false, targetCrossSize);
      }
    }

    // Position children along main axis
    const actualTotalMain = calcLineActualMain(line, isRow, mainGap);
    let mainOffset = calcJustifyOffset(justifyContent, availableMain, actualTotalMain);
    const mainBetween = calcJustifyBetween(justifyContent, availableMain, actualTotalMain, line.children.length, mainGap);

    for (let i = 0; i < line.children.length; i++) {
      const child = line.children[i];

      // Main-axis margin before
      const mainMarginBefore = isRow ? child.marginLeft : child.marginTop;
      const mainMarginAfter = isRow ? child.marginRight : child.marginBottom;
      const crossMarginBefore = isRow ? child.marginTop : child.marginLeft;

      mainOffset += mainMarginBefore;

      // Cross-axis alignment
      const effectiveAlign = child.alignSelf || alignItems;
      const currentCrossSize = isRow ? child.bounds.height : child.bounds.width;
      const crossAlignOffset = calcCrossAlignOffset(
        effectiveAlign,
        lineCross,
        currentCrossSize,
        crossMarginBefore,
        isRow ? child.marginBottom : child.marginRight
      );

      // Compute target position
      const targetMainPos = (isRow ? layoutBounds.x : layoutBounds.y) + mainOffset;
      const targetCrossPos = (isRow ? layoutBounds.y : layoutBounds.x) + crossOffset + crossAlignOffset;

      const targetX = isRow ? targetMainPos : targetCrossPos;
      const targetY = isRow ? targetCrossPos : targetMainPos;

      // Compute move delta
      const dx = targetX - child.bounds.x;
      const dy = targetY - child.bounds.y;

      if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
        const mods = getOrCreateModifiers(modifTree, child.id);
        mods.geometryChild.push(moveModifiers(dx, dy));
      }

      // Advance main offset
      const childMainSize = isRow ? child.bounds.width : child.bounds.height;
      mainOffset += childMainSize + mainMarginAfter;

      if (i < line.children.length - 1) {
        mainOffset += mainBetween;
      }
    }

    crossOffset += lineCross + crossBetween;
  }
}

// ── Fill Resize Helper ────────────────────────────────────────

function applyFillResize(
  child: ChildLayoutData,
  modifTree: ModifTree,
  isRow: boolean,
  isMainAxis: boolean,
  targetSize: number
): void {
  const currentSize = (isMainAxis === isRow) ? child.bounds.width : child.bounds.height;
  if (Math.abs(currentSize - targetSize) < 0.001) return;

  const scale = targetSize / (currentSize || 1);

  const mods = getOrCreateModifiers(modifTree, child.id);

  if (isMainAxis === isRow) {
    // Affecting width
    mods.geometryChild.push(
      resizeModifiers(scale, 1, child.bounds.x, child.bounds.y)
    );
    child.bounds.width = targetSize;
  } else {
    // Affecting height
    mods.geometryChild.push(
      resizeModifiers(1, scale, child.bounds.x, child.bounds.y)
    );
    child.bounds.height = targetSize;
  }
}

// ── Line Sizing Helpers ───────────────────────────────────────

function getLineCrossSize(line: LayoutLine, isRow: boolean): number {
  let maxCross = 0;
  for (const child of line.children) {
    const crossMargin = isRow
      ? child.marginTop + child.marginBottom
      : child.marginLeft + child.marginRight;
    const crossSize = (isRow ? child.bounds.height : child.bounds.width) + crossMargin;
    maxCross = Math.max(maxCross, crossSize);
  }
  return maxCross;
}

function calcLineActualMain(line: LayoutLine, isRow: boolean, mainGap: number): number {
  let total = 0;
  for (const child of line.children) {
    const mainMargin = isRow
      ? child.marginLeft + child.marginRight
      : child.marginTop + child.marginBottom;
    total += (isRow ? child.bounds.width : child.bounds.height) + mainMargin;
  }
  total += Math.max(0, line.children.length - 1) * mainGap;
  return total;
}

// ── Alignment Helpers ─────────────────────────────────────────

function calcJustifyOffset(
  justify: FlexJustify,
  available: number,
  totalContent: number
): number {
  const free = Math.max(0, available - totalContent);
  switch (justify) {
    case "start": return 0;
    case "center": return free / 2;
    case "end": return free;
    case "space-around": return 0; // handled by between
    case "space-evenly": return 0; // handled by between
    case "space-between": return 0;
    default: return 0;
  }
}

function calcJustifyBetween(
  justify: FlexJustify,
  available: number,
  totalContent: number,
  itemCount: number,
  gap: number
): number {
  const freeSpace = Math.max(0, available - totalContent);
  switch (justify) {
    case "space-between":
      return itemCount > 1
        ? freeSpace / (itemCount - 1) + gap
        : gap;
    case "space-around":
      return itemCount > 0
        ? freeSpace / itemCount + gap
        : gap;
    case "space-evenly":
      return itemCount > 0
        ? freeSpace / (itemCount + 1) + gap
        : gap;
    default:
      return gap;
  }
}

function calcAlignContentOffset(
  align: FlexAlign,
  available: number,
  totalLines: number,
  lineCount: number,
  crossGap: number
): number {
  const free = Math.max(0, available - totalLines);
  switch (align) {
    case "start": return 0;
    case "center": return free / 2;
    case "end": return free;
    case "stretch": return 0;
    default: return 0;
  }
}

function calcAlignContentBetween(
  align: FlexAlign,
  available: number,
  totalLines: number,
  lineCount: number,
  crossGap: number
): number {
  if (lineCount <= 1) return crossGap;
  const free = Math.max(0, available - totalLines);

  switch (align) {
    case "stretch":
      return (free / lineCount) + crossGap;
    default:
      return crossGap;
  }
}

function calcCrossAlignOffset(
  align: FlexAlign,
  lineCross: number,
  childCross: number,
  marginBefore: number,
  marginAfter: number
): number {
  const childWithMargin = childCross + marginBefore + marginAfter;
  const free = Math.max(0, lineCross - childWithMargin);

  switch (align) {
    case "start": return marginBefore;
    case "center": return marginBefore + free / 2;
    case "end": return marginBefore + free;
    case "stretch": return marginBefore;
    default: return marginBefore;
  }
}

// ── Content Bounds (for auto-sizing) ──────────────────────────

/**
 * Calculate the content bounds of a flex layout container.
 * Used by the auto-sizing pass to determine hug-content size.
 *
 * @returns The minimum bounding rect that contains all children
 *          plus padding, in the parent's local coordinate space.
 */
export function flexLayoutContentBounds(
  parent: PenpotShape,
  objects: Record<UUID, PenpotShape>,
  boundsMap: Map<UUID, Bounds>,
  parentBounds: Bounds
): Bounds {
  const lp = parent.layoutProps;
  if (!lp) return parentBounds;

  const childIds = (parent.shapes || []).filter((cid) => {
    const child = objects[cid];
    return child && !child.hidden && !isAbsolutelyPositioned(child);
  });

  if (childIds.length === 0) {
    const padTop = lp.layoutPaddingTop || 0;
    const padRight = lp.layoutPaddingRight || 0;
    const padBottom = lp.layoutPaddingBottom || 0;
    const padLeft = lp.layoutPaddingLeft || 0;
    return {
      x: parentBounds.x,
      y: parentBounds.y,
      width: padLeft + padRight,
      height: padTop + padBottom,
    };
  }

  const dir = lp.layoutFlexDir || "row";
  const isRow = dir === "row" || dir === "row-reverse";
  const gap = {
    row: lp.layoutGapRow ?? lp.layoutGap ?? 0,
    col: lp.layoutGapColumn ?? lp.layoutGap ?? 0,
  };
  const mainGap = isRow ? gap.col : gap.row;

  const padTop = lp.layoutPaddingTop || 0;
  const padRight = lp.layoutPaddingRight || 0;
  const padBottom = lp.layoutPaddingBottom || 0;
  const padLeft = lp.layoutPaddingLeft || 0;

  // Compute total main-axis content size
  let totalMain = 0;
  let maxCross = 0;

  for (let i = 0; i < childIds.length; i++) {
    const cb = boundsMap.get(childIds[i]);
    if (!cb) continue;

    const lip = objects[childIds[i]].layoutItemProps;
    const margin = (lip as any)?.layoutItemMargin || {};
    const marginMain = isRow
      ? (margin.m4 || 0) + (margin.m2 || 0) // left + right
      : (margin.m1 || 0) + (margin.m3 || 0); // top + bottom
    const marginCross = isRow
      ? (margin.m1 || 0) + (margin.m3 || 0)
      : (margin.m4 || 0) + (margin.m2 || 0);

    const mainSize = (isRow ? cb.width : cb.height) + marginMain;
    const crossSize = (isRow ? cb.height : cb.width) + marginCross;

    totalMain += mainSize;
    if (i > 0) totalMain += mainGap;
    maxCross = Math.max(maxCross, crossSize);
  }

  const contentWidth = isRow
    ? padLeft + totalMain + padRight
    : padLeft + maxCross + padRight;
  const contentHeight = isRow
    ? padTop + maxCross + padBottom
    : padTop + totalMain + padBottom;

  return {
    x: parentBounds.x,
    y: parentBounds.y,
    width: contentWidth,
    height: contentHeight,
  };
}
