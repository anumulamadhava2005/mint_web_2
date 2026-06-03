"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Check, AlertTriangle, User, Settings, Shield,
  Activity, Users, FolderOpen, GitCommit, Calendar, Mail,
  Eye, EyeOff, Globe, Moon, Sun, Monitor
} from "lucide-react";

type Tab = "profile" | "account" | "security" | "activity" | "teams";
type ProfileData = {
  profile: { id: string; email: string; fullname: string; photo: string; lang: string | null; theme: string | null; created_at: string };
  stats: { projectCount: number; commitCount: number; teamCount: number };
  teams: { id: string; name: string; is_owner: boolean; is_admin: boolean; can_edit: boolean }[];
  recentProjects: { id: string; name: string; created_at: string; updated_at: string }[];
  recentCommits: { version: number; message: string; created_at: string; project_name: string }[];
};

function getCookie(name: string) {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? match[2] : null;
}

function SidebarGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-3 pt-4 pb-1.5"><span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#666360]">{label}</span></div>
      {children}
    </div>
  );
}

function NavItem({ icon: Icon, label, active, onClick }: { icon: any; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`group flex w-full items-center gap-2.5 px-4 py-[7px] text-[13px] transition-colors ${active ? "bg-[#1f1f1f] text-[#f6f4f0] font-medium" : "text-[#a8a6a2] hover:bg-[#161616] hover:text-[#d7d6d2]"}`}>
      <Icon size={15} className={active ? "text-emerald-400" : "text-[#666360] group-hover:text-[#a8a6a2]"} />
      <span className="flex-1 text-left truncate">{label}</span>
    </button>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <div className="rounded-lg border border-[#1f1f1f] bg-[#0f0f0f] p-4 flex items-center gap-2.5">
      <div className={`flex h-8 w-8 items-center justify-center rounded-md ${color}`}><Icon size={14} /></div>
      <div><p className="text-xl font-semibold tabular-nums">{value}</p><p className="text-[11px] text-[#666360]">{label}</p></div>
    </div>
  );
}

