"use client";

// ═══════════════════════════════════════════════════════════════
// State Manager — the flagship studio editor. A visual graph of the
// app's reactive state: plain nodes grouped by scope, derived nodes
// (computed formulas) and async nodes (data sources) wired to their
// dependencies. Every backend capability of StateNodeSchema —
// derived / async / validation / persist — has a first-class control
// here (PRODUCT.md: "Expose the full schema, not a subset").
//
// Binds directly to useRuntimeStore.{globalState, add/update/remove}.
// ═══════════════════════════════════════════════════════════════

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { v4 as uuid } from "uuid";
import {
  Plus,
  Variable,
  FunctionSquare,
  RefreshCw,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize,
  PanelRight,
  GitBranch,
  ListTree,
  Network,
  AlertCircle,
} from "lucide-react";
import { useRuntimeStore } from "@/lib/runtime/runtime-store";
import type { StateNodeSchema, StateScope, StateType, ValidationRule } from "@/lib/runtime/schema";
import {
  Inspector,
  Section,
  Field,
  TextField,
  SelectField,
  Segmented,
  ToggleRow,
  Btn,
  IconBtn,
  EmptyState,
} from "./primitives";

// ── Domain helpers ───────────────────────────────────────────────

type Kind = "plain" | "derived" | "async";
type XY = { x: number; y: number };

function kindOf(n: StateNodeSchema): Kind {
  if (n.derived != null) return "derived";
  if (n.async != null) return "async";
  return "plain";
}

const SCOPES: { value: StateScope; label: string; color: string }[] = [
  { value: "global", label: "Global", color: "var(--st-success)" },
  { value: "local", label: "Local", color: "var(--st-info)" },
  { value: "session", label: "Session", color: "var(--st-warning)" },
  { value: "persisted", label: "Persisted", color: "var(--st-brand)" },
];

const KIND_META: Record<Kind, { label: string; color: string; icon: React.ReactNode }> = {
  plain: { label: "State", color: "var(--st-text-2)", icon: <Variable size={12} /> },
  derived: { label: "Derived", color: "var(--st-brand)", icon: <FunctionSquare size={12} /> },
  async: { label: "Async", color: "var(--st-info)", icon: <RefreshCw size={12} /> },
};

const STATE_TYPES: StateType[] = ["string", "number", "boolean", "object", "array", "any"];

function scopeColor(scope: StateScope) {
  return SCOPES.find((s) => s.value === scope)?.color ?? "var(--st-text-2)";
}

function valuePreview(n: StateNodeSchema): string {
  const k = kindOf(n);
  if (k === "derived") return n.derived || "—";
  if (k === "async") return n.async?.source ? `← ${n.async.source}` : "Promise";
  const v = n.defaultValue;
  if (v === undefined || v === null) return n.type ?? "any";
  if (Array.isArray(v)) return `Array(${v.length})`;
  if (typeof v === "object") {
    const keys = Object.keys(v as object);
    return `Object {${keys.slice(0, 3).join(", ")}${keys.length > 3 ? ", …" : ""}}`;
  }
  if (typeof v === "string") return `"${v}"`;
  return String(v);
}

