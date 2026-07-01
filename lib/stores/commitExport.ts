// ═══════════════════════════════════════════════════════════════
// Commit / Export from the figma editor.
//
// The spine: both build the AppSchema from the CURRENT figma design
// (buildAppSchemaFromFigma) and send it as `runtimeSchema`, so what you
// preview is exactly what gets committed (→ live runtime) and exported
// (→ standalone ZIP). Canvas `nodes` are omitted — the schema-driven
// exporter renders from the authored screens.
// ═══════════════════════════════════════════════════════════════

import { useFigmaStore } from './figmaStore';
import { buildAppSchemaFromFigma } from './figmaToRuntimeSchema';

// Only these targets use the schema-driven exporter (embeds the runtime engine
// so bindings/actions/data/auth work). Other frameworks emit static markup only.
export type ExportFramework = 'react' | 'nextjs' | 'react-native';
export const EXPORT_FRAMEWORKS: { value: ExportFramework; label: string }[] = [
  { value: 'react', label: 'React (Vite)' },
  { value: 'nextjs', label: 'Next.js' },
  { value: 'react-native', label: 'React Native' },
];

export interface CommitResult { ok: boolean; version?: number; error?: string; }

export async function commitProjectFromFigma(framework: ExportFramework = 'react', message?: string): Promise<CommitResult> {
  const s = useFigmaStore.getState();
  if (!s.projectId) return { ok: false, error: 'Open a saved project first.' };
  if (!s.fileId) return { ok: false, error: 'Save the file first — it needs to be persisted before committing.' };
  const runtimeSchema = buildAppSchemaFromFigma(s.projectId);
  if (!runtimeSchema.screens.length) return { ok: false, error: 'Add at least one frame (a screen) before committing.' };
  try {
    const res = await fetch('/api/commit', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: s.projectId,
        fileId: s.fileId,
        targetFramework: framework,
        fileName: s.fileName || 'app',
        nodes: [],
        interactions: [],
        runtimeSchema,
        message,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: json.error || `HTTP ${res.status}` };
    return { ok: true, version: json.version };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Commit failed' };
  }
}

export async function exportProjectFromFigma(framework: ExportFramework = 'react'): Promise<{ ok: boolean; error?: string }> {
  const s = useFigmaStore.getState();
  if (!s.projectId) return { ok: false, error: 'Open a saved project first.' };
  const runtimeSchema = buildAppSchemaFromFigma(s.projectId);
  if (!runtimeSchema.screens.length) return { ok: false, error: 'Add at least one frame (a screen) before exporting.' };
  const fileName = (s.fileName || 'app').replace(/\s+/g, '-').toLowerCase();
  try {
    const res = await fetch('/api/convert', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: framework, fileName, nodes: [], interactions: [], options: { projectId: s.projectId, runtimeSchema } }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return { ok: false, error: j.error || `HTTP ${res.status}` };
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}-${framework}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Export failed' };
  }
}
