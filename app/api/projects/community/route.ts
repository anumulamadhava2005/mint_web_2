import { NextResponse } from "next/server";
import db from "../../../../lib/db";

// GET /api/projects/community — list public projects from all users
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";

    let query = `
      SELECT p.id, p.name, p.description, p.thumbnail_url, p.likes, p.views, p.created_at, p.updated_at, p.is_public, u.email as owner_email
      FROM projects p
      JOIN users u ON u.id = p.owner_id
      WHERE p.is_public = true
    `;
    const params: any[] = [];

    if (search) {
      query += ` AND (p.name ILIKE $1 OR p.description ILIKE $1 OR u.email ILIKE $1)`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY p.created_at DESC LIMIT 50`;

    const res = await db.query(query, params);

    return NextResponse.json({ projects: res.rows });
  } catch (error) {
    console.error("Community API Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
