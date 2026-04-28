"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/Card";
import { ArrowRight, Heart, Eye } from "lucide-react";
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

  function handleCreated(project: { id: string; name: string; description: string | null }) {
    router.push(`/projects/${project.id}`);
  }

  const filteredProjects = projects.filter((project) => {
    const haystack = `${project.name} ${project.description ?? ""} ${project.owner_email}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  return (
    <>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] brand-muted">Recent work</p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-medium text-black transition-transform hover:scale-[1.01]"
        >
          New Project
          <ArrowRight size={14} />
        </button>
      </div>

      <Card className="p-0 bg-black shadow-none">
        <div className="rounded-[24px] border border-black/10 bg-black p-5">
          <div className="mb-5 flex items-center justify-between">
            <div className="text-xs uppercase tracking-[0.22em] brand-muted">Workspace</div>
            <div className="text-xs brand-muted">{filteredProjects.length} items</div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="h-6 w-6 animate-spin text-white/40" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-black/20 py-14 text-center">
              <div className="mb-3 text-3xl text-white/50">◌</div>
              <p className="text-sm font-medium text-[var(--foreground)]">No matching projects.</p>
              <p className="mt-1 text-sm brand-muted">Try another search or create a new project.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredProjects.map((p) => {
                const ownerName = p.owner_email?.split("@")[0] ?? "User";
                const initial = ownerName.charAt(0).toUpperCase();

                return (
                  <div
                    key={p.id}
                    onClick={() => router.push(`/projects/${p.id}`)}
                    className="group cursor-pointer overflow-hidden rounded-[24px] border border-white/10 bg-[var(--surface)] transition-all hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_20px_50px_-30px_rgba(0,0,0,0.8)]"
                  >
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-white/5">
                      {p.thumbnail_url ? (
                        <img
                          src={p.thumbnail_url}
                          alt={p.name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,rgba(255,255,255,0.05),transparent)]">
                          <span className="text-4xl font-semibold text-white/20">{initial}</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-white text-[11px] font-semibold text-black">
                            {initial}
                          </div>

                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-semibold text-[var(--foreground)]">{p.name}</h3>
                            <p className="truncate text-xs brand-muted">by {ownerName}</p>
                          </div>
                        </div>

                        <span className="rounded-full border border-white/10 bg-[var(--surface)] px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] brand-muted">
                          open
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs brand-muted">
                        <span className="flex items-center gap-1.5">
                          <Heart size={12} />
                          {formatCount(p.likes)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Eye size={12} />
                          {formatCount(p.views)}
                        </span>
                      </div>

                      {p.description && (
                        <p className="line-clamp-2 text-sm leading-6 brand-muted">{p.description}</p>
                      )}

                      <div className="flex items-center justify-between pt-1 text-xs brand-muted">
                        <span>
                          {new Date(p.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        <span className="inline-flex items-center gap-1 font-medium text-[var(--foreground)] transition-colors group-hover:text-[var(--accent)]">
                          View
                          <ArrowRight size={12} />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      <NewProjectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={handleCreated}
      />
    </>
  );
}
