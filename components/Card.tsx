"use client";

import React from "react";

export default function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl ${className}`}>
      {children}
    </div>
  );
}
