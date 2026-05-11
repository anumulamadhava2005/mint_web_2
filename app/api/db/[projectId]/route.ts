// ═══════════════════════════════════════════════════════════════
// Mint Managed Database API
//
// This API route handles database queries from exported apps.
// Each project gets an isolated database namespace, accessed via:
//   {project_id}_{user_id}.mintit.pro/api/db/query
//
// In the current architecture, all project databases share the
// same PostgreSQL instance, isolated via schema prefixing:
//   mint_proj_{projectId}_{table}
//
// Future: separate databases per project for true isolation.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import db from "../../../../lib/db";

// Allowed SQL operations for security
const ALLOWED_PREFIXES = [
  "SELECT", "INSERT", "UPDATE", "DELETE",
  "CREATE TABLE", "CREATE INDEX", "CREATE UNIQUE INDEX",
  "CREATE OR REPLACE FUNCTION", "CREATE TRIGGER",
  "DROP TRIGGER", "ALTER TABLE", "CREATE POLICY",
  "DO $$",
];

// Blocked patterns for security
const BLOCKED_PATTERNS = [
  /;\s*(DROP\s+DATABASE|DROP\s+SCHEMA)/i,
  /;\s*TRUNCATE\s/i,
  /pg_sleep/i,
  /information_schema/i,
  /pg_catalog/i,
  /COPY\s/i,
  /\\copy/i,
];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    const body = await req.json();
    const { sql, params: queryParams } = body;

    if (!sql || typeof sql !== "string") {
      return NextResponse.json({ error: "Missing SQL query" }, { status: 400 });
    }

    // Security: validate SQL
    const trimmed = sql.trim().toUpperCase();
    const isAllowed = ALLOWED_PREFIXES.some((p) => trimmed.startsWith(p));
    if (!isAllowed) {
      return NextResponse.json(
        { error: "Query type not allowed" },
        { status: 403 }
      );
    }

    // Security: check for blocked patterns
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(sql)) {
        return NextResponse.json(
          { error: "Query contains blocked pattern" },
          { status: 403 }
        );
      }
    }

    // Execute the query with project namespace isolation
    // All tables are prefixed with the project ID to provide isolation
    const namespacedSQL = namespaceQuery(sql, projectId);

    const result = await db.query(namespacedSQL, queryParams || []);

    return NextResponse.json({
      rows: result.rows || [],
      rowCount: result.rows?.length || 0,
    });
  } catch (e) {
    console.error("[MintDB] Query error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Query failed" },
      { status: 500 }
    );
  }
}

/**
 * Namespace table references in SQL to isolate per-project.
 *
 * Strategy: Only prefix quoted identifiers that appear in table-position
 * contexts (after FROM, INTO, UPDATE, JOIN, ON, REFERENCES, TABLE, INDEX ON).
 * Column names inside parentheses are left untouched.
 */
function namespaceQuery(sql: string, projectId: string): string {
  const prefix = `mint_proj_${projectId.replace(/[^a-zA-Z0-9_]/g, "")}_`;

  // These keywords are immediately followed by a table name
  const tableKeywords = [
    "FROM",
    "JOIN",
    "UPDATE",
    "REFERENCES",
    "TABLE",
    "EXISTS",       // CREATE TABLE IF NOT EXISTS "name"
  ];

  // INTO is special: INSERT INTO "table" ("col1", "col2") — only first is table
  // We handle it by matching INTO "name" specifically followed by ( or whitespace

  // Phase 1: Replace INSERT INTO "table"
  let result = sql.replace(
    /\bINTO\s+"([a-zA-Z][a-zA-Z0-9_]*)"/gi,
    (match, name) => {
      if (name.startsWith("_") || name.startsWith("pg_") || name.startsWith("mint_")) return match;
      return `INTO "${prefix}${name}"`;
    }
  );

  // Phase 2: Replace after table-position keywords
  for (const kw of tableKeywords) {
    const regex = new RegExp(`\\b${kw}\\s+"([a-zA-Z][a-zA-Z0-9_]*)"`, "gi");
    result = result.replace(regex, (match, name) => {
      if (name.startsWith("_") || name.startsWith("pg_") || name.startsWith("mint_")) return match;
      return match.replace(`"${name}"`, `"${prefix}${name}"`);
    });
  }

  // Phase 3: Replace ON "table" (for triggers/indexes but NOT ON "column")
  // Pattern: INDEX ... ON "table"  or  TRIGGER ... ON "table"
  result = result.replace(
    /\bON\s+"([a-zA-Z][a-zA-Z0-9_]*)"/gi,
    (match, name) => {
      if (name.startsWith("_") || name.startsWith("pg_") || name.startsWith("mint_")) return match;
      return `ON "${prefix}${name}"`;
    }
  );

  return result;
}
