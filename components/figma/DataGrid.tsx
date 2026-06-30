"use client";

// ═══════════════════════════════════════════════════════════════
// DataGrid — spreadsheet view of a deployed table's rows.
// Reads/writes real data through /api/db/[projectId] (DML-only).
// ═══════════════════════════════════════════════════════════════

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Plus, Trash2, RefreshCw, ChevronLeft, ChevronRight, Rows3, X } from "lucide-react";
import type { DbTable } from "@/lib/stores/figmaStore";
import { runProjectQuery, displayValue, type DbRow } from "./dbStudioQuery";
import { C, inputStyle } from "./dbStudioTheme";

const PAGE_SIZE = 100;
const SYS_COLS = new Set(["id", "created_at", "updated_at", "deleted_at"]);

export default function DataGrid({ projectId, table }: { projectId?: string; table: DbTable }) {
  const [rows, setRows] = useState<DbRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<{ rowId: string; col: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  // Fetch rows. await-first so no setState runs synchronously in the effect
  // body (keeps react-hooks/set-state-in-effect happy).
  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      const where = table.softDelete ? `WHERE "deleted_at" IS NULL` : "";
      const order = table.timestamps ? `ORDER BY "created_at" DESC` : `ORDER BY "id"`;
      const sql = `SELECT * FROM "${table.name}" ${where} ${order} LIMIT ${PAGE_SIZE} OFFSET ${page * PAGE_SIZE}`;
      const r = await runProjectQuery(projectId, sql, []);
      setRows(r.rows);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, table.name, table.softDelete, table.timestamps, page]);

  // Parent remounts this component per table (key=table.id), so table-switch
  // resets state for free — no reset effect needed.
  useEffect(() => { load(); }, [load]);

  const columns = useMemo(() => {
    if (rows.length) return Object.keys(rows[0]);
    const cols = ["id", ...table.fields.filter((f) => f.name !== "id").map((f) => f.name)];
    if (table.timestamps) cols.push("created_at", "updated_at");
    if (table.softDelete) cols.push("deleted_at");
    return cols;
  }, [rows, table]);

  const editableCols = useMemo(() => columns.filter((c) => !SYS_COLS.has(c)), [columns]);

  const commitEdit = useCallback(async () => {
    if (!editing || !projectId) { setEditing(null); return; }
    const { rowId, col } = editing;
    setEditing(null);
    try {
      await runProjectQuery(projectId, `UPDATE "${table.name}" SET "${col}" = $1 WHERE "id" = $2`, [editValue, rowId]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [editing, editValue, projectId, table.name, load]);

  const deleteRow = useCallback(async (rowId: string) => {
    if (!projectId) return;
    try {
      const sql = table.softDelete
        ? `UPDATE "${table.name}" SET "deleted_at" = now() WHERE "id" = $1`
        : `DELETE FROM "${table.name}" WHERE "id" = $1`;
      await runProjectQuery(projectId, sql, [rowId]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [projectId, table.name, table.softDelete, load]);

  const insertRow = useCallback(async () => {
    if (!projectId) return;
    const entries = Object.entries(draft).filter(([, v]) => v !== "");
    try {
      let sql: string, params: unknown[];
      if (entries.length === 0) {
        sql = `INSERT INTO "${table.name}" DEFAULT VALUES`;
        params = [];
      } else {
        const cols = entries.map(([k]) => `"${k}"`).join(", ");
        const ph = entries.map((_, i) => `$${i + 1}`).join(", ");
        sql = `INSERT INTO "${table.name}" (${cols}) VALUES (${ph})`;
        params = entries.map(([, v]) => v);
      }
      await runProjectQuery(projectId, sql, params);
      setDraft({});
      setShowAdd(false);
      setPage(0);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [draft, projectId, table.name, load]);

  if (!projectId) {
    return <Centered>Open a saved project to browse its data.</Centered>;
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: C.canvas }}>
      {/* toolbar */}
      <div style={{ height: 40, display: "flex", alignItems: "center", gap: 10, padding: "0 12px",
        borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <Rows3 size={13} style={{ color: C.accent }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: C.text, fontFamily: "monospace" }}>{table.name}</span>
        <span style={{ fontSize: 10, color: C.textDim }}>{loading ? "loading…" : `${rows.length} row${rows.length !== 1 ? "s" : ""}`}</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => { setLoading(true); setPage((p) => Math.max(0, p - 1)); }} disabled={page === 0} title="Previous page"
          style={{ ...miniBtn, opacity: page === 0 ? 0.4 : 1 }}><ChevronLeft size={13} /></button>
        <span style={{ fontSize: 11, color: C.textDim, minWidth: 48, textAlign: "center" }}>page {page + 1}</span>
        <button onClick={() => { setLoading(true); setPage((p) => p + 1); }} disabled={rows.length < PAGE_SIZE} title="Next page"
          style={{ ...miniBtn, opacity: rows.length < PAGE_SIZE ? 0.4 : 1 }}><ChevronRight size={13} /></button>
        <div style={{ width: 1, height: 16, background: C.border, margin: "0 2px" }} />
        <button onClick={() => { setLoading(true); load(); }} title="Refresh" style={miniBtn}><RefreshCw size={13} /></button>
        <button onClick={() => setShowAdd((v) => !v)}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 6, border: "none",
            background: showAdd ? C.panelAlt : C.accent, color: showAdd ? C.text : "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
          {showAdd ? <X size={12} /> : <Plus size={12} />} {showAdd ? "Cancel" : "Insert row"}
        </button>
      </div>

      {error && (
        <div style={{ padding: "8px 12px", background: "#3a1714", borderBottom: `1px solid ${C.err}`, color: "#ffb4a8", fontSize: 11, fontFamily: "monospace" }}>
          {error}
        </div>
      )}

      {/* insert form */}
      {showAdd && (
        <div style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, background: C.panel,
          display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
          {editableCols.length === 0 && <span style={{ fontSize: 11, color: C.textDim }}>No user columns — inserts a default row.</span>}
          {editableCols.map((c) => (
            <label key={c} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: 9, color: C.textDim, fontFamily: "monospace" }}>{c}</span>
              <input value={draft[c] ?? ""} spellCheck={false} placeholder="NULL"
                onChange={(e) => setDraft((d) => ({ ...d, [c]: e.target.value }))}
                style={{ ...inputStyle, width: 130 }} />
            </label>
          ))}
          <button onClick={insertRow}
            style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: C.ok, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            Insert
          </button>
        </div>
      )}

      {/* grid */}
      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        {rows.length === 0 && !loading ? (
          <Centered>{error ? "Could not load rows." : "No rows yet — Deploy the table, then insert a row."}</Centered>
        ) : (
          <table style={{ borderCollapse: "collapse", width: "max-content", minWidth: "100%", fontSize: 11, fontFamily: "monospace" }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 32 }} />
                {columns.map((c) => (
                  <th key={c} style={thStyle}>
                    {c}{SYS_COLS.has(c) && <span style={{ color: C.textDim, marginLeft: 4 }}>·</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const rowId = String(row.id);
                return (
                  <tr key={rowId} style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <button onClick={() => deleteRow(rowId)} title="Delete row"
                        style={{ background: "none", border: "none", color: C.textDim, cursor: "pointer", padding: 2 }}>
                        <Trash2 size={11} />
                      </button>
                    </td>
                    {columns.map((c) => {
                      const isEditing = editing?.rowId === rowId && editing?.col === c;
                      const editable = !SYS_COLS.has(c);
                      if (isEditing) {
                        return (
                          <td key={c} style={tdStyle}>
                            <input autoFocus value={editValue} spellCheck={false}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={commitEdit}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitEdit();
                                if (e.key === "Escape") setEditing(null);
                              }}
                              style={{ ...inputStyle, minWidth: 100 }} />
                          </td>
                        );
                      }
                      return (
                        <td key={c}
                          onClick={editable ? () => { setEditing({ rowId, col: c }); setEditValue(displayValue(row[c])); } : undefined}
                          style={{ ...tdStyle, cursor: editable ? "text" : "default",
                            color: row[c] === null || row[c] === undefined ? "#555" : C.textMuted }}>
                          {row[c] === null || row[c] === undefined ? "NULL" : displayValue(row[c])}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <style>{`@keyframes ddstudio-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  position: "sticky", top: 0, zIndex: 1, textAlign: "left", padding: "7px 10px",
  background: C.panelAlt, color: C.text, borderBottom: `1px solid ${C.border}`,
  borderRight: `1px solid ${C.borderSoft}`, fontWeight: 600, whiteSpace: "nowrap",
};
const tdStyle: React.CSSProperties = {
  padding: "5px 10px", borderRight: `1px solid ${C.borderSoft}`, whiteSpace: "nowrap",
  maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis",
};
const miniBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26,
  borderRadius: 5, border: "none", background: "none", cursor: "pointer", color: C.textMuted,
};

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
      color: C.textDim, fontSize: 12, padding: 24, textAlign: "center" }}>
      {children}
    </div>
  );
}
