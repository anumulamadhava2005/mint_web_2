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
import { cookies } from "next/headers";
import { findUserByToken } from "../../../../lib/auth";
import db from "../../../../lib/db";

// Allowed SQL operations — strictly DML only
const ALLOWED_PREFIXES = [
  "SELECT",
  "INSERT",
  "UPDATE",
  "DELETE",
];

// Blocked patterns for security — defense in depth
const BLOCKED_PATTERNS = [
  // DDL operations
  /\bCREATE\b/i,
  /\bALTER\b/i,
  /\bDROP\b/i,
  /\bTRUNCATE\b/i,
  // PL/pgSQL execution
  /\bDO\s*\$/i,
  /\bDO\s+\$\$/i,
  // System catalog access
  /\binformation_schema\b/i,
  /\bpg_catalog\b/i,
  /\bpg_sleep\b/i,
  // File I/O
  /\bCOPY\s/i,
  /\\copy/i,
  // Resource exhaustion
  /\bgenerate_series\b/i,
  // Subquery table escapes — block FROM/JOIN inside parentheses
  /\(\s*SELECT\b/i,
  // Multi-statement injection
  /;\s*\S/,
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

    // Auth check
    const cookieStore = await cookies();
    const tokenFromCookie = cookieStore.get("token")?.value;
    const authHeader = req.headers.get("authorization");
    const tokenFromHeader = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;
    const token = tokenFromCookie || tokenFromHeader;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await findUserByToken(token);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify project ownership or public access
    const projCheck = await db.query(
      "SELECT id FROM projects WHERE id = $1 AND (owner_id = $2 OR is_public = true)",
      [projectId, user.id]
    );
    if (!projCheck.rows?.length) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await req.json();
    const { sql, params: queryParams } = body;

    if (!sql || typeof sql !== "string") {
      return NextResponse.json({ error: "Missing SQL query" }, { status: 400 });
    }

    // Security: validate SQL — only DML allowed
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

    // SD-03: Enforce 5s timeout on user-provided queries
    // Use a transaction so both statements share the same connection
    const result = await db.transaction(async (client) => {
      await client.query("SET statement_timeout = '5000'");
      return client.query(namespacedSQL, queryParams || []);
    });

    return NextResponse.json({
      rows: result.rows || [],
      rowCount: result.rows?.length || 0,
    });
  } catch (e) {
    console.error("[MintDB] Query error:", e);
    return NextResponse.json(
      { error: "Query failed" },
      { status: 400 }
    );
  }
}

/**
 * Namespace table references in SQL to isolate per-project.
 *
 * Strategy: Prefix both quoted and unquoted identifiers that appear in
 * table-position contexts (after FROM, INTO, UPDATE, JOIN, ON, REFERENCES,
 * TABLE, INDEX ON, EXISTS). Column names inside parentheses are left untouched.
 */
function namespaceQuery(sql: string, projectId: string): string {
  const prefix = `mint_proj_${projectId.replace(/[^a-zA-Z0-9_]/g, "")}_`;

  const tableKeywords = [
    "FROM",
    "JOIN",
    "UPDATE",
    "REFERENCES",
    "TABLE",
    "EXISTS",
  ];

  let result = sql;

  // Phase 1: Replace INSERT INTO "table" or INSERT INTO table
  result = result.replace(
    /\bINTO\s+(?:"([a-zA-Z][a-zA-Z0-9_]*)"|([a-zA-Z][a-zA-Z0-9_]*))/gi,
    (match, quoted, unquoted) => {
      const name = quoted || unquoted;
      if (name.startsWith("_") || name.startsWith("pg_") || name.startsWith("mint_")) return match;
      const prefixedName = `"${prefix}${name}"`;
      return match.replace(quoted ? `"${name}"` : name, prefixedName);
    }
  );

  // Phase 2: Replace after table-position keywords (quoted and unquoted)
  for (const kw of tableKeywords) {
    const regex = new RegExp(
      `\\b${kw}\\s+(?:"([a-zA-Z][a-zA-Z0-9_]*)"|([a-zA-Z][a-zA-Z0-9_]*))`,
      "gi"
    );
    result = result.replace(regex, (match, quoted, unquoted) => {
      const name = quoted || unquoted;
      if (name.startsWith("_") || name.startsWith("pg_") || name.startsWith("mint_")) return match;
      const prefixedName = `"${prefix}${name}"`;
      return match.replace(quoted ? `"${name}"` : name, prefixedName);
    });
  }

  // Phase 3: Replace ON "table" or ON table (for triggers/indexes)
  result = result.replace(
    /\bON\s+(?:"([a-zA-Z][a-zA-Z0-9_]*)"|([a-zA-Z][a-zA-Z0-9_]*))/gi,
    (match, quoted, unquoted) => {
      const name = quoted || unquoted;
      if (name.startsWith("_") || name.startsWith("pg_") || name.startsWith("mint_")) return match;
      const prefixedName = `"${prefix}${name}"`;
      return match.replace(quoted ? `"${name}"` : name, prefixedName);
    }
  );

  return result;
}
