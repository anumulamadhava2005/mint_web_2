import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { findUserByToken } from '@/lib/auth';
import db from '@/lib/db';
import { cacheGet, cacheInvalidate } from '@/lib/cache';

interface PendingCanvas {
  fileId: string;
  projectId: string;
  figmaData: Record<string, unknown>;
  displayName: string;
}

// POST /api/figma-flush?projectId=xxx
// Reads the Redis-cached canvas state and flushes it to PostgreSQL.
// Called by the client every 5 minutes to durably persist cached saves.
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await findUserByToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const projectId = req.nextUrl.searchParams.get('projectId');
    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

    // Verify project access
    const projRes = await db.query(
      `SELECT id FROM projects WHERE id = $1 AND (owner_id = $2 OR allow_public_edit = true OR $3 = 'admin')`,
      [projectId, user.id, user.role]
    );
    if (projRes.rows.length === 0) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 403 });
    }

    const pendingKey = `figma:pending:${projectId}`;
    const pending = await cacheGet<PendingCanvas>(pendingKey);

    if (!pending) {
      // Nothing pending — already flushed or Redis is down
      return NextResponse.json({ ok: true, flushed: false });
    }

    const { fileId, figmaData, displayName } = pending;

    const updateRes = await db.query(
      `UPDATE files
       SET data = $1, name = $2, revn = revn + 1, modified_at = now()
       WHERE id = $3 AND project_id = $4 AND 'figma-canvas' = ANY(features) AND deleted_at IS NULL
       RETURNING id`,
      [JSON.stringify(figmaData), displayName, fileId, projectId]
    );

    if (updateRes.rows.length === 0) {
      return NextResponse.json({ error: 'File not found during flush' }, { status: 404 });
    }

    // Clear pending cache after successful DB write
    await cacheInvalidate(pendingKey);

    return NextResponse.json({ ok: true, flushed: true });
  } catch (e) {
    console.error('POST /api/figma-flush error:', e);
    return NextResponse.json({ error: 'Flush failed' }, { status: 500 });
  }
}
