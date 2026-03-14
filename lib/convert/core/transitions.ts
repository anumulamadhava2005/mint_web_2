// ═══════════════════════════════════════════════════════════════
// Transition Engine — Converts Figma Animation objects into
// framework-specific transition code. (v4.0.0)
//
// Figma model:
//   Animation { type, direction, easing, duration, bezier }
//
// This module generates:
//   • CSS @keyframes + transition utilities (web frameworks)
//   • React Native Animated config helpers
//   • Flutter PageRouteBuilder transition definitions
//   • Shared easing → CSS cubic-bezier conversion
// ═══════════════════════════════════════════════════════════════

import type { Animation, Interaction } from "../types";

// ── Easing Conversion ─────────────────────────────────────────

/**
 * Convert a Figma easing type to a CSS timing function.
 */
export function easingToCSS(
  easing?: Animation["easing"],
  bezier?: [number, number, number, number]
): string {
  if (easing === "CUSTOM_BEZIER" && bezier) {
    return `cubic-bezier(${bezier[0]}, ${bezier[1]}, ${bezier[2]}, ${bezier[3]})`;
  }
  switch (easing) {
    case "LINEAR":
      return "linear";
    case "EASE_IN":
      return "cubic-bezier(0.42, 0, 1, 1)";
    case "EASE_OUT":
      return "cubic-bezier(0, 0, 0.58, 1)";
    case "EASE_IN_OUT":
      return "cubic-bezier(0.42, 0, 0.58, 1)";
    case "EASE_IN_BACK":
      return "cubic-bezier(0.36, 0, 0.66, -0.56)";
    case "EASE_OUT_BACK":
      return "cubic-bezier(0.34, 1.56, 0.64, 1)";
    default:
      return "ease-out";
  }
}

// ── CSS Transition Generation ─────────────────────────────────

/**
 * Build CSS properties for an inline transition style based on an Animation.
 * Returns an object that can be spread into a CSSProperties.
 */
export function animationToCSS(anim: Animation): Record<string, string> {
  const duration = anim.duration ?? 300;
  const easing = easingToCSS(anim.easing, anim.bezier);

  switch (anim.type) {
    case "INSTANT":
      return {};

    case "DISSOLVE":
      return {
        animationName: "page-dissolve-in",
        animationDuration: `${duration}ms`,
        animationTimingFunction: easing,
        animationFillMode: "both",
      };

    case "MOVE_IN": {
      const dir = directionToTranslate(anim.direction, true);
      return {
        animationName: `page-move-in-${(anim.direction || "RIGHT").toLowerCase()}`,
        animationDuration: `${duration}ms`,
        animationTimingFunction: easing,
        animationFillMode: "both",
      };
    }

    case "MOVE_OUT": {
      return {
        animationName: `page-move-out-${(anim.direction || "LEFT").toLowerCase()}`,
        animationDuration: `${duration}ms`,
        animationTimingFunction: easing,
        animationFillMode: "both",
      };
    }

    case "PUSH": {
      return {
        animationName: `page-push-${(anim.direction || "LEFT").toLowerCase()}`,
        animationDuration: `${duration}ms`,
        animationTimingFunction: easing,
        animationFillMode: "both",
      };
    }

    case "SLIDE_IN": {
      return {
        animationName: `page-move-in-${(anim.direction || "RIGHT").toLowerCase()}`,
        animationDuration: `${duration}ms`,
        animationTimingFunction: easing,
        animationFillMode: "both",
      };
    }

    case "SLIDE_OUT": {
      return {
        animationName: `page-move-out-${(anim.direction || "LEFT").toLowerCase()}`,
        animationDuration: `${duration}ms`,
        animationTimingFunction: easing,
        animationFillMode: "both",
      };
    }

    case "SMART_ANIMATE":
      // Smart Animate approximated as a dissolve + scale for now
      return {
        animationName: "page-smart-animate",
        animationDuration: `${duration}ms`,
        animationTimingFunction: easing,
        animationFillMode: "both",
      };

    default:
      return {};
  }
}

/**
 * Get the CSS translateX / translateY for a direction.
 */
