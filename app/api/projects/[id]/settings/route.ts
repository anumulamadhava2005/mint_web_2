import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findUserByToken } from "../../../../../lib/auth";
import db from "../../../../../lib/db";

// PATCH /api/projects/[id]/settings — update project settings and access control
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
    const { is_public, allow_public_edit, name, description } = body;

    const updates: string[] = [];
    const values: any[] = [];
    let queryIndex = 1;

    if (typeof is_public === "boolean") {
      updates.push(`is_public = $${queryIndex++}`);
      values.push(is_public);
    }
    
    if (typeof allow_public_edit === "boolean") {
      updates.push(`allow_public_edit = $${queryIndex++}`);
      values.push(allow_public_edit);
    }

    if (typeof name === "string" && name.trim().length > 0) {
      updates.push(`name = $${queryIndex++}`);
      values.push(name.trim());
    }

    if (typeof description === "string" || description === null) {
      updates.push(`description = $${queryIndex++}`);
      values.push(description);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    updates.push(`updated_at = now()`);

    values.push(projectId, user.id);
    const projectIdIndex = queryIndex++;
    const userIdIndex = queryIndex++;

    const res = await db.query(
      `UPDATE projects 
       SET ${updates.join(", ")} 
       WHERE id = $${projectIdIndex} AND owner_id = $${userIdIndex} 
       RETURNING id, name, description, is_public, allow_public_edit`,
      values
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: "Project not found or you don't have permission" }, { status: 404 });
    }

    return NextResponse.json({ success: true, project: res.rows[0] });
  } catch (error) {
    console.error("Project Settings API Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
