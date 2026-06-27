"use client";

import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { Key, Hash, Fingerprint, Diamond, CircleDot, GripVertical } from "lucide-react";

// ── Types ────────────────────────────────────────────────────
interface FieldDef {
  name: string;
  type: string;
  required?: boolean;
  unique?: boolean;
  isPrimary?: boolean;
  isIdentity?: boolean;
  default?: unknown;
}

interface RelationDef {
  type: string;
  targetTable: string;
  foreignKey: string;
  targetKey?: string;
  onDelete?: string;
}

interface TableDef {
  id: string;
  name: string;
  fields?: FieldDef[];
  relations?: RelationDef[];
  timestamps?: boolean;
  softDelete?: boolean;
}

interface Props {
  tables: TableDef[];
  relations?: RelationDef[];
}

// Safe accessors — API may omit these arrays
function tFields(t: TableDef): FieldDef[] { return t.fields ?? []; }
function tRelations(t: TableDef): RelationDef[] { return t.relations ?? []; }

// ── Layout helpers ───────────────────────────────────────────
const TABLE_W = 240;
const TABLE_HEADER_H = 36;
const ROW_H = 28;
const GAP_X = 100;
const GAP_Y = 60;

function getAllDisplayFields(table: TableDef) {
  const rows: { name: string; type: string }[] = [];
  const seen = new Set<string>();
  const addRow = (row: { name: string; type: string }) => {
    if (seen.has(row.name)) return;
    seen.add(row.name);
    rows.push(row);
  };

  const fields = tFields(table);
  if (!fields.find((f) => f.name === "id")) {
    addRow({ name: "id", type: "uuid" });
  }
  for (const f of fields) addRow({ name: f.name, type: f.type });
  for (const r of tRelations(table)) {
    if (r.type !== "many-to-many") {
      addRow({ name: r.foreignKey, type: "uuid" });
    }
  }
  if (table.timestamps !== false) {
    addRow({ name: "created_at", type: "timestamptz" });
    addRow({ name: "updated_at", type: "timestamptz" });
  }
  if (table.softDelete) {
    addRow({ name: "deleted_at", type: "timestamptz" });
  }
  return rows;
}

function getTableHeight(t: TableDef) {
  const rows = getAllDisplayFields(t);
  return TABLE_HEADER_H + rows.length * ROW_H + 8;
}

function autoLayout(tables: TableDef[]): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  const cols = Math.max(2, Math.ceil(Math.sqrt(tables.length)));
  tables.forEach((t, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    // Accumulate heights for stacking
    let yOff = 0;
    for (let r = 0; r < row; r++) {
      const idx = r * cols + col;
      if (idx < tables.length) yOff += getTableHeight(tables[idx]) + GAP_Y;
    }
    positions[t.id || t.name] = { x: 40 + col * (TABLE_W + GAP_X), y: 40 + yOff };
  });
  return positions;
}

// ── Field icon ───────────────────────────────────────────────
function FieldIcon({ field, isFK }: { field: FieldDef; isFK?: boolean }) {
  if (field.isPrimary || field.name === "id")
    return <Key size={12} className="text-amber-400 shrink-0" />;
  if (field.isIdentity)
    return <Hash size={12} className="text-sky-400 shrink-0" />;
  if (isFK)
    return <Fingerprint size={12} className="text-violet-400 shrink-0" />;
  if (field.unique)
    return <CircleDot size={12} className="text-emerald-400 shrink-0" />;
  return <Diamond size={12} className={`shrink-0 ${field.required ? "text-zinc-300" : "text-zinc-500"}`} />;
}

