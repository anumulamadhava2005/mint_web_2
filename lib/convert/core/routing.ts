// ═══════════════════════════════════════════════════════════════
// Routing Utilities — Shared helpers for frame-as-page routing
// ═══════════════════════════════════════════════════════════════

import type { DrawableNode, Interaction, Animation } from "../types";

/**
 * Represents a routable frame (page) in the exported project.
 */
export interface FrameRoute {
  /** Original frame node */
  frame: DrawableNode;
  /** URL-safe slug, e.g. "login-page" */
  slug: string;
  /** Full route path, e.g. "/login-page" (first frame gets "/") */
  routePath: string;
  /** Safe component name, e.g. "LoginPage" */
  componentName: string;
  /** Safe file name (no extension), e.g. "LoginPage" */
  fileName: string;
  /** Whether this is the home/index route */
  isHome: boolean;
}

/**
 * Convert a frame name to a URL-safe slug.
 * "Login Page" → "login-page"
 * "Frame 1" → "frame-1"
 * "  My Dashboard! " → "my-dashboard"
 */
export function slugifyFrameName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    || "page";
}

/**
 * Convert a frame name to a PascalCase component name.
 * "login-page" → "LoginPage"
 * "Frame 1" → "Frame1"
 */
export function toComponentName(name: string): string {
  const slug = slugifyFrameName(name);
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("")
    || "Page";
}

/**
 * Build a route map from top-level frames.
 * The first frame becomes the home route ("/").
 * Subsequent frames get slugified paths.
 * Handles duplicate slugs by appending a counter.
 */
export function buildFrameRoutes(frames: DrawableNode[]): FrameRoute[] {
  const usedSlugs = new Set<string>();
  const routes: FrameRoute[] = [];

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const isHome = i === 0;

    let slug = slugifyFrameName(frame.name);
    // Deduplicate slugs
    if (usedSlugs.has(slug)) {
      let counter = 2;
      while (usedSlugs.has(`${slug}-${counter}`)) counter++;
      slug = `${slug}-${counter}`;
    }
    usedSlugs.add(slug);

    const componentName = toComponentName(frame.name) + (usedSlugs.size !== new Set([...usedSlugs].map(s => toComponentName(s.split("-").join(" ")))).size ? i.toString() : "");
    // Simpler: just derive from slug
    const safeName = slug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join("")
      || "Page";

    routes.push({
      frame,
      slug,
      routePath: isHome ? "/" : `/${slug}`,
      componentName: safeName,
      fileName: safeName,
      isHome,
    });
  }

  // Ensure component names are unique
  const nameCount = new Map<string, number>();
  for (const route of routes) {
    const count = nameCount.get(route.componentName) || 0;
    nameCount.set(route.componentName, count + 1);
  }
  for (const [name, count] of nameCount) {
    if (count > 1) {
      let idx = 1;
      for (const route of routes) {
        if (route.componentName === name) {
          if (idx > 1) {
            route.componentName = `${name}${idx}`;
            route.fileName = `${name}${idx}`;
          }
          idx++;
        }
      }
    }
  }

  return routes;
}

/**
 * Build a map of frameId → route path for quick lookup.
 */
export function buildRouteMap(routes: FrameRoute[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const route of routes) {
    map.set(route.frame.id, route.routePath);
  }
  return map;
}

/**
 * Rewrite interactions so that NAVIGATE targetIds reference
 * route paths instead of raw UUIDs.
 *
 * This allows render.ts to generate:
 *   onClick={() => navigate("/login"))
 * instead of:
 *   onClick(() => navigate("some-uuid"))
 *
 * OPEN_OVERLAY / SWAP_OVERLAY targets are NOT rewritten here —
 * they keep their raw frame IDs so the overlay system can match them.
 */
export function rewriteInteractionsForRouting(
  interactions: Interaction[],
  routeMap: Map<string, string>
): Interaction[] {
  return interactions.map((ix) => {
    if (
      ix.action === "NAVIGATE" &&
      ix.targetId &&
      routeMap.has(ix.targetId)
    ) {
      return { ...ix, targetId: routeMap.get(ix.targetId)! };
    }
    return ix;
  });
}
