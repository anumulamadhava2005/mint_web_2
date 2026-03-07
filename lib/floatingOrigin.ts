// ═══════════════════════════════════════════════════════════════
// Floating Origin System — Precision at extreme zoom/coordinates
//
// Problem: IEEE-754 double precision loses sub-pixel accuracy
// when coordinates grow large. At zoom 256x on a canvas
// thousands of pixels wide, vertex positions jitter visibly.
//
// Solution: "Floating origin" — keep rendering coordinates near
// the origin by periodically rebasing the world. The camera
// stores a high-precision origin offset, rendering always
// happens near (0,0) in local space.
//
// Used in: game engines (Unreal, Unity DOTS), GIS viewers,
// astronomy visualization, and — when zoom spans 0.01× to
// 256× — design tools like this one.
//
// Integration:
//   1. Before rendering, compute rebasedViewport
//   2. Transform shapes into rebased space for GPU upload
//   3. On large pan/zoom, call rebaseIfNeeded()
//   4. All hit-testing uses rebased coords
// ═══════════════════════════════════════════════════════════════

export interface FloatingOriginState {
  /** High-precision origin X in world space */
  originX: number;
  /** High-precision origin Y in world space */
  originY: number;
  /** Threshold distance from origin before rebasing */
  rebaseThreshold: number;
  /** Number of times rebasing has occurred (diagnostic) */
  rebaseCount: number;
}

/**
 * FloatingOrigin manages coordinate space rebasing to maintain
 * float precision during extreme zoom and large pan operations.
 */
export class FloatingOrigin {
  private originX = 0;
  private originY = 0;
  private rebaseThreshold: number;
  private rebaseCount = 0;

  /**
   * @param rebaseThreshold Distance from origin before rebasing.
   *   Default 10000 — works well for canvas coordinates.
   *   Lower values rebase more often (more precision, slight overhead).
   */
  constructor(rebaseThreshold = 10_000) {
    this.rebaseThreshold = rebaseThreshold;
  }

  // ── Coordinate Transforms ─────────────────────────────

  /**
   * Convert a world-space position to rebased rendering space.
   * Used when uploading vertex data to the GPU or drawing to canvas.
   */
  worldToRebased(worldX: number, worldY: number): [number, number] {
    return [worldX - this.originX, worldY - this.originY];
  }

  /**
   * Convert rebased rendering space back to world space.
   * Used when interpreting user input (clicks, drags).
   */
  rebasedToWorld(rebasedX: number, rebasedY: number): [number, number] {
    return [rebasedX + this.originX, rebasedY + this.originY];
  }

  /**
   * Rebase the camera viewport, returning rebased camera coordinates.
   * The camera's "world position" stays the same semantically,
   * but rendering coordinates stay near the origin.
   *
   * @param cameraWorldX Camera center in world space
   * @param cameraWorldY Camera center in world space
   * @returns [rebasedCameraX, rebasedCameraY] for rendering
   */
  rebaseCamera(
    cameraWorldX: number,
    cameraWorldY: number,
  ): [number, number] {
    return [cameraWorldX - this.originX, cameraWorldY - this.originY];
  }

  // ── Rebase Check ──────────────────────────────────────

  /**
   * Check if the camera has moved far enough from origin to require
   * rebasing. Call this after significant pan/zoom operations.
   *
   * @param cameraWorldX Camera center X in world coordinates
   * @param cameraWorldY Camera center Y in world coordinates
   * @returns true if rebasing occurred
   */
  rebaseIfNeeded(cameraWorldX: number, cameraWorldY: number): boolean {
    const dx = cameraWorldX - this.originX;
    const dy = cameraWorldY - this.originY;
    const dist2 = dx * dx + dy * dy;
    const threshold2 = this.rebaseThreshold * this.rebaseThreshold;

    if (dist2 > threshold2) {
      // Snap origin to camera position (quantized to avoid micro-jitter)
      const quantize = 1000;
      this.originX = Math.round(cameraWorldX / quantize) * quantize;
      this.originY = Math.round(cameraWorldY / quantize) * quantize;
      this.rebaseCount++;
      return true;
    }

    return false;
  }

  /**
   * Force a rebase to a specific world position.
   * Useful when loading a saved document or jumping to a bookmark.
   */
  forceRebase(worldX: number, worldY: number): void {
    this.originX = worldX;
    this.originY = worldY;
    this.rebaseCount++;
  }

  /**
   * Reset origin to (0,0). Use when starting a new document.
   */
  reset(): void {
    this.originX = 0;
    this.originY = 0;
    this.rebaseCount = 0;
  }

  // ── Transform Helpers ─────────────────────────────────

  /**
   * Apply floating origin offset to an entire transform matrix.
   * For a 2D affine matrix [a, b, c, d, tx, ty], adjusts tx/ty.
   *
   * @param matrix 6-element affine transform
   * @returns New matrix with rebased translation
   */
  rebaseMatrix(matrix: [number, number, number, number, number, number]):
    [number, number, number, number, number, number] {
    return [
      matrix[0], matrix[1],
      matrix[2], matrix[3],
      matrix[4] - this.originX,
      matrix[5] - this.originY,
    ];
  }

  /**
   * Rebase a bounding rect (x, y, w, h) into rendering space.
   */
  rebaseBounds(x: number, y: number, w: number, h: number):
    { x: number; y: number; w: number; h: number } {
    return {
      x: x - this.originX,
      y: y - this.originY,
      w,
      h,
    };
  }

  // ── Precision Diagnostics ─────────────────────────────

  /**
   * Compute the current precision in pixels at a given zoom level.
   * Double-precision floats have ~15 significant decimal digits.
   * This returns the smallest distinguishable delta in world-space
   * coordinates around the current origin neighborhood.
   *
   * @param zoom Current zoom level
   * @returns Precision epsilon in screen pixels
   */
  getPrecisionEpsilon(zoom: number): number {
    // Distance from origin affects available mantissa bits
    const maxCoord = Math.max(
      Math.abs(this.originX),
      Math.abs(this.originY),
    ) + this.rebaseThreshold;

    // Machine epsilon for double: 2^-52 ≈ 2.22e-16
    const machineEps = 2.220446049250313e-16;
    const worldEps = maxCoord * machineEps;

    // Convert to screen pixels
    return worldEps * zoom;
  }

  /**
   * Check if precision is acceptable for the current zoom.
   * Returns false if sub-pixel jitter would be visible.
   *
   * @param zoom Current zoom level
   * @param threshold Minimum acceptable pixel precision (default 0.01)
   */
  isPrecisionAcceptable(zoom: number, threshold = 0.01): boolean {
    return this.getPrecisionEpsilon(zoom) < threshold;
  }

  // ── State ─────────────────────────────────────────────

  getOrigin(): [number, number] {
    return [this.originX, this.originY];
  }

  getRebaseCount(): number {
    return this.rebaseCount;
  }

  getState(): FloatingOriginState {
    return {
      originX: this.originX,
      originY: this.originY,
      rebaseThreshold: this.rebaseThreshold,
      rebaseCount: this.rebaseCount,
    };
  }
}
