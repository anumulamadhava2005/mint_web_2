import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, code } = body;

    if (!email || !code || typeof email !== "string" || typeof code !== "string") {
      return NextResponse.json({ error: "Email and code are required" }, { status: 400 });
    }

    const emailTrimmed = email.trim().toLowerCase();
    const codeTrimmed = code.trim();

    // Retrieve the OTP record
    const res = await db.query(
      "SELECT code, expires_at, attempts FROM email_otps WHERE email = $1",
      [emailTrimmed]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: "No verification code found for this email" }, { status: 400 });
    }

    const record = res.rows[0];

    // Check if max attempts reached (5 attempts)
    if (record.attempts >= 5) {
      return NextResponse.json({ error: "Too many failed attempts. Please request a new code." }, { status: 400 });
    }

    // Increment attempts
    await db.query(
      "UPDATE email_otps SET attempts = attempts + 1 WHERE email = $1",
      [emailTrimmed]
    );

    // Check if expired
    const now = new Date();
    if (new Date(record.expires_at) < now) {
      return NextResponse.json({ error: "Verification code has expired" }, { status: 400 });
    }

    // Check if code matches
    if (record.code !== codeTrimmed) {
      return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
    }

    // Success! Delete the OTP record
    await db.query(
      "DELETE FROM email_otps WHERE email = $1",
      [emailTrimmed]
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("OTP verification error:", err);
    return NextResponse.json({ error: "Failed to verify code" }, { status: 500 });
  }
}
