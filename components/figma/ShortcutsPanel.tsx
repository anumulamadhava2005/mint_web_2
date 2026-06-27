"use client";

import React from 'react';

interface Props {
  onClose: () => void;
}

const SHORTCUT_GROUPS = [
  {
    title: 'Tools',
    shortcuts: [
      { keys: ['V'], label: 'Select' },
      { keys: ['F'], label: 'Frame' },
      { keys: ['R'], label: 'Rectangle' },
      { keys: ['O'], label: 'Ellipse' },
      { keys: ['L'], label: 'Line' },
      { keys: ['T'], label: 'Text' },
      { keys: ['P'], label: 'Pen' },
      { keys: ['H'], label: 'Hand (pan)' },
      { keys: ['C'], label: 'Comment' },
      { keys: ['K'], label: 'Scale' },
    ],
  },
  {
    title: 'Edit',
    shortcuts: [
      { keys: ['Ctrl', 'Z'], label: 'Undo' },
      { keys: ['Ctrl', 'Y'], label: 'Redo' },
      { keys: ['Ctrl', 'D'], label: 'Duplicate' },
      { keys: ['Ctrl', 'C'], label: 'Copy' },
      { keys: ['Ctrl', 'V'], label: 'Paste' },
      { keys: ['Del'], label: 'Delete' },
      { keys: ['Ctrl', 'F'], label: 'Find & Replace' },
    ],
  },
  {
    title: 'Canvas',
    shortcuts: [
      { keys: ['Shift', '1'], label: 'Zoom to fit' },
      { keys: ['Ctrl', '+'], label: 'Zoom in' },
      { keys: ['Ctrl', '-'], label: 'Zoom out' },
      { keys: ['Ctrl', "'"  ], label: 'Toggle grid' },
      { keys: ['Ctrl', 'R'], label: 'Toggle rulers' },
      { keys: ['Space', 'drag'], label: 'Pan canvas' },
    ],
  },
  {
    title: 'Layers',
    shortcuts: [
      { keys: ['Ctrl', ']'], label: 'Bring forward' },
      { keys: ['Ctrl', '['], label: 'Send backward' },
      { keys: ['Ctrl', 'Shift', ']'], label: 'Bring to front' },
      { keys: ['Ctrl', 'Shift', '['], label: 'Send to back' },
      { keys: ['Shift', 'A'], label: 'Toggle auto layout' },
    ],
  },
  {
    title: 'Text',
    shortcuts: [
      { keys: ['Enter'], label: 'Edit text layer' },
      { keys: ['Esc'], label: 'Exit text edit' },
      { keys: ['Ctrl', 'B'], label: 'Bold' },
      { keys: ['Ctrl', 'I'], label: 'Italic' },
    ],
  },
  {
    title: 'View',
    shortcuts: [
      { keys: ['?'], label: 'Keyboard shortcuts' },
      { keys: ['Esc'], label: 'Deselect / cancel' },
      { keys: ['Tab'], label: 'Select next layer' },
    ],
  },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 20, padding: '2px 5px', background: '#1e1e1e',
      border: '1px solid #444', borderRadius: 3, fontSize: 10,
      color: '#ccc', fontFamily: 'inherit', lineHeight: 1.4,
    }}>
      {children}
    </kbd>
  );
}

export default function ShortcutsPanel({ onClose }: Props) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
      onKeyDown={e => { if (e.key === 'Escape' || e.key === '?') onClose(); }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#2c2c2c', border: '1px solid #3c3c3c', borderRadius: 10,
          boxShadow: '0 16px 64px rgba(0,0,0,0.6)',
          width: 680, maxHeight: '80vh', overflow: 'auto',
          padding: 24,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#ebebeb' }}>Keyboard Shortcuts</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px 32px' }}>
          {SHORTCUT_GROUPS.map(group => (
            <div key={group.title}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#0d99ff', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                {group.title}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {group.shortcuts.map((s, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 22 }}>
                    <span style={{ fontSize: 12, color: '#b0b0b0' }}>{s.label}</span>
                    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                      {s.keys.map((k, ki) => (
                        <React.Fragment key={ki}>
                          {ki > 0 && <span style={{ color: '#555', fontSize: 10 }}>+</span>}
                          <Kbd>{k}</Kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #3c3c3c', fontSize: 11, color: '#555', textAlign: 'center' }}>
          Press <Kbd>?</Kbd> to close
        </div>
      </div>
    </div>
  );
}
