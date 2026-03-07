"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Snowfall from "react-snowfall";
import Card from "@/components/Card";
import Button from "@/components/Button";
import ProjectsContent from "@/components/ProjectsContent";
import CommunityContent from "@/components/CommunityContent";

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

  // Fetch current user details on mount
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

  // Derive display name from email (part before @)
  const displayName = user?.email?.split("@")[0] ?? "User";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="relative min-h-screen overflow-hidden bg-black">
      <Snowfall color="white" snowflakeCount={180} />

      {/* subtle background orbs */}
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-900/50 via-black to-zinc-900/50" />
      <div className="absolute -left-40 -top-40 h-80 w-80 animate-pulse rounded-full bg-white/5 blur-[100px]" />
      <div className="absolute -bottom-40 -right-40 h-80 w-80 animate-pulse rounded-full bg-white/10 blur-[100px]" style={{ animationDelay: "1s" }} />

      <div className="relative z-10 flex min-h-screen">
        {/* ───── Left sidebar ───── */}
        <aside className="flex w-64 flex-col border-r border-white/[0.06] p-3">
          {/* Account row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-indigo-500 text-xs font-bold text-white">
                {initial}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold text-white leading-none">
                  {displayName}
                </span>
                {/* dropdown chevron */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3.5 w-3.5 text-zinc-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* notification bell */}
            <button className="rounded p-1 text-zinc-400 transition-colors hover:text-white">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4.5 w-4.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </button>
          </div>

          {/* Search */}
          <div className="mt-3">
            <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3.5 w-3.5 text-zinc-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-sm text-white placeholder-zinc-500 outline-none"
              />
            </div>
          </div>

          {/* Navigation */}
          <nav className="mt-4 flex flex-col gap-0.5 text-sm">
            <button
              onClick={() => setActiveTab("recents")}
              className={`flex items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors ${
                activeTab === "recents"
                  ? "bg-white/[0.08] text-white"
                  : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
              }`}
            >
              {/* clock icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">Recents</span>
            </button>

            <button
              onClick={() => setActiveTab("community")}
              className={`flex items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors ${
                activeTab === "community"
                  ? "bg-white/[0.08] text-white"
                  : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
              }`}
            >
              {/* users / community icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <span className="font-medium">Community</span>
            </button>
          </nav>

          {/* Spacer pushes logout to bottom */}
          <div className="mt-auto pt-4">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-200"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              <span className="font-medium">Log out</span>
            </button>
          </div>
        </aside>

        {/* ───── Main content ───── */}
        <main className="flex-1 overflow-y-auto p-6">
          <header className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">
              {activeTab === "recents" ? "Projects" : "Community"}
            </h1>
          </header>

          {activeTab === "recents" ? <ProjectsContent /> : <CommunityContent />}
        </main>
      </div>
    </div>
  );
}