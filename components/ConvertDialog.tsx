// ═══════════════════════════════════════════════════════════════
// ConvertDialog — Framework selection modal with auto-suggestion
// ═══════════════════════════════════════════════════════════════
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useWorkspaceStore } from "@/lib/penpot/store";
import { suggestFramework, type FrameworkSuggestion } from "@/lib/convert/suggest";
import type { TargetFramework } from "@/lib/convert/types";
import type { PenpotShape } from "@/lib/penpot/types";
import { ROOT_FRAME_ID } from "@/lib/penpot/types";

// ── Framework metadata ────────────────────────────────────────
const FRAMEWORK_INFO: Record<
  TargetFramework,
  { icon: string; color: string; description: string }
> = {
  react: {
    icon: "⚛️",
    color: "#61DAFB",
    description: "React with Vite, TypeScript, and Tailwind CSS",
  },
  nextjs: {
    icon: "▲",
    color: "#FFFFFF",
    description: "Next.js App Router with SSR, image optimization, and Tailwind",
  },
  vue: {
    icon: "💚",
    color: "#42B883",
    description: "Vue 3 Composition API with Vite and TypeScript",
  },
  svelte: {
    icon: "🔥",
    color: "#FF3E00",
    description: "SvelteKit with transitions and reactive stores",
  },
  "react-native": {
    icon: "📱",
    color: "#61DAFB",
    description: "React Native with Expo and native navigation",
  },
  flutter: {
    icon: "🐦",
    color: "#54C5F8",
    description: "Flutter with Material Design and Dart",
  },
  html: {
    icon: "🌐",
    color: "#E34F26",
    description: "Plain HTML/CSS/JS — no framework",
  },
};

