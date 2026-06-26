"use client";

import { useState } from "react";
import {
  Search,
  LayoutTemplate,
  AlignHorizontalJustifyStart,
  Grid,
  ScrollText,
  RectangleHorizontal,
  MonitorPlay,
  Type,
  Heading1,
  Tag,
  Code2,
  TextCursorInput,
  MousePointerClick,
  ChevronDown,
  CheckSquare,
  ToggleLeft,
  Calendar,
  Table2,
  List,
  BarChart2,
  LineChart,
  Clock,
  ImageIcon,
  Video,
  Upload,
  UserCircle2,
  Layout,
  PanelLeft,
  ChevronsRight,
  GitMerge,
  Repeat,
  Database,
  GripVertical,
  X,
  ExternalLink,
  LayoutGrid,
  AlignJustify,
  Rows3,
  Plus,
  Frame,
  CheckCircle2,
} from "lucide-react";
import { TextField, Btn, IconBtn, Pill, cx } from "./primitives";
import { useRuntimeStore } from "@/lib/runtime/runtime-store";

// ── Types ──────────────────────────────────────────────────────────

type Category =
  | "All"
  | "Layout"
  | "Typography"
  | "Input"
  | "Data"
  | "Media"
  | "Navigation"
  | "Logic";

type ViewMode = "grid" | "list" | "compact";

interface ComponentDef {
  id: string;
  name: string;
  description: string;
  type: string;
  category: Exclude<Category, "All">;
  icon: React.ReactNode;
  props?: { name: string; type: string; default: string }[];
}

// ── Component registry ────────────────────────────────────────────

const ICON_SIZE = 16;

