// ═══════════════════════════════════════════════════════════════
// Build Design Payload — Server-side shape → design node converter
//
// Converts raw PenpotFile data into DesignNode[] payload suitable
// for convertDesign(). Extracted from ConvertDialog.tsx so both
// client (Convert button) and server (Commit API) can use it.
// ═══════════════════════════════════════════════════════════════

import type { PenpotFile, PenpotShape, UUID } from "@/lib/penpot/types";
import { ROOT_FRAME_ID } from "@/lib/penpot/types";

export interface DesignPayload {
  nodes: Record<string, unknown>[];
  referenceFrame?: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  interactions: Record<string, unknown>[];
}

/**
 * Build a design payload from a PenpotFile for a given page.
 * If no pageId is provided, uses the first page.
 */
export function buildDesignPayload(
  file: PenpotFile,
  pageId?: string
): DesignPayload | null {
  const targetPageId = pageId || file.pages?.[0];
  if (!targetPageId) return null;

  const page = file.pagesIndex[targetPageId];
  if (!page) return null;

  const objects = page.objects;
  const root = objects[ROOT_FRAME_ID];
  if (!root?.shapes?.length) return null;

  // Round to 1 decimal place for clean output
  function r(n: number): number {
    return Math.round(n * 10) / 10;
  }

  // Recursively convert PenpotShape → lightweight node for the API
  function shapeToNode(
    shape: PenpotShape,
    parentX: number,
    parentY: number
  ): Record<string, unknown> {
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
    if (shape.opacity !== undefined && shape.opacity !== 1)
      node.opacity = shape.opacity;

    // Fills
    if (shape.fills?.length) {
      node.fills = shape.fills.map((f) => ({
        type: f.fillColorGradient
          ? `GRADIENT_${f.fillColorGradient.type.toUpperCase()}`
          : "SOLID",
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
      node.effects = shape.shadow
        .filter((s) => !s.hidden)
        .map((s) => ({
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
            .flatMap((p: any) => p.children.map((r: any) => r.text))
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
        mode:
          lp.layout === "flex"
            ? lp.layoutFlexDir === "column" ||
              lp.layoutFlexDir === "column-reverse"
              ? "VERTICAL"
              : "HORIZONTAL"
            : lp.layout === "grid"
              ? "GRID"
              : "NONE",
        gap: lp.layoutGap,
        paddingTop: lp.layoutPaddingTop,
        paddingRight: lp.layoutPaddingRight,
        paddingBottom: lp.layoutPaddingBottom,
        paddingLeft: lp.layoutPaddingLeft,
      };
    }

    // Image
    if (shape.type === "image" && shape.imageMetadata) {
      node.fills = [
        { type: "IMAGE", imageRef: shape.imageMetadata.url || shape.id },
      ];
    }

    // Scroll / Clip
    if (shape.showContent === false || shape.scrollConfig) {
      const sc = shape.scrollConfig;
      node.clipContent = shape.showContent === false;
      if (sc) {
        node.overflowBehavior = sc.behavior || "none";
        if (sc.fixedElements?.length && shape.shapes?.length) {
          const fixedSet = new Set(sc.fixedElements);
          for (const childId of shape.shapes) {
            const childShape = objects[childId];
            if (childShape && fixedSet.has(childId)) {
              (childShape as unknown as Record<string, unknown>).__fixedWhenScrolling = true;
            }
          }
        }
      }
    }
    if ((shape as unknown as Record<string, unknown>).__fixedWhenScrolling) {
      node.fixedWhenScrolling = true;
    }

    // Children
    if (shape.shapes?.length) {
      const kids = shape.shapes
        .map((id: string) => objects[id])
        .filter((s: any): s is PenpotShape => !!s && !s.hidden);
      if (kids.length > 0) {
        node.children = kids.map((k: PenpotShape) =>
          shapeToNode(k, shape.x, shape.y)
        );
      }
    }

    return node;
  }

  // Get top-level frames
  const topFrames = root.shapes
    .map((id: string) => objects[id])
    .filter(
      (s: any): s is PenpotShape => !!s && s.type === "frame" && !s.hidden
    );

  // Top-level frames get x=0, y=0 — they ARE the viewport
  const nodes = topFrames.map((f: PenpotShape) => shapeToNode(f, f.x, f.y));

  // Reference frame
  const maxW = Math.max(...topFrames.map((f: PenpotShape) => f.width));
  const maxH = Math.max(...topFrames.map((f: PenpotShape) => f.height));
  const firstFrame = topFrames[0];
  const referenceFrame = firstFrame
    ? { id: firstFrame.id, x: 0, y: 0, width: r(maxW), height: r(maxH) }
    : undefined;

  // Collect interactions
  const interactions: Record<string, unknown>[] = [];
  for (const shape of Object.values(objects) as PenpotShape[]) {
    if (shape.interactions?.length) {
      for (const ix of shape.interactions) {
        interactions.push({
          sourceId: shape.id,
          trigger: mapInteractionTrigger(ix.eventType),
          action: mapInteractionAction(ix.actionType),
          targetId:
            ix.actionType === "scroll-to" ? ix.scrollTargetId : ix.destination,
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

  return { nodes, referenceFrame, interactions };
}

// ── Helpers ───────────────────────────────────────────────────

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
    "key-down": "ON_CLICK",
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
