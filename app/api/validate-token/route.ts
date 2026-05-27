import { NextResponse } from "next/server";
import { findUserByToken } from "../../../lib/auth";
import { cacheableWithLock, TTL } from "../../../lib/cache";

export async function POST(req: Request) {
  try {
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
