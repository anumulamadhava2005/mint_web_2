"use client";

// ═══════════════════════════════════════════════════════════════
// ScreenManager — 3-column screen/canvas management panel
// Left sidebar: screens + layers | Center: device preview | Right: inspector
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";
import {
  Frame, Layers, Plus, Pencil, Trash2, ZoomIn, ZoomOut,
  Rocket, Minus, Type, Square, MousePointer, AlignLeft,
} from "lucide-react";
import {
  Inspector, InspectorTabs, Section, Field, TextField,
  SelectField, ToggleRow, Btn, IconBtn, Pill, cx,
} from "./primitives";
import { useRuntimeStore } from "@/lib/runtime/runtime-store";
import type { ScreenSchema, ComponentSchema, ComponentType } from "@/lib/runtime/schema";

// ── Default seed data ─────────────────────────────────────────

const SEED_SCREENS: ScreenSchema[] = [
  {
    id: "screen-home",
    name: "Home",
    route: "/home",
    components: [
      { id: "c1", type: "view", props: {}, bindings: {}, style: {}, events: {} },
      { id: "c2", type: "text", props: { content: "Welcome back" }, bindings: {}, style: {}, events: {} },
      { id: "c3", type: "button", props: { label: "Get Started", variant: "primary" }, bindings: {}, style: {}, events: {} },
    ],
    localState: [],
    actions: [],
  },
  {
    id: "screen-login",
    name: "Login",
    route: "/login",
    components: [
      { id: "c4", type: "view", props: {}, bindings: {}, style: {}, events: {} },
      { id: "c5", type: "text", props: { content: "Sign In" }, bindings: {}, style: {}, events: {} },
      { id: "c6", type: "input", props: { placeholder: "Email", inputType: "email" }, bindings: {}, style: {}, events: {} },
      { id: "c7", type: "input", props: { placeholder: "Password", inputType: "password" }, bindings: {}, style: {}, events: {} },
      { id: "c8", type: "button", props: { label: "Sign In", variant: "primary" }, bindings: {}, style: {}, events: {} },
    ],
    localState: [],
    actions: [],
  },
  {
    id: "screen-dashboard",
    name: "Dashboard",
    route: "/dashboard",
    components: [
      { id: "c9", type: "view", props: {}, bindings: {}, style: {}, events: {} },
      { id: "c10", type: "text", props: { content: "Dashboard" }, bindings: {}, style: {}, events: {} },
      { id: "c11", type: "button", props: { label: "Logout", variant: "outline" }, bindings: {}, style: {}, events: {} },
    ],
    localState: [],
    actions: [],
  },
];

type InspectorTab = "config" | "styles" | "actions";
type DeviceFrame = "iphone14" | "pixel7" | "ipad" | "desktop";

const DEVICE_SIZES: Record<DeviceFrame, { w: number; h: number; label: string }> = {
  iphone14:  { w: 375,  h: 812,  label: "iPhone 14" },
  pixel7:    { w: 393,  h: 851,  label: "Pixel 7"   },
  ipad:      { w: 768,  h: 1024, label: "iPad"      },
  desktop:   { w: 1280, h: 800,  label: "Desktop"   },
};

// ── Component type icon ───────────────────────────────────────

function CompIcon({ type }: { type: ComponentType }) {
  const s = { size: 12, strokeWidth: 2 };
  switch (type) {
    case "text":   return <Type {...s} />;
    case "button": return <MousePointer {...s} />;
    case "input":  return <AlignLeft {...s} />;
    case "view":
    case "scroll": return <Square {...s} />;
    default:       return <Layers {...s} />;
  }
}

// ── Canvas component preview ──────────────────────────────────