// ── Table Card ───────────────────────────────────────────────
function TableCard({
  table,
  pos,
  onDragStart,
}: {
  table: TableDef;
  pos: { x: number; y: number };
  onDragStart: (id: string, e: React.PointerEvent) => void;
}) {
  const fkFields = new Set(tRelations(table).map((r) => r.foreignKey));

  // Build display rows: id + fields + FK fields (if not already in fields) + timestamps
  const displayRows: { name: string; type: string; isPrimary?: boolean; isFK?: boolean; required?: boolean; unique?: boolean }[] = [];
  const seen = new Set<string>();
  const addRow = (row: { name: string; type: string; isPrimary?: boolean; isFK?: boolean; required?: boolean; unique?: boolean }) => {
    if (seen.has(row.name)) return;
    seen.add(row.name);
    displayRows.push(row);
  };

  // Primary key
  if (!tFields(table).find((f) => f.name === "id")) {
    addRow({ name: "id", type: "uuid", isPrimary: true, required: true });
  }

  for (const f of tFields(table)) {
    addRow({
      name: f.name,
      type: f.type,
      isPrimary: f.name === "id" || f.isPrimary,
      isFK: fkFields.has(f.name),
      required: f.required,
      unique: f.unique,
    });
  }

  // FK fields not in schema
  for (const r of tRelations(table)) {
    if (r.type !== "many-to-many") {
      addRow({ name: r.foreignKey, type: "uuid", isFK: true, required: true });
    }
  }

  // Timestamps
  if (table.timestamps !== false) {
    addRow({ name: "created_at", type: "timestamptz", required: true });
    addRow({ name: "updated_at", type: "timestamptz", required: true });
  }
  if (table.softDelete) {
    addRow({ name: "deleted_at", type: "timestamptz" });
  }

  return (
    <g
      transform={`translate(${pos.x}, ${pos.y})`}
      style={{ cursor: "grab" }}
      onPointerDown={(e) => onDragStart(table.id || table.name, e)}
    >
      {/* Shadow */}
      <rect
        x={2} y={2}
        width={TABLE_W} height={TABLE_HEADER_H + displayRows.length * ROW_H + 8}
        rx={6} fill="rgba(0,0,0,0.3)"
      />
      {/* Background */}
      <rect
        width={TABLE_W} height={TABLE_HEADER_H + displayRows.length * ROW_H + 8}
        rx={6} fill="#0f0f0f" stroke="rgba(255,255,255,0.06)" strokeWidth={1}
      />
      {/* Header */}
      <rect width={TABLE_W} height={TABLE_HEADER_H} rx={6} fill="rgba(255,255,255,0.04)" />
      <rect y={TABLE_HEADER_H - 6} width={TABLE_W} height={6} fill="rgba(255,255,255,0.04)" />
      <line x1={0} y1={TABLE_HEADER_H} x2={TABLE_W} y2={TABLE_HEADER_H} stroke="rgba(255,255,255,0.06)" />

      {/* Drag handle + Table icon + name */}
      <foreignObject x={8} y={8} width={TABLE_W - 16} height={20}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#f6f4f0", fontSize: 13, fontWeight: 600, fontFamily: "Inter, system-ui, sans-serif" }}>
          <GripVertical size={12} style={{ color: "#666360", flexShrink: 0 }} />
          <span style={{ color: "#34d399", fontSize: 11 }}>⊞</span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{table.name}</span>
        </div>
      </foreignObject>

      {/* Rows */}
      {displayRows.map((row, i) => {
        const y = TABLE_HEADER_H + i * ROW_H;
        return (
          <g key={row.name}>
            {/* Hover highlight area */}
            <rect x={1} y={y} width={TABLE_W - 2} height={ROW_H} fill="transparent" rx={0} className="hover:fill-white/5" />
            <foreignObject x={10} y={y + 4} width={TABLE_W - 20} height={ROW_H - 4}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontFamily: "'JetBrains Mono', 'Fira Code', monospace", lineHeight: "20px" }}>
                <FieldIcon field={row as FieldDef} isFK={row.isFK} />
                <span style={{ color: "#d7d6d2", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {row.name}
                </span>
                <span style={{ color: "#666360", fontSize: 10, flexShrink: 0 }}>{row.type}</span>
              </div>
            </foreignObject>
          </g>
        );
      })}
    </g>
  );
}

