// ═══════════════════════════════════════════════════════════════
// PenpotEditor — Main workspace editor component
// Mirrors: frontend/src/app/main/ui/workspace.cljs
// ═══════════════════════════════════════════════════════════════
"use client";

import React, { useEffect, useMemo, useCallback, memo, useState, useRef } from "react";
import { useWorkspaceStore, type OptionsMode } from "@/lib/penpot/store";
import { useEditorStore } from "@/lib/editorStore";
import { useRuntimeStore } from "@/lib/runtime/runtime-store";
import { SVGViewport } from "./penpot/SVGViewport";
import type { UUID, PenpotShape } from "@/lib/penpot/types";
import { ROOT_FRAME_ID } from "@/lib/penpot/types";
import { DEVICE_PRESETS, type DevicePreset } from "@/lib/devicePresets";
import ConvertDialog from "./ConvertDialog";
import {
  COMPONENT_PALETTE,
  defaultComponent,
  componentSummary,
  ComponentConfigEditor,
  type CanvasFrame,
} from "./BackendPanel";
import BackendPanel from "./BackendPanel";
import { Settings, Share } from "lucide-react";
// socket.io-client removed — sync daemon uses HTTP polling now

// Stable empty array for Zustand selectors (avoids infinite loop from new [] each render)
const EMPTY_BINDING_ARR: any[] = [];
const EMPTY_PAGE_OBJECTS: Record<string, any> = {};

// ── Props ─────────────────────────────────────────────────────
interface PenpotEditorProps {
  fileId: string;
  projectId: string;
  projectName: string;
  onBack: () => void;
  readOnly?: boolean;
  onSwitchStudioMode?: (mode: string) => void;
}

