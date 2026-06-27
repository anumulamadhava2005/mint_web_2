import type { ComponentSchema, ComponentType, StyleSchema } from "@/lib/runtime/schema";

export interface PaletteEntry {
  id: string;
  label: string;
  icon: string;
  type: ComponentType;
  w: number;
  h: number;
}

export interface PaletteCategory {
  label: string;
  entries: PaletteEntry[];
}

export const PALETTE_CATEGORIES: PaletteCategory[] = [
  {
    label: "Layout",
    entries: [
      { id: "view",      label: "Container",   icon: "⬜", type: "view",      w: 220, h: 130 },
      { id: "card",      label: "Card",         icon: "▭",  type: "card",      w: 260, h: 160 },
      { id: "form",      label: "Form",         icon: "⊞",  type: "form",      w: 320, h: 400 },
      { id: "scroll",    label: "Scroll View",  icon: "↕",  type: "scroll",    w: 320, h: 300 },
      { id: "modal",     label: "Modal",        icon: "⧉",  type: "modal",     w: 300, h: 360 },
      { id: "tabs",      label: "Tabs",         icon: "⊡",  type: "tabs",      w: 340, h: 44  },
      { id: "accordion", label: "Accordion",    icon: "≡",  type: "accordion", w: 320, h: 120 },
    ],
  },
  {
    label: "Inputs",
    entries: [
      { id: "input",       label: "Input",        icon: "▭",  type: "input",       w: 220, h: 42 },
      { id: "select",      label: "Select",       icon: "▾",  type: "select",      w: 220, h: 42 },
      { id: "searchInput", label: "Search",       icon: "⌕",  type: "searchInput", w: 220, h: 42 },
      { id: "datePicker",  label: "Date Picker",  icon: "⏲",  type: "datePicker",  w: 220, h: 42 },
      { id: "checkbox",    label: "Checkbox",     icon: "☑",  type: "checkbox",    w: 170, h: 26 },
      { id: "radio",       label: "Radio",        icon: "◎",  type: "radio",       w: 170, h: 26 },
      { id: "switch",      label: "Switch",       icon: "⬤",  type: "switch",      w: 130, h: 28 },
      { id: "fileUpload",  label: "File Upload",  icon: "↑",  type: "fileUpload",  w: 220, h: 80 },
    ],
  },
  {
    label: "Basic",
    entries: [
      { id: "text",   label: "Text",   icon: "T",  type: "text",   w: 140, h: 28 },
      { id: "button", label: "Button", icon: "⬛", type: "button", w: 130, h: 42 },
      { id: "image",  label: "Image",  icon: "⬡",  type: "image",  w: 220, h: 150 },
      { id: "icon",   label: "Icon",   icon: "✦",  type: "icon",   w: 32,  h: 32  },
    ],
  },
  {
    label: "Display",
    entries: [
      { id: "avatar",     label: "Avatar",      icon: "◯",  type: "avatar",     w: 48,  h: 48  },
      { id: "badge",      label: "Badge",        icon: "⬡",  type: "badge",      w: 80,  h: 28  },
      { id: "statusChip", label: "Status Chip",  icon: "●",  type: "statusChip", w: 90,  h: 28  },
      { id: "divider",    label: "Divider",      icon: "─",  type: "divider",    w: 300, h: 2   },
      { id: "spacer",     label: "Spacer",       icon: "↔",  type: "spacer",     w: 220, h: 24  },
      { id: "loading",    label: "Loading",      icon: "⟳",  type: "loading",    w: 48,  h: 48  },
    ],
  },
  {
    label: "Data",
    entries: [
      { id: "dataTable", label: "Data Table", icon: "⊞",  type: "dataTable", w: 330, h: 220 },
      { id: "statCard",  label: "Stat Card",  icon: "⬛",  type: "statCard",  w: 170, h: 96  },
      { id: "chart",     label: "Chart",      icon: "↗",  type: "chart",     w: 320, h: 200 },
      { id: "timeline",  label: "Timeline",   icon: "⋮",  type: "timeline",  w: 300, h: 200 },
      { id: "list",      label: "List",       icon: "☰",  type: "list",      w: 320, h: 200 },
    ],
  },
];

export const CANVAS_PALETTE: PaletteEntry[] = PALETTE_CATEGORIES.flatMap((c) => c.entries);

function box(x: number, y: number, w: number, h: number, extra?: Partial<StyleSchema>): StyleSchema {
  return {
    layout: { position: "absolute", left: x, top: y },
    sizing: { width: w, height: h },
    ...extra,
  };
}

