// ═══════════════════════════════════════════════════════════════
// Geometry Utilities
// Mirrors: common/src/app/common/geom/
// ═══════════════════════════════════════════════════════════════

import type { Point, Rect, SelectionRect, Matrix2D, PenpotShape } from "./types";

// ── Points ────────────────────────────────────────────────────
export function point(x = 0, y = 0): Point {
  return { x, y };
}

export function addPoints(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function subPoints(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scalePoint(p: Point, factor: number): Point {
  return { x: p.x * factor, y: p.y * factor };
}

export function distPoints(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function lerpPoint(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function rotatePoint(p: Point, angle: number, center: Point = point()): Point {
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

// ── Matrices (SVG-compatible 2D affine) ───────────────────────
export function identityMatrix(): Matrix2D {
  return [1, 0, 0, 1, 0, 0];
}

export function translateMatrix(tx: number, ty: number): Matrix2D {
  return [1, 0, 0, 1, tx, ty];
}

export function rotateMatrix(angleDeg: number): Matrix2D {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [cos, sin, -sin, cos, 0, 0];
}

export function scaleMatrix(sx: number, sy: number): Matrix2D {
  return [sx, 0, 0, sy, 0, 0];
}

export function multiplyMatrices(a: Matrix2D, b: Matrix2D): Matrix2D {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

export function invertMatrix(m: Matrix2D): Matrix2D | null {
  const det = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(det) < 1e-10) return null;
  const invDet = 1 / det;
  return [
    m[3] * invDet,
    -m[1] * invDet,
    -m[2] * invDet,
    m[0] * invDet,
    (m[2] * m[5] - m[3] * m[4]) * invDet,
    (m[1] * m[4] - m[0] * m[5]) * invDet,
  ];
}

export function transformPoint(p: Point, m: Matrix2D): Point {
  return {
    x: m[0] * p.x + m[2] * p.y + m[4],
    y: m[1] * p.x + m[3] * p.y + m[5],
  };
}

export function matrixToSVG(m: Matrix2D): string {
  return `matrix(${m.join(",")})`;
}

// ── Rectangles ────────────────────────────────────────────────
export function makeRect(x: number, y: number, w: number, h: number): Rect {
  return { x, y, width: w, height: h };
}

export function rectCenter(r: Rect): Point {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function rectContainsPoint(r: Rect, p: Point): boolean {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}

export function boundsFromShapes(shapes: PenpotShape[]): Rect {
  if (shapes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const s of shapes) {
    minX = Math.min(minX, s.x);
    minY = Math.min(minY, s.y);
    maxX = Math.max(maxX, s.x + s.width);
    maxY = Math.max(maxY, s.y + s.height);
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function selectionRectFromRect(r: Rect): SelectionRect {
  return {
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
    x1: r.x,
    y1: r.y,
    x2: r.x + r.width,
    y2: r.y + r.height,
  };
}

// ── Shape Geometry ────────────────────────────────────────────
export function shapeCenter(s: PenpotShape): Point {
  return { x: s.x + s.width / 2, y: s.y + s.height / 2 };
}

export function shapeBounds(s: PenpotShape): Rect {
  // For shapes with rotation, compute the rotated bounding box
  if (s.rotation && s.rotation !== 0) {
    const center = shapeCenter(s);
    const corners: Point[] = [
      { x: s.x, y: s.y },
      { x: s.x + s.width, y: s.y },
      { x: s.x + s.width, y: s.y + s.height },
      { x: s.x, y: s.y + s.height },
    ];
    const rotated = corners.map((c) => rotatePoint(c, s.rotation, center));
    let mnX = Infinity,
      mnY = Infinity,
      mxX = -Infinity,
      mxY = -Infinity;
    for (const p of rotated) {
      mnX = Math.min(mnX, p.x);
      mnY = Math.min(mnY, p.y);
      mxX = Math.max(mxX, p.x);
      mxY = Math.max(mxY, p.y);
    }
    return { x: mnX, y: mnY, width: mxX - mnX, height: mxY - mnY };
  }
  return { x: s.x, y: s.y, width: s.width, height: s.height };
}

// ── Viewbox helpers ───────────────────────────────────────────
export interface Viewbox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export function formatViewbox(vbox: Viewbox): string {
  return `${vbox.x} ${vbox.y} ${vbox.width} ${vbox.height}`;
}

export function zoomFromViewbox(vport: Viewport, vbox: Viewbox): number {
  return vport.width / vbox.width;
}

export function screenToWorld(screenP: Point, vbox: Viewbox, vport: Viewport): Point {
  return {
    x: vbox.x + (screenP.x / vport.width) * vbox.width,
    y: vbox.y + (screenP.y / vport.height) * vbox.height,
  };
}

export function worldToScreen(worldP: Point, vbox: Viewbox, vport: Viewport): Point {
  return {
    x: ((worldP.x - vbox.x) / vbox.width) * vport.width,
    y: ((worldP.y - vbox.y) / vbox.height) * vport.height,
  };
}

/** Zoom towards a specific point in screen coordinates */
export function zoomAtScreenPoint(
  vbox: Viewbox,
  vport: Viewport,
  screenP: Point,
  zoomDelta: number
): Viewbox {
  const worldP = screenToWorld(screenP, vbox, vport);
  const currentZoom = zoomFromViewbox(vport, vbox);
  const newZoom = Math.max(0.01, Math.min(256, currentZoom * (1 + zoomDelta)));
  const newWidth = vport.width / newZoom;
  const newHeight = vport.height / newZoom;

  return {
    x: worldP.x - (screenP.x / vport.width) * newWidth,
    y: worldP.y - (screenP.y / vport.height) * newHeight,
    width: newWidth,
    height: newHeight,
  };
}