// ── Relation Edge ────────────────────────────────────────────
function RelationEdge({
  from,
  to,
  relation,
  positions,
  tables,
}: {
  from: TableDef;
  to: TableDef;
  relation: RelationDef;
  positions: Record<string, { x: number; y: number }>;
  tables: TableDef[];
}) {
  const fromPos = positions[from.id || from.name];
  const toPos = positions[to.id || to.name];
  if (!fromPos || !toPos) return null;

  // Find FK field index in source table
  const allFieldsFrom = getAllDisplayFields(from);
  const fkIdx = allFieldsFrom.findIndex((f) => f.name === relation.foreignKey);
  const targetIdx = 0; // connect to "id" row

  const fromY = fromPos.y + TABLE_HEADER_H + (fkIdx >= 0 ? fkIdx : 0) * ROW_H + ROW_H / 2;
  const toY = toPos.y + TABLE_HEADER_H + targetIdx * ROW_H + ROW_H / 2;

  // Decide side
  const fromRight = fromPos.x + TABLE_W;
  const toLeft = toPos.x;
  const toRight = toPos.x + TABLE_W;
  const fromLeft = fromPos.x;

  let x1: number, x2: number;
  if (fromRight < toLeft) {
    x1 = fromRight;
    x2 = toLeft;
  } else if (toRight < fromLeft) {
    x1 = fromLeft;
    x2 = toRight;
  } else {
    x1 = fromRight;
    x2 = toRight;
  }

  const midX = (x1 + x2) / 2;

  return (
    <g>
      <path
        d={`M ${x1} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${x2} ${toY}`}
        fill="none"
        stroke="#34d399"
        strokeWidth={1.5}
        strokeDasharray={relation.type === "many-to-many" ? "6 3" : "none"}
        opacity={0.4}
      />
      {/* Source dot */}
      <circle cx={x1} cy={fromY} r={3} fill="#34d399" />
      {/* Target arrow/dot */}
      {relation.type?.includes("many") ? (
        <>
          <circle cx={x2} cy={toY} r={4} fill="none" stroke="#34d399" strokeWidth={1.5} />
          <circle cx={x2} cy={toY} r={1.5} fill="#34d399" />
        </>
      ) : (
        <circle cx={x2} cy={toY} r={3} fill="#34d399" />
      )}
    </g>
  );
}

// Helper moved above getTableHeight

