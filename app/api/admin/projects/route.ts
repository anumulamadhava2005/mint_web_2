import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findUserByToken } from "@/lib/auth";
import db from "@/lib/db";

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

// GET /api/admin/projects — List all projects
export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const res = await db.query(
      `SELECT p.id, p.name, p.description, p.created_at, p.owner_id, u.email as owner_email, u.fullname as owner_fullname
       FROM projects p
       LEFT JOIN users u ON p.owner_id = u.id
       ORDER BY p.created_at DESC`
    );

    return NextResponse.json({ projects: res.rows || [] });
  } catch (err) {
    console.error("Admin GET projects error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// DELETE /api/admin/projects — Delete any project
export async function DELETE(req: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    // Verify the project exists
    const projRes = await db.query(
      "SELECT id FROM projects WHERE id = $1",
      [projectId]
    );
    if (projRes.rows.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Delete the project (Cascades automatically to files, collab_sessions, project_commits)
    await db.query("DELETE FROM projects WHERE id = $1", [projectId]);

    return NextResponse.json({ ok: true, projectId });
  } catch (err) {
    console.error("Admin DELETE project error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
