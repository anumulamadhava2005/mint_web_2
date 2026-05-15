// ═══════════════════════════════════════════════════════════════
// File Changes API — Core collaboration endpoint (update-file)
// Mirrors: backend/src/app/rpc/commands/files_update.clj
//
// POST /api/files/changes — submit changes to a file
// GET  /api/files/changes?fileId=...&fromRevn=... — get changes since revn
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findUserByToken } from "@/lib/auth";
import db from "@/lib/db";

// POST — submit changes (the main collaboration endpoint)
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await findUserByToken(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { fileId, sessionId, revn, changes } = body;

    if (!fileId || !changes || !Array.isArray(changes)) {
      return NextResponse.json({ error: "fileId and changes required" }, { status: 400 });
    }

    // Short-circuit: if no actual changes, just return current revn
    if (changes.length === 0) {
      const fileRes = await db.query(
        `SELECT revn FROM files WHERE id = $1 AND deleted_at IS NULL`,
        [fileId]
      );
      const currentRevn = fileRes.rows.length ? parseInt(fileRes.rows[0].revn, 10) : 0;
      return NextResponse.json({ revn: currentRevn, laggedChanges: [] });
    }

    // Use a transaction for atomicity
    const result = await db.transaction(async (client) => {
      // 1. Get current file with exclusive lock
      const fileRes = await client.query(
        `SELECT f.id, f.revn, f.data
         FROM files f
         JOIN projects p ON f.project_id = p.id
         WHERE f.id = $1 AND (p.owner_id = $2 OR p.allow_public_edit = true) AND f.deleted_at IS NULL
         FOR UPDATE`,
        [fileId, user.id]
      );

      if (fileRes.rows.length === 0) {
        throw new Error("File not found");
      }

      const file = fileRes.rows[0];
      const currentRevn = parseInt(file.revn, 10);

      // 2. Check for lagged changes (conflict resolution)
      let laggedChanges: any[] = [];
      const clientRevn = typeof revn === "number" ? revn : currentRevn;
      
      if (clientRevn < currentRevn) {
        const lagRes = await client.query(
          `SELECT changes, revn, session_id FROM file_changes
           WHERE file_id = $1 AND revn > $2
           ORDER BY revn ASC`,
          [fileId, clientRevn]
        );
        laggedChanges = lagRes.rows.map((r: any) => ({
          changes: r.changes,
          revn: parseInt(r.revn, 10),
          sessionId: r.session_id,
        }));
      }

      // 3. Increment revn
      const newRevn = currentRevn + 1;

      // 4. Apply changes to file data (server-authoritative)
      let fileData = file.data || {};

      // If the client sent a full snapshot, use it (for save operations)
      if (body.snapshotData) {
        fileData = body.snapshotData;
      } else {
        // Apply incremental changes
        fileData = applyServerChanges(fileData, changes);
      }

      // 5. Persist the change record
      await client.query(
        `INSERT INTO file_changes (file_id, session_id, revn, data, changes)
         VALUES ($1, $2, $3, $4, $5)`,
        [fileId, sessionId || null, newRevn, JSON.stringify(fileData), JSON.stringify(changes)]
      );

      // 6. Update the file's revn and data
      await client.query(
        `UPDATE files SET revn = $1, data = $2 WHERE id = $3`,
        [newRevn, JSON.stringify(fileData), fileId]
      );

      return {
        revn: newRevn,
        laggedChanges,
      };
    });

    return NextResponse.json(result);
  } catch (e: any) {
    if (e.message === "File not found") {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    console.error("POST /api/files/changes error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// GET — retrieve changes since a given revision
export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await findUserByToken(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get("fileId");
    const fromRevn = parseInt(searchParams.get("fromRevn") || "0", 10);

    if (!fileId) return NextResponse.json({ error: "fileId required" }, { status: 400 });

    const res = await db.query(
      `SELECT fc.id, fc.revn, fc.session_id, fc.changes, fc.created_at
       FROM file_changes fc
       JOIN files f ON fc.file_id = f.id
       JOIN projects p ON f.project_id = p.id
       WHERE fc.file_id = $1 AND fc.revn > $2 AND (p.owner_id = $3 OR p.is_public = true)
       ORDER BY fc.revn ASC
       LIMIT 100`,
      [fileId, fromRevn, user.id]
    );

    return NextResponse.json({ changes: res.rows });
  } catch (e) {
    console.error("GET /api/files/changes error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// ── Server-side change application ────────────────────────────
function applyServerChanges(fileData: any, changes: any[]): any {
  let data = structuredClone(fileData);

  for (const change of changes) {
    switch (change.type) {
      case "add-obj": {
        const page = data.pagesIndex?.[change.pageId];
        if (!page) break;
        if (!page.objects) page.objects = {};
        page.objects[change.id] = change.obj;
        // Add to parent's children
        const parent = page.objects[change.parentId];
        if (parent) {
          if (!parent.shapes) parent.shapes = [];
          if (change.index !== undefined) {
            parent.shapes.splice(change.index, 0, change.id);
          } else {
            parent.shapes.push(change.id);
          }
        }
        break;
      }

      case "mod-obj": {
        const page = data.pagesIndex?.[change.pageId];
        if (!page) break;
        const shape = page.objects?.[change.id];
        if (!shape) break;
        for (const op of change.operations || []) {
          if (op.type === "set") {
            shape[op.attr] = op.val;
          } else if (op.type === "assign") {
            Object.assign(shape, op.value);
          }
        }
        break;
      }

      case "del-obj": {
        const page = data.pagesIndex?.[change.pageId];
        if (!page) break;
        const shape = page.objects?.[change.id];
        if (!shape) break;
        // Remove from parent
        if (shape.parentId) {
          const parent = page.objects[shape.parentId];
          if (parent?.shapes) {
            parent.shapes = parent.shapes.filter((sid: string) => sid !== change.id);
          }
        }
        // Delete recursively
        const deleteRec = (id: string) => {
          const s = page.objects[id];
          if (s?.shapes) {
            for (const cid of s.shapes) deleteRec(cid);
          }
          delete page.objects[id];
        };
        deleteRec(change.id);
        break;
      }

      case "mov-objects": {
        const page = data.pagesIndex?.[change.pageId];
        if (!page) break;
        for (const sid of change.shapes || []) {
          const s = page.objects[sid];
          if (!s) continue;
          if (s.parentId) {
            const old = page.objects[s.parentId];
            if (old?.shapes) old.shapes = old.shapes.filter((id: string) => id !== sid);
          }
        }
        const newParent = page.objects[change.parentId];
        if (newParent) {
          if (!newParent.shapes) newParent.shapes = [];
          newParent.shapes.push(...(change.shapes || []));
        }
        // Update parentId and frameId on moved shapes
        const targetFrameId = (newParent?.type === "frame")
          ? change.parentId
          : newParent?.frameId || change.parentId;
        for (const sid of change.shapes || []) {
          const s = page.objects[sid];
          if (s) {
            s.parentId = change.parentId;
            s.frameId = targetFrameId;
          }
        }
        break;
      }

      case "add-page": {
        if (!data.pages) data.pages = [];
        if (!data.pagesIndex) data.pagesIndex = {};
        data.pages.push(change.page.id);
        data.pagesIndex[change.page.id] = change.page;
        break;
      }

      case "del-page": {
        data.pages = (data.pages || []).filter((pid: string) => pid !== change.id);
        if (data.pagesIndex) delete data.pagesIndex[change.id];
        break;
      }

      case "mod-page": {
        const page = data.pagesIndex?.[change.id];
        if (page && change.name !== undefined) page.name = change.name;
        break;
      }

      case "set-flow": {
        const page = data.pagesIndex?.[change.pageId];
        if (!page) break;
        if (!page.flows) page.flows = [];
        const idx = page.flows.findIndex((f: any) => f.id === change.flow.id);
        if (idx >= 0) page.flows[idx] = change.flow;
        else page.flows.push(change.flow);
        break;
      }

      case "del-flow": {
        const page = data.pagesIndex?.[change.pageId];
        if (!page || !page.flows) break;
        page.flows = page.flows.filter((f: any) => f.id !== change.id);
        break;
      }
    }
  }

  return data;
}
