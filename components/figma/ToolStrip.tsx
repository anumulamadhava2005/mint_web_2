"use client";

import React, { useState, useRef, useCallback } from 'react';
import {
  MousePointer2, Maximize2, Scissors, Square, PenTool, Type, Hand,
  MessageSquare, Triangle, TextCursorInput,
} from 'lucide-react';
import { useFigmaStore, type ToolType } from '@/lib/stores/figmaStore';

interface Tool {
  id: ToolType;
  key: string;
  label: string;
  icon: React.ReactNode;
}

const SHAPE_SUBMENU: { id: ToolType; key: string; label: string }[] = [
  { id: 'rect', key: 'R', label: 'Rectangle' },
  { id: 'ellipse', key: 'O', label: 'Ellipse' },
  { id: 'line', key: 'L', label: 'Line' },
  { id: 'arrow', key: '', label: 'Arrow' },
  { id: 'polygon', key: '', label: 'Polygon' },
  { id: 'star', key: '', label: 'Star' },
];

const SectionDashedIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.5 2" />
  </svg>
);

const HashIcon = () => (
  <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 16, lineHeight: 1 }}>#</span>
);

function Tooltip({ label, shortcut }: { label: string; shortcut?: string }) {
  return (
    <div style={{
      position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)',
      marginLeft: 8, background: '#1e1e1e', border: '1px solid #3c3c3c',
      borderRadius: 5, padding: '4px 8px', whiteSpace: 'nowrap',
      fontSize: 11, color: '#ebebeb', pointerEvents: 'none', zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: 6,
      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
    }}>
      {label}
      {shortcut && (
        <kbd style={{
          background: '#3c3c3c', borderRadius: 3, padding: '1px 5px', fontSize: 10, color: '#aaa',
        }}>{shortcut}</kbd>
      )}
    </div>
  );
}

function ToolBtn({ tool, active, onClick }: { tool: Tool; active: boolean; onClick: () => void }) {
  const [showTip, setShowTip] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={onClick}
        onMouseEnter={() => { setShowTip(true); setHovered(true); }}
        onMouseLeave={() => { setShowTip(false); setHovered(false); }}
        style={{
          width: 32, height: 32, borderRadius: 6, border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: active ? 'rgba(255,255,255,0.10)' : hovered ? 'rgba(255,255,255,0.06)' : 'transparent',
          color: active ? '#ebebeb' : hovered ? '#ebebeb' : '#9a9a9a',
          transition: 'background 0.1s, color 0.1s',
        }}
      >
        {tool.icon}
      </button>
      {showTip && <Tooltip label={tool.label} shortcut={tool.key} />}
    </div>
  );
}

function Separator() {
  return <div style={{ width: 24, height: 1, background: '#3c3c3c', margin: '4px 0' }} />;
}

