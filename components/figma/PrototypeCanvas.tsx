"use client";

import React, {
  useState, useRef, useEffect, useCallback, useMemo, WheelEvent,
} from 'react';
import {
  useFigmaStore,
  type FigmaLayer,
  type Interaction,
  type InteractionTrigger,
  type InteractionAction,
  type TransitionType,
  type OverlayPosition,
} from '@/lib/stores/figmaStore';

// ── Layer renderer ─────────────────────────────────────────────

function fillCss(layer: FigmaLayer): string {
  const fill = layer.fills.find(f => f.visible !== false);
  if (!fill || fill.type === 'none') return 'transparent';
  if (fill.type === 'solid') return fill.color;
  if (fill.type === 'linear') {
    const stops = (fill.stops ?? []).map(s => `${s.color} ${s.position * 100}%`).join(', ');
    return `linear-gradient(${fill.gradientAngle ?? 90}deg, ${stops})`;
  }
  return fill.color ?? 'transparent';
}

function LayerView({ layer, scale }: { layer: FigmaLayer; scale: number }) {
  if (!layer.visible) return null;
  const fill = layer.fills.find(f => f.visible !== false);
  const stroke = layer.strokes.find(s => s.visible !== false);

  const base: React.CSSProperties = {
    position: 'absolute',
    left: layer.x * scale, top: layer.y * scale,
    width: layer.width * scale, height: layer.height * scale,
    opacity: layer.opacity ?? 1,
    borderRadius: layer.type === 'ellipse' ? '50%' : layer.cornerRadius ? layer.cornerRadius * scale : 0,
    background: fillCss(layer),
    border: stroke ? `${stroke.weight * scale}px ${stroke.type} ${stroke.color}` : undefined,
    overflow: layer.clipContent ? 'hidden' : 'visible',
    transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
    transformOrigin: 'center center',
    boxSizing: 'border-box',
    pointerEvents: 'none',
  };

  if (layer.type === 'text') {
    const align = layer.textAlign ?? 'left';
    return (
      <div style={{
        ...base, background: 'none', border: 'none',
        color: fill?.color ?? '#000000',
        fontSize: (layer.fontSize ?? 14) * scale,
        fontFamily: layer.fontFamily ?? 'Inter, sans-serif',
        fontWeight: layer.fontWeight ?? 'normal',
        lineHeight: layer.lineHeight ? `${layer.lineHeight * scale}px` : '1.4',
        textAlign: align as React.CSSProperties['textAlign'],
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        display: 'flex', alignItems: 'center',
        justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
      }}>
        {layer.text ?? ''}
      </div>
    );
  }

  return (
    <div style={base}>
      {(layer.children ?? []).map(child => (
        <LayerView key={child.id} layer={child} scale={scale} />
      ))}
    </div>
  );
}

// ── World-space flattening ─────────────────────────────────────

interface FlatEntry { layer: FigmaLayer; wx: number; wy: number; parentFrameId?: string; }

function flattenWorld(layers: FigmaLayer[], ox = 0, oy = 0, parentFrameId?: string): FlatEntry[] {
  const out: FlatEntry[] = [];
  for (const l of layers) {
    const wx = ox + l.x, wy = oy + l.y;
    const isFrame = l.type === 'frame' || l.type === 'component';
    out.push({ layer: l, wx, wy, parentFrameId: isFrame ? undefined : parentFrameId });
    if (l.children?.length) {
      out.push(...flattenWorld(l.children, wx, wy, isFrame ? l.id : parentFrameId));
    }
  }
  return out;
}

// ── Coordinate helpers ─────────────────────────────────────────

interface Vp { x: number; y: number; zoom: number; }
const toSx = (wx: number, vp: Vp) => wx * vp.zoom + vp.x;
const toSy = (wy: number, vp: Vp) => wy * vp.zoom + vp.y;

function handlePos(e: FlatEntry, vp: Vp) {
  return { hx: toSx(e.wx + e.layer.width, vp), hy: toSy(e.wy + e.layer.height / 2, vp) };
}

function hitEntry(mx: number, my: number, e: FlatEntry, vp: Vp): boolean {
  const sx = toSx(e.wx, vp), sy = toSy(e.wy, vp);
  return mx >= sx && mx <= sx + e.layer.width * vp.zoom && my >= sy && my <= sy + e.layer.height * vp.zoom;
}

