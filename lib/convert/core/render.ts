// ═══════════════════════════════════════════════════════════════
// Render Engine — Transforms DrawableNode[] → JSX/HTML/Framework code
// ═══════════════════════════════════════════════════════════════

import type { DrawableNode, ImageManifest, ConversionOptions, Interaction } from "../types";
import { cssFromDrawable, cssToReactStyle, type CSSProperties } from "./styles";
import { detectHoverInteraction } from "./transitions";

// ═══════════════════════════════════════════════════════════════
// JSX Renderer (React / Next.js)
// ═══════════════════════════════════════════════════════════════

export interface RenderOptions {
  indent?: number;
  useTypescript?: boolean;
  includeDataAttributes?: boolean;
  componentPrefix?: string;
  manifest?: ImageManifest;
  /** Interactions array for wiring up event handlers */
  interactions?: Interaction[];
  /** Function name used for navigate actions (e.g., "setActiveFrame") */
  navigateHandler?: string;
  /** Function name used for opening overlays (e.g., "openOverlay") */
  overlayHandler?: string;
  /** Function name used for closing the topmost overlay */
  closeOverlayHandler?: string;
  /** Function name used for replacing the topmost overlay */
  swapOverlayHandler?: string;
}

/**
 * Renders a drawable tree to JSX string
 */
export function renderJSX(
  nodes: DrawableNode[],
  options: RenderOptions = {}
): string {
  const {
    indent = 6,
    useTypescript = true,
    includeDataAttributes = true,
    componentPrefix = "",
    manifest,
  } = options;

  return nodes.map((node) => renderJSXNode(node, indent, options)).join("\n");
}

