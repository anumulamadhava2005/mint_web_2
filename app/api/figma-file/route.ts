import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { findUserByToken } from '@/lib/auth';
import db from '@/lib/db';
import { cacheGet, cacheSet } from '@/lib/cache';

// Pending canvas writes are cached here until flushed to DB every 5 minutes
const PENDING_KEY = (projectId: string) => `figma:pending:${projectId}`;
// 15-minute TTL — well beyond the 5-minute flush interval
const CANVAS_CACHE_TTL = 900;

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

    // Always fetch project name first so we can use it as a fallback
    const projRes = await db.query(
      `SELECT name FROM projects WHERE id = $1 AND (owner_id = $2 OR is_public = true OR $3 = 'admin')`,
      [projectId, user.id, user.role]
    );
    if (projRes.rows.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    const projectName: string = projRes.rows[0].name;

    const result = await db.query(
      `SELECT f.id, f.name, f.data, f.revn
       FROM files f
       WHERE f.project_id = $1
         AND f.deleted_at IS NULL
         AND 'figma-canvas' = ANY(f.features)
       ORDER BY f.modified_at DESC
       LIMIT 1`,
      [projectId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ fileId: null, projectName });
    }

    const row = result.rows[0];
    const figmaData = row.data ?? {};
    // row.name is the stored file name; fall back to projectName if blank
    const fileName: string = row.name || projectName;
    return NextResponse.json({ fileId: row.id, fileName, projectName, ...figmaData });
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
    const { projectId, fileId, pages, layers, components, colorStyles, textStyles, effectStyles, fileName, apiSources, globalStateVars, actionFlows, database, auth, navigation, appWorkflows } = body;

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
      apiSources: apiSources ?? [],
      globalStateVars: globalStateVars ?? [],
      actionFlows: actionFlows ?? [],
      database: database ?? { provider: 'mint', tables: [] },
      auth: auth ?? null,
      navigation: navigation ?? null,
      appWorkflows: appWorkflows ?? [],
    };

    const displayName = fileName || 'Untitled';

    let savedFileId: string;

    if (fileId) {
      // Write to Redis immediately; flush to DB happens every 5 minutes via /api/figma-flush
      const pendingKey = PENDING_KEY(projectId);
      await cacheSet(pendingKey, { fileId, projectId, figmaData, displayName }, CANVAS_CACHE_TTL);
      // Check if cache write succeeded (Redis may be down — cacheSet is non-throwing but a
      // subsequent cacheGet will return null when Redis is unavailable)
      const written = await cacheGet<unknown>(pendingKey);
      if (written !== null) {
        return NextResponse.json({ fileId, ok: true });
      }
      // Redis unavailable — fall through to direct DB write
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
