"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Copy, Check, Globe, Lock, ArrowLeft, Trash2, AlertTriangle,
  Settings2, BarChart3, Shield, Link2, ExternalLink, ChevronRight
} from "lucide-react";
import dynamic from "next/dynamic";

const DashboardSection = dynamic(() => import("@/components/DashboardSection"), { ssr: false });

type Tab = "general" | "access" | "dashboard" | "danger";

const NAV_ITEMS: { id: Tab; label: string; icon: any; color: string }[] = [
  { id: "general", label: "General", icon: Settings2, color: "text-emerald-400" },
  { id: "access", label: "Access & Sharing", icon: Shield, color: "text-indigo-400" },
  { id: "dashboard", label: "Dashboard", icon: BarChart3, color: "text-sky-400" },
  { id: "danger", label: "Danger Zone", icon: AlertTriangle, color: "text-red-400" },
];

export default function ProjectSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [projectId, setProjectId] = useState<string>("");
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
  const [activeTab, setActiveTab] = useState<Tab>("general");

  useEffect(() => {
    params.then((p) => setProjectId(p.id));
  }, [params]);

  useEffect(() => {
    if (projectId) {
      setLoading(true);
      setError(null);
      fetch(`/api/projects?id=${projectId}`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch project settings");
          return res.json();
        })
        .then((data) => {
          setIsPublic(!!data.project.is_public);
          setAllowPublicEdit(!!data.project.allow_public_edit);
          setProjectName(data.project.name || "");
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [projectId]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_public: isPublic, allow_public_edit: allowPublicEdit }),
      });
      if (!res.ok) throw new Error("Failed to save settings. You might not have permission.");
      setSuccess("Settings saved successfully.");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete project.");
      router.push("/projects");
    } catch (err: any) {
      setError(err.message);
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/projects/${projectId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="text-xs text-white/30">Loading settings…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen overflow-hidden bg-[#0a0a0a] text-[#f6f4f0] selection:bg-emerald-500/30">
      {/* Ambient background gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,0.06),transparent_40%),radial-gradient(ellipse_at_bottom_right,rgba(99,102,241,0.05),transparent_40%)]" />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02] mix-blend-overlay pointer-events-none" />

      <div className="relative z-10 flex h-screen">
        {/* ─── Sidebar ─── */}
        <aside className="flex w-[260px] shrink-0 flex-col border-r border-white/[0.04] bg-[#0a0a0a]/80 backdrop-blur-xl">
          {/* Back + project name */}
          <div className="flex items-center gap-3 px-5 py-5 border-b border-white/[0.04]">
            <button
              onClick={() => router.push(`/projects/${projectId}`)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white transition-all"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-semibold tracking-tight">{projectName}</h1>
              <p className="text-[10px] font-medium tracking-widest text-emerald-400/70 uppercase">Settings</p>
            </div>
          </div>

          {/* Nav items */}
          <nav className="flex flex-col gap-0.5 p-3 flex-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`group flex items-center gap-3 rounded-xl px-4 py-2.5 text-[13px] font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-white/[0.06] text-white"
                      : "text-white/40 hover:bg-white/[0.03] hover:text-white/70"
                  }`}
                >
                  <Icon size={16} className={isActive ? item.color : "text-white/30 group-hover:text-white/50"} />
                  {item.label}
                  {isActive && <ChevronRight size={12} className="ml-auto text-white/20" />}
                </button>
              );
            })}
          </nav>

          {/* Save button */}
          {activeTab !== "dashboard" && (
            <div className="p-4 border-t border-white/[0.04]">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-emerald-500 disabled:opacity-50 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]"
              >
                {saving ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <Check size={15} />
                )}
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          )}
        </aside>

        {/* ─── Main Content ─── */}
        <main className="flex-1 overflow-y-auto">
          {/* Toast messages */}
          <div className="sticky top-0 z-20">
            {error && (
              <div className="mx-6 mt-4 rounded-xl bg-red-500/10 border border-red-500/20 px-5 py-3 flex items-center gap-3 text-red-400 backdrop-blur-sm animate-in fade-in slide-in-from-top-2">
                <AlertTriangle size={16} />
                <p className="text-sm font-medium flex-1">{error}</p>
                <button onClick={() => setError(null)} className="text-red-400/50 hover:text-red-400 text-lg">×</button>
              </div>
            )}
            {success && (
              <div className="mx-6 mt-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-5 py-3 flex items-center gap-3 text-emerald-400 backdrop-blur-sm animate-in fade-in slide-in-from-top-2">
                <Check size={16} />
                <p className="text-sm font-medium">{success}</p>
              </div>
            )}
          </div>

          {/* Tab content */}
          <div className="p-8 lg:p-12">
            {activeTab === "general" && <GeneralSection projectName={projectName} projectId={projectId} />}
            {activeTab === "access" && (
              <AccessSection
                isPublic={isPublic}
                setIsPublic={setIsPublic}
                allowPublicEdit={allowPublicEdit}
                setAllowPublicEdit={setAllowPublicEdit}
                projectId={projectId}
                copied={copied}
                handleCopyLink={handleCopyLink}
              />
            )}
            {activeTab === "dashboard" && projectId && <DashboardSection projectId={projectId} />}
            {activeTab === "danger" && (
              <DangerSection
                showDeleteConfirm={showDeleteConfirm}
                setShowDeleteConfirm={setShowDeleteConfirm}
                deleting={deleting}
                handleDelete={handleDelete}
                projectName={projectName}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* ─── General Section ─────────────────────────────────────────────────  */
/* ═══════════════════════════════════════════════════════════════════════ */
function GeneralSection({ projectName, projectId }: { projectName: string; projectId: string }) {
  return (
    <div className="max-w-2xl space-y-10">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight mb-1">General</h2>
        <p className="text-sm text-[#a8a6a2]">Basic information about your project.</p>
      </div>

      {/* Project info cards */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5">
          <label className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400/60 mb-2 block">Project Name</label>
          <p className="text-lg font-semibold tracking-tight">{projectName}</p>
        </div>
      </div>

      {/* Quick links */}
      <div>
        <h3 className="text-sm font-semibold mb-3 text-white/70">Quick Links</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <a href={`/projects/${projectId}`} className="group flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 hover:bg-white/[0.04] hover:border-white/[0.08] transition-all">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <ExternalLink size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Open Editor</p>
              <p className="text-[11px] text-white/30">Design and build your project</p>
            </div>
            <ChevronRight size={14} className="text-white/20 group-hover:text-white/40 transition-colors" />
          </a>
          
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* ─── Access & Sharing Section ────────────────────────────────────────  */
/* ═══════════════════════════════════════════════════════════════════════ */
function AccessSection({
  isPublic, setIsPublic, allowPublicEdit, setAllowPublicEdit,
  projectId, copied, handleCopyLink,
}: {
  isPublic: boolean; setIsPublic: (v: boolean) => void;
  allowPublicEdit: boolean; setAllowPublicEdit: (v: boolean) => void;
  projectId: string; copied: boolean; handleCopyLink: () => void;
}) {
  return (
    <div className="max-w-2xl space-y-10">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight mb-1">Access & Sharing</h2>
        <p className="text-sm text-[#a8a6a2]">Control who can view and edit this project.</p>
      </div>

      {/* Visibility toggle cards */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-1">Visibility</h3>
        <div
          onClick={() => { setIsPublic(false); setAllowPublicEdit(false); }}
          className={`group flex cursor-pointer items-start gap-4 rounded-2xl border p-5 transition-all duration-200 ${
            !isPublic
              ? "bg-white/[0.04] border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.04)]"
              : "bg-white/[0.01] border-white/[0.04] hover:bg-white/[0.03] hover:border-white/[0.06]"
          }`}
        >
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${
            !isPublic ? "bg-emerald-500/15 text-emerald-400" : "bg-white/[0.04] text-white/30"
          }`}>
            <Lock size={18} />
          </div>
          <div className="flex-1">
            <p className={`text-sm font-semibold ${!isPublic ? "text-white" : "text-white/60"}`}>Private Workspace</p>
            <p className="text-xs text-white/30 mt-0.5 leading-relaxed">Only you can access this project. It will not appear in the community feed.</p>
          </div>
          {!isPublic && (
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 mt-0.5">
              <Check size={13} className="text-emerald-400" />
            </div>
          )}
        </div>

        <div
          onClick={() => setIsPublic(true)}
          className={`group flex cursor-pointer items-start gap-4 rounded-2xl border p-5 transition-all duration-200 ${
            isPublic
              ? "bg-indigo-500/[0.04] border-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.04)]"
              : "bg-white/[0.01] border-white/[0.04] hover:bg-white/[0.03] hover:border-white/[0.06]"
          }`}
        >
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${
            isPublic ? "bg-indigo-500/15 text-indigo-400 shadow-[0_0_12px_rgba(99,102,241,0.2)]" : "bg-white/[0.04] text-white/30"
          }`}>
            <Globe size={18} />
          </div>
          <div className="flex-1">
            <p className={`text-sm font-semibold ${isPublic ? "text-white" : "text-white/60"}`}>Public Community</p>
            <p className="text-xs text-white/30 mt-0.5 leading-relaxed">Project is visible in the community feed. Anyone with the link can access it.</p>

            {isPublic && (
              <div className="mt-4 p-4 rounded-xl bg-black/30 border border-indigo-500/10">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400/60 mb-2 block">Visitor Permissions</label>
                <select
                  value={allowPublicEdit ? "edit" : "view"}
                  onChange={(e) => setAllowPublicEdit(e.target.value === "edit")}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full rounded-xl border border-indigo-500/20 bg-indigo-950/30 px-4 py-2.5 text-sm text-indigo-200 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20 transition-all"
                >
                  <option value="view">View Only — Visitors cannot modify the design</option>
                  <option value="edit">Collaboration Mode — Visitors can freely edit</option>
                </select>
              </div>
            )}
          </div>
          {isPublic && (
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 mt-0.5">
              <Check size={13} className="text-indigo-400" />
            </div>
          )}
        </div>
      </div>

      {/* Share link */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-3">Share Link</h3>
        <p className="text-xs text-white/30 mb-3">Send this link to collaborators.</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-white/40 font-mono text-xs overflow-hidden">
            <span className="truncate block">{typeof window !== "undefined" ? `${window.location.origin}/projects/${projectId}` : ""}</span>
          </div>
          <button
            onClick={handleCopyLink}
            className={`flex h-[46px] items-center gap-2 rounded-xl px-5 text-sm font-medium transition-all ${
              copied
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                : "bg-white/[0.04] text-white/70 border border-white/[0.06] hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* ─── Danger Zone Section ─────────────────────────────────────────────  */
/* ═══════════════════════════════════════════════════════════════════════ */
function DangerSection({
  showDeleteConfirm, setShowDeleteConfirm, deleting, handleDelete, projectName,
}: {
  showDeleteConfirm: boolean; setShowDeleteConfirm: (v: boolean) => void;
  deleting: boolean; handleDelete: () => void; projectName: string;
}) {
  const [confirmText, setConfirmText] = useState("");
  return (
    <div className="max-w-2xl space-y-10">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-red-400 mb-1">Danger Zone</h2>
        <p className="text-sm text-[#a8a6a2]">Irreversible and destructive actions for this project.</p>
      </div>

      <div className="rounded-2xl border border-red-500/15 bg-red-500/[0.03] overflow-hidden">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
              <Trash2 size={18} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white">Delete Project</h3>
              <p className="text-xs text-white/30 mt-1 leading-relaxed">
                Permanently remove <span className="font-medium text-white/50">{projectName}</span> and all associated files, commits, comments, and database data. This action cannot be undone.
              </p>
            </div>
          </div>

          {!showDeleteConfirm ? (
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-5 py-2.5 rounded-xl bg-red-500/10 text-red-400 font-medium text-sm border border-red-500/15 hover:bg-red-500/20 hover:border-red-500/25 transition-all"
              >
                Delete Project
              </button>
            </div>
          ) : (
            <div className="mt-5 space-y-4 border-t border-red-500/10 pt-5">
              <div>
                <label className="text-[11px] font-medium text-red-400/70 mb-1.5 block">
                  Type <span className="font-mono font-bold text-red-400">{projectName}</span> to confirm
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={projectName}
                  className="w-full rounded-xl border border-red-500/20 bg-red-500/[0.04] px-4 py-2.5 text-sm text-white outline-none focus:border-red-500/40 focus:ring-2 focus:ring-red-500/10 transition-all placeholder:text-white/15"
                />
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => { setShowDeleteConfirm(false); setConfirmText(""); }}
                  className="px-4 py-2.5 rounded-xl bg-white/[0.04] text-white/50 font-medium text-sm hover:bg-white/[0.06] transition-all"
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting || confirmText !== projectName}
                  className="px-5 py-2.5 rounded-xl bg-red-600 text-white font-medium text-sm hover:bg-red-500 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {deleting ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                  Permanently Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
