// Vector Engine Utilities for High-Performance Canvas Rendering

export type Point = {
  x: number;
  y: number;
};

export type Matrix3 = number[]; // 3x3 matrix as flat array [9 elements]

// Transform utilities
export class Transform {
  static identity(): Matrix3 {
    return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  }

  static translation(tx: number, ty: number): Matrix3 {
    return [1, 0, 0, 0, 1, 0, tx, ty, 1];
  }

  static rotation(angleInRadians: number): Matrix3 {
    const c = Math.cos(angleInRadians);
    const s = Math.sin(angleInRadians);
    return [c, s, 0, -s, c, 0, 0, 0, 1];
  }

  static scaling(sx: number, sy: number): Matrix3 {
    return [sx, 0, 0, 0, sy, 0, 0, 0, 1];
  }

  static multiply(a: Matrix3, b: Matrix3): Matrix3 {
    const a00 = a[0], a01 = a[1], a02 = a[2];
    const a10 = a[3], a11 = a[4], a12 = a[5];
    const a20 = a[6], a21 = a[7], a22 = a[8];
    const b00 = b[0], b01 = b[1], b02 = b[2];
    const b10 = b[3], b11 = b[4], b12 = b[5];
    const b20 = b[6], b21 = b[7], b22 = b[8];

    return [
      a00 * b00 + a01 * b10 + a02 * b20,
      a00 * b01 + a01 * b11 + a02 * b21,
      a00 * b02 + a01 * b12 + a02 * b22,
      a10 * b00 + a11 * b10 + a12 * b20,
      a10 * b01 + a11 * b11 + a12 * b21,
      a10 * b02 + a11 * b12 + a12 * b22,
      a20 * b00 + a21 * b10 + a22 * b20,
      a20 * b01 + a21 * b11 + a22 * b21,
      a20 * b02 + a21 * b12 + a22 * b22,
    ];
  }

  static transformPoint(matrix: Matrix3, point: Point): Point {
    const x = point.x * matrix[0] + point.y * matrix[3] + matrix[6];
    const y = point.x * matrix[1] + point.y * matrix[4] + matrix[7];
    return { x, y };
  }
}

// Vector path utilities
export class VectorPath {
  static createRectangle(x: number, y: number, width: number, height: number): Point[] {
    return [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ];
  }

  static createCircle(cx: number, cy: number, radius: number, segments: number = 32): Point[] {
    const points: Point[] = [];
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push({
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      });
    }
    return points;
  }

  static createEllipse(
    cx: number,
    cy: number,
    radiusX: number,
    radiusY: number,
    segments: number = 32
  ): Point[] {
    const points: Point[] = [];
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push({
        x: cx + Math.cos(angle) * radiusX,
        y: cy + Math.sin(angle) * radiusY,
      });
    }
    return points;
  }

  static triangulate(points: Point[]): number[] {
    // Simple ear clipping triangulation for convex polygons
    const vertices: number[] = [];
    if (points.length < 3) return vertices;

    // For simple fan triangulation (works for convex polygons)
    for (let i = 1; i < points.length - 1; i++) {
      vertices.push(points[0].x, points[0].y);
      vertices.push(points[i].x, points[i].y);
      vertices.push(points[i + 1].x, points[i + 1].y);
    }

    return vertices;
  }

  static getBoundingBox(points: Point[]): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  } {
    if (points.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
    }

    let minX = points[0].x;
    let minY = points[0].y;
    let maxX = points[0].x;
    let maxY = points[0].y;

    for (const point of points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  static smoothPath(points: Point[], tension: number = 0.5): Point[] {
    if (points.length < 3) return points;

    const smoothed: Point[] = [];
    smoothed.push(points[0]);

    for (let i = 1; i < points.length - 1; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];

      // Catmull-Rom spline
      for (let t = 0; t < 1; t += 0.1) {
        const t2 = t * t;
        const t3 = t2 * t;

        const x =
          0.5 *
          (2 * p1.x +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p2.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p2.x) * t3);

        const y =
          0.5 *
          (2 * p1.y +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p2.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p2.y) * t3);

        smoothed.push({ x, y });
      }
    }

    smoothed.push(points[points.length - 1]);
    return smoothed;
  }
}

// Color utilities
export class ColorUtils {
  static hexToRGBA(hex: string): [number, number, number, number] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return [0, 0, 0, 1];

