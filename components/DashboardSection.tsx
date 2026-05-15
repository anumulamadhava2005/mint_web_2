"use client";

import React, { useState, useEffect } from "react";
import {
  Database, Table2, GitCommit, MessageSquare, FileText, Users, Link2,
  ChevronDown, ChevronRight, RefreshCw, Layers, BarChart3, Clock
} from "lucide-react";
import dynamic from "next/dynamic";

const SchemaVisualizer = dynamic(() => import("@/components/SchemaVisualizer"), { ssr: false });

interface DashboardProps {
  projectId: string;
}

interface DashboardData {
  project: any;
  stats: {
    fileCount: number;
    totalRevisions: number;
    commitCount: number;
    commentThreads: number;
    collabSessions: number;
    shareLinks: number;
    totalTables: number;
  };
  files: any[];
  commits: any[];
  comments: any[];
  collabSessions: any[];
  shareLinks: any[];
  runtimeSchema: { schema: any; updatedAt: string } | null;
  runtimeTablesData: Record<string, { rows: any[]; rowCount: number }>;
}

/* ─── Stat Card ───────────────────────────────────────────── */
function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number | string; accent: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5 hover:bg-white/[0.03] transition-all group">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${accent}`}>
          <Icon size={16} />
        </div>
        <div>
          <p className="text-2xl font-bold tracking-tight text-[#f6f4f0]">{value}</p>
          <p className="text-[10px] font-medium uppercase tracking-widest text-white/25">{label}</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Collapsible Section ─────────────────────────────────── */
function CollapsibleSection({ title, icon: Icon, children, defaultOpen = false, count, accent }: {
  title: string; icon: any; children: React.ReactNode; defaultOpen?: boolean; count?: number; accent?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 text-sm font-medium text-white/80 hover:bg-white/[0.02] transition-all"
      >
        <Icon size={15} className={accent || "text-white/30"} />
        <span className="flex-1 text-left text-[13px]">{title}</span>
        {count !== undefined && (
          <span className="text-[10px] font-semibold text-white/20 bg-white/[0.04] px-2.5 py-1 rounded-full">{count}</span>
        )}
        {open ? <ChevronDown size={13} className="text-white/20" /> : <ChevronRight size={13} className="text-white/20" />}
      </button>
      {open && <div className="border-t border-white/[0.04]">{children}</div>}
    </div>
  );
}

