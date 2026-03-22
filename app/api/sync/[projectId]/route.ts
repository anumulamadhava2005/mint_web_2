// ═══════════════════════════════════════════════════════════════
// Sync API — Public endpoint for the sync daemon to poll
//
// GET /api/sync/[projectId]?since=N — returns latest commit if newer
//     than version N, or the latest commit if no "since" param.
//
// This is intentionally unauthenticated — projectId (UUID) acts
// as the token. The sync daemon in the converted project polls
// this endpoint to detect new commits.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
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
        // No new version — return 204 No Content (fast path)
        return new NextResponse(null, { status: 204 });
      }

      const row = res.rows[0];
      const data = typeof row.config_json === "string"
        ? JSON.parse(row.config_json)
        : row.config_json;

      return NextResponse.json({
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
      return NextResponse.json({ version: 0, files: [] });
    }

    const row = res.rows[0];
    const data = typeof row.config_json === "string"
      ? JSON.parse(row.config_json)
      : row.config_json;

    return NextResponse.json({
      version: row.version,
      framework: data.framework,
      fileCount: data.fileCount,
      files: data.files,
      committedAt: row.created_at,
    });
  } catch (e: any) {
    console.error("GET /api/sync error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
