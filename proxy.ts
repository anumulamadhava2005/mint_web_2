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

async function validateToken(token: string): Promise<boolean> {
  // Try direct Redis lookup first
  const redis = await getRedis();
  if (redis) {
    try {
      const cached = await redis.get(`session:${token}`);
      if (cached) return true;
    } catch { /* fall through */ }
  }

  // Redis miss or down — fail CLOSED.
  // Return false so the middleware rejects at the gate.
  // Each route handler has its own auth check as a second layer,
  // but the middleware must never allow unauthenticated access.
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
