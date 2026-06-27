"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Pipette, Plus } from 'lucide-react';

// ── Color math helpers ─────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
}

function hexToHsb(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map(v => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  const s = max === 0 ? 0 : d / max;
  const bv = max;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s * 100, bv * 100];
}

function hsbToHex(h: number, s: number, b: number): string {
  const hh = h / 60, ss = s / 100, bb = b / 100;
  const i = Math.floor(hh) % 6;
  const f = hh - Math.floor(hh);
  const p = bb * (1 - ss);
  const q = bb * (1 - f * ss);
  const t = bb * (1 - (1 - f) * ss);
  const table: [number, number, number][] = [
    [bb, t, p], [q, bb, p], [p, bb, t],
    [p, q, bb], [t, p, bb], [bb, p, q],
  ];
  const [r, g, bOut] = table[i];
  return rgbToHex(r * 255, g * 255, bOut * 255);
}

function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map(v => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l * 100];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  const hh = h / 360, ss = s / 100, ll = l / 100;
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p = 2 * ll - q;
  const hue2rgb = (t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  return rgbToHex(hue2rgb(hh + 1/3) * 255, hue2rgb(hh) * 255, hue2rgb(hh - 1/3) * 255);
}

// ── Props ───────────────────────────────────────────────────────

export interface ColorPickerProps {
  color: string;
  alpha: number;
  onChange: (hex: string, alpha: number) => void;
  onClose?: () => void;
  recentColors?: string[];
  documentColors?: string[];
  onSaveStyle?: (color: string) => void;
}

// ── Slider (shared for hue + alpha) ────────────────────────────

function Slider({
  value, onChange, gradient, thumbColor = '#fff',
}: {
  value: number; onChange: (v: number) => void;
  gradient: string; thumbColor?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  const getVal = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return clamp((clientX - rect.left) / rect.width, 0, 1);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    onChange(getVal(e.clientX));
    const onMove = (ev: MouseEvent) => onChange(getVal(ev.clientX));
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div
      ref={trackRef}
      onMouseDown={handleMouseDown}
      style={{ position: 'relative', height: 12, borderRadius: 6, background: gradient, cursor: 'crosshair', border: '1px solid rgba(0,0,0,0.3)' }}
    >
      <div style={{
        position: 'absolute', top: '50%', left: `${value * 100}%`,
        transform: 'translate(-50%, -50%)',
        width: 14, height: 14, borderRadius: '50%',
        background: thumbColor, border: '2px solid #fff',
        boxShadow: '0 1px 4px rgba(0,0,0,0.5)', pointerEvents: 'none',
      }} />
    </div>
  );
}

// ── Main ColorPicker ────────────────────────────────────────────

