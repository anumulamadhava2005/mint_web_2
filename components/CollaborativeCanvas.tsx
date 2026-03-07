// Example: Collaborative Canvas Integration
// This shows how to integrate collaboration into your existing DesignCanvas

"use client";

import { useEffect, useState, useRef } from "react";
import { useCollaboration, Shape } from "@/hooks/useCollaboration";
import { CursorOverlay, ParticipantsList } from "@/components/CursorOverlay";

interface CollaborativeCanvasProps {
  projectId: string;
  token: string;
}

export function CollaborativeCanvas({ projectId, token }: CollaborativeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shapesRef = useRef<Shape[]>([]);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  
  // Initialize collaboration
  const { state, actions } = useCollaboration({
    projectId,
    token,
    onShapeAdd: (shape) => {
      console.log("🔷 Shape added by collaborator:", shape.id);
      shapesRef.current.push(shape);
      renderCanvas();
    },
    onShapeUpdate: (shapeId, updates) => {
      console.log("🔶 Shape updated by collaborator:", shapeId);
      const shape = shapesRef.current.find(s => s.id === shapeId);
      if (shape) {
        Object.assign(shape, updates);
        renderCanvas();
      }
    },
    onShapeDelete: (shapeId) => {
      console.log("🔴 Shape deleted by collaborator:", shapeId);
      shapesRef.current = shapesRef.current.filter(s => s.id !== shapeId);
      renderCanvas();
    },
    onParticipantJoin: (participant) => {
      console.log("👤 User joined:", participant.email);
    },
    onParticipantLeave: (userId) => {
      console.log("👋 User left:", userId);
    },
  });

  // Initialize shapes from collaboration state
  useEffect(() => {
    if (state.shapes.size > 0) {
      shapesRef.current = Array.from(state.shapes.values());
      renderCanvas();
    }
  }, [state.shapes]);

  // Canvas rendering
  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply viewport transform
    ctx.save();
    ctx.translate(-viewport.x * viewport.zoom, -viewport.y * viewport.zoom);
    ctx.scale(viewport.zoom, viewport.zoom);

    // Render all shapes
    shapesRef.current.forEach(shape => {
      ctx.fillStyle = shape.color;
      
      if (shape.type === "rectangle") {
        ctx.fillRect(shape.x, shape.y, shape.width || 0, shape.height || 0);
      } else if (shape.type === "circle") {
        ctx.beginPath();
        ctx.arc(shape.x, shape.y, shape.radius || 0, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    ctx.restore();
  };

  // Handle mouse events
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left + viewport.x * viewport.zoom) / viewport.zoom;
    const y = (e.clientY - rect.top + viewport.y * viewport.zoom) / viewport.zoom;
    
    // Broadcast cursor position
    actions.updateCursor(x, y);
  };

  const handleAddRectangle = () => {
    const newShape: Shape = {
      id: crypto.randomUUID(),
      type: "rectangle",
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
      width: 150,
      height: 100,
      color: `hsl(${Math.random() * 360}, 70%, 60%)`,
    };
    
    // Broadcast to all collaborators
    actions.addShape(newShape);
  };

  const handleAddCircle = () => {
    const newShape: Shape = {
      id: crypto.randomUUID(),
      type: "circle",
      x: 200 + Math.random() * 200,
      y: 200 + Math.random() * 200,
      radius: 50,
      color: `hsl(${Math.random() * 360}, 70%, 60%)`,
    };
    
    actions.addShape(newShape);
  };

  // Initial canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    renderCanvas();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      renderCanvas();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="relative w-screen h-screen bg-zinc-950 overflow-hidden">
      {/* Connection Status Bar */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-3 bg-zinc-900 rounded-lg px-4 py-2 border border-zinc-800">
        <div className={`w-2 h-2 rounded-full ${state.connected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
        <span className="text-sm text-white font-medium">
          {state.connected ? "Connected" : "Disconnected"}
        </span>
        {state.connected && (
          <span className="text-xs text-zinc-400">
            {state.latency}ms
          </span>
        )}
      </div>

      {/* Toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex gap-2 bg-zinc-900 rounded-lg px-3 py-2 border border-zinc-800">
        <button
          onClick={handleAddRectangle}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition"
          disabled={!state.connected}
        >
          Add Rectangle
        </button>
        <button
          onClick={handleAddCircle}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-medium transition"
          disabled={!state.connected}
        >
          Add Circle
        </button>
        <div className="w-px bg-zinc-700 mx-2" />
        <div className="flex items-center gap-2 px-3">
          <span className="text-xs text-zinc-400">Shapes:</span>
          <span className="text-sm text-white font-medium">{state.shapes.size}</span>
        </div>
      </div>

      {/* Participants List */}
      {state.connected && (
        <ParticipantsList
          participants={state.participants}
          currentUserId={state.currentUser?.id || null}
          latency={state.latency}
        />
      )}

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        className="absolute inset-0"
      />

      {/* Cursor Overlay */}
      {state.connected && (
        <CursorOverlay
          participants={state.participants}
          currentUserId={state.currentUser?.id || null}
          viewport={viewport}
        />
      )}

      {/* Info Panel */}
      <div className="absolute bottom-4 left-4 bg-zinc-900 rounded-lg px-4 py-3 border border-zinc-800 max-w-xs">
        <h3 className="text-sm font-semibold text-white mb-2">Real-Time Collaboration</h3>
        <p className="text-xs text-zinc-400 mb-3">
          Draw shapes and see them appear instantly for all collaborators. Cursors show where others are working.
        </p>
        <div className="flex gap-2 text-xs text-zinc-500">
          <div>
            <span className="text-zinc-400">Version:</span> {state.version}
          </div>
          <div>
            <span className="text-zinc-400">Users:</span> {state.participants.size}
          </div>
        </div>
      </div>
    </div>
  );
}

// Usage in your project page:
/*
import { CollaborativeCanvas } from "@/components/CollaborativeCanvas";

export default function ProjectEditor({ params }) {
  const { id } = params;
  const token = "your-jwt-token"; // Get from your auth system

  return <CollaborativeCanvas projectId={id} token={token} />;
}
*/
