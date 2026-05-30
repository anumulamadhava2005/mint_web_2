// ═══════════════════════════════════════════════════════════════
// Mobile Config API — Public endpoint for mobile apps / previews
//
// GET /api/mobile-config?projectId=... — latest committed config
// No auth required (designed for mobile app consumption)
//
// Security: Never return generated source files (config_json.files).
// Only return metadata needed for SDUI: framework, version,
// runtimeSchema, designData.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    // Only serve public projects
    const projCheck = await db.query(
      "SELECT id FROM projects WHERE id = $1 AND is_public = true",
      [projectId]
    );
    if (!projCheck.rows?.length) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Get the latest committed config
    const res = await db.query(
      `SELECT pc.version, pc.config_json, pc.message, pc.created_at
       FROM project_commits pc
       WHERE pc.project_id = $1
       ORDER BY pc.version DESC
       LIMIT 1`,
      [projectId]
    );

    if (res.rows.length === 0) {
      return NextResponse.json(
        { error: "No commits found for this project" },
        { status: 404 }
      );
    }

    const row = res.rows[0];
    const config = typeof row.config_json === "string"
      ? JSON.parse(row.config_json)
      : row.config_json;

    // Strip sensitive data — never return generated source files
    return NextResponse.json({
      projectId,
      version: row.version,
      framework: config.framework || null,
      runtimeSchema: config.designData?.runtimeSchema || null,
      message: row.message,
      committedAt: row.created_at,
    }, {
      headers: {
        "Cache-Control": "public, max-age=10, stale-while-revalidate=60",
        "ETag": `"v${row.version}"`,
      },
    });
  } catch (e) {
    console.error("GET /api/mobile-config error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
