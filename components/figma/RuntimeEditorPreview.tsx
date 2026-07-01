"use client";

// ═══════════════════════════════════════════════════════════════
// RuntimeEditorPreview — live, data-driven preview inside the editor.
//
// Unlike the prototype preview (which replays Figma interactions), this
// builds a real runtime AppSchema from the editor state and mounts the
// production runtime (RuntimeProvider + SchemaRenderer). Inputs are two-way
// bound, buttons dispatch real actions (incl. signUp → the live DB), and
// bound text reflects state — the full app loop.
// ═══════════════════════════════════════════════════════════════

import React, { useMemo, useState, useEffect } from 'react';
import { X, Play } from 'lucide-react';
import { buildAppSchemaFromFigma } from '@/lib/stores/figmaToRuntimeSchema';
import { RuntimeProvider, useRuntime } from '@/components/runtime/RuntimeProvider';
import SchemaRenderer from '@/components/SchemaRenderer';
import type { ScreenSchema } from '@/lib/runtime/schema';

// Renders a screen and fires its onMount actions (e.g. dbQuery loads) when the
// screen becomes active — the runtime provider itself doesn't auto-run onMount.
function ScreenStage({ screen, projectId }: { screen: ScreenSchema; projectId?: string }) {
  const runtime = useRuntime();
  useEffect(() => {
    if (runtime && screen.onMount?.length) void runtime.dispatch(screen.onMount);
  }, [runtime, screen.id, screen.onMount]);
  return (
    <div style={{
      position: 'relative',
      width: screen.width ?? 390,
      minHeight: screen.height ?? 720,
      background: screen.backgroundColor ?? '#ffffff',
      boxShadow: '0 12px 48px rgba(0,0,0,0.5)', borderRadius: 8, overflow: 'hidden',
    }}>
      <SchemaRenderer components={screen.components} projectId={projectId} />
    </div>
  );
}

export default function RuntimeEditorPreview({ projectId, onClose }: { projectId?: string; onClose: () => void }) {
  // Snapshot the schema once when the preview opens.
  const schema = useMemo(() => buildAppSchemaFromFigma(projectId ?? 'local'), [projectId]);
  const [route, setRoute] = useState(schema.navigation.initialRoute);

  const activeScreen = schema.screens.find(s => s.route === route) ?? schema.screens[0];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(0,0,0,0.7)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '0 14px',
        background: '#1e1e1e', borderBottom: '1px solid #3c3c3c', color: '#ebebeb',
      }}>
        <Play size={13} style={{ color: '#0d99ff' }} />
        <span style={{ fontSize: 12, fontWeight: 700 }}>Live preview</span>
        <span style={{ fontSize: 10, color: '#888' }}>running the real runtime · data writes are live</span>
        <div style={{ flex: 1 }} />
        {schema.screens.length > 1 && (
          <select
            value={route}
            onChange={e => setRoute(e.target.value)}
            style={{ background: '#0d0d0d', border: '1px solid #333', borderRadius: 6, color: '#ebebeb', fontSize: 11, padding: '4px 8px', cursor: 'pointer' }}>
            {schema.screens.map(s => <option key={s.id} value={s.route}>{s.name}</option>)}
          </select>
        )}
        <button onClick={onClose} title="Close preview (Esc)"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer', color: '#ebebeb' }}>
          <X size={16} />
        </button>
      </div>

      {/* Stage */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 24 }}>
        {!activeScreen ? (
          <div style={{ color: '#9a9a9a', fontSize: 13, marginTop: 80, textAlign: 'center' }}>
            Nothing to preview yet.<br />Draw a frame (a screen) and add some inputs.
          </div>
        ) : (
          <RuntimeProvider schema={schema} onNavigate={(r) => setRoute(r)} onBack={() => setRoute(schema.navigation.initialRoute)}>
            <ScreenStage key={activeScreen.id} screen={activeScreen} projectId={projectId} />
          </RuntimeProvider>
        )}
      </div>
    </div>
  );
}
