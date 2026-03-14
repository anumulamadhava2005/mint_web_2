// ═══════════════════════════════════════════════════════════════
// Overlay System — Identifies overlay frames and generates
// overlay/modal infrastructure for code generation.
//
// Figma model: overlayStack.push(frame) / overlayStack.pop()
//   - OPEN_OVERLAY  → push frame onto modal stack
//   - CLOSE_OVERLAY → pop the topmost (or specific) overlay
//   - SWAP_OVERLAY  → replace topmost overlay with a different frame
//
// Generated code produces a provider/context with:
//   openOverlay(id)  /  closeOverlay()  /  swapOverlay(id)
// and an <OverlayContainer /> that renders the current stack
// with backdrop + animated entrance/exit.
// ═══════════════════════════════════════════════════════════════

import type { DrawableNode, Interaction, Animation } from "../types";
import { slugifyFrameName, toComponentName } from "./routing";
import { animationToCSS, easingToCSS } from "./transitions";

// ── Types ─────────────────────────────────────────────────────

export interface OverlayFrame {
  /** Original top-level frame node */
  frame: DrawableNode;
  /** Component name, e.g. "LoginModal" */
  componentName: string;
  /** Slug for identification */
  slug: string;
  /** The animation specified by the OPEN_OVERLAY interaction (if any) */
  animation?: Animation;
  /** Whether clicking the backdrop should close this overlay */
  closeOnBackdropClick: boolean;
}

export interface OverlayAnalysis {
  /** Frames that are used as pages (NAVIGATE targets + non-overlay origins) */
  pageFrames: DrawableNode[];
  /** Frames that are overlay targets (only referenced by OPEN_OVERLAY / SWAP_OVERLAY) */
  overlayFrames: OverlayFrame[];
  /** Whether any overlay interactions exist at all */
  hasOverlays: boolean;
  /** All OPEN_OVERLAY / CLOSE_OVERLAY / SWAP_OVERLAY interactions */
  overlayInteractions: Interaction[];
}

// ── Core Analysis ─────────────────────────────────────────────

/**
 * Separate top-level frames into pages vs overlays.
 *
 * A frame is considered an overlay if:
 *   1. It is the target of an OPEN_OVERLAY or SWAP_OVERLAY interaction, AND
 *   2. It is NOT also the target of a NAVIGATE interaction
 *
 * This prevents routing to overlay frames while still generating
 * proper modal components for them.
 */
export function analyzeOverlays(
  frames: DrawableNode[],
  interactions: Interaction[]
): OverlayAnalysis {
  // Collect target IDs by action type
  const navigateTargets = new Set<string>();
  const overlayTargets = new Set<string>();
  const overlayAnimations = new Map<string, Animation | undefined>();

  for (const ix of interactions) {
    if (ix.action === "NAVIGATE" && ix.targetId) {
      navigateTargets.add(ix.targetId);
    }
    if (
      (ix.action === "OPEN_OVERLAY" || ix.action === "SWAP_OVERLAY") &&
      ix.targetId
    ) {
      overlayTargets.add(ix.targetId);
      // Keep the first animation we find for each overlay
      if (!overlayAnimations.has(ix.targetId)) {
        overlayAnimations.set(ix.targetId, ix.animation);
      }
    }
  }

  const overlayInteractions = interactions.filter(
    (ix) =>
      ix.action === "OPEN_OVERLAY" ||
      ix.action === "CLOSE_OVERLAY" ||
      ix.action === "SWAP_OVERLAY"
  );

  const pageFrames: DrawableNode[] = [];
  const overlayFrames: OverlayFrame[] = [];

  for (const frame of frames) {
    const isOverlayTarget = overlayTargets.has(frame.id);
    const isNavigateTarget = navigateTargets.has(frame.id);

    // A frame that is ONLY an overlay target (not also a navigate target)
    // gets extracted as an overlay component
    if (isOverlayTarget && !isNavigateTarget) {
      const slug = slugifyFrameName(frame.name);
      overlayFrames.push({
        frame,
        componentName: toComponentName(frame.name) + "Overlay",
        slug,
        animation: overlayAnimations.get(frame.id),
        closeOnBackdropClick: true,
      });
    } else {
      pageFrames.push(frame);
    }
  }

  return {
    pageFrames,
    overlayFrames,
    hasOverlays: overlayFrames.length > 0,
    overlayInteractions,
  };
}

