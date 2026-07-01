"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useFigmaStore, type ActionFlow, type ActionStep, type ActionStepType } from '@/lib/stores/figmaStore';

const DARK = '#141414';
const PANEL = '#1e1e1e';
const BORDER = '#2a2a2a';
const TEXT = '#ebebeb';
const MUTED = '#888';
const ACCENT = '#0d99ff';

const STEP_COLORS: Record<ActionStepType, string> = {
  navigate: '#0d99ff', goBack: '#0d99ff', openModal: '#0d99ff', closeModal: '#0d99ff',
  setState: '#7b61ff', updateState: '#7b61ff', resetState: '#7b61ff',
  fetch: '#00c864', mutate: '#00c864',
  toast: '#ff9500', alert: '#ff9500',
  condition: '#f72585',
  delay: '#888',
  custom: '#ebebeb',
  signUp: '#00c864', signIn: '#00c864', signOut: '#ff4444',
};

const STEP_LABELS: Record<ActionStepType, string> = {
  navigate: 'Navigate', goBack: 'Go back', openModal: 'Open modal', closeModal: 'Close modal',
  setState: 'Set state', updateState: 'Update state', resetState: 'Reset state',
  fetch: 'Fetch API', mutate: 'Mutate API',
  toast: 'Show toast', alert: 'Show alert',
  condition: 'Condition (if/else)',
  delay: 'Delay',
  custom: 'Custom code',
  signUp: 'Sign up', signIn: 'Sign in', signOut: 'Sign out',
};

const STEP_GROUPS: { label: string; types: ActionStepType[] }[] = [
  { label: 'Navigation', types: ['navigate', 'goBack', 'openModal', 'closeModal'] },
  { label: 'State', types: ['setState', 'updateState', 'resetState'] },
  { label: 'Data', types: ['fetch', 'mutate'] },
  { label: 'UI', types: ['toast', 'alert'] },
  { label: 'Control flow', types: ['condition', 'delay'] },
  { label: 'Auth', types: ['signUp', 'signIn', 'signOut'] },
  { label: 'Advanced', types: ['custom'] },
];

// ── Step field editor ─────────────────────────────────────────────────────────