const COMPONENTS: ComponentDef[] = [
  // Layout
  { id: "view", name: "View", description: "Flexible container for layout composition", type: "Container", category: "Layout", icon: <RectangleHorizontal size={ICON_SIZE} />, props: [{ name: "direction", type: "string", default: "column" }, { name: "padding", type: "number", default: "0" }] },
  { id: "stack", name: "Stack", description: "Horizontal stack with spacing control", type: "Container", category: "Layout", icon: <AlignHorizontalJustifyStart size={ICON_SIZE} />, props: [{ name: "gap", type: "number", default: "8" }, { name: "align", type: "string", default: "start" }] },
  { id: "grid-layout", name: "Grid", description: "Grid layout with configurable columns", type: "Container", category: "Layout", icon: <Grid size={ICON_SIZE} />, props: [{ name: "columns", type: "number", default: "2" }, { name: "gap", type: "number", default: "8" }] },
  { id: "scroll", name: "Scroll", description: "Scrollable area with optional snap", type: "Container", category: "Layout", icon: <ScrollText size={ICON_SIZE} />, props: [{ name: "axis", type: "string", default: "vertical" }] },
  { id: "card", name: "Card", description: "Content card with optional shadow", type: "Surface", category: "Layout", icon: <LayoutTemplate size={ICON_SIZE} />, props: [{ name: "elevated", type: "boolean", default: "true" }] },
  { id: "modal", name: "Modal", description: "Dialog/modal overlay", type: "Overlay", category: "Layout", icon: <MonitorPlay size={ICON_SIZE} />, props: [{ name: "size", type: "string", default: "md" }, { name: "dismissable", type: "boolean", default: "true" }] },
  // Typography
  { id: "text", name: "Text", description: "Text element with style controls", type: "Text", category: "Typography", icon: <Type size={ICON_SIZE} />, props: [{ name: "value", type: "string", default: "Text" }, { name: "size", type: "number", default: "14" }] },
  { id: "heading", name: "Heading", description: "Page or section heading", type: "Text", category: "Typography", icon: <Heading1 size={ICON_SIZE} />, props: [{ name: "level", type: "number", default: "1" }, { name: "value", type: "string", default: "Heading" }] },
  { id: "label", name: "Label", description: "Form label or annotation", type: "Text", category: "Typography", icon: <Tag size={ICON_SIZE} />, props: [{ name: "value", type: "string", default: "Label" }, { name: "required", type: "boolean", default: "false" }] },
  { id: "code", name: "Code", description: "Monospaced code block", type: "Text", category: "Typography", icon: <Code2 size={ICON_SIZE} />, props: [{ name: "language", type: "string", default: "typescript" }] },
  // Input
  { id: "input", name: "Input", description: "Text input field", type: "Input", category: "Input", icon: <TextCursorInput size={ICON_SIZE} />, props: [{ name: "placeholder", type: "string", default: "" }, { name: "type", type: "string", default: "text" }] },
  { id: "button", name: "Button", description: "Pressable button with variants", type: "Input", category: "Input", icon: <MousePointerClick size={ICON_SIZE} />, props: [{ name: "label", type: "string", default: "Button" }, { name: "variant", type: "string", default: "primary" }] },
  { id: "select", name: "Select", description: "Dropdown select", type: "Input", category: "Input", icon: <ChevronDown size={ICON_SIZE} />, props: [{ name: "options", type: "array", default: "[]" }] },
  { id: "checkbox", name: "Checkbox", description: "Checkbox with label", type: "Input", category: "Input", icon: <CheckSquare size={ICON_SIZE} />, props: [{ name: "checked", type: "boolean", default: "false" }, { name: "label", type: "string", default: "" }] },
  { id: "switch", name: "Switch", description: "Toggle switch", type: "Input", category: "Input", icon: <ToggleLeft size={ICON_SIZE} />, props: [{ name: "enabled", type: "boolean", default: "false" }] },
  { id: "datepicker", name: "DatePicker", description: "Date picker input", type: "Input", category: "Input", icon: <Calendar size={ICON_SIZE} />, props: [{ name: "value", type: "string", default: "" }, { name: "format", type: "string", default: "YYYY-MM-DD" }] },
  { id: "searchinput", name: "SearchInput", description: "Search with autocomplete", type: "Input", category: "Input", icon: <Search size={ICON_SIZE} />, props: [{ name: "placeholder", type: "string", default: "Search..." }] },
  // Data
  { id: "datatable", name: "DataTable", description: "Tabular data with sorting/pagination", type: "Data", category: "Data", icon: <Table2 size={ICON_SIZE} />, props: [{ name: "columns", type: "array", default: "[]" }, { name: "rows", type: "array", default: "[]" }] },
  { id: "list", name: "List", description: "List renderer with item template", type: "Data", category: "Data", icon: <List size={ICON_SIZE} />, props: [{ name: "items", type: "array", default: "[]" }] },
  { id: "statcard", name: "StatCard", description: "Metric card with trend indicator", type: "Data", category: "Data", icon: <BarChart2 size={ICON_SIZE} />, props: [{ name: "value", type: "string", default: "0" }, { name: "label", type: "string", default: "Metric" }] },
  { id: "chart", name: "Chart", description: "Chart visualization", type: "Data", category: "Data", icon: <LineChart size={ICON_SIZE} />, props: [{ name: "type", type: "string", default: "line" }, { name: "data", type: "array", default: "[]" }] },
  { id: "timeline", name: "Timeline", description: "Event timeline", type: "Data", category: "Data", icon: <Clock size={ICON_SIZE} />, props: [{ name: "events", type: "array", default: "[]" }] },
  // Media
  { id: "image", name: "Image", description: "Image/asset display", type: "Media", category: "Media", icon: <ImageIcon size={ICON_SIZE} />, props: [{ name: "src", type: "string", default: "" }, { name: "fit", type: "string", default: "cover" }] },
  { id: "video", name: "Video", description: "Video player", type: "Media", category: "Media", icon: <Video size={ICON_SIZE} />, props: [{ name: "src", type: "string", default: "" }, { name: "autoplay", type: "boolean", default: "false" }] },
  { id: "fileupload", name: "FileUpload", description: "File upload with drag-and-drop", type: "Media", category: "Media", icon: <Upload size={ICON_SIZE} />, props: [{ name: "accept", type: "string", default: "*" }, { name: "multiple", type: "boolean", default: "false" }] },
  { id: "avatar", name: "Avatar", description: "User avatar with fallback initials", type: "Media", category: "Media", icon: <UserCircle2 size={ICON_SIZE} />, props: [{ name: "src", type: "string", default: "" }, { name: "size", type: "number", default: "32" }] },
  // Navigation
  { id: "tabs", name: "Tabs", description: "Tab bar navigation", type: "Navigation", category: "Navigation", icon: <Layout size={ICON_SIZE} />, props: [{ name: "tabs", type: "array", default: "[]" }] },
  { id: "drawer", name: "Drawer", description: "Side drawer/panel", type: "Navigation", category: "Navigation", icon: <PanelLeft size={ICON_SIZE} />, props: [{ name: "side", type: "string", default: "left" }, { name: "width", type: "number", default: "280" }] },
  { id: "breadcrumb", name: "Breadcrumb", description: "Breadcrumb navigation trail", type: "Navigation", category: "Navigation", icon: <ChevronsRight size={ICON_SIZE} />, props: [{ name: "items", type: "array", default: "[]" }] },
  // Logic
  { id: "ifcondition", name: "IfCondition", description: "Conditional render branch", type: "Logic", category: "Logic", icon: <GitMerge size={ICON_SIZE} />, props: [{ name: "condition", type: "expression", default: "true" }] },
  { id: "foreach", name: "forEach", description: "List iteration over data", type: "Logic", category: "Logic", icon: <Repeat size={ICON_SIZE} />, props: [{ name: "items", type: "expression", default: "[]" }, { name: "itemVar", type: "string", default: "item" }] },
  { id: "statestore", name: "StateStore", description: "Local state container", type: "Logic", category: "Logic", icon: <Database size={ICON_SIZE} />, props: [{ name: "initialState", type: "object", default: "{}" }] },
];

