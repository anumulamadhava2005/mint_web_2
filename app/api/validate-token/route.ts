import { NextResponse } from "next/server";
import { findUserByToken } from "../../../lib/auth";
import { cacheableWithLock, TTL, cacheGet, cacheSet } from "../../../lib/cache";

const MAX_REQUESTS = 20;
const WINDOW_SECONDS = 60; // 1 minute

async function checkRateLimit(ip: string): Promise<{ allowed: boolean }> {
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
    const forwardedFor = req.headers.get("x-forwarded-for");
    const ip = forwardedFor?.split(",").map(s => s.trim()).filter(Boolean).at(-1) || "unknown";

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