function StepFields({ step, flowId }: { step: ActionStep; flowId: string }) {
  const { updateActionStep, apiSources, pages } = useFigmaStore();
  const upd = (patch: Partial<ActionStep>) => updateActionStep(flowId, step.id, patch);

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#0d0d0d', border: `1px solid ${BORDER}`,
    borderRadius: 4, color: TEXT, fontSize: 11, padding: '5px 8px',
    outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif',
  };
  const monoInput: React.CSSProperties = { ...inputStyle, fontFamily: 'monospace' };

  const fieldLabel = (text: string) => (
    <div style={{ fontSize: 9, color: MUTED, marginBottom: 3, fontWeight: 600,
      textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{text}</div>
  );
  const row = (children: React.ReactNode) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{children}</div>
  );

  const screenNames = pages?.map((p: { name: string }) => p.name) ?? [];

  switch (step.type) {
    case 'navigate':
    case 'openModal':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {row(<>{fieldLabel('Target screen or URL')}
            <input value={step.navigateTo ?? ''} onChange={e => upd({ navigateTo: e.target.value })}
              placeholder="Screen name or https://…" style={monoInput} list={`screens-${step.id}`} />
            <datalist id={`screens-${step.id}`}>
              {screenNames.map((n: string) => <option key={n} value={n} />)}
            </datalist>
          </>)}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: MUTED, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!step.navigateReplace} onChange={e => upd({ navigateReplace: e.target.checked })} />
            Replace history (no back button)
          </label>
        </div>
      );

    case 'goBack':
    case 'closeModal':
    case 'signIn':
    case 'signOut':
      return <div style={{ fontSize: 11, color: '#555', marginTop: 8, fontStyle: 'italic' }}>No configuration needed.</div>;

    case 'setState':
    case 'updateState':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {row(<>{fieldLabel('State target (expression)')}
            <input value={step.stateTarget ?? ''} onChange={e => upd({ stateTarget: e.target.value })}
              placeholder="$global.count or $page.items" style={monoInput} />
          </>)}
          {row(<>{fieldLabel('New value (expression or JSON)')}
            <input value={step.stateValue ?? ''} onChange={e => upd({ stateValue: e.target.value })}
              placeholder='"hello" or $api.data.result or 42' style={monoInput} />
          </>)}
        </div>
      );

    case 'resetState':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {row(<>{fieldLabel('State target to reset')}
            <input value={step.stateTarget ?? ''} onChange={e => upd({ stateTarget: e.target.value })}
              placeholder="$global.count  (leave blank for all)" style={monoInput} />
          </>)}
        </div>
      );

    case 'fetch':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {row(<>{fieldLabel('API source')}
            <select value={step.apiSourceId ?? ''} onChange={e => upd({ apiSourceId: e.target.value })}
              style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="">— select an API source —</option>
              {apiSources.map(s => <option key={s.id} value={s.id}>{s.name} ({s.method} {s.url.slice(0, 40)})</option>)}
            </select>
          </>)}
          {row(<>{fieldLabel('Store result in (optional)')}
            <input value={step.apiResultBinding ?? ''} onChange={e => upd({ apiResultBinding: e.target.value })}
              placeholder="$global.users  (leave blank to discard)" style={monoInput} />
          </>)}
        </div>
      );

    case 'mutate':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {row(<>{fieldLabel('API source')}
            <select value={step.apiSourceId ?? ''} onChange={e => upd({ apiSourceId: e.target.value })}
              style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="">— select an API source —</option>
              {apiSources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </>)}
          {row(<>{fieldLabel('Request body (JSON, expressions allowed)')}
            <textarea value={step.apiBody ?? ''} onChange={e => upd({ apiBody: e.target.value })}
              placeholder={'{\n  "name": "$page.formName"\n}'} rows={4}
              style={{ ...monoInput, resize: 'vertical', fontSize: 10 }} />
          </>)}
          {row(<>{fieldLabel('Store result in (optional)')}
            <input value={step.apiResultBinding ?? ''} onChange={e => upd({ apiResultBinding: e.target.value })}
              placeholder="$global.newItem" style={monoInput} />
          </>)}
        </div>
      );

    case 'toast':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {row(<>{fieldLabel('Message (expression or string)')}
            <input value={step.toastMessage ?? ''} onChange={e => upd({ toastMessage: e.target.value })}
              placeholder='"Saved!" or "Error: " + $global.error' style={monoInput} />
          </>)}
          {row(<>{fieldLabel('Type')}
            <select value={step.toastType ?? 'info'} onChange={e => upd({ toastType: e.target.value as ActionStep['toastType'] })}
              style={{ ...inputStyle, cursor: 'pointer' }}>
              {(['info', 'success', 'warning', 'error'] as const).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </>)}
        </div>
      );

    case 'alert':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {row(<>{fieldLabel('Message')}
            <input value={step.toastMessage ?? ''} onChange={e => upd({ toastMessage: e.target.value })}
              placeholder='"Are you sure?"' style={monoInput} />
          </>)}
        </div>
      );

    case 'condition':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {row(<>{fieldLabel('Condition expression')}
            <input value={step.conditionExpr ?? ''} onChange={e => upd({ conditionExpr: e.target.value })}
              placeholder="$global.isLoggedIn === true" style={monoInput} />
          </>)}
          <div style={{ fontSize: 10, color: '#555', background: 'rgba(255,255,255,0.03)', borderRadius: 4, padding: '6px 8px' }}>
            Nested then/else steps available via custom code for complex branching.
          </div>
        </div>
      );

    case 'delay':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 8 }}>
          {fieldLabel('Wait (milliseconds)')}
          <input type="number" min={0} step={100}
            value={step.delayMs ?? 500} onChange={e => upd({ delayMs: parseInt(e.target.value) || 0 })}
            style={{ ...inputStyle, width: 120 }} />
        </div>
      );

    case 'custom':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          <div style={{ fontSize: 10, color: MUTED }}>
            Available:{' '}
            {['$global', '$page', '$api', 'navigate(screen)', 'setState(key, val)'].map(v => (
              <code key={v} style={{ color: '#7bcfff', fontFamily: 'monospace', marginRight: 6 }}>{v}</code>
            ))}
          </div>
          <textarea
            value={step.customCode ?? ''}
            onChange={e => upd({ customCode: e.target.value })}
            placeholder={"// Example:\nconst users = await $api.getUsers();\nsetState('$global.users', users);\nnavigate('Dashboard');"}
            rows={8}
            style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 10, resize: 'vertical' }}
          />
        </div>
      );

    default:
      return null;
  }
}

// ── Step card ─────────────────────────────────────────────────────────────────

