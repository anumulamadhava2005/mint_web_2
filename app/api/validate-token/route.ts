import { NextResponse } from "next/server";
import { findUserByToken } from "../../../lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token } = body ?? {};

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    const user = await findUserByToken(token);
    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    return NextResponse.json({ ok: true, user: { id: user.id, email: user.email } });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
