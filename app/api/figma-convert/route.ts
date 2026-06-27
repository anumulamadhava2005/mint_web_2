// POST /api/figma-convert
// Converts Figma canvas state directly to framework code using figmaAdapter.
// Accepts either { projectId, framework } (loads from DB) or
// { snapshot, framework } (inline canvas data).

import { NextResponse } from 'next/server';
import { convertDesign, type TargetFramework } from '@/lib/convert';
import { figmaStoreToConversionRequest, type FigmaStoreSnapshot } from '@/lib/convert/adapters/figmaAdapter';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { framework, snapshot: inlineSnapshot, options = {} } = body as {
      framework: TargetFramework;
      snapshot?: FigmaStoreSnapshot;
      options?: Record<string, unknown>;
    };

    if (!framework) {
      return NextResponse.json({ success: false, error: 'framework is required' }, { status: 400 });
    }

    let snapshot: FigmaStoreSnapshot | null = inlineSnapshot ?? null;

    // If no inline snapshot, try to load from DB via the figma-file API
    if (!snapshot && body.projectId) {
      try {
        const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const res = await fetch(`${origin}/api/figma-file?projectId=${body.projectId}`, {
          headers: { cookie: request.headers.get('cookie') ?? '' },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.pages && data.layers) {
            snapshot = {
              fileName: data.fileName ?? 'design-export',
              pages: data.pages,
              layers: data.layers,
              activePageId: data.pages?.[0]?.id ?? '',
            };
          }
        }
      } catch {
        // fall through to error below
      }
    }

    if (!snapshot) {
      return NextResponse.json({ success: false, error: 'No canvas data. Provide snapshot or projectId.' }, { status: 400 });
    }

    const conversionRequest = figmaStoreToConversionRequest(snapshot, framework, options as any);

    if (conversionRequest.nodes.length === 0) {
      return NextResponse.json({ success: false, error: 'No frames found on the active page.' }, { status: 400 });
    }

    const result = await convertDesign(conversionRequest);

    if (!result.success) {
      return NextResponse.json({ success: false, errors: result.errors }, { status: 500 });
    }

    // Return file list as JSON (caller can ZIP if needed)
    const files = result.files.map(f => ({
      path: f.path,
      type: f.type,
      content: f.type === 'text' ? f.content : null, // skip binary in JSON response
    }));

    return NextResponse.json({
      success: true,
      files,
      warnings: result.warnings,
      usedSchemaRuntime: result.usedSchemaRuntime,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