function bezier(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.max(Math.abs(x2 - x1) * 0.5, 60);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

// 8-point selection handles
function selHandles(sx: number, sy: number, sw: number, sh: number) {
  const mx = sx + sw / 2, my = sy + sh / 2, ex = sx + sw, ey = sy + sh;
  return [
    { id: 'tl', x: sx, y: sy }, { id: 'tc', x: mx, y: sy }, { id: 'tr', x: ex, y: sy },
    { id: 'ml', x: sx, y: my },                               { id: 'mr', x: ex, y: my },
    { id: 'bl', x: sx, y: ey }, { id: 'bc', x: mx, y: ey }, { id: 'br', x: ex, y: ey },
  ];
}

// ── Dialog types & options ─────────────────────────────────────

interface DialogState {
  layerId: string;
  interactionId: string | null;
  targetFrameId: string;
  trigger: InteractionTrigger;
  action: InteractionAction;
  transition: TransitionType;
  duration: number;
  easing: Interaction['easing'];
  delay?: number;
  keyCode?: string;
  url?: string;
  overlayPosition?: OverlayPosition;
  overlayBackground?: 'none' | 'dim' | 'blur';
  overlayBgOpacity?: number;
  overlayCloseOnClickOutside?: boolean;
  ax: number; ay: number;
}

const TRIGGERS: { value: InteractionTrigger; label: string; icon: string }[] = [
  { value: 'click',      label: 'On click',       icon: '↑'  },
  { value: 'hover',      label: 'On hover',        icon: '◎'  },
  { value: 'mouseLeave', label: 'On mouse leave',  icon: '↩'  },
  { value: 'press',      label: 'On press',        icon: '◼'  },
  { value: 'drag',       label: 'On drag',         icon: '⇢'  },
  { value: 'afterDelay', label: 'After delay',     icon: '⏱'  },
  { value: 'keyDown',    label: 'On key down',     icon: '⌨'  },
  { value: 'scroll',     label: 'On scroll',       icon: '↕'  },
];

const ACTIONS: { value: InteractionAction; label: string }[] = [
  { value: 'navigate',    label: 'Navigate to'  },
  { value: 'openOverlay', label: 'Open overlay' },
  { value: 'swapOverlay', label: 'Swap overlay' },
  { value: 'closeOverlay',label: 'Close overlay'},
  { value: 'back',        label: 'Go back'      },
  { value: 'scrollTo',    label: 'Scroll to'    },
  { value: 'openUrl',     label: 'Open URL'     },
];

const TRANSITIONS: { value: TransitionType; label: string; icon: string }[] = [
  { value: 'instant',       label: 'Instant',   icon: '⚡' },
  { value: 'dissolve',      label: 'Dissolve',  icon: '◌' },
  { value: 'slide-left',    label: 'Slide ←',   icon: '←' },
  { value: 'slide-right',   label: 'Slide →',   icon: '→' },
  { value: 'push-left',     label: 'Push ←',    icon: '⟵' },
  { value: 'push-right',    label: 'Push →',    icon: '⟶' },
  { value: 'smart-animate', label: 'Smart',     icon: '✦' },
];

const EASINGS: { value: Interaction['easing']; label: string }[] = [
  { value: 'ease-out',    label: 'Ease out'    },
  { value: 'ease-in',     label: 'Ease in'     },
  { value: 'ease-in-out', label: 'Ease in-out' },
  { value: 'linear',      label: 'Linear'      },
];

const OVERLAY_POSITIONS: { value: OverlayPosition; label: string }[] = [
  { value: 'center',       label: 'Center'          },
  { value: 'top-left',     label: 'Top left'        },
  { value: 'top-right',    label: 'Top right'       },
  { value: 'bottom-left',  label: 'Bottom left'     },
  { value: 'bottom-right', label: 'Bottom right'    },
  { value: 'origin',       label: 'Centered on click'},
];

// ── Connection dialog ──────────────────────────────────────────

function ConnectionDialog({
  dialog, frames, onSave, onDelete, onClose,
}: {
  dialog: DialogState;
  frames: FigmaLayer[];
  onSave: (d: DialogState) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<DialogState>(dialog);
  const ref = useRef<HTMLDivElement>(null);
  const patch = (p: Partial<DialogState>) => setForm(f => ({ ...f, ...p }));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const W = 262;
  const left = form.ax + 24 + W > vw ? form.ax - W - 24 : form.ax + 24;
  const top = Math.min(Math.max(8, form.ay - 20), vh - 520);

  const needsTarget = form.action === 'navigate' || form.action === 'openOverlay' || form.action === 'swapOverlay' || form.action === 'scrollTo';
  const isOverlay = form.action === 'openOverlay' || form.action === 'swapOverlay';

  return (
    <div ref={ref} style={{
      position: 'fixed', left, top, width: W,
      background: '#1e1e1e', border: '1px solid #383838',
      borderRadius: 8, boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
      zIndex: 9500, fontFamily: 'Inter, sans-serif', overflow: 'hidden',
    }} onMouseDown={e => e.stopPropagation()}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px 8px', borderBottom: '1px solid #2a2a2a' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#c8c8c8' }}>
          {form.interactionId ? 'Edit interaction' : 'New interaction'}
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 14, padding: 2 }}>✕</button>
      </div>

      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 9, maxHeight: 'calc(100vh - 160px)', overflowY: 'auto' }}>

        {/* Trigger */}
        <div>
          <div style={{ fontSize: 10, color: '#555', fontWeight: 600, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>Trigger</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
            {TRIGGERS.map(t => (
              <button key={t.value} onClick={() => patch({ trigger: t.value })} style={{
                background: form.trigger === t.value ? 'rgba(13,153,255,0.15)' : '#252525',
                border: `1px solid ${form.trigger === t.value ? '#0d99ff' : '#2e2e2e'}`,
                borderRadius: 5, color: form.trigger === t.value ? '#0d99ff' : '#888',
                fontSize: 11, padding: '4px 6px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5, textAlign: 'left',
              }}>
                <span style={{ fontSize: 12, width: 14 }}>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>
          {form.trigger === 'afterDelay' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
              <span style={{ fontSize: 10, color: '#666', whiteSpace: 'nowrap' }}>Delay (ms)</span>
              <input type="number" value={form.delay ?? 1000} min={100} max={10000} step={100}
                onChange={e => patch({ delay: Number(e.target.value) })}
                style={{ flex: 1, background: '#252525', border: '1px solid #2e2e2e', borderRadius: 4, color: '#ccc', fontSize: 11, padding: '3px 6px' }} />
            </div>
          )}
          {form.trigger === 'keyDown' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
              <span style={{ fontSize: 10, color: '#666', whiteSpace: 'nowrap' }}>Key</span>
              <input type="text" placeholder="e.g. Enter, Space, ArrowRight" value={form.keyCode ?? ''}
                onChange={e => patch({ keyCode: e.target.value })}
                style={{ flex: 1, background: '#252525', border: '1px solid #2e2e2e', borderRadius: 4, color: '#ccc', fontSize: 11, padding: '3px 6px' }} />
            </div>
          )}
        </div>

        {/* Action */}
        <div>
          <div style={{ fontSize: 10, color: '#555', fontWeight: 600, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>Action</div>
          <select value={form.action} onChange={e => patch({ action: e.target.value as InteractionAction })}
            style={{ width: '100%', background: '#252525', border: '1px solid #2e2e2e', borderRadius: 5, color: '#ccc', fontSize: 11, padding: '5px 8px', cursor: 'pointer' }}>
            {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>

        {/* Destination (frame picker) */}
        {needsTarget && (
          <div>
            <div style={{ fontSize: 10, color: '#555', fontWeight: 600, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>Destination</div>
            <select value={form.targetFrameId} onChange={e => patch({ targetFrameId: e.target.value })}
              style={{ width: '100%', background: '#252525', border: '1px solid #2e2e2e', borderRadius: 5, color: '#ccc', fontSize: 11, padding: '5px 8px', cursor: 'pointer' }}>
              <option value="">— None —</option>
              {frames.filter(f => f.type === 'frame' || f.type === 'component').map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* URL */}
        {form.action === 'openUrl' && (
          <div>
            <div style={{ fontSize: 10, color: '#555', fontWeight: 600, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>URL</div>
            <input type="url" placeholder="https://" value={form.url ?? ''}
              onChange={e => patch({ url: e.target.value })}
              style={{ width: '100%', background: '#252525', border: '1px solid #2e2e2e', borderRadius: 5, color: '#ccc', fontSize: 11, padding: '5px 8px', boxSizing: 'border-box' }} />
          </div>
        )}

        {/* Overlay options */}
        {isOverlay && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ fontSize: 10, color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Overlay</div>
            <select value={form.overlayPosition ?? 'center'} onChange={e => patch({ overlayPosition: e.target.value as OverlayPosition })}
              style={{ background: '#252525', border: '1px solid #2e2e2e', borderRadius: 5, color: '#ccc', fontSize: 11, padding: '4px 7px' }}>
              {OVERLAY_POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: '#666', whiteSpace: 'nowrap' }}>Background</span>
              {(['none', 'dim', 'blur'] as const).map(bg => (
                <button key={bg} onClick={() => patch({ overlayBackground: bg })}
                  style={{ flex: 1, fontSize: 10, padding: '3px 0', borderRadius: 4, cursor: 'pointer',
                    background: (form.overlayBackground ?? 'none') === bg ? 'rgba(13,153,255,0.15)' : '#252525',
                    border: `1px solid ${(form.overlayBackground ?? 'none') === bg ? '#0d99ff' : '#2e2e2e'}`,
                    color: (form.overlayBackground ?? 'none') === bg ? '#0d99ff' : '#777',
                  }}>
                  {bg}
                </button>
              ))}
            </div>
            {(form.overlayBackground === 'dim') && (
              <input type="range" min={0} max={100} value={Math.round((form.overlayBgOpacity ?? 0.4) * 100)}
                onChange={e => patch({ overlayBgOpacity: Number(e.target.value) / 100 })}
                style={{ width: '100%', accentColor: '#0d99ff' }} />
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.overlayCloseOnClickOutside ?? true}
                onChange={e => patch({ overlayCloseOnClickOutside: e.target.checked })}
                style={{ accentColor: '#0d99ff' }} />
              <span style={{ fontSize: 11, color: '#888' }}>Close on click outside</span>
            </label>
          </div>
        )}

        {/* Animation */}
        {form.action !== 'closeOverlay' && form.action !== 'openUrl' && form.action !== 'back' && (
          <div>
            <div style={{ fontSize: 10, color: '#555', fontWeight: 600, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>Animation</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3 }}>
              {TRANSITIONS.map(t => (
                <button key={t.value} title={t.label} onClick={() => patch({ transition: t.value })} style={{
                  background: form.transition === t.value ? 'rgba(13,153,255,0.15)' : '#252525',
                  border: `1px solid ${form.transition === t.value ? '#0d99ff' : '#2e2e2e'}`,
                  borderRadius: 5, cursor: 'pointer', padding: '6px 0', fontSize: 13,
                  color: form.transition === t.value ? '#0d99ff' : '#666',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                }}>
                  <span>{t.icon}</span>
                  <span style={{ fontSize: 8, opacity: 0.85 }}>{t.label.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Duration + easing */}
        {form.transition !== 'instant' && form.action !== 'closeOverlay' && form.action !== 'openUrl' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Duration</span>
              <span style={{ fontSize: 11, color: '#888' }}>{form.duration}ms</span>
            </div>
            <input type="range" min={0} max={1000} step={50} value={form.duration}
              onChange={e => patch({ duration: Number(e.target.value) })}
              style={{ width: '100%', accentColor: '#0d99ff' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 7 }}>
              <span style={{ fontSize: 10, color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Easing</span>
              <select value={form.easing} onChange={e => patch({ easing: e.target.value as Interaction['easing'] })}
                style={{ background: '#252525', border: '1px solid #2e2e2e', borderRadius: 4, color: '#ccc', fontSize: 10, padding: '2px 5px', cursor: 'pointer' }}>
                {EASINGS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, padding: '8px 12px 10px', borderTop: '1px solid #2a2a2a' }}>
        {form.interactionId && (
          <button onClick={onDelete} style={{ flex: 0, background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)', borderRadius: 5, color: '#ff5050', fontSize: 11, padding: '5px 10px', cursor: 'pointer' }}>
            Delete
          </button>
        )}
        <button onClick={() => onSave(form)} style={{ flex: 1, background: '#0d99ff', border: 'none', borderRadius: 5, color: '#fff', fontSize: 11, fontWeight: 600, padding: '6px 0', cursor: 'pointer' }}>
          {form.interactionId ? 'Update' : 'Create'}
        </button>
      </div>
    </div>
  );
}

// ── Drag & pan state ───────────────────────────────────────────

interface DragLine { fromLayerId: string; hx: number; hy: number; mx: number; my: number; }
interface PanState { startMx: number; startMy: number; startVpX: number; startVpY: number; }

// ── Main prototype canvas ──────────────────────────────────────

export default function PrototypeCanvas() {
  const {
    layers, activePageId, editorMode,
    addInteraction, updateInteraction, removeInteraction,
    prototypeDevice, setPrototypeDevice,
    setPreviewMode,
  } = useFigmaStore();

  const allLayers = useMemo(() => layers[activePageId] ?? [], [layers, activePageId]);
  const frames = useMemo(
    () => allLayers.filter(l => l.type === 'frame' || l.type === 'component'),
    [allLayers],
  );
  // ALL layers at all depths with world coords — deduplicate by layer.id to prevent
  // duplicate keys when a layer appears both as a top-level store entry and as a child.
  const flatEntries = useMemo(() => {
    const all = flattenWorld(allLayers);
    const seen = new Set<string>();
    return all.filter(e => {
      if (seen.has(e.layer.id)) return false;
      seen.add(e.layer.id);
      return true;
    });
  }, [allLayers]);

  const [vp, setVp] = useState<Vp>({ x: 80, y: 80, zoom: 1 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [dragLine, setDragLine] = useState<DragLine | null>(null);
  const [panState, setPanState] = useState<PanState | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // ── Fit frames to canvas on mount ─────────────────────────────

  useEffect(() => {
    if (frames.length === 0) return;
    const cw = containerRef.current?.clientWidth ?? window.innerWidth - 480;
    const ch = containerRef.current?.clientHeight ?? window.innerHeight - 44;
    const xs = frames.flatMap(f => [f.x, f.x + f.width]);
    const ys = frames.flatMap(f => [f.y, f.y + f.height]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const ww = maxX - minX, wh = maxY - minY;
    if (!ww || !wh) return;
    const zoom = Math.min(1, (cw * 0.8) / ww, (ch * 0.8) / wh);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVp({ zoom, x: (cw - ww * zoom) / 2 - minX * zoom, y: (ch - wh * zoom) / 2 - minY * zoom });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── All connections ────────────────────────────────────────────

  const connections = useMemo(() => {
    const result: { source: FlatEntry; interaction: Interaction; target: FlatEntry | null }[] = [];
    for (const entry of flatEntries) {
      for (const ia of (entry.layer.interactions ?? [])) {
        const target = ia.targetFrameId ? flatEntries.find(e => e.layer.id === ia.targetFrameId) ?? null : null;
        result.push({ source: entry, interaction: ia, target });
      }
    }
    return result;
  }, [flatEntries]);

  // ── Frame rect helper ──────────────────────────────────────────

  const entryRect = useCallback((e: FlatEntry) => ({
    sx: toSx(e.wx, vp), sy: toSy(e.wy, vp),
    sw: e.layer.width * vp.zoom, sh: e.layer.height * vp.zoom,
  }), [vp]);

  // Hit-test: which frame is the drop target?
  const frameAt = useCallback((mx: number, my: number): FlatEntry | null => {
    const topFrames = allLayers.filter(l => l.type === 'frame' || l.type === 'component')
      .map(l => flatEntries.find(e => e.layer.id === l.id)!)
      .filter(Boolean);
    for (let i = topFrames.length - 1; i >= 0; i--) {
      if (hitEntry(mx, my, topFrames[i], vp)) return topFrames[i];
    }
    return null;
  }, [allLayers, flatEntries, vp]);

  // Hit-test: any layer (for hover)
  const layerAt = useCallback((mx: number, my: number): string | null => {
    // Reverse order = deepest / last-drawn first
    for (let i = flatEntries.length - 1; i >= 0; i--) {
      if (hitEntry(mx, my, flatEntries[i], vp)) return flatEntries[i].layer.id;
    }
    return null;
  }, [flatEntries, vp]);

  // ── Handle position for any entry ─────────────────────────────

  const getHandlePos = useCallback((layerId: string) => {
    const entry = flatEntries.find(e => e.layer.id === layerId);
    if (!entry) return null;
    return handlePos(entry, vp);
  }, [flatEntries, vp]);

  // ── Wheel zoom ─────────────────────────────────────────────────

  const onWheel = useCallback((e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const r = containerRef.current?.getBoundingClientRect();
    const ox = e.clientX - (r?.left ?? 0);
    const oy = e.clientY - (r?.top ?? 0);
    setVp(v => {
      const zoom = Math.max(0.1, Math.min(8, v.zoom * factor));
      return { zoom, x: ox - (ox - v.x) * (zoom / v.zoom), y: oy - (oy - v.y) * (zoom / v.zoom) };
    });
  }, []);

  // ── Container-level mouse move — hover any layer ───────────────

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (panState || dragLine) return;
    const r = containerRef.current?.getBoundingClientRect();
    const lx = e.clientX - (r?.left ?? 0);
    const ly = e.clientY - (r?.top ?? 0);
    setHoveredId(layerAt(lx, ly));
  }, [panState, dragLine, layerAt]);

  // ── Pan ─────────────────────────────────────────────────────────

  const onContainerMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      setPanState({ startMx: e.clientX, startMy: e.clientY, startVpX: vp.x, startVpY: vp.y });
      return;
    }
    if (e.button === 0) { setDialog(null); }
  }, [vp]);

  // ── Global mouse move / up ─────────────────────────────────────

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (panState) {
        setVp(v => ({ ...v, x: panState.startVpX + e.clientX - panState.startMx, y: panState.startVpY + e.clientY - panState.startMy }));
      }
      if (dragLine) {
        const r = containerRef.current?.getBoundingClientRect();
        setDragLine(d => d ? { ...d, mx: e.clientX - (r?.left ?? 0), my: e.clientY - (r?.top ?? 0) } : d);
      }
    };
    const onUp = (e: MouseEvent) => {
      if (panState) { setPanState(null); return; }
      if (dragLine) {
        const r = containerRef.current?.getBoundingClientRect();
        const lx = e.clientX - (r?.left ?? 0);
        const ly = e.clientY - (r?.top ?? 0);
        const target = frameAt(lx, ly);
        if (target && target.layer.id !== dragLine.fromLayerId) {
          setDialog({
            layerId: dragLine.fromLayerId,
            interactionId: null, targetFrameId: target.layer.id,
            trigger: 'click', action: 'navigate', transition: 'dissolve',
            duration: 300, easing: 'ease-out',
            overlayPosition: 'center', overlayBackground: 'dim', overlayBgOpacity: 0.4, overlayCloseOnClickOutside: true,
            ax: e.clientX, ay: e.clientY,
          });
        }
        setDragLine(null);
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panState, dragLine, frameAt, getHandlePos]);

  // ── Start drag from "+" handle ─────────────────────────────────

  const startDrag = useCallback((e: React.MouseEvent, entry: FlatEntry) => {
    e.stopPropagation();
    e.preventDefault();
    const { hx, hy } = handlePos(entry, vp);
    setDragLine({ fromLayerId: entry.layer.id, hx, hy, mx: hx, my: hy });
    setDialog(null);
  }, [vp]);

  // ── Dialog save / delete ───────────────────────────────────────

  const handleSave = useCallback((form: DialogState) => {
    const interaction: Interaction = {
      id: form.interactionId ?? `int-${Date.now()}`,
      trigger: form.trigger, action: form.action,
      targetFrameId: (form.action !== 'back' && form.action !== 'closeOverlay' && form.action !== 'openUrl') ? form.targetFrameId : undefined,
      transition: form.transition, duration: form.duration, easing: form.easing,
      delay: form.delay, keyCode: form.keyCode, url: form.url,
      overlayPosition: form.overlayPosition, overlayBackground: form.overlayBackground,
      overlayBgOpacity: form.overlayBgOpacity, overlayCloseOnClickOutside: form.overlayCloseOnClickOutside,
    };
    if (form.interactionId) updateInteraction(form.layerId, form.interactionId, interaction);
    else addInteraction(form.layerId, interaction);
    setDialog(null);
  }, [addInteraction, updateInteraction]);

  const handleDelete = useCallback(() => {
    if (dialog?.interactionId) removeInteraction(dialog.layerId, dialog.interactionId);
    setDialog(null);
  }, [dialog, removeInteraction]);

  const openEdit = useCallback((e: React.MouseEvent, conn: typeof connections[number]) => {
    e.stopPropagation();
    const { hx, hy } = handlePos(conn.source, vp);
    const r = containerRef.current?.getBoundingClientRect();
    setDialog({
      layerId: conn.source.layer.id, interactionId: conn.interaction.id,
      targetFrameId: conn.interaction.targetFrameId ?? '',
      trigger: conn.interaction.trigger, action: conn.interaction.action,
      transition: conn.interaction.transition, duration: conn.interaction.duration, easing: conn.interaction.easing,
      delay: conn.interaction.delay, keyCode: conn.interaction.keyCode, url: conn.interaction.url,
      overlayPosition: conn.interaction.overlayPosition, overlayBackground: conn.interaction.overlayBackground,
      overlayBgOpacity: conn.interaction.overlayBgOpacity, overlayCloseOnClickOutside: conn.interaction.overlayCloseOnClickOutside,
      ax: (hx + (r?.left ?? 0)), ay: (hy + (r?.top ?? 0)),
    });
  }, [vp]);

  if (editorMode !== 'prototype') return null;

  // ── Hovered entry (any layer) ──────────────────────────────────

  const hoveredEntry = hoveredId ? flatEntries.find(e => e.layer.id === hoveredId) ?? null : null;

  const DEVICES = [
    { id: 'none',       name: 'No device'    },
    { id: 'iphone-14',  name: 'iPhone 14'    },
    { id: 'pixel-7',    name: 'Pixel 7'      },
    { id: 'ipad-pro',   name: 'iPad Pro'     },
    { id: 'desktop',    name: 'Desktop'      },
  ];

  return (
    <div ref={containerRef} style={{
      position: 'relative', flex: 1, overflow: 'hidden',
      background: '#1c1c1c',
      cursor: panState ? 'grabbing' : dragLine ? 'crosshair' : 'default',
    }}
      onMouseDown={onContainerMouseDown}
      onMouseMove={onMouseMove}
      onMouseLeave={() => { if (!dragLine) setHoveredId(null); }}
      onWheel={onWheel}
    >
      {/* Dot grid */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}>
        <defs>
          <pattern id="pc-dot" x={vp.x % 24} y={vp.y % 24} width={24} height={24} patternUnits="userSpaceOnUse">
            <circle cx={12} cy={12} r={0.8} fill="#333" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#pc-dot)" />
      </svg>

      {/* Toolbar */}
      <div style={{
        position: 'absolute', top: 12, right: 12, zIndex: 20,
        display: 'flex', gap: 6, alignItems: 'center',
      }}>
        <select value={prototypeDevice} onChange={e => setPrototypeDevice(e.target.value)}
          style={{ background: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: 5, color: '#bbb', fontSize: 11, padding: '4px 8px', cursor: 'pointer' }}>
          {DEVICES.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <button onClick={() => setPreviewMode(true)} style={{
          background: '#0d99ff', border: 'none', borderRadius: 5,
          color: '#fff', fontSize: 11, fontWeight: 600, padding: '5px 12px', cursor: 'pointer',
        }}>▶ Present</button>
      </div>

      {/* Frames (visual content) */}
      {frames.map(frame => {
        const frameEntry = flatEntries.find(e => e.layer.id === frame.id)!;
        if (!frameEntry) return null;
        const { sx, sy, sw, sh } = entryRect(frameEntry);
        return (
          <div key={frame.id} style={{ position: 'absolute', zIndex: 1 }}>
            {/* Label */}
            <div style={{
              position: 'absolute', left: sx, top: sy - 20,
              fontSize: 11, color: '#777', fontFamily: 'Inter, sans-serif',
              whiteSpace: 'nowrap', pointerEvents: 'none', userSelect: 'none',
            }}>
              {frame.name}
            </div>
            {/* Frame content box */}
            <div style={{
              position: 'absolute', left: sx, top: sy, width: sw, height: sh,
              background: fillCss(frame),
              borderRadius: frame.cornerRadius ? frame.cornerRadius * vp.zoom : 0,
              overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
            }}>
              {(frame.children ?? []).map(child => (
                <LayerView key={child.id} layer={child} scale={vp.zoom} />
              ))}
            </div>
          </div>
        );
      })}

      {/* SVG layer: arrows + hover outline + drag preview */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none', zIndex: 3 }}>
        <defs>
          <marker id="pc-arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#0d99ff" />
          </marker>
        </defs>

        {/* Hover outline for ANY layer */}
        {hoveredEntry && !dragLine && (() => {
          const { sx, sy, sw, sh } = entryRect(hoveredEntry);
          const isTopFrame = hoveredEntry.layer.type === 'frame' || hoveredEntry.layer.type === 'component';
          return (
            <rect x={sx} y={sy} width={sw} height={sh}
              fill="none" stroke="#0d99ff"
              strokeWidth={isTopFrame ? 1.5 : 1}
              strokeDasharray={isTopFrame ? undefined : '3 2'}
              opacity={0.7} rx={1} style={{ pointerEvents: 'none' }} />
          );
        })()}

        {/* Existing connection arrows */}
        {connections.map((conn, connIdx) => {
          const { hx: sx, hy: sy } = handlePos(conn.source, vp);
          const trigIcon = conn.interaction.trigger === 'click' ? '↑'
            : conn.interaction.trigger === 'hover' ? '◎'
            : conn.interaction.trigger === 'afterDelay' ? '⏱'
            : conn.interaction.trigger === 'keyDown' ? '⌨'
            : conn.interaction.trigger === 'press' ? '◼' : '⇢';
          const actionLabel = conn.interaction.action === 'navigate' ? ''
            : conn.interaction.action === 'openOverlay' ? 'O'
            : conn.interaction.action === 'swapOverlay' ? 'S'
            : conn.interaction.action === 'back' ? '↩' : '';

          if (!conn.target) {
            return (
              <g key={`c-${connIdx}`}>
                <path d={`M ${sx} ${sy} C ${sx + 50} ${sy - 35}, ${sx + 50} ${sy + 35}, ${sx} ${sy}`}
                  fill="none" stroke="#0d99ff" strokeWidth={2} strokeDasharray="5 3"
                  markerEnd="url(#pc-arr)" opacity={0.8}
                  style={{ pointerEvents: 'all', cursor: 'pointer' }}
                  onClick={e => openEdit(e as unknown as React.MouseEvent, conn)} />
                <circle cx={sx} cy={sy} r={9} fill="#0d99ff" opacity={0.9}
                  style={{ pointerEvents: 'all', cursor: 'pointer' }}
                  onClick={e => openEdit(e as unknown as React.MouseEvent, conn)} />
                <text x={sx} y={sy + 4} textAnchor="middle" fontSize={9} fill="white" style={{ pointerEvents: 'none' }}>↩</text>
              </g>
            );
          }

          const { hx: tx, hy: ty } = (() => {
            const targetEntry = conn.target;
            return { hx: toSx(targetEntry.wx, vp), hy: toSy(targetEntry.wy + targetEntry.layer.height / 2, vp) };
          })();
          const path = bezier(sx, sy, tx, ty);
          // Midpoint for label
          const midX = (sx + tx) / 2, midY = (sy + ty) / 2;

          return (
            <g key={`c-${connIdx}`}>
              <path d={path} fill="none" stroke="transparent" strokeWidth={14}
                style={{ pointerEvents: 'all', cursor: 'pointer' }}
                onClick={e => openEdit(e as unknown as React.MouseEvent, conn)} />
              <path d={path} fill="none" stroke="#0d99ff" strokeWidth={2}
                strokeDasharray="6 3" markerEnd="url(#pc-arr)" opacity={0.85}
                style={{ pointerEvents: 'none' }} />
              {/* Label pill on arrow midpoint */}
              <rect x={midX - 14} y={midY - 8} width={28} height={16} rx={8}
                fill="#0d99ff" opacity={0.9} style={{ pointerEvents: 'none' }} />
              <text x={midX} y={midY + 4} textAnchor="middle" fontSize={9} fill="white" style={{ pointerEvents: 'none' }}>
                {trigIcon}{actionLabel}
              </text>
              {/* Source dot */}
              <circle cx={sx} cy={sy} r={9} fill="#0d99ff" opacity={0.9}
                style={{ pointerEvents: 'all', cursor: 'pointer' }}
                onClick={e => openEdit(e as unknown as React.MouseEvent, conn)} />
              <text x={sx} y={sy + 4} textAnchor="middle" fontSize={9} fill="white" style={{ pointerEvents: 'none' }}>{trigIcon}</text>
              {/* Target dashed outline */}
              <rect x={toSx(conn.target.wx, vp)} y={toSy(conn.target.wy, vp)}
                width={conn.target.layer.width * vp.zoom} height={conn.target.layer.height * vp.zoom}
                fill="none" stroke="#0d99ff" strokeWidth={2} strokeDasharray="4 4" opacity={0.4}
                style={{ pointerEvents: 'none' }} />
            </g>
          );
        })}

        {/* Live drag preview */}
        {dragLine && (() => {
          const target = frameAt(dragLine.mx, dragLine.my);
          return (
            <>
              <path d={bezier(dragLine.hx, dragLine.hy, dragLine.mx, dragLine.my)}
                fill="none" stroke="#0d99ff" strokeWidth={2.5}
                markerEnd="url(#pc-arr)" opacity={0.9} />
              {target && (
                <rect x={toSx(target.wx, vp)} y={toSy(target.wy, vp)}
                  width={target.layer.width * vp.zoom} height={target.layer.height * vp.zoom}
                  fill="rgba(13,153,255,0.08)" stroke="#0d99ff" strokeWidth={2} rx={2} />
              )}
              <circle cx={dragLine.hx} cy={dragLine.hy} r={10} fill="#0d99ff" />
              <text x={dragLine.hx} y={dragLine.hy + 5} textAnchor="middle" fontSize={13} fill="white">+</text>
            </>
          );
        })()}
      </svg>

      {/* Hover UI: 8-point handles + "+" drag handle + dimension badge */}
      {hoveredEntry && !dragLine && (() => {
        const { sx, sy, sw, sh } = entryRect(hoveredEntry);
        const { hx, hy } = handlePos(hoveredEntry, vp);
        const handles = selHandles(sx, sy, sw, sh);
        const isTopFrame = hoveredEntry.layer.type === 'frame' || hoveredEntry.layer.type === 'component';

        return (
          <>
            {/* 8-point selection handles (only for top-level frames to avoid clutter) */}
            {isTopFrame && handles.map(h => (
              <div key={h.id} style={{
                position: 'absolute', left: h.x - 4, top: h.y - 4,
                width: 8, height: 8, background: '#fff',
                border: '2px solid #0d99ff', borderRadius: 1, zIndex: 5, pointerEvents: 'none',
              }} />
            ))}

            {/* "+" drag handle — right-edge center, shown for ANY layer */}
            <div
              style={{
                position: 'absolute', left: hx - 13, top: hy - 13,
                width: 26, height: 26, borderRadius: '50%',
                background: '#1c1c1c', border: '2px solid #0d99ff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#0d99ff', fontSize: 18, lineHeight: 1,
                cursor: 'crosshair', zIndex: 6,
                boxShadow: '0 0 0 3px rgba(13,153,255,0.2)',
                userSelect: 'none',
              }}
              onMouseDown={e => startDrag(e, hoveredEntry)}
            >
              +
            </div>

            {/* Dimension badge */}
            <div style={{
              position: 'absolute',
              left: sx + sw / 2, top: sy + sh + 8,
              transform: 'translateX(-50%)',
              background: '#0d99ff', color: '#fff',
              fontSize: 11, fontFamily: 'Inter, sans-serif', fontWeight: 500,
              padding: '2px 8px', borderRadius: 4,
              whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 5,
            }}>
              {Math.round(hoveredEntry.layer.width)} × {Math.round(hoveredEntry.layer.height)}
            </div>
          </>
        );
      })()}

      {/* Empty state */}
      {frames.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#444', fontSize: 14, fontFamily: 'Inter, sans-serif', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ fontSize: 32 }}>□</div>
          <div>No frames to connect</div>
          <div style={{ fontSize: 12, color: '#333' }}>Switch to Design and add frames first</div>
        </div>
      )}

      {/* Zoom indicator */}
      <div style={{ position: 'absolute', bottom: 16, right: 16, fontSize: 11, color: '#444', fontFamily: 'Inter, sans-serif', pointerEvents: 'none' }}>
        {Math.round(vp.zoom * 100)}%
      </div>

      {dialog && (
        <ConnectionDialog
          key={`${dialog.layerId}-${dialog.interactionId ?? 'new'}`}
          dialog={dialog} frames={allLayers}
          onSave={handleSave} onDelete={handleDelete} onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

