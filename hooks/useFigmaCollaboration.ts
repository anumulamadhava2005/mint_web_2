"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useFigmaStore, type FigmaLayer } from "@/lib/stores/figmaStore";

const WS_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || "http://localhost:3002";
const CURSOR_THROTTLE_MS = 50;
const PRESENCE_TIMEOUT_MS = 10000;

export interface RemoteCursor {
  userId: string;
  label: string;
  color: string;
  x: number;
  y: number;
  pageId?: string;
}

function getToken(): string {
  if (typeof document === "undefined") return "";
  for (const c of document.cookie.split(";")) {
    const [name, value] = c.trim().split("=");
    if (name === "token") return decodeURIComponent(value || "");
  }
  return "";
}

function generateColor(id: string): string {
  const colors = [
    "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8",
    "#F7DC6F", "#BB8FCE", "#85C1E2", "#F8B739", "#52B788",
  ];
  const hash = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

export function useFigmaCollaboration() {
  const { fileId, activePageId, applyRemoteLayers } = useFigmaStore();
  const socketRef = useRef<Socket | null>(null);
  const lastCursorEmit = useRef(0);
  const layersRef = useRef(useFigmaStore.getState().layers);
  const layerDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionId = useRef(`sess-${Math.random().toString(36).slice(2, 10)}`);
  const presenceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [connected, setConnected] = useState(false);
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);

  const removeRemoteCursor = useCallback((userId: string) => {
    setRemoteCursors(prev => prev.filter(c => c.userId !== userId));
  }, []);

  const touchPresence = useCallback((userId: string) => {
    const existing = presenceTimers.current.get(userId);
    if (existing) clearTimeout(existing);
    presenceTimers.current.set(
      userId,
      setTimeout(() => {
        removeRemoteCursor(userId);
        presenceTimers.current.delete(userId);
      }, PRESENCE_TIMEOUT_MS)
    );
  }, [removeRemoteCursor]);

  // Connect/disconnect based on fileId
  useEffect(() => {
    const token = getToken();
    if (!fileId) return;

    const socket = io(WS_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      // Join the figma file room — uses existing subscribe-file flow
      // If token is missing (unauthenticated dev), we skip cursor broadcast
      if (token) {
        socket.emit("figma-subscribe", { fileId });
      }
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    // Remote cursor updates (from figma-cursor broadcast)
    socket.on("figma-cursor", (data: { sessionId: string; userId: string; label: string; color: string; x: number; y: number; pageId?: string }) => {
      if (data.sessionId === sessionId.current) return;
      touchPresence(data.userId);
      setRemoteCursors(prev => {
        const idx = prev.findIndex(c => c.userId === data.userId);
        const cursor: RemoteCursor = {
          userId: data.userId,
          label: data.label,
          color: data.color,
          x: data.x,
          y: data.y,
          pageId: data.pageId,
        };
        if (idx === -1) return [...prev, cursor];
        const next = [...prev];
        next[idx] = cursor;
        return next;
      });
    });

    // Remote layer snapshots (from figma-change broadcast)
    socket.on("figma-change", (data: { sessionId: string; pageId: string; layers: FigmaLayer[] }) => {
      if (data.sessionId === sessionId.current) return;
      if (data.pageId && data.layers) {
        applyRemoteLayers(data.pageId, data.layers);
      }
    });

    // User left — clean up cursor
    socket.on("figma-leave", ({ userId }: { userId: string }) => {
      removeRemoteCursor(userId);
    });

    return () => {
      for (const t of presenceTimers.current.values()) clearTimeout(t);
      presenceTimers.current.clear();
      if (layerDebounceRef.current) clearTimeout(layerDebounceRef.current);
      if (fileId) socket.emit("figma-unsubscribe", { fileId });
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [fileId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Broadcast layer mutations when layers change
  useEffect(() => {
    const unsub = useFigmaStore.subscribe((state) => {
      if (state.layers === layersRef.current) return;
      layersRef.current = state.layers;

      const pageId = state.activePageId;
      if (layerDebounceRef.current) clearTimeout(layerDebounceRef.current);
      layerDebounceRef.current = setTimeout(() => {
        const sock = socketRef.current;
        if (!sock?.connected || !state.fileId) return;
        sock.emit("figma-change", {
          fileId: state.fileId,
          sessionId: sessionId.current,
          pageId,
          layers: state.layers[pageId] ?? [],
        });
      }, 120);
    });
    return unsub;
  }, []);

  const emitCursor = useCallback((x: number, y: number) => {
    const now = Date.now();
    if (now - lastCursorEmit.current < CURSOR_THROTTLE_MS) return;
    lastCursorEmit.current = now;

    const sock = socketRef.current;
    if (!sock?.connected) return;

    const state = useFigmaStore.getState();
    const token = getToken();
    const label = token ? token.slice(0, 2).toUpperCase() : "?";

    sock.emit("figma-cursor", {
      fileId: state.fileId,
      sessionId: sessionId.current,
      userId: sessionId.current,
      label,
      color: generateColor(sessionId.current),
      x,
      y,
      pageId: state.activePageId,
    });
  }, []);

  // Filter cursors to active page only
  const visibleCursors = remoteCursors.filter(
    c => !c.pageId || c.pageId === activePageId
  );

  return { emitCursor, remoteCursors: visibleCursors, connected };
}