function StepCard({ step, flowId, index, total, onMoveUp, onMoveDown, onDelete }: {
  step: ActionStep; flowId: string; index: number; total: number;
  onMoveUp: () => void; onMoveDown: () => void; onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { updateActionStep } = useFigmaStore();
  const color = STEP_COLORS[step.type] ?? MUTED;

  return (
    <div style={{
      border: `1px solid ${expanded ? color + '40' : BORDER}`,
      borderRadius: 8, background: PANEL, overflow: 'hidden',
      transition: 'border-color 150ms',
    }}>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', cursor: 'pointer' }}
      >
        <span style={{
          width: 20, height: 20, borderRadius: '50%',
          background: color + '20', border: `1px solid ${color}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, color, fontWeight: 700, flexShrink: 0,
        }}>{index + 1}</span>

        <span style={{
          fontSize: 9, fontWeight: 700, color,
          background: color + '15', border: `1px solid ${color}30`,
          borderRadius: 3, padding: '2px 5px', flexShrink: 0,
        }}>{STEP_LABELS[step.type]}</span>

        <div style={{ flex: 1, minWidth: 0 }}>
          {step.label ? (
            <span style={{ fontSize: 11, color: TEXT }}>{step.label}</span>
          ) : (
            <span style={{ fontSize: 11, color: '#555', fontStyle: 'italic' }}>
              {step.navigateTo || step.stateTarget || step.toastMessage ||
               (step.apiSourceId ? 'API call' : '') || 'click to configure'}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button onClick={onMoveUp} disabled={index === 0}
            style={{ background: 'none', border: 'none', color: index === 0 ? '#333' : MUTED,
              cursor: index === 0 ? 'not-allowed' : 'pointer', fontSize: 12, padding: '2px 4px' }}>↑</button>
          <button onClick={onMoveDown} disabled={index === total - 1}
            style={{ background: 'none', border: 'none', color: index === total - 1 ? '#333' : MUTED,
              cursor: index === total - 1 ? 'not-allowed' : 'pointer', fontSize: 12, padding: '2px 4px' }}>↓</button>
          <button onClick={onDelete}
            style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 14, padding: '2px 4px' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ff4444'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#555'; }}>×</button>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 12px 12px', borderTop: `1px solid ${BORDER}` }}>
          <div style={{ marginTop: 8, marginBottom: 4 }}>
            <input
              value={step.label ?? ''}
              onChange={e => updateActionStep(flowId, step.id, { label: e.target.value })}
              placeholder="Step label (optional)"
              style={{
                width: '100%', background: 'transparent', border: 'none',
                borderBottom: `1px solid ${BORDER}`, color: TEXT, fontSize: 11,
                padding: '3px 0', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          <StepFields step={step} flowId={flowId} />
        </div>
      )}
    </div>
  );
}

// ── Add step dropdown ─────────────────────────────────────────────────────────

function AddStepMenu({ flowId, onClose }: { flowId: string; onClose: () => void }) {
  const { addActionStep } = useFigmaStore();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 10);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      style={{
        position: 'absolute', bottom: '100%', left: 0, marginBottom: 4,
        background: '#1a1a1a', border: `1px solid ${BORDER}`, borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 100, overflow: 'hidden',
        width: 220,
      }}
    >
      {STEP_GROUPS.map(group => (
        <div key={group.label}>
          <div style={{
            padding: '5px 12px 3px', fontSize: 9, fontWeight: 700,
            color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>{group.label}</div>
          {group.types.map(type => (
            <div
              key={type}
              onClick={() => { addActionStep(flowId, { type, label: '' }); onClose(); }}
              style={{ padding: '6px 12px', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 8 }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.06)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: STEP_COLORS[type], flexShrink: 0, display: 'inline-block' }} />
              <span style={{ color: TEXT }}>{STEP_LABELS[type]}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Flow detail panel ─────────────────────────────────────────────────────────

function FlowDetail({ flow }: { flow: ActionFlow }) {
  const { updateActionFlow, deleteActionStep, reorderActionSteps } = useFigmaStore();
  const [showAddMenu, setShowAddMenu] = useState(false);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input
          value={flow.name}
          onChange={e => updateActionFlow(flow.id, { name: e.target.value })}
          style={{
            background: 'none', border: 'none', borderBottom: `1px solid ${BORDER}`,
            color: TEXT, fontSize: 18, fontWeight: 700, outline: 'none', padding: '4px 0',
          }}
        />
        <input
          value={flow.description ?? ''}
          onChange={e => updateActionFlow(flow.id, { description: e.target.value })}
          placeholder="What does this flow do? (optional)"
          style={{ background: 'none', border: 'none', color: MUTED, fontSize: 12, outline: 'none', padding: '2px 0' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {flow.steps.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '32px 16px',
            border: `2px dashed ${BORDER}`, borderRadius: 8, color: '#555',
          }}>
            <div style={{ fontSize: 12, marginBottom: 8 }}>No steps yet</div>
            <div style={{ fontSize: 11 }}>Add your first step below</div>
          </div>
        )}
        {flow.steps.map((step, i) => (
          <StepCard
            key={step.id}
            step={step}
            flowId={flow.id}
            index={i}
            total={flow.steps.length}
            onMoveUp={() => reorderActionSteps(flow.id, i, i - 1)}
            onMoveDown={() => reorderActionSteps(flow.id, i, i + 1)}
            onDelete={() => deleteActionStep(flow.id, step.id)}
          />
        ))}
      </div>

      <div style={{ position: 'relative', alignSelf: 'flex-start' }}>
        {showAddMenu && <AddStepMenu flowId={flow.id} onClose={() => setShowAddMenu(false)} />}
        <button
          onClick={() => setShowAddMenu(m => !m)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: `1px dashed ${BORDER}`, borderRadius: 6,
            color: MUTED, fontSize: 11, padding: '7px 14px', cursor: 'pointer',
            transition: 'border-color 150ms, color 150ms',
          }}
          onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = ACCENT; b.style.color = ACCENT; }}
          onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = BORDER; b.style.color = MUTED; }}
        >
          + Add step
        </button>
      </div>
    </div>
  );
}

// ── LogicPanel ────────────────────────────────────────────────────────────────

export default function LogicPanel() {
  const { actionFlows, addActionFlow, deleteActionFlow } = useFigmaStore();
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);

  const selectedFlow = actionFlows.find(f => f.id === selectedFlowId) ?? null;

  const createFlow = () => {
    addActionFlow({ name: 'New flow', description: '', steps: [] });
    setTimeout(() => {
      const { actionFlows: flows } = useFigmaStore.getState();
      const last = flows[flows.length - 1];
      if (last) setSelectedFlowId(last.id);
    }, 0);
  };

  return (
    <div style={{ flex: 1, display: 'flex', background: DARK, overflow: 'hidden', fontFamily: 'Inter, -apple-system, sans-serif' }}>
      {/* Left sidebar */}
      <div style={{ width: 240, flexShrink: 0, borderRight: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}` }}>
          <button
            onClick={createFlow}
            style={{ width: '100%', background: ACCENT, border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, fontWeight: 600, padding: '7px 12px', cursor: 'pointer' }}
          >+ New flow</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {actionFlows.length === 0 && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: '#555', fontSize: 11 }}>
              No flows yet.<br />Create one to get started.
            </div>
          )}
          {actionFlows.map(flow => (
            <div
              key={flow.id}
              onClick={() => setSelectedFlowId(flow.id)}
              style={{
                padding: '10px 16px', cursor: 'pointer',
                background: selectedFlowId === flow.id ? 'rgba(13,153,255,0.1)' : 'transparent',
                borderLeft: `2px solid ${selectedFlowId === flow.id ? ACCENT : 'transparent'}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
              }}
              onMouseEnter={e => { if (selectedFlowId !== flow.id) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={e => { if (selectedFlowId !== flow.id) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {flow.name}
                </div>
                <div style={{ fontSize: 10, color: MUTED, marginTop: 1 }}>
                  {flow.steps.length} step{flow.steps.length !== 1 ? 's' : ''}
                </div>
              </div>
              <button
                onClick={e => { e.stopPropagation(); deleteActionFlow(flow.id); if (selectedFlowId === flow.id) setSelectedFlowId(null); }}
                style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: 14, padding: '2px 4px', flexShrink: 0 }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ff4444'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#444'; }}
              >×</button>
            </div>
          ))}
        </div>
      </div>

      {/* Right: flow detail or empty state */}
      {selectedFlow ? (
        <FlowDetail flow={selectedFlow} />
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, color: '#555' }}>
          <div style={{ fontSize: 32 }}>⚙️</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#888' }}>Select a flow to edit it</div>
          <div style={{ fontSize: 12 }}>or create a new one</div>
        </div>
      )}
    </div>
  );
}
