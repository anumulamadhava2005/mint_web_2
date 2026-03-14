// ═══════════════════════════════════════════════════════════════
// Framework Auto-Suggestion Engine
// Analyzes PenpotShape data to recommend the best target framework
// ═══════════════════════════════════════════════════════════════

import type { PenpotShape, Page, PenpotFile, ShapeKind } from "@/lib/penpot/types";
import { ROOT_FRAME_ID } from "@/lib/penpot/types";
import type { TargetFramework } from "./types";

// ── Scoring weights ───────────────────────────────────────────

interface FrameworkScore {
  framework: TargetFramework;
  displayName: string;
  score: number;
  reasons: string[];
}

interface AnalysisSignals {
  // Design topology
  totalFrames: number;
  totalShapes: number;
  maxDepth: number;

  // Mobile signals
  mobileFrames: number;    // frames ≤ 430px wide
  tabletFrames: number;    // frames 431-1024px wide
  desktopFrames: number;   // frames > 1024px wide

  // Navigation / multi-page
  pageCount: number;
  hasNavigation: boolean;  // navigate interactions exist
  navigationTargets: number;

  // Layout complexity
  hasFlexLayout: boolean;
  hasGridLayout: boolean;
  nestedLayoutDepth: number;

  // Interactivity
  interactionCount: number;
  hasOverlays: boolean;
  hasScrollConfig: boolean;
  hasAnimations: boolean;

  // Content types
  imageCount: number;
  textCount: number;
  hasComponents: boolean;

  // Native-specific
  hasBottomNav: boolean;
  hasTabBar: boolean;
  hasDrawer: boolean;
  hasStatusBar: boolean;

  // Responsive signals
  hasResponsiveConstraints: boolean;
  hasMultipleBreakpoints: boolean;
}

// ── Dimension-based device detection ──────────────────────────

const MOBILE_MAX_WIDTH = 430;
const TABLET_MAX_WIDTH = 1024;

// Common mobile frame names
const MOBILE_NAME_PATTERNS = /\b(mobile|phone|android|ios|iphone|samsung|pixel|app)\b/i;
const TABLET_NAME_PATTERNS = /\b(tablet|ipad)\b/i;
const DESKTOP_NAME_PATTERNS = /\b(desktop|web|browser|landing|website|page)\b/i;
const NAV_NAME_PATTERNS = /\b(nav|navbar|navigation|menu|sidebar|drawer|tab.?bar|bottom.?bar|header)\b/i;
const STATUS_BAR_PATTERNS = /\b(status.?bar|notch|safe.?area)\b/i;

// ── Analysis ──────────────────────────────────────────────────

function analyzeShapes(
  objects: Record<string, PenpotShape>,
  parentId: string,
  depth: number
): {
  maxDepth: number;
  imageCount: number;
  textCount: number;
  nestedLayoutDepth: number;
  hasBottomNav: boolean;
  hasTabBar: boolean;
  hasDrawer: boolean;
  hasStatusBar: boolean;
} {
  const parent = objects[parentId];
  if (!parent?.shapes?.length) {
    return {
      maxDepth: depth,
      imageCount: 0,
      textCount: 0,
      nestedLayoutDepth: 0,
      hasBottomNav: false,
      hasTabBar: false,
      hasDrawer: false,
      hasStatusBar: false,
    };
  }

  let maxDepth = depth;
  let imageCount = 0;
  let textCount = 0;
  let nestedLayoutDepth = 0;
  let hasBottomNav = false;
  let hasTabBar = false;
  let hasDrawer = false;
  let hasStatusBar = false;

  for (const childId of parent.shapes) {
    const child = objects[childId];
    if (!child) continue;

    if (child.type === "image") imageCount++;
    if (child.type === "text") textCount++;

    const name = child.name.toLowerCase();
    if (NAV_NAME_PATTERNS.test(name) && name.includes("bottom")) hasBottomNav = true;
    if (/\btab.?bar\b/i.test(name)) hasTabBar = true;
    if (/\b(drawer|sidebar)\b/i.test(name)) hasDrawer = true;
    if (STATUS_BAR_PATTERNS.test(name)) hasStatusBar = true;

    if (child.layoutProps?.layout) {
      nestedLayoutDepth = Math.max(nestedLayoutDepth, depth);
    }

    const sub = analyzeShapes(objects, childId, depth + 1);
    maxDepth = Math.max(maxDepth, sub.maxDepth);
    imageCount += sub.imageCount;
    textCount += sub.textCount;
    nestedLayoutDepth = Math.max(nestedLayoutDepth, sub.nestedLayoutDepth);
    hasBottomNav = hasBottomNav || sub.hasBottomNav;
    hasTabBar = hasTabBar || sub.hasTabBar;
    hasDrawer = hasDrawer || sub.hasDrawer;
    hasStatusBar = hasStatusBar || sub.hasStatusBar;
  }

  return { maxDepth, imageCount, textCount, nestedLayoutDepth, hasBottomNav, hasTabBar, hasDrawer, hasStatusBar };
}

