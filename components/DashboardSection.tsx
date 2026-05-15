"use client";

import React, { useState, useEffect } from "react";
import {
  Database, Table2, GitCommit, MessageSquare, FileText, Users, Link2,
  ChevronDown, ChevronRight, RefreshCw, Layers, Clock
} from "lucide-react";
import dynamic from "next/dynamic";

const SchemaVisualizer = dynamic(() => import("@/components/SchemaVisualizer"), { ssr: false });

interface DashboardProps { projectId: string; }
interface DashboardData {
  project: any;
  stats: { fileCount: number; totalRevisions: number; commitCount: number; commentThreads: number; collabSessions: number; shareLinks: number; totalTables: number; };
  files: any[]; commits: any[]; comments: any[]; collabSessions: any[]; shareLinks: any[];
  runtimeSchema: { schema: any; updatedAt: string } | null;
  runtimeTablesData: Record<string, { rows: any[]; rowCount: number }>;
}

/* ─── Collapsible ──────────────────────────────────────────── */
function Collapsible({ title, icon: Icon, children, defaultOpen, count, color }: {
  title: string; icon: any; children: React.ReactNode; defaultOpen?: boolean; count?: number; color?: string;
}) {
  const [open, setOpen] = useState(defaultOpen || false);
  return (
    <div className="rounded-lg border border-[#2a2a2a] bg-[#1c1c1c] overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] font-medium text-[#ccc] hover:bg-[#222] transition-colors">
        <Icon size={14} className={color || "text-[#555]"} />
        <span className="flex-1 text-left">{title}</span>
        {count !== undefined && <span className="text-[10px] text-[#555] bg-[#252525] px-2 py-0.5 rounded-md font-medium">{count}</span>}
        {open ? <ChevronDown size={12} className="text-[#555]" /> : <ChevronRight size={12} className="text-[#555]" />}
      </button>
      {open && <div className="border-t border-[#2a2a2a]">{children}</div>}
    </div>
  );
}

