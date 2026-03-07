// ═══════════════════════════════════════════════════════════════
// Prototype Viewer — Full Figma-style prototype playback
//
// Features:
//   - Navigation between frames (with back stack)
//   - Overlay stack (open/swap/toggle/close overlays)
//   - All trigger types: click, hover, mouse-down/up, after-delay, key-down
//   - All animation types: dissolve, slide, push, move-in/out, smart-animate
//   - Scroll behavior (vertical, horizontal, fixed elements)
//   - Scroll-to action
//   - Hotspot highlighting toggle
//   - Flow selector for multi-flow pages
// ═══════════════════════════════════════════════════════════════
"use client";

import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
  memo,
} from "react";
import { useWorkspaceStore } from "@/lib/penpot/store";
import { useEditorStore } from "@/lib/editorStore";
import { ShapeWrapper } from "./penpot/ShapeRenderers";
import type { UUID, PenpotShape, Interaction } from "@/lib/penpot/types";
import { formatViewbox } from "@/lib/penpot/geom";
import {
  createInitialPrototypeState,
  executeInteraction,
  findInteractionForEvent,
  collectFrameChildren,
  getHotspots,
  easingToCss,
  transitionToStyle,
  type PrototypeState,
} from "@/lib/penpot/prototypeEngine";

// ── Props ─────────────────────────────────────────────────────
interface PrototypeViewerProps {
  onClose: () => void;
}

