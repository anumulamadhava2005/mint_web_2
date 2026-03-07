"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";

// Vector shape types
export type VectorShape = {
  id: string;
  type: "rectangle" | "circle" | "path" | "text";
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  path?: { x: number; y: number }[];
  color: [number, number, number, number]; // RGBA
  strokeColor?: [number, number, number, number];
  strokeWidth?: number;
  rotation?: number;
  opacity?: number;
  text?: string;
  fontSize?: number;
  createdAt?: number; // Timestamp for animation
};

// Camera/Viewport state
type Camera = {
  x: number;
  y: number;
  zoom: number;
};

// Animation state
type AnimationState = "idle" | "playing" | "paused";

// WebGL shader programs
const vertexShaderSource = `
  attribute vec2 a_position;
  uniform mat3 u_matrix;
  
  void main() {
    vec2 position = (u_matrix * vec3(a_position, 1)).xy;
    gl_Position = vec4(position, 0, 1);
  }
`;

const fragmentShaderSource = `
  precision mediump float;
  uniform vec4 u_color;
  
  void main() {
    gl_FragColor = u_color;
  }
`;

export default function DesignCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);

  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const [shapes, setShapes] = useState<VectorShape[]>([]);
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [selectedTool, setSelectedTool] = useState<"select" | "rectangle" | "circle" | "pen">("select");
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentShape, setCurrentShape] = useState<Partial<VectorShape> | null>(null);
  
  // Animation states
  const [animationState, setAnimationState] = useState<AnimationState>("idle");
  const [animationProgress, setAnimationProgress] = useState(0);
  const [allShapes, setAllShapes] = useState<VectorShape[]>([]);
  const animationStartTimeRef = useRef<number>(0);
  const animationDurationRef = useRef<number>(5000); // 5 seconds for slow motion

  // Initialize WebGL
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
    });

    if (!gl) {
      console.error("WebGL not supported");
      return;
    }

    glRef.current = gl;

    // Compile shaders
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

    if (!vertexShader || !fragmentShader) {
      console.error("Failed to create shaders");
      return;
    }

    // Create program
    const program = createProgram(gl, vertexShader, fragmentShader);
    if (!program) {
      console.error("Failed to create program");
      return;
    }

    programRef.current = program;

    // Set up initial viewport
    resizeCanvas();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Resize canvas to match display size
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const gl = glRef.current;
    if (!canvas || !gl) return;

    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      gl.viewport(0, 0, displayWidth, displayHeight);
    }
  }, []);

  // Handle window resize
  useEffect(() => {
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [resizeCanvas]);

  // Animation loop with slow motion
  useEffect(() => {
    if (animationState === "playing") {
      const animate = () => {
        const now = performance.now();
        const elapsed = now - animationStartTimeRef.current;
        const progress = Math.min(elapsed / animationDurationRef.current, 1);
        
        setAnimationProgress(progress);

        if (progress >= 1) {
          setAnimationState("idle");
          setShapes(allShapes);
        } else {
          animationFrameRef.current = requestAnimationFrame(animate);
        }
      };

      animationStartTimeRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(animate);

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
  }, [animationState, allShapes]);

  // Update visible shapes based on animation progress with easing
  useEffect(() => {
    if (animationState === "playing" && allShapes.length > 0) {
      const sortedShapes = [...allShapes].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      const firstTimestamp = sortedShapes[0]?.createdAt || 0;
      const lastTimestamp = sortedShapes[sortedShapes.length - 1]?.createdAt || 0;
      const timeRange = lastTimestamp - firstTimestamp || 1;
      
      // Apply ease-in-out for smoother slow-motion effect
      const easedProgress = easeInOutCubic(animationProgress);
      const currentTime = firstTimestamp + (timeRange * easedProgress);
      
      const visibleShapes = sortedShapes.filter(shape => (shape.createdAt || 0) <= currentTime);
      setShapes(visibleShapes);
    }
  }, [animationProgress, animationState, allShapes]);

  // Render loop
  useEffect(() => {
    const render = () => {
      const gl = glRef.current;
      const program = programRef.current;
      const canvas = canvasRef.current;

      if (!gl || !program || !canvas) return;

      // Clear canvas
      gl.clearColor(0.08, 0.08, 0.12, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(program);

      // Get attribute and uniform locations
      const positionLocation = gl.getAttribLocation(program, "a_position");
      const matrixLocation = gl.getUniformLocation(program, "u_matrix");
      const colorLocation = gl.getUniformLocation(program, "u_color");

      // Create projection matrix
      const projectionMatrix = createProjectionMatrix(
        canvas.width,
        canvas.height,
        camera.x,
        camera.y,
        camera.zoom
      );

      // Render all shapes
      shapes.forEach((shape) => {
        renderShape(gl, shape, positionLocation, matrixLocation, colorLocation, projectionMatrix);
      });

      // Render current shape being drawn (only when not animating)
      if (currentShape && currentShape.type && animationState === "idle") {
        renderShape(
          gl,
          currentShape as VectorShape,
          positionLocation,
          matrixLocation,
          colorLocation,
          projectionMatrix
        );
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [shapes, camera, currentShape, animationState]);

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (animationState === "playing") return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert to world coordinates
    const worldX = (x - canvas.width / 2) / camera.zoom - camera.x;
    const worldY = -(y - canvas.height / 2) / camera.zoom - camera.y;

    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Middle mouse or Alt+Left mouse = pan
      setIsPanning(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    } else if (e.button === 0 && selectedTool !== "select") {
      // Left mouse with tool selected = draw
      setIsDrawing(true);
      const newShape: Partial<VectorShape> = {
        id: `shape-${Date.now()}`,
        type: selectedTool === "rectangle" ? "rectangle" : selectedTool === "circle" ? "circle" : "path",
        x: worldX,
        y: worldY,
        color: [Math.random(), Math.random(), Math.random(), 1],
      };

      if (selectedTool === "rectangle") {
        newShape.width = 0;
        newShape.height = 0;
      } else if (selectedTool === "circle") {
        newShape.radius = 0;
      }

      setCurrentShape(newShape);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isPanning) {
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;

      setCamera((prev) => ({
        ...prev,
        x: prev.x - dx / camera.zoom,
        y: prev.y + dy / camera.zoom,
      }));

      setLastMousePos({ x: e.clientX, y: e.clientY });
    } else if (isDrawing && currentShape) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const worldX = (x - canvas.width / 2) / camera.zoom - camera.x;
      const worldY = -(y - canvas.height / 2) / camera.zoom - camera.y;

      if (currentShape.type === "rectangle") {
        setCurrentShape({
          ...currentShape,
          width: worldX - (currentShape.x || 0),
          height: worldY - (currentShape.y || 0),
        });
      } else if (currentShape.type === "circle") {
        const dx = worldX - (currentShape.x || 0);
        const dy = worldY - (currentShape.y || 0);
        const radius = Math.sqrt(dx * dx + dy * dy);
        setCurrentShape({
          ...currentShape,
          radius,
        });
      }
    }
  };

  const handleMouseUp = () => {
    if (isDrawing && currentShape) {
      const newShape = { ...currentShape, createdAt: Date.now() } as VectorShape;
      setShapes((prev) => [...prev, newShape]);
      setAllShapes((prev) => [...prev, newShape]);
      setCurrentShape(null);
    }
    setIsPanning(false);
    setIsDrawing(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    setCamera((prev) => ({
      ...prev,
      zoom: Math.max(0.1, Math.min(10, prev.zoom * zoomFactor)),
    }));
  };

  const handlePlayPause = () => {
    if (animationState === "idle") {
      if (allShapes.length === 0) return;
      setAnimationState("playing");
      setAnimationProgress(0);
    } else if (animationState === "playing") {
      setAnimationState("idle");
      setShapes(allShapes);
    }
  };

  const handleRestart = () => {
    setAnimationState("playing");
    setAnimationProgress(0);
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Play Button at Top Center */}
      <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 gap-2">
        <button
          onClick={handlePlayPause}
          disabled={allShapes.length === 0}
          className={`flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-zinc-900/95 px-4 backdrop-blur-sm transition-all ${
            allShapes.length === 0
              ? "cursor-not-allowed opacity-50"
              : "hover:border-blue-500/50 hover:bg-zinc-800"
          }`}
          title={animationState === "playing" ? "Stop Animation" : "Play Animation"}
        >
          {animationState === "playing" ? (
            <>
              <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
              <span className="text-sm text-white">Stop</span>
            </>
          ) : (
            <>
              <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span className="text-sm text-white">Play Timeline</span>
            </>
          )}
        </button>
        {animationState === "playing" && (
          <button
            onClick={handleRestart}
            className="flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-zinc-900/95 px-3 backdrop-blur-sm transition-all hover:border-blue-500/50 hover:bg-zinc-800"
            title="Restart Animation"
          >
            <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </button>
        )}
      </div>

      {/* Animation Progress Bar */}
      {animationState === "playing" && (
        <div className="absolute left-1/2 top-[72px] z-10 w-64 -translate-x-1/2">
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-blue-500 transition-all duration-100"
              style={{ width: `${animationProgress * 100}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-center gap-1 text-center text-xs text-zinc-400">
            <span>🎬</span>
            <span>{Math.round(animationProgress * 100)}% • Slow Motion</span>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="absolute left-4 top-4 z-10 flex gap-2 rounded-lg border border-white/10 bg-zinc-900/95 p-2 backdrop-blur-sm">
        <ToolButton
          icon="🖱️"
          active={selectedTool === "select"}
          onClick={() => setSelectedTool("select")}
          label="Select (V)"
          disabled={animationState === "playing"}
        />
        <ToolButton
          icon="⬜"
          active={selectedTool === "rectangle"}
          onClick={() => setSelectedTool("rectangle")}
          label="Rectangle (R)"
          disabled={animationState === "playing"}
        />
        <ToolButton
          icon="⭕"
          active={selectedTool === "circle"}
          onClick={() => setSelectedTool("circle")}
          label="Circle (O)"
          disabled={animationState === "playing"}
        />
        <ToolButton
          icon="✏️"
          active={selectedTool === "pen"}
          onClick={() => setSelectedTool("pen")}
          label="Pen (P)"
          disabled={animationState === "playing"}
        />
      </div>

      {/* Canvas info */}
      <div className="absolute right-4 top-4 z-10 rounded-lg border border-white/10 bg-zinc-900/95 px-3 py-2 text-xs text-zinc-400 backdrop-blur-sm">
        <div>Zoom: {(camera.zoom * 100).toFixed(0)}%</div>
        <div>
          Shapes: {shapes.length}
          {animationState === "playing" && ` / ${allShapes.length}`}
        </div>
        {animationState === "playing" && (
          <div className="mt-1 text-[10px] text-blue-400">▶ Animating...</div>
        )}
        {allShapes.length === 0 && (
          <div className="mt-1 text-[10px] text-zinc-500">Draw shapes to start</div>
        )}
        <div className="mt-1 text-[10px] text-zinc-600">
          Middle click to pan • Scroll to zoom
        </div>
      </div>

      {/* WebGL Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className="h-full w-full cursor-crosshair"
        style={{ touchAction: "none" }}
      />
    </div>
  );
}

// Toolbar button component
function ToolButton({
  icon,
  active,
  onClick,
  label,
  disabled,
}: {
  icon: string;
  active: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex h-8 w-8 items-center justify-center rounded transition-colors ${
        disabled
          ? "cursor-not-allowed opacity-40"
          : active
          ? "bg-blue-600 text-white"
          : "text-zinc-400 hover:bg-white/5 hover:text-white"
      }`}
      title={label}
    >
      {icon}
    </button>
  );
}

// Easing function for smooth slow-motion animation
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// WebGL utility functions
function createShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader | null {
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

function createProgram(
  gl: WebGLRenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader
): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

function createProjectionMatrix(
  width: number,
  height: number,
  cameraX: number,
  cameraY: number,
  zoom: number
): number[] {
  // Create a projection matrix that maps world coordinates to clip space
  const scaleX = (2 / width) * zoom;
  const scaleY = (2 / height) * zoom;

  return [
    scaleX, 0, 0,
    0, scaleY, 0,
    cameraX * scaleX, cameraY * scaleY, 1,
  ];
}

function renderShape(
  gl: WebGLRenderingContext,
  shape: VectorShape,
  positionLocation: number,
  matrixLocation: WebGLUniformLocation | null,
  colorLocation: WebGLUniformLocation | null,
  projectionMatrix: number[]
) {
  if (!shape.type) return;

  // Create buffer for shape vertices
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

  let vertices: number[] = [];

  if (shape.type === "rectangle") {
    const w = shape.width || 0;
    const h = shape.height || 0;
    vertices = [
      shape.x, shape.y,
      shape.x + w, shape.y,
      shape.x, shape.y + h,
      shape.x, shape.y + h,
      shape.x + w, shape.y,
      shape.x + w, shape.y + h,
    ];
  } else if (shape.type === "circle") {
    const radius = shape.radius || 0;
    const segments = 32;
    for (let i = 0; i < segments; i++) {
      const angle1 = (i / segments) * Math.PI * 2;
      const angle2 = ((i + 1) / segments) * Math.PI * 2;
      vertices.push(shape.x, shape.y);
      vertices.push(shape.x + Math.cos(angle1) * radius, shape.y + Math.sin(angle1) * radius);
      vertices.push(shape.x + Math.cos(angle2) * radius, shape.y + Math.sin(angle2) * radius);
    }
  }

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

  // Enable and configure position attribute
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  // Set uniforms
  gl.uniformMatrix3fv(matrixLocation, false, projectionMatrix);
  gl.uniform4fv(colorLocation, shape.color);

  // Enable blending for transparency
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  // Draw
  gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 2);

  // Draw stroke if specified
  if (shape.strokeColor && shape.strokeWidth) {
    gl.uniform4fv(colorLocation, shape.strokeColor);
    gl.lineWidth(shape.strokeWidth || 1);
    
    let strokeVertices: number[] = [];
    if (shape.type === "rectangle") {
      const w = shape.width || 0;
      const h = shape.height || 0;
      strokeVertices = [
        shape.x, shape.y,
        shape.x + w, shape.y,
        shape.x + w, shape.y + h,
        shape.x, shape.y + h,
        shape.x, shape.y,
      ];
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(strokeVertices), gl.STATIC_DRAW);
      gl.drawArrays(gl.LINE_STRIP, 0, strokeVertices.length / 2);
    } else if (shape.type === "circle") {
      const radius = shape.radius || 0;
      const segments = 32;
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        strokeVertices.push(shape.x + Math.cos(angle) * radius, shape.y + Math.sin(angle) * radius);
      }
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(strokeVertices), gl.STATIC_DRAW);
      gl.drawArrays(gl.LINE_STRIP, 0, strokeVertices.length / 2);
    }
  }

  gl.deleteBuffer(buffer);
}
