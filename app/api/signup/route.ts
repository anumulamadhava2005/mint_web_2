import { NextResponse } from "next/server";
import { createUser } from "../../../lib/auth";
import { cacheGet, cacheSet } from "../../../lib/cache";

const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60; // 15 minutes

async function checkRateLimit(ip: string): Promise<{ allowed: boolean }> {
  const key = `ratelimit:signup:${ip}`;
  const current = await cacheGet<number>(key);
  if (current !== null && current >= MAX_ATTEMPTS) {
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
        { error: "Too many signup attempts. Try again later." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { email, password } = body ?? {};
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }
    // basic validation
    if (typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const user = await createUser(email, password);
    return NextResponse.json({ ok: true, user }, { status: 201 });
  } catch (err: any) {
    // Do not leak whether email exists — return generic error for all failures
    if (err?.message === "User exists") {
      return NextResponse.json({ error: "Signup failed" }, { status: 400 });
    }
    return NextResponse.json({ error: "Signup failed" }, { status: 500 });
  }
}
