import { NextResponse } from "next/server";
import { findUserByToken } from "../../../lib/auth";
import { cacheableWithLock, TTL, cacheGet, cacheSet } from "../../../lib/cache";
import { getClientIp } from "../../../lib/clientIp";

const MAX_REQUESTS = 20;
const WINDOW_SECONDS = 60; // 1 minute

// A null IP (direct/local request with no proxy header) is never limited —
// otherwise all such clients share one bucket and block each other.
async function checkRateLimit(ip: string | null): Promise<{ allowed: boolean }> {
  if (!ip) return { allowed: true };
  const key = `ratelimit:validate:${ip}`;
  const current = await cacheGet<number>(key);
  if (current !== null && current >= MAX_REQUESTS) {
    return { allowed: false };
  }
  await cacheSet(key, (current ?? 0) + 1, WINDOW_SECONDS);
  return { allowed: true };
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);

    const { allowed } = await checkRateLimit(ip);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(WINDOW_SECONDS) },
        }
      );
    }

    const body = await req.json();
    const { token } = body ?? {};

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    const cacheKey = `session:${token}`;
    const userData = await cacheableWithLock(
      cacheKey,
      TTL.SESSION,
      async () => {
        const user = await findUserByToken(token);
        if (!user) return null;
        return { id: user.id, email: user.email };
      },
    );

    if (!userData) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    return NextResponse.json({ ok: true, user: userData });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
