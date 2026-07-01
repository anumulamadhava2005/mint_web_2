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

export type ClickActionKind = 'none' | 'signUp' | 'signIn' | 'signOut' | 'create' | 'update' | 'delete';
export interface ScreenOption { name: string; route: string }
const CRUD_KINDS: ClickActionKind[] = ['create', 'update', 'delete'];

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

const STEP_TO_KIND: Record<string, ClickActionKind> = {
  signUp: 'signUp', signIn: 'signIn', signOut: 'signOut',
  dbInsert: 'create', dbUpdate: 'update', dbDelete: 'delete',
};

/** Read the current click action wired to a layer (via its onClick action flow). */
function currentClickAction(layer: WorldLayer | undefined, flows: ActionFlow[]): { kind: ClickActionKind; navigateTo?: string; table?: string } {
  const flowId = layer?.layerEvents?.onClick?.[0];
  const flow = flowId ? flows.find(f => f.id === flowId) : undefined;
  if (!flow) return { kind: 'none' };
  const primary = flow.steps.find(s => STEP_TO_KIND[s.type]);
  const nav = flow.steps.find(s => s.type === 'navigate');
  return { kind: primary ? STEP_TO_KIND[primary.type] : 'none', navigateTo: nav?.navigateTo, table: primary?.dbTable };
}

const ACTION_LABELS: Record<ClickActionKind, string> = {
  none: 'No action', signUp: 'Sign up', signIn: 'Log in', signOut: 'Sign out',
  create: 'Create record', update: 'Update record', delete: 'Delete record',
};

