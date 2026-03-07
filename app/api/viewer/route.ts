// ═══════════════════════════════════════════════════════════════
// Viewer Bundle API — get-view-only-bundle
// Mirrors: backend/src/app/rpc/commands/viewer.clj
// Returns file data for the prototype viewer (via share link or auth)
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findUserByToken } from "@/lib/auth";
import db from "@/lib/db";

// GET /api/viewer?fileId=...&shareId=...
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get("fileId");
    const shareId = searchParams.get("shareId");

    if (!fileId) {
      return NextResponse.json({ error: "fileId required" }, { status: 400 });
    }

    // Try share link first (no auth needed)
    if (shareId) {
      const shareRes = await db.query(
        `SELECT sl.pages, sl.flags, f.id, f.name, f.data, f.revn
         FROM share_links sl
         JOIN files f ON sl.file_id = f.id
         WHERE sl.id = $1 AND f.id = $2 AND f.deleted_at IS NULL`,
        [shareId, fileId]
      );
      if (shareRes.rows.length > 0) {
        const row = shareRes.rows[0];
        return NextResponse.json({
          file: { id: row.id, name: row.name, data: row.data, revn: row.revn },
          permissions: { canComment: (row.flags || []).includes("can-comment") },
        });
      }
      return NextResponse.json({ error: "Share link not found" }, { status: 404 });
    }

    // Authenticated access
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await findUserByToken(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const res = await db.query(
      `SELECT f.id, f.name, f.data, f.revn
       FROM files f
       JOIN projects p ON f.project_id = p.id
       WHERE f.id = $1 AND p.owner_id = $2 AND f.deleted_at IS NULL`,
      [fileId, user.id]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const file = res.rows[0];
    return NextResponse.json({
      file: { id: file.id, name: file.name, data: file.data, revn: file.revn },
      permissions: { canComment: true, canEdit: true },
    });
  } catch (e) {
    console.error("GET /api/viewer error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