function ComponentPreview({
  comp, selected, onClick,
}: {
  comp: ComponentSchema; selected: boolean; onClick: () => void;
}) {
  const base: React.CSSProperties = {
    cursor: "pointer",
    borderRadius: 6,
    outline: selected ? "2px solid var(--st-brand)" : "none",
    outlineOffset: 2,
    marginBottom: 8,
  };

  if (comp.type === "button") {
    return (
      <div onClick={onClick} style={base}>
        <div style={{ background: "var(--st-brand)", color: "#fff", borderRadius: 8, padding: "10px 20px", textAlign: "center", fontSize: 14, fontWeight: 600 }}>
          {String(comp.props.label ?? "Button")}
        </div>
      </div>
    );
  }
  if (comp.type === "text") {
    return (
      <div onClick={onClick} style={{ ...base, padding: "4px 0" }}>
        <p style={{ fontSize: 16, fontWeight: 500, color: "#111", margin: 0 }}>
          {String(comp.props.content ?? "Text")}
        </p>
      </div>
    );
  }
  if (comp.type === "input") {
    return (
      <div onClick={onClick} style={base}>
        <div style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 14px", fontSize: 14, color: "#9ca3af", background: "#fff" }}>
          {String(comp.props.placeholder ?? "Input")}
        </div>
      </div>
    );
  }
  return (
    <div onClick={onClick} style={{ ...base, border: "1.5px dashed #d1d5db", borderRadius: 8, padding: "10px 12px", minHeight: 40, color: "#9ca3af", fontSize: 12 }}>
      {comp.type} container
    </div>
  );
}

// ── Config inspector panel ────────────────────────────────────

function ConfigPanel({
  screen, comp, onUpdateScreen, onUpdateComp,
}: {
  screen: ScreenSchema;
  comp: ComponentSchema | null;
  onUpdateScreen: (u: Partial<ScreenSchema>) => void;
  onUpdateComp: (id: string, u: Partial<ComponentSchema>) => void;
}) {
  if (!comp) {
    return (
      <>
        <Section title="Screen">
          <Field label="Name" htmlFor="sc-name">
            <TextField id="sc-name" value={screen.name} onChange={(e) => onUpdateScreen({ name: e.target.value })} />
          </Field>
          <Field label="Route" htmlFor="sc-route">
            <TextField id="sc-route" value={screen.route} mono onChange={(e) => onUpdateScreen({ route: e.target.value })} />
          </Field>
        </Section>
        <Section title="Metadata" defaultOpen={false}>
          <Field label="Title">
            <TextField value={screen.meta?.title ?? ""} placeholder="Page title" onChange={(e) => onUpdateScreen({ meta: { ...screen.meta, title: e.target.value } })} />
          </Field>
          <Field label="Description">
            <TextField value={screen.meta?.description ?? ""} placeholder="Page description" onChange={(e) => onUpdateScreen({ meta: { ...screen.meta, description: e.target.value } })} />
          </Field>
        </Section>
      </>
    );
  }

  const props = comp.props;
  return (
    <>
      <Section title="Component">
        <div className="mb-2 flex items-center gap-2">
          <Pill tone="brand">{comp.type}</Pill>
          <span className="text-[10px]" style={{ color: "var(--st-text-3)" }}>{comp.id}</span>
        </div>
      </Section>
      <Section title="Props">
        {comp.type === "button" && (
          <>
            <Field label="Label">
              <TextField value={String(props.label ?? "")} onChange={(e) => onUpdateComp(comp.id, { props: { ...props, label: e.target.value } })} />
            </Field>
            <Field label="Variant">
              <SelectField value={String(props.variant ?? "primary")} onChange={(e) => onUpdateComp(comp.id, { props: { ...props, variant: e.target.value } })}>
                <option value="primary">Primary</option>
                <option value="outline">Outline</option>
                <option value="ghost">Ghost</option>
                <option value="danger">Danger</option>
              </SelectField>
            </Field>
            <ToggleRow label="Disabled" checked={Boolean(props.disabled)} onChange={(v) => onUpdateComp(comp.id, { props: { ...props, disabled: v } })} />
          </>
        )}
        {comp.type === "text" && (
          <>
            <Field label="Content">
              <TextField value={String(props.content ?? "")} onChange={(e) => onUpdateComp(comp.id, { props: { ...props, content: e.target.value } })} />
            </Field>
            <Field label="Tag">
              <SelectField value={String(props.tag ?? "p")} onChange={(e) => onUpdateComp(comp.id, { props: { ...props, tag: e.target.value } })}>
                <option value="h1">h1</option>
                <option value="h2">h2</option>
                <option value="p">p</option>
                <option value="span">span</option>
              </SelectField>
            </Field>
          </>
        )}
        {comp.type === "input" && (
          <>
            <Field label="Placeholder">
              <TextField value={String(props.placeholder ?? "")} onChange={(e) => onUpdateComp(comp.id, { props: { ...props, placeholder: e.target.value } })} />
            </Field>
            <Field label="Type">
              <SelectField value={String(props.inputType ?? "text")} onChange={(e) => onUpdateComp(comp.id, { props: { ...props, inputType: e.target.value } })}>
                <option value="text">text</option>
                <option value="email">email</option>
                <option value="password">password</option>
                <option value="number">number</option>
                <option value="tel">tel</option>
              </SelectField>
            </Field>
            <ToggleRow label="Required" checked={Boolean(props.required)} onChange={(v) => onUpdateComp(comp.id, { props: { ...props, required: v } })} />
          </>
        )}
        {(comp.type === "view" || comp.type === "scroll") && (
          <p className="text-[11px]" style={{ color: "var(--st-text-3)" }}>Container — no configurable props.</p>
        )}
      </Section>
      <Section title="Bindings" defaultOpen={false}>
        {Object.entries(comp.bindings ?? {}).map(([k, v]) => (
          <div key={k} className="mb-2 flex gap-1.5">
            <TextField value={k} readOnly className="w-1/3 opacity-60" onChange={() => {}} />
            <TextField value={v} onChange={(e) => onUpdateComp(comp.id, { bindings: { ...comp.bindings, [k]: e.target.value } })} />
          </div>
        ))}
        {Object.keys(comp.bindings ?? {}).length === 0 && (
          <p className="text-[11px]" style={{ color: "var(--st-text-3)" }}>No bindings.</p>
        )}
      </Section>
    </>
  );
}

