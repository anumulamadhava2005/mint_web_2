"use client";

import React, { useState, useCallback } from 'react';
import { useFigmaStore, type FigmaLayer, type FigmaPage, type Interaction } from '@/lib/stores/figmaStore';

export interface PrototypeStandaloneData {
  pages?: FigmaPage[];
  layers?: Record<string, FigmaLayer[]>;
  activePageId?: string;
  fileName?: string;
}

interface PreviewLayerProps {
  layer: FigmaLayer;
  scale: number;
  onInteraction: (interaction: Interaction) => void;
}

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

function PreviewLayer({ layer, scale, onInteraction }: PreviewLayerProps) {
  if (!layer.visible) return null;

  const fill = layer.fills.find(f => f.visible !== false);
  const stroke = layer.strokes.find(s => s.visible !== false);
  const hasInteraction = (layer.interactions ?? []).length > 0;

  const handleClick = () => {
    const clickInt = (layer.interactions ?? []).find(i => i.trigger === 'click');
    if (clickInt) onInteraction(clickInt);
  };

  const baseStyle: React.CSSProperties = {
    position: 'absolute',
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
    background: fillToCss(layer),
    border: stroke ? `${stroke.weight * scale}px ${stroke.type} ${stroke.color}` : undefined,
    boxSizing: 'border-box',
  };

  if (layer.type === 'text') {
    return (
      <div
        style={{
          ...baseStyle,
          background: 'none',
          border: 'none',
          color: fill?.color ?? '#000',
          fontSize: (layer.fontSize ?? 14) * scale,
          fontFamily: layer.fontFamily ?? 'Inter',
          fontWeight: layer.fontWeight ?? 'normal',
          lineHeight: layer.lineHeight ? `${layer.lineHeight * scale}px` : '1.4',
          textAlign: (layer.textAlign as React.CSSProperties['textAlign']) ?? 'left',
          overflow: 'hidden',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
        onClick={handleClick}
      >
        {layer.text ?? ''}
      </div>
    );
  }

  if (layer.type === 'ellipse') {
    return <div style={{ ...baseStyle, borderRadius: '50%' }} onClick={handleClick} />;
  }

  return (
    <div style={baseStyle} onClick={handleClick}>
      {(layer.children ?? []).map(child => (
        <PreviewLayer key={child.id} layer={child} scale={scale} onInteraction={onInteraction} />
      ))}
      {hasInteraction && (
        <div style={{
          position: 'absolute', inset: 0,
          border: '2px solid rgba(13,153,255,0.4)',
          borderRadius: 'inherit',
          pointerEvents: 'none',
        }} />
      )}
    </div>
  );
}

interface Props {
  onClose?: () => void;
  standaloneData?: PrototypeStandaloneData;
}

export default function PrototypePreview({ onClose, standaloneData }: Props) {
  const storeData = useFigmaStore();
  const isStandalone = !onClose;

  const layers = standaloneData?.layers ?? storeData.layers;
  const activePageId = standaloneData?.activePageId ?? storeData.activePageId;
  const prototypeStartFrameId = standaloneData ? null : storeData.prototypeStartFrameId;

  const pageLayers = layers[activePageId] ?? [];

  const frames = pageLayers.filter(l => l.type === 'frame' || l.type === 'component');
  const startFrame =
    (prototypeStartFrameId && pageLayers.find(l => l.id === prototypeStartFrameId)) ||
    frames[0] ||
    null;

  const [currentFrameId, setCurrentFrameId] = useState<string>(startFrame?.id ?? '');
  const [history, setHistory] = useState<string[]>([]);
  const [transitionClass, setTransitionClass] = useState('');

  const currentFrame = pageLayers.find(l => l.id === currentFrameId) ?? startFrame;

  const navigate = useCallback((targetId: string, transition: string) => {
    setHistory(h => [...h, currentFrameId]);
    setTransitionClass(transition);
    setTimeout(() => {
      setCurrentFrameId(targetId);
      setTransitionClass('');
    }, transition === 'instant' ? 0 : 50);
  }, [currentFrameId]);

  const goBack = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setCurrentFrameId(prev);
  }, [history]);

  const handleInteraction = useCallback((interaction: Interaction) => {
    if (interaction.action === 'navigate' && interaction.targetFrameId) {
      navigate(interaction.targetFrameId, interaction.transition);
    } else if (interaction.action === 'back') {
      goBack();
    }
  }, [navigate, goBack]);

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

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const maxW = vw - 80;
  const maxH = vh - 120;
  const scaleX = maxW / (currentFrame.width || 1);
  const scaleY = maxH / (currentFrame.height || 1);
  const scale = Math.min(1, scaleX, scaleY);

  const scaledW = currentFrame.width * scale;
  const scaledH = currentFrame.height * scale;

  const transitionStyle: React.CSSProperties =
    transitionClass === 'dissolve'
      ? { opacity: 0, transition: 'opacity 0.3s ease-out' }
      : transitionClass === 'slide-left'
      ? { transform: 'translateX(-100%)', transition: 'transform 0.3s ease-out' }
      : transitionClass === 'slide-right'
      ? { transform: 'translateX(100%)', transition: 'transform 0.3s ease-out' }
      : {};

  const frameFill = currentFrame.fills.find(f => f.visible !== false);
  const frameBg = frameFill?.type === 'solid' ? frameFill.color : '#ffffff';

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
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <select
            value={currentFrameId}
            onChange={e => setCurrentFrameId(e.target.value)}
            style={{ background: '#2c2c2c', border: '1px solid #3c3c3c', borderRadius: 4, color: '#ccc', fontSize: 11, padding: '3px 6px' }}
          >
            {frames.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          {history.length > 0 && (
            <button onClick={goBack} style={{ background: '#2c2c2c', border: '1px solid #3c3c3c', borderRadius: 4, color: '#ccc', fontSize: 11, padding: '3px 10px', cursor: 'pointer' }}>
              ← Back
            </button>
          )}
        </div>
        <div style={{ color: '#555', fontSize: 11 }}>
          {Math.round(scale * 100)}% · {currentFrame.name}
        </div>
        {onClose ? (
          <button
            onClick={onClose}
            style={{ background: 'none', border: '1px solid #3c3c3c', borderRadius: 4, color: '#888', fontSize: 12, padding: '4px 12px', cursor: 'pointer' }}
          >
            ✕ Close
          </button>
        ) : (
          <div style={{ color: '#555', fontSize: 11 }}>
            {standaloneData?.fileName ?? 'Prototype'}
          </div>
        )}
      </div>

      {/* Frame canvas */}
      <div
        style={{
          width: scaledW,
          height: scaledH,
          background: frameBg,
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          borderRadius: currentFrame.cornerRadius ? currentFrame.cornerRadius * scale : 0,
          ...transitionStyle,
        }}
      >
        {(currentFrame.children ?? []).map(child => (
          <PreviewLayer key={child.id} layer={child} scale={scale} onInteraction={handleInteraction} />
        ))}
      </div>

      <div style={{ marginTop: 12, color: '#555', fontSize: 11 }}>
        {currentFrame.name} · {currentFrame.width} × {currentFrame.height}
      </div>
    </div>
  );
}
