"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useFigmaStore, type FigmaLayer, type LayerType, type ToolType, type Viewport, type LayoutGrid, type VectorPoint, type AutoLayout, type Interaction } from '@/lib/stores/figmaStore';
import type { RemoteCursor } from '@/hooks/useFigmaCollaboration';

// ── Types ──────────────────────────────────────────────────────

type HandleType = 'tl' | 'tc' | 'tr' | 'ml' | 'mr' | 'bl' | 'bc' | 'br' | 'rotate' | 'radius';

type DragState =
  | { mode: 'pan'; startMX: number; startMY: number; startVpX: number; startVpY: number }
  | { mode: 'draw'; tool: ToolType; startWX: number; startWY: number; curWX: number; curWY: number }
  | { mode: 'move'; startMSX: number; startMSY: number; origPos: Record<string, { x: number; y: number }>; origWorldPos: Record<string, { x: number; y: number }> }
  | { mode: 'resize'; handle: HandleType; startMSX: number; startMSY: number; origLayer: FigmaLayer; aspectRatio: number }
  | { mode: 'rotate'; startAngle: number; origRot: number; cxS: number; cyS: number }
  | { mode: 'rubber'; startSX: number; startSY: number; curSX: number; curSY: number }
  | { mode: 'radius'; startMSX: number; origRadius: number; layerId: string }
  | { mode: 'node-point'; layerId: string; pointId: string; startX: number; startY: number; originX: number; originY: number }
  | { mode: 'node-handle'; layerId: string; pointId: string; handleType: 'in' | 'out'; startX: number; startY: number };

interface SnapLine { axis: 'h' | 'v'; pos: number; from: number; to: number; }
interface FramePreset { name: string; w: number; h: number; }
interface HandleInfo { id: HandleType; sx: number; sy: number; cursor: string; }

// ── Coordinate helpers ─────────────────────────────────────────

function screenToWorld(sx: number, sy: number, vp: Viewport): { x: number; y: number } {
  return { x: (sx - vp.x) / vp.zoom, y: (sy - vp.y) / vp.zoom };
}

// ── Ruler interval ─────────────────────────────────────────────

function getInterval(zoom: number): number {
  if (zoom >= 8) return 1;
  if (zoom >= 4) return 5;
  if (zoom >= 2) return 10;
  if (zoom >= 1) return 20;
  if (zoom >= 0.5) return 50;
  if (zoom >= 0.25) return 100;
  return 200;
}

// ── Rulers ─────────────────────────────────────────────────────

function RulerH({ viewport, width, height }: { viewport: Viewport; width: number; height: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = width * dpr;
    cv.height = height * dpr;
    cv.style.width = `${width}px`;
    cv.style.height = `${height}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, width, height);

    const interval = getInterval(viewport.zoom);
    const startWorld = -viewport.x / viewport.zoom;
    const endWorld = (width - viewport.x) / viewport.zoom;
    const firstTick = Math.floor(startWorld / interval) * interval;

    ctx.font = `9px monospace`;
    ctx.textBaseline = 'top';

    for (let w = firstTick; w <= endWorld; w += interval) {
      const sx = w * viewport.zoom + viewport.x;
      const isMajor = Math.round(w) % (interval * 5) === 0;
      const tickH = isMajor ? 8 : 4;
      ctx.fillStyle = '#444';
      ctx.fillRect(sx, height - tickH, 1, tickH);
      if (isMajor) {
        ctx.fillStyle = '#6b6b6b';
        ctx.fillText(String(Math.round(w)), sx + 2, 1);
      }
    }
  }, [viewport, width, height]);

  return <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />;
}

function RulerV({ viewport, width, height }: { viewport: Viewport; width: number; height: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = width * dpr;
    cv.height = height * dpr;
    cv.style.width = `${width}px`;
    cv.style.height = `${height}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, width, height);

    const interval = getInterval(viewport.zoom);
    const startWorld = -viewport.y / viewport.zoom;
    const endWorld = (height - viewport.y) / viewport.zoom;
    const firstTick = Math.floor(startWorld / interval) * interval;

    ctx.font = `9px monospace`;

    for (let w = firstTick; w <= endWorld; w += interval) {
      const sy = w * viewport.zoom + viewport.y;
      const isMajor = Math.round(w) % (interval * 5) === 0;
      const tickW = isMajor ? 8 : 4;
      ctx.fillStyle = '#444';
      ctx.fillRect(width - tickW, sy, tickW, 1);
      if (isMajor) {
        ctx.save();
        ctx.fillStyle = '#6b6b6b';
        ctx.translate(width - 9, sy - 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(String(Math.round(w)), 0, 0);
        ctx.restore();
      }
    }
  }, [viewport, width, height]);

  return <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />;
}

// ── Layout grid overlay ────────────────────────────────────────

function GridOverlay({ grid, width, height }: { grid: LayoutGrid; width: number; height: number }) {
  if (!grid.visible || width <= 0 || height <= 0) return null;

  const hex = grid.color.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const color = `rgba(${r},${g},${b},${grid.opacity})`;

  if (grid.type === 'grid') {
    const size = Math.max(1, grid.size || 8);
    const cols = Math.ceil(width / size);
    const rows = Math.ceil(height / size);
    return (
      <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }} width={width} height={height}>
        {Array.from({ length: cols + 1 }, (_, i) => (
          <line key={`v${i}`} x1={i * size} y1={0} x2={i * size} y2={height} stroke={color} strokeWidth={0.5} />
        ))}
        {Array.from({ length: rows + 1 }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={i * size} x2={width} y2={i * size} stroke={color} strokeWidth={0.5} />
        ))}
      </svg>
    );
  }

  if (grid.type === 'columns') {
    const count = Math.max(1, grid.count);
    const totalW = width - grid.margin * 2;
    const colW = (totalW - grid.gutter * (count - 1)) / count;
    return (
      <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }} width={width} height={height}>
        {Array.from({ length: count }, (_, i) => {
          const x = grid.margin + i * (colW + grid.gutter);
          return <rect key={i} x={x} y={0} width={colW} height={height} fill={color} />;
        })}
      </svg>
    );
  }

  if (grid.type === 'rows') {
    const count = Math.max(1, grid.count);
    const totalH = height - grid.margin * 2;
    const rowH = (totalH - grid.gutter * (count - 1)) / count;
    return (
      <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }} width={width} height={height}>
        {Array.from({ length: count }, (_, i) => {
          const y = grid.margin + i * (rowH + grid.gutter);
          return <rect key={i} x={0} y={y} width={width} height={rowH} fill={color} />;
        })}
      </svg>
    );
  }

  return null;
}

// ── Layer renderer ─────────────────────────────────────────────

