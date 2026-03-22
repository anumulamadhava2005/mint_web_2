// ═══════════════════════════════════════════════════════════════
// Mobile Config API — Public endpoint for mobile apps / previews
//
// GET /api/mobile-config?projectId=... — latest committed config
// No auth required (designed for mobile app consumption)
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

    return NextResponse.json({
      version: row.version,
      config: typeof row.config_json === "string"
        ? JSON.parse(row.config_json)
        : row.config_json,
      message: row.message,
      committedAt: row.created_at,
    });
  } catch (e) {
    console.error("GET /api/mobile-config error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
