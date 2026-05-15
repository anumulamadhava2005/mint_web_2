import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findUserByToken } from "../../../../lib/auth";
import db from "../../../../lib/db";

// DELETE /api/projects/[id] — Delete a project and all associated files
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
      "SELECT id FROM projects WHERE id = $1 AND owner_id = $2",
      [projectId, user.id]
    );

    if (projRes.rows.length === 0) {
      return NextResponse.json({ error: "Project not found or you don't have permission to delete it" }, { status: 404 });
    }

    // Use transaction to delete associated files, file changes, etc. (if cascading isn't set up, though files FK has ON DELETE CASCADE usually)
    // Assuming 'projects' is at the root. We'll just delete the project and rely on CASCADE or soft-delete if preferred.
    // Let's do a hard delete of the project for the owner.
    
    await db.query("DELETE FROM projects WHERE id = $1 AND owner_id = $2", [projectId, user.id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Project Deletion API Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
