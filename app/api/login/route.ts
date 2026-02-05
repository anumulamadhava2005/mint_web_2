import { NextResponse } from "next/server";
import { verifyUser, issueTokenForUser } from "../../../lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body ?? {};
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }
    if (typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const user = await verifyUser(email, password);
    if (!user) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

    const token = await issueTokenForUser(user.id);
    return NextResponse.json({ ok: true, token, user: { id: user.id, email: user.email } });
  } catch (err) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