// ── Main Component ───────────────────────────────────────────
export default function SchemaVisualizer({ tables: rawTables }: Props) {
  // Normalize: ensure every table has relations + fields arrays (API may omit them)
  const tables = useMemo(() =>
    (rawTables || []).map((t) => ({
      ...t,
      relations: Array.isArray(t.relations) ? t.relations : [],
      fields: Array.isArray(t.fields) ? t.fields : [],
    })),
    [rawTables]
  );
  const svgRef = useRef<SVGSVGElement>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [dragging, setDragging] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 1200, h: 800 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, vx: 0, vy: 0 });

  useEffect(() => {
    if (tables.length > 0) {
      const pos = autoLayout(tables);
      setPositions(pos);
      // Calculate bounding box
      let maxX = 0, maxY = 0;
      for (const t of tables) {
        const p = pos[t.id || t.name];
        if (p) {
          maxX = Math.max(maxX, p.x + TABLE_W + 60);
          maxY = Math.max(maxY, p.y + getTableHeight(t) + 60);
        }
      }
      setViewBox({ x: 0, y: 0, w: Math.max(1200, maxX), h: Math.max(600, maxY) });
    }
  }, [tables]);

  // Collect all relations
  const allEdges = useMemo(() => {
    const edges: { from: TableDef; to: TableDef; relation: RelationDef }[] = [];
    const tableMap = new Map(tables.map((t) => [t.name, t]));
    for (const t of tables) {
      for (const r of (t.relations ?? [])) {
        const target = tableMap.get(r.targetTable);
        if (target) edges.push({ from: t, to: target, relation: r });
      }
    }
    return edges;
  }, [tables]);

  const handleDragStart = useCallback((id: string, e: React.PointerEvent) => {
    e.stopPropagation();
    const pos = positions[id];
    if (!pos) return;
    const svg = svgRef.current;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    dragOffset.current = { x: svgP.x - pos.x, y: svgP.y - pos.y };
    setDragging(id);
  }, [positions]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (dragging) {
      const svg = svgRef.current;
      if (!svg) return;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
      setPositions((prev) => ({
        ...prev,
        [dragging]: { x: svgP.x - dragOffset.current.x, y: svgP.y - dragOffset.current.y },
      }));
    } else if (isPanning) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      const scale = viewBox.w / (svgRef.current?.clientWidth || 1200);
      setViewBox((prev) => ({
        ...prev,
        x: panStart.current.vx - dx * scale,
        y: panStart.current.vy - dy * scale,
      }));
    }
  }, [dragging, isPanning, viewBox.w]);

  const handlePointerUp = useCallback(() => {
    setDragging(null);
    setIsPanning(false);
  }, []);

  const handleBgPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.target === svgRef.current || (e.target as Element)?.classList?.contains("bg-grid")) {
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, vx: viewBox.x, vy: viewBox.y };
    }
  }, [viewBox.x, viewBox.y]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const factor = e.deltaY > 0 ? 1.1 : 0.9;
      setViewBox((prev) => {
        const newW = prev.w * factor;
        const newH = prev.h * factor;
        const cx = prev.x + prev.w / 2;
        const cy = prev.y + prev.h / 2;
        return { x: cx - newW / 2, y: cy - newH / 2, w: newW, h: newH };
      });
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  if (!tables.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
        <Diamond size={32} className="mb-3 text-zinc-600" />
        <p className="text-sm font-medium">No database tables defined</p>
        <p className="text-xs mt-1 text-zinc-600">Add tables in the runtime editor to see the schema visualization</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full rounded-lg border border-white/[0.06] bg-[#0a0a0a] overflow-hidden" style={{ minHeight: 400 }}>
      {/* Legend */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-5 px-4 py-2 rounded-md bg-[#0f0f0f]/95 border border-white/[0.06] backdrop-blur-sm text-[10px] text-[#a8a6a2]">
        <span className="flex items-center gap-1.5"><Key size={10} className="text-amber-400" /> Primary key</span>
        <span className="flex items-center gap-1.5"><Hash size={10} className="text-sky-400" /> Identity</span>
        <span className="flex items-center gap-1.5"><CircleDot size={10} className="text-emerald-400" /> Unique</span>
        <span className="flex items-center gap-1.5"><Diamond size={10} className="text-[#666360]" /> Nullable</span>
        <span className="flex items-center gap-1.5"><Diamond size={10} className="text-[#d7d6d2]" /> Non-Nullable</span>
      </div>

      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerDown={(e) => { if (e.detail > 1) e.preventDefault(); handleBgPointerDown(e); }}
        style={{ cursor: isPanning ? "grabbing" : dragging ? "grabbing" : "default", userSelect: "none" }}
      >
        {/* Grid pattern */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect
          className="bg-grid"
          x={viewBox.x - 1000} y={viewBox.y - 1000}
          width={viewBox.w + 2000} height={viewBox.h + 2000}
          fill="url(#grid)"
        />

        {/* Edges */}
        {allEdges.map((edge, i) => (
          <RelationEdge
            key={i}
            from={edge.from}
            to={edge.to}
            relation={edge.relation}
            positions={positions}
            tables={tables}
          />
        ))}

        {/* Tables */}
        {tables.map((t) => {
          const pos = positions[t.id || t.name];
          if (!pos) return null;
          return (
            <TableCard
              key={t.id || t.name}
              table={t}
              pos={pos}
              onDragStart={handleDragStart}
            />
          );
        })}
      </svg>
    </div>
  );
}
