"use client";

// ═══════════════════════════════════════════════════════════════
// CanvasBindingOverlay — canvas-native data affordances.
//
//  • Binding badges: a small ⚡ chip on any layer that has a data
//    binding, so bound elements are visible at a glance.
//  • Input config chip: when a single input is selected, a floating
//    control (anchored to the field, NOT the right panel) to switch
//    the field type and rebind its value variable.
//
// All overlays are screen-space; world→screen uses the viewport.
// ═══════════════════════════════════════════════════════════════

import React from 'react';
import { Zap, MousePointerClick, Pencil, Rows3 } from 'lucide-react';
import type { ActionFlow, FigmaLayer, InputFieldType, Viewport } from '@/lib/stores/figmaStore';

type WorldLayer = FigmaLayer & { wx: number; wy: number };

export type ClickActionKind = 'none' | 'signUp' | 'signIn' | 'signOut';
export interface ScreenOption { name: string; route: string }

const INPUT_TYPES: InputFieldType[] = ['text', 'email', 'password', 'number', 'tel', 'url', 'textarea', 'date', 'checkbox'];

const PLACEHOLDER_FOR: Partial<Record<InputFieldType, string>> = {
  text: 'Enter text…', email: 'you@example.com', password: 'Password',
  number: '0', tel: '+1 555 000 0000', url: 'https://…', textarea: 'Write something…', date: '',
};

/** Strip the leading $ for display: "$form.email" → "form.email". */
function varLabel(expr?: string): string | null {
  if (!expr) return null;
  const m = expr.trim().match(/^\$([A-Za-z_][A-Za-z0-9_.]*)$/);
  return m ? m[1] : expr.trim();
}

/** Read the current click action wired to a layer (via its onClick action flow). */
function currentClickAction(layer: WorldLayer | undefined, flows: ActionFlow[]): { kind: ClickActionKind; navigateTo?: string } {
  const flowId = layer?.layerEvents?.onClick?.[0];
  const flow = flowId ? flows.find(f => f.id === flowId) : undefined;
  if (!flow) return { kind: 'none' };
  const auth = flow.steps.find(s => s.type === 'signUp' || s.type === 'signIn' || s.type === 'signOut');
  const nav = flow.steps.find(s => s.type === 'navigate');
  return { kind: (auth?.type as ClickActionKind) ?? 'none', navigateTo: nav?.navigateTo };
}

const ACTION_LABELS: Record<ClickActionKind, string> = {
  none: 'No action', signUp: 'Sign up', signIn: 'Log in', signOut: 'Sign out',
};

