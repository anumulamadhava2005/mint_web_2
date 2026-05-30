// ═══════════════════════════════════════════════════════════════
// Design Data API — Endpoint for the RN/Flutter runtime
//
// GET /api/design-data/[projectId]       — returns the latest
//     raw design nodes + interactions for runtime rendering.
//
// GET /api/design-data/[projectId]?since=N — returns data only
//     if there's a version newer than N (204 otherwise).
//
// Requires authentication. Private projects are only accessible
// to the owner. Public projects are accessible to any authed user.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { findUserByToken } from "@/lib/auth";
import db from "@/lib/db";
import { cacheable, TTL } from "@/lib/cache";
import crypto from "crypto";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_URL || "https://mintweb.mintit.pro",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
      return NextResponse.json({ error: "Not found" }, { status: 404, headers: CORS_HEADERS });
    }

    // Authenticate: cookie or Authorization header
    const cookieHeader = req.headers.get("cookie") || "";
    const tokenMatch = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
    const tokenFromCookie = tokenMatch ? tokenMatch[1] : null;
    const authHeader = req.headers.get("authorization");
    const tokenFromHeader = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;
    const token = tokenFromCookie || tokenFromHeader;

    if (!token) {
      // Return 404 to prevent enumeration
      return NextResponse.json({ error: "Not found" }, { status: 404, headers: CORS_HEADERS });
    }

    const user = await findUserByToken(token);
    if (!user) {
      return NextResponse.json({ error: "Not found" }, { status: 404, headers: CORS_HEADERS });
    }

    // Verify project ownership OR public access
    const projCheck = await db.query(
      "SELECT id FROM projects WHERE id = $1 AND (owner_id = $2 OR is_public = true)",
      [projectId, user.id]
    );
    if (!projCheck.rows?.length) {
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
