"use client";

// ═══════════════════════════════════════════════════════════════
// RuntimeEditorPreview — live, data-driven preview inside the editor.
//
// Unlike the prototype preview (which replays Figma interactions), this
// builds a real runtime AppSchema from the editor state and mounts the
// production runtime (RuntimeProvider + SchemaRenderer). Inputs are two-way
// bound, buttons dispatch real actions (incl. signUp → the live DB), and
// bound text reflects state — the full app loop.
//
// A console at the bottom shows every action dispatched, DB query + rows,
// navigation, and errors — observed via ActionRegistry middleware + previewLog.
// ═══════════════════════════════════════════════════════════════

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { X, Play, Terminal, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { buildAppSchemaFromFigma } from '@/lib/stores/figmaToRuntimeSchema';
import { RuntimeProvider, useRuntime } from '@/components/runtime/RuntimeProvider';
import SchemaRenderer from '@/components/SchemaRenderer';
import type { ScreenSchema } from '@/lib/runtime/schema';
import { previewLog, type LogEntry, type LogLevel } from '@/lib/runtime/previewLog';

function summarizeResult(type: string, result: unknown): string | undefined {
  if (type === 'signUp' || type === 'signIn') {
    const u = (result as { user?: { email?: string; username?: string; id?: string } })?.user;
    if (u) return `user: ${u.email ?? u.username ?? u.id}`;
  }
  return undefined;
}

// Installs action-logging middleware once per runtime and logs each dispatch.
// dbQuery self-logs (SQL + row count) so we skip it here to avoid duplication.
function RuntimeLogger() {
  const rt = useRuntime();
  const installedFor = useRef<unknown>(null);
  useEffect(() => {
    if (!rt || installedFor.current === rt.actionRegistry) return;
    installedFor.current = rt.actionRegistry;
    rt.actionRegistry.use(async (schema, _ctx, next) => {
      if (schema.type === 'dbQuery') return next();
      const label = schema.name && schema.name !== schema.type ? `${schema.type} · ${schema.name}` : schema.type;
      previewLog.push('info', 'action', `▶ ${label}`);
      try {
        const r = await next();
        previewLog.push('success', 'action', `✓ ${label}`, summarizeResult(schema.type, r));
        return r;
      } catch (e) {
        previewLog.push('error', 'action', `✗ ${label}: ${e instanceof Error ? e.message : String(e)}`);
        throw e;
      }
    });
  }, [rt]);
  return null;
}

// Renders a screen and fires its onMount actions (e.g. dbQuery loads) when the
// screen becomes active — the runtime provider itself doesn't auto-run onMount.
function ScreenStage({ screen, projectId, loginRoute, onRedirect }: { screen: ScreenSchema; projectId?: string; loginRoute?: string; onRedirect?: (route: string) => void }) {
  const runtime = useRuntime();
  useEffect(() => {
    // Protected screen: redirect to login when there's no authenticated user.
    if (screen.requiresAuth && runtime && loginRoute && screen.route !== loginRoute) {
      const user = runtime.state.get('user') as { id?: unknown } | null;
      if (!user || !user.id) {
        previewLog.push('info', 'screen', `"${screen.name}" requires login → ${loginRoute}`);
        onRedirect?.(loginRoute);
        return;
      }
    }
    previewLog.push('info', 'screen', `mounted "${screen.name}"`);
    if (runtime && screen.onMount?.length) void runtime.dispatch(screen.onMount);
  }, [runtime, screen.id, screen.onMount, screen.name, screen.requiresAuth, screen.route, loginRoute, onRedirect]);
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

const LEVEL_COLOR: Record<LogLevel, string> = {
  info: '#c9c9c9', success: '#7fdca4', error: '#ff9b8a', debug: '#7a7a7a',
};
const SOURCE_COLOR: Record<string, string> = {
  action: '#0d99ff', db: '#00c864', nav: '#7b61ff', screen: '#ff9500', preview: '#888', state: '#f72585',
};

function fmtTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

function PreviewConsole() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [open, setOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => previewLog.subscribe(setEntries), []);
  useEffect(() => {
    const el = scrollRef.current;
    if (el && open) el.scrollTop = el.scrollHeight;
  }, [entries, open]);

  const errors = entries.filter(e => e.level === 'error').length;

  return (
    <div style={{
      flexShrink: 0, borderTop: '1px solid #3c3c3c', background: '#141414', color: '#ebebeb',
      display: 'flex', flexDirection: 'column', height: open ? 190 : 32,
    }}>
      <div style={{ height: 32, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', borderBottom: open ? '1px solid #2a2a2a' : 'none' }}>
        <Terminal size={12} style={{ color: '#0d99ff' }} />
        <span style={{ fontSize: 11, fontWeight: 700 }}>Console</span>
        <span style={{ fontSize: 10, color: '#777' }}>{entries.length} event{entries.length !== 1 ? 's' : ''}</span>
        {errors > 0 && <span style={{ fontSize: 10, color: '#ff9b8a' }}>· {errors} error{errors !== 1 ? 's' : ''}</span>}
        <div style={{ flex: 1 }} />
        <button onClick={() => previewLog.clear()} title="Clear"
          style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: '#888', fontSize: 10, cursor: 'pointer' }}>
          <Trash2 size={12} /> Clear
        </button>
        <button onClick={() => setOpen(o => !o)} title={open ? 'Collapse' : 'Expand'}
          style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
          {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>
      {open && (
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '6px 0', fontFamily: 'monospace', fontSize: 11, lineHeight: 1.6 }}>
          {entries.length === 0 ? (
            <div style={{ padding: '8px 12px', color: '#666' }}>No activity yet — interact with the preview (sign up, load a list, navigate).</div>
          ) : entries.map(e => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '1px 12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              <span style={{ color: '#555', flexShrink: 0 }}>{fmtTime(e.ts)}</span>
              <span style={{ color: SOURCE_COLOR[e.source] ?? '#888', flexShrink: 0, minWidth: 46 }}>{e.source}</span>
              <span style={{ color: LEVEL_COLOR[e.level], flex: 1 }}>
                {e.message}
                {e.detail && <span style={{ color: '#6a6a6a' }}>{'  '}{e.detail}</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RuntimeEditorPreview({ projectId, onClose }: { projectId?: string; onClose: () => void }) {
  // Snapshot the schema once when the preview opens.
  const schema = useMemo(() => buildAppSchemaFromFigma(projectId ?? 'local'), [projectId]);
  const [route, setRoute] = useState(schema.navigation.initialRoute);

  useEffect(() => {
    previewLog.clear();
    previewLog.push('info', 'preview', `started · ${schema.screens.length} screen(s), ${schema.globalActions.length} action(s)`);
  }, [schema]);

  const activeScreen = schema.screens.find(s => s.route === route) ?? schema.screens[0];

  const navigate = (r: string) => { previewLog.push('info', 'nav', `→ ${r}`); setRoute(r); };

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
            onChange={e => navigate(e.target.value)}
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
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 24, minHeight: 0 }}>
        {!activeScreen ? (
          <div style={{ color: '#9a9a9a', fontSize: 13, marginTop: 80, textAlign: 'center' }}>
            Nothing to preview yet.<br />Draw a frame (a screen) and add some inputs.
          </div>
        ) : (
          <RuntimeProvider schema={schema} onNavigate={navigate} onBack={() => navigate(schema.navigation.initialRoute)}>
            <RuntimeLogger />
            <ScreenStage key={activeScreen.id} screen={activeScreen} projectId={projectId} loginRoute={schema.navigation.loginRoute} onRedirect={navigate} />
          </RuntimeProvider>
        )}
      </div>

      {/* Runtime console */}
      <PreviewConsole />
    </div>
  );
}