export default function CanvasBindingOverlay({
  layersWorld, selection, viewport, designMode, screens, actionFlows, tables,
  onSetInputType, onBindValue, onSetClickAction, onEditText, onBindText, onSetDataSource,
}: {
  layersWorld: WorldLayer[];
  selection: string[];
  viewport: Viewport;
  designMode: boolean;
  screens: ScreenOption[];
  actionFlows: ActionFlow[];
  tables: string[];
  onSetInputType: (layerId: string, type: InputFieldType, placeholder: string) => void;
  onBindValue: (layerId: string, anchor: DOMRect) => void;
  onSetClickAction: (layerId: string, kind: ClickActionKind, navigateTo?: string) => void;
  onEditText: (layerId: string) => void;
  onBindText: (layerId: string, anchor: DOMRect) => void;
  onSetDataSource: (layerId: string, table: string | null) => void;
}) {
  if (!designMode) return null;
  const z = viewport.zoom;

  const sole = selection.length === 1 ? layersWorld.find(l => l.id === selection[0]) : undefined;
  // Single selected input → config chip.
  const selectedInput = sole?.type === 'input' ? sole : undefined;
  // Single selected non-input, non-screen layer → click-action chip.
  const selectedClickable = sole && sole.type !== 'input' && sole.type !== 'section' ? sole : undefined;
  const clickAction = currentClickAction(selectedClickable, actionFlows);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 23 }}>
      {/* Binding badges */}
      {layersWorld.map(l => {
        const bound = l.bindings && Object.keys(l.bindings).length > 0;
        if (!bound || l.id === selectedInput?.id) return null;
        const sx = l.wx * z + viewport.x;
        const sy = l.wy * z + viewport.y;
        return (
          <div key={l.id} style={{
            position: 'absolute', left: sx, top: sy - 16, height: 14,
            display: 'flex', alignItems: 'center', gap: 3, padding: '0 5px',
            background: 'rgba(13,153,255,0.16)', border: '1px solid rgba(13,153,255,0.5)',
            borderRadius: 3, color: '#5cb3ff', fontSize: 9, fontFamily: 'monospace',
            whiteSpace: 'nowrap', pointerEvents: 'none',
          }}>
            <Zap size={8} fill="#5cb3ff" />
            {varLabel(l.bindings?.value ?? l.bindings?.text) ?? 'bound'}
          </div>
        );
      })}

      {/* Input config chip */}
      {selectedInput && (() => {
        const sx = selectedInput.wx * z + viewport.x;
        const sy = (selectedInput.wy + selectedInput.height) * z + viewport.y;
        const valueVar = varLabel(selectedInput.bindings?.value);
        return (
          <div style={{
            position: 'absolute', left: sx, top: sy + 8,
            display: 'flex', alignItems: 'center', gap: 6, padding: 4,
            background: '#1e1e1e', border: '1px solid #3c3c3c', borderRadius: 7,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)', pointerEvents: 'all',
          }}
          onMouseDown={e => e.stopPropagation()}>
            <select
              value={selectedInput.inputType ?? 'text'}
              onChange={e => {
                const t = e.target.value as InputFieldType;
                onSetInputType(selectedInput.id, t, PLACEHOLDER_FOR[t] ?? '');
              }}
              style={{
                background: '#0d0d0d', border: '1px solid #333', borderRadius: 4,
                color: '#ebebeb', fontSize: 11, padding: '3px 6px', outline: 'none', cursor: 'pointer',
              }}>
              {INPUT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button
              onClick={e => {
                e.stopPropagation();
                onBindValue(selectedInput.id, (e.currentTarget as HTMLElement).getBoundingClientRect());
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 4,
                border: '1px solid rgba(13,153,255,0.5)', background: 'rgba(13,153,255,0.12)',
                color: '#5cb3ff', fontSize: 11, fontFamily: 'monospace', cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
              <Zap size={10} fill="#5cb3ff" />
              {valueVar ?? 'bind value'}
            </button>
          </div>
        );
      })()}

      {/* Click-action chip — wire onClick to a real action (e.g. Sign up) */}
      {selectedClickable && (() => {
        const sx = selectedClickable.wx * z + viewport.x;
        const sy = (selectedClickable.wy + selectedClickable.height) * z + viewport.y;
        return (
          <div style={{
            position: 'absolute', left: sx, top: sy + 8,
            display: 'flex', alignItems: 'center', gap: 6, padding: 4,
            background: '#1e1e1e', border: '1px solid #3c3c3c', borderRadius: 7,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)', pointerEvents: 'all',
          }}
          onMouseDown={e => e.stopPropagation()}>
            {/* Container layers: bind to a DB table → live repeating list */}
            {(selectedClickable.type === 'frame' || selectedClickable.type === 'group') && (
              <>
                <Rows3 size={12} style={{ color: '#9a9a9a', marginLeft: 2 }} />
                <span style={{ fontSize: 10, color: '#888' }}>Repeat</span>
                <select
                  value={selectedClickable.dataSource?.table ?? ''}
                  onChange={e => onSetDataSource(selectedClickable.id, e.target.value || null)}
                  style={{ background: '#0d0d0d', border: '1px solid #333', borderRadius: 4, color: '#ebebeb', fontSize: 11, padding: '3px 6px', outline: 'none', cursor: 'pointer' }}>
                  <option value="">— no data —</option>
                  {tables.map(t => <option key={t} value={t}>each {t} row</option>)}
                </select>
                <div style={{ width: 1, height: 18, background: '#3c3c3c', margin: '0 2px' }} />
              </>
            )}
            {/* Text layers: edit the label + bind it to data (the @ path, one click) */}
            {selectedClickable.type === 'text' && (
              <>
                <button
                  onClick={e => { e.stopPropagation(); onEditText(selectedClickable.id); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 4, border: '1px solid #3c3c3c', background: '#2a2a2a', color: '#ebebeb', fontSize: 11, cursor: 'pointer' }}>
                  <Pencil size={10} /> Edit
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onBindText(selectedClickable.id, (e.currentTarget as HTMLElement).getBoundingClientRect()); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 4, border: '1px solid rgba(13,153,255,0.5)', background: 'rgba(13,153,255,0.12)', color: '#5cb3ff', fontSize: 11, fontFamily: 'monospace', cursor: 'pointer' }}>
                  <Zap size={10} fill="#5cb3ff" /> {varLabel(selectedClickable.bindings?.text) ?? 'Bind'}
                </button>
                <div style={{ width: 1, height: 18, background: '#3c3c3c', margin: '0 2px' }} />
              </>
            )}
            <MousePointerClick size={12} style={{ color: '#9a9a9a', marginLeft: 2 }} />
            <span style={{ fontSize: 10, color: '#888' }}>On click</span>
            <select
              value={clickAction.kind}
              onChange={e => onSetClickAction(selectedClickable.id, e.target.value as ClickActionKind, clickAction.navigateTo)}
              style={{ background: '#0d0d0d', border: '1px solid #333', borderRadius: 4, color: '#ebebeb', fontSize: 11, padding: '3px 6px', outline: 'none', cursor: 'pointer' }}>
              {(Object.keys(ACTION_LABELS) as ClickActionKind[]).map(k => (
                <option key={k} value={k}>{ACTION_LABELS[k]}</option>
              ))}
            </select>
            {clickAction.kind !== 'none' && screens.length > 0 && (
              <>
                <span style={{ fontSize: 10, color: '#888' }}>then go to</span>
                <select
                  value={clickAction.navigateTo ?? ''}
                  onChange={e => onSetClickAction(selectedClickable.id, clickAction.kind, e.target.value || undefined)}
                  style={{ background: '#0d0d0d', border: '1px solid #333', borderRadius: 4, color: '#ebebeb', fontSize: 11, padding: '3px 6px', outline: 'none', cursor: 'pointer' }}>
                  <option value="">— stay —</option>
                  {screens.map(s => <option key={s.route} value={s.route}>{s.name}</option>)}
                </select>
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
}
