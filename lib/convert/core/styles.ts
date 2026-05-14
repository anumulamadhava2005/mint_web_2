// ═══════════════════════════════════════════════════════════════
// Style Mapping — Converts DrawableNode properties → CSS
// Supports inline styles, Tailwind, and cross-platform mapping
// ═══════════════════════════════════════════════════════════════

import type {
  DrawableNode,
  Fill,
  Stroke,
  Effect,
  CornerRadius,
  LayoutProperties,
  TextStyle,
  GradientStop,
  ScrollViewProperties,
} from "../types";

// ── CSS Properties Type ───────────────────────────────────────

export interface CSSProperties {
  position?: string;
  left?: number | string;
  top?: number | string;
  right?: number | string;
  bottom?: number | string;
  width?: number | string;
  height?: number | string;
  minWidth?: number | string;
  maxWidth?: number | string;
  minHeight?: number | string;
  maxHeight?: number | string;
  boxSizing?: string;
  // Background
  background?: string;
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  backgroundRepeat?: string;
  // Border
  border?: string;
  borderWidth?: number | string;
  borderStyle?: string;
  borderColor?: string;
  borderRadius?: number | string;
  borderTopLeftRadius?: number | string;
  borderTopRightRadius?: number | string;
  borderBottomRightRadius?: number | string;
  borderBottomLeftRadius?: number | string;
  // Effects
  boxShadow?: string;
  filter?: string;
  backdropFilter?: string;
  opacity?: number;
  mixBlendMode?: string;
  // Text
  color?: string;
  fontSize?: number | string;
  fontFamily?: string;
  fontWeight?: number | string;
  lineHeight?: number | string;
  letterSpacing?: number | string;
  textAlign?: string;
  textDecoration?: string;
  textTransform?: string;
  whiteSpace?: string;
  overflow?: string;
  textOverflow?: string;
  // Layout
  display?: string;
  flexDirection?: string;
  flexWrap?: string;
  justifyContent?: string;
  alignItems?: string;
  alignContent?: string;
  gap?: number | string;
  rowGap?: number | string;
  columnGap?: number | string;
  flex?: string;
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: string;
  // Padding
  padding?: number | string;
  paddingTop?: number | string;
  paddingRight?: number | string;
  paddingBottom?: number | string;
  paddingLeft?: number | string;
  // Margin
  margin?: number | string;
  marginTop?: number | string;
  marginRight?: number | string;
  marginBottom?: number | string;
  marginLeft?: number | string;
  // Transform
  transform?: string;
  transformOrigin?: string;
  // Overflow
  overflowX?: string;
  overflowY?: string;
  scrollSnapType?: string;
  scrollSnapAlign?: string;
  WebkitOverflowScrolling?: string;
  // Pointer
  cursor?: string;
  pointerEvents?: string;
  // Z-index
  zIndex?: number;
  [key: string]: string | number | undefined;
}

// ═══════════════════════════════════════════════════════════════
// Main Style Generation
// ═══════════════════════════════════════════════════════════════