/* ─── Table ────────────────────────────────────────────────── */
function DataTable({ columns, rows }: { columns: string[]; rows: any[] }) {
  if (!rows.length) return <p className="px-4 py-6 text-[12px] text-[#444] text-center">No data</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-[#1a1a1a]">
            {columns.map((c) => <th key={c} className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[#555] whitespace-nowrap">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-[#252525] hover:bg-[#1f1f1f] transition-colors">
              {columns.map((c) => <td key={c} className="px-4 py-2 text-[#888] whitespace-nowrap max-w-[200px] truncate font-mono">{fmt(row[c])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v).slice(0, 80);
  if (typeof v === "string" && v.match(/^\d{4}-\d{2}-\d{2}T/)) return new Date(v).toLocaleString();
  return String(v);
}
function fmtDate(d: string) { return d ? new Date(d).toLocaleString() : "—"; }

/* ═══════════════════════════════════════════════════════════════ */
/* ─── Main ─────────────────────────────────────────────────── */
/* ═══════════════════════════════════════════════════════════════ */
export default function DashboardSection({ projectId }: DashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTable, setActiveTable] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`/api/projects/${projectId}/dashboard`);
      if (!r.ok) throw new Error("Failed to load");
      const d = await r.json(); setData(d);
      if (d.runtimeSchema?.schema?.database?.tables?.length && !activeTable)
        setActiveTable(d.runtimeSchema.schema.database.tables[0].name);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (projectId) load(); }, [projectId]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
    </div>
  );

  if (error) return (
    <div className="m-6 rounded-md bg-red-500/10 border border-red-500/15 p-3 text-[12px] text-red-400 flex items-center gap-2">
      ⚠ {error}
      <button onClick={load} className="ml-auto text-[11px] underline underline-offset-2">Retry</button>
    </div>
  );

  if (!data) return null;
  const tables = data.runtimeSchema?.schema?.database?.tables || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-[#ededed]">Database</h2>
          <p className="text-[13px] text-[#666] mt-0.5">Schema visualization and stored data</p>
        </div>
        <button onClick={load}
          className="flex items-center gap-1.5 rounded-md bg-[#2a2a2a] border border-[#333] px-3 py-1.5 text-[11px] font-medium text-[#888] hover:text-[#ccc] transition-colors">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Schema Visualizer */}
      {tables.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Database size={14} className="text-emerald-400" />
              <span className="text-[13px] font-medium text-[#ccc]">Schema Visualizer</span>
            </div>
            <span className="text-[10px] text-[#555]">Drag to rearrange • Scroll to zoom</span>
          </div>
          <SchemaVisualizer tables={tables} />
        </section>
      )}

      {/* Table Data */}
      {tables.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Table2 size={14} className="text-emerald-400" />
            <span className="text-[13px] font-medium text-[#ccc]">Table Data</span>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 mb-3 border-b border-[#2a2a2a] overflow-x-auto">
            {tables.map((t: any) => (
              <button key={t.name} onClick={() => setActiveTable(t.name)}
                className={`px-3 py-2 text-[12px] font-medium whitespace-nowrap border-b-2 transition-colors -mb-px ${
                  activeTable === t.name
                    ? "border-emerald-400 text-emerald-400"
                    : "border-transparent text-[#555] hover:text-[#888]"
                }`}>
                {t.name}
                <span className="ml-1 text-[10px] opacity-50">{data.runtimeTablesData[t.name]?.rowCount || 0}</span>
              </button>
            ))}
          </div>

          {activeTable && data.runtimeTablesData[activeTable] && (
            <div className="rounded-lg border border-[#2a2a2a] bg-[#1c1c1c] overflow-hidden">
              {data.runtimeTablesData[activeTable].rows.length > 0 ? (
                <DataTable columns={Object.keys(data.runtimeTablesData[activeTable].rows[0])} rows={data.runtimeTablesData[activeTable].rows} />
              ) : (
                <p className="px-4 py-8 text-[12px] text-[#444] text-center">No rows</p>
              )}
            </div>
          )}
        </section>
      )}

      {/* Collapsible sections */}
      <div className="space-y-2">
        <Collapsible title="Design Files" icon={FileText} count={data.files.length} defaultOpen color="text-sky-400">
          <DataTable columns={["name","revn","change_count","created_at","modified_at"]}
            rows={data.files.map((f) => ({ name: f.name, revn: f.revn, change_count: f.change_count, created_at: fmtDate(f.created_at), modified_at: fmtDate(f.modified_at) }))} />
        </Collapsible>
        <Collapsible title="Commits" icon={GitCommit} count={data.commits.length} color="text-emerald-400">
          <DataTable columns={["version","message","committed_by_email","created_at"]}
            rows={data.commits.map((c) => ({ version: `v${c.version}`, message: c.message || "—", committed_by_email: c.committed_by_email || "—", created_at: fmtDate(c.created_at) }))} />
        </Collapsible>
        <Collapsible title="Comments" icon={MessageSquare} count={data.comments.length} color="text-amber-400">
          <DataTable columns={["content","author_email","resolved","created_at"]}
            rows={data.comments.map((c) => ({ content: c.content, author_email: c.author_email, resolved: c.resolved ? "✓" : "Open", created_at: fmtDate(c.created_at) }))} />
        </Collapsible>
        <Collapsible title="Collaboration" icon={Users} count={data.collabSessions.length} color="text-rose-400">
          <DataTable columns={["started_at","ended_at","active_users","total_operations"]}
            rows={data.collabSessions.map((s) => ({ started_at: fmtDate(s.started_at), ended_at: s.ended_at ? fmtDate(s.ended_at) : "Active", active_users: s.active_users, total_operations: s.total_operations }))} />
        </Collapsible>
        <Collapsible title="Share Links" icon={Link2} count={data.shareLinks.length} color="text-teal-400">
          <DataTable columns={["id","owner_email","created_at"]}
            rows={data.shareLinks.map((s) => ({ id: s.id?.slice(0,8)+"…", owner_email: s.owner_email, created_at: fmtDate(s.created_at) }))} />
        </Collapsible>
      </div>
    </div>
  );
}
