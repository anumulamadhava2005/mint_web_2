// ═══════════════════════════════════════════════════════════════
// Schema version control — Git-revert-style, forward-only history.
//
// Every successful deploy records an immutable snapshot of the editor's
// database config (the unprefixed figmaStore.DatabaseConfig) as a numbered
// version. Rollback never rewrites history: it restores a prior snapshot by
// creating a NEW version equal to the target (like `git revert`).
// ═══════════════════════════════════════════════════════════════

import db from "../db";

export interface SchemaVersion {
  version: number;
  message: string;
  created_at: string;
  schema_json: unknown;
}

export async function ensureVersionsTable(): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS "schema_versions" (
      "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "project_id"  uuid NOT NULL,
      "version"     integer NOT NULL,
      "schema_json" jsonb NOT NULL,
      "message"     text DEFAULT '',
      "created_at"  timestamptz DEFAULT now(),
      UNIQUE ("project_id", "version")
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_schema_versions_project ON "schema_versions"("project_id", "version" DESC)`).catch(() => {});
}

/** The most recent version row for a project, or null. */
export async function latestVersion(projectId: string): Promise<SchemaVersion | null> {
  const res = await db.query(
    `SELECT "version", "message", "created_at", "schema_json"
       FROM "schema_versions" WHERE "project_id" = $1
      ORDER BY "version" DESC LIMIT 1`,
    [projectId]
  );
  return (res.rows && res.rows[0]) || null;
}

/** A specific version, or null. */
export async function getVersion(projectId: string, version: number): Promise<SchemaVersion | null> {
  const res = await db.query(
    `SELECT "version", "message", "created_at", "schema_json"
       FROM "schema_versions" WHERE "project_id" = $1 AND "version" = $2`,
    [projectId, version]
  );
  return (res.rows && res.rows[0]) || null;
}

/** Full history (newest first), without the heavy schema_json payload. */
export async function listVersions(projectId: string): Promise<Omit<SchemaVersion, "schema_json">[]> {
  const res = await db.query(
    `SELECT "version", "message", "created_at"
       FROM "schema_versions" WHERE "project_id" = $1
      ORDER BY "version" DESC`,
    [projectId]
  );
  return res.rows || [];
}

/**
 * Append a new version snapshot. If the schema is byte-identical to the latest
 * version, no new row is created and the latest version number is returned
 * (avoids cluttering history with no-op deploys).
 */
export async function recordVersion(projectId: string, schemaJson: unknown, message: string): Promise<number> {
  const latest = await latestVersion(projectId);
  if (latest && JSON.stringify(latest.schema_json) === JSON.stringify(schemaJson)) {
    return latest.version;
  }
  const next = (latest?.version ?? 0) + 1;
  await db.query(
    `INSERT INTO "schema_versions" ("project_id", "version", "schema_json", "message")
     VALUES ($1, $2, $3, $4)`,
    [projectId, next, JSON.stringify(schemaJson), message]
  );
  return next;
}