function renderJSXNode(
  node: DrawableNode,
  indent: number,
  options: RenderOptions
): string {
  const spaces = " ".repeat(indent);
  const { includeDataAttributes = true, manifest, interactions, navigateHandler, overlayHandler, closeOverlayHandler, swapOverlayHandler } = options;

  const style = cssFromDrawable(node);
  const styleStr = cssToReactStyle(style, indent);

  // Data attributes
  let hoverAttr = "";
  if (interactions?.length) {
    const hover = detectHoverInteraction(node.id, interactions);
    if (hover) hoverAttr = ` ${hover}`;
  }

  const dataAttrs = includeDataAttributes
    ? ` data-name="${node.name}" data-id="${node.id}" id="${node.id}"${hoverAttr}`
    : ` id="${node.id}"${hoverAttr}`;

  // Build interaction handler (onClick, onMouseEnter, etc.)
  let eventHandler = "";
  if (interactions?.length) {
    const nodeInteractions = interactions.filter((i) => i.sourceId === node.id);
    for (const ix of nodeInteractions) {
      // NAVIGATE — page routing
      if (ix.action === "NAVIGATE" && ix.targetId && navigateHandler) {
        if (ix.trigger === "ON_CLICK" || ix.trigger === "ON_PRESS") {
          eventHandler += ` onClick={() => ${navigateHandler}("${ix.targetId}")}`;
          if (!style.cursor) style.cursor = "pointer";
        } else if (ix.trigger === "ON_HOVER" || ix.trigger === "MOUSE_ENTER") {
          eventHandler += ` onMouseEnter={() => ${navigateHandler}("${ix.targetId}")}`;
        }
      }

      // OPEN_OVERLAY — push overlay onto stack
      if (ix.action === "OPEN_OVERLAY" && ix.targetId && overlayHandler) {
        if (ix.trigger === "ON_CLICK" || ix.trigger === "ON_PRESS") {
          eventHandler += ` onClick={() => ${overlayHandler}("${ix.targetId}")}`;
          if (!style.cursor) style.cursor = "pointer";
        } else if (ix.trigger === "ON_HOVER" || ix.trigger === "MOUSE_ENTER") {
          eventHandler += ` onMouseEnter={() => ${overlayHandler}("${ix.targetId}")}`;
        }
      }

      // CLOSE_OVERLAY — pop topmost overlay
      if (ix.action === "CLOSE_OVERLAY" && closeOverlayHandler) {
        if (ix.trigger === "ON_CLICK" || ix.trigger === "ON_PRESS") {
          eventHandler += ` onClick={() => ${closeOverlayHandler}()}`;
          if (!style.cursor) style.cursor = "pointer";
        }
      }

      // SWAP_OVERLAY — replace topmost overlay
      if (ix.action === "SWAP_OVERLAY" && ix.targetId && swapOverlayHandler) {
        if (ix.trigger === "ON_CLICK" || ix.trigger === "ON_PRESS") {
          eventHandler += ` onClick={() => ${swapOverlayHandler}("${ix.targetId}")}`;
          if (!style.cursor) style.cursor = "pointer";
        }
      }

      // SCROLL_TO — scroll an element into view
      if (ix.action === "SCROLL_TO" && ix.targetId) {
        if (ix.trigger === "ON_CLICK" || ix.trigger === "ON_PRESS") {
          eventHandler += ` onClick={() => document.getElementById("${ix.targetId}")?.scrollIntoView({ behavior: "smooth", block: "start" })}`;
          if (!style.cursor) style.cursor = "pointer";
        }
      }

      // BACK — browser back navigation
      if (ix.action === "BACK") {
        if (ix.trigger === "ON_CLICK" || ix.trigger === "ON_PRESS") {
          eventHandler += ` onClick={() => window.history.back()}`;
          if (!style.cursor) style.cursor = "pointer";
        }
      }

      // OPEN_URL — external link
      if (ix.action === "OPEN_URL" && ix.destinationUrl) {
        if (ix.trigger === "ON_CLICK" || ix.trigger === "ON_PRESS") {
          eventHandler += ` onClick={() => window.open("${ix.destinationUrl}", "_blank")}`;
          if (!style.cursor) style.cursor = "pointer";
        }
      }
    }
  }

  // Handle different node types
  if (node.type === "TEXT") {
    return renderTextNode(node, style, indent, includeDataAttributes, eventHandler);
  }

  if (node.type === "IMAGE" || node.fill?.type === "IMAGE") {
    return renderImageNode(node, style, indent, includeDataAttributes, manifest, eventHandler);
  }

  // Regenerate styleStr after potential cursor addition
  const finalStyleStr = cssToReactStyle(style, indent);

  // Container/frame with children
  if (node.children?.length) {
    const isScrollContainer =
      node.ux?.scrollX || node.ux?.scrollY ||
      (node.scroll?.overflowBehavior && node.scroll.overflowBehavior !== "none");

    const scrollX = node.ux?.scrollX ||
      node.scroll?.overflowBehavior === "horizontal" ||
      node.scroll?.overflowBehavior === "both";
    const scrollY = node.ux?.scrollY ||
      node.scroll?.overflowBehavior === "vertical" ||
      node.scroll?.overflowBehavior === "both";

    // Separate fixed (sticky) children from scrollable children
    const fixedChildren = isScrollContainer
      ? node.children.filter((c) => c.scroll?.fixedWhenScrolling)
      : [];
    const scrollableChildren = isScrollContainer && fixedChildren.length > 0
      ? node.children.filter((c) => !c.scroll?.fixedWhenScrolling)
      : node.children;

    const childContent = scrollableChildren
      .map((child) => renderJSXNode(child, indent + (isScrollContainer ? 4 : 2), options))
      .join("\n");

    // For scroll containers, wrap children in a content div with the actual
    // content dimensions so the parent's overflow CSS creates a scrollable area.
    // Without this wrapper, absolutely-positioned children don't expand the
    // parent's scrollable region.
    if (isScrollContainer) {
      const contentW = Math.ceil(Math.max(...scrollableChildren.map((c) => c.x + c.w)));
      const contentH = Math.ceil(Math.max(...scrollableChildren.map((c) => c.y + c.h)));

      const innerWidth = scrollX ? contentW : Math.round(node.w);
      const innerHeight = scrollY ? contentH : Math.round(node.h);
      const innerStyleStr = cssToReactStyle({
        position: "relative",
        width: innerWidth,
        height: innerHeight,
        minWidth: scrollX ? innerWidth : undefined,
        minHeight: scrollY ? innerHeight : undefined,
      }, indent + 2);

      const fixedContent = fixedChildren.length > 0
        ? "\n" + fixedChildren.map((child) => renderJSXNode(child, indent + 2, options)).join("\n")
        : "";

      // Add data-scroll attribute so CSS scrollbar-hiding rules apply
      let scrollAttr = "";
      if (scrollX && scrollY) scrollAttr = ` data-scroll-both`;
      else if (scrollX) scrollAttr = ` data-scroll-x`;
      else if (scrollY) scrollAttr = ` data-scroll-y`;

      return `${spaces}<div style={${finalStyleStr}}${dataAttrs}${eventHandler}${scrollAttr}>
${spaces}  <div style={${innerStyleStr}}>
${childContent}
${spaces}  </div>${fixedContent}
${spaces}</div>`;
    }

    return `${spaces}<div style={${finalStyleStr}}${dataAttrs}${eventHandler}>
${childContent}
${spaces}</div>`;
  }

  // Simple shape
  return `${spaces}<div style={${finalStyleStr}}${dataAttrs}${eventHandler} />`;
}

