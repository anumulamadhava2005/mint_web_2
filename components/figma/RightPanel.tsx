"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronRight, ChevronDown, Plus, Minus } from 'lucide-react';
import { useFigmaStore, type FigmaLayer, type Fill, type Stroke, type Effect, type ColorStop, type LayoutGrid, type AutoLayout, type Interaction, type InteractionTrigger, type InteractionAction, type TransitionType, type OverlayPosition } from '@/lib/stores/figmaStore';

const LAYER_EVENTS: Record<string, string[]> = {
  frame: ['onClick', 'onLongPress'],
  rect: ['onClick', 'onLongPress'],
  ellipse: ['onClick', 'onLongPress'],
  text: ['onClick'],
  image: ['onClick'],
  group: ['onClick'],
  component: ['onClick', 'onLongPress', 'onChange', 'onSubmit'],
  instance: ['onClick', 'onLongPress', 'onChange', 'onSubmit'],
  section: ['onClick'],
};
import ColorPicker from './ColorPicker';
import BindingPicker from './BindingPicker';

// ── Shared input ────────────────────────────────────────────────

function InspectorInput({
  label, value, unit = '', onChange, width,
}: {
  label: string; value: number | string; unit?: string;
  onChange?: (v: number) => void; width?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = useCallback(() => {
    if (onChange) {
      const n = parseFloat(draft);
      if (!isNaN(n)) onChange(n);
    }
    setEditing(false);
  }, [draft, onChange]);

  if (editing && onChange) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1 }}>
        <span style={{ fontSize: 10, color: '#666', minWidth: 10, textAlign: 'center' }}>{label}</span>
        <input
          ref={inputRef}
          value={draft}
          autoFocus
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
            if (e.key === 'ArrowUp') { e.preventDefault(); setDraft(v => String((parseFloat(v) || 0) + (e.shiftKey ? 10 : 1))); }
            if (e.key === 'ArrowDown') { e.preventDefault(); setDraft(v => String((parseFloat(v) || 0) - (e.shiftKey ? 10 : 1))); }
          }}
          style={{
            flex: 1, minWidth: 0, width: width ?? '100%',
            background: '#0d0d0d', border: '1px solid #0d99ff',
            borderRadius: 4, color: '#ebebeb', fontSize: 12,
            padding: '3px 5px', outline: 'none',
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1, cursor: onChange ? 'text' : 'default' }}
      onClick={() => { if (onChange) { setDraft(String(value)); setEditing(true); } }}
    >
      <span style={{ fontSize: 10, color: '#666', minWidth: 10, textAlign: 'center' }}>{label}</span>
      <div style={{
        flex: 1, minWidth: 0, width: width ?? '100%',
        background: '#1a1a1a', border: '1px solid #333',
        borderRadius: 4, color: '#ebebeb', fontSize: 12,
        padding: '3px 5px', lineHeight: '16px',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {value}{unit}
      </div>
    </div>
  );
}

// ── Section wrapper ─────────────────────────────────────────────

function Section({
  label, expanded, onToggle, action, children,
}: {
  label: string; expanded: boolean; onToggle: () => void;
  action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div style={{ borderBottom: '1px solid #232323' }}>
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 12px', cursor: 'pointer', userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {expanded ? <ChevronDown size={11} color="#555" /> : <ChevronRight size={11} color="#555" />}
          <span style={{ fontSize: 11, color: '#aaa', fontWeight: 500 }}>{label}</span>
        </div>
        {action && <div onClick={e => e.stopPropagation()}>{action}</div>}
      </div>
      {expanded && <div style={{ padding: '4px 12px 10px' }}>{children}</div>}
    </div>
  );
}

// ── Color swatch with picker popover ───────────────────────────

