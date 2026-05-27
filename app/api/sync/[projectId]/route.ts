// ═══════════════════════════════════════════════════════════════
// Sync API — Public endpoint for the sync daemon to poll
//
// GET /api/sync/[projectId]?since=N — returns latest commit if newer
//     than version N, or the latest commit if no "since" param.
//
// Only accessible for public projects. projectId (UUID) identifies
// the project. The sync daemon in the converted project polls
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

    // PERF-06: Single JOIN instead of 2 sequential queries
    if (since) {
      const sinceVersion = parseInt(since, 10);
      const res = await db.query(
        `SELECT pc.id, pc.version, pc.config_json, pc.created_at
         FROM project_commits pc
         JOIN projects p ON pc.project_id = p.id
         WHERE pc.project_id = $1 AND p.is_public = true
           AND pc.version > $2
         ORDER BY pc.version DESC LIMIT 1`,
        [projectId, sinceVersion]
      );

      if (res.rows.length === 0) {
        // Either project not public or no new version — return 204
        return new NextResponse(null, { status: 204 });
      }

      const row = res.rows[0];
      const data = typeof row.config_json === "string"
        ? JSON.parse(row.config_json)
        : row.config_json;

      // PERF-12: Strip full file content — return metadata only
      const files = (data.files || []).map((f: any) => ({
        path: f.path,
        type: f.type,
      }));

      return NextResponse.json({
        version: row.version,
        framework: data.framework,
        fileCount: data.fileCount,
        files,
        committedAt: row.created_at,
      });
    }

    // No "since" — return the latest commit (single JOIN)
    const res = await db.query(
      `SELECT pc.id, pc.version, pc.config_json, pc.created_at
       FROM project_commits pc
       JOIN projects p ON pc.project_id = p.id
       WHERE pc.project_id = $1 AND p.is_public = true
       ORDER BY pc.version DESC LIMIT 1`,
      [projectId]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ version: 0, files: [] });
    }

    const row = res.rows[0];
    const data = typeof row.config_json === "string"
      ? JSON.parse(row.config_json)
      : row.config_json;

    // PERF-12: Strip full file content — return metadata only
    const files = (data.files || []).map((f: any) => ({
      path: f.path,
      type: f.type,
    }));

    return NextResponse.json({
      version: row.version,
      framework: data.framework,
      fileCount: data.fileCount,
      files,
      committedAt: row.created_at,
    });
  } catch (e: any) {
    console.error("GET /api/sync error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
