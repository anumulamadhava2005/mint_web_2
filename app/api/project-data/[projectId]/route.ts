// ═══════════════════════════════════════════════════════════════
// Project Data API — Public endpoint for the connector to fetch
//
// GET /api/project-data/[projectId] — returns the latest commit
//     data (files, framework, version) for a given project.
//
// Only accessible for public projects. projectId (UUID) identifies
// the project. The connector in converted projects calls this
// to get the code files that will be written to disk.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import db from "@/lib/db";
import { findUserByToken } from "@/lib/auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    // Verify project exists
    const projCheck = await db.query(
      "SELECT is_public, owner_id FROM projects WHERE id = $1",
      [projectId]
    );
    if (!projCheck.rows?.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const project = projCheck.rows[0];

    // If not public, require authentication as the project owner
    if (!project.is_public) {
      const authHeader = req.headers.get("authorization");
      const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
      if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const user = await findUserByToken(token);
      if (!user || user.id !== project.owner_id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const { searchParams } = new URL(req.url);
    const since = searchParams.get("since");

    // If "since" is provided, only return if there's a newer version
    if (since) {
      const sinceVersion = parseInt(since, 10);
      const res = await db.query(
        `SELECT id, version, config_json, created_at
         FROM project_commits
         WHERE project_id = $1 AND version > $2
         ORDER BY version DESC LIMIT 1`,
        [projectId, sinceVersion]
      );

      if (res.rows.length === 0) {
        return new NextResponse(null, { status: 204 });
      }

      const row = res.rows[0];
      const data = typeof row.config_json === "string"
        ? JSON.parse(row.config_json)
        : row.config_json;

      return NextResponse.json({
        projectId,
        version: row.version,
        framework: data.framework,
        fileCount: data.fileCount,
        files: data.files,
        committedAt: row.created_at,
      });
    }

    // No "since" — return the latest commit
    const res = await db.query(
      `SELECT id, version, config_json, created_at
       FROM project_commits
       WHERE project_id = $1
       ORDER BY version DESC LIMIT 1`,
      [projectId]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({
        projectId,
        version: 0,
        framework: null,
        fileCount: 0,
        files: [],
      });
    }

    const row = res.rows[0];
    const data = typeof row.config_json === "string"
      ? JSON.parse(row.config_json)
      : row.config_json;

    return NextResponse.json({
      projectId,
      version: row.version,
      framework: data.framework,
      fileCount: data.fileCount,
      files: data.files,
      committedAt: row.created_at,
    });
  } catch (e: any) {
    console.error("GET /api/project-data error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
