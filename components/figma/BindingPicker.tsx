"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useFigmaStore, type ApiSource, type GlobalStateVar } from '@/lib/stores/figmaStore';

export interface TokenGroup {
  label: string;
  color: string;
  tokens: { path: string; label: string; type?: string }[];
}

interface Props {
  anchorRect?: DOMRect;
  currentValue?: string;
  layerId: string;
  onSelect: (expression: string) => void;
  onClose: () => void;
}

function buildTokenGroups(
  apiSources: ApiSource[],
  globalStateVars: GlobalStateVar[],
  repeatContext: string | null,
): TokenGroup[] {
  const groups: TokenGroup[] = [];

  if (repeatContext !== null) {
    const v = repeatContext;
    groups.push({
      label: 'Repeat Item',
      color: '#f72585',
      tokens: [
        { path: `$${v}`, label: `${v} (current row)`, type: 'object' },
        { path: `$${v}.id`, label: `${v}.id`, type: 'string' },
        { path: `$${v}.name`, label: `${v}.name`, type: 'string' },
        { path: `$${v}.title`, label: `${v}.title`, type: 'string' },
        { path: `$${v}.description`, label: `${v}.description`, type: 'string' },
        { path: `$${v}.imageUrl`, label: `${v}.imageUrl`, type: 'string' },
        { path: `$${v}.createdAt`, label: `${v}.createdAt`, type: 'string' },
      ],
    });
  }

  if (globalStateVars.length > 0) {
    groups.push({
      label: 'Global State',
      color: '#0d99ff',
      tokens: globalStateVars.map(v => ({
        path: v.scope === 'global' ? `$global.${v.name}` : `$page.${v.name}`,
        label: v.name,
        type: v.type,
      })),
    });
  }

  if (apiSources.length > 0) {
    groups.push({
      label: 'APIs',
      color: '#00c864',
      tokens: apiSources.flatMap(s => [
        { path: `$api.${s.name}.data`, label: `${s.name}.data`, type: 'array' },
        { path: `$api.${s.name}.loading`, label: `${s.name}.loading`, type: 'boolean' },
        { path: `$api.${s.name}.error`, label: `${s.name}.error`, type: 'object' },
      ]),
    });
  }

  groups.push({
    label: 'URL Params',
    color: '#7b61ff',
    tokens: [
      { path: '$params.id', label: 'params.id', type: 'string' },
      { path: '$params.userId', label: 'params.userId', type: 'string' },
      { path: '$params.slug', label: 'params.slug', type: 'string' },
    ],
  });

  groups.push({
    label: 'Auth',
    color: '#6366f1',
    tokens: [
      { path: '$user.id', label: 'user.id', type: 'string' },
      { path: '$user.email', label: 'user.email', type: 'string' },
      { path: '$user.name', label: 'user.name', type: 'string' },
      { path: '$user.role', label: 'user.role', type: 'string' },
      { path: '$user.isLoggedIn', label: 'user.isLoggedIn', type: 'boolean' },
    ],
  });

  groups.push({
    label: 'Theme',
    color: '#ff9500',
    tokens: [
      { path: '$theme.primary', label: 'theme.primary', type: 'color' },
      { path: '$theme.secondary', label: 'theme.secondary', type: 'color' },
      { path: '$theme.background', label: 'theme.background', type: 'color' },
      { path: '$theme.text', label: 'theme.text', type: 'color' },
      { path: '$theme.error', label: 'theme.error', type: 'color' },
    ],
  });

  return groups;
}

