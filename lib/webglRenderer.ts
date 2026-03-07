// ═══════════════════════════════════════════════════════════════
// WebGL Rendering Layer — GPU-accelerated canvas rendering
//
// Canvas2D becomes slow with:
//   - Thousands of objects
//   - Complex transforms
//   - Deep zoom levels
//
// WebGL enables:
//   - Batch rendering (thousands of shapes in few draw calls)
//   - Transforms in shader (GPU handles matrix math)
//   - Instanced rendering for identical shapes
//   - Anti-aliased edges via SDF
//
// Architecture:
//   Scene Graph traversal
//       ↓
//   Batch collection (group by shader/material)
//       ↓
//   Upload vertex buffers
//       ↓
//   Draw calls (minimal state changes)
//       ↓
//   Post-process (selection highlights, guides)
//
// Falls back to Canvas2D if WebGL is unavailable.
// ═══════════════════════════════════════════════════════════════

import type { CanvasShape, Vec2, AABB, Camera } from "./canvasEngine";
import type { Matrix3 } from "./matrix3";
import type { SceneGraph } from "./sceneGraph";
import type { SnapGuide } from "./snappingEngine";

// ── Vertex format ─────────────────────────────────────────────
// Each vertex: position (2), texCoord (2), color (4), transform (6)
const VERTEX_FLOATS = 14;
const MAX_BATCH_QUADS = 4096;
const MAX_BATCH_VERTICES = MAX_BATCH_QUADS * 4;
const MAX_BATCH_INDICES = MAX_BATCH_QUADS * 6;

// ── Shader sources ────────────────────────────────────────────

const SHAPE_VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  attribute vec4 a_color;
  attribute vec2 a_transform_ab;  // [a, b]
  attribute vec2 a_transform_cd;  // [c, d]
  attribute vec2 a_transform_tx;  // [tx, ty]

  uniform mat3 u_viewMatrix;

  varying vec2 v_texCoord;
  varying vec4 v_color;

  void main() {
    // Apply shape transform
    float a = a_transform_ab.x;
    float b = a_transform_ab.y;
    float c = a_transform_cd.x;
    float d = a_transform_cd.y;
    float tx = a_transform_tx.x;
    float ty = a_transform_tx.y;

    vec2 transformed = vec2(
      a * a_position.x + c * a_position.y + tx,
      b * a_position.x + d * a_position.y + ty
    );

    // Apply view transform (camera)
    vec3 viewPos = u_viewMatrix * vec3(transformed, 1.0);
    gl_Position = vec4(viewPos.xy, 0.0, 1.0);

    v_texCoord = a_texCoord;
    v_color = a_color;
  }
`;

const SHAPE_FRAGMENT_SHADER = `
  precision mediump float;

  varying vec2 v_texCoord;
  varying vec4 v_color;

  uniform float u_cornerRadius;
  uniform vec2 u_shapeSize;

  float roundedBoxSDF(vec2 center, vec2 half_size, float radius) {
    vec2 d = abs(center) - half_size + radius;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - radius;
  }

  void main() {
    vec4 color = v_color;

    // Apply rounded corner SDF if needed
    if (u_cornerRadius > 0.0 && u_shapeSize.x > 0.0) {
      vec2 center = (v_texCoord - 0.5) * u_shapeSize;
      vec2 half_size = u_shapeSize * 0.5;
      float dist = roundedBoxSDF(center, half_size, u_cornerRadius);
      float aa = fwidth(dist);
      float alpha = 1.0 - smoothstep(-aa, aa, dist);
      color.a *= alpha;
    }

    if (color.a < 0.01) discard;
    gl_FragColor = color;
  }
`;

const GUIDE_VERTEX_SHADER = `
  attribute vec2 a_position;
  uniform mat3 u_viewMatrix;

  void main() {
    vec3 viewPos = u_viewMatrix * vec3(a_position, 1.0);
    gl_Position = vec4(viewPos.xy, 0.0, 1.0);
  }
`;

const GUIDE_FRAGMENT_SHADER = `
  precision mediump float;
  uniform vec4 u_color;

  void main() {
    gl_FragColor = u_color;
  }
