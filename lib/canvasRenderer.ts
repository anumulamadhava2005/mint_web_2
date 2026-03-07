// ═══════════════════════════════════════════════════════════════
// Canvas Renderer — Production-grade Figma-style rendering
//
// Pipeline (correct ordering):
//   1. Clear + background
//   2. Grid (screen space, zoom-adaptive)
//   3. Scene layer (world space via viewport matrix)
//   4. Reset to identity (screen space)
//   5. Overlay layer:
//      a. Frame labels (constant 11px)
//      b. Hover outline
//      c. Drop target highlight
//      d. Selection outlines (projected corners → polygon)
//      e. Handles (constant 8px screen size)
//      f. Snap guides
//      g. Marquee rect
//      h. Drag preview
//
// Key principles:
//   • Scene shapes: rendered via viewport matrix in world space
//   • Overlays: rendered in screen space (identity transform)
//   • Handles: ALWAYS 8px on screen regardless of zoom
//   • Strokes on overlays: ALWAYS 1–2px on screen
//   • Pixel snapping: screen-space coords rounded to device pixels
//   • devicePixelRatio: handled by caller (ctx.setTransform(dpr,...))
// ═══════════════════════════════════════════════════════════════

import {
  CanvasShape,
  Camera,
  Vec2,
  vec,
  deg2rad,
  getShapeVertices,
  AABB,
  buildShapeMap,
  getGlobalPosition,
} from "./canvasEngine";
import type { SceneGraph } from "./sceneGraph";
import type { Matrix3 } from "./matrix3";
import type { SnapGuide } from "./snappingEngine";
import { mat3ConcatToContext, mat3TransformPoint, mat3Multiply, mat3Translate, mat3Scale } from "./matrix3";

// ── Constants ─────────────────────────────────────────────────
const HANDLE_SIZE = 8;       // px on screen — NEVER scales
const HANDLE_STROKE = 1.5;   // px on screen
const SELECTION_WIDTH = 1.5;  // px on screen
const HOVER_WIDTH = 1;        // px on screen
const SELECTION_COLOR = "#4F8EF7";
const HOVER_COLOR = "#4F8EF7";
const HANDLE_FILL = "#FFFFFF";
const SNAP_GUIDE_COLOR = "#FF3366";
const FRAME_LABEL_FONT = "Inter, system-ui, sans-serif";
const TEXT_FONT_FALLBACK = "Inter, system-ui, sans-serif";
const BG_COLOR = "#1a1a1a";

// ── Viewport matrix ───────────────────────────────────────────
function viewportMatrix(cam: Camera): Matrix3 {
  return mat3Multiply(
    mat3Translate(cam.x, cam.y),
    mat3Scale(cam.zoom, cam.zoom),
  );
}

/** Transform a world point to screen space */
function worldToScreenPt(p: Vec2, cam: Camera): Vec2 {
  return { x: p.x * cam.zoom + cam.x, y: p.y * cam.zoom + cam.y };
}

/** Pixel-snap a screen coordinate for crisp 1px strokes */
function snap(v: number): number {
  return Math.round(v) + 0.5;
}

/** Pixel-snap for fills (no +0.5 needed) */
function snapFill(v: number): number {
  return Math.round(v);
}

// ── Public render options ─────────────────────────────────────
export interface RenderOverlayOptions {
  /** ID of shape currently under cursor (hover highlight) */
  hoverId?: string | null;
  /** Active snap guides to render */
  snapGuides?: SnapGuide[];
}