function analyzeFile(file: PenpotFile): AnalysisSignals {
  const signals: AnalysisSignals = {
    totalFrames: 0,
    totalShapes: 0,
    maxDepth: 0,
    mobileFrames: 0,
    tabletFrames: 0,
    desktopFrames: 0,
    pageCount: file.pages.length,
    hasNavigation: false,
    navigationTargets: 0,
    hasFlexLayout: false,
    hasGridLayout: false,
    nestedLayoutDepth: 0,
    interactionCount: 0,
    hasOverlays: false,
    hasScrollConfig: false,
    hasAnimations: false,
    imageCount: 0,
    textCount: 0,
    hasComponents: false,
    hasBottomNav: false,
    hasTabBar: false,
    hasDrawer: false,
    hasStatusBar: false,
    hasResponsiveConstraints: false,
    hasMultipleBreakpoints: false,
  };

  const navTargets = new Set<string>();

  for (const pageId of file.pages) {
    const page = file.pagesIndex[pageId];
    if (!page) continue;

    const objects = page.objects;
    const root = objects[ROOT_FRAME_ID];
    if (!root?.shapes) continue;

    // Analyze top-level frames (direct children of root)
    for (const frameId of root.shapes) {
      const frame = objects[frameId];
      if (!frame || frame.type !== "frame") continue;

      signals.totalFrames++;

      // Classify frame by width
      const w = frame.width;
      const frameName = frame.name;
      if (w <= MOBILE_MAX_WIDTH || MOBILE_NAME_PATTERNS.test(frameName)) {
        signals.mobileFrames++;
      } else if (w <= TABLET_MAX_WIDTH || TABLET_NAME_PATTERNS.test(frameName)) {
        signals.tabletFrames++;
      } else {
        signals.desktopFrames++;
      }

      // Check layout
      if (frame.layoutProps?.layout === "flex") signals.hasFlexLayout = true;
      if (frame.layoutProps?.layout === "grid") signals.hasGridLayout = true;

      // Check scroll
      if (frame.scrollConfig && frame.scrollConfig.behavior !== "none") {
        signals.hasScrollConfig = true;
      }

      // Analyze children recursively
      const sub = analyzeShapes(objects, frameId, 1);
      signals.maxDepth = Math.max(signals.maxDepth, sub.maxDepth);
      signals.imageCount += sub.imageCount;
      signals.textCount += sub.textCount;
      signals.nestedLayoutDepth = Math.max(signals.nestedLayoutDepth, sub.nestedLayoutDepth);
      signals.hasBottomNav = signals.hasBottomNav || sub.hasBottomNav;
      signals.hasTabBar = signals.hasTabBar || sub.hasTabBar;
      signals.hasDrawer = signals.hasDrawer || sub.hasDrawer;
      signals.hasStatusBar = signals.hasStatusBar || sub.hasStatusBar;
    }

    // Count all shapes
    signals.totalShapes += Object.keys(objects).length - 1; // minus root

    // Analyze interactions across all shapes
    for (const shape of Object.values(objects)) {
      if (shape.interactions?.length) {
        signals.interactionCount += shape.interactions.length;
        for (const interaction of shape.interactions) {
          if (interaction.actionType === "navigate" && interaction.destination) {
            signals.hasNavigation = true;
            navTargets.add(interaction.destination);
          }
          if (
            interaction.actionType === "open-overlay" ||
            interaction.actionType === "toggle-overlay" ||
            interaction.actionType === "swap-overlay"
          ) {
            signals.hasOverlays = true;
          }
          if (interaction.animation && interaction.animation.animationType !== "instant") {
            signals.hasAnimations = true;
          }
        }
      }

      // Check for responsive constraints
      if (
        shape.constraintsH === "leftright" ||
        shape.constraintsH === "center" ||
        shape.constraintsH === "scale" ||
        shape.constraintsV === "topbottom" ||
        shape.constraintsV === "center" ||
        shape.constraintsV === "scale"
      ) {
        signals.hasResponsiveConstraints = true;
      }

      // Check components
      if (shape.componentId) {
        signals.hasComponents = true;
      }
    }

    // Check flows (prototype entry points)
    if (page.flows?.length) {
      signals.hasNavigation = true;
    }
  }

  signals.navigationTargets = navTargets.size;

  // Check for multiple breakpoints (mobile + tablet, or mobile + desktop)
  const breakpointCategories = [signals.mobileFrames > 0, signals.tabletFrames > 0, signals.desktopFrames > 0];
  signals.hasMultipleBreakpoints = breakpointCategories.filter(Boolean).length >= 2;

  return signals;
}

