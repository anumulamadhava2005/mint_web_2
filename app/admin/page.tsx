"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import MLogo from "@/app/M.png";
import {
  Users, UserCheck, Clock, Shield, Search,
  ChevronDown, ChevronUp, LogOut, Check, X,
  RefreshCw, CheckCircle2, XCircle, Home,
  Folder, Trash2
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────── */
type WaitlistUser = {
  id: string;
  email: string;
  fullname: string;
  role: string;
  approved: boolean;
  company: string;
  team_size: string;
  created_at: string;
};

type AdminProject = {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  owner_email: string;
  owner_fullname: string;
  created_at: string;
};

type SortKey = "fullname" | "email" | "created_at" | "approved";
type SortDir = "asc" | "desc";

/* ─── Stat Card ─────────────────────────────────────────── */
function StatCard({ label, value, icon: Icon, gradient }: {
  label: string; value: number | string; icon: any; gradient: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-sm">
      <div className={`absolute inset-0 opacity-[0.04] ${gradient}`} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#888] mb-2">{label}</p>
          <p className="text-3xl font-bold tracking-tight text-[#f5f5f7]">{value}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${gradient} bg-opacity-10`}>
          <Icon size={20} className="text-white/80" />
        </div>
      </div>
    </div>
  );
}

/* ─── User Row ──────────────────────────────────────────── */
function UserRow({ user, onToggle, toggling, onDelete, deletingUserId }: {
  user: WaitlistUser;
  onToggle: (id: string, approved: boolean) => void;
  toggling: string | null;
  onDelete: (id: string) => void;
  deletingUserId: string | null;
}) {
  const isToggling = toggling === user.id;
  const isAdmin = user.role === "admin";
  const isDeleting = deletingUserId === user.id;

  return (
    <tr className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group">
      {/* Name + Email */}
      <td className="py-4 px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-white/[0.08] to-white/[0.03] text-[13px] font-semibold text-white/70 shrink-0">
            {(user.fullname || user.email)[0]?.toUpperCase() || "?"}
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-medium text-[#f5f5f7] truncate">
              {user.fullname || "—"}
              {isAdmin && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
                  <Shield size={10} /> Admin
                </span>
              )}
            </p>
            <p className="text-[12px] text-[#888] truncate">{user.email}</p>
            <p className="text-[10px] font-mono text-[#555] truncate">{user.id}</p>
          </div>
        </div>
      </td>

      {/* Company */}
      <td className="py-4 px-4 hidden md:table-cell">
        <span className="text-[13px] text-[#a3a3a6]">{user.company || "—"}</span>
      </td>

      {/* Team Size */}
      <td className="py-4 px-4 hidden lg:table-cell">
        <span className="text-[13px] text-[#a3a3a6]">{user.team_size || "—"}</span>
      </td>

      {/* Signed Up */}
      <td className="py-4 px-4 hidden sm:table-cell">
        <span className="text-[12px] font-mono text-[#888]">
          {new Date(user.created_at).toLocaleDateString("en-US", {
            month: "short", day: "numeric", year: "numeric",
          })}
        </span>
      </td>

      {/* Status */}
      <td className="py-4 px-4">
        {user.approved ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-[11px] font-semibold text-emerald-400">
            <CheckCircle2 size={12} /> Approved
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 px-3 py-1 text-[11px] font-semibold text-orange-400">
            <Clock size={12} /> Pending
          </span>
        )}
      </td>

      {/* Action */}
      <td className="py-4 px-4 text-right">
        <div className="flex justify-end items-center gap-2">
          {!isAdmin && (
            <>
              <button
                onClick={() => onToggle(user.id, !user.approved)}
                disabled={isToggling || isDeleting}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all duration-200 disabled:opacity-50 ${
                  user.approved
                    ? "border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/15 hover:border-red-500/30"
                    : "border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/15 hover:border-emerald-500/30"
                }`}
              >
                {isToggling ? (
                  <RefreshCw size={12} className="animate-spin" />
                ) : user.approved ? (
                  <><X size={12} /> Revoke</>
                ) : (
                  <><Check size={12} /> Approve</>
                )}
              </button>
              <button
                onClick={() => onDelete(user.id)}
                disabled={isToggling || isDeleting}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-1.5 text-[12px] font-semibold text-red-400 hover:bg-red-500/15 hover:border-red-500/30 transition-all duration-200 disabled:opacity-50"
              >
                {isDeleting ? (
                  <RefreshCw size={12} className="animate-spin" />
                ) : (
                  <><Trash2 size={12} /> Delete</>
                )}
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

/* ─── Sort Header ───────────────────────────────────────── */
function SortHeader({ label, sortKey, currentSort, currentDir, onSort, className }: {
  label: string; sortKey: SortKey; currentSort: SortKey; currentDir: SortDir;
  onSort: (key: SortKey) => void; className?: string;
}) {
  const active = currentSort === sortKey;
  return (
    <th
      className={`py-3 px-4 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-[#888] cursor-pointer select-none hover:text-white/70 transition-colors ${className || ""}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && (currentDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
      </span>
    </th>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/* ─── MAIN ───────────────────────────────────────────────── */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function AdminDashboard() {
  const router = useRouter();
  const [users, setUsers] = useState<WaitlistUser[]>([]);
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [error, setError] = useState("");
  const [projectsError, setProjectsError] = useState("");
  const [toggling, setToggling] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterStatus, setFilterStatus] = useState<"all" | "approved" | "pending">("all");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [activeTab, setActiveTab] = useState<"users" | "projects">("users");

  /* ─── Fetch users ───── */
  async function fetchUsers() {
    try {
      const res = await fetch("/api/admin/users");
      if (res.status === 403) {
        router.replace("/waitlist-success");
        return;
      }
      if (res.status === 401) {
        router.replace("/login?redirect=/admin");
        return;
      }
      if (!res.ok) {
        setError("Failed to fetch users");
        return;
      }
      const data = await res.json();
      setUsers(data.users || []);
    } catch {
      setError("Network error");
    }
  }

  /* ─── Fetch projects ───── */
  async function fetchProjects() {
    try {
      setProjectsLoading(true);
      const res = await fetch("/api/admin/projects");
      if (!res.ok) {
        setProjectsError("Failed to fetch projects");
        return;
      }
      const data = await res.json();
      setProjects(data.projects || []);
      setProjectsError("");
    } catch {
      setProjectsError("Network error loading projects");
    } finally {
      setProjectsLoading(false);
    }
  }

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      await Promise.all([fetchUsers(), fetchProjects()]);
      setLoading(false);
    }
    loadAll();
  }, []);

  /* ─── Toggle approval ───── */
  async function handleToggle(userId: string, approved: boolean) {
    setToggling(userId);
    const prevUsers = [...users];
    setUsers(users.map(u => u.id === userId ? { ...u, approved } : u));

    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, approved }),
      });
      if (!res.ok) {
        setUsers(prevUsers);
        const data = await res.json();
        showToast(data.error || "Failed to update", "error");
      } else {
        const targetUser = users.find(u => u.id === userId);
        showToast(
          `${targetUser?.fullname || targetUser?.email || "User"} ${approved ? "approved" : "revoked"}`,
          "success"
        );
      }
    } catch {
      setUsers(prevUsers);
      showToast("Network error", "error");
    } finally {
      setToggling(null);
    }
  }

  /* ─── Delete User ───── */
  async function handleDeleteUser(userId: string) {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;

    if (!window.confirm(`Are you absolutely sure you want to delete user "${targetUser.fullname || targetUser.email}"?\n\nThis will permanently delete their account and ALL of their projects/files. This action CANNOT be undone.`)) {
      return;
    }

    setDeletingUserId(userId);
    try {
      const res = await fetch(`/api/admin/users?userId=${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "Failed to delete user", "error");
      } else {
        showToast("User deleted successfully", "success");
        setUsers(users.filter(u => u.id !== userId));
        setProjects(projects.filter(p => p.owner_id !== userId));
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setDeletingUserId(null);
    }
  }

  /* ─── Delete Project ───── */
  async function handleDeleteProject(projectId: string) {
    const targetProj = projects.find(p => p.id === projectId);
    if (!targetProj) return;

    if (!window.confirm(`Are you sure you want to delete project "${targetProj.name}"?\n\nThis will permanently delete the project and all its canvas files. This action cannot be undone.`)) {
      return;
    }

    setDeletingProjectId(projectId);
    try {
      const res = await fetch(`/api/admin/projects?projectId=${projectId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "Failed to delete project", "error");
      } else {
        showToast("Project deleted successfully", "success");
        setProjects(projects.filter(p => p.id !== projectId));
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setDeletingProjectId(null);
    }
  }

  /* ─── Toast ───── */
  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  /* ─── Sort ───── */
  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  /* ─── Refresh ───── */
  async function handleRefresh() {
    if (activeTab === "users") {
      await fetchUsers();
    } else {
      await fetchProjects();
    }
    showToast("Data refreshed", "success");
  }

  /* ─── Derived data ───── */
  const totalUsers = users.length;
  const approvedCount = users.filter(u => u.approved).length;
  const pendingCount = totalUsers - approvedCount;

  const filteredUsers = useMemo(() => {
    let result = [...users];

    // Filter
    if (filterStatus === "approved") result = result.filter(u => u.approved);
    if (filterStatus === "pending") result = result.filter(u => !u.approved);

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(u =>
        (u.fullname || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.company || "").toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "fullname":
          cmp = (a.fullname || "").localeCompare(b.fullname || "");
          break;
        case "email":
          cmp = (a.email || "").localeCompare(b.email || "");
          break;
        case "created_at":
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case "approved":
          cmp = Number(a.approved) - Number(b.approved);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [users, search, sortKey, sortDir, filterStatus]);

  const filteredProjects = useMemo(() => {
    let result = [...projects];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q) ||
        (p.owner_fullname || "").toLowerCase().includes(q) ||
        (p.owner_email || "").toLowerCase().includes(q)
      );
    }

    return result;
  }, [projects, search]);

  /* ─── Bulk approve ───── */
  async function handleBulkApprove() {
    const pending = users.filter(u => !u.approved && u.role !== "admin");
    if (pending.length === 0) return;

    const prevUsers = [...users];
    setUsers(users.map(u => ({ ...u, approved: true })));

    try {
      for (const user of pending) {
        await fetch("/api/admin/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, approved: true }),
        });
      }
      showToast(`Approved ${pending.length} users`, "success");
    } catch {
      setUsers(prevUsers);
      showToast("Bulk approve failed", "error");
    }
  }

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    document.cookie = "token=; path=/; max-age=0";
    router.replace("/home");
  }

  /* ─── Loading ───── */
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="text-[13px] text-[#888] font-mono">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  /* ─── Error ───── */
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <XCircle size={48} className="text-red-400 mx-auto mb-4" />
          <p className="text-[15px] text-[#f5f5f7] font-semibold mb-2">Something went wrong</p>
          <p className="text-[13px] text-[#888] mb-6">{error}</p>
          <button onClick={() => { setError(""); setLoading(true); fetchUsers(); }}
            className="inline-flex items-center gap-2 rounded-lg bg-white/[0.06] px-4 py-2 text-[13px] text-white hover:bg-white/[0.1] transition-colors">
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e0deda] antialiased">

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-2 rounded-xl border px-5 py-3 text-[13px] font-medium shadow-2xl backdrop-blur-xl transition-all duration-300 animate-[slideIn_0.3s_ease-out] ${
          toast.type === "success"
            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
            : "border-red-500/20 bg-red-500/10 text-red-400"
        }`}>
          {toast.type === "success" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          {toast.message}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}} />

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-white/[0.05] bg-[#0a0a0a]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/home" className="flex items-center gap-2.5 group">
              <Image src={MLogo} alt="Mint" width={26} height={26} className="rounded-[5px] transition-transform group-hover:scale-105" />
              <span className="text-[15px] font-semibold tracking-tight">mint</span>
            </Link>
            <span className="h-5 w-px bg-white/[0.08]" />
            <div className="flex items-center gap-1.5">
              <Shield size={14} className="text-amber-400" />
              <span className="text-[13px] font-semibold text-[#f5f5f7]">Admin Dashboard</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/home"
              className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] font-medium text-[#a3a3a6] hover:text-white hover:bg-white/[0.04] transition-all">
              <Home size={13} /> Home
            </Link>
            <button onClick={handleLogout}
              className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] font-medium text-[#a3a3a6] hover:text-white hover:bg-white/[0.04] transition-all">
              <LogOut size={13} /> Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="mx-auto max-w-7xl px-6 py-8">

        {/* ── Stats ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Users" value={totalUsers} icon={Users} gradient="bg-gradient-to-br from-blue-500 to-indigo-600" />
          <StatCard label="Approved Users" value={approvedCount} icon={UserCheck} gradient="bg-gradient-to-br from-emerald-500 to-teal-600" />
          <StatCard label="Pending Approval" value={pendingCount} icon={Clock} gradient="bg-gradient-to-br from-orange-500 to-amber-600" />
          <StatCard label="Total Projects" value={projects.length} icon={Folder} gradient="bg-gradient-to-br from-purple-500 to-pink-600" />
        </div>

        {/* ── Tab Switcher ── */}
        <div className="flex border-b border-white/[0.08] mb-6">
          <button
            onClick={() => { setActiveTab("users"); setSearch(""); }}
            className={`flex items-center gap-2 px-6 py-3 border-b-2 text-[14px] font-semibold transition-all ${
              activeTab === "users"
                ? "border-emerald-500 text-white"
                : "border-transparent text-[#888] hover:text-white"
            }`}
          >
            <Users size={16} />
            Users ({users.length})
          </button>
          <button
            onClick={() => { setActiveTab("projects"); setSearch(""); }}
            className={`flex items-center gap-2 px-6 py-3 border-b-2 text-[14px] font-semibold transition-all ${
              activeTab === "projects"
                ? "border-emerald-500 text-white"
                : "border-transparent text-[#888] hover:text-white"
            }`}
          >
            <Folder size={16} />
            Projects ({projects.length})
          </button>
        </div>

        {/* ── Controls ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={activeTab === "users" ? "Search users..." : "Search projects..."}
                className="w-64 rounded-lg border border-white/[0.08] bg-white/[0.03] py-2 pl-9 pr-4 text-[13px] text-white placeholder:text-[#555] outline-none focus:border-white/[0.15] transition-colors"
              />
            </div>

            {/* Filter (Only for Users tab) */}
            {activeTab === "users" && (
              <div className="flex rounded-lg border border-white/[0.08] overflow-hidden">
                {(["all", "approved", "pending"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilterStatus(f)}
                    className={`px-3 py-2 text-[12px] font-medium transition-all capitalize ${
                      filterStatus === f
                        ? "bg-white/[0.08] text-white"
                        : "text-[#888] hover:text-white hover:bg-white/[0.03]"
                    }`}
                  >
                    {f === "all" ? `All (${totalUsers})` :
                     f === "approved" ? `Approved (${approvedCount})` :
                     `Pending (${pendingCount})`}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button onClick={handleRefresh}
              className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[12px] font-medium text-[#a3a3a6] hover:text-white hover:bg-white/[0.04] transition-all font-mono">
              <RefreshCw size={13} /> Refresh
            </button>
            {activeTab === "users" && pendingCount > 0 && (
              <button onClick={handleBulkApprove}
                className="flex items-center gap-2 rounded-lg bg-emerald-500/15 border border-emerald-500/25 px-4 py-2 text-[12px] font-semibold text-emerald-400 hover:bg-emerald-500/25 transition-all">
                <UserCheck size={13} /> Approve All ({pendingCount})
              </button>
            )}
          </div>
        </div>

        {/* ── Content Area ── */}
        {activeTab === "users" ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] overflow-hidden animate-[fadeIn_0.2s_ease-out]">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/[0.02] border-b border-white/[0.06]">
                  <tr>
                    <SortHeader label="User" sortKey="fullname" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortHeader label="Company" sortKey="email" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="hidden md:table-cell" />
                    <th className="py-3 px-4 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-[#888] hidden lg:table-cell">Team</th>
                    <SortHeader label="Signed Up" sortKey="created_at" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="hidden sm:table-cell" />
                    <SortHeader label="Status" sortKey="approved" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <th className="py-3 px-4 text-right text-[11px] font-semibold uppercase tracking-[0.1em] text-[#888]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Users size={32} className="text-[#333]" />
                          <p className="text-[14px] text-[#888]">
                            {search ? "No users match your search" : "No users found"}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <UserRow
                        key={user.id}
                        user={user}
                        onToggle={handleToggle}
                        toggling={toggling}
                        onDelete={handleDeleteUser}
                        deletingUserId={deletingUserId}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Table footer */}
            <div className="border-t border-white/[0.04] bg-white/[0.01] px-4 py-3 flex items-center justify-between">
              <p className="text-[12px] text-[#888] font-mono">
                Showing {filteredUsers.length} of {totalUsers} users
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] overflow-hidden animate-[fadeIn_0.2s_ease-out]">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/[0.02] border-b border-white/[0.06]">
                  <tr>
                    <th className="py-3 px-4 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-[#888]">Project Name</th>
                    <th className="py-3 px-4 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-[#888]">Owner</th>
                    <th className="py-3 px-4 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-[#888]">Created Date</th>
                    <th className="py-3 px-4 text-right text-[11px] font-semibold uppercase tracking-[0.1em] text-[#888]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {projectsLoading ? (
                    <tr>
                      <td colSpan={4} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <RefreshCw size={32} className="animate-spin text-emerald-500" />
                          <p className="text-[14px] text-[#888]">Loading projects...</p>
                        </div>
                      </td>
                    </tr>
                  ) : projectsError ? (
                    <tr>
                      <td colSpan={4} className="py-16 text-center text-red-400">
                        {projectsError}
                      </td>
                    </tr>
                  ) : filteredProjects.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Folder size={32} className="text-[#333]" />
                          <p className="text-[14px] text-[#888]">
                            {search ? "No projects match your search" : "No projects found"}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredProjects.map((project) => (
                      <tr key={project.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-white/[0.08] to-white/[0.03] text-[13px] font-semibold text-white/70 shrink-0">
                              <Folder size={16} className="text-[#a3a3a6]" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[14px] font-medium text-[#f5f5f7] truncate">{project.name || "Untitled Project"}</p>
                              <p className="text-[12px] text-[#888] truncate">{project.description || "No description"}</p>
                              <p className="text-[10px] font-mono text-[#555] truncate">{project.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="min-w-0">
                            <p className="text-[13px] text-[#a3a3a6] truncate">{project.owner_fullname || "—"}</p>
                            <p className="text-[12px] text-[#888] truncate">{project.owner_email || "—"}</p>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-[12px] font-mono text-[#888]">
                            {new Date(project.created_at).toLocaleDateString("en-US", {
                              month: "short", day: "numeric", year: "numeric",
                            })}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button
                            onClick={() => handleDeleteProject(project.id)}
                            disabled={deletingProjectId === project.id}
                            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all duration-200 border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/15 hover:border-red-500/30 disabled:opacity-50"
                          >
                            {deletingProjectId === project.id ? (
                              <RefreshCw size={12} className="animate-spin" />
                            ) : (
                              <><Trash2 size={12} /> Delete</>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Table footer */}
            <div className="border-t border-white/[0.04] bg-white/[0.01] px-4 py-3 flex items-center justify-between">
              <p className="text-[12px] text-[#888] font-mono">
                Showing {filteredProjects.length} of {projects.length} projects
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