export default function PrototypeViewer({ onClose }: PrototypeViewerProps) {
  const file = useWorkspaceStore((s) => s.file);
  const currentPageId = useWorkspaceStore((s) => s.currentPageId);
  const setViewerMode = useEditorStore((s) => s.setViewerMode);

  // Viewer options
  const [showHotspots, setShowHotspots] = useState(false);

  // Page data
  const pageObjects = useMemo(() => {
    if (!file || !currentPageId) return {};
    return file.pagesIndex[currentPageId]?.objects || {};
  }, [file, currentPageId]);

  const flows = useMemo(() => {
    if (!file || !currentPageId) return [];
    return file.pagesIndex[currentPageId]?.flows || [];
  }, [file, currentPageId]);

  // Runtime state (from engine)
  const [protoState, setProtoState] = useState<PrototypeState>(() =>
    createInitialPrototypeState(pageObjects, flows),
  );

  // Scroll ref
  const scrollRef = useRef<HTMLDivElement>(null);

  // Transition timer
  const transitionTimer = useRef<ReturnType<typeof setTimeout>>(null);

  // Current frame
  const currentFrame = protoState.currentFrameId
    ? pageObjects[protoState.currentFrameId]
    : null;

  // Frame child objects
  const frameChildObjects = useMemo(
    () =>
      protoState.currentFrameId
        ? collectFrameChildren(protoState.currentFrameId, pageObjects)
        : {},
    [protoState.currentFrameId, pageObjects],
  );

  // Hotspots in current frame
  const hotspots = useMemo(
    () =>
      protoState.currentFrameId
        ? getHotspots(protoState.currentFrameId, pageObjects)
        : [],
    [protoState.currentFrameId, pageObjects],
  );

  // ── Execute an interaction ──────────────────────────────────
  const runInteraction = useCallback(
    (interaction: Interaction, sourceShapeId: UUID) => {
      if (transitionTimer.current) clearTimeout(transitionTimer.current);

      const nextState = executeInteraction(
        protoState,
        interaction,
        sourceShapeId,
        pageObjects,
      );

      if (nextState.transitionActive) {
        setProtoState(nextState);
        transitionTimer.current = setTimeout(() => {
          setProtoState((s) => ({
            ...s,
            transitionActive: false,
            transitionType: "instant",
            transitionDuration: 0,
          }));
        }, nextState.transitionDuration || 300);
      } else {
        setProtoState(nextState);
      }
    },
    [protoState, pageObjects],
  );

  // ── Event handlers ──────────────────────────────────────────

  const findAndRun = useCallback(
    (target: EventTarget | null, eventType: Parameters<typeof findInteractionForEvent>[1]) => {
      let el = target as Element | null;
      while (el) {
        const shapeId = el.getAttribute?.("data-shape-id");
        if (shapeId) {
          const result = findInteractionForEvent(shapeId, eventType, pageObjects);
          if (result) {
            runInteraction(result.interaction, result.shapeId);
            return true;
          }
        }
        el = el.parentElement;
      }
      return false;
    },
    [pageObjects, runInteraction],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => findAndRun(e.target, "click"),
    [findAndRun],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      findAndRun(e.target, "mouse-press");
      findAndRun(e.target, "mouse-down");
    },
    [findAndRun],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => findAndRun(e.target, "mouse-up"),
    [findAndRun],
  );

  const handleMouseOver = useCallback(
    (e: React.MouseEvent) => {
      findAndRun(e.target, "mouse-enter");
      findAndRun(e.target, "mouse-over");
    },
    [findAndRun],
  );

  const handleMouseOut = useCallback(
    (e: React.MouseEvent) => findAndRun(e.target, "mouse-leave"),
    [findAndRun],
  );

  // Key-down interactions
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!protoState.currentFrameId) return;
      const frame = pageObjects[protoState.currentFrameId];
      if (!frame?.shapes) return;

      const walk = (ids: UUID[]) => {
        for (const id of ids) {
          const shape = pageObjects[id];
          if (!shape) continue;
          if (shape.interactions) {
            for (const inter of shape.interactions) {
              if (inter.eventType === "key-down") {
                if (!inter.key || inter.key.toLowerCase() === e.key.toLowerCase()) {
                  runInteraction(inter, shape.id);
                  return;
                }
              }
            }
          }
          if (shape.shapes) walk(shape.shapes);
        }
      };
      walk(frame.shapes);
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [protoState.currentFrameId, pageObjects, runInteraction]);

  // After-delay triggers
  useEffect(() => {
    if (!protoState.currentFrameId) return;
    const frame = pageObjects[protoState.currentFrameId];
    if (!frame?.shapes) return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    const walkDelays = (ids: UUID[]) => {
      for (const id of ids) {
        const shape = pageObjects[id];
        if (!shape) continue;
        if (shape.interactions) {
          for (const inter of shape.interactions) {
            if (inter.eventType === "after-delay") {
              const timer = setTimeout(() => {
                runInteraction(inter, shape.id);
              }, inter.delay || 1000);
              timers.push(timer);
            }
          }
        }
        if (shape.shapes) walkDelays(shape.shapes);
      }
    };

    walkDelays(frame.shapes);
    return () => timers.forEach(clearTimeout);
  }, [protoState.currentFrameId, pageObjects, runInteraction]);

  // ── Overlay data ────────────────────────────────────────────
  const overlayFrames = useMemo(() => {
    return protoState.overlayStack.map((entry) => ({
      ...entry,
      frame: pageObjects[entry.frameId],
      objects: collectFrameChildren(entry.frameId, pageObjects),
    }));
  }, [protoState.overlayStack, pageObjects]);

  // ── Handle close ────────────────────────────────────────────
  const handleClose = () => {
    setViewerMode(false);
    onClose();
  };

  // ── Navigate back ───────────────────────────────────────────
  const goBack = useCallback(() => {
    if (protoState.navStack.length > 0) {
      const prev = protoState.navStack[protoState.navStack.length - 1];
      setProtoState((s) => ({
        ...s,
        currentFrameId: prev,
        navStack: s.navStack.slice(0, -1),
        overlayStack: [],
      }));
    }
  }, [protoState.navStack]);

  // ── Restart ─────────────────────────────────────────────────
  const restart = useCallback(() => {
    setProtoState(createInitialPrototypeState(pageObjects, flows));
  }, [pageObjects, flows]);

  // ── Jump to flow ────────────────────────────────────────────
  const jumpToFlow = useCallback((flowStartFrame: UUID) => {
    setProtoState((s) => ({
      ...s,
      currentFrameId: flowStartFrame,
      navStack: [],
      overlayStack: [],
    }));
  }, []);

  // ── No frame ────────────────────────────────────────────────
  if (!currentFrame) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
        <div className="text-center">
          <p className="text-zinc-400">No frames to preview.</p>
          <p className="mt-1 text-xs text-zinc-600">
            Create frames and set up a flow to use the prototype viewer.
          </p>
          <button
            onClick={handleClose}
            className="mt-4 rounded bg-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700"
          >
            Back to Editor
          </button>
        </div>
      </div>
    );
  }

  // ── Scroll config ───────────────────────────────────────────
  const scrollConfig = currentFrame.scrollConfig;
  const scrollBehavior = scrollConfig?.behavior || "none";
  const hasScroll = scrollBehavior !== "none";
  const fixedElements = new Set(scrollConfig?.fixedElements || []);

  // Transition styles
  const anim = protoState.transitionActive
    ? transitionToStyle(
        protoState.transitionType,
        protoState.transitionDirection,
        true,
      )
    : {};
  const transitionCss = protoState.transitionActive
    ? `all ${protoState.transitionDuration || 300}ms ${easingToCss("ease-in-out")}`
    : "all 300ms ease-in-out";

  const vbox = {
    x: currentFrame.x,
    y: currentFrame.y,
    width: currentFrame.width,
    height: currentFrame.height,
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* ── Toolbar ── */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={handleClose}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            title="Close viewer (Esc)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
          <span className="text-sm text-zinc-300">
            {currentFrame.name || "Frame"}
          </span>
          {protoState.navStack.length > 0 && (
            <span className="text-xs text-zinc-600">
              ({protoState.navStack.length} deep)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Back */}
          <button
            onClick={goBack}
            disabled={protoState.navStack.length === 0}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-30"
            title="Back"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5m7-7-7 7 7 7" />
            </svg>
          </button>

          {/* Restart */}
          <button
            onClick={restart}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            title="Restart prototype"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 4v6h6" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </button>

          {/* Hotspots toggle */}
          <button
            onClick={() => setShowHotspots(!showHotspots)}
            className={`rounded p-1 text-xs ${showHotspots ? "bg-indigo-600 text-white" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}
            title="Toggle hotspot highlighting"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          </button>

          {/* Flow selector */}
          {flows.length > 1 && (
            <select
              value={protoState.currentFrameId || ""}
              onChange={(e) => jumpToFlow(e.target.value)}
              className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-200"
            >
              {flows.map((flow) => (
                <option key={flow.id} value={flow.startingFrame}>
                  {flow.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* ── Viewer area ── */}
      <div className="relative flex-1 overflow-hidden">
        {/* Main frame */}
        <div
          className="flex h-full w-full items-center justify-center"
          style={{
            transition: transitionCss,
            ...anim,
          }}
        >
          {hasScroll ? (
            <div
              ref={scrollRef}
              className="relative"
              style={{
                width: currentFrame.width,
                height: currentFrame.height,
                overflowX: scrollBehavior === "horizontal" || scrollBehavior === "both" ? "auto" : "hidden",
                overflowY: scrollBehavior === "vertical" || scrollBehavior === "both" ? "auto" : "hidden",
              }}
            >
              <svg
                viewBox={formatViewbox(vbox)}
                width={currentFrame.width}
                height={currentFrame.height}
                style={{ display: "block" }}
              >
                <InteractiveFrame
                  frame={currentFrame}
                  objects={frameChildObjects}
                  fixedElements={fixedElements}
                  isFixed={false}
                  onClick={handleClick}
                  onMouseDown={handleMouseDown}
                  onMouseUp={handleMouseUp}
                  onMouseOver={handleMouseOver}
                  onMouseOut={handleMouseOut}
                  showHotspots={showHotspots}
                  hotspots={hotspots}
                />
              </svg>
            </div>
          ) : (
            <svg
              viewBox={formatViewbox(vbox)}
              className="max-h-full max-w-full"
              style={{
                width: currentFrame.width,
                height: currentFrame.height,
              }}
            >
              <InteractiveFrame
                frame={currentFrame}
                objects={frameChildObjects}
                fixedElements={fixedElements}
                isFixed={false}
                onClick={handleClick}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseOver={handleMouseOver}
                onMouseOut={handleMouseOut}
                showHotspots={showHotspots}
                hotspots={hotspots}
              />
            </svg>
          )}
        </div>

        {/* ── Overlay stack ── */}
        {overlayFrames.map((entry, idx) => (
          <div
            key={`${entry.frameId}-${idx}`}
            className="absolute inset-0"
            style={overlayPositionStyle(entry.posType)}
            onClick={(e) => {
              if (entry.closeOnClick && e.target === e.currentTarget) {
                setProtoState((s) => ({
                  ...s,
                  overlayStack: s.overlayStack.filter((_, i) => i !== idx),
                }));
              }
            }}
          >
            {/* Backdrop */}
            {entry.backgroundOverlay && (
              <div className="absolute inset-0 bg-black/50" />
            )}

            {/* Overlay frame */}
            {entry.frame && (
              <div
                className="relative z-10"
                style={entry.position
                  ? { position: "absolute", left: entry.position.x, top: entry.position.y }
                  : {}
                }
              >
                <svg
                  viewBox={`${entry.frame.x} ${entry.frame.y} ${entry.frame.width} ${entry.frame.height}`}
                  width={entry.frame.width}
                  height={entry.frame.height}
                  style={{ filter: "drop-shadow(0 8px 32px rgba(0,0,0,0.5))" }}
                >
                  <InteractiveFrame
                    frame={entry.frame}
                    objects={entry.objects}
                    fixedElements={new Set()}
                    isFixed={false}
                    onClick={handleClick}
                    onMouseDown={handleMouseDown}
                    onMouseUp={handleMouseUp}
                    onMouseOver={handleMouseOver}
                    onMouseOut={handleMouseOut}
                    showHotspots={showHotspots}
                    hotspots={getHotspots(entry.frameId, pageObjects)}
                  />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Overlay positioning ───────────────────────────────────────
function overlayPositionStyle(posType: string): React.CSSProperties {
  switch (posType) {
    case "center": return { display: "flex", alignItems: "center", justifyContent: "center" };
    case "top-left": return { display: "flex", alignItems: "flex-start", justifyContent: "flex-start" };
    case "top-right": return { display: "flex", alignItems: "flex-start", justifyContent: "flex-end" };
    case "top-center": return { display: "flex", alignItems: "flex-start", justifyContent: "center" };
    case "bottom-left": return { display: "flex", alignItems: "flex-end", justifyContent: "flex-start" };
    case "bottom-right": return { display: "flex", alignItems: "flex-end", justifyContent: "flex-end" };
    case "bottom-center": return { display: "flex", alignItems: "flex-end", justifyContent: "center" };
    default: return { display: "flex", alignItems: "center", justifyContent: "center" };
  }
}

// ── Interactive Frame (renders shapes with full event handlers) ──
const InteractiveFrame = memo(function InteractiveFrame({
  frame,
  objects,
  fixedElements,
  isFixed,
  onClick,
  onMouseDown,
  onMouseUp,
  onMouseOver,
  onMouseOut,
  showHotspots,
  hotspots,
}: {
  frame: PenpotShape;
  objects: Record<UUID, PenpotShape>;
  fixedElements: Set<UUID>;
  isFixed: boolean;
  onClick: (e: React.MouseEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onMouseOver: (e: React.MouseEvent) => void;
  onMouseOut: (e: React.MouseEvent) => void;
  showHotspots: boolean;
  hotspots: UUID[];
}) {
  const hotspotSet = useMemo(() => new Set(hotspots), [hotspots]);

  return (
    <g
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseOver={onMouseOver}
      onMouseOut={onMouseOut}
      style={{ cursor: "default" }}
    >
      {/* Frame background */}
      <rect
        x={frame.x}
        y={frame.y}
        width={frame.width}
        height={frame.height}
        fill={frame.fills?.[0]?.fillColor || "#FFFFFF"}
        rx={frame.rx || 0}
        ry={frame.ry || 0}
      />

      {/* Children */}
      {frame.shapes?.map((childId) => {
        const shape = objects[childId];
        if (!shape || shape.hidden) return null;

        // Skip fixed elements in scroll layer, or non-fixed in fixed layer
        if (fixedElements.has(childId) !== isFixed) return null;

        const isInteractive = hasInteractionRecursive(shape, objects);

        return (
          <g
            key={childId}
            style={{ cursor: isInteractive ? "pointer" : "default" }}
          >
            <ShapeWrapper shape={shape} objects={objects} />

            {/* Hotspot overlay */}
            {showHotspots && hotspotSet.has(childId) && (
              <rect
                x={shape.x}
                y={shape.y}
                width={shape.width}
                height={shape.height}
                fill="rgba(66, 133, 244, 0.15)"
                stroke="rgba(66, 133, 244, 0.6)"
                strokeWidth={1}
                rx={2}
                pointerEvents="none"
              />
            )}
          </g>
        );
      })}
    </g>
  );
});

/** Check if shape or any descendant has interactions */
function hasInteractionRecursive(
  shape: PenpotShape,
  objects: Record<UUID, PenpotShape>,
): boolean {
  if (shape.interactions && shape.interactions.length > 0) return true;
  if (shape.shapes) {
    for (const childId of shape.shapes) {
      const child = objects[childId];
      if (child && hasInteractionRecursive(child, objects)) return true;
    }
  }
  return false;
}
