// ═══════════════════════════════════════════════════════════════
// Schema Version Control API
//
// GET  /api/db/versions/[projectId]        → list version history
// POST /api/db/versions/[projectId]         body { rollbackTo: number }
//        → converge the live DB to that version (up-sync + down-drop) and
//          append a new version (git-revert style; history is never rewritten)
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findUserByToken } from "@/lib/auth";
import db from "@/lib/db";
import {
  generateSyncStatements,
  generateDropStatements,
  prefixSchemaTables,
} from "@/lib/runtime/database";
import { dbConfigToRuntimeSchema } from "@/lib/stores/figmaDbToSchema";
import {
  ensureVersionsTable,
  listVersions,
  getVersion,
  latestVersion,
  recordVersion,
} from "@/lib/runtime/schemaVersions";
import type { DatabaseConfig } from "@/lib/stores/figmaStore";
import type { DatabaseConfigSchema } from "@/lib/runtime/schema";

async function authProject(projectId: string): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return false;
  const user = await findUserByToken(token);
  if (!user) return false;
  const check = await db.query("SELECT id FROM projects WHERE id = $1 AND owner_id = $2", [projectId, user.id]);
  return !!check.rows?.length;
}

export async function GET(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  if (!(await authProject(projectId))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await ensureVersionsTable();
    const versions = await listVersions(projectId);
    // ?schema=1 also returns the latest schema so the studio can bootstrap
    // when figmaStore is empty (e.g. after Redis→DB flush window expires).
    const url = new URL(req.url);
    let latestSchema: unknown = undefined;
    if (url.searchParams.get("schema") === "1" && versions.length > 0) {
      const latest = await latestVersion(projectId);
      latestSchema = latest?.schema_json ?? null;
    }
    return NextResponse.json({ versions, ...(latestSchema !== undefined && { latestSchema }) });
  } catch (e) {
    console.error("[MintDB] List versions error:", e);
    return NextResponse.json({ error: "Failed to list versions" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  if (!(await authProject(projectId))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await ensureVersionsTable();
    const body = await req.json();
    const rollbackTo = Number(body.rollbackTo);
    if (!Number.isInteger(rollbackTo)) {
      return NextResponse.json({ error: "rollbackTo must be a version number" }, { status: 400 });
    }

    const target = await getVersion(projectId, rollbackTo);
    if (!target) return NextResponse.json({ error: `Version ${rollbackTo} not found` }, { status: 404 });
    const current = await latestVersion(projectId);

    const targetConfig = target.schema_json as DatabaseConfig;
    const targetPrefixed = prefixSchemaTables(dbConfigToRuntimeSchema(targetConfig), projectId);
    const currentPrefixed = current
      ? prefixSchemaTables(dbConfigToRuntimeSchema(current.schema_json as DatabaseConfig), projectId)
      : ({ provider: targetConfig.provider, tables: [] } as DatabaseConfigSchema);

    // Which target tables already exist (for NOT NULL safety on re-create).
    const names = targetPrefixed.tables.map((t) => t.name);
    let existingTables = new Set<string>();
    try {
      const introspect = await db.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
        [names]
      );
      existingTables = new Set((introspect.rows || []).map((r: { table_name: string }) => r.table_name));
    } catch { /* fall back to additive */ }

    // up-sync everything the target needs, then down-drop what it no longer has.
    const plan = [
      ...generateSyncStatements(targetPrefixed, existingTables),
      ...generateDropStatements(currentPrefixed, targetPrefixed),
    ];

    const applied: string[] = [];
    const errors: string[] = [];
    for (const step of plan) {
      try {
        await db.query(step.sql);
        applied.push(step.label);
      } catch (e) {
        errors.push(`${step.label}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Append a new version equal to the target (forward-only history).
    const newVersion = await recordVersion(projectId, targetConfig, `Rolled back to v${rollbackTo}`);

    return NextResponse.json({
      success: errors.length === 0,
      applied,
      errors,
      restoredFrom: rollbackTo,
      version: newVersion,
      schema: targetConfig,
    });
  } catch (e) {
    console.error("[MintDB] Rollback error:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Rollback failed" }, { status: 500 });
  }
}
