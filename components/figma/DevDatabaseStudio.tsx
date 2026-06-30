"use client";

// ═══════════════════════════════════════════════════════════════
// DevDatabaseStudio — the "Dev" tab canvas of the Figma editor.
//
// A Supabase-style visual database builder. Tables are modelled as
// draggable cards on a pan/zoom ERD canvas with foreign-key lines.
// Schema lives in figmaStore.database (rides the file autosave).
// "Deploy" converts to the runtime schema and POSTs to the real
// migration endpoint, which provisions prefixed tables on Postgres.
// ═══════════════════════════════════════════════════════════════

import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  Database, Plus, Trash2, Key, Link2, Circle, Rocket, Code2,
  ZoomIn, ZoomOut, Maximize2, RefreshCw, Table2, ShieldCheck, Terminal, Users, Rows3,
} from "lucide-react";
import { useFigmaStore, type DbField, type DbFieldType, type DbTable, type DbRelation } from "@/lib/stores/figmaStore";
import { dbConfigToRuntimeSchema } from "@/lib/stores/figmaDbToSchema";
import { generateMigrations } from "@/lib/runtime/database";
import { C, inputStyle, iconBtn } from "./dbStudioTheme";
import DataGrid from "./DataGrid";
import SqlEditor from "./SqlEditor";

type StudioView = "schema" | "data" | "sql";

const FIELD_TYPES: DbFieldType[] = [
  "uuid", "text", "integer", "float", "boolean",
  "date", "datetime", "timestamp", "json", "jsonb",
  "enum", "array", "binary",
];

const CARD_W = 256;
const CARD_HEADER_H = 40;
const FIELD_H = 28;
const CARD_FOOTER_H = 32;

type CardPos = { x: number; y: number };
type DeployResult = { success: boolean; applied: string[]; errors: string[]; totalTables: number } | null;

const defaultPos = (i: number): CardPos => ({ x: 60 + (i % 3) * 300, y: 60 + Math.floor(i / 3) * 300 });

// ── FK relation lines ──────────────────────────────────────────────
function FkLines({ tables, positions }: { tables: DbTable[]; positions: Record<string, CardPos> }) {
  const paths: React.ReactNode[] = [];

  tables.forEach((t) => {
    const src = positions[t.id];
    if (!src) return;
    (t.relations ?? []).forEach((r, ri) => {
      const tgt = tables.find((x) => x.name === r.targetTable || x.id === r.targetTable);
      if (!tgt) return;
      const tgtPos = positions[tgt.id];
      if (!tgtPos) return;

      const fkIdx = t.fields.findIndex((f) => f.name === r.foreignKey);
      const tgtFieldIdx = tgt.fields.findIndex((f) => f.name === (r.targetKey ?? "id"));

      const sy = src.y + CARD_HEADER_H + (Math.max(0, fkIdx) + 0.5) * FIELD_H;
      const ty = tgtPos.y + CARD_HEADER_H + (Math.max(0, tgtFieldIdx) + 0.5) * FIELD_H;

      const srcRight = src.x + CARD_W;
      const tgtLeft = tgtPos.x;
      const tgtRight = tgtPos.x + CARD_W;
      let sx: number, tx: number, cpx1: number, cpx2: number;

      if (tgtLeft >= srcRight - 20) {
        sx = srcRight; tx = tgtLeft;
        const d = Math.max(60, tx - sx); cpx1 = sx + d * 0.5; cpx2 = tx - d * 0.5;
      } else if (tgtRight <= src.x + 20) {
        sx = src.x; tx = tgtRight;
        const d = Math.max(60, sx - tx); cpx1 = sx - d * 0.5; cpx2 = tx + d * 0.5;
      } else {
        sx = srcRight; tx = tgtLeft; cpx1 = sx + 80; cpx2 = tx - 80;
      }

      paths.push(
        <g key={`${t.id}-${ri}`}>
          <path d={`M ${sx} ${sy} C ${cpx1} ${sy} ${cpx2} ${ty} ${tx} ${ty}`}
            fill="none" stroke={C.accent} strokeWidth={1.5} strokeOpacity={0.7} />
          <circle cx={sx} cy={sy} r={3} fill={C.accent} />
          <circle cx={tx} cy={ty} r={3} fill={C.accent} />
        </g>
      );
    });
  });

  const posVals = Object.values(positions);
  const maxX = Math.max(1400, ...posVals.map((p) => p.x + CARD_W)) + 300;
  const maxY = Math.max(900, ...posVals.map((p) => p.y + 400)) + 200;

  return (
    <svg style={{ position: "absolute", top: 0, left: 0, width: maxX, height: maxY, pointerEvents: "none" }}>
      {paths}
    </svg>
  );
}

