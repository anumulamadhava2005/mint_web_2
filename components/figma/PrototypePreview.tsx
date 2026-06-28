"use client";

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  useFigmaStore,
  type FigmaLayer,
  type FigmaPage,
  type Interaction,
  type OverlayPosition,
} from '@/lib/stores/figmaStore';
import { usePreviewRuntime, type PreviewRuntime, type EvalCtx } from '@/hooks/usePreviewRuntime';

export interface PrototypeStandaloneData {
  pages?: FigmaPage[];
  layers?: Record<string, FigmaLayer[]>;
  activePageId?: string;
  fileName?: string;
}

// ── Easing ─────────────────────────────────────────────────────

function easingToCss(easing: Interaction['easing']): string {
  switch (easing) {
    case 'ease-in':     return 'cubic-bezier(0.4,0,1,1)';
    case 'ease-out':    return 'cubic-bezier(0,0,0.6,1)';
    case 'ease-in-out': return 'cubic-bezier(0.4,0,0.6,1)';
    case 'linear':      return 'linear';
    default:            return 'cubic-bezier(0,0,0.6,1)';
  }
}

// ── Helpers ────────────────────────────────────────────────────

function fillToCss(layer: FigmaLayer): string {
  const fill = layer.fills.find(f => f.visible !== false);
  if (!fill || fill.type === 'none') return 'transparent';
  if (fill.type === 'solid') return fill.color;
  if (fill.type === 'linear') {
    const stops = (fill.stops ?? []).map(s => `${s.color} ${s.position * 100}%`).join(', ');
    return `linear-gradient(${fill.gradientAngle ?? 90}deg, ${stops})`;
  }
  return fill.color ?? 'transparent';
}

// ── Device frames ──────────────────────────────────────────────

interface DeviceSpec {
  id: string; name: string;
  screenW: number; screenH: number;
  bezW: number; bezH: number;
  cornerRadius: number;
  topPad: number; bottomPad: number;
  sidePad: number;
  notchType: 'none' | 'notch' | 'hole';
  color: string;
}

const DEVICE_SPECS: DeviceSpec[] = [
  { id: 'iphone-14', name: 'iPhone 14',   screenW: 390, screenH: 844, bezW: 416, bezH: 900, cornerRadius: 40, topPad: 28, bottomPad: 28, sidePad: 13, notchType: 'notch', color: '#1c1c1e' },
  { id: 'pixel-7',   name: 'Pixel 7',     screenW: 412, screenH: 892, bezW: 440, bezH: 952, cornerRadius: 36, topPad: 30, bottomPad: 30, sidePad: 14, notchType: 'hole',  color: '#3a3a3c' },
  { id: 'ipad-pro',  name: 'iPad Pro',    screenW: 1024,screenH:1366, bezW:1064, bezH:1422, cornerRadius: 18, topPad: 28, bottomPad: 28, sidePad: 20, notchType: 'hole',  color: '#e0e0e0' },
  { id: 'desktop',   name: 'Desktop',     screenW: 1280,screenH: 800, bezW:1310, bezH: 860, cornerRadius: 4,  topPad: 30, bottomPad: 30, sidePad: 15, notchType: 'none',  color: '#2a2a2a' },
];

