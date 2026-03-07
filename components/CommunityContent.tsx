"use client";

import React from "react";
import Card from "@/components/Card";

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

export default function CommunityContent() {
  return (
    <Card>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white">Community</h2>
        <p className="text-sm text-zinc-400">
          Join discussions, share ideas, and connect with others
        </p>
      </div>

      <div className="space-y-3">
        {communityItems.map((item) => (
          <div
            key={item.id}
            className="group flex items-start justify-between rounded-lg border border-white/[0.06] bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.06] cursor-pointer"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-300">
                  {item.category}
                </span>
              </div>
              <h3 className="mt-1.5 text-sm font-semibold text-white group-hover:text-zinc-100">
                {item.title}
              </h3>
              <p className="mt-1 text-xs text-zinc-500">by {item.author}</p>
            </div>
            <div className="ml-4 flex flex-col items-end gap-1">
              <span className="text-xs text-zinc-400">
                {item.replies} replies
              </span>
              <span className="text-zinc-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
