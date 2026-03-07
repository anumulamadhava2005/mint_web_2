// ═══════════════════════════════════════════════════════════════
// Penpot-style WebSocket Collaboration Hook
// Mirrors: frontend WebSocket connection + presence system
// ═══════════════════════════════════════════════════════════════
"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useWorkspaceStore, setChangeBroadcaster } from "@/lib/penpot/store";
import type { FileChange } from "@/lib/penpot/changes";
import type { UUID } from "@/lib/penpot/types";

const WS_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || "http://localhost:3002";
const CURSOR_THROTTLE_MS = 50;
const PRESENCE_TIMEOUT_MS = 15000;

export function usePenpotCollaboration(fileId: UUID | null) {
  const socketRef = useRef<Socket | null>(null);
  const lastCursorUpdate = useRef(0);
  const presenceTimers = useRef<Map<UUID, NodeJS.Timeout>>(new Map());

  const {
    profile,
    sessionId,
    currentPageId,
    setPresence,
    removePresence,
    setConnected,
    applyRemoteChanges,
  } = useWorkspaceStore();

  // Connect and subscribe
  useEffect(() => {
    if (!fileId || !profile) return;

    // Helper: reset presence inactivity timer for a user
    const touchPresence = (profileId: UUID) => {
      const existing = presenceTimers.current.get(profileId);
      if (existing) clearTimeout(existing);
      presenceTimers.current.set(
        profileId,
        setTimeout(() => {
          removePresence(profileId);
          presenceTimers.current.delete(profileId);
        }, PRESENCE_TIMEOUT_MS)
      );
    };

    const socket = io(WS_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Connected to collaboration server");
      setConnected(true);

      // Subscribe to file (Penpot: :subscribe-file)
      socket.emit("subscribe-file", {
        fileId,
        userId: profile.id,
        email: profile.email,
        token: getToken(),
      });
    });

    socket.on("disconnect", () => {
      console.log("❌ Disconnected from collaboration server");
      setConnected(false);
    });

    // File subscribed confirmation
    socket.on("file-subscribed", ({ participants }) => {
      for (const p of participants) {
        if (p.id !== profile.id) {
          setPresence(p.id, {
            profileId: p.id,
            profileName: p.email,
            profileColor: p.color,
            x: p.cursor?.x || 0,
            y: p.cursor?.y || 0,
          });
        }
      }
    });

    // User joined (Penpot: :join-file)
    socket.on("join-file", ({ profileId, email, color }) => {
      touchPresence(profileId);
      setPresence(profileId, {
        profileId,
        profileName: email,
        profileColor: color,
        x: 0,
        y: 0,
      });
    });

    // User left (Penpot: :leave-file, :disconnect)
    socket.on("leave-file", ({ profileId }) => {
      removePresence(profileId);
    });

    // Presence updates (cursors + selection)
    socket.on("presence", (data) => {
      if (data.profileId === profile.id) return;

      touchPresence(data.profileId);

      if (data.type === "pointer") {
        setPresence(data.profileId, {
          profileId: data.profileId,
          profileName: data.profileName || "",
          profileColor: data.profileColor || "#4ECDC4",
          x: data.x,
          y: data.y,
          pageId: data.pageId,
        });
      } else if (data.type === "selection") {
        const existing = useWorkspaceStore.getState().presence.get(data.profileId);
        if (existing) {
          setPresence(data.profileId, {
            ...existing,
            selection: data.selection,
          });
        }
      }
    });

    // File change from other users (Penpot: :file-change)
    socket.on("file-change", ({ changes, revn, sessionId: remoteSessionId }) => {
      if (remoteSessionId === sessionId) return; // Skip own changes
      if (changes && changes.length > 0) {
        applyRemoteChanges(changes);
      }
    });

    // Legacy compatibility
    socket.on("cursor_update", ({ user_id, cursor }) => {
      if (user_id === profile.id) return;
      touchPresence(user_id);
      const existing = useWorkspaceStore.getState().presence.get(user_id);
      setPresence(user_id, {
        profileId: user_id,
        profileName: existing?.profileName || "",
        profileColor: existing?.profileColor || "#4ECDC4",
        x: cursor.x,
        y: cursor.y,
      });
    });

    socket.on("user_left", ({ user_id }) => {
      removePresence(user_id);
    });

    // Heartbeat
    const heartbeat = setInterval(() => {
      socket.emit("heartbeat");
    }, 5000);

    // Register broadcaster so store changes auto-emit via WS
    setChangeBroadcaster((changes, revn) => {
      socket.emit("file-change", {
        fileId,
        changes,
        revn,
        sessionId,
      });
    });

    return () => {
      clearInterval(heartbeat);
      setChangeBroadcaster(null);
      // Clear all presence timers
      for (const timer of presenceTimers.current.values()) clearTimeout(timer);
      presenceTimers.current.clear();
      socket.emit("unsubscribe-file", { fileId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [fileId, profile?.id]);

  // ── Send cursor position ────────────────────────────────
  const sendCursorPosition = useCallback(
    (x: number, y: number) => {
      const now = Date.now();
      if (now - lastCursorUpdate.current < CURSOR_THROTTLE_MS) return;
      lastCursorUpdate.current = now;

      socketRef.current?.emit("pointer-update", { x, y, pageId: currentPageId });
    },
    [currentPageId]
  );

  // ── Send selection change ───────────────────────────────
  const sendSelectionChange = useCallback((shapeIds: UUID[]) => {
    socketRef.current?.emit("selection-change", { shapeIds });
  }, []);

  // ── Broadcast file changes ──────────────────────────────
  const broadcastChanges = useCallback(
    (changes: FileChange[], revn: number) => {
      socketRef.current?.emit("file-change", {
        fileId,
        changes,
        revn,
        sessionId,
      });
    },
    [fileId, sessionId]
  );

  // ── Send viewport change ───────────────────────────────
  const sendViewportChange = useCallback((x: number, y: number, zoom: number) => {
    socketRef.current?.emit("viewport-change", { x, y, zoom });
  }, []);

  return {
    sendCursorPosition,
    sendSelectionChange,
    broadcastChanges,
    sendViewportChange,
    socket: socketRef,
  };
}

function getToken(): string {
  if (typeof document === "undefined") return "";
  const cookies = document.cookie.split(";");
  for (const c of cookies) {
    const [name, value] = c.trim().split("=");
    if (name === "token") return value || "";
  }
  return "";
}
