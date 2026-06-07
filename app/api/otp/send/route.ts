import { NextResponse } from "next/server";
import db from "@/lib/db";
import { sendOtpEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const emailTrimmed = email.trim().toLowerCase();

    // Validate email format basic check
    if (!emailTrimmed.includes("@")) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // Check if user already exists
    const userCheck = await db.query("SELECT 1 FROM users WHERE lower(email) = lower($1) LIMIT 1", [emailTrimmed]);
    if (userCheck.rows.length > 0) {
      return NextResponse.json({ error: "User already exists. Please log in." }, { status: 400 });
    }

    // Rate limit check: 3 OTP requests max per day
    const limitRes = await db.query(
      "SELECT count, (last_requested::date = now()::date) AS is_same_day FROM otp_daily_limits WHERE email = $1",
      [emailTrimmed]
    );

    if (limitRes.rows.length > 0) {
      const { count, is_same_day } = limitRes.rows[0];
      if (is_same_day) {
        if (count >= 3) {
          return NextResponse.json(
            { error: "Bro i'm running on a free trial for sending otps so please don't try to spam login" },
            { status: 429 }
          );
        }
        // Increment count
        await db.query(
          "UPDATE otp_daily_limits SET count = count + 1, last_requested = now() WHERE email = $1",
          [emailTrimmed]
        );
      } else {
        // Reset count for new day
        await db.query(
          "UPDATE otp_daily_limits SET count = 1, last_requested = now() WHERE email = $1",
          [emailTrimmed]
        );
      }
    } else {
      // First request
      await db.query(
        "INSERT INTO otp_daily_limits (email, count, last_requested) VALUES ($1, 1, now())",
        [emailTrimmed]
      );
    }

    // Generate random 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now

    // Upsert the OTP record
    await db.query(
      `INSERT INTO email_otps (email, code, expires_at, attempts)
       VALUES ($1, $2, $3, 0)
       ON CONFLICT (email)
       DO UPDATE SET code = $2, expires_at = $3, attempts = 0, created_at = now()`,
      [emailTrimmed, code, expiresAt]
    );

    // Send the email
    await sendOtpEmail({ email: emailTrimmed, code });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("OTP send error:", err);
    return NextResponse.json({ error: "Failed to send verification code" }, { status: 500 });
  }
}
