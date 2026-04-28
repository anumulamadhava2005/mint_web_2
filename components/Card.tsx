"use client";

import React from "react";

export default function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[28px] border border-black/5 bg-white/10 p-5 shadow-[0_24px_80px_-48px_rgba(20,18,15,0.28)] backdrop-blur-xl ${className}`}>
      {children}
    </div>
  );
}