// ── Styles inspector panel ────────────────────────────────────

function StylesPanel({ comp, onUpdateComp }: { comp: ComponentSchema | null; onUpdateComp: (id: string, u: Partial<ComponentSchema>) => void }) {
  if (!comp) return <div className="p-3.5 text-[11px]" style={{ color: "var(--st-text-3)" }}>Select a component to edit styles.</div>;

  const style = comp.style ?? {};
  const layout = style.layout ?? {};
  const spacing = style.spacing ?? {};
  const typography = style.typography ?? {};
  const background = (style.background ?? {}) as Record<string, any>;
  const border = style.border ?? {};

  const upd = (patch: ComponentSchema["style"]) => onUpdateComp(comp.id, { style: { ...style, ...patch } });

  return (
    <>
      <Section title="Layout">
        <Field label="Direction">
          <SelectField value={layout.direction ?? "column"} onChange={(e) => upd({ layout: { ...layout, direction: e.target.value as any } })}>
            <option value="column">column</option>
            <option value="row">row</option>
            <option value="row-reverse">row-reverse</option>
            <option value="column-reverse">column-reverse</option>
          </SelectField>
        </Field>
        <Field label="Justify">
          <SelectField value={layout.justify ?? "start"} onChange={(e) => upd({ layout: { ...layout, justify: e.target.value as any } })}>
            <option value="start">start</option>
            <option value="center">center</option>
            <option value="end">end</option>
            <option value="between">space-between</option>
            <option value="around">space-around</option>
          </SelectField>
        </Field>
        <Field label="Align">
          <SelectField value={layout.align ?? "stretch"} onChange={(e) => upd({ layout: { ...layout, align: e.target.value as any } })}>
            <option value="start">start</option>
            <option value="center">center</option>
            <option value="end">end</option>
            <option value="stretch">stretch</option>
          </SelectField>
        </Field>
      </Section>
      <Section title="Spacing" defaultOpen={false}>
        <div className="grid grid-cols-2 gap-2">
          {(["Top", "Right", "Bottom", "Left"] as const).map((side) => (
            <Field key={side} label={`Pad ${side}`}>
              <TextField
                type="number"
                value={String((spacing as any)[`padding${side}`] ?? "")}
                placeholder="0"
                onChange={(e) => upd({ spacing: { ...spacing, [`padding${side}`]: Number(e.target.value) } as any })}
              />
            </Field>
          ))}
        </div>
      </Section>
      <Section title="Typography" defaultOpen={false}>
        <Field label="Font Size">
          <TextField type="number" value={String(typography.fontSize ?? "")} placeholder="14" onChange={(e) => upd({ typography: { ...typography, fontSize: Number(e.target.value) } })} />
        </Field>
        <Field label="Font Weight">
          <SelectField value={String(typography.fontWeight ?? "400")} onChange={(e) => upd({ typography: { ...typography, fontWeight: e.target.value } })}>
            <option value="400">Regular</option>
            <option value="500">Medium</option>
            <option value="600">Semibold</option>
            <option value="700">Bold</option>
          </SelectField>
        </Field>
        <Field label="Color">
          <TextField value={String(typography.color ?? "")} placeholder="#111827" onChange={(e) => upd({ typography: { ...typography, color: e.target.value } })} />
        </Field>
      </Section>
      <Section title="Background" defaultOpen={false}>
        <Field label="Color">
          <TextField value={String(background.color ?? "")} placeholder="#ffffff" onChange={(e) => upd({ background: { ...background, color: e.target.value } as any })} />
        </Field>
      </Section>
      <Section title="Border" defaultOpen={false}>
        <Field label="Width">
          <TextField type="number" value={String(border.width ?? "")} placeholder="0" onChange={(e) => upd({ border: { ...border, width: Number(e.target.value) } })} />
        </Field>
        <Field label="Radius">
          <TextField type="number" value={String(border.radius ?? "")} placeholder="0" onChange={(e) => upd({ border: { ...border, radius: Number(e.target.value) } })} />
        </Field>
        <Field label="Color">
          <TextField value={String(border.color ?? "")} placeholder="#e5e7eb" onChange={(e) => upd({ border: { ...border, color: e.target.value } })} />
        </Field>
      </Section>
    </>
  );
}

