"use client";

import { useState } from "react";
import { Download, Undo2, Plus, Circle, Type, ArrowLeftRight, ChevronDown } from "lucide-react";
import { Segmented, Toggle, Btn, IconBtn, Pill, Field, TextField } from "./primitives";
import { useRuntimeStore } from "@/lib/runtime/runtime-store";

type Viewport = "Desktop" | "Tablet" | "Mobile";
interface ColorToken { name: string; hex: string; }

const DEFAULT_COLORS: ColorToken[] = [
  { name: "primary", hex: "#7c3aed" },
  { name: "background", hex: "#0c0c0c" },
  { name: "surface", hex: "#1a1a1a" },
  { name: "outline", hex: "#3f3f3f" },
  { name: "error", hex: "#ef4444" },
  { name: "secondary-cont", hex: "#4b5563" },
  { name: "surface-variant", hex: "#2e2e2e" },
  { name: "on-surface", hex: "#e5e7eb" },
];

const RADIUS_PRESETS = [
  { key: "none", label: "none", cssRadius: "0px" },
  { key: "DEFAULT", label: "DEFAULT", cssRadius: "4px" },
  { key: "lg", label: "lg", cssRadius: "8px" },
  { key: "xl", label: "xl", cssRadius: "12px" },
  { key: "full", label: "full", cssRadius: "9999px" },
];

const SPACING_SCALE = [
  { key: "xs", bars: 1 }, { key: "sm", bars: 2 }, { key: "md", bars: 3 },
  { key: "lg", bars: 4 }, { key: "xl", bars: 5 },
];

const TYPOGRAPHY_ROWS = [
  { key: "headline-sm", label: "headline-sm", font: "Inter, 18px", size: 18, weight: 600, lineHeight: 1.3, mono: false, upper: false, preview: "The quick brown fox" },
  { key: "body-md", label: "body-md", font: "Inter, 13px", size: 13, weight: 400, lineHeight: 1.5, mono: false, upper: false, preview: "The quick brown fox jumps over" },
  { key: "body-sm", label: "body-sm", font: "Inter, 12px", size: 12, weight: 400, lineHeight: 1.5, mono: false, upper: false, preview: "The quick brown fox jumps over the lazy dog" },
  { key: "label-md", label: "label-md", font: "Inter, 11px, 500", size: 11, weight: 500, lineHeight: 1.4, mono: false, upper: true, preview: "THE QUICK BROWN FOX" },
  { key: "code-sm", label: "code-sm", font: "JB Mono, 12px", size: 12, weight: 400, lineHeight: 1.6, mono: true, upper: false, preview: 'const fox = "jumps";' },
];

const card = { background: "var(--st-surface)", boxShadow: "inset 0 0 0 1px var(--st-border)" } as const;
const sectionHd = { color: "var(--st-text-2)" } as const;

function SectionHead({ icon, label, right }: { icon: React.ReactNode; label: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em]" style={sectionHd}>{label}</span>
      </div>
      {right}
    </div>
  );
}

