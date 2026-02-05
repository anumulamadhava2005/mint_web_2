import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require authentication
const protectedPaths = ["/projects"];
// Routes that should redirect to /projects if already authenticated
const authPages = ["/login", "/signup"];

async function validateToken(token: string, baseUrl: string): Promise<boolean> {
  try {
    const validateUrl = new URL("/api/validate-token", baseUrl);
    const res = await fetch(validateUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
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
    const isValid = await validateToken(token, request.url);
    if (isValid) {
      // Already logged in — redirect to projects (or redirect param)
      const redirect = request.nextUrl.searchParams.get("redirect") || "/projects";
      return NextResponse.redirect(new URL(redirect, request.url));
    }
  }

  // Check if this is a protected route
  const isProtected = protectedPaths.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  if (!token) {
    // Redirect to login page
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Validate token
  const isValid = await validateToken(token, request.url);

  if (!isValid) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/projects/:path*", "/login", "/signup"],
};
