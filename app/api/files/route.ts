// ═══════════════════════════════════════════════════════════════
// Files API — CRUD + update-file (core collaboration endpoint)
// Mirrors: backend/src/app/rpc/commands/files.clj
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findUserByToken } from "@/lib/auth";
import db from "@/lib/db";

// GET /api/files?projectId=... — list files in a project
// GET /api/files?id=...       — get a single file
export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await findUserByToken(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get("id");
    const projectId = searchParams.get("projectId");

    if (fileId) {
      // Get single file with data
      const res = await db.query(
        `SELECT f.id, f.project_id, f.name, f.revn, f.data, f.features, f.created_at, f.modified_at
         FROM files f
         JOIN projects p ON f.project_id = p.id
         WHERE f.id = $1 AND f.deleted_at IS NULL AND (p.owner_id = $2 OR p.is_public = true OR $3 = 'admin')`,
        [fileId, user.id, user.role]
      );
      if (res.rows.length === 0) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }
      return NextResponse.json({ file: res.rows[0] });
    }

    if (projectId) {
      // List files in project
      const res = await db.query(
        `SELECT f.id, f.project_id, f.name, f.revn, f.features, f.created_at, f.modified_at
         FROM files f
         JOIN projects p ON f.project_id = p.id
         WHERE f.project_id = $1 AND f.deleted_at IS NULL AND (p.owner_id = $2 OR p.is_public = true OR $3 = 'admin')
         ORDER BY f.modified_at DESC`,
        [projectId, user.id, user.role]
      );
      return NextResponse.json({ files: res.rows });
    }

    return NextResponse.json({ error: "projectId or id required" }, { status: 400 });
  } catch (e) {
    console.error("GET /api/files error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST /api/files — create a new file
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await findUserByToken(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { projectId, name, data } = body;

    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    // Verify project ownership or edit access or if admin
    const projRes = await db.query(
      "SELECT id FROM projects WHERE id = $1 AND (owner_id = $2 OR allow_public_edit = true OR $3 = 'admin')",
      [projectId, user.id, user.role]
    );
    if (projRes.rows.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const fileData = data || null;
    const res = await db.query(
      `INSERT INTO files (project_id, name, data, revn)
       VALUES ($1, $2, $3, 0)
       RETURNING id, project_id, name, revn, data, created_at, modified_at`,
      [projectId, name || "Untitled", fileData ? JSON.stringify(fileData) : null]
    );

    return NextResponse.json({ file: res.rows[0] }, { status: 201 });
  } catch (e) {
    console.error("POST /api/files error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// PUT /api/files — rename a file
export async function PUT(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await findUserByToken(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { id, name } = body;

    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const res = await db.query(
      `UPDATE files SET name = $1, modified_at = now()
       FROM projects p
       WHERE files.id = $2 AND files.project_id = p.id AND (p.owner_id = $3 OR p.allow_public_edit = true OR $4 = 'admin') AND files.deleted_at IS NULL
       RETURNING files.id, files.name, files.modified_at`,
      [name || "Untitled", id, user.id, user.role]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    return NextResponse.json({ file: res.rows[0] });
  } catch (e) {
    console.error("PUT /api/files error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// DELETE /api/files — soft-delete a file
export async function DELETE(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await findUserByToken(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    await db.query(
      `UPDATE files SET deleted_at = now()
       FROM projects p
       WHERE files.id = $1 AND files.project_id = p.id AND (p.owner_id = $2 OR p.allow_public_edit = true OR $3 = 'admin')`,
      [id, user.id, user.role]
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/files error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