// ── Actions inspector panel ───────────────────────────────────

function ActionsPanel({ comp, onUpdateComp }: { comp: ComponentSchema | null; onUpdateComp: (id: string, u: Partial<ComponentSchema>) => void }) {
  if (!comp) return <div className="p-3.5 text-[11px]" style={{ color: "var(--st-text-3)" }}>Select a component to manage event handlers.</div>;

  const events = comp.events ?? {};

  return (
    <Section title="Event Handlers" right={
      <IconBtn title="Add onClick handler" onClick={() => {
        const updated = { ...events, onClick: [...(events.onClick ?? []), { actionId: "navigate", params: { to: "/" } }] };
        onUpdateComp(comp.id, { events: updated });
      }}>
        <Plus size={13} />
      </IconBtn>
    }>
      {Object.keys(events).length === 0 && (
        <p className="text-[11px]" style={{ color: "var(--st-text-3)" }}>No handlers. Click + to add one.</p>
      )}
      {Object.entries(events).map(([event, refs]) => (
        <div key={event} className="mb-3">
          <div className="mb-1.5 text-[10.5px] font-semibold" style={{ color: "var(--st-text-2)" }}>{event}</div>
          {(refs ?? []).map((ref: any, i: number) => (
            <div key={i} className="mb-1.5 flex items-center gap-1.5 rounded-[var(--st-r-md)] px-2 py-1.5" style={{ background: "var(--st-bg)" }}>
              <span className="flex-1 font-mono text-[11px]" style={{ color: "var(--st-text)" }}>
                {ref.actionId}{ref.params?.to ? `('${ref.params.to}')` : "()"}
              </span>
              <IconBtn
                title="Remove"
                style={{ width: 20, height: 20, color: "var(--st-error)" }}
                onClick={() => {
                  const newRefs = (refs as any[]).filter((_: any, j: number) => j !== i);
                  const newEvents = { ...events, [event]: newRefs };
                  if (newRefs.length === 0) delete newEvents[event];
                  onUpdateComp(comp.id, { events: newEvents });
                }}
              >
                <Minus size={10} />
              </IconBtn>
            </div>
          ))}
        </div>
      ))}
    </Section>
  );
}

