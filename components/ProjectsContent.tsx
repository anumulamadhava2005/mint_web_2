"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/Card";
import { ArrowRight, Heart, Eye, Globe } from "lucide-react";
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
  is_public?: boolean;
};

function formatCount(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

type Props = {
  search?: string;
};

export default function  ProjectsContent({ search = "" }: Props) {
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

  async function togglePublish(project: Project, e: React.MouseEvent) {
    e.stopPropagation();
    
    // Optimistic update
    setProjects(projects.map(p => p.id === project.id ? { ...p, is_public: !p.is_public } : p));
    
    try {
      const res = await fetch(`/api/projects/${project.id}/publish`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_public: !project.is_public })
      });
      if (!res.ok) {
        setProjects(projects.map(p => p.id === project.id ? { ...p, is_public: project.is_public } : p));
      }
    } catch {
      setProjects(projects.map(p => p.id === project.id ? { ...p, is_public: project.is_public } : p));
    }
  }

  function handleCreated(project: { id: string; name: string; description: string | null }) {
    router.push(`/projects/${project.id}`);
  }

  const filteredProjects = projects.filter((project) => {
    const haystack = `${project.name} ${project.description ?? ""} ${project.owner_email}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header - Fixed */}
      <div className="flex-none flex items-end justify-between gap-4 px-6 sm:px-10 pt-6 sm:pt-8 pb-6 border-b border-white/[0.06] bg-white/[0.02]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#f6f4f0] mb-1">Recent Work</h1>
          <p className="text-sm text-[#a8a6a2]">Manage and create your design projects.</p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-[#f6f4f0] shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] active:scale-95 border border-emerald-400/20"
        >
          New Project
          <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6 sm:px-10 py-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 relative scroll-smooth">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="h-8 w-8 animate-spin text-emerald-500" viewBox="0 0 24 24">
              <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[32px] border border-dashed border-white/[0.06] bg-white/[0.02] py-24 text-center mt-4">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04] text-[#666360]">
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            </div>
            <p className="text-base font-medium text-[#d7d6d2]">No projects found</p>
            <p className="mt-1.5 text-sm text-[#a8a6a2] max-w-sm">
              {search ? "We couldn't find any projects matching your search." : "Get started by creating your first design project."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 pb-8">
            {filteredProjects.map((p) => {
              const ownerName = p.owner_email?.split("@")[0] ?? "User";
              const initial = ownerName.charAt(0).toUpperCase();

              return (
                <div
                  key={p.id}
                  onClick={() => router.push(`/projects/${p.id}`)}
                  className="group relative cursor-pointer overflow-hidden rounded-[24px] border border-white/[0.06] bg-white/[0.02] transition-all duration-300 hover:-translate-y-1.5 hover:bg-white/[0.04] hover:border-white/10 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)]"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video w-full overflow-hidden bg-black/40">
                    {p.thumbnail_url ? (
                      <img
                        src={p.thumbnail_url}
                        alt={p.name}
                        className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.05),transparent)]">
                        <span className="text-5xl font-semibold text-[#55524f] group-hover:scale-110 transition-transform duration-500 ease-out">{initial}</span>
                      </div>
                    )}
                    {/* Gradient Overlay for contrast */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60" />
                    
                    {/* Floating Date Badge */}
                    <div className="absolute top-3 right-3 rounded-lg bg-black/40 backdrop-blur-md px-2.5 py-1 text-[10px] font-medium text-[#d7d6d2] border border-white/10">
                      {new Date(p.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="truncate text-base font-semibold text-[#f6f4f0] group-hover:text-emerald-400 transition-colors">{p.name}</h3>
                      <span className="shrink-0 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-400">
                        open
                      </span>
                    </div>

                    {p.description ? (
                      <p className="line-clamp-2 text-xs leading-relaxed text-[#a8a6a2] mb-4 h-8">{p.description}</p>
                    ) : (
                      <p className="text-xs text-[#666360] mb-4 h-8 italic">No description provided.</p>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-gray-700 to-gray-900 text-[9px] font-bold text-[#f6f4f0] shadow-inner">
                          {initial}
                        </div>
                        <p className="truncate text-xs text-[#a8a6a2]">{ownerName}</p>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-[#a8a6a2]">
                        <button 
                          onClick={(e) => togglePublish(p, e)}
                          className={`flex items-center gap-1.5 transition-colors mr-2 ${p.is_public ? 'text-blue-400 hover:text-blue-300' : 'hover:text-[#d7d6d2]'}`}
                          title={p.is_public ? "Unpublish from Community" : "Publish to Community"}
                        >
                          <Globe size={12} className={p.is_public ? "animate-pulse" : ""} />
                          {p.is_public ? 'Public' : 'Publish'}
                        </button>
                        <span className="flex items-center gap-1 hover:text-rose-400 transition-colors">
                          <Heart size={12} />
                          {formatCount(p.likes)}
                        </span>
                        <span className="flex items-center gap-1 hover:text-blue-400 transition-colors">
                          <Eye size={12} />
                          {formatCount(p.views)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <NewProjectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
