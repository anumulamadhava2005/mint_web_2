"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/Card";
import Button from "@/components/Button";
import NewProjectDialog from "@/components/NewProjectDialog";

type Project = {
  id: string;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  likes: number;
  views: number;
  owner_email: string;
  created_at: string;
};

function formatCount(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

export default function ProjectsContent() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  async function fetchProjects() {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  function handleCreated(project: { id: string; name: string; description: string | null }) {
    router.push(`/projects/${project.id}`);
  }

  return (
    <>
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Your projects</h2>
            <p className="text-sm text-zinc-400">
              Manage your active projects and teams
            </p>
          </div>
          <Button
            onClick={() => setDialogOpen(true)}
            className="w-auto px-3 py-2"
          >
            New Project
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <svg className="h-6 w-6 animate-spin text-zinc-400" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 text-4xl">📁</div>
            <p className="text-sm text-zinc-400">No projects yet.</p>
            <p className="mt-1 text-sm text-zinc-500">
              Click <span className="text-white font-medium">New Project</span> to create your first one.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 justify-items-center">
            {projects.map((p) => {
              const ownerName = p.owner_email?.split("@")[0] ?? "User";
              const initial = ownerName.charAt(0).toUpperCase();

              return (
                <div
                  key={p.id}
                  onClick={() => router.push(`/projects/${p.id}`)}
                  className="group cursor-pointer w-full max-w-[260px] overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.03] transition-colors hover:border-white/[0.12]"
                >
                  {/* Thumbnail */}
                  <div className="relative h-28 w-full overflow-hidden bg-zinc-800">
                    {p.thumbnail_url ? (
                      <img
                        src={p.thumbnail_url}
                        alt={p.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
                        <span className="text-3xl font-bold text-zinc-600">{initial}</span>
                      </div>
                    )}
                  </div>

                  {/* Info row */}
                  <div className="flex items-center gap-3 px-2 py-2">
                    {/* Avatar */}
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-indigo-500 text-[11px] font-bold text-white">
                      {initial}
                    </div>

                    {/* Title + author */}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold text-white">{p.name}</h3>
                      <p className="truncate text-xs text-zinc-500">by {ownerName}</p>
                    </div>

                    {/* Stats */}
                    <div className="flex flex-shrink-0 items-center gap-3 text-xs text-zinc-500">
                      {/* Likes */}
                      <span className="flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        {formatCount(p.likes)}
                      </span>
                      {/* Views */}
                      <span className="flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {formatCount(p.views)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <NewProjectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={handleCreated}
      />
    </>
  );
}