const CATEGORIES: Category[] = ["All", "Layout", "Typography", "Input", "Data", "Media", "Navigation", "Logic"];

// ── Sub-components ────────────────────────────────────────────────

function ComponentIcon({ icon, size = 40 }: { icon: React.ReactNode; size?: number }) {
  return (
    <div
      className="grid shrink-0 place-items-center rounded-[var(--st-r-md)]"
      style={{
        width: size,
        height: size,
        background: "var(--st-surface)",
        color: "var(--st-text-2)",
      }}
    >
      {icon}
    </div>
  );
}

function GridCard({ comp, onSelect }: { comp: ComponentDef; onSelect: (c: ComponentDef) => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(comp)}
      onKeyDown={(e) => e.key === "Enter" && onSelect(comp)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex cursor-pointer flex-col gap-2 rounded-lg p-3 transition-all"
      style={{
        background: "var(--st-elevated)",
        border: `1px solid ${hovered ? "var(--st-brand)" : "var(--st-border)"}`,
      }}
      draggable
    >
      {hovered && (
        <div
          className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded"
          style={{ color: "var(--st-text-3)" }}
          title="Drag to add"
        >
          <GripVertical size={12} />
        </div>
      )}
      <ComponentIcon icon={comp.icon} size={40} />
      <div>
        <div className="text-[12px] font-medium" style={{ color: "var(--st-text)" }}>
          {comp.name}
        </div>
        <div className="text-[10px]" style={{ color: "var(--st-text-3)" }}>
          {comp.type}
        </div>
      </div>
      {hovered && (
        <div
          className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded px-2 py-1 text-[10px] font-medium"
          style={{
            background: "var(--st-elevated)",
            color: "var(--st-text-2)",
            boxShadow: "var(--st-shadow-floating)",
            border: "1px solid var(--st-border)",
            zIndex: 20,
          }}
        >
          Drag to add
        </div>
      )}
    </div>
  );
}

function ListRow({ comp, onSelect }: { comp: ComponentDef; onSelect: (c: ComponentDef) => void }) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-[var(--st-r-md)] px-2 py-1.5 transition-colors hover:bg-white/[0.04]"
      style={{ cursor: "pointer" }}
      onClick={() => onSelect(comp)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSelect(comp)}
      draggable
    >
      <ComponentIcon icon={comp.icon} size={32} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-medium" style={{ color: "var(--st-text)" }}>
          {comp.name}
        </div>
        <div className="truncate text-[10.5px]" style={{ color: "var(--st-text-3)" }}>
          {comp.type}
        </div>
      </div>
      <Btn variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onSelect(comp); }}>
        <Plus size={11} />
        Add
      </Btn>
    </div>
  );
}

function CompactRow({ comp, onSelect }: { comp: ComponentDef; onSelect: (c: ComponentDef) => void }) {
  return (
    <div
      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 transition-colors hover:bg-white/[0.04]"
      onClick={() => onSelect(comp)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSelect(comp)}
      draggable
    >
      <span style={{ color: "var(--st-text-3)" }}>{comp.icon}</span>
      <span className="text-[11.5px]" style={{ color: "var(--st-text)" }}>{comp.name}</span>
      <span className="ml-auto text-[10px]" style={{ color: "var(--st-text-disabled)" }}>{comp.type}</span>
    </div>
  );
}

