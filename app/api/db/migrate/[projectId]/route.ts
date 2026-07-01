// ═══════════════════════════════════════════════════════════════
// Database Migration API — Deploy schema changes to project DBs
//
// POST /api/db/migrate/[projectId]
//   Body: { schema: DatabaseConfigSchema }
//   → Generates and applies SQL migrations
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findUserByToken } from "../../../../../lib/auth";
import db from "../../../../../lib/db";
import { generateSyncStatements, prefixSchemaTables } from "../../../../../lib/runtime/database";
import { ensureVersionsTable, recordVersion } from "../../../../../lib/runtime/schemaVersions";
import type { DatabaseConfigSchema } from "../../../../../lib/runtime/schema";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    // Auth check
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await findUserByToken(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { projectId } = await params;

    // Verify project ownership
    const projectCheck = await db.query(
      "SELECT id FROM projects WHERE id = $1 AND owner_id = $2",
      [projectId, user.id]
    );
    if (!projectCheck.rows?.length) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await req.json();
    const schema = body.schema as DatabaseConfigSchema;
    // The unprefixed editor (figma) config — stored as a version snapshot so
    // it can be restored verbatim into the editor on rollback.
    const source = body.source;
    const message = typeof body.message === "string" ? body.message : "";

    if (!schema?.tables?.length) {
      return NextResponse.json({ error: "No tables in schema" }, { status: 400 });
    }

    // Ensure migrations table
    await db.query(`
      CREATE TABLE IF NOT EXISTS "_mint_migrations" (
        "id" TEXT PRIMARY KEY,
        "project_id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "applied_at" TIMESTAMPTZ DEFAULT now()
      )
    `);

    // Prefix table names so only table names get prefixed, not column names.
    const prefixedSchema = prefixSchemaTables(schema, projectId);

    // Introspect which of these tables already exist, so the sync generator
    // knows when it can safely enforce NOT NULL on freshly-added columns.
    const prefixedNames = prefixedSchema.tables.map((t) => t.name);
    let existingTables = new Set<string>();
    try {
      const introspect = await db.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
        [prefixedNames]
      );
      existingTables = new Set((introspect.rows || []).map((r: { table_name: string }) => r.table_name));
    } catch {
      // If introspection fails, fall back to additive behaviour (treat all as new).
    }

    // Idempotent sync plan — converges existing tables to the desired schema.
    const plan = generateSyncStatements(prefixedSchema, existingTables);

    const applied: string[] = [];
    const errors: string[] = [];

    for (const step of plan) {
      try {
        await db.query(step.sql);
        applied.push(step.label);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${step.label}: ${msg}`);
      }
    }

    // Store schema snapshot for history/audit.
    await db.query(
      `INSERT INTO "_mint_migrations" ("id", "project_id", "name")
       VALUES ($1, $2, $3)
       ON CONFLICT ("id") DO UPDATE SET "name" = $3`,
      [`schema_${projectId}_${Date.now()}`, projectId, `Schema: ${schema.tables.map((t) => t.name).join(", ")}`]
    );

    // Record a version snapshot of the editor config (skipped if unchanged).
    let version: number | null = null;
    if (source && errors.length === 0) {
      try {
        await ensureVersionsTable();
        version = await recordVersion(projectId, source, message || `Deploy · ${schema.tables.length} table${schema.tables.length !== 1 ? "s" : ""}`);
      } catch (e) {
        console.error("[MintDB] Version snapshot failed:", e);
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      applied,
      errors,
      totalTables: schema.tables.length,
      version,
    });
  } catch (e) {
    console.error("[MintDB] Migration error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Migration failed" },
      { status: 500 }
    );
  }
}
