// Shared palette + control styles for the Dev-tab Database Studio.
// Matches the Figma editor chrome (dark #1e1e1e, blue #0d99ff accent).
import type { CSSProperties } from "react";

export const C = {
  bg: "#1e1e1e",
  canvas: "#1a1a1a",
  panel: "#2c2c2c",
  panelAlt: "#383838",
  border: "#3a3a3a",
  borderSoft: "#2e2e2e",
  text: "#e5e5e5",
  textMuted: "#b3b3b3",
  textDim: "#808080",
  accent: "#0d99ff",
  accentSoft: "#0d99ff22",
  ok: "#14ae5c",
  err: "#f24822",
  pk: "#ffcd29",
} as const;

export const inputStyle: CSSProperties = {
  width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 5,
  color: C.text, fontSize: 11, padding: "5px 7px", fontFamily: "monospace", outline: "none",
};

export const iconBtn: CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28,
  borderRadius: 6, border: "none", background: "none", cursor: "pointer", color: C.textMuted,
};