const PRIMARY = "#4F46E5";
const SURFACE = "#FFFFFF";
const BORDER  = "#E5E7EB";
const TEXT    = "#111827";
const MUTED   = "#6B7280";

export function createComponentForType(entry: PaletteEntry, x: number, y: number): ComponentSchema {
  const id = `${entry.type}-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
  const base = { id, bindings: {}, events: {} } as Pick<ComponentSchema, "id" | "bindings" | "events">;

  switch (entry.type) {
    case "text":
      return { ...base, type: "text", props: { text: "Text" },
        style: box(x, y, entry.w, entry.h, { typography: { color: TEXT, fontSize: 14 } }) };

    case "button":
      return { ...base, type: "button", props: { text: "Button" },
        style: box(x, y, entry.w, entry.h, {
          background: { color: PRIMARY },
          typography: { color: "#FFFFFF", fontWeight: "600", textAlign: "center", fontSize: 14 },
          border: { radius: 8 },
          layout: { position: "absolute", left: x, top: y, display: "flex", justify: "center", align: "center" },
        }) };

    case "input":
      return { ...base, type: "input", props: { placeholder: "Enter value…" },
        style: box(x, y, entry.w, entry.h, {
          background: { color: SURFACE }, border: { width: 1, color: BORDER, radius: 8 },
          spacing: { padding: [8, 10, 8, 10] }, typography: { color: TEXT, fontSize: 14 },
        }) };

    case "select":
      return { ...base, type: "select", props: { placeholder: "Select…", options: ["Option 1", "Option 2"] },
        style: box(x, y, entry.w, entry.h, {
          background: { color: SURFACE }, border: { width: 1, color: BORDER, radius: 8 },
          spacing: { padding: [8, 10, 8, 10] }, typography: { color: TEXT, fontSize: 14 },
        }) };

    case "searchInput":
      return { ...base, type: "searchInput", props: { placeholder: "Search…" },
        style: box(x, y, entry.w, entry.h, {
          background: { color: SURFACE }, border: { width: 1, color: BORDER, radius: 20 },
          spacing: { padding: [8, 12, 8, 12] }, typography: { color: TEXT, fontSize: 14 },
        }) };

    case "datePicker":
      return { ...base, type: "datePicker", props: { placeholder: "Pick a date" },
        style: box(x, y, entry.w, entry.h, {
          background: { color: SURFACE }, border: { width: 1, color: BORDER, radius: 8 },
          spacing: { padding: [8, 10, 8, 10] }, typography: { color: TEXT, fontSize: 14 },
        }) };

    case "checkbox":
      return { ...base, type: "checkbox", props: { label: "Checkbox" },
        style: box(x, y, entry.w, entry.h, {
          typography: { color: TEXT, fontSize: 14 },
          layout: { position: "absolute", left: x, top: y, display: "flex", align: "center", gap: 8 },
        }) };

    case "radio":
      return { ...base, type: "radio", props: { label: "Radio Option" },
        style: box(x, y, entry.w, entry.h, {
          typography: { color: TEXT, fontSize: 14 },
          layout: { position: "absolute", left: x, top: y, display: "flex", align: "center", gap: 8 },
        }) };

    case "switch":
      return { ...base, type: "switch", props: { label: "Toggle" },
        style: box(x, y, entry.w, entry.h, {
          typography: { color: TEXT, fontSize: 14 },
          layout: { position: "absolute", left: x, top: y, display: "flex", align: "center", gap: 8 },
        }) };

    case "fileUpload":
      return { ...base, type: "fileUpload", props: { label: "Upload file", accept: "*/*" },
        style: box(x, y, entry.w, entry.h, {
          background: { color: "#F9FAFB" }, border: { width: 1, color: BORDER, radius: 8 },
          spacing: { padding: 16 }, typography: { color: MUTED, fontSize: 13, textAlign: "center" },
        }) };

    case "card":
    case "view":
      return { ...base, type: entry.type, props: {}, children: [],
        style: box(x, y, entry.w, entry.h, {
          background: { color: entry.type === "card" ? SURFACE : "#F9FAFB" },
          border: { width: 1, color: BORDER, radius: 12 },
          spacing: { padding: 12 },
        }) };

    case "form":
      return { ...base, type: "form", props: {}, children: [],
        style: box(x, y, entry.w, entry.h, {
          background: { color: SURFACE }, border: { width: 1, color: BORDER, radius: 12 },
          spacing: { padding: 20 },
          layout: { position: "absolute", left: x, top: y, display: "flex", direction: "column", gap: 12 },
        }) };

    case "scroll":
      return { ...base, type: "scroll", props: {}, children: [],
        style: box(x, y, entry.w, entry.h, {
          background: { color: "#F9FAFB" }, border: { width: 1, color: BORDER, radius: 8 },
          spacing: { padding: 12 },
        }) };

    case "modal":
      return { ...base, type: "modal", props: { title: "Modal Title" }, children: [],
        style: box(x, y, entry.w, entry.h, {
          background: { color: SURFACE }, border: { width: 1, color: BORDER, radius: 16 },
          spacing: { padding: 24 },
          layout: { position: "absolute", left: x, top: y, display: "flex", direction: "column", gap: 16 },
        }) };

    case "tabs":
      return { ...base, type: "tabs", props: { tabs: ["Tab 1", "Tab 2", "Tab 3"], activeTab: 0 },
        style: box(x, y, entry.w, entry.h, {
          background: { color: "#F3F4F6" }, border: { radius: 8 },
          spacing: { padding: [4, 4, 4, 4] },
          layout: { position: "absolute", left: x, top: y, display: "flex", direction: "row", gap: 4 },
        }) };

    case "accordion":
      return { ...base, type: "accordion", props: { title: "Accordion Item", expanded: false },
        style: box(x, y, entry.w, entry.h, {
          background: { color: SURFACE }, border: { width: 1, color: BORDER, radius: 8 },
          spacing: { padding: 14 },
        }) };

    case "image":
      return { ...base, type: "image", props: { fit: "cover" },
        style: box(x, y, entry.w, entry.h, { border: { radius: 10 }, background: { color: "#E5E7EB" } }) };

    case "avatar":
      return { ...base, type: "avatar", props: { size: 40 },
        style: box(x, y, entry.w, entry.h, { border: { radius: 9999 }, background: { color: "#E5E7EB" } }) };

    case "badge":
      return { ...base, type: "badge", props: { text: "Badge", variant: "default" },
        style: box(x, y, entry.w, entry.h, {
          background: { color: "#EEF2FF" }, border: { radius: 9999 },
          spacing: { padding: [3, 10, 3, 10] }, typography: { color: PRIMARY, fontSize: 11, fontWeight: "600" },
        }) };

    case "statusChip":
      return { ...base, type: "statusChip", props: { label: "Active", status: "success" },
        style: box(x, y, entry.w, entry.h, {
          background: { color: "#DCFCE7" }, border: { radius: 9999 },
          spacing: { padding: [3, 10, 3, 10] }, typography: { color: "#16A34A", fontSize: 11, fontWeight: "600" },
        }) };

    case "icon":
      return { ...base, type: "icon", props: { name: "star", size: 24, color: PRIMARY },
        style: box(x, y, entry.w, entry.h) };

    case "divider":
      return { ...base, type: "divider", props: {},
        style: box(x, y, entry.w, 1, { background: { color: BORDER } }) };

    case "spacer":
      return { ...base, type: "spacer", props: {},
        style: box(x, y, entry.w, entry.h) };

    case "loading":
      return { ...base, type: "loading", props: { size: "md", variant: "spinner" },
        style: box(x, y, entry.w, entry.h, {
          layout: { position: "absolute", left: x, top: y, display: "flex", justify: "center", align: "center" },
        }) };

    case "statCard":
      return { ...base, type: "statCard", props: { label: "Metric", value: "0", trend: "+0%" },
        style: box(x, y, entry.w, entry.h, {
          background: { color: SURFACE }, border: { width: 1, color: BORDER, radius: 12 },
          spacing: { padding: 16 },
        }) };

    case "dataTable":
      return { ...base, type: "dataTable",
        props: { columns: [{ key: "name", label: "Name" }, { key: "value", label: "Value" }], dataSource: "$local.rows", searchable: true },
        style: box(x, y, entry.w, entry.h) };

    case "chart":
      return { ...base, type: "chart", props: { type: "bar", dataSource: "$local.chartData", xKey: "label", yKey: "value" },
        style: box(x, y, entry.w, entry.h, {
          background: { color: SURFACE }, border: { width: 1, color: BORDER, radius: 12 },
          spacing: { padding: 16 },
        }) };

    case "timeline":
      return { ...base, type: "timeline", props: { dataSource: "$local.events", labelKey: "title", dateKey: "date" },
        style: box(x, y, entry.w, entry.h) };

    case "list":
      return { ...base, type: "list", props: { dataSource: "$local.items", keyExtractor: "id" }, children: [],
        style: box(x, y, entry.w, entry.h, {
          background: { color: SURFACE }, border: { width: 1, color: BORDER, radius: 8 },
          spacing: { padding: 8 },
        }) };

    default:
      return { ...base, type: entry.type, props: {}, style: box(x, y, entry.w, entry.h) };
  }
}

// ── Free-Form Layer Tools ─────────────────────────────────────
// Replaces PALETTE_CATEGORIES for new screens.

import type { LayerType, LayerSchema } from "@/lib/runtime/schema";

export interface LayerTool {
  type: LayerType;
  label: string;
  shortcut: string;
  defaultW: number;
  defaultH: number;
  description: string;
}

export const LAYER_TOOLS: LayerTool[] = [
  { type: "frame",  label: "Frame",     shortcut: "F", defaultW: 200, defaultH: 120, description: "Container — holds child layers, supports auto-layout" },
  { type: "text",   label: "Text",      shortcut: "T", defaultW: 160, defaultH: 28,  description: "Text content — bind to any string expression" },
  { type: "rect",   label: "Rectangle", shortcut: "R", defaultW: 180, defaultH: 80,  description: "Decorative shape — fill, border, radius" },
  { type: "image",  label: "Image",     shortcut: "I", defaultW: 200, defaultH: 140, description: "Image — bind src to any URL expression" },
  { type: "line",   label: "Line",      shortcut: "L", defaultW: 240, defaultH: 1,   description: "Separator line" },
];

let _layerCounter = 0;
function lid(type: LayerType): string {
  return `${type}-${Date.now()}-${++_layerCounter}`;
}

export function createLayer(type: LayerType, x: number, y: number, w?: number, h?: number): LayerSchema {
  const tool = LAYER_TOOLS.find((t) => t.type === type) ?? LAYER_TOOLS[0];
  const lw = w ?? tool.defaultW;
  const lh = h ?? tool.defaultH;
  const name = `${tool.label} ${_layerCounter + 1}`;

  const base: LayerSchema = {
    id: lid(type),
    name,
    type,
    style: {
      layout: { position: "absolute", left: x, top: y },
      sizing: { width: lw, height: lh },
    },
    bindings: {},
    events: {},
  };

  switch (type) {
    case "frame":
      return {
        ...base,
        content: { layoutMode: "none" },
        children: [],
        style: {
          ...base.style,
          background: { color: "#FFFFFF" },
          border: { width: 1, color: "#E5E7EB", radius: 8 },
        },
      };

    case "text":
      return {
        ...base,
        content: { text: "Text", textRole: "p" },
        style: {
          ...base.style,
          typography: { fontSize: 14, color: "#111827" },
        },
      };

    case "rect":
      return {
        ...base,
        style: {
          ...base.style,
          background: { color: "#E5E7EB" },
          border: { radius: 6 },
        },
      };

    case "image":
      return {
        ...base,
        content: { src: "", imageFit: "cover" },
        style: {
          ...base.style,
          background: { color: "#F3F4F6" },
          border: { radius: 8 },
        },
      };

    case "line":
      return {
        ...base,
        style: {
          ...base.style,
          sizing: { width: lw, height: 1 },
          background: { color: "#E5E7EB" },
        },
      };

    case "group":
      return { ...base, children: [] };

    default:
      return base;
  }
}

/** Bridge: converts a LayerSchema to a ComponentSchema so the existing canvas can render it.
 *  Used during Phase 1 while the render engine is being updated in Phase 5. */
export function layerToComponent(layer: LayerSchema): ComponentSchema {
  const type = (
    layer.type === "rect" ? "view" :
    layer.type === "line" ? "divider" :
    layer.type === "group" ? "view" :
    layer.type
  ) as ComponentType;
  return {
    id: layer.id,
    type,
    props: {
      _label: layer.name,
      _layerType: layer.type,
      ...(layer.content?.text != null ? { text: layer.content.text } : {}),
      ...(layer.content?.src != null ? { src: layer.content.src } : {}),
      ...(layer.content?.placeholder != null ? { placeholder: layer.content.placeholder } : {}),
    },
    bindings: layer.bindings ?? {},
    children: layer.children?.map(layerToComponent),
    conditionalRender: layer.conditionalRender,
    repeatFor: layer.repeatFor,
    style: layer.style,
    events: layer.events ?? {},
  };
}