function ColorPalette({ colors, selected, onSelect, onAdd }: {
  colors: ColorToken[]; selected: string | null;
  onSelect: (n: string) => void; onAdd: () => void;
}) {
  return (
    <div className="rounded-[var(--st-r-lg)] p-4" style={card}>
      <SectionHead
        icon={<Circle size={13} style={{ color: "var(--st-brand)" }} />}
        label="Color Palette"
        right={<IconBtn onClick={onAdd} title="Add color token"><Plus size={14} /></IconBtn>}
      />
      <div className="grid grid-cols-4 gap-2">
        {colors.map((t) => (
          <button key={t.name} type="button" onClick={() => onSelect(t.name)} className="flex flex-col items-center gap-1">
            <div className="w-full rounded-[var(--st-r-md)] transition-all" style={{
              height: 48, background: t.hex,
              boxShadow: selected === t.name ? "0 0 0 2px var(--st-bg), 0 0 0 4px #fff" : "inset 0 0 0 1px rgba(255,255,255,0.08)",
            }} />
            <span className="truncate w-full text-center" style={{ fontSize: 9.5, color: "var(--st-text-3)" }}>{t.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TypographyScale() {
  return (
    <div className="rounded-[var(--st-r-lg)] p-4" style={card}>
      <SectionHead icon={<Type size={13} style={{ color: "var(--st-brand)" }} />} label="Typography Scale" />
      <div className="flex flex-col gap-3">
        {TYPOGRAPHY_ROWS.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-3">
            <div className="shrink-0 min-w-[120px]">
              <div className="text-[11px] font-medium" style={{ color: "var(--st-text)" }}>{row.label}</div>
              <div style={{ fontSize: 9.5, color: "var(--st-text-3)", fontFamily: row.mono ? "var(--st-mono)" : undefined }}>{row.font}</div>
            </div>
            <div className="flex-1 truncate text-right" style={{
              fontSize: Math.min(row.size, 14), fontWeight: row.weight, lineHeight: row.lineHeight,
              fontFamily: row.mono ? "var(--st-mono)" : "Inter, sans-serif",
              textTransform: row.upper ? "uppercase" : undefined,
              color: "var(--st-text)", letterSpacing: row.upper ? "0.05em" : undefined,
            }}>
              {row.preview}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BorderRadiusSection({ selected, onSelect }: { selected: string; onSelect: (k: string) => void }) {
  return (
    <div className="rounded-[var(--st-r-lg)] p-4" style={card}>
      <SectionHead
        icon={<div style={{ width: 13, height: 13, borderRadius: 4, border: "1.5px solid var(--st-brand)" }} />}
        label="Border Radius"
      />
      <div className="flex items-end gap-3">
        {RADIUS_PRESETS.map((p) => (
          <button key={p.key} type="button" onClick={() => onSelect(p.key)} className="flex flex-col items-center gap-1.5 flex-1">
            <div style={{
              width: 36, height: 36,
              borderRadius: p.key === "full" ? "50%" : p.cssRadius,
              background: "var(--st-elevated)",
              boxShadow: selected === p.key ? "0 0 0 2px var(--st-bg), 0 0 0 4px var(--st-brand)" : "inset 0 0 0 1px var(--st-border-2)",
            }} />
            <span style={{ fontSize: 9, color: "var(--st-text-3)" }}>{p.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SpacingUnit() {
  return (
    <div className="rounded-[var(--st-r-lg)] p-4" style={card}>
      <SectionHead
        icon={<ArrowLeftRight size={13} style={{ color: "var(--st-brand)" }} />}
        label="Spacing Unit"
        right={<Pill>Base: 4px</Pill>}
      />
      <div className="flex flex-col gap-2">
        {SPACING_SCALE.map((s) => (
          <div key={s.key} className="flex items-center gap-3">
            <span className="w-6 text-[10px]" style={{ color: "var(--st-text-3)" }}>{s.key}</span>
            <div className="rounded-full" style={{ height: 4, width: s.bars * 20, background: "var(--st-brand)", opacity: 0.4 + s.bars * 0.12 }} />
            <span style={{ fontSize: 9.5, color: "var(--st-text-3)" }}>{s.bars * 4}px</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LivePreview() {
  return (
    <div className="rounded-[var(--st-r-lg)] p-4" style={card}>
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full inline-block" style={{ background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em]" style={sectionHd}>Live Preview</span>
      </div>
      <div className="rounded-[var(--st-r-md)] p-3" style={{ background: "var(--st-elevated)", boxShadow: "inset 0 0 0 1px var(--st-border)" }}>
        <div className="mb-1 font-semibold" style={{ fontSize: 14, color: "var(--st-text)" }}>Project Alpha</div>
        <div className="mb-2" style={{ fontSize: 11, color: "var(--st-brand)" }}>Active Connection</div>
        <p className="mb-3 leading-relaxed" style={{ fontSize: 11, color: "var(--st-text-3)" }}>
          Token values applied live across surfaces, typography, and spacing.
        </p>
        <div className="flex gap-2">
          <Btn variant="primary" size="sm">Deploy</Btn>
          <Btn variant="outline" size="sm">Edit</Btn>
        </div>
      </div>
    </div>
  );
}

function TokenInspector({ token, onUpdate, onNameChange }: {
  token: ColorToken | null;
  onUpdate: (name: string, hex: string) => void;
  onNameChange: (oldName: string, newName: string) => void;
}) {
  const [advOpen, setAdvOpen] = useState(false);
  const [refEnabled, setRefEnabled] = useState(false);

  if (!token) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="text-center" style={{ fontSize: 12, color: "var(--st-text-3)" }}>Select a token to configure</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3.5">
      <Field label="Token Name" htmlFor="token-name">
        <TextField id="token-name" value={token.name} onChange={(e) => onNameChange(token.name, e.target.value)} />
      </Field>
      <Field label="Hex Value" htmlFor="token-hex">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 shrink-0 rounded-[var(--st-r-sm)]" style={{ background: token.hex, boxShadow: "inset 0 0 0 1px var(--st-border-2)" }} />
          <TextField id="token-hex" value={token.hex} mono maxLength={7} onChange={(e) => onUpdate(token.name, e.target.value)} />
        </div>
      </Field>
      <div className="rounded-[var(--st-r-md)] overflow-hidden mt-1" style={{ boxShadow: "inset 0 0 0 1px var(--st-border)" }}>
        <button type="button" onClick={() => setAdvOpen((o) => !o)} className="flex w-full items-center gap-1.5 px-3 py-2 text-left hover:bg-white/[0.02]">
          <ChevronDown size={12} className="transition-transform duration-200" style={{ color: "var(--st-text-3)", transform: advOpen ? "none" : "rotate(-90deg)" }} />
          <span className="text-[10px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--st-text-3)" }}>Advanced Mapping</span>
        </button>
        {advOpen && (
          <div className="px-3 pb-3 pt-1 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px]" style={{ color: "var(--st-text-2)" }}>Reference</span>
              <Toggle checked={refEnabled} onChange={setRefEnabled} label="Reference" />
            </div>
            {refEnabled && (
              <Field label="Alias Target">
                <select className="w-full rounded-[var(--st-r-md)] px-2.5 py-1.5 text-[12px] outline-none appearance-none" style={{ background: "var(--st-bg)", color: "var(--st-text)", boxShadow: "inset 0 0 0 1px var(--st-border-2)" }}>
                  <option value="">— none —</option>
                  <option value="primary">primary</option>
                  <option value="surface">surface</option>
                  <option value="background">background</option>
                </select>
              </Field>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────

export function ThemeDesigner() {
  const { schema, updateTheme } = useRuntimeStore();
  const [viewport, setViewport] = useState<Viewport>("Desktop");
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [selectedRadius, setSelectedRadius] = useState("xl");

  const rawColors = schema.theme?.colors ?? {};
  const colorTokens: ColorToken[] = Object.keys(rawColors).length > 0
    ? Object.entries(rawColors).map(([name, hex]) => ({ name, hex }))
    : DEFAULT_COLORS;

  function handleUpdateColor(name: string, hex: string) {
    updateTheme({ colors: { ...rawColors, [name]: hex } });
  }
  function handleRenameColor(oldName: string, newName: string) {
    if (!newName || newName === oldName) return;
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawColors)) next[k === oldName ? newName : k] = v;
    updateTheme({ colors: next });
    setSelectedToken(newName);
  }
  function handleAddColor() {
    updateTheme({ colors: { ...rawColors, [`token-${Object.keys(rawColors).length + 1}`]: "#888888" } });
  }
  function handleRevert() {
    const seed: Record<string, string> = {};
    DEFAULT_COLORS.forEach((c) => { seed[c.name] = c.hex; });
    updateTheme({ colors: seed });
    setSelectedToken(null);
  }
  function handleExport() {
    const blob = new Blob([JSON.stringify(schema.theme, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "theme-tokens.json"; a.click();
    URL.revokeObjectURL(url);
  }

  const activeToken = selectedToken ? (colorTokens.find((t) => t.name === selectedToken) ?? null) : null;

  return (
    <div className="flex h-full flex-col" style={{ background: "var(--st-bg)", color: "var(--st-text)" }}>
      {/* Top bar */}
      <div className="flex h-11 shrink-0 items-center justify-between gap-4 border-b px-4" style={{ borderColor: "var(--st-border)", background: "var(--st-surface)" }}>
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--st-text-2)" }}>Theme Tokens</span>
        <div className="w-56 shrink-0">
          <Segmented<Viewport>
            options={[{ value: "Desktop", label: "Desktop" }, { value: "Tablet", label: "Tablet" }, { value: "Mobile", label: "Mobile" }]}
            value={viewport} onChange={setViewport} size="sm"
          />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Btn variant="outline" size="sm" onClick={handleExport}><Download size={12} />Export</Btn>
          <Btn variant="ghost" size="sm" onClick={handleRevert}><Undo2 size={12} />Revert</Btn>
        </div>
      </div>

      {/* Main area */}
      <div className="flex min-h-0 flex-1">
        {/* Left content (scrollable) */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex max-w-2xl flex-col gap-4">
            <ColorPalette colors={colorTokens} selected={selectedToken} onSelect={setSelectedToken} onAdd={handleAddColor} />
            <TypographyScale />
            <BorderRadiusSection selected={selectedRadius} onSelect={setSelectedRadius} />
            <SpacingUnit />
            <LivePreview />
          </div>
        </div>

        {/* Right inspector */}
        <aside className="flex w-72 shrink-0 flex-col border-l" style={{ borderColor: "var(--st-border)", background: "var(--st-surface)" }}>
          <div className="flex h-11 shrink-0 items-center border-b px-3.5" style={{ borderColor: "var(--st-border)" }}>
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--st-text-2)" }}>
              {activeToken ? "Token Settings" : "Inspector"}
            </span>
          </div>
          <TokenInspector token={activeToken} onUpdate={handleUpdateColor} onNameChange={handleRenameColor} />
        </aside>
      </div>
    </div>
  );
}