function ColorSwatch({ color, alpha = 1, onChange, onAlphaChange, showAlpha }: {
  color: string; alpha?: number;
  // onChange receives hex AND the current alpha so callers can update both in one store write
  onChange: (hex: string, alpha: number) => void;
  onAlphaChange?: (v: number) => void;
  showAlpha?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Viewport-relative position for the picker (position: fixed escapes overflow clipping)
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const { recentColors, colorStyles, addRecentColor, addColorStyle } = useFigmaStore();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const openPicker = () => {
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect();
      const PICKER_W = 256;
      const vw = window.innerWidth;
      // prefer to the right of anchor, flip left if it would overflow viewport
      const left = r.right + PICKER_W > vw ? r.left - PICKER_W : r.right + 4;
      setPickerPos({ top: r.top, left: Math.max(4, left) });
    }
    setOpen(v => !v);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        anchorRef.current && !anchorRef.current.contains(e.target as Node) &&
        pickerRef.current && !pickerRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  const checkerStyle: React.CSSProperties = {
    backgroundImage: 'linear-gradient(45deg,#555 25%,transparent 25%),linear-gradient(-45deg,#555 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#555 75%),linear-gradient(-45deg,transparent 75%,#555 75%)',
    backgroundSize: '6px 6px',
    backgroundPosition: '0 0,0 3px,3px -3px,-3px 0',
    backgroundColor: '#888',
  };

  const safeColor = (typeof color === 'string' && color.startsWith('#')) ? color : '#e2e2e2';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
      {/* Swatch button */}
      <button
        ref={anchorRef}
        onClick={openPicker}
        title="Pick color"
        style={{
          width: 22, height: 22, padding: 0, border: '1px solid #555',
          borderRadius: 3, cursor: 'pointer', position: 'relative', overflow: 'hidden', flexShrink: 0,
        }}
      >
        <div style={{ ...checkerStyle, position: 'absolute', inset: 0 }} />
        <div style={{ position: 'absolute', inset: 0, background: safeColor, opacity: alpha }} />
      </button>

      {/* Hex display */}
      <div
        style={{
          flex: 1, background: '#1a1a1a', border: '1px solid #333', borderRadius: 4,
          color: '#ccc', fontSize: 11, padding: '2px 5px', fontFamily: 'monospace',
          cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
        onClick={openPicker}
      >
        {safeColor.replace('#', '').toUpperCase()}
      </div>

      {/* Alpha */}
      {showAlpha && onAlphaChange && (
        <div style={{ width: 44 }}>
          <InspectorInput label="" value={Math.round(alpha * 100)} unit="%" onChange={v => onAlphaChange(Math.max(0, Math.min(1, v / 100)))} />
        </div>
      )}

      {/* Picker popover — position: fixed so it escapes overflow:auto scroll containers */}
      {open && (
        <div
          ref={pickerRef}
          style={{ position: 'fixed', top: pickerPos.top, left: pickerPos.left, zIndex: 99999 }}
        >
          <ColorPicker
            color={safeColor}
            alpha={alpha}
            onChange={(hex, a) => {
              // Pass both hex and alpha together — callers update them in one store write
              // to avoid the second write reverting the color via a stale fills closure.
              onChange(hex, a);
            }}
            onClose={() => { setOpen(false); addRecentColor(safeColor); }}
            recentColors={recentColors}
            documentColors={colorStyles.map(s => s.color)}
            onSaveStyle={(c) => { addColorStyle('Color style', c); addRecentColor(c); }}
          />
        </div>
      )}
    </div>
  );
}

// ── Alignment grid ──────────────────────────────────────────────

const ALIGN_ICONS: Array<{ title: string; fn: (l: FigmaLayer) => Partial<FigmaLayer>; svg: string }> = [
  { title: 'Align Left', fn: () => ({ x: 0 }), svg: 'M4 4v24M8 10h16M8 22h12' },
  { title: 'Center Horizontal', fn: (l) => ({ x: Math.round(-l.width / 2) }), svg: 'M16 4v24M8 10h16M10 22h12' },
  { title: 'Align Right', fn: (l) => ({ x: -l.width }), svg: 'M28 4v24M8 10h16M12 22h16' },
  { title: 'Align Top', fn: () => ({ y: 0 }), svg: 'M4 4h24M10 8v16M22 8v12' },
  { title: 'Center Vertical', fn: (l) => ({ y: Math.round(-l.height / 2) }), svg: 'M4 16h24M10 8v16M22 10v12' },
  { title: 'Align Bottom', fn: (l) => ({ y: -l.height }), svg: 'M4 28h24M10 8v20M22 12v16' },
  { title: 'Distribute H', fn: () => ({}), svg: 'M4 4v24M28 4v24M16 12v8' },
  { title: 'Distribute V', fn: () => ({}), svg: 'M4 4h24M4 28h24M12 16h8' },
];

function AlignmentSection({ layer, updateLayer }: { layer: FigmaLayer | null; updateLayer: (id: string, p: Partial<FigmaLayer>) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3 }}>
      {ALIGN_ICONS.map(a => (
        <button
          key={a.title}
          title={a.title}
          onClick={() => { if (layer) updateLayer(layer.id, a.fn(layer)); }}
          style={{
            height: 26, background: '#1a1a1a', border: '1px solid #333', borderRadius: 4,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#2a2a2a'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#444'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#333'; }}
        >
          <svg width="16" height="16" viewBox="0 0 32 32" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round">
            {a.svg.split('M').filter(Boolean).map((s, i) => <path key={i} d={`M${s}`} />)}
          </svg>
        </button>
      ))}
    </div>
  );
}

// ── Frame dimension presets ──────────────────────────────────────

const FRAME_PRESETS: { label: string; presets: { name: string; w: number; h: number }[] }[] = [
  { label: 'Mobile', presets: [
    { name: 'iPhone 14', w: 390, h: 844 },
    { name: 'iPhone 14 Pro Max', w: 430, h: 932 },
    { name: 'iPhone SE', w: 375, h: 667 },
    { name: 'Android (360)', w: 360, h: 800 },
  ]},
  { label: 'Tablet', presets: [
    { name: 'iPad', w: 768, h: 1024 },
    { name: 'iPad Pro 11"', w: 834, h: 1194 },
    { name: 'iPad Pro 12.9"', w: 1024, h: 1366 },
  ]},
  { label: 'Desktop', presets: [
    { name: '1280 × 800', w: 1280, h: 800 },
    { name: '1440 × 900', w: 1440, h: 900 },
    { name: '1920 × 1080', w: 1920, h: 1080 },
  ]},
  { label: 'Watch', presets: [
    { name: 'Apple Watch 45mm', w: 198, h: 242 },
    { name: 'Apple Watch 41mm', w: 176, h: 215 },
  ]},
  { label: 'Social', presets: [
    { name: 'Instagram Post', w: 1080, h: 1080 },
    { name: 'Instagram Story', w: 1080, h: 1920 },
    { name: 'Twitter Header', w: 1500, h: 500 },
    { name: 'Facebook Cover', w: 820, h: 312 },
  ]},
];

function FramePresetsButton({ layerId, updateLayer }: { layerId: string; updateLayer: (id: string, p: Partial<FigmaLayer>) => void }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={btnRef}
        onClick={() => setOpen(v => !v)}
        title="Frame size presets"
        style={{
          background: open ? 'rgba(13,153,255,0.15)' : 'none',
          border: `1px solid ${open ? 'rgba(13,153,255,0.4)' : '#333'}`,
          borderRadius: 4, cursor: 'pointer',
          color: open ? '#0d99ff' : '#666',
          fontSize: 10, padding: '2px 6px', lineHeight: 1.4,
        }}
      >
        Presets
      </button>
      {open && (
        <div
          ref={menuRef}
          style={{
            position: 'absolute', top: '100%', right: 0, zIndex: 9999,
            background: '#252525', border: '1px solid #3a3a3a',
            borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            width: 192, marginTop: 4, overflow: 'hidden',
          }}
        >
          {FRAME_PRESETS.map(group => (
            <div key={group.label}>
              <div style={{
                padding: '6px 10px 3px', fontSize: 9, color: '#555',
                fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                borderTop: group.label !== FRAME_PRESETS[0].label ? '1px solid #2e2e2e' : undefined,
              }}>
                {group.label}
              </div>
              {group.presets.map(p => (
                <button
                  key={p.name}
                  onClick={() => { updateLayer(layerId, { width: p.w, height: p.h }); setOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '5px 10px', background: 'none',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                >
                  <span style={{ fontSize: 11, color: '#ccc' }}>{p.name}</span>
                  <span style={{ fontSize: 10, color: '#555', fontFamily: 'monospace' }}>{p.w}×{p.h}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Transform section ───────────────────────────────────────────

function TransformSection({ layer, updateLayer }: { layer: FigmaLayer; updateLayer: (id: string, p: Partial<FigmaLayer>) => void }) {
  const upd = (key: keyof FigmaLayer) => (v: number) => updateLayer(layer.id, { [key]: v });
  const hasRadius = layer.type === 'rect' || layer.type === 'frame';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
        <InspectorInput label="X" value={Math.round(layer.x)} onChange={upd('x')} />
        <InspectorInput label="Y" value={Math.round(layer.y)} onChange={upd('y')} />
        <InspectorInput label="W" value={Math.round(layer.width)} onChange={v => updateLayer(layer.id, { width: Math.max(1, v) })} />
        <InspectorInput label="H" value={Math.round(layer.height)} onChange={v => updateLayer(layer.id, { height: Math.max(1, v) })} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
        <InspectorInput label="°" value={Math.round(layer.rotation ?? 0)} onChange={upd('rotation')} />
        {hasRadius
          ? <InspectorInput label="⌒" value={layer.cornerRadius ?? 0} onChange={upd('cornerRadius')} />
          : <div />
        }
      </div>
    </div>
  );
}

// ── Layer section (opacity + blend mode) ───────────────────────

const BLEND_MODES = ['Normal', 'Darken', 'Multiply', 'Color Burn', 'Lighten', 'Screen', 'Color Dodge', 'Overlay', 'Soft Light', 'Hard Light', 'Difference', 'Exclusion', 'Hue', 'Saturation', 'Color', 'Luminosity'];

function LayerSection({ layer, updateLayer }: { layer: FigmaLayer; updateLayer: (id: string, p: Partial<FigmaLayer>) => void }) {
  const [editOpacity, setEditOpacity] = useState(false);
  const [opDraft, setOpDraft] = useState('');

  const commitOp = () => {
    const n = parseFloat(opDraft);
    if (!isNaN(n)) updateLayer(layer.id, { opacity: Math.max(0, Math.min(1, n / 100)) });
    setEditOpacity(false);
  };

  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      <select
        value={layer.blendMode}
        onChange={e => updateLayer(layer.id, { blendMode: e.target.value })}
        style={{ flex: 1, background: '#1a1a1a', border: '1px solid #333', borderRadius: 4, color: '#ebebeb', fontSize: 11, padding: '3px 5px', outline: 'none', cursor: 'pointer' }}
      >
        {BLEND_MODES.map(m => <option key={m} value={m.toLowerCase().replace(/ /g, '-')}>{m}</option>)}
      </select>
      {editOpacity ? (
        <input
          autoFocus value={opDraft}
          onChange={e => setOpDraft(e.target.value)}
          onBlur={commitOp}
          onKeyDown={e => { if (e.key === 'Enter') commitOp(); if (e.key === 'Escape') setEditOpacity(false); }}
          style={{ width: 44, background: '#0d0d0d', border: '1px solid #0d99ff', borderRadius: 4, color: '#ebebeb', fontSize: 12, padding: '3px 5px', outline: 'none' }}
        />
      ) : (
        <div
          onClick={() => { setOpDraft(String(Math.round(layer.opacity * 100))); setEditOpacity(true); }}
          style={{ width: 44, background: '#1a1a1a', border: '1px solid #333', borderRadius: 4, color: '#ebebeb', fontSize: 12, padding: '3px 5px', cursor: 'text', textAlign: 'right' }}
        >
          {Math.round(layer.opacity * 100)}%
        </div>
      )}
    </div>
  );
}

// ── Gradient editor ────────────────────────────────────────────

function GradientEditor({ fill, updateFill }: { fill: Fill; updateFill: (p: Partial<Fill>) => void }) {
  const stops: ColorStop[] = fill.stops ?? [
    { id: 'stop-0', position: 0, color: '#ffffff', opacity: 1 },
    { id: 'stop-1', position: 1, color: '#000000', opacity: 1 },
  ];

  const updateStop = (id: string, partial: Partial<ColorStop>) =>
    updateFill({ stops: stops.map(s => s.id === id ? { ...s, ...partial } : s) });

  const addStop = () => {
    const id = `stop-${Date.now()}`;
    updateFill({ stops: [...stops, { id, position: 0.5, color: '#888888', opacity: 1 }] });
  };

  const removeStop = (id: string) => {
    if (stops.length <= 2) return;
    updateFill({ stops: stops.filter(s => s.id !== id) });
  };

  // Preview gradient track
  const sortedStops = [...stops].sort((a, b) => a.position - b.position);
  const gradientCss = `linear-gradient(to right, ${sortedStops.map(s => `${s.color} ${Math.round(s.position * 100)}%`).join(', ')})`;

  return (
    <div style={{ marginTop: 6 }}>
      {/* Gradient preview track */}
      <div style={{ height: 12, borderRadius: 6, background: gradientCss, border: '1px solid #444', marginBottom: 8, position: 'relative' }}>
        {stops.map(s => (
          <div
            key={s.id}
            title={`Stop at ${Math.round(s.position * 100)}%`}
            style={{
              position: 'absolute', top: '50%', left: `${s.position * 100}%`,
              transform: 'translate(-50%, -50%)',
              width: 12, height: 12, borderRadius: '50%',
              background: s.color, border: '2px solid white',
              boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
              cursor: 'pointer',
            }}
          />
        ))}
      </div>

      {/* Angle for linear */}
      {fill.type === 'linear' && (
        <div style={{ marginBottom: 6 }}>
          <InspectorInput label="°" value={fill.gradientAngle ?? 90} onChange={v => updateFill({ gradientAngle: v })} />
        </div>
      )}

      {/* Color stops */}
      {stops.map(s => (
        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
          <ColorSwatch
            color={s.color}
            alpha={s.opacity}
            onChange={(c, v) => updateStop(s.id, { color: c, opacity: v })}
            onAlphaChange={v => updateStop(s.id, { opacity: v })}
            showAlpha
          />
          <InspectorInput label="%" value={Math.round(s.position * 100)} onChange={v => updateStop(s.id, { position: Math.max(0, Math.min(1, v / 100)) })} width={32} />
          <button onClick={() => removeStop(s.id)} title="Remove stop" style={{ background: 'none', border: 'none', cursor: 'pointer', color: stops.length <= 2 ? '#333' : '#555', padding: 0 }}>
            <Minus size={11} />
          </button>
        </div>
      ))}
      <button onClick={addStop} style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 11, padding: 0 }}>
        <Plus size={11} /> Add stop
      </button>
    </div>
  );
}

// ── Image fill editor ──────────────────────────────────────────

function ImageFillEditor({ fill, updateFill }: { fill: Fill; updateFill: (p: Partial<Fill>) => void }) {
  const [urlDraft, setUrlDraft] = useState(fill.imageUrl ?? '');

  return (
    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 5 }}>
      <input
        value={urlDraft}
        placeholder="Image URL…"
        onChange={e => setUrlDraft(e.target.value)}
        onBlur={() => updateFill({ imageUrl: urlDraft })}
        onKeyDown={e => { if (e.key === 'Enter') updateFill({ imageUrl: urlDraft }); }}
        style={{ background: '#111', border: '1px solid #444', borderRadius: 4, color: '#ebebeb', fontSize: 11, padding: '3px 6px', outline: 'none', width: '100%', boxSizing: 'border-box' }}
      />
      <select
        value={fill.imageFit ?? 'fill'}
        onChange={e => updateFill({ imageFit: e.target.value as Fill['imageFit'] })}
        style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 4, color: '#ebebeb', fontSize: 11, padding: '2px 4px', outline: 'none' }}
      >
        {(['fill', 'fit', 'crop', 'tile'] as const).map(m => (
          <option key={m} value={m}>{m[0].toUpperCase() + m.slice(1)}</option>
        ))}
      </select>
      {fill.imageUrl && (
        <div style={{ borderRadius: 4, overflow: 'hidden', height: 60, background: '#111', position: 'relative' }}>
          <img src={fill.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: fill.imageFit === 'tile' ? 'none' : (fill.imageFit as 'fill' | 'contain') || 'cover' }} />
        </div>
      )}
    </div>
  );
}

// ── Fill section ────────────────────────────────────────────────

const FILL_TYPE_LABELS: Record<string, string> = {
  solid: 'Solid', linear: 'Linear', radial: 'Radial', angular: 'Angular', image: 'Image', none: 'None',
};

function FillSection({ layer, updateLayer }: { layer: FigmaLayer; updateLayer: (id: string, p: Partial<FigmaLayer>) => void }) {
  const addFill = () => {
    const newFill: Fill = { id: `fill-${Date.now()}`, type: 'solid', color: '#e2e2e2', opacity: 1, visible: true, blendMode: 'normal' };
    updateLayer(layer.id, { fills: [...layer.fills, newFill] });
  };
  const removeFill = (id: string) => updateLayer(layer.id, { fills: layer.fills.filter(f => f.id !== id) });
  const updateFill = (id: string, partial: Partial<Fill>) =>
    updateLayer(layer.id, { fills: layer.fills.map(f => f.id === id ? { ...f, ...partial } : f) });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {layer.fills.map(fill => (
        <div key={fill.id} style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingBottom: 6, borderBottom: '1px solid #222' }}>
          {/* Row 1: type + visibility + remove */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <select
              value={fill.type}
              onChange={e => updateFill(fill.id, { type: e.target.value as Fill['type'] })}
              style={{ flex: 1, background: '#1a1a1a', border: '1px solid #333', borderRadius: 4, color: '#ebebeb', fontSize: 11, padding: '2px 4px', outline: 'none' }}
            >
              {Object.entries(FILL_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select
              value={fill.blendMode}
              onChange={e => updateFill(fill.id, { blendMode: e.target.value })}
              style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 4, color: '#ebebeb', fontSize: 11, padding: '2px 4px', outline: 'none', maxWidth: 80 }}
            >
              {BLEND_MODES.map(m => <option key={m} value={m.toLowerCase().replace(/ /g, '-')}>{m}</option>)}
            </select>
            <button
              onClick={() => updateFill(fill.id, { visible: !fill.visible })}
              title={fill.visible ? 'Hide' : 'Show'}
              style={{ width: 18, height: 18, background: 'none', border: 'none', cursor: 'pointer', color: fill.visible ? '#888' : '#444', padding: 0, flexShrink: 0 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {fill.visible
                  ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
                  : <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></>
                }
              </svg>
            </button>
            <button onClick={() => removeFill(fill.id)} style={{ width: 18, height: 18, background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 0, flexShrink: 0 }}>
              <Minus size={12} />
            </button>
          </div>

          {/* Row 2: color swatch (for solid/none) */}
          {(fill.type === 'solid' || fill.type === 'none') && (
            <ColorSwatch
              color={fill.color}
              alpha={fill.opacity}
              onChange={(c, v) => updateFill(fill.id, { color: c, opacity: v })}
              onAlphaChange={v => updateFill(fill.id, { opacity: v })}
              showAlpha
            />
          )}

          {/* Gradient editor */}
          {(fill.type === 'linear' || fill.type === 'radial' || fill.type === 'angular') && (
            <GradientEditor fill={fill} updateFill={p => updateFill(fill.id, p)} />
          )}

          {/* Image fill editor */}
          {fill.type === 'image' && (
            <ImageFillEditor fill={fill} updateFill={p => updateFill(fill.id, p)} />
          )}
        </div>
      ))}
      {layer.fills.length === 0 && (
        <div style={{ fontSize: 11, color: '#555' }}>No fills</div>
      )}
      <button onClick={addFill} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 11, padding: 0 }}>
        <Plus size={12} /> Add fill
      </button>
    </div>
  );
}

// ── Stroke section ──────────────────────────────────────────────

function StrokeSection({ layer, updateLayer }: { layer: FigmaLayer; updateLayer: (id: string, p: Partial<FigmaLayer>) => void }) {
  const addStroke = () => {
    const s: Stroke = { id: `stroke-${Date.now()}`, color: '#000000', opacity: 1, weight: 1, position: 'center', type: 'solid', visible: true };
    updateLayer(layer.id, { strokes: [...layer.strokes, s] });
  };
  const removeStroke = (id: string) => updateLayer(layer.id, { strokes: layer.strokes.filter(s => s.id !== id) });
  const updateStroke = (id: string, partial: Partial<Stroke>) =>
    updateLayer(layer.id, { strokes: layer.strokes.map(s => s.id === id ? { ...s, ...partial } : s) });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {layer.strokes.map(stroke => (
        <div key={stroke.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <ColorSwatch
              color={stroke.color}
              alpha={stroke.opacity}
              onChange={(c, v) => updateStroke(stroke.id, { color: c, opacity: v })}
              onAlphaChange={v => updateStroke(stroke.id, { opacity: v })}
              showAlpha
            />
            <button onClick={() => removeStroke(stroke.id)} style={{ width: 18, height: 18, background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 0, flexShrink: 0 }}>
              <Minus size={12} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
            <select
              value={stroke.position}
              onChange={e => updateStroke(stroke.id, { position: e.target.value as Stroke['position'] })}
              style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 4, color: '#ebebeb', fontSize: 11, padding: '2px 4px', outline: 'none' }}
            >
              {(['inside', 'center', 'outside'] as const).map(p => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
            </select>
            <select
              value={stroke.type}
              onChange={e => updateStroke(stroke.id, { type: e.target.value as Stroke['type'] })}
              style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 4, color: '#ebebeb', fontSize: 11, padding: '2px 4px', outline: 'none' }}
            >
              {(['solid', 'dashed', 'dotted'] as const).map(t => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
            </select>
            <InspectorInput label="W" value={stroke.weight} onChange={v => updateStroke(stroke.id, { weight: Math.max(0, v) })} />
          </div>
        </div>
      ))}
      {layer.strokes.length === 0 && (
        <div style={{ fontSize: 11, color: '#555' }}>No strokes</div>
      )}
      <button onClick={addStroke} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 11, padding: 0 }}>
        <Plus size={12} /> Add stroke
      </button>
    </div>
  );
}