// ── Main draw function ────────────────────────────────────────
export function renderAll(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cam: Camera,
  shapes: CanvasShape[],
  selectedIds: Set<string>,
  selectionRect: AABB | null,
  dragPreview: { type: string; x: number; y: number; w: number; h: number } | null,
  dropTargetId?: string | null,
  sceneGraph?: SceneGraph | null,
  overlay?: RenderOverlayOptions,
) {
  // ────────────────────────────────────────────────────────
  // PHASE 1: Clear + background
  // ────────────────────────────────────────────────────────
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, width, height);

  // ────────────────────────────────────────────────────────
  // PHASE 2: Grid (screen space, zoom-adaptive)
  // ────────────────────────────────────────────────────────
  drawGrid(ctx, width, height, cam);

  // ────────────────────────────────────────────────────────
  // PHASE 3: Scene layer (world space via viewport matrix)
  // ────────────────────────────────────────────────────────
  ctx.save();
  const vp = viewportMatrix(cam);
  ctx.transform(vp[0], vp[1], vp[2], vp[3], vp[4], vp[5]);

  const lookup = buildShapeMap(shapes);

  if (sceneGraph) {
    renderSceneTree(ctx, sceneGraph, cam);
  } else {
    drawSceneTreeLegacy(ctx, shapes, null, vec(), cam, lookup);
  }

  ctx.restore();
  // ctx.restore() returns us to screen space (caller's dpr transform)

  // ────────────────────────────────────────────────────────
  // PHASE 4: Overlay layer (SCREEN SPACE)
  //
  //   Everything below is in screen pixels.
  //   Line widths and handle sizes are constant.
  // ────────────────────────────────────────────────────────

  // 4a. Frame labels (constant 11px)
  if (sceneGraph) {
    drawFrameLabels(ctx, sceneGraph, cam);
  }

  // 4b. Hover highlight
  const hoverId = overlay?.hoverId;
  if (hoverId && !selectedIds.has(hoverId)) {
    if (sceneGraph) {
      drawHoverOutline(ctx, hoverId, sceneGraph, cam);
    }
  }

  // 4c. Drop target highlight
  if (dropTargetId) {
    if (sceneGraph) {
      drawDropTarget(ctx, dropTargetId, sceneGraph, cam);
    } else {
      const dt = lookup.get(dropTargetId);
      if (dt) {
        const g = getGlobalPosition(dt, lookup);
        const tl = worldToScreenPt(g, cam);
        const br = worldToScreenPt({ x: g.x + dt.width, y: g.y + dt.height }, cam);
        ctx.save();
        ctx.strokeStyle = SELECTION_COLOR;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(snap(tl.x) - 0.5, snap(tl.y) - 0.5, br.x - tl.x, br.y - tl.y);
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(79, 142, 247, 0.06)";
        ctx.fillRect(snapFill(tl.x), snapFill(tl.y), br.x - tl.x, br.y - tl.y);
        ctx.restore();
      }
    }
  }

  // 4d. Selection outlines + handles (constant screen size)
  for (const s of shapes) {
    if (!selectedIds.has(s.id)) continue;
    if (sceneGraph) {
      const wt = sceneGraph.getWorldTransform(s.id);
      drawSelectionScreenSpace(ctx, s, wt, cam);
    } else {
      const g = getGlobalPosition(s, lookup);
      drawSelectionLegacy(ctx, { ...s, x: g.x, y: g.y }, cam);
    }
  }

  // 4e. Snap guides
  if (overlay?.snapGuides && overlay.snapGuides.length > 0) {
    drawSnapGuides(ctx, overlay.snapGuides, cam);
  }

  // 4f. Marquee selection rect (screen space)
  if (selectionRect) {
    const tl = worldToScreenPt({ x: selectionRect.minX, y: selectionRect.minY }, cam);
    const br = worldToScreenPt({ x: selectionRect.maxX, y: selectionRect.maxY }, cam);
    ctx.save();
    ctx.strokeStyle = SELECTION_COLOR;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.fillStyle = "rgba(79, 142, 247, 0.08)";
    const rw = br.x - tl.x;
    const rh = br.y - tl.y;
    ctx.fillRect(snapFill(tl.x), snapFill(tl.y), rw, rh);
    ctx.strokeRect(snap(tl.x) - 0.5, snap(tl.y) - 0.5, rw, rh);
    ctx.setLineDash([]);
    ctx.restore();
  }

  // 4g. Drag preview (screen space)
  if (dragPreview) {
    drawDragPreview(ctx, dragPreview, cam);
  }
}

// ═══════════════════════════════════════════════════════════════
// SCENE LAYER (world space — rendered under viewport matrix)
// ═══════════════════════════════════════════════════════════════

function renderSceneTree(
  ctx: CanvasRenderingContext2D,
  sg: SceneGraph,
  cam: Camera,
): void {
  sg.traverse((id, worldTransform, _depth) => {
    const shape = sg.getShape(id);
    if (!shape || !shape.visible) return;
    drawShapeWithMatrix(ctx, shape, worldTransform, cam);
  });
}

/**
 * Draw a shape in local space (0,0,w,h).
 * The viewport + world transform matrices handle positioning.
 * Shape strokes are world-space (they scale with zoom —
 * that's correct for shape content, unlike overlay strokes).
 */