function directionToTranslate(
  direction?: Animation["direction"],
  entering = true
): string {
  const sign = entering ? "-" : "";
  switch (direction) {
    case "LEFT":
      return `translateX(${sign}100%)`;
    case "RIGHT":
      return `translateX(${entering ? "" : "-"}100%)`;
    case "TOP":
      return `translateY(${sign}100%)`;
    case "BOTTOM":
      return `translateY(${entering ? "" : "-"}100%)`;
    default:
      return `translateX(${entering ? "" : "-"}100%)`;
  }
}

// ── Global Transition CSS ─────────────────────────────────────

/**
 * Generate the complete set of page-transition keyframes and utility classes.
 * Append this to the global CSS of each web framework.
 */
export function generatePageTransitionCSS(): string {
  return `
/* ── Page Transition Animations ──────────────────────────── */
.page-transition-dissolve {
  animation: page-dissolve-in 300ms ease-out both;
}

.page-transition-move-in-left {
  animation: page-move-in-left 300ms ease-out both;
}

.page-transition-move-in-right {
  animation: page-move-in-right 300ms ease-out both;
}

.page-transition-move-in-top {
  animation: page-move-in-top 300ms ease-out both;
}

.page-transition-move-in-bottom {
  animation: page-move-in-bottom 300ms ease-out both;
}

.page-transition-push-left {
  animation: page-push-left 300ms ease-out both;
}

.page-transition-push-right {
  animation: page-push-right 300ms ease-out both;
}

.page-transition-smart-animate {
  animation: page-smart-animate 300ms ease-out both;
}

/* Hover State Transitions */
[data-hover-scale] {
  transition: transform 150ms ease-out;
}

[data-hover-scale]:hover {
  transform: scale(1.02);
}

[data-hover-opacity] {
  transition: opacity 150ms ease-out;
}

[data-hover-opacity]:hover {
  opacity: 0.8;
}

[data-hover-brightness] {
  transition: filter 150ms ease-out;
}

[data-hover-brightness]:hover {
  filter: brightness(1.1);
}

/* Keyframes */
@keyframes page-dissolve-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes page-move-in-left {
  from { transform: translateX(-100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes page-move-in-right {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes page-move-in-top {
  from { transform: translateY(-100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes page-move-in-bottom {
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes page-push-left {
  from { transform: translateX(-30%); opacity: 0.5; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes page-push-right {
  from { transform: translateX(30%); opacity: 0.5; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes page-smart-animate {
  from { transform: scale(0.96); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
`;
}

/**
 * Get the CSS class for a page transition animation.
 */
export function transitionClassName(animation?: Animation): string {
  if (!animation || animation.type === "INSTANT") return "";

  switch (animation.type) {
    case "DISSOLVE":
      return "page-transition-dissolve";
    case "MOVE_IN":
    case "SLIDE_IN":
      return `page-transition-move-in-${(animation.direction || "RIGHT").toLowerCase()}`;
    case "MOVE_OUT":
    case "SLIDE_OUT":
      return `page-transition-move-in-${oppositeDirection(animation.direction || "LEFT").toLowerCase()}`;
    case "PUSH":
      return `page-transition-push-${(animation.direction || "LEFT").toLowerCase()}`;
    case "SMART_ANIMATE":
      return "page-transition-smart-animate";
    default:
      return "";
  }
}

/**
 * Return the opposite direction for push/slide-out animations.
 */
function oppositeDirection(
  dir: NonNullable<Animation["direction"]>
): string {
  switch (dir) {
    case "LEFT":
      return "RIGHT";
    case "RIGHT":
      return "LEFT";
    case "TOP":
      return "BOTTOM";
    case "BOTTOM":
      return "TOP";
    default:
      return "RIGHT";
  }
}

// ── React Native Transition Config ────────────────────────────

/**
 * Generate expo-router/Stack screen transition options for React Native.
 */
export function rnTransitionOptions(animation?: Animation): string {
  if (!animation || animation.type === "INSTANT") {
    return `animation: "none"`;
  }

  switch (animation.type) {
    case "DISSOLVE":
      return `animation: "fade"`;
    case "MOVE_IN":
    case "SLIDE_IN":
    case "PUSH":
      return `animation: "slide_from_right"`;
    case "MOVE_OUT":
    case "SLIDE_OUT":
      return `animation: "slide_from_left"`;
    case "SMART_ANIMATE":
      return `animation: "fade_from_bottom"`;
    default:
      return `animation: "default"`;
  }
}

