// ═══════════════════════════════════════════════════════════════
// Mobile Config Schema — Runtime UI configuration types
// The mobile app (or web preview) interprets these to render UI.
// ═══════════════════════════════════════════════════════════════

export type MobileComponentType =
  | "Text"
  | "Button"
  | "Image"
  | "Container"
  | "Input"
  | "Ellipse"
  | "Divider"
  | "ScrollView"
  | "Icon";

// ── Style shared by all components ────────────────────────────
export interface MobileStyle {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  backgroundColor?: string;
  backgroundGradient?: {
    type: "linear" | "radial";
    colors: string[];
    stops: number[];
  };
  borderRadius?: number;
  borderColor?: string;
  borderWidth?: number;
  overflow?: "visible" | "hidden" | "scroll";
  // Shadows
  shadow?: {
    color: string;
    offsetX: number;
    offsetY: number;
    blur: number;
    spread: number;
    type: "drop" | "inner";
  }[];
  // Flex layout (when Container is a layout)
  flexDirection?: "row" | "column" | "row-reverse" | "column-reverse";
  justifyContent?: "flex-start" | "center" | "flex-end" | "space-between" | "space-around" | "space-evenly";
  alignItems?: "flex-start" | "center" | "flex-end" | "stretch";
  gap?: number;
  padding?: { top: number; right: number; bottom: number; left: number };
  flexWrap?: "wrap" | "nowrap";
}

// ── Text-specific props ───────────────────────────────────────
export interface TextProps {
  value: string;
  fontSize?: number;
  fontWeight?: number;
  fontFamily?: string;
  fontStyle?: "normal" | "italic";
  color?: string;
  textAlign?: "left" | "center" | "right" | "justify";
  textDecoration?: "none" | "underline" | "line-through";
  letterSpacing?: number;
  lineHeight?: number;
}

// ── Button props ──────────────────────────────────────────────
export interface ButtonProps {
  label: string;
  fontSize?: number;
  fontWeight?: number;
  fontFamily?: string;
  color?: string;
  backgroundColor?: string;
}

// ── Image props ───────────────────────────────────────────────
export interface ImageProps {
  src: string;
  alt?: string;
  objectFit?: "cover" | "contain" | "fill" | "none";
}

// ── Component Action (navigation, URL, etc.) ──────────────────
export interface MobileAction {
  type: "navigate" | "open-url" | "go-back" | "scroll-to";
  target?: string;   // screen ID or URL
  animation?: {
    type: "dissolve" | "slide" | "push" | "instant";
    duration?: number;
    direction?: "left" | "right" | "up" | "down";
  };
}

// ── Mobile Component ──────────────────────────────────────────
export interface MobileComponent {
  id: string;
  type: MobileComponentType;
  name: string;
  props: TextProps | ButtonProps | ImageProps | Record<string, any>;
  style: MobileStyle;
  children?: MobileComponent[];
  action?: MobileAction;
}

// ── Screen ────────────────────────────────────────────────────
export interface MobileScreen {
  id: string;
  name: string;
  width: number;
  height: number;
  backgroundColor: string;
  components: MobileComponent[];
}

// ── Flow (entry point + navigation) ───────────────────────────
export interface MobileFlow {
  id: string;
  name: string;
  startScreenId: string;
}

// ── Theme ─────────────────────────────────────────────────────
export interface MobileTheme {
  colors: Record<string, string>;
  fonts: string[];
}

// ── Top-level config ──────────────────────────────────────────
export interface MobileConfig {
  projectId: string;
  version: number;
  screens: MobileScreen[];
  flows: MobileFlow[];
  theme: MobileTheme;
  generatedAt: string;
}
