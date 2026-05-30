import { NextResponse } from "next/server";
import { findUserByEmail, verifyPassword, issueTokenForUser, dummyVerifyPassword } from "../../../lib/auth";
import db from "../../../lib/db";
import { cacheGet, cacheSet } from "../../../lib/cache";

const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60; // 15 minutes

async function checkRateLimit(ip: string): Promise<{ allowed: boolean }> {
  const key = `ratelimit:login:${ip}`;
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
        { error: "Too many login attempts. Try again later." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { email, password } = body ?? {};
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }
    if (typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      // ATK-12: Run dummy hash so response time is identical to real verification
      dummyVerifyPassword(password);
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const result = verifyPassword(password, user.password_hash, user.salt);
    if (!result.valid) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

    if (result.rehash && result.newHash) {
      await db.query("UPDATE users SET password_hash=$1 WHERE id=$2", [result.newHash, user.id]);
    }

    const token = await issueTokenForUser(user.id);
    const response = NextResponse.json({ ok: true, user: { id: user.id, email: user.email } });
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (err) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
