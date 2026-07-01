import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require authentication
const protectedPaths = ["/projects"];
// Routes that should redirect appropriately if already authenticated
const authPages = ["/login", "/signup"];
// Routes that require admin role
const adminPaths = ["/admin"];

// Lightweight DB query for proxy — avoids importing lib/db which triggers
// heavy schema migrations at module scope.
const DB_BRIDGE_URL = process.env.DB_PROXY_URL || "https://api.mintit.pro/api/mint-db";

async function dbQuery(text: string, params?: any[]): Promise<{ rows: any[] }> {
  const res = await fetch(DB_BRIDGE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, params }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`DB bridge error: ${res.status}`);
  return res.json();
}

async function validateToken(token: string): Promise<boolean> {
  try {
    const res = await dbQuery(
      "SELECT 1 FROM sessions WHERE token = $1 AND expires_at > now() LIMIT 1",
      [token]
    );
    return !!(res.rows && res.rows.length > 0);
  } catch { /* DB error — fail closed */ }
  return false;
}

/** Get user info (email, role, approved) from session token */
async function getUserFromToken(token: string): Promise<{ email: string; role: string; approved: boolean } | null> {
  try {
    const res = await dbQuery(
      `SELECT u.email, u.role, u.approved FROM users u
       JOIN sessions s ON s.user_id = u.id
       WHERE s.token = $1 AND s.expires_at > now()
       LIMIT 1`,
      [token]
    );
    if (res.rows && res.rows.length > 0) {
      return res.rows[0];
    }
  } catch { /* fail closed */ }
  return null;
}

// API routes that are intentionally public (no auth needed)
const publicApiRoutes = [
  "/api/validate-token",
  "/api/mobile-config",
  "/api/design-data",
  "/api/sync",
  "/api/project-data",
  // Managed DB bridge for exported apps — the route itself authorizes via the
  // project sync token / public flag / session owner (see app/api/db/[projectId]).
  "/api/db",
  // End-user auth for generated apps — inherently public (end users have no
  // Mint session); the route scopes writes to an existing project's namespace.
  "/api/app-auth",
  "/api/projects/community",
  "/api/login",
  "/api/signup",
  "/api/otp/send",
  "/api/otp/verify",
  "/api/crm",
  "/api/seed-crm",
  "/api/seed-expense-approval",
  "/api/check-elements",
  "/api/upload",
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
      // Already logged in — determine where to redirect
      const user = await getUserFromToken(token);
      if (user) {
        // Admin or approved user → projects
        if (user.role === "admin" || user.approved) {
          const rawRedirect = request.nextUrl.searchParams.get("redirect");
          const safeRedirect = rawRedirect?.startsWith("/") && !rawRedirect.startsWith("//")
            ? rawRedirect
            : "/projects";
          return NextResponse.redirect(new URL(safeRedirect, request.url));
        }
      }
      // Not approved — waitlist
      return NextResponse.redirect(new URL("/waitlist-success", request.url));
    }
  }

  // Check if this is an admin route
  const isAdminPage = adminPaths.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );
  const isAdminApi = pathname.startsWith("/api/admin");

  // Check if this is a protected page route
  const isProtectedPage = protectedPaths.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );

  // Check if this is an API route that needs auth
  const isApiRoute = pathname.startsWith("/api/");
  const isProtectedApi = isApiRoute && !isPublicApiRoute(pathname);

  if (!isProtectedPage && !isProtectedApi && !isAdminPage && !isAdminApi) {
    return NextResponse.next();
  }

  if (!token) {
    if (isProtectedApi || isAdminApi) {
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
    if (isProtectedApi || isAdminApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // For admin routes, check admin role
  if (isAdminPage || isAdminApi) {
    const user = await getUserFromToken(token);
    if (!user || user.role !== "admin") {
      if (isAdminApi) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/waitlist-success", request.url));
    }
    return NextResponse.next();
  }

  // For protected product routes, check approval
  if (isProtectedPage) {
    const user = await getUserFromToken(token);
    if (!user || (!user.approved && user.role !== "admin")) {
      return NextResponse.redirect(new URL("/waitlist-success", request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/projects/:path*",
    "/login",
    "/signup",
    "/admin/:path*",
    "/admin",
    "/api/:path*",
  ],
};