`;

// ── Render batch ──────────────────────────────────────────────

interface RenderBatch {
  vertices: Float32Array;
  indices: Uint16Array;
  vertexCount: number;
  indexCount: number;
  quadCount: number;
}

// ── Color helpers ─────────────────────────────────────────────

function hexToRGBA(hex: string): [number, number, number, number] {
  if (!hex || hex === "transparent" || hex === "") return [0, 0, 0, 0];
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i.exec(hex);
  if (!result) return [0, 0, 0, 1];
  return [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255,
    1,
  ];
}

/**
 * WebGL Rendering Layer.
 * Provides GPU-accelerated rendering with batch support.
 */
export class WebGLRenderer {
  private gl: WebGLRenderingContext | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private shapeProgram: WebGLProgram | null = null;
  private guideProgram: WebGLProgram | null = null;
  private vertexBuffer: WebGLBuffer | null = null;
  private indexBuffer: WebGLBuffer | null = null;
  private initialized = false;

  // Pre-allocated batch data
  private batchVertices: Float32Array;
  private batchIndices: Uint16Array;
  private batchQuadCount = 0;

  constructor() {
    this.batchVertices = new Float32Array(MAX_BATCH_VERTICES * VERTEX_FLOATS);
    this.batchIndices = new Uint16Array(MAX_BATCH_INDICES);

    // Pre-generate shared index buffer pattern
    for (let i = 0; i < MAX_BATCH_QUADS; i++) {
      const vi = i * 4;
      const ii = i * 6;
      this.batchIndices[ii] = vi;
      this.batchIndices[ii + 1] = vi + 1;
      this.batchIndices[ii + 2] = vi + 2;
      this.batchIndices[ii + 3] = vi;
      this.batchIndices[ii + 4] = vi + 2;
      this.batchIndices[ii + 5] = vi + 3;
    }
  }

  /**
   * Initialize the WebGL context and compile shaders.
   * Returns false if WebGL is not available.
   */
  init(canvas: HTMLCanvasElement): boolean {
    this.canvas = canvas;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });

    if (!gl) {
      console.warn("WebGL not available, falling back to Canvas2D");
      return false;
    }

    this.gl = gl;

    // Compile shaders
    this.shapeProgram = this.createProgram(SHAPE_VERTEX_SHADER, SHAPE_FRAGMENT_SHADER);
    this.guideProgram = this.createProgram(GUIDE_VERTEX_SHADER, GUIDE_FRAGMENT_SHADER);

    if (!this.shapeProgram || !this.guideProgram) {
      console.warn("WebGL shader compilation failed");
      return false;
    }

    // Create buffers
    this.vertexBuffer = gl.createBuffer();
    this.indexBuffer = gl.createBuffer();

    // Enable blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    this.initialized = true;
    return true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Render the full scene using WebGL.
   */
  render(
    width: number,
    height: number,
    cam: Camera,
    sceneGraph: SceneGraph,
    selectedIds: Set<string>,
    snapGuides: SnapGuide[],
    selectionRect: AABB | null,
  ): void {
    const gl = this.gl;
    if (!gl || !this.shapeProgram) return;

    const dpr = window.devicePixelRatio || 1;
    const canvasW = width * dpr;
    const canvasH = height * dpr;

    if (this.canvas) {
      if (this.canvas.width !== canvasW || this.canvas.height !== canvasH) {
        this.canvas.width = canvasW;
        this.canvas.height = canvasH;
      }
    }

    gl.viewport(0, 0, canvasW, canvasH);

    // Clear
    gl.clearColor(0.102, 0.102, 0.102, 1.0); // #1a1a1a
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Build view matrix: screen_pos = (world_pos * zoom + cam_offset) → NDC
    // NDC: x∈[-1,1], y∈[-1,1]
    const viewMatrix = this.buildViewMatrix(width, height, cam);

    // Use shape program
    gl.useProgram(this.shapeProgram);

    // Set view matrix uniform
    const viewLoc = gl.getUniformLocation(this.shapeProgram, "u_viewMatrix");
    gl.uniformMatrix3fv(viewLoc, false, viewMatrix);

    // Batch and render shapes
    this.beginBatch();

    sceneGraph.traverse((id, worldTransform, _depth) => {
      const shape = sceneGraph.getShape(id);
      if (!shape || !shape.visible) return;
      this.addShapeToBatch(shape, worldTransform);
    });

    this.flushBatch();

    // Render snap guides
    if (snapGuides.length > 0 && this.guideProgram) {
      this.renderSnapGuides(snapGuides, viewMatrix);
    }

    // Render selection highlights
    if (selectedIds.size > 0) {
      this.renderSelectionHighlights(selectedIds, sceneGraph, viewMatrix, cam);
    }

    // Render marquee rect
    if (selectionRect) {
      this.renderMarqueeRect(selectionRect, viewMatrix);
    }
  }

  // ── Batch system ────────────────────────────────────────

  private beginBatch(): void {
    this.batchQuadCount = 0;
  }

  private addShapeToBatch(shape: CanvasShape, worldTransform: Matrix3): void {
    if (this.batchQuadCount >= MAX_BATCH_QUADS) {
      this.flushBatch();
      this.beginBatch();
    }

    const [r, g, b, a] = hexToRGBA(shape.fill);
    const opacity = shape.opacity;

    // Quad vertices in local space (0, 0, width, height)
    const w = shape.width;
    const h = shape.height;
    const positions: [number, number][] = [
      [0, 0], [w, 0], [w, h], [0, h],
    ];
    const texCoords: [number, number][] = [
      [0, 0], [1, 0], [1, 1], [0, 1],
    ];

    const offset = this.batchQuadCount * 4 * VERTEX_FLOATS;

    for (let vi = 0; vi < 4; vi++) {
      const base = offset + vi * VERTEX_FLOATS;
      // Position
      this.batchVertices[base] = positions[vi][0];
      this.batchVertices[base + 1] = positions[vi][1];
      // TexCoord
      this.batchVertices[base + 2] = texCoords[vi][0];
      this.batchVertices[base + 3] = texCoords[vi][1];
      // Color
      this.batchVertices[base + 4] = r;
      this.batchVertices[base + 5] = g;
      this.batchVertices[base + 6] = b;
      this.batchVertices[base + 7] = a * opacity;
      // Transform (6 floats: a, b, c, d, tx, ty)
      this.batchVertices[base + 8] = worldTransform[0];
      this.batchVertices[base + 9] = worldTransform[1];
      this.batchVertices[base + 10] = worldTransform[2];
      this.batchVertices[base + 11] = worldTransform[3];
      this.batchVertices[base + 12] = worldTransform[4];
      this.batchVertices[base + 13] = worldTransform[5];
    }

    this.batchQuadCount++;
  }

  private flushBatch(): void {
    const gl = this.gl;
    if (!gl || !this.shapeProgram || this.batchQuadCount === 0) return;

    const vertexCount = this.batchQuadCount * 4;
    const indexCount = this.batchQuadCount * 6;

    // Upload vertex data
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      this.batchVertices.subarray(0, vertexCount * VERTEX_FLOATS),
      gl.DYNAMIC_DRAW,
    );

    // Upload index data
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      this.batchIndices.subarray(0, indexCount),
      gl.DYNAMIC_DRAW,
    );

    const stride = VERTEX_FLOATS * 4; // bytes per vertex

    // Setup attributes
    const posLoc = gl.getAttribLocation(this.shapeProgram, "a_position");
    const texLoc = gl.getAttribLocation(this.shapeProgram, "a_texCoord");
    const colLoc = gl.getAttribLocation(this.shapeProgram, "a_color");
    const tabLoc = gl.getAttribLocation(this.shapeProgram, "a_transform_ab");
    const tcdLoc = gl.getAttribLocation(this.shapeProgram, "a_transform_cd");
    const ttxLoc = gl.getAttribLocation(this.shapeProgram, "a_transform_tx");

    if (posLoc >= 0) {
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, stride, 0);
    }
    if (texLoc >= 0) {
      gl.enableVertexAttribArray(texLoc);
      gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, stride, 8);
    }
    if (colLoc >= 0) {
      gl.enableVertexAttribArray(colLoc);
      gl.vertexAttribPointer(colLoc, 4, gl.FLOAT, false, stride, 16);
    }
    if (tabLoc >= 0) {
      gl.enableVertexAttribArray(tabLoc);
      gl.vertexAttribPointer(tabLoc, 2, gl.FLOAT, false, stride, 32);
    }
    if (tcdLoc >= 0) {
      gl.enableVertexAttribArray(tcdLoc);
      gl.vertexAttribPointer(tcdLoc, 2, gl.FLOAT, false, stride, 40);
    }
    if (ttxLoc >= 0) {
      gl.enableVertexAttribArray(ttxLoc);
      gl.vertexAttribPointer(ttxLoc, 2, gl.FLOAT, false, stride, 48);
    }

    // Set uniforms
    const crLoc = gl.getUniformLocation(this.shapeProgram, "u_cornerRadius");
    const ssLoc = gl.getUniformLocation(this.shapeProgram, "u_shapeSize");
    gl.uniform1f(crLoc, 0);
    gl.uniform2f(ssLoc, 0, 0);

    // Draw
    gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);

    this.batchQuadCount = 0;
  }

  // ── View matrix ─────────────────────────────────────────

  private buildViewMatrix(
    screenWidth: number,
    screenHeight: number,
    cam: Camera,
  ): Float32Array {
    // world → screen: pos * zoom + offset
    // screen → NDC: (pos / halfSize) - 1
    // Combined: ((world * zoom + cam) / halfSize) * 2 - 1
    const sx = (2 * cam.zoom) / screenWidth;
    const sy = -(2 * cam.zoom) / screenHeight; // flip Y for WebGL
    const tx = (2 * cam.x) / screenWidth - 1;
    const ty = -(2 * cam.y) / screenHeight + 1;

    return new Float32Array([
      sx, 0, 0,
      0, sy, 0,
      tx, ty, 1,
    ]);
  }

  // ── Guides rendering ───────────────────────────────────

  private renderSnapGuides(
    guides: SnapGuide[],
    viewMatrix: Float32Array,
  ): void {
    const gl = this.gl;
    if (!gl || !this.guideProgram) return;

    gl.useProgram(this.guideProgram);

    const viewLoc = gl.getUniformLocation(this.guideProgram, "u_viewMatrix");
    gl.uniformMatrix3fv(viewLoc, false, viewMatrix);

    const colorLoc = gl.getUniformLocation(this.guideProgram, "u_color");
    gl.uniform4f(colorLoc, 1.0, 0.3, 0.3, 0.8); // Red snap guides

    for (const guide of guides) {
      const vertices = new Float32Array([
        guide.start.x, guide.start.y,
        guide.end.x, guide.end.y,
      ]);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);

      const posLoc = gl.getAttribLocation(this.guideProgram, "a_position");
      if (posLoc >= 0) {
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
      }

      gl.drawArrays(gl.LINES, 0, 2);
    }
  }

  // ── Selection highlights ────────────────────────────────

  private renderSelectionHighlights(
    selectedIds: Set<string>,
    sceneGraph: SceneGraph,
    viewMatrix: Float32Array,
    cam: Camera,
  ): void {
    const gl = this.gl;
    if (!gl || !this.guideProgram) return;

    gl.useProgram(this.guideProgram);

    const viewLoc = gl.getUniformLocation(this.guideProgram, "u_viewMatrix");
    gl.uniformMatrix3fv(viewLoc, false, viewMatrix);

    const colorLoc = gl.getUniformLocation(this.guideProgram, "u_color");
    gl.uniform4f(colorLoc, 0.31, 0.56, 0.97, 1.0); // Selection blue

    for (const id of selectedIds) {
      const wb = sceneGraph.getWorldBounds(id);
      if (!wb) continue;

      // Draw selection rect as line loop
      const vertices = new Float32Array([
        wb.minX, wb.minY,
        wb.maxX, wb.minY,
        wb.maxX, wb.maxY,
        wb.minX, wb.maxY,
      ]);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);

      const posLoc = gl.getAttribLocation(this.guideProgram, "a_position");
      if (posLoc >= 0) {
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
      }

      gl.drawArrays(gl.LINE_LOOP, 0, 4);
    }
  }

  // ── Marquee rect ────────────────────────────────────────

  private renderMarqueeRect(
    rect: AABB,
    viewMatrix: Float32Array,
  ): void {
    const gl = this.gl;
    if (!gl || !this.guideProgram) return;

    gl.useProgram(this.guideProgram);

    const viewLoc = gl.getUniformLocation(this.guideProgram, "u_viewMatrix");
    gl.uniformMatrix3fv(viewLoc, false, viewMatrix);

    const colorLoc = gl.getUniformLocation(this.guideProgram, "u_color");
    gl.uniform4f(colorLoc, 0.31, 0.56, 0.97, 0.5); // Semi-transparent blue

    const vertices = new Float32Array([
      rect.minX, rect.minY,
      rect.maxX, rect.minY,
      rect.maxX, rect.maxY,
      rect.minX, rect.maxY,
    ]);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);

    const posLoc = gl.getAttribLocation(this.guideProgram, "a_position");
    if (posLoc >= 0) {
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    }

    gl.drawArrays(gl.LINE_LOOP, 0, 4);
  }

  // ── Shader compilation ──────────────────────────────────

  private createProgram(
    vertexSource: string,
    fragmentSource: string,
  ): WebGLProgram | null {
    const gl = this.gl;
    if (!gl) return null;

    const vs = this.compileShader(gl.VERTEX_SHADER, vertexSource);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vs || !fs) return null;

    const program = gl.createProgram();
    if (!program) return null;

    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    }

    return program;
  }

  private compileShader(type: number, source: string): WebGLShader | null {
    const gl = this.gl;
    if (!gl) return null;

    const shader = gl.createShader(type);
    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Shader compile error:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  // ── Cleanup ─────────────────────────────────────────────

  destroy(): void {
    const gl = this.gl;
    if (!gl) return;

    if (this.shapeProgram) gl.deleteProgram(this.shapeProgram);
    if (this.guideProgram) gl.deleteProgram(this.guideProgram);
    if (this.vertexBuffer) gl.deleteBuffer(this.vertexBuffer);
    if (this.indexBuffer) gl.deleteBuffer(this.indexBuffer);

    this.shapeProgram = null;
    this.guideProgram = null;
    this.vertexBuffer = null;
    this.indexBuffer = null;
    this.gl = null;
    this.initialized = false;
  }
}
