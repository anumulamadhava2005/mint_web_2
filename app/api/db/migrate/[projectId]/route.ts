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
import { generateMigrations } from "../../../../../lib/runtime/database";
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

    if (!schema?.tables?.length) {
      return NextResponse.json({ error: "No tables in schema" }, { status: 400 });
    }

    const prefix = `mint_proj_${projectId.replace(/[^a-zA-Z0-9_]/g, "")}_`;

    // Ensure migrations table
    await db.query(`
      CREATE TABLE IF NOT EXISTS "_mint_migrations" (
        "id" TEXT PRIMARY KEY,
        "project_id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "applied_at" TIMESTAMPTZ DEFAULT now()
      )
    `);

    // Prefix table names in the schema BEFORE generating migrations
    // This ensures only table names get prefixed, not column names
    const prefixedSchema: DatabaseConfigSchema = {
      ...schema,
      tables: schema.tables.map((t: any) => ({
        ...t,
        name: `${prefix}${t.name}`,
        relations: (t.relations || []).map((r: any) => ({
          ...r,
          targetTable: `${prefix}${r.targetTable}`,
          junctionTable: r.junctionTable ? `${prefix}${r.junctionTable}` : undefined,
        })),
        indexes: (t.indexes || []).map((idx: any) => ({
          ...idx,
          name: `${prefix}${idx.name}`,
        })),
        policies: (t.policies || []).map((p: any) => ({
          ...p,
          name: `${prefix}${p.name}`,
        })),
      })),
    };

    // Generate migrations with prefixed table names
    const migrations = generateMigrations(prefixedSchema);

    // Check which are already applied
    const existing = await db.query(
      `SELECT "id" FROM "_mint_migrations" WHERE "project_id" = $1`,
      [projectId]
    );
    const appliedIds = new Set((existing.rows || []).map((r: any) => r.id));

    const applied: string[] = [];
    const errors: string[] = [];

    for (const migration of migrations) {
      if (appliedIds.has(migration.id)) continue;

      try {
        await db.query(migration.upSQL);
        await db.query(
          `INSERT INTO "_mint_migrations" ("id", "project_id", "name") VALUES ($1, $2, $3)`,
          [migration.id, projectId, migration.name]
        );
        applied.push(migration.id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${migration.name}: ${msg}`);
      }
    }

    // Store schema snapshot
    await db.query(
      `INSERT INTO "_mint_migrations" ("id", "project_id", "name")
       VALUES ($1, $2, $3)
       ON CONFLICT ("id") DO UPDATE SET "name" = $3`,
      [`schema_${projectId}_${Date.now()}`, projectId, `Schema: ${schema.tables.map((t) => t.name).join(", ")}`]
    );

    return NextResponse.json({
      success: errors.length === 0,
      applied,
      errors,
      totalTables: schema.tables.length,
    });
  } catch (e) {
    console.error("[MintDB] Migration error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Migration failed" },
      { status: 500 }
    );
  }
}
