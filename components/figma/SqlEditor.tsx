"use client";

// ═══════════════════════════════════════════════════════════════
// SqlEditor — run ad-hoc DML against the project DB.
// Server enforces SELECT/INSERT/UPDATE/DELETE only (DDL → use Deploy).
// ═══════════════════════════════════════════════════════════════

import React, { useState, useCallback } from "react";
import { Play, Terminal, RefreshCw } from "lucide-react";
import { runProjectQuery, displayValue, type DbRow } from "./dbStudioQuery";
import { C } from "./dbStudioTheme";
import { usePersistentState } from "./usePersistentState";

const PLACEHOLDER = `-- DML only (SELECT / INSERT / UPDATE / DELETE)
-- Use bare table names; they're namespaced to your project.
SELECT * FROM your_table LIMIT 50`;

export default function SqlEditor({ projectId }: { projectId?: string }) {
  const [sql, setSql] = usePersistentState<string>(`mintdb:sql:${projectId ?? "local"}`, "");
  const [rows, setRows] = useState<DbRow[] | null>(null);
  const [rowCount, setRowCount] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ranOnce, setRanOnce] = useState(false);

  const run = useCallback(async () => {
    if (!projectId || !sql.trim()) return;
    setRunning(true);
    setError(null);
    try {
      const r = await runProjectQuery(projectId, sql.trim().replace(/;\s*$/, ""), []);
      setRows(r.rows);
      setRowCount(r.rowCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRows(null);
    }
    setRanOnce(true);
    setRunning(false);
  }, [projectId, sql]);

  const columns = rows && rows.length ? Object.keys(rows[0]) : [];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: C.canvas }}>
      <div style={{ height: 40, display: "flex", alignItems: "center", gap: 10, padding: "0 12px",
        borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <Terminal size={13} style={{ color: C.accent }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>SQL Editor</span>
        <span style={{ fontSize: 10, color: C.textDim }}>DML only · ⌘/Ctrl + Enter to run</span>
        <div style={{ flex: 1 }} />
        <button onClick={run} disabled={running || !projectId}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 6, border: "none",
            background: running ? "#0a6cb3" : C.accent, color: "#fff", fontSize: 11, fontWeight: 700,
            cursor: running || !projectId ? "default" : "pointer", opacity: !projectId ? 0.5 : 1 }}>
          {running ? <RefreshCw size={12} style={{ animation: "ddstudio-spin .8s linear infinite" }} /> : <Play size={12} />}
          Run
        </button>
      </div>

      <textarea value={sql} placeholder={PLACEHOLDER} spellCheck={false}
        onChange={(e) => setSql(e.target.value)}
        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); run(); } }}
        style={{ height: 180, flexShrink: 0, resize: "vertical", padding: 12, background: C.bg, color: C.text,
          border: "none", borderBottom: `1px solid ${C.border}`, outline: "none",
          fontFamily: "monospace", fontSize: 12, lineHeight: 1.6 }} />

      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        {!projectId ? (
          <Centered>Open a saved project to run queries.</Centered>
        ) : error ? (
          <div style={{ padding: 12, color: "#ffb4a8", fontSize: 12, fontFamily: "monospace", whiteSpace: "pre-wrap" }}>{error}</div>
        ) : !ranOnce ? (
          <Centered>Write a query and press Run.</Centered>
        ) : rows && rows.length === 0 ? (
          <div style={{ padding: 12, color: C.ok, fontSize: 12, fontFamily: "monospace" }}>
            ✓ Query OK — {rowCount} row{rowCount !== 1 ? "s" : ""} returned.
          </div>
        ) : rows ? (
          <>
            <div style={{ padding: "6px 12px", fontSize: 10, color: C.textDim }}>{rows.length} row{rows.length !== 1 ? "s" : ""}</div>
            <table style={{ borderCollapse: "collapse", width: "max-content", minWidth: "100%", fontSize: 11, fontFamily: "monospace" }}>
              <thead>
                <tr>{columns.map((c) => <th key={c} style={thStyle}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
                    {columns.map((c) => (
                      <td key={c} style={{ ...tdStyle, color: row[c] === null || row[c] === undefined ? "#555" : C.textMuted }}>
                        {row[c] === null || row[c] === undefined ? "NULL" : displayValue(row[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}
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
  maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis",
};

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
      color: C.textDim, fontSize: 12, padding: 24, textAlign: "center" }}>
      {children}
    </div>
  );
}
