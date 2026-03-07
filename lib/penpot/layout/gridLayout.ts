// ═══════════════════════════════════════════════════════════════
// Grid Layout Engine — Penpot-style CSS Grid layout for frames
// Mirrors: common/src/app/common/geom/shapes/grid_layout/
// ═══════════════════════════════════════════════════════════════

import type { UUID, PenpotShape, FlexAlign, FlexJustify } from "../types";
import type { Bounds, ModifTree } from "./modifiers";
import { getOrCreateModifiers, moveModifiers, resizeModifiers } from "./modifiers";
import { isAbsolutelyPositioned } from "./constraints";

// ── Grid Type Definitions ─────────────────────────────────────

export type GridTrackType = "fixed" | "flex" | "auto" | "percent";

export interface GridTrackDef {
  type: GridTrackType;
  value: number;
}

export type CellPosition = "auto" | "manual" | "area";

export interface GridCell {
  id: UUID;
  row: number;        // 1-based row start
  column: number;     // 1-based column start
  rowSpan: number;    // how many rows the cell spans
  colSpan: number;    // how many columns the cell spans
  shapes: UUID[];     // shapes assigned to this cell
  position: CellPosition;
  alignSelf?: FlexAlign;
  justifySelf?: FlexAlign;
}

export interface GridLayoutProps {
  gridDir?: "row" | "column";
  gridRows: GridTrackDef[];
  gridColumns: GridTrackDef[];
  gridCells: Record<UUID, GridCell>;
}

// ── Resolved Grid Data ────────────────────────────────────────

interface ResolvedTrack {
  start: number;  // offset from layout area start
  size: number;   // resolved track size in px
}

interface ResolvedGrid {
  rows: ResolvedTrack[];
  columns: ResolvedTrack[];
}

interface CellBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ── Main Entry Point ──────────────────────────────────────────

/**
 * Calculate grid layout modifiers for all children of a parent grid frame.
 */
export function calcGridLayoutModifiers(
  parent: PenpotShape,
  objects: Record<UUID, PenpotShape>,
  boundsMap: Map<UUID, Bounds>,
  parentBounds: Bounds
): ModifTree {
  const modifTree: ModifTree = new Map();
  const lp = parent.layoutProps;
  if (!lp?.layout || lp.layout !== "grid") return modifTree;

  const gridProps = getGridProps(parent);
  if (!gridProps) return modifTree;

  // Resolve padding
  const padTop = lp.layoutPaddingTop || 0;
  const padRight = lp.layoutPaddingRight || 0;
  const padBottom = lp.layoutPaddingBottom || 0;
  const padLeft = lp.layoutPaddingLeft || 0;

  const layoutArea: Bounds = {
    x: parentBounds.x + padLeft,
    y: parentBounds.y + padTop,
    width: Math.max(0, parentBounds.width - padLeft - padRight),
    height: Math.max(0, parentBounds.height - padTop - padBottom),
  };

  const gap = {
    row: lp.layoutGapRow ?? lp.layoutGap ?? 0,
    col: lp.layoutGapColumn ?? lp.layoutGap ?? 0,
  };

  // Resolve track sizes
  const resolvedGrid = resolveGrid(
    gridProps.gridRows,
    gridProps.gridColumns,
    layoutArea,
    gap,
    objects,
    boundsMap,
    gridProps.gridCells
  );

  // Position children in their cells
  const alignItems = lp.layoutAlignItems || "start";
  const justifyItems = (lp as any).layoutJustifyItems || "start";

  for (const cell of Object.values(gridProps.gridCells)) {
    for (const shapeId of cell.shapes) {
      const child = objects[shapeId];
      if (!child || child.hidden || isAbsolutelyPositioned(child)) continue;

      const childBounds = boundsMap.get(shapeId) || {
        x: child.x,
        y: child.y,
        width: child.width,
        height: child.height,
      };

      const cellBounds = getCellBounds(resolvedGrid, cell, layoutArea, gap);
      if (!cellBounds) continue;

      // Apply sizing and positioning
      applyCellModifiers(
        modifTree,
        child,
        childBounds,
        cellBounds,
        cell,
        alignItems,
        justifyItems
      );
    }
  }

  return modifTree;
}

// ── Grid Property Extraction ──────────────────────────────────

function getGridProps(parent: PenpotShape): GridLayoutProps | null {
  const lp = parent.layoutProps as any;
  if (!lp) return null;

  return {
    gridDir: lp.layoutGridDir || "row",
    gridRows: lp.layoutGridRows || [{ type: "flex", value: 1 }],
    gridColumns: lp.layoutGridColumns || [{ type: "flex", value: 1 }],
    gridCells: lp.layoutGridCells || {},
  };
}

