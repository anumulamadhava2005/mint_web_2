"use client";

// Navigation Editor — visual routing graph editor.
// Draggable screen cards on a canvas, SVG bezier connections,
// right inspector for route/auth config.

import { useState, useRef, useCallback, useMemo } from "react";
import { v4 as uuid } from "uuid";
import {
  Frame, ShieldCheck, Plus, Undo2, Redo2,
  ZoomIn, ZoomOut, Maximize, Play, Search,
  Settings2, Zap, Users, MousePointer2, Trash2,
} from "lucide-react";
import { useRuntimeStore } from "@/lib/runtime/runtime-store";
import type { ScreenSchema } from "@/lib/runtime/schema";
import {
  Inspector, InspectorTabs, Section, Field,
  TextField, SelectField, ToggleRow, Btn, IconBtn, Pill, EmptyState,
} from "./primitives";

// ── Types ──────────────────────────────────────────────────────

interface CardPos { x: number; y: number }
interface NavEdge { id: string; fromId: string; toId: string; label?: string }
type InspectorTab = "props" | "style" | "events" | "collab";

// ── Defaults ───────────────────────────────────────────────────

const DEFAULT_POSITIONS: Record<string, CardPos> = {
  login: { x: 100, y: 100 }, dashboard: { x: 350, y: 100 },
  profile: { x: 350, y: 260 }, admin: { x: 600, y: 100 },
};
const DEFAULT_EDGES: NavEdge[] = [
  { id: "e1", fromId: "login",     toId: "dashboard", label: "on auth" },
  { id: "e2", fromId: "dashboard", toId: "profile",   label: "" },
  { id: "e3", fromId: "dashboard", toId: "admin",     label: "" },
  { id: "e4", fromId: "profile",   toId: "dashboard", label: "back" },
];
const DEFAULT_AUTH: Record<string, { required: boolean; roles: string[] }> = {
  login:     { required: false, roles: [] },
  dashboard: { required: true,  roles: [] },
  profile:   { required: true,  roles: ["user", "admin"] },
  admin:     { required: true,  roles: ["admin"] },
};

const CARD_W = 208;
const CARD_H = 80;

// ── Screen card ────────────────────────────────────────────────