// ── Main component ────────────────────────────────────────────

export function ScreenManager() {
  const { schema, addScreen, updateScreen, removeScreen, updateComponent } = useRuntimeStore();

  const [seeded, setSeeded] = useState(false);
  const [selectedScreenId, setSelectedScreenId] = useState<string>("screen-home");
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("config");
  const [zoom, setZoom] = useState(0.7);
  const [device, setDevice] = useState<DeviceFrame>("iphone14");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Seed default screens once on mount
  useEffect(() => {
    if (seeded) return;
    setSeeded(true);
    if (schema.screens.length === 0) {
      SEED_SCREENS.forEach((s) => addScreen(s));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const screens = schema.screens as ScreenSchema[];
  const activeScreen = screens.find((s) => s.id === selectedScreenId) ?? screens[0] ?? null;
  const components: ComponentSchema[] = activeScreen?.components ?? [];
  const selectedComp = components.find((c) => c.id === selectedCompId) ?? null;
  const dev = DEVICE_SIZES[device];

  function handleAddScreen() {
    const id = `screen-${Date.now()}`;
    addScreen({ id, name: "New Screen", route: `/${id}`, components: [], localState: [], actions: [] });
    setSelectedScreenId(id);
    setSelectedCompId(null);
  }

  function handleDeleteScreen(id: string) {
    removeScreen(id);
    if (selectedScreenId === id) {
      const remaining = screens.filter((s) => s.id !== id);
      setSelectedScreenId(remaining[0]?.id ?? "");
    }
  }

  function handleStartRename(s: ScreenSchema) {
    setRenamingId(s.id);
    setRenameValue(s.name);
  }

  function handleFinishRename() {
    if (renamingId && renameValue.trim()) {
      const slug = renameValue.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      updateScreen(renamingId, { name: renameValue.trim(), route: `/${slug}` });
    }
    setRenamingId(null);
  }

  function handleUpdateScreen(updates: Partial<ScreenSchema>) {
    if (activeScreen) updateScreen(activeScreen.id, updates);
  }

  function handleUpdateComp(compId: string, updates: Partial<ComponentSchema>) {
    if (activeScreen) updateComponent(activeScreen.id, compId, updates);
  }

  const INSPECTOR_TABS: { id: InspectorTab; icon: React.ReactNode; label: string }[] = [
    { id: "config",  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>, label: "Config" },
    { id: "styles",  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 13.5V20a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-2h2v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-6.5"/><path d="M12 3H3L2 9l10 4 10-4-1-6z"/></svg>, label: "Styles" },
    { id: "actions", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>, label: "Actions" },
  ];

  return (
    <div className={cx("flex h-full w-full overflow-hidden")} style={{ background: "var(--st-bg)" }}>

      {/* ── Left sidebar ───────────────────────────────────── */}
      <aside
        className="flex w-52 shrink-0 flex-col border-r"
        style={{ borderColor: "var(--st-border)", background: "var(--st-surface)" }}
      >
        {/* Screens header */}
        <div className="flex h-10 shrink-0 items-center justify-between border-b px-3" style={{ borderColor: "var(--st-border)" }}>
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--st-text-3)" }}>
            Screens
          </span>
          <IconBtn title="Add screen" onClick={handleAddScreen}>
            <Plus size={13} />
          </IconBtn>
        </div>

        {/* Screen list */}
        <div className="overflow-y-auto" style={{ maxHeight: "45%" }}>
          {screens.map((s) => {
            const active = s.id === selectedScreenId;
            return (
              <div
                key={s.id}
                className="group relative flex cursor-pointer items-center gap-2 px-2.5 py-2"
                style={{
                  background: active ? "var(--st-brand-tint)" : "transparent",
                  borderLeft: active ? "2px solid var(--st-brand)" : "2px solid transparent",
                }}
                onClick={() => { setSelectedScreenId(s.id); setSelectedCompId(null); }}
              >
                <Frame size={13} style={{ color: active ? "var(--st-brand)" : "var(--st-text-3)", flexShrink: 0 }} />
                <div className="min-w-0 flex-1">
                  {renamingId === s.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={handleFinishRename}
                      onKeyDown={(e) => e.key === "Enter" && handleFinishRename()}
                      className="w-full rounded px-1 text-[11.5px] outline-none"
                      style={{ background: "var(--st-elevated)", color: "var(--st-text)" }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <>
                      <div className="truncate text-[11.5px] font-medium" style={{ color: active ? "var(--st-brand)" : "var(--st-text)" }}>
                        {s.name}
                      </div>
                      <div className="truncate font-mono text-[9.5px]" style={{ color: "var(--st-text-3)" }}>
                        {s.route}
                      </div>
                    </>
                  )}
                </div>
                {renamingId !== s.id && (
                  <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <IconBtn title="Rename" style={{ width: 18, height: 18 }} onClick={(e) => { e.stopPropagation(); handleStartRename(s); }}>
                      <Pencil size={10} />
                    </IconBtn>
                    <IconBtn title="Delete" style={{ width: 18, height: 18, color: "var(--st-error)" }} onClick={(e) => { e.stopPropagation(); handleDeleteScreen(s.id); }}>
                      <Trash2 size={10} />
                    </IconBtn>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Divider + Layers */}
        <div className="border-t px-3 pb-1 pt-2" style={{ borderColor: "var(--st-border)" }}>
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--st-text-3)" }}>
            Layers
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pb-2">
          {components.length === 0 && (
            <p className="px-3 text-[11px]" style={{ color: "var(--st-text-3)" }}>No components.</p>
          )}
          {components.map((comp) => {
            const sel = comp.id === selectedCompId;
            return (
              <div
                key={comp.id}
                className="flex cursor-pointer items-center gap-1.5 px-3 py-1.5 hover:bg-white/[0.04]"
                style={{
                  background: sel ? "var(--st-brand-tint)" : "transparent",
                  color: sel ? "var(--st-brand)" : "var(--st-text-2)",
                }}
                onClick={() => { setSelectedCompId(sel ? null : comp.id); setInspectorTab("config"); }}
              >
                <CompIcon type={comp.type} />
                <span className="truncate text-[11.5px]">{comp.type}</span>
                <span className="ml-auto font-mono text-[9px]" style={{ color: "var(--st-text-3)" }}>
                  {comp.id.slice(-4)}
                </span>
              </div>
            );
          })}
        </div>
      </aside>

      {/* ── Center canvas ───────────────────────────────────── */}
      <div className="relative flex flex-1 flex-col overflow-hidden" style={{ background: "var(--st-canvas)" }}>

        {/* Top bar overlay */}
        <div
          className="absolute inset-x-0 top-0 z-10 flex h-10 items-center justify-between px-3"
          style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(6px)" }}
        >
          <div className="flex items-center gap-1">
            <Btn size="sm" variant="outline" onClick={() => setZoom(0.7)} style={{ padding: "3px 8px", fontSize: 11 }}>
              Fit
            </Btn>
            <Btn size="sm" variant="outline" onClick={() => setZoom(1)} style={{ padding: "3px 8px", fontSize: 11 }}>
              1:1
            </Btn>
            <IconBtn title="Zoom in" onClick={() => setZoom((z) => Math.min(z + 0.1, 2))}>
              <ZoomIn size={14} style={{ color: "var(--st-text-2)" }} />
            </IconBtn>
            <IconBtn title="Zoom out" onClick={() => setZoom((z) => Math.max(z - 0.1, 0.3))}>
              <ZoomOut size={14} style={{ color: "var(--st-text-2)" }} />
            </IconBtn>
            <span className="ml-1 text-[11px]" style={{ color: "var(--st-text-3)" }}>
              {Math.round(zoom * 100)}%
            </span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={device}
              onChange={(e) => setDevice(e.target.value as DeviceFrame)}
              className="rounded px-2 py-1 text-[11px] outline-none"
              style={{ background: "var(--st-elevated)", color: "var(--st-text-2)", border: "1px solid var(--st-border)" }}
            >
              {(Object.entries(DEVICE_SIZES) as [DeviceFrame, { w: number; h: number; label: string }][]).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <Btn size="sm" variant="primary" style={{ gap: 4 }}>
              <Rocket size={11} />
              Preview
            </Btn>
          </div>
        </div>

        {/* Canvas scroll area */}
        <div className="flex flex-1 items-center justify-center overflow-auto pt-10">
          <div style={{ transform: `scale(${zoom})`, transformOrigin: "center center", transition: "transform 0.2s ease" }}>
            {/* Device bezel */}
            <div style={{
              width: dev.w,
              height: dev.h,
              borderRadius: device === "desktop" ? 8 : 40,
              background: "#1a1a2e",
              padding: device === "desktop" ? 4 : 12,
              boxShadow: "0 32px 80px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.08)",
              position: "relative",
            }}>
              {/* Phone notch */}
              {device !== "desktop" && device !== "ipad" && (
                <div style={{
                  position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
                  width: 120, height: 28, background: "#1a1a2e", borderRadius: "0 0 16px 16px", zIndex: 2,
                }} />
              )}
              {/* Inner screen */}
              <div style={{
                width: "100%", height: "100%",
                borderRadius: device === "desktop" ? 4 : 28,
                background: "#ffffff", overflow: "hidden", position: "relative",
              }}>
                {activeScreen ? (
                  <div style={{ padding: "24px 16px 16px", display: "flex", flexDirection: "column", height: "100%", overflowY: "auto" }}>
                    <div style={{ marginBottom: 16, paddingTop: device !== "desktop" ? 16 : 0 }}>
                      <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500, marginBottom: 4 }}>{activeScreen.route}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>{activeScreen.name}</div>
                    </div>
                    {components.map((comp) => (
                      <ComponentPreview
                        key={comp.id}
                        comp={comp}
                        selected={comp.id === selectedCompId}
                        onClick={() => { setSelectedCompId(comp.id === selectedCompId ? null : comp.id); setInspectorTab("config"); }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid h-full place-items-center" style={{ color: "#9ca3af", fontSize: 13 }}>
                    No screen selected
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right inspector ─────────────────────────────────── */}
      {activeScreen && (
        <Inspector
          title={selectedComp ? selectedComp.type : activeScreen.name}
          tabs={
            <InspectorTabs
              tabs={INSPECTOR_TABS}
              value={inspectorTab}
              onChange={setInspectorTab}
            />
          }
        >
          {inspectorTab === "config" && (
            <ConfigPanel
              screen={activeScreen}
              comp={selectedComp}
              onUpdateScreen={handleUpdateScreen}
              onUpdateComp={handleUpdateComp}
            />
          )}
          {inspectorTab === "styles" && (
            <StylesPanel comp={selectedComp} onUpdateComp={handleUpdateComp} />
          )}
          {inspectorTab === "actions" && (
            <ActionsPanel comp={selectedComp} onUpdateComp={handleUpdateComp} />
          )}
        </Inspector>
      )}
    </div>
  );
}
