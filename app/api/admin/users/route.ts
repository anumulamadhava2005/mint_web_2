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

// DELETE /api/admin/users — Delete a user and clean up their associations
export async function DELETE(req: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // Don't allow deleting yourself
    if (userId === admin.id) {
      return NextResponse.json({ error: "Cannot delete your own admin account" }, { status: 400 });
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

    // Don't allow deleting other admins for security
    if (targetUser.role === "admin") {
      return NextResponse.json({ error: "Cannot delete another admin account" }, { status: 400 });
    }

    // Clean up non-cascaded dependencies and delete user
    try {
      await db.query("UPDATE audit_log SET actor_id = NULL WHERE actor_id = $1", [userId]);
    } catch (e) {
      // Ignore if audit_log table does not exist
    }

    try {
      await db.query("UPDATE project_commits SET committed_by = NULL WHERE committed_by = $1", [userId]);
    } catch (e) {
      // Ignore if project_commits fails
    }

    await db.query("DELETE FROM comments WHERE owner_id = $1", [userId]);
    await db.query("DELETE FROM comment_threads WHERE owner_id = $1", [userId]);
    await db.query("DELETE FROM share_links WHERE who_id = $1", [userId]);
    await db.query("DELETE FROM projects WHERE owner_id = $1", [userId]);
    await db.query("DELETE FROM team_profile_rel WHERE profile_id = $1", [userId]);
    await db.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
    await db.query("DELETE FROM users WHERE id = $1", [userId]);

    return NextResponse.json({ ok: true, userId });
  } catch (err) {
    console.error("Admin DELETE user error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

