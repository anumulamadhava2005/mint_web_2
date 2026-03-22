// ═══════════════════════════════════════════════════════════════
// Config Generator — Converts Penpot canvas state → Mobile Config
//
// Walks the shape tree per page and produces a flat, mobile-friendly
// JSON structure that a runtime renderer can interpret.
// ═══════════════════════════════════════════════════════════════

import type { PenpotFile, PenpotShape, UUID, Page, Flow } from "./penpot/types";
import { ROOT_FRAME_ID } from "./penpot/types";
import type {
  MobileConfig,
  MobileScreen,
  MobileComponent,
  MobileComponentType,
  MobileStyle,
  MobileAction,
  MobileFlow,
  MobileTheme,
  TextProps,
  ButtonProps,
  ImageProps,
} from "./mobileConfig";

// ── Main entry point ──────────────────────────────────────────

export function generateMobileConfig(
  file: PenpotFile,
  projectId: string,
  version: number
): MobileConfig {
  const screens: MobileScreen[] = [];
  const flows: MobileFlow[] = [];

  // Each page becomes a set of screens
  for (const pageId of file.pages) {
    const page = file.pagesIndex[pageId];
    if (!page) continue;

    const root = page.objects[ROOT_FRAME_ID];
    if (!root) continue;

    // Top-level frames become screens; loose shapes go into a default screen
    const topLevelFrames: PenpotShape[] = [];
    const looseShapes: PenpotShape[] = [];

    for (const childId of root.shapes || []) {
      const shape = page.objects[childId];
      if (!shape) continue;
      if (shape.type === "frame") {
        topLevelFrames.push(shape);
      } else {
        looseShapes.push(shape);
      }
    }

    // Convert frames → screens
    for (const frame of topLevelFrames) {
      screens.push(frameToScreen(frame, page.objects));
    }

    // Loose shapes → a default "canvas" screen
    if (looseShapes.length > 0) {
      const components = looseShapes
        .map((s) => shapeToComponent(s, page.objects))
        .filter(Boolean) as MobileComponent[];

      screens.push({
        id: `page-${pageId}`,
        name: page.name || "Canvas",
        width: 375,
        height: 812,
        backgroundColor: "#FFFFFF",
        components,
      });
    }

    // Convert prototype flows
    for (const flow of page.flows || []) {
      flows.push(flowToMobileFlow(flow));
    }
  }

  // Build theme from library
  const theme = extractTheme(file);

  return {
    projectId,
    version,
    screens,
    flows,
    theme,
    generatedAt: new Date().toISOString(),
  };
}

// ── Frame → Screen ────────────────────────────────────────────

function frameToScreen(
  frame: PenpotShape,
  objects: Record<UUID, PenpotShape>
): MobileScreen {
  const bgFill = frame.fills?.[0];
  const bgColor = bgFill?.fillColor || "#FFFFFF";

  const components: MobileComponent[] = [];
  for (const childId of frame.shapes || []) {
    const child = objects[childId];
    if (!child || child.hidden) continue;
    const comp = shapeToComponent(child, objects);
    if (comp) components.push(comp);
  }

  return {
    id: frame.id,
    name: frame.name || "Screen",
    width: frame.width,
    height: frame.height,
    backgroundColor: bgColor,
    components,
  };
}

// ── Shape → Component (recursive) ─────────────────────────────

function shapeToComponent(
  shape: PenpotShape,
  objects: Record<UUID, PenpotShape>
): MobileComponent | null {
  if (shape.hidden) return null;

  const componentType = resolveComponentType(shape);
  const style = extractStyle(shape);
  const action = extractAction(shape);

  // Recursively convert children
  let children: MobileComponent[] | undefined;
  if (shape.shapes && shape.shapes.length > 0) {
    children = [];
    for (const childId of shape.shapes) {
      const child = objects[childId];
      if (!child || child.hidden) continue;
      const comp = shapeToComponent(child, objects);
      if (comp) children.push(comp);
    }
    if (children.length === 0) children = undefined;
  }

  // Build props based on type
  const props = extractProps(shape, componentType);

  // If shape has a navigate interaction, override type to Button
  const finalType = action?.type === "navigate" && componentType !== "Image"
    ? "Button"
    : componentType;

  // Adjust props if we promoted to Button
  const finalProps = finalType === "Button" && componentType !== "Button"
    ? buttonPropsFromShape(shape, props)
    : props;

  return {
    id: shape.id,
    type: finalType,
    name: shape.name || shape.type,
    props: finalProps,
    style,
    children,
    action: action || undefined,
  };
}

// ── Resolve component type from shape type ────────────────────

