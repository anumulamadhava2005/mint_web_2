// ═══════════════════════════════════════════════════════════════
// Editor Store — lightweight store for top-level editor UI state
// (Viewer mode toggle, panel visibility, etc.)
// ═══════════════════════════════════════════════════════════════

import { create } from "zustand";

interface EditorState {
  viewerMode: boolean;
  setViewerMode: (v: boolean) => void;
  toggleViewerMode: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  viewerMode: false,
  setViewerMode: (v) => set({ viewerMode: v }),
  toggleViewerMode: () => set((s) => ({ viewerMode: !s.viewerMode })),
}));
