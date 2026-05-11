// ═══════════════════════════════════════════════════════════════
// Runtime Schema API — Save/load runtime schemas for projects
//
// GET  /api/runtime-schema/[projectId] — Load saved schema
// POST /api/runtime-schema/[projectId] — Save schema
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findUserByToken } from "../../../../lib/auth";
import db from "../../../../lib/db";

// Ensure the table exists
const initPromise = db.query(`
  CREATE TABLE IF NOT EXISTS runtime_schemas (
    project_id UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    schema_json JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by UUID REFERENCES users(id)
  )
`).catch(() => {});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    await initPromise;
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await findUserByToken(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { projectId } = await params;

    const result = await db.query(
      `SELECT schema_json, updated_at FROM runtime_schemas WHERE project_id = $1`,
      [projectId]
    );

    if (!result.rows?.length) {
      return NextResponse.json({ schema: null });
    }

    return NextResponse.json({
      schema: result.rows[0].schema_json,
      updatedAt: result.rows[0].updated_at,
    });
  } catch (e) {
    return NextResponse.json({ error: "Failed to load schema" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    await initPromise;
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await findUserByToken(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { projectId } = await params;
    const body = await req.json();
    const { schema } = body;

    if (!schema) {
      return NextResponse.json({ error: "Missing schema" }, { status: 400 });
    }

    await db.query(
      `INSERT INTO runtime_schemas (project_id, schema_json, updated_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (project_id)
       DO UPDATE SET schema_json = $2, updated_at = now(), updated_by = $3`,
      [projectId, JSON.stringify(schema), user.id]
    );

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Failed to save schema" }, { status: 500 });
  }
}
