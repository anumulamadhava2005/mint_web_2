"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { v4 as uuid } from "uuid";
import {
  Frame, ShieldCheck, Plus,
  ZoomIn, ZoomOut, Maximize, Search,
  Trash2, Link2, X, Lock, Unlock,
} from "lucide-react";
import { useRuntimeStore } from "@/lib/runtime/runtime-store";
import type { ScreenSchema } from "@/lib/runtime/schema";
import {
  Section, Field, TextField, ToggleRow, Btn, Pill,
} from "./primitives";

// ── Types ──────────────────────────────────────────────────────
interface CardPos { x: number; y: number }
interface NavEdge { id: string; fromId: string; toId: string; label?: string }

const CARD_W = 200;
const CARD_H = 88;

// ── Connection lines ───────────────────────────────────────────
function ConnectionLines({
  edges, positions, connecting, mousePos,
}: {
  edges: NavEdge[];
  positions: Record<string, CardPos>;
  connecting: { fromId: string } | null;
  mousePos: { x: number; y: number };
}) {
  return (
    <svg
      style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}
      width="100%" height="100%"
    >
      <defs>
        <marker id="nav-arr" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <path d="M0,0 L0,7 L7,3.5 z" fill="var(--st-brand)" opacity="0.7" />
        </marker>
        <marker id="nav-arr-draft" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <path d="M0,0 L0,7 L7,3.5 z" fill="var(--st-text-3)" opacity="0.7" />
        </marker>
      </defs>

      {edges.map((edge) => {
        const f = positions[edge.fromId];
        const t = positions[edge.toId];
        if (!f || !t) return null;
        const x1 = f.x + CARD_W;
        const y1 = f.y + CARD_H / 2;
        const x2 = t.x;
        const y2 = t.y + CARD_H / 2;
        const cp = Math.abs(x2 - x1) * 0.45 + 40;
        const d = `M${x1},${y1} C${x1 + cp},${y1} ${x2 - cp},${y2} ${x2},${y2}`;
        return (
          <g key={edge.id}>
            <path d={d} fill="none" stroke="var(--st-brand)" strokeWidth={1.5}
              strokeOpacity={0.5} markerEnd="url(#nav-arr)" />
            {edge.label && (
              <text x={(x1 + x2) / 2} y={Math.min(y1, y2) - 6}
                textAnchor="middle" fontSize={9}
                fill="var(--st-text-3)" fontFamily="var(--st-mono)">
                {edge.label}
              </text>
            )}
          </g>
        );
      })}

      {connecting && positions[connecting.fromId] && (() => {
        const f = positions[connecting.fromId];
        const x1 = f.x + CARD_W;
        const y1 = f.y + CARD_H / 2;
        const x2 = mousePos.x;
        const y2 = mousePos.y;
        const cp = Math.abs(x2 - x1) * 0.4 + 30;
        const d = `M${x1},${y1} C${x1 + cp},${y1} ${x2 - cp},${y2} ${x2},${y2}`;
        return (
          <path d={d} fill="none" stroke="var(--st-text-3)" strokeWidth={1.5}
            strokeDasharray="5 3" markerEnd="url(#nav-arr-draft)" />
        );
      })()}
    </svg>
  );
}