// ── Flutter Transition Builder ────────────────────────────────

/**
 * Generate a Flutter PageRouteBuilder for a custom page transition.
 */
export function flutterTransitionRoute(
  routePath: string,
  widgetExpression: string,
  animation?: Animation
): string {
  if (!animation || animation.type === "INSTANT") {
    return `MaterialPageRoute(builder: (_) => ${widgetExpression})`;
  }

  const duration = animation.duration ?? 300;

  switch (animation.type) {
    case "DISSOLVE":
      return `PageRouteBuilder(
        pageBuilder: (_, __, ___) => ${widgetExpression},
        transitionDuration: const Duration(milliseconds: ${duration}),
        transitionsBuilder: (_, anim, __, child) => FadeTransition(opacity: anim, child: child),
      )`;

    case "MOVE_IN":
    case "SLIDE_IN":
    case "PUSH": {
      const beginOffset = flutterSlideOffset(animation.direction, true);
      return `PageRouteBuilder(
        pageBuilder: (_, __, ___) => ${widgetExpression},
        transitionDuration: const Duration(milliseconds: ${duration}),
        transitionsBuilder: (_, anim, __, child) => SlideTransition(
          position: Tween<Offset>(begin: ${beginOffset}, end: Offset.zero).animate(CurvedAnimation(parent: anim, curve: Curves.easeOut)),
          child: child,
        ),
      )`;
    }

    case "SMART_ANIMATE":
      return `PageRouteBuilder(
        pageBuilder: (_, __, ___) => ${widgetExpression},
        transitionDuration: const Duration(milliseconds: ${duration}),
        transitionsBuilder: (_, anim, __, child) => FadeTransition(
          opacity: anim,
          child: ScaleTransition(
            scale: Tween<double>(begin: 0.96, end: 1.0).animate(CurvedAnimation(parent: anim, curve: Curves.easeOut)),
            child: child,
          ),
        ),
      )`;

    default:
      return `MaterialPageRoute(builder: (_) => ${widgetExpression})`;
  }
}

function flutterSlideOffset(
  direction?: Animation["direction"],
  entering = true
): string {
  switch (direction) {
    case "LEFT":
      return "const Offset(-1, 0)";
    case "RIGHT":
      return "const Offset(1, 0)";
    case "TOP":
      return "const Offset(0, -1)";
    case "BOTTOM":
      return "const Offset(0, 1)";
    default:
      return "const Offset(1, 0)";
  }
}

// ── Hover / State Machine Helpers ─────────────────────────────

/**
 * Detect MOUSE_ENTER / MOUSE_LEAVE interaction pairs on a node and
 * return the data-attribute to apply for CSS hover effects.
 */
export function detectHoverInteraction(
  nodeId: string,
  interactions: Interaction[]
): string | null {
  const enter = interactions.find(
    (ix) =>
      ix.sourceId === nodeId &&
      (ix.trigger === "MOUSE_ENTER" || ix.trigger === "ON_HOVER")
  );

  if (!enter) return null;

  // If the hover triggers an overlay or navigation, we don't add a CSS effect
  if (enter.action === "OPEN_OVERLAY" || enter.action === "NAVIGATE") return null;

  // For SET_VARIABLE or state-change actions, approximate with a hover effect
  return "data-hover-scale";
}

/**
 * Build a map of animation configs keyed by NAVIGATE interaction targetId.
 * Used by builders to apply per-route transition classes.
 */
export function buildTransitionMap(
  interactions: Interaction[]
): Map<string, Animation> {
  const map = new Map<string, Animation>();
  for (const ix of interactions) {
    if (ix.action === "NAVIGATE" && ix.targetId && ix.animation) {
      // Keep the first animation encountered per target
      if (!map.has(ix.targetId)) {
        map.set(ix.targetId, ix.animation);
      }
    }
  }
  return map;
}
