"use client";

import React from "react";
import { C } from "./dbStudioTheme";

/** Pill toggle switch used across the Database Studio panels. */
export function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none",
        cursor: "pointer", padding: "3px 0", color: on ? C.text : C.textDim, fontSize: 11 }}>
      <span style={{ width: 26, height: 15, borderRadius: 8, background: on ? C.accent : "#555",
        position: "relative", transition: "background .15s", flexShrink: 0 }}>
        <span style={{ position: "absolute", top: 2, left: on ? 13 : 2, width: 11, height: 11, borderRadius: "50%",
          background: "#fff", transition: "left .15s" }} />
      </span>
      {label}
    </button>
  );
}

/** Uppercase section label. */
export function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontSize: 9, fontWeight: 700, color: C.textDim, letterSpacing: ".1em", textTransform: "uppercase", ...style }}>
      {children}
    </div>
  );
}