function drawShapeWithMatrix(
  ctx: CanvasRenderingContext2D,
  s: CanvasShape,
  worldTransform: Matrix3,
  cam: Camera,
): void {
  ctx.save();
  mat3ConcatToContext(ctx, worldTransform);
  ctx.globalAlpha = s.opacity;

  const w = s.width;
  const h = s.height;

  const hasFill = !!s.fill && s.fill !== "transparent" && s.fill !== "";
  const hasStroke = !!s.stroke && s.stroke !== "transparent" && s.stroke !== "" && s.strokeWidth > 0;

  if (hasFill) ctx.fillStyle = s.fill;
  if (hasStroke) {
    ctx.strokeStyle = s.stroke;
    ctx.lineWidth = s.strokeWidth;
  }

  switch (s.type) {
    case "rectangle": {
      if (s.cornerRadius > 0) {
        roundRect(ctx, 0, 0, w, h, s.cornerRadius);
        if (hasFill) ctx.fill();
        if (hasStroke) ctx.stroke();
      } else {
        if (hasFill) ctx.fillRect(0, 0, w, h);
        if (hasStroke) ctx.strokeRect(0, 0, w, h);
      }
      break;
    }
    case "ellipse": {
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, Math.abs(w) / 2, Math.abs(h) / 2, 0, 0, Math.PI * 2);
      if (hasFill) ctx.fill();
      if (hasStroke) ctx.stroke();
      break;
    }
    case "line": {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w, h);
      ctx.strokeStyle = s.stroke || s.fill || "#fff";
      ctx.lineWidth = s.strokeWidth || 2;
      ctx.stroke();
      break;
    }
    case "text": {
      const size = s.fontSize || 16;
      ctx.font = `${size}px ${s.fontFamily || TEXT_FONT_FALLBACK}`;
      ctx.fillStyle = s.fill || "#FFFFFF";
      ctx.textBaseline = "top";
      const lines = (s.text || "Text").split("\n");
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], 0, i * size * 1.3);
      }
      break;
    }
    case "polygon":
    case "star": {
      const pts = getShapeVertices({ ...s, x: 0, y: 0 });
      if (pts.length < 3) break;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      if (hasFill) ctx.fill();
      if (hasStroke) ctx.stroke();
      break;
    }
    case "path": {
      if (!s.points || s.points.length < 2) break;
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i].x, s.points[i].y);
      }
      if (s.points.length > 2) ctx.closePath();
      if (hasFill) ctx.fill();
      if (hasStroke) ctx.stroke();
      break;
    }
    case "frame": {
      ctx.fillStyle = s.fill || "#1e1e1e";
      ctx.fillRect(0, 0, w, h);
      // 1px screen-width border (compensate for zoom)
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 1 / cam.zoom;
      ctx.strokeRect(0, 0, w, h);
      // Label drawn in overlay pass
      break;
    }
  }

  ctx.restore();
}

// ── Legacy offset-based scene tree (fallback, no SceneGraph) ──

function drawSceneTreeLegacy(
  ctx: CanvasRenderingContext2D,
  allShapes: CanvasShape[],
  parentId: string | null,
  parentOffset: Vec2,
  cam: Camera,
  lookup: Map<string, CanvasShape>,
) {
  const children = allShapes
    .filter(s => s.parentId === parentId)
    .sort((a, b) => a.zIndex - b.zIndex);

  for (const s of children) {
    if (!s.visible) continue;
    const globalX = s.x + parentOffset.x;
    const globalY = s.y + parentOffset.y;
    const globalShape: CanvasShape = { ...s, x: globalX, y: globalY };
    drawShapeLegacy(ctx, globalShape, cam);
    if (s.children.length > 0) {
      drawSceneTreeLegacy(ctx, allShapes, s.id, vec(globalX, globalY), cam, lookup);
    }
  }
}

