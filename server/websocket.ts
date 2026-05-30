// ═══════════════════════════════════════════════════════════════
// WebSocket Server for Real-Time Collaboration (Penpot-inspired)
// Mirrors: backend/src/app/http/websocket.clj
// Run separately: npx tsx server/websocket.ts
// ═══════════════════════════════════════════════════════════════

import { createServer } from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import { z } from "zod";

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: [process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"],
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
// Dedicated Redis client for presence/cache operations
const cacheClient = createClient({ url: REDIS_URL });

let redisConnected = false;
Promise.all([pubClient.connect(), subClient.connect(), cacheClient.connect()])
  .then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    redisConnected = true;
    console.log("✅ Redis adapter connected");
  })
  .catch((err) => {
    console.warn("⚠️  Redis not available, running without adapter:", err.message);
  });

// ── Zod schemas for payload validation ────────────────────────
const FileChangeSchema = z.object({
  fileId: z.string().min(1),
  changes: z.any().optional(),
  revn: z.number().int().optional(),
  sessionId: z.string().optional(),
});

const OperationSchema = z.object({
  type: z.string().min(1),
}).passthrough();

const ConfigUpdateSchema = z.object({
  projectId: z.string().min(1),
  version: z.number().int().optional(),
  config: z.any().optional(),
});

