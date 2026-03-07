// ═══════════════════════════════════════════════════════════════
// Comments API
// Mirrors: backend/src/app/rpc/commands/comments.clj
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findUserByToken } from "@/lib/auth";
import db from "@/lib/db";

// GET /api/comments?fileId=... — list comment threads for a file
export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await findUserByToken(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get("fileId");
    if (!fileId) return NextResponse.json({ error: "fileId required" }, { status: 400 });

    const res = await db.query(
      `SELECT ct.*, u.email as owner_email, u.fullname as owner_name,
              (SELECT count(*) FROM comments c WHERE c.thread_id = ct.id) as reply_count
       FROM comment_threads ct
       JOIN users u ON ct.owner_id = u.id
       JOIN files f ON ct.file_id = f.id
       JOIN projects p ON f.project_id = p.id
       WHERE ct.file_id = $1 AND p.owner_id = $2
       ORDER BY ct.created_at DESC`,
      [fileId, user.id]
    );

    return NextResponse.json({ threads: res.rows });
  } catch (e) {
    console.error("GET /api/comments error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST /api/comments — create a comment thread or reply
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await findUserByToken(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    // Reply to existing thread
    if (body.threadId) {
      const res = await db.query(
        `INSERT INTO comments (thread_id, owner_id, content)
         VALUES ($1, $2, $3)
         RETURNING id, thread_id, content, created_at`,
        [body.threadId, user.id, body.content || ""]
      );
      return NextResponse.json({ comment: res.rows[0] }, { status: 201 });
    }

    // Create new thread
    const { fileId, pageId, frameId, positionX, positionY, content } = body;
    if (!fileId || !pageId || !content) {
      return NextResponse.json({ error: "fileId, pageId, content required" }, { status: 400 });
    }

    const res = await db.query(
      `INSERT INTO comment_threads (file_id, owner_id, page_id, frame_id, position_x, position_y, content)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, file_id, page_id, position_x, position_y, content, created_at`,
      [fileId, user.id, pageId, frameId || null, positionX || 0, positionY || 0, content]
    );

    return NextResponse.json({ thread: res.rows[0] }, { status: 201 });
  } catch (e) {
    console.error("POST /api/comments error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
