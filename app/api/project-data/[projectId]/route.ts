// ═══════════════════════════════════════════════════════════════
// Project Data API — Endpoint for the connector to fetch code
//
// GET /api/project-data/[projectId] — returns the latest commit
//     data (files, framework, version) for a given project.
//
// Requires authentication. Private projects are only accessible
// to the owner. Public projects are accessible to any authed user.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { findUserByToken, getProjectSyncToken } from "@/lib/auth";
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

    // Verify project authorization (ownership or public access)
    let isAuthorized = false;

    // 1. Check if the project is public first
    const publicProjCheck = await db.query(
      "SELECT id FROM projects WHERE id = $1 AND is_public = true",
      [projectId]
    );
    if (publicProjCheck.rows?.length) {
      isAuthorized = true;
    }

    // 2. If not public, require a valid session token, project sync token, and verify ownership
    if (!isAuthorized) {
      const cookieHeader = req.headers.get("cookie") || "";
      const tokenMatch = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
      const tokenFromCookie = tokenMatch ? tokenMatch[1] : null;
      const authHeader = req.headers.get("authorization");
      const tokenFromHeader = authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;
      const token = tokenFromCookie || tokenFromHeader;

      if (token) {
        // A. Check if it's the project-specific sync token
        if (token === getProjectSyncToken(projectId)) {
          isAuthorized = true;
        } else {
          // B. Check if it's a valid session token and verify project ownership
          const user = await findUserByToken(token);
          if (user) {
            const ownerProjCheck = await db.query(
              "SELECT id FROM projects WHERE id = $1 AND owner_id = $2",
              [projectId, user.id]
            );
            if (ownerProjCheck.rows?.length) {
              isAuthorized = true;
            }
          }
        }
      }
    }

    if (!isAuthorized) {
      // Return 404 to prevent enumeration (not 401)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
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