// ── Effects section ─────────────────────────────────────────────

const EFFECT_TYPE_LABELS: Record<Effect['type'], string> = {
  'drop-shadow': 'Drop Shadow',
  'inner-shadow': 'Inner Shadow',
  'layer-blur': 'Layer Blur',
  'background-blur': 'Background Blur',
};

function EffectsSection({ layer, updateLayer }: { layer: FigmaLayer; updateLayer: (id: string, p: Partial<FigmaLayer>) => void }) {
  const { effectStyles, saveEffectStyle, applyEffectStyle } = useFigmaStore();
  const addEffect = (type: Effect['type']) => {
    const e: Effect = { id: `effect-${Date.now()}`, type, visible: true, x: 2, y: 4, blur: type === 'layer-blur' || type === 'background-blur' ? 4 : 8, spread: 0, color: '#000000', opacity: 0.25 };
    updateLayer(layer.id, { effects: [...layer.effects, e] });
  };
  const removeEffect = (id: string) => updateLayer(layer.id, { effects: layer.effects.filter(e => e.id !== id) });
  const updateEffect = (id: string, p: Partial<Effect>) =>
    updateLayer(layer.id, { effects: layer.effects.map(e => e.id === id ? { ...e, ...p } : e) });

  const isBlurOnly = (type: Effect['type']) => type === 'layer-blur' || type === 'background-blur';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {layer.effects.map(eff => (
        <div key={eff.id} style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingBottom: 6, borderBottom: '1px solid #222' }}>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <select
              value={eff.type}
              onChange={e => updateEffect(eff.id, { type: e.target.value as Effect['type'] })}
              style={{ flex: 1, background: '#1a1a1a', border: '1px solid #333', borderRadius: 4, color: '#ebebeb', fontSize: 11, padding: '2px 4px', outline: 'none' }}
            >
              {(Object.entries(EFFECT_TYPE_LABELS) as [Effect['type'], string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <button
              onClick={() => updateEffect(eff.id, { visible: !eff.visible })}
              title={eff.visible ? 'Hide' : 'Show'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: eff.visible ? '#888' : '#444', padding: 0 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
              </svg>
            </button>
            <button onClick={() => removeEffect(eff.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 0 }}>
              <Minus size={11} />
            </button>
          </div>

          {/* Blur-only effects */}
          {isBlurOnly(eff.type) && (
            <InspectorInput label="B" value={eff.blur} onChange={v => updateEffect(eff.id, { blur: Math.max(0, v) })} />
          )}

          {/* Shadow effects */}
          {!isBlurOnly(eff.type) && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                <InspectorInput label="X" value={eff.x} onChange={v => updateEffect(eff.id, { x: v })} />
                <InspectorInput label="Y" value={eff.y} onChange={v => updateEffect(eff.id, { y: v })} />
                <InspectorInput label="B" value={eff.blur} onChange={v => updateEffect(eff.id, { blur: Math.max(0, v) })} />
                <InspectorInput label="S" value={eff.spread} onChange={v => updateEffect(eff.id, { spread: v })} />
              </div>
              <ColorSwatch
                color={eff.color}
                alpha={eff.opacity}
                onChange={(c, v) => updateEffect(eff.id, { color: c, opacity: v })}
                onAlphaChange={v => updateEffect(eff.id, { opacity: v })}
                showAlpha
              />
            </>
          )}
        </div>
      ))}
      {layer.effects.length === 0 && (
        <div style={{ fontSize: 11, color: '#555' }}>No effects</div>
      )}
      {/* Add effect dropdown */}
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        <select
          defaultValue=""
          onChange={e => { if (e.target.value) { addEffect(e.target.value as Effect['type']); e.target.value = ''; } }}
          style={{ flex: 1, background: '#1a1a1a', border: '1px solid #333', borderRadius: 4, color: '#888', fontSize: 11, padding: '2px 4px', outline: 'none' }}
        >
          <option value="" disabled>Add effect…</option>
          {(Object.entries(EFFECT_TYPE_LABELS) as [Effect['type'], string][]).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>
      {effectStyles.length > 0 && (
        <select
          defaultValue=""
          onChange={e => { if (e.target.value) { applyEffectStyle(layer.id, e.target.value); (e.target as HTMLSelectElement).value = ''; } }}
          style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 4, color: '#888', fontSize: 11, padding: '2px 4px', outline: 'none' }}
        >
          <option value="" disabled>Apply effect style…</option>
          {effectStyles.map(es => (
            <option key={es.id} value={es.id}>{es.name}</option>
          ))}
        </select>
      )}
      {layer.effects.length > 0 && (
        <div style={{ paddingTop: 4 }}>
          <SaveStyleButton label="Save effect style" onSave={(name) => saveEffectStyle(name, layer.effects)} />
        </div>
      )}
    </div>
  );
}

// ── Export section ──────────────────────────────────────────────

function ExportSection({ layer, updateLayer }: { layer: FigmaLayer; updateLayer: (id: string, p: Partial<FigmaLayer>) => void }) {
  const addExport = () => {
    const e = { id: `export-${Date.now()}`, scale: 1, format: 'png' as const, suffix: '' };
    updateLayer(layer.id, { exports: [...layer.exports, e] });
  };
  const removeExport = (id: string) => updateLayer(layer.id, { exports: layer.exports.filter(e => e.id !== id) });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {layer.exports.map(exp => (
        <div key={exp.id} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <InspectorInput label="×" value={exp.scale} onChange={v => updateLayer(layer.id, { exports: layer.exports.map(e => e.id === exp.id ? { ...e, scale: Math.max(0.5, v) } : e) })} width={36} />
          <select
            value={exp.format}
            onChange={ev => updateLayer(layer.id, { exports: layer.exports.map(e => e.id === exp.id ? { ...e, format: ev.target.value as typeof exp.format } : e) })}
            style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 4, color: '#ebebeb', fontSize: 11, padding: '2px 4px', outline: 'none' }}
          >
            {(['png', 'jpg', 'svg', 'pdf', 'webp'] as const).map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
          </select>
          <button onClick={() => removeExport(exp.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 0 }}>
            <Minus size={11} />
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 5 }}>
        <button onClick={addExport} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 11, padding: 0 }}>
          <Plus size={12} /> Add export
        </button>
        {layer.exports.length > 0 && (
          <button
            onClick={() => {
              const svg = generateSVG(layer);
              const name = layer.name.replace(/\s+/g, '_');
              downloadBlob(svg, `${name}.svg`, 'image/svg+xml');
            }}
            style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 4, color: '#ccc', fontSize: 11, padding: '3px 10px', cursor: 'pointer' }}
          >
            Export SVG ↓
          </button>
        )}
      </div>
    </div>
  );
}

// ── Typography section (for text layers) ───────────────────────

const FONTS = [
  'Inter', 'Roboto', 'Open Sans', 'Poppins', 'Lato', 'Montserrat', 'Source Sans Pro',
  'Nunito', 'Raleway', 'Ubuntu', 'Oswald', 'Merriweather', 'Playfair Display',
  'Lora', 'PT Serif', 'Noto Sans', 'Work Sans', 'Fira Sans', 'Barlow',
  'Mulish', 'Quicksand', 'DM Sans', 'Space Grotesk', 'Manrope', 'Plus Jakarta Sans',
  'Outfit', 'Sora', 'IBM Plex Sans', 'Rubik', 'Karla', 'Cabin', 'Josefin Sans',
];

const FONT_WEIGHTS: { value: string; label: string }[] = [
  { value: '100', label: 'Thin' }, { value: '200', label: 'Extra Light' },
  { value: '300', label: 'Light' }, { value: 'normal', label: 'Regular' },
  { value: '500', label: 'Medium' }, { value: '600', label: 'Semi Bold' },
  { value: '700', label: 'Bold' }, { value: '800', label: 'Extra Bold' },
  { value: '900', label: 'Black' },
];

