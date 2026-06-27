import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { findUserByToken } from '@/lib/auth';
import db from '@/lib/db';

// GET /api/figma-file?projectId=xxx
// Returns the figma canvas state for a project (stored in the files table)
export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await findUserByToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const projectId = req.nextUrl.searchParams.get('projectId');
    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

    const result = await db.query(
      `SELECT f.id, f.name, f.data, f.revn
       FROM files f
       JOIN projects p ON f.project_id = p.id
       WHERE f.project_id = $1
         AND f.deleted_at IS NULL
         AND 'figma-canvas' = ANY(f.features)
         AND (p.owner_id = $2 OR p.is_public = true OR $3 = 'admin')
       ORDER BY f.modified_at DESC
       LIMIT 1`,
      [projectId, user.id, user.role]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ fileId: null });
    }

    const row = result.rows[0];
    const figmaData = row.data ?? {};
    return NextResponse.json({ fileId: row.id, fileName: row.name, ...figmaData });
  } catch (e) {
    console.error('GET /api/figma-file error:', e);
    return NextResponse.json({ error: 'Load failed' }, { status: 500 });
  }
}

// POST /api/figma-file
// Upserts figma canvas state into the files table (feature-flagged as 'figma-canvas')
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await findUserByToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { projectId, fileId, pages, layers, components, colorStyles, textStyles, effectStyles, fileName } = body;

    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

    // Verify project access
    const projRes = await db.query(
      `SELECT id FROM projects WHERE id = $1 AND (owner_id = $2 OR allow_public_edit = true OR $3 = 'admin')`,
      [projectId, user.id, user.role]
    );
    if (projRes.rows.length === 0) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 403 });
    }

    const figmaData = {
      version: 1,
      pages: pages ?? [],
      layers: layers ?? {},
      components: components ?? {},
      colorStyles: colorStyles ?? [],
      textStyles: textStyles ?? [],
      effectStyles: effectStyles ?? [],
    };

    const displayName = fileName || 'Untitled';

    let savedFileId: string;

    if (fileId) {
      // Update existing — bump revn and write data
      const updateRes = await db.query(
        `UPDATE files
         SET data = $1, name = $2, revn = revn + 1, modified_at = now()
         WHERE id = $3 AND project_id = $4 AND 'figma-canvas' = ANY(features) AND deleted_at IS NULL
         RETURNING id`,
        [JSON.stringify(figmaData), displayName, fileId, projectId]
      );
      if (updateRes.rows.length === 0) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }
      savedFileId = updateRes.rows[0].id;
    } else {
      // Insert new figma-canvas file
      const insertRes = await db.query(
        `INSERT INTO files (project_id, name, data, revn, features)
         VALUES ($1, $2, $3, 0, '{figma-canvas}')
         RETURNING id`,
        [projectId, displayName, JSON.stringify(figmaData)]
      );
      savedFileId = insertRes.rows[0].id;
    }

    return NextResponse.json({ fileId: savedFileId, ok: true });
  } catch (e) {
    console.error('POST /api/figma-file error:', e);
    return NextResponse.json({ error: 'Save failed' }, { status: 500 });
  }
}