export default function PenpotEditor({
  fileId,
  projectId,
  projectName,
  onBack,
  readOnly = false,
  onSwitchStudioMode,
}: PenpotEditorProps) {
  const initWorkspace = useWorkspaceStore((s) => s.initWorkspace);
  const file = useWorkspaceStore((s) => s.file);
  const saving = useWorkspaceStore((s) => s.saving);
  const lastSaved = useWorkspaceStore((s) => s.lastSaved);
  const connected = useWorkspaceStore((s) => s.connected);
  const currentPageId = useWorkspaceStore((s) => s.currentPageId);
  const optionsMode = useWorkspaceStore((s) => s.optionsMode);
  const local = useWorkspaceStore((s) => s.local);
  const setOptionsMode = useWorkspaceStore((s) => s.setOptionsMode);
  const setDrawing = useWorkspaceStore((s) => s.setDrawing);
  const saveFile = useWorkspaceStore((s) => s.saveFile);
  const undo = useWorkspaceStore((s) => s.undo);
  const redo = useWorkspaceStore((s) => s.redo);
  const toggleRulers = useWorkspaceStore((s) => s.toggleRulers);
  const toggleGrid = useWorkspaceStore((s) => s.toggleGrid);
  const showRulers = useWorkspaceStore((s) => s.showRulers);
  const showGrid = useWorkspaceStore((s) => s.showGrid);
  const setViewerMode = useEditorStore((s) => s.setViewerMode);

  const setProfile = useWorkspaceStore((s) => s.setProfile);
  const [loading, setLoading] = useState(true);
  const [convertOpen, setConvertOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitFramework, setCommitFramework] = useState<string>("react");
  const [commitToast, setCommitToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Orphan frame confirmation for commit
  const [commitOrphanDialog, setCommitOrphanDialog] = useState<{
    orphans: { id: string; name: string }[];
    allNodes: Record<string, unknown>[];
    allInteractions: Record<string, unknown>[];
    referenceFrame: any;
  } | null>(null);
  const [commitExcludedFrames, setCommitExcludedFrames] = useState<Set<string>>(new Set());

  // ── Commit handler ───────────────────────────────────────
  const handleCommit = useCallback(async () => {
    if (!file || committing || !currentPageId) return;

    setCommitting(true);
    try {
      // Save first to ensure latest state is persisted
      await saveFile();

      // Build design payload from current canvas state
      const page = file.pagesIndex[currentPageId];
      if (!page) throw new Error("No current page");

      const objects = page.objects;
      const root = objects[ROOT_FRAME_ID];
      if (!root?.shapes?.length) throw new Error("No frames on canvas");

      function r(n: number) { return Math.round(n * 10) / 10; }

      function shapeToNode(shape: PenpotShape, parentX: number, parentY: number): Record<string, unknown> {
        const typeMap: Record<string, string> = {
          frame: "FRAME", group: "GROUP", rect: "RECTANGLE", circle: "ELLIPSE",
          text: "TEXT", image: "IMAGE", path: "VECTOR", bool: "BOOLEAN_OPERATION", "svg-raw": "VECTOR",
        };
        const node: Record<string, unknown> = {
          id: shape.id, name: shape.name, type: typeMap[shape.type] || "FRAME",
          x: r(shape.x - parentX), y: r(shape.y - parentY),
          width: r(shape.width), height: r(shape.height), visible: !shape.hidden,
        };
        if (shape.rotation) node.rotation = shape.rotation;
        if (shape.opacity !== undefined && shape.opacity !== 1) node.opacity = shape.opacity;
        if (shape.fills?.length) {
          node.fills = shape.fills.map((f) => ({
            type: f.fillColorGradient ? `GRADIENT_${f.fillColorGradient.type.toUpperCase()}` : "SOLID",
            color: f.fillColor, opacity: f.fillOpacity,
          }));
        }
        if (shape.strokes?.length) {
          node.strokes = shape.strokes.map((s) => ({
            color: s.strokeColor, opacity: s.strokeOpacity,
            weight: s.strokeWidth, align: s.strokeAlignment?.toUpperCase() || "CENTER",
          }));
        }
        if (shape.rx || shape.ry) node.corners = { uniform: shape.rx || shape.ry };
        if (shape.shadow?.length) {
          node.effects = shape.shadow.filter((s) => !s.hidden).map((s) => ({
            type: s.type === "inner-shadow" ? "INNER_SHADOW" : "DROP_SHADOW",
            color: s.color, offsetX: s.offsetX, offsetY: s.offsetY, blur: s.blur, spread: s.spread,
          }));
        }
        if (shape.type === "text" && shape.content) {
          const firstP = shape.content.children?.[0];
          const firstR = firstP?.children?.[0];
          if (firstR) {
            node.text = {
              characters: shape.content.children.flatMap((p: any) => p.children.map((r: any) => r.text)).join("\n"),
              fontFamily: firstR.fontFamily, fontSize: firstR.fontSize,
              fontWeight: firstR.fontWeight, color: firstR.fill || shape.fills?.[0]?.fillColor,
            };
          }
        }
        if (shape.layoutProps?.layout) {
          const lp = shape.layoutProps;
          node.layout = {
            mode: lp.layout === "flex"
              ? (lp.layoutFlexDir === "column" || lp.layoutFlexDir === "column-reverse" ? "VERTICAL" : "HORIZONTAL")
              : lp.layout === "grid" ? "GRID" : "NONE",
            gap: lp.layoutGap, paddingTop: lp.layoutPaddingTop, paddingRight: lp.layoutPaddingRight,
            paddingBottom: lp.layoutPaddingBottom, paddingLeft: lp.layoutPaddingLeft,
          };
        }
        if (shape.type === "image" && shape.imageMetadata) {
          node.fills = [{ type: "IMAGE", imageRef: shape.imageMetadata.url || shape.id }];
        }
        if (shape.shapes?.length) {
          const kids = shape.shapes.map((id: string) => objects[id]).filter((s: any): s is PenpotShape => !!s && !s.hidden);
          if (kids.length > 0) node.children = kids.map((k: PenpotShape) => shapeToNode(k, shape.x, shape.y));
        }
        // Runtime bindings → pluginData so the tree builder picks them up
        if (shape.runtimeBindings && Object.values(shape.runtimeBindings).some(Boolean)) {
          node.pluginData = { runtimeBindings: shape.runtimeBindings };
        }
        return node;
      }

      const topFrames = root.shapes
        .map((id: string) => objects[id])
        .filter((s: any): s is PenpotShape => !!s && s.type === "frame" && !s.hidden);

      if (topFrames.length === 0) throw new Error("No visible frames to commit");

      const nodes = topFrames.map((f: PenpotShape) => shapeToNode(f, f.x, f.y));
      const maxW = Math.max(...topFrames.map((f: PenpotShape) => f.width));
      const maxH = Math.max(...topFrames.map((f: PenpotShape) => f.height));
      const referenceFrame = { id: topFrames[0].id, x: 0, y: 0, width: r(maxW), height: r(maxH) };

      // Collect interactions
      const interactions: Record<string, unknown>[] = [];
      const triggerMap: Record<string, string> = {
        click: "ON_CLICK", "mouse-press": "ON_PRESS", "mouse-over": "ON_HOVER",
        "mouse-enter": "MOUSE_ENTER", "mouse-leave": "MOUSE_LEAVE",
        "after-delay": "AFTER_TIMEOUT",
      };
      const actionMap: Record<string, string> = {
        navigate: "NAVIGATE", "open-overlay": "OPEN_OVERLAY", "close-overlay": "CLOSE_OVERLAY",
        "toggle-overlay": "OPEN_OVERLAY", "swap-overlay": "SWAP_OVERLAY",
        "prev-screen": "BACK", "open-url": "OPEN_URL", "scroll-to": "SCROLL_TO",
      };
      for (const shape of Object.values(objects) as PenpotShape[]) {
        if (shape.interactions?.length) {
          for (const ix of shape.interactions) {
            const entry: Record<string, unknown> = {
              sourceId: shape.id,
              trigger: triggerMap[ix.eventType] || "ON_CLICK",
              action: actionMap[ix.actionType] || "NAVIGATE",
            };
            // Map target/destination fields based on action type
            if (ix.actionType === "scroll-to") {
              entry.targetId = ix.scrollTargetId;
            } else if (ix.actionType === "open-url") {
              entry.destinationUrl = ix.url;
            } else {
              entry.targetId = ix.destination;
            }
            // Include delay for after-delay triggers
            if (ix.delay) entry.delay = ix.delay;
            // Include animation data if present
            if (ix.animation) {
              entry.animation = {
                type: ix.animation.animationType?.toUpperCase() || "INSTANT",
                direction: ix.animation.direction?.toUpperCase(),
                easing: ix.animation.easing?.toUpperCase().replace("-", "_") || "EASE_OUT",
                duration: ix.animation.duration || 300,
              };
            }
            interactions.push(entry);
          }
        }
      }

      // ── Orphan frame detection ──────────────────────────────
      if (nodes.length > 1) {
        const homeId = (nodes[0] as Record<string, unknown>).id as string;
        const navigatedTo = new Set<string>();
        for (const ix of interactions) {
          const action = ix.action as string;
          const targetId = ix.targetId as string | undefined;
          if ((action === "NAVIGATE" || action === "OPEN_OVERLAY" || action === "SWAP_OVERLAY") && targetId) {
            navigatedTo.add(targetId);
          }
        }
        const orphans = nodes
          .map((n: Record<string, unknown>) => ({ id: n.id as string, name: n.name as string }))
          .filter((f) => f.id !== homeId && !navigatedTo.has(f.id));

        if (orphans.length > 0) {
          // Show confirmation dialog — commit paused
          setCommitting(false);
          setCommitOrphanDialog({ orphans, allNodes: nodes, allInteractions: interactions, referenceFrame });
          setCommitExcludedFrames(new Set());
          return;
        }
      }

      // No orphans — commit directly
      await doCommit(nodes, interactions, referenceFrame);
    } catch (e: any) {
      console.error("Commit failed:", e);
      setCommitToast({ message: e.message || "Commit failed", type: "error" });
    } finally {
      setCommitting(false);
      setTimeout(() => setCommitToast(null), 4000);
    }
  }, [file, committing, saveFile, projectId, fileId, commitFramework, currentPageId]);

  // ── Actual commit (after orphan confirmation if needed) ─────
  const doCommit = useCallback(async (
    nodes: Record<string, unknown>[],
    interactions: Record<string, unknown>[],
    referenceFrame: any,
    excluded: Set<string> = new Set()
  ) => {
    if (!file) return;
    setCommitting(true);

    try {
      const filteredNodes = excluded.size > 0
        ? nodes.filter((n: Record<string, unknown>) => !excluded.has(n.id as string))
        : nodes;
      const filteredInteractions = excluded.size > 0
        ? interactions.filter((ix: Record<string, unknown>) => {
            const sourceId = ix.sourceId as string;
            const targetId = ix.targetId as string | undefined;
            return !excluded.has(sourceId) && (!targetId || !excluded.has(targetId));
          })
        : interactions;

      if (filteredNodes.length === 0) {
        setCommitToast({ message: "No frames remaining after exclusion.", type: "error" });
        return;
      }

      // POST to commit API with nodes
      const res = await fetch("/api/commit", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId, fileId,
          targetFramework: commitFramework,
          fileName: file.name || "design-export",
          nodes: filteredNodes, referenceFrame, interactions: filteredInteractions,
          runtimeSchema: useRuntimeStore.getState().schema,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Commit failed");
      }

      const result = await res.json();
      const fw = commitFramework.charAt(0).toUpperCase() + commitFramework.slice(1);
      const total = result.totalFiles ? ` of ${result.totalFiles}` : "";
      setCommitToast({ message: `Committed v${result.version} → ${fw} (${result.fileCount}${total} files changed)`, type: "success" });
    } catch (e: any) {
      console.error("Commit failed:", e);
      setCommitToast({ message: e.message || "Commit failed", type: "error" });
    } finally {
      setCommitting(false);
      setCommitOrphanDialog(null);
      setTimeout(() => setCommitToast(null), 4000);
    }
  }, [file, projectId, fileId, commitFramework]);

  // Initialize workspace on mount + set profile for collaboration
  useEffect(() => {
    if (!fileId) return;
    let cancelled = false;
    (async () => {
      try {
        // Fetch user profile so collaboration hook can connect
        const { getProfile } = await import("@/lib/penpot/repo");
        const res = await getProfile();
        if (!cancelled && res?.user) {
          setProfile({ id: res.user.id, email: res.user.email });
        }
        await initWorkspace(fileId);
      } catch (e) {
        console.error("Failed to init:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fileId, initWorkspace, setProfile]);

  // Auto-save on interval (only when dirty)
  const dirty = useWorkspaceStore((s) => s.dirty);
  useEffect(() => {
    const interval = setInterval(() => {
      if (file && dirty && !readOnly) saveFile();
    }, 30000); // save every 30s
    return () => clearInterval(interval);
  }, [file, dirty, saveFile, readOnly]);

  // Current tool label
  const currentTool: string = local.drawing?.tool || "select";

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#2c2c2c]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-sm text-[#a8a6a2]">Loading workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#2c2c2c]">
      {/* ── Top Header Bar ── */}
      <Header
        projectName={projectName}
        projectId={projectId}
        fileName={file?.name || "Untitled"}
        fileId={fileId}
        saving={saving}
        lastSaved={lastSaved}
        connected={connected}
        committing={committing}
        commitFramework={commitFramework}
        onCommitFrameworkChange={setCommitFramework}
        onBack={onBack}
        onSave={saveFile}
        onPlay={() => setViewerMode(true)}
        onConvert={() => setConvertOpen(true)}
        onSettings={() => setSettingsOpen(true)}
        onCommit={handleCommit}
        onUndo={undo}
        onRedo={redo}
        readOnly={readOnly}
        onFileNameChange={(newName: string) => {
          useWorkspaceStore.setState((state: any) => {
            if (state.file) state.file.name = newName;
          });
        }}
        onSwitchStudioMode={onSwitchStudioMode}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Panel (Layers + Pages) ── */}
        <LeftPanel />

        {/* ── Center: Toolbar + Canvas ── */}
        <div className="flex flex-1 flex-col overflow-hidden relative">
          {/* Toolbar */}
          <div className={readOnly ? "pointer-events-none" : ""}>
            <Toolbar
              currentTool={currentTool}
              onToolChange={readOnly ? () => {} : (t) => setDrawing(t === "select" ? null : t as any)}
              showRulers={showRulers}
              showGrid={showGrid}
              onToggleRulers={readOnly ? () => {} : toggleRulers}
              onToggleGrid={readOnly ? () => {} : toggleGrid}
            />
          </div>

          {/* Canvas */}
          <div className="flex-1 overflow-hidden relative">
            <SVGViewport fileId={fileId} readOnly={readOnly} />
          </div>
        </div>

        {/* ── Right Panel (Design / Inspect / Prototype) ── */}
        <RightPanel
          optionsMode={optionsMode}
          onModeChange={setOptionsMode}
          projectId={projectId}
          readOnly={readOnly}
          onSwitchStudioMode={onSwitchStudioMode}
        />
      </div>

      {/* Convert to code dialog */}
      <ConvertDialog open={convertOpen} onClose={() => setConvertOpen(false)} />

      {/* Commit orphan confirmation dialog */}
      {commitOrphanDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#2c2c2c] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-[#f6f4f0]">Unreachable Screens</h2>
                <p className="mt-0.5 text-xs text-[#a8a6a2]">
                  These screens have no navigation pointing to them
                </p>
              </div>
              <button
                onClick={() => setCommitOrphanDialog(null)}
                className="rounded-lg p-1.5 text-[#a8a6a2] transition-colors hover:bg-[#0f0f0f] hover:text-[#f6f4f0]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-4">
              <div className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span className="text-xs font-medium text-amber-300">
                    {commitOrphanDialog.orphans.length} screen{commitOrphanDialog.orphans.length > 1 ? "s" : ""} not linked
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-amber-300/70">
                  Include them in this commit or exclude them?
                </p>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {commitOrphanDialog.orphans.map((frame) => {
                  const isExcluded = commitExcludedFrames.has(frame.id);
                  return (
                    <div
                      key={frame.id}
                      className={`flex items-center justify-between rounded-lg border p-3 transition-all ${
                        isExcluded
                          ? "border-white/5 bg-white/[0.01] opacity-50"
                          : "border-emerald-500/20 bg-emerald-500/5"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#666360]">
                          <rect x="2" y="2" width="20" height="20" rx="2" />
                          <path d="M2 8h20M8 2v20" />
                        </svg>
                        <span className="text-sm text-[#f6f4f0]">{frame.name}</span>
                      </div>
                      <button
                        onClick={() => {
                          setCommitExcludedFrames((prev) => {
                            const next = new Set(prev);
                            if (next.has(frame.id)) next.delete(frame.id);
                            else next.add(frame.id);
                            return next;
                          });
                        }}
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
                          isExcluded
                            ? "bg-white/[0.08] text-[#a8a6a2] hover:bg-zinc-600"
                            : "bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30"
                        }`}
                      >
                        {isExcluded ? "Excluded" : "Included"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-white/5 px-5 py-4">
              <button
                onClick={() => setCommitOrphanDialog(null)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#a8a6a2] transition-colors hover:text-[#f6f4f0]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (commitOrphanDialog) {
                    doCommit(
                      commitOrphanDialog.allNodes,
                      commitOrphanDialog.allInteractions,
                      commitOrphanDialog.referenceFrame,
                      commitExcludedFrames
                    );
                  }
                }}
                disabled={committing}
                className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-medium transition-all ${
                  committing
                    ? "cursor-not-allowed bg-white/[0.08] text-[#666360]"
                    : "bg-violet-600 text-[#f6f4f0] hover:bg-violet-500"
                }`}
              >
                {committing ? (
                  <>
                    <div className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />
                    Committing...
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    Confirm & Commit
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Commit toast notification */}
      {commitToast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-lg backdrop-blur-sm transition-all animate-in slide-in-from-bottom-2 ${
            commitToast.type === "success"
              ? "border border-emerald-500/30 bg-emerald-950/90 text-emerald-300"
              : "border border-red-500/30 bg-red-950/90 text-red-300"
          }`}
        >
          {commitToast.type === "success" ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M15 9l-6 6M9 9l6 6" />
            </svg>
          )}
          {commitToast.message}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Header
// ═══════════════════════════════════════════════════════════════
const Header = memo(function Header({
  projectName,
  projectId,
  fileName,
  fileId,
  saving,
  lastSaved,
  connected,
  committing,
  commitFramework,
  onCommitFrameworkChange,
  onBack,
  onSave,
  onPlay,
  onConvert,
  onSettings,
  onCommit,
  onUndo,
  onRedo,
  readOnly,
  onFileNameChange,
  onSwitchStudioMode,
}: {
  projectName: string;
  projectId: string;
  fileName: string;
  fileId: string;
  saving: boolean;
  lastSaved: string | null;
  connected: boolean;
  committing: boolean;
  commitFramework: string;
  onCommitFrameworkChange: (fw: string) => void;
  onBack: () => void;
  onSave: () => void;
  onPlay: () => void;
  onConvert: () => void;
  onSettings: () => void;
  onCommit: () => void;
  onUndo: () => void;
  onRedo: () => void;
  readOnly: boolean;
  onFileNameChange: (name: string) => void;
  onSwitchStudioMode?: (mode: string) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(fileName);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Sync nameValue when fileName changes externally
  useEffect(() => {
    if (!editingName) setNameValue(fileName);
  }, [fileName, editingName]);

  // Auto-focus + select when entering edit mode
  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingName]);

  const commitRename = useCallback(async () => {
    setEditingName(false);
    const trimmed = nameValue.trim() || "Untitled";
    if (trimmed === fileName) return;
    onFileNameChange(trimmed);
    try {
      await fetch("/api/files", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: fileId, name: trimmed }),
      });
    } catch (e) {
      console.error("Failed to rename file:", e);
    }
  }, [nameValue, fileName, fileId, onFileNameChange]);
  const copyLink = () => {
    const url = window.location.origin + "/projects/" + (window.location.pathname.split("/").pop() || "");
    navigator.clipboard.writeText(url);
    // basic feedback could be added, or it relies on the settings dialog for complex sharing
  };

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.08] bg-[#2c2c2c] px-3">
      {/* Left: Back + file info */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-sm text-[#a8a6a2] hover:bg-[#0f0f0f] hover:text-[#f6f4f0]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5m7-7-7 7 7 7" />
          </svg>
          Back
        </button>
        <div className="h-4 w-px bg-white/[0.08]" />
        {onSwitchStudioMode ? (
          <div className="relative group">
            <button
              className="flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-violet-300 transition-colors hover:bg-violet-500/10 hover:text-violet-200"
              title="Switch Studio mode"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 3v2m0 14v2M5.6 5.6l1.4 1.4m10 10 1.4 1.4M3 12h2m14 0h2M5.6 18.4l1.4-1.4m10-10 1.4-1.4" />
              </svg>
              Studio
            </button>
            <div className="absolute left-0 top-full z-50 mt-1 hidden min-w-[160px] rounded-lg border border-white/[0.08] bg-[#1a1a1a] py-1 shadow-xl group-hover:block">
              {([
                { id: "screens", label: "Screen Manager" },
                { id: "state", label: "State Manager" },
                { id: "workflows", label: "Workflows" },
                { id: "navigation", label: "Navigation" },
                { id: "database", label: "Database" },
                { id: "auth", label: "Auth & RBAC" },
                { id: "theme", label: "Theme Designer" },
                { id: "components", label: "Components" },
              ] as const).map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSwitchStudioMode(item.id)}
                  className="flex w-full items-center px-3 py-1.5 text-left text-xs text-[#a8a6a2] hover:bg-white/[0.06] hover:text-[#f6f4f0]"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <a
            href={`/projects/${projectId}/studio`}
            title="Open the logic studio — state, actions, auth, data"
            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-violet-300 transition-colors hover:bg-violet-500/10 hover:text-violet-200"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 3v2m0 14v2M5.6 5.6l1.4 1.4m10 10 1.4 1.4M3 12h2m14 0h2M5.6 18.4l1.4-1.4m10-10 1.4-1.4" />
            </svg>
            Studio
          </a>
        )}
        <div className="h-4 w-px bg-white/[0.08]" />
        <span className="text-xs text-[#666360]">{projectName}</span>
        <span className="text-xs text-[#666360]">/</span>
        {editingName ? (
          <input
            ref={nameInputRef}
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setNameValue(fileName);
                setEditingName(false);
              }
            }}
            className="text-sm font-medium text-[#f6f4f0] bg-transparent border-b border-indigo-500 outline-none px-0.5 min-w-[60px] max-w-[200px]"
            style={{ width: `${Math.max(60, nameValue.length * 8)}px` }}
          />
        ) : (
          <span
            className="text-sm font-medium text-[#f6f4f0] cursor-pointer hover:text-indigo-400 transition-colors"
            onDoubleClick={() => !readOnly && setEditingName(true)}
            title="Double-click to rename"
          >
            {fileName}
          </span>
        )}
        {readOnly ? (
          <span className="rounded-full bg-[#0f0f0f] px-2 py-0.5 text-xs font-medium text-[#a8a6a2] border border-white/5">View Only</span>
        ) : saving ? (
          <span className="text-xs text-amber-400">Saving...</span>
        ) : lastSaved ? (
          <span className="text-xs text-[#666360]">Saved</span>
        ) : null}
      </div>

      {/* Center: Undo/Redo */}
      {!readOnly && (
        <div className="flex items-center gap-1">
        <button
          onClick={onUndo}
          className="rounded p-1.5 text-[#a8a6a2] hover:bg-[#0f0f0f] hover:text-[#f6f4f0]"
          title="Undo (Ctrl+Z)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 10h10a5 5 0 0 1 0 10H5" />
            <path d="M3 10l3 3m-3-3 3-3" />
          </svg>
        </button>
        <button
          onClick={onRedo}
          className="rounded p-1.5 text-[#a8a6a2] hover:bg-[#0f0f0f] hover:text-[#f6f4f0]"
          title="Redo (Ctrl+Shift+Z)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 10H11a5 5 0 0 0 0 10h8" />
            <path d="M21 10l-3 3m3-3-3-3" />
          </svg>
        </button>
        </div>
      )}

      {/* Right: Status + Play */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className={`h-2 w-2 rounded-full ${connected ? "bg-green-400" : "bg-zinc-600"}`}
          />
          <span className="text-xs text-[#666360]">
            {connected ? "Connected" : "Offline"}
          </span>
        </div>
        {!readOnly && (
          <button
            onClick={onSave}
            className="rounded px-2 py-1 text-xs text-[#a8a6a2] hover:bg-[#0f0f0f] hover:text-[#f6f4f0]"
          >
            Save
          </button>
        )}
        <button
          onClick={onConvert}
          className="flex items-center gap-1.5 rounded border border-emerald-500/30 bg-emerald-600/10 px-3 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-600/20 hover:text-emerald-300 transition-colors"
          title="Export design to code"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" />
          </svg>
          Convert
        </button>
        <div className="h-4 w-px bg-white/[0.08] mx-1" />
        <button
          onClick={copyLink}
          className="rounded p-1.5 text-[#a8a6a2] hover:bg-[#0f0f0f] hover:text-[#f6f4f0] transition-colors"
          title="Copy Link to Share"
        >
          <Share size={14} />
        </button>
        {!readOnly && (
          <button
            onClick={() => window.location.href = `/projects/${window.location.pathname.split("/").pop()}/settings`}
            className="rounded p-1.5 text-[#a8a6a2] hover:bg-[#0f0f0f] hover:text-[#f6f4f0] transition-colors mr-1"
            title="Project Settings"
          >
            <Settings size={14} />
          </button>
        )}
        {/* Commit: framework selector + commit button */}
        <div className="flex items-center gap-0.5">
          <select
            value={commitFramework}
            onChange={(e) => onCommitFrameworkChange(e.target.value)}
            disabled={committing}
            className="h-[26px] rounded-l border border-r-0 border-violet-500/30 bg-violet-600/10 px-1.5 text-[10px] font-medium text-violet-400 focus:outline-none focus:border-violet-500 appearance-none cursor-pointer"
            title="Target framework for commit"
          >
            <option value="react">React</option>
            <option value="nextjs">Next.js</option>
            <option value="vue">Vue</option>
            <option value="svelte">Svelte</option>
            <option value="react-native">RN</option>
            <option value="flutter">Flutter</option>
            <option value="html">HTML</option>
          </select>
          <button
            onClick={onCommit}
            disabled={committing}
            className={`flex items-center gap-1.5 rounded-r border px-3 py-1 text-xs font-medium transition-colors ${
              committing
                ? "border-amber-500/30 bg-amber-600/10 text-amber-300 cursor-wait"
                : "border-violet-500/30 bg-violet-600/10 text-violet-400 hover:bg-violet-600/20 hover:text-violet-300"
            }`}
            title="Commit design → generate code → push to running app"
          >
            {committing ? (
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 19V5m0 0l-4 4m4-4l4 4" />
              </svg>
            )}
            {committing ? "Committing..." : "Commit"}
          </button>
        </div>
        <button
          onClick={onPlay}
          className="flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-[#f6f4f0] hover:bg-indigo-500"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
          Play
        </button>
      </div>
    </header>
  );
});

// ═══════════════════════════════════════════════════════════════
// Toolbar
// ═══════════════════════════════════════════════════════════════
type ToolType = string;

const TOOLS: { id: ToolType; label: string; shortcut: string; icon: React.ReactNode }[] = [
  {
    id: "select",
    label: "Select",
    shortcut: "V",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
      </svg>
    ),
  },
  {
    id: "rect",
    label: "Rectangle",
    shortcut: "R",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
      </svg>
    ),
  },
  {
    id: "circle",
    label: "Ellipse",
    shortcut: "O",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
      </svg>
    ),
  },
  {
    id: "text",
    label: "Text",
    shortcut: "T",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 7V4h16v3M9 20h6M12 4v16" />
      </svg>
    ),
  },
  {
    id: "frame",
    label: "Frame",
    shortcut: "F",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="2" width="20" height="20" rx="0" />
        <path d="M2 8h20M8 2v20" />
      </svg>
    ),
  },
  {
    id: "path",
    label: "Path",
    shortcut: "P",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM19 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM5 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
        <path d="M5 7c0 9 14 9 14 0" />
      </svg>
    ),
  },
];

