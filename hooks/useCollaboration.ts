// Client-side collaboration hook for real-time editing
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

// Types
export interface Shape {
  id: string;
  type: "rectangle" | "circle" | "path";
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  points?: { x: number; y: number }[];
  color: string;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
}

export interface Operation {
  type: "shape_add" | "shape_update" | "shape_delete" | "shape_transform";
  data: any;
  user_id?: string;
  lamport_clock?: number;
  timestamp?: number;
}

export interface Participant {
  id: string;
  email: string;
  color: string;
  cursor: { x: number; y: number };
  selection?: string[];
}

export interface CollaborationState {
  connected: boolean;
  sessionId: string | null;
  participants: Map<string, Participant>;
  currentUser: Participant | null;
  shapes: Map<string, Shape>;
  version: number;
  latency: number;
}

export interface UseCollaborationOptions {
  projectId: string;
  token: string;
  onShapeAdd?: (shape: Shape) => void;
  onShapeUpdate?: (shapeId: string, updates: Partial<Shape>) => void;
  onShapeDelete?: (shapeId: string) => void;
  onParticipantJoin?: (participant: Participant) => void;
  onParticipantLeave?: (userId: string) => void;
  onCursorMove?: (userId: string, x: number, y: number) => void;
  onSelectionChange?: (userId: string, shapeIds: string[]) => void;
}

