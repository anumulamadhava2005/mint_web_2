"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Share2, Play, ChevronDown } from 'lucide-react';
import { useFigmaStore } from '@/lib/stores/figmaStore';

const FigmaLogo = () => (
  <svg width="20" height="24" viewBox="0 0 20 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="10" height="12" rx="5" fill="#F24E1E" />
    <rect x="10" y="0" width="10" height="12" rx="5" fill="#FF7262" />
    <rect x="0" y="12" width="10" height="12" rx="5" fill="#0ACF83" />
    <rect x="10" y="12" width="10" height="12" rx="5" fill="#1ABCFE" />
    <circle cx="15" cy="12" r="5" fill="#A259FF" />
  </svg>
);

const ZOOM_PRESETS = [
  { label: '25%', value: 0.25 },
  { label: '50%', value: 0.5 },
  { label: '75%', value: 0.75 },
  { label: '100%', value: 1 },
  { label: '150%', value: 1.5 },
  { label: '200%', value: 2 },
];

const MENU_ITEMS = ['New', 'Open', 'Save', 'Import', 'Export'];

interface TopBarProps {
  editorTab?: 'design' | 'backend' | 'logic';
  onTabChange?: (tab: 'design' | 'backend' | 'logic') => void;
}

export default function TopBar({ editorTab = 'design', onTabChange }: TopBarProps) {
  const { fileName, setFileName, viewport, setViewport, editorMode, setEditorMode, undo, redo, canUndo, canRedo, setPreviewMode, saveStatus, projectId } = useFigmaStore();

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState(fileName);
  const [menuOpen, setMenuOpen] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTitleVal(fileName); }, [fileName]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (zoomRef.current && !zoomRef.current.contains(e.target as Node)) setZoomOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (editingTitle && titleRef.current) titleRef.current.focus();
  }, [editingTitle]);

  const commitTitle = () => {
    setFileName(titleVal.trim() || 'Untitled');
    setEditingTitle(false);
  };

  const zoomPct = Math.round(viewport.zoom * 100);

  const modes: { id: 'design' | 'prototype' | 'dev'; label: string }[] = [
    { id: 'design', label: 'Design' },
    { id: 'prototype', label: 'Prototype' },
    { id: 'dev', label: 'Dev' },
  ];

  return (
    <div style={{
      height: 48,
      background: '#2c2c2c',
      borderBottom: '1px solid #3c3c3c',
      display: 'flex',
      alignItems: 'center',
      padding: '0 8px',
      flexShrink: 0,
      userSelect: 'none',
      gap: 4,
    }}>
      {/* Logo */}
      <div style={{ padding: '0 8px', display: 'flex', alignItems: 'center' }}>
        <FigmaLogo />
      </div>

      {/* Hamburger / menu */}
      <div ref={menuRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setMenuOpen(v => !v)}
          style={{
            width: 28, height: 28, borderRadius: 6,
            background: menuOpen ? 'rgba(255,255,255,0.10)' : 'transparent',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#ebebeb',
          }}
          onMouseEnter={e => { if (!menuOpen) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
          onMouseLeave={e => { if (!menuOpen) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="2" y="3" width="12" height="1.5" rx="0.75" />
            <rect x="2" y="7.25" width="12" height="1.5" rx="0.75" />
            <rect x="2" y="11.5" width="12" height="1.5" rx="0.75" />
          </svg>
        </button>
        {menuOpen && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 4,
            background: '#2c2c2c', border: '1px solid #3c3c3c',
            borderRadius: 6, padding: '4px 0', zIndex: 1000, minWidth: 140,
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}>
            {MENU_ITEMS.map(item => (
              <button key={item} onClick={() => setMenuOpen(false)} style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '6px 14px', background: 'none', border: 'none',
                color: '#ebebeb', fontSize: 12, cursor: 'pointer',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Separator */}
      <div style={{ width: 1, height: 20, background: '#3c3c3c', margin: '0 4px' }} />

      {/* Undo */}
      <button
        onClick={undo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        style={{
          width: 28, height: 28, borderRadius: 6, border: 'none', cursor: canUndo ? 'pointer' : 'default',
          background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: canUndo ? '#ebebeb' : '#555', transition: 'all 0.1s',
        }}
        onMouseEnter={e => { if (canUndo) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 7 C2 4.2 4.2 2 7 2 C9.8 2 12 4.2 12 7 C12 9.8 9.8 12 7 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
          <polyline points="2,4 2,7 5,7" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
        </svg>
      </button>

      {/* Redo */}
      <button
        onClick={redo}
        disabled={!canRedo}
        title="Redo (Ctrl+Y)"
        style={{
          width: 28, height: 28, borderRadius: 6, border: 'none', cursor: canRedo ? 'pointer' : 'default',
          background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: canRedo ? '#ebebeb' : '#555', transition: 'all 0.1s',
        }}
        onMouseEnter={e => { if (canRedo) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M12 7 C12 4.2 9.8 2 7 2 C4.2 2 2 4.2 2 7 C2 9.8 4.2 12 7 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
          <polyline points="12,4 12,7 9,7" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
        </svg>
      </button>

      {/* File title */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {editingTitle ? (
          <input
            ref={titleRef}
            value={titleVal}
            onChange={e => setTitleVal(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={e => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') { setTitleVal(fileName); setEditingTitle(false); } }}
            style={{
              background: '#1e1e1e', border: '1px solid #0d99ff', borderRadius: 4,
              color: '#ebebeb', fontSize: 13, padding: '2px 6px',
              outline: 'none', minWidth: 80,
            }}
          />
        ) : (
          <button
            onClick={() => setEditingTitle(true)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#ebebeb', fontSize: 13, padding: '2px 6px', borderRadius: 4,
              display: 'flex', alignItems: 'center', gap: 4,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
          >
            {fileName}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.4 }}>
              <path d="M8.5 1.5L10.5 3.5L4 10 2 10 2 8l6.5-6.5z" stroke="#ebebeb" strokeWidth="1.2" fill="none" />
            </svg>
          </button>
        )}
      </div>

      {/* Save status indicator */}
      {projectId && saveStatus !== 'idle' && (
        <span style={{
          fontSize: 10,
          color: saveStatus === 'saving' ? '#888' : saveStatus === 'saved' ? '#00c864' : '#ff6b6b',
          marginLeft: 4,
          minWidth: 60,
        }}>
          {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? '✓ Saved' : '✗ Error'}
        </span>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Editor tab switcher (Design / Backend / Logic) */}
      <div style={{ display: 'flex', gap: 0, background: '#0d0d0d', borderRadius: 6, border: '1px solid #2a2a2a', padding: 2 }}>
        {(['design', 'backend', 'logic'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => onTabChange?.(tab)}
            style={{
              background: editorTab === tab ? '#1e1e1e' : 'none',
              border: 'none', borderRadius: 4, cursor: 'pointer',
              color: editorTab === tab ? '#ebebeb' : '#666',
              fontSize: 11, fontWeight: editorTab === tab ? 600 : 400,
              padding: '4px 12px', transition: 'all 150ms',
            }}
          >
            {tab === 'design' ? '✏️ Design' : tab === 'backend' ? '⚡ Backend' : '⚙️ Logic'}
          </button>
        ))}
      </div>

      {/* Prototype/Dev mode sub-tabs — only shown in Design tab */}
      {editorTab === 'design' && (
        <div style={{
          display: 'flex', background: '#1e1e1e', borderRadius: 6, padding: 2, gap: 1, marginLeft: 8,
        }}>
          {modes.map(m => (
            <button
              key={m.id}
              onClick={() => setEditorMode(m.id)}
              style={{
                padding: '4px 12px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 11,
                background: editorMode === m.id ? '#2c2c2c' : 'transparent',
                color: editorMode === m.id ? '#ebebeb' : '#888',
                fontWeight: editorMode === m.id ? 500 : 400,
                transition: 'all 0.1s',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Right actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Zoom control */}
        <div ref={zoomRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setZoomOpen(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 3,
              background: zoomOpen ? 'rgba(255,255,255,0.10)' : 'transparent',
              border: '1px solid transparent', borderRadius: 4, cursor: 'pointer',
              color: '#ebebeb', fontSize: 12, padding: '3px 8px',
            }}
            onMouseEnter={e => { if (!zoomOpen) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={e => { if (!zoomOpen) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            {zoomPct}%
            <ChevronDown size={10} />
          </button>
          {zoomOpen && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 4,
              background: '#2c2c2c', border: '1px solid #3c3c3c',
              borderRadius: 6, padding: '4px 0', zIndex: 1000, minWidth: 120,
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}>
              {ZOOM_PRESETS.map(z => (
                <button key={z.label} onClick={() => { setViewport({ zoom: z.value }); setZoomOpen(false); }} style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '6px 14px', background: 'none', border: 'none',
                  color: viewport.zoom === z.value ? '#0d99ff' : '#ebebeb', fontSize: 12, cursor: 'pointer',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                >
                  {z.label}
                </button>
              ))}
              <div style={{ height: 1, background: '#3c3c3c', margin: '4px 0' }} />
              <button onClick={() => { setViewport({ zoom: Math.min(64, viewport.zoom * 1.2) }); setZoomOpen(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 14px', background: 'none', border: 'none', color: '#ebebeb', fontSize: 12, cursor: 'pointer' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
              >Zoom in</button>
              <button onClick={() => { setViewport({ zoom: Math.max(0.02, viewport.zoom / 1.2) }); setZoomOpen(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 14px', background: 'none', border: 'none', color: '#ebebeb', fontSize: 12, cursor: 'pointer' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
              >Zoom out</button>
              <button onClick={() => { setViewport({ zoom: 1 }); setZoomOpen(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 14px', background: 'none', border: 'none', color: '#ebebeb', fontSize: 12, cursor: 'pointer' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
              >Fit page</button>
            </div>
          )}
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 20, background: '#3c3c3c' }} />

        {/* Share */}
        <button style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
          background: '#6366f1', border: 'none', borderRadius: 6, cursor: 'pointer',
          color: '#fff', fontSize: 12, fontWeight: 500,
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#5254cc'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#6366f1'; }}
        >
          <Share2 size={13} />
          Share
        </button>

        {/* Present */}
        <button
          title="Present prototype (▶)"
          onClick={() => setPreviewMode(true)}
          style={{
            width: 28, height: 28, borderRadius: 6, background: 'transparent',
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#999',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#ebebeb'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#999'; }}
        >
          <Play size={14} />
        </button>

        {/* Separator */}
        <div style={{ width: 1, height: 20, background: '#3c3c3c' }} />

        {/* Avatar */}
        <div style={{
          width: 28, height: 28, borderRadius: '50%', background: '#4f46e5',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer',
        }}>
          U
        </div>
      </div>
    </div>
  );
}
