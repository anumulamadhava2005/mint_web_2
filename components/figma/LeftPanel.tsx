"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Eye, EyeOff, Lock, Unlock, Plus, Search, ChevronRight, ChevronDown as ChevronDownIcon } from 'lucide-react';
import { useFigmaStore, type FigmaLayer, type LayerType } from '@/lib/stores/figmaStore';

function AssetSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 11, fontWeight: 600 }}
      >
        <span style={{ fontSize: 9 }}>{open ? '▼' : '▶'}</span>
        {title}
      </button>
      {open && children}
    </div>
  );
}

// Layer type icons
function LayerIcon({ type }: { type: LayerType }) {
  const color = '#9a9a9a';
  switch (type) {
    case 'frame':
      return <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 11, color, lineHeight: 1 }}>#</span>;
    case 'component':
      return <svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 1L11 6L6 11L1 6Z" fill="#A259FF" /></svg>;
    case 'instance':
      return <svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 1L11 6L6 11L1 6Z" fill="none" stroke="#A259FF" strokeWidth="1.5" /></svg>;
    case 'group':
      return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 3h10M1 6h10M1 9h10" stroke={color} strokeWidth="1.2" /></svg>;
    case 'text':
      return <span style={{ fontFamily: 'serif', fontSize: 12, fontWeight: 700, color, lineHeight: 1 }}>T</span>;
    case 'rect':
      return <svg width="12" height="12" viewBox="0 0 12 12"><rect x="1.5" y="1.5" width="9" height="9" rx="1" stroke={color} strokeWidth="1.2" fill="none" /></svg>;
    case 'ellipse':
      return <svg width="12" height="12" viewBox="0 0 12 12"><ellipse cx="6" cy="6" rx="4.5" ry="4.5" stroke={color} strokeWidth="1.2" fill="none" /></svg>;
    case 'line':
      return <svg width="12" height="12" viewBox="0 0 12 12"><line x1="1" y1="11" x2="11" y2="1" stroke={color} strokeWidth="1.5" /></svg>;
    case 'image':
      return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="1" width="10" height="10" rx="1" stroke={color} strokeWidth="1.2" /><path d="M1 8l3-3 2 2 2-2.5 3 3.5" stroke={color} strokeWidth="1" /></svg>;
    case 'vector':
      return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 10C2 10 4 6 6 4C8 2 10 2 10 2" stroke={color} strokeWidth="1.5" strokeLinecap="round" /></svg>;
    case 'section':
      return <svg width="12" height="12" viewBox="0 0 12 12"><rect x="1.5" y="1.5" width="9" height="9" rx="1" stroke={color} strokeWidth="1.2" strokeDasharray="2 1.5" fill="none" /></svg>;
    default:
      return <svg width="12" height="12" viewBox="0 0 12 12"><rect x="1.5" y="1.5" width="9" height="9" rx="1" stroke={color} strokeWidth="1.2" fill="none" /></svg>;
  }
}

// Context menu for pages
interface ContextMenu { x: number; y: number; pageId: string; }

// ── Layer drag-and-drop (reparent / reorder) ──────────────────────
type DropMode = 'inside' | 'before' | 'after';
interface LayerDnD {
  dragId: string | null;
  dropTarget: { id: string; mode: DropMode } | null;
  onDragStart: (id: string) => void;
  onRowDragOver: (id: string, type: LayerType, e: React.DragEvent) => void;
  onRowDrop: () => void;
  onDragEnd: () => void;
}
const LayerDnDContext = React.createContext<LayerDnD | null>(null);
const CONTAINER_TYPES: LayerType[] = ['frame', 'group', 'section', 'component', 'instance'];