// ── Track Resolution ──────────────────────────────────────────

function resolveGrid(
  rowDefs: GridTrackDef[],
  colDefs: GridTrackDef[],
  layoutArea: Bounds,
  gap: { row: number; col: number },
  objects: Record<UUID, PenpotShape>,
  boundsMap: Map<UUID, Bounds>,
  cells: Record<UUID, GridCell>
): ResolvedGrid {
  const rows = resolveTracks(rowDefs, layoutArea.height, gap.row, "row", objects, boundsMap, cells);
  const columns = resolveTracks(colDefs, layoutArea.width, gap.col, "col", objects, boundsMap, cells);
  return { rows, columns };
}

function resolveTracks(
  defs: GridTrackDef[],
  available: number,
  gap: number,
  axis: "row" | "col",
  objects: Record<UUID, PenpotShape>,
  boundsMap: Map<UUID, Bounds>,
  cells: Record<UUID, GridCell>
): ResolvedTrack[] {
  const n = defs.length;
  if (n === 0) return [{ start: 0, size: available }];

  const totalGaps = Math.max(0, n - 1) * gap;
  const usable = Math.max(0, available - totalGaps);

  const resolved: number[] = new Array(n).fill(0);
  let flexTotal = 0;
  let flexCount = 0;
  let consumed = 0;

  // First pass: resolve fixed, percent, auto
  for (let i = 0; i < n; i++) {
    const def = defs[i];
    switch (def.type) {
      case "fixed":
        resolved[i] = def.value;
        consumed += def.value;
        break;
      case "percent":
        resolved[i] = (def.value / 100) * usable;
        consumed += resolved[i];
        break;
      case "auto":
        resolved[i] = calcAutoTrackSize(i, axis, objects, boundsMap, cells);
        consumed += resolved[i];
        break;
      case "flex":
        flexTotal += def.value;
        flexCount++;
        break;
    }
  }

  // Second pass: distribute remaining space among flex tracks
  const remaining = Math.max(0, usable - consumed);
  if (flexTotal > 0) {
    for (let i = 0; i < n; i++) {
      if (defs[i].type === "flex") {
        resolved[i] = (defs[i].value / flexTotal) * remaining;
      }
    }
  }

  // Build resolved tracks with offsets
  const tracks: ResolvedTrack[] = [];
  let offset = 0;
  for (let i = 0; i < n; i++) {
    tracks.push({ start: offset, size: Math.max(0, resolved[i]) });
    offset += resolved[i] + gap;
  }

  return tracks;
}

/**
 * Calculate the auto-size of a track based on the content of cells in that track.
 */
function calcAutoTrackSize(
  trackIndex: number,
  axis: "row" | "col",
  objects: Record<UUID, PenpotShape>,
  boundsMap: Map<UUID, Bounds>,
  cells: Record<UUID, GridCell>
): number {
  let maxSize = 0;

  for (const cell of Object.values(cells)) {
    const cellTrackStart = axis === "row" ? cell.row - 1 : cell.column - 1;
    const cellTrackSpan = axis === "row" ? cell.rowSpan : cell.colSpan;

    // Only consider cells that are entirely within this track (span 1)
    if (cellTrackStart === trackIndex && cellTrackSpan === 1) {
      for (const shapeId of cell.shapes) {
        const bounds = boundsMap.get(shapeId);
        if (bounds) {
          maxSize = Math.max(maxSize, axis === "row" ? bounds.height : bounds.width);
        }
      }
    }
  }

  return maxSize || 20; // minimum auto size
}

// ── Cell Bounds ───────────────────────────────────────────────

function getCellBounds(
  grid: ResolvedGrid,
  cell: GridCell,
  layoutArea: Bounds,
  gap: { row: number; col: number }
): CellBounds | null {
  const rowStart = cell.row - 1; // 0-based
  const colStart = cell.column - 1;
  const rowEnd = rowStart + cell.rowSpan - 1;
  const colEnd = colStart + cell.colSpan - 1;

  if (rowStart >= grid.rows.length || colStart >= grid.columns.length) return null;

  const row = grid.rows[rowStart];
  const col = grid.columns[colStart];
  if (!row || !col) return null;

  // For spanning cells, accumulate size
  let cellHeight = 0;
  for (let r = rowStart; r <= Math.min(rowEnd, grid.rows.length - 1); r++) {
    cellHeight += grid.rows[r].size;
    if (r > rowStart) cellHeight += gap.row;
  }

  let cellWidth = 0;
  for (let c = colStart; c <= Math.min(colEnd, grid.columns.length - 1); c++) {
    cellWidth += grid.columns[c].size;
    if (c > colStart) cellWidth += gap.col;
  }

  return {
    x: layoutArea.x + col.start,
    y: layoutArea.y + row.start,
    width: cellWidth,
    height: cellHeight,
  };
}