    return [
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255,
      1,
    ];
  }

  static rgbaToHex(r: number, g: number, b: number): string {
    const toHex = (n: number) => {
      const hex = Math.round(n * 255).toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  static interpolate(
    color1: [number, number, number, number],
    color2: [number, number, number, number],
    t: number
  ): [number, number, number, number] {
    return [
      color1[0] + (color2[0] - color1[0]) * t,
      color1[1] + (color2[1] - color1[1]) * t,
      color1[2] + (color2[2] - color1[2]) * t,
      color1[3] + (color2[3] - color1[3]) * t,
    ];
  }
}

// Spatial indexing for performance with many shapes
export class SpatialGrid {
  private cellSize: number;
  private grid: Map<string, Set<string>>;

  constructor(cellSize: number = 100) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  private getCellKey(x: number, y: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX},${cellY}`;
  }

  insert(id: string, x: number, y: number, width: number, height: number): void {
    const minCellX = Math.floor(x / this.cellSize);
    const minCellY = Math.floor(y / this.cellSize);
    const maxCellX = Math.floor((x + width) / this.cellSize);
    const maxCellY = Math.floor((y + height) / this.cellSize);

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cy = minCellY; cy <= maxCellY; cy++) {
        const key = `${cx},${cy}`;
        if (!this.grid.has(key)) {
          this.grid.set(key, new Set());
        }
        this.grid.get(key)!.add(id);
      }
    }
  }

  query(x: number, y: number, width: number, height: number): Set<string> {
    const results = new Set<string>();
    const minCellX = Math.floor(x / this.cellSize);
    const minCellY = Math.floor(y / this.cellSize);
    const maxCellX = Math.floor((x + width) / this.cellSize);
    const maxCellY = Math.floor((y + height) / this.cellSize);

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cy = minCellY; cy <= maxCellY; cy++) {
        const key = `${cx},${cy}`;
        const cell = this.grid.get(key);
        if (cell) {
          cell.forEach((id) => results.add(id));
        }
      }
    }

    return results;
  }

  clear(): void {
    this.grid.clear();
  }
}

// Performance utilities
export class PerformanceMonitor {
  private frames: number[] = [];
  private lastTime: number = performance.now();

  tick(): number {
    const now = performance.now();
    const delta = now - this.lastTime;
    this.lastTime = now;

    this.frames.push(1000 / delta);
    if (this.frames.length > 60) {
      this.frames.shift();
    }

    return delta;
  }

  getFPS(): number {
    if (this.frames.length === 0) return 0;
    const sum = this.frames.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.frames.length);
  }

  reset(): void {
    this.frames = [];
    this.lastTime = performance.now();
  }
}

// Viewport/Camera utilities
export class Viewport {
  x: number;
  y: number;
  zoom: number;
  minZoom: number;
  maxZoom: number;

  constructor(
    x: number = 0,
    y: number = 0,
    zoom: number = 1,
    minZoom: number = 0.1,
    maxZoom: number = 10
  ) {
    this.x = x;
    this.y = y;
    this.zoom = Math.max(minZoom, Math.min(maxZoom, zoom));
    this.minZoom = minZoom;
    this.maxZoom = maxZoom;
  }

  screenToWorld(screenX: number, screenY: number, width: number, height: number): Point {
    return {
      x: (screenX - width / 2) / this.zoom - this.x,
      y: -(screenY - height / 2) / this.zoom - this.y,
    };
  }

  worldToScreen(worldX: number, worldY: number, width: number, height: number): Point {
    return {
      x: (worldX + this.x) * this.zoom + width / 2,
      y: -(worldY + this.y) * this.zoom + height / 2,
    };
  }

  pan(dx: number, dy: number): void {
    this.x -= dx / this.zoom;
    this.y += dy / this.zoom;
  }

  zoomAt(screenX: number, screenY: number, factor: number, width: number, height: number): void {
    const worldBefore = this.screenToWorld(screenX, screenY, width, height);
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));
    const worldAfter = this.screenToWorld(screenX, screenY, width, height);

    this.x += worldBefore.x - worldAfter.x;
    this.y += worldBefore.y - worldAfter.y;
  }

  reset(): void {
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
  }

  fitBounds(minX: number, minY: number, maxX: number, maxY: number, width: number, height: number): void {
    const worldWidth = maxX - minX;
    const worldHeight = maxY - minY;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const zoomX = width / worldWidth;
    const zoomY = height / worldHeight;
    this.zoom = Math.min(zoomX, zoomY) * 0.9; // 90% to add padding
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom));

    this.x = -centerX;
    this.y = -centerY;
  }
}