const CodeUpdateSchema = z.object({
  projectId: z.string().min(1),
  version: z.number().int().optional(),
  framework: z.string().optional(),
  files: z.array(z.any()).optional(),
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

// ── In-memory state (local cache — Redis is source of truth for presence) ──
const fileSessions = new Map<string, FileSession>();
const userFiles = new Map<string, string>(); // socket_id -> file_id
const subscribeRateLimit = new Map<string, { count: number; resetAt: number }>();
const SUBSCRIBE_MAX = 10;
const SUBSCRIBE_WINDOW_MS = 60_000;
const MAX_ROOM_SIZE = parseInt(process.env.WS_MAX_ROOM_SIZE || "50", 10);
const CURSOR_THROTTLE_MS = 16;
const lastCursorEmit = new Map<string, number>();

// Utility: Generate unique color for user
function generateUserColor(userId: string): string {
  const colors = [
    "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8",
    "#F7DC6F", "#BB8FCE", "#85C1E2", "#F8B739", "#52B788"
  ];
  const hash = userId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

// ── Redis presence helpers ────────────────────────────────────
async function setPresence(fileId: string, userId: string, presence: UserPresence): Promise<void> {
  if (!redisConnected) return;
  try {
    await cacheClient.hSet(`presence:${fileId}`, userId, JSON.stringify(presence));
    await cacheClient.expire(`presence:${fileId}`, 3600);
  } catch { /* non-fatal */ }
}

async function removePresence(fileId: string, userId: string): Promise<void> {
  if (!redisConnected) return;
  try {
    await cacheClient.hDel(`presence:${fileId}`, userId);
  } catch { /* non-fatal */ }
}

async function getPresenceAll(fileId: string): Promise<UserPresence[]> {
  if (!redisConnected) return [];
  try {
    const data = await cacheClient.hGetAll(`presence:${fileId}`);
    return Object.values(data).map((v) => JSON.parse(v));
  } catch {
    return [];
  }
}

async function getPresenceCount(fileId: string): Promise<number> {
  if (!redisConnected) return 0;
  try {
    return await cacheClient.hLen(`presence:${fileId}`);
  } catch {
    return 0;
  }
}

// ── Token validation helper (SD-05: direct Redis lookup first) ──
async function validateSocketToken(token: string): Promise<{ valid: boolean; user?: { id: string; email: string } }> {
  // Try Redis session cache directly — avoids HTTP round-trip to Next.js
  if (redisConnected) {
    try {
      const cached = await cacheClient.get(`session:${token}`);
      if (cached) {
        const user = JSON.parse(cached);
        return { valid: true, user };
      }
    } catch { /* fall through to HTTP */ }
  }

  // Fallback: HTTP validation (cold start / Redis miss)
  try {
    const authRes = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/validate-token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      }
    );
    if (!authRes.ok) return { valid: false };
    const data = await authRes.json();
    return { valid: true, user: data.user };
  } catch {
    return { valid: false };
  }
}

// ── Project ownership verification (ATK-16/17 fix) ──────────
const DB_BRIDGE = process.env.DB_PROXY_URL || "https://api.mintit.pro/api/mint-db";

async function verifyProjectAccess(projectId: string, userId: string): Promise<boolean> {
  try {
    const res = await fetch(DB_BRIDGE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "SELECT id FROM projects WHERE id = $1 AND (owner_id = $2 OR allow_public_edit = true)",
        params: [projectId, userId],
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.rows && data.rows.length > 0;
  } catch {
    return false;
  }
}

// Read-only access check (owner OR public project)
async function verifyProjectReadAccess(projectId: string, userId: string): Promise<boolean> {
  try {
    const res = await fetch(DB_BRIDGE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "SELECT id FROM projects WHERE id = $1 AND (owner_id = $2 OR is_public = true)",
        params: [projectId, userId],
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.rows && data.rows.length > 0;
  } catch {
    return false;
  }
}

// Lookup projectId for a fileId via DB bridge
async function lookupProjectIdForFile(fileId: string): Promise<string | null> {
  try {
    const res = await fetch(DB_BRIDGE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "SELECT project_id FROM files WHERE id = $1 AND deleted_at IS NULL LIMIT 1",
        params: [fileId],
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.rows?.[0]?.project_id || null;
  } catch {
    return null;
  }
}

// ── Connection handler (Penpot-style message types) ───────────
io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);

  let currentUserId: string | null = null;
  let currentUserEmail: string | null = null;

  // ── Subscribe to file (replaces join_session) ───────────
  // Message types mirror: :subscribe-file, :unsubscribe-file
  socket.on("subscribe-file", async ({ fileId, userId, email, token }) => {
    // Rate limit subscribe attempts per socket
    const now = Date.now();
    const rl = subscribeRateLimit.get(socket.id);
    if (rl && rl.resetAt > now) {
      rl.count++;
      if (rl.count > SUBSCRIBE_MAX) {
        socket.emit("error", { message: "Rate limit exceeded" });
        socket.disconnect(true);
        return;
      }
    } else {
      subscribeRateLimit.set(socket.id, { count: 1, resetAt: now + SUBSCRIBE_WINDOW_MS });
    }

    if (!fileId || !userId || !token) {
      socket.emit("error", { message: "fileId, userId, and token required" });
      return;
    }

    // Validate token — fail closed
    const authResult = await validateSocketToken(token);
    if (!authResult.valid) {
      socket.emit("error", { message: "Invalid auth token" });
      return;
    }

    // Verify the claimed userId matches the token's actual user
    if (authResult.user && authResult.user.id !== userId) {
      socket.emit("error", { message: "Token/userId mismatch" });
      return;
    }

    currentUserId = userId;
    currentUserEmail = authResult.user?.email || email || "anonymous";

    // Check room size limit via Redis
    const roomSize = await getPresenceCount(fileId);
    if (roomSize >= MAX_ROOM_SIZE) {
      socket.emit("error", { message: `Room full (max ${MAX_ROOM_SIZE} participants)` });
      return;
    }

    // Create or get local file session
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

    // Store presence in Redis
    await setPresence(fileId, userId, presence);

    // Join socket room for this file
    socket.join(`file:${fileId}`);

    // Send current participants from Redis
    const allPresence = await getPresenceAll(fileId);
    const participants = allPresence.map((u) => ({
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
  // Security (ATK-17): verify sender is subscribed to this file's room
  socket.on("file-change", (data) => {
    const parsed = FileChangeSchema.safeParse(data);
    if (!parsed.success) return;

    const { fileId, changes, revn, sessionId } = parsed.data;
    if (!fileId || !currentUserId) return;

    // Only allow broadcast if sender is subscribed to this file
    const subscribedFileId = userFiles.get(socket.id);
    if (subscribedFileId !== fileId) return; // silently drop

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
  socket.on("operation", (data: any) => {
    const parsed = OperationSchema.safeParse(data);
    if (!parsed.success) return;

    const operation = parsed.data;
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

  // ── Pointer/cursor update (PERF-09: throttled to 16ms) ──
  // Message type: :pointer-update
  socket.on("pointer-update", ({ x, y, pageId }) => {
    const now = Date.now();
    const last = lastCursorEmit.get(socket.id) || 0;
    if (now - last < CURSOR_THROTTLE_MS) return;
    lastCursorEmit.set(socket.id, now);

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

  // ── Legacy events (removed for security — ATK-18) ───────
  // join_session was unauthenticated; use subscribe-file instead
  socket.on("join_session", () => {
    socket.emit("error", { message: "join_session is deprecated. Use subscribe-file." });
  });

  socket.on("cursor_move", ({ x, y }) => {
    const now = Date.now();
    const last = lastCursorEmit.get(socket.id) || 0;
    if (now - last < CURSOR_THROTTLE_MS) return;
    lastCursorEmit.set(socket.id, now);

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
  // Security (ATK-19): verify project ownership or is_public before joining
  socket.on("subscribe-project", async ({ projectId, token }) => {
    if (!projectId || !token) {
      socket.emit("error", { message: "projectId and token required" });
      return;
    }

    // Validate token — fail closed
    const authResult = await validateSocketToken(token);
    if (!authResult.valid) {
      socket.emit("error", { message: "Invalid auth token" });
      return;
    }

    const userId = authResult.user?.id;
    if (!userId) {
      socket.emit("error", { message: "Invalid auth token" });
      return;
    }

    // Verify user owns the project or project is public
    const hasAccess = await verifyProjectReadAccess(projectId, userId);
    if (!hasAccess) {
      socket.emit("error", { message: "Project not found" });
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
  // Security: verify sender owns the project before broadcasting
  socket.on("config-update", async (data) => {
    const parsed = ConfigUpdateSchema.safeParse(data);
    if (!parsed.success) return;

    const { projectId, version, config } = parsed.data;
    if (!projectId || !currentUserId) return;

    // Verify ownership — silently drop on failure
    const hasAccess = await verifyProjectAccess(projectId, currentUserId);
    if (!hasAccess) return;

    // Broadcast to all preview clients watching this project
    socket.to(`project:${projectId}`).emit("config-update", {
      projectId,
      version,
      config,
    });
    console.log(`🚀 Config update v${version} broadcast to project ${projectId}`);
  });

  // Editor broadcasts code-update with generated files for live sync daemons
  // Security: verify sender owns the project before broadcasting
  socket.on("code-update", async (data) => {
    const parsed = CodeUpdateSchema.safeParse(data);
    if (!parsed.success) return;

    const { projectId, version, framework, files } = parsed.data;
    if (!projectId || !currentUserId) return;

    // Verify ownership — silently drop on failure
    const hasAccess = await verifyProjectAccess(projectId, currentUserId);
    if (!hasAccess) return;

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
    subscribeRateLimit.delete(socket.id);
    lastCursorEmit.delete(socket.id);
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

    // Remove from Redis presence
    removePresence(fileId, userId);

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

// Graceful shutdown — drain connections before exiting
function gracefulShutdown(signal: string) {
  console.log(`${signal} received, draining connections...`);

  // Stop accepting new connections
  httpServer.close();

  // Notify all connected clients
  io.emit("server-shutting-down", { message: "Server restarting, please reconnect" });

  // Give clients 10s to finish in-flight operations
  const forceTimeout = setTimeout(() => {
    console.log("Force shutdown after grace period");
    if (redisConnected) {
      pubClient.quit().catch(() => {});
      subClient.quit().catch(() => {});
      cacheClient.quit().catch(() => {});
    }
    process.exit(0);
  }, 10_000);

  // Disconnect all sockets gracefully
  io.close(() => {
    clearTimeout(forceTimeout);
    console.log("All connections drained");
    if (redisConnected) {
      pubClient.quit().catch(() => {});
      subClient.quit().catch(() => {});
      cacheClient.quit().catch(() => {});
    }
    process.exit(0);
  });
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