function LayerRenderer({ layer, selection, textEditId }: {
  layer: FigmaLayer; selection: string[]; textEditId: string | null;
}) {
  const fill = layer.fills.find(f => f.visible !== false);
  const fillColor = fill ? fill.color : 'transparent';
  const stroke = layer.strokes.find(s => s.visible !== false);

  const baseOpacity = layer.visible === false ? 0.3 : layer.opacity;

  const style: React.CSSProperties = {
    position: 'absolute',
    left: layer.x,
    top: layer.y,
    width: layer.width,
    height: layer.height,
    opacity: baseOpacity,
    overflow: layer.clipContent ? 'hidden' : 'visible',
    boxSizing: 'border-box',
  };

  if (layer.rotation) style.transform = `rotate(${layer.rotation}deg)`;
  if (layer.cornerRadius) style.borderRadius = layer.cornerRadius;
  if (stroke) {
    style.border = `${stroke.weight}px ${stroke.type === 'dashed' ? 'dashed' : stroke.type === 'dotted' ? 'dotted' : 'solid'} ${stroke.color}`;
  }

  if (layer.type === 'ellipse') style.borderRadius = '50%';
  if (layer.type !== 'text') style.background = fillColor;

  if (layer.type === 'line') {
    return (
      <div style={{ ...style, height: stroke?.weight ?? 1, background: stroke?.color ?? fillColor, border: 'none', borderRadius: 0 }} />
    );
  }

  if (layer.type === 'text') {
    const va = layer.verticalAlign ?? 'top';
    const vaMap: Record<string, string> = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };
    return (
      <div style={{
        ...style,
        opacity: textEditId === layer.id ? 0 : baseOpacity,
        color: fillColor,
        fontSize: layer.fontSize ?? 14,
        fontFamily: layer.fontFamily ?? 'Inter, sans-serif',
        fontWeight: layer.fontWeight ?? 'normal',
        fontStyle: layer.fontStyle ?? 'normal',
        textDecoration: layer.textDecoration ?? 'none',
        textTransform: (layer.textTransform as React.CSSProperties['textTransform']) ?? 'none',
        lineHeight: layer.lineHeight ? `${layer.lineHeight}px` : 'normal',
        letterSpacing: layer.letterSpacing ?? 'normal',
        textAlign: (layer.textAlign as React.CSSProperties['textAlign']) ?? 'left',
        display: va !== 'top' ? 'flex' : 'block',
        alignItems: va !== 'top' ? vaMap[va] : undefined,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        userSelect: 'none',
      }}>
        {layer.text ?? ''}
      </div>
    );
  }

  if (layer.type === 'frame' || layer.type === 'group' || layer.type === 'section' || layer.type === 'component' || layer.type === 'instance') {
    const labelColor = layer.type === 'component' ? '#9747ff' : layer.type === 'instance' ? '#7b61ff' : '#888';
    const labelPrefix = layer.type === 'component' ? '◆ ' : layer.type === 'instance' ? '◇ ' : '';
    return (
      <div style={style} data-layer-id={layer.id}>
        <div style={{
          position: 'absolute', top: -18, left: 0, fontSize: 11,
          color: labelColor, whiteSpace: 'nowrap', pointerEvents: 'none',
          fontWeight: (layer.type === 'component' || layer.type === 'instance') ? 600 : 400,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {labelPrefix}{layer.name}
          {layer.autoLayout && (
            <span style={{ fontSize: 9, color: '#0d99ff', fontWeight: 600 }}>
              {layer.autoLayout.direction === 'horizontal' ? '⇄' : '⇅'}
            </span>
          )}
        </div>
        {(() => {
          const autoPositions = layer.autoLayout ? computeAutoLayoutPositions(layer) : null;
          return (layer.children ?? []).map(ch => {
            const ov = autoPositions?.get(ch.id);
            const child = ov ? { ...ch, x: ov.x, y: ov.y, width: ov.width, height: ov.height } : ch;
            return <LayerRenderer key={ch.id} layer={child} selection={selection} textEditId={textEditId} />;
          });
        })()}
        {(layer.layoutGrids ?? []).map(grid => (
          <GridOverlay key={grid.id} grid={grid} width={layer.width} height={layer.height} />
        ))}
      </div>
    );
  }

  if (layer.type === 'vector') {
    const pts = layer.points ?? [];
    const d = pointsToPath(pts, layer.pathClosed ?? false);
    const vFill = layer.fills.find(f => f.visible !== false);
    const vFillColor = vFill?.type === 'solid' ? vFill.color : 'none';
    const vStroke = layer.strokes.find(s => s.visible !== false);
    return (
      <div
        data-layer-id={layer.id}
        style={{
          position: 'absolute', left: layer.x, top: layer.y,
          width: Math.max(1, layer.width), height: Math.max(1, layer.height),
          opacity: baseOpacity,
          transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
          transformOrigin: 'center center',
        }}
      >
        <svg
          style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
          width={Math.max(1, layer.width)} height={Math.max(1, layer.height)}
        >
          {d && (
            <path
              d={d}
              fill={layer.pathClosed ? vFillColor : 'none'}
              stroke={vStroke?.color ?? '#000000'}
              strokeWidth={vStroke?.weight ?? 2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
      </div>
    );
  }

  if (layer.type === 'comment') {
    return (
      <div
        data-layer-id={layer.id}
        style={{ position: 'absolute', left: layer.x, top: layer.y, opacity: baseOpacity, pointerEvents: 'all' }}
        title={layer.text ?? ''}
      >
        {/* Bubble */}
        <div style={{
          position: 'absolute', bottom: 20, left: 0, background: '#fbbf24', borderRadius: 6,
          padding: '3px 7px', fontSize: 10, color: '#1e1e1e', whiteSpace: 'nowrap',
          maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis',
          boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
          display: layer.text ? 'block' : 'none',
        }}>
          {layer.text}
        </div>
        {/* Pin */}
        <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
          <ellipse cx="10" cy="10" rx="9" ry="9" fill="#fbbf24" />
          <path d="M10 19 L10 24" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
          <text x="10" y="14" textAnchor="middle" fontSize="11" fill="#1e1e1e" fontWeight="bold">!</text>
        </svg>
      </div>
    );
  }

  return (
    <div style={style} data-layer-id={layer.id}>
      {layer.children?.map(ch => <LayerRenderer key={ch.id} layer={ch} selection={selection} textEditId={textEditId} />)}
    </div>
  );
}

// ── Cursor helpers ─────────────────────────────────────────────


function cursorForTool(tool: ToolType, spaceDownState: boolean, dragModeState: string | null): string {
  if (dragModeState === 'pan' || (spaceDownState && !dragModeState)) return 'grab';
  if (spaceDownState && dragModeState) return 'grabbing';
  if (dragModeState === 'move') return 'move';
  if (dragModeState === 'rotate') return 'grabbing';
  if (tool === 'hand') return 'grab';
  if (tool === 'text') return 'text';
  if (['pen', 'frame', 'rect', 'ellipse', 'line', 'section', 'slice'].includes(tool)) return 'crosshair';
  return 'default';
}

// ── Default fills / strokes ────────────────────────────────────

function defaultFills(type: LayerType) {
  const base = { id: `fill-${Date.now()}`, type: 'solid' as const, opacity: 1, visible: true, blendMode: 'normal' };
  switch (type) {
    case 'frame': return [];
    case 'text': return [{ ...base, color: '#000000' }];
    default: return [{ ...base, color: '#e2e2e2' }];
  }
}

function defaultStrokes(type: LayerType) {
  const base = { id: `stroke-${Date.now()}`, opacity: 1, weight: 1, position: 'center' as const, type: 'solid' as const, visible: true };
  if (type === 'frame') return [{ ...base, color: '#cccccc' }];
  return [];
}

// ── Vector path builder ────────────────────────────────────────

function pointsToPath(points: VectorPoint[], closed: boolean): string {
  if (points.length === 0) return '';
  const cmds: string[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (i === 0) {
      cmds.push(`M ${p.x} ${p.y}`);
    } else {
      const prev = points[i - 1];
      const cp1 = prev.handleOut ?? prev;
      const cp2 = p.handleIn ?? p;
      if (cp1.x === prev.x && cp1.y === prev.y && cp2.x === p.x && cp2.y === p.y) {
        cmds.push(`L ${p.x} ${p.y}`);
      } else {
        cmds.push(`C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${p.x} ${p.y}`);
      }
    }
  }
  if (closed && points.length > 1) {
    const last = points[points.length - 1];
    const first = points[0];
    const cp1 = last.handleOut ?? last;
    const cp2 = first.handleIn ?? first;
    if (cp1.x === last.x && cp1.y === last.y && cp2.x === first.x && cp2.y === first.y) {
      cmds.push('Z');
    } else {
      cmds.push(`C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${first.x} ${first.y} Z`);
    }
  }
  return cmds.join(' ');
}

// ── Auto layout position computer ─────────────────────────────

function computeAutoLayoutPositions(
  layer: FigmaLayer
): Map<string, { x: number; y: number; width: number; height: number }> {
  const result = new Map<string, { x: number; y: number; width: number; height: number }>();
  const al = layer.autoLayout!;
  const children = layer.children ?? [];
  if (children.length === 0) return result;

  const { direction, gap, paddingTop, paddingRight, paddingBottom, paddingLeft,
    primaryAlign, counterAlign } = al;

  const innerW = layer.width - paddingLeft - paddingRight;
  const innerH = layer.height - paddingTop - paddingBottom;

  const childSizes = children.map(ch => ({
    id: ch.id,
    w: ch.width,
    h: ch.height,
    hSizing: ch.layoutSizing?.horizontal ?? 'fixed',
    vSizing: ch.layoutSizing?.vertical ?? 'fixed',
  }));

  if (direction === 'horizontal') {
    const fixedW = childSizes.reduce((sum, c) => sum + (c.hSizing !== 'fill' ? c.w : 0), 0);
    const fillCount = childSizes.filter(c => c.hSizing === 'fill').length;
    const totalGap = gap * (children.length - 1);
    const fillW = fillCount > 0 ? Math.max(0, innerW - fixedW - totalGap) / fillCount : 0;
    childSizes.forEach(c => { if (c.hSizing === 'fill') c.w = Math.max(0, fillW); });
    childSizes.forEach(c => { if (c.vSizing === 'fill') c.h = Math.max(0, innerH); });

    const totalW = childSizes.reduce((sum, c) => sum + c.w, 0) + totalGap;
    let cursorX = paddingLeft;
    if (primaryAlign === 'center') cursorX = paddingLeft + (innerW - totalW) / 2;
    else if (primaryAlign === 'end') cursorX = paddingLeft + innerW - totalW;

    const spaceBetween = primaryAlign === 'space-between' && children.length > 1
      ? (innerW - childSizes.reduce((sum, c) => sum + c.w, 0)) / (children.length - 1)
      : gap;

    childSizes.forEach(c => {
      let y = paddingTop;
      if (counterAlign === 'center') y = paddingTop + (innerH - c.h) / 2;
      else if (counterAlign === 'end') y = paddingTop + innerH - c.h;
      result.set(c.id, { x: cursorX, y, width: c.w, height: c.h });
      cursorX += c.w + (primaryAlign === 'space-between' ? spaceBetween : gap);
    });

  } else {
    const fixedH = childSizes.reduce((sum, c) => sum + (c.vSizing !== 'fill' ? c.h : 0), 0);
    const fillCount = childSizes.filter(c => c.vSizing === 'fill').length;
    const totalGap = gap * (children.length - 1);
    const fillH = fillCount > 0 ? Math.max(0, innerH - fixedH - totalGap) / fillCount : 0;
    childSizes.forEach(c => { if (c.vSizing === 'fill') c.h = Math.max(0, fillH); });
    childSizes.forEach(c => { if (c.hSizing === 'fill') c.w = Math.max(0, innerW); });

    const totalH = childSizes.reduce((sum, c) => sum + c.h, 0) + totalGap;
    let cursorY = paddingTop;
    if (primaryAlign === 'center') cursorY = paddingTop + (innerH - totalH) / 2;
    else if (primaryAlign === 'end') cursorY = paddingTop + innerH - totalH;

    const spaceBetween = primaryAlign === 'space-between' && children.length > 1
      ? (innerH - childSizes.reduce((sum, c) => sum + c.h, 0)) / (children.length - 1)
      : gap;

    childSizes.forEach(c => {
      let x = paddingLeft;
      if (counterAlign === 'center') x = paddingLeft + (innerW - c.w) / 2;
      else if (counterAlign === 'end') x = paddingLeft + innerW - c.w;
      result.set(c.id, { x, y: cursorY, width: c.w, height: c.h });
      cursorY += c.h + (primaryAlign === 'space-between' ? spaceBetween : gap);
    });
  }

  return result;
}

// ── Frame presets ──────────────────────────────────────────────

const FRAME_PRESETS: FramePreset[] = [
  { name: 'Desktop', w: 1440, h: 1024 },
  { name: 'MacBook', w: 1280, h: 832 },
  { name: 'iPhone 14', w: 390, h: 844 },
  { name: 'iPhone SE', w: 375, h: 667 },
  { name: 'iPad', w: 820, h: 1180 },
  { name: 'Android', w: 360, h: 800 },
  { name: 'Watch', w: 198, h: 242 },
];

// ── Bounding box ───────────────────────────────────────────────

function getBoundingBox(layers: FigmaLayer[]): { x: number; y: number; w: number; h: number } | null {
  if (!layers.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const l of layers) {
    minX = Math.min(minX, l.x);
    minY = Math.min(minY, l.y);
    maxX = Math.max(maxX, l.x + l.width);
    maxY = Math.max(maxY, l.y + (l.type === 'line' ? 0 : l.height));
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// ── Snap lines ─────────────────────────────────────────────────

function computeSnapLines(
  movingLayers: FigmaLayer[],
  allLayers: FigmaLayer[],
  selectedIds: string[],
  vp: Viewport,
  threshold = 4
): { lines: SnapLine[]; snapDX: number; snapDY: number } {
  const guides: { axis: 'h' | 'v'; world: number }[] = [];
  for (const l of allLayers) {
    if (selectedIds.includes(l.id)) continue;
    const cx = l.x + l.width / 2;
    const cy = l.y + l.height / 2;
    guides.push(
      { axis: 'v', world: l.x },
      { axis: 'v', world: l.x + l.width },
      { axis: 'v', world: cx },
      { axis: 'h', world: l.y },
      { axis: 'h', world: l.y + l.height },
      { axis: 'h', world: cy },
    );
  }

  const bb = getBoundingBox(movingLayers);
  if (!bb) return { lines: [], snapDX: 0, snapDY: 0 };

  const movingEdges = {
    v: [bb.x, bb.x + bb.w, bb.x + bb.w / 2],
    h: [bb.y, bb.y + bb.h, bb.y + bb.h / 2],
  };

  const lines: SnapLine[] = [];
  let snapDX = 0, snapDY = 0;

  for (const g of guides) {
    for (const edge of movingEdges[g.axis]) {
      const screenDist = Math.abs((edge - g.world) * vp.zoom);
      if (screenDist < threshold) {
        const worldDelta = g.world - edge;
        if (g.axis === 'v' && !snapDX) snapDX = worldDelta;
        if (g.axis === 'h' && !snapDY) snapDY = worldDelta;
        if (g.axis === 'v') {
          const sx = g.world * vp.zoom + vp.x;
          lines.push({ axis: 'v', pos: sx, from: 0, to: 2000 });
        } else {
          const sy = g.world * vp.zoom + vp.y;
          lines.push({ axis: 'h', pos: sy, from: 0, to: 2000 });
        }
        break;
      }
    }
  }

  return { lines, snapDX, snapDY };
}

// ── Tree helpers ───────────────────────────────────────────────

function findLayerInTree(layers: FigmaLayer[], id: string): FigmaLayer | null {
  for (const l of layers) {
    if (l.id === id) return l;
    if (l.children) { const f = findLayerInTree(l.children, id); if (f) return f; }
  }
  return null;
}

type WorldEntry = FigmaLayer & { wx: number; wy: number };

function flattenWorldSpace(layers: FigmaLayer[], ox = 0, oy = 0): WorldEntry[] {
  const result: WorldEntry[] = [];
  for (const l of layers) {
    const wx = ox + l.x;
    const wy = oy + l.y;
    result.push({ ...l, wx, wy });
    if (l.children?.length) result.push(...flattenWorldSpace(l.children, wx, wy));
  }
  return result;
}

// ── Hit test ───────────────────────────────────────────────────

function hitTest(wx: number, wy: number, layers: FigmaLayer[], ox = 0, oy = 0): string | null {
  for (let i = layers.length - 1; i >= 0; i--) {
    const l = layers[i];
    if (!l.visible || l.locked) continue;
    const lx = ox + l.x;
    const ly = oy + l.y;
    if (wx >= lx && wx <= lx + l.width && wy >= ly && wy <= ly + (l.type === 'line' ? 2 : l.height)) {
      // Prefer children over the parent frame — depth-first
      if (l.children?.length) {
        const childHit = hitTest(wx, wy, l.children, lx, ly);
        if (childHit) return childHit;
      }
      return l.id;
    }
  }
  return null;
}

// ── Handle geometry ────────────────────────────────────────────

function getHandles(bb: { x: number; y: number; w: number; h: number }, vp: Viewport): HandleInfo[] {
  const sx = bb.x * vp.zoom + vp.x;
  const sy = bb.y * vp.zoom + vp.y;
  const sw = bb.w * vp.zoom;
  const sh = bb.h * vp.zoom;
  return [
    { id: 'tl', sx, sy, cursor: 'nwse-resize' },
    { id: 'tc', sx: sx + sw / 2, sy, cursor: 'ns-resize' },
    { id: 'tr', sx: sx + sw, sy, cursor: 'nesw-resize' },
    { id: 'mr', sx: sx + sw, sy: sy + sh / 2, cursor: 'ew-resize' },
    { id: 'br', sx: sx + sw, sy: sy + sh, cursor: 'nwse-resize' },
    { id: 'bc', sx: sx + sw / 2, sy: sy + sh, cursor: 'ns-resize' },
    { id: 'bl', sx, sy: sy + sh, cursor: 'nesw-resize' },
    { id: 'ml', sx, sy: sy + sh / 2, cursor: 'ew-resize' },
    { id: 'rotate', sx: sx + sw / 2, sy: sy - 24, cursor: 'grab' },
  ];
}

// ── Selection overlay ──────────────────────────────────────────

function SelectionOverlay({
  selectedLayers, viewport, onHandleMouseDown, rotateAngle,
}: {
  selectedLayers: FigmaLayer[];
  viewport: Viewport;
  onHandleMouseDown: (e: React.MouseEvent, handle: HandleType) => void;
  rotateAngle: number | null;
}) {
  if (!selectedLayers.length) return null;
  const bb = getBoundingBox(selectedLayers);
  if (!bb) return null;

  const sx = bb.x * viewport.zoom + viewport.x;
  const sy = bb.y * viewport.zoom + viewport.y;
  const sw = bb.w * viewport.zoom;
  const sh = bb.h * viewport.zoom;
  const handles = getHandles(bb, viewport);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 20 }}>
      <div style={{
        position: 'absolute', left: sx, top: sy, width: sw, height: sh,
        border: '1px solid #0d99ff', boxSizing: 'border-box', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        left: sx + sw / 2 - 0.5, top: sy - 24,
        width: 1, height: 24, background: '#0d99ff', pointerEvents: 'none',
      }} />
      {handles.map(h => (
        <div
          key={h.id}
          style={{
            position: 'absolute',
            left: h.sx - 4, top: h.sy - 4,
            width: 8, height: 8,
            background: h.id === 'rotate' ? '#0d99ff' : '#ffffff',
            border: '1px solid #0d99ff',
            borderRadius: h.id === 'rotate' ? '50%' : 2,
            cursor: h.cursor,
            pointerEvents: 'all',
            zIndex: 21,
            boxSizing: 'border-box',
          }}
          onMouseDown={e => { e.stopPropagation(); onHandleMouseDown(e, h.id); }}
        />
      ))}
      {rotateAngle !== null && (
        <div style={{
          position: 'absolute',
          left: sx + sw / 2 + 8, top: sy - 30,
          background: '#18a0fb', color: '#fff',
          fontSize: 11, padding: '2px 6px', borderRadius: 4,
          pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          {Math.round(rotateAngle)}°
        </div>
      )}
    </div>
  );
}

// ── Hover highlight ────────────────────────────────────────────

function HoverHighlight({ hoveredId, flatAll, selection, viewport }: {
  hoveredId: string | null; flatAll: WorldEntry[]; selection: string[]; viewport: Viewport;
}) {
  if (!hoveredId || selection.includes(hoveredId)) return null;
  const entry = flatAll.find(e => e.id === hoveredId);
  if (!entry) return null;
  const vp = viewport;
  const sx = entry.wx * vp.zoom + vp.x;
  const sy = entry.wy * vp.zoom + vp.y;
  const sw = entry.width * vp.zoom;
  const sh = entry.height * vp.zoom;
  return (
    <div style={{
      position: 'absolute', pointerEvents: 'none', zIndex: 16,
      left: sx, top: sy, width: sw, height: sh,
      outline: '1px solid rgba(13,153,255,0.6)', boxSizing: 'border-box',
    }} />
  );
}

// ── Distance overlay ───────────────────────────────────────────

function DistanceOverlay({ selectedLayers, hoveredId, flatAll, viewport }: {
  selectedLayers: FigmaLayer[]; hoveredId: string | null; flatAll: WorldEntry[]; viewport: Viewport;
}) {
  if (!hoveredId || !selectedLayers.length) return null;
  const hoveredEntry = flatAll.find(e => e.id === hoveredId);
  if (!hoveredEntry || selectedLayers.some(l => l.id === hoveredId)) return null;
  const sb = getBoundingBox(selectedLayers);
  if (!sb) return null;

  const vp = viewport;
  const distLeft = Math.round(sb.x - hoveredEntry.wx);
  const distRight = Math.round((hoveredEntry.wx + hoveredEntry.width) - (sb.x + sb.w));
  const distTop = Math.round(sb.y - hoveredEntry.wy);
  const distBottom = Math.round((hoveredEntry.wy + hoveredEntry.height) - (sb.y + sb.h));

  const selMidS = { x: (sb.x + sb.w / 2) * vp.zoom + vp.x, y: (sb.y + sb.h / 2) * vp.zoom + vp.y };

  const hsx = hoveredEntry.wx * vp.zoom + vp.x;
  const hsy = hoveredEntry.wy * vp.zoom + vp.y;
  const hsw = hoveredEntry.width * vp.zoom;
  const hsh = hoveredEntry.height * vp.zoom;

  const labelStyle: React.CSSProperties = {
    position: 'absolute', background: '#e91e8c', color: '#fff',
    fontSize: 10, padding: '1px 4px', borderRadius: 3, whiteSpace: 'nowrap', pointerEvents: 'none',
  };

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 15 }}>
      <div style={{ position: 'absolute', left: hsx, top: hsy, width: hsw, height: hsh, border: '1px solid #e91e8c', boxSizing: 'border-box' }} />
      {distLeft > 0 && <div style={{ ...labelStyle, left: selMidS.x - 40, top: selMidS.y }}>{distLeft}</div>}
      {distRight > 0 && <div style={{ ...labelStyle, left: selMidS.x + 20, top: selMidS.y }}>{distRight}</div>}
      {distTop > 0 && <div style={{ ...labelStyle, left: selMidS.x, top: selMidS.y - 20 }}>{distTop}</div>}
      {distBottom > 0 && <div style={{ ...labelStyle, left: selMidS.x, top: selMidS.y + 10 }}>{distBottom}</div>}
    </div>
  );
}

// ── Snap lines overlay ─────────────────────────────────────────

function SnapLinesOverlay({ lines }: { lines: SnapLine[] }) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 18 }}>
      {lines.map((l, i) => (
        <div key={i} style={{
          position: 'absolute',
          background: '#ff3d3d',
          ...(l.axis === 'h'
            ? { left: l.from, top: l.pos - 0.5, width: l.to - l.from, height: 1 }
            : { left: l.pos - 0.5, top: l.from, width: 1, height: l.to - l.from }),
        }} />
      ))}
    </div>
  );
}