function resolveComponentType(shape: PenpotShape): MobileComponentType {
  switch (shape.type) {
    case "text":
      return "Text";
    case "image":
      return "Image";
    case "circle":
      return "Ellipse";
    case "frame":
    case "group":
    case "bool":
      return "Container";
    case "rect":
      return "Container";
    case "path":
      return "Container"; // SVG paths rendered as decorative containers
    case "svg-raw":
      return "Container";
    default:
      return "Container";
  }
}

// ── Extract style from shape ──────────────────────────────────

function extractStyle(shape: PenpotShape): MobileStyle {
  const style: MobileStyle = {
    x: shape.x,
    y: shape.y,
    width: shape.width,
    height: shape.height,
  };

  if (shape.rotation) style.rotation = shape.rotation;
  if (shape.opacity !== undefined && shape.opacity !== 1) style.opacity = shape.opacity;

  // Background from fills (first solid fill)
  const fill = shape.fills?.[0];
  if (fill?.fillColor && shape.type !== "text") {
    style.backgroundColor = fill.fillColor;
    if (fill.fillOpacity !== undefined && fill.fillOpacity < 1) {
      style.backgroundColor = hexToRgba(fill.fillColor, fill.fillOpacity);
    }
  }

  // Gradients
  if (fill?.fillColorGradient) {
    const g = fill.fillColorGradient;
    style.backgroundGradient = {
      type: g.type,
      colors: g.stops.map((s) => hexToRgba(s.color, s.opacity)),
      stops: g.stops.map((s) => s.offset),
    };
  }

  // Border radius
  if (shape.rx) style.borderRadius = shape.rx;

  // Stroke → border
  const stroke = shape.strokes?.[0];
  if (stroke?.strokeColor && stroke?.strokeWidth) {
    style.borderColor = stroke.strokeColor;
    style.borderWidth = stroke.strokeWidth;
  }

  // Clip
  if (shape.type === "frame" && shape.showContent === false) {
    style.overflow = "hidden";
  }

  // Shadows
  if (shape.shadow && shape.shadow.length > 0) {
    style.shadow = shape.shadow
      .filter((s) => !s.hidden)
      .map((s) => ({
        color: hexToRgba(s.color, s.opacity),
        offsetX: s.offsetX,
        offsetY: s.offsetY,
        blur: s.blur,
        spread: s.spread,
        type: s.type === "inner-shadow" ? ("inner" as const) : ("drop" as const),
      }));
  }

  // Layout props → flex properties
  const lp = shape.layoutProps;
  if (lp?.layout === "flex") {
    const dirMap: Record<string, MobileStyle["flexDirection"]> = {
      row: "row",
      column: "column",
      "row-reverse": "row-reverse",
      "column-reverse": "column-reverse",
    };
    style.flexDirection = dirMap[lp.layoutFlexDir || "row"] || "row";

    const justifyMap: Record<string, MobileStyle["justifyContent"]> = {
      start: "flex-start",
      center: "center",
      end: "flex-end",
      "space-between": "space-between",
      "space-around": "space-around",
      "space-evenly": "space-evenly",
    };
    style.justifyContent = justifyMap[lp.layoutJustifyContent || "start"] || "flex-start";

    const alignMap: Record<string, MobileStyle["alignItems"]> = {
      start: "flex-start",
      center: "center",
      end: "flex-end",
      stretch: "stretch",
    };
    style.alignItems = alignMap[lp.layoutAlignItems || "start"] || "flex-start";

    style.gap = lp.layoutGap || 0;
    style.flexWrap = lp.layoutWrapType || "nowrap";

    if (
      lp.layoutPaddingTop ||
      lp.layoutPaddingRight ||
      lp.layoutPaddingBottom ||
      lp.layoutPaddingLeft
    ) {
      style.padding = {
        top: lp.layoutPaddingTop || 0,
        right: lp.layoutPaddingRight || 0,
        bottom: lp.layoutPaddingBottom || 0,
        left: lp.layoutPaddingLeft || 0,
      };
    }
  }

  return style;
}

// ── Extract props based on component type ─────────────────────

function extractProps(
  shape: PenpotShape,
  type: MobileComponentType
): Record<string, any> {
  switch (type) {
    case "Text":
      return extractTextProps(shape);
    case "Image":
      return extractImageProps(shape);
    default:
      return {};
  }
}

