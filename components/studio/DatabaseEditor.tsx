"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import type { CSSProperties } from "react";
import { v4 as uuid } from "uuid";
import {
  Plus, Trash2, Code2, Key, Link2, Rocket, Database,
  ZoomIn, ZoomOut, Maximize2, Circle, RefreshCw,
} from "lucide-react";
import { useRuntimeStore } from "@/lib/runtime/runtime-store";
import type { TableSchema, FieldSchema } from "@/lib/runtime/schema";

// ── Constants ─────────────────────────────────────────────────────
const CARD_W = 260;
const CARD_HEADER_H = 42;
const FIELD_H = 30;
const CARD_FOOTER_H = 36;

// ── SQL generation (preserved export) ────────────────────────────
export function genSQL(tables: TableSchema[]): string {
  const pgType: Record<string, string> = {
    uuid: "UUID", text: "TEXT", integer: "INTEGER", float: "FLOAT",
    boolean: "BOOLEAN", timestamp: "TIMESTAMPTZ", jsonb: "JSONB",
  };
  return tables.map((t) => {
    const cols = t.fields.map((f) => {
      const pk = f.name === "id" ? " PRIMARY KEY" : "";
      const nn = f.required ? " NOT NULL" : "";
      const uq = f.unique && !pk ? " UNIQUE" : "";
      return `  ${f.name} ${pgType[f.type] ?? "TEXT"}${pk}${nn}${uq}`;
    });
    const fks = t.relations.map((r) =>
      `  FOREIGN KEY (${r.foreignKey}) REFERENCES ${r.targetTable}(${r.targetKey ?? "id"})`
    );
    return `CREATE TABLE IF NOT EXISTS ${t.name} (\n${[...cols, ...fks].join(",\n")}\n);`;
  }).join("\n\n");
}

// ── Types ─────────────────────────────────────────────────────────
type CardPos = { x: number; y: number };
const defaultPos = (i: number): CardPos => ({ x: 60 + (i % 3) * 320, y: 80 + Math.floor(i / 3) * 320 });
type DeployResult = {
  success: boolean;
  applied: string[];
  errors: string[];
  totalTables: number;
} | null;

// ── Shared style constants ────────────────────────────────────────
const iconBtn: CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: 28, height: 28, borderRadius: 6, border: "none",
  background: "none", cursor: "pointer",
};

// ── Field icon ────────────────────────────────────────────────────
function FieldIcon({ field }: { field: FieldSchema }) {
  if (field.name === "id") return <Key size={10} style={{ color: "#eab308" }} />;
  if (field.name.endsWith("_id")) return <Link2 size={10} style={{ color: "#6b7280" }} />;
  if (field.unique) return <Circle size={10} style={{ color: "#22c55e" }} />;
  return <span style={{ display: "inline-block", width: 10, height: 10 }} />;
}