// ── Cell Modifier Application ─────────────────────────────────

function applyCellModifiers(
  modifTree: ModifTree,
  child: PenpotShape,
  childBounds: Bounds,
  cellBounds: CellBounds,
  cell: GridCell,
  alignItems: FlexAlign,
  justifyItems: FlexAlign
): void {
  const lip = child.layoutItemProps;
  const hSizing = lip?.layoutItemHSizing || "fix";
  const vSizing = lip?.layoutItemVSizing || "fix";

  let targetW = childBounds.width;
  let targetH = childBounds.height;

  // Fill sizing
  if (hSizing === "fill") {
    targetW = clamp(
      cellBounds.width,
      (lip as any)?.layoutItemMinW ?? 0.01,
      (lip as any)?.layoutItemMaxW ?? Infinity
    );
  }

  if (vSizing === "fill") {
    targetH = clamp(
      cellBounds.height,
      (lip as any)?.layoutItemMinH ?? 0.01,
      (lip as any)?.layoutItemMaxH ?? Infinity
    );
  }

  // Apply resize if needed
  const scaleX = targetW / (childBounds.width || 1);
  const scaleY = targetH / (childBounds.height || 1);

  if (Math.abs(scaleX - 1) > 0.001 || Math.abs(scaleY - 1) > 0.001) {
    const mods = getOrCreateModifiers(modifTree, child.id);
    mods.geometryChild.push(
      resizeModifiers(scaleX, scaleY, childBounds.x, childBounds.y)
    );
  }

  // Alignment within cell
  const alignSelf = cell.alignSelf || alignItems;
  const justifySelf = cell.justifySelf || justifyItems;

  const targetX = calcCellAlign(justifySelf, cellBounds.x, cellBounds.width, targetW);
  const targetY = calcCellAlign(alignSelf, cellBounds.y, cellBounds.height, targetH);

  const dx = targetX - childBounds.x;
  const dy = targetY - childBounds.y;

  if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
    const mods = getOrCreateModifiers(modifTree, child.id);
    mods.geometryChild.push(moveModifiers(dx, dy));
  }
}

