import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findUserByToken } from "../../../../../lib/auth";
import db from "../../../../../lib/db";

// Safe query helper — returns empty result on failure
async function safeQuery(text: string, params?: any[]) {
  try {
    const res = await db.query(text, params);
    return { rows: res.rows || [], error: null };
  } catch (e: any) {
    console.warn("[Dashboard] Query failed:", e.message?.slice(0, 120));
    return { rows: [], error: e.message };
  }
}

// GET /api/projects/[id]/dashboard — fetch project-specific data overview
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await findUserByToken(token);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership
    const projRes = await db.query(
      "SELECT id, name, created_at, updated_at, is_public, allow_public_edit FROM projects WHERE id = $1 AND owner_id = $2",
      [projectId, user.id]
    );

    if (projRes.rows.length === 0) {
      return NextResponse.json({ error: "Project not found or no permission" }, { status: 404 });
    }

    const project = projRes.rows[0];

    // Run all independent queries in parallel
    const [filesRes, changesRes, threadsRes, commitsRes, collabRes, shareRes, schemaRes] = await Promise.all([
      safeQuery(
        `SELECT id, name, revn, created_at, modified_at
         FROM files
         WHERE project_id = $1 AND deleted_at IS NULL
         ORDER BY modified_at DESC`,
        [projectId]
      ),
      safeQuery(
        `SELECT fc.file_id, COUNT(*) as change_count, MAX(fc.created_at) as last_change
         FROM file_changes fc
         JOIN files f ON fc.file_id = f.id
         WHERE f.project_id = $1 AND f.deleted_at IS NULL
         GROUP BY fc.file_id`,
        [projectId]
      ),
      safeQuery(
        `SELECT ct.id, ct.content, ct.resolved, ct.created_at, u.email as author_email
         FROM comment_threads ct
         JOIN files f ON ct.file_id = f.id
         JOIN users u ON ct.owner_id = u.id
         WHERE f.project_id = $1 AND f.deleted_at IS NULL
         ORDER BY ct.created_at DESC
         LIMIT 20`,
        [projectId]
      ),
      safeQuery(
        `SELECT pc.id, pc.version, pc.message, pc.created_at, u.email as committed_by_email
         FROM project_commits pc
         LEFT JOIN users u ON pc.committed_by = u.id
         WHERE pc.project_id = $1
         ORDER BY pc.version DESC
         LIMIT 20`,
        [projectId]
      ),
      safeQuery(
        `SELECT id, started_at, ended_at, active_users, total_operations
         FROM collab_sessions
         WHERE project_id = $1
         ORDER BY started_at DESC
         LIMIT 10`,
        [projectId]
      ),
      safeQuery(
        `SELECT sl.id, sl.pages, sl.flags, sl.created_at
         FROM share_links sl
         JOIN files f ON sl.file_id = f.id
         WHERE f.project_id = $1 AND f.deleted_at IS NULL
         ORDER BY sl.created_at DESC
         LIMIT 20`,
        [projectId]
      ),
      safeQuery(
        `SELECT schema_json, updated_at FROM runtime_schemas WHERE project_id = $1`,
        [projectId]
      ),
    ]);

    // Runtime schema
    let runtimeSchema = null;
    if (schemaRes.rows.length) {
      const raw = schemaRes.rows[0].schema_json;
      runtimeSchema = {
        schema: typeof raw === "string" ? JSON.parse(raw) : raw,
        updatedAt: schemaRes.rows[0].updated_at,
      };
    }

    // Runtime table data — parallelize all table queries
    const dbTables = runtimeSchema?.schema?.database?.tables || [];
    const runtimeTablesData: Record<string, { rows: any[]; rowCount: number }> = {};
    if (dbTables.length > 0) {
      const prefix = `mint_proj_${projectId.replace(/[^a-zA-Z0-9_]/g, "")}_`;
      const tableQueries = (dbTables as any[])
        .map((table: any) => {
          const safeName = (table.name || "").replace(/[^a-zA-Z0-9_]/g, "");
          if (!safeName) return null;
          return {
            name: table.name,
            promise: safeQuery(
              `SELECT * FROM "${prefix}${safeName}" ORDER BY "created_at" DESC LIMIT 100`
            ),
          };
        })
        .filter(Boolean) as { name: string; promise: Promise<any> }[];

      const results = await Promise.all(tableQueries.map((q) => q.promise));
      tableQueries.forEach((q, i) => {
        runtimeTablesData[q.name] = {
          rows: results[i].rows,
          rowCount: results[i].rows.length,
        };
      });
    }

    // Build changes map
    const changesMap: Record<string, { change_count: number; last_change: string }> = {};
    for (const row of changesRes.rows) {
      changesMap[row.file_id] = { change_count: parseInt(row.change_count, 10) || 0, last_change: row.last_change };
    }

    // Enrich files with change data
    const files = filesRes.rows.map((f: any) => ({
      ...f,
      change_count: changesMap[f.id]?.change_count || 0,
      last_change: changesMap[f.id]?.last_change || null,
    }));

    return NextResponse.json({
      project,
      stats: {
        fileCount: filesRes.rows.length,
        totalRevisions: changesRes.rows.reduce(
          (sum: number, r: any) => sum + (parseInt(r.change_count, 10) || 0), 0
        ),
        commitCount: commitsRes.rows.length,
        commentThreads: threadsRes.rows.length,
        collabSessions: collabRes.rows.length,
        shareLinks: shareRes.rows.length,
        totalTables: runtimeSchema?.schema?.database?.tables?.length || 0,
      },
      files,
      commits: commitsRes.rows,
      comments: threadsRes.rows,
      collabSessions: collabRes.rows,
      shareLinks: shareRes.rows,
      runtimeSchema,
      runtimeTablesData,
    });
  } catch (error) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