export function useCollaboration(options: UseCollaborationOptions) {
  const {
    projectId,
    token,
    onShapeAdd,
    onShapeUpdate,
    onShapeDelete,
    onParticipantJoin,
    onParticipantLeave,
    onCursorMove,
    onSelectionChange,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<CollaborationState>({
    connected: false,
    sessionId: null,
    participants: new Map(),
    currentUser: null,
    shapes: new Map(),
    version: 0,
    latency: 0,
  });

  // Pending operations queue for optimistic updates
  const pendingOps = useRef<Map<string, Operation>>(new Map());
  
  // Throttle tracking for cursor updates
  const lastCursorUpdate = useRef<number>(0);
  const CURSOR_THROTTLE_MS = 50; // 20 updates per second

  // Connect to WebSocket server
  useEffect(() => {
    const WEBSOCKET_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || "http://localhost:3002";
    
    const socket = io(WEBSOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    // Connection events
    socket.on("connect", () => {
      console.log("✅ Connected to collaboration server");
      setState(prev => ({ ...prev, connected: true }));
      
      // Join session
      socket.emit("join_session", { project_id: projectId, token });
    });

    socket.on("disconnect", () => {
      console.log("❌ Disconnected from collaboration server");
      setState(prev => ({ ...prev, connected: false }));
    });

    socket.on("connect_error", (error) => {
      console.error("Connection error:", error);
    });

    // Session events
    socket.on("session_joined", ({ session_id, user, shapes, participants, version }) => {
      console.log("✅ Joined session:", session_id);
      
      const shapesMap = new Map(shapes.map((s: Shape) => [s.id, s]));
      const participantsMap = new Map(participants.map((p: Participant) => [p.id, p]));

      setState((prev:any) => ({
        ...prev,
        sessionId: session_id,
        currentUser: user,
        shapes: shapesMap,
        participants: participantsMap,
        version,
      }));
    });

    socket.on("user_joined", ({ user }) => {
      console.log("👤 User joined:", user.email);
      setState(prev => {
        const newParticipants = new Map(prev.participants);
        newParticipants.set(user.id, { ...user, cursor: { x: 0, y: 0 }, selection: [] });
        return { ...prev, participants: newParticipants };
      });
      onParticipantJoin?.(user);
    });

    socket.on("user_left", ({ user_id }) => {
      console.log("👤 User left:", user_id);
      setState(prev => {
        const newParticipants = new Map(prev.participants);
        newParticipants.delete(user_id);
        return { ...prev, participants: newParticipants };
      });
      onParticipantLeave?.(user_id);
    });

    // Operation events
    socket.on("operation_broadcast", (operation: Operation) => {
      // Check if this is our own operation (optimistic update already applied)
      const opId = `${operation.type}_${operation.timestamp}`;
      if (pendingOps.current.has(opId)) {
        pendingOps.current.delete(opId);
        return; // Already applied optimistically
      }

      // Apply operation from other users
      applyOperation(operation);
    });

    socket.on("operation_error", ({ operation, error }:any) => {
      console.error("Operation error:", error, operation);
      // Rollback optimistic update
      const opId = `${operation.type}_${operation.timestamp}`;
      pendingOps.current.delete(opId);
      // TODO: Implement rollback logic
    });

    // Presence events
    socket.on("cursor_update", ({ user_id, cursor }) => {
      setState(prev => {
        const newParticipants = new Map(prev.participants);
        const participant = newParticipants.get(user_id);
        if (participant) {
          participant.cursor = cursor;
          newParticipants.set(user_id, participant);
        }
        return { ...prev, participants: newParticipants };
      });
      onCursorMove?.(user_id, cursor.x, cursor.y);
    });

    socket.on("selection_update", ({ user_id, selection }) => {
      setState(prev => {
        const newParticipants = new Map(prev.participants);
        const participant = newParticipants.get(user_id);
        if (participant) {
          participant.selection = selection;
          newParticipants.set(user_id, participant);
        }
        return { ...prev, participants: newParticipants };
      });
      onSelectionChange?.(user_id, selection);
    });

    // Heartbeat for latency tracking
    const heartbeatInterval = setInterval(() => {
      const start = Date.now();
      socket.emit("heartbeat");
      
      socket.once("heartbeat_ack", () => {
        const latency = Date.now() - start;
        setState(prev => ({ ...prev, latency }));
      });
    }, 5000);

    return () => {
      clearInterval(heartbeatInterval);
      socket.disconnect();
    };
  }, [projectId, token]);

  // Apply operation to local state
  const applyOperation = useCallback((operation: Operation) => {
    setState(prev => {
      const newShapes = new Map(prev.shapes);
      let updated = false;

      switch (operation.type) {
        case "shape_add":
          newShapes.set(operation.data.shape.id, operation.data.shape);
          onShapeAdd?.(operation.data.shape);
          updated = true;
          break;

        case "shape_update":
          const shape = newShapes.get(operation.data.shape_id);
          if (shape) {
            Object.assign(shape, operation.data.updates);
            newShapes.set(operation.data.shape_id, shape);
            onShapeUpdate?.(operation.data.shape_id, operation.data.updates);
            updated = true;
          }
          break;

        case "shape_delete":
          if (newShapes.delete(operation.data.shape_id)) {
            onShapeDelete?.(operation.data.shape_id);
            updated = true;
          }
          break;

        case "shape_transform":
          const transformShape = newShapes.get(operation.data.shape_id);
          if (transformShape) {
            Object.assign(transformShape, operation.data.transform);
            newShapes.set(operation.data.shape_id, transformShape);
            updated = true;
          }
          break;
      }

      return updated ? { ...prev, shapes: newShapes, version: prev.version + 1 } : prev;
    });
  }, [onShapeAdd, onShapeUpdate, onShapeDelete]);

  // Send operation with optimistic update
  const sendOperation = useCallback((operation: Operation) => {
    if (!socketRef.current?.connected) {
      console.warn("Not connected, operation queued");
      return;
    }

    // Apply optimistically
    applyOperation(operation);

    // Track pending operation
    const opId = `${operation.type}_${Date.now()}`;
    pendingOps.current.set(opId, operation);

    // Send to server
    socketRef.current.emit("operation", operation);

    // Clean up after 5 seconds (should receive broadcast by then)
    setTimeout(() => {
      pendingOps.current.delete(opId);
    }, 5000);
  }, [applyOperation]);

  // Public API methods
  const addShape = useCallback((shape: Shape) => {
    sendOperation({
      type: "shape_add",
      data: { shape },
    });
  }, [sendOperation]);

  const updateShape = useCallback((shapeId: string, updates: Partial<Shape>) => {
    sendOperation({
      type: "shape_update",
      data: { shape_id: shapeId, updates },
    });
  }, [sendOperation]);

  const deleteShape = useCallback((shapeId: string) => {
    sendOperation({
      type: "shape_delete",
      data: { shape_id: shapeId },
    });
  }, [sendOperation]);

  const transformShape = useCallback((shapeId: string, transform: Partial<Shape>) => {
    sendOperation({
      type: "shape_transform",
      data: { shape_id: shapeId, transform },
    });
  }, [sendOperation]);

  // Throttled cursor movement
  const updateCursor = useCallback((x: number, y: number) => {
    const now = Date.now();
    if (now - lastCursorUpdate.current < CURSOR_THROTTLE_MS) {
      return;
    }
    lastCursorUpdate.current = now;

    if (socketRef.current?.connected) {
      socketRef.current.emit("cursor_move", { x, y });
    }
  }, []);

  const updateSelection = useCallback((shapeIds: string[]) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("selection_change", { shape_ids: shapeIds });
    }
  }, []);

  const updateViewport = useCallback((x: number, y: number, zoom: number) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("viewport_change", { x, y, zoom });
    }
  }, []);

  return {
    state,
    actions: {
      addShape,
      updateShape,
      deleteShape,
      transformShape,
      updateCursor,
      updateSelection,
      updateViewport,
    },
  };
}