// ── Screen card ────────────────────────────────────────────────
function ScreenCard({
  screen, pos, selected, authRequired,
  isConnectingFrom, canReceiveConnection,
  onSelect, onDragEnd, onConnectStart, onConnectEnd,
}: {
  screen: ScreenSchema; pos: CardPos; selected: boolean;
  authRequired: boolean; isConnectingFrom: boolean; canReceiveConnection: boolean;
  onSelect: () => void;
  onDragEnd: (pos: CardPos) => void;
  onConnectStart: (e: React.MouseEvent) => void;
  onConnectEnd: () => void;
}) {
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const [hovered, setHovered] = useState(false);

  const accentColor = selected
    ? "var(--st-brand)"
    : authRequired
    ? "var(--st-warning)"
    : "var(--st-border-3)";

  return (
    <div
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("[data-handle]")) return;
        e.stopPropagation();
        if (canReceiveConnection) { onConnectEnd(); return; }
        onSelect();
        const card = (e.target as HTMLElement).closest<HTMLElement>("[data-card]");
        card?.setPointerCapture(e.pointerId);
        drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        onDragEnd({
          x: drag.current.ox + e.clientX - drag.current.sx,
          y: drag.current.oy + e.clientY - drag.current.sy,
        });
      }}
      onPointerUp={() => { drag.current = null; }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      data-card="true"
      style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        width: CARD_W,
        cursor: canReceiveConnection ? "crosshair" : "grab",
        userSelect: "none",
        borderRadius: 10,
        background: selected ? "var(--st-elevated)" : "var(--st-surface)",
        border: `1px solid ${selected ? "var(--st-brand)" : canReceiveConnection ? "var(--st-warning)" : "var(--st-border)"}`,
        boxShadow: selected
          ? "0 0 0 3px var(--st-brand-tint), 0 4px 16px rgba(0,0,0,0.4)"
          : "0 2px 8px rgba(0,0,0,0.25)",
        transition: "border-color 120ms, box-shadow 120ms",
        overflow: "hidden",
      }}
    >
      {/* Left accent stripe */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
        background: accentColor,
        borderRadius: "10px 0 0 10px",
        transition: "background 120ms",
      }} />

      {/* Card body */}
      <div style={{ padding: "10px 12px 10px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <Frame size={12} style={{ color: "var(--st-brand)", flexShrink: 0 }} />
          <span style={{
            flex: 1, fontSize: 13, fontWeight: 600, color: "var(--st-text)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {screen.name}
          </span>
          {authRequired && (
            <ShieldCheck size={12} style={{ color: "var(--st-warning)", flexShrink: 0 }} />
          )}
        </div>

        <div style={{
          fontSize: 11, color: "var(--st-text-3)", fontFamily: "var(--st-mono)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          marginBottom: 8,
        }}>
          {screen.route || "/"}
        </div>

        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {authRequired
            ? <Pill tone="warning"><Lock size={8} />Protected</Pill>
            : <Pill tone="neutral"><Unlock size={8} />Public</Pill>
          }
          {screen.width && (
            <Pill tone="neutral">{screen.width}×{screen.height}</Pill>
          )}
        </div>
      </div>

      {/* Right connection handle */}
      {(hovered || isConnectingFrom) && (
        <div
          data-handle="true"
          onMouseDown={(e) => { e.stopPropagation(); onConnectStart(e); }}
          title="Click to start connection"
          style={{
            position: "absolute", right: -6, top: "50%", transform: "translateY(-50%)",
            width: 12, height: 12, borderRadius: "50%",
            background: "var(--st-brand)", border: "2px solid var(--st-bg)",
            cursor: "crosshair", zIndex: 10,
          }}
        />
      )}
    </div>
  );
}

// ── Stat row ──────────────────────────────────────────────────
function StatRow({ label, value, tone }: { label: string; value: number; tone?: "warning" | "brand" }) {
  const color = tone === "warning" ? "var(--st-warning)" : tone === "brand" ? "var(--st-brand)" : "var(--st-text)";
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0" }}>
      <span style={{ fontSize: 12, color: "var(--st-text-2)" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color }}>{value}</span>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────
function NavEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{ display: "grid", placeItems: "center", height: "100%", padding: 40 }}>
      <div style={{ textAlign: "center", maxWidth: 320 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12, background: "var(--st-surface)",
          border: "1px solid var(--st-border)", display: "grid", placeItems: "center",
          margin: "0 auto 16px",
        }}>
          <Frame size={22} style={{ color: "var(--st-text-3)" }} />
        </div>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--st-text)", marginBottom: 8 }}>
          No screens yet
        </h3>
        <p style={{ fontSize: 12.5, color: "var(--st-text-3)", lineHeight: 1.6, marginBottom: 20 }}>
          Add screens in the Canvas tab first, then wire up your navigation flow here.
        </p>
        <Btn variant="primary" size="sm" onClick={onAdd}>
          <Plus size={11} />Add First Screen
        </Btn>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export function NavigationEditor() {
  const { schema, addScreen, updateScreen, removeScreen } = useRuntimeStore();
  const storeScreens = useMemo(() => schema.screens ?? [], [schema.screens]);

  const [positions, setPositions] = useState<Record<string, CardPos>>({});
  const [authInfo, setAuthInfo] = useState<Record<string, { required: boolean; roles: string[] }>>({});
  const [edges, setEdges] = useState<NavEdge[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 60, y: 60 });
  const [connecting, setConnecting] = useState<{ fromId: string } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [routeEdits, setRouteEdits] = useState<Record<string, string>>({});
  const [rolesInput, setRolesInput] = useState<Record<string, string>>({});

  const canvasRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  // Non-passive wheel — pan + zoom
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.ctrlKey || e.metaKey) {
        setZoom((z) => Math.max(0.3, Math.min(2, z - e.deltaY * 0.002)));
      } else {
        setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const selectedScreen = useMemo(
    () => storeScreens.find((s) => s.id === selectedId) ?? null,
    [storeScreens, selectedId]
  );

  const filteredScreens = useMemo(
    () => searchQuery.trim()
      ? storeScreens.filter((s) =>
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.route ?? "").toLowerCase().includes(searchQuery.toLowerCase()))
      : storeScreens,
    [storeScreens, searchQuery]
  );

  const authGuardedCount = useMemo(
    () => Object.values(authInfo).filter((a) => a.required).length,
    [authInfo]
  );

  const handleAddScreen = useCallback(() => {
    const id = uuid();
    const idx = storeScreens.length + 1;
    const s: ScreenSchema = {
      id, name: `Screen ${idx}`, route: `/screen-${idx}`,
      components: [], localState: [], actions: [],
    };
    setPositions((p) => ({ ...p, [id]: { x: 80 + Math.random() * 300, y: 80 + Math.random() * 200 } }));
    setAuthInfo((p) => ({ ...p, [id]: { required: false, roles: [] } }));
    addScreen(s);
    setSelectedId(id);
  }, [storeScreens.length, addScreen]);

  const handleRemoveScreen = useCallback((id: string) => {
    removeScreen(id);
    setEdges((prev) => prev.filter((e) => e.fromId !== id && e.toId !== id));
    if (selectedId === id) setSelectedId(null);
  }, [removeScreen, selectedId]);

  const handleUpdateRoute = useCallback((id: string, route: string) => {
    updateScreen(id, { route });
  }, [updateScreen]);

  const handleDrag = useCallback((id: string, p: CardPos) => {
    setPositions((prev) => ({ ...prev, [id]: p }));
  }, []);

  const handleConnectStart = useCallback((fromId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConnecting({ fromId });
  }, []);

  const handleConnectEnd = useCallback((toId: string) => {
    if (!connecting || connecting.fromId === toId) { setConnecting(null); return; }
    const exists = edges.some((e) => e.fromId === connecting.fromId && e.toId === toId);
    if (!exists) {
      setEdges((prev) => [...prev, { id: uuid(), fromId: connecting.fromId, toId, label: "" }]);
    }
    setConnecting(null);
  }, [connecting, edges]);

  const handleDeleteEdge = useCallback((edgeId: string) => {
    setEdges((prev) => prev.filter((e) => e.id !== edgeId));
  }, []);

  const sid = selectedId ?? "";

  const onCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-card]")) return;
    setSelectedId(null);
    setConnecting(null);
    panRef.current = { sx: e.clientX, sy: e.clientY, ox: pan.x, oy: pan.y };
    const onMove = (me: MouseEvent) => {
      if (!panRef.current) return;
      setPan({ x: panRef.current.ox + me.clientX - panRef.current.sx, y: panRef.current.oy + me.clientY - panRef.current.sy });
    };
    const onUp = () => {
      panRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [pan]);

  const onCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (!connecting) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMousePos({
      x: (e.clientX - rect.left - pan.x) / zoom,
      y: (e.clientY - rect.top - pan.y) / zoom,
    });
  }, [connecting, pan, zoom]);

  if (storeScreens.length === 0) {
    return (
      <div style={{ height: "100%", background: "var(--st-bg)" }}>
        <NavEmptyState onAdd={handleAddScreen} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--st-bg)", color: "var(--st-text)" }}>

      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 8, height: 44, flexShrink: 0, padding: "0 12px",
        borderBottom: "1px solid var(--st-border)", background: "var(--st-surface)",
      }}>
        {/* Search */}
        <div style={{ position: "relative", width: 200, display: "flex", alignItems: "center" }}>
          <Search size={12} style={{ position: "absolute", left: 9, color: "var(--st-text-3)", pointerEvents: "none" }} />
          <input type="text" placeholder="Search screens…" value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              height: 28, width: "100%", paddingLeft: 28, paddingRight: 8,
              fontSize: 12, borderRadius: 6, outline: "none",
              background: "var(--st-bg)", color: "var(--st-text)",
              boxShadow: "inset 0 0 0 1px var(--st-border-2)", border: "none",
            }} />
        </div>

        {/* Center status */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--st-text-3)" }}>
            {storeScreens.length} screen{storeScreens.length !== 1 ? "s" : ""}
          </span>
          {edges.length > 0 && (
            <span style={{ fontSize: 12, color: "var(--st-text-3)" }}>
              · {edges.length} connection{edges.length !== 1 ? "s" : ""}
            </span>
          )}
          {connecting && (
            <span style={{
              fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 4,
              background: "rgba(167,139,250,0.15)", color: "var(--st-brand)",
              display: "flex", alignItems: "center", gap: 4,
            }}>
              Click a screen to connect →
              <button onClick={() => setConnecting(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--st-text-3)", padding: 0, display: "flex" }}>
                <X size={11} />
              </button>
            </span>
          )}
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <button title="Zoom out"
            onClick={() => setZoom((z) => Math.max(0.3, +(z - 0.1).toFixed(2)))}
            style={{ width: 28, height: 28, display: "grid", placeItems: "center", borderRadius: 6, background: "transparent", border: "none", cursor: "pointer", color: "var(--st-text-2)" }}>
            <ZoomOut size={13} />
          </button>
          <button onClick={() => { setZoom(1); setPan({ x: 60, y: 60 }); }}
            style={{ minWidth: 44, height: 28, fontSize: 11, borderRadius: 6, background: "transparent", border: "none", cursor: "pointer", color: "var(--st-text-2)" }}>
            {Math.round(zoom * 100)}%
          </button>
          <button title="Zoom in"
            onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))}
            style={{ width: 28, height: 28, display: "grid", placeItems: "center", borderRadius: 6, background: "transparent", border: "none", cursor: "pointer", color: "var(--st-text-2)" }}>
            <ZoomIn size={13} />
          </button>
          <button title="Reset view"
            onClick={() => { setZoom(1); setPan({ x: 60, y: 60 }); }}
            style={{ width: 28, height: 28, display: "grid", placeItems: "center", borderRadius: 6, background: "transparent", border: "none", cursor: "pointer", color: "var(--st-text-2)" }}>
            <Maximize size={13} />
          </button>
          <div style={{ width: 1, height: 16, background: "var(--st-border)", margin: "0 4px" }} />
          <button onClick={handleAddScreen}
            style={{
              height: 28, padding: "0 10px", borderRadius: 6, fontSize: 12, fontWeight: 500,
              background: "var(--st-brand)", color: "#fff", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4,
            }}>
            <Plus size={12} />New Screen
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>

        {/* Canvas */}
        <div
          ref={canvasRef}
          style={{
            flex: 1, position: "relative", overflow: "hidden",
            background: "var(--st-canvas)", cursor: connecting ? "crosshair" : "default",
            userSelect: "none",
          }}
          onMouseDown={onCanvasMouseDown}
          onMouseMove={onCanvasMouseMove}
        >
          {/* Dot grid */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            backgroundImage: "radial-gradient(circle, var(--st-border-2) 1px, transparent 1px)",
            backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
            backgroundPosition: `${pan.x % (24 * zoom)}px ${pan.y % (24 * zoom)}px`,
          }} />

          {/* Transform layer */}
          <div style={{
            position: "absolute", top: 0, left: 0,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}>
            <ConnectionLines edges={edges} positions={positions} connecting={connecting} mousePos={mousePos} />

            {filteredScreens.map((screen, idx) => {
              const defaultPos = { x: 80 + (idx % 3) * 240, y: 80 + Math.floor(idx / 3) * 140 };
              const pos = positions[screen.id] ?? defaultPos;
              const auth = authInfo[screen.id] ?? { required: false, roles: [] };
              return (
                <ScreenCard
                  key={screen.id}
                  screen={screen}
                  pos={pos}
                  selected={selectedId === screen.id}
                  authRequired={auth.required}
                  isConnectingFrom={connecting?.fromId === screen.id}
                  canReceiveConnection={!!connecting && connecting.fromId !== screen.id}
                  onSelect={() => { setSelectedId(screen.id); setConnecting(null); }}
                  onDragEnd={(p) => handleDrag(screen.id, p)}
                  onConnectStart={(e) => handleConnectStart(screen.id, e)}
                  onConnectEnd={() => handleConnectEnd(screen.id)}
                />
              );
            })}
          </div>

          {/* Hint */}
          <div style={{
            position: "absolute", bottom: 12, left: 12, fontSize: 11,
            color: "var(--st-text-3)", pointerEvents: "none",
          }}>
            Drag to pan · ⌘-scroll to zoom · Hover card to connect
          </div>
        </div>

        {/* Inspector */}
        <div style={{
          width: 280, flexShrink: 0, borderLeft: "1px solid var(--st-border)",
          background: "var(--st-surface)", display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
          <div style={{
            height: 44, display: "flex", alignItems: "center", padding: "0 14px",
            borderBottom: "1px solid var(--st-border)", flexShrink: 0,
          }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--st-text-2)" }}>
              {selectedScreen ? selectedScreen.name : "Navigation"}
            </span>
            {selectedScreen && (
              <button
                onClick={() => handleRemoveScreen(selectedScreen.id)}
                title="Delete screen"
                style={{
                  marginLeft: "auto", width: 24, height: 24, borderRadius: 6,
                  background: "transparent", border: "none", cursor: "pointer",
                  display: "grid", placeItems: "center", color: "var(--st-error)",
                }}>
                <Trash2 size={12} />
              </button>
            )}
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {selectedScreen ? (
              <>
                <Section title="Route" defaultOpen>
                  <Field label="Path" htmlFor={`route-${sid}`}>
                    <TextField id={`route-${sid}`} mono
                      value={routeEdits[sid] ?? selectedScreen.route ?? ""}
                      placeholder="/my-screen"
                      onChange={(e) => setRouteEdits((p) => ({ ...p, [sid]: e.target.value }))}
                      onBlur={(e) => handleUpdateRoute(sid, e.target.value)} />
                    {(() => {
                      const r = routeEdits[sid] ?? selectedScreen.route ?? "";
                      const params = (r.match(/:([a-zA-Z_]\w*)/g) ?? []).map((p: string) => p.slice(1));
                      if (!params.length) return (
                        <p style={{ fontSize: 10, color: "var(--st-text-3)", marginTop: 4 }}>
                          Use <code style={{ fontFamily: "var(--st-mono)", background: "var(--st-bg)", padding: "1px 3px", borderRadius: 3 }}>:id</code> for dynamic segments
                        </p>
                      );
                      return (
                        <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {params.map((p: string) => (
                            <span key={p} style={{
                              fontSize: 10, padding: "2px 6px", borderRadius: 4,
                              background: "var(--st-bg)", border: "1px solid var(--st-border-2)",
                              color: "var(--st-brand)", fontFamily: "var(--st-mono)",
                            }}>:{p}</span>
                          ))}
                        </div>
                      );
                    })()}
                  </Field>
                </Section>

                <Section title="Auth Guard" defaultOpen>
                  <ToggleRow label="Require authentication"
                    hint="Redirect unauthenticated users to login"
                    checked={authInfo[sid]?.required ?? false}
                    onChange={(v) => setAuthInfo((p) => ({ ...p, [sid]: { ...p[sid], required: v } }))} />
                  {authInfo[sid]?.required && (
                    <Field label="Allowed roles" htmlFor={`roles-${sid}`}>
                      <TextField id={`roles-${sid}`} placeholder="user, admin"
                        value={rolesInput[sid] ?? (authInfo[sid]?.roles ?? []).join(", ")}
                        onChange={(e) => setRolesInput((p) => ({ ...p, [sid]: e.target.value }))}
                        onBlur={(e) => {
                          const roles = e.target.value.split(",").map((r: string) => r.trim()).filter(Boolean);
                          setAuthInfo((p) => ({ ...p, [sid]: { ...p[sid], roles } }));
                        }} />
                      <p style={{ fontSize: 10, color: "var(--st-text-3)", marginTop: 4 }}>
                        Leave empty to allow all authenticated users
                      </p>
                    </Field>
                  )}
                </Section>

                <Section title="Connections" defaultOpen={false}>
                  {edges.filter((e) => e.fromId === sid || e.toId === sid).length === 0 ? (
                    <p style={{ fontSize: 11, color: "var(--st-text-3)" }}>
                      No connections. Hover a card and click the right handle to connect.
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {edges.filter((e) => e.fromId === sid || e.toId === sid).map((edge) => {
                        const otherId = edge.fromId === sid ? edge.toId : edge.fromId;
                        const other = storeScreens.find((s) => s.id === otherId);
                        const dir = edge.fromId === sid ? "→" : "←";
                        return (
                          <div key={edge.id} style={{
                            display: "flex", alignItems: "center", gap: 6,
                            padding: "5px 8px", borderRadius: 6,
                            background: "var(--st-bg)", border: "1px solid var(--st-border)",
                          }}>
                            <span style={{ fontSize: 11, color: "var(--st-text-3)", fontFamily: "var(--st-mono)" }}>{dir}</span>
                            <span style={{ flex: 1, fontSize: 12, color: "var(--st-text)" }}>{other?.name ?? "Unknown"}</span>
                            <button onClick={() => handleDeleteEdge(edge.id)}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--st-error)", padding: 2, borderRadius: 4, display: "grid", placeItems: "center" }}>
                              <X size={10} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); setConnecting({ fromId: sid }); }}
                    style={{
                      marginTop: 8, width: "100%", height: 28, borderRadius: 6,
                      background: "transparent", border: "1px dashed var(--st-border-2)",
                      cursor: "pointer", fontSize: 11, color: "var(--st-text-3)",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                    }}>
                    <Link2 size={11} />Add connection
                  </button>
                </Section>
              </>
            ) : (
              <div style={{ padding: "16px 14px" }}>
                <div style={{
                  borderRadius: 10, padding: "12px 14px",
                  background: "var(--st-surface-2)", marginBottom: 12,
                }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--st-text-3)", marginBottom: 10 }}>
                    Graph Overview
                  </div>
                  <StatRow label="Screens" value={storeScreens.length} />
                  <StatRow label="Routes" value={storeScreens.length} />
                  <StatRow label="Auth-guarded" value={authGuardedCount} tone="warning" />
                  <StatRow label="Connections" value={edges.length} tone={edges.length > 0 ? "brand" : undefined} />
                </div>

                <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--st-text-3)", marginBottom: 8 }}>
                  Screens
                </div>
                {storeScreens.map((s) => {
                  const auth = authInfo[s.id];
                  return (
                    <div key={s.id}
                      onClick={() => setSelectedId(s.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
                        borderRadius: 7, cursor: "pointer", marginBottom: 3,
                        background: "var(--st-bg)", border: "1px solid var(--st-border)",
                      }}>
                      <Frame size={12} style={{ color: "var(--st-brand)", flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--st-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                        <div style={{ fontSize: 10.5, color: "var(--st-text-3)", fontFamily: "var(--st-mono)" }}>{s.route || "/"}</div>
                      </div>
                      {auth?.required && <ShieldCheck size={11} style={{ color: "var(--st-warning)", flexShrink: 0 }} />}
                    </div>
                  );
                })}

                <p style={{ fontSize: 11, color: "var(--st-text-3)", marginTop: 12, textAlign: "center" }}>
                  Click a screen card to configure its route.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