export default function BindingPicker({ anchorRect, currentValue, layerId, onSelect, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [customExpr, setCustomExpr] = useState(currentValue ?? '');
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(['Repeat Item', 'Global State', 'APIs']));
  const containerRef = useRef<HTMLDivElement>(null);

  const { layers, activePageId, apiSources, globalStateVars } = useFigmaStore();
  const pageLayers = layers[activePageId] ?? [];

  const repeatContext = React.useMemo(() => {
    type LayerArr = typeof pageLayers;
    const check = (arr: LayerArr, targetId: string, ancestorRepeat: boolean, ancestorVar: string): { found: boolean; varName: string } => {
      for (const l of arr) {
        if (l.id === targetId) return { found: true, varName: ancestorVar };
        if (l.children) {
          const result = check(
            l.children,
            targetId,
            ancestorRepeat || !!l.repeatFor,
            l.repeatFor?.as ?? ancestorVar,
          );
          if (result.found) return result;
        }
      }
      return { found: false, varName: 'item' };
    };
    const result = check(pageLayers, layerId, false, 'item');
    if (!result.found) return null;
    const hasAncestorRepeat = (() => {
      const findRepeat = (arr: LayerArr, targetId: string): boolean => {
        for (const l of arr) {
          if (l.children) {
            const inChildren = (c: LayerArr): boolean => c.some(ch => ch.id === targetId || (ch.children ? inChildren(ch.children) : false));
            if (inChildren(l.children)) {
              if (l.repeatFor) return true;
              return findRepeat(l.children, targetId);
            }
          }
        }
        return false;
      };
      return findRepeat(pageLayers, layerId);
    })();
    return hasAncestorRepeat ? result.varName : null;
  }, [pageLayers, layerId]);

  const groups = buildTokenGroups(apiSources, globalStateVars, repeatContext);

  const filteredGroups = search
    ? groups.map(g => ({
        ...g,
        tokens: g.tokens.filter(t =>
          t.path.toLowerCase().includes(search.toLowerCase()) ||
          t.label.toLowerCase().includes(search.toLowerCase())
        ),
      })).filter(g => g.tokens.length > 0)
    : groups;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const tid = setTimeout(() => document.addEventListener('mousedown', handler), 10);
    return () => { clearTimeout(tid); document.removeEventListener('mousedown', handler); };
  }, [onClose]);

  const style: React.CSSProperties = anchorRect ? {
    position: 'fixed',
    top: Math.min(anchorRect.bottom + 4, window.innerHeight - 400),
    left: Math.max(8, Math.min(anchorRect.left, window.innerWidth - 300)),
    width: 280,
    zIndex: 9999,
  } : {
    position: 'fixed',
    top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 280,
    zIndex: 9999,
  };

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  };

  return (
    <div
      ref={containerRef}
      style={{
        ...style,
        background: '#1e1e1e',
        border: '1px solid #3c3c3c',
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        overflow: 'hidden',
        fontFamily: 'Inter, sans-serif',
        fontSize: 11,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 400,
      }}
    >
      {/* Header */}
      <div style={{ padding: '8px 10px 0', borderBottom: '1px solid #2e2e2e' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#ebebeb', marginBottom: 6 }}>Bind Data</div>
        <input
          autoFocus
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search tokens…"
          onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
          style={{
            width: '100%', background: '#0d0d0d', border: '1px solid #333',
            borderRadius: 4, color: '#ebebeb', fontSize: 11,
            padding: '5px 8px', outline: 'none', marginBottom: 8,
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Token groups */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {filteredGroups.map(group => (
          <div key={group.label}>
            <button
              onClick={() => toggleGroup(group.label)}
              style={{
                width: '100%', textAlign: 'left', display: 'flex',
                alignItems: 'center', gap: 6,
                padding: '5px 10px', background: 'none', border: 'none',
                cursor: 'pointer', color: '#888', fontSize: 10, fontWeight: 700,
                letterSpacing: '0.06em', textTransform: 'uppercase' as const,
              }}
            >
              <span style={{ color: group.color, fontSize: 8 }}>
                {openGroups.has(group.label) ? '▼' : '▶'}
              </span>
              <span style={{ color: group.color }}>{group.label}</span>
            </button>
            {openGroups.has(group.label) && group.tokens.map(token => (
              <div
                key={token.path}
                onClick={() => { onSelect(token.path); onClose(); }}
                style={{
                  padding: '4px 10px 4px 24px',
                  cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  gap: 8,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.06)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
              >
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#ebebeb' }}>
                  {token.path}
                </span>
                {token.type && (
                  <span style={{ fontSize: 9, color: '#555', textTransform: 'uppercase' as const, flexShrink: 0 }}>
                    {token.type}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}

        {filteredGroups.length === 0 && search && (
          <div style={{ padding: '12px', color: '#555', textAlign: 'center', fontSize: 11 }}>
            No tokens match &ldquo;{search}&rdquo;
          </div>
        )}
      </div>

      {/* Custom expression input */}
      <div style={{ borderTop: '1px solid #2e2e2e', padding: '8px 10px' }}>
        <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>Custom expression</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={customExpr}
            onChange={e => setCustomExpr(e.target.value)}
            placeholder="$state.field or 'literal'"
            onKeyDown={e => {
              if (e.key === 'Enter' && customExpr.trim()) { onSelect(customExpr.trim()); onClose(); }
            }}
            style={{
              flex: 1, background: '#0d0d0d', border: '1px solid #333',
              borderRadius: 4, color: '#ebebeb', fontSize: 11,
              padding: '4px 8px', outline: 'none', fontFamily: 'monospace',
            }}
          />
          <button
            onClick={() => { if (customExpr.trim()) { onSelect(customExpr.trim()); onClose(); } }}
            style={{
              background: customExpr.trim() ? '#0d99ff' : '#1a1a1a',
              border: 'none', borderRadius: 4, color: customExpr.trim() ? '#fff' : '#555',
              fontSize: 11, padding: '4px 10px',
              cursor: customExpr.trim() ? 'pointer' : 'not-allowed',
              flexShrink: 0,
            }}
          >
            Bind
          </button>
        </div>
      </div>
    </div>
  );
}