// ── FK bezier relation lines ──────────────────────────────────────
function FkLines({
  tables,
  positions,
}: {
  tables: TableSchema[];
  positions: Record<string, CardPos>;
}) {
  const paths: React.ReactNode[] = [];

  tables.forEach((t) => {
    const src = positions[t.id];
    if (!src) return;

    t.relations.forEach((r, ri) => {
      const tgt = tables.find(
        (x) => x.id === r.targetTable || x.name === r.targetTable
      );
      if (!tgt) return;
      const tgtPos = positions[tgt.id];
      if (!tgtPos) return;

      const fkIdx = t.fields.findIndex((f) => f.name === r.foreignKey);
      const tgtFieldIdx = tgt.fields.findIndex(
        (f) => f.name === (r.targetKey ?? "id")
      );

      const sy =
        src.y + CARD_HEADER_H + (Math.max(0, fkIdx) + 0.5) * FIELD_H;
      const ty =
        tgtPos.y +
        CARD_HEADER_H +
        (Math.max(0, tgtFieldIdx) + 0.5) * FIELD_H;

      const srcRight = src.x + CARD_W;
      const tgtLeft = tgtPos.x;
      const tgtRight = tgtPos.x + CARD_W;

      let sx: number, tx: number, cpx1: number, cpx2: number;

      if (tgtLeft >= srcRight - 20) {
        sx = srcRight;
        tx = tgtLeft;
        const dist = Math.max(60, tx - sx);
        cpx1 = sx + dist * 0.5;
        cpx2 = tx - dist * 0.5;
      } else if (tgtRight <= src.x + 20) {
        sx = src.x;
        tx = tgtRight;
        const dist = Math.max(60, sx - tx);
        cpx1 = sx - dist * 0.5;
        cpx2 = tx + dist * 0.5;
      } else {
        sx = srcRight;
        tx = tgtLeft;
        cpx1 = sx + 80;
        cpx2 = tx - 80;
      }

      paths.push(
        <g key={`${t.id}-${ri}`}>
          <path
            d={`M ${sx} ${sy} C ${cpx1} ${sy} ${cpx2} ${ty} ${tx} ${ty}`}
            fill="none"
            stroke="#22c55e"
            strokeWidth={1.5}
            strokeOpacity={0.6}
          />
          <circle cx={sx} cy={sy} r={3} fill="#22c55e" fillOpacity={0.8} />
          <circle cx={tx} cy={ty} r={3} fill="#22c55e" fillOpacity={0.8} />
        </g>
      );
    });
  });

  const posVals = Object.values(positions);
  const maxX =
    Math.max(1400, ...posVals.map((p) => p.x + CARD_W)) + 300;
  const maxY =
    Math.max(900, ...posVals.map((p) => p.y + 400)) + 200;

  return (
    <svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: maxX,
        height: maxY,
        pointerEvents: "none",
      }}
    >
      {paths}
    </svg>
  );
}