const Toolbar = memo(function Toolbar({
  currentTool,
  onToolChange,
  showRulers,
  showGrid,
  onToggleRulers,
  onToggleGrid,
}: {
  currentTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  showRulers: boolean;
  showGrid: boolean;
  onToggleRulers: () => void;
  onToggleGrid: () => void;
}) {
  return (
    <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/[0.08] bg-[#2c2c2c] px-2">
      <div className="flex items-center gap-0.5">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onToolChange(tool.id)}
            className={`relative rounded p-1.5 transition-colors ${
              currentTool === tool.id
                ? "bg-indigo-600 text-[#f6f4f0]"
                : "text-[#a8a6a2] hover:bg-[#0f0f0f] hover:text-[#f6f4f0]"
            }`}
            title={`${tool.label} (${tool.shortcut})`}
          >
            {tool.icon}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={onToggleRulers}
          className={`rounded px-2 py-1 text-xs ${
            showRulers ? "bg-white/[0.08] text-[#f6f4f0]" : "text-[#666360] hover:text-[#d7d6d2]"
          }`}
        >
          Rulers
        </button>
        <button
          onClick={onToggleGrid}
          className={`rounded px-2 py-1 text-xs ${
            showGrid ? "bg-white/[0.08] text-[#f6f4f0]" : "text-[#666360] hover:text-[#d7d6d2]"
          }`}
        >
          Grid
        </button>
        <ZoomControl />
      </div>
    </div>
  );
});

