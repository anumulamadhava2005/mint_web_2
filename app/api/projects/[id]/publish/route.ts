import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findUserByToken } from "../../../../../lib/auth";
import db from "../../../../../lib/db";

// PATCH /api/projects/[id]/publish — toggle project's public status
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id: projectId } = await Promise.resolve(params);
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await findUserByToken(token);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { is_public } = body;

    if (typeof is_public !== "boolean") {
      return NextResponse.json({ error: "is_public boolean flag is required" }, { status: 400 });
    }

    // Verify ownership and update in one query
    const res = await db.query(
      `UPDATE projects 
       SET is_public = $1, updated_at = now() 
       WHERE id = $2 AND owner_id = $3 
       RETURNING id, is_public`,
      [is_public, projectId, user.id]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: "Project not found or you don't have permission" }, { status: 404 });
    }

    return NextResponse.json({ success: true, project: res.rows[0] });
  } catch (error) {
    console.error("Publish API Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
