"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, Eye, Users } from "lucide-react";

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

export default function CommunityContent({ search = "" }: Props) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCommunityProjects() {
      try {
        const res = await fetch(`/api/projects/community?search=${encodeURIComponent(search)}`);
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
    
    // Debounce the search fetch slightly
    const timer = setTimeout(() => {
      fetchCommunityProjects();
    }, 300);
    
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header - Fixed */}
      <div className="flex-none flex items-end justify-between gap-4 px-6 sm:px-10 pt-6 sm:pt-8 pb-6 border-b border-white/[0.04] bg-white/[0.01]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1">Community Feed</h1>
          <p className="text-sm text-white/40">Explore projects published by creators around the world.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-white/70">
          <Users size={16} className="text-blue-400" />
          {projects.length} Public Projects
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6 sm:px-10 py-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 relative scroll-smooth">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="h-8 w-8 animate-spin text-blue-500" viewBox="0 0 24 24">
              <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[32px] border border-dashed border-white/[0.05] bg-white/[0.01] py-24 text-center mt-4">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.03] text-white/20">
              <Users size={24} />
            </div>
            <p className="text-base font-medium text-white/80">No community projects yet</p>
            <p className="mt-1.5 text-sm text-white/40 max-w-sm">
              {search ? "We couldn't find any public projects matching your search." : "Be the first to publish a project to the community!"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 pb-8">
            {projects.map((p) => {
              const ownerName = p.owner_email?.split("@")[0] ?? "Creator";
              const initial = ownerName.charAt(0).toUpperCase();

              return (
                <div
                  key={p.id}
                  onClick={() => router.push(`/projects/${p.id}`)}
                  className="group relative cursor-pointer overflow-hidden rounded-[24px] border border-white/[0.04] bg-white/[0.02] transition-all duration-300 hover:-translate-y-1.5 hover:bg-white/[0.04] hover:border-white/10 hover:shadow-[0_20px_40px_-15px_rgba(59,130,246,0.3)]"
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
                      <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.1),transparent)]">
                        <span className="text-5xl font-semibold text-blue-500/20 group-hover:scale-110 transition-transform duration-500 ease-out">{initial}</span>
                      </div>
                    )}
                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60" />
                    
                    {/* Floating Badge */}
                    <div className="absolute top-3 right-3 rounded-lg bg-blue-500/20 backdrop-blur-md px-2.5 py-1 text-[10px] font-semibold text-blue-300 border border-blue-500/30 uppercase tracking-wider">
                      Public
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="truncate text-base font-semibold text-white/90 group-hover:text-blue-400 transition-colors">{p.name}</h3>
                    </div>

                    {p.description ? (
                      <p className="line-clamp-2 text-xs leading-relaxed text-white/40 mb-4 h-8">{p.description}</p>
                    ) : (
                      <p className="text-xs text-white/20 mb-4 h-8 italic">No description provided.</p>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t border-white/[0.04]">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-blue-900 to-black text-[9px] font-bold text-white shadow-inner border border-blue-500/30">
                          {initial}
                        </div>
                        <p className="truncate text-xs text-white/50">{ownerName}</p>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-white/40">
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
    </div>
  );
}