function drawShapeLegacy(ctx: CanvasRenderingContext2D, s: CanvasShape, cam: Camera) {
  ctx.save();
  ctx.globalAlpha = s.opacity;

  if (s.rotation !== 0) {
    const cx = s.x + s.width / 2;
    const cy = s.y + s.height / 2;
    ctx.translate(cx, cy);
    ctx.rotate(deg2rad(s.rotation));
    ctx.translate(-cx, -cy);
  }

  const hasFill = !!s.fill && s.fill !== "transparent" && s.fill !== "";
  const hasStroke = !!s.stroke && s.stroke !== "transparent" && s.stroke !== "" && s.strokeWidth > 0;

  if (hasFill) ctx.fillStyle = s.fill;
  if (hasStroke) {
    ctx.strokeStyle = s.stroke;
    ctx.lineWidth = s.strokeWidth;
  }

  switch (s.type) {
    case "rectangle":
      if (s.cornerRadius > 0) {
        roundRect(ctx, s.x, s.y, s.width, s.height, s.cornerRadius);
        if (hasFill) ctx.fill();
        if (hasStroke) ctx.stroke();
      } else {
        if (hasFill) ctx.fillRect(s.x, s.y, s.width, s.height);
        if (hasStroke) ctx.strokeRect(s.x, s.y, s.width, s.height);
      }
      break;
    case "ellipse":
      ctx.beginPath();
      ctx.ellipse(s.x + s.width / 2, s.y + s.height / 2, Math.abs(s.width) / 2, Math.abs(s.height) / 2, 0, 0, Math.PI * 2);
      if (hasFill) ctx.fill();
      if (hasStroke) ctx.stroke();
      break;
    case "line":
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + s.width, s.y + s.height);
      ctx.strokeStyle = s.stroke || s.fill || "#fff";
      ctx.lineWidth = s.strokeWidth || 2;
      ctx.stroke();
      break;
    case "text": {
      const size = s.fontSize || 16;
      ctx.font = `${size}px ${s.fontFamily || TEXT_FONT_FALLBACK}`;
      ctx.fillStyle = s.fill || "#FFFFFF";
      ctx.textBaseline = "top";
      const lines = (s.text || "Text").split("\n");
      for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], s.x, s.y + i * size * 1.3);
      break;
    }
    case "polygon":
    case "star": {
      const pts = getShapeVertices(s);
      if (pts.length < 3) break;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      if (hasFill) ctx.fill();
      if (hasStroke) ctx.stroke();
      break;
    }
    case "path":
      if (!s.points || s.points.length < 2) break;
      ctx.beginPath();
      ctx.moveTo(s.x + s.points[0].x, s.y + s.points[0].y);
      for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.x + s.points[i].x, s.y + s.points[i].y);
      if (s.points.length > 2) ctx.closePath();
      if (hasFill) ctx.fill();
      if (hasStroke) ctx.stroke();
      break;
    case "frame":
      ctx.fillStyle = s.fill || "#1e1e1e";
      ctx.fillRect(s.x, s.y, s.width, s.height);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 1 / cam.zoom;
      ctx.strokeRect(s.x, s.y, s.width, s.height);
      break;
  }
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════
// OVERLAY LAYER (screen space — constant pixel sizes)
// ═══════════════════════════════════════════════════════════════

// ── Grid (screen space, zoom-adaptive density) ────────────────

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, cam: Camera) {
  if (cam.zoom < 0.08) return;

  ctx.save();

  // Adaptive grid: choose a world-space step that keeps grid lines
  // ~12–120px apart on screen. Mimics Figma's zoom-adaptive grid.
  const baseSteps = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
  const minScreenSpacing = 12;
  const maxScreenSpacing = 120;

  let smallStep = 10;
  let largeStep = 100;

  for (const step of baseSteps) {
    const screenPx = step * cam.zoom;
    if (screenPx >= minScreenSpacing && screenPx <= maxScreenSpacing) {
      smallStep = step;
      break;
    }
  }
  for (const step of baseSteps) {
    if (step > smallStep * 3) {
      largeStep = step;
      break;
    }
  }

  // Small grid (pixel-snapped lines)
  const ssPx = smallStep * cam.zoom;
  if (ssPx > 6) {
    ctx.strokeStyle = "rgba(255,255,255,0.025)";
    ctx.lineWidth = 1;
    const offX = cam.x % ssPx;
    const offY = cam.y % ssPx;
    ctx.beginPath();
    for (let x = offX; x < w; x += ssPx) {
      const sx = snap(x) - 0.5;
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, h);
    }
    for (let y = offY; y < h; y += ssPx) {
      const sy = snap(y) - 0.5;
      ctx.moveTo(0, sy);
      ctx.lineTo(w, sy);
    }
    ctx.stroke();
  }

  // Large grid
  const lsPx = largeStep * cam.zoom;
  if (lsPx > 6) {
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    const offX = cam.x % lsPx;
    const offY = cam.y % lsPx;
    ctx.beginPath();
    for (let x = offX; x < w; x += lsPx) {
      const sx = snap(x) - 0.5;
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, h);
    }
    for (let y = offY; y < h; y += lsPx) {
      const sy = snap(y) - 0.5;
      ctx.moveTo(0, sy);
      ctx.lineTo(w, sy);
    }
    ctx.stroke();
  }

  // Origin axes (subtle)
  const ox = snap(cam.x) - 0.5;
  const oy = snap(cam.y) - 0.5;
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (ox >= 0 && ox <= w) { ctx.moveTo(ox, 0); ctx.lineTo(ox, h); }
  if (oy >= 0 && oy <= h) { ctx.moveTo(0, oy); ctx.lineTo(w, oy); }
  ctx.stroke();

  ctx.restore();
}

