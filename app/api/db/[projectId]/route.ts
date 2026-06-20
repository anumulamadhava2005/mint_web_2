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
import { findUserByToken, getProjectSyncToken } from "../../../../lib/auth";
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

// CORS headers for cross-origin requests (e.g. React Native exported apps)
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400, headers: corsHeaders() });
    }

    // Auth check. Exported apps authenticate with the project-specific sync
    // token (HMAC of the projectId — same trust model as /api/design-data and
    // /api/project-data); the editor authenticates with a session cookie/token.
    // Prefer Authorization header (sync token from exported apps) over cookie,
    // because login sets a session cookie that React Native's fetch auto-sends,
    // which would shadow the valid sync token if cookie were checked first.
    const authHeader = req.headers.get("authorization");
    const tokenFromHeader = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;
    const cookieStore = await cookies();
    const tokenFromCookie = cookieStore.get("token")?.value;

    let isAuthorized = false;

    // A. Project sync token — the credential baked into exported apps.
    //    Check the Bearer header explicitly (not the cookie).
    const expectedSyncToken = getProjectSyncToken(projectId);
    if (tokenFromHeader && tokenFromHeader === expectedSyncToken) {
      isAuthorized = true;
    }

    // B. Public projects are readable/writable by the managed DB bridge.
    if (!isAuthorized) {
      const publicCheck = await db.query(
        "SELECT id FROM projects WHERE id = $1 AND is_public = true",
        [projectId]
      );
      if (publicCheck.rows?.length) isAuthorized = true;
    }

    // C. Otherwise require a valid session token that owns the project.
    //    Check both header and cookie — either can carry a session token.
    const sessionToken = tokenFromHeader || tokenFromCookie;
    if (!isAuthorized && sessionToken) {
      const user = await findUserByToken(sessionToken);
      if (user) {
        const ownerCheck = await db.query(
          "SELECT id FROM projects WHERE id = $1 AND owner_id = $2",
          [projectId, user.id]
        );
        if (ownerCheck.rows?.length) isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      // 404 (not 401) to avoid project-id enumeration, matching the
      // other SDUI endpoints.
      return NextResponse.json({ error: "Not found" }, { status: 404, headers: corsHeaders() });
    }

    const body = await req.json();
    const { sql, params: queryParams } = body;

    if (!sql || typeof sql !== "string") {
      return NextResponse.json({ error: "Missing SQL query" }, { status: 400, headers: corsHeaders() });
    }

    // Security: validate SQL — only DML allowed
    const trimmed = sql.trim().toUpperCase();
    const isAllowed = ALLOWED_PREFIXES.some((p) => trimmed.startsWith(p));
    if (!isAllowed) {
      return NextResponse.json(
        { error: "Query type not allowed" },
        { status: 403, headers: corsHeaders() }
      );
    }

    // Security: check for blocked patterns
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(sql)) {
        return NextResponse.json(
          { error: "Query contains blocked pattern" },
          { status: 403, headers: corsHeaders() }
        );
      }
    }

    // Execute the query with project namespace isolation
    // All tables are prefixed with the project ID to provide isolation
    const namespacedSQL = namespaceQuery(sql, projectId);

    const sanitizedParams = (queryParams || []).map((p: any) =>
      (p === "" || p === undefined) ? null : p
    );

    // SD-03: Enforce 5s timeout on user-provided queries
    // Use a transaction so both statements share the same connection
    const result = await db.transaction(async (client) => {
      await client.query("SET statement_timeout = '5000'");
      return client.query(namespacedSQL, sanitizedParams);
    });


    return NextResponse.json({
      rows: result.rows || [],
      rowCount: result.rows?.length || 0,
    }, { headers: corsHeaders() });
  } catch (e) {
    console.error("[MintDB] Query error:", e);
    return NextResponse.json(
      { error: "Query failed" },
      { status: 400, headers: corsHeaders() }
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
