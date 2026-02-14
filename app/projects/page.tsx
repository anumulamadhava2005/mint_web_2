"use client";

import { useRouter } from "next/navigation";
import Snowfall from "react-snowfall";
import Card from "@/components/Card";
import Button from "@/components/Button";

export default function Projects() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    // Clear client-side cookie as backup
    document.cookie = "token=; path=/; max-age=0";
    router.replace("/login");
  }

  const sampleProjects = [
    { id: "1", title: "Mint Website", desc: "Marketing site + dashboard" },
    { id: "2", title: "Analytics Engine", desc: "Real-time metrics" },
    { id: "3", title: "Mobile App", desc: "iOS / Android" },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-black">
      <Snowfall color="white" snowflakeCount={180} />

      {/* subtle background orbs to match other pages */}
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-900/50 via-black to-zinc-900/50" />
      <div className="absolute -left-40 -top-40 h-80 w-80 animate-pulse rounded-full bg-white/5 blur-[100px]" />
      <div className="absolute -bottom-40 -right-40 h-80 w-80 animate-pulse rounded-full bg-white/10 blur-[100px]" style={{ animationDelay: "1s" }} />

      <header className="relative z-10 flex items-center justify-between px-6 py-6">
        <h1 className="text-2xl font-bold text-white">Projects</h1>
        <div className="flex items-center gap-3">
          <Button onClick={handleLogout} className="w-auto px-4 py-2">Log Out</Button>
        </div>
      </header>

      <main className="relative z-10 p-6">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Your projects</h2>
              <p className="text-sm text-zinc-400">Manage your active projects and teams</p>
            </div>
            <Button onClick={() => router.push('/projects/new')} className="w-auto px-3 py-2">New Project</Button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {sampleProjects.map((p) => (
              <div key={p.id} className="rounded-lg border border-white/6 bg-white/3 p-4">
                <h3 className="text-md font-semibold text-white">{p.title}</h3>
                <p className="mt-2 text-sm text-zinc-300">{p.desc}</p>
                <div className="mt-4 flex gap-2">
                  <Button onClick={() => router.push(`/projects/${p.id}`)} className="px-3 py-1">Open</Button>
                  <Button onClick={() => alert('Settings')} className="px-3 py-1">Settings</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </main>
    </div>
  );
}