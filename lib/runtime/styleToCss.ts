// ═══════════════════════════════════════════════════════════════
// styleToCss — StyleSchema → React.CSSProperties
//
// The renderer (SchemaRenderer) and the eventual SchemaCanvas both need
// to turn a component's declarative StyleSchema into real inline styles.
// Pure + framework-agnostic so it can be unit-tested and reused by the
// convert pipeline later. Returns an empty object for empty/undefined
// styles so callers can cheaply skip applying it.
// ═══════════════════════════════════════════════════════════════

import type { CSSProperties } from "react";
import type {
  StyleSchema,
  LayoutStyle,
  SpacingStyle,
  SizingStyle,
  BackgroundStyle,
  BorderStyle,
  TypographyStyle,
  EffectStyle,
} from "./schema";

const JUSTIFY: Record<NonNullable<LayoutStyle["justify"]>, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  between: "space-between",
  around: "space-around",
  evenly: "space-evenly",
};

const ALIGN: Record<NonNullable<LayoutStyle["align"]>, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
  baseline: "baseline",
};

/** number → "Npx"; string passed through (e.g. "100%", "auto"). */
function len(v: number | string | undefined): string | undefined {
  if (v == null) return undefined;
  return typeof v === "number" ? `${v}px` : v;
}

/** padding/margin: number → uniform; [t,r,b,l] → CSS shorthand. */
function box(v: number | [number, number, number, number] | undefined): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "number") return `${v}px`;
  return v.map((n) => `${n}px`).join(" ");
}

function applyLayout(l: LayoutStyle, out: CSSProperties): void {
  if (l.display) out.display = l.display;
  if (l.direction) out.flexDirection = l.direction;
  if (l.justify) out.justifyContent = JUSTIFY[l.justify];
  if (l.align) out.alignItems = ALIGN[l.align];
  if (l.wrap != null) out.flexWrap = l.wrap ? "wrap" : "nowrap";
  if (l.gap != null) out.gap = l.gap;
  if (l.position) out.position = l.position;
  if (l.top != null) out.top = l.top;
  if (l.right != null) out.right = l.right;
  if (l.bottom != null) out.bottom = l.bottom;
  if (l.left != null) out.left = l.left;
  if (l.zIndex != null) out.zIndex = l.zIndex;
}

function applySpacing(s: SpacingStyle, out: CSSProperties): void {
  const p = box(s.padding);
  const m = box(s.margin);
  if (p) out.padding = p;
  if (m) out.margin = m;
}

function applySizing(s: SizingStyle, out: CSSProperties): void {
  if (s.width != null) out.width = s.width;
  if (s.height != null) out.height = s.height;
  if (s.minWidth != null) out.minWidth = s.minWidth;
  if (s.minHeight != null) out.minHeight = s.minHeight;
  if (s.maxWidth != null) out.maxWidth = s.maxWidth;
  if (s.maxHeight != null) out.maxHeight = s.maxHeight;
  if (s.flex != null) out.flex = s.flex;
}

function applyBackground(b: BackgroundStyle, out: CSSProperties): void {
  if (b.gradient) {
    const { type, colors, angle } = b.gradient;
    out.backgroundImage =
      type === "radial"
        ? `radial-gradient(${colors.join(", ")})`
        : `linear-gradient(${angle ?? 180}deg, ${colors.join(", ")})`;
  } else if (b.image) {
    out.backgroundImage = `url(${b.image.uri})`;
    out.backgroundSize = b.image.fit === "contain" ? "contain" : b.image.fit === "fill" ? "100% 100%" : "cover";
    out.backgroundPosition = "center";
    out.backgroundRepeat = "no-repeat";
  }
  if (b.color) out.backgroundColor = b.color;
  if (b.opacity != null) out.opacity = b.opacity;
}

function applyBorder(b: BorderStyle, out: CSSProperties): void {
  if (b.width != null) {
    out.borderWidth = b.width;
    out.borderStyle = b.style ?? "solid";
    if (b.color) out.borderColor = b.color;
  }
  if (b.radius != null) {
    out.borderRadius = Array.isArray(b.radius) ? b.radius.map((n) => `${n}px`).join(" ") : b.radius;
  }
}

function applyTypography(t: TypographyStyle, out: CSSProperties): void {
  if (t.fontFamily) out.fontFamily = t.fontFamily;
  if (t.fontSize != null) out.fontSize = t.fontSize;
  if (t.fontWeight) out.fontWeight = t.fontWeight as CSSProperties["fontWeight"];
  if (t.fontStyle) out.fontStyle = t.fontStyle;
  if (t.color) out.color = t.color;
  if (t.lineHeight != null) out.lineHeight = t.lineHeight;
  if (t.letterSpacing != null) out.letterSpacing = t.letterSpacing;
  if (t.textAlign) out.textAlign = t.textAlign;
  if (t.textDecoration) out.textDecoration = t.textDecoration;
  if (t.textTransform) out.textTransform = t.textTransform;
}

function applyEffects(e: EffectStyle, out: CSSProperties): void {
  if (e.shadow?.length) {
    out.boxShadow = e.shadow
      .map((s) => `${s.x}px ${s.y}px ${s.blur}px ${s.spread ?? 0}px ${s.color}`)
      .join(", ");
  }
  if (e.blur != null) out.filter = `blur(${e.blur}px)`;
  if (e.overflow) out.overflow = e.overflow;
  if (e.transform) {
    const t = e.transform;
    const parts: string[] = [];
    if (t.translateX != null) parts.push(`translateX(${t.translateX}px)`);
    if (t.translateY != null) parts.push(`translateY(${t.translateY}px)`);
    if (t.rotate != null) parts.push(`rotate(${t.rotate}deg)`);
    if (t.scale != null) parts.push(`scale(${t.scale})`);
    if (parts.length) out.transform = parts.join(" ");
  }
  if (e.transition?.length) {
    out.transition = e.transition
      .map((tr) => `${tr.property} ${tr.duration}ms ${tr.easing ?? "ease"}`)
      .join(", ");
  }
}

/**
 * Convert a StyleSchema into React inline styles.
 * Returns {} for undefined/empty input. Responsive overrides are not applied
 * here (the renderer/preview decides the active breakpoint) — that's Phase 4.
 */
export function styleToCss(style?: StyleSchema): CSSProperties {
  const out: CSSProperties = {};
  if (!style) return out;
  if (style.layout) applyLayout(style.layout, out);
  if (style.spacing) applySpacing(style.spacing, out);
  if (style.sizing) applySizing(style.sizing, out);
  if (style.background) applyBackground(style.background, out);
  if (style.border) applyBorder(style.border, out);
  if (style.typography) applyTypography(style.typography, out);
  if (style.effects) applyEffects(style.effects, out);
  return out;
}

/** True when styleToCss would produce at least one declaration. */
export function hasStyle(style?: StyleSchema): boolean {
  if (!style) return false;
  return Object.keys(styleToCss(style)).length > 0;
}