// ── ERD Table Card ────────────────────────────────────────────────
function ErdCard({
  table,
  pos,
  isActive,
  onHeaderMouseDown,
  onDelete,
  onAddField,
  onActivate,
}: {
  table: TableSchema;
  pos: CardPos;
  isActive: boolean;
  onHeaderMouseDown: (e: React.MouseEvent) => void;
  onDelete: () => void;
  onAddField: () => void;
  onActivate: () => void;
}) {
  return (
    <div
      onMouseDown={onActivate}
      style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        width: CARD_W,
        userSelect: "none",
        zIndex: isActive ? 10 : 1,
      }}
    >
      <div
        style={{
          borderRadius: 8,
          border: `1px solid ${isActive ? "#22c55e66" : "#222222"}`,
          overflow: "hidden",
          background: "#111111",
          boxShadow: isActive
            ? "0 0 0 1px #22c55e33, 0 12px 40px rgba(0,0,0,0.7)"
            : "0 4px 24px rgba(0,0,0,0.6)",
        }}
      >
        {/* Drag handle header */}
        <div
          onMouseDown={onHeaderMouseDown}
          style={{
            height: CARD_HEADER_H,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 10px 0 12px",
            background: "#161616",
            borderBottom: "1px solid #222222",
            cursor: "grab",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              minWidth: 0,
            }}
          >
            <Database
              size={13}
              style={{ color: "#22c55e", flexShrink: 0 }}
            />
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#e5e7eb",
                fontFamily: "var(--st-mono, monospace)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {table.name}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span
              style={{
                fontSize: 9,
                color: "#6b7280",
                background: "#1e1e1e",
                borderRadius: 10,
                padding: "1px 6px",
              }}
            >
              {table.fields.length}
            </span>
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 22,
                height: 22,
                borderRadius: 4,
                border: "none",
                background: "none",
                cursor: "pointer",
                color: "#6b7280",
              }}
            >
              <Trash2 size={11} />
            </button>
          </div>
        </div>

        {/* Fields list */}
        <div>
          {table.fields.map((f) => (
            <div
              key={f.name}
              style={{
                height: FIELD_H,
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "0 10px 0 12px",
                borderBottom: "1px solid #1a1a1a",
              }}
            >
              <span
                style={{
                  width: 14,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <FieldIcon field={f} />
              </span>
              <span
                style={{
                  flex: 1,
                  fontSize: 11,
                  color: "#d1d5db",
                  fontFamily: "var(--st-mono, monospace)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {f.name}
              </span>
              <span
                style={{
                  fontSize: 9,
                  color: "#4b5563",
                  background: "#1a1a1a",
                  borderRadius: 4,
                  padding: "1px 5px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  flexShrink: 0,
                }}
              >
                {f.type}
              </span>
              <span
                style={{
                  width: 12,
                  flexShrink: 0,
                  fontSize: 10,
                  color: f.required ? "#f59e0b" : "#2a2a2a",
                  textAlign: "center",
                }}
              >
                {f.required ? "◆" : "◇"}
              </span>
            </div>
          ))}
        </div>

        {/* Add field footer */}
        <div
          style={{
            height: CARD_FOOTER_H,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderTop: "1px solid #1a1a1a",
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddField();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11,
              color: "#4b5563",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: 4,
            }}
          >
            <Plus size={10} />
            Add field
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────
export function DatabaseEditor({ projectId }: { projectId?: string }) {
  const { schema, addTable, removeTable, addField } = useRuntimeStore();
  const tables: TableSchema[] = useMemo(() => schema.database?.tables ?? [], [schema.database?.tables]);

  // Only user-dragged overrides live in state; everything else falls back to a
  // deterministic default layout (avoids setState-in-effect for new tables).
  const [overrides, setOverrides] = useState<Record<string, CardPos>>({});
  const positions = useMemo(() => {
    const m: Record<string, CardPos> = {};
    tables.forEach((t, i) => { m[t.id] = overrides[t.id] ?? defaultPos(i); });
    return m;
  }, [tables, overrides]);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 60, y: 40 });
  const [activeCard, setActiveCard] = useState<string | null>(null);
  const [rawSQL, setRawSQL] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<DeployResult>(null);

  const dragRef = useRef<{
    cardId: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const panRef = useRef<{
    startX: number;
    startY: number;
    origPanX: number;
    origPanY: number;
  } | null>(null);
  const erdRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = erdRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((z) => Math.min(2.5, Math.max(0.2, z * factor)));
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const onCardHeaderMouseDown = useCallback(
    (cardId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setActiveCard(cardId);
      const idx = tables.findIndex((t) => t.id === cardId);
      const pos = overrides[cardId] ?? defaultPos(idx);
      dragRef.current = {
        cardId,
        startX: e.clientX,
        startY: e.clientY,
        origX: pos.x,
        origY: pos.y,
      };
    },
    [overrides, tables]
  );

  const onCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      setActiveCard(null);
      panRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origPanX: pan.x,
        origPanY: pan.y,
      };
    },
    [pan]
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragRef.current) {
        const d = dragRef.current;
        const dx = (e.clientX - d.startX) / zoom;
        const dy = (e.clientY - d.startY) / zoom;
        setOverrides((prev) => ({
          ...prev,
          [d.cardId]: { x: d.origX + dx, y: d.origY + dy },
        }));
      } else if (panRef.current) {
        const p = panRef.current;
        setPan({
          x: p.origPanX + (e.clientX - p.startX),
          y: p.origPanY + (e.clientY - p.startY),
        });
      }
    },
    [zoom]
  );

  const onMouseUp = useCallback(() => {
    dragRef.current = null;
    panRef.current = null;
  }, []);

  const addNewTable = useCallback(() => {
    const id = uuid();
    const i = tables.length;
    addTable({
      id,
      name: `table_${i + 1}`,
      fields: [{ name: "id", type: "uuid", required: true, unique: true }],
      relations: [],
      indexes: [],
      policies: [],
    });
    setActiveCard(id);
  }, [addTable, tables.length]);

  const deleteTable = useCallback(
    (id: string) => {
      removeTable(id);
      setOverrides((prev) => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
      if (activeCard === id) setActiveCard(null);
    },
    [removeTable, activeCard]
  );

  const addNewField = useCallback(
    (tableId: string) => {
      const tbl = tables.find((t) => t.id === tableId);
      if (!tbl) return;
      addField(tableId, {
        name: `field_${tbl.fields.length + 1}`,
        type: "text",
        required: false,
        unique: false,
      });
    },
    [addField, tables]
  );

  const handleDeploy = useCallback(async () => {
    if (!projectId) {
      setDeployResult({
        success: false,
        applied: [],
        errors: ["No projectId — cannot deploy"],
        totalTables: 0,
      });
      return;
    }
    if (!tables.length) {
      setDeployResult({
        success: false,
        applied: [],
        errors: ["No tables defined. Add tables first."],
        totalTables: 0,
      });
      return;
    }
    setDeploying(true);
    setDeployResult(null);
    try {
      const res = await fetch(`/api/db/migrate/${projectId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schema: schema.database }),
      });
      const json = await res.json();
      if (!res.ok) {
        setDeployResult({
          success: false,
          applied: [],
          errors: [json.error ?? `HTTP ${res.status}`],
          totalTables: tables.length,
        });
      } else {
        setDeployResult(json);
      }
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : "Network error — DB bridge unreachable";
      setDeployResult({
        success: false,
        applied: [],
        errors: [msg],
        totalTables: tables.length,
      });
    }
    setDeploying(false);
  }, [projectId, tables, schema.database]);

  const sql = useMemo(() => genSQL(tables), [tables]);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        background: "#0a0a0a",
        overflow: "hidden",
      }}
    >
      {/* ── Top toolbar ── */}
      <div
        style={{
          height: 44,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "0 12px",
          background: "#0f0f0f",
          borderBottom: "1px solid #1e1e1e",
          flexShrink: 0,
        }}
      >
        <Database size={13} style={{ color: "#22c55e" }} />
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#4b5563",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Schema
        </span>
        <div style={{ flex: 1 }} />

        <button
          style={iconBtn}
          title="Zoom in"
          onClick={() => setZoom((z) => Math.min(2.5, z + 0.1))}
        >
          <ZoomIn size={13} style={{ color: "#6b7280" }} />
        </button>
        <span
          style={{
            fontSize: 11,
            color: "#374151",
            minWidth: 38,
            textAlign: "center",
          }}
        >
          {Math.round(zoom * 100)}%
        </span>
        <button
          style={iconBtn}
          title="Zoom out"
          onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))}
        >
          <ZoomOut size={13} style={{ color: "#6b7280" }} />
        </button>
        <button
          style={iconBtn}
          title="Reset view"
          onClick={() => {
            setZoom(1);
            setPan({ x: 60, y: 40 });
          }}
        >
          <Maximize2 size={13} style={{ color: "#6b7280" }} />
        </button>

        <div
          style={{
            width: 1,
            height: 18,
            background: "#222222",
            margin: "0 4px",
          }}
        />

        <button
          style={{ ...iconBtn, color: rawSQL ? "#22c55e" : "#6b7280" }}
          title="Toggle SQL"
          onClick={() => setRawSQL((v) => !v)}
        >
          <Code2 size={13} />
        </button>

        <div
          style={{
            width: 1,
            height: 18,
            background: "#222222",
            margin: "0 4px",
          }}
        />

        <button
          onClick={handleDeploy}
          disabled={deploying}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 14px",
            borderRadius: 6,
            border: "none",
            background: deploying ? "#14532d" : "#22c55e",
            color: deploying ? "#86efac" : "#0a0a0a",
            fontSize: 12,
            fontWeight: 700,
            cursor: deploying ? "wait" : "pointer",
            opacity: deploying ? 0.8 : 1,
            transition: "background 0.15s, opacity 0.15s",
          }}
        >
          {deploying ? (
            <RefreshCw
              size={12}
              style={{ animation: "spin 0.8s linear infinite" }}
            />
          ) : (
            <Rocket size={12} />
          )}
          {deploying ? "Deploying…" : "Deploy DB"}
        </button>
      </div>

      {/* ── Main body ── */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* ── Left sidebar ── */}
        <aside
          style={{
            width: 216,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            background: "#0f0f0f",
            borderRight: "1px solid #1e1e1e",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "12px 14px 4px",
              fontSize: 10,
              fontWeight: 700,
              color: "#374151",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Management
          </div>
          <div style={{ padding: "2px 6px 4px" }}>
            {[
              { label: "Tables", count: tables.length, active: true },
              { label: "Functions", count: 0, active: false },
              { label: "Triggers", count: 0, active: false },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 8px",
                  borderRadius: 6,
                  background: item.active ? "#0d2614" : "none",
                  cursor: "default",
                }}
              >
                <Database
                  size={12}
                  style={{ color: item.active ? "#22c55e" : "#374151" }}
                />
                <span
                  style={{
                    flex: 1,
                    fontSize: 12,
                    color: item.active ? "#d1d5db" : "#4b5563",
                  }}
                >
                  {item.label}
                </span>
                {item.count > 0 && (
                  <span
                    style={{
                      fontSize: 9,
                      color: "#6b7280",
                      background: "#1a1a1a",
                      borderRadius: 10,
                      padding: "1px 6px",
                    }}
                  >
                    {item.count}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div
            style={{
              padding: "10px 14px 4px",
              fontSize: 10,
              fontWeight: 700,
              color: "#374151",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Tables
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "2px 6px" }}>
            {tables.length === 0 ? (
              <p
                style={{
                  padding: "12px 8px",
                  fontSize: 11,
                  color: "#374151",
                  textAlign: "center",
                }}
              >
                No tables yet
              </p>
            ) : (
              tables.map((t) => {
                const active = activeCard === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => setActiveCard(t.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 8px",
                      borderRadius: 6,
                      cursor: "pointer",
                      background: active ? "#0d2614" : "none",
                      borderLeft: `2px solid ${active ? "#22c55e" : "transparent"}`,
                      transition: "background 0.1s",
                    }}
                  >
                    <Database
                      size={11}
                      style={{
                        color: active ? "#22c55e" : "#374151",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        flex: 1,
                        fontSize: 11,
                        color: active ? "#e5e7eb" : "#6b7280",
                        fontFamily: "var(--st-mono, monospace)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.name}
                    </span>
                    <span style={{ fontSize: 9, color: "#374151", flexShrink: 0 }}>
                      {t.fields.length}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <div style={{ padding: 8, borderTop: "1px solid #1e1e1e" }}>
            <button
              onClick={addNewTable}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: 8,
                borderRadius: 6,
                border: "1px dashed #222222",
                background: "none",
                color: "#4b5563",
                fontSize: 11,
                cursor: "pointer",
                width: "100%",
              }}
            >
              <Plus size={11} />
              New Table
            </button>
          </div>
        </aside>

        {/* ── ERD Canvas ── */}
        <div
          ref={erdRef}
          style={{
            flex: 1,
            position: "relative",
            overflow: "hidden",
            background: "#0a0a0a",
            cursor: "default",
            userSelect: "none",
          }}
          onMouseDown={(e) => { if (e.detail > 1) e.preventDefault(); onCanvasMouseDown(e); }}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          {/* Dot grid background */}
          <svg
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
            }}
          >
            <defs>
              <pattern
                id="erd-dots"
                x={(pan.x % 24).toString()}
                y={(pan.y % 24).toString()}
                width="24"
                height="24"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="1" cy="1" r="0.8" fill="#1a1a1a" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#erd-dots)" />
          </svg>

          {/* Transformed canvas */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
            }}
          >
            <FkLines tables={tables} positions={positions} />
            {tables.map((t) => (
              <ErdCard
                key={t.id}
                table={t}
                pos={positions[t.id] ?? { x: 0, y: 0 }}
                isActive={activeCard === t.id}
                onHeaderMouseDown={(e) => onCardHeaderMouseDown(t.id, e)}
                onDelete={() => deleteTable(t.id)}
                onAddField={() => addNewField(t.id)}
                onActivate={() => setActiveCard(t.id)}
              />
            ))}
          </div>

          {/* Empty state */}
          {tables.length === 0 && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 14,
                pointerEvents: "none",
              }}
            >
              <Database size={40} style={{ color: "#1e1e1e" }} />
              <p style={{ fontSize: 13, color: "#2a2a2a", margin: 0 }}>
                No tables defined yet
              </p>
              <button
                onClick={addNewTable}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "none",
                  background: "#22c55e",
                  color: "#0a0a0a",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  pointerEvents: "all",
                }}
              >
                <Plus size={12} />
                Add Table
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Raw SQL panel ── */}
      {rawSQL && (
        <div
          style={{
            borderTop: "1px solid #1e1e1e",
            background: "#0f0f0f",
            flexShrink: 0,
            maxHeight: 200,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              height: 32,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "0 12px",
              borderBottom: "1px solid #1e1e1e",
              flexShrink: 0,
            }}
          >
            <Code2 size={11} style={{ color: "#22c55e" }} />
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#374151",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Generated SQL
            </span>
          </div>
          <pre
            style={{
              margin: 0,
              padding: 12,
              overflow: "auto",
              flex: 1,
              fontSize: 11,
              lineHeight: 1.7,
              color: "#6b7280",
              fontFamily: "var(--st-mono, monospace)",
              whiteSpace: "pre",
            }}
          >
            {sql}
          </pre>
        </div>
      )}

      {/* ── Legend bar ── */}
      <div
        style={{
          height: 32,
          display: "flex",
          alignItems: "center",
          gap: 18,
          padding: "0 16px",
          background: "#0a0a0a",
          borderTop: "1px solid #141414",
          flexShrink: 0,
        }}
      >
        {[
          {
            icon: <Key size={10} style={{ color: "#eab308" }} />,
            label: "Primary Key",
          },
          {
            icon: <Link2 size={10} style={{ color: "#6b7280" }} />,
            label: "Foreign Key",
          },
          {
            icon: <Circle size={10} style={{ color: "#22c55e" }} />,
            label: "Unique",
          },
          {
            icon: (
              <span style={{ fontSize: 10, color: "#f59e0b", lineHeight: 1 }}>
                ◆
              </span>
            ),
            label: "Required",
          },
          {
            icon: (
              <span style={{ fontSize: 10, color: "#2a2a2a", lineHeight: 1 }}>
                ◇
              </span>
            ),
            label: "Nullable",
          },
          {
            icon: (
              <span
                style={{
                  width: 16,
                  height: 2,
                  background: "#22c55e",
                  display: "inline-block",
                  borderRadius: 1,
                  opacity: 0.6,
                }}
              />
            ),
            label: "FK Relation",
          },
        ].map((item) => (
          <div
            key={item.label}
            style={{ display: "flex", alignItems: "center", gap: 5 }}
          >
            {item.icon}
            <span style={{ fontSize: 10, color: "#2a2a2a" }}>
              {item.label}
            </span>
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: "#1a1a1a" }}>
          Scroll to zoom · Drag canvas to pan · Drag header to move
        </span>
      </div>

      {/* ── Deploy result toast ── */}
      {deployResult && (
        <div
          style={{
            position: "fixed",
            bottom: 60,
            right: 20,
            zIndex: 200,
            background: deployResult.success ? "#14532d" : "#450a0a",
            border: `1px solid ${deployResult.success ? "#166534" : "#7f1d1d"}`,
            borderRadius: 8,
            padding: "12px 16px",
            maxWidth: 320,
            boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <div>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: deployResult.success ? "#4ade80" : "#f87171",
                  margin: "0 0 4px",
                }}
              >
                {deployResult.success
                  ? "✓ Deployed successfully"
                  : "✗ Deploy failed"}
              </p>
              {deployResult.success ? (
                <p style={{ fontSize: 11, color: "#86efac", margin: 0 }}>
                  {deployResult.applied.length} migration
                  {deployResult.applied.length !== 1 ? "s" : ""} ·{" "}
                  {deployResult.totalTables} table
                  {deployResult.totalTables !== 1 ? "s" : ""}
                </p>
              ) : (
                deployResult.errors.map((err, i) => (
                  <p key={i} style={{ fontSize: 11, color: "#fca5a5", margin: 0 }}>
                    {err}
                  </p>
                ))
              )}
            </div>
            <button
              onClick={() => setDeployResult(null)}
              style={{
                background: "none",
                border: "none",
                color: "#6b7280",
                cursor: "pointer",
                fontSize: 16,
                lineHeight: 1,
                padding: "0 2px",
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