function extractTextProps(shape: PenpotShape): TextProps {
  const content = shape.content;
  if (!content || !content.children?.length) {
    return { value: "" };
  }

  // Flatten all text runs into a single value
  const paragraphs = content.children;
  const textParts: string[] = [];
  let firstRun: any = null;
  let textAlign: TextProps["textAlign"] = undefined;

  for (const para of paragraphs) {
    if (para.textAlign) textAlign = para.textAlign;
    for (const run of para.children || []) {
      textParts.push(run.text);
      if (!firstRun) firstRun = run;
    }
  }

  const props: TextProps = {
    value: textParts.join(""),
  };

  if (firstRun) {
    if (firstRun.fontSize) props.fontSize = firstRun.fontSize;
    if (firstRun.fontWeight) props.fontWeight = firstRun.fontWeight;
    if (firstRun.fontFamily) props.fontFamily = firstRun.fontFamily;
    if (firstRun.fontStyle) props.fontStyle = firstRun.fontStyle;
    if (firstRun.fill) props.color = firstRun.fill;
    if (firstRun.textDecoration) props.textDecoration = firstRun.textDecoration;
    if (firstRun.letterSpacing) props.letterSpacing = firstRun.letterSpacing;
    if (firstRun.lineHeight) props.lineHeight = firstRun.lineHeight;
  }

  // Use text fill color if available
  const textFill = shape.fills?.[0];
  if (textFill?.fillColor && !props.color) {
    props.color = textFill.fillColor;
  }

  if (textAlign) props.textAlign = textAlign;

  return props;
}

function extractImageProps(shape: PenpotShape): ImageProps {
  return {
    src: shape.imageMetadata?.url || "",
    alt: shape.name || "Image",
    objectFit: "cover",
  };
}

// ── Extract action from interactions ──────────────────────────

function extractAction(shape: PenpotShape): MobileAction | null {
  if (!shape.interactions || shape.interactions.length === 0) return null;

  // Use the first click/press interaction
  const interaction = shape.interactions.find(
    (i) => i.eventType === "click" || i.eventType === "mouse-press"
  );
  if (!interaction) return null;

  switch (interaction.actionType) {
    case "navigate":
      return {
        type: "navigate",
        target: interaction.destination || undefined,
        animation: interaction.animation
          ? {
              type: interaction.animation.animationType === "smart-animate"
                ? "dissolve"
                : (interaction.animation.animationType as any) || "instant",
              duration: interaction.animation.duration,
              direction: interaction.animation.direction,
            }
          : undefined,
      };
    case "open-url":
      return {
        type: "open-url",
        target: interaction.url,
      };
    case "prev-screen":
      return { type: "go-back" };
    case "scroll-to":
      return {
        type: "scroll-to",
        target: interaction.scrollTargetId,
      };
    default:
      return null;
  }
}

// ── Button props from a non-button shape that has a navigate action ──

function buttonPropsFromShape(
  shape: PenpotShape,
  originalProps: Record<string, any>
): ButtonProps {
  // If it was a text shape, use its text as the label
  if (shape.type === "text" && originalProps.value) {
    return {
      label: originalProps.value,
      fontSize: originalProps.fontSize,
      fontWeight: originalProps.fontWeight,
      fontFamily: originalProps.fontFamily,
      color: originalProps.color,
      backgroundColor: shape.fills?.[0]?.fillColor,
    };
  }

  return {
    label: shape.name || "Button",
    backgroundColor: shape.fills?.[0]?.fillColor,
    color: "#FFFFFF",
  };
}

// ── Flow conversion ───────────────────────────────────────────

function flowToMobileFlow(flow: Flow): MobileFlow {
  return {
    id: flow.id,
    name: flow.name,
    startScreenId: flow.startingFrame,
  };
}

// ── Theme extraction ──────────────────────────────────────────

function extractTheme(file: PenpotFile): MobileTheme {
  const colors: Record<string, string> = {};
  const fontSet = new Set<string>();

  // Library colors
  if (file.colors) {
    for (const [id, color] of Object.entries(file.colors)) {
      colors[color.name || id] = color.color;
    }
  }

  // Collect fonts from typographies
  if (file.typographies) {
    for (const typo of Object.values(file.typographies)) {
      if (typo.fontFamily) fontSet.add(typo.fontFamily);
    }
  }

  // Also scan shapes for fonts used
  for (const pageId of file.pages) {
    const page = file.pagesIndex[pageId];
    if (!page) continue;
    for (const shape of Object.values(page.objects)) {
      if (shape.type === "text" && shape.content) {
        for (const para of shape.content.children || []) {
          for (const run of para.children || []) {
            if (run.fontFamily) fontSet.add(run.fontFamily);
          }
        }
      }
    }
  }

  return {
    colors,
    fonts: [...fontSet],
  };
}

// ── Utility ───────────────────────────────────────────────────

function hexToRgba(hex: string, opacity: number): string {
  if (opacity >= 1) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