function renderTextNode(
  node: DrawableNode,
  style: CSSProperties,
  indent: number,
  includeDataAttrs: boolean,
  eventHandler: string
): string {
  const spaces = " ".repeat(indent);
  const styleStr = cssToReactStyle(style, indent);
  const dataAttrs = includeDataAttrs
    ? ` data-name="${node.name}" data-id="${node.id}"`
    : "";
  const text = node.text?.characters ?? "";

  return `${spaces}<div style={${styleStr}}${dataAttrs}${eventHandler}>{${JSON.stringify(text)}}</div>`;
}

function renderImageNode(
  node: DrawableNode,
  style: CSSProperties,
  indent: number,
  includeDataAttrs: boolean,
  manifest?: ImageManifest,
  eventHandler?: string
): string {
  const spaces = " ".repeat(indent);
  const dataAttrs = includeDataAttrs
    ? ` data-name="${node.name}" data-id="${node.id}"`
    : "";
  const handler = eventHandler || "";

  // Get image source
  let src = node.fill?.imageRef ?? "";
  if (manifest && node.fill?.imageRef) {
    src = manifest.images.get(node.fill.imageRef) ?? src;
  }

  // Create img-specific style (remove background styles)
  const imgStyle: CSSProperties = {
    position: style.position,
    left: style.left,
    top: style.top,
    width: style.width,
    height: style.height,
    objectFit: node.fill?.imageFit === "cover" ? "cover" :
               node.fill?.imageFit === "contain" ? "contain" : "cover",
    borderRadius: style.borderRadius,
  };

  const styleStr = cssToReactStyle(imgStyle, indent);

  if (!src) {
    return `${spaces}<div style={${styleStr}}${dataAttrs}${handler} data-img-missing />`;
  }

  return `${spaces}<img src="${src}" alt="${node.name}" style={${styleStr}}${dataAttrs}${handler} />`;
}

// ═══════════════════════════════════════════════════════════════
// HTML Renderer
// ═══════════════════════════════════════════════════════════════

/**
 * Renders a drawable tree to plain HTML
 */
export function renderHTML(
  nodes: DrawableNode[],
  options: RenderOptions = {}
): string {
  const { indent = 2, manifest } = options;
  return nodes.map((node) => renderHTMLNode(node, indent, manifest)).join("\n");
}

function renderHTMLNode(
  node: DrawableNode,
  indent: number,
  manifest?: ImageManifest
): string {
  const spaces = " ".repeat(indent);
  const style = cssFromDrawable(node);
  const styleStr = cssToInlineStyle(style);

  // Text node
  if (node.type === "TEXT") {
    const text = node.text?.characters ?? "";
    return `${spaces}<div style="${styleStr}" data-name="${node.name}">${escapeHTML(text)}</div>`;
  }

  // Image node
  if (node.type === "IMAGE" || node.fill?.type === "IMAGE") {
    let src = node.fill?.imageRef ?? "";
    if (manifest && node.fill?.imageRef) {
      src = manifest.images.get(node.fill.imageRef) ?? src;
    }
    const imgStyle: CSSProperties = {
      ...style,
      backgroundImage: undefined,
      backgroundColor: undefined,
    };
    const imgStyleStr = cssToInlineStyle(imgStyle);

    if (src) {
      return `${spaces}<img src="${src}" alt="${node.name}" style="${imgStyleStr}" data-name="${node.name}" />`;
    }
    return `${spaces}<div style="${styleStr}" data-name="${node.name}" data-img-missing></div>`;
  }

  // Container with children
  if (node.children?.length) {
    const childContent = node.children
      .map((child) => renderHTMLNode(child, indent + 2, manifest))
      .join("\n");

    return `${spaces}<div style="${styleStr}" data-name="${node.name}">
${childContent}
${spaces}</div>`;
  }

  // Simple element
  return `${spaces}<div style="${styleStr}" data-name="${node.name}"></div>`;
}

function cssToInlineStyle(css: CSSProperties): string {
  return Object.entries(css)
    .filter(([_, v]) => v !== undefined)
    .map(([k, v]) => {
      const prop = k.replace(/([A-Z])/g, "-$1").toLowerCase();
      const val = typeof v === "number" && !isUnitlessProperty(k) ? `${v}px` : v;
      return `${prop}: ${val}`;
    })
    .join("; ");
}

