import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "redis";

// SD-13: Use Node.js runtime so we can use the redis npm package

// Routes that require authentication
const protectedPaths = ["/projects"];
// Routes that should redirect to /projects if already authenticated
const authPages = ["/login", "/signup"];

// Redis client for direct session validation (no HTTP self-call)
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
let redisClient: ReturnType<typeof createClient> | null = null;
let redisReady = false;

async function getRedis() {
  if (redisClient && redisReady) return redisClient;
  if (redisClient) return null;
  try {
    redisClient = createClient({ url: REDIS_URL });
    redisClient.on("error", () => {
      redisReady = false;
    });
    redisClient.on("ready", () => {
      redisReady = true;
    });
    await redisClient.connect();
    redisReady = true;
    return redisClient;
  } catch {
    redisClient = null;
    return null;
  }
}

// Lightweight DB query for middleware — avoids importing lib/db which triggers
// heavy schema migrations at module scope.
const DB_BRIDGE_URL = process.env.DB_PROXY_URL || "https://api.mintit.pro/api/mint-db";

async function dbQuery(text: string, params?: any[]): Promise<{ rows: any[] }> {
  const res = await fetch(DB_BRIDGE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, params }),
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`DB bridge error: ${res.status}`);
  return res.json();
}

async function validateToken(token: string): Promise<boolean> {
  // Try direct Redis lookup first
  const redis = await getRedis();
  if (redis) {
    try {
      const cached = await redis.get(`session:${token}`);
      if (cached) return true;
    } catch { /* fall through to DB */ }
  }

  // Redis miss — fall back to PostgreSQL session table via DB bridge
  try {
    const res = await dbQuery(
      "SELECT 1 FROM sessions WHERE token = $1 AND expires_at > now() LIMIT 1",
      [token]
    );
    if (res.rows && res.rows.length > 0) {
      // Cache in Redis for future requests (5 min TTL)
      if (redis) {
        redis.set(`session:${token}`, "1", { EX: 300 }).catch(() => {});
      }
      return true;
    }
  } catch { /* DB error — fail closed */ }

  return false;
}

// API routes that are intentionally public (no auth needed)
const publicApiRoutes = [
  "/api/validate-token",
  "/api/mobile-config",
  "/api/design-data",
  "/api/sync",
  "/api/project-data",
  "/api/projects/community",
  "/api/login",
  "/api/signup",
];

function isPublicApiRoute(pathname: string): boolean {
  return publicApiRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for token in cookie or Authorization header
  const tokenFromCookie = request.cookies.get("token")?.value;
  const authHeader = request.headers.get("authorization");
  const tokenFromHeader = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  const token = tokenFromCookie || tokenFromHeader;

  // Check if this is an auth page (login/signup)
  const isAuthPage = authPages.includes(pathname);

  if (isAuthPage && token) {
    // User has a token, validate it
    const isValid = await validateToken(token);
    if (isValid) {
      // Already logged in — redirect to projects (or safe redirect param)
      const rawRedirect = request.nextUrl.searchParams.get("redirect");
      // Only allow relative paths — block absolute URLs and protocol-relative URLs
      const safeRedirect = rawRedirect?.startsWith("/") && !rawRedirect.startsWith("//")
        ? rawRedirect
        : "/projects";
      return NextResponse.redirect(new URL(safeRedirect, request.url));
    }
  }

  // Check if this is a protected page route
  const isProtectedPage = protectedPaths.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );

  // Check if this is an API route that needs auth
  const isApiRoute = pathname.startsWith("/api/");
  const isProtectedApi = isApiRoute && !isPublicApiRoute(pathname);

  if (!isProtectedPage && !isProtectedApi) {
    return NextResponse.next();
  }

  if (!token) {
    if (isProtectedApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Redirect to login page for page routes
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Validate token
  const isValid = await validateToken(token);

  if (!isValid) {
    if (isProtectedApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/projects/:path*",
    "/login",
    "/signup",
    "/api/:path*",
  ],
};