// ── Confidence badge ──────────────────────────────────────────
function ConfidenceBadge({ level }: { level: "high" | "medium" | "low" }) {
  const config = {
    high: { label: "High confidence", bg: "bg-green-500/20", text: "text-green-400", dot: "bg-green-400" },
    medium: { label: "Medium confidence", bg: "bg-amber-500/20", text: "text-amber-400", dot: "bg-amber-400" },
    low: { label: "Low confidence", bg: "bg-zinc-500/20", text: "text-zinc-400", dot: "bg-zinc-400" },
  }[level];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${config.bg} ${config.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

// ── Signal bar visualization ──────────────────────────────────
function ScoreBar({ score, maxScore = 100 }: { score: number; maxScore?: number }) {
  const pct = Math.round((score / maxScore) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-zinc-700">
        <div
          className="h-1.5 rounded-full bg-indigo-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] tabular-nums text-zinc-500">{score}</span>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────
interface ConvertDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function ConvertDialog({ open, onClose }: ConvertDialogProps) {
  const file = useWorkspaceStore((s) => s.file);
  const currentPageId = useWorkspaceStore((s) => s.currentPageId);
  const profile = useWorkspaceStore((s) => s.profile);

  const [selected, setSelected] = useState<TargetFramework | null>(null);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Step management: "framework" → "orphans" → converting
  const [step, setStep] = useState<"framework" | "orphans">("framework");
  // Orphan frames the user can include/exclude
  const [orphanFrames, setOrphanFrames] = useState<{ id: string; name: string }[]>([]);
  const [excludedFrames, setExcludedFrames] = useState<Set<string>>(new Set());

  // Run suggestion engine
  const suggestion = useMemo<FrameworkSuggestion | null>(() => {
    if (!file) return null;
    try {
      return suggestFramework(file);
    } catch {
      return null;
    }
  }, [file]);

  // Auto-select recommended framework when dialog opens
  useEffect(() => {
    if (open && suggestion) {
      setSelected(suggestion.recommended);
      setError("");
      setConverting(false);
      setShowDetails(false);
      setStep("framework");
      setOrphanFrames([]);
      setExcludedFrames(new Set());
    }
  }, [open, suggestion]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [open, onClose]);

  // Click outside
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid the click that opened it
    const timer = setTimeout(() => {
      window.addEventListener("mousedown", handle);
    }, 100);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousedown", handle);
    };
  }, [open, onClose]);

  // ── Build DesignNode[] from PenpotShapes ────────────────────
  const buildPayload = useCallback(() => {
    if (!file || !currentPageId) return null;

    const page = file.pagesIndex[currentPageId];
    if (!page) return null;

    const objects = page.objects;
    const root = objects[ROOT_FRAME_ID];
    if (!root?.shapes?.length) return null;

    // Round to 1 decimal place for clean output
    function r(n: number): number {
      return Math.round(n * 10) / 10;
    }

    // Recursively convert PenpotShape → lightweight payload for the API
    // parentX/parentY = absolute position of the parent shape (for computing local coords)
    function shapeToNode(shape: PenpotShape, parentX: number, parentY: number): Record<string, unknown> {
      const node: Record<string, unknown> = {
        id: shape.id,
        name: shape.name,
        type: mapShapeType(shape.type),
        x: r(shape.x - parentX),
        y: r(shape.y - parentY),
        width: r(shape.width),
        height: r(shape.height),
        visible: !shape.hidden,
      };

      if (shape.rotation) node.rotation = shape.rotation;
      if (shape.opacity !== undefined && shape.opacity !== 1) node.opacity = shape.opacity;

      // Fills
      if (shape.fills?.length) {
        node.fills = shape.fills.map((f) => ({
          type: f.fillColorGradient ? `GRADIENT_${f.fillColorGradient.type.toUpperCase()}` : "SOLID",
          color: f.fillColor,
          opacity: f.fillOpacity,
        }));
      }

      // Strokes
      if (shape.strokes?.length) {
        node.strokes = shape.strokes.map((s) => ({
          color: s.strokeColor,
          opacity: s.strokeOpacity,
          weight: s.strokeWidth,
          align: s.strokeAlignment?.toUpperCase() || "CENTER",
        }));
      }

      // Corner radius
      if (shape.rx || shape.ry) {
        node.corners = { uniform: shape.rx || shape.ry };
      }

      // Effects (shadows)
      if (shape.shadow?.length) {
        node.effects = shape.shadow.filter((s) => !s.hidden).map((s) => ({
          type: s.type === "inner-shadow" ? "INNER_SHADOW" : "DROP_SHADOW",
          color: s.color,
          offsetX: s.offsetX,
          offsetY: s.offsetY,
          blur: s.blur,
          spread: s.spread,
        }));
      }

      // Text
      if (shape.type === "text" && shape.content) {
        const firstParagraph = shape.content.children?.[0];
        const firstRun = firstParagraph?.children?.[0];
        if (firstRun) {
          node.text = {
            characters: shape.content.children
              .flatMap((p) => p.children.map((r) => r.text))
              .join("\n"),
            fontFamily: firstRun.fontFamily,
            fontSize: firstRun.fontSize,
            fontWeight: firstRun.fontWeight,
            color: firstRun.fill || shape.fills?.[0]?.fillColor,
          };
        }
      }

      // Layout
      if (shape.layoutProps?.layout) {
        const lp = shape.layoutProps;
        node.layout = {
          mode: lp.layout === "flex"
            ? (lp.layoutFlexDir === "column" || lp.layoutFlexDir === "column-reverse" ? "VERTICAL" : "HORIZONTAL")
            : lp.layout === "grid" ? "GRID" : "NONE",
          gap: lp.layoutGap,
          paddingTop: lp.layoutPaddingTop,
          paddingRight: lp.layoutPaddingRight,
          paddingBottom: lp.layoutPaddingBottom,
          paddingLeft: lp.layoutPaddingLeft,
        };
      }

      // Image
      if (shape.type === "image" && shape.imageMetadata) {
        node.fills = [{ type: "IMAGE", imageRef: shape.imageMetadata.url || shape.id }];
      }

      // Scroll / Clip properties
      // showContent === false means clip is ON in Penpot
      if (shape.showContent === false || shape.scrollConfig) {
        const sc = shape.scrollConfig;
        node.clipContent = shape.showContent === false;
        if (sc) {
          node.overflowBehavior = sc.behavior || "none";
          // Mark children that are fixed during scroll
          if (sc.fixedElements?.length && shape.shapes?.length) {
            const fixedSet = new Set(sc.fixedElements);
            for (const childId of shape.shapes) {
              const childShape = objects[childId];
              if (childShape && fixedSet.has(childId)) {
                // We'll set fixedWhenScrolling on child nodes below
                (childShape as unknown as Record<string, unknown>).__fixedWhenScrolling = true;
              }
            }
          }
        }
      }
      // Check if parent marked this as fixed
      if ((shape as unknown as Record<string, unknown>).__fixedWhenScrolling) {
        node.fixedWhenScrolling = true;
      }

      // Children — positions relative to this shape's absolute canvas position
      if (shape.shapes?.length) {
        const kids = shape.shapes
          .map((id) => objects[id])
          .filter((s): s is PenpotShape => !!s && !s.hidden);
        if (kids.length > 0) {
          node.children = kids.map((k) => shapeToNode(k, shape.x, shape.y));
        }
      }

      return node;
    }

    // Get top-level frames
    const topFrames = root.shapes
      .map((id) => objects[id])
      .filter((s): s is PenpotShape => !!s && s.type === "frame" && !s.hidden);

    // Top-level frames get x=0, y=0 — they ARE the viewport
    const nodes = topFrames.map((f) => shapeToNode(f, f.x, f.y));

    // Reference frame — use max dimensions across all frames (not bounding box)
    const maxW = Math.max(...topFrames.map((f) => f.width));
    const maxH = Math.max(...topFrames.map((f) => f.height));
    const firstFrame = topFrames[0];
    const referenceFrame = firstFrame
      ? { id: firstFrame.id, x: 0, y: 0, width: r(maxW), height: r(maxH) }
      : undefined;

    // Collect interactions
    const interactions: Record<string, unknown>[] = [];
    for (const shape of Object.values(objects)) {
      if (shape.interactions?.length) {
        for (const ix of shape.interactions) {
          interactions.push({
            sourceId: shape.id,
            trigger: mapInteractionTrigger(ix.eventType),
            action: mapInteractionAction(ix.actionType),
            targetId: ix.actionType === "scroll-to" ? ix.scrollTargetId : ix.destination,
            animation: ix.animation
              ? {
                  type: ix.animation.animationType.toUpperCase(),
                  duration: ix.animation.duration,
                  easing: ix.animation.easing.toUpperCase().replace("-", "_"),
                }
              : undefined,
          });
        }
      }
    }

    return {
      nodes,
      referenceFrame,
      interactions,
    };
  }, [file, currentPageId]);

  // ── Detect orphan frames (0 in-degree, not home) ────────────
  const detectOrphans = useCallback(() => {
    const payload = buildPayload();
    if (!payload || payload.nodes.length <= 1) return { payload, orphans: [] };

    // Home frame is always the first top-level frame (route "/")
    const homeId = (payload.nodes[0] as Record<string, unknown>).id as string;

    // Collect all NAVIGATE interaction target IDs
    const navigatedTo = new Set<string>();
    for (const ix of payload.interactions) {
      const action = ix.action as string;
      const targetId = ix.targetId as string | undefined;
      if ((action === "NAVIGATE" || action === "OPEN_OVERLAY" || action === "SWAP_OVERLAY") && targetId) {
        navigatedTo.add(targetId);
      }
    }

    // Top-level frame IDs
    const topFrameIds = payload.nodes.map((n: Record<string, unknown>) => ({
      id: n.id as string,
      name: n.name as string,
    }));

    // Orphans: not home, and not navigated to by any interaction
    const orphans = topFrameIds.filter(
      (f) => f.id !== homeId && !navigatedTo.has(f.id)
    );

    return { payload, orphans };
  }, [buildPayload]);

  // ── Step 1 → orphan check (called when user clicks Export) ──
  const handleExportClick = useCallback(() => {
    if (!selected || !file) return;
    setError("");

    const { payload, orphans } = detectOrphans();
    if (!payload || payload.nodes.length === 0) {
      setError("No frames found on the current page to convert.");
      return;
    }

    if (orphans.length > 0) {
      // Show orphan confirmation step
      setOrphanFrames(orphans);
      setExcludedFrames(new Set()); // default: include all
      setStep("orphans");
    } else {
      // No orphans — proceed directly
      doConvert(payload, new Set());
    }
  }, [selected, file, detectOrphans]);

  // ── Proceed from orphans step ───────────────────────────────
  const handleOrphanConfirm = useCallback(() => {
    const { payload } = detectOrphans();
    if (!payload) return;
    doConvert(payload, excludedFrames);
  }, [detectOrphans, excludedFrames]);

  // ── Convert handler (actual conversion) ─────────────────────
  const doConvert = useCallback(async (
    payload: { nodes: Record<string, unknown>[]; referenceFrame: any; interactions: Record<string, unknown>[] },
    excluded: Set<string>
  ) => {
    if (!selected || !file) return;

    setConverting(true);
    setError("");

    try {
      // Filter out excluded orphan frames
      const filteredNodes = excluded.size > 0
        ? payload.nodes.filter((n: Record<string, unknown>) => !excluded.has(n.id as string))
        : payload.nodes;

      // Also filter interactions that reference excluded frames
      const filteredInteractions = excluded.size > 0
        ? payload.interactions.filter((ix: Record<string, unknown>) => {
            const sourceId = ix.sourceId as string;
            const targetId = ix.targetId as string | undefined;
            return !excluded.has(sourceId) && (!targetId || !excluded.has(targetId));
          })
        : payload.interactions;

      if (filteredNodes.length === 0) {
        setError("No frames remaining after exclusion.");
        setConverting(false);
        return;
      }

      const body = {
        target: selected,
        fileName: file.name.replace(/\s+/g, "-").toLowerCase() || "design",
        nodes: filteredNodes,
        referenceFrame: payload.referenceFrame,
        interactions: filteredInteractions,
        options: {
          generateTypeScript: true,
          cssFramework: "tailwind" as const,
          includeComments: true,
          enableLiveSync: true,
          fileKey: file.id,
          projectId: file.projectId,
          userId: profile?.id,
        },
      };

      const res = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Conversion failed (${res.status})`);
        setConverting(false);
        return;
      }

      // Download the ZIP
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${file.name.replace(/\s+/g, "-").toLowerCase()}-${selected}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setConverting(false);
    }
  }, [selected, file, onClose, profile]);

  if (!open) return null;

  const rankings = suggestion?.rankings ?? [];
  const recommended = suggestion?.recommended;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Dialog */}
      <div
        ref={dialogRef}
        className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-white">
              {step === "orphans" ? "Unreachable Screens" : "Export to Code"}
            </h2>
            <p className="mt-0.5 text-xs text-zinc-400">
              {step === "orphans"
                ? "These screens have no navigation pointing to them"
                : "Choose a target framework for your design"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {step === "framework" ? (
          <>
            {/* Suggestion banner */}
            {suggestion && (
              <div className="mx-5 mt-4 rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-400">
                      <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <span className="text-xs font-medium text-indigo-300">
                      Recommended: {suggestion.displayName}
                    </span>
                  </div>
                  <ConfidenceBadge level={suggestion.confidence} />
                </div>
                {suggestion.rankings[0]?.reasons.length > 0 && (
                  <p className="mt-1 text-[11px] leading-relaxed text-indigo-300/70">
                    {suggestion.rankings[0].reasons.slice(0, 2).join(" · ")}
                  </p>
                )}
              </div>
            )}

            {/* Framework grid */}
            <div className="px-5 py-4">
              <div className="grid grid-cols-2 gap-2">
                {rankings.map((fw) => {
                  const info = FRAMEWORK_INFO[fw.framework];
                  if (!info) return null;
                  const isRecommended = fw.framework === recommended;
                  const isSelected = fw.framework === selected;

                  return (
                    <button
                      key={fw.framework}
                      onClick={() => setSelected(fw.framework)}
                      className={`relative flex flex-col gap-1.5 rounded-xl border p-3 text-left transition-all ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/30"
                          : "border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]"
                      }`}
                    >
                      {isRecommended && (
                        <span className="absolute -top-1.5 right-2 rounded-full bg-indigo-500 px-1.5 py-px text-[9px] font-semibold text-white">
                          AI Pick
                        </span>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-base">{info.icon}</span>
                        <span className="text-sm font-medium text-zinc-200">
                          {fw.displayName}
                        </span>
                      </div>
                      <p className="text-[11px] leading-snug text-zinc-500">
                        {info.description}
                      </p>
                      <ScoreBar score={fw.score} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Details toggle */}
            {suggestion && (
              <div className="px-5 pb-2">
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`transition-transform ${showDetails ? "rotate-90" : ""}`}
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                  {showDetails ? "Hide" : "Show"} analysis details
                </button>

                {showDetails && (
                  <div className="mt-2 rounded-lg border border-white/5 bg-white/[0.02] p-3">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                      <Detail label="Total frames" value={suggestion.signals.totalFrames} />
                      <Detail label="Total shapes" value={suggestion.signals.totalShapes} />
                      <Detail label="Mobile frames" value={suggestion.signals.mobileFrames} />
                      <Detail label="Desktop frames" value={suggestion.signals.desktopFrames} />
                      <Detail label="Pages" value={suggestion.signals.pageCount} />
                      <Detail label="Interactions" value={suggestion.signals.interactionCount} />
                      <Detail label="Images" value={suggestion.signals.imageCount} />
                      <Detail label="Text nodes" value={suggestion.signals.textCount} />
                      <Detail label="Has navigation" value={suggestion.signals.hasNavigation ? "Yes" : "No"} />
                      <Detail label="Has overlays" value={suggestion.signals.hasOverlays ? "Yes" : "No"} />
                      <Detail label="Flex layout" value={suggestion.signals.hasFlexLayout ? "Yes" : "No"} />
                      <Detail label="Grid layout" value={suggestion.signals.hasGridLayout ? "Yes" : "No"} />
                      <Detail label="Bottom nav" value={suggestion.signals.hasBottomNav ? "Yes" : "No"} />
                      <Detail label="Responsive" value={suggestion.signals.hasMultipleBreakpoints ? "Yes" : "No"} />
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {rankings.filter((r) => r.reasons.length > 0).map((r) => (
                        <div key={r.framework} className="text-[10px]">
                          <span className="font-medium text-zinc-400">{r.displayName}:</span>{" "}
                          <span className="text-zinc-500">{r.reasons.join(" · ")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          /* ── Orphan Frames Review Step ── */
          <div className="px-5 py-4">
            <div className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span className="text-xs font-medium text-amber-300">
                  {orphanFrames.length} screen{orphanFrames.length > 1 ? "s" : ""} not linked by any navigation
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-amber-300/70">
                These frames can&apos;t be reached from the home screen. Include them anyway?
              </p>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {orphanFrames.map((frame) => {
                const isExcluded = excludedFrames.has(frame.id);
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
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-500">
                        <rect x="2" y="2" width="20" height="20" rx="2" />
                        <path d="M2 8h20M8 2v20" />
                      </svg>
                      <span className="text-sm text-zinc-200">{frame.name}</span>
                    </div>
                    <button
                      onClick={() => {
                        setExcludedFrames((prev) => {
                          const next = new Set(prev);
                          if (next.has(frame.id)) {
                            next.delete(frame.id);
                          } else {
                            next.add(frame.id);
                          }
                          return next;
                        });
                      }}
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
                        isExcluded
                          ? "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
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
        )}

        {/* Error */}
        {error && (
          <div className="mx-5 mb-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/5 px-5 py-4">
          <p className="text-[11px] text-zinc-500">
            {file?.name || "Untitled"} · Page {currentPageId ? "1" : "—"}
          </p>
          <div className="flex items-center gap-2">
            {step === "orphans" && (
              <button
                onClick={() => setStep("framework")}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-white"
              >
                ← Back
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-white"
            >
              Cancel
            </button>
            {step === "framework" ? (
              <button
                onClick={handleExportClick}
                disabled={!selected || converting}
                className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-medium transition-all ${
                  !selected || converting
                    ? "cursor-not-allowed bg-zinc-700 text-zinc-500"
                    : "bg-indigo-600 text-white hover:bg-indigo-500"
                }`}
              >
                {converting ? (
                  <>
                    <div className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />
                    Converting...
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                    </svg>
                    Export {selected ? FRAMEWORK_INFO[selected]?.icon : ""} ZIP
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleOrphanConfirm}
                disabled={converting}
                className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-medium transition-all ${
                  converting
                    ? "cursor-not-allowed bg-zinc-700 text-zinc-500"
                    : "bg-indigo-600 text-white hover:bg-indigo-500"
                }`}
              >
                {converting ? (
                  <>
                    <div className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />
                    Converting...
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    Confirm &amp; Export
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────

function Detail({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between text-zinc-400">
      <span className="text-zinc-500">{label}</span>
      <span className="font-medium">{String(value)}</span>
    </div>
  );
}

function mapShapeType(kind: string): string {
  const map: Record<string, string> = {
    frame: "FRAME",
    group: "GROUP",
    rect: "RECTANGLE",
    circle: "ELLIPSE",
    text: "TEXT",
    image: "IMAGE",
    path: "VECTOR",
    bool: "BOOLEAN_OPERATION",
    "svg-raw": "VECTOR",
  };
  return map[kind] || "FRAME";
}

function mapInteractionTrigger(eventType: string): string {
  const map: Record<string, string> = {
    click: "ON_CLICK",
    "mouse-press": "ON_PRESS",
    "mouse-over": "ON_HOVER",
    "mouse-enter": "MOUSE_ENTER",
    "mouse-leave": "MOUSE_LEAVE",
    "mouse-down": "MOUSE_DOWN",
    "mouse-up": "MOUSE_UP",
    "after-delay": "AFTER_TIMEOUT",
    "key-down": "ON_CLICK", // fallback
  };
  return map[eventType] || "ON_CLICK";
}

function mapInteractionAction(actionType: string): string {
  const map: Record<string, string> = {
    navigate: "NAVIGATE",
    "open-overlay": "OPEN_OVERLAY",
    "toggle-overlay": "SWAP_OVERLAY",
    "swap-overlay": "SWAP_OVERLAY",
    "close-overlay": "CLOSE_OVERLAY",
    "prev-screen": "BACK",
    "open-url": "OPEN_URL",
    "scroll-to": "SCROLL_TO",
    "swap-variant": "SET_VARIABLE",
  };
  return map[actionType] || "NAVIGATE";
}
