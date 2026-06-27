"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { useFigmaStore, FigmaLayer } from '@/lib/stores/figmaStore';

interface Props {
  onClose: () => void;
}

function collectAllLayers(layers: FigmaLayer[]): FigmaLayer[] {
  const result: FigmaLayer[] = [];
  const walk = (arr: FigmaLayer[]) => {
    for (const l of arr) {
      result.push(l);
      if (l.children) walk(l.children);
    }
  };
  walk(layers);
  return result;
}

export default function FindReplacePanel({ onClose }: Props) {
  const { layers, activePageId, setSelection, updateLayer } = useFigmaStore();
  const [query, setQuery] = useState('');
  const [replace, setReplace] = useState('');
  const [useRegex, setUseRegex] = useState(false);

  const allLayers = useMemo(() => collectAllLayers(layers[activePageId] ?? []), [layers, activePageId]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    try {
      const pattern = useRegex ? new RegExp(query, 'i') : null;
      const test = (s: string) => pattern ? pattern.test(s) : s.toLowerCase().includes(query.toLowerCase());
      return allLayers.filter(l => test(l.name) || (l.text !== undefined && test(l.text ?? '')));
    } catch {
      return [];
    }
  }, [allLayers, query, useRegex]);

  const handleReplaceAll = useCallback(() => {
    if (!query.trim()) return;
    try {
      const pattern = useRegex ? new RegExp(query, 'gi') : null;
      for (const l of results) {
        const newName = pattern
          ? l.name.replace(pattern, replace)
          : l.name.split(query).join(replace);
        const newText = (l.text !== undefined && l.text !== null)
          ? (pattern ? l.text.replace(pattern, replace) : l.text.split(query).join(replace))
          : undefined;
        const update: Partial<FigmaLayer> = { name: newName };
        if (newText !== undefined) update.text = newText;
        updateLayer(l.id, update);
      }
    } catch {}
  }, [query, replace, results, useRegex, updateLayer]);

  const layerIcon = (type: string) => {
    const icons: Record<string, string> = {
      frame: '▢', rect: '▭', ellipse: '◯', text: 'T',
      group: '⊞', component: '◆', instance: '◇', vector: '✏', comment: '📌',
      line: '/', image: '🖼', section: '§',
    };
    return icons[type] ?? '▢';
  };

  return (
    <div
      style={{
        position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)',
        background: '#2c2c2c', border: '1px solid #3c3c3c', borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 2000,
        width: 340, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}
      onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
    >
      {/* Header */}
      <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #3c3c3c', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#ebebeb' }}>Find & Replace</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 16, lineHeight: 1, padding: '0 2px' }}>×</button>
      </div>

      {/* Inputs */}
      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Find…"
            style={{
              flex: 1, background: '#1e1e1e', border: '1px solid #3c3c3c', borderRadius: 4,
              color: '#ebebeb', fontSize: 12, padding: '4px 8px', outline: 'none',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = '#0d99ff')}
            onBlur={e => (e.currentTarget.style.borderColor = '#3c3c3c')}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#888', cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={useRegex} onChange={e => setUseRegex(e.target.checked)} style={{ cursor: 'pointer' }} />
            Regex
          </label>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            value={replace}
            onChange={e => setReplace(e.target.value)}
            placeholder="Replace with…"
            style={{
              flex: 1, background: '#1e1e1e', border: '1px solid #3c3c3c', borderRadius: 4,
              color: '#ebebeb', fontSize: 12, padding: '4px 8px', outline: 'none',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = '#0d99ff')}
            onBlur={e => (e.currentTarget.style.borderColor = '#3c3c3c')}
          />
          <button
            onClick={handleReplaceAll}
            disabled={results.length === 0}
            style={{
              padding: '4px 10px', borderRadius: 4, border: 'none', cursor: results.length > 0 ? 'pointer' : 'default',
              background: results.length > 0 ? '#0d99ff' : '#3c3c3c',
              color: results.length > 0 ? '#fff' : '#555', fontSize: 11, whiteSpace: 'nowrap',
            }}
          >
            Replace all
          </button>
        </div>
      </div>

      {/* Results count */}
      {query.trim() && (
        <div style={{ padding: '0 12px 4px', fontSize: 11, color: '#888' }}>
          {results.length} result{results.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Results list */}
      {results.length > 0 && (
        <div style={{ maxHeight: 220, overflowY: 'auto', borderTop: '1px solid #3c3c3c' }}>
          {results.map(l => (
            <button
              key={l.id}
              onClick={() => { setSelection([l.id]); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '6px 12px', background: 'none', border: 'none',
                cursor: 'pointer', textAlign: 'left',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <span style={{ fontSize: 12, color: '#888', flexShrink: 0 }}>{layerIcon(l.type)}</span>
              <span style={{ flex: 1, fontSize: 12, color: '#ebebeb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {l.name}
              </span>
              {l.text && (
                <span style={{ fontSize: 11, color: '#888', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {l.text}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