// ── Frame labels (screen space, constant 11px) ────────────────

function drawFrameLabels(
  ctx: CanvasRenderingContext2D,
  sg: SceneGraph,
  cam: Camera,
): void {
  sg.traverse((id, worldTransform, _depth) => {
    const shape = sg.getShape(id);
    if (!shape || !shape.visible || shape.type !== "frame") return;

    const topLeft = mat3TransformPoint(worldTransform, { x: 0, y: 0 });
    const screenPt = worldToScreenPt(topLeft, cam);

    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = `11px ${FRAME_LABEL_FONT}`;
    ctx.textBaseline = "bottom";
    ctx.fillText(shape.name, snap(screenPt.x) - 0.5, snap(screenPt.y - 4) - 0.5);
    ctx.restore();
  });
}

// ── Hover outline (screen space, constant 1px) ────────────────

function drawHoverOutline(
  ctx: CanvasRenderingContext2D,
  hId: string,
  sg: SceneGraph,
  cam: Camera,
): void {
  const shape = sg.getShape(hId);
  if (!shape) return;
  const wt = sg.getWorldTransform(hId);
  const corners = getScreenCorners(shape, wt, cam);

  ctx.save();
  ctx.strokeStyle = HOVER_COLOR;
  ctx.lineWidth = HOVER_WIDTH;
  ctx.setLineDash([]);
  drawPolygonPath(ctx, corners);
  ctx.stroke();
  ctx.restore();
}

// ── Drop target highlight (screen space) ──────────────────────

function drawDropTarget(
  ctx: CanvasRenderingContext2D,
  dtId: string,
  sg: SceneGraph,
  cam: Camera,
): void {
  const shape = sg.getShape(dtId);
  if (!shape) return;
  const wt = sg.getWorldTransform(dtId);
  const corners = getScreenCorners(shape, wt, cam);

  ctx.save();
  ctx.strokeStyle = SELECTION_COLOR;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  drawPolygonPath(ctx, corners);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(79, 142, 247, 0.06)";
  ctx.fill();
  ctx.restore();
}

// ── Selection outline + handles (SCREEN SPACE, constant size) ─

/**
 * Correct Figma-style selection rendering:
 *  1. Project 4 local corners through worldTransform → screen
 *  2. Draw outline as polygon (constant 1.5px)
 *  3. Draw handles at projected positions (constant 8px)
 *
 * Handles NEVER scale with zoom.
 * Selection border is ALWAYS 1.5px.
 * Rotated objects show correct projected outline.
 */
