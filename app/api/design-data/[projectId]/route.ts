// ═══════════════════════════════════════════════════════════════
// Design Data API — Public endpoint for the RN/Flutter runtime
//
// GET /api/design-data/[projectId]       — returns the latest
//     raw design nodes + interactions for runtime rendering.
//
// GET /api/design-data/[projectId]?since=N — returns data only
//     if there's a version newer than N (204 otherwise).
//
// Only accessible for public projects. projectId (UUID) identifies
// the project. The production mobile app polls this endpoint
// to receive design updates without an app-store release.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import db from "@/lib/db";
import { cacheable, TTL } from "@/lib/cache";
import crypto from "crypto";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_URL || "https://mintweb.mintit.pro",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400, headers: CORS_HEADERS });
    }

    // Verify project exists and is public
    const projCheck = await db.query(
      "SELECT is_public FROM projects WHERE id = $1",
      [projectId]
    );
    if (!projCheck.rows?.length || !projCheck.rows[0].is_public) {
      return NextResponse.json({ error: "Not found" }, { status: 404, headers: CORS_HEADERS });
    }

    const { searchParams } = new URL(req.url);
    const since = searchParams.get("since");

    // ── Incremental poll (since=N) ─────────────────────────────
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
        return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
      }

      const row = res.rows[0];
      const data = typeof row.config_json === "string"
        ? JSON.parse(row.config_json)
        : row.config_json;

      // Only return if designData exists
      if (!data.designData) {
        return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
      }

      return NextResponse.json({
        projectId,
        version: row.version,
        framework: data.framework,
        designData: data.designData,
        committedAt: row.created_at,
      }, {
        headers: {
          ...CORS_HEADERS,
          "Cache-Control": "public, max-age=10, stale-while-revalidate=30",
          "ETag": `"v${row.version}"`,
        },
      });
    }

    // ── Latest commit ──────────────────────────────────────────
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
        designData: null,
      }, { headers: CORS_HEADERS });
    }

    const row = res.rows[0];
    const data = typeof row.config_json === "string"
      ? JSON.parse(row.config_json)
      : row.config_json;

    return NextResponse.json({
      projectId,
      version: row.version,
      framework: data.framework,
      designData: data.designData || null,
      committedAt: row.created_at,
    }, {
      headers: {
        ...CORS_HEADERS,
        "Cache-Control": "public, max-age=10, stale-while-revalidate=30",
        "ETag": `"v${row.version}"`,
      },
    });
  } catch (e: any) {
    console.error("GET /api/design-data error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500, headers: CORS_HEADERS });
  }
}