// ── Zoom control ──────────────────────────────────────────────
const ZoomControl = memo(function ZoomControl() {
  const zoom = useWorkspaceStore((s) => s.local.zoom);
  const setZoom = useWorkspaceStore((s) => s.setZoom);
  const setViewbox = useWorkspaceStore((s) => s.setViewbox);
  const vbox = useWorkspaceStore((s) => s.local.vbox);
  const vport = useWorkspaceStore((s) => s.local.vport);

  const changeZoom = (newZoom: number) => {
    const oldZoom = vport.width / vbox.width;
    const ratio = oldZoom / newZoom;
    const cx = vbox.x + vbox.width / 2;
    const cy = vbox.y + vbox.height / 2;
    const newW = vport.width / newZoom;
    const newH = vport.height / newZoom;
    setViewbox({
      x: cx - newW / 2,
      y: cy - newH / 2,
      width: newW,
      height: newH,
    });
    setZoom(newZoom);
  };

  return (
    <div className="flex items-center gap-1 rounded bg-[#0f0f0f] px-1">
      <button
        onClick={() => changeZoom(Math.max(0.1, (vport.width / vbox.width) / 1.2))}
        className="px-1 py-0.5 text-xs text-[#a8a6a2] hover:text-[#f6f4f0]"
      >
        -
      </button>
      <span className="min-w-[40px] text-center text-xs text-[#d7d6d2]">
        {Math.round((vport.width / vbox.width) * 100)}%
      </span>
      <button
        onClick={() => changeZoom(Math.min(64, (vport.width / vbox.width) * 1.2))}
        className="px-1 py-0.5 text-xs text-[#a8a6a2] hover:text-[#f6f4f0]"
      >
        +
      </button>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════
// Left Panel — Layers & Pages
// ═══════════════════════════════════════════════════════════════
const LeftPanel = memo(function LeftPanel() {
  const file = useWorkspaceStore((s) => s.file);
  const currentPageId = useWorkspaceStore((s) => s.currentPageId);
  const setCurrentPage = useWorkspaceStore((s) => s.setCurrentPage);
  const addPage = useWorkspaceStore((s) => s.addPage);
  const selected = useWorkspaceStore((s) => s.local.selected);
  const selectShape = useWorkspaceStore((s) => s.selectShape);
  const moveShapes = useWorkspaceStore((s) => s.moveShapes);
  const toggleLocked = useWorkspaceStore((s) => s.toggleLocked);
  const toggleHidden = useWorkspaceStore((s) => s.toggleHidden);
  const renameShape = useWorkspaceStore((s) => s.renameShape);

  const [tab, setTab] = useState<"layers" | "pages">("layers");
  const [draggedId, setDraggedId] = useState<UUID | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: UUID; position: "before" | "inside" | "after" } | null>(null);
  const [layerSearch, setLayerSearch] = useState("");
  const [editingLayerId, setEditingLayerId] = useState<UUID | null>(null);

  const pageObjects = useWorkspaceStore((s) => {
    if (!s.file || !s.currentPageId) return EMPTY_PAGE_OBJECTS;
    return s.file.pagesIndex[s.currentPageId]?.objects || EMPTY_PAGE_OBJECTS;
  });

  const rootChildren: UUID[] = pageObjects[ROOT_FRAME_ID]?.shapes || [];

  const isDescendantOf = useCallback(
    (ancestorId: UUID, nodeId: UUID): boolean => {
      let current = pageObjects[nodeId];
      while (current?.parentId) {
        if (current.parentId === ancestorId) return true;
        if (current.parentId === ROOT_FRAME_ID) break;
        current = pageObjects[current.parentId];
      }
      return false;
    },
    [pageObjects],
  );

  const resolvePlacement = useCallback(
    (targetId: UUID, position: "before" | "inside" | "after", movingId: UUID) => {
      const target = pageObjects[targetId];
      if (!target) return null;

      if (position === "inside") {
        return { parentId: targetId, index: undefined as number | undefined };
      }

      const parentId = target.parentId || ROOT_FRAME_ID;
      const parent = pageObjects[parentId];
      const siblings = parent?.shapes || [];
      const targetIndex = siblings.indexOf(targetId);
      if (targetIndex === -1) {
        return { parentId, index: undefined as number | undefined };
      }

      // Layers are rendered in reverse order (top-most first), so before/after
      // in UI maps inversely to child array insertion index.
      let index = position === "before" ? targetIndex + 1 : targetIndex;

      const moving = pageObjects[movingId];
      const currentParentId = moving?.parentId || ROOT_FRAME_ID;
      if (currentParentId === parentId) {
        const movingIndex = siblings.indexOf(movingId);
        if (movingIndex !== -1 && movingIndex < index) {
          index -= 1;
        }
      }

      return { parentId, index };
    },
    [pageObjects],
  );

  const handleDropOnLayer = useCallback(
    (targetId: UUID, fallbackPosition: "before" | "inside" | "after" = "inside") => {
      if (!draggedId) return;
      if (draggedId === targetId) {
        setDropTarget(null);
        setDraggedId(null);
        return;
      }

      const position = dropTarget?.id === targetId ? dropTarget.position : fallbackPosition;
      const placement = resolvePlacement(targetId, position, draggedId);
      if (!placement) return;

      // Prevent cycles (cannot move into own descendant subtree)
      if (
        placement.parentId === draggedId ||
        isDescendantOf(draggedId, placement.parentId)
      ) {
        setDropTarget(null);
        setDraggedId(null);
        return;
      }

      moveShapes([draggedId], placement.parentId, placement.index);
      setDropTarget(null);
      setDraggedId(null);
    },
    [draggedId, dropTarget, isDescendantOf, moveShapes, resolvePlacement],
  );

  const handleDropToRoot = useCallback(() => {
    if (!draggedId) return;
    moveShapes([draggedId], ROOT_FRAME_ID);
    setDropTarget(null);
    setDraggedId(null);
  }, [draggedId, moveShapes]);

  if (!file) return null;

  return (
    <div className="flex w-56 shrink-0 flex-col border-r border-white/[0.08] bg-[#2c2c2c]">
      {/* Tab switcher */}
      <div className="flex border-b border-white/[0.08]">
        <button
          onClick={() => setTab("layers")}
          className={`flex-1 py-2 text-xs font-medium ${
            tab === "layers" ? "border-b-2 border-indigo-500 text-[#f6f4f0]" : "text-[#666360]"
          }`}
        >
          Layers
        </button>
        <button
          onClick={() => setTab("pages")}
          className={`flex-1 py-2 text-xs font-medium ${
            tab === "pages" ? "border-b-2 border-indigo-500 text-[#f6f4f0]" : "text-[#666360]"
          }`}
        >
          Pages
        </button>
      </div>

      {/* Content */}
      <div
        className="flex-1 overflow-y-auto p-1"
        onDragOver={(e) => {
          if (!draggedId || tab !== "layers") return;
          e.preventDefault();
        }}
        onDrop={(e) => {
          if (!draggedId || tab !== "layers") return;
          e.preventDefault();
          if (!(e.target as HTMLElement).closest("[data-layer-row='true']")) {
            handleDropToRoot();
          }
        }}
      >
        {tab === "pages" ? (
          <div className="space-y-0.5">
            {file.pages.map((pid) => {
              const page = file.pagesIndex[pid];
              return (
                <button
                  key={pid}
                  onClick={() => setCurrentPage(pid)}
                  className={`w-full rounded px-2 py-1.5 text-left text-xs ${
                    pid === currentPageId
                      ? "bg-indigo-600/20 text-indigo-300"
                      : "text-[#a8a6a2] hover:bg-[#0f0f0f]"
                  }`}
                >
                  {page?.name || "Untitled Page"}
                </button>
              );
            })}
            <button
              onClick={() => addPage()}
              className="mt-1 w-full rounded border border-dashed border-white/[0.08] py-1.5 text-xs text-[#666360] hover:border-zinc-500 hover:text-[#d7d6d2]"
            >
              + Add Page
            </button>
          </div>
        ) : (
          <>
            {/* Layer search */}
            <div className="px-1 pb-1">
              <input
                type="text"
                placeholder="Search layers…"
                value={layerSearch}
                onChange={(e) => setLayerSearch(e.target.value)}
                className="w-full rounded bg-[#0f0f0f] px-2 py-1 text-xs text-[#d7d6d2] outline-none placeholder:text-zinc-600 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <LayerTree
              objects={pageObjects}
              childIds={rootChildren}
              depth={0}
              selected={selected}
              onSelect={selectShape}
              draggedId={draggedId}
              dropTarget={dropTarget}
              onDragStart={setDraggedId}
              onDragEnd={() => {
                setDraggedId(null);
                setDropTarget(null);
              }}
              onDragOverLayer={(e, id) => {
                if (!draggedId) return;
                e.preventDefault();
                const el = e.currentTarget;
                const rect = el.getBoundingClientRect();
                const y = e.clientY - rect.top;
                const threshold = Math.max(4, rect.height * 0.25);
                const position = y < threshold
                  ? "before"
                  : y > rect.height - threshold
                    ? "after"
                    : "inside";
                setDropTarget({ id, position });
              }}
              onDropOnLayer={handleDropOnLayer}
              onToggleLocked={(id) => toggleLocked([id])}
              onToggleHidden={(id) => toggleHidden([id])}
              editingLayerId={editingLayerId}
              onStartEdit={setEditingLayerId}
              onFinishEdit={(id, name) => {
                renameShape(id, name);
                setEditingLayerId(null);
              }}
              searchFilter={layerSearch}
            />
          </>
        )}
      </div>
    </div>
  );
});

// ── Layer tree (recursive) ────────────────────────────────────
function LayerTree({
  objects,
  childIds,
  depth,
  selected,
  onSelect,
  draggedId,
  dropTarget,
  onDragStart,
  onDragEnd,
  onDragOverLayer,
  onDropOnLayer,
  onToggleLocked,
  onToggleHidden,
  editingLayerId,
  onStartEdit,
  onFinishEdit,
  searchFilter,
}: {
  objects: Record<UUID, PenpotShape>;
  childIds: UUID[];
  depth: number;
  selected: Set<UUID>;
  onSelect: (id: UUID, multi?: boolean) => void;
  draggedId: UUID | null;
  dropTarget: { id: UUID; position: "before" | "inside" | "after" } | null;
  onDragStart: (id: UUID) => void;
  onDragEnd: () => void;
  onDragOverLayer: (e: React.DragEvent<HTMLButtonElement>, id: UUID) => void;
  onDropOnLayer: (id: UUID, fallbackPosition?: "before" | "inside" | "after") => void;
  onToggleLocked: (id: UUID) => void;
  onToggleHidden: (id: UUID) => void;
  editingLayerId: UUID | null;
  onStartEdit: (id: UUID) => void;
  onFinishEdit: (id: UUID, name: string) => void;
  searchFilter: string;
}) {
  return (
    <>
      {[...childIds].reverse().map((id) => {
        const shape = objects[id];
        if (!shape) return null;

        // Search filtering
        const matchesSearch = !searchFilter || (shape.name || shape.type).toLowerCase().includes(searchFilter.toLowerCase());
        const hasMatchingChild = searchFilter && shape.shapes?.some((cid) => {
          const child = objects[cid];
          return child && (child.name || child.type).toLowerCase().includes(searchFilter.toLowerCase());
        });
        if (searchFilter && !matchesSearch && !hasMatchingChild) return null;

        const isSelected = selected.has(id);
        const hasChildren = shape.shapes && shape.shapes.length > 0;
        const isDragging = draggedId === id;
        const isDropBefore = dropTarget?.id === id && dropTarget.position === "before";
        const isDropInside = dropTarget?.id === id && dropTarget.position === "inside";
        const isDropAfter = dropTarget?.id === id && dropTarget.position === "after";
        const isEditing = editingLayerId === id;

        return (
          <div key={id}>
            <div
              className={`group flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-xs ${
                isSelected
                  ? "bg-indigo-600/20 text-indigo-300"
                  : "text-[#a8a6a2] hover:bg-[#0f0f0f]"
              } ${isDragging ? "opacity-40" : ""} ${isDropInside ? "bg-indigo-600/25 ring-1 ring-indigo-500/50" : ""} ${isDropBefore ? "border-t border-indigo-500" : ""} ${isDropAfter ? "border-b border-indigo-500" : ""}`}
              style={{ paddingLeft: `${depth * 12 + 4}px` }}
            >
              <button
                data-layer-row="true"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", id);
                  onDragStart(id);
                }}
                onDragEnd={onDragEnd}
                onDragOver={(e) => onDragOverLayer(e, id)}
                onDrop={(e) => {
                  e.preventDefault();
                  onDropOnLayer(id);
                }}
                onClick={(e) => onSelect(id, e.shiftKey || e.ctrlKey || e.metaKey)}
                onDoubleClick={() => onStartEdit(id)}
                className="flex flex-1 items-center gap-1.5 truncate py-0.5"
              >
                <ShapeIcon type={shape.type} />
                {isEditing ? (
                  <input
                    autoFocus
                    defaultValue={shape.name || shape.type}
                    onBlur={(e) => onFinishEdit(id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onFinishEdit(id, (e.target as HTMLInputElement).value);
                      if (e.key === "Escape") onFinishEdit(id, shape.name || shape.type);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full rounded bg-white/[0.08] px-1 py-0 text-xs text-zinc-100 outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                ) : (
                  <span className="truncate">{shape.name || shape.type}</span>
                )}
              </button>

              {/* Lock/Unlock + Hide/Show buttons — visible on hover or when active */}
              <div className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleHidden(id); }}
                  className={`rounded p-0.5 transition-colors ${shape.hidden ? "text-amber-400 opacity-100" : "text-zinc-600 hover:text-[#d7d6d2]"}`}
                  title={shape.hidden ? "Show" : "Hide"}
                  style={shape.hidden ? { opacity: 1 } : undefined}
                >
                  {shape.hidden ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleLocked(id); }}
                  className={`rounded p-0.5 transition-colors ${shape.locked ? "text-red-400 opacity-100" : "text-zinc-600 hover:text-[#d7d6d2]"}`}
                  title={shape.locked ? "Unlock" : "Lock"}
                  style={shape.locked ? { opacity: 1 } : undefined}
                >
                  {shape.locked ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0110 0v4" />
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 019.9-1" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            {hasChildren && (
              <LayerTree
                objects={objects}
                childIds={shape.shapes!}
                depth={depth + 1}
                selected={selected}
                onSelect={onSelect}
                draggedId={draggedId}
                dropTarget={dropTarget}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onDragOverLayer={onDragOverLayer}
                onDropOnLayer={onDropOnLayer}
                onToggleLocked={onToggleLocked}
                onToggleHidden={onToggleHidden}
                editingLayerId={editingLayerId}
                onStartEdit={onStartEdit}
                onFinishEdit={onFinishEdit}
                searchFilter={searchFilter}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

function ShapeIcon({ type }: { type: string }) {
  const size = "h-3.5 w-3.5 shrink-0";
  switch (type) {
    case "frame":
      // # hash/grid icon (Penpot frame style)
      return <svg className={`${size} text-indigo-400`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="6" y1="2" x2="6" y2="14" /><line x1="10" y1="2" x2="10" y2="14" /><line x1="2" y1="6" x2="14" y2="6" /><line x1="2" y1="10" x2="14" y2="10" /></svg>;
    case "rect":
      return <svg className={`${size} text-zinc-400`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="12" height="12" rx="0.5" /></svg>;
    case "circle":
      return <svg className={`${size} text-zinc-400`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6" /></svg>;
    case "text":
      // T letter icon (Penpot text style)
      return <svg className={`${size} text-zinc-400`} viewBox="0 0 16 16" fill="currentColor"><text x="3.5" y="13" fontSize="13" fontWeight="600" fontFamily="Inter, system-ui, sans-serif">T</text></svg>;
    case "path":
    case "svg-raw":
      // Pen nib / bezier icon
      return <svg className={`${size} text-zinc-400`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M12 2l2 2-7 7-3 1 1-3 7-7z" /><path d="M10 4l2 2" /></svg>;
    case "image":
      // Landscape icon
      return <svg className={`${size} text-zinc-400`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="2" y="3" width="12" height="10" rx="1" /><circle cx="5.5" cy="6.5" r="1.5" /><path d="M2 11l3-3 2.5 2 3-4L14 10" strokeLinejoin="round" /></svg>;
    case "group":
      // Overlapping squares
      return <svg className={`${size} text-zinc-400`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1.5" y="4.5" width="8" height="8" rx="0.5" /><rect x="6.5" y="1.5" width="8" height="8" rx="0.5" opacity="0.5" /></svg>;
    case "bool":
      return <svg className={`${size} text-zinc-400`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="6" cy="8" r="4" /><circle cx="10" cy="8" r="4" /></svg>;
    default:
      // Dashed placeholder
      return <svg className={`${size} text-zinc-600`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1.5"><rect x="2" y="2" width="12" height="12" rx="0.5" /></svg>;
  }
}

// ═══════════════════════════════════════════════════════════════
// Right Panel — Design / Inspect / Prototype tabs
// ═══════════════════════════════════════════════════════════════
const RightPanel = memo(function RightPanel({
  optionsMode,
  onModeChange,
  projectId,
  readOnly = false,
  onSwitchStudioMode,
}: {
  optionsMode: OptionsMode;
  onModeChange: (mode: OptionsMode) => void;
  projectId: string;
  readOnly?: boolean;
  onSwitchStudioMode?: (mode: string) => void;
}) {
  const [panelWidth, setPanelWidth] = useState(optionsMode === "backend" ? 400 : 320);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  // Top-level canvas frames → screens for the Backend "Screens" tab
  const file = useWorkspaceStore((s) => s.file);
  const currentPageId = useWorkspaceStore((s) => s.currentPageId);
  const frames = useMemo(() => {
    if (!file || !currentPageId) return [] as { id: string; name: string }[];
    const objects = file.pagesIndex[currentPageId]?.objects || {};
    const root = objects[ROOT_FRAME_ID];
    return (root?.shapes || [])
      .map((id: string) => objects[id])
      .filter((s: any) => s && s.type === "frame" && !s.hidden)
      .map((f: any) => ({ id: f.id, name: f.name }));
  }, [file, currentPageId]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = panelWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = ev.clientX - startX.current;
      const newWidth = Math.max(260, Math.min(600, startWidth.current + delta));
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [panelWidth]);

  return (
    <div
      className="relative flex shrink-0 flex-col border-l border-white/[0.08] bg-[#2c2c2c]"
      style={{ width: panelWidth }}
    >
      {/* Drag handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute left-0 top-0 bottom-0 z-10 w-1 cursor-col-resize transition-colors hover:bg-indigo-500/40"
      />

      {/* Mode tabs — always interactive, even in readOnly */}
      <div className="flex border-b border-white/[0.08]">
        {(["design", "inspect", "prototype", "backend"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => onModeChange(mode)}
            className={`flex-1 py-2 text-xs font-medium capitalize ${
              optionsMode === mode
                ? mode === "backend"
                  ? "border-b-2 border-emerald-500 text-emerald-400"
                  : "border-b-2 border-indigo-500 text-[#f6f4f0]"
                : "text-[#666360] hover:text-[#d7d6d2]"
            }`}
          >
            {mode === "backend" ? "⚙ Backend" : mode}
          </button>
        ))}
      </div>

      {/* Tab content — scrollable with hidden scrollbar, non-editable in readOnly */}
      <div
        className={`flex-1 overflow-y-auto ${readOnly ? "right-panel-readonly" : ""}`}
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}
      >
        {optionsMode === "design" && <DesignPanel frames={frames} onSwitchStudioMode={onSwitchStudioMode} />}
        {optionsMode === "inspect" && <InspectPanel />}
        {optionsMode === "prototype" && <PrototypePanel onSwitchStudioMode={onSwitchStudioMode} />}
        {optionsMode === "backend" && (
          onSwitchStudioMode ? (
            <StudioLinksPanel onSwitch={onSwitchStudioMode} />
          ) : (
            <BackendPanel projectId={projectId} frames={frames} />
          )
        )}
      </div>

      {/* Hide webkit scrollbar via inline style tag */}
      <style>{`
        .flex-1.overflow-y-auto::-webkit-scrollbar { display: none; }
        .right-panel-readonly input,
        .right-panel-readonly select,
        .right-panel-readonly textarea,
        .right-panel-readonly button {
          pointer-events: none !important;
          cursor: default !important;
        }
      `}</style>
    </div>
  );
});

// ── Shared hook: derive selected shapes from stable state ─────
function useSelectedShapes(): PenpotShape[] {
  const selected = useWorkspaceStore((s) => s.local.selected);
  const file = useWorkspaceStore((s) => s.file);
  const currentPageId = useWorkspaceStore((s) => s.currentPageId);
  return useMemo(() => {
    if (!file || !currentPageId) return [];
    const objects = file.pagesIndex[currentPageId]?.objects || {};
    return Array.from(selected)
      .map((id) => objects[id])
      .filter(Boolean);
  }, [selected, file, currentPageId]);
}

// ── Collapsible Section ───────────────────────────────────────
function CollapsibleSection({
  title,
  icon,
  badge,
  defaultOpen = true,
  accentColor,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  badge?: string;
  defaultOpen?: boolean;
  accentColor?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/[0.04] last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.02]"
      >
        {icon && <span className={`shrink-0 ${accentColor || "text-zinc-500"}`}>{icon}</span>}
        <span className={`text-[11px] font-semibold tracking-wide uppercase ${accentColor || "text-zinc-400"}`}>
          {title}
        </span>
        {badge && (
          <span className="ml-auto rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px] text-zinc-500">
            {badge}
          </span>
        )}
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className={`${badge ? "" : "ml-auto"} shrink-0 text-zinc-600 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && <div className="px-3.5 pb-3 pt-0.5">{children}</div>}
    </div>
  );
}

// ── Screens & Components Section (shared with Backend UI tab) ─
function ScreensSection({ frames }: { frames: CanvasFrame[] }) {
  const screens = useRuntimeStore((s) => s.schema.screens ?? EMPTY_BINDING_ARR);
  const addScreen = useRuntimeStore((s) => s.addScreen);
  const removeScreen = useRuntimeStore((s) => s.removeScreen);
  const syncFromCanvas = useRuntimeStore((s) => s.syncFromCanvas);
  const addComponent = useRuntimeStore((s) => s.addComponent);
  const removeComponent = useRuntimeStore((s) => s.removeComponent);
  const moveComponent = useRuntimeStore((s) => s.moveComponent);

  const [selectedId, setSelectedId] = useState<string>("");
  const [newScreen, setNewScreen] = useState("");
  const [showPalette, setShowPalette] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId && screens.length) setSelectedId((screens[0] as any).id);
  }, [screens, selectedId]);

  const screen: any = screens.find((s: any) => s.id === selectedId) || screens[0];
  const components: any[] = screen?.components || [];
  const unsyncedFrames = frames.filter((f) => !screens.some((s: any) => s.id === f.id));

  const handleAddScreen = () => {
    if (!newScreen.trim()) return;
    const slug = newScreen.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const id = crypto.randomUUID();
    addScreen({ id, name: newScreen.trim(), route: `/${slug}`, components: [], localState: [], actions: [] } as any);
    setSelectedId(id);
    setNewScreen("");
  };

  return (
    <div className="space-y-2 text-xs">
      {/* Screen selector */}
      <div className="flex items-center gap-1">
        <select value={screen?.id || ""} onChange={(e) => setSelectedId(e.target.value)}
          className="flex-1 rounded bg-zinc-800 px-2 py-1 text-xs text-white outline-none ring-1 ring-zinc-700 focus:ring-indigo-500">
          {screens.length === 0 && <option value="">No screens</option>}
          {screens.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {screen && (
          <button onClick={() => { removeScreen(screen.id); setSelectedId(""); }}
            title="Delete screen" className="text-zinc-500 hover:text-red-400">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" /></svg>
          </button>
        )}
      </div>

      {/* Add screen + sync */}
      <div className="flex items-center gap-1">
        <input value={newScreen} onChange={(e) => setNewScreen(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddScreen()}
          placeholder="New screen name…" className="flex-1 rounded bg-zinc-900 px-1.5 py-0.5 text-xs text-white outline-none ring-1 ring-zinc-700 focus:ring-indigo-500" />
        <button onClick={handleAddScreen} className="rounded bg-indigo-600 p-1 text-white hover:bg-indigo-500">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </div>
      {unsyncedFrames.length > 0 && (
        <button onClick={() => { syncFromCanvas(frames); if (!selectedId && frames[0]) setSelectedId(frames[0].id); }}
          className="w-full rounded border border-dashed border-indigo-700/60 bg-indigo-900/20 py-1 text-[10px] text-indigo-300 hover:bg-indigo-900/40">
          ⟳ Sync {unsyncedFrames.length} canvas frame{unsyncedFrames.length > 1 ? "s" : ""} → screens
        </button>
      )}

      {/* Component list */}
      {screen && (
        <>
          <p className="text-[10px] text-zinc-500 uppercase font-semibold tracking-wider">Components · {screen.name}</p>
          {components.length === 0 && (
            <div className="rounded-lg border border-dashed border-zinc-700 p-3 text-center text-zinc-500">
              <p className="text-[10px]">No components. Add one below.</p>
            </div>
          )}
          {components.map((c: any, i: number) => (
            <div key={c.id} className="rounded-lg border border-zinc-700/60 bg-zinc-800/50">
              <div className="flex items-center gap-1.5 px-2 py-1.5 cursor-pointer" onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                <span className="text-[10px] text-indigo-400">{expanded === c.id ? "▼" : "▶"}</span>
                <span className="rounded bg-indigo-900/40 px-1 py-0.5 text-[9px] text-indigo-300">{c.type}</span>
                <span className="truncate text-[11px] text-zinc-300">{componentSummary(c)}</span>
                <span className="ml-auto flex items-center gap-0.5">
                  <button onClick={(e) => { e.stopPropagation(); moveComponent(screen.id, c.id, -1); }} disabled={i === 0}
                    className="px-0.5 text-zinc-500 hover:text-zinc-200 disabled:opacity-30">↑</button>
                  <button onClick={(e) => { e.stopPropagation(); moveComponent(screen.id, c.id, 1); }} disabled={i === components.length - 1}
                    className="px-0.5 text-zinc-500 hover:text-zinc-200 disabled:opacity-30">↓</button>
                  <button onClick={(e) => { e.stopPropagation(); removeComponent(screen.id, c.id); }}
                    className="px-0.5 text-zinc-500 hover:text-red-400">×</button>
                </span>
              </div>
              {expanded === c.id && (
                <div className="border-t border-zinc-700/50 px-2 py-1.5">
                  <ComponentConfigEditor screenId={screen.id} component={c} />
                </div>
              )}
            </div>
          ))}

          {/* Component palette */}
          <button onClick={() => setShowPalette(!showPalette)}
            className="w-full rounded bg-zinc-700/50 py-1 text-[10px] text-zinc-300 hover:bg-zinc-700">
            {showPalette ? "Hide components" : "+ Add Component"}
          </button>
          {showPalette && (
            <div className="space-y-1.5 rounded border border-zinc-700/50 bg-zinc-900/40 p-1.5">
              {COMPONENT_PALETTE.map((g) => (
                <div key={g.group}>
                  <p className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1">{g.group}</p>
                  <div className="flex flex-wrap gap-1">
                    {g.items.map((it) => (
                      <button key={it.type}
                        onClick={() => { const comp = defaultComponent(it.type); addComponent(screen.id, comp); setExpanded(comp.id); }}
                        className="flex items-center gap-1 rounded border border-zinc-700/50 bg-zinc-900/60 px-1.5 py-0.5 text-[10px] text-zinc-400 hover:text-white hover:border-zinc-500">
                        <span>{it.icon}</span><span>{it.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Design Panel ──────────────────────────────────────────────
function DesignPanel({ frames, onSwitchStudioMode }: { frames: CanvasFrame[]; onSwitchStudioMode?: (mode: string) => void }) {
  const selectedShapes = useSelectedShapes();
  const updateShape = useWorkspaceStore((s) => s.updateShape);

  // Access page objects to resolve parent frame for relative positioning
  const pageObjects = useWorkspaceStore((s) => {
    if (!s.file || !s.currentPageId) return EMPTY_PAGE_OBJECTS;
    return s.file.pagesIndex[s.currentPageId]?.objects || EMPTY_PAGE_OBJECTS;
  });

  // ── Pull live data from Backend tab for binding suggestions ──
  // Stable empty array avoids "getSnapshot should be cached" infinite loop
  const runtimeGlobalState = useRuntimeStore((s) => s.schema.globalState || EMPTY_BINDING_ARR);
  const runtimeGlobalActions = useRuntimeStore((s) => s.schema.globalActions || EMPTY_BINDING_ARR);
  const runtimeTables = useRuntimeStore((s) => (s.schema.database as any)?.tables || EMPTY_BINDING_ARR);

  const stateOptions = useMemo(() =>
    runtimeGlobalState.map((sv: any) => ({ value: `$${sv.name}`, type: sv.type })),
    [runtimeGlobalState]
  );
  const actionOptions = useMemo(() =>
    runtimeGlobalActions.map((a: any) => a.name),
    [runtimeGlobalActions]
  );
  const tableOptions = useMemo(() =>
    runtimeTables.map((t: any) => t.name),
    [runtimeTables]
  );
  const arrayStateOptions = useMemo(() =>
    stateOptions.filter((o: any) => o.type === "array"),
    [stateOptions]
  );

  // Render screens section + shape properties
  const shapeContent = (() => {
    if (selectedShapes.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
          <div className="rounded-xl bg-white/[0.03] p-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-600">
              <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-400">No selection</p>
            <p className="mt-0.5 text-[11px] text-zinc-600">Click a shape on the canvas to edit</p>
          </div>
        </div>
      );
    }

    if (selectedShapes.length > 1) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
          <div className="flex -space-x-1.5">
            {selectedShapes.slice(0, 3).map((s) => (
              <div key={s.id} className="h-6 w-6 rounded-md border-2 border-[#2c2c2c] bg-indigo-600/20" />
            ))}
          </div>
          <p className="text-xs font-medium text-zinc-400">{selectedShapes.length} shapes selected</p>
        </div>
      );
    }

    return null; // single selection — rendered below
  })();

  // Single shape selected — full property panel
  const singleShape = selectedShapes.length === 1 ? selectedShapes[0] : null;
  const parent = singleShape && singleShape.parentId && singleShape.parentId !== ROOT_FRAME_ID
    ? pageObjects[singleShape.parentId] : null;
  const localX = singleShape ? (parent ? singleShape.x - parent.x : singleShape.x) : 0;
  const localY = singleShape ? (parent ? singleShape.y - parent.y : singleShape.y) : 0;
  const handleLocalXChange = (localVal: number) => {
    if (!singleShape) return;
    const absX = parent ? parent.x + localVal : localVal;
    updateShape(singleShape.id, { x: absX });
  };
  const handleLocalYChange = (localVal: number) => {
    if (!singleShape) return;
    const absY = parent ? parent.y + localVal : localVal;
    updateShape(singleShape.id, { y: absY });
  };

  const shape = singleShape;
  const hasBindings = shape ? shape.runtimeBindings && Object.values(shape.runtimeBindings).some(Boolean) : false;
  const bindingCount = hasBindings && shape ? Object.values(shape.runtimeBindings!).filter(Boolean).length : 0;

  return (
    <div className="divide-y divide-white/[0.04]">
      {/* ── Screens & Components ── */}
      <CollapsibleSection
        title="Screens & Components"
        icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>}
        accentColor="text-indigo-400"
        defaultOpen={selectedShapes.length === 0}
      >
        <ScreensSection frames={frames} />
      </CollapsibleSection>

      {/* Selection-dependent content */}
      {shapeContent ? shapeContent : shape && (
        <>
      {/* ── Shape Header ── */}
      <div className="px-3.5 py-3">
        <div className="flex items-center gap-2">
          <ShapeIcon type={shape.type} />
          <input
            value={shape.name}
            onChange={(e) => updateShape(shape.id, { name: e.target.value })}
            className="flex-1 rounded-md bg-white/[0.04] px-2 py-1.5 text-[13px] font-medium text-[#f6f4f0] outline-none transition-colors focus:bg-white/[0.08] focus:ring-1 focus:ring-indigo-500/50"
          />
          <span className="shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-medium uppercase text-zinc-500">
            {shape.type}
          </span>
        </div>
      </div>

      {/* ── Layout ── */}
      <CollapsibleSection
        title="Layout"
        icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 3v18" /></svg>}
      >
        {shape.type === "frame" && (
          <div className="mb-2.5">
            <SizePresetsDropdown
              currentWidth={shape.width}
              currentHeight={shape.height}
              onApply={(w, h) => updateShape(shape.id, { width: w, height: h })}
            />
          </div>
        )}
        <div className="space-y-2">
          <div>
            <label className="mb-1 flex items-center gap-1 text-[10px] text-zinc-500">
              Position
              {parent && <span className="text-zinc-600">· relative to {parent.name || "parent"}</span>}
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <PropertyInput label="X" value={localX} onChange={handleLocalXChange} />
              <PropertyInput label="Y" value={localY} onChange={handleLocalYChange} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[10px] text-zinc-500">Size</label>
            <div className="grid grid-cols-2 gap-1.5">
              <PropertyInput label="W" value={shape.width} onChange={(v) => updateShape(shape.id, { width: v })} />
              <PropertyInput label="H" value={shape.height} onChange={(v) => updateShape(shape.id, { height: v })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="mb-1 block text-[10px] text-zinc-500">Rotation</label>
              <PropertyInput label="°" value={shape.rotation ?? 0} onChange={(v) => updateShape(shape.id, { rotation: v })} />
            </div>
            {(shape.type === "rect" || shape.type === "frame") && (
              <div>
                <label className="mb-1 block text-[10px] text-zinc-500">Radius</label>
                <PropertyInput label="R" value={shape.rx ?? 0} onChange={(v) => updateShape(shape.id, { rx: v, ry: v })} />
              </div>
            )}
          </div>
        </div>
      </CollapsibleSection>

      {/* ── Appearance ── */}
      <CollapsibleSection
        title="Appearance"
        icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 2a10 10 0 0 1 0 20" fill="currentColor" opacity="0.3" /></svg>}
        defaultOpen={false}
      >
        <div className="space-y-2.5">
          {/* Opacity */}
          <div>
            <label className="mb-1 block text-[10px] text-zinc-500">Opacity</label>
            <div className="flex items-center gap-2">
              <input
                type="range" min="0" max="1" step="0.01"
                value={shape.opacity ?? 1}
                onChange={(e) => updateShape(shape.id, { opacity: parseFloat(e.target.value) })}
                className="flex-1 accent-indigo-500"
              />
              <span className="min-w-[32px] text-right text-[11px] text-zinc-400">{Math.round((shape.opacity ?? 1) * 100)}%</span>
            </div>
          </div>

      {/* Typography (for text shapes) */}
      {shape.type === "text" && (() => {
        // Extract current text properties from the first run
        const firstPara = shape.content?.children?.[0];
        const firstRun = firstPara?.children?.[0];
        const currentFontFamily = firstRun?.fontFamily || "Inter";
        const currentFontSize = firstRun?.fontSize || 16;
        const currentFontWeight = firstRun?.fontWeight || 400;
        const currentFontStyle = firstRun?.fontStyle || "normal";
        const currentLetterSpacing = firstRun?.letterSpacing || 0;
        const currentLineHeight = firstRun?.lineHeight || 0;
        const currentTextDecoration = firstRun?.textDecoration || "none";
        const currentTextAlign = firstPara?.textAlign || "left";
        const currentGrowType = shape.growType || "auto-height";

        // Helper: update all runs in the content
        const updateAllRuns = (runUpdates: Record<string, any>) => {
          if (!shape.content) {
            updateShape(shape.id, {
              content: {
                type: "root" as const,
                children: [{
                  type: "paragraph" as const,
                  children: [{ text: "Text", fontFamily: "Inter", fontSize: 16, fontWeight: 400, fontStyle: "normal" as const, ...runUpdates }],
                }],
              },
            });
            return;
          }
          const newContent = {
            ...shape.content,
            children: shape.content.children.map(para => ({
              ...para,
              children: para.children.map(run => ({ ...run, ...runUpdates })),
            })),
          };
          updateShape(shape.id, { content: newContent });
        };

        // Helper: update all paragraphs
        const updateAllParagraphs = (paraUpdates: Record<string, any>) => {
          if (!shape.content) return;
          const newContent = {
            ...shape.content,
            children: shape.content.children.map(para => ({
              ...para,
              ...paraUpdates,
            })),
          };
          updateShape(shape.id, { content: newContent });
        };

        // Get plain text from content
        const plainText = shape.content?.children?.map(
          p => p.children.map(r => r.text).join("")
        ).join("\n") || "";

        return (
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-[#666360]">Typography</label>
            <div className="space-y-2">
              {/* Font Family */}
              <select
                value={currentFontFamily}
                onChange={(e) => updateAllRuns({ fontFamily: e.target.value })}
                className="w-full rounded bg-[#0f0f0f] px-2 py-1 text-xs text-[#f6f4f0] outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {["Inter", "Roboto", "Arial", "Helvetica", "Georgia", "Times New Roman", "Courier New", "Verdana", "system-ui", "sans-serif", "serif", "monospace"].map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>

              {/* Weight + Style */}
              <div className="flex gap-1.5">
                <select
                  value={currentFontWeight}
                  onChange={(e) => updateAllRuns({ fontWeight: Number(e.target.value) })}
                  className="flex-1 rounded bg-[#0f0f0f] px-2 py-1 text-xs text-[#f6f4f0] outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {[{v:100,l:"Thin"},{v:200,l:"ExtraLight"},{v:300,l:"Light"},{v:400,l:"Regular"},{v:500,l:"Medium"},{v:600,l:"SemiBold"},{v:700,l:"Bold"},{v:800,l:"ExtraBold"},{v:900,l:"Black"}].map(w => (
                    <option key={w.v} value={w.v}>{w.l}</option>
                  ))}
                </select>
                <button
                  onClick={() => updateAllRuns({ fontStyle: currentFontStyle === "italic" ? "normal" : "italic" })}
                  className={`rounded px-2 py-1 text-xs transition-colors ${currentFontStyle === "italic" ? "bg-indigo-600 text-[#f6f4f0]" : "bg-[#0f0f0f] text-[#a8a6a2] hover:text-[#f6f4f0]"}`}
                  title="Italic"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="19" y1="4" x2="10" y2="4" /><line x1="14" y1="20" x2="5" y2="20" /><line x1="15" y1="4" x2="9" y2="20" />
                  </svg>
                </button>
              </div>

              {/* Size + Line Height */}
              <div className="grid grid-cols-2 gap-1.5">
                <PropertyInput label="Size" value={currentFontSize} onChange={(v) => updateAllRuns({ fontSize: Math.max(1, v) })} />
                <PropertyInput label="LH" value={currentLineHeight} onChange={(v) => updateAllRuns({ lineHeight: Math.max(0, v) })} />
              </div>

              {/* Letter Spacing */}
              <PropertyInput label="Spacing" value={currentLetterSpacing} onChange={(v) => updateAllRuns({ letterSpacing: v })} />

              {/* Text Alignment */}
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-[#666360]">Alignment</label>
                <div className="flex gap-0.5">
                  {(["left", "center", "right", "justify"] as const).map(align => (
                    <button
                      key={align}
                      onClick={() => updateAllParagraphs({ textAlign: align })}
                      className={`flex-1 rounded px-1 py-1 transition-colors ${currentTextAlign === align ? "bg-indigo-600 text-[#f6f4f0]" : "bg-[#0f0f0f] text-[#a8a6a2] hover:text-[#f6f4f0]"}`}
                      title={align}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mx-auto">
                        {align === "left" && <><line x1="3" y1="6" x2="16" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="14" y2="18" /></>}
                        {align === "center" && <><line x1="6" y1="6" x2="18" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="7" y1="18" x2="17" y2="18" /></>}
                        {align === "right" && <><line x1="8" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="10" y1="18" x2="21" y2="18" /></>}
                        {align === "justify" && <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>}
                      </svg>
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Decoration */}
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-[#666360]">Decoration</label>
                <div className="flex gap-0.5">
                  {(["none", "underline", "line-through"] as const).map(deco => (
                    <button
                      key={deco}
                      onClick={() => updateAllRuns({ textDecoration: deco })}
                      className={`flex-1 rounded px-1 py-1 text-[10px] transition-colors ${currentTextDecoration === deco ? "bg-indigo-600 text-[#f6f4f0]" : "bg-[#0f0f0f] text-[#a8a6a2] hover:text-[#f6f4f0]"}`}
                      title={deco}
                    >
                      {deco === "none" ? "—" : deco === "underline" ? "U̲" : "S̶"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grow Type (Resize Mode) */}
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-[#666360]">Resize</label>
                <div className="flex gap-0.5">
                  {([
                    { val: "auto-width" as const, label: "Auto W" },
                    { val: "auto-height" as const, label: "Auto H" },
                    { val: "fixed" as const, label: "Fixed" },
                  ]).map(g => (
                    <button
                      key={g.val}
                      onClick={() => updateShape(shape.id, { growType: g.val })}
                      className={`flex-1 rounded px-1 py-1 text-[10px] transition-colors ${currentGrowType === g.val ? "bg-indigo-600 text-[#f6f4f0]" : "bg-[#0f0f0f] text-[#a8a6a2] hover:text-[#f6f4f0]"}`}
                      title={g.label}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Content Editor */}
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-wider text-[#666360]">Content</label>
                <textarea
                  value={plainText}
                  onChange={(e) => {
                    const newText = e.target.value;
                    const paragraphs = newText.split("\n");
                    const newContent = {
                      type: "root" as const,
                      children: paragraphs.map(paraText => ({
                        type: "paragraph" as const,
                        textAlign: currentTextAlign as "left" | "center" | "right" | "justify",
                        children: [{
                          text: paraText,
                          fontFamily: currentFontFamily,
                          fontSize: currentFontSize,
                          fontWeight: currentFontWeight,
                          fontStyle: currentFontStyle as "normal" | "italic",
                          letterSpacing: currentLetterSpacing,
                          lineHeight: currentLineHeight,
                          textDecoration: currentTextDecoration as "none" | "underline" | "line-through",
                        }],
                      })),
                    };
                    updateShape(shape.id, { content: newContent });
                  }}
                  className="w-full rounded bg-[#0f0f0f] px-2 py-1 text-xs text-[#f6f4f0] outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                  rows={3}
                  placeholder="Enter text..."
                />
              </div>
            </div>
          </div>
        );
      })()}

          {/* Fill */}
          <div>
            <label className="mb-1 block text-[10px] text-zinc-500">Fill</label>
            {shape.fills && shape.fills.length > 0 ? (
              shape.fills.map((fill, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={fill.fillColor || "#000000"}
                    onChange={(e) => {
                      const fills = [...(shape.fills || [])];
                      fills[i] = { ...fills[i], fillColor: e.target.value };
                      updateShape(shape.id, { fills });
                    }}
                    className="h-7 w-7 cursor-pointer rounded-md border border-white/[0.08] bg-transparent"
                  />
                  <span className="text-[11px] font-mono text-zinc-400">{fill.fillColor || "none"}</span>
                </div>
              ))
            ) : (
              <button
                onClick={() => updateShape(shape.id, { fills: [{ fillColor: "#B1B2B5", fillOpacity: 1 }] })}
                className="text-[11px] text-zinc-600 hover:text-indigo-400 transition-colors"
              >
                + Add fill
              </button>
            )}
          </div>

          {/* Stroke */}
          <div>
            <label className="mb-1 block text-[10px] text-zinc-500">Stroke</label>
            {shape.strokes && shape.strokes.length > 0 ? (
              shape.strokes.map((stroke, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={stroke.strokeColor || "#000000"}
                    onChange={(e) => {
                      const strokes = [...(shape.strokes || [])];
                      strokes[i] = { ...strokes[i], strokeColor: e.target.value };
                      updateShape(shape.id, { strokes });
                    }}
                    className="h-7 w-7 cursor-pointer rounded-md border border-white/[0.08] bg-transparent"
                  />
                  <span className="text-[11px] font-mono text-zinc-400">{stroke.strokeColor}</span>
                </div>
              ))
            ) : (
              <button
                onClick={() => updateShape(shape.id, { strokes: [{ strokeColor: "#000000", strokeWidth: 1, strokeAlignment: "center" }] })}
                className="text-[11px] text-zinc-600 hover:text-indigo-400 transition-colors"
              >
                + Add stroke
              </button>
            )}
          </div>
        </div>
      </CollapsibleSection>

      {/* ── Runtime Bindings ── */}
      <CollapsibleSection
        title="Bindings"
        icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>}
        accentColor="text-emerald-500"
        badge={bindingCount > 0 ? `${bindingCount}` : undefined}
        defaultOpen={!!hasBindings}
      >
        <div className="space-y-2.5">
          {/* Datalists for autocomplete */}
          <datalist id="dl-state-vars">
            {stateOptions.map((o: any) => <option key={o.value} value={o.value}>{o.value} ({o.type})</option>)}
          </datalist>
          <datalist id="dl-actions">
            {actionOptions.map((n: string) => <option key={n} value={n} />)}
          </datalist>
          <datalist id="dl-tables">
            {tableOptions.map((n: string) => <option key={n} value={n} />)}
          </datalist>
          <datalist id="dl-array-state">
            {arrayStateOptions.map((o: any) => <option key={o.value} value={o.value}>{o.value} ({o.type})</option>)}
          </datalist>

          {/* Text Binding */}
          {(shape.type === "text" || shape.type === "rect" || shape.type === "frame") && (
            <div>
              <label className="mb-0.5 block text-[10px] font-medium text-zinc-500">Text / Content</label>
              <input
                list="dl-state-vars"
                value={shape.runtimeBindings?.textBind || ""}
                onChange={(e) => updateShape(shape.id, {
                  runtimeBindings: { ...shape.runtimeBindings, textBind: e.target.value }
                })}
                placeholder={stateOptions.length > 0 ? `e.g. ${stateOptions[0].value}` : "$state.variable"}
                className="w-full rounded-md bg-white/[0.04] px-2.5 py-1.5 text-xs text-[#f6f4f0] outline-none ring-1 ring-white/[0.08] transition-all focus:bg-white/[0.06] focus:ring-emerald-500/50"
              />
            </div>
          )}

          {/* Input Binding */}
          <div>
            <label className="mb-0.5 block text-[10px] font-medium text-zinc-500">Input Bind <span className="text-zinc-600">(2-way)</span></label>
            <input
              list="dl-state-vars"
              value={shape.runtimeBindings?.inputBind || ""}
              onChange={(e) => updateShape(shape.id, {
                runtimeBindings: { ...shape.runtimeBindings, inputBind: e.target.value }
              })}
              placeholder={stateOptions.length > 0 ? `e.g. ${stateOptions[0].value}` : "$form.fieldName"}
              className="w-full rounded-md bg-white/[0.04] px-2.5 py-1.5 text-xs text-[#f6f4f0] outline-none ring-1 ring-white/[0.08] transition-all focus:bg-white/[0.06] focus:ring-emerald-500/50"
            />
          </div>

          {/* onClick Action */}
          <div>
            <label className="mb-0.5 block text-[10px] font-medium text-zinc-500">On Click <span className="text-zinc-600">(action)</span></label>
            <input
              list="dl-actions"
              value={shape.runtimeBindings?.onClick || ""}
              onChange={(e) => updateShape(shape.id, {
                runtimeBindings: { ...shape.runtimeBindings, onClick: e.target.value }
              })}
              placeholder={actionOptions.length > 0 ? `e.g. ${actionOptions[0]}` : "actionName"}
              className="w-full rounded-md bg-white/[0.04] px-2.5 py-1.5 text-xs text-[#f6f4f0] outline-none ring-1 ring-white/[0.08] transition-all focus:bg-white/[0.06] focus:ring-emerald-500/50"
            />
          </div>

          {/* Visible Bind */}
          <div>
            <label className="mb-0.5 block text-[10px] font-medium text-zinc-500">Visible When</label>
            <input
              list="dl-state-vars"
              value={shape.runtimeBindings?.visibleBind || ""}
              onChange={(e) => updateShape(shape.id, {
                runtimeBindings: { ...shape.runtimeBindings, visibleBind: e.target.value }
              })}
              placeholder={stateOptions.find((o: any) => o.type === "boolean")?.value || "$isLoggedIn"}
              className="w-full rounded-md bg-white/[0.04] px-2.5 py-1.5 text-xs text-[#f6f4f0] outline-none ring-1 ring-white/[0.08] transition-all focus:bg-white/[0.06] focus:ring-emerald-500/50"
            />
          </div>

          {/* Data Source + Repeat + On Mount (for frames/groups) */}
          {(shape.type === "frame" || shape.type === "group") && (
            <div className="mt-1 border-t border-white/[0.04] pt-2.5">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Data & Lifecycle</p>
              <div className="space-y-2">
                <div>
                  <label className="mb-0.5 block text-[10px] font-medium text-zinc-500">Data Source <span className="text-zinc-600">(table)</span></label>
                  <input
                    list="dl-tables"
                    value={shape.runtimeBindings?.dataSource || ""}
                    onChange={(e) => updateShape(shape.id, {
                      runtimeBindings: { ...shape.runtimeBindings, dataSource: e.target.value }
                    })}
                    placeholder={tableOptions.length > 0 ? `e.g. ${tableOptions[0]}` : "todos"}
                    className="w-full rounded-md bg-white/[0.04] px-2.5 py-1.5 text-xs text-[#f6f4f0] outline-none ring-1 ring-white/[0.08] transition-all focus:bg-white/[0.06] focus:ring-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] font-medium text-zinc-500">Repeat For / As</label>
                  <div className="flex gap-1.5">
                    <input
                      list="dl-array-state"
                      value={shape.runtimeBindings?.repeatFor || ""}
                      onChange={(e) => updateShape(shape.id, {
                        runtimeBindings: { ...shape.runtimeBindings, repeatFor: e.target.value }
                      })}
                      placeholder={arrayStateOptions.length > 0 ? `e.g. ${arrayStateOptions[0].value}` : "$todos"}
                      className="flex-1 rounded-md bg-white/[0.04] px-2.5 py-1.5 text-xs text-[#f6f4f0] outline-none ring-1 ring-white/[0.08] transition-all focus:bg-white/[0.06] focus:ring-emerald-500/50"
                    />
                    <input
                      value={shape.runtimeBindings?.repeatAs || ""}
                      onChange={(e) => updateShape(shape.id, {
                        runtimeBindings: { ...shape.runtimeBindings, repeatAs: e.target.value }
                      })}
                      placeholder="item"
                      className="w-16 rounded-md bg-white/[0.04] px-2 py-1.5 text-xs text-[#f6f4f0] outline-none ring-1 ring-white/[0.08] transition-all focus:bg-white/[0.06] focus:ring-emerald-500/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] font-medium text-zinc-500">On Mount <span className="text-zinc-600">(action)</span></label>
                  <input
                    list="dl-actions"
                    value={shape.runtimeBindings?.onMount || ""}
                    onChange={(e) => updateShape(shape.id, {
                      runtimeBindings: { ...shape.runtimeBindings, onMount: e.target.value }
                    })}
                    placeholder={actionOptions.length > 0 ? `e.g. ${actionOptions[0]}` : "loadMessages"}
                    className="w-full rounded-md bg-white/[0.04] px-2.5 py-1.5 text-xs text-[#f6f4f0] outline-none ring-1 ring-white/[0.08] transition-all focus:bg-white/[0.06] focus:ring-emerald-500/50"
                  />
                  <p className="mt-0.5 text-[9px] text-zinc-600">Runs when this screen mounts</p>
                </div>
              </div>
            </div>
          )}

          {hasBindings && (
            <button
              onClick={() => updateShape(shape.id, { runtimeBindings: undefined })}
              className="mt-1 flex w-full items-center justify-center gap-1 rounded-md bg-red-500/10 px-2 py-1.5 text-[10px] font-medium text-red-400 transition-colors hover:bg-red-500/20"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
              Clear all bindings
            </button>
          )}
          {onSwitchStudioMode && (
            <button
              onClick={() => onSwitchStudioMode("state")}
              className="mt-2 flex w-full items-center justify-between rounded-md bg-violet-500/10 px-2.5 py-1.5 text-[10px] font-medium text-violet-400 transition-colors hover:bg-violet-500/15"
            >
              <span>Manage all state in State Manager</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          )}
        </div>
      </CollapsibleSection>
        </>
      )}
    </div>
  );
}

// ── Inspect Panel ─────────────────────────────────────────────
function InspectPanel() {
  const selectedShapes = useSelectedShapes();
  const pageObjects = useWorkspaceStore((s) => {
    if (!s.file || !s.currentPageId) return EMPTY_PAGE_OBJECTS;
    return s.file.pagesIndex[s.currentPageId]?.objects || EMPTY_PAGE_OBJECTS;
  });

  if (selectedShapes.length === 0) {
    return (
      <div className="p-3 text-xs text-[#666360]">
        Select a shape to inspect its properties.
      </div>
    );
  }

  const shape = selectedShapes[0];

  // Relative position (local coordinates)
  const parent =
    shape.parentId && shape.parentId !== ROOT_FRAME_ID
      ? pageObjects[shape.parentId]
      : null;
  const localX = parent ? shape.x - parent.x : shape.x;
  const localY = parent ? shape.y - parent.y : shape.y;

  return (
    <div className="space-y-2 p-3">
      <div className="rounded bg-[#0f0f0f] p-2 font-mono text-[11px] text-[#d7d6d2]">
        <div className="text-[#666360]">/* {shape.type} — {shape.name} */</div>
        {parent && <div className="text-zinc-600">/* relative to {parent.name || "parent"} */</div>}
        <div>position: ({Math.round(localX)}, {Math.round(localY)});</div>
        <div>size: {Math.round(shape.width)} x {Math.round(shape.height)};</div>
        {shape.rotation ? <div>rotation: {Math.round(shape.rotation)}deg;</div> : null}
        {shape.fills?.map((f, i) => (
          <div key={i}>fill: {f.fillColor || "none"} @ {Math.round((f.fillOpacity ?? 1) * 100)}%;</div>
        ))}
        {shape.strokes?.map((s, i) => (
          <div key={i}>stroke: {s.strokeColor} {s.strokeWidth}px {s.strokeAlignment};</div>
        ))}
        {(shape.rx || shape.ry) ? <div>border-radius: {shape.rx}px;</div> : null}
        <div>opacity: {Math.round((shape.opacity ?? 1) * 100)}%;</div>
      </div>
    </div>
  );
}

// ── Prototype Panel ───────────────────────────────────────────
function PrototypePanel({ onSwitchStudioMode }: { onSwitchStudioMode?: (mode: string) => void } = {}) {
  const selectedShapes = useSelectedShapes();
  const file = useWorkspaceStore((s) => s.file);
  const currentPageId = useWorkspaceStore((s) => s.currentPageId);
  const addInteraction = useWorkspaceStore((s) => s.addInteraction);
  const removeInteraction = useWorkspaceStore((s) => s.removeInteraction);
  const setFlow = useWorkspaceStore((s) => s.setFlow);

  const pageObjects = useWorkspaceStore((s) => {
    if (!s.file || !s.currentPageId) return EMPTY_PAGE_OBJECTS;
    return s.file.pagesIndex[s.currentPageId]?.objects || EMPTY_PAGE_OBJECTS;
  });

  const currentFlows = useMemo(() => {
    if (!file || !currentPageId) return [];
    return file.pagesIndex[currentPageId]?.flows || [];
  }, [file, currentPageId]);

  // All frames in current page (for destination picker)
  const frames = useMemo(() => {
    return Object.values(pageObjects).filter(
      (s) => s.type === "frame" && s.id !== ROOT_FRAME_ID
    );
  }, [pageObjects]);

  // All shapes in current page (for scroll-to target picker)
  const allShapes = useMemo(() => {
    return Object.values(pageObjects).filter(
      (s) => s.id !== ROOT_FRAME_ID
    );
  }, [pageObjects]);

  if (selectedShapes.length === 0) {
    return (
      <div className="space-y-3 p-3">
        {onSwitchStudioMode && (
          <div className="flex items-center justify-between rounded-lg bg-indigo-500/10 px-3 py-2">
            <span className="text-[10px] text-indigo-400">For full flow management</span>
            <button
              onClick={() => onSwitchStudioMode("navigation")}
              className="text-[10px] font-medium text-indigo-300 hover:text-indigo-200"
            >
              Navigation Editor →
            </button>
          </div>
        )}
        <p className="text-xs text-[#666360]">Select a shape to add interactions.</p>

        {/* Flow starting points */}
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-[#666360]">Flows</label>
          {currentFlows.length === 0 ? (
            <p className="text-xs text-zinc-600">No flows defined</p>
          ) : (
            currentFlows.map((flow) => (
              <div key={flow.id} className="flex items-center justify-between rounded bg-[#0f0f0f] px-2 py-1">
                <span className="text-xs text-[#d7d6d2]">{flow.name}</span>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  const shape = selectedShapes[0];
  const interactions = shape.interactions || [];

  return (
    <div className="space-y-3 p-3">
      {onSwitchStudioMode && (
        <div className="flex items-center justify-between rounded-lg bg-indigo-500/10 px-3 py-2">
          <span className="text-[10px] text-indigo-400">For full flow management</span>
          <button
            onClick={() => onSwitchStudioMode("navigation")}
            className="text-[10px] font-medium text-indigo-300 hover:text-indigo-200"
          >
            Navigation Editor →
          </button>
        </div>
      )}
      <div className="text-xs font-medium text-[#d7d6d2]">{shape.name}</div>

      {/* Existing interactions */}
      {interactions.map((inter) => (
        <div key={inter.id} className="rounded bg-[#0f0f0f] p-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#d7d6d2]">
              {EVENT_LABELS[inter.eventType] || inter.eventType} → {ACTION_LABELS[inter.actionType] || inter.actionType}
            </span>
            <button
              onClick={() => removeInteraction(shape.id, inter.id)}
              className="text-xs text-red-400 hover:text-red-300"
            >
              ×
            </button>
          </div>
          {inter.destination && (
            <span className="text-[10px] text-[#666360]">
              → {pageObjects[inter.destination]?.name || inter.destination}
            </span>
          )}
          {inter.animation && inter.animation.animationType !== "instant" && (
            <div className="mt-0.5 text-[10px] text-zinc-600">
              {inter.animation.animationType} · {inter.animation.duration}ms · {inter.animation.easing}
              {inter.animation.direction ? ` · ${inter.animation.direction}` : ""}
            </div>
          )}
          {inter.eventType === "after-delay" && (
            <div className="mt-0.5 text-[10px] text-zinc-600">delay: {inter.delay || 1000}ms</div>
          )}
          {inter.eventType === "key-down" && inter.key && (
            <div className="mt-0.5 text-[10px] text-zinc-600">key: {inter.key}</div>
          )}
          {inter.url && (
            <div className="mt-0.5 truncate text-[10px] text-zinc-600">{inter.url}</div>
          )}
        </div>
      ))}

      {/* Add interaction */}
      <AddInteractionForm
        shapeId={shape.id}
        frames={frames}
        allShapes={allShapes}
        onAdd={addInteraction}
      />

      {/* Scroll config (frames only) */}
      {shape.type === "frame" && (
        <ScrollConfigSection shape={shape} />
      )}

      {/* Set as flow start */}
      {shape.type === "frame" && (
        <button
          onClick={() =>
            setFlow({
              id: crypto.randomUUID(),
              name: shape.name + " Flow",
              startingFrame: shape.id,
            })
          }
          className="w-full rounded border border-dashed border-white/[0.08] py-1.5 text-xs text-[#666360] hover:border-indigo-500 hover:text-indigo-400"
        >
          Set as Flow Starting Point
        </button>
      )}
    </div>
  );
}

// ── Studio Links Panel (Backend tab when inside Studio) ───────
function StudioLinksPanel({ onSwitch }: { onSwitch: (mode: string) => void }) {
  const studioLinks = [
    { id: "screens", label: "Screen Manager", desc: "Manage screens, routes, components", icon: "🖥" },
    { id: "state", label: "State Manager", desc: "Global state, local state, variables", icon: "⚡" },
    { id: "workflows", label: "Workflows & Actions", desc: "Actions, events, logic flows", icon: "⚙" },
    { id: "navigation", label: "Navigation Editor", desc: "Routes, transitions, flows", icon: "🔀" },
    { id: "database", label: "Database & Schema", desc: "Tables, fields, relationships", icon: "🗄" },
    { id: "auth", label: "Auth & RBAC", desc: "Auth providers, roles, policies", icon: "🔐" },
    { id: "theme", label: "Theme Designer", desc: "Design tokens, colors, typography", icon: "🎨" },
    { id: "components", label: "Component Library", desc: "Reusable UI components", icon: "📦" },
  ];

  return (
    <div className="p-3 space-y-1.5">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-3">Studio Editors</p>
      {studioLinks.map((link) => (
        <button
          key={link.id}
          onClick={() => onSwitch(link.id)}
          className="flex w-full items-start gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-left transition-all hover:border-white/[0.12] hover:bg-white/[0.04]"
        >
          <span className="text-base leading-none mt-0.5">{link.icon}</span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-[#f6f4f0]">{link.label}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{link.desc}</p>
          </div>
          <svg className="ml-auto mt-1 shrink-0 text-zinc-600" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      ))}
    </div>
  );
}

// ── Label maps ────────────────────────────────────────────────
const EVENT_LABELS: Record<string, string> = {
  click: "On Click",
  "mouse-press": "Mouse Press",
  "mouse-over": "Mouse Over",
  "mouse-enter": "On Hover",
  "mouse-leave": "Mouse Leave",
  "mouse-down": "Mouse Down",
  "mouse-up": "Mouse Up",
  "after-delay": "After Delay",
  "key-down": "Key Down",
};

const ACTION_LABELS: Record<string, string> = {
  navigate: "Navigate To",
  "open-overlay": "Open Overlay",
  "swap-overlay": "Swap Overlay",
  "toggle-overlay": "Toggle Overlay",
  "close-overlay": "Close Overlay",
  "prev-screen": "Back",
  "open-url": "Open URL",
  "scroll-to": "Scroll To",
  "swap-variant": "Swap Variant",
};

// Actions that need a destination frame picker
const NEEDS_DESTINATION = new Set(["navigate", "open-overlay", "swap-overlay", "toggle-overlay"]);
// Actions that need overlay options
const IS_OVERLAY_ACTION = new Set(["open-overlay", "swap-overlay", "toggle-overlay"]);
// Animation types that support direction
const NEEDS_DIRECTION = new Set(["slide", "push", "move-in", "move-out"]);

// ── Add Interaction Form ──────────────────────────────────────
function AddInteractionForm({
  shapeId,
  frames,
  allShapes,
  onAdd,
}: {
  shapeId: UUID;
  frames: PenpotShape[];
  allShapes: PenpotShape[];
  onAdd: (shapeId: UUID, interaction: any) => void;
}) {
  const [eventType, setEventType] = useState<string>("click");
  const [actionType, setActionType] = useState<string>("navigate");
  const [destination, setDestination] = useState("");
  const [url, setUrl] = useState("");
  const [delay, setDelay] = useState(1000);
  const [key, setKey] = useState("");
  const [scrollTargetId, setScrollTargetId] = useState("");

  // Animation
  const [animationType, setAnimationType] = useState<string>("dissolve");
  const [animDuration, setAnimDuration] = useState(300);
  const [animEasing, setAnimEasing] = useState<string>("ease-in-out");
  const [animDirection, setAnimDirection] = useState<string>("right");

  // Overlay options
  const [overlayPosType, setOverlayPosType] = useState<string>("center");
  const [closeClickOutside, setCloseClickOutside] = useState(true);
  const [backgroundOverlay, setBackgroundOverlay] = useState(true);

  const [expanded, setExpanded] = useState(false);

  const handleAdd = () => {
    const interaction: any = {
      id: crypto.randomUUID(),
      eventType,
      actionType,
    };

    // Destination
    if (NEEDS_DESTINATION.has(actionType) && destination) {
      interaction.destination = destination;
    } else if (NEEDS_DESTINATION.has(actionType) && !destination) {
      return; // destination required
    }

    // URL
    if (actionType === "open-url") {
      if (!url) return;
      interaction.url = url;
    }

    // Scroll-to
    if (actionType === "scroll-to" && scrollTargetId) {
      interaction.scrollTargetId = scrollTargetId;
    }

    // Delay
    if (eventType === "after-delay") {
      interaction.delay = delay;
    }

    // Key
    if (eventType === "key-down" && key) {
      interaction.key = key;
    }

    // Animation
    if (animationType !== "instant") {
      interaction.animation = {
        animationType,
        duration: animDuration,
        easing: animEasing,
        ...(NEEDS_DIRECTION.has(animationType) ? { direction: animDirection } : {}),
      };
    }

    // Overlay options
    if (IS_OVERLAY_ACTION.has(actionType)) {
      interaction.overlayPosType = overlayPosType;
      interaction.closeClickOutside = closeClickOutside;
      interaction.backgroundOverlay = backgroundOverlay;
    }

    onAdd(shapeId, interaction);
    // Reset destination/url
    setDestination("");
    setUrl("");
    setScrollTargetId("");
    setKey("");
  };

  return (
    <div className="space-y-1.5 rounded border border-white/[0.08] p-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between text-[10px] uppercase tracking-wider text-[#666360]"
      >
        <span>Add Interaction</span>
        <span>{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded && (
        <div className="space-y-1.5">
          {/* Trigger */}
          <label className="text-[9px] uppercase tracking-widest text-zinc-600">Trigger</label>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="w-full rounded bg-[#0f0f0f] px-2 py-1 text-xs text-[#f6f4f0]"
          >
            <option value="click">On Click</option>
            <option value="mouse-enter">On Hover</option>
            <option value="mouse-leave">Mouse Leave</option>
            <option value="mouse-down">Mouse Down</option>
            <option value="mouse-up">Mouse Up</option>
            <option value="mouse-press">Mouse Press</option>
            <option value="after-delay">After Delay</option>
            <option value="key-down">Key Down</option>
          </select>

          {/* Delay input */}
          {eventType === "after-delay" && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[#666360]">Delay</span>
              <input
                type="number"
                min={0}
                value={delay}
                onChange={(e) => setDelay(parseInt(e.target.value) || 0)}
                className="w-20 rounded bg-[#0f0f0f] px-2 py-0.5 text-xs text-[#f6f4f0] outline-none"
              />
              <span className="text-[10px] text-[#666360]">ms</span>
            </div>
          )}

          {/* Key input */}
          {eventType === "key-down" && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[#666360]">Key</span>
              <input
                placeholder="Press a key..."
                value={key}
                onKeyDown={(e) => {
                  e.preventDefault();
                  setKey(e.key);
                }}
                readOnly
                className="w-full rounded bg-[#0f0f0f] px-2 py-0.5 text-xs text-[#f6f4f0] outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          )}

          {/* Action */}
          <label className="text-[9px] uppercase tracking-widest text-zinc-600">Action</label>
          <select
            value={actionType}
            onChange={(e) => setActionType(e.target.value)}
            className="w-full rounded bg-[#0f0f0f] px-2 py-1 text-xs text-[#f6f4f0]"
          >
            <option value="navigate">Navigate To</option>
            <option value="open-overlay">Open Overlay</option>
            <option value="swap-overlay">Swap Overlay</option>
            <option value="toggle-overlay">Toggle Overlay</option>
            <option value="close-overlay">Close Overlay</option>
            <option value="prev-screen">Back (Previous Screen)</option>
            <option value="open-url">Open URL</option>
            <option value="scroll-to">Scroll To</option>
          </select>

          {/* Destination picker */}
          {NEEDS_DESTINATION.has(actionType) && (
            <>
              <label className="text-[9px] uppercase tracking-widest text-zinc-600">Destination</label>
              <select
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full rounded bg-[#0f0f0f] px-2 py-1 text-xs text-[#f6f4f0]"
              >
                <option value="">Select frame...</option>
                {frames.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </>
          )}

          {/* URL input */}
          {actionType === "open-url" && (
            <input
              type="url"
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full rounded bg-[#0f0f0f] px-2 py-1 text-xs text-[#f6f4f0] outline-none"
            />
          )}

          {/* Scroll target picker */}
          {actionType === "scroll-to" && (
            <>
              <label className="text-[9px] uppercase tracking-widest text-zinc-600">Scroll Target</label>
              <select
                value={scrollTargetId}
                onChange={(e) => setScrollTargetId(e.target.value)}
                className="w-full rounded bg-[#0f0f0f] px-2 py-1 text-xs text-[#f6f4f0]"
              >
                <option value="">Select element...</option>
                {allShapes.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.type})</option>
                ))}
              </select>
            </>
          )}

          {/* Overlay options */}
          {IS_OVERLAY_ACTION.has(actionType) && (
            <div className="space-y-1 rounded bg-[#2c2c2c] p-1.5">
              <label className="text-[9px] uppercase tracking-widest text-zinc-600">Overlay Options</label>
              <select
                value={overlayPosType}
                onChange={(e) => setOverlayPosType(e.target.value)}
                className="w-full rounded bg-[#0f0f0f] px-2 py-0.5 text-xs text-[#f6f4f0]"
              >
                <option value="center">Center</option>
                <option value="top-left">Top Left</option>
                <option value="top-center">Top Center</option>
                <option value="top-right">Top Right</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="bottom-center">Bottom Center</option>
                <option value="bottom-right">Bottom Right</option>
                <option value="manual">Manual</option>
              </select>
              <label className="flex items-center gap-1.5 text-xs text-[#a8a6a2]">
                <input
                  type="checkbox"
                  checked={closeClickOutside}
                  onChange={(e) => setCloseClickOutside(e.target.checked)}
                  className="rounded"
                />
                Close on outside click
              </label>
              <label className="flex items-center gap-1.5 text-xs text-[#a8a6a2]">
                <input
                  type="checkbox"
                  checked={backgroundOverlay}
                  onChange={(e) => setBackgroundOverlay(e.target.checked)}
                  className="rounded"
                />
                Background overlay
              </label>
            </div>
          )}

          {/* Animation */}
          <label className="text-[9px] uppercase tracking-widest text-zinc-600">Animation</label>
          <select
            value={animationType}
            onChange={(e) => setAnimationType(e.target.value)}
            className="w-full rounded bg-[#0f0f0f] px-2 py-0.5 text-xs text-[#f6f4f0]"
          >
            <option value="instant">Instant</option>
            <option value="dissolve">Dissolve</option>
            <option value="slide">Slide</option>
            <option value="push">Push</option>
            <option value="move-in">Move In</option>
            <option value="move-out">Move Out</option>
            <option value="smart-animate">Smart Animate</option>
          </select>

          {animationType !== "instant" && (
            <div className="flex gap-1">
              <div className="flex-1">
                <input
                  type="number"
                  min={0}
                  max={10000}
                  value={animDuration}
                  onChange={(e) => setAnimDuration(parseInt(e.target.value) || 0)}
                  className="w-full rounded bg-[#0f0f0f] px-2 py-0.5 text-xs text-[#f6f4f0] outline-none"
                  title="Duration (ms)"
                />
              </div>
              <select
                value={animEasing}
                onChange={(e) => setAnimEasing(e.target.value)}
                className="flex-1 rounded bg-[#0f0f0f] px-1 py-0.5 text-xs text-[#f6f4f0]"
              >
                <option value="linear">Linear</option>
                <option value="ease">Ease</option>
                <option value="ease-in">Ease In</option>
                <option value="ease-out">Ease Out</option>
                <option value="ease-in-out">Ease In-Out</option>
                <option value="spring">Spring</option>
              </select>
            </div>
          )}

          {animationType !== "instant" && NEEDS_DIRECTION.has(animationType) && (
            <select
              value={animDirection}
              onChange={(e) => setAnimDirection(e.target.value)}
              className="w-full rounded bg-[#0f0f0f] px-2 py-0.5 text-xs text-[#f6f4f0]"
            >
              <option value="right">→ Right</option>
              <option value="left">← Left</option>
              <option value="up">↑ Up</option>
              <option value="down">↓ Down</option>
            </select>
          )}

          <button
            onClick={handleAdd}
            className="w-full rounded bg-indigo-600 py-1 text-xs font-medium text-[#f6f4f0] hover:bg-indigo-500"
          >
            Add Interaction
          </button>
        </div>
      )}
    </div>
  );
}

// ── Scroll Config Section (for frames) ────────────────────────
function ScrollConfigSection({ shape }: { shape: PenpotShape }) {
  const updateShape = useWorkspaceStore((s) => s.updateShape);
  const scrollConfig = shape.scrollConfig || { behavior: "none" as const, overflow: "hidden" as const };

  return (
    <div className="space-y-1.5 rounded border border-white/[0.08] p-2">
      <div className="text-[10px] uppercase tracking-wider text-[#666360]">Scroll Behavior</div>
      <select
        value={scrollConfig.behavior}
        onChange={(e) =>
          updateShape(shape.id, {
            scrollConfig: { ...scrollConfig, behavior: e.target.value as any },
          } as any)
        }
        className="w-full rounded bg-[#0f0f0f] px-2 py-1 text-xs text-[#f6f4f0]"
      >
        <option value="none">No scrolling</option>
        <option value="vertical">Vertical</option>
        <option value="horizontal">Horizontal</option>
        <option value="both">Both directions</option>
      </select>
      {scrollConfig.behavior !== "none" && (
        <select
          value={scrollConfig.overflow}
          onChange={(e) =>
            updateShape(shape.id, {
              scrollConfig: { ...scrollConfig, overflow: e.target.value as any },
            } as any)
          }
          className="w-full rounded bg-[#0f0f0f] px-2 py-1 text-xs text-[#f6f4f0]"
        >
          <option value="hidden">Clip overflow</option>
          <option value="scroll">Show overflow</option>
        </select>
      )}
    </div>
  );
}

// ── Size Presets Dropdown ─────────────────────────────────────
function SizePresetsDropdown({
  currentWidth,
  currentHeight,
  onApply,
}: {
  currentWidth: number;
  currentHeight: number;
  onApply: (width: number, height: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Find matching preset label
  const matchLabel = useMemo(() => {
    for (const group of DEVICE_PRESETS) {
      for (const p of group.presets) {
        if (
          (p.width === currentWidth && p.height === currentHeight) ||
          (p.height === currentWidth && p.width === currentHeight)
        ) {
          return p.name;
        }
      }
    }
    return null;
  }, [currentWidth, currentHeight]);

  const applyPreset = (preset: DevicePreset) => {
    const w = orientation === "portrait" ? preset.width : preset.height;
    const h = orientation === "portrait" ? preset.height : preset.width;
    onApply(w, h);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1">
        <button
          onClick={() => setOpen(!open)}
          className="flex flex-1 items-center justify-between rounded bg-[#0f0f0f] px-2 py-1.5 text-xs text-[#f6f4f0] hover:bg-white/[0.08]"
        >
          <span>{matchLabel || "Size presets"}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-[#666360]">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {/* Orientation toggles */}
        <button
          onClick={() => setOrientation("portrait")}
          className={`rounded p-1.5 ${
            orientation === "portrait"
              ? "bg-white/[0.08] text-[#f6f4f0]"
              : "text-[#666360] hover:bg-[#0f0f0f] hover:text-[#d7d6d2]"
          }`}
          title="Portrait"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="6" y="3" width="12" height="18" rx="2" />
          </svg>
        </button>
        <button
          onClick={() => setOrientation("landscape")}
          className={`rounded p-1.5 ${
            orientation === "landscape"
              ? "bg-white/[0.08] text-[#f6f4f0]"
              : "text-[#666360] hover:bg-[#0f0f0f] hover:text-[#d7d6d2]"
          }`}
          title="Landscape"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="6" width="18" height="12" rx="2" />
          </svg>
        </button>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[70vh] overflow-y-auto rounded-lg border border-white/[0.08] bg-[#2c2c2c] py-1 shadow-xl">
          {DEVICE_PRESETS.map((group) => (
            <div key={group.label}>
              <div className="sticky top-0 bg-[#2c2c2c] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#666360]">
                {group.label}
              </div>
              {group.presets.map((preset) => {
                const w = orientation === "portrait" ? preset.width : preset.height;
                const h = orientation === "portrait" ? preset.height : preset.width;
                const isActive = w === currentWidth && h === currentHeight;
                return (
                  <button
                    key={`${group.label}-${preset.name}`}
                    onClick={() => applyPreset(preset)}
                    className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-[#0f0f0f] ${
                      isActive ? "text-indigo-400" : "text-[#d7d6d2]"
                    }`}
                  >
                    <span>{preset.name}</span>
                    <span className="text-[#666360]">{w} x {h}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Property Input ────────────────────────────────────────────
function PropertyInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center rounded-md bg-white/[0.04] px-2.5 py-1.5 ring-1 ring-white/[0.06] transition-all focus-within:bg-white/[0.06] focus-within:ring-indigo-500/40">
      <span className="mr-1.5 text-[10px] font-medium text-zinc-500">{label}</span>
      <input
        type="number"
        value={Math.round(value * 100) / 100}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full bg-transparent text-right text-xs text-[#f6f4f0] outline-none"
      />
    </div>
  );
}
