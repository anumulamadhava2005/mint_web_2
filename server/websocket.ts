// ═══════════════════════════════════════════════════════════════
// WebSocket Server for Real-Time Collaboration (Penpot-inspired)
// Mirrors: backend/src/app/http/websocket.clj
// Run separately: npx tsx server/websocket.ts
// ═══════════════════════════════════════════════════════════════

import { createServer } from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    credentials: true,
  },
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Redis setup for scaling across multiple servers
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const pubClient = createClient({ url: REDIS_URL });
const subClient = pubClient.duplicate();

let redisConnected = false;
Promise.all([pubClient.connect(), subClient.connect()])
  .then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    redisConnected = true;
    console.log("✅ Redis adapter connected");
  })
  .catch((err) => {
    console.warn("⚠️  Redis not available, running without adapter:", err.message);
  });

// ── Types ─────────────────────────────────────────────────────
interface UserPresence {
  id: string;
  email: string;
  socketId: string;
  color: string;
  cursor: { x: number; y: number };
  selection: string[];
  viewport: { x: number; y: number; zoom: number };
  joinedAt: number;
}

interface FileSession {
  fileId: string;
  users: Map<string, UserPresence>;
  version: number;
}

// ── In-memory state ───────────────────────────────────────────
const fileSessions = new Map<string, FileSession>(); // file_id -> session
const userFiles = new Map<string, string>(); // socket_id -> file_id

