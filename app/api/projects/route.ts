import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findUserByToken } from "../../../lib/auth";
import db from "../../../lib/db";

// GET /api/projects — list projects for the authenticated user or get single project by ID
export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await findUserByToken(token);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if requesting a specific project
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("id");

    if (projectId) {
      // Fetch single project
      const res = await db.query(
        `SELECT p.id, p.name, p.description, p.thumbnail_url, p.likes, p.views, p.created_at, p.updated_at, p.is_public, p.allow_public_edit, u.email as owner_email, (p.owner_id = $2) as is_owner
         FROM projects p
         JOIN users u ON u.id = p.owner_id
         WHERE p.id = $1 AND (p.owner_id = $2 OR p.is_public = true)`,
        [projectId, user.id]
      );

      if (res.rows.length === 0) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      return NextResponse.json({ project: res.rows[0] });
    }

    // List all projects
    const res = await db.query(
      `SELECT p.id, p.name, p.description, p.thumbnail_url, p.likes, p.views, p.created_at, p.updated_at, p.is_public, u.email as owner_email
       FROM projects p
       JOIN users u ON u.id = p.owner_id
       WHERE p.owner_id = $1
       ORDER BY p.created_at DESC
       LIMIT 100`,
      [user.id]
    );

    return NextResponse.json({ projects: res.rows });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST /api/projects — create a new project
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await findUserByToken(token);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, thumbnail_url } = body ?? {};

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    const desc = typeof description === "string" ? description.trim() : null;
    const thumb = typeof thumbnail_url === "string" && thumbnail_url.trim() ? thumbnail_url.trim() : null;

    const res = await db.query(
      "INSERT INTO projects (name, description, thumbnail_url, owner_id) VALUES ($1, $2, $3, $4) RETURNING id, name, description, thumbnail_url, likes, views, created_at",
      [name.trim(), desc, thumb, user.id]
    );

    const project = res.rows[0];
    return NextResponse.json({ project }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
