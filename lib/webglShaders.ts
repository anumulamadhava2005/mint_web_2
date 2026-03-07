// Advanced WebGL shaders for high-performance rendering

export const advancedVertexShader = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  
  uniform mat3 u_matrix;
  
  varying vec2 v_texCoord;
  
  void main() {
    vec2 position = (u_matrix * vec3(a_position, 1)).xy;
    gl_Position = vec4(position, 0, 1);
    v_texCoord = a_texCoord;
  }
`;

export const advancedFragmentShader = `
  precision mediump float;
  
  uniform vec4 u_color;
  uniform float u_opacity;
  uniform bool u_hasTexture;
  uniform sampler2D u_texture;
  
  varying vec2 v_texCoord;
  
  void main() {
    vec4 color = u_color;
    
    if (u_hasTexture) {
      vec4 texColor = texture2D(u_texture, v_texCoord);
      color = texColor;
    }
    
    color.a *= u_opacity;
    gl_FragColor = color;
  }
`;

// Gradient shader
export const gradientVertexShader = `
  attribute vec2 a_position;
  
  uniform mat3 u_matrix;
  
  varying vec2 v_position;
  
  void main() {
    vec2 position = (u_matrix * vec3(a_position, 1)).xy;
    gl_Position = vec4(position, 0, 1);
    v_position = a_position;
  }
`;

export const gradientFragmentShader = `
  precision mediump float;
  
  uniform vec4 u_color1;
  uniform vec4 u_color2;
  uniform vec2 u_gradientStart;
  uniform vec2 u_gradientEnd;
  
  varying vec2 v_position;
  
  void main() {
    vec2 dir = u_gradientEnd - u_gradientStart;
    vec2 pos = v_position - u_gradientStart;
    float t = dot(pos, dir) / dot(dir, dir);
    t = clamp(t, 0.0, 1.0);
    
    vec4 color = mix(u_color1, u_color2, t);
    gl_FragColor = color;
  }
`;

// Shadow/blur shader for effects
export const blurFragmentShader = `
  precision mediump float;
  
  uniform sampler2D u_texture;
  uniform vec2 u_resolution;
  uniform float u_blurAmount;
  
  varying vec2 v_texCoord;
  
  void main() {
    vec4 color = vec4(0.0);
    float total = 0.0;
    
    float blurSize = u_blurAmount / u_resolution.x;
    
    for (float x = -4.0; x <= 4.0; x += 1.0) {
      for (float y = -4.0; y <= 4.0; y += 1.0) {
        vec2 offset = vec2(x, y) * blurSize;
        color += texture2D(u_texture, v_texCoord + offset);
        total += 1.0;
      }
    }
    
    gl_FragColor = color / total;
  }
`;

// Text rendering shader (for SDF text)
export const textVertexShader = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  
  uniform mat3 u_matrix;
  
  varying vec2 v_texCoord;
  
  void main() {
    vec2 position = (u_matrix * vec3(a_position, 1)).xy;
    gl_Position = vec4(position, 0, 1);
    v_texCoord = a_texCoord;
  }
`;

export const textFragmentShader = `
  precision mediump float;
  
  uniform sampler2D u_texture;
  uniform vec4 u_color;
  uniform float u_buffer;
  uniform float u_gamma;
  
  varying vec2 v_texCoord;
  
  void main() {
    float dist = texture2D(u_texture, v_texCoord).a;
    float alpha = smoothstep(u_buffer - u_gamma, u_buffer + u_gamma, dist);
    gl_FragColor = vec4(u_color.rgb, u_color.a * alpha);
  }
`;

// Pattern/texture shader
export const patternFragmentShader = `
  precision mediump float;
  
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform vec4 u_color1;
  uniform vec4 u_color2;
  
  varying vec2 v_position;
  
  void main() {
    vec2 pos = v_position / u_resolution;
    
    // Create a checkerboard pattern
    float check = mod(floor(pos.x * 20.0) + floor(pos.y * 20.0), 2.0);
    vec4 color = mix(u_color1, u_color2, check);
    
    gl_FragColor = color;
  }
`;

// Anti-aliasing shader for smooth edges
export const antialiasedFragmentShader = `
  precision mediump float;
  
  uniform vec4 u_color;
  uniform vec2 u_resolution;
  
  varying vec2 v_texCoord;
  
  float edgeAA(float edge) {
    float fw = fwidth(edge);
    return smoothstep(-fw, fw, edge);
  }
  
  void main() {
    // Calculate distance from edge
    float dist = length(v_texCoord - 0.5) * 2.0;
    float alpha = 1.0 - edgeAA(dist - 1.0);
    
    gl_FragColor = vec4(u_color.rgb, u_color.a * alpha);
  }
`;

// WebGL utility functions for shader management
export class ShaderManager {
  private gl: WebGLRenderingContext;
  private programs: Map<string, WebGLProgram>;
  private currentProgram: WebGLProgram | null = null;

  constructor(gl: WebGLRenderingContext) {
    this.gl = gl;
    this.programs = new Map();
  }

