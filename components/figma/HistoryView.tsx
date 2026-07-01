"use client";

// ═══════════════════════════════════════════════════════════════
// HistoryView — schema version history + rollback.
// Lists immutable version snapshots (created on each deploy) and lets
// the user restore any one. Restore converges the live DB and loads the
// restored schema back into the editor.
// ═══════════════════════════════════════════════════════════════

import React, { useState, useCallback, useEffect } from "react";
import { History, RotateCcw, RefreshCw, Check } from "lucide-react";
import { useFigmaStore } from "@/lib/stores/figmaStore";
import type { DatabaseConfig } from "@/lib/stores/figmaStore";
import { C } from "./dbStudioTheme";

type VersionRow = { version: number; message: string; created_at: string };

export default function HistoryView({ projectId }: { projectId?: string }) {
  const setDatabaseConfig = useFigmaStore((s) => s.setDatabaseConfig);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // await-first so no setState runs synchronously in the effect body.
  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/db/versions/${projectId}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setVersions(json.versions || []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoaded(true);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const restore = useCallback(async (version: number) => {
    if (!projectId) return;
    setBusy(version);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/db/versions/${projectId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rollbackTo: version }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      if (json.schema) setDatabaseConfig(json.schema as DatabaseConfig);
      setNotice(
        json.success
          ? `Restored v${version} → new v${json.version}`
          : `Restored v${version} with ${json.errors?.length ?? 0} error(s)`
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(null);
  }, [projectId, setDatabaseConfig, load]);

  const latest = versions.length ? versions[0].version : null;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: C.canvas, overflow: "hidden" }}>
      <div style={{ height: 40, display: "flex", alignItems: "center", gap: 10, padding: "0 12px",
        borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <History size={13} style={{ color: C.accent }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>Version history</span>
        <span style={{ fontSize: 10, color: C.textDim }}>{versions.length} version{versions.length !== 1 ? "s" : ""}</span>
        <div style={{ flex: 1 }} />
        <button onClick={load} title="Refresh"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28,
            borderRadius: 6, border: "none", background: "none", cursor: "pointer", color: C.textMuted }}>
          <RefreshCw size={14} />
        </button>
      </div>

      {(error || notice) && (
        <div style={{ padding: "8px 12px", fontSize: 11, fontFamily: "monospace",
          background: error ? "#3a1714" : "#11301d", borderBottom: `1px solid ${error ? C.err : C.ok}`,
          color: error ? "#ffb4a8" : "#9be8bf" }}>
          {error || notice}
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {!loaded ? (
          <Centered>Loading history…</Centered>
        ) : !projectId ? (
          <Centered>Open a saved project to see its version history.</Centered>
        ) : versions.length === 0 ? (
          <Centered>No versions yet. Deploy your schema to create the first version.</Centered>
        ) : (
          <div style={{ position: "relative", maxWidth: 640, marginLeft: 6 }}>
            {/* timeline rail */}
            <div style={{ position: "absolute", left: 5, top: 8, bottom: 8, width: 2, background: C.border }} />
            {versions.map((v) => {
              const isCurrent = v.version === latest;
              return (
                <div key={v.version} style={{ position: "relative", paddingLeft: 26, marginBottom: 14 }}>
                  <div style={{ position: "absolute", left: 0, top: 4, width: 12, height: 12, borderRadius: "50%",
                    background: isCurrent ? C.accent : C.panel, border: `2px solid ${isCurrent ? C.accent : C.border}` }} />
                  <div style={{ background: C.panel, border: `1px solid ${isCurrent ? C.accent : C.border}`, borderRadius: 8, padding: "10px 12px",
                    display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.text, fontFamily: "monospace" }}>v{v.version}</span>
                        {isCurrent && (
                          <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 9, color: C.accent,
                            border: `1px solid ${C.accent}`, borderRadius: 10, padding: "0 6px" }}>
                            <Check size={9} /> current
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {v.message || "—"}
                      </div>
                      <div style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>
                        {new Date(v.created_at).toLocaleString()}
                      </div>
                    </div>
                    {!isCurrent && (
                      <button onClick={() => restore(v.version)} disabled={busy !== null}
                        style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 6, border: `1px solid ${C.border}`,
                          background: C.panelAlt, color: C.text, fontSize: 11, fontWeight: 600, cursor: busy !== null ? "wait" : "pointer", flexShrink: 0 }}>
                        {busy === v.version
                          ? <RefreshCw size={12} style={{ animation: "ddstudio-spin .8s linear infinite" }} />
                          : <RotateCcw size={12} />}
                        Restore
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <style>{`@keyframes ddstudio-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
      color: C.textDim, fontSize: 12, padding: 24, textAlign: "center" }}>
      {children}
    </div>
  );
}