/** Round to 1 decimal place for clean CSS output */
function roundPx(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Generates CSS properties from a DrawableNode.
 * Uses local coordinates (x, y) for positioning within parent.
 */
export function cssFromDrawable(
  node: DrawableNode,
  options: StyleOptions = {}
): CSSProperties {
  const style: CSSProperties = {};

  // Position and size
  if (options.useAbsolutePosition) {
    style.position = "absolute";
    style.left = roundPx(node.ax);
    style.top = roundPx(node.ay);
  } else if (!options.omitPosition) {
    style.position = "absolute";
    style.left = roundPx(node.x);
    style.top = roundPx(node.y);
  }

  style.width = roundPx(node.w);
  style.height = roundPx(node.h);
  style.boxSizing = "border-box";

  // Background (skip for text nodes — their fill is the text color, not background)
  if (node.fill && node.type !== "TEXT") {
    Object.assign(style, cssFromFill(node.fill));
  }

  // Border
  if (node.stroke) {
    Object.assign(style, cssFromStroke(node.stroke));
  }

  // Border radius
  if (node.corners) {
    Object.assign(style, cssFromCorners(node.corners));
  }

  // Effects
  if (node.effects?.length) {
    Object.assign(style, cssFromEffects(node.effects));
  }

  // Opacity
  if (node.opacity !== undefined && node.opacity < 1) {
    style.opacity = node.opacity;
  }

  // Blend mode
  if (node.mixBlendMode) {
    style.mixBlendMode = node.mixBlendMode;
  }

  // Text styling
  if (node.type === "TEXT" && node.text) {
    Object.assign(style, cssFromText(node.text));
  }

  // Layout (auto-layout / flexbox)
  if (node.layout?.mode && node.layout.mode !== "NONE") {
    Object.assign(style, cssFromLayout(node.layout));
  }

  // UX enhancements
  if (node.ux) {
    Object.assign(style, cssFromUX(node.ux));
  }

  // Scroll / overflow properties (explicit design-tool settings)
  if (node.scroll) {
    Object.assign(style, cssFromScroll(node.scroll, node.ux));
  }

  // Transform
  if (node.transform?.rotation) {
    style.transform = `rotate(${node.transform.rotation}deg)`;
    style.transformOrigin = "center center";
  }

  return style;
}

export interface StyleOptions {
  useAbsolutePosition?: boolean;
  omitPosition?: boolean;
  omitSize?: boolean;
  pixelUnits?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// Component Style Generators
// ═══════════════════════════════════════════════════════════════

/**
 * Generate background styles from Fill
 */
export function cssFromFill(fill: Fill): CSSProperties {
  const style: CSSProperties = {};

  switch (fill.type) {
    case "SOLID":
      if (fill.color) {
        style.backgroundColor = fill.color;
        if (fill.opacity !== undefined && fill.opacity < 1) {
          style.backgroundColor = addAlphaToColor(fill.color, fill.opacity);
        }
      }
      break;

    case "GRADIENT_LINEAR":
    case "GRADIENT_RADIAL":
    case "GRADIENT_ANGULAR":
      style.backgroundImage = cssGradient(fill);
      break;

    case "IMAGE":
      if (fill.imageRef) {
        style.backgroundImage = `url("${fill.imageRef}")`;
        style.backgroundSize = fill.imageFit === "cover" ? "cover" :
                               fill.imageFit === "contain" ? "contain" : "100% 100%";
        style.backgroundPosition = "center";
        style.backgroundRepeat = fill.imageFit === "tile" ? "repeat" : "no-repeat";
      }
      break;
  }

  return style;
}

/**
 * Generate gradient CSS
 */
export function cssGradient(fill: Fill): string {
  if (!fill.gradientStops?.length) {
    return `linear-gradient(0deg, #000 0%, #fff 100%)`;
  }

  const stops = fill.gradientStops
    .sort((a, b) => a.position - b.position)
    .map((stop) => {
      const color = stop.opacity !== undefined
        ? addAlphaToColor(stop.color, stop.opacity)
        : stop.color;
      return `${color} ${Math.round(stop.position * 100)}%`;
    })
    .join(", ");

  const angle = fill.gradientAngle ?? 0;

  switch (fill.type) {
    case "GRADIENT_LINEAR":
      return `linear-gradient(${angle}deg, ${stops})`;
    case "GRADIENT_RADIAL":
      return `radial-gradient(circle, ${stops})`;
    case "GRADIENT_ANGULAR":
      return `conic-gradient(from ${angle}deg, ${stops})`;
    default:
      return `linear-gradient(${angle}deg, ${stops})`;
  }
}

/**
 * Generate border styles from Stroke
 */
export function cssFromStroke(stroke: Stroke): CSSProperties {
  const style: CSSProperties = {};

  if (!stroke.weight || stroke.weight <= 0) {
    return style;
  }

  style.borderWidth = stroke.weight;
  style.borderColor = stroke.color ?? "currentColor";
  style.borderStyle = stroke.dashPattern?.length ? "dashed" : "solid";

  return style;
}

/**
 * Generate border-radius from CornerRadius
 */
export function cssFromCorners(corners: CornerRadius): CSSProperties {
  const style: CSSProperties = {};

  if (corners.uniform !== undefined) {
    style.borderRadius = corners.uniform;
    return style;
  }

  // Individual corners
  if (corners.topLeft) style.borderTopLeftRadius = corners.topLeft;
  if (corners.topRight) style.borderTopRightRadius = corners.topRight;
  if (corners.bottomRight) style.borderBottomRightRadius = corners.bottomRight;
  if (corners.bottomLeft) style.borderBottomLeftRadius = corners.bottomLeft;

  return style;
}

/**
 * Generate shadow/filter styles from Effects
 */
export function cssFromEffects(effects: Effect[]): CSSProperties {
  const style: CSSProperties = {};

  const shadows: string[] = [];
  const filters: string[] = [];
  const backdropFilters: string[] = [];

  for (const effect of effects) {
    if (effect.boxShadow) {
      shadows.push(effect.boxShadow);
    }
    if (effect.filter) {
      filters.push(effect.filter);
    }
    if (effect.backdropFilter) {
      backdropFilters.push(effect.backdropFilter);
    }
  }

  if (shadows.length) {
    style.boxShadow = shadows.join(", ");
  }
  if (filters.length) {
    style.filter = filters.join(" ");
  }
  if (backdropFilters.length) {
    style.backdropFilter = backdropFilters.join(" ");
  }

  return style;
}

/**
 * Generate text styles from TextStyle
 */
export function cssFromText(text: TextStyle): CSSProperties {
  const style: CSSProperties = {};

  if (text.fontFamily) {
    // Strip any existing quotes around the font name to avoid double-quoting
    const clean = text.fontFamily.replace(/["']/g, "").trim();
    style.fontFamily = `${clean}, system-ui, sans-serif`;
  }
  if (text.fontSize) {
    style.fontSize = text.fontSize;
  }
  if (text.fontWeight) {
    style.fontWeight = text.fontWeight;
  }
  if (text.color) {
    style.color = text.color;
  }

  // Line height
  if (text.lineHeight !== undefined && text.lineHeight !== "AUTO") {
    if (text.lineHeightUnit === "PERCENT") {
      style.lineHeight = `${text.lineHeight}%`;
    } else {
      style.lineHeight = text.lineHeight;
    }
  }

  // Letter spacing
  if (text.letterSpacing) {
    if (text.letterSpacingUnit === "PERCENT") {
      style.letterSpacing = `${text.letterSpacing / 100}em`;
    } else {
      style.letterSpacing = text.letterSpacing;
    }
  }

  // Text alignment
  if (text.textAlign) {
    style.textAlign = text.textAlign.toLowerCase();
  }

  // Text decoration
  if (text.textDecoration && text.textDecoration !== "NONE") {
    style.textDecoration = text.textDecoration.toLowerCase();
  }

  // Text case
  if (text.textCase && text.textCase !== "ORIGINAL") {
    const caseMap: Record<string, string> = {
      UPPER: "uppercase",
      LOWER: "lowercase",
      TITLE: "capitalize",
    };
    style.textTransform = caseMap[text.textCase];
  }

  return style;
}

/**
 * Generate flexbox styles from LayoutProperties
 */
export function cssFromLayout(layout: LayoutProperties): CSSProperties {
  const style: CSSProperties = {};

  if (layout.mode === "HORIZONTAL" || layout.mode === "VERTICAL") {
    style.display = "flex";
    style.flexDirection = layout.direction === "ROW" ? "row" : "column";

    if (layout.wrap === "WRAP") {
      style.flexWrap = "wrap";
    }

    // Primary axis alignment
    if (layout.primaryAxisAlign) {
      const justifyMap: Record<string, string> = {
        MIN: "flex-start",
        CENTER: "center",
        MAX: "flex-end",
        SPACE_BETWEEN: "space-between",
        SPACE_AROUND: "space-around",
        SPACE_EVENLY: "space-evenly",
      };
      style.justifyContent = justifyMap[layout.primaryAxisAlign] ?? "flex-start";
    }

    // Counter axis alignment
    if (layout.counterAxisAlign) {
      const alignMap: Record<string, string> = {
        MIN: "flex-start",
        CENTER: "center",
        MAX: "flex-end",
        STRETCH: "stretch",
        BASELINE: "baseline",
      };
      style.alignItems = alignMap[layout.counterAxisAlign] ?? "stretch";
    }
  }

  // Gap
  if (layout.gap !== undefined) {
    style.gap = layout.gap;
  }

  // Padding
  if (layout.paddingTop) style.paddingTop = layout.paddingTop;
  if (layout.paddingRight) style.paddingRight = layout.paddingRight;
  if (layout.paddingBottom) style.paddingBottom = layout.paddingBottom;
  if (layout.paddingLeft) style.paddingLeft = layout.paddingLeft;

  return style;
}

/**
 * Generate UX enhancement styles
 */
export function cssFromUX(ux: import("../types").UXEnhancements): CSSProperties {
  const style: CSSProperties = {};

  if (ux.scrollX) {
    style.overflowX = "auto";
    style.WebkitOverflowScrolling = "touch";
    if (ux.snap) {
      style.scrollSnapType = "x mandatory";
    }
  }

  if (ux.scrollY) {
    style.overflowY = "auto";
    style.WebkitOverflowScrolling = "touch";
    if (ux.snap) {
      style.scrollSnapType = "y mandatory";
    }
  }

  if (ux.snap) {
    style.scrollSnapAlign = "center";
  }

  if (ux.elevate) {
    // Elevated card effect
    style.boxShadow = "0 20px 40px -10px rgba(0,0,0,0.3)";
    style.transform = "scale(1.05)";
    style.zIndex = 10;
  }

  if (ux.isClickable) {
    style.cursor = "pointer";
  }

  return style;
}

/**
 * Generate scroll/overflow CSS from ScrollViewProperties.
 * This handles explicit design-tool settings (clip content, overflow direction).
 * Called AFTER cssFromUX so it can refine or override auto-detected scroll.
 */
export function cssFromScroll(
  scroll: ScrollViewProperties,
  ux?: import("../types").UXEnhancements
): CSSProperties {
  const style: CSSProperties = {};

  // fixedWhenScrolling → position: sticky (stays in place during parent scroll)
  if (scroll.fixedWhenScrolling) {
    style.position = "sticky";
    style.top = 0;
    style.zIndex = 10;
  }

  // Explicit overflow behavior from design tool
  if (scroll.overflowBehavior) {
    switch (scroll.overflowBehavior) {
      case "none":
        // Clip only — no scrolling
        style.overflow = "hidden";
        style.overflowX = undefined;
        style.overflowY = undefined;
        break;
      case "vertical":
        style.overflowX = "hidden";
        style.overflowY = "auto";
        style.WebkitOverflowScrolling = "touch";
        break;
      case "horizontal":
        style.overflowX = "auto";
        style.overflowY = "hidden";
        style.WebkitOverflowScrolling = "touch";
        break;
      case "both":
        style.overflowX = "auto";
        style.overflowY = "auto";
        style.WebkitOverflowScrolling = "touch";
        break;
    }
  } else if (scroll.clipContent && !ux?.scrollX && !ux?.scrollY) {
    // clipContent without any scroll direction → overflow: hidden
    style.overflow = "hidden";
  }

  return style;
}

// ═══════════════════════════════════════════════════════════════
// Tailwind Class Generation
// ═══════════════════════════════════════════════════════════════

/**
 * Generates Tailwind CSS classes from a DrawableNode
 */
export function tailwindFromDrawable(node: DrawableNode): string[] {
  const classes: string[] = [];

  // Position
  classes.push("absolute");

  // Size - use arbitrary values for exact sizes
  if (node.w) classes.push(`w-[${node.w}px]`);
  if (node.h) classes.push(`h-[${node.h}px]`);

  // Background
  if (node.fill?.type === "SOLID" && node.fill.color) {
    classes.push(`bg-[${node.fill.color}]`);
  }

  // Border radius
  if (node.corners?.uniform) {
    const r = node.corners.uniform;
    if (r >= 9999) {
      classes.push("rounded-full");
    } else if (r >= 16) {
      classes.push("rounded-2xl");
    } else if (r >= 8) {
      classes.push("rounded-lg");
    } else if (r >= 4) {
      classes.push("rounded");
    }
  }

  // Opacity
  if (node.opacity !== undefined && node.opacity < 1) {
    classes.push(`opacity-${Math.round(node.opacity * 100)}`);
  }

  // UX
  if (node.ux?.scrollX) {
    classes.push("overflow-x-auto");
    if (node.ux.snap) {
      classes.push("snap-x", "snap-mandatory");
    }
  }

  if (node.ux?.isClickable) {
    classes.push("cursor-pointer");
  }

  return classes;
}

// ═══════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════

/**
 * Adds alpha channel to a color
 */
function addAlphaToColor(color: string, alpha: number): string {
  // Handle hex colors
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }

  // Handle rgb/rgba
  if (color.startsWith("rgb")) {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
    }
  }

  return color;
}

/**
 * Converts CSS properties object to inline style string
 */
export function cssToInlineString(css: CSSProperties): string {
  return Object.entries(css)
    .filter(([_, v]) => v !== undefined)
    .map(([k, v]) => {
      // Convert camelCase to kebab-case
      const prop = k.replace(/([A-Z])/g, "-$1").toLowerCase();
      // Add px to numeric values
      const val = typeof v === "number" ? `${v}px` : v;
      return `${prop}: ${val}`;
    })
    .join("; ");
}

/**
 * Converts CSS properties object to React style object string
 */
export function cssToReactStyle(css: CSSProperties, indent = 0): string {
  const spaces = " ".repeat(indent);
  const entries = Object.entries(css).filter(([_, v]) => v !== undefined);

  if (entries.length === 0) return "{}";

  const props = entries
    .map(([k, v]) => {
      const val = typeof v === "string" ? `"${v}"` : v;
      return `${spaces}  ${k}: ${val}`;
    })
    .join(",\n");

  return `{\n${props}\n${spaces}}`;
}