function ScreenCard({ screen, pos, selected, authInfo, onSelect, onDragEnd }: {
  screen: ScreenSchema; pos: CardPos; selected: boolean;
  authInfo: { required: boolean; roles: string[] };
  onSelect: () => void; onDragEnd: (pos: CardPos) => void;
}) {
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  return (
    <div
      onPointerDown={(e) => {
        e.stopPropagation(); onSelect();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        onDragEnd({ x: drag.current.ox + e.clientX - drag.current.sx, y: drag.current.oy + e.clientY - drag.current.sy });
      }}
      onPointerUp={() => { drag.current = null; }}
      style={{
        position: "absolute", left: pos.x, top: pos.y, width: CARD_W,
        cursor: "grab", userSelect: "none",
        background: "var(--st-elevated)",
        border: selected ? "1.5px solid var(--st-brand)" : "1px solid var(--st-border)",
        borderRadius: "var(--st-r-lg)",
        boxShadow: selected ? "0 0 0 3px var(--st-brand-tint), var(--st-shadow-raised)" : "var(--st-shadow-raised)",
        padding: "10px 12px",
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Frame size={14} style={{ color: "var(--st-brand)", flexShrink: 0 }} />
        <span className="font-semibold text-[12.5px] truncate" style={{ color: "var(--st-text)" }}>
          {screen.name}
        </span>
      </div>
      <div className="text-[11px] truncate mb-2" style={{ color: "var(--st-text-3)", fontFamily: "var(--st-mono)" }}>
        {screen.route || "/"}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {authInfo.required && <Pill tone="warning"><ShieldCheck size={9} />Auth</Pill>}
        {authInfo.roles.map((r) => <Pill key={r} tone="brand">{r}</Pill>)}
      </div>
    </div>
  );
}

// ── SVG edges ─────────────────────────────────────────────────

function ConnectionLines({ edges, positions }: { edges: NavEdge[]; positions: Record<string, CardPos> }) {
  return (
    <svg style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }} width="100%" height="100%">
      <defs>
        <marker id="nav-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="var(--st-text-3)" />
        </marker>
      </defs>
      {edges.map((edge) => {
        const f = positions[edge.fromId], t = positions[edge.toId];
        if (!f || !t) return null;
        const x1 = f.x + CARD_W, y1 = f.y + CARD_H / 2;
        const x2 = t.x,          y2 = t.y + CARD_H / 2;
        const cp = (x2 - x1) * 0.5;
        const d = `M${x1},${y1} C${x1+cp},${y1} ${x2-cp},${y2} ${x2},${y2}`;
        return (
          <g key={edge.id}>
            <path d={d} fill="none" stroke="var(--st-border-2)" strokeWidth={1.5} markerEnd="url(#nav-arr)" />
            {edge.label && (
              <text x={(x1+x2)/2} y={(y1+y2)/2 - 8} textAnchor="middle" fontSize={9}
                fill="var(--st-text-3)" fontFamily="var(--st-mono)">{edge.label}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Stat row ──────────────────────────────────────────────────

function StatRow({ label, value, tone }: { label: string; value: number; tone?: "warning" | "brand" }) {
  const color = tone === "warning" ? "var(--st-warning)" : tone === "brand" ? "var(--st-brand)" : "var(--st-text)";
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11.5px]" style={{ color: "var(--st-text-2)" }}>{label}</span>
      <span className="text-[12px] font-semibold tabular-nums" style={{ color }}>{value}</span>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────

export function NavigationEditor() {
  const { schema, addScreen, updateScreen, removeScreen } = useRuntimeStore();
  const storeScreens = schema.screens ?? [];

  const [localScreens, setLocalScreens] = useState<ScreenSchema[]>(storeScreens);
  const [positions, setPositions] = useState<Record<string, CardPos>>(DEFAULT_POSITIONS);
  const [authInfo, setAuthInfo] = useState<Record<string, { required: boolean; roles: string[] }>>(DEFAULT_AUTH);
  const [edges] = useState<NavEdge[]>(DEFAULT_EDGES);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("props");
  const [zoom, setZoom] = useState(1);
  const [bottomTab, setBottomTab] = useState<"json" | "console" | "logs" | "validation">("json");
  const [routeEdits, setRouteEdits] = useState<Record<string, string>>({});
  const [titleEdits, setTitleEdits] = useState<Record<string, string>>({});
  const [rolesInput, setRolesInput] = useState<Record<string, string>>({});

  const selectedScreen = useMemo(
    () => localScreens.find((s) => s.id === selectedId) ?? null,
    [localScreens, selectedId]
  );
  const filteredScreens = useMemo(
    () => searchQuery.trim()
      ? localScreens.filter((s) =>
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.route.toLowerCase().includes(searchQuery.toLowerCase()))
      : localScreens,
    [localScreens, searchQuery]
  );
  const authGuardedCount = useMemo(
    () => Object.values(authInfo).filter((a) => a.required).length, [authInfo]
  );

  const handleAddScreen = useCallback(() => {
    const id = uuid(), idx = localScreens.length + 1;
    const s: ScreenSchema = { id, name: `Screen ${idx}`, route: `/screen-${idx}`, components: [], localState: [], actions: [] };
    setLocalScreens((p) => [...p, s]);
    setPositions((p) => ({ ...p, [id]: { x: 120 + Math.random() * 280, y: 120 + Math.random() * 200 } }));
    setAuthInfo((p) => ({ ...p, [id]: { required: false, roles: [] } }));
    addScreen(s); setSelectedId(id);
  }, [localScreens.length, addScreen]);

  const handleRemoveScreen = useCallback((id: string) => {
    setLocalScreens((p) => p.filter((s) => s.id !== id));
    removeScreen(id);
    if (selectedId === id) setSelectedId(null);
  }, [removeScreen, selectedId]);

  const handleUpdateRoute = useCallback((id: string, route: string) => {
    setLocalScreens((p) => p.map((s) => s.id === id ? { ...s, route } : s));
    updateScreen(id, { route });
  }, [updateScreen]);

  const handleDrag = useCallback((id: string, pos: CardPos) => {
    setPositions((p) => ({ ...p, [id]: pos }));
  }, []);

  const inspTabs: { id: InspectorTab; icon: React.ReactNode; label: string }[] = [
    { id: "props",  icon: <Settings2 size={13} />,   label: "Properties" },
    { id: "style",  icon: <Zap size={13} />,          label: "Style" },
    { id: "events", icon: <MousePointer2 size={13} />, label: "Events" },
    { id: "collab", icon: <Users size={13} />,         label: "Collaborators" },
  ];

  const sid = selectedId ?? "";

  if (localScreens.length === 0) {
    return (
      <EmptyState
        icon={<Frame size={22} />}
        title="No screens to route"
        description="Add screens in Screen Manager first, then come back to wire up your navigation graph."
        action={
          <Btn variant="primary" size="sm" onClick={handleAddScreen}>
            Add First Screen
          </Btn>
        }
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col" style={{ background: "var(--st-bg)", color: "var(--st-text)" }}>

      {/* Top bar */}
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b px-3"
        style={{ borderColor: "var(--st-border)", background: "var(--st-surface)" }}>
        <div className="relative flex items-center" style={{ width: 200 }}>
          <Search size={12} className="pointer-events-none absolute left-2.5" style={{ color: "var(--st-text-3)" }} />
          <input type="text" placeholder="Search screens..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-6 w-full rounded-[var(--st-r-md)] pl-7 pr-2 text-[11.5px] outline-none"
            style={{ background: "var(--st-bg)", color: "var(--st-text)", boxShadow: "inset 0 0 0 1px var(--st-border-2)" }} />
        </div>
        <div className="flex items-center gap-1">
          <IconBtn title="Undo"><Undo2 size={13} /></IconBtn>
          <IconBtn title="Redo"><Redo2 size={13} /></IconBtn>
          <div className="mx-1 h-4 w-px" style={{ background: "var(--st-border)" }} />
          <IconBtn title="Zoom out" onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))}>
            <ZoomOut size={13} />
          </IconBtn>
          <span className="w-10 text-center text-[11px] tabular-nums" style={{ color: "var(--st-text-2)" }}>
            {Math.round(zoom * 100)}%
          </span>
          <IconBtn title="Zoom in" onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))}>
            <ZoomIn size={13} />
          </IconBtn>
          <IconBtn title="Fit" onClick={() => setZoom(1)}><Maximize size={13} /></IconBtn>
          <div className="mx-1 h-4 w-px" style={{ background: "var(--st-border)" }} />
          <Btn variant="primary" size="sm"><Play size={11} />Preview</Btn>
        </div>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {/* Canvas */}
        <div className="relative min-h-0 flex-1 overflow-hidden" style={{ background: "var(--st-canvas)" }}
          onClick={() => setSelectedId(null)}>
          {/* Dot grid */}
          <div style={{
            position: "absolute", inset: 0, opacity: 0.4, pointerEvents: "none",
            backgroundImage: "radial-gradient(circle, var(--st-border) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }} />
          {/* Zoom layer */}
          <div style={{ position: "absolute", inset: 0, transform: `scale(${zoom})`, transformOrigin: "top left" }}>
            <ConnectionLines edges={edges} positions={positions} />
            {filteredScreens.map((screen) => (
              <ScreenCard key={screen.id} screen={screen}
                pos={positions[screen.id] ?? { x: 100, y: 100 }}
                selected={selectedId === screen.id}
                authInfo={authInfo[screen.id] ?? { required: false, roles: [] }}
                onSelect={() => setSelectedId(screen.id)}
                onDragEnd={(pos) => handleDrag(screen.id, pos)} />
            ))}
          </div>
          {/* FAB */}
          <button type="button" title="Add screen"
            onClick={(e) => { e.stopPropagation(); handleAddScreen(); }}
            style={{
              position: "absolute", bottom: 40, right: 16, width: 36, height: 36,
              borderRadius: "50%", background: "var(--st-brand)", color: "#fff",
              display: "grid", placeItems: "center", boxShadow: "var(--st-shadow-floating)",
              border: "none", cursor: "pointer",
            }}>
            <Plus size={18} />
          </button>
        </div>

        {/* Inspector */}
        <Inspector title="Inspector"
          tabs={<InspectorTabs tabs={inspTabs} value={inspectorTab} onChange={setInspectorTab} />}>
          {selectedScreen ? (
            <>
              {/* Breadcrumb */}
              <div className="flex items-center gap-1.5 border-b px-3.5 py-2"
                style={{ borderColor: "var(--st-border)" }}>
                <span className="rounded-[var(--st-r-sm)] px-1.5 py-0.5 text-[11px] font-medium"
                  style={{ background: "var(--st-surface-2)", color: "var(--st-text-2)" }}>
                  {selectedScreen.name}
                </span>
                <span style={{ color: "var(--st-text-3)", fontSize: 10 }}>|</span>
                <span className="text-[11px]" style={{ color: "var(--st-text-3)" }}>Route Config</span>
                <div className="ml-auto">
                  <IconBtn title="Delete screen" onClick={() => handleRemoveScreen(selectedScreen.id)}
                    style={{ color: "var(--st-error)" }}>
                    <Trash2 size={12} />
                  </IconBtn>
                </div>
              </div>

              {/* Route config */}
              <Section title="Route Configuration" defaultOpen>
                <Field label="Route path" htmlFor={`route-${sid}`}>
                  <TextField id={`route-${sid}`} mono
                    value={routeEdits[sid] ?? selectedScreen.route}
                    placeholder="/my-screen"
                    onChange={(e) => setRouteEdits((p) => ({ ...p, [sid]: e.target.value }))}
                    onBlur={(e) => handleUpdateRoute(sid, e.target.value)} />
                </Field>
                <Field label="Page title" htmlFor={`title-${sid}`}>
                  <TextField id={`title-${sid}`}
                    value={titleEdits[sid] ?? selectedScreen.name}
                    placeholder="Page title (meta)"
                    onChange={(e) => setTitleEdits((p) => ({ ...p, [sid]: e.target.value }))} />
                </Field>
                <ToggleRow label="Auth Required" hint="Redirect unauthenticated users"
                  checked={authInfo[sid]?.required ?? false}
                  onChange={(v) => setAuthInfo((p) => ({ ...p, [sid]: { ...p[sid], required: v } }))} />
                {authInfo[sid]?.required && (
                  <Field label="Roles (comma-separated)" htmlFor={`roles-${sid}`}>
                    <TextField id={`roles-${sid}`} placeholder="user, admin"
                      value={rolesInput[sid] ?? (authInfo[sid]?.roles ?? []).join(", ")}
                      onChange={(e) => setRolesInput((p) => ({ ...p, [sid]: e.target.value }))}
                      onBlur={(e) => {
                        const roles = e.target.value.split(",").map((r) => r.trim()).filter(Boolean);
                        setAuthInfo((p) => ({ ...p, [sid]: { ...p[sid], roles } }));
                      }} />
                  </Field>
                )}
              </Section>

              {/* Action config */}
              <Section title="Action Configuration" defaultOpen={false}>
                <Field label="Action Name"><TextField placeholder="e.g. handleSubmit" /></Field>
                <Field label="Integration">
                  <SelectField defaultValue="none">
                    <option value="none">None</option>
                    <option value="supabase">Supabase DB</option>
                    <option value="rest">REST API</option>
                  </SelectField>
                </Field>
                <Field label="Method">
                  <SelectField defaultValue="insert">
                    <option value="insert">Insert Row</option>
                    <option value="select">Select</option>
                    <option value="update">Update</option>
                    <option value="delete">Delete</option>
                  </SelectField>
                </Field>
                <div className="mb-2 mt-1">
                  <div className="mb-1.5 text-[11px] font-medium" style={{ color: "var(--st-text-2)" }}>Payload (JSON)</div>
                  <div className="rounded-[var(--st-r-md)] p-2 text-[11px]" style={{
                    background: "var(--st-bg)", boxShadow: "inset 0 0 0 1px var(--st-border-2)",
                    fontFamily: "var(--st-mono)", color: "var(--st-text-2)", lineHeight: 1.6,
                  }}>
                    <div><span style={{ color: "var(--st-text-3)" }}>email:</span>{" "}
                      <span style={{ color: "var(--st-brand)" }}>{"{{input_email.value}}"}</span></div>
                    <div><span style={{ color: "var(--st-text-3)" }}>role:</span>{" "}
                      <span style={{ color: "var(--st-success)" }}>{"'user'"}</span></div>
                  </div>
                  <Btn variant="outline" size="sm" className="mt-2 w-full"><Plus size={11} />Add Field</Btn>
                </div>
              </Section>

              <Section title="Advanced Logic" defaultOpen={false}>
                <p className="text-[11px]" style={{ color: "var(--st-text-3)" }}>
                  Conditionals, guards, and multi-step flows.
                </p>
              </Section>
            </>
          ) : (
            <div className="px-3.5 py-4 space-y-3">
              <div className="rounded-[var(--st-r-lg)] p-3 space-y-2" style={{ background: "var(--st-surface-2)" }}>
                <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-widest" style={{ color: "var(--st-text-3)" }}>
                  Navigation Graph
                </div>
                <StatRow label="Screens" value={localScreens.length} />
                <StatRow label="Routes" value={localScreens.length} />
                <StatRow label="Auth-guarded" value={authGuardedCount} tone="warning" />
                <StatRow label="Connections" value={edges.length} />
              </div>
              <p className="text-center text-[11px]" style={{ color: "var(--st-text-3)" }}>
                Click a screen card to edit its route configuration.
              </p>
            </div>
          )}
        </Inspector>
      </div>

      {/* Bottom bar */}
      <div className="flex h-8 shrink-0 items-center justify-between border-t px-3"
        style={{ borderColor: "var(--st-border)", background: "var(--st-surface)" }}>
        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--st-text-3)" }}>
          <span style={{ color: "var(--st-success)" }}>●</span>
          <span>Ready</span>
          <span style={{ color: "var(--st-border-2)" }}>|</span>
          <span>v1.0.4-stable</span>
        </div>
        <div className="flex items-center gap-0.5">
          {(["json", "console", "logs", "validation"] as const).map((tab) => (
            <button key={tab} type="button" onClick={() => setBottomTab(tab)}
              className="rounded-[var(--st-r-sm)] px-2 py-0.5 text-[10.5px] capitalize transition-colors"
              style={{
                background: bottomTab === tab ? "var(--st-surface-2)" : "transparent",
                color: bottomTab === tab ? "var(--st-text)" : "var(--st-text-3)",
              }}>
              {tab}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