function drawSelectionScreenSpace(
  ctx: CanvasRenderingContext2D,
  s: CanvasShape,
  worldTransform: Matrix3,
  cam: Camera,
): void {
  const corners = getScreenCorners(s, worldTransform, cam);

  const tc = midpoint(corners[0], corners[1]);
  const mr = midpoint(corners[1], corners[2]);
  const bc = midpoint(corners[2], corners[3]);
  const ml = midpoint(corners[3], corners[0]);

  ctx.save();

  // Selection outline — polygon (handles rotation correctly)
  ctx.strokeStyle = SELECTION_COLOR;
  ctx.lineWidth = SELECTION_WIDTH;
  ctx.setLineDash([]);
  drawPolygonPath(ctx, corners);
  ctx.stroke();

  // Rotation handle — 24px above top-center (constant screen pixels)
  const rotateOffset = 24;
  const dirX = tc.x - bc.x;
  const dirY = tc.y - bc.y;
  const dirLen = Math.sqrt(dirX * dirX + dirY * dirY);
  let rotatePt: Vec2;
  if (dirLen > 0.001) {
    const nx = dirX / dirLen;
    const ny = dirY / dirLen;
    rotatePt = { x: tc.x + nx * rotateOffset, y: tc.y + ny * rotateOffset };
  } else {
    rotatePt = { x: tc.x, y: tc.y - rotateOffset };
  }

  // Rotation stem
  ctx.beginPath();
  ctx.moveTo(snap(tc.x) - 0.5, snap(tc.y) - 0.5);
  ctx.lineTo(snap(rotatePt.x) - 0.5, snap(rotatePt.y) - 0.5);
  ctx.strokeStyle = SELECTION_COLOR;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Rotation handle (circle)
  drawCircleHandle(ctx, rotatePt);

  // Corner handles (8px squares)
  for (const c of corners) drawSquareHandle(ctx, c);

  // Edge midpoint handles (6px squares)
  for (const m of [tc, mr, bc, ml]) drawSquareHandle(ctx, m, 6);

  ctx.restore();
}

/** Legacy selection (no SceneGraph) */
function drawSelectionLegacy(
  ctx: CanvasRenderingContext2D,
  s: CanvasShape,
  cam: Camera,
): void {
  const cx = s.x + s.width / 2;
  const cy = s.y + s.height / 2;
  const rad = deg2rad(s.rotation);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  function rotAndProject(lx: number, ly: number): Vec2 {
    const dx = lx - cx;
    const dy = ly - cy;
    const wx = cx + dx * cos - dy * sin;
    const wy = cy + dx * sin + dy * cos;
    return worldToScreenPt({ x: wx, y: wy }, cam);
  }

  const corners: Vec2[] = [
    rotAndProject(s.x, s.y),
    rotAndProject(s.x + s.width, s.y),
    rotAndProject(s.x + s.width, s.y + s.height),
    rotAndProject(s.x, s.y + s.height),
  ];

  const tc = midpoint(corners[0], corners[1]);
  const mr = midpoint(corners[1], corners[2]);
  const bc = midpoint(corners[2], corners[3]);
  const ml = midpoint(corners[3], corners[0]);

  ctx.save();
  ctx.strokeStyle = SELECTION_COLOR;
  ctx.lineWidth = SELECTION_WIDTH;
  drawPolygonPath(ctx, corners);
  ctx.stroke();

  const dirX = tc.x - bc.x;
  const dirY = tc.y - bc.y;
  const dirLen = Math.sqrt(dirX * dirX + dirY * dirY);
  const rotateOffset = 24;
  let rotatePt: Vec2;
  if (dirLen > 0.001) {
    const nx = dirX / dirLen;
    const ny = dirY / dirLen;
    rotatePt = { x: tc.x + nx * rotateOffset, y: tc.y + ny * rotateOffset };
  } else {
    rotatePt = { x: tc.x, y: tc.y - rotateOffset };
  }

  ctx.beginPath();
  ctx.moveTo(snap(tc.x) - 0.5, snap(tc.y) - 0.5);
  ctx.lineTo(snap(rotatePt.x) - 0.5, snap(rotatePt.y) - 0.5);
  ctx.strokeStyle = SELECTION_COLOR;
  ctx.lineWidth = 1;
  ctx.stroke();
  drawCircleHandle(ctx, rotatePt);

  for (const c of corners) drawSquareHandle(ctx, c);
  for (const m of [tc, mr, bc, ml]) drawSquareHandle(ctx, m, 6);

  ctx.restore();
}

// ── Snap guides (screen space, constant 1px) ──────────────────

function drawSnapGuides(
  ctx: CanvasRenderingContext2D,
  guides: SnapGuide[],
  cam: Camera,
): void {
  ctx.save();
  ctx.strokeStyle = SNAP_GUIDE_COLOR;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);

  for (const g of guides) {
    const from = worldToScreenPt(g.start, cam);
    const to = worldToScreenPt(g.end, cam);
    ctx.beginPath();
    if (g.axis === "x") {
      const sx = snap(from.x) - 0.5;
      ctx.moveTo(sx, Math.min(from.y, to.y));
      ctx.lineTo(sx, Math.max(from.y, to.y));
    } else {
      const sy = snap(from.y) - 0.5;
      ctx.moveTo(Math.min(from.x, to.x), sy);
      ctx.lineTo(Math.max(from.x, to.x), sy);
    }
    ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.restore();
}