function isUnitlessProperty(prop: string): boolean {
  const unitless = ["opacity", "zIndex", "fontWeight", "flexGrow", "flexShrink", "order"];
  return unitless.includes(prop);
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ═══════════════════════════════════════════════════════════════
// Component Extraction
// ═══════════════════════════════════════════════════════════════

export interface ExtractedComponent {
  name: string;
  node: DrawableNode;
  code: string;
  instances: number;
}

/**
 * Identifies repeated patterns that could be extracted as components
 */
export function extractComponents(
  nodes: DrawableNode[],
  minInstances = 2
): ExtractedComponent[] {
  // Build signature map
  const signatures = new Map<string, DrawableNode[]>();

  function traverse(node: DrawableNode) {
    const sig = generateNodeSignature(node);
    const existing = signatures.get(sig) || [];
    existing.push(node);
    signatures.set(sig, existing);

    node.children?.forEach(traverse);
  }

  nodes.forEach(traverse);

  // Extract components with multiple instances
  const components: ExtractedComponent[] = [];

  for (const [_, matchingNodes] of signatures) {
    if (matchingNodes.length >= minInstances) {
      const representative = matchingNodes[0];
      if (isExtractableAsComponent(representative)) {
        components.push({
          name: generateComponentName(representative.name),
          node: representative,
          code: "", // Will be generated by framework builder
          instances: matchingNodes.length,
        });
      }
    }
  }

  return components;
}

/**
 * Generates a signature for node comparison
 */
function generateNodeSignature(node: DrawableNode): string {
  // Create a structural signature (ignoring position and specific text)
  const parts = [
    node.type,
    Math.round(node.w),
    Math.round(node.h),
    node.fill?.type,
    node.corners?.uniform,
    node.children?.length ?? 0,
    node.children?.map((c) => c.type).join(","),
  ];

  return parts.filter(Boolean).join("|");
}

/**
 * Determines if a node should be extracted as a component
 */
function isExtractableAsComponent(node: DrawableNode): boolean {
  // Must have children or be a non-trivial element
  if (!node.children?.length && node.type === "RECTANGLE") {
    return false;
  }

  // Should have a meaningful structure
  if (node.children && node.children.length < 2) {
    return false;
  }

  return true;
}

/**
 * Generates a valid component name
 */
function generateComponentName(name: string): string {
  // PascalCase and sanitize
  let componentName = name
    .split(/[\s-_]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");

  // Remove non-alphanumeric
  componentName = componentName.replace(/[^a-zA-Z0-9]/g, "");

  // Ensure starts with letter
  if (/^\d/.test(componentName)) {
    componentName = "Component" + componentName;
  }

  return componentName || "Component";
}

// ═══════════════════════════════════════════════════════════════
// Responsive Stage Wrapper
// ═══════════════════════════════════════════════════════════════

/**
 * Generates a responsive wrapper component
 */
export function generateResponsiveStage(
  refWidth: number,
  refHeight: number,
  framework: "react" | "vue" | "svelte" = "react"
): string {
  if (framework === "react") {
    return `import { useRef, useState, useEffect } from "react";

interface ResponsiveStageProps {
  refW: number;
  refH: number;
  children: React.ReactNode;
}

export function ResponsiveStage({ refW, refH, children }: ResponsiveStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      const scaleX = width / refW;
      const scaleY = height / refH;
      setScale(Math.min(scaleX, scaleY, 1));
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [refW, refH]);

  return (
    <div ref={containerRef} className="responsive-stage-container">
      <div
        className="responsive-stage-content"
        style={{
          width: refW,
          height: refH,
          transform: \`scale(\${scale})\`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}`;
  }

  if (framework === "vue") {
    return `<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";

const props = defineProps<{
  refW: number;
  refH: number;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const scale = ref(1);

let observer: ResizeObserver | null = null;

onMounted(() => {
  if (!containerRef.value) return;

  observer = new ResizeObserver((entries) => {
    const { width, height } = entries[0].contentRect;
    const scaleX = width / props.refW;
    const scaleY = height / props.refH;
    scale.value = Math.min(scaleX, scaleY, 1);
  });

  observer.observe(containerRef.value);
});

onUnmounted(() => observer?.disconnect());

const stageStyle = computed(() => ({
  width: props.refW + "px",
  height: props.refH + "px",
  transform: \`scale(\${scale.value})\`,
  transformOrigin: "top left",
}));
</script>

<template>
  <div ref="containerRef" class="responsive-stage-container">
    <div class="responsive-stage-content" :style="stageStyle">
      <slot />
    </div>
  </div>
</template>`;
  }

  return "";
}

// ═══════════════════════════════════════════════════════════════
// Code Formatting Utilities
// ═══════════════════════════════════════════════════════════════

/**
 * Formats generated code with consistent indentation
 */
export function formatCode(code: string, indentSize = 2): string {
  const lines = code.split("\n");
  let indent = 0;
  const formatted: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Decrease indent for closing braces
    if (trimmed.startsWith("}") || trimmed.startsWith("</") || trimmed.startsWith(")")) {
      indent = Math.max(0, indent - indentSize);
    }

    formatted.push(" ".repeat(indent) + trimmed);

    // Increase indent for opening braces
    if (
      (trimmed.endsWith("{") || trimmed.endsWith("(") || trimmed.match(/<[^/][^>]*[^/]>$/)) &&
      !trimmed.includes("}")
    ) {
      indent += indentSize;
    }
  }

  return formatted.join("\n");
}
