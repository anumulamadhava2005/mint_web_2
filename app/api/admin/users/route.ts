import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findUserByToken } from "@/lib/auth";
import db from "@/lib/db";

// Admin email whitelist (hardcoded for security)
const ADMIN_EMAILS = ["manimadhava43@gmail.com"];

/** Verify the current user is an admin */
async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;

  const user = await findUserByToken(token);
  if (!user) return null;

  // Check role in DB
  const roleRes = await db.query(
    "SELECT role FROM users WHERE id = $1",
    [user.id]
  );
  const role = roleRes.rows?.[0]?.role;
  if (role !== "admin") return null;

  return user;
}

// GET /api/admin/users — List all users with waitlist status
export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const res = await db.query(
      `SELECT id, email, fullname, role, approved, company, team_size, created_at
       FROM users
       ORDER BY created_at DESC`
    );

    return NextResponse.json({ users: res.rows || [] });
  } catch (err) {
    console.error("Admin GET users error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// PATCH /api/admin/users — Toggle user approval status
export async function PATCH(req: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { userId, approved } = body ?? {};

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }
    if (typeof approved !== "boolean") {
      return NextResponse.json({ error: "approved must be a boolean" }, { status: 400 });
    }

    // Verify the target user exists
    const userRes = await db.query(
      "SELECT id, email, role FROM users WHERE id = $1",
      [userId]
    );
    const targetUser = userRes.rows?.[0];
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Don't allow revoking admin's own access
    if (targetUser.id === admin.id && !approved) {
      return NextResponse.json({ error: "Cannot revoke your own access" }, { status: 400 });
    }

    await db.query(
      "UPDATE users SET approved = $1 WHERE id = $2",
      [approved, userId]
    );

    return NextResponse.json({ ok: true, userId, approved });
  } catch (err) {
    console.error("Admin PATCH user error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