// ── Drag preview (screen space) ───────────────────────────────

function drawDragPreview(
  ctx: CanvasRenderingContext2D,
  dp: { type: string; x: number; y: number; w: number; h: number },
  cam: Camera,
): void {
  ctx.save();
  ctx.globalAlpha = 0.4;

  // World → screen
  const tl = worldToScreenPt({ x: dp.x, y: dp.y }, cam);
  const sw = dp.w * cam.zoom;
  const sh = dp.h * cam.zoom;

  ctx.fillStyle = "#818CF8";
  ctx.strokeStyle = "#818CF8";
  ctx.lineWidth = 1.5;

  switch (dp.type) {
    case "ellipse": {
      ctx.beginPath();
      ctx.ellipse(
        tl.x + sw / 2, tl.y + sh / 2,
        Math.abs(sw) / 2, Math.abs(sh) / 2,
        0, 0, Math.PI * 2,
      );
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "line": {
      ctx.beginPath();
      ctx.moveTo(tl.x, tl.y);
      ctx.lineTo(tl.x + sw, tl.y + sh);
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    }
    case "frame": {
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      let fx = tl.x, fy = tl.y, fw = sw, fh = sh;
      if (fw < 0) { fx += fw; fw = -fw; }
      if (fh < 0) { fy += fh; fh = -fh; }
      ctx.strokeRect(snap(fx) - 0.5, snap(fy) - 0.5, fw, fh);
      ctx.setLineDash([]);
      break;
    }
    default: {
      let rx = tl.x, ry = tl.y, rw = sw, rh = sh;
      if (rw < 0) { rx += rw; rw = -rw; }
      if (rh < 0) { ry += rh; rh = -rh; }
      ctx.fillRect(snapFill(rx), snapFill(ry), rw, rh);
      ctx.strokeRect(snap(rx) - 0.5, snap(ry) - 0.5, rw, rh);
    }
  }
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════
// HANDLE PRIMITIVES (constant screen-pixel size — NEVER scale)
// ═══════════════════════════════════════════════════════════════

function drawSquareHandle(ctx: CanvasRenderingContext2D, center: Vec2, size = HANDLE_SIZE): void {
  const x = snap(center.x) - 0.5 - size / 2;
  const y = snap(center.y) - 0.5 - size / 2;
  ctx.fillStyle = HANDLE_FILL;
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = SELECTION_COLOR;
  ctx.lineWidth = HANDLE_STROKE;
  ctx.strokeRect(x, y, size, size);
}

function drawCircleHandle(ctx: CanvasRenderingContext2D, center: Vec2, size = HANDLE_SIZE): void {
  const r = size / 2;
  ctx.beginPath();
  ctx.arc(snap(center.x) - 0.5, snap(center.y) - 0.5, r, 0, Math.PI * 2);
  ctx.fillStyle = HANDLE_FILL;
  ctx.fill();
  ctx.strokeStyle = SELECTION_COLOR;
  ctx.lineWidth = HANDLE_STROKE;
  ctx.stroke();
}

// ═══════════════════════════════════════════════════════════════
// GEOMETRY HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Project 4 local-space corners through worldTransform → viewport → screen.
 * Returns [topLeft, topRight, bottomRight, bottomLeft] in screen px.
 */
function getScreenCorners(
  s: CanvasShape,
  worldTransform: Matrix3,
  cam: Camera,
): [Vec2, Vec2, Vec2, Vec2] {
  const local: Vec2[] = [
    { x: 0, y: 0 },
    { x: s.width, y: 0 },
    { x: s.width, y: s.height },
    { x: 0, y: s.height },
  ];

  return local.map(lc => {
    const world = mat3TransformPoint(worldTransform, lc);
    return worldToScreenPt(world, cam);
  }) as [Vec2, Vec2, Vec2, Vec2];
}

function midpoint(a: Vec2, b: Vec2): Vec2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Draw a closed polygon through pixel-snapped points */
function drawPolygonPath(ctx: CanvasRenderingContext2D, pts: Vec2[]): void {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(snap(pts[0].x) - 0.5, snap(pts[0].y) - 0.5);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(snap(pts[i].x) - 0.5, snap(pts[i].y) - 0.5);
  }
  ctx.closePath();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