function DetailDrawer({ comp, onClose }: { comp: ComponentDef; onClose: () => void }) {
  const addComponent = useRuntimeStore((s) => s.addComponent);
  const activeScreenId = useRuntimeStore((s) => s.activeScreenId);
  const screens = useRuntimeStore((s) => s.schema.screens);
  const activeScreenName = screens.find((s) => s.id === activeScreenId)?.name;

  const [propValues, setPropValues] = useState<Record<string, string>>(() =>
    Object.fromEntries((comp.props ?? []).map((p) => [p.name, p.default]))
  );
  const [added, setAdded] = useState(false);

  function handleAdd() {
    if (!activeScreenId) return;
    addComponent(activeScreenId, {
      id: `comp-${comp.id}-${Date.now()}`,
      type: comp.id as any,
      props: propValues,
      bindings: {},
      style: {},
      events: {},
    });
    setAdded(true);
    setTimeout(() => { setAdded(false); onClose(); }, 600);
  }

  return (
    <div
      className="absolute right-0 top-0 z-10 flex h-full w-64 shrink-0 flex-col border-l"
      style={{
        background: "var(--st-surface)",
        borderColor: "var(--st-border)",
        boxShadow: "var(--st-shadow-floating)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3.5 py-3" style={{ borderColor: "var(--st-border)" }}>
        <div className="flex items-center gap-2">
          <ComponentIcon icon={comp.icon} size={28} />
          <div>
            <div className="text-[13px] font-semibold" style={{ color: "var(--st-text)" }}>{comp.name}</div>
            <Pill tone="neutral">{comp.type}</Pill>
          </div>
        </div>
        <IconBtn onClick={onClose} aria-label="Close detail">
          <X size={14} />
        </IconBtn>
      </div>

      {/* Target screen indicator */}
      <div className="flex items-center gap-1.5 border-b px-3.5 py-2" style={{ borderColor: "var(--st-border)" }}>
        <Frame size={11} style={{ color: activeScreenId ? "var(--st-brand)" : "var(--st-error)" }} />
        <span className="text-[10.5px]" style={{ color: activeScreenId ? "var(--st-text-2)" : "var(--st-error)" }}>
          {activeScreenName ?? "No screen selected — open Screen Manager first"}
        </span>
      </div>

      {/* Description */}
      <div className="border-b px-3.5 py-3" style={{ borderColor: "var(--st-border)" }}>
        <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--st-text-2)" }}>{comp.description}</p>
      </div>

      {/* Props — editable */}
      <div className="flex-1 overflow-y-auto px-3.5 py-3">
        {comp.props && comp.props.length > 0 ? (
          <>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--st-text-3)" }}>Props</div>
            <div className="flex flex-col gap-2">
              {comp.props.map((p) => (
                <div key={p.name}>
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="text-[11px] font-medium" style={{ color: "var(--st-text)" }}>{p.name}</span>
                    <span className="text-[9.5px]" style={{ color: "var(--st-brand)" }}>{p.type}</span>
                  </div>
                  {p.type === "boolean" ? (
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={propValues[p.name] === "true"}
                        onChange={(e) => setPropValues((v) => ({ ...v, [p.name]: String(e.target.checked) }))}
                        className="h-3.5 w-3.5 rounded"
                        style={{ accentColor: "var(--st-brand)" }}
                      />
                      <span className="text-[11px]" style={{ color: "var(--st-text-2)" }}>
                        {propValues[p.name] === "true" ? "true" : "false"}
                      </span>
                    </label>
                  ) : p.type === "array" || p.type === "object" || p.type === "expression" ? (
                    <div className="rounded px-2 py-1.5 font-mono text-[10px]" style={{ background: "var(--st-bg)", color: "var(--st-text-3)" }}>
                      {p.type} — set at runtime
                    </div>
                  ) : (
                    <TextField
                      value={propValues[p.name] ?? ""}
                      placeholder={p.default || p.name}
                      onChange={(e) => setPropValues((v) => ({ ...v, [p.name]: e.target.value }))}
                      className="text-[11.5px]"
                    />
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-[11px]" style={{ color: "var(--st-text-3)" }}>No configurable props.</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 border-t px-3.5 py-3" style={{ borderColor: "var(--st-border)" }}>
        {!activeScreenId && (
          <p className="text-center text-[10.5px]" style={{ color: "var(--st-error)" }}>
            Select a screen in Screen Manager first
          </p>
        )}
        <Btn
          variant="primary"
          className="w-full justify-center"
          onClick={handleAdd}
          disabled={!activeScreenId || added}
        >
          {added ? <CheckCircle2 size={13} /> : <Plus size={13} />}
          {added ? "Added!" : "Add to Screen"}
        </Btn>
        <button
          className="flex items-center justify-center gap-1.5 text-[11.5px] transition-opacity hover:opacity-80"
          style={{ color: "var(--st-text-3)" }}
        >
          <ExternalLink size={11} />
          View Docs
        </button>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────

export function ComponentLibrary() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selected, setSelected] = useState<ComponentDef | null>(null);

  const filtered = COMPONENTS.filter((c) => {
    const matchesCategory = activeCategory === "All" || c.category === activeCategory;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.type.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const groupedCategories = (
    activeCategory === "All"
      ? (["Layout", "Typography", "Input", "Data", "Media", "Navigation", "Logic"] as const)
      : [activeCategory as Exclude<Category, "All">]
  ).filter((cat) => filtered.some((c) => c.category === cat));

  return (
    <div className="relative flex h-full flex-col overflow-hidden" style={{ background: "var(--st-bg)" }}>
      {/* Top bar */}
      <div
        className="flex shrink-0 flex-col gap-2 border-b px-3 py-2.5"
        style={{ borderColor: "var(--st-border)" }}
      >
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search
              size={13}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
              style={{ color: "var(--st-text-3)" }}
            />
            <TextField
              placeholder="Search components..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 text-[12px]"
            />
          </div>
          <div className="flex items-center gap-0.5">
            <IconBtn active={viewMode === "grid"} onClick={() => setViewMode("grid")} title="Grid view" aria-label="Grid view">
              <LayoutGrid size={14} />
            </IconBtn>
            <IconBtn active={viewMode === "list"} onClick={() => setViewMode("list")} title="List view" aria-label="List view">
              <AlignJustify size={14} />
            </IconBtn>
            <IconBtn active={viewMode === "compact"} onClick={() => setViewMode("compact")} title="Compact view" aria-label="Compact view">
              <Rows3 size={14} />
            </IconBtn>
          </div>
        </div>

        {/* Category filters */}
        <div className="flex gap-1 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
          {CATEGORIES.map((cat) => {
            const active = activeCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className="shrink-0 rounded-full px-2.5 py-0.5 text-[10.5px] font-medium transition-colors"
                style={{
                  background: active ? "var(--st-brand)" : "var(--st-surface)",
                  color: active ? "#fff" : "var(--st-text-2)",
                  border: `1px solid ${active ? "var(--st-brand)" : "var(--st-border)"}`,
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content area */}
      <div className="relative flex flex-1 overflow-hidden">
        <div className={cx("flex-1 overflow-y-auto", selected ? "opacity-60 pointer-events-none" : "")}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <Search size={28} style={{ color: "var(--st-text-disabled)" }} />
              <div>
                <div className="text-[13px] font-medium" style={{ color: "var(--st-text-2)" }}>
                  No components match &ldquo;{search}&rdquo;
                </div>
                <div className="mt-1 text-[11.5px]" style={{ color: "var(--st-text-3)" }}>
                  Try a different search term
                </div>
              </div>
              <Btn
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setActiveCategory("All");
                }}
              >
                Clear filters
              </Btn>
            </div>
          ) : (
            <div className="p-3">
              {groupedCategories.map((cat) => {
                const items = filtered.filter((c) => c.category === cat);
                if (!items.length) return null;
                return (
                  <div key={cat} className="mb-5">
                    <div
                      className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em]"
                      style={{ color: "var(--st-text-3)" }}
                    >
                      {cat}
                    </div>
                    {viewMode === "grid" && (
                      <div className="grid grid-cols-2 gap-2">
                        {items.map((comp) => (
                          <GridCard key={comp.id} comp={comp} onSelect={setSelected} />
                        ))}
                      </div>
                    )}
                    {viewMode === "list" && (
                      <div className="flex flex-col gap-0.5">
                        {items.map((comp) => (
                          <ListRow key={comp.id} comp={comp} onSelect={setSelected} />
                        ))}
                      </div>
                    )}
                    {viewMode === "compact" && (
                      <div className="flex flex-col">
                        {items.map((comp) => (
                          <CompactRow key={comp.id} comp={comp} onSelect={setSelected} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail drawer — slides in from right */}
        {selected && <DetailDrawer comp={selected} onClose={() => setSelected(null)} />}
      </div>
    </div>
  );
}