// Detect which other state nodes an expression references by name. The name
// may stand alone (`currentUser`) or be reached through a namespace
// (`$global.currentUser`), so a preceding `.` is allowed but adjacent word
// characters are not (avoids matching `currentUserId`).
function referencedNames(expr: string | undefined, names: string[]): string[] {
  if (!expr) return [];
  const hits = new Set<string>();
  for (const name of names) {
    if (!name) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?<![\\w$])${escaped}(?![\\w])`);
    if (re.test(expr)) hits.add(name);
  }
  return [...hits];
}

function dependenciesOf(n: StateNodeSchema, all: StateNodeSchema[]): StateNodeSchema[] {
  const others = all.filter((o) => o.id !== n.id);
  const names = others.map((o) => o.name).filter(Boolean);
  const sources: string[] = [];
  if (n.derived) sources.push(n.derived);
  if (n.async) {
    if (n.async.source) sources.push(n.async.source);
    if (n.async.params) sources.push(...Object.values(n.async.params));
  }
  const refNames = new Set(sources.flatMap((s) => referencedNames(s, names)));
  return others.filter((o) => refNames.has(o.name));
}

// ── Auto layout ──────────────────────────────────────────────────

const NODE_W = 176;
const NODE_H = 58;
const GROUP_PAD = 18;
const GROUP_HEADER = 26;

function autoLayout(nodes: StateNodeSchema[]): Record<string, XY> {
  const pos: Record<string, XY> = {};
  let groupY = 48;
  for (const s of SCOPES) {
    const members = nodes.filter((n) => kindOf(n) === "plain" && n.scope === s.value);
    if (!members.length) continue;
    members.forEach((n, i) => {
      pos[n.id] = { x: 56 + GROUP_PAD, y: groupY + GROUP_HEADER + i * (NODE_H + 16) };
    });
    groupY += GROUP_HEADER + members.length * (NODE_H + 16) + 46;
  }
  const computed = nodes.filter((n) => kindOf(n) !== "plain");
  computed.forEach((n, i) => {
    pos[n.id] = { x: 460, y: 80 + i * (NODE_H + 30) };
  });
  return pos;
}

// ═══════════════════════════════════════════════════════════════

export function StateManager() {
  const nodes = useRuntimeStore((s) => s.schema.globalState);
  const addGlobalState = useRuntimeStore((s) => s.addGlobalState);
  const updateGlobalState = useRuntimeStore((s) => s.updateGlobalState);
  const removeGlobalState = useRuntimeStore((s) => s.removeGlobalState);

  const [view, setView] = useState<"visual" | "list">("visual");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showInspector, setShowInspector] = useState(true);
  const [pan, setPan] = useState<XY>({ x: 16, y: 8 });
  const [zoom, setZoom] = useState(1);

  // User-dragged positions live in a ref (an external store, effectively);
  // the rendered positions are derived by overlaying them on auto-layout.
  // A version counter forces re-derivation after a drag without a layout effect.
  const overrides = useRef<Record<string, XY>>({});
  const [posVersion, setPosVersion] = useState(0);
  const positions = useMemo(() => {
    const auto = autoLayout(nodes);
    const out: Record<string, XY> = {};
    for (const n of nodes) out[n.id] = overrides.current[n.id] ?? auto[n.id];
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, posVersion]);

  const selected = nodes.find((n) => n.id === selectedId) ?? null;

  const uniqueName = useCallback(
    (base: string) => {
      const existing = new Set(nodes.map((n) => n.name));
      let i = 1;
      let name = `${base}${i}`;
      while (existing.has(name)) name = `${base}${++i}`;
      return name;
    },
    [nodes]
  );

  const addNode = useCallback(
    (kind: Kind = "plain") => {
      const id = uuid();
      const node: StateNodeSchema = {
        id,
        name: uniqueName(kind === "derived" ? "computed" : kind === "async" ? "data" : "state"),
        scope: "global",
        type: kind === "async" ? "object" : "string",
        defaultValue: kind === "plain" ? "" : null,
        ...(kind === "derived" ? { derived: "" } : {}),
        ...(kind === "async" ? { async: { source: "", autoFetch: true } } : {}),
      };
      addGlobalState(node);
      setSelectedId(id);
      setShowInspector(true);
    },
    [addGlobalState, uniqueName]
  );

  const update = useCallback(
    (id: string, updates: Partial<StateNodeSchema>) => updateGlobalState(id, updates),
    [updateGlobalState]
  );

  // ── graph interaction ──────────────────────────────────────────
  const dragRef = useRef<{ id: string | null; startX: number; startY: number; origin: XY } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; origin: XY } | null>(null);

  const onNodePointerDown = (e: ReactPointerEvent, id: string) => {
    e.stopPropagation();
    setSelectedId(id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      origin: positions[id] ?? { x: 0, y: 0 },
    };
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (dragRef.current?.id) {
      const d = dragRef.current;
      const nx = d.origin.x + (e.clientX - d.startX) / zoom;
      const ny = d.origin.y + (e.clientY - d.startY) / zoom;
      overrides.current[d.id as string] = { x: nx, y: ny };
      setPosVersion((v) => v + 1);
    } else if (panRef.current) {
      const p = panRef.current;
      setPan({ x: p.origin.x + (e.clientX - p.startX), y: p.origin.y + (e.clientY - p.startY) });
    }
  };

  const onPointerUp = () => {
    dragRef.current = null;
    panRef.current = null;
  };

  const onCanvasPointerDown = (e: ReactPointerEvent) => {
    setSelectedId(null);
    panRef.current = { startX: e.clientX, startY: e.clientY, origin: pan };
  };

  const fit = () => {
    setZoom(1);
    setPan({ x: 16, y: 8 });
  };

  // ── edges ───────────────────────────────────────────────────────
  const edges = useMemo(() => {
    const list: { from: string; to: string }[] = [];
    for (const n of nodes) {
      if (kindOf(n) === "plain") continue;
      for (const dep of dependenciesOf(n, nodes)) list.push({ from: dep.id, to: n.id });
    }
    return list;
  }, [nodes]);

  // ── group frames (scope clusters of plain nodes) ────────────────
  const groupFrames = useMemo(() => {
    const frames: { scope: StateScope; label: string; color: string; x: number; y: number; w: number; h: number }[] = [];
    for (const s of SCOPES) {
      const members = nodes.filter((n) => kindOf(n) === "plain" && n.scope === s.value);
      if (!members.length) continue;
      const pts = members.map((m) => positions[m.id]).filter(Boolean) as XY[];
      if (pts.length < members.length) continue;
      const minX = Math.min(...pts.map((p) => p.x));
      const minY = Math.min(...pts.map((p) => p.y));
      const maxX = Math.max(...pts.map((p) => p.x + NODE_W));
      const maxY = Math.max(...pts.map((p) => p.y + NODE_H));
      frames.push({
        scope: s.value,
        label: s.label,
        color: s.color,
        x: minX - GROUP_PAD,
        y: minY - GROUP_HEADER,
        w: maxX - minX + GROUP_PAD * 2,
        h: maxY - minY + GROUP_HEADER + GROUP_PAD,
      });
    }
    return frames;
  }, [nodes, positions]);

  const hasNodes = nodes.length > 0;

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* ── toolbar ─────────────────────────────────────────── */}
        <div
          className="flex h-11 shrink-0 items-center gap-2 border-b px-3"
          style={{ borderColor: "var(--st-border)", background: "var(--st-surface)" }}
        >
          <div className="w-[150px]">
            <Segmented
              size="sm"
              value={view}
              onChange={setView}
              options={[
                { value: "visual", label: <span className="flex items-center justify-center gap-1"><Network size={12} /> Visual</span> },
                { value: "list", label: <span className="flex items-center justify-center gap-1"><ListTree size={12} /> List</span> },
              ]}
            />
          </div>

          {view === "visual" && (
            <div className="flex items-center gap-0.5">
              <IconBtn onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))} title="Zoom out">
                <ZoomOut size={15} />
              </IconBtn>
              <span className="w-10 text-center text-[11px] tabular-nums" style={{ color: "var(--st-text-3)" }}>
                {Math.round(zoom * 100)}%
              </span>
              <IconBtn onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))} title="Zoom in">
                <ZoomIn size={15} />
              </IconBtn>
              <IconBtn onClick={fit} title="Reset view">
                <Maximize size={14} />
              </IconBtn>
            </div>
          )}

          <div className="ml-auto flex items-center gap-1.5">
            <Btn variant="outline" size="sm" onClick={() => addNode("derived")} title="Add derived node">
              <FunctionSquare size={13} /> Derived
            </Btn>
            <Btn variant="outline" size="sm" onClick={() => addNode("async")} title="Add async node">
              <RefreshCw size={13} /> Async
            </Btn>
            <Btn variant="primary" size="sm" onClick={() => addNode("plain")}>
              <Plus size={13} /> Add Node
            </Btn>
            <IconBtn active={showInspector} onClick={() => setShowInspector((v) => !v)} title="Toggle inspector">
              <PanelRight size={15} />
            </IconBtn>
          </div>
        </div>

        {/* ── body ────────────────────────────────────────────── */}
        {!hasNodes ? (
          <EmptyState
            icon={<Variable size={22} />}
            title="No state yet"
            description="State nodes hold the reactive data your app reads and writes. Add a plain value, a derived formula computed from other state, or an async source that fetches and caches."
            action={
              <div className="flex gap-2">
                <Btn variant="primary" size="md" onClick={() => addNode("plain")}>
                  <Plus size={14} /> Create state node
                </Btn>
                <Btn variant="outline" size="md" onClick={() => addNode("derived")}>
                  <FunctionSquare size={14} /> Derived
                </Btn>
              </div>
            }
          />
        ) : view === "list" ? (
          <ListView
            nodes={nodes}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              setShowInspector(true);
            }}
            onRemove={removeGlobalState}
          />
        ) : (
          <div
            className="relative min-h-0 flex-1 cursor-grab overflow-hidden active:cursor-grabbing"
            onPointerDown={onCanvasPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            style={{
              backgroundImage: "radial-gradient(var(--st-grid-dot) 1px, transparent 1px)",
              backgroundSize: `${22 * zoom}px ${22 * zoom}px`,
              backgroundPosition: `${pan.x}px ${pan.y}px`,
            }}
          >
            <div
              className="absolute left-0 top-0 origin-top-left"
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
            >
              {/* group frames */}
              {groupFrames.map((f) => (
                <div
                  key={f.scope}
                  className="absolute rounded-[var(--st-r-lg)]"
                  style={{
                    left: f.x,
                    top: f.y,
                    width: f.w,
                    height: f.h,
                    border: `1px solid ${f.color}`,
                    background: "color-mix(in oklab, var(--st-surface) 55%, transparent)",
                    opacity: 0.9,
                  }}
                >
                  <span
                    className="absolute left-2 top-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ color: f.color }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: f.color }} />
                    {f.label}
                  </span>
                </div>
              ))}

              {/* edges */}
              <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={1} height={1}>
                {edges.map((e, i) => {
                  const a = positions[e.from];
                  const b = positions[e.to];
                  if (!a || !b) return null;
                  const x1 = a.x + NODE_W;
                  const y1 = a.y + NODE_H / 2;
                  const x2 = b.x;
                  const y2 = b.y + NODE_H / 2;
                  const dx = Math.max(40, Math.abs(x2 - x1) * 0.5);
                  const path = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
                  const active = selectedId === e.from || selectedId === e.to;
                  return (
                    <path
                      key={i}
                      d={path}
                      fill="none"
                      stroke={active ? "var(--st-brand)" : "var(--st-border-3)"}
                      strokeWidth={active ? 2 : 1.5}
                      strokeDasharray="4 4"
                    />
                  );
                })}
              </svg>

              {/* nodes */}
              {nodes.map((n) => {
                const p = positions[n.id];
                if (!p) return null;
                return (
                  <GraphNode
                    key={n.id}
                    node={n}
                    pos={p}
                    selected={selectedId === n.id}
                    onPointerDown={(e) => onNodePointerDown(e, n.id)}
                  />
                );
              })}
            </div>

            {/* engine status chip */}
            <div
              className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5 rounded-[var(--st-r-full)] px-2.5 py-1 text-[10.5px] font-medium"
              style={{ background: "var(--st-surface)", color: "var(--st-text-2)", boxShadow: "var(--st-shadow-raised)" }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--st-success)", animation: "st-pulse 2s infinite" }} />
              Reactive engine active
            </div>
          </div>
        )}
      </div>

      {/* ── inspector ─────────────────────────────────────────── */}
      {showInspector && (
        <NodeInspector
          node={selected}
          allNodes={nodes}
          onUpdate={update}
          onRemove={(id) => {
            removeGlobalState(id);
            setSelectedId(null);
          }}
        />
      )}
    </div>
  );
}

// ── Graph node card ──────────────────────────────────────────────

function GraphNode({
  node,
  pos,
  selected,
  onPointerDown,
}: {
  node: StateNodeSchema;
  pos: XY;
  selected: boolean;
  onPointerDown: (e: ReactPointerEvent) => void;
}) {
  const k = kindOf(node);
  const meta = KIND_META[k];
  const accent = k === "plain" ? scopeColor(node.scope) : meta.color;
  return (
    <div
      onPointerDown={onPointerDown}
      className="absolute cursor-grab touch-none select-none rounded-[var(--st-r-lg)] active:cursor-grabbing"
      style={{
        left: pos.x,
        top: pos.y,
        width: NODE_W,
        background: "var(--st-elevated)",
        boxShadow: selected ? `0 0 0 1.5px ${accent}, var(--st-shadow-floating)` : "var(--st-shadow-raised)",
        border: selected ? "none" : "1px solid var(--st-border-2)",
      }}
    >
      {/* ports */}
      <span
        className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full"
        style={{ background: "var(--st-elevated)", border: `1.5px solid ${accent}` }}
      />
      <span
        className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full"
        style={{ background: "var(--st-elevated)", border: `1.5px solid ${accent}` }}
      />
      <div className="flex items-center gap-1.5 px-2.5 pb-1 pt-2">
        <span style={{ color: accent }}>{meta.icon}</span>
        <span className="text-[9.5px] font-semibold uppercase tracking-wide" style={{ color: accent }}>
          {meta.label}
        </span>
        {k === "plain" && (
          <span className="ml-auto text-[9px] font-medium uppercase" style={{ color: "var(--st-text-3)" }}>
            {node.scope}
          </span>
        )}
      </div>
      <div className="px-2.5 pb-2">
        <div className="truncate text-[12.5px] font-semibold" style={{ color: "var(--st-text)" }}>
          {node.name || <span style={{ color: "var(--st-text-3)" }}>unnamed</span>}
        </div>
        <div className="truncate font-[family-name:var(--st-mono)] text-[10.5px]" style={{ color: "var(--st-text-3)" }}>
          {valuePreview(node)}
        </div>
      </div>
    </div>
  );
}

// ── List view ────────────────────────────────────────────────────

function ListView({
  nodes,
  selectedId,
  onSelect,
  onRemove,
}: {
  nodes: StateNodeSchema[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr
            className="sticky top-0 z-10 text-left"
            style={{ background: "var(--st-surface)", color: "var(--st-text-3)" }}
          >
            {["Name", "Kind", "Scope", "Type", "Value / Source", "Deps", ""].map((h) => (
              <th
                key={h}
                className="border-b px-3 py-2 text-[10px] font-semibold uppercase tracking-wide"
                style={{ borderColor: "var(--st-border)" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {nodes.map((n) => {
            const k = kindOf(n);
            const deps = dependenciesOf(n, nodes).length;
            const active = selectedId === n.id;
            return (
              <tr
                key={n.id}
                onClick={() => onSelect(n.id)}
                className="cursor-pointer transition-colors"
                style={{ background: active ? "var(--st-brand-tint)" : "transparent" }}
              >
                <td className="border-b px-3 py-2 font-medium" style={{ borderColor: "var(--st-border)", color: "var(--st-text)" }}>
                  {n.name}
                </td>
                <td className="border-b px-3 py-2" style={{ borderColor: "var(--st-border)" }}>
                  <span style={{ color: KIND_META[k].color }} className="inline-flex items-center gap-1 text-[11px] font-medium">
                    {KIND_META[k].icon} {KIND_META[k].label}
                  </span>
                </td>
                <td className="border-b px-3 py-2" style={{ borderColor: "var(--st-border)" }}>
                  <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: "var(--st-text-2)" }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: scopeColor(n.scope) }} />
                    {n.scope}
                  </span>
                </td>
                <td className="border-b px-3 py-2 font-[family-name:var(--st-mono)] text-[11px]" style={{ borderColor: "var(--st-border)", color: "var(--st-text-3)" }}>
                  {n.type ?? "any"}
                </td>
                <td className="max-w-[280px] truncate border-b px-3 py-2 font-[family-name:var(--st-mono)] text-[11px]" style={{ borderColor: "var(--st-border)", color: "var(--st-text-2)" }}>
                  {valuePreview(n)}
                </td>
                <td className="border-b px-3 py-2 tabular-nums" style={{ borderColor: "var(--st-border)", color: "var(--st-text-3)" }}>
                  {deps || "—"}
                </td>
                <td className="border-b px-3 py-2 text-right" style={{ borderColor: "var(--st-border)" }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(n.id);
                    }}
                    className="text-[var(--st-text-3)] transition-colors hover:text-[var(--st-error)]"
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Inspector ────────────────────────────────────────────────────

function NodeInspector({
  node,
  allNodes,
  onUpdate,
  onRemove,
}: {
  node: StateNodeSchema | null;
  allNodes: StateNodeSchema[];
  onUpdate: (id: string, updates: Partial<StateNodeSchema>) => void;
  onRemove: (id: string) => void;
}) {
  if (!node) {
    return (
      <Inspector title="Node Config">
        <div className="grid h-full place-items-center p-6 text-center">
          <p className="text-[12px] leading-relaxed" style={{ color: "var(--st-text-3)" }}>
            Select a node to edit its identity, formula, validation, and persistence.
          </p>
        </div>
      </Inspector>
    );
  }

  const k = kindOf(node);
  const deps = dependenciesOf(node, allNodes);

  const setKind = (next: Kind) => {
    if (next === k) return;
    if (next === "derived") onUpdate(node.id, { derived: node.derived ?? "", async: undefined });
    else if (next === "async") onUpdate(node.id, { async: node.async ?? { source: "", autoFetch: true }, derived: undefined });
    else onUpdate(node.id, { derived: undefined, async: undefined });
  };

  return (
    <Inspector title="Node Config">
      {/* Identity */}
      <Section title="Identity">
        <Field label="Node name" htmlFor="node-name">
          <TextField
            id="node-name"
            mono
            value={node.name}
            onChange={(e) => onUpdate(node.id, { name: e.target.value })}
            placeholder="myState"
          />
        </Field>
        <Field label="Kind" hint="how the value is produced">
          <Segmented<Kind>
            value={k}
            onChange={setKind}
            options={[
              { value: "plain", label: "State" },
              { value: "derived", label: "Derived" },
              { value: "async", label: "Async" },
            ]}
          />
        </Field>
        <Field label="Scope" htmlFor="node-scope">
          <SelectField id="node-scope" value={node.scope} onChange={(e) => onUpdate(node.id, { scope: e.target.value as StateScope })}>
            {SCOPES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </SelectField>
        </Field>
        <Field label="Output type" htmlFor="node-type">
          <SelectField id="node-type" value={node.type ?? "any"} onChange={(e) => onUpdate(node.id, { type: e.target.value as StateType })}>
            {STATE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </SelectField>
        </Field>
        {k === "plain" && <DefaultValueField key={node.id} node={node} onUpdate={onUpdate} />}
      </Section>

      {/* Formula (derived) */}
      {k === "derived" && (
        <FormulaSection key={node.id} node={node} deps={deps} onUpdate={onUpdate} />
      )}

      {/* Async config */}
      {k === "async" && <AsyncSection node={node} onUpdate={onUpdate} />}

      {/* Dependencies */}
      {k !== "plain" && (
        <Section title="Dependencies" badge={deps.length}>
          {deps.length === 0 ? (
            <p className="text-[11px]" style={{ color: "var(--st-text-3)" }}>
              Reference another node by name in the {k === "derived" ? "formula" : "source / params"} and it appears here automatically.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {deps.map((d) => (
                <span
                  key={d.id}
                  className="inline-flex items-center gap-1.5 rounded-[var(--st-r-md)] px-2 py-1 font-[family-name:var(--st-mono)] text-[11px]"
                  style={{ background: "var(--st-bg)", color: "var(--st-text-2)", boxShadow: "inset 0 0 0 1px var(--st-border)" }}
                >
                  <GitBranch size={11} style={{ color: scopeColor(d.scope) }} />
                  {d.name}
                </span>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Validation */}
      <ValidationSection node={node} onUpdate={onUpdate} />

      {/* Advanced / persistence */}
      <AdvancedSection node={node} onUpdate={onUpdate} />

      {/* Danger */}
      <div className="p-3.5">
        <Btn variant="danger" size="sm" className="w-full justify-center hover:bg-[color-mix(in_oklab,var(--st-error)_14%,transparent)]" onClick={() => onRemove(node.id)}>
          <Trash2 size={13} /> Delete node
        </Btn>
      </div>
    </Inspector>
  );
}

function DefaultValueField({ node, onUpdate }: { node: StateNodeSchema; onUpdate: (id: string, u: Partial<StateNodeSchema>) => void }) {
  // Keyed by node.id at the call site, so the lazy initializer reruns per node.
  const [raw, setRaw] = useState(() =>
    node.defaultValue === undefined || node.defaultValue === null
      ? ""
      : typeof node.defaultValue === "object"
        ? JSON.stringify(node.defaultValue)
        : String(node.defaultValue)
  );

  const commit = () => {
    let parsed: unknown = raw;
    if (node.type === "number") parsed = raw === "" ? 0 : Number(raw);
    else if (node.type === "boolean") parsed = raw === "true";
    else if (node.type === "object" || node.type === "array") {
      try {
        parsed = JSON.parse(raw || (node.type === "array" ? "[]" : "{}"));
      } catch {
        parsed = raw;
      }
    }
    onUpdate(node.id, { defaultValue: parsed });
  };

  return (
    <Field label="Default value" hint={node.type}>
      <TextField mono value={raw} onChange={(e) => setRaw(e.target.value)} onBlur={commit} placeholder={node.type === "object" ? '{ "key": "value" }' : "initial value"} />
    </Field>
  );
}

function FormulaSection({
  node,
  deps,
  onUpdate,
}: {
  node: StateNodeSchema;
  deps: StateNodeSchema[];
  onUpdate: (id: string, u: Partial<StateNodeSchema>) => void;
}) {
  const [validation, setValidation] = useState<null | { ok: boolean; msg: string }>(null);
  const expr = node.derived ?? "";

  const validate = () => {
    if (!expr.trim()) return setValidation({ ok: false, msg: "Formula is empty" });
    const balanced = (expr.match(/\(/g)?.length ?? 0) === (expr.match(/\)/g)?.length ?? 0);
    if (!balanced) return setValidation({ ok: false, msg: "Unbalanced parentheses" });
    setValidation({ ok: true, msg: `Valid · ${deps.length} dependenc${deps.length === 1 ? "y" : "ies"}` });
  };

  return (
    <Section title="Formula">
      <div
        className="mb-2 flex items-center gap-1.5 rounded-t-[var(--st-r-md)] px-2.5 py-1.5 font-[family-name:var(--st-mono)] text-[10.5px]"
        style={{ background: "var(--st-bg)", color: "var(--st-brand)", boxShadow: "inset 0 0 0 1px var(--st-border)" }}
      >
        <FunctionSquare size={12} /> f(x)
      </div>
      <textarea
        value={expr}
        onChange={(e) => {
          onUpdate(node.id, { derived: e.target.value });
          setValidation(null);
        }}
        rows={4}
        spellCheck={false}
        placeholder="$global.currentUser !== null && $global.currentUser.status === 'active'"
        className="-mt-2 w-full resize-y rounded-b-[var(--st-r-md)] px-2.5 py-2 font-[family-name:var(--st-mono)] text-[11.5px] leading-relaxed outline-none"
        style={{ background: "var(--st-bg)", color: "var(--st-text)", boxShadow: "inset 0 0 0 1px var(--st-border-2)" }}
      />
      <div className="mt-2 flex items-center gap-1.5">
        <Btn variant="outline" size="sm" onClick={() => onUpdate(node.id, { derived: expr.replace(/\s+/g, " ").trim() })}>
          Format
        </Btn>
        <Btn variant="outline" size="sm" onClick={validate}>
          Validate
        </Btn>
        {validation && (
          <span className="ml-auto flex items-center gap-1 text-[10.5px]" style={{ color: validation.ok ? "var(--st-success)" : "var(--st-error)" }}>
            {!validation.ok && <AlertCircle size={11} />}
            {validation.msg}
          </span>
        )}
      </div>
    </Section>
  );
}

function AsyncSection({ node, onUpdate }: { node: StateNodeSchema; onUpdate: (id: string, u: Partial<StateNodeSchema>) => void }) {
  const a = node.async ?? { source: "" };
  const patch = (p: Partial<NonNullable<StateNodeSchema["async"]>>) => onUpdate(node.id, { async: { ...a, ...p } });
  return (
    <Section title="Async Source">
      <Field label="Source" hint="endpoint or action">
        <TextField mono value={a.source} onChange={(e) => patch({ source: e.target.value })} placeholder="/api/v1/users" />
      </Field>
      <ToggleRow label="Auto-fetch on mount" checked={a.autoFetch ?? false} onChange={(v) => patch({ autoFetch: v })} />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Refetch (ms)">
          <TextField
            type="number"
            value={a.refetchInterval ?? ""}
            onChange={(e) => patch({ refetchInterval: e.target.value === "" ? undefined : Number(e.target.value) })}
            placeholder="0"
          />
        </Field>
        <Field label="Stale time (ms)">
          <TextField
            type="number"
            value={a.staleTime ?? ""}
            onChange={(e) => patch({ staleTime: e.target.value === "" ? undefined : Number(e.target.value) })}
            placeholder="0"
          />
        </Field>
      </div>
    </Section>
  );
}

const VALIDATION_TYPES: ValidationRule["type"][] = ["required", "minLength", "maxLength", "min", "max", "pattern", "custom"];

function ValidationSection({ node, onUpdate }: { node: StateNodeSchema; onUpdate: (id: string, u: Partial<StateNodeSchema>) => void }) {
  const rules = node.validation ?? [];
  const set = (next: ValidationRule[]) => onUpdate(node.id, { validation: next });
  const add = () => set([...rules, { type: "required", message: "This field is required" }]);
  const remove = (i: number) => set(rules.filter((_, idx) => idx !== i));
  const patch = (i: number, p: Partial<ValidationRule>) => set(rules.map((r, idx) => (idx === i ? { ...r, ...p } : r)));

  return (
    <Section title="Validation" badge={rules.length} defaultOpen={rules.length > 0}>
      {rules.length === 0 && (
        <p className="mb-2 text-[11px]" style={{ color: "var(--st-text-3)" }}>
          Rules run whenever this value changes.
        </p>
      )}
      <div className="flex flex-col gap-2">
        {rules.map((r, i) => {
          const needsValue = r.type !== "required" && r.type !== "custom";
          return (
            <div key={i} className="rounded-[var(--st-r-md)] p-2" style={{ background: "var(--st-bg)", boxShadow: "inset 0 0 0 1px var(--st-border)" }}>
              <div className="mb-1.5 flex items-center gap-1.5">
                <SelectField value={r.type} onChange={(e) => patch(i, { type: e.target.value as ValidationRule["type"] })} className="!py-1 text-[11px]">
                  {VALIDATION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </SelectField>
                {needsValue && (
                  <TextField
                    value={(r.value as string) ?? ""}
                    onChange={(e) => patch(i, { value: e.target.value })}
                    placeholder="value"
                    className="!py-1 text-[11px]"
                  />
                )}
                <button onClick={() => remove(i)} className="shrink-0 text-[var(--st-text-3)] hover:text-[var(--st-error)]" title="Remove rule">
                  <Trash2 size={13} />
                </button>
              </div>
              {r.type === "custom" && (
                <TextField
                  mono
                  value={r.expression ?? ""}
                  onChange={(e) => patch(i, { expression: e.target.value })}
                  placeholder="value.length > 0 && value !== 'admin'"
                  className="mb-1.5 !py-1 text-[11px]"
                />
              )}
              <TextField value={r.message} onChange={(e) => patch(i, { message: e.target.value })} placeholder="Error message" className="!py-1 text-[11px]" />
            </div>
          );
        })}
      </div>
      <Btn variant="outline" size="sm" className="mt-2 w-full justify-center" onClick={add}>
        <Plus size={13} /> Add rule
      </Btn>
    </Section>
  );
}

function AdvancedSection({ node, onUpdate }: { node: StateNodeSchema; onUpdate: (id: string, u: Partial<StateNodeSchema>) => void }) {
  const persist = node.persist;
  const persistOn = !!persist;
  return (
    <Section title="Advanced" defaultOpen={false}>
      <Field label="Group" hint="visual cluster">
        <TextField value={node.group ?? ""} onChange={(e) => onUpdate(node.id, { group: e.target.value || undefined })} placeholder="user" />
      </Field>
      <ToggleRow
        label="Persist value"
        hint="survive reloads via storage"
        checked={persistOn}
        onChange={(v) => onUpdate(node.id, { persist: v ? { storage: "localStorage" } : undefined })}
      />
      {persistOn && persist && (
        <div className="rounded-[var(--st-r-md)] p-2.5" style={{ background: "var(--st-bg)", boxShadow: "inset 0 0 0 1px var(--st-border)" }}>
          <Field label="Storage">
            <SelectField
              value={persist.storage}
              onChange={(e) => onUpdate(node.id, { persist: { ...persist, storage: e.target.value as NonNullable<StateNodeSchema["persist"]>["storage"] } })}
            >
              <option value="localStorage">localStorage</option>
              <option value="sessionStorage">sessionStorage</option>
              <option value="asyncStorage">asyncStorage</option>
              <option value="secureStorage">secureStorage</option>
            </SelectField>
          </Field>
          <Field label="Custom key" hint="optional">
            <TextField mono value={persist.key ?? ""} onChange={(e) => onUpdate(node.id, { persist: { ...persist, key: e.target.value || undefined } })} placeholder={node.name} />
          </Field>
          <ToggleRow label="Encrypt at rest" checked={persist.encrypt ?? false} onChange={(v) => onUpdate(node.id, { persist: { ...persist, encrypt: v } })} />
        </div>
      )}
    </Section>
  );
}
