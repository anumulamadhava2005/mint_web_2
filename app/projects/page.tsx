"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProjectsContent from "@/components/ProjectsContent";
import CommunityContent from "@/components/CommunityContent";
import { Grid2X2, LogOut, MessageSquareMore, Search, Shield, Sparkles, UserCircle } from "lucide-react";

type ActiveTab = "recents" | "community";

function getCookie(name: string) {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? match[2] : null;
}

export default function Projects() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>("recents");
  const [user, setUser] = useState<{ email: string; role?: string } | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchUser() {
      try {
        // Fetch profile which includes role info
        const profileRes = await fetch("/api/profile");
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          setUser({
            email: profileData.profile.email,
            role: profileData.profile.role,
          });
          return;
        }
      } catch { /* ignore */ }

      // Fallback to token validation
      const token = getCookie("token");
      if (!token) return;
      try {
        const res = await fetch("/api/validate-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
      } catch { /* ignore */ }
    }

    fetchUser();
  }, []);

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    document.cookie = "token=; path=/; max-age=0";
    router.replace("/login");
  }

  const displayName = user?.email?.split("@")[0] ?? "User";
  const initial = displayName.charAt(0).toUpperCase();

  const stats = [
    { label: "Projects", value: "12" },
    { label: "Shared", value: "4" },
    { label: "Drafts", value: "7" },
  ];

  return (
    <div className="relative h-screen overflow-hidden bg-[#0a0a0a] text-[#f6f4f0] selection:bg-emerald-500/30">
      {/* Dynamic Ambient Background */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none" />
      
      <div className="relative z-10 mx-auto flex h-screen max-w-[1500px] flex-col px-4 py-6 sm:px-8 lg:px-12">
        <div className="grid h-[calc(100vh-3rem)] gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
          
          {/* Sidebar */}
          <aside className="flex flex-col h-full">
            <div className="flex items-center gap-3 pb-8 pl-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-sm font-bold text-[#f6f4f0] shadow-lg shadow-emerald-900/20">
                {initial}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold tracking-tight text-[#f6f4f0]">{displayName}</h2>
                <p className="text-[11px] font-medium tracking-widest text-emerald-400/80 uppercase">Mint Studio</p>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              {/* Search */}
              <div className="group relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-[#666360] group-focus-within:text-emerald-400 transition-colors">
                  <Search size={16} />
                </div>
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-2xl bg-white/[0.04] border border-white/[0.06] py-3 pl-10 pr-4 text-sm text-[#f6f4f0] placeholder:text-[#666360] outline-none transition-all focus:bg-white/[0.06] focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10"
                />
              </div>

              {/* Navigation Tabs */}
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => setActiveTab("recents")}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                    activeTab === "recents"
                      ? "bg-white/[0.08] text-[#f6f4f0] shadow-sm"
                      : "text-[#a8a6a2] hover:bg-white/[0.04] hover:text-[#d7d6d2]"
                  }`}
                >
                  <Grid2X2 size={18} className={activeTab === "recents" ? "text-emerald-400" : ""} />
                  Recent Projects
                </button>
                <button
                  onClick={() => setActiveTab("community")}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                    activeTab === "community"
                      ? "bg-white/[0.08] text-[#f6f4f0] shadow-sm"
                      : "text-[#a8a6a2] hover:bg-white/[0.04] hover:text-[#d7d6d2]"
                  }`}
                >
                  <Sparkles size={18} className={activeTab === "community" ? "text-blue-400" : ""} />
                  Community
                </button>
              </div>
            </div>

            <div className="mt-auto pt-8 pb-2 flex flex-col gap-1">
              {user?.role === "admin" && (
                <button
                  onClick={() => router.push("/admin")}
                  type="button"
                  className="group flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold text-amber-400/90 transition-all hover:bg-amber-500/10 hover:text-amber-300 border border-amber-500/15 hover:border-amber-500/25 mb-1"
                >
                  <span className="flex items-center gap-3">
                    <Shield size={16} />
                    Admin Portal
                  </span>
                </button>
              )}
              <button
                onClick={() => router.push("/profile")}
                type="button"
                className="group flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-[#a8a6a2] transition-all hover:bg-white/[0.04] hover:text-[#d7d6d2]"
              >
                <span className="flex items-center gap-3">
                  <UserCircle size={16} />
                  Profile
                </span>
              </button>
              <button
                onClick={handleLogout}
                type="button"
                className="group flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-[#a8a6a2] transition-all hover:bg-red-500/10 hover:text-red-400"
              >
                <span className="flex items-center gap-3">
                  <LogOut size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                  Sign Out
                </span>
              </button>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="flex min-w-0 min-h-0 flex-col h-full">
            <section className="flex-1 flex flex-col rounded-[32px] bg-[#0f0f0f]/80 border border-white/[0.06] shadow-2xl shadow-black/50 backdrop-blur-2xl overflow-hidden">
              {activeTab === "recents" ? (
                <ProjectsContent search={search} />
              ) : (
                <CommunityContent search={search} />
              )}
            </section>
          </main>

        </div>
      </div>
    </div>
  );
}