/**
 * Build a map of overlayFrameId → component name for code generation.
 */
export function buildOverlayMap(
  overlayFrames: OverlayFrame[]
): Map<string, string> {
  const map = new Map<string, string>();
  for (const ov of overlayFrames) {
    map.set(ov.frame.id, ov.componentName);
  }
  return map;
}

// ── CSS Generation ────────────────────────────────────────────

/**
 * Generate global CSS for the overlay system (backdrop, animations, stacking).
 */
export function generateOverlayCSS(): string {
  return `
/* ── Overlay System ──────────────────────────────────────── */
.overlay-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: overlay-fade-in 200ms ease-out;
}

.overlay-backdrop.closing {
  animation: overlay-fade-out 200ms ease-in forwards;
}

.overlay-content {
  position: relative;
  z-index: 9001;
}

/* Overlay entrance animations */
.overlay-enter-dissolve {
  animation: overlay-fade-in var(--overlay-duration, 300ms) var(--overlay-easing, ease-out);
}

.overlay-enter-move-in-right {
  animation: overlay-slide-in-right var(--overlay-duration, 300ms) var(--overlay-easing, ease-out);
}

.overlay-enter-move-in-left {
  animation: overlay-slide-in-left var(--overlay-duration, 300ms) var(--overlay-easing, ease-out);
}

.overlay-enter-move-in-top {
  animation: overlay-slide-in-top var(--overlay-duration, 300ms) var(--overlay-easing, ease-out);
}

.overlay-enter-move-in-bottom {
  animation: overlay-slide-in-bottom var(--overlay-duration, 300ms) var(--overlay-easing, ease-out);
}

.overlay-enter-scale {
  animation: overlay-scale-in var(--overlay-duration, 300ms) var(--overlay-easing, ease-out);
}

/* Exit animations */
.overlay-exit-dissolve {
  animation: overlay-fade-out var(--overlay-duration, 200ms) var(--overlay-easing, ease-in) forwards;
}

.overlay-exit-move-out-right {
  animation: overlay-slide-out-right var(--overlay-duration, 200ms) var(--overlay-easing, ease-in) forwards;
}

.overlay-exit-move-out-left {
  animation: overlay-slide-out-left var(--overlay-duration, 200ms) var(--overlay-easing, ease-in) forwards;
}

.overlay-exit-move-out-top {
  animation: overlay-slide-out-top var(--overlay-duration, 200ms) var(--overlay-easing, ease-in) forwards;
}

.overlay-exit-move-out-bottom {
  animation: overlay-slide-out-bottom var(--overlay-duration, 200ms) var(--overlay-easing, ease-in) forwards;
}

/* Keyframes */
@keyframes overlay-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes overlay-fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes overlay-slide-in-right {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes overlay-slide-in-left {
  from { transform: translateX(-100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes overlay-slide-in-top {
  from { transform: translateY(-100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes overlay-slide-in-bottom {
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes overlay-slide-out-right {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(100%); opacity: 0; }
}

@keyframes overlay-slide-out-left {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(-100%); opacity: 0; }
}

@keyframes overlay-slide-out-top {
  from { transform: translateY(0); opacity: 1; }
  to { transform: translateY(-100%); opacity: 0; }
}

@keyframes overlay-slide-out-bottom {
  from { transform: translateY(0); opacity: 1; }
  to { transform: translateY(100%); opacity: 0; }
}

@keyframes overlay-scale-in {
  from { transform: scale(0.85); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
`;
}

/**
 * Determine the CSS animation class for an overlay based on its Animation config.
 */
export function overlayEntranceClass(animation?: Animation): string {
  if (!animation || animation.type === "INSTANT") return "";

  switch (animation.type) {
    case "DISSOLVE":
      return "overlay-enter-dissolve";
    case "MOVE_IN":
      return `overlay-enter-move-in-${(animation.direction || "BOTTOM").toLowerCase()}`;
    case "SLIDE_IN":
      return `overlay-enter-move-in-${(animation.direction || "BOTTOM").toLowerCase()}`;
    case "PUSH":
      return `overlay-enter-move-in-${(animation.direction || "RIGHT").toLowerCase()}`;
    case "SMART_ANIMATE":
      return "overlay-enter-scale";
    default:
      return "overlay-enter-dissolve";
  }
}