// ── Frame picker panel ─────────────────────────────────────────

function FramePickerPanel({ sx, sy, onSelect, onClose }: {
  sx: number; sy: number;
  onSelect: (w: number, h: number) => void;
  onClose: () => void;
}) {
  const [customW, setCustomW] = React.useState('');
  const [customH, setCustomH] = React.useState('');

  return (
    <div
      style={{
        position: 'absolute', left: Math.min(sx + 8, window.innerWidth - 240), top: sy + 8, zIndex: 100,
        background: '#2c2c2c', border: '1px solid #3c3c3c', borderRadius: 8,
        padding: '8px 0', width: 220, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', fontSize: 12,
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div style={{ padding: '4px 12px 8px', color: '#888', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Frame</div>
      {FRAME_PRESETS.map(p => (
        <div
          key={p.name}
          style={{ padding: '6px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', color: '#ebebeb' }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.06)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = ''; }}
          onClick={() => { onSelect(p.w, p.h); onClose(); }}
        >
          <span>{p.name}</span>
          <span style={{ color: '#888' }}>{p.w} × {p.h}</span>
        </div>
      ))}
      <div style={{ height: 1, background: '#3c3c3c', margin: '8px 0' }} />
      <div style={{ padding: '4px 12px', color: '#888', fontSize: 11 }}>Custom</div>
      <div style={{ padding: '4px 12px 8px', display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          value={customW} onChange={e => setCustomW(e.target.value)} placeholder="W"
          style={{ width: 70, background: '#1e1e1e', border: '1px solid #3c3c3c', borderRadius: 4, padding: '4px 6px', color: '#ebebeb', fontSize: 12 }}
        />
        <span style={{ color: '#888' }}>×</span>
        <input
          value={customH} onChange={e => setCustomH(e.target.value)} placeholder="H"
          style={{ width: 70, background: '#1e1e1e', border: '1px solid #3c3c3c', borderRadius: 4, padding: '4px 6px', color: '#ebebeb', fontSize: 12 }}
        />
        <button
          style={{ background: '#0d99ff', border: 'none', borderRadius: 4, color: '#fff', padding: '4px 8px', cursor: 'pointer', fontSize: 11 }}
          onClick={() => { const w = parseInt(customW) || 100; const h = parseInt(customH) || 100; onSelect(w, h); onClose(); }}
        >+</button>
      </div>
    </div>
  );
}

// ── Context menu helpers ───────────────────────────────────────

function CtxItem({ label, shortcut, onClick, danger }: {
  label: string; shortcut?: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        width: '100%', padding: '5px 12px', background: 'none', border: 'none',
        cursor: 'pointer', color: danger ? '#ff6b6b' : '#ebebeb', fontSize: 12,
        textAlign: 'left', gap: 24,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
    >
      <span>{label}</span>
      {shortcut && <span style={{ fontSize: 10, color: '#666' }}>{shortcut}</span>}
    </button>
  );
}

function CtxDivider() {
  return <div style={{ height: 1, background: '#3c3c3c', margin: '4px 0' }} />;
}

// ── Main Canvas ────────────────────────────────────────────────

const DRAW_TOOLS: ToolType[] = ['frame', 'rect', 'ellipse', 'line', 'text', 'section', 'slice'];

interface CanvasProps {
  remoteCursors?: RemoteCursor[];
  emitCursor?: (x: number, y: number) => void;
}

export default function Canvas({ remoteCursors = [], emitCursor }: CanvasProps) {
  const {
    layers, activePageId, selection, hoveredId, activeTool, viewport,
    setViewport, setSelection, setHovered, addLayer, addLayerToParent, setActiveTool, updateLayer,
    editingVectorId, nodeSelection, setEditingVector, setNodeSelection,
    updateVectorPoint, deleteVectorPoints,
    components, createComponent, detachInstance, deleteLayer, duplicateLayer, paste,
    editorMode, showRulers, showGrid,
  } = useFigmaStore();

  const currentLayers = React.useMemo(() => layers[activePageId] ?? [], [layers, activePageId]);
  const outerRef = useRef<HTMLDivElement>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const [rulerSize, setRulerSize] = useState({ w: 800, h: 600 });

  const dragRef = useRef<DragState | null>(null);
  const spaceDownRef = useRef(false);
  // Render-visible mirrors of refs (updated alongside the refs)
  const [dragMode, setDragMode] = useState<string | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);

  const viewportRef = useRef(viewport);
  const activeToolRef = useRef(activeTool);
  const selectionRef = useRef(selection);
  const layersRef = useRef(currentLayers);

  const [snapLines, setSnapLines] = useState<SnapLine[]>([]);
  const [rubberBand, setRubberBand] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [framePicker, setFramePicker] = useState<{ sx: number; sy: number; wx: number; wy: number } | null>(null);
  const [rotateAngle, setRotateAngle] = useState<number | null>(null);
  const [drawPreview, setDrawPreview] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [textEditId, setTextEditId] = useState<string | null>(null);
  const textEditRef = useRef<HTMLDivElement>(null);
  const textEditIdRef = useRef<string | null>(null);
  const setTextEditIdRef = useRef(setTextEditId);
  useEffect(() => { textEditIdRef.current = textEditId; }, [textEditId]);

  // Pen tool state
  const [penPoints, setPenPoints] = useState<VectorPoint[]>([]);
  const [penPreview, setPenPreview] = useState<{ x: number; y: number } | null>(null);
  const penPointsRef = useRef<VectorPoint[]>([]);
  useEffect(() => { penPointsRef.current = penPoints; }, [penPoints]);

  // Context menu
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; layerId: string | null } | null>(null);
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [ctxMenu]);

  // Keep refs in sync
  useEffect(() => { viewportRef.current = viewport; }, [viewport]);
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { selectionRef.current = selection; }, [selection]);
  useEffect(() => { layersRef.current = currentLayers; }, [currentLayers]);

  // Observe canvas area size for rulers
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      for (const e of entries) setRulerSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Non-passive wheel handler
  useEffect(() => {
    const el = canvasAreaRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const vp = viewportRef.current;
      if (e.ctrlKey || e.metaKey) {
        const factor = e.deltaY < 0 ? 1.1 : 0.909;
        const rect = el.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const worldX = (mx - vp.x) / vp.zoom;
        const worldY = (my - vp.y) / vp.zoom;
        const newZoom = Math.max(0.02, Math.min(64, vp.zoom * factor));
        setViewport({ zoom: newZoom, x: mx - worldX * newZoom, y: my - worldY * newZoom });
      } else {
        setViewport({ x: vp.x - e.deltaX, y: vp.y - e.deltaY });
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [setViewport]);

  // Space key for hand-tool pan
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        const t = e.target as HTMLElement;
        if (t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA' && !t.isContentEditable) {
          e.preventDefault();
          spaceDownRef.current = true;
          setSpaceDown(true);
        }
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceDownRef.current = false;
        setSpaceDown(false);
      }
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, []);

  // commitNewLayer (uses refs, defined here so it can be called from mouseup)
  const addLayerRef = useRef(addLayer);
  const addLayerToParentRef = useRef(addLayerToParent);
  const setSelectionRef = useRef(setSelection);
  const setActiveToolRef = useRef(setActiveTool);
  const updateLayerRef = useRef(updateLayer);
  const setEditingVectorRef = useRef(setEditingVector);
  useEffect(() => { addLayerRef.current = addLayer; }, [addLayer]);
  useEffect(() => { addLayerToParentRef.current = addLayerToParent; }, [addLayerToParent]);
  useEffect(() => { setSelectionRef.current = setSelection; }, [setSelection]);
  useEffect(() => { setActiveToolRef.current = setActiveTool; }, [setActiveTool]);
  useEffect(() => { updateLayerRef.current = updateLayer; }, [updateLayer]);
  useEffect(() => { setEditingVectorRef.current = setEditingVector; }, [setEditingVector]);
  useEffect(() => { setTextEditIdRef.current = setTextEditId; }, []);

  // Initialize contenteditable text when entering edit mode
  useEffect(() => {
    if (!textEditId || !textEditRef.current) return;
    const layer = layersRef.current.find(l => l.id === textEditId);
    if (!layer) return;
    textEditRef.current.innerText = layer.text ?? '';
    // Place cursor at end
    const el = textEditRef.current;
    const range = document.createRange();
    const sel = window.getSelection();
    if (el.childNodes.length > 0) {
      range.setStartAfter(el.lastChild!);
      range.collapse(true);
    } else {
      range.selectNodeContents(el);
      range.collapse(false);
    }
    sel?.removeAllRanges();
    sel?.addRange(range);
    el.focus();
  }, [textEditId]);

  // Find the deepest top-level frame whose bounds contain (cx, cy) in world coords.
  // Returns the frame and its world-space origin so callers can convert to local coords.
  const findContainingFrame = (layers: FigmaLayer[], cx: number, cy: number): { frame: FigmaLayer; wx: number; wy: number } | null => {
    // Iterate in reverse so the last-drawn (topmost) frame wins when overlapping
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i];
      if (l.type !== 'frame' && l.type !== 'component' && l.type !== 'section') continue;
      if (cx >= l.x && cx <= l.x + l.width && cy >= l.y && cy <= l.y + l.height) {
        return { frame: l, wx: l.x, wy: l.y };
      }
    }
    return null;
  };

  const commitNewLayer = useCallback((type: LayerType, x: number, y: number, w: number, h: number) => {
    const typeNames: Record<LayerType, string> = {
      frame: 'Frame', rect: 'Rectangle', ellipse: 'Ellipse', line: 'Line',
      text: 'Text', group: 'Group', section: 'Section', image: 'Image',
      component: 'Component', instance: 'Instance', vector: 'Vector', comment: 'Comment',
    };
    const curLayers = layersRef.current;
    const countAllOfType = (arr: FigmaLayer[]): number =>
      arr.reduce((n, l) => n + (l.type === type ? 1 : 0) + (l.children ? countAllOfType(l.children) : 0), 0);
    const countOfType = countAllOfType(curLayers);
    const newLayer: FigmaLayer = {
      id: `layer-${Date.now()}`,
      name: `${typeNames[type]} ${countOfType + 1}`,
      type, x: Math.round(x), y: Math.round(y),
      width: Math.round(w), height: type === 'line' ? 0 : Math.round(h),
      rotation: 0, visible: true, locked: false, opacity: 1, blendMode: 'normal',
      fills: defaultFills(type), strokes: defaultStrokes(type),
      effects: [], exports: [],
      ...(type === 'text' ? { text: 'Text', fontSize: 14, fontFamily: 'Inter, sans-serif', fontWeight: 'normal' } : {}),
    };

    // Nest inside a frame if the new layer's center falls within one
    const cx = x + w / 2;
    const cy = y + h / 2;
    const container = findContainingFrame(curLayers, cx, cy);
    if (container) {
      const localLayer = { ...newLayer, x: Math.round(x - container.wx), y: Math.round(y - container.wy) };
      addLayerToParentRef.current(localLayer, container.frame.id);
      setSelectionRef.current([localLayer.id]);
    } else {
      addLayerRef.current(newLayer);
      setSelectionRef.current([newLayer.id]);
    }

    setActiveToolRef.current('select');
    if (type === 'text') {
      setTextEditIdRef.current(newLayer.id);
    }
  }, []);

  // Finalize pen path: normalize world coords to local, commit layer
  const finalizePenPath = useCallback((closed: boolean) => {
    const pts = penPointsRef.current;
    if (pts.length < 1) return;
    const xs = pts.map(p => p.x);
    const ys = pts.map(p => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);
    const localPoints: VectorPoint[] = pts.map(p => ({
      ...p,
      x: p.x - minX,
      y: p.y - minY,
      handleIn: p.handleIn ? { x: p.handleIn.x - minX, y: p.handleIn.y - minY } : undefined,
      handleOut: p.handleOut ? { x: p.handleOut.x - minX, y: p.handleOut.y - minY } : undefined,
    }));
    const newLayer: FigmaLayer = {
      id: `layer-${Date.now()}`,
      name: 'Path',
      type: 'vector',
      x: minX, y: minY, width: w, height: h,
      rotation: 0, visible: true, locked: false, opacity: 1, blendMode: 'normal',
      fills: closed ? [{ id: `f-${Date.now()}`, type: 'solid', color: '#d4d4d4', opacity: 1, visible: true, blendMode: 'normal' }] : [],
      strokes: [{ id: `s-${Date.now()}`, color: '#000000', opacity: 1, weight: 2, position: 'center', type: 'solid', visible: true }],
      effects: [], exports: [],
      points: localPoints,
      pathClosed: closed,
    };
    const curLayers = layersRef.current;
    const cx = minX + w / 2;
    const cy = minY + h / 2;
    const container = findContainingFrame(curLayers, cx, cy);
    if (container) {
      const localLayer = { ...newLayer, x: minX - container.wx, y: minY - container.wy };
      addLayerToParentRef.current(localLayer, container.frame.id);
      setSelectionRef.current([localLayer.id]);
    } else {
      addLayerRef.current(newLayer);
      setSelectionRef.current([newLayer.id]);
    }
    setPenPoints([]);
    setPenPreview(null);
    setActiveToolRef.current('select');
  }, []);

  // Clean up pen state when tool changes away from pen
  useEffect(() => {
    if (activeTool !== 'pen') {
      setPenPoints([]);
      setPenPreview(null);
    }
  }, [activeTool]);

  // Pen escape/enter to finalize path
  useEffect(() => {
    if (activeTool !== 'pen') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const pts = penPointsRef.current;
        if (pts.length >= 2) finalizePenPath(false);
        else { setPenPoints([]); setPenPreview(null); setActiveToolRef.current('select'); }
      }
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [activeTool, finalizePenPath]);

  // Node editor: escape exits, delete removes selected nodes
  useEffect(() => {
    if (!editingVectorId) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target instanceof HTMLInputElement || target.contentEditable === 'true') return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setEditingVectorRef.current(null);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && nodeSelection.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        deleteVectorPoints(editingVectorId, nodeSelection);
        setNodeSelection([]);
      }
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [editingVectorId, nodeSelection, deleteVectorPoints, setNodeSelection]);

  // Exit node edit when selection moves away
  useEffect(() => {
    if (editingVectorId && !selection.includes(editingVectorId)) {
      setEditingVectorRef.current(null);
    }
  }, [selection, editingVectorId]);

  // Ctrl+Alt+K — create component from selection
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target instanceof HTMLInputElement || target.contentEditable === 'true') return;
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (selectionRef.current.length > 0) createComponent(selectionRef.current);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [createComponent]);

  // Handle mousedown on handles
  const handleHandleMouseDown = useCallback((e: React.MouseEvent, handle: HandleType) => {
    e.preventDefault();
    e.stopPropagation();
    const el = canvasAreaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const msx = e.clientX - rect.left;
    const msy = e.clientY - rect.top;
    const vp = viewportRef.current;
    const curSel = selectionRef.current;
    const curLayers = layersRef.current;

    if (handle === 'rotate') {
      const layer = findLayerInTree(curLayers, curSel[0]);
      if (!layer) return;
      const flatAll = flattenWorldSpace(curLayers);
      const entry = flatAll.find(e => e.id === curSel[0]);
      const worldLayer = entry ? { ...layer, x: entry.wx, y: entry.wy } : layer;
      const bb = getBoundingBox([worldLayer]);
      if (!bb) return;
      const cxS = bb.x * vp.zoom + vp.x + (bb.w * vp.zoom) / 2;
      const cyS = bb.y * vp.zoom + vp.y + (bb.h * vp.zoom) / 2;
      const startAngle = Math.atan2(msy - cyS, msx - cxS) * (180 / Math.PI);
      dragRef.current = { mode: 'rotate', startAngle, origRot: layer.rotation ?? 0, cxS, cyS };
      setDragMode('rotate');
      return;
    }

    if (handle === 'radius') {
      const layer = findLayerInTree(curLayers, curSel[0]);
      if (!layer) return;
      dragRef.current = { mode: 'radius', startMSX: msx, origRadius: layer.cornerRadius ?? 0, layerId: layer.id };
      setDragMode('radius');
      return;
    }

    const layer = findLayerInTree(curLayers, curSel[0]);
    if (!layer) return;
    dragRef.current = {
      mode: 'resize', handle, startMSX: msx, startMSY: msy,
      origLayer: { ...layer },
      aspectRatio: layer.height > 0 ? layer.width / layer.height : 1,
    };
    setDragMode('resize');
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = canvasAreaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const msx = e.clientX - rect.left;
    const msy = e.clientY - rect.top;
    const vp = viewportRef.current;
    const { x: wx, y: wy } = screenToWorld(msx, msy, vp);
    const curLayers = layersRef.current;
    const hitId = hitTest(wx, wy, curLayers);
    if (!hitId) return;
    const layer = findLayerInTree(curLayers, hitId);
    if (!layer) return;
    if (layer.type === 'vector') {
      setEditingVectorRef.current(hitId);
      setSelectionRef.current([hitId]);
      return;
    }
    if (layer.type !== 'text') return;
    setTextEditId(hitId);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Exit text edit on any canvas click (overlay has stopPropagation, so only outside clicks reach here)
    if (textEditIdRef.current) {
      setTextEditId(null);
    }
    if (e.button !== 0 && e.button !== 1) return;
    const el = canvasAreaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const msx = e.clientX - rect.left;
    const msy = e.clientY - rect.top;
    const vp = viewportRef.current;
    const tool = activeToolRef.current;

    if (e.button === 1 || spaceDownRef.current || tool === 'hand') {
      dragRef.current = { mode: 'pan', startMX: e.clientX, startMY: e.clientY, startVpX: vp.x, startVpY: vp.y };
      setDragMode('pan');
      return;
    }

    const { x: wx, y: wy } = screenToWorld(msx, msy, vp);

    if (DRAW_TOOLS.includes(tool)) {
      dragRef.current = { mode: 'draw', tool, startWX: wx, startWY: wy, curWX: wx, curWY: wy };
      setDragMode('draw');
      setDrawPreview({ x: wx, y: wy, w: 0, h: 0 });
      return;
    }

    if (tool === 'pen') {
      const pts = penPointsRef.current;
      // Check if clicking near first point to close the path
      if (pts.length >= 3) {
        const first = pts[0];
        const fsx = first.x * vp.zoom + vp.x;
        const fsy = first.y * vp.zoom + vp.y;
        const dx = fsx - msx;
        const dy = fsy - msy;
        if (Math.sqrt(dx * dx + dy * dy) < 10) {
          finalizePenPath(true);
          return;
        }
      }
      const newPt: VectorPoint = {
        id: `pt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        x: wx, y: wy, cornerType: 'sharp',
      };
      setPenPoints(prev => [...prev, newPt]);
      e.preventDefault();
      return;
    }

    if (tool === 'comment') {
      const text = window.prompt('Add comment:');
      if (text !== null) {
        addLayer({
          id: `layer-${Date.now()}`,
          type: 'comment',
          name: 'Comment',
          x: Math.round(wx), y: Math.round(wy),
          width: 20, height: 24,
          rotation: 0, visible: true, locked: false, opacity: 1, blendMode: 'normal',
          text,
          fills: [], strokes: [], effects: [], exports: [],
        });
      }
      setActiveTool('select');
      return;
    }

    if (tool !== 'select') return;

    const curLayers = layersRef.current;
    const hitId = hitTest(wx, wy, curLayers);
    const curSel = selectionRef.current;

    if (!hitId) {
      if (!e.shiftKey) setSelection([]);
      dragRef.current = { mode: 'rubber', startSX: msx, startSY: msy, curSX: msx, curSY: msy };
      setDragMode('rubber');
      setRubberBand({ x: msx, y: msy, w: 0, h: 0 });
      return;
    }

    if (e.shiftKey) {
      const newSel = curSel.includes(hitId) ? curSel.filter(id => id !== hitId) : [...curSel, hitId];
      setSelection(newSel);
      return;
    }

    if (!curSel.includes(hitId)) setSelection([hitId]);

    const sel = curSel.includes(hitId) ? curSel : [hitId];
    const origPos: Record<string, { x: number; y: number }> = {};
    const origWorldPos: Record<string, { x: number; y: number }> = {};
    const flatStart = flattenWorldSpace(curLayers);
    for (const id of sel) {
      const l = findLayerInTree(curLayers, id);
      const entry = flatStart.find(e => e.id === id);
      if (l) origPos[id] = { x: l.x, y: l.y };
      if (entry) origWorldPos[id] = { x: entry.wx, y: entry.wy };
    }
    dragRef.current = { mode: 'move', startMSX: msx, startMSY: msy, origPos, origWorldPos };
    setDragMode('move');
  }, [setSelection]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const el = canvasAreaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const msx = e.clientX - rect.left;
    const msy = e.clientY - rect.top;
    const vp = viewportRef.current;
    const drag = dragRef.current;
    const curLayers = layersRef.current;
    const curSel = selectionRef.current;

    if (!drag) {
      const { x: wx, y: wy } = screenToWorld(msx, msy, vp);
      const hitId = hitTest(wx, wy, curLayers);
      setHovered(hitId ?? null);
      if (activeToolRef.current === 'pen') {
        setPenPreview({ x: wx, y: wy });
      }
      emitCursor?.(wx, wy);
      return;
    }

    if (drag.mode === 'pan') {
      const dx = e.clientX - drag.startMX;
      const dy = e.clientY - drag.startMY;
      setViewport({ x: drag.startVpX + dx, y: drag.startVpY + dy });
      return;
    }

    if (drag.mode === 'rubber') {
      drag.curSX = msx;
      drag.curSY = msy;
      const x = Math.min(drag.startSX, msx);
      const y = Math.min(drag.startSY, msy);
      const w = Math.abs(msx - drag.startSX);
      const h = Math.abs(msy - drag.startSY);
      setRubberBand({ x, y, w, h });
      const selIds: string[] = [];
      for (const entry of flattenWorldSpace(curLayers)) {
        if (!entry.visible || entry.locked) continue;
        const lsx = entry.wx * vp.zoom + vp.x;
        const lsy = entry.wy * vp.zoom + vp.y;
        const lsw = entry.width * vp.zoom;
        const lsh = (entry.type === 'line' ? 2 : entry.height) * vp.zoom;
        if (lsx < x + w && lsx + lsw > x && lsy < y + h && lsy + lsh > y) selIds.push(entry.id);
      }
      setSelection(selIds);
      return;
    }

    if (drag.mode === 'draw') {
      const { x: wx, y: wy } = screenToWorld(msx, msy, vp);
      drag.curWX = wx;
      drag.curWY = wy;
      setDrawPreview({
        x: Math.min(drag.startWX, wx),
        y: Math.min(drag.startWY, wy),
        w: Math.abs(wx - drag.startWX),
        h: Math.abs(wy - drag.startWY),
      });
      return;
    }

    if (drag.mode === 'move') {
      const dx = (msx - drag.startMSX) / vp.zoom;
      const dy = (msy - drag.startMSY) / vp.zoom;
      // Build world-space positions for snap computation
      const movingLayers = curSel.map(id => {
        const origW = drag.origWorldPos[id];
        const l = findLayerInTree(curLayers, id);
        return l && origW ? { ...l, x: origW.x + dx, y: origW.y + dy } : null;
      }).filter(Boolean) as FigmaLayer[];

      const { lines, snapDX, snapDY } = computeSnapLines(movingLayers, curLayers, curSel, vp);
      setSnapLines(lines);

      // Update using LOCAL positions (delta is identical in local and world space)
      for (const id of curSel) {
        const orig = drag.origPos[id];
        if (orig) updateLayer(id, { x: Math.round(orig.x + dx + snapDX), y: Math.round(orig.y + dy + snapDY) });
      }
      return;
    }

    if (drag.mode === 'resize') {
      const { handle, startMSX, startMSY, origLayer } = drag;
      const dsx = msx - startMSX;
      const dsy = msy - startMSY;
      const dwx = dsx / vp.zoom;
      const dwy = dsy / vp.zoom;

      let { x, y, width: w, height: h } = origLayer;

      if (handle === 'br') { w = Math.max(4, origLayer.width + dwx); h = Math.max(4, origLayer.height + dwy); }
      else if (handle === 'bl') { x = origLayer.x + dwx; w = Math.max(4, origLayer.width - dwx); h = Math.max(4, origLayer.height + dwy); }
      else if (handle === 'tr') { y = origLayer.y + dwy; w = Math.max(4, origLayer.width + dwx); h = Math.max(4, origLayer.height - dwy); }
      else if (handle === 'tl') { x = origLayer.x + dwx; y = origLayer.y + dwy; w = Math.max(4, origLayer.width - dwx); h = Math.max(4, origLayer.height - dwy); }
      else if (handle === 'tc') { y = origLayer.y + dwy; h = Math.max(4, origLayer.height - dwy); }
      else if (handle === 'bc') { h = Math.max(4, origLayer.height + dwy); }
      else if (handle === 'ml') { x = origLayer.x + dwx; w = Math.max(4, origLayer.width - dwx); }
      else if (handle === 'mr') { w = Math.max(4, origLayer.width + dwx); }

      if (e.shiftKey && drag.aspectRatio > 0 && ['tl', 'tr', 'bl', 'br'].includes(handle)) {
        if (w / h > drag.aspectRatio) h = w / drag.aspectRatio;
        else w = h * drag.aspectRatio;
      }

      if (e.altKey) {
        const cxOrig = origLayer.x + origLayer.width / 2;
        const cyOrig = origLayer.y + origLayer.height / 2;
        x = cxOrig - w / 2;
        y = cyOrig - h / 2;
      }

      updateLayer(origLayer.id, { x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) });
      return;
    }

    if (drag.mode === 'rotate') {
      const angle = Math.atan2(msy - drag.cyS, msx - drag.cxS) * (180 / Math.PI);
      let delta = angle - drag.startAngle;
      if (e.shiftKey) delta = Math.round(delta / 15) * 15;
      const newRot = ((drag.origRot + delta) % 360 + 360) % 360;
      setRotateAngle(newRot);
      if (curSel[0]) updateLayer(curSel[0], { rotation: Math.round(newRot) });
      return;
    }

    if (drag.mode === 'radius') {
      const dx = (msx - drag.startMSX) / vp.zoom;
      updateLayer(drag.layerId, { cornerRadius: Math.max(0, Math.min(999, Math.round(drag.origRadius + dx))) });
      return;
    }

    if (drag.mode === 'node-point') {
      const dx = (msx - drag.startX) / vp.zoom;
      const dy = (msy - drag.startY) / vp.zoom;
      updateVectorPoint(drag.layerId, drag.pointId, {
        x: drag.originX + dx,
        y: drag.originY + dy,
      });
      return;
    }

    if (drag.mode === 'node-handle') {
      const layer = curLayers.find(l => l.id === drag.layerId);
      if (!layer) return;
      const lx = (msx - vp.x) / vp.zoom - layer.x;
      const ly = (msy - vp.y) / vp.zoom - layer.y;
      if (drag.handleType === 'in') {
        updateVectorPoint(drag.layerId, drag.pointId, { handleIn: { x: lx, y: ly }, cornerType: 'asymmetric' });
      } else {
        updateVectorPoint(drag.layerId, drag.pointId, { handleOut: { x: lx, y: ly }, cornerType: 'asymmetric' });
      }
      return;
    }
  }, [setHovered, setViewport, setSelection, updateLayer, updateVectorPoint]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    setDragMode(null);
    setSnapLines([]);
    setRubberBand(null);
    setRotateAngle(null);

    if (drag.mode === 'draw') {
      setDrawPreview(null);
      const typeMap: Partial<Record<ToolType, LayerType>> = {
        frame: 'frame', rect: 'rect', ellipse: 'ellipse', line: 'line', text: 'text',
      };
      const layerType = typeMap[drag.tool];
      if (!layerType) return;

      const rawW = Math.abs(drag.curWX - drag.startWX);
      const rawH = Math.abs(drag.curWY - drag.startWY);
      const isClick = rawW < 4 && rawH < 4;

      if (drag.tool === 'frame' && isClick) {
        const el = canvasAreaRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const msx = e.clientX - rect.left;
        const msy = e.clientY - rect.top;
        setFramePicker({ sx: msx, sy: msy, wx: drag.startWX, wy: drag.startWY });
        return;
      }

      const w = isClick ? (layerType === 'text' ? 200 : 100) : Math.max(4, rawW);
      const h = isClick ? (layerType === 'text' ? 40 : 100) : Math.max(4, rawH);
      const x = isClick ? drag.startWX - w / 2 : Math.min(drag.startWX, drag.curWX);
      const y = isClick ? drag.startWY - h / 2 : Math.min(drag.startWY, drag.curWY);
      commitNewLayer(layerType, x, y, w, h);
    }
  }, [commitNewLayer]);

  // Node point drag handler
  const handleNodePointMouseDown = (e: React.MouseEvent, layerId: string, pointId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setNodeSelection([pointId]);
    const layer = currentLayers.find(l => l.id === layerId);
    const pt = (layer?.points ?? []).find(p => p.id === pointId);
    dragRef.current = {
      mode: 'node-point', layerId, pointId,
      startX: e.clientX, startY: e.clientY,
      originX: pt?.x ?? 0, originY: pt?.y ?? 0,
    };
    setDragMode('node-point');
  };

  // Node bezier handle drag handler
  const handleNodeHandleMouseDown = (e: React.MouseEvent, layerId: string, pointId: string, handleType: 'in' | 'out') => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      mode: 'node-handle', layerId, pointId, handleType,
      startX: e.clientX, startY: e.clientY,
    };
    setDragMode('node-handle');
  };

  // Attach global mousemove/mouseup
  useEffect(() => {
    const onMove = (e: MouseEvent) => handleMouseMove(e);
    const onUp = (e: MouseEvent) => handleMouseUp(e);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const vp = viewport;
  const flatAll = React.useMemo(() => flattenWorldSpace(currentLayers), [currentLayers]);
  // Selection overlay needs world-space x/y so handles appear at the correct screen position
  const selectedLayersWorld = React.useMemo(() =>
    selection.map(id => {
      const entry = flatAll.find(e => e.id === id);
      return entry ? { ...entry, x: entry.wx, y: entry.wy } : null;
    }).filter(Boolean) as FigmaLayer[],
  [selection, flatAll]);
  const isDragging = dragMode !== null;

  return (
    <div ref={outerRef} style={{ position: 'relative', flex: 1, overflow: 'hidden', background: '#1e1e1e' }}>
      {/* Horizontal ruler */}
      {showRulers && (
        <div style={{ position: 'absolute', top: 0, left: 20, right: 0, height: 20, background: '#1e1e1e', borderBottom: '1px solid #3c3c3c', zIndex: 10, overflow: 'hidden' }}>
          <RulerH viewport={vp} width={rulerSize.w - 20} height={20} />
        </div>
      )}

      {/* Vertical ruler */}
      {showRulers && (
        <div style={{ position: 'absolute', top: 20, left: 0, width: 20, bottom: 0, background: '#1e1e1e', borderRight: '1px solid #3c3c3c', zIndex: 10, overflow: 'hidden' }}>
          <RulerV viewport={vp} width={20} height={rulerSize.h - 20} />
        </div>
      )}

      {/* Corner square */}
      {showRulers && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: 20, height: 20, background: '#2c2c2c', zIndex: 11, borderRight: '1px solid #3c3c3c', borderBottom: '1px solid #3c3c3c' }} />
      )}

      {/* Main canvas area */}
      <div
        ref={canvasAreaRef}
        style={{
          position: 'absolute', top: showRulers ? 20 : 0, left: showRulers ? 20 : 0, right: 0, bottom: 0,
          overflow: 'hidden',
          cursor: cursorForTool(activeTool, spaceDown, dragMode),
          userSelect: 'none',
        }}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => {
          e.preventDefault();
          const clickedId = (e.target as HTMLElement).closest('[data-layer-id]')?.getAttribute('data-layer-id') ?? null;
          setCtxMenu({ x: e.clientX, y: e.clientY, layerId: clickedId });
        }}
      >
        {/* Dot grid */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: showGrid ? `radial-gradient(circle, #3a3a3a 1px, transparent 1px)` : 'none',
          backgroundSize: `${20 * vp.zoom}px ${20 * vp.zoom}px`,
          backgroundPosition: `${vp.x % (20 * vp.zoom)}px ${vp.y % (20 * vp.zoom)}px`,
        }} />

        {/* World transform container */}
        <div style={{
          position: 'absolute', top: 0, left: 0,
          transformOrigin: '0 0',
          transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
        }}>
          {currentLayers.map(layer => (
            <div key={layer.id} style={{ position: 'absolute', left: 0, top: 0 }}>
              <LayerRenderer layer={layer} selection={selection} textEditId={textEditId} />
            </div>
          ))}
        </div>

        {/* Screen-space overlays */}
        <HoverHighlight hoveredId={hoveredId} flatAll={flatAll} selection={selection} viewport={vp} />
        <DistanceOverlay selectedLayers={selectedLayersWorld} hoveredId={hoveredId} flatAll={flatAll} viewport={vp} />
        <SnapLinesOverlay lines={snapLines} />

        {/* Selection handles */}
        {selection.length > 0 && activeTool === 'select' && dragMode !== 'draw' && (
          <>
            <SelectionOverlay
              selectedLayers={selectedLayersWorld}
              viewport={vp}
              onHandleMouseDown={handleHandleMouseDown}
              rotateAngle={rotateAngle}
            />
            {/* Corner radius handle */}
            {selection.length === 1 && (() => {
              const entry = flatAll.find(e => e.id === selection[0]);
              const l = entry ? { ...entry, x: entry.wx, y: entry.wy } : null;
              if (!l || (l.type !== 'rect' && l.type !== 'frame')) return null;
              const lsx = l.x * vp.zoom + vp.x;
              const lsy = l.y * vp.zoom + vp.y;
              const lsw = l.width * vp.zoom;
              return (
                <div
                  style={{
                    position: 'absolute',
                    left: lsx + lsw - 4, top: lsy + 4,
                    width: 8, height: 8,
                    background: '#1bc9c9', borderRadius: '50%',
                    cursor: 'ew-resize', zIndex: 22, boxSizing: 'border-box',
                    border: '1px solid rgba(0,0,0,0.3)',
                  }}
                  onMouseDown={e => { e.stopPropagation(); handleHandleMouseDown(e, 'radius'); }}
                />
              );
            })()}
          </>
        )}

        {/* Rubber band */}
        {rubberBand && rubberBand.w > 2 && rubberBand.h > 2 && (
          <div style={{
            position: 'absolute',
            left: rubberBand.x, top: rubberBand.y, width: rubberBand.w, height: rubberBand.h,
            border: '1px solid #0d99ff', background: 'rgba(13,153,255,0.05)',
            pointerEvents: 'none', zIndex: 19,
          }} />
        )}

        {/* Draw preview */}
        {drawPreview && drawPreview.w > 0 && drawPreview.h > 0 && (
          <div style={{
            position: 'absolute',
            left: drawPreview.x * vp.zoom + vp.x,
            top: drawPreview.y * vp.zoom + vp.y,
            width: drawPreview.w * vp.zoom,
            height: drawPreview.h * vp.zoom,
            border: '1px solid #0d99ff',
            background: 'rgba(13,153,255,0.08)',
            pointerEvents: 'none',
          }}>
            {drawPreview.w > 20 && (
              <div style={{
                position: 'absolute', bottom: -18, left: 0,
                fontSize: 10, color: '#0d99ff',
                background: 'rgba(13,153,255,0.12)', padding: '1px 4px', borderRadius: 3,
                whiteSpace: 'nowrap',
              }}>
                {Math.round(drawPreview.w)} × {Math.round(drawPreview.h)}
              </div>
            )}
          </div>
        )}

        {/* Text edit overlay */}
        {textEditId && (() => {
          const layer = currentLayers.find(l => l.id === textEditId);
          if (!layer) return null;
          const sx = layer.x * vp.zoom + vp.x;
          const sy = layer.y * vp.zoom + vp.y;
          const sw = layer.width * vp.zoom;
          const sh = layer.height * vp.zoom;
          const fillColor = layer.fills.find(f => f.visible !== false)?.color ?? '#000000';
          return (
            <div
              ref={textEditRef}
              contentEditable
              suppressContentEditableWarning
              style={{
                position: 'absolute', left: sx, top: sy, width: sw, height: sh,
                minWidth: 2, minHeight: 2,
                color: fillColor,
                fontSize: (layer.fontSize ?? 14) * vp.zoom,
                fontFamily: layer.fontFamily ?? 'Inter, sans-serif',
                fontWeight: layer.fontWeight ?? 'normal',
                fontStyle: layer.fontStyle ?? 'normal',
                textDecoration: layer.textDecoration ?? 'none',
                textTransform: (layer.textTransform as React.CSSProperties['textTransform']) ?? 'none',
                lineHeight: layer.lineHeight ? `${layer.lineHeight * vp.zoom}px` : 'normal',
                letterSpacing: layer.letterSpacing ? `${layer.letterSpacing * vp.zoom}px` : 'normal',
                textAlign: (layer.textAlign as React.CSSProperties['textAlign']) ?? 'left',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                outline: '1px solid #0d99ff', boxSizing: 'border-box',
                background: 'transparent', cursor: 'text', zIndex: 25, padding: 0, margin: 0,
                overflow: 'visible',
              }}
              onKeyDown={e => {
                e.stopPropagation();
                if (e.key === 'Escape') setTextEditId(null);
              }}
              onInput={e => {
                const text = (e.currentTarget as HTMLDivElement).innerText;
                updateLayer(textEditId, { text });
              }}
              onBlur={() => setTextEditId(null)}
              onMouseDown={e => e.stopPropagation()}
            />
          );
        })()}

        {/* Pen preview overlay */}
        {activeTool === 'pen' && (penPoints.length > 0 || penPreview) && (() => {
          const toScreen = (wx: number, wy: number) => ({
            sx: wx * vp.zoom + vp.x,
            sy: wy * vp.zoom + vp.y,
          });
          return (
            <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 100 }} width="100%" height="100%">
              {penPoints.map((pt, i) => {
                if (i === 0) return null;
                const prev = penPoints[i - 1];
                const { sx: x1, sy: y1 } = toScreen(prev.x, prev.y);
                const { sx: x2, sy: y2 } = toScreen(pt.x, pt.y);
                return <line key={`l-${pt.id}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0d99ff" strokeWidth={1.5} />;
              })}
              {penPoints.length > 0 && penPreview && (() => {
                const last = penPoints[penPoints.length - 1];
                const { sx: x1, sy: y1 } = toScreen(last.x, last.y);
                const { sx: x2, sy: y2 } = toScreen(penPreview.x, penPreview.y);
                return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0d99ff" strokeWidth={1} strokeDasharray="4 3" opacity={0.8} />;
              })()}
              {penPoints.length >= 3 && penPreview && (() => {
                const first = penPoints[0];
                const { sx: fx, sy: fy } = toScreen(first.x, first.y);
                const { sx: px, sy: py } = toScreen(penPreview.x, penPreview.y);
                const dist = Math.sqrt((fx - px) ** 2 + (fy - py) ** 2);
                if (dist < 20) return <circle cx={fx} cy={fy} r={7} fill="none" stroke="#0d99ff" strokeWidth={1.5} opacity={0.9} />;
                return null;
              })()}
              {penPoints.map((pt, i) => {
                const { sx, sy } = toScreen(pt.x, pt.y);
                return (
                  <circle key={`dot-${pt.id}`} cx={sx} cy={sy} r={5}
                    fill={i === 0 ? '#0d99ff' : 'white'} stroke="#0d99ff" strokeWidth={1.5} />
                );
              })}
            </svg>
          );
        })()}

        {/* Node editor overlay */}
        {editingVectorId && (() => {
          const layer = currentLayers.find(l => l.id === editingVectorId);
          if (!layer || layer.type !== 'vector') return null;
          const points = layer.points ?? [];
          const toScreen = (lx: number, ly: number) => ({
            sx: (layer.x + lx) * vp.zoom + vp.x,
            sy: (layer.y + ly) * vp.zoom + vp.y,
          });
          return (
            <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 90 }} width="100%" height="100%">
              {points.map(pt => {
                const { sx, sy } = toScreen(pt.x, pt.y);
                return (
                  <g key={`handles-${pt.id}`}>
                    {pt.handleIn && (() => {
                      const { sx: hx, sy: hy } = toScreen(pt.handleIn!.x, pt.handleIn!.y);
                      return (
                        <>
                          <line x1={sx} y1={sy} x2={hx} y2={hy} stroke="#0d99ff" strokeWidth={1} opacity={0.6} />
                          <circle cx={hx} cy={hy} r={4} fill="white" stroke="#0d99ff" strokeWidth={1.5}
                            style={{ pointerEvents: 'all', cursor: 'move' }}
                            onMouseDown={e => handleNodeHandleMouseDown(e, layer.id, pt.id, 'in')} />
                        </>
                      );
                    })()}
                    {pt.handleOut && (() => {
                      const { sx: hx, sy: hy } = toScreen(pt.handleOut!.x, pt.handleOut!.y);
                      return (
                        <>
                          <line x1={sx} y1={sy} x2={hx} y2={hy} stroke="#0d99ff" strokeWidth={1} opacity={0.6} />
                          <circle cx={hx} cy={hy} r={4} fill="white" stroke="#0d99ff" strokeWidth={1.5}
                            style={{ pointerEvents: 'all', cursor: 'move' }}
                            onMouseDown={e => handleNodeHandleMouseDown(e, layer.id, pt.id, 'out')} />
                        </>
                      );
                    })()}
                  </g>
                );
              })}
              {points.map(pt => {
                const { sx, sy } = toScreen(pt.x, pt.y);
                const selected = nodeSelection.includes(pt.id);
                return (
                  <rect key={`node-${pt.id}`}
                    x={sx - 5} y={sy - 5} width={10} height={10}
                    fill={selected ? '#0d99ff' : 'white'} stroke="#0d99ff" strokeWidth={1.5}
                    style={{ pointerEvents: 'all', cursor: 'move' }}
                    onMouseDown={e => handleNodePointMouseDown(e, layer.id, pt.id)} />
                );
              })}
            </svg>
          );
        })()}

        {/* Frame preset picker */}
        {framePicker && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setFramePicker(null)} />
            <FramePickerPanel
              sx={framePicker.sx}
              sy={framePicker.sy}
              onSelect={(w, h) => {
                commitNewLayer('frame', framePicker.wx - w / 2, framePicker.wy - h / 2, w, h);
                setFramePicker(null);
              }}
              onClose={() => setFramePicker(null)}
            />
          </>
        )}


        {/* Context menu */}
        {ctxMenu && (
          <div
            style={{
              position: 'fixed', left: ctxMenu.x, top: ctxMenu.y,
              background: '#2c2c2c', border: '1px solid #3c3c3c',
              borderRadius: 6, padding: '4px 0', zIndex: 9999,
              minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {ctxMenu.layerId ? (() => {
              const layer = currentLayers.find(l => l.id === ctxMenu.layerId) ??
                currentLayers.flatMap(l => l.children ?? []).find(l => l.id === ctxMenu.layerId);
              return (
                <>
                  {layer?.type !== 'instance' && (
                    <CtxItem
                      label="Create Component"
                      shortcut="⌥⌘K"
                      onClick={() => {
                        const sel = selectionRef.current.length > 0 ? selectionRef.current : (ctxMenu.layerId ? [ctxMenu.layerId] : []);
                        createComponent(sel);
                        setCtxMenu(null);
                      }}
                    />
                  )}
                  {layer?.type === 'instance' && (
                    <CtxItem
                      label="Detach Instance"
                      onClick={() => {
                        detachInstance(ctxMenu.layerId!);
                        setCtxMenu(null);
                      }}
                    />
                  )}
                  <CtxDivider />
                  <CtxItem label="Duplicate" shortcut="⌘D" onClick={() => { duplicateLayer(ctxMenu.layerId!); setCtxMenu(null); }} />
                  <CtxDivider />
                  <CtxItem label="Delete" danger onClick={() => { deleteLayer(ctxMenu.layerId!); setCtxMenu(null); }} />
                </>
              );
            })() : (
              <CtxItem label="Paste here" shortcut="⌘V" onClick={() => { paste(); setCtxMenu(null); }} />
            )}
          </div>
        )}

        {/* Remote cursors overlay */}
        {remoteCursors.map(cursor => {
          const sx = cursor.x * vp.zoom + vp.x;
          const sy = cursor.y * vp.zoom + vp.y;
          return (
            <div
              key={cursor.userId}
              style={{
                position: 'absolute',
                left: sx,
                top: sy,
                pointerEvents: 'none',
                zIndex: 200,
                transform: 'translate(-2px, -2px)',
              }}
            >
              {/* Cursor arrow */}
              <svg width="20" height="20" viewBox="0 0 20 20" style={{ display: 'block' }}>
                <path
                  d="M2 2 L2 14 L5.5 10.5 L8.5 17 L10.5 16 L7.5 9.5 L12 9.5 Z"
                  fill={cursor.color}
                  stroke="white"
                  strokeWidth="1.2"
                />
              </svg>
              {/* Label badge */}
              <div style={{
                position: 'absolute',
                top: 14,
                left: 14,
                background: cursor.color,
                color: 'white',
                fontSize: 10,
                fontWeight: 600,
                padding: '1px 5px',
                borderRadius: 3,
                whiteSpace: 'nowrap',
                boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                letterSpacing: 0.3,
              }}>
                {cursor.label}
              </div>
            </div>
          );
        })}

        {/* Empty state */}
        {currentLayers.length === 0 && !drawPreview && !isDragging && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ textAlign: 'center', color: '#555' }}>
              <div style={{ fontSize: 13, marginBottom: 4 }}>Click to add a frame</div>
              <div style={{ fontSize: 12 }}>
                Press <kbd style={{ background: '#333', padding: '1px 5px', borderRadius: 3, fontSize: 11, color: '#aaa' }}>F</kbd> to select the frame tool
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