function LayerRow({
  layer, depth, expandedIds, toggleExpand,
}: {
  layer: FigmaLayer;
  depth: number;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
}) {
  const { selection, setSelection, updateLayer } = useFigmaStore();
  const dnd = React.useContext(LayerDnDContext);
  const [hovered, setHovered] = useState(false);
  const selected = selection.includes(layer.id);
  const hasChildren = (layer.children?.length ?? 0) > 0;
  const expanded = expandedIds.has(layer.id);
  const drop = dnd?.dropTarget?.id === layer.id ? dnd.dropTarget.mode : null;
  const isDragging = dnd?.dragId === layer.id;

  const handleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      setSelection(selected ? selection.filter(id => id !== layer.id) : [...selection, layer.id]);
    } else {
      setSelection([layer.id]);
    }
  };

  return (
    <>
      <div
        draggable
        onDragStart={e => { e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', layer.id); dnd?.onDragStart(layer.id); }}
        onDragOver={e => { if (dnd?.dragId) { e.preventDefault(); dnd.onRowDragOver(layer.id, layer.type, e); } }}
        onDrop={e => { if (dnd?.dragId) { e.preventDefault(); dnd.onRowDrop(); } }}
        onDragEnd={() => dnd?.onDragEnd()}
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'relative',
          display: 'flex', alignItems: 'center', height: 28,
          paddingLeft: 8 + depth * 12, paddingRight: 8,
          background: drop === 'inside' ? 'rgba(13,153,255,0.28)'
            : selected ? 'rgba(13,153,255,0.15)' : hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
          boxShadow: drop === 'inside' ? 'inset 0 0 0 1px #0d99ff' : undefined,
          opacity: isDragging ? 0.4 : 1,
          cursor: 'default', userSelect: 'none', gap: 4, borderRadius: 2,
        }}
      >
        {(drop === 'before' || drop === 'after') && (
          <div style={{ position: 'absolute', left: 6, right: 6, [drop === 'before' ? 'top' : 'bottom']: -1, height: 2, background: '#0d99ff', borderRadius: 2 }} />
        )}
        {/* Expand toggle */}
        <div
          onClick={e => { e.stopPropagation(); if (hasChildren) toggleExpand(layer.id); }}
          style={{ width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          {hasChildren
            ? expanded
              ? <ChevronDownIcon size={10} color="#9a9a9a" />
              : <ChevronRight size={10} color="#9a9a9a" />
            : null}
        </div>

        {/* Type icon */}
        <div style={{ width: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <LayerIcon type={layer.type} />
        </div>

        {/* Name */}
        <span style={{
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontSize: 12, color: selected ? '#ebebeb' : '#ccc',
        }}>
          {layer.name}
        </span>

        {/* Action icons (show on hover) */}
        {hovered && (
          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
            <button
              onClick={e => { e.stopPropagation(); updateLayer(layer.id, { visible: !layer.visible }); }}
              style={{ width: 18, height: 18, background: 'none', border: 'none', cursor: 'pointer', color: '#9a9a9a', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {layer.visible ? <Eye size={11} /> : <EyeOff size={11} />}
            </button>
            <button
              onClick={e => { e.stopPropagation(); updateLayer(layer.id, { locked: !layer.locked }); }}
              style={{ width: 18, height: 18, background: 'none', border: 'none', cursor: 'pointer', color: '#9a9a9a', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {layer.locked ? <Lock size={11} /> : <Unlock size={11} />}
            </button>
          </div>
        )}
      </div>

      {/* Render children if expanded */}
      {hasChildren && expanded && layer.children!.map(child => (
        <LayerRow key={child.id} layer={child} depth={depth + 1} expandedIds={expandedIds} toggleExpand={toggleExpand} />
      ))}
    </>
  );
}

// Locate a layer's parent id (null = top level) and its index among siblings.
function findParentAndIndex(
  layers: FigmaLayer[], id: string, parentId: string | null = null,
): { parentId: string | null; index: number } | null {
  for (let i = 0; i < layers.length; i++) {
    if (layers[i].id === id) return { parentId, index: i };
    const ch = layers[i].children;
    if (ch) { const r = findParentAndIndex(ch, id, layers[i].id); if (r) return r; }
  }
  return null;
}

export default function LeftPanel() {
  const {
    pages, activePageId, layers, leftPanelWidth, leftPanelCollapsed, leftPanelTab,
    setActivePage, addPage, renamePage, deletePage, reorderPage,
    setLeftPanelTab, setLeftPanelCollapsed, setLeftPanelWidth,
    colorStyles, textStyles, effectStyles, deleteTextStyle, deleteEffectStyle,
    components, createInstance, deleteComponent, moveLayerToParent,
  } = useFigmaStore();

  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingPageName, setEditingPageName] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Layer drag-and-drop state
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; mode: DropMode } | null>(null);

  const layerDnD: LayerDnD = React.useMemo(() => ({
    dragId, dropTarget,
    onDragStart: (id) => setDragId(id),
    onRowDragOver: (id, type, e) => {
      if (!dragId || id === dragId) { setDropTarget(null); return; }
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const rel = (e.clientY - rect.top) / rect.height;
      const canNest = CONTAINER_TYPES.includes(type);
      let mode: DropMode;
      if (canNest) mode = rel < 0.28 ? 'before' : rel > 0.72 ? 'after' : 'inside';
      else mode = rel < 0.5 ? 'before' : 'after';
      setDropTarget({ id, mode });
    },
    onRowDrop: () => {
      if (!dragId || !dropTarget || dragId === dropTarget.id) { setDragId(null); setDropTarget(null); return; }
      const roots = layers[activePageId] ?? [];
      if (dropTarget.mode === 'inside') {
        moveLayerToParent(dragId, dropTarget.id, null);
      } else {
        const tgt = findParentAndIndex(roots, dropTarget.id);
        if (tgt) {
          const dragPI = findParentAndIndex(roots, dragId);
          let desired = dropTarget.mode === 'before' ? tgt.index : tgt.index + 1;
          if (dragPI && dragPI.parentId === tgt.parentId && dragPI.index < desired) desired -= 1;
          moveLayerToParent(dragId, tgt.parentId, desired);
        }
      }
      setDragId(null);
      setDropTarget(null);
    },
    onDragEnd: () => { setDragId(null); setDropTarget(null); },
  }), [dragId, dropTarget, layers, activePageId, moveLayerToParent]);

  // Auto-expand any layer that gains children
  useEffect(() => {
    const collectParents = (arr: FigmaLayer[]): string[] =>
      arr.flatMap(l => (l.children?.length ? [l.id, ...collectParents(l.children)] : []));
    const parentIds = collectParents(layers[activePageId] ?? []);
    if (parentIds.length === 0) return;
    setExpandedIds(prev => {
      const next = new Set(prev);
      parentIds.forEach(id => next.add(id));
      return next;
    });
  }, [layers, activePageId]);
  const [assetSearch, setAssetSearch] = useState('');

  const resizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const currentLayers = (layers[activePageId] ?? []).filter(l =>
    search ? l.name.toLowerCase().includes(search.toLowerCase()) : true
  );

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) setContextMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenu]);

  // Panel resize
  const onResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = leftPanelWidth;
    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = ev.clientX - startXRef.current;
      setLeftPanelWidth(startWidthRef.current + delta);
    };
    const onUp = () => { resizingRef.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const startPageRename = (page: { id: string; name: string }) => {
    setEditingPageId(page.id);
    setEditingPageName(page.name);
  };

  const commitPageRename = () => {
    if (editingPageId) {
      renamePage(editingPageId, editingPageName.trim() || 'Page');
      setEditingPageId(null);
    }
  };

  if (leftPanelCollapsed) {
    return (
      <div
        style={{ width: 4, background: '#2c2c2c', borderRight: '1px solid #3c3c3c', cursor: 'ew-resize', flexShrink: 0 }}
        onClick={() => setLeftPanelCollapsed(false)}
      />
    );
  }

  const pageIdx = (id: string) => pages.findIndex(p => p.id === id);

  return (
    <div style={{
      width: leftPanelWidth, flexShrink: 0, display: 'flex', flexDirection: 'column',
      background: '#2c2c2c', borderRight: '1px solid #3c3c3c', overflow: 'hidden', position: 'relative',
    }}>
      {/* Tab bar */}
      <div style={{ height: 40, display: 'flex', alignItems: 'center', borderBottom: '1px solid #3c3c3c', flexShrink: 0 }}>
        {(['layers', 'assets'] as const).map(tab => (
          <button key={tab} onClick={() => setLeftPanelTab(tab)} style={{
            flex: 1, height: '100%', background: 'none', border: 'none', cursor: 'pointer',
            color: leftPanelTab === tab ? '#ebebeb' : '#777', fontSize: 12,
            fontWeight: leftPanelTab === tab ? 500 : 400,
            borderBottom: leftPanelTab === tab ? '2px solid #0d99ff' : '2px solid transparent',
            marginBottom: -1,
          }}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {leftPanelTab === 'layers' ? (
          <div style={{ flex: 1, overflow: 'auto' }}>
            {/* Pages section */}
            <div style={{ padding: '8px 8px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, padding: '0 4px' }}>
                <span style={{ fontSize: 11, color: '#777', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pages</span>
                <button onClick={addPage} style={{ width: 20, height: 20, background: 'none', border: 'none', cursor: 'pointer', color: '#777', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 3 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#ebebeb'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = '#777'; }}
                >
                  <Plus size={13} />
                </button>
              </div>
              {pages.map(page => (
                <div
                  key={page.id}
                  onClick={() => setActivePage(page.id)}
                  onDoubleClick={() => startPageRename(page)}
                  onContextMenu={e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, pageId: page.id }); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '4px 4px', borderRadius: 4, cursor: 'pointer',
                    background: activePageId === page.id ? 'rgba(255,255,255,0.06)' : 'transparent',
                    marginBottom: 1,
                  }}
                  onMouseEnter={e => { if (activePageId !== page.id) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={e => { if (activePageId !== page.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  {/* Thumbnail placeholder */}
                  <div style={{ width: 20, height: 14, borderRadius: 2, background: '#1e1e1e', border: '1px solid #444', flexShrink: 0 }} />
                  {editingPageId === page.id ? (
                    <input
                      autoFocus
                      value={editingPageName}
                      onChange={e => setEditingPageName(e.target.value)}
                      onBlur={commitPageRename}
                      onKeyDown={e => { if (e.key === 'Enter') commitPageRename(); if (e.key === 'Escape') setEditingPageId(null); }}
                      onClick={e => e.stopPropagation()}
                      style={{ flex: 1, background: '#1e1e1e', border: '1px solid #0d99ff', borderRadius: 3, color: '#ebebeb', fontSize: 12, padding: '1px 4px', outline: 'none' }}
                    />
                  ) : (
                    <span style={{ fontSize: 12, color: activePageId === page.id ? '#0d99ff' : '#ccc', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {page.name}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: '#3c3c3c', margin: '8px 0' }} />

            {/* Layers section */}
            <div style={{ padding: '0 8px 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, padding: '0 4px' }}>
                <span style={{ fontSize: 11, color: '#777', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Layers</span>
              </div>

              {/* Search */}
              <div style={{ position: 'relative', marginBottom: 6 }}>
                <Search size={11} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: '#666', pointerEvents: 'none' }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search layers..."
                  style={{
                    width: '100%', background: '#1e1e1e', border: '1px solid #3c3c3c', borderRadius: 4,
                    color: '#ccc', fontSize: 11, padding: '4px 8px 4px 24px', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              {currentLayers.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#555', fontSize: 12, padding: '24px 8px' }}>
                  {search ? 'No layers match' : 'No layers yet'}
                </div>
              ) : (
                <LayerDnDContext.Provider value={layerDnD}>
                  {currentLayers.map(layer => (
                    <LayerRow key={layer.id} layer={layer} depth={0} expandedIds={expandedIds} toggleExpand={toggleExpand} />
                  ))}
                  {/* Drop zone to move a layer to the very end of the top level */}
                  {dragId && (
                    <div
                      onDragOver={e => { e.preventDefault(); setDropTarget(null); }}
                      onDrop={e => { e.preventDefault(); moveLayerToParent(dragId, null, null); setDragId(null); setDropTarget(null); }}
                      style={{ height: 24 }}
                    />
                  )}
                </LayerDnDContext.Provider>
              )}
            </div>
          </div>
        ) : (
          /* Assets tab */
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Search */}
            <div style={{ padding: 8, borderBottom: '1px solid #333', flexShrink: 0 }}>
              <div style={{ position: 'relative' }}>
                <Search size={11} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: '#666', pointerEvents: 'none' }} />
                <input
                  value={assetSearch}
                  onChange={e => setAssetSearch(e.target.value)}
                  placeholder="Search styles…"
                  style={{ width: '100%', background: '#1e1e1e', border: '1px solid #3c3c3c', borderRadius: 4, color: '#ccc', fontSize: 11, padding: '4px 8px 4px 24px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {/* Components */}
              {Object.values(components).filter(c =>
                !assetSearch || c.name.toLowerCase().includes(assetSearch.toLowerCase())
              ).length > 0 && (
                <AssetSection title="Components">
                  <div style={{ padding: '4px 8px' }}>
                    {Object.values(components)
                      .filter(c => !assetSearch || c.name.toLowerCase().includes(assetSearch.toLowerCase()))
                      .map(comp => (
                        <div
                          key={comp.id}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px', cursor: 'pointer', borderRadius: 4, marginBottom: 2 }}
                          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.06)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                          onClick={() => createInstance(comp.id)}
                          title={`Click to place an instance of "${comp.name}"`}
                        >
                          <div style={{
                            width: 28, height: 28, borderRadius: 4, flexShrink: 0,
                            background: comp.fills.find(f => f.visible !== false)?.color ?? '#9747ff',
                            border: '1px solid rgba(255,255,255,0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, color: 'rgba(255,255,255,0.8)',
                          }}>◆</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, color: '#ebebeb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{comp.name}</div>
                            <div style={{ fontSize: 10, color: '#666' }}>{Math.round(comp.width)}×{Math.round(comp.height)}</div>
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); deleteComponent(comp.id); }}
                            style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: 2, fontSize: 11, flexShrink: 0 }}
                            title="Delete component"
                          >✕</button>
                        </div>
                      ))}
                  </div>
                </AssetSection>
              )}

              {/* Color Styles */}
              {colorStyles.filter(s => !assetSearch || s.name.toLowerCase().includes(assetSearch.toLowerCase())).length > 0 && (
                <AssetSection title="Color Styles">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '6px 10px' }}>
                    {colorStyles
                      .filter(s => !assetSearch || s.name.toLowerCase().includes(assetSearch.toLowerCase()))
                      .map(style => (
                        <div key={style.id} title={style.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer', width: 36 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 6, background: style.color, border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }} />
                          <span style={{ fontSize: 9, color: '#888', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{style.name}</span>
                        </div>
                      ))}
                  </div>
                </AssetSection>
              )}

              {/* Text Styles */}
              {textStyles.filter(s => !assetSearch || s.name.toLowerCase().includes(assetSearch.toLowerCase())).length > 0 && (
                <AssetSection title="Text Styles">
                  {textStyles
                    .filter(s => !assetSearch || s.name.toLowerCase().includes(assetSearch.toLowerCase()))
                    .map(style => (
                      <div key={style.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', cursor: 'pointer', borderRadius: 4 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.05)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                      >
                        <span style={{ fontFamily: style.fontFamily, fontSize: Math.min(14, style.fontSize), color: style.color, fontWeight: style.fontWeight, lineHeight: 1.2, flexShrink: 0 }}>Aa</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, color: '#ebebeb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{style.name}</div>
                          <div style={{ fontSize: 10, color: '#666' }}>{style.fontFamily} · {style.fontSize}px</div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); deleteTextStyle(style.id); }}
                          style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: 2, fontSize: 11, flexShrink: 0 }}>✕</button>
                      </div>
                    ))}
                </AssetSection>
              )}

              {/* Effect Styles */}
              {effectStyles.filter(s => !assetSearch || s.name.toLowerCase().includes(assetSearch.toLowerCase())).length > 0 && (
                <AssetSection title="Effect Styles">
                  {effectStyles
                    .filter(s => !assetSearch || s.name.toLowerCase().includes(assetSearch.toLowerCase()))
                    .map(style => (
                      <div key={style.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', cursor: 'pointer', borderRadius: 4 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.05)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                      >
                        <div style={{
                          width: 24, height: 24, borderRadius: 4, background: '#e2e2e2',
                          boxShadow: style.effects.filter(e => e.type === 'drop-shadow' && e.visible).map(e => `${e.x}px ${e.y}px ${e.blur}px ${e.spread}px ${e.color ?? '#000'}`).join(', ') || 'none',
                          flexShrink: 0,
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, color: '#ebebeb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{style.name}</div>
                          <div style={{ fontSize: 10, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{style.effects.map(e => e.type.replace(/-/g, ' ')).join(', ')}</div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); deleteEffectStyle(style.id); }}
                          style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: 2, fontSize: 11, flexShrink: 0 }}>✕</button>
                      </div>
                    ))}
                </AssetSection>
              )}

              {/* Empty state */}
              {colorStyles.length === 0 && textStyles.length === 0 && effectStyles.length === 0 && Object.keys(components).length === 0 && (
                <div style={{ textAlign: 'center', color: '#555', fontSize: 12, padding: '40px 16px' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>🎨</div>
                  <div style={{ marginBottom: 4 }}>No assets yet</div>
                  <div style={{ fontSize: 11, color: '#444' }}>Right-click a layer → Create Component,<br />or save colors, text, and effects as styles</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={onResizeMouseDown}
        onDoubleClick={() => setLeftPanelCollapsed(true)}
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 4,
          cursor: 'ew-resize', zIndex: 10,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(13,153,255,0.3)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      />

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{
            position: 'fixed', left: contextMenu.x, top: contextMenu.y,
            background: '#2c2c2c', border: '1px solid #3c3c3c', borderRadius: 6,
            padding: '4px 0', zIndex: 9999, minWidth: 140,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}
        >
          {[
            { label: 'Duplicate', action: () => { const page = pages.find(p => p.id === contextMenu.pageId); if (page) { addPage(); } } },
            { label: 'Rename', action: () => { const page = pages.find(p => p.id === contextMenu.pageId); if (page) startPageRename(page); } },
            { label: 'Move up', action: () => { const idx = pageIdx(contextMenu.pageId); if (idx > 0) reorderPage(idx, idx - 1); } },
            { label: 'Move down', action: () => { const idx = pageIdx(contextMenu.pageId); if (idx < pages.length - 1) reorderPage(idx, idx + 1); } },
            { label: 'Delete', action: () => deletePage(contextMenu.pageId) },
          ].map(item => (
            <button key={item.label} onClick={() => { item.action(); setContextMenu(null); }} style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '6px 14px',
              background: 'none', border: 'none', color: item.label === 'Delete' ? '#ef4444' : '#ebebeb',
              fontSize: 12, cursor: 'pointer',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