/**
 * Generate CSS custom properties for an overlay's timing.
 */
export function overlayTimingVars(animation?: Animation): string {
  if (!animation) return "";
  const duration = animation.duration ?? 300;
  const easing = easingToCSS(animation.easing, animation.bezier);
  return `--overlay-duration: ${duration}ms; --overlay-easing: ${easing};`;
}

// ── React/Next.js Overlay Provider ────────────────────────────

/**
 * Generate a React context provider for the overlay stack.
 */
export function generateReactOverlayProvider(
  overlayFrames: OverlayFrame[]
): string {
  const imports = overlayFrames
    .map((ov) => `import ${ov.componentName} from "./${ov.componentName}";`)
    .join("\n");

  const registry = overlayFrames
    .map(
      (ov) => `  "${ov.frame.id}": { component: ${ov.componentName}, animation: "${overlayEntranceClass(ov.animation)}", timing: "${overlayTimingVars(ov.animation)}" }`
    )
    .join(",\n");

  return `"use client";

import React, { createContext, useContext, useState, useCallback, useRef } from "react";
${imports}

interface OverlayEntry {
  id: string;
  key: number;
}

interface OverlayContextValue {
  openOverlay: (id: string) => void;
  closeOverlay: () => void;
  swapOverlay: (id: string) => void;
}

const OverlayContext = createContext<OverlayContextValue>({
  openOverlay: () => {},
  closeOverlay: () => {},
  swapOverlay: () => {},
});

export function useOverlay() {
  return useContext(OverlayContext);
}

const OVERLAY_REGISTRY: Record<string, {
  component: React.ComponentType;
  animation: string;
  timing: string;
}> = {
${registry}
};

export function OverlayProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<OverlayEntry[]>([]);
  const keyRef = useRef(0);

  const openOverlay = useCallback((id: string) => {
    keyRef.current += 1;
    setStack((prev) => [...prev, { id, key: keyRef.current }]);
  }, []);

  const closeOverlay = useCallback(() => {
    setStack((prev) => prev.slice(0, -1));
  }, []);

  const swapOverlay = useCallback((id: string) => {
    keyRef.current += 1;
    setStack((prev) => [
      ...prev.slice(0, -1),
      { id, key: keyRef.current },
    ]);
  }, []);

  return (
    <OverlayContext.Provider value={{ openOverlay, closeOverlay, swapOverlay }}>
      {children}
      {stack.map((entry) => {
        const reg = OVERLAY_REGISTRY[entry.id];
        if (!reg) return null;
        const Comp = reg.component;
        return (
          <div
            key={entry.key}
            className="overlay-backdrop"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeOverlay();
            }}
            style={reg.timing ? { ...Object.fromEntries(reg.timing.split(";").filter(Boolean).map(s => { const [k,v] = s.split(":"); return [k.trim(), v.trim()]; })) } as React.CSSProperties : undefined}
          >
            <div className={\`overlay-content \${reg.animation}\`}>
              <Comp />
            </div>
          </div>
        );
      })}
    </OverlayContext.Provider>
  );
}
`;
}

/**
 * Generate a standalone overlay component (React/Next.js) for a single overlay frame.
 */
export function generateReactOverlayComponent(
  overlay: OverlayFrame,
  renderContent: string
): string {
  const { frame, componentName } = overlay;
  const w = Math.round(frame.w);
  const h = Math.round(frame.h);
  const bgColor =
    frame.fill?.type === "SOLID" && frame.fill.color
      ? frame.fill.color
      : undefined;
  const bgStyle = bgColor ? `, backgroundColor: "${bgColor}"` : "";

  return `export default function ${componentName}() {
  return (
    <div
      style={{ width: ${w}, height: ${h}, position: "relative", overflow: "hidden"${bgStyle} }}
      data-name="${frame.name}"
    >
${renderContent}
    </div>
  );
}
`;
}