// Utility: Generate unique color for user
function generateUserColor(userId: string): string {
  const colors = [
    "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8",
    "#F7DC6F", "#BB8FCE", "#85C1E2", "#F8B739", "#52B788"
  ];
  const hash = userId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

// ── Connection handler (Penpot-style message types) ───────────
io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);

  let currentUserId: string | null = null;
  let currentUserEmail: string | null = null;

  // ── Subscribe to file (replaces join_session) ───────────
  // Message types mirror: :subscribe-file, :unsubscribe-file
  socket.on("subscribe-file", async ({ fileId, userId, email, token }) => {
    if (!fileId || !userId) {
      socket.emit("error", { message: "fileId and userId required" });
      return;
    }

    // Validate token if provided (basic auth check)
    if (token) {
      try {
        const authRes = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/validate-token`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          }
        );
        if (!authRes.ok) {
          socket.emit("error", { message: "Invalid auth token" });
          return;
        }
      } catch {
        // If validation service is down, allow connection (graceful fallback)
        console.warn("Token validation failed, allowing connection");
      }
    }

    currentUserId = userId;
    currentUserEmail = email || "anonymous";

    // Create or get file session
    if (!fileSessions.has(fileId)) {
      fileSessions.set(fileId, {
        fileId,
        users: new Map(),
        version: 0,
      });
    }

    const session = fileSessions.get(fileId)!;
    const userColor = generateUserColor(userId);

    const presence: UserPresence = {
      id: userId,
      email: currentUserEmail!,
      socketId: socket.id,
      color: userColor,
      cursor: { x: 0, y: 0 },
      selection: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      joinedAt: Date.now(),
    };

    session.users.set(userId, presence);
    userFiles.set(socket.id, fileId);

    // Join socket room for this file
    socket.join(`file:${fileId}`);

    // Send current participants to the new user
    const participants = Array.from(session.users.values()).map((u) => ({
      id: u.id,
      email: u.email,
      color: u.color,
      cursor: u.cursor,
    }));

    socket.emit("file-subscribed", {
      fileId,
      user: presence,
      participants,
      version: session.version,
    });

    // Notify others: :join-file
    socket.to(`file:${fileId}`).emit("join-file", {
      profileId: userId,
      email: currentUserEmail,
      color: userColor,
    });

    console.log(`✅ ${currentUserEmail} subscribed to file ${fileId}`);
  });

  // ── Unsubscribe from file ───────────────────────────────
  socket.on("unsubscribe-file", ({ fileId }) => {
    leaveFile(socket, fileId);
  });

  // ── File change broadcast (from update-file) ────────────
  // When a client commits changes via HTTP, it also broadcasts here
  socket.on("file-change", ({ fileId, changes, revn, sessionId }) => {
    if (!fileId) return;

    const session = fileSessions.get(fileId);
    if (session) {
      session.version = revn || session.version + 1;
    }

    // Broadcast to all OTHER clients watching this file
    socket.to(`file:${fileId}`).emit("file-change", {
      changes,
      revn: session?.version || revn,
      sessionId,
      profileId: currentUserId,
    });
  });

  // ── Legacy operation support (shape_add, etc.) ──────────
  socket.on("operation", (operation: any) => {
    const fileId = userFiles.get(socket.id);
    if (!fileId || !currentUserId) return;

    const session = fileSessions.get(fileId);
    if (!session) return;

    session.version++;

    const enrichedOp = {
      ...operation,
      user_id: currentUserId,
      timestamp: Date.now(),
    };

    // Broadcast to all clients in file room (including sender for confirmation)
    io.to(`file:${fileId}`).emit("operation_broadcast", enrichedOp);
  });

  // ── Pointer/cursor update ───────────────────────────────
  // Message type: :pointer-update
  socket.on("pointer-update", ({ x, y, pageId }) => {
    const fileId = userFiles.get(socket.id);
    if (!fileId || !currentUserId) return;

    const session = fileSessions.get(fileId);
    if (!session) return;

    const user = session.users.get(currentUserId);
    if (user) user.cursor = { x, y };

    socket.to(`file:${fileId}`).emit("presence", {
      type: "pointer",
      profileId: currentUserId,
      profileName: currentUserEmail,
      profileColor: user?.color,
      x,
      y,
      pageId,
    });
  });

  // ── Selection change ────────────────────────────────────
  socket.on("selection-change", ({ shapeIds }) => {
    const fileId = userFiles.get(socket.id);
    if (!fileId || !currentUserId) return;

    const session = fileSessions.get(fileId);
    if (!session) return;

    const user = session.users.get(currentUserId);
    if (user) user.selection = shapeIds;

    socket.to(`file:${fileId}`).emit("presence", {
      type: "selection",
      profileId: currentUserId,
      selection: shapeIds,
    });
  });

  // ── Viewport change ─────────────────────────────────────
  socket.on("viewport-change", ({ x, y, zoom }) => {
    const fileId = userFiles.get(socket.id);
    if (!fileId || !currentUserId) return;

    const session = fileSessions.get(fileId);
    const user = session?.users.get(currentUserId);
    if (user) user.viewport = { x, y, zoom };
  });

  // ── Legacy events (backward compatible) ─────────────────
  socket.on("join_session", ({ project_id, token }) => {
    socket.emit("session_joined", {
      session_id: `session:${project_id}`,
      user: { id: currentUserId || socket.id, email: "user", color: "#4ECDC4" },
      shapes: [],
      participants: [],
      version: 0,
    });
  });

  socket.on("cursor_move", ({ x, y }) => {
    const fileId = userFiles.get(socket.id);
    if (!fileId || !currentUserId) return;
    socket.to(`file:${fileId}`).emit("cursor_update", {
      user_id: currentUserId,
      cursor: { x, y },
    });
  });

  socket.on("selection_change", ({ shape_ids }) => {
    const fileId = userFiles.get(socket.id);
    if (!fileId || !currentUserId) return;
    socket.to(`file:${fileId}`).emit("selection_update", {
      user_id: currentUserId,
      selection: shape_ids,
    });
  });

  socket.on("viewport_change", (_data: any) => {});

  // ── Project subscription (for mobile preview / live update) ─
  // Preview clients subscribe to project-level config updates
  socket.on("subscribe-project", ({ projectId }) => {
    if (!projectId) {
      socket.emit("error", { message: "projectId required" });
      return;
    }
    socket.join(`project:${projectId}`);
    socket.emit("project-subscribed", { projectId });
    console.log(`📱 Preview client subscribed to project ${projectId}`);
  });

  socket.on("unsubscribe-project", ({ projectId }) => {
    if (projectId) {
      socket.leave(`project:${projectId}`);
      console.log(`📱 Preview client unsubscribed from project ${projectId}`);
    }
  });

  // Editor broadcasts config-update after a successful commit
  socket.on("config-update", ({ projectId, version, config }) => {
    if (!projectId) return;
    // Broadcast to all preview clients watching this project
    socket.to(`project:${projectId}`).emit("config-update", {
      projectId,
      version,
      config,
    });
    console.log(`🚀 Config update v${version} broadcast to project ${projectId}`);
  });

  // Editor broadcasts code-update with generated files for live sync daemons
  socket.on("code-update", ({ projectId, version, framework, files }) => {
    if (!projectId) return;
    socket.to(`project:${projectId}`).emit("code-update", {
      projectId,
      version,
      framework,
      files,
    });
    console.log(`🔄 Code update v${version} (${framework}) → ${files?.length || 0} files broadcast to project ${projectId}`);
  });

  // ── Heartbeat ───────────────────────────────────────────
  socket.on("heartbeat", () => {
    socket.emit("heartbeat_ack", { timestamp: Date.now() });
  });

  // ── Disconnect ──────────────────────────────────────────
  socket.on("disconnect", () => {
    console.log("🔌 Client disconnected:", socket.id);
    const fileId = userFiles.get(socket.id);
    if (fileId) {
      leaveFile(socket, fileId);
    }
  });
});

function leaveFile(socket: any, fileId: string) {
  const session = fileSessions.get(fileId);
  if (!session) return;

  // Find user by socket ID
  let userId: string | null = null;
  for (const [uid, user] of session.users) {
    if (user.socketId === socket.id) {
      userId = uid;
      break;
    }
  }

  if (userId) {
    session.users.delete(userId);

    // Notify others: :leave-file / :disconnect
    socket.to(`file:${fileId}`).emit("leave-file", { profileId: userId });
    socket.to(`file:${fileId}`).emit("user_left", { user_id: userId });
  }

  socket.leave(`file:${fileId}`);
  userFiles.delete(socket.id);

  // Clean up empty sessions
  if (session.users.size === 0) {
    fileSessions.delete(fileId);
    console.log(`🗑️  Cleaned up empty file session: ${fileId}`);
  }
}

const PORT = process.env.WEBSOCKET_PORT || 3002;
httpServer.listen(PORT, () => {
  console.log(`🚀 WebSocket server running on port ${PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, closing server...");
  httpServer.close(() => {
    if (redisConnected) {
      pubClient.quit();
      subClient.quit();
    }
    process.exit(0);
  });
});