  createProgram(name: string, vertexSource: string, fragmentSource: string): WebGLProgram | null {
    if (this.programs.has(name)) {
      return this.programs.get(name)!;
    }

    const vertexShader = this.compileShader(this.gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, fragmentSource);

    if (!vertexShader || !fragmentShader) {
      return null;
    }

    const program = this.gl.createProgram();
    if (!program) return null;

    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error("Program link error:", this.gl.getProgramInfoLog(program));
      this.gl.deleteProgram(program);
      return null;
    }

    this.programs.set(name, program);
    return program;
  }

  private compileShader(type: number, source: string): WebGLShader | null {
    const shader = this.gl.createShader(type);
    if (!shader) return null;

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error("Shader compile error:", this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  useProgram(name: string): boolean {
    const program = this.programs.get(name);
    if (!program) return false;

    if (this.currentProgram !== program) {
      this.gl.useProgram(program);
      this.currentProgram = program;
    }
    return true;
  }

  getProgram(name: string): WebGLProgram | null {
    return this.programs.get(name) || null;
  }

  deleteProgram(name: string): void {
    const program = this.programs.get(name);
    if (program) {
      this.gl.deleteProgram(program);
      this.programs.delete(name);
    }
  }

  cleanup(): void {
    this.programs.forEach((program) => {
      this.gl.deleteProgram(program);
    });
    this.programs.clear();
    this.currentProgram = null;
  }
}

// Batch rendering for performance
export class BatchRenderer {
  private gl: WebGLRenderingContext;
  private vertexBuffer: WebGLBuffer | null;
  private indexBuffer: WebGLBuffer | null;
  private maxVertices: number;
  private maxIndices: number;
  private vertices: Float32Array;
  private indices: Uint16Array;
  private vertexCount: number = 0;
  private indexCount: number = 0;

  constructor(gl: WebGLRenderingContext, maxVertices: number = 10000) {
    this.gl = gl;
    this.maxVertices = maxVertices;
    this.maxIndices = maxVertices * 3; // Assuming triangles

    this.vertices = new Float32Array(maxVertices * 4); // x, y, u, v per vertex
    this.indices = new Uint16Array(this.maxIndices);

    this.vertexBuffer = gl.createBuffer();
    this.indexBuffer = gl.createBuffer();
  }

  begin(): void {
    this.vertexCount = 0;
    this.indexCount = 0;
  }

  addQuad(
    x: number,
    y: number,
    width: number,
    height: number,
    u0: number = 0,
    v0: number = 0,
    u1: number = 1,
    v1: number = 1
  ): void {
    const vertexIndex = this.vertexCount * 4;

    // Top-left
    this.vertices[vertexIndex] = x;
    this.vertices[vertexIndex + 1] = y;
    this.vertices[vertexIndex + 2] = u0;
    this.vertices[vertexIndex + 3] = v0;

    // Top-right
    this.vertices[vertexIndex + 4] = x + width;
    this.vertices[vertexIndex + 5] = y;
    this.vertices[vertexIndex + 6] = u1;
    this.vertices[vertexIndex + 7] = v0;

    // Bottom-right
    this.vertices[vertexIndex + 8] = x + width;
    this.vertices[vertexIndex + 9] = y + height;
    this.vertices[vertexIndex + 10] = u1;
    this.vertices[vertexIndex + 11] = v1;

    // Bottom-left
    this.vertices[vertexIndex + 12] = x;
    this.vertices[vertexIndex + 13] = y + height;
    this.vertices[vertexIndex + 14] = u0;
    this.vertices[vertexIndex + 15] = v1;

    const indexBase = this.vertexCount;
    this.indices[this.indexCount++] = indexBase;
    this.indices[this.indexCount++] = indexBase + 1;
    this.indices[this.indexCount++] = indexBase + 2;
    this.indices[this.indexCount++] = indexBase;
    this.indices[this.indexCount++] = indexBase + 2;
    this.indices[this.indexCount++] = indexBase + 3;

    this.vertexCount += 4;
  }

  flush(program: WebGLProgram): void {
    if (this.vertexCount === 0) return;

    const gl = this.gl;

    // Upload vertex data
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.vertices.subarray(0, this.vertexCount * 4), gl.DYNAMIC_DRAW);

    // Upload index data
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices.subarray(0, this.indexCount), gl.DYNAMIC_DRAW);

    // Set up attributes
    const positionLocation = gl.getAttribLocation(program, "a_position");
    const texCoordLocation = gl.getAttribLocation(program, "a_texCoord");

    if (positionLocation >= 0) {
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0);
    }

    if (texCoordLocation >= 0) {
      gl.enableVertexAttribArray(texCoordLocation);
      gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 16, 8);
    }

    // Draw
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);

    this.vertexCount = 0;
    this.indexCount = 0;
  }

  cleanup(): void {
    if (this.vertexBuffer) this.gl.deleteBuffer(this.vertexBuffer);
    if (this.indexBuffer) this.gl.deleteBuffer(this.indexBuffer);
  }
}