export default function ToolStrip() {
  const { activeTool, setActiveTool } = useFigmaStore();
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);

  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const SHAPE_TOOLS: ToolType[] = ['rect', 'ellipse', 'line', 'arrow', 'polygon', 'star'];
  const activeShapeTool = SHAPE_TOOLS.includes(activeTool) ? activeTool : 'rect';

  const openShapeMenu = () => setShapeMenuOpen(true);
  const closeShapeMenu = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setShapeMenuOpen(false), 120);
  }, []);

  const cancelClose = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
  }, []);

  const topTools: Tool[] = [
    { id: 'select', key: 'V', label: 'Move', icon: <MousePointer2 size={16} /> },
    { id: 'scale', key: 'K', label: 'Scale', icon: <Maximize2 size={16} /> },
  ];

  const frameTools: Tool[] = [
    { id: 'frame', key: 'F', label: 'Frame', icon: <HashIcon /> },
    { id: 'section', key: 'S', label: 'Section', icon: <SectionDashedIcon /> },
    { id: 'slice', key: '', label: 'Slice', icon: <Scissors size={15} /> },
  ];

  const bottomTools: Tool[] = [
    { id: 'pen', key: 'P', label: 'Pen', icon: <PenTool size={15} /> },
    { id: 'text', key: 'T', label: 'Text', icon: <Type size={15} /> },
    { id: 'input', key: 'I', label: 'Input field', icon: <TextCursorInput size={15} /> },
  ];

  const utilTools: Tool[] = [
    { id: 'hand', key: 'H', label: 'Hand', icon: <Hand size={15} /> },
    { id: 'comment', key: 'C', label: 'Comment', icon: <MessageSquare size={15} /> },
  ];

  // Shape button label
  const shapeLabel = SHAPE_SUBMENU.find(s => s.id === activeShapeTool)?.label ?? 'Rectangle';
  const shapeKey = SHAPE_SUBMENU.find(s => s.id === activeShapeTool)?.key ?? 'R';
  const [showShapeTip, setShowShapeTip] = useState(false);

  return (
    <div style={{
      width: 48, flexShrink: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', background: '#2c2c2c', borderRight: '1px solid #3c3c3c',
      padding: '8px 0', gap: 2,
    }}>
      {topTools.map(tool => (
        <ToolBtn key={tool.id} tool={tool} active={activeTool === tool.id} onClick={() => setActiveTool(tool.id)} />
      ))}

      <Separator />

      {frameTools.map(tool => (
        <ToolBtn key={tool.id} tool={tool} active={activeTool === tool.id} onClick={() => setActiveTool(tool.id)} />
      ))}

      <Separator />

      {/* Shape tool with submenu */}
      <div
        ref={menuRef}
        style={{ position: 'relative' }}
        onMouseEnter={() => {
          cancelClose();
          if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
          hoverTimerRef.current = setTimeout(openShapeMenu, 300);
          setShowShapeTip(true);
        }}
        onMouseLeave={() => {
          if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
          closeShapeMenu();
          setShowShapeTip(false);
        }}
      >
        <button
          onClick={() => setActiveTool(activeShapeTool)}
          style={{
            width: 32, height: 32, borderRadius: 6, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
            background: SHAPE_TOOLS.includes(activeTool) ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0)',
            color: SHAPE_TOOLS.includes(activeTool) ? '#ebebeb' : '#9a9a9a',
          }}
        >
          <Square size={15} />
          {/* Small triangle indicator */}
          <span style={{ position: 'absolute', bottom: 3, right: 3 }}>
            <Triangle size={5} fill="currentColor" style={{ transform: 'rotate(180deg)' }} />
          </span>
        </button>
        {showShapeTip && !shapeMenuOpen && <Tooltip label={shapeLabel} shortcut={shapeKey} />}
        {shapeMenuOpen && (
          <div
            onMouseEnter={cancelClose}
            onMouseLeave={closeShapeMenu}
            style={{
              position: 'absolute', left: '100%', top: 0, marginLeft: 4,
              background: '#2c2c2c', border: '1px solid #3c3c3c',
              borderRadius: 6, padding: '4px 0', zIndex: 9999, minWidth: 130,
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}
          >
            {SHAPE_SUBMENU.map(s => (
              <button
                key={s.id}
                onClick={() => { setActiveTool(s.id); setShapeMenuOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '6px 12px', background: 'none', border: 'none',
                  color: activeTool === s.id ? '#0d99ff' : '#ebebeb', fontSize: 12, cursor: 'pointer', gap: 16,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
              >
                <span>{s.label}</span>
                {s.key && <kbd style={{ background: '#3c3c3c', borderRadius: 3, padding: '1px 5px', fontSize: 10, color: '#aaa' }}>{s.key}</kbd>}
              </button>
            ))}
          </div>
        )}
      </div>

      {bottomTools.map(tool => (
        <ToolBtn key={tool.id} tool={tool} active={activeTool === tool.id} onClick={() => setActiveTool(tool.id)} />
      ))}

      <Separator />

      {utilTools.map(tool => (
        <ToolBtn key={tool.id} tool={tool} active={activeTool === tool.id} onClick={() => setActiveTool(tool.id)} />
      ))}
    </div>
  );
}

