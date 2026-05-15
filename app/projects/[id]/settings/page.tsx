"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Copy, Check, Globe, Lock, ArrowLeft, Trash2, AlertTriangle,
  Settings2, Shield, Database, Eye, FileText, Table2,
  GitCommit, Users, Link2, Layers, ExternalLink, RefreshCw
} from "lucide-react";
import dynamic from "next/dynamic";

const SchemaVisualizer = dynamic(() => import("@/components/SchemaVisualizer"), { ssr: false });

type Tab = "overview" | "schema" | "access" | "danger" | string; // string for table:tableName

export default function ProjectSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [projectId, setProjectId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [allowPublicEdit, setAllowPublicEdit] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [dashData, setDashData] = useState<any>(null);
  const [dashLoading, setDashLoading] = useState(false);

  useEffect(() => { params.then((p) => setProjectId(p.id)); }, [params]);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    fetch(`/api/projects?id=${projectId}`)
      .then((r) => { if (!r.ok) throw new Error("Failed to fetch"); return r.json(); })
      .then((d) => { setIsPublic(!!d.project.is_public); setAllowPublicEdit(!!d.project.allow_public_edit); setProjectName(d.project.name || ""); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [projectId]);

  const loadDash = async () => {
    if (!projectId) return;
    setDashLoading(true);
    try {
      const r = await fetch(`/api/projects/${projectId}/dashboard`);
      if (r.ok) setDashData(await r.json());
    } catch {}
    setDashLoading(false);
  };

  useEffect(() => { if (projectId) loadDash(); }, [projectId]);

  const handleSave = async () => {
    setSaving(true); setError(null); setSuccess(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/settings`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_public: isPublic, allow_public_edit: allowPublicEdit }),
      });
      if (!res.ok) throw new Error("Failed to save.");
      setSuccess("Saved."); setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true); setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete.");
      router.push("/projects");
    } catch (e: any) { setError(e.message); setDeleting(false); setShowDeleteConfirm(false); }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/projects/${projectId}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const runtimeTables: any[] = dashData?.runtimeSchema?.schema?.database?.tables || [];

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-[#171717]">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#171717] text-[#ededed]">
      {/* Sidebar */}
      <aside className="flex w-[220px] shrink-0 flex-col bg-[#1c1c1c] border-r border-[#2a2a2a]">
        <div className="flex items-center gap-2.5 px-4 h-[49px] border-b border-[#2a2a2a]">
          <button onClick={() => router.push(`/projects/${projectId}`)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#666] hover:text-[#ededed] hover:bg-[#2a2a2a] transition-colors">
            <ArrowLeft size={15} />
          </button>
          <span className="text-[13px] font-medium truncate">{projectName}</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-2 text-[13px]">
          <SidebarGroup label="Management">
            <NavItem icon={Eye} label="Project Overview" active={activeTab === "overview"} onClick={() => setActiveTab("overview")} />
            <NavItem icon={Database} label="Schema" active={activeTab === "schema"} onClick={() => setActiveTab("schema")} />
          </SidebarGroup>

          {runtimeTables.length > 0 && (
            <SidebarGroup label="Tables">
              {runtimeTables.map((t: any) => (
                <NavItem key={t.name} icon={Table2} label={t.name}
                  badge={String(dashData?.runtimeTablesData?.[t.name]?.rowCount ?? 0)}
                  active={activeTab === `table:${t.name}`}
                  onClick={() => setActiveTab(`table:${t.name}`)} />
              ))}
            </SidebarGroup>
          )}

          <SidebarGroup label="Configuration">
            <NavItem icon={Shield} label="Access Control" active={activeTab === "access"} onClick={() => setActiveTab("access")} />
          </SidebarGroup>

          <SidebarGroup label="Settings">
            <NavItem icon={Settings2} label="Project Settings" active={activeTab === "danger"} onClick={() => setActiveTab("danger")} />
          </SidebarGroup>
        </nav>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-[49px] shrink-0 items-center justify-between border-b border-[#2a2a2a] bg-[#1c1c1c] px-5">
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-medium text-[#888]">{projectName}</span>
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">Active</span>
          </div>
          <div className="flex items-center gap-2">
            {!activeTab.startsWith("table:") && activeTab !== "schema" && activeTab !== "overview" && (
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3.5 py-1.5 text-[12px] font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors">
                {saving ? <div className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" /> : <Check size={13} />}
                {saving ? "Saving…" : "Save"}
              </button>
            )}
          </div>
        </header>

        {(error || success) && (
          <div className="px-5 pt-3">
            {error && <div className="flex items-center gap-2 rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2 text-[12px] text-red-400"><AlertTriangle size={13} /> {error} <button onClick={() => setError(null)} className="ml-auto">×</button></div>}
            {success && <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-[12px] text-emerald-400"><Check size={13} /> {success}</div>}
          </div>
        )}

        <main className="flex-1 overflow-y-auto">
          {activeTab === "overview" && <OverviewTab projectId={projectId} projectName={projectName} stats={dashData?.stats} />}
          {activeTab === "schema" && <SchemaTab tables={runtimeTables} loading={dashLoading} onRefresh={loadDash} />}
          {activeTab.startsWith("table:") && <TableDataTab tableName={activeTab.replace("table:", "")} data={dashData?.runtimeTablesData} onRefresh={loadDash} />}
          {activeTab === "access" && <AccessTab isPublic={isPublic} setIsPublic={setIsPublic} allowPublicEdit={allowPublicEdit} setAllowPublicEdit={setAllowPublicEdit} projectId={projectId} copied={copied} handleCopyLink={handleCopyLink} />}
          {activeTab === "danger" && <DangerTab showDeleteConfirm={showDeleteConfirm} setShowDeleteConfirm={setShowDeleteConfirm} deleting={deleting} handleDelete={handleDelete} projectName={projectName} />}
        </main>
      </div>
    </div>
  );
}

/* ─── Sidebar helpers ──────────────────────────────────────── */
function SidebarGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-3 pt-4 pb-1.5"><span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#555]">{label}</span></div>
      {children}
    </div>
  );
}

function NavItem({ icon: Icon, label, active, onClick, badge }: { icon: any; label: string; active?: boolean; onClick: () => void; badge?: string }) {
  return (
    <button onClick={onClick}
      className={`group flex w-full items-center gap-2.5 px-4 py-[7px] text-[13px] transition-colors ${active ? "bg-[#2a2a2a] text-[#ededed] font-medium" : "text-[#888] hover:bg-[#232323] hover:text-[#ccc]"}`}>
      <Icon size={15} className={active ? "text-emerald-400" : "text-[#555] group-hover:text-[#888]"} />
      <span className="flex-1 text-left truncate">{label}</span>
      {badge && <span className="text-[10px] text-[#555] bg-[#252525] px-1.5 py-0.5 rounded">{badge}</span>}
    </button>
  );
}

/* ─── Overview ─────────────────────────────────────────────── */
function OverviewTab({ projectId, projectName, stats }: { projectId: string; projectName: string; stats?: any }) {
  return (
    <div className="p-6 space-y-6">
      <h2 className="text-[15px] font-semibold">Project Overview</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Files", value: stats?.fileCount ?? "—", icon: FileText, color: "text-sky-400 bg-sky-400/10" },
          { label: "Revisions", value: stats?.totalRevisions ?? "—", icon: Layers, color: "text-violet-400 bg-violet-400/10" },
          { label: "Commits", value: stats?.commitCount ?? "—", icon: GitCommit, color: "text-emerald-400 bg-emerald-400/10" },
          { label: "Tables", value: stats?.totalTables ?? "—", icon: Database, color: "text-amber-400 bg-amber-400/10" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-[#2a2a2a] bg-[#1c1c1c] p-4 flex items-center gap-2.5">
            <div className={`flex h-8 w-8 items-center justify-center rounded-md ${s.color}`}><s.icon size={14} /></div>
            <div><p className="text-xl font-semibold tabular-nums">{s.value}</p><p className="text-[11px] text-[#555]">{s.label}</p></div>
          </div>
        ))}
      </div>
      <div>
        <h3 className="text-[13px] font-medium text-[#888] mb-3">Quick Actions</h3>
        <a href={`/projects/${projectId}`} className="group flex items-center gap-3 rounded-lg border border-[#2a2a2a] bg-[#1c1c1c] p-3.5 hover:border-[#333] hover:bg-[#222] transition-all w-fit">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-400/10 text-emerald-400"><ExternalLink size={14} /></div>
          <div><p className="text-[13px] font-medium">Open Editor</p><p className="text-[11px] text-[#555]">Design and build</p></div>
        </a>
      </div>
    </div>
  );
}

/* ─── Schema ───────────────────────────────────────────────── */
function SchemaTab({ tables, loading, onRefresh }: { tables: any[]; loading: boolean; onRefresh: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-2">
          <Database size={15} className="text-emerald-400" />
          <span className="text-[14px] font-semibold">Database Schema</span>
          <span className="text-[11px] text-[#555] ml-2">Drag to rearrange • Scroll to zoom</span>
        </div>
        <button onClick={onRefresh} className="flex items-center gap-1.5 rounded-md bg-[#2a2a2a] border border-[#333] px-3 py-1.5 text-[11px] text-[#888] hover:text-[#ccc] transition-colors">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>
      <div className="flex-1 min-h-0 p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full"><div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" /></div>
        ) : tables.length > 0 ? (
          <div className="h-full"><SchemaVisualizer tables={tables} /></div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-[#555]"><Database size={28} className="mb-2 text-[#333]" /><p className="text-[13px]">No tables defined</p><p className="text-[11px] text-[#444] mt-1">Add tables in the Backend panel of the editor</p></div>
        )}
      </div>
    </div>
  );
}

/* ─── Table Data (full screen) ─────────────────────────────── */
function TableDataTab({ tableName, data, onRefresh }: { tableName: string; data?: Record<string, { rows: any[]; rowCount: number }>; onRefresh: () => void }) {
  const tableData = data?.[tableName];
  const rows = tableData?.rows || [];
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-2">
          <Table2 size={15} className="text-emerald-400" />
          <span className="text-[14px] font-semibold">{tableName}</span>
          <span className="rounded-md bg-[#252525] px-2 py-0.5 text-[10px] text-[#666] font-medium ml-1">{tableData?.rowCount ?? 0} rows</span>
        </div>
        <button onClick={onRefresh} className="flex items-center gap-1.5 rounded-md bg-[#2a2a2a] border border-[#333] px-3 py-1.5 text-[11px] text-[#888] hover:text-[#ccc] transition-colors">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#555]">
            <Table2 size={28} className="mb-2 text-[#333]" />
            <p className="text-[13px]">No rows in <span className="text-[#888] font-medium">{tableName}</span></p>
            <p className="text-[11px] text-[#444] mt-1">Data will appear here once records are inserted</p>
          </div>
        ) : (
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#1c1c1c] border-b border-[#2a2a2a]">
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[#555] w-[50px]">#</th>
                {columns.map((c) => (
                  <th key={c} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[#555] whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any, i: number) => (
                <tr key={i} className="border-b border-[#222] hover:bg-[#1e1e1e] transition-colors">
                  <td className="px-4 py-2.5 text-[#444] font-mono">{i + 1}</td>
                  {columns.map((c) => (
                    <td key={c} className="px-4 py-2.5 text-[#999] whitespace-nowrap max-w-[300px] truncate font-mono">
                      {fmtCell(row[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function fmtCell(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "object") return JSON.stringify(v).slice(0, 120);
  if (typeof v === "string" && v.match(/^\d{4}-\d{2}-\d{2}T/)) return new Date(v).toLocaleString();
  return String(v);
}

/* ─── Access ───────────────────────────────────────────────── */
function AccessTab({ isPublic, setIsPublic, allowPublicEdit, setAllowPublicEdit, projectId, copied, handleCopyLink }: {
  isPublic: boolean; setIsPublic: (v: boolean) => void; allowPublicEdit: boolean; setAllowPublicEdit: (v: boolean) => void;
  projectId: string; copied: boolean; handleCopyLink: () => void;
}) {
  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h2 className="text-[15px] font-semibold">Access Control</h2>
      <div className="space-y-2">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-[#555]">Visibility</label>
        <div onClick={() => { setIsPublic(false); setAllowPublicEdit(false); }}
          className={`flex cursor-pointer items-center gap-3.5 rounded-lg border p-4 transition-all ${!isPublic ? "bg-[#1c1c1c] border-emerald-500/30" : "bg-[#1c1c1c] border-[#2a2a2a] hover:border-[#333]"}`}>
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${!isPublic ? "bg-emerald-400/10 text-emerald-400" : "bg-[#2a2a2a] text-[#555]"}`}><Lock size={15} /></div>
          <div className="flex-1"><p className="text-[13px] font-medium">Private</p><p className="text-[11px] text-[#555] mt-0.5">Only you can access</p></div>
          {!isPublic && <div className="h-2 w-2 rounded-full bg-emerald-400" />}
        </div>
        <div onClick={() => setIsPublic(true)}
          className={`flex cursor-pointer items-start gap-3.5 rounded-lg border p-4 transition-all ${isPublic ? "bg-[#1c1c1c] border-indigo-500/30" : "bg-[#1c1c1c] border-[#2a2a2a] hover:border-[#333]"}`}>
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${isPublic ? "bg-indigo-400/10 text-indigo-400" : "bg-[#2a2a2a] text-[#555]"}`}><Globe size={15} /></div>
          <div className="flex-1">
            <p className="text-[13px] font-medium">Public</p><p className="text-[11px] text-[#555] mt-0.5">Visible in community feed</p>
            {isPublic && (
              <div className="mt-3"><label className="text-[11px] text-[#666] mb-1.5 block">Permissions</label>
                <select value={allowPublicEdit ? "edit" : "view"} onChange={(e) => setAllowPublicEdit(e.target.value === "edit")} onClick={(e) => e.stopPropagation()}
                  className="w-full rounded-md border border-[#333] bg-[#222] px-3 py-2 text-[12px] text-[#ccc] outline-none focus:border-indigo-500/50">
                  <option value="view">View Only</option><option value="edit">Can Edit</option>
                </select>
              </div>
            )}
          </div>
          {isPublic && <div className="h-2 w-2 rounded-full bg-indigo-400 mt-1.5" />}
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-[#555]">Share Link</label>
        <div className="flex items-center gap-2">
          <input readOnly value={typeof window !== "undefined" ? `${window.location.origin}/projects/${projectId}` : ""}
            className="flex-1 rounded-md border border-[#2a2a2a] bg-[#222] px-3 py-2 text-[12px] text-[#888] font-mono outline-none" />
          <button onClick={handleCopyLink}
            className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-[12px] font-medium transition-colors ${copied ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-[#2a2a2a] text-[#888] border border-[#333]"}`}>
            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Danger ───────────────────────────────────────────────── */
function DangerTab({ showDeleteConfirm, setShowDeleteConfirm, deleting, handleDelete, projectName }: {
  showDeleteConfirm: boolean; setShowDeleteConfirm: (v: boolean) => void; deleting: boolean; handleDelete: () => void; projectName: string;
}) {
  const [confirmText, setConfirmText] = useState("");
  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h2 className="text-[15px] font-semibold text-red-400">Project Settings</h2>
      <div className="rounded-lg border border-red-500/15 bg-[#1c1c1c]">
        <div className="p-4 flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-red-400/10 text-red-400"><Trash2 size={15} /></div>
          <div className="flex-1"><p className="text-[13px] font-medium">Delete Project</p><p className="text-[11px] text-[#555] mt-0.5">Permanently remove <span className="text-[#888]">{projectName}</span> and all data.</p></div>
          {!showDeleteConfirm && <button onClick={() => setShowDeleteConfirm(true)} className="rounded-md bg-red-500/10 border border-red-500/15 px-3 py-1.5 text-[12px] text-red-400 hover:bg-red-500/20">Delete</button>}
        </div>
        {showDeleteConfirm && (
          <div className="border-t border-red-500/10 p-4 space-y-3">
            <div><label className="text-[11px] text-[#666] mb-1 block">Type <span className="font-mono text-red-400">{projectName}</span> to confirm</label>
              <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={projectName}
                className="w-full rounded-md border border-red-500/20 bg-[#222] px-3 py-2 text-[12px] text-[#ededed] outline-none focus:border-red-500/40 placeholder:text-[#333]" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowDeleteConfirm(false); setConfirmText(""); }} className="rounded-md bg-[#2a2a2a] px-3 py-1.5 text-[12px] text-[#888]">Cancel</button>
              <button onClick={handleDelete} disabled={deleting || confirmText !== projectName}
                className="flex items-center gap-1.5 rounded-md bg-red-600 px-3.5 py-1.5 text-[12px] font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed">
                {deleting ? <div className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" /> : <Trash2 size={12} />} Delete permanently
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
