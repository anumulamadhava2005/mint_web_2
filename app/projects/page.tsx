"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProjectsContent from "@/components/ProjectsContent";
import CommunityContent from "@/components/CommunityContent";
import { Grid2X2, LogOut, MessageSquareMore, Search, Sparkles } from "lucide-react";

type ActiveTab = "recents" | "community";

function getCookie(name: string) {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? match[2] : null;
}

export default function Projects() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>("recents");
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchUser() {
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
      } catch {
        /* ignore */
      }
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
    <div className="relative min-h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(73,214,166,0.1),transparent_28%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.05),transparent_26%),linear-gradient(to_bottom,var(--background),#000000)]" />
      <div className="absolute inset-0 pointer-events-none opacity-[0.1] [background-image:linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] [background-size:42px_42px]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1440px] flex-col px-4 py-4 sm:px-6 lg:px-8">
        <div className="grid min-h-[calc(100vh-2rem)] gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="flex flex-col rounded-[28px] border border-white/10 bg-[var(--surface)] p-5 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.8)] backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] brand-muted">Mint Studio</p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-[var(--foreground)]">Projects</h2>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ffffff] text-sm font-semibold text-black shadow-lg shadow-black/10">
                {initial}
              </div>
            </div>

            <div className="mt-5 rounded-[22px] border border-white/5 bg-black/40 p-4">
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[var(--surface)] px-3 py-2.5">
                <Search size={16} className="text-white/40" />
                <input
                  type="text"
                  placeholder="Search projects, people, topics"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-white/40"
                />
              </div>

              <div className="mt-4 grid gap-2">
                <button
                  onClick={() => setActiveTab("recents")}
                  className={`flex items-center justify-between rounded-2xl px-3 py-3 text-left transition-colors ${
                    activeTab === "recents"
                      ? "bg-[var(--accent)] text-black"
                      : "text-white/70 hover:bg-white/5"
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Grid2X2 size={16} />
                    Recents
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab("community")}
                  className={`flex items-center justify-between rounded-2xl px-3 py-3 text-left transition-colors ${
                    activeTab === "community"
                      ? "bg-[var(--accent)] text-black"
                      : "text-white/70 hover:bg-white/5"
                  }`}
                >

                </button>
              </div>
            </div>

            {/* <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-[22px] border border-black/5 bg-white/80 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-[#8a806f]">{stat.label}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-[#14120f]">{stat.value}</p>
                </div>
              ))}
            </div> */}

            <div className="mt-auto pt-5">
              <button
                onClick={handleLogout}
                type="button"
                className="flex w-full items-center justify-between rounded-[22px] border border-white/10 bg-black/40 px-4 py-3 text-sm font-medium text-white/70 transition-colors hover:border-white/20 hover:bg-black/60 hover:text-white"
              >
                <span className="flex items-center gap-2">
                  <LogOut size={16} />
                  Log out
                </span>
                <span className="rounded-full border border-white/10 bg-[var(--surface)] px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] brand-muted">
                  secure
                </span>
              </button>
            </div>
          </aside>

          <main className="flex min-w-0 flex-col gap-4">
            <section className="rounded-[28px] border border-black/10 bg-black p-6 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.8)] backdrop-blur-xl sm:p-8">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] brand-muted">
                    <Sparkles size={12} className="brand-accent" />
                    Dashboard
                  </div>


            </section>

            <section className="flex-1 rounded-[28px] border border-black/10 bg-black p-4 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.8)] backdrop-blur-xl ">
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