export default function CanvasBindingOverlay({
  layersWorld, selection, viewport, designMode, screens, actionFlows, tables, screenIds,
  onSetInputType, onBindValue, onSetClickAction, onRemoveStep, onAddStepToFlow, onEditText, onBindText, onSetDataSource, onToggleRequiresAuth,
}: {
  layersWorld: WorldLayer[];
  selection: string[];
  viewport: Viewport;
  designMode: boolean;
  screens: ScreenOption[];
  actionFlows: ActionFlow[];
  tables: string[];
  screenIds: string[];
  onSetInputType: (layerId: string, type: InputFieldType, placeholder: string) => void;
  onBindValue: (layerId: string, anchor: DOMRect) => void;
  onSetClickAction: (layerId: string, kind: ClickActionKind, opts?: { navigateTo?: string; table?: string }) => void;
  onRemoveStep: (layerId: string, flowId: string, stepId: string) => void;
  onAddStepToFlow: (layerId: string, flowId: string) => void;
  onEditText: (layerId: string) => void;
  onBindText: (layerId: string, anchor: DOMRect) => void;
  onSetDataSource: (layerId: string, table: string | null) => void;
  onToggleRequiresAuth: (layerId: string, value: boolean) => void;
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
            {/* Screen frames: require an authenticated user to view */}
            {screenIds.includes(selectedClickable.id) && (
              <>
                <button
                  onClick={e => { e.stopPropagation(); onToggleRequiresAuth(selectedClickable.id, !selectedClickable.requiresAuth); }}
                  title="Redirect to login when no user is signed in"
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 4,
                    border: `1px solid ${selectedClickable.requiresAuth ? 'rgba(13,153,255,0.6)' : '#3c3c3c'}`,
                    background: selectedClickable.requiresAuth ? 'rgba(13,153,255,0.15)' : '#2a2a2a',
                    color: selectedClickable.requiresAuth ? '#5cb3ff' : '#ebebeb', fontSize: 11, cursor: 'pointer' }}>
                  {selectedClickable.requiresAuth ? '🔒' : '🔓'} Requires login
                </button>
                <div style={{ width: 1, height: 18, background: '#3c3c3c', margin: '0 2px' }} />
              </>
            )}
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
            {/* Multi-step chain: show each step as a pill */}
            {(() => {
              const flowId = selectedClickable.layerEvents?.onClick?.[0];
              const flow = flowId ? actionFlows.find(f => f.id === flowId) : undefined;
              const steps = flow?.steps ?? [];

              if (steps.length === 0) {
                // No steps yet — show the legacy single-action dropdown
                return (
                  <>
                    <select
                      value={clickAction.kind}
                      onChange={e => onSetClickAction(selectedClickable.id, e.target.value as ClickActionKind, { navigateTo: clickAction.navigateTo, table: clickAction.table })}
                      style={{ background: '#0d0d0d', border: '1px solid #333', borderRadius: 4, color: '#ebebeb', fontSize: 11, padding: '3px 6px', outline: 'none', cursor: 'pointer' }}>
                      {(Object.keys(ACTION_LABELS) as ClickActionKind[]).map(k => (
                        <option key={k} value={k}>{ACTION_LABELS[k]}</option>
                      ))}
                    </select>
                    {CRUD_KINDS.includes(clickAction.kind) && (
                      <select
                        value={clickAction.table ?? ''}
                        onChange={e => onSetClickAction(selectedClickable.id, clickAction.kind, { navigateTo: clickAction.navigateTo, table: e.target.value || undefined })}
                        style={{ background: '#0d0d0d', border: '1px solid #333', borderRadius: 4, color: '#ebebeb', fontSize: 11, padding: '3px 6px', outline: 'none', cursor: 'pointer' }}>
                        <option value="">— table —</option>
                        {tables.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    )}
                    {clickAction.kind !== 'none' && screens.length > 0 && (
                      <>
                        <span style={{ fontSize: 10, color: '#888' }}>then go to</span>
                        <select
                          value={clickAction.navigateTo ?? ''}
                          onChange={e => onSetClickAction(selectedClickable.id, clickAction.kind, { navigateTo: e.target.value || undefined, table: clickAction.table })}
                          style={{ background: '#0d0d0d', border: '1px solid #333', borderRadius: 4, color: '#ebebeb', fontSize: 11, padding: '3px 6px', outline: 'none', cursor: 'pointer' }}>
                          <option value="">— stay —</option>
                          {screens.map(s => <option key={s.route} value={s.route}>{s.name}</option>)}
                        </select>
                      </>
                    )}
                  </>
                );
              }

              // Multi-step mode: render each step as a compact pill
              const PILL_COLORS: Record<string, string> = {
                navigate: '#0d99ff', goBack: '#0d99ff', openModal: '#0d99ff', closeModal: '#0d99ff',
                setState: '#7b61ff', updateState: '#7b61ff', resetState: '#7b61ff',
                fetch: '#00c864', mutate: '#00c864',
                dbInsert: '#00c864', dbUpdate: '#00c864', dbDelete: '#ff4444',
                toast: '#ff9500', alert: '#ff9500', condition: '#f72585', delay: '#888',
                custom: '#ebebeb', signUp: '#00c864', signIn: '#00c864', signOut: '#ff4444',
              };
              const PILL_LABELS: Record<string, string> = {
                navigate: 'Nav', goBack: 'Back', signUp: 'Sign up', signIn: 'Log in', signOut: 'Sign out',
                dbInsert: 'Create', dbUpdate: 'Update', dbDelete: 'Delete',
                setState: 'Set', toast: 'Toast', delay: 'Wait', condition: 'If', custom: 'Code',
                fetch: 'Fetch', mutate: 'Mutate', updateState: 'Upd', resetState: 'Reset',
                openModal: 'Modal', closeModal: 'Close', alert: 'Alert',
              };
              return (
                <>
                  {steps.map((s, i) => {
                    const c = PILL_COLORS[s.type] ?? '#888';
                    const label = PILL_LABELS[s.type] ?? s.type;
                    const detail = s.dbTable ? `:${s.dbTable}` : s.navigateTo ? `:${s.navigateTo}` : '';
                    return (
                      <React.Fragment key={s.id}>
                        {i > 0 && <span style={{ fontSize: 10, color: '#555' }}>→</span>}
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                          background: c + '18', border: `1px solid ${c}40`, borderRadius: 4,
                          padding: '2px 6px', fontSize: 10, color: c, fontWeight: 600, whiteSpace: 'nowrap',
                        }}>
                          {label}{detail && <span style={{ fontWeight: 400, opacity: 0.8 }}>{detail}</span>}
                          <span
                            onClick={e => { e.stopPropagation(); onRemoveStep(selectedClickable.id, flow!.id, s.id); }}
                            style={{ cursor: 'pointer', opacity: 0.6, marginLeft: 2 }}
                            onMouseEnter={e => { (e.currentTarget as HTMLSpanElement).style.opacity = '1'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLSpanElement).style.opacity = '0.6'; }}
                          >×</span>
                        </span>
                      </React.Fragment>
                    );
                  })}
                  <button
                    onClick={e => { e.stopPropagation(); onAddStepToFlow(selectedClickable.id, flow!.id); }}
                    style={{
                      background: 'none', border: '1px dashed #333', borderRadius: 4,
                      color: '#888', fontSize: 10, padding: '2px 6px', cursor: 'pointer',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#0d99ff'; (e.currentTarget as HTMLButtonElement).style.color = '#0d99ff'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#333'; (e.currentTarget as HTMLButtonElement).style.color = '#888'; }}
                  >+</button>
                </>
              );
            })()}
          </div>
        );
      })()}
    </div>
  );
}