/* ─── Data Table ──────────────────────────────────────────── */
function DataTable({ columns, rows }: { columns: string[]; rows: any[] }) {
  if (!rows.length) {
    return <p className="px-5 py-8 text-xs text-white/20 text-center">No data available</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-white/[0.02]">
            {columns.map((col) => (
              <th key={col} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-white/25 whitespace-nowrap">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-white/[0.03] hover:bg-white/[0.015] transition-colors">
              {columns.map((col) => (
                <td key={col} className="px-5 py-2.5 text-white/50 whitespace-nowrap max-w-[220px] truncate font-mono">
                  {formatCell(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value).slice(0, 80);
  if (typeof value === "string" && value.match(/^\d{4}-\d{2}-\d{2}T/)) {
    return new Date(value).toLocaleString();
  }
  return String(value);
}

function formatDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

/* ═══════════════════════════════════════════════════════════════ */
/* ─── Main Dashboard Component ────────────────────────────────  */
/* ═══════════════════════════════════════════════════════════════ */
export default function DashboardSection({ projectId }: DashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeRuntimeTable, setActiveRuntimeTable] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/dashboard`);
      if (!res.ok) throw new Error("Failed to load dashboard data");
      const json = await res.json();
      setData(json);
      if (json.runtimeSchema?.schema?.database?.tables?.length && !activeRuntimeTable) {
        setActiveRuntimeTable(json.runtimeSchema.schema.database.tables[0].name);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) fetchData();
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="text-xs text-white/20">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-red-500/[0.05] border border-red-500/15 p-5 text-sm text-red-400 flex items-center gap-3">
        <span>⚠</span> {error}
        <button onClick={fetchData} className="ml-auto text-xs underline underline-offset-2 hover:text-red-300">Retry</button>
      </div>
    );
  }

  if (!data) return null;

  const runtimeTables = data.runtimeSchema?.schema?.database?.tables || [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
          <p className="text-sm text-[#a8a6a2] mt-0.5">Data overview for this project.</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/[0.06] px-4 py-2 text-xs font-medium text-white/50 hover:bg-white/[0.06] hover:text-white/70 transition-all"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={FileText} label="Files" value={data.stats.fileCount} accent="bg-sky-500/10 text-sky-400" />
        <StatCard icon={Layers} label="Revisions" value={data.stats.totalRevisions} accent="bg-violet-500/10 text-violet-400" />
        <StatCard icon={GitCommit} label="Commits" value={data.stats.commitCount} accent="bg-emerald-500/10 text-emerald-400" />
        <StatCard icon={Database} label="Tables" value={data.stats.totalTables} accent="bg-indigo-500/10 text-indigo-400" />
      </div>

      {/* Schema Visualizer */}
      {runtimeTables.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Database size={15} className="text-indigo-400" />
            <h3 className="text-sm font-semibold tracking-tight">Database Schema</h3>
            <span className="text-[10px] text-white/20 ml-1">Drag to rearrange • Scroll to zoom</span>
          </div>
          <SchemaVisualizer tables={runtimeTables} />
        </section>
      )}

      {/* Runtime Table Data */}
      {runtimeTables.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Table2 size={15} className="text-emerald-400" />
            <h3 className="text-sm font-semibold tracking-tight">Table Data</h3>
          </div>

          {/* Table tabs */}
          <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1">
            {runtimeTables.map((t: any) => (
              <button
                key={t.name}
                onClick={() => setActiveRuntimeTable(t.name)}
                className={`px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  activeRuntimeTable === t.name
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-white/[0.02] text-white/30 border border-white/[0.04] hover:bg-white/[0.04] hover:text-white/50"
                }`}
              >
                {t.name}
                <span className="ml-1.5 text-[10px] opacity-50">
                  {data.runtimeTablesData[t.name]?.rowCount || 0}
                </span>
              </button>
            ))}
          </div>

          {/* Active table data */}
          {activeRuntimeTable && data.runtimeTablesData[activeRuntimeTable] && (
            <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] overflow-hidden">
              {data.runtimeTablesData[activeRuntimeTable].rows.length > 0 ? (
                <DataTable
                  columns={Object.keys(data.runtimeTablesData[activeRuntimeTable].rows[0])}
                  rows={data.runtimeTablesData[activeRuntimeTable].rows}
                />
              ) : (
                <p className="px-5 py-10 text-xs text-white/20 text-center">No rows in this table</p>
              )}
            </div>
          )}
        </section>
      )}

      {/* Collapsible Data Sections */}
      <div className="space-y-3">
        <CollapsibleSection title="Design Files" icon={FileText} count={data.files.length} defaultOpen accent="text-sky-400">
          <DataTable
            columns={["name", "revn", "change_count", "created_at", "modified_at"]}
            rows={data.files.map((f) => ({
              name: f.name, revn: f.revn, change_count: f.change_count,
              created_at: formatDate(f.created_at), modified_at: formatDate(f.modified_at),
            }))}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Commits" icon={GitCommit} count={data.commits.length} accent="text-emerald-400">
          <DataTable
            columns={["version", "message", "committed_by_email", "created_at"]}
            rows={data.commits.map((c) => ({
              version: `v${c.version}`, message: c.message || "—",
              committed_by_email: c.committed_by_email || "—", created_at: formatDate(c.created_at),
            }))}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Comments" icon={MessageSquare} count={data.comments.length} accent="text-amber-400">
          <DataTable
            columns={["content", "author_email", "resolved", "created_at"]}
            rows={data.comments.map((c) => ({
              content: c.content, author_email: c.author_email,
              resolved: c.resolved ? "✓ Resolved" : "Open", created_at: formatDate(c.created_at),
            }))}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Collaboration Sessions" icon={Users} count={data.collabSessions.length} accent="text-rose-400">
          <DataTable
            columns={["started_at", "ended_at", "active_users", "total_operations"]}
            rows={data.collabSessions.map((s) => ({
              started_at: formatDate(s.started_at), ended_at: s.ended_at ? formatDate(s.ended_at) : "Active",
              active_users: s.active_users, total_operations: s.total_operations,
            }))}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Share Links" icon={Link2} count={data.shareLinks.length} accent="text-teal-400">
          <DataTable
            columns={["id", "owner_email", "created_at"]}
            rows={data.shareLinks.map((s) => ({
              id: s.id?.slice(0, 8) + "…", owner_email: s.owner_email, created_at: formatDate(s.created_at),
            }))}
          />
        </CollapsibleSection>
      </div>
    </div>
  );
}