function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"; }
function fmtDateFull(d: string) { return d ? new Date(d).toLocaleString() : "—"; }
function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function ProfilePage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("profile");
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Editable fields
  const [fullname, setFullname] = useState("");
  const [photo, setPhoto] = useState("");
  const [theme, setTheme] = useState<string | null>(null);
  const [lang, setLang] = useState<string | null>(null);

  // Security
  const [curPass, setCurPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => { if (!r.ok) throw new Error("Failed to load profile"); return r.json(); })
      .then((d: ProfileData) => {
        setData(d);
        setFullname(d.profile.fullname);
        setPhoto(d.profile.photo);
        setTheme(d.profile.theme);
        setLang(d.profile.lang);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSaveProfile = async () => {
    setSaving(true); setError(null); setSuccess(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullname, photo, theme, lang }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed to save"); }
      setSuccess("Profile updated."); setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    setError(null); setSuccess(null);
    if (newPass !== confirmPass) { setError("Passwords do not match."); return; }
    if (newPass.length < 6) { setError("Password must be at least 6 characters."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: curPass, new_password: newPass }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      setSuccess("Password changed."); setCurPass(""); setNewPass(""); setConfirmPass("");
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
    </div>
  );

  const profile = data?.profile;
  const displayName = profile?.fullname || profile?.email?.split("@")[0] || "User";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0a] text-[#f6f4f0]">
      {/* Sidebar */}
      <aside className="flex w-[220px] shrink-0 flex-col bg-[#0f0f0f] border-r border-[#1f1f1f]">
        <div className="flex items-center gap-2.5 px-4 h-[49px] border-b border-[#1f1f1f]">
          <button onClick={() => router.push("/projects")}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#777572] hover:text-[#f6f4f0] hover:bg-[#1f1f1f] transition-colors">
            <ArrowLeft size={15} />
          </button>
          <span className="text-[13px] font-medium truncate">Profile</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-2 text-[13px]">
          <SidebarGroup label="Personal">
            <NavItem icon={User} label="Profile" active={tab === "profile"} onClick={() => setTab("profile")} />
            <NavItem icon={Settings} label="Preferences" active={tab === "account"} onClick={() => setTab("account")} />
            <NavItem icon={Shield} label="Security" active={tab === "security"} onClick={() => setTab("security")} />
          </SidebarGroup>
          <SidebarGroup label="Workspace">
            <NavItem icon={Activity} label="Activity" active={tab === "activity"} onClick={() => setTab("activity")} />
            <NavItem icon={Users} label="Teams" active={tab === "teams"} onClick={() => setTab("teams")} />
          </SidebarGroup>
        </nav>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-[49px] shrink-0 items-center justify-between border-b border-[#1f1f1f] bg-[#0f0f0f] px-5">
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-medium text-[#a8a6a2]">{displayName}</span>
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">Active</span>
          </div>
          {(tab === "profile" || tab === "account") && (
            <button onClick={handleSaveProfile} disabled={saving}
              className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3.5 py-1.5 text-[12px] font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors">
              {saving ? <div className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" /> : <Check size={13} />}
              {saving ? "Saving…" : "Save"}
            </button>
          )}
        </header>

        {(error || success) && (
          <div className="px-5 pt-3">
            {error && <div className="flex items-center gap-2 rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2 text-[12px] text-red-400"><AlertTriangle size={13} /> {error} <button onClick={() => setError(null)} className="ml-auto">×</button></div>}
            {success && <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-[12px] text-emerald-400"><Check size={13} /> {success}</div>}
          </div>
        )}

        <main className="flex-1 overflow-y-auto">
          {tab === "profile" && (
            <div className="p-6 space-y-8 max-w-2xl">
              {/* Avatar + Name */}
              <div className="flex items-center gap-5">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-2xl font-bold text-white shadow-lg shadow-emerald-900/30">
                  {photo ? <img src={photo} alt="" className="h-full w-full rounded-2xl object-cover" /> : initial}
                </div>
                <div>
                  <h2 className="text-xl font-semibold">{displayName}</h2>
                  <p className="text-[13px] text-[#666360] flex items-center gap-1.5 mt-1"><Mail size={12} /> {profile?.email}</p>
                  <p className="text-[11px] text-[#666360] flex items-center gap-1.5 mt-1"><Calendar size={12} /> Member since {fmtDate(profile?.created_at || "")}</p>
                </div>
              </div>

              {/* Editable Fields */}
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#666360] mb-1.5 block">Full Name</label>
                  <input value={fullname} onChange={(e) => setFullname(e.target.value)} placeholder="Enter your name"
                    className="w-full rounded-md border border-[#282828] bg-[#161616] px-3 py-2.5 text-[13px] text-[#f6f4f0] outline-none focus:border-emerald-500/50 placeholder:text-[#333]" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#666360] mb-1.5 block">Avatar URL</label>
                  <input value={photo} onChange={(e) => setPhoto(e.target.value)} placeholder="https://example.com/avatar.jpg"
                    className="w-full rounded-md border border-[#282828] bg-[#161616] px-3 py-2.5 text-[13px] text-[#f6f4f0] outline-none focus:border-emerald-500/50 placeholder:text-[#333] font-mono" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#666360] mb-1.5 block">Email</label>
                  <input value={profile?.email || ""} disabled
                    className="w-full rounded-md border border-[#1f1f1f] bg-[#111] px-3 py-2.5 text-[13px] text-[#666360] cursor-not-allowed" />
                  <p className="text-[10px] text-[#444] mt-1">Email cannot be changed</p>
                </div>
              </div>
            </div>
          )}

          {tab === "account" && (
            <div className="p-6 space-y-6 max-w-2xl">
              <h2 className="text-[15px] font-semibold">Preferences</h2>
              {/* Theme */}
              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[#666360]">Theme</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: "dark", label: "Dark", icon: Moon },
                    { value: "light", label: "Light", icon: Sun },
                    { value: "system", label: "System", icon: Monitor },
                  ] as const).map((opt) => (
                    <button key={opt.value} onClick={() => setTheme(opt.value)}
                      className={`flex items-center gap-2.5 rounded-lg border p-3.5 transition-all ${
                        theme === opt.value ? "bg-[#0f0f0f] border-emerald-500/30" : "bg-[#0f0f0f] border-[#1f1f1f] hover:border-[#282828]"
                      }`}>
                      <opt.icon size={15} className={theme === opt.value ? "text-emerald-400" : "text-[#666360]"} />
                      <span className="text-[13px] font-medium">{opt.label}</span>
                      {theme === opt.value && <div className="ml-auto h-2 w-2 rounded-full bg-emerald-400" />}
                    </button>
                  ))}
                </div>
              </div>
              {/* Language */}
              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[#666360]">Language</label>
                <select value={lang || "en"} onChange={(e) => setLang(e.target.value)}
                  className="w-full rounded-md border border-[#282828] bg-[#161616] px-3 py-2.5 text-[13px] text-[#d7d6d2] outline-none focus:border-emerald-500/50">
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                  <option value="ja">日本語</option>
                  <option value="zh">中文</option>
                </select>
              </div>
            </div>
          )}

          {tab === "security" && (
            <div className="p-6 space-y-6 max-w-2xl">
              <h2 className="text-[15px] font-semibold">Change Password</h2>
              <div className="rounded-lg border border-[#1f1f1f] bg-[#0f0f0f] p-5 space-y-4">
                <div className="relative">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#666360] mb-1.5 block">Current Password</label>
                  <input type={showCur ? "text" : "password"} value={curPass} onChange={(e) => setCurPass(e.target.value)}
                    className="w-full rounded-md border border-[#282828] bg-[#161616] px-3 py-2.5 text-[13px] text-[#f6f4f0] outline-none focus:border-emerald-500/50 pr-10" />
                  <button type="button" onClick={() => setShowCur(!showCur)} className="absolute right-3 top-[34px] text-[#666360] hover:text-[#a8a6a2]">
                    {showCur ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <div className="relative">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#666360] mb-1.5 block">New Password</label>
                  <input type={showNew ? "text" : "password"} value={newPass} onChange={(e) => setNewPass(e.target.value)}
                    className="w-full rounded-md border border-[#282828] bg-[#161616] px-3 py-2.5 text-[13px] text-[#f6f4f0] outline-none focus:border-emerald-500/50 pr-10" />
                  <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-[34px] text-[#666360] hover:text-[#a8a6a2]">
                    {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#666360] mb-1.5 block">Confirm New Password</label>
                  <input type="password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)}
                    className="w-full rounded-md border border-[#282828] bg-[#161616] px-3 py-2.5 text-[13px] text-[#f6f4f0] outline-none focus:border-emerald-500/50" />
                </div>
                <button onClick={handleChangePassword} disabled={saving || !curPass || !newPass || !confirmPass}
                  className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-[12px] font-medium text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors mt-2">
                  {saving ? <div className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" /> : <Shield size={13} />}
                  {saving ? "Updating…" : "Update Password"}
                </button>
              </div>
            </div>
          )}

          {tab === "activity" && (
            <div className="p-6 space-y-6">
              <h2 className="text-[15px] font-semibold">Activity Overview</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <StatCard label="Projects" value={data?.stats.projectCount ?? 0} icon={FolderOpen} color="text-sky-400 bg-sky-400/10" />
                <StatCard label="Commits" value={data?.stats.commitCount ?? 0} icon={GitCommit} color="text-emerald-400 bg-emerald-400/10" />
                <StatCard label="Teams" value={data?.stats.teamCount ?? 0} icon={Users} color="text-violet-400 bg-violet-400/10" />
              </div>

              {/* Recent Projects */}
              <div>
                <h3 className="text-[13px] font-medium text-[#a8a6a2] mb-3">Recent Projects</h3>
                {(data?.recentProjects?.length ?? 0) === 0 ? (
                  <div className="rounded-lg border border-[#1f1f1f] bg-[#0f0f0f] p-8 text-center">
                    <FolderOpen size={24} className="mx-auto mb-2 text-[#282828]" />
                    <p className="text-[13px] text-[#666360]">No projects yet</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-[#1f1f1f] bg-[#0f0f0f] divide-y divide-[#1f1f1f]">
                    {data?.recentProjects.map((p) => (
                      <a key={p.id} href={`/projects/${p.id}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-[#161616] transition-colors group">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-400/10 text-sky-400"><FolderOpen size={14} /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium truncate group-hover:text-emerald-400 transition-colors">{p.name}</p>
                          <p className="text-[11px] text-[#666360]">Updated {timeAgo(p.updated_at || p.created_at)}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Commits */}
              <div>
                <h3 className="text-[13px] font-medium text-[#a8a6a2] mb-3">Recent Commits</h3>
                {(data?.recentCommits?.length ?? 0) === 0 ? (
                  <div className="rounded-lg border border-[#1f1f1f] bg-[#0f0f0f] p-8 text-center">
                    <GitCommit size={24} className="mx-auto mb-2 text-[#282828]" />
                    <p className="text-[13px] text-[#666360]">No commits yet</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-[#1f1f1f] bg-[#0f0f0f] divide-y divide-[#1f1f1f]">
                    {data?.recentCommits.map((c, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-400/10 text-emerald-400"><GitCommit size={14} /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium truncate">{c.message || `v${c.version}`}</p>
                          <p className="text-[11px] text-[#666360]">{c.project_name} · {timeAgo(c.created_at)}</p>
                        </div>
                        <span className="text-[10px] text-[#444] font-mono">v{c.version}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "teams" && (
            <div className="p-6 space-y-6 max-w-2xl">
              <h2 className="text-[15px] font-semibold">Teams</h2>
              {(data?.teams?.length ?? 0) === 0 ? (
                <div className="rounded-lg border border-[#1f1f1f] bg-[#0f0f0f] p-12 text-center">
                  <Users size={28} className="mx-auto mb-3 text-[#282828]" />
                  <p className="text-[13px] text-[#666360]">You&apos;re not part of any teams yet</p>
                  <p className="text-[11px] text-[#444] mt-1">Teams will appear here when you create or join one</p>
                </div>
              ) : (
                <div className="rounded-lg border border-[#1f1f1f] bg-[#0f0f0f] divide-y divide-[#1f1f1f]">
                  {data?.teams.map((t) => (
                    <div key={t.id} className="flex items-center gap-3 px-4 py-3.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-400/10 text-violet-400 font-semibold text-[13px]">
                        {t.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="text-[13px] font-medium">{t.name}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        t.is_owner ? "bg-amber-500/15 text-amber-400" :
                        t.is_admin ? "bg-sky-500/15 text-sky-400" :
                        "bg-[#1f1f1f] text-[#666360]"
                      }`}>
                        {t.is_owner ? "Owner" : t.is_admin ? "Admin" : t.can_edit ? "Editor" : "Viewer"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