// ── Scoring logic ─────────────────────────────────────────────

function scoreFrameworks(signals: AnalysisSignals): FrameworkScore[] {
  const scores: FrameworkScore[] = [
    { framework: "react", displayName: "React (Vite)", score: 50, reasons: [] },
    { framework: "nextjs", displayName: "Next.js", score: 50, reasons: [] },
    { framework: "vue", displayName: "Vue 3", score: 40, reasons: [] },
    { framework: "svelte", displayName: "Svelte", score: 35, reasons: [] },
    { framework: "react-native", displayName: "React Native (Expo)", score: 20, reasons: [] },
    { framework: "flutter", displayName: "Flutter", score: 15, reasons: [] },
  ];

  const find = (fw: TargetFramework) => scores.find((s) => s.framework === fw)!;

  // ── Mobile-dominant projects → native frameworks ────────────
  const mobileFraction = signals.totalFrames > 0 ? signals.mobileFrames / signals.totalFrames : 0;

  if (mobileFraction >= 0.8 && signals.mobileFrames >= 2) {
    find("react-native").score += 40;
    find("react-native").reasons.push("Design is primarily mobile screens");
    find("flutter").score += 35;
    find("flutter").reasons.push("Design targets mobile devices");
    // Web frameworks still viable but lower
    find("react").score -= 5;
    find("nextjs").score -= 10;
  } else if (mobileFraction >= 0.5) {
    find("react-native").score += 25;
    find("react-native").reasons.push("Majority mobile screens");
    find("flutter").score += 20;
    find("flutter").reasons.push("Significant mobile presence");
  }

  // ── Native UI patterns ──────────────────────────────────────
  if (signals.hasBottomNav) {
    find("react-native").score += 15;
    find("react-native").reasons.push("Bottom navigation detected");
    find("flutter").score += 15;
    find("flutter").reasons.push("Bottom navigation is native pattern");
  }

  if (signals.hasTabBar) {
    find("react-native").score += 10;
    find("react-native").reasons.push("Tab bar pattern found");
    find("flutter").score += 10;
    find("flutter").reasons.push("Tab bar pattern found");
  }

  if (signals.hasStatusBar) {
    find("react-native").score += 10;
    find("react-native").reasons.push("Status bar elements indicate native app");
    find("flutter").score += 10;
    find("flutter").reasons.push("Status bar elements indicate native app");
  }

  // ── Multi-page navigation → Next.js / SvelteKit ────────────
  if (signals.hasNavigation && signals.navigationTargets >= 3) {
    find("nextjs").score += 20;
    find("nextjs").reasons.push("Multi-page navigation with file-based routing");
    find("svelte").score += 10;
    find("svelte").reasons.push("SvelteKit has built-in routing");
  } else if (signals.hasNavigation) {
    find("nextjs").score += 10;
    find("nextjs").reasons.push("Navigation between screens benefits from routing");
    find("react").score += 5;
    find("react").reasons.push("Client-side routing with React Router");
  }

  // ── Multiple pages → Next.js excels ─────────────────────────
  if (signals.pageCount >= 3) {
    find("nextjs").score += 15;
    find("nextjs").reasons.push(`${signals.pageCount} pages map well to file-based routes`);
  }

  // ── Complex layouts → React / Vue ───────────────────────────
  if (signals.hasGridLayout) {
    find("react").score += 10;
    find("react").reasons.push("CSS Grid layout support");
    find("nextjs").score += 10;
    find("nextjs").reasons.push("Full CSS Grid support via Tailwind");
    find("vue").score += 8;
    find("vue").reasons.push("Good CSS Grid support");
  }

  if (signals.nestedLayoutDepth >= 3) {
    find("react").score += 10;
    find("react").reasons.push("Deep component nesting maps well to JSX");
    find("vue").score += 8;
    find("vue").reasons.push("Template-based nesting is intuitive");
  }

  // ── Heavy interactivity → React / Svelte ────────────────────
  if (signals.interactionCount >= 10) {
    find("react").score += 15;
    find("react").reasons.push("Rich interactivity matches React's event model");
    find("svelte").score += 12;
    find("svelte").reasons.push("Svelte's reactive model handles interactions well");
    find("vue").score += 10;
    find("vue").reasons.push("Vue's reactivity handles complex interactions");
  } else if (signals.interactionCount >= 5) {
    find("react").score += 8;
    find("react").reasons.push("Moderate interactivity");
    find("svelte").score += 8;
    find("svelte").reasons.push("Good for interactive UI");
  }

  // ── Overlays / Modals → web frameworks ──────────────────────
  if (signals.hasOverlays) {
    find("react").score += 8;
    find("react").reasons.push("Portal-based overlays");
    find("nextjs").score += 8;
    find("nextjs").reasons.push("Intercept routes for modals");
    find("vue").score += 6;
    find("vue").reasons.push("Teleport-based overlays");
  }

  // ── Animations → Svelte / React Native ──────────────────────
  if (signals.hasAnimations) {
    find("svelte").score += 10;
    find("svelte").reasons.push("Built-in transition/animation primitives");
    find("react-native").score += 5;
    find("react-native").reasons.push("Reanimated for native animations");
  }

  // ── Responsive / multiple breakpoints ───────────────────────
  if (signals.hasMultipleBreakpoints) {
    find("nextjs").score += 10;
    find("nextjs").reasons.push("Responsive design with Tailwind breakpoints");
    find("react").score += 8;
    find("react").reasons.push("Multi-breakpoint responsive layout");
    find("vue").score += 6;
    find("vue").reasons.push("Responsive CSS support");
    // Penalize native for multi-breakpoint
    find("react-native").score -= 10;
    find("flutter").score -= 10;
  }

  // ── Desktop-dominant → web frameworks ───────────────────────
  if (signals.desktopFrames > signals.mobileFrames && signals.desktopFrames >= 2) {
    find("nextjs").score += 12;
    find("nextjs").reasons.push("Desktop-focused design suits web platform");
    find("react").score += 10;
    find("react").reasons.push("Desktop web application");
    find("vue").score += 8;
    find("vue").reasons.push("Desktop web UI");
    find("svelte").score += 6;
    find("svelte").reasons.push("Lightweight desktop web");
    find("react-native").score -= 15;
    find("flutter").score -= 15;
  }

  // ── Components → component-based frameworks ─────────────────
  if (signals.hasComponents) {
    find("react").score += 8;
    find("react").reasons.push("Component architecture matches design system");
    find("vue").score += 8;
    find("vue").reasons.push("Vue SFC maps cleanly to design components");
    find("svelte").score += 6;
    find("svelte").reasons.push("Svelte components map to design components");
  }

  // ── Simple / few frames → simpler frameworks ────────────────
  if (signals.totalFrames <= 2 && signals.interactionCount <= 2) {
    find("svelte").score += 10;
    find("svelte").reasons.push("Simple design benefits from lightweight framework");
    find("react").score += 5;
    find("react").reasons.push("Quick to set up for small projects");
    find("nextjs").score -= 5;
    find("nextjs").reasons.push("May be overkill for simple designs");
  }

  // ── Content-heavy (lots of text/images) → Next.js ──────────
  if (signals.imageCount >= 10 || signals.textCount >= 20) {
    find("nextjs").score += 12;
    find("nextjs").reasons.push("Image optimization and SSR for content-heavy designs");
  }

  // ── Scroll configurations → native or specialized ───────────
  if (signals.hasScrollConfig) {
    find("react-native").score += 5;
    find("react-native").reasons.push("Native scroll views");
    find("flutter").score += 5;
    find("flutter").reasons.push("ListView/CustomScrollView");
  }

  // Clamp scores to [0, 100]
  for (const s of scores) {
    s.score = Math.max(0, Math.min(100, s.score));
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  return scores;
}

// ═══════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════

export interface FrameworkSuggestion {
  recommended: TargetFramework;
  displayName: string;
  confidence: "high" | "medium" | "low";
  rankings: FrameworkScore[];
  signals: AnalysisSignals;
}

/**
 * Analyze a PenpotFile and suggest the best target framework.
 * Returns all frameworks ranked with reasoning.
 */
export function suggestFramework(file: PenpotFile): FrameworkSuggestion {
  const signals = analyzeFile(file);
  const rankings = scoreFrameworks(signals);

  const top = rankings[0];
  const second = rankings[1];

  // Confidence based on gap between top and second
  const gap = top.score - second.score;
  let confidence: "high" | "medium" | "low";
  if (gap >= 15) {
    confidence = "high";
  } else if (gap >= 5) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  return {
    recommended: top.framework,
    displayName: top.displayName,
    confidence,
    rankings,
    signals,
  };
}

/**
 * Quick helper: get just the recommended framework name
 */
export function getRecommendedFramework(file: PenpotFile): TargetFramework {
  return suggestFramework(file).recommended;
}