export default function ColorPicker({
  color, alpha, onChange, recentColors = [], documentColors = [], onSaveStyle,
}: ColorPickerProps) {
  const [hsb, setHsb] = useState<[number, number, number]>(() => hexToHsb(color));
  const [localAlpha, setLocalAlpha] = useState(alpha);
  const [mode, setMode] = useState<'HEX' | 'RGB' | 'HSB' | 'HSL'>('HEX');
  const [savingStyle, setSavingStyle] = useState(false);
  const [styleName, setStyleName] = useState('');
  const sbRef = useRef<HTMLCanvasElement>(null);

  const [h, s, b] = hsb;
  const currentHex = hsbToHex(h, s, b);

  // Sync from external prop changes
  useEffect(() => {
    const [nh, ns, nb] = hexToHsb(color);
    setHsb([nh, ns, nb]);
  }, [color]);

  useEffect(() => { setLocalAlpha(alpha); }, [alpha]);

  // Draw the SB square
  useEffect(() => {
    const cv = sbRef.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = 220 * dpr;
    cv.height = 150 * dpr;
    cv.style.width = '220px';
    cv.style.height = '150px';
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // White → hue color
    const gH = ctx.createLinearGradient(0, 0, 220, 0);
    gH.addColorStop(0, 'white');
    gH.addColorStop(1, `hsl(${h}, 100%, 50%)`);
    ctx.fillStyle = gH;
    ctx.fillRect(0, 0, 220, 150);

    // Transparent → black
    const gV = ctx.createLinearGradient(0, 0, 0, 150);
    gV.addColorStop(0, 'transparent');
    gV.addColorStop(1, 'black');
    ctx.fillStyle = gV;
    ctx.fillRect(0, 0, 220, 150);
  }, [h]);

  const handleSbMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const update = (clientX: number, clientY: number) => {
      const cv = sbRef.current;
      if (!cv) return;
      const rect = cv.getBoundingClientRect();
      const ns = clamp((clientX - rect.left) / rect.width, 0, 1) * 100;
      const nb = (1 - clamp((clientY - rect.top) / rect.height, 0, 1)) * 100;
      const newHsb: [number, number, number] = [h, ns, nb];
      setHsb(newHsb);
      onChange(hsbToHex(h, ns, nb), localAlpha);
    };
    update(e.clientX, e.clientY);
    const onMove = (ev: MouseEvent) => update(ev.clientX, ev.clientY);
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [h, localAlpha, onChange]);

  const handleHueChange = (v: number) => {
    const nh = v * 360;
    setHsb([nh, s, b]);
    onChange(hsbToHex(nh, s, b), localAlpha);
  };

  const handleAlphaChange = (v: number) => {
    setLocalAlpha(v);
    onChange(currentHex, v);
  };

  const handleHexInput = (val: string) => {
    const h2 = val.replace('#', '');
    const full = h2.length === 3 ? h2.split('').map(c => c + c).join('') : h2;
    if (/^[0-9a-fA-F]{6}$/.test(full)) {
      const hex = '#' + full.toLowerCase();
      setHsb(hexToHsb(hex));
      onChange(hex, localAlpha);
    }
  };

  const [r, g, bRgb] = hexToRgb(currentHex);
  const [hh, hs, hl] = hexToHsl(currentHex);

  const inputStyle: React.CSSProperties = {
    background: '#111', border: '1px solid #444', borderRadius: 4,
    color: '#ebebeb', fontSize: 11, padding: '3px 5px', outline: 'none',
    width: '100%', boxSizing: 'border-box',
  };

  const swatch = (c: string) => (
    <button
      key={c}
      title={c}
      onClick={() => { setHsb(hexToHsb(c)); onChange(c, localAlpha); }}
      style={{ width: 16, height: 16, borderRadius: '50%', background: c, border: '1px solid #555', cursor: 'pointer', padding: 0, flexShrink: 0 }}
    />
  );

  const [rgb1, rgb2] = hexToRgb(currentHex).map(v => v / 255);
  const alphaGradient = `linear-gradient(to right, transparent, rgb(${r},${g},${bRgb}))`;
  const hueGradient = 'linear-gradient(to right, hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%), hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%))';

  const checkerStyle: React.CSSProperties = {
    backgroundImage: 'linear-gradient(45deg,#808080 25%,transparent 25%),linear-gradient(-45deg,#808080 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#808080 75%),linear-gradient(-45deg,transparent 75%,#808080 75%)',
    backgroundSize: '8px 8px',
    backgroundPosition: '0 0,0 4px,4px -4px,-4px 0',
    backgroundColor: 'white',
  };

  const eyeDropper = () => {
    if (typeof window !== 'undefined' && (window as any).EyeDropper) {
      new (window as any).EyeDropper().open().then((r: { sRGBHex: string }) => {
        setHsb(hexToHsb(r.sRGBHex));
        onChange(r.sRGBHex, localAlpha);
      }).catch(() => {});
    } else {
      alert('EyeDropper not supported in this browser');
    }
  };

  return (
    <div style={{
      background: '#2c2c2c', border: '1px solid #444', borderRadius: 8,
      padding: 12, width: 244, boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      fontSize: 12, color: '#ebebeb', userSelect: 'none',
    }}
      onMouseDown={e => e.stopPropagation()}
    >
      {/* SB square */}
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <canvas
          ref={sbRef}
          onMouseDown={handleSbMouseDown}
          style={{ display: 'block', borderRadius: 4, cursor: 'crosshair', border: '1px solid #444' }}
        />
        {/* Cursor dot */}
        <div style={{
          position: 'absolute', pointerEvents: 'none',
          left: `${(s / 100) * 220}px`, top: `${(1 - b / 100) * 150}px`,
          transform: 'translate(-50%, -50%)',
          width: 10, height: 10, borderRadius: '50%',
          background: currentHex, border: '2px solid white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
        }} />
      </div>

      {/* Hue slider */}
      <div style={{ marginBottom: 6 }}>
        <Slider value={h / 360} onChange={handleHueChange} gradient={hueGradient} thumbColor={`hsl(${h},100%,50%)`} />
      </div>

      {/* Alpha slider */}
      <div style={{ marginBottom: 10, position: 'relative', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ ...checkerStyle, position: 'absolute', inset: 0, borderRadius: 6 }} />
        <Slider value={localAlpha} onChange={handleAlphaChange} gradient={alphaGradient} thumbColor={currentHex} />
      </div>

      {/* Mode tabs + inputs */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 2, marginBottom: 6 }}>
          {(['HEX', 'RGB', 'HSB', 'HSL'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex: 1, padding: '2px 0', background: mode === m ? '#444' : 'transparent',
              border: 'none', borderRadius: 3, color: mode === m ? '#fff' : '#888',
              fontSize: 10, cursor: 'pointer',
            }}>{m}</button>
          ))}
          <button onClick={eyeDropper} title="Eyedropper" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: '2px 4px' }}>
            <Pipette size={12} />
          </button>
        </div>

        {mode === 'HEX' && (
          <input
            defaultValue={currentHex.replace('#', '').toUpperCase()}
            key={currentHex}
            onBlur={e => handleHexInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleHexInput((e.target as HTMLInputElement).value); }}
            style={{ ...inputStyle, fontFamily: 'monospace' }}
          />
        )}

        {mode === 'RGB' && (
          <div style={{ display: 'flex', gap: 4 }}>
            {[['R', r], ['G', g], ['B', bRgb]].map(([lbl, val]) => (
              <div key={lbl as string} style={{ flex: 1, textAlign: 'center' }}>
                <input
                  type="number" min={0} max={255}
                  defaultValue={val as number}
                  key={`${lbl}-${currentHex}`}
                  onBlur={e => {
                    const arr = [r, g, bRgb];
                    arr[['R','G','B'].indexOf(lbl as string)] = parseInt(e.target.value) || 0;
                    const hex = rgbToHex(arr[0], arr[1], arr[2]);
                    setHsb(hexToHsb(hex)); onChange(hex, localAlpha);
                  }}
                  style={{ ...inputStyle }}
                />
                <div style={{ fontSize: 9, color: '#666', marginTop: 2 }}>{lbl}</div>
              </div>
            ))}
          </div>
        )}

        {mode === 'HSB' && (
          <div style={{ display: 'flex', gap: 4 }}>
            {[['H', Math.round(h)], ['S', Math.round(s)], ['B', Math.round(b)]].map(([lbl, val]) => (
              <div key={lbl as string} style={{ flex: 1, textAlign: 'center' }}>
                <input
                  type="number"
                  min={lbl === 'H' ? 0 : 0} max={lbl === 'H' ? 360 : 100}
                  defaultValue={val as number}
                  key={`${lbl}-${Math.round(h)}-${Math.round(s)}-${Math.round(b)}`}
                  onBlur={e => {
                    const v = parseFloat(e.target.value) || 0;
                    const newHsb: [number, number, number] = [...hsb];
                    newHsb[['H','S','B'].indexOf(lbl as string)] = v;
                    setHsb(newHsb);
                    onChange(hsbToHex(...newHsb), localAlpha);
                  }}
                  style={{ ...inputStyle }}
                />
                <div style={{ fontSize: 9, color: '#666', marginTop: 2 }}>{lbl}</div>
              </div>
            ))}
          </div>
        )}

        {mode === 'HSL' && (
          <div style={{ display: 'flex', gap: 4 }}>
            {[['H', Math.round(hh)], ['S', Math.round(hs)], ['L', Math.round(hl)]].map(([lbl, val]) => (
              <div key={lbl as string} style={{ flex: 1, textAlign: 'center' }}>
                <input
                  type="number"
                  min={0} max={lbl === 'H' ? 360 : 100}
                  defaultValue={val as number}
                  key={`${lbl}-${Math.round(hh)}-${Math.round(hs)}-${Math.round(hl)}`}
                  onBlur={e => {
                    const v = parseFloat(e.target.value) || 0;
                    const arr = [hh, hs, hl];
                    arr[['H','S','L'].indexOf(lbl as string)] = v;
                    const hex = hslToHex(arr[0], arr[1], arr[2]);
                    setHsb(hexToHsb(hex)); onChange(hex, localAlpha);
                  }}
                  style={{ ...inputStyle }}
                />
                <div style={{ fontSize: 9, color: '#666', marginTop: 2 }}>{lbl}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent colors */}
      {recentColors.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>Recent</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {recentColors.map(swatch)}
          </div>
        </div>
      )}

      {/* Document colors */}
      {documentColors.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>Document</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {documentColors.map(swatch)}
          </div>
        </div>
      )}

      {/* Divider */}
      <div style={{ height: 1, background: '#3c3c3c', margin: '8px 0' }} />

      {/* Add to styles */}
      {onSaveStyle && (
        savingStyle ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              autoFocus
              value={styleName}
              onChange={e => setStyleName(e.target.value)}
              placeholder="Style name…"
              onKeyDown={e => {
                if (e.key === 'Enter') { onSaveStyle(currentHex); setSavingStyle(false); setStyleName(''); }
                if (e.key === 'Escape') { setSavingStyle(false); setStyleName(''); }
              }}
              style={{ flex: 1, background: '#111', border: '1px solid #0d99ff', borderRadius: 4, color: '#ebebeb', fontSize: 11, padding: '3px 6px', outline: 'none' }}
            />
            <button
              onClick={() => { onSaveStyle(currentHex); setSavingStyle(false); setStyleName(''); }}
              style={{ background: '#0d99ff', border: 'none', borderRadius: 4, color: '#fff', fontSize: 11, padding: '3px 8px', cursor: 'pointer' }}
            >
              Save
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSavingStyle(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 11, padding: 0 }}
          >
            <Plus size={11} /> Add to styles
          </button>
        )
      )}
    </div>
  );
}