function DeviceFrame({ deviceId, children, scale }: { deviceId: string; children: React.ReactNode; scale: number }) {
  const spec = DEVICE_SPECS.find(d => d.id === deviceId);
  if (!spec) return <>{children}</>;

  const bW = spec.bezW * scale;
  const bH = spec.bezH * scale;
  const cr = spec.cornerRadius * scale;
  const tPad = spec.topPad * scale;
  const bPad = spec.bottomPad * scale;
  const sPad = spec.sidePad * scale;

  return (
    <div style={{
      position: 'relative', width: bW, height: bH,
      background: spec.color, borderRadius: cr,
      boxShadow: '0 30px 80px rgba(0,0,0,0.6), inset 0 0 0 1.5px rgba(255,255,255,0.08)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Notch / punch-hole */}
      {spec.notchType === 'notch' && (
        <div style={{
          position: 'absolute', top: tPad * 0.3, left: '50%',
          transform: 'translateX(-50%)',
          width: 120 * scale, height: 26 * scale,
          background: spec.color, borderRadius: 14 * scale, zIndex: 2,
        }} />
      )}
      {spec.notchType === 'hole' && (
        <div style={{
          position: 'absolute', top: tPad * 0.35, left: '50%',
          transform: 'translateX(-50%)',
          width: 12 * scale, height: 12 * scale,
          background: '#000', borderRadius: '50%', zIndex: 2,
        }} />
      )}
      {/* Screen area */}
      <div style={{
        position: 'absolute',
        top: tPad, bottom: bPad, left: sPad, right: sPad,
        overflow: 'hidden',
        borderRadius: Math.max(0, cr - sPad),
        background: '#fff',
      }}>
        {children}
      </div>
      {/* Home indicator */}
      {(deviceId === 'iphone-14' || deviceId === 'pixel-7') && (
        <div style={{
          position: 'absolute', bottom: bPad * 0.4, left: '50%',
          transform: 'translateX(-50%)',
          width: 120 * scale, height: 4 * scale,
          background: 'rgba(255,255,255,0.3)', borderRadius: 2 * scale,
        }} />
      )}
    </div>
  );
}

// ── Transition animation keyframes injected once ───────────────

const KEYFRAMES = `
@keyframes pp-slide-in-left  { from { transform: translateX(100%); }  to { transform: translateX(0); } }
@keyframes pp-slide-out-left { from { transform: translateX(0); }      to { transform: translateX(-100%); } }
@keyframes pp-slide-in-right { from { transform: translateX(-100%); }  to { transform: translateX(0); } }
@keyframes pp-slide-out-right{ from { transform: translateX(0); }      to { transform: translateX(100%); } }
@keyframes pp-push-in-left   { from { transform: translateX(100%); }   to { transform: translateX(0); } }
@keyframes pp-push-out-left  { from { transform: translateX(0); }      to { transform: translateX(-100%); } }
@keyframes pp-push-in-right  { from { transform: translateX(-100%); }  to { transform: translateX(0); } }
@keyframes pp-push-out-right { from { transform: translateX(0); }      to { transform: translateX(100%); } }
@keyframes pp-fade-in        { from { opacity: 0; }                    to { opacity: 1; } }
@keyframes pp-fade-out       { from { opacity: 1; }                    to { opacity: 0; } }
`;

let keyframesInjected = false;
function ensureKeyframes() {
  if (keyframesInjected || typeof document === 'undefined') return;
  keyframesInjected = true;
  const el = document.createElement('style');
  el.textContent = KEYFRAMES;
  document.head.appendChild(el);
}

// ── Overlay system types ───────────────────────────────────────

interface OverlayEntry {
  frameId: string;
  position: OverlayPosition;
  background: Interaction['overlayBackground'];
  bgOpacity: number;
  closeOnClickOutside: boolean;
  manualX?: number;
  manualY?: number;
}

// ── Transition state ───────────────────────────────────────────

interface TransitionState {
  fromId: string;
  toId: string;
  type: string;
  duration: number;
  easing: string;
}

// ── Runtime layer renderer ────────────────────────────────────

interface RuntimeLayerProps {
  layer: FigmaLayer;
  scale: number;
  onInteraction: (interaction: Interaction) => void;
  runtime: PreviewRuntime;
  localCtx?: EvalCtx;
  containerW?: number;
  containerH?: number;
}

function RuntimePreviewLayer({
  layer, scale, onInteraction, runtime, localCtx, containerW, containerH,
}: RuntimeLayerProps) {
  const { evalExpr, dispatchFlow } = runtime;

  // afterDelay — fire after mount
  useEffect(() => {
    const delayInts = (layer.interactions ?? []).filter(i => i.trigger === 'afterDelay');
    if (!delayInts.length) return;
    const timers = delayInts.map(ia =>
      window.setTimeout(() => onInteraction(ia), ia.delay ?? 1000)
    );
    return () => { timers.forEach(clearTimeout); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer.id]);

  // keyDown — global listener
  useEffect(() => {
    const keyInts = (layer.interactions ?? []).filter(i => i.trigger === 'keyDown');
    if (!keyInts.length) return;
    const handler = (e: KeyboardEvent) => {
      for (const ia of keyInts) {
        if (!ia.keyCode || e.key === ia.keyCode || e.code === ia.keyCode) {
          onInteraction(ia);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer.id]);

  // Conditional render
  if (layer.conditionalRender) {
    const show = evalExpr(layer.conditionalRender, localCtx);
    if (!show) return null;
  }
  if (layer.bindings?.visible) {
    const vis = evalExpr(layer.bindings.visible, localCtx);
    if (!vis) return null;
  }

  // RepeatFor
  if (layer.repeatFor) {
    const items = evalExpr(layer.repeatFor.items, localCtx);
    const arr = Array.isArray(items) ? items : [];
    const layerWithout: FigmaLayer = { ...layer, repeatFor: undefined };
    return (
      <>
        {arr.map((item, idx) => {
          const itemCtx: EvalCtx = { ...(localCtx ?? {}), [layer.repeatFor!.as]: item };
          const key = layer.repeatFor!.key
            ? String(evalExpr(layer.repeatFor!.key, itemCtx) ?? idx)
            : idx;
          return (
            <RuntimePreviewLayer
              key={key} layer={layerWithout} scale={scale}
              onInteraction={onInteraction} runtime={runtime}
              localCtx={itemCtx}
            />
          );
        })}
      </>
    );
  }

  if (!layer.visible) return null;

  let displayText = layer.text ?? '';
  if (layer.bindings?.text) {
    const val = evalExpr(layer.bindings.text, localCtx);
    if (val != null) displayText = String(val);
  }

  let fillOverride = '';
  const fillExpr = layer.bindings?.fill ?? layer.bindings?.background ?? layer.bindings?.color ?? '';
  if (fillExpr) {
    const val = evalExpr(fillExpr, localCtx);
    if (typeof val === 'string') fillOverride = val;
  }

  const hasInteraction = (layer.interactions ?? []).length > 0 || (layer.layerEvents?.onClick ?? []).length > 0;

  // Scroll behavior
  const isFixed = layer.scrollBehavior === 'fixed';
  const fixedStyle: React.CSSProperties = isFixed ? {
    position: 'fixed',
    left: (containerW ? (containerW / 2 - layer.width * scale / 2) : 0) + layer.x * scale,
    top: layer.y * scale,
  } : {};

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const clickInt = (layer.interactions ?? []).find(i => i.trigger === 'click');
    if (clickInt) onInteraction(clickInt);
    for (const flowId of layer.layerEvents?.onClick ?? []) {
      dispatchFlow(flowId, (target) => {
        if (target === '__back__') {
          onInteraction({ id: '__back__', trigger: 'click', action: 'back', transition: 'instant', duration: 0, easing: 'ease-out' });
        } else {
          onInteraction({ id: target, trigger: 'click', action: 'navigate', targetFrameId: target, transition: 'dissolve', duration: 300, easing: 'ease-out' });
        }
      });
    }
  };

  const handleMouseEnter = (e: React.MouseEvent) => {
    e.stopPropagation();
    const hoverInt = (layer.interactions ?? []).find(i => i.trigger === 'hover');
    if (hoverInt) onInteraction(hoverInt);
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    e.stopPropagation();
    const leaveInt = (layer.interactions ?? []).find(i => i.trigger === 'mouseLeave');
    if (leaveInt) onInteraction(leaveInt);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    const pressInt = (layer.interactions ?? []).find(i => i.trigger === 'press');
    if (pressInt) onInteraction(pressInt);
  };

  const fill = layer.fills.find(f => f.visible !== false);
  const stroke = layer.strokes.find(s => s.visible !== false);

  const baseStyle: React.CSSProperties = {
    position: isFixed ? 'fixed' : 'absolute',
    left: layer.x * scale,
    top: layer.y * scale,
    width: layer.width * scale,
    height: layer.height * scale,
    opacity: layer.opacity,
    transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
    transformOrigin: 'center center',
    cursor: hasInteraction ? 'pointer' : 'default',
    overflow: layer.clipContent ? 'hidden' : 'visible',
    borderRadius: layer.cornerRadius ? layer.cornerRadius * scale : undefined,
    background: fillOverride || fillToCss(layer),
    border: stroke ? `${stroke.weight * scale}px ${stroke.type} ${stroke.color}` : undefined,
    boxSizing: 'border-box',
    ...fixedStyle,
  };

  const scrollDir = layer.scrollDirection;
  const scrollStyle: React.CSSProperties = scrollDir && scrollDir !== 'none' ? {
    overflowX: scrollDir === 'horizontal' || scrollDir === 'both' ? 'auto' : 'hidden',
    overflowY: scrollDir === 'vertical' || scrollDir === 'both' ? 'auto' : 'hidden',
  } : {};

  const interactionProps = {
    onClick: handleClick,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onMouseDown: handleMouseDown,
  };

  if (layer.type === 'text') {
    return (
      <div
        style={{
          ...baseStyle, background: 'none', border: 'none',
          color: fill?.color ?? '#000',
          fontSize: (layer.fontSize ?? 14) * scale,
          fontFamily: layer.fontFamily ?? 'Inter',
          fontWeight: layer.fontWeight ?? 'normal',
          lineHeight: layer.lineHeight ? `${layer.lineHeight * scale}px` : '1.4',
          textAlign: (layer.textAlign as React.CSSProperties['textAlign']) ?? 'left',
          overflow: 'hidden', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}
        {...interactionProps}
      >
        {displayText}
      </div>
    );
  }

  if (layer.type === 'ellipse') {
    return <div style={{ ...baseStyle, borderRadius: '50%' }} {...interactionProps} />;
  }

  return (
    <div style={{ ...baseStyle, ...scrollStyle }} {...interactionProps}>
      {(layer.children ?? []).map(child => (
        <RuntimePreviewLayer
          key={child.id} layer={child} scale={scale}
          onInteraction={onInteraction} runtime={runtime}
          localCtx={localCtx} containerW={containerW} containerH={containerH}
        />
      ))}
    </div>
  );
}

// ── Overlay position helper ────────────────────────────────────

function overlayStyle(pos: OverlayPosition, fw: number, fh: number, ow: number, oh: number, manX?: number, manY?: number): React.CSSProperties {
  const center: React.CSSProperties = { left: (fw - ow) / 2, top: (fh - oh) / 2 };
  switch (pos) {
    case 'center':       return center;
    case 'top-left':     return { left: 0, top: 0 };
    case 'top-right':    return { right: 0, top: 0 };
    case 'bottom-left':  return { left: 0, bottom: 0 };
    case 'bottom-right': return { right: 0, bottom: 0 };
    case 'manual':       return { left: manX ?? 0, top: manY ?? 0 };
    default:             return center;
  }
}

// ── Overlay renderer ───────────────────────────────────────────

function OverlayFrame({
  entry, pageLayers, scale, onInteraction, onClose, runtime, containerW, containerH,
}: {
  entry: OverlayEntry;
  pageLayers: FigmaLayer[];
  scale: number;
  onInteraction: (ia: Interaction) => void;
  onClose: () => void;
  runtime: PreviewRuntime;
  containerW: number;
  containerH: number;
}) {
  const frame = pageLayers.find(l => l.id === entry.frameId);
  if (!frame) return null;

  const ow = frame.width * scale;
  const oh = frame.height * scale;
  const posStyle = overlayStyle(entry.position, containerW, containerH, ow, oh, entry.manualX, entry.manualY);

  const scrimStyle: React.CSSProperties = {
    position: 'absolute', inset: 0, zIndex: 10,
    cursor: entry.closeOnClickOutside ? 'default' : 'unset',
  };

  if (entry.background === 'dim') {
    scrimStyle.background = `rgba(0,0,0,${entry.bgOpacity ?? 0.4})`;
  } else if (entry.background === 'blur') {
    scrimStyle.backdropFilter = `blur(${Math.round((entry.bgOpacity ?? 0.4) * 20)}px)`;
    scrimStyle.background = 'rgba(0,0,0,0.1)';
  }

  const frameFill = frame.fills.find(f => f.visible !== false);

  return (
    <>
      <div style={scrimStyle} onClick={entry.closeOnClickOutside ? onClose : undefined} />
      <div style={{
        position: 'absolute', ...posStyle, zIndex: 11,
        width: ow, height: oh,
        background: frameFill?.type === 'solid' ? frameFill.color : '#fff',
        borderRadius: frame.cornerRadius ? frame.cornerRadius * scale : 0,
        overflow: 'hidden',
        boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
      }}
        onClick={e => e.stopPropagation()}
      >
        {(frame.children ?? []).map(child => (
          <RuntimePreviewLayer
            key={child.id} layer={child} scale={scale}
            onInteraction={onInteraction} runtime={runtime}
            containerW={containerW} containerH={containerH}
          />
        ))}
      </div>
    </>
  );
}

// ── Toast overlay ──────────────────────────────────────────────

const TOAST_COLORS: Record<string, string> = {
  info: '#1565c0', success: '#2e7d32', warning: '#e65100', error: '#c62828',
};

function ToastOverlay({ toasts, onDismiss }: { toasts: PreviewRuntime['toasts']; onDismiss: (id: string) => void }) {
  if (!toasts.length) return null;
  return (
    <div style={{
      position: 'absolute', bottom: 72, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', flexDirection: 'column-reverse', gap: 8, zIndex: 20,
      alignItems: 'center', pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div key={t.id} onClick={() => onDismiss(t.id)} style={{
          padding: '8px 16px', borderRadius: 8, fontSize: 12,
          color: '#fff', background: TOAST_COLORS[t.type] ?? TOAST_COLORS.info,
          boxShadow: '0 4px 12px rgba(0,0,0,0.35)', maxWidth: 300,
          textAlign: 'center', pointerEvents: 'auto', cursor: 'pointer',
          fontFamily: 'Inter, sans-serif',
        }}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ── Frame canvas with transitions ──────────────────────────────

function FrameCanvas({
  frame, nextFrame, transition, scale, onInteraction, runtime, overlays, onCloseOverlay, pageLayers, containerW, containerH,
}: {
  frame: FigmaLayer | null;
  nextFrame?: FigmaLayer | null;
  transition: TransitionState | null;
  scale: number;
  onInteraction: (ia: Interaction) => void;
  runtime: PreviewRuntime;
  overlays: OverlayEntry[];
  onCloseOverlay: (idx: number) => void;
  pageLayers: FigmaLayer[];
  containerW: number;
  containerH: number;
}) {
  if (!frame) return null;

  const frameFill = frame.fills.find(f => f.visible !== false);
  const frameBg = frameFill?.type === 'solid' ? frameFill.color : '#ffffff';

  const dur = transition ? `${transition.duration}ms` : '0ms';
  const ease = transition ? transition.easing : 'ease-out';

  const isPush = transition?.type === 'push-left' || transition?.type === 'push-right';
  const isSlide = transition?.type === 'slide-left' || transition?.type === 'slide-right';
  const isDissolve = transition?.type === 'dissolve';

  // Current frame style during transition
  let currentAnim: React.CSSProperties = {};
  let incomingAnim: React.CSSProperties = {};

  if (transition) {
    if (isDissolve) {
      currentAnim = { animation: `pp-fade-out ${dur} ${ease} forwards` };
      incomingAnim = { animation: `pp-fade-in ${dur} ${ease} forwards` };
    } else if (isPush) {
      const dir = transition.type === 'push-left' ? 'left' : 'right';
      currentAnim = { animation: `pp-push-out-${dir} ${dur} ${ease} forwards` };
      incomingAnim = { animation: `pp-push-in-${dir} ${dur} ${ease} forwards` };
    } else if (isSlide) {
      const dir = transition.type === 'slide-left' ? 'left' : 'right';
      currentAnim = { animation: `pp-slide-out-${dir} ${dur} ${ease} forwards` };
      incomingAnim = { animation: `pp-slide-in-${dir} ${dur} ${ease} forwards` };
    }
  }

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: frame.width * scale,
    height: frame.height * scale,
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    borderRadius: frame.cornerRadius ? frame.cornerRadius * scale : 0,
  };

  return (
    <div style={containerStyle}>
      {/* Current frame */}
      <div style={{
        position: 'absolute', inset: 0, background: frameBg,
        ...currentAnim,
      }}>
        {(frame.children ?? []).map(child => (
          <RuntimePreviewLayer
            key={child.id} layer={child} scale={scale}
            onInteraction={onInteraction} runtime={runtime}
            containerW={containerW} containerH={containerH}
          />
        ))}
      </div>

      {/* Incoming frame (push/slide/dissolve transitions) */}
      {transition && nextFrame && (isPush || isSlide || isDissolve) && (() => {
        const nfFill = nextFrame.fills.find(f => f.visible !== false);
        const nfBg = nfFill?.type === 'solid' ? nfFill.color : '#ffffff';
        return (
          <div style={{
            position: 'absolute', inset: 0, background: nfBg,
            ...incomingAnim,
          }}>
            {(nextFrame.children ?? []).map(child => (
              <RuntimePreviewLayer
                key={child.id} layer={child} scale={scale}
                onInteraction={onInteraction} runtime={runtime}
                containerW={containerW} containerH={containerH}
              />
            ))}
          </div>
        );
      })()}

      {/* Overlay stack */}
      {overlays.map((ov, idx) => (
        <OverlayFrame
          key={`${ov.frameId}-${idx}`}
          entry={ov} pageLayers={pageLayers}
          scale={scale} onInteraction={onInteraction}
          onClose={() => onCloseOverlay(idx)}
          runtime={runtime}
          containerW={frame.width * scale}
          containerH={frame.height * scale}
        />
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────

interface Props {
  onClose?: () => void;
  standaloneData?: PrototypeStandaloneData;
}

export default function PrototypePreview({ onClose, standaloneData }: Props) {
  ensureKeyframes();

  const storeData = useFigmaStore();
  const runtime = usePreviewRuntime();
  const isStandalone = !onClose;

  const storeLayers = storeData.layers;
  const storeActivePageId = storeData.activePageId;
  const prototypeStartFrameId = standaloneData ? null : storeData.prototypeStartFrameId;
  const prototypeDevice = storeData.prototypeDevice ?? 'none';

  const layers = standaloneData?.layers ?? storeLayers;
  const activePageId = standaloneData?.activePageId ?? storeActivePageId;

  const pageLayers = layers[activePageId] ?? [];
  const frames = useMemo(() => pageLayers.filter(l => l.type === 'frame' || l.type === 'component'), [pageLayers]);
  const startFrame =
    (prototypeStartFrameId && pageLayers.find(l => l.id === prototypeStartFrameId)) ||
    frames[0] ||
    null;

  const [currentFrameId, setCurrentFrameId] = useState<string>(startFrame?.id ?? '');
  const [history, setHistory] = useState<string[]>([]);
  const [transition, setTransition] = useState<TransitionState | null>(null);
  const [overlayStack, setOverlayStack] = useState<OverlayEntry[]>([]);

  const currentFrame = pageLayers.find(l => l.id === currentFrameId) ?? startFrame;
  const nextFrameId = transition?.toId;
  const nextFrame = nextFrameId ? pageLayers.find(l => l.id === nextFrameId) ?? null : null;

  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goBack = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setCurrentFrameId(prev);
    setOverlayStack([]);
  }, [history]);

  const navigate = useCallback((targetId: string, type: string, duration: number, easing: string) => {
    if (type === 'instant' || duration === 0) {
      setHistory(h => currentFrameId ? [...h, currentFrameId] : h);
      setCurrentFrameId(targetId);
      setOverlayStack([]);
      return;
    }
    const easingCss = easingToCss(easing as Interaction['easing']);
    setHistory(h => currentFrameId ? [...h, currentFrameId] : h);
    setTransition({ fromId: currentFrameId, toId: targetId, type, duration, easing: easingCss });
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = setTimeout(() => {
      setCurrentFrameId(targetId);
      setTransition(null);
      setOverlayStack([]);
    }, duration);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFrameId]);

  const runtimeNavigate = useCallback((target: string) => {
    if (target === '__back__') { goBack(); return; }
    const frame = frames.find(f => f.id === target || f.name === target);
    if (frame) navigate(frame.id, 'dissolve', 300, 'ease-out');
  }, [frames, navigate, goBack]);

  const handleInteraction = useCallback((interaction: Interaction) => {
    switch (interaction.action) {
      case 'navigate':
        if (interaction.targetFrameId) {
          navigate(interaction.targetFrameId, interaction.transition, interaction.duration, interaction.easing ?? 'ease-out');
        }
        break;
      case 'back':
        goBack();
        break;
      case 'openOverlay':
        if (interaction.targetFrameId) {
          setOverlayStack(s => [...s, {
            frameId: interaction.targetFrameId!,
            position: interaction.overlayPosition ?? 'center',
            background: interaction.overlayBackground ?? 'dim',
            bgOpacity: interaction.overlayBgOpacity ?? 0.4,
            closeOnClickOutside: interaction.overlayCloseOnClickOutside ?? true,
          }]);
        }
        break;
      case 'swapOverlay':
        if (interaction.targetFrameId) {
          setOverlayStack(s => {
            const next = [...s];
            if (next.length > 0) {
              next[next.length - 1] = {
                frameId: interaction.targetFrameId!,
                position: interaction.overlayPosition ?? 'center',
                background: interaction.overlayBackground ?? 'dim',
                bgOpacity: interaction.overlayBgOpacity ?? 0.4,
                closeOnClickOutside: interaction.overlayCloseOnClickOutside ?? true,
              };
            }
            return next;
          });
        }
        break;
      case 'closeOverlay':
        setOverlayStack(s => s.slice(0, -1));
        break;
      case 'openUrl':
        if (interaction.url) window.open(interaction.url, '_blank');
        break;
      case 'scrollTo':
        // Scroll target into view — best-effort
        if (interaction.targetFrameId) {
          const el = document.getElementById(`pp-layer-${interaction.targetFrameId}`);
          el?.scrollIntoView({ behavior: 'smooth' });
        }
        break;
    }
  }, [navigate, goBack]);

  const runtimeWithNav: PreviewRuntime = useMemo(() => ({
    ...runtime,
    dispatchFlow: (flowId, _onNav) => runtime.dispatchFlow(flowId, runtimeNavigate),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [runtime, runtimeNavigate]);

  // Compute canvas scale
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

  const deviceSpec = DEVICE_SPECS.find(d => d.id === prototypeDevice);
  const maxW = vw - 80;
  const maxH = vh - 120;

  const frameToDisplay = currentFrame;
  const frameW = frameToDisplay?.width ?? 390;
  const frameH = frameToDisplay?.height ?? 844;

  let scale: number;
  if (deviceSpec) {
    scale = Math.min(1, maxW / (deviceSpec.bezW), maxH / (deviceSpec.bezH));
  } else {
    scale = Math.min(1, maxW / (frameW || 1), maxH / (frameH || 1));
  }

  const containerW = frameW * scale;
  const containerH = frameH * scale;

  if (!currentFrame) {
    return (
      <div style={{
        position: isStandalone ? 'relative' : 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        zIndex: isStandalone ? undefined : 10000, fontFamily: 'Inter, sans-serif',
        width: isStandalone ? '100vw' : undefined, height: isStandalone ? '100vh' : undefined,
      }}>
        <div style={{ color: '#555', fontSize: 14, marginBottom: 16 }}>No frames to preview</div>
        {!isStandalone && (
          <button onClick={onClose} style={{ background: '#333', border: 'none', borderRadius: 4, color: '#ccc', padding: '6px 16px', cursor: 'pointer' }}>
            Close
          </button>
        )}
      </div>
    );
  }

  const isFetching = Object.values(runtime.apiStatus).some(s => s === 'loading');
  const hasLiveData = Object.keys(runtime.apiStatus).length > 0 || storeData.globalStateVars.length > 0;

  const canvasContent = (
    <FrameCanvas
      frame={currentFrame} nextFrame={nextFrame}
      transition={transition}
      scale={scale} onInteraction={handleInteraction}
      runtime={runtimeWithNav}
      overlays={overlayStack}
      onCloseOverlay={(idx) => setOverlayStack(s => s.filter((_, i) => i !== idx))}
      pageLayers={pageLayers}
      containerW={containerW} containerH={containerH}
    />
  );

  return (
    <div
      style={{
        position: isStandalone ? 'relative' : 'fixed',
        inset: isStandalone ? undefined : 0,
        width: isStandalone ? '100vw' : undefined,
        height: isStandalone ? '100vh' : undefined,
        background: 'rgba(15,15,15,0.96)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        zIndex: isStandalone ? undefined : 10000,
        fontFamily: 'Inter, sans-serif',
      }}
      onKeyDown={e => { if (e.key === 'Escape' && onClose) onClose(); }}
      tabIndex={-1}
    >
      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 44,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)',
        zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select
            value={currentFrameId}
            onChange={e => { setCurrentFrameId(e.target.value); setOverlayStack([]); }}
            style={{ background: '#2c2c2c', border: '1px solid #3c3c3c', borderRadius: 4, color: '#ccc', fontSize: 11, padding: '3px 6px' }}
          >
            {frames.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          {history.length > 0 && (
            <button onClick={goBack} style={{ background: '#2c2c2c', border: '1px solid #3c3c3c', borderRadius: 4, color: '#ccc', fontSize: 11, padding: '3px 10px', cursor: 'pointer' }}>
              ← Back
            </button>
          )}
          {hasLiveData && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '2px 8px', borderRadius: 10,
              background: 'rgba(99,255,155,0.12)', border: '1px solid rgba(99,255,155,0.25)',
              color: '#63ff9b', fontSize: 10, fontWeight: 500,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: isFetching ? '#f0c040' : '#63ff9b', display: 'inline-block' }} />
              {isFetching ? 'Fetching…' : 'Live Data'}
            </div>
          )}
        </div>
        <div style={{ color: '#555', fontSize: 11 }}>
          {Math.round(scale * 100)}% · {currentFrame.name}
        </div>
        {onClose ? (
          <button onClick={onClose} style={{ background: 'none', border: '1px solid #3c3c3c', borderRadius: 4, color: '#888', fontSize: 12, padding: '4px 12px', cursor: 'pointer' }}>
            ✕ Close
          </button>
        ) : (
          <div style={{ color: '#555', fontSize: 11 }}>
            {standaloneData?.fileName ?? 'Prototype'}
          </div>
        )}
      </div>

      {/* Device frame wrapper or bare canvas */}
      {deviceSpec
        ? <DeviceFrame deviceId={prototypeDevice} scale={scale}>{canvasContent}</DeviceFrame>
        : canvasContent
      }

      <div style={{ marginTop: 12, color: '#555', fontSize: 11 }}>
        {currentFrame.name} · {currentFrame.width} × {currentFrame.height}
      </div>

      <ToastOverlay toasts={runtime.toasts} onDismiss={runtime.dismissToast} />
    </div>
  );
}