function TypographySection({ layer, updateLayer }: { layer: FigmaLayer; updateLayer: (id: string, p: Partial<FigmaLayer>) => void }) {
  const { textStyles, saveTextStyle, applyTextStyle } = useFigmaStore();
  const [fontSearch, setFontSearch] = useState('');
  const [fontDropOpen, setFontDropOpen] = useState(false);
  const fontInputRef = useRef<HTMLInputElement>(null);
  const fontDropRef = useRef<HTMLDivElement>(null);

  const filteredFonts = FONTS.filter(f => f.toLowerCase().includes(fontSearch.toLowerCase()));
  const isItalic = layer.fontStyle === 'italic';

  useEffect(() => {
    if (!fontDropOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        !fontInputRef.current?.contains(e.target as Node) &&
        !fontDropRef.current?.contains(e.target as Node)
      ) { setFontDropOpen(false); setFontSearch(''); }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [fontDropOpen]);

  const btnStyle = (active: boolean): React.CSSProperties => ({
    background: active ? '#0d99ff' : '#1a1a1a',
    border: '1px solid ' + (active ? '#0d99ff' : '#333'),
    borderRadius: 4, cursor: 'pointer',
    color: active ? '#fff' : '#aaa',
    padding: '3px 5px', fontSize: 11, lineHeight: 1,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Font family + italic */}
      <div style={{ display: 'flex', gap: 4 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            ref={fontInputRef}
            value={fontDropOpen ? fontSearch : (layer.fontFamily ?? 'Inter')}
            placeholder="Font…"
            onFocus={() => { setFontDropOpen(true); setFontSearch(''); }}
            onChange={e => setFontSearch(e.target.value)}
            style={{
              width: '100%', background: '#1a1a1a', border: '1px solid ' + (fontDropOpen ? '#0d99ff' : '#333'),
              borderRadius: 4, color: '#ebebeb', fontSize: 11, padding: '3px 5px',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
          {fontDropOpen && (
            <div ref={fontDropRef} style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999,
              background: '#2c2c2c', border: '1px solid #444', borderRadius: 4,
              maxHeight: 180, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            }}>
              {filteredFonts.length === 0
                ? <div style={{ padding: '6px 8px', color: '#555', fontSize: 11 }}>No fonts found</div>
                : filteredFonts.map(f => (
                  <div
                    key={f}
                    onMouseDown={e => {
                      e.preventDefault();
                      updateLayer(layer.id, { fontFamily: f });
                      setFontDropOpen(false);
                      setFontSearch('');
                    }}
                    style={{
                      padding: '5px 8px', cursor: 'pointer', fontSize: 11,
                      fontFamily: f,
                      color: (layer.fontFamily ?? 'Inter') === f ? '#0d99ff' : '#ccc',
                      background: (layer.fontFamily ?? 'Inter') === f ? 'rgba(13,153,255,0.1)' : 'transparent',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = (layer.fontFamily ?? 'Inter') === f ? 'rgba(13,153,255,0.1)' : 'transparent'; }}
                  >{f}</div>
                ))
              }
            </div>
          )}
        </div>
        <button
          onClick={() => updateLayer(layer.id, { fontStyle: isItalic ? 'normal' : 'italic' })}
          title="Italic"
          style={{ ...btnStyle(isItalic), fontStyle: 'italic', width: 26, flexShrink: 0 }}
        >I</button>
      </div>

      {/* Weight + size */}
      <div style={{ display: 'flex', gap: 4 }}>
        <select
          value={layer.fontWeight ?? 'normal'}
          onChange={e => updateLayer(layer.id, { fontWeight: e.target.value })}
          style={{ flex: 1, background: '#1a1a1a', border: '1px solid #333', borderRadius: 4, color: '#ebebeb', fontSize: 11, padding: '2px 4px', outline: 'none' }}
        >
          {FONT_WEIGHTS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
        </select>
        <div style={{ width: 52 }}>
          <InspectorInput label="fs" value={layer.fontSize ?? 14} onChange={v => updateLayer(layer.id, { fontSize: Math.max(1, v) })} />
        </div>
      </div>

      {/* Line height / letter spacing / paragraph spacing */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
        <InspectorInput label="lh" value={layer.lineHeight ?? 0} onChange={v => updateLayer(layer.id, { lineHeight: Math.max(0, v) })} />
        <InspectorInput label="ls" value={layer.letterSpacing ?? 0} onChange={v => updateLayer(layer.id, { letterSpacing: v })} />
        <InspectorInput label="ps" value={(layer as FigmaLayer & { paragraphSpacing?: number }).paragraphSpacing ?? 0} onChange={v => updateLayer(layer.id, { paragraphSpacing: Math.max(0, v) })} />
      </div>

      {/* Horizontal alignment */}
      <div style={{ display: 'flex', gap: 3 }}>
        {(['left', 'center', 'right', 'justify'] as const).map(align => {
          const paths: Record<string, string[]> = {
            left: ['M4 7h16', 'M4 12h10', 'M4 17h13'],
            center: ['M4 7h16', 'M7 12h10', 'M6 17h12'],
            right: ['M4 7h16', 'M10 12h10', 'M7 17h13'],
            justify: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
          };
          return (
            <button key={align} title={`Align ${align}`} onClick={() => updateLayer(layer.id, { textAlign: align })}
              style={{
                flex: 1, height: 26, cursor: 'pointer',
                background: (layer.textAlign ?? 'left') === align ? '#0d99ff' : '#1a1a1a',
                border: '1px solid ' + ((layer.textAlign ?? 'left') === align ? '#0d99ff' : '#333'),
                borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                {paths[align].map((d, i) => <path key={i} d={d} />)}
              </svg>
            </button>
          );
        })}
      </div>

      {/* Vertical alignment + text decoration */}
      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        {(['top', 'middle', 'bottom'] as const).map(va => {
          const vpaths: Record<string, string[]> = {
            top: ['M4 4h16', 'M9 8v12', 'M15 8v8'],
            middle: ['M4 12h16', 'M9 6v12', 'M15 8v8'],
            bottom: ['M4 20h16', 'M9 4v16', 'M15 8v12'],
          };
          return (
            <button key={va} title={`Vertical ${va}`} onClick={() => updateLayer(layer.id, { verticalAlign: va })}
              style={{
                flex: 1, height: 26, cursor: 'pointer',
                background: (layer.verticalAlign ?? 'top') === va ? '#0d99ff' : '#1a1a1a',
                border: '1px solid ' + ((layer.verticalAlign ?? 'top') === va ? '#0d99ff' : '#333'),
                borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                {vpaths[va].map((d, i) => <path key={i} d={d} />)}
              </svg>
            </button>
          );
        })}
        <div style={{ width: 1, background: '#444', height: 18, flexShrink: 0 }} />
        {(['none', 'underline', 'line-through'] as const).map(dec => {
          const decLabels: Record<string, string> = { none: 'Ab', underline: 'U', 'line-through': 'S' };
          const decStyles: React.CSSProperties[] = [{}, { textDecoration: 'underline' }, { textDecoration: 'line-through' }];
          const idx = ['none', 'underline', 'line-through'].indexOf(dec);
          return (
            <button key={dec} title={dec === 'none' ? 'No decoration' : dec}
              onClick={() => updateLayer(layer.id, { textDecoration: dec })}
              style={{ ...btnStyle((layer.textDecoration ?? 'none') === dec), flex: 1, height: 26, ...decStyles[idx] }}>
              {decLabels[dec]}
            </button>
          );
        })}
      </div>

      {/* Text transform */}
      <div style={{ display: 'flex', gap: 3 }}>
        {(['none', 'uppercase', 'lowercase', 'capitalize'] as const).map((tt, i) => {
          const ttLabels = ['Ag', 'AG', 'ag', 'Aa'];
          return (
            <button key={tt} title={tt === 'none' ? 'No transform' : tt}
              onClick={() => updateLayer(layer.id, { textTransform: tt })}
              style={{
                ...btnStyle((layer.textTransform ?? 'none') === tt),
                flex: 1, height: 26, fontSize: 10,
                textTransform: tt as React.CSSProperties['textTransform'],
              }}>
              {ttLabels[i]}
            </button>
          );
        })}
      </div>

      {/* Text resize mode */}
      <select
        value={(layer as FigmaLayer & { textResize?: string }).textResize ?? 'fixed'}
        onChange={e => updateLayer(layer.id, { textResize: e.target.value as FigmaLayer['textResize'] })}
        style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 4, color: '#ebebeb', fontSize: 11, padding: '2px 4px', outline: 'none' }}
      >
        <option value="auto-width">Auto Width</option>
        <option value="auto-height">Auto Height</option>
        <option value="fixed">Fixed</option>
      </select>

      {/* Text style apply/save */}
      {textStyles.length > 0 && (
        <select
          defaultValue=""
          onChange={e => { if (e.target.value) { applyTextStyle(layer.id, e.target.value); (e.target as HTMLSelectElement).value = ''; } }}
          style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 4, color: '#888', fontSize: 11, padding: '2px 4px', outline: 'none' }}
        >
          <option value="" disabled>Apply text style…</option>
          {textStyles.map(ts => (
            <option key={ts.id} value={ts.id}>{ts.name} ({ts.fontFamily} {ts.fontSize}px)</option>
          ))}
        </select>
      )}
      <div style={{ paddingTop: 6, borderTop: '1px solid #2e2e2e' }}>
        <SaveStyleButton label="Save text style" onSave={(name) => saveTextStyle(name, layer)} />
      </div>
    </div>
  );
}

// ── Binding badge (shows bound expression with clear button) ────

function BindingBadge({ value, onClear }: { value: string; onClear: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      background: 'rgba(13,153,255,0.12)', border: '1px solid rgba(13,153,255,0.3)',
      borderRadius: 4, padding: '2px 6px', flex: 1, minWidth: 0,
    }}>
      <span style={{ color: '#0d99ff', fontSize: 10 }}>⚡</span>
      <span style={{
        fontFamily: 'monospace', fontSize: 10, color: '#7bcfff',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
      }}>
        {value}
      </span>
      <button
        onClick={onClear}
        style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 11, padding: 0, lineHeight: 1 }}
        title="Remove binding"
      >
        ✕
      </button>
    </div>
  );
}

// ── Bind button (⚡ trigger to open BindingPicker) ───────────────

function BindButton({
  prop, layerId, currentBinding, onSelect: onSelectOverride,
}: {
  prop: string; layerId: string; currentBinding?: string;
  onSelect?: (expr: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | undefined>();
  const { setBinding } = useFigmaStore();
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleSelect = onSelectOverride ?? ((expr: string) => setBinding(layerId, prop, expr));

  return (
    <>
      <button
        ref={btnRef}
        onClick={e => {
          e.stopPropagation();
          setAnchorRect(btnRef.current?.getBoundingClientRect());
          setOpen(o => !o);
        }}
        title={currentBinding ? `Bound: ${currentBinding}` : `Bind ${prop} to data`}
        style={{
          background: currentBinding ? 'rgba(13,153,255,0.15)' : 'none',
          border: `1px solid ${currentBinding ? 'rgba(13,153,255,0.4)' : '#333'}`,
          borderRadius: 3, cursor: 'pointer', padding: '1px 5px',
          fontSize: 11, color: currentBinding ? '#0d99ff' : '#555',
          flexShrink: 0,
        }}
      >
        ⚡
      </button>
      {open && (
        <BindingPicker
          anchorRect={anchorRect}
          currentValue={currentBinding}
          layerId={layerId}
          onSelect={handleSelect}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// ── RepeatFor section (B3) ───────────────────────────────────────

function RepeatForSection({ layer }: { layer: FigmaLayer }) {
  const { setRepeatFor } = useFigmaStore();
  const rf = layer.repeatFor;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | undefined>();
  const btnRef = useRef<HTMLButtonElement>(null);

  if (!rf) {
    return (
      <button
        ref={btnRef}
        onClick={() => {
          setAnchorRect(btnRef.current?.getBoundingClientRect());
          setPickerOpen(true);
        }}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, width: '100%',
          background: 'none', border: '1px dashed #333', borderRadius: 4,
          cursor: 'pointer', color: '#888', fontSize: 11, padding: '6px 8px',
          boxSizing: 'border-box',
        }}
      >
        <span style={{ fontSize: 13 }}>⟳</span> Repeat for data list
        {pickerOpen && (
          <BindingPicker
            anchorRect={anchorRect}
            layerId={layer.id}
            onSelect={expr => setRepeatFor(layer.id, { items: expr, as: 'item' })}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div>
        <div style={{ fontSize: 10, color: '#666', marginBottom: 3 }}>Data source</div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <BindingBadge
            value={rf.items}
            onClear={() => setRepeatFor(layer.id, null)}
          />
          <button
            ref={btnRef}
            onClick={() => {
              setAnchorRect(btnRef.current?.getBoundingClientRect());
              setPickerOpen(true);
            }}
            style={{
              background: 'rgba(13,153,255,0.1)', border: '1px solid rgba(13,153,255,0.3)',
              borderRadius: 3, cursor: 'pointer', padding: '2px 6px',
              fontSize: 11, color: '#0d99ff', flexShrink: 0,
            }}
          >
            ⚡
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <div>
          <div style={{ fontSize: 10, color: '#666', marginBottom: 3 }}>Item variable</div>
          <input
            value={rf.as}
            onChange={e => setRepeatFor(layer.id, { ...rf, as: e.target.value || 'item' })}
            style={{
              width: '100%', background: '#1a1a1a', border: '1px solid #333',
              borderRadius: 4, color: '#ccc', fontSize: 11, padding: '4px 6px',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#666', marginBottom: 3 }}>Key field</div>
          <input
            value={rf.key ?? ''}
            placeholder="item.id"
            onChange={e => setRepeatFor(layer.id, { ...rf, key: e.target.value || undefined })}
            style={{
              width: '100%', background: '#1a1a1a', border: '1px solid #333',
              borderRadius: 4, color: '#ccc', fontSize: 11, padding: '4px 6px',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      <div style={{ fontSize: 10, color: '#555', background: 'rgba(255,255,255,0.03)', borderRadius: 4, padding: '4px 8px' }}>
        Children use <code style={{ color: '#7bcfff', fontFamily: 'monospace' }}>${rf.as}.field</code> in bindings
      </div>

      <button
        onClick={() => setRepeatFor(layer.id, null)}
        style={{
          background: 'none', border: '1px solid #333', borderRadius: 4,
          color: '#666', fontSize: 11, padding: '3px 8px', cursor: 'pointer',
        }}
      >
        Remove repeat
      </button>

      {pickerOpen && (
        <BindingPicker
          anchorRect={anchorRect}
          currentValue={rf.items}
          layerId={layer.id}
          onSelect={expr => { setRepeatFor(layer.id, { items: expr, as: rf.as ?? 'item', key: rf.key }); setPickerOpen(false); }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

// ── Save style button ───────────────────────────────────────────

function SaveStyleButton({ label, onSave }: { label: string; onSave: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');

  if (editing) {
    return (
      <div style={{ display: 'flex', gap: 4, flex: 1 }}>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Style name…"
          onKeyDown={e => {
            if (e.key === 'Enter' && name.trim()) { onSave(name.trim()); setEditing(false); setName(''); }
            if (e.key === 'Escape') { setEditing(false); setName(''); }
          }}
          style={{ flex: 1, background: '#0d0d0d', border: '1px solid #0d99ff', borderRadius: 4, color: '#ebebeb', fontSize: 11, padding: '3px 6px', outline: 'none' }}
        />
        <button
          onClick={() => { if (name.trim()) { onSave(name.trim()); setEditing(false); setName(''); } }}
          style={{ background: '#0d99ff', border: 'none', borderRadius: 4, color: '#fff', fontSize: 11, padding: '3px 8px', cursor: 'pointer' }}
        >
          Save
        </button>
        <button onClick={() => { setEditing(false); setName(''); }}
          style={{ background: 'none', border: '1px solid #333', borderRadius: 4, color: '#888', fontSize: 11, padding: '3px 6px', cursor: 'pointer' }}>
          ✕
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: '1px solid #333', borderRadius: 4, cursor: 'pointer', color: '#888', fontSize: 11, padding: '3px 8px' }}
    >
      <Plus size={11} /> {label}
    </button>
  );
}

// ── Auto layout section ─────────────────────────────────────────

function AutoLayoutSection({ layer }: { layer: FigmaLayer }) {
  const { setAutoLayout, updateAutoLayout } = useFigmaStore();
  const al = layer.autoLayout;

  if (!al) {
    return (
      <button
        onClick={() => setAutoLayout(layer.id, {
          direction: 'horizontal', gap: 8,
          paddingTop: 8, paddingRight: 8, paddingBottom: 8, paddingLeft: 8,
          primaryAlign: 'start', counterAlign: 'start',
          widthMode: 'fixed', heightMode: 'fixed', wrap: false,
        })}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: '1px solid #333', borderRadius: 4,
          cursor: 'pointer', color: '#888', fontSize: 11, padding: '4px 8px', width: '100%',
        }}
      >
        <Plus size={11} /> Add auto layout
      </button>
    );
  }

  const U = <K extends keyof AutoLayout>(field: K, val: AutoLayout[K]) =>
    updateAutoLayout(layer.id, { [field]: val } as Partial<AutoLayout>);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Direction + wrap + remove */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ display: 'flex', background: '#1a1a1a', border: '1px solid #333', borderRadius: 4, overflow: 'hidden', flex: 1 }}>
          {(['horizontal', 'vertical'] as const).map(d => (
            <button key={d} onClick={() => U('direction', d)}
              style={{
                flex: 1, padding: '3px 0', border: 'none', cursor: 'pointer', fontSize: 13,
                background: al.direction === d ? '#0d99ff' : 'transparent',
                color: al.direction === d ? '#fff' : '#888',
              }}
              title={d.charAt(0).toUpperCase() + d.slice(1)}
            >
              {d === 'horizontal' ? '⇄' : '⇅'}
            </button>
          ))}
        </div>
        <button onClick={() => U('wrap', !al.wrap)} title="Wrap"
          style={{
            padding: '3px 6px', border: '1px solid #333', borderRadius: 4, cursor: 'pointer',
            background: al.wrap ? 'rgba(13,153,255,0.15)' : '#1a1a1a',
            color: al.wrap ? '#0d99ff' : '#888', fontSize: 11,
          }}
        >↩</button>
        <button onClick={() => setAutoLayout(layer.id, null)} title="Remove auto layout"
          style={{ padding: '3px 6px', border: '1px solid #333', borderRadius: 4, cursor: 'pointer', background: '#1a1a1a', color: '#666', fontSize: 11 }}
        >
          <Minus size={11} />
        </button>
      </div>

      {/* Gap */}
      <InspectorInput label="Gap" value={al.gap} onChange={v => U('gap', Math.max(0, v))} />

      {/* Padding */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        <InspectorInput label="↑" value={al.paddingTop} onChange={v => U('paddingTop', Math.max(0, v))} />
        <InspectorInput label="↓" value={al.paddingBottom} onChange={v => U('paddingBottom', Math.max(0, v))} />
        <InspectorInput label="←" value={al.paddingLeft} onChange={v => U('paddingLeft', Math.max(0, v))} />
        <InspectorInput label="→" value={al.paddingRight} onChange={v => U('paddingRight', Math.max(0, v))} />
      </div>

      {/* Primary alignment */}
      <div>
        <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>
          {al.direction === 'horizontal' ? 'Horizontal' : 'Vertical'} align
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['start', 'center', 'end', 'space-between'] as const).map(a => (
            <button key={a} onClick={() => U('primaryAlign', a)}
              style={{
                flex: 1, padding: '3px 0', border: '1px solid #333', borderRadius: 3,
                cursor: 'pointer',
                background: al.primaryAlign === a ? 'rgba(13,153,255,0.2)' : '#1a1a1a',
                color: al.primaryAlign === a ? '#0d99ff' : '#666', fontSize: 9,
              }}
            >
              {a === 'start' ? '⤙' : a === 'center' ? '⬝' : a === 'end' ? '⤚' : '⇹'}
            </button>
          ))}
        </div>
      </div>

      {/* Counter alignment */}
      <div>
        <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>
          {al.direction === 'horizontal' ? 'Vertical' : 'Horizontal'} align
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['start', 'center', 'end'] as const).map(a => (
            <button key={a} onClick={() => U('counterAlign', a)}
              style={{
                flex: 1, padding: '3px 0', border: '1px solid #333', borderRadius: 3,
                cursor: 'pointer',
                background: al.counterAlign === a ? 'rgba(13,153,255,0.2)' : '#1a1a1a',
                color: al.counterAlign === a ? '#0d99ff' : '#666', fontSize: 9,
              }}
            >
              {a === 'start' ? '⤒' : a === 'center' ? '⬝' : '⤓'}
            </button>
          ))}
        </div>
      </div>

      {/* Frame sizing */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        <div>
          <div style={{ fontSize: 10, color: '#666', marginBottom: 3 }}>W</div>
          <select value={al.widthMode} onChange={e => U('widthMode', e.target.value as AutoLayout['widthMode'])}
            style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: 4, color: '#ccc', fontSize: 11, padding: '3px 4px' }}
          >
            <option value="fixed">Fixed</option>
            <option value="hug">Hug contents</option>
          </select>
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#666', marginBottom: 3 }}>H</div>
          <select value={al.heightMode} onChange={e => U('heightMode', e.target.value as AutoLayout['heightMode'])}
            style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: 4, color: '#ccc', fontSize: 11, padding: '3px 4px' }}
          >
            <option value="fixed">Fixed</option>
            <option value="hug">Hug contents</option>
          </select>
        </div>
      </div>
    </div>
  );
}

// ── Layout grid section ─────────────────────────────────────────

function LayoutGridSection({ layer }: { layer: FigmaLayer }) {
  const { addLayoutGrid, updateLayoutGrid, removeLayoutGrid } = useFigmaStore();
  const grids = layer.layoutGrids ?? [];

  return (
    <div>
      {grids.map(grid => (
        <div key={grid.id} style={{ marginBottom: 10, padding: 6, background: '#1e1e1e', borderRadius: 6, border: '1px solid #2e2e2e' }}>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 6 }}>
            <select
              value={grid.type}
              onChange={e => updateLayoutGrid(layer.id, grid.id, { type: e.target.value as LayoutGrid['type'] })}
              style={{ flex: 1, background: '#1a1a1a', border: '1px solid #333', borderRadius: 4, color: '#ebebeb', fontSize: 11, padding: '3px 4px' }}
            >
              <option value="columns">Columns</option>
              <option value="rows">Rows</option>
              <option value="grid">Grid</option>
            </select>
            <button
              onClick={() => updateLayoutGrid(layer.id, grid.id, { visible: !grid.visible })}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: grid.visible ? '#0d99ff' : '#555', fontSize: 11, padding: 2 }}
            >
              {grid.visible ? '●' : '○'}
            </button>
            <input
              type="color"
              value={grid.color}
              onChange={e => updateLayoutGrid(layer.id, grid.id, { color: e.target.value })}
              style={{ width: 20, height: 20, padding: 0, border: '1px solid #444', borderRadius: 3, cursor: 'pointer', background: 'none' }}
            />
            <button
              onClick={() => removeLayoutGrid(layer.id, grid.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', padding: 2 }}
            >
              <Minus size={12} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {grid.type !== 'grid' && (
              <InspectorInput label="N" value={grid.count} onChange={v => updateLayoutGrid(layer.id, grid.id, { count: Math.max(1, Math.round(v)) })} />
            )}
            {grid.type === 'grid' && (
              <InspectorInput label="sz" value={grid.size} onChange={v => updateLayoutGrid(layer.id, grid.id, { size: Math.max(1, v) })} />
            )}
            <InspectorInput label="g" value={grid.gutter} onChange={v => updateLayoutGrid(layer.id, grid.id, { gutter: Math.max(0, v) })} />
            {grid.type !== 'grid' && (
              <InspectorInput label="m" value={grid.margin} onChange={v => updateLayoutGrid(layer.id, grid.id, { margin: Math.max(0, v) })} />
            )}
            <InspectorInput label="α" unit="%" value={Math.round(grid.opacity * 100)} onChange={v => updateLayoutGrid(layer.id, grid.id, { opacity: Math.max(0, Math.min(1, v / 100)) })} />
          </div>
        </div>
      ))}
      <button
        onClick={() => addLayoutGrid(layer.id)}
        style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 11, padding: 0 }}
      >
        <Plus size={12} /> Layout grid
      </button>
    </div>
  );
}

// ── SVG export helpers ──────────────────────────────────────────

function generateSVG(layer: FigmaLayer): string {
  const w = layer.width || 100;
  const h = layer.height || 100;

  function layerToSVG(l: FigmaLayer, offsetX = 0, offsetY = 0): string {
    const x = l.x - offsetX;
    const y = l.y - offsetY;
    const fill = l.fills.find(f => f.visible !== false);
    const fillColor = fill?.type === 'solid' ? fill.color : 'transparent';
    const stroke = l.strokes.find(s => s.visible !== false);
    const strokeAttr = stroke ? `stroke="${stroke.color}" stroke-width="${stroke.weight}"` : '';
    const opacityAttr = l.opacity !== 1 ? `opacity="${l.opacity}"` : '';
    const transformAttr = l.rotation ? `transform="rotate(${l.rotation} ${x + l.width / 2} ${y + l.height / 2})"` : '';
    const rxAttr = l.cornerRadius ? `rx="${l.cornerRadius}"` : '';

    if (l.type === 'text') {
      const textFill = l.fills.find(f => f.visible !== false);
      const textColor = textFill?.color ?? '#000000';
      const safeText = (l.text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<text x="${x}" y="${y + (l.fontSize ?? 14)}" font-family="${l.fontFamily ?? 'Inter'}" font-size="${l.fontSize ?? 14}" font-weight="${l.fontWeight ?? 'normal'}" fill="${textColor}" ${opacityAttr} ${transformAttr}>${safeText}</text>`;
    }
    if (l.type === 'ellipse') {
      const cx = x + l.width / 2;
      const cy = y + l.height / 2;
      return `<ellipse cx="${cx}" cy="${cy}" rx="${l.width / 2}" ry="${l.height / 2}" fill="${fillColor}" ${strokeAttr} ${opacityAttr} ${transformAttr} />`;
    }
    if (l.type === 'line') {
      return `<line x1="${x}" y1="${y}" x2="${x + l.width}" y2="${y}" ${strokeAttr || `stroke="${fillColor}"`} stroke-width="${l.strokes[0]?.weight ?? 1}" ${opacityAttr} />`;
    }
    const childrenSVG = l.children?.map(ch => layerToSVG(ch, offsetX, offsetY)).join('') ?? '';
    return `<rect x="${x}" y="${y}" width="${l.width}" height="${Math.max(1, l.height)}" fill="${fillColor}" ${strokeAttr} ${opacityAttr} ${rxAttr} ${transformAttr} />${childrenSVG}`;
  }

  const content = layer.type === 'frame'
    ? (layer.children ?? []).map(ch => layerToSVG(ch, layer.x, layer.y)).join('')
    : layerToSVG(layer);

  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n${content}\n</svg>`;
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Design tab ──────────────────────────────────────────────────

function DesignTab() {
  const { selection, layers, activePageId, updateLayer, setLayoutSizing, setBinding, removeBinding, setConditionalRender, setLayerEvent, actionFlows } = useFigmaStore();
  const currentLayers = layers[activePageId] ?? [];

  const selectedLayer = selection.length === 1
    ? (function find(arr: typeof currentLayers): FigmaLayer | null {
        for (const l of arr) {
          if (l.id === selection[0]) return l;
          if (l.children) { const r = find(l.children); if (r) return r; }
        }
        return null;
      })(currentLayers)
    : null;

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    alignment: true, transform: true, layer: true, typography: true,
    fill: true, stroke: false, effects: false, export: false, layoutGrid: false,
    autoLayout: true, layoutSizing: false, repeat: false, bindings: false, events: false,
  });
  const toggle = (k: string) => setExpanded(s => ({ ...s, [k]: !s[k] }));

  if (selection.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#555', fontSize: 12, padding: 16, lineHeight: 1.5 }}>
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" style={{ margin: '0 auto 10px', display: 'block', opacity: 0.5 }}>
            <rect x="4" y="4" width="10" height="10" rx="1" stroke="#666" strokeWidth="1.5" />
            <rect x="18" y="4" width="10" height="10" rx="1" stroke="#666" strokeWidth="1.5" />
            <rect x="4" y="18" width="10" height="10" rx="1" stroke="#666" strokeWidth="1.5" />
            <rect x="18" y="18" width="10" height="10" rx="1" stroke="#666" strokeWidth="1.5" />
          </svg>
          Select a layer<br />to edit properties
        </div>
      </div>
    );
  }

  if (selection.length > 1) {
    return (
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #2a2a2a', fontSize: 11, color: '#888' }}>
          {selection.length} layers selected
        </div>
        <Section label="Alignment" expanded={!!expanded.alignment} onToggle={() => toggle('alignment')}>
          <AlignmentSection layer={null} updateLayer={updateLayer} />
        </Section>
      </div>
    );
  }

  if (!selectedLayer) return null;

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      {selectedLayer.type === 'component' && (
        <div style={{
          margin: '8px 10px', padding: '8px 10px',
          background: 'rgba(151, 71, 255, 0.1)', border: '1px solid rgba(151, 71, 255, 0.3)',
          borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 14, color: '#9747ff' }}>◆</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#9747ff', fontWeight: 600 }}>Main Component</div>
            <div style={{ fontSize: 10, color: '#666', marginTop: 1 }}>Edit to update all instances</div>
          </div>
          <button
            onClick={() => useFigmaStore.getState().createInstance(selectedLayer.id)}
            style={{
              background: 'rgba(151, 71, 255, 0.2)', border: '1px solid rgba(151, 71, 255, 0.4)',
              borderRadius: 4, color: '#9747ff', fontSize: 10, padding: '3px 8px', cursor: 'pointer',
            }}
          >+ Instance</button>
        </div>
      )}
      {selectedLayer.type === 'instance' && selectedLayer.componentId && (
        <div style={{
          margin: '8px 10px', padding: '8px 10px',
          background: 'rgba(123, 97, 255, 0.1)', border: '1px solid rgba(123, 97, 255, 0.3)',
          borderRadius: 6,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 14, color: '#7b61ff' }}>◇</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: '#7b61ff', fontWeight: 600 }}>Instance</div>
              <div style={{ fontSize: 10, color: '#666', marginTop: 1 }}>
                {useFigmaStore.getState().components[selectedLayer.componentId]?.name ?? 'Unknown component'}
              </div>
            </div>
          </div>
          <button
            onClick={() => useFigmaStore.getState().detachInstance(selectedLayer.id)}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid #333',
              borderRadius: 4, color: '#888', fontSize: 11, padding: '4px', cursor: 'pointer',
            }}
          >Detach Instance</button>
        </div>
      )}

      <Section label="Alignment" expanded={!!expanded.alignment} onToggle={() => toggle('alignment')}>
        <AlignmentSection layer={selectedLayer} updateLayer={updateLayer} />
      </Section>

      <Section
        label="Transform"
        expanded={!!expanded.transform}
        onToggle={() => toggle('transform')}
        action={
          (selectedLayer.type === 'frame' || selectedLayer.type === 'component')
            ? <FramePresetsButton layerId={selectedLayer.id} updateLayer={updateLayer} />
            : undefined
        }
      >
        <TransformSection layer={selectedLayer} updateLayer={updateLayer} />
      </Section>

      <Section label="Layer" expanded={!!expanded.layer} onToggle={() => toggle('layer')}>
        <LayerSection layer={selectedLayer} updateLayer={updateLayer} />
      </Section>

      {selectedLayer.type === 'text' && (
        <Section label="Typography" expanded={!!expanded.typography} onToggle={() => toggle('typography')}>
          <TypographySection layer={selectedLayer} updateLayer={updateLayer} />
        </Section>
      )}

      {(selectedLayer.type === 'frame' || selectedLayer.type === 'component' || selectedLayer.type === 'instance') && (
        <Section label="Auto Layout" expanded={!!expanded.autoLayout} onToggle={() => toggle('autoLayout')}>
          <AutoLayoutSection layer={selectedLayer} />
        </Section>
      )}

      {(selectedLayer.type === 'frame' || selectedLayer.type === 'component' ||
        selectedLayer.type === 'instance' || selectedLayer.type === 'group' ||
        selectedLayer.type === 'section') && (
        <Section label="Repeat" expanded={!!expanded.repeat} onToggle={() => toggle('repeat')}>
          <RepeatForSection layer={selectedLayer} />
        </Section>
      )}

      <Section label="Bindings" expanded={!!expanded.bindings} onToggle={() => toggle('bindings')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Conditional render */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: '#888' }}>Visible when</span>
              <BindButton
                prop="conditionalRender"
                layerId={selectedLayer.id}
                currentBinding={selectedLayer.conditionalRender}
                onSelect={expr => setConditionalRender(selectedLayer.id, expr)}
              />
            </div>
            {selectedLayer.conditionalRender && (
              <BindingBadge
                value={selectedLayer.conditionalRender}
                onClear={() => setConditionalRender(selectedLayer.id, null)}
              />
            )}
          </div>

          {/* Text content binding (text layers only) */}
          {selectedLayer.type === 'text' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: '#888' }}>Text content</span>
                <BindButton
                  prop="content.text"
                  layerId={selectedLayer.id}
                  currentBinding={selectedLayer.bindings?.['content.text']}
                />
              </div>
              {selectedLayer.bindings?.['content.text'] ? (
                <BindingBadge
                  value={selectedLayer.bindings['content.text']}
                  onClear={() => removeBinding(selectedLayer.id, 'content.text')}
                />
              ) : (
                <div style={{
                  background: '#1a1a1a', border: '1px solid #2a2a2a',
                  borderRadius: 4, padding: '4px 8px', fontSize: 11, color: '#555',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {selectedLayer.text ? `"${selectedLayer.text.slice(0, 32)}${selectedLayer.text.length > 32 ? '…' : ''}"` : 'No text'}
                </div>
              )}
            </div>
          )}

          {/* Image src binding (image/rect with image fill) */}
          {(selectedLayer.type === 'image' || selectedLayer.fills.some(f => f.type === 'image')) && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: '#888' }}>Image src</span>
                <BindButton
                  prop="content.imageUrl"
                  layerId={selectedLayer.id}
                  currentBinding={selectedLayer.bindings?.['content.imageUrl']}
                />
              </div>
              {selectedLayer.bindings?.['content.imageUrl'] && (
                <BindingBadge
                  value={selectedLayer.bindings['content.imageUrl']}
                  onClear={() => removeBinding(selectedLayer.id, 'content.imageUrl')}
                />
              )}
            </div>
          )}

          {/* Show existing bindings summary */}
          {selectedLayer.bindings && Object.keys(selectedLayer.bindings).length > 0 && (
            <div style={{ borderTop: '1px solid #2a2a2a', paddingTop: 6 }}>
              <div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>All bindings</div>
              {Object.entries(selectedLayer.bindings).map(([prop, expr]) => (
                <div key={prop} style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontSize: 10, color: '#555', minWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prop}</span>
                  <BindingBadge value={expr} onClear={() => removeBinding(selectedLayer.id, prop)} />
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      {selectedLayer.type !== 'frame' && selectedLayer.type !== 'section' && selectedLayer.type !== 'component' && selectedLayer.type !== 'instance' && (
        <Section label="Layout" expanded={!!expanded.layoutSizing} onToggle={() => toggle('layoutSizing')}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: '0 2px' }}>
            <div>
              <div style={{ fontSize: 10, color: '#666', marginBottom: 3 }}>Width</div>
              <select
                value={selectedLayer.layoutSizing?.horizontal ?? 'fixed'}
                onChange={e => setLayoutSizing(selectedLayer.id, {
                  horizontal: e.target.value as 'fixed' | 'fill' | 'hug',
                  vertical: selectedLayer.layoutSizing?.vertical ?? 'fixed',
                })}
                style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: 4, color: '#ccc', fontSize: 11, padding: '3px 4px' }}
              >
                <option value="fixed">Fixed</option>
                <option value="fill">Fill container</option>
                <option value="hug">Hug contents</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#666', marginBottom: 3 }}>Height</div>
              <select
                value={selectedLayer.layoutSizing?.vertical ?? 'fixed'}
                onChange={e => setLayoutSizing(selectedLayer.id, {
                  horizontal: selectedLayer.layoutSizing?.horizontal ?? 'fixed',
                  vertical: e.target.value as 'fixed' | 'fill' | 'hug',
                })}
                style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: 4, color: '#ccc', fontSize: 11, padding: '3px 4px' }}
              >
                <option value="fixed">Fixed</option>
                <option value="fill">Fill container</option>
                <option value="hug">Hug contents</option>
              </select>
            </div>
          </div>
        </Section>
      )}

      <Section label="Fill" expanded={!!expanded.fill} onToggle={() => toggle('fill')}>
        <FillSection layer={selectedLayer} updateLayer={updateLayer} />
      </Section>

      <Section label="Stroke" expanded={!!expanded.stroke} onToggle={() => toggle('stroke')}>
        <StrokeSection layer={selectedLayer} updateLayer={updateLayer} />
      </Section>

      {(selectedLayer.type === 'frame' || selectedLayer.type === 'section' || selectedLayer.type === 'component' || selectedLayer.type === 'instance') && (
        <Section label="Layout Grid" expanded={!!expanded.layoutGrid} onToggle={() => toggle('layoutGrid')}>
          <LayoutGridSection layer={selectedLayer} />
        </Section>
      )}

      <Section label="Effects" expanded={!!expanded.effects} onToggle={() => toggle('effects')}>
        <EffectsSection layer={selectedLayer} updateLayer={updateLayer} />
      </Section>

      <Section label="Export" expanded={!!expanded.export} onToggle={() => toggle('export')}>
        <ExportSection layer={selectedLayer} updateLayer={updateLayer} />
      </Section>

      <Section label="Events" expanded={!!expanded.events} onToggle={() => toggle('events')}>
        {(() => {
          const availableEvents = LAYER_EVENTS[selectedLayer.type] ?? ['onClick'];
          return (
            <div>
              {availableEvents.map(eventName => {
                const attached = selectedLayer.layerEvents?.[eventName] ?? [];
                return (
                  <div key={eventName} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 10, color: '#888', fontWeight: 600, fontFamily: 'monospace' }}>{eventName}</span>
                      {attached.length === 0 && <span style={{ fontSize: 9, color: '#444' }}>no action</span>}
                    </div>
                    {attached.map((flowId, idx) => {
                      const flow = actionFlows.find(f => f.id === flowId);
                      if (!flow) return null;
                      return (
                        <div key={flowId} style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          background: 'rgba(13,153,255,0.1)', border: '1px solid rgba(13,153,255,0.25)',
                          borderRadius: 4, padding: '3px 7px', marginBottom: 3,
                        }}>
                          <span style={{ flex: 1, fontSize: 10, color: '#7bcfff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {flow.name}
                          </span>
                          <button
                            onClick={() => setLayerEvent(selectedLayer.id, eventName, attached.filter((_, i) => i !== idx))}
                            style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 11, padding: 0, lineHeight: 1 }}
                          >✕</button>
                        </div>
                      );
                    })}
                    <select
                      value=""
                      onChange={e => { if (e.target.value) setLayerEvent(selectedLayer.id, eventName, [...attached, e.target.value]); }}
                      style={{
                        width: '100%', background: '#0d0d0d', border: '1px dashed #333',
                        borderRadius: 4, color: '#555', fontSize: 10, padding: '4px 6px',
                        cursor: 'pointer', outline: 'none',
                      }}
                    >
                      <option value="">+ Attach a flow…</option>
                      {actionFlows
                        .filter(f => !attached.includes(f.id))
                        .map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                );
              })}
              {actionFlows.length === 0 && (
                <div style={{ fontSize: 10, color: '#444', fontStyle: 'italic', padding: '4px 0' }}>
                  No flows yet — create one in the Logic tab.
                </div>
              )}
            </div>
          );
        })()}
      </Section>
    </div>
  );
}

