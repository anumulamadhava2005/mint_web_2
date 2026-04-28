"use client";

import React from "react";
import Card from "@/components/Card";
import { ArrowRight, MessageSquareMore } from "lucide-react";

const communityItems = [
  {
    id: "1",
    title: "Getting Started with Mint",
    author: "Mint Team",
    replies: 42,
    category: "Guide",
  },
  {
    id: "2",
    title: "Best practices for project structure",
    author: "Community",
    replies: 18,
    category: "Discussion",
  },
  {
    id: "3",
    title: "Share your workflow tips",
    author: "Community",
    replies: 27,
    category: "Discussion",
  },
  {
    id: "4",
    title: "Upcoming features & roadmap",
    author: "Mint Team",
    replies: 65,
    category: "Announcement",
  },
];

type Props = {
  search?: string;
};

export default function CommunityContent({ search = "" }: Props) {
  const filteredItems = communityItems.filter((item) => {
    const haystack = `${item.title} ${item.author} ${item.category}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  return (
    <Card className="p-0 bg-transparent shadow-none">
      <div className="rounded-[24px] border border-white/10 bg-[var(--surface)] p-5">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] brand-muted">Community</p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight text-[var(--foreground)]">Discussion feed</h2>
            <p className="mt-1 text-sm brand-muted">A quiet space for guides, announcements, and conversation.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[var(--surface)] px-3 py-2 text-xs uppercase tracking-[0.2em] brand-muted">
            <MessageSquareMore size={12} />
            {filteredItems.length} topics
          </div>
        </div>

        <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-white/10 bg-black/20 px-5 py-10 text-center">
            <p className="text-sm font-medium text-[var(--foreground)]">No matching discussions.</p>
            <p className="mt-1 text-sm brand-muted">Try a different search term.</p>
          </div>
        ) : (
          filteredItems.map((item) => (
          <div
            key={item.id}
            className="group flex items-start justify-between rounded-[22px] border border-white/10 bg-black/40 p-4 transition-all hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_20px_50px_-30px_rgba(0,0,0,0.8)] cursor-pointer"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider brand-muted">
                  {item.category}
                </span>
              </div>
              <h3 className="mt-1.5 text-sm font-semibold text-[var(--foreground)] group-hover:underline">
                {item.title}
              </h3>
              <p className="mt-1 text-xs brand-muted">by {item.author}</p>
            </div>
            <div className="ml-4 flex flex-col items-end gap-2">
              <span className="text-xs brand-muted">
                {item.replies} replies
              </span>
              <span className="brand-muted group-hover:text-[var(--accent)] transition-colors">
                <ArrowRight size={14} />
              </span>
            </div>
          </div>
          ))
        )}
        </div>
      </div>
    </Card>
  );
}
