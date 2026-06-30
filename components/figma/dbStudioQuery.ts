// ═══════════════════════════════════════════════════════════════
// dbStudioQuery — thin client for the managed-DB DML endpoint.
//
// POSTs { sql, params } to /api/db/[projectId]. That route is DML-only
// (SELECT/INSERT/UPDATE/DELETE), blocks DDL + injection patterns, and
// namespaces table names to mint_proj_<projectId>_ — so callers use the
// BARE table name (e.g. "users") and the server adds the prefix.
// ═══════════════════════════════════════════════════════════════

export type DbRow = Record<string, unknown>;
export type QueryResult = { rows: DbRow[]; rowCount: number };

export async function runProjectQuery(
  projectId: string,
  sql: string,
  params: unknown[] = [],
): Promise<QueryResult> {
  const res = await fetch(`/api/db/${projectId}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sql, params }),
  });
  let json: { rows?: DbRow[]; rowCount?: number; error?: string };
  try {
    json = await res.json();
  } catch {
    throw new Error(`HTTP ${res.status}`);
  }
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return { rows: json.rows ?? [], rowCount: json.rowCount ?? 0 };
}

/** Render a DB value for display in a cell. */
export function displayValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}
