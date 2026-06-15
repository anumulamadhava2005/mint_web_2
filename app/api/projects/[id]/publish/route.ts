import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findUserByToken } from "../../../../../lib/auth";
import db from "../../../../../lib/db";

// PATCH /api/projects/[id]/publish — toggle project's public status
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
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
    const { is_public } = body;

    if (typeof is_public !== "boolean") {
      return NextResponse.json({ error: "is_public boolean flag is required" }, { status: 400 });
    }

    // Verify ownership and update in one query
    const res = await db.query(
      `UPDATE projects 
       SET is_public = $1, updated_at = now() 
       WHERE id = $2 AND owner_id = $3 
       RETURNING id, is_public`,
      [is_public, projectId, user.id]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: "Project not found or you don't have permission" }, { status: 404 });
    }

    return NextResponse.json({ success: true, project: res.rows[0] });
  } catch (error) {
    console.error("Publish API Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST /api/projects/[id]/publish — Create a published version snapshot
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Get current file data
    const file = await db.query(
      `SELECT id, data FROM files WHERE project_id = $1 ORDER BY modified_at DESC LIMIT 1`,
      [id]
    );
    if (!file.rows?.length) {
      return NextResponse.json({ error: "No file data found" }, { status: 404 });
    }

    // Get next version number
    const version = await db.query(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM project_commits WHERE project_id = $1`,
      [id]
    );
    const nextVersion = version.rows?.[0]?.next_version || 1;

    // Create published commit
    await db.query(
      `INSERT INTO project_commits (project_id, version, config_json, message)
       VALUES ($1, $2, $3, $4)`,
      [id, nextVersion, JSON.stringify(file.rows[0].data), `Published v${nextVersion}`]
    );

    // Try to update publish tracking columns (may not exist yet)
    await db.query(
      `UPDATE projects SET modified_at = now() WHERE id = $1`,
      [id]
    ).catch(() => {});

    return NextResponse.json({
      published: true,
      version: nextVersion,
      publishedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Publish] Error:", error);
    return NextResponse.json({ error: "Publish failed" }, { status: 500 });
  }
}

// GET /api/projects/[id]/publish — Get publish status
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Get latest published version
    const commit = await db.query(
      `SELECT version, config_json, message, created_at
       FROM project_commits
       WHERE project_id = $1
       ORDER BY version DESC LIMIT 1`,
      [id]
    );

    // Get current file data
    const file = await db.query(
      `SELECT data, modified_at FROM files WHERE project_id = $1 ORDER BY modified_at DESC LIMIT 1`,
      [id]
    );

    const publishedVersion = commit.rows?.[0] || null;
    const currentData = file.rows?.[0] || null;

    // Check for unpublished changes
    let hasUnpublishedChanges = false;
    if (publishedVersion && currentData) {
      const publishedStr = JSON.stringify(publishedVersion.config_json);
      const currentStr = JSON.stringify(currentData.data);
      hasUnpublishedChanges = publishedStr !== currentStr;
    } else if (!publishedVersion && currentData) {
      hasUnpublishedChanges = true;
    }

    return NextResponse.json({
      status: publishedVersion ? "published" : "draft",
      currentVersion: publishedVersion?.version || 0,
      publishedAt: publishedVersion?.created_at || null,
      hasUnpublishedChanges,
      message: publishedVersion?.message || null,
    });
  } catch (error) {
    console.error("[PublishStatus] Error:", error);
    return NextResponse.json({ error: "Failed to get status" }, { status: 500 });
  }
}