// ── Prototype tab ───────────────────────────────────────────────

// ── Interaction row ─────────────────────────────────────────────

function InteractionRow({
  interaction, layers, onUpdate, onRemove,
}: {
  interaction: Interaction;
  layers: FigmaLayer[];
  onUpdate: (partial: Partial<Interaction>) => void;
  onRemove: () => void;
}) {
  const allFrames = layers.filter(l => l.type === 'frame' || l.type === 'component');
  const sel = { flex: 1, background: '#0d0d0d', border: '1px solid #333', borderRadius: 3, color: '#ccc', fontSize: 11, padding: '2px 4px' } as const;
  const row = { display: 'flex', gap: 4 } as const;
  const lbl = { fontSize: 10, color: '#666', width: 50, display: 'flex', alignItems: 'center' } as const;
  const inp = { flex: 1, background: '#0d0d0d', border: '1px solid #333', borderRadius: 3, color: '#ccc', fontSize: 11, padding: '2px 6px' } as const;

  const isOverlay = interaction.action === 'openOverlay' || interaction.action === 'swapOverlay';
  const needsTarget = interaction.action === 'navigate' || isOverlay || interaction.action === 'scrollTo';

  return (
    <div style={{ background: '#1e1e1e', border: '1px solid #2e2e2e', borderRadius: 6, padding: 8, marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: '#ebebeb', fontWeight: 600 }}>On {interaction.trigger}</span>
        <button onClick={onRemove} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 13 }}>✕</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* Trigger */}
        <div style={row}>
          <label style={lbl}>Trigger</label>
          <select value={interaction.trigger} onChange={e => onUpdate({ trigger: e.target.value as InteractionTrigger })} style={sel}>
            <option value="click">Click</option>
            <option value="hover">Hover</option>
            <option value="mouseLeave">Mouse leave</option>
            <option value="press">Mouse down</option>
            <option value="drag">Drag</option>
            <option value="afterDelay">After delay</option>
            <option value="keyDown">Key down</option>
            <option value="scroll">Scroll</option>
          </select>
        </div>
        {interaction.trigger === 'afterDelay' && (
          <div style={row}>
            <label style={lbl}>Delay</label>
            <input type="number" value={interaction.delay ?? 1000} min={100} max={10000} step={100}
              onChange={e => onUpdate({ delay: Number(e.target.value) })} style={inp} />
            <span style={{ fontSize: 10, color: '#555', display: 'flex', alignItems: 'center' }}>ms</span>
          </div>
        )}
        {interaction.trigger === 'keyDown' && (
          <div style={row}>
            <label style={lbl}>Key</label>
            <input type="text" placeholder="e.g. Enter" value={interaction.keyCode ?? ''}
              onChange={e => onUpdate({ keyCode: e.target.value })} style={inp} />
          </div>
        )}

        {/* Action */}
        <div style={row}>
          <label style={lbl}>Action</label>
          <select value={interaction.action} onChange={e => onUpdate({ action: e.target.value as InteractionAction })} style={sel}>
            <option value="navigate">Navigate to</option>
            <option value="openOverlay">Open overlay</option>
            <option value="swapOverlay">Swap overlay</option>
            <option value="closeOverlay">Close overlay</option>
            <option value="back">Go back</option>
            <option value="scrollTo">Scroll to</option>
            <option value="openUrl">Open URL</option>
          </select>
        </div>

        {/* Target frame */}
        {needsTarget && (
          <div style={row}>
            <label style={lbl}>To</label>
            <select value={interaction.targetFrameId ?? ''} onChange={e => onUpdate({ targetFrameId: e.target.value || undefined })} style={sel}>
              <option value="">— select frame —</option>
              {allFrames.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
        )}

        {/* URL */}
        {interaction.action === 'openUrl' && (
          <div style={row}>
            <label style={lbl}>URL</label>
            <input type="url" placeholder="https://" value={interaction.url ?? ''}
              onChange={e => onUpdate({ url: e.target.value })} style={inp} />
          </div>
        )}

        {/* Overlay options */}
        {isOverlay && (
          <>
            <div style={row}>
              <label style={lbl}>Position</label>
              <select value={interaction.overlayPosition ?? 'center'} onChange={e => onUpdate({ overlayPosition: e.target.value as OverlayPosition })} style={sel}>
                <option value="center">Center</option>
                <option value="top-left">Top left</option>
                <option value="top-right">Top right</option>
                <option value="bottom-left">Bottom left</option>
                <option value="bottom-right">Bottom right</option>
                <option value="origin">On click</option>
              </select>
            </div>
            <div style={row}>
              <label style={lbl}>Background</label>
              <select value={interaction.overlayBackground ?? 'none'} onChange={e => onUpdate({ overlayBackground: e.target.value as Interaction['overlayBackground'] })} style={sel}>
                <option value="none">None</option>
                <option value="dim">Dim</option>
                <option value="blur">Blur</option>
              </select>
            </div>
            {interaction.overlayBackground === 'dim' && (
              <div style={row}>
                <label style={lbl}>Opacity</label>
                <input type="range" min={0} max={100} value={Math.round((interaction.overlayBgOpacity ?? 0.4) * 100)}
                  onChange={e => onUpdate({ overlayBgOpacity: Number(e.target.value) / 100 })}
                  style={{ flex: 1, accentColor: '#0d99ff' }} />
                <span style={{ fontSize: 10, color: '#555', width: 28, textAlign: 'right' }}>{Math.round((interaction.overlayBgOpacity ?? 0.4) * 100)}%</span>
              </div>
            )}
            <div style={row}>
              <label style={{ ...lbl, width: 'auto', marginRight: 6 }}>
                <input type="checkbox" checked={interaction.overlayCloseOnClickOutside ?? true}
                  onChange={e => onUpdate({ overlayCloseOnClickOutside: e.target.checked })}
                  style={{ accentColor: '#0d99ff', marginRight: 4 }} />
                <span style={{ fontSize: 10, color: '#888' }}>Close on click outside</span>
              </label>
            </div>
          </>
        )}

        {/* Animation */}
        {interaction.action !== 'closeOverlay' && interaction.action !== 'openUrl' && interaction.action !== 'back' && (
          <div style={row}>
            <label style={lbl}>Anim</label>
            <select value={interaction.transition} onChange={e => onUpdate({ transition: e.target.value as TransitionType })} style={sel}>
              <option value="instant">Instant</option>
              <option value="dissolve">Dissolve</option>
              <option value="slide-left">Slide left</option>
              <option value="slide-right">Slide right</option>
              <option value="push-left">Push left</option>
              <option value="push-right">Push right</option>
              <option value="smart-animate">Smart animate</option>
            </select>
          </div>
        )}

        {/* Duration */}
        {interaction.transition !== 'instant' && interaction.action !== 'closeOverlay' && interaction.action !== 'openUrl' && (
          <div style={row}>
            <label style={lbl}>ms</label>
            <input type="number" value={interaction.duration} min={50} max={2000} step={50}
              onChange={e => onUpdate({ duration: Number(e.target.value) })} style={inp} />
          </div>
        )}

        {/* Easing */}
        {interaction.transition !== 'instant' && (
          <div style={row}>
            <label style={lbl}>Easing</label>
            <select value={interaction.easing ?? 'ease-out'} onChange={e => onUpdate({ easing: e.target.value as Interaction['easing'] })} style={sel}>
              <option value="ease-out">Ease out</option>
              <option value="ease-in">Ease in</option>
              <option value="ease-in-out">Ease in-out</option>
              <option value="linear">Linear</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Prototype tab ───────────────────────────────────────────────

function PrototypeTab() {
  const {
    selection, layers, activePageId,
    prototypeStartFrameId, setPreviewMode, setPrototypeStartFrame,
    addInteraction, updateInteraction, removeInteraction,
  } = useFigmaStore();
  const currentLayers = layers[activePageId] ?? [];
  const selectedLayer = selection.length === 1
    ? (function find(arr: typeof currentLayers): FigmaLayer | null {
        for (const l of arr) {
          if (l.id === selection[0]) return l;
          if (l.children) { const r = find(l.children); if (r) return r; }
        }
        return null;
      })(currentLayers)
    : null;

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {!selectedLayer ? (
        <div style={{ padding: 16, color: '#555', fontSize: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>⚡</div>
          Select a layer to add interactions
        </div>
      ) : (
        <>
          <div style={{ padding: '8px 10px 4px', borderBottom: '1px solid #2e2e2e' }}>
            <div style={{ fontSize: 11, color: '#888', fontWeight: 600, marginBottom: 8 }}>INTERACTIONS</div>
            {(selectedLayer.interactions ?? []).map(interaction => (
              <InteractionRow
                key={interaction.id}
                interaction={interaction}
                layers={currentLayers}
                onUpdate={(partial) => updateInteraction(selectedLayer.id, interaction.id, partial)}
                onRemove={() => removeInteraction(selectedLayer.id, interaction.id)}
              />
            ))}
            <button
              onClick={() => addInteraction(selectedLayer.id, {
                id: `int-${Date.now()}`, trigger: 'click', action: 'navigate',
                targetFrameId: undefined, transition: 'dissolve', duration: 300, easing: 'ease-out',
              })}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                background: 'none', border: '1px dashed #333', borderRadius: 4,
                cursor: 'pointer', color: '#888', fontSize: 11, padding: '6px 8px', marginTop: 6,
              }}
            >
              <Plus size={11} /> Add interaction
            </button>
          </div>
          {(selectedLayer.type === 'frame' || selectedLayer.type === 'component') && (
            <div style={{ padding: '8px 10px', borderBottom: '1px solid #2e2e2e' }}>
              <div style={{ fontSize: 11, color: '#888', fontWeight: 600, marginBottom: 6 }}>FLOW START POINT</div>
              <button
                onClick={() => setPrototypeStartFrame(prototypeStartFrameId === selectedLayer.id ? null : selectedLayer.id)}
                style={{
                  width: '100%', padding: '5px 8px', border: '1px solid',
                  borderColor: prototypeStartFrameId === selectedLayer.id ? '#0d99ff' : '#333',
                  borderRadius: 4, cursor: 'pointer', fontSize: 11,
                  background: prototypeStartFrameId === selectedLayer.id ? 'rgba(13,153,255,0.1)' : '#1a1a1a',
                  color: prototypeStartFrameId === selectedLayer.id ? '#0d99ff' : '#888',
                }}
              >
                {prototypeStartFrameId === selectedLayer.id ? '★ Flow start point' : '☆ Set as flow start'}
              </button>
            </div>
          )}
          <div style={{ padding: '8px 10px' }}>
            <button
              onClick={() => setPreviewMode(true)}
              style={{
                width: '100%', padding: '7px', background: '#0d99ff',
                border: 'none', borderRadius: 4, cursor: 'pointer', color: '#fff', fontSize: 12, fontWeight: 600,
              }}
            >
              ▶ Present
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Inspect tab ─────────────────────────────────────────────────

// ── Inspect tab helpers ─────────────────────────────────────────

function generateCSS(layer: FigmaLayer): string {
  const lines: string[] = [];
  lines.push(`width: ${layer.width}px;`);
  lines.push(`height: ${layer.height}px;`);
  if (layer.cornerRadius) lines.push(`border-radius: ${layer.cornerRadius}px;`);
  if (layer.opacity !== 1) lines.push(`opacity: ${layer.opacity};`);
  if (layer.blendMode && layer.blendMode !== 'normal') lines.push(`mix-blend-mode: ${layer.blendMode};`);

  const fill = layer.fills.find(f => f.visible !== false);
  if (fill && fill.type !== 'none') {
    if (fill.type === 'solid') {
      const hex = fill.color;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      lines.push(fill.opacity < 1 ? `background: rgba(${r}, ${g}, ${b}, ${fill.opacity});` : `background: ${hex};`);
    } else if (fill.type === 'linear') {
      const stops = (fill.stops ?? []).map(s => `${s.color} ${Math.round(s.position * 100)}%`).join(', ');
      lines.push(`background: linear-gradient(${fill.gradientAngle ?? 90}deg, ${stops});`);
    } else if (fill.type === 'radial') {
      const stops = (fill.stops ?? []).map(s => `${s.color} ${Math.round(s.position * 100)}%`).join(', ');
      lines.push(`background: radial-gradient(circle, ${stops});`);
    } else if (fill.type === 'image') {
      lines.push(`background-size: ${fill.imageFit ?? 'cover'};`);
      lines.push(`background-position: center;`);
    }
  }

  const stroke = layer.strokes.find(s => s.visible !== false);
  if (stroke) {
    if (stroke.position === 'outside') lines.push(`outline: ${stroke.weight}px ${stroke.type} ${stroke.color};`);
    else lines.push(`border: ${stroke.weight}px ${stroke.type} ${stroke.color};`);
    lines.push(`box-sizing: border-box;`);
  }

  const shadows = layer.effects.filter(e => e.visible && (e.type === 'drop-shadow' || e.type === 'inner-shadow'));
  const blurs = layer.effects.filter(e => e.visible && (e.type === 'layer-blur' || e.type === 'background-blur'));
  if (shadows.length > 0) {
    const shadowStr = shadows.map(e => {
      const inset = e.type === 'inner-shadow' ? 'inset ' : '';
      const hex = e.color ?? '#000000';
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `${inset}${e.x}px ${e.y}px ${e.blur}px ${e.spread}px rgba(${r},${g},${b},${e.opacity})`;
    }).join(',\n             ');
    lines.push(`box-shadow: ${shadowStr};`);
  }
  if (blurs.length > 0) {
    const blur = blurs[0];
    if (blur.type === 'layer-blur') lines.push(`filter: blur(${blur.blur}px);`);
    if (blur.type === 'background-blur') lines.push(`backdrop-filter: blur(${blur.blur}px);`);
  }

  if (layer.autoLayout) {
    const al = layer.autoLayout;
    lines.push(`display: flex;`);
    lines.push(`flex-direction: ${al.direction === 'horizontal' ? 'row' : 'column'};`);
    lines.push(`gap: ${al.gap}px;`);
    if (al.paddingTop === al.paddingBottom && al.paddingLeft === al.paddingRight && al.paddingTop === al.paddingLeft) {
      lines.push(`padding: ${al.paddingTop}px;`);
    } else {
      lines.push(`padding: ${al.paddingTop}px ${al.paddingRight}px ${al.paddingBottom}px ${al.paddingLeft}px;`);
    }
    const justifyMap: Record<string, string> = { start: 'flex-start', center: 'center', end: 'flex-end', 'space-between': 'space-between' };
    const alignMap: Record<string, string> = { start: 'flex-start', center: 'center', end: 'flex-end' };
    lines.push(`justify-content: ${justifyMap[al.primaryAlign] ?? 'flex-start'};`);
    lines.push(`align-items: ${alignMap[al.counterAlign] ?? 'flex-start'};`);
    if (al.wrap) lines.push(`flex-wrap: wrap;`);
  }

  if (layer.clipContent) lines.push(`overflow: hidden;`);

  if (layer.type === 'text') {
    const textFill = layer.fills.find(f => f.visible !== false);
    if (textFill?.color) lines.push(`color: ${textFill.color};`);
    if (layer.fontFamily) lines.push(`font-family: '${layer.fontFamily}', sans-serif;`);
    if (layer.fontSize) lines.push(`font-size: ${layer.fontSize}px;`);
    if (layer.fontWeight) lines.push(`font-weight: ${layer.fontWeight};`);
    if (layer.fontStyle && layer.fontStyle !== 'normal') lines.push(`font-style: ${layer.fontStyle};`);
    if (layer.lineHeight) lines.push(`line-height: ${layer.lineHeight}px;`);
    if (layer.letterSpacing) lines.push(`letter-spacing: ${layer.letterSpacing}px;`);
    if (layer.textAlign && layer.textAlign !== 'left') lines.push(`text-align: ${layer.textAlign};`);
    if (layer.textDecoration && layer.textDecoration !== 'none') lines.push(`text-decoration: ${layer.textDecoration};`);
    if (layer.textTransform && layer.textTransform !== 'none') lines.push(`text-transform: ${layer.textTransform};`);
  }

  return lines.join('\n');
}

function generateReact(layer: FigmaLayer): string {
  const tag = layer.type === 'text'
    ? (layer.fontSize && layer.fontSize >= 28 ? 'h1' : layer.fontSize && layer.fontSize >= 20 ? 'h2' : layer.fontSize && layer.fontSize >= 16 ? 'h3' : 'p')
    : 'div';
  const className = layer.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const css = generateCSS(layer);
  const styleLines = css.split('\n').map(l => {
    const [prop, ...rest] = l.replace(';', '').split(':');
    if (!prop || rest.length === 0) return '';
    const camel = prop.trim().replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    const val = rest.join(':').trim();
    return `    ${camel}: '${val}',`;
  }).filter(Boolean).join('\n');
  if (layer.type === 'text') return `<${tag}\n  className="${className}"\n  style={{\n${styleLines}\n  }}\n>\n  ${layer.text ?? 'Text'}\n</${tag}>`;
  if ((layer.children ?? []).length > 0) return `<div\n  className="${className}"\n  style={{\n${styleLines}\n  }}\n>\n  {/* ${layer.children!.length} child${layer.children!.length !== 1 ? 'ren' : ''} */}\n</div>`;
  return `<div\n  className="${className}"\n  style={{\n${styleLines}\n  }}\n/>`;
}

function generateHTML(layer: FigmaLayer): string {
  const css = generateCSS(layer);
  const className = layer.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const styleTag = `<style>\n.${className} {\n${css.split('\n').map(l => '  ' + l).join('\n')}\n}\n</style>`;
  const tag = layer.type === 'text' ? 'p' : 'div';
  const inner = layer.type === 'text' ? (layer.text ?? 'Text') : '<!-- children -->';
  return `${styleTag}\n\n<${tag} class="${className}">${inner}</${tag}>`;
}

function highlightCSS(css: string): React.ReactNode[] {
  return css.split('\n').map((line, i) => {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) return <div key={i} style={{ minHeight: 18 }}>{line}</div>;
    const prop = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);
    return (
      <div key={i} style={{ minHeight: 18 }}>
        <span style={{ color: '#9cdcfe' }}>{prop}</span>
        <span style={{ color: '#d4d4d4' }}>:</span>
        <span style={{ color: '#ce9178' }}> {value}</span>
      </div>
    );
  });
}

function highlightReact(code: string): React.ReactNode[] {
  return code.split('\n').map((line, i) => (
    <div key={i} style={{ minHeight: 18 }}>
      <span
        style={{ color: '#d4d4d4' }}
        dangerouslySetInnerHTML={{
          __html: line
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/(&lt;\/?)([\w]+)/g, '$1<span style="color:#4ec9b0">$2</span>')
            .replace(/([\w]+)(=\{)/g, '<span style="color:#9cdcfe">$1</span>$2')
            .replace(/('[^']*')/g, '<span style="color:#ce9178">$1</span>'),
        }}
      />
    </div>
  ));
}

function InspectSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '8px 10px', borderBottom: '1px solid #1e1e1e' }}>
      <div style={{ fontSize: 9, color: '#555', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, justifyContent: 'space-between' }}>
      <span style={{ color: '#666', fontSize: 10, flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#ebebeb', fontSize: 11, fontFamily: 'monospace', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1200); }}
      style={{ background: 'none', border: 'none', color: done ? '#00c864' : '#555', cursor: 'pointer', fontSize: 10, padding: '1px 4px', marginLeft: 'auto' }}
    >
      {done ? '✓' : 'copy'}
    </button>
  );
}

function ColorSpecRow({ fill }: { fill: Fill }) {
  const hex = fill.color ?? '#000000';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const [fmt, setFmt] = useState<'hex' | 'rgb' | 'hsl'>('hex');
  const rgbStr = `rgb(${r}, ${g}, ${b})`;
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const lv = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = lv > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else h = ((rn - gn) / d + 4) / 6;
  }
  const hslStr = `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(lv * 100)}%)`;
  const displayStr = fmt === 'hex' ? hex.toUpperCase() : fmt === 'rgb' ? rgbStr : hslStr;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
      <div style={{ width: 16, height: 16, borderRadius: 3, background: hex, border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }} />
      <span
        style={{ color: '#ebebeb', fontFamily: 'monospace', fontSize: 11, flex: 1, cursor: 'pointer' }}
        onClick={() => setFmt(f => f === 'hex' ? 'rgb' : f === 'rgb' ? 'hsl' : 'hex')}
        title="Click to cycle format"
      >
        {displayStr}
      </span>
      {fill.opacity < 1 && <span style={{ color: '#666', fontSize: 10 }}>{Math.round(fill.opacity * 100)}%</span>}
      <CopyBtn text={displayStr} />
    </div>
  );
}

function InspectTabInner({ layer }: { layer: FigmaLayer }) {
  const [codeTab, setCodeTab] = useState<'css' | 'react' | 'html'>('css');
  const [copied, setCopied] = useState(false);

  const cssCode = generateCSS(layer);
  const reactCode = generateReact(layer);
  const htmlCode = generateHTML(layer);
  const activeCode = codeTab === 'css' ? cssCode : codeTab === 'react' ? reactCode : htmlCode;

  const copyCode = () => {
    navigator.clipboard.writeText(activeCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', fontSize: 11 }}>
      {/* Code tab switcher */}
      <div style={{ display: 'flex', borderBottom: '1px solid #2e2e2e' }}>
        {(['css', 'react', 'html'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setCodeTab(tab)}
            style={{
              flex: 1, padding: '7px 0', border: 'none', cursor: 'pointer', fontSize: 11,
              background: codeTab === tab ? '#1e1e1e' : 'transparent',
              color: codeTab === tab ? '#ebebeb' : '#666',
              borderBottom: codeTab === tab ? '2px solid #0d99ff' : '2px solid transparent',
              fontWeight: codeTab === tab ? 600 : 400,
            }}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Code block */}
      <div style={{ position: 'relative', background: '#141414', margin: 8, borderRadius: 6, border: '1px solid #2e2e2e' }}>
        <button
          onClick={copyCode}
          style={{
            position: 'absolute', top: 6, right: 6, zIndex: 1,
            background: copied ? 'rgba(0,200,100,0.15)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${copied ? '#00c864' : '#333'}`,
            borderRadius: 4, color: copied ? '#00c864' : '#888',
            fontSize: 10, padding: '2px 8px', cursor: 'pointer',
          }}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
        <div style={{
          padding: '12px 12px 12px 12px',
          fontFamily: '"Fira Code", "Cascadia Code", "Consolas", monospace',
          fontSize: 11, lineHeight: 1.6, overflowX: 'auto',
          whiteSpace: 'pre', color: '#d4d4d4',
        }}>
          {codeTab === 'css'
            ? highlightCSS(cssCode)
            : codeTab === 'react'
            ? highlightReact(reactCode)
            : <span style={{ color: '#d4d4d4' }}>{htmlCode}</span>
          }
        </div>
      </div>

      {/* Properties */}
      <InspectSection title="PROPERTIES">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px', padding: '4px 0' }}>
          <SpecRow label="W" value={`${layer.width}px`} />
          <SpecRow label="H" value={`${layer.height}px`} />
          <SpecRow label="X" value={`${layer.x}px`} />
          <SpecRow label="Y" value={`${layer.y}px`} />
          {layer.cornerRadius ? <SpecRow label="R" value={`${layer.cornerRadius}px`} /> : null}
          {layer.opacity !== 1 ? <SpecRow label="Opacity" value={`${Math.round(layer.opacity * 100)}%`} /> : null}
          {layer.rotation ? <SpecRow label="Rotation" value={`${layer.rotation}°`} /> : null}
          {layer.blendMode && layer.blendMode !== 'normal' ? <SpecRow label="Blend" value={layer.blendMode} /> : null}
        </div>
      </InspectSection>

      {/* Fill */}
      {layer.fills.filter(f => f.visible !== false && f.type !== 'none').length > 0 && (
        <InspectSection title="FILL">
          {layer.fills.filter(f => f.visible !== false && f.type !== 'none').map(fill => (
            <ColorSpecRow key={fill.id} fill={fill} />
          ))}
        </InspectSection>
      )}

      {/* Stroke */}
      {layer.strokes.filter(s => s.visible !== false).length > 0 && (
        <InspectSection title="STROKE">
          {layer.strokes.filter(s => s.visible !== false).map(stroke => (
            <div key={stroke.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
              <div style={{ width: 16, height: 16, borderRadius: 3, background: stroke.color, border: '2px solid rgba(255,255,255,0.1)', flexShrink: 0 }} />
              <span style={{ color: '#ebebeb', fontFamily: 'monospace', fontSize: 11 }}>{stroke.color.toUpperCase()}</span>
              <span style={{ color: '#666', fontSize: 10 }}>{stroke.weight}px {stroke.position}</span>
              <CopyBtn text={stroke.color} />
            </div>
          ))}
        </InspectSection>
      )}

      {/* Typography */}
      {layer.type === 'text' && (
        <InspectSection title="TYPOGRAPHY">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <SpecRow label="Font" value={layer.fontFamily ?? 'Inter'} />
            <SpecRow label="Size" value={`${layer.fontSize ?? 14}px`} />
            <SpecRow label="Weight" value={layer.fontWeight ?? '400'} />
            {layer.lineHeight ? <SpecRow label="Line H" value={`${layer.lineHeight}px`} /> : null}
            {layer.letterSpacing ? <SpecRow label="Tracking" value={`${layer.letterSpacing}px`} /> : null}
            {layer.textAlign ? <SpecRow label="Align" value={layer.textAlign} /> : null}
            {layer.textTransform && layer.textTransform !== 'none' ? <SpecRow label="Transform" value={layer.textTransform} /> : null}
            {layer.textDecoration && layer.textDecoration !== 'none' ? <SpecRow label="Decoration" value={layer.textDecoration} /> : null}
          </div>
        </InspectSection>
      )}

      {/* Auto layout */}
      {layer.autoLayout && (
        <InspectSection title="AUTO LAYOUT">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <SpecRow label="Direction" value={layer.autoLayout.direction} />
            <SpecRow label="Gap" value={`${layer.autoLayout.gap}px`} />
            <SpecRow label="Padding" value={`${layer.autoLayout.paddingTop}px ${layer.autoLayout.paddingRight}px ${layer.autoLayout.paddingBottom}px ${layer.autoLayout.paddingLeft}px`} />
            <SpecRow label="Align" value={`${layer.autoLayout.primaryAlign} / ${layer.autoLayout.counterAlign}`} />
          </div>
        </InspectSection>
      )}

      {/* Effects */}
      {layer.effects.filter(e => e.visible).length > 0 && (
        <InspectSection title="EFFECTS">
          {layer.effects.filter(e => e.visible).map(effect => (
            <div key={effect.id} style={{ padding: '2px 0' }}>
              <div style={{ color: '#888', fontSize: 10, marginBottom: 2, textTransform: 'uppercase' }}>{effect.type.replace(/-/g, ' ')}</div>
              {(effect.type === 'drop-shadow' || effect.type === 'inner-shadow') && (
                <div style={{ color: '#ebebeb', fontFamily: 'monospace', fontSize: 10 }}>
                  {effect.x}px {effect.y}px {effect.blur}px {effect.spread}px {effect.color}
                </div>
              )}
              {(effect.type === 'layer-blur' || effect.type === 'background-blur') && (
                <div style={{ color: '#ebebeb', fontFamily: 'monospace', fontSize: 10 }}>
                  blur({effect.blur}px)
                </div>
              )}
            </div>
          ))}
        </InspectSection>
      )}

      {/* Interactions */}
      {(layer.interactions ?? []).length > 0 && (
        <InspectSection title="INTERACTIONS">
          {layer.interactions!.map(int => (
            <div key={int.id} style={{ padding: '3px 0', color: '#888', fontSize: 10 }}>
              <span style={{ color: '#0d99ff' }}>{int.trigger}</span>
              {' → '}
              <span style={{ color: '#ebebeb' }}>{int.action}</span>
              {int.transition !== 'instant' && (
                <span style={{ color: '#666' }}> ({int.transition}, {int.duration}ms)</span>
              )}
            </div>
          ))}
        </InspectSection>
      )}
    </div>
  );
}

// ── Inspect tab ─────────────────────────────────────────────────

function InspectTab() {
  const { selection, layers, activePageId } = useFigmaStore();
  const currentLayers = layers[activePageId] ?? [];

  const findLayer = (arr: FigmaLayer[], id: string): FigmaLayer | null => {
    for (const l of arr) {
      if (l.id === id) return l;
      if (l.children) { const f = findLayer(l.children, id); if (f) return f; }
    }
    return null;
  };

  const selectedLayer = selection.length === 1 ? findLayer(currentLayers, selection[0]) : null;

  if (!selectedLayer) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#555', fontSize: 12, padding: 16 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>{'</>'}</div>
          Select a layer to inspect its code
        </div>
      </div>
    );
  }

  return <InspectTabInner layer={selectedLayer} />;
}

// ── Root component ──────────────────────────────────────────────

export default function RightPanel() {
  const { rightPanelWidth, rightPanelCollapsed, editorMode, setRightPanelCollapsed, setRightPanelWidth } = useFigmaStore();

  const resizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const onResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = rightPanelWidth;
    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      setRightPanelWidth(startWidthRef.current - (ev.clientX - startXRef.current));
    };
    const onUp = () => {
      resizingRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  if (rightPanelCollapsed) {
    return (
      <div
        style={{ width: 4, background: '#2c2c2c', borderLeft: '1px solid #3c3c3c', cursor: 'ew-resize', flexShrink: 0 }}
        onClick={() => setRightPanelCollapsed(false)}
        title="Expand panel"
      />
    );
  }

  return (
    <div style={{
      width: rightPanelWidth, flexShrink: 0, display: 'flex', flexDirection: 'column',
      background: '#2c2c2c', borderLeft: '1px solid #3c3c3c', overflow: 'hidden', position: 'relative',
    }}>
      {/* Resize handle */}
      <div
        onMouseDown={onResizeMouseDown}
        onDoubleClick={() => setRightPanelCollapsed(true)}
        style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, cursor: 'ew-resize', zIndex: 10 }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(13,153,255,0.3)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      />

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {editorMode === 'design' && <DesignTab />}
        {editorMode === 'prototype' && <PrototypeTab />}
        {editorMode === 'dev' && <InspectTab />}
      </div>
    </div>
  );
}