// ── Field row icon ──────────────────────────────────────────────────
function FieldIcon({ field }: { field: DbField }) {
  if (field.primary) return <Key size={10} style={{ color: C.pk }} />;
  if (field.name.endsWith("_id")) return <Link2 size={10} style={{ color: C.textDim }} />;
  if (field.unique) return <Circle size={10} style={{ color: C.accent }} />;
  return <span style={{ display: "inline-block", width: 10, height: 10 }} />;
}

// ── ERD table card ──────────────────────────────────────────────────
function ErdCard({
  table, pos, isActive, onHeaderMouseDown, onActivate, onDelete, onAddField,
}: {
  table: DbTable; pos: CardPos; isActive: boolean;
  onHeaderMouseDown: (e: React.MouseEvent) => void;
  onActivate: () => void; onDelete: () => void; onAddField: () => void;
}) {
  return (
    <div onMouseDown={onActivate}
      style={{ position: "absolute", left: pos.x, top: pos.y, width: CARD_W, userSelect: "none", zIndex: isActive ? 10 : 1 }}>
      <div style={{
        borderRadius: 8,
        border: `1px solid ${isActive ? C.accent : C.border}`,
        overflow: "hidden", background: C.panel,
        boxShadow: isActive ? `0 0 0 1px ${C.accent}55, 0 12px 40px rgba(0,0,0,0.6)` : "0 4px 24px rgba(0,0,0,0.5)",
      }}>
        <div onMouseDown={onHeaderMouseDown}
          style={{ height: CARD_HEADER_H, display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0 8px 0 12px", background: C.panelAlt, borderBottom: `1px solid ${C.border}`, cursor: "grab" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <Database size={13} style={{ color: C.accent, flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: C.text, fontFamily: "monospace",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{table.name}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 9, color: C.textDim, background: C.bg, borderRadius: 10, padding: "1px 6px" }}>
              {table.fields.length}
            </span>
            <button type="button" onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              style={{ display: "flex", width: 22, height: 22, alignItems: "center", justifyContent: "center",
                borderRadius: 4, border: "none", background: "none", cursor: "pointer", color: C.textDim }}>
              <Trash2 size={11} />
            </button>
          </div>
        </div>

        <div>
          {table.fields.map((f) => (
            <div key={f.id} style={{ height: FIELD_H, display: "flex", alignItems: "center", gap: 7,
              padding: "0 10px 0 12px", borderBottom: `1px solid ${C.borderSoft}` }}>
              <span style={{ width: 14, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FieldIcon field={f} />
              </span>
              <span style={{ flex: 1, fontSize: 11, color: C.textMuted, fontFamily: "monospace",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
              <span style={{ fontSize: 9, color: C.textDim, background: C.bg, borderRadius: 4, padding: "1px 5px",
                fontWeight: 600, textTransform: "uppercase", flexShrink: 0 }}>{f.type}</span>
              <span style={{ width: 12, flexShrink: 0, fontSize: 10, textAlign: "center",
                color: f.nullable === false || f.primary ? C.pk : "#444" }}>
                {f.nullable === false || f.primary ? "◆" : "◇"}
              </span>
            </div>
          ))}
        </div>

        <div style={{ height: CARD_FOOTER_H, display: "flex", alignItems: "center", justifyContent: "center",
          borderTop: `1px solid ${C.borderSoft}` }}>
          <button type="button" onClick={(e) => { e.stopPropagation(); onAddField(); }}
            style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.textDim,
              background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 4 }}>
            <Plus size={10} /> Add field
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tiny reusable controls ─────────────────────────────────────────
function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none",
        cursor: "pointer", padding: "3px 0", color: on ? C.text : C.textDim, fontSize: 11 }}>
      <span style={{ width: 26, height: 15, borderRadius: 8, background: on ? C.accent : "#555",
        position: "relative", transition: "background .15s", flexShrink: 0 }}>
        <span style={{ position: "absolute", top: 2, left: on ? 13 : 2, width: 11, height: 11, borderRadius: "50%",
          background: "#fff", transition: "left .15s" }} />
      </span>
      {label}
    </button>
  );
}

// ── Inspector: edit the active table ────────────────────────────────
function TableInspector({ table, allTables }: { table: DbTable; allTables: DbTable[] }) {
  const { updateTable, updateField, deleteField, addField, addRelation, deleteRelation } = useFigmaStore();

  return (
    <aside style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column",
      background: C.panel, borderLeft: `1px solid ${C.border}`, overflow: "hidden" }}>
      <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.border}` }}>
        <label style={{ fontSize: 9, fontWeight: 700, color: C.textDim, letterSpacing: ".1em", textTransform: "uppercase" }}>
          Table name
        </label>
        <input value={table.name} spellCheck={false}
          onChange={(e) => updateTable(table.id, { name: e.target.value.replace(/[^a-zA-Z0-9_]/g, "_") })}
          style={{ ...inputStyle, marginTop: 6, fontSize: 12 }} />
        <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
          <Toggle on={table.timestamps} label="Timestamps" onClick={() => updateTable(table.id, { timestamps: !table.timestamps })} />
          <Toggle on={table.softDelete} label="Soft delete" onClick={() => updateTable(table.id, { softDelete: !table.softDelete })} />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* Fields */}
        <div style={{ padding: "10px 14px 4px", fontSize: 9, fontWeight: 700, color: C.textDim, letterSpacing: ".1em", textTransform: "uppercase" }}>
          Columns
        </div>
        <div style={{ padding: "0 10px" }}>
          {table.fields.map((f) => (
            <div key={f.id} style={{ background: C.bg, border: `1px solid ${C.borderSoft}`, borderRadius: 6, padding: 8, marginBottom: 6 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input value={f.name} spellCheck={false} disabled={f.primary}
                  onChange={(e) => updateField(table.id, f.id, { name: e.target.value.replace(/[^a-zA-Z0-9_]/g, "_") })}
                  style={{ ...inputStyle, flex: 1, opacity: f.primary ? 0.6 : 1 }} />
                <select value={f.type} disabled={f.primary}
                  onChange={(e) => updateField(table.id, f.id, { type: e.target.value as DbFieldType })}
                  style={{ ...inputStyle, width: 90, cursor: "pointer" }}>
                  {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                {!f.primary && (
                  <button type="button" onClick={() => deleteField(table.id, f.id)}
                    style={{ background: "none", border: "none", color: C.textDim, cursor: "pointer", padding: 2, flexShrink: 0 }}>
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
              {!f.primary && (
                <div style={{ display: "flex", gap: 12, marginTop: 7, flexWrap: "wrap" }}>
                  <Toggle on={f.nullable === false} label="Required" onClick={() => updateField(table.id, f.id, { nullable: !(f.nullable === false) })} />
                  <Toggle on={!!f.unique} label="Unique" onClick={() => updateField(table.id, f.id, { unique: !f.unique })} />
                </div>
              )}
              {f.type === "enum" && !f.primary && (
                <input placeholder="enum values, comma-separated" spellCheck={false} value={f.enumValues ?? ""}
                  onChange={(e) => updateField(table.id, f.id, { enumValues: e.target.value })}
                  style={{ ...inputStyle, marginTop: 6 }} />
              )}
            </div>
          ))}
          <button type="button"
            onClick={() => addField(table.id, { name: `field_${table.fields.length + 1}`, type: "text", nullable: true })}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, width: "100%",
              padding: 7, borderRadius: 6, border: `1px dashed ${C.border}`, background: "none",
              color: C.textDim, fontSize: 11, cursor: "pointer", marginBottom: 10 }}>
            <Plus size={11} /> Add column
          </button>
        </div>

        {/* Relations */}
        <div style={{ padding: "4px 14px 4px", fontSize: 9, fontWeight: 700, color: C.textDim, letterSpacing: ".1em", textTransform: "uppercase" }}>
          Foreign keys
        </div>
        <div style={{ padding: "0 10px 14px" }}>
          {(table.relations ?? []).map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: C.bg,
              border: `1px solid ${C.borderSoft}`, borderRadius: 6, padding: "6px 8px", marginBottom: 6, fontSize: 11, color: C.textMuted, fontFamily: "monospace" }}>
              <Link2 size={11} style={{ color: C.accent, flexShrink: 0 }} />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.foreignKey} → {r.targetTable}
              </span>
              <button type="button" onClick={() => deleteRelation(table.id, i)}
                style={{ background: "none", border: "none", color: C.textDim, cursor: "pointer", padding: 2 }}>
                <Trash2 size={11} />
              </button>
            </div>
          ))}
          <RelationAdder table={table} allTables={allTables}
            onAdd={(rel, fkField) => {
              // ensure the FK column exists on this table
              if (!table.fields.some((f) => f.name === fkField)) {
                addField(table.id, { name: fkField, type: "uuid", nullable: true });
              }
              addRelation(table.id, rel);
            }} />
        </div>
      </div>
    </aside>
  );
}

function RelationAdder({ table, allTables, onAdd }: {
  table: DbTable; allTables: DbTable[];
  onAdd: (rel: DbRelation, fkField: string) => void;
}) {
  const candidates = allTables.filter((t) => t.id !== table.id);
  const [picked, setPicked] = useState("");

  if (candidates.length === 0) {
    return <p style={{ fontSize: 10, color: C.textDim, margin: "2px 0 0" }}>Add another table to create a relation.</p>;
  }

  // Derive the effective target (default to first candidate) without an effect.
  const target = picked && candidates.some((t) => t.name === picked) ? picked : candidates[0].name;
  const fkField = `${target}_id`;

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2 }}>
      <select value={target} onChange={(e) => setPicked(e.target.value)} style={{ ...inputStyle, flex: 1, cursor: "pointer" }}>
        {candidates.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
      </select>
      <button type="button"
        onClick={() => onAdd({ type: "one-to-many", targetTable: target, foreignKey: fkField, targetKey: "id", onDelete: "cascade" }, fkField)}
        style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 6,
          border: "none", background: C.accentSoft, color: C.accent, fontSize: 11, cursor: "pointer", flexShrink: 0 }}>
        <Plus size={11} /> FK
      </button>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────
export default function DevDatabaseStudio({ projectId }: { projectId?: string }) {
  const database = useFigmaStore((s) => s.database);
  const addTable = useFigmaStore((s) => s.addTable);
  const deleteTable = useFigmaStore((s) => s.deleteTable);
  const addField = useFigmaStore((s) => s.addField);
  const tables = useMemo(() => database.tables ?? [], [database.tables]);

  // Card positions: only user-dragged overrides live in state; everything
  // else falls back to a deterministic default layout (no setState-in-effect).
  const [overrides, setOverrides] = useState<Record<string, CardPos>>({});
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [activeCard, setActiveCard] = useState<string | null>(null);
  const [showSQL, setShowSQL] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<DeployResult>(null);
  const [view, setView] = useState<StudioView>("schema");

  const positions = useMemo(() => {
    const m: Record<string, CardPos> = {};
    tables.forEach((t, i) => { m[t.id] = overrides[t.id] ?? defaultPos(i); });
    return m;
  }, [tables, overrides]);

  const dragRef = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const panRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => Math.min(2.5, Math.max(0.2, z * (e.deltaY > 0 ? 0.9 : 1.1))));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onCardHeaderDown = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveCard(id);
    const idx = tables.findIndex((t) => t.id === id);
    const p = overrides[id] ?? defaultPos(idx);
    dragRef.current = { id, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y };
  }, [overrides, tables]);

  const onCanvasDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setActiveCard(null);
    panRef.current = { sx: e.clientX, sy: e.clientY, ox: pan.x, oy: pan.y };
  }, [pan]);

  const onMove = useCallback((e: React.MouseEvent) => {
    if (dragRef.current) {
      const d = dragRef.current;
      const dx = (e.clientX - d.sx) / zoom, dy = (e.clientY - d.sy) / zoom;
      setOverrides((p) => ({ ...p, [d.id]: { x: d.ox + dx, y: d.oy + dy } }));
    } else if (panRef.current) {
      const p = panRef.current;
      setPan({ x: p.ox + (e.clientX - p.sx), y: p.oy + (e.clientY - p.sy) });
    }
  }, [zoom]);

  const onUp = useCallback(() => { dragRef.current = null; panRef.current = null; }, []);

  const handleAddTable = useCallback(() => {
    addTable(`table_${tables.length + 1}`);
    // zustand set is synchronous — read the new table and select it.
    const after = useFigmaStore.getState().database.tables;
    const newest = after[after.length - 1];
    if (newest) setActiveCard(newest.id);
  }, [addTable, tables.length]);

  const sql = useMemo(() => {
    try {
      const schema = dbConfigToRuntimeSchema(database);
      if (!schema.tables.length) return "-- Add a table to see generated SQL";
      return generateMigrations(schema).map((m) => m.upSQL).join("\n\n");
    } catch (e) {
      return `-- SQL preview error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }, [database]);

  const handleDeploy = useCallback(async () => {
    if (!projectId) {
      setDeployResult({ success: false, applied: [], errors: ["No project — open a saved project to deploy."], totalTables: 0 });
      return;
    }
    if (!tables.length) {
      setDeployResult({ success: false, applied: [], errors: ["No tables defined yet."], totalTables: 0 });
      return;
    }
    setDeploying(true);
    setDeployResult(null);
    try {
      const schema = dbConfigToRuntimeSchema(database);
      const res = await fetch(`/api/db/migrate/${projectId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schema }),
      });
      const json = await res.json();
      if (!res.ok) {
        setDeployResult({ success: false, applied: [], errors: [json.error ?? `HTTP ${res.status}`], totalTables: tables.length });
      } else {
        setDeployResult(json);
      }
    } catch (e) {
      setDeployResult({ success: false, applied: [], errors: [e instanceof Error ? e.message : "DB bridge unreachable"], totalTables: tables.length });
    }
    setDeploying(false);
  }, [projectId, database, tables.length]);

  const activeTable = tables.find((t) => t.id === activeCard) ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, background: C.bg, color: C.text }}>
      {/* Toolbar */}
      <div style={{ height: 44, display: "flex", alignItems: "center", gap: 6, padding: "0 12px",
        background: C.panel, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <Database size={14} style={{ color: C.accent }} />
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".04em" }}>Database</span>
        <span style={{ fontSize: 10, color: C.textDim, marginLeft: 4 }}>
          {tables.length} table{tables.length !== 1 ? "s" : ""} · provider: {database.provider}
        </span>
        <div style={{ flex: 1 }} />
        {view === "schema" && (
          <>
            <button title="Zoom out" onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))} style={iconBtn}><ZoomOut size={14} /></button>
            <span style={{ fontSize: 11, color: C.textDim, minWidth: 38, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
            <button title="Zoom in" onClick={() => setZoom((z) => Math.min(2.5, z + 0.1))} style={iconBtn}><ZoomIn size={14} /></button>
            <button title="Reset view" onClick={() => { setZoom(1); setPan({ x: 40, y: 40 }); }} style={iconBtn}><Maximize2 size={14} /></button>
            <div style={{ width: 1, height: 18, background: C.border, margin: "0 4px" }} />
            <button title="Toggle SQL" onClick={() => setShowSQL((v) => !v)} style={{ ...iconBtn, color: showSQL ? C.accent : C.textMuted }}><Code2 size={14} /></button>
            <div style={{ width: 1, height: 18, background: C.border, margin: "0 4px" }} />
          </>
        )}
        <button onClick={handleDeploy} disabled={deploying}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 6, border: "none",
            background: deploying ? "#0a6cb3" : C.accent, color: "#fff", fontSize: 12, fontWeight: 700,
            cursor: deploying ? "wait" : "pointer" }}>
          {deploying ? <RefreshCw size={12} style={{ animation: "ddstudio-spin .8s linear infinite" }} /> : <Rocket size={12} />}
          {deploying ? "Deploying…" : "Deploy DB"}
        </button>
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Left nav */}
        <aside style={{ width: 200, flexShrink: 0, display: "flex", flexDirection: "column",
          background: C.panel, borderRight: `1px solid ${C.border}`, overflow: "hidden" }}>
          <div style={{ padding: "10px 12px 4px", fontSize: 9, fontWeight: 700, color: C.textDim, letterSpacing: ".1em", textTransform: "uppercase" }}>
            Manage
          </div>
          <div style={{ padding: "0 6px 6px" }}>
            <NavItem icon={<Table2 size={13} />} label="Schema" active={view === "schema"} count={tables.length}
              onClick={() => setView("schema")} />
            <NavItem icon={<Rows3 size={13} />} label="Data" active={view === "data"}
              onClick={() => { setView("data"); if (!activeCard && tables[0]) setActiveCard(tables[0].id); }} />
            <NavItem icon={<Terminal size={13} />} label="SQL Editor" active={view === "sql"}
              onClick={() => setView("sql")} />
            <NavItem icon={<ShieldCheck size={13} />} label="Policies" soon />
            <NavItem icon={<Users size={13} />} label="Auth" soon />
          </div>

          <div style={{ padding: "8px 12px 4px", fontSize: 9, fontWeight: 700, color: C.textDim, letterSpacing: ".1em", textTransform: "uppercase" }}>
            Tables
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "0 6px" }}>
            {tables.length === 0 ? (
              <p style={{ padding: "10px 8px", fontSize: 11, color: C.textDim, textAlign: "center" }}>No tables yet</p>
            ) : tables.map((t) => {
              const on = activeCard === t.id;
              return (
                <div key={t.id} onClick={() => setActiveCard(t.id)}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 6,
                    cursor: "pointer", background: on ? C.accentSoft : "none",
                    borderLeft: `2px solid ${on ? C.accent : "transparent"}` }}>
                  <Database size={11} style={{ color: on ? C.accent : C.textDim, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 11, color: on ? C.text : C.textMuted, fontFamily: "monospace",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
                  <span style={{ fontSize: 9, color: C.textDim }}>{t.fields.length}</span>
                </div>
              );
            })}
          </div>
          <div style={{ padding: 8, borderTop: `1px solid ${C.border}` }}>
            <button onClick={handleAddTable}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%",
                padding: 8, borderRadius: 6, border: `1px dashed ${C.border}`, background: "none", color: C.textMuted, fontSize: 11, cursor: "pointer" }}>
              <Plus size={11} /> New Table
            </button>
          </div>
        </aside>

        {view === "schema" ? (
        <>
        {/* ERD canvas */}
        <div ref={canvasRef}
          style={{ flex: 1, position: "relative", overflow: "hidden", background: C.canvas, cursor: "default", userSelect: "none" }}
          onMouseDown={onCanvasDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}>
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
            <defs>
              <pattern id="ddstudio-dots" x={(pan.x % 24).toString()} y={(pan.y % 24).toString()} width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="0.8" fill="#2a2a2a" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#ddstudio-dots)" />
          </svg>

          <div style={{ position: "absolute", top: 0, left: 0, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}>
            <FkLines tables={tables} positions={positions} />
            {tables.map((t) => (
              <ErdCard key={t.id} table={t} pos={positions[t.id] ?? { x: 0, y: 0 }} isActive={activeCard === t.id}
                onHeaderMouseDown={(e) => onCardHeaderDown(t.id, e)}
                onActivate={() => setActiveCard(t.id)}
                onDelete={() => { deleteTable(t.id); if (activeCard === t.id) setActiveCard(null); }}
                onAddField={() => addField(t.id, { name: `field_${t.fields.length + 1}`, type: "text", nullable: true })} />
            ))}
          </div>

          {tables.length === 0 && (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: 14, pointerEvents: "none" }}>
              <Database size={42} style={{ color: "#333" }} />
              <p style={{ fontSize: 13, color: C.textDim, margin: 0 }}>Design your project&apos;s database</p>
              <button onClick={handleAddTable}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 6, border: "none",
                  background: C.accent, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", pointerEvents: "all" }}>
                <Plus size={12} /> Add Table
              </button>
            </div>
          )}
        </div>

        {/* Inspector */}
        {activeTable && <TableInspector table={activeTable} allTables={tables} />}
        </>
        ) : view === "data" ? (
          activeTable
            ? <DataGrid key={activeTable.id} projectId={projectId} table={activeTable} />
            : <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                color: C.textDim, fontSize: 12, background: C.canvas }}>
                Select a table on the left to view its data.
              </div>
        ) : (
          <SqlEditor projectId={projectId} />
        )}
      </div>

      {/* SQL preview */}
      {showSQL && view === "schema" && (
        <div style={{ borderTop: `1px solid ${C.border}`, background: C.panel, flexShrink: 0, maxHeight: 220, display: "flex", flexDirection: "column" }}>
          <div style={{ height: 30, display: "flex", alignItems: "center", gap: 8, padding: "0 12px", borderBottom: `1px solid ${C.border}` }}>
            <Code2 size={11} style={{ color: C.accent }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: ".08em", textTransform: "uppercase" }}>
              Generated SQL (preview)
            </span>
            <span style={{ fontSize: 9, color: C.textDim }}>· tables are prefixed per-project on deploy</span>
          </div>
          <pre style={{ margin: 0, padding: 12, overflow: "auto", flex: 1, fontSize: 11, lineHeight: 1.6,
            color: C.textMuted, fontFamily: "monospace", whiteSpace: "pre" }}>{sql}</pre>
        </div>
      )}

      {/* Deploy toast */}
      {deployResult && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 200, maxWidth: 340,
          background: C.panel, border: `1px solid ${deployResult.success ? C.ok : C.err}`, borderRadius: 8,
          padding: "12px 16px", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, margin: "0 0 4px", color: deployResult.success ? C.ok : C.err }}>
                {deployResult.success ? "✓ Deployed to Postgres" : "✗ Deploy failed"}
              </p>
              {deployResult.success ? (
                <p style={{ fontSize: 11, color: C.textMuted, margin: 0 }}>
                  {deployResult.applied.length} migration{deployResult.applied.length !== 1 ? "s" : ""} applied · {deployResult.totalTables} table{deployResult.totalTables !== 1 ? "s" : ""}
                </p>
              ) : deployResult.errors.map((e, i) => (
                <p key={i} style={{ fontSize: 11, color: C.textMuted, margin: 0 }}>{e}</p>
              ))}
            </div>
            <button onClick={() => setDeployResult(null)}
              style={{ background: "none", border: "none", color: C.textDim, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 2px", flexShrink: 0 }}>×</button>
          </div>
        </div>
      )}

      <style>{`@keyframes ddstudio-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function NavItem({ icon, label, active, soon, count, onClick }: {
  icon: React.ReactNode; label: string; active?: boolean; soon?: boolean; count?: number; onClick?: () => void;
}) {
  return (
    <div onClick={soon ? undefined : onClick}
      style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 6,
      background: active ? C.accentSoft : "none", color: active ? C.text : soon ? "#5a5a5a" : C.textMuted,
      cursor: soon ? "default" : "pointer" }}>
      <span style={{ color: active ? C.accent : "inherit", display: "flex" }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 12 }}>{label}</span>
      {soon && <span style={{ fontSize: 8, color: "#5a5a5a", border: `1px solid #444`, borderRadius: 4, padding: "0 4px", textTransform: "uppercase", letterSpacing: ".05em" }}>soon</span>}
      {count != null && count > 0 && <span style={{ fontSize: 9, color: C.textDim, background: C.bg, borderRadius: 10, padding: "1px 6px" }}>{count}</span>}
    </div>
  );
}