function calcCellAlign(align: FlexAlign, cellStart: number, cellSize: number, childSize: number): number {
  const free = Math.max(0, cellSize - childSize);
  switch (align) {
    case "start": return cellStart;
    case "center": return cellStart + free / 2;
    case "end": return cellStart + free;
    case "stretch": return cellStart;
    default: return cellStart;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ── Grid Cell Assignment ──────────────────────────────────────

/**
 * Ensure all children of a grid parent have a cell assignment.
 * Unassigned children are placed in the first available cell.
 */
export function assignGridCells(
  parent: PenpotShape,
  objects: Record<UUID, PenpotShape>
): Record<UUID, GridCell> {
  const gridProps = getGridProps(parent);
  if (!gridProps) return {};

  const cells = { ...gridProps.gridCells };
  const assignedShapes = new Set<UUID>();

  // Collect already-assigned shapes
  for (const cell of Object.values(cells)) {
    for (const sid of cell.shapes) {
      assignedShapes.add(sid);
    }
  }

  // Find unassigned children
  const childIds = (parent.shapes || []).filter((cid) => {
    const child = objects[cid];
    return child && !child.hidden && !isAbsolutelyPositioned(child) && !assignedShapes.has(cid);
  });

  if (childIds.length === 0) return cells;

  // Build occupancy grid
  const numRows = gridProps.gridRows.length || 1;
  const numCols = gridProps.gridColumns.length || 1;
  const occupied = new Set<string>();

  for (const cell of Object.values(cells)) {
    for (let r = cell.row; r < cell.row + cell.rowSpan; r++) {
      for (let c = cell.column; c < cell.column + cell.colSpan; c++) {
        occupied.add(`${r},${c}`);
      }
    }
  }

  // Place unassigned children
  let nextChildIdx = 0;
  const dir = gridProps.gridDir || "row";

  if (dir === "row") {
    for (let r = 1; r <= numRows && nextChildIdx < childIds.length; r++) {
      for (let c = 1; c <= numCols && nextChildIdx < childIds.length; c++) {
        if (!occupied.has(`${r},${c}`)) {
          const cellId = crypto.randomUUID();
          cells[cellId] = {
            id: cellId,
            row: r,
            column: c,
            rowSpan: 1,
            colSpan: 1,
            shapes: [childIds[nextChildIdx]],
            position: "auto",
          };
          occupied.add(`${r},${c}`);
          nextChildIdx++;
        }
      }
    }
  } else {
    for (let c = 1; c <= numCols && nextChildIdx < childIds.length; c++) {
      for (let r = 1; r <= numRows && nextChildIdx < childIds.length; r++) {
        if (!occupied.has(`${r},${c}`)) {
          const cellId = crypto.randomUUID();
          cells[cellId] = {
            id: cellId,
            row: r,
            column: c,
            rowSpan: 1,
            colSpan: 1,
            shapes: [childIds[nextChildIdx]],
            position: "auto",
          };
          occupied.add(`${r},${c}`);
          nextChildIdx++;
        }
      }
    }
  }

  // If still unassigned, add more rows
  let extraRow = numRows + 1;
  while (nextChildIdx < childIds.length) {
    for (let c = 1; c <= numCols && nextChildIdx < childIds.length; c++) {
      const cellId = crypto.randomUUID();
      cells[cellId] = {
        id: cellId,
        row: extraRow,
        column: c,
        rowSpan: 1,
        colSpan: 1,
        shapes: [childIds[nextChildIdx]],
        position: "auto",
      };
      nextChildIdx++;
    }
    extraRow++;
  }

  return cells;
}

/**
 * Push a shape into a specific cell position.
 */
export function pushIntoCell(
  cells: Record<UUID, GridCell>,
  shapeId: UUID,
  row: number,
  column: number
): Record<UUID, GridCell> {
  const result = { ...cells };

  // Remove shape from existing cell
  for (const cell of Object.values(result)) {
    cell.shapes = cell.shapes.filter((sid) => sid !== shapeId);
  }

  // Find or create cell at position
  const existing = Object.values(result).find(
    (c) => c.row === row && c.column === column
  );

  if (existing) {
    existing.shapes.push(shapeId);
  } else {
    const cellId = crypto.randomUUID();
    result[cellId] = {
      id: cellId,
      row,
      column,
      rowSpan: 1,
      colSpan: 1,
      shapes: [shapeId],
      position: "manual",
    };
  }

  return result;
}

// ── Grid Content Bounds (for auto-sizing) ─────────────────────

/**
 * Calculate the content bounds of a grid layout container.
 */
export function gridLayoutContentBounds(
  parent: PenpotShape,
  objects: Record<UUID, PenpotShape>,
  boundsMap: Map<UUID, Bounds>,
  parentBounds: Bounds
): Bounds {
  const lp = parent.layoutProps;
  if (!lp) return parentBounds;

  const gridProps = getGridProps(parent);
  if (!gridProps) return parentBounds;

  const padTop = lp.layoutPaddingTop || 0;
  const padRight = lp.layoutPaddingRight || 0;
  const padBottom = lp.layoutPaddingBottom || 0;
  const padLeft = lp.layoutPaddingLeft || 0;

  const gap = {
    row: lp.layoutGapRow ?? lp.layoutGap ?? 0,
    col: lp.layoutGapColumn ?? lp.layoutGap ?? 0,
  };

  // For auto tracks, calculate from content
  let totalRowSize = 0;
  for (let i = 0; i < gridProps.gridRows.length; i++) {
    const def = gridProps.gridRows[i];
    if (def.type === "auto") {
      totalRowSize += calcAutoTrackSize(i, "row", objects, boundsMap, gridProps.gridCells);
    } else if (def.type === "fixed") {
      totalRowSize += def.value;
    } else {
      // For flex/percent, use current bounds
      totalRowSize += parentBounds.height / Math.max(1, gridProps.gridRows.length);
    }
  }
  totalRowSize += Math.max(0, gridProps.gridRows.length - 1) * gap.row;

  let totalColSize = 0;
  for (let i = 0; i < gridProps.gridColumns.length; i++) {
    const def = gridProps.gridColumns[i];
    if (def.type === "auto") {
      totalColSize += calcAutoTrackSize(i, "col", objects, boundsMap, gridProps.gridCells);
    } else if (def.type === "fixed") {
      totalColSize += def.value;
    } else {
      totalColSize += parentBounds.width / Math.max(1, gridProps.gridColumns.length);
    }
  }
  totalColSize += Math.max(0, gridProps.gridColumns.length - 1) * gap.col;

  return {
    x: parentBounds.x,
    y: parentBounds.y,
    width: padLeft + totalColSize + padRight,
    height: padTop + totalRowSize + padBottom,
  };
}
