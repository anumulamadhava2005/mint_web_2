// ═══════════════════════════════════════════════════════════════
// Matrix3 — 2D affine transform (3×3 matrix, stored as 6 floats)
//
//   | a  c  tx |      Index layout: [a, b, c, d, tx, ty]
//   | b  d  ty |
//   | 0  0  1  |
//
// Supports: translation, rotation, scale, skew, composition,
//           inversion, point transform, and decomposition.
// ═══════════════════════════════════════════════════════════════

/** 2D affine transform stored as [a, b, c, d, tx, ty] */
export type Matrix3 = [number, number, number, number, number, number];

// ── Constructors ──────────────────────────────────────────────

/** Identity matrix */
export function mat3Identity(): Matrix3 {
  return [1, 0, 0, 1, 0, 0];
}

/** Pure translation */
export function mat3Translate(tx: number, ty: number): Matrix3 {
  return [1, 0, 0, 1, tx, ty];
}

/** Pure rotation (radians) */
export function mat3Rotate(radians: number): Matrix3 {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return [c, s, -s, c, 0, 0];
}

/** Pure scale */
export function mat3Scale(sx: number, sy: number): Matrix3 {
  return [sx, 0, 0, sy, 0, 0];
}

/** Skew (radians along x and y axes) */
export function mat3Skew(skewX: number, skewY: number): Matrix3 {
  return [1, Math.tan(skewY), Math.tan(skewX), 1, 0, 0];
}

// ── Composition ───────────────────────────────────────────────

/**
 * Compose a local transform from decomposed values:
 *   T(tx,ty) × R(rotation) × S(sx,sy)
 *
 * This matches how Figma/Unity/Unreal order transforms.
 */
export function mat3Compose(
  tx: number,
  ty: number,
  rotation: number,   // radians
  sx: number,
  sy: number,
): Matrix3 {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return [
    cos * sx,     // a
    sin * sx,     // b
    -sin * sy,    // c
    cos * sy,     // d
    tx,           // tx
    ty,           // ty
  ];
}

/**
 * Decompose a matrix into translation, rotation, scaleX, scaleY.
 * Assumes the matrix was composed as T × R × S (no skew).
 */
export function mat3Decompose(m: Matrix3): {
  tx: number;
  ty: number;
  rotation: number;   // radians
  scaleX: number;
  scaleY: number;
} {
  const [a, b, c, d, tx, ty] = m;
  const det = a * d - b * c;
  let scaleX = Math.sqrt(a * a + b * b);
  let scaleY = Math.sqrt(c * c + d * d);
  // Correct sign for reflection
  if (det < 0) scaleY = -scaleY;
  const rotation = Math.atan2(b, a);
  return { tx, ty, rotation, scaleX, scaleY };
}

// ── Arithmetic ────────────────────────────────────────────────

/** Multiply two matrices: result = A × B */
export function mat3Multiply(a: Matrix3, b: Matrix3): Matrix3 {
  return [
    a[0] * b[0] + a[2] * b[1],             // a
    a[1] * b[0] + a[3] * b[1],             // b
    a[0] * b[2] + a[2] * b[3],             // c
    a[1] * b[2] + a[3] * b[3],             // d
    a[0] * b[4] + a[2] * b[5] + a[4],      // tx
    a[1] * b[4] + a[3] * b[5] + a[5],      // ty
  ];
}

/** Invert a matrix. Returns identity if singular. */
export function mat3Inverse(m: Matrix3): Matrix3 {
  const [a, b, c, d, tx, ty] = m;
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-12) return mat3Identity();
  const invDet = 1 / det;
  return [
    d * invDet,                         // a
    -b * invDet,                        // b
    -c * invDet,                        // c
    a * invDet,                         // d
    (c * ty - d * tx) * invDet,         // tx
    (b * tx - a * ty) * invDet,         // ty
  ];
}

/** Determinant (a*d - b*c) */
export function mat3Determinant(m: Matrix3): number {
  return m[0] * m[3] - m[1] * m[2];
}

/** Check if two matrices are approximately equal */
export function mat3Equals(a: Matrix3, b: Matrix3, eps = 1e-6): boolean {
  for (let i = 0; i < 6; i++) {
    if (Math.abs(a[i] - b[i]) > eps) return false;
  }
  return true;
}

// ── Point transformation ──────────────────────────────────────

export interface Vec2 { x: number; y: number; }

/** Transform a point by a matrix */
export function mat3TransformPoint(m: Matrix3, p: Vec2): Vec2 {
  return {
    x: m[0] * p.x + m[2] * p.y + m[4],
    y: m[1] * p.x + m[3] * p.y + m[5],
  };
}

/** Transform a direction vector (ignores translation) */
export function mat3TransformVector(m: Matrix3, v: Vec2): Vec2 {
  return {
    x: m[0] * v.x + m[2] * v.y,
    y: m[1] * v.x + m[3] * v.y,
  };
}

/** Convert a world-space point to local space of the given matrix */
export function mat3WorldToLocal(worldTransform: Matrix3, worldPoint: Vec2): Vec2 {
  return mat3TransformPoint(mat3Inverse(worldTransform), worldPoint);
}

/** Convert a local-space point to world space */
export function mat3LocalToWorld(worldTransform: Matrix3, localPoint: Vec2): Vec2 {
  return mat3TransformPoint(worldTransform, localPoint);
}

// ── AABB from transformed rect ────────────────────────────────

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Compute the axis-aligned bounding box of a rectangle transformed by a matrix */
export function mat3TransformAABB(m: Matrix3, rect: Rect): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  const corners = [
    mat3TransformPoint(m, { x: rect.x, y: rect.y }),
    mat3TransformPoint(m, { x: rect.x + rect.width, y: rect.y }),
    mat3TransformPoint(m, { x: rect.x + rect.width, y: rect.y + rect.height }),
    mat3TransformPoint(m, { x: rect.x, y: rect.y + rect.height }),
  ];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of corners) {
    if (c.x < minX) minX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.x > maxX) maxX = c.x;
    if (c.y > maxY) maxY = c.y;
  }
  return { minX, minY, maxX, maxY };
}

// ── Canvas2D integration ──────────────────────────────────────

/** Apply a Matrix3 to a Canvas2D context via setTransform */
export function mat3ApplyToContext(
  ctx: CanvasRenderingContext2D,
  m: Matrix3,
): void {
  ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
}

/** Concatenate a Matrix3 onto the current Canvas2D transform */
export function mat3ConcatToContext(
  ctx: CanvasRenderingContext2D,
  m: Matrix3,
): void {
  ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
}
