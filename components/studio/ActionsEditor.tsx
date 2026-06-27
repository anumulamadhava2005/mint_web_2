"use client";

// ═══════════════════════════════════════════════════════════════
// ActionsEditor — visual action flow diagram editor.
// 3-column layout: flow list | canvas | inspector
// Canvas renders workflow nodes as positioned cards with SVG
// bezier edges. Inspector adapts to selected node type.
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";
import { v4 as uuid } from "uuid";
import {
  Plus,
  Pencil,
  ZoomIn,
  ZoomOut,
  Maximize2,
  MoreVertical,
  MousePointer,
  Globe,
  GitBranch,
  Navigation,
  Bell,
  Database,
  Trash2,
  Settings,
  Layers,
  Calendar,
  MessageSquare,
} from "lucide-react";
import { useRuntimeStore } from "@/lib/runtime/runtime-store";
import type { WorkflowSchema, WorkflowNode, WorkflowEdge } from "@/lib/runtime/schema";
import {
  Inspector,
  InspectorTabs,
  Section,
  Field,
  TextField,
  SelectField,
  ToggleRow,
  Btn,
  IconBtn,
  EmptyState,
} from "./primitives";

// ── Constants ────────────────────────────────────────────────────

const NODE_W = 192;
const NODE_H_BASE = 88;

// ── Node meta ────────────────────────────────────────────────────

type NodeType = WorkflowNode["type"];

const NODE_META: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  "trigger":       { label: "Button Click",  color: "#F59E0B", Icon: MousePointer },
  "api":           { label: "API Request",   color: "#3B82F6", Icon: Globe        },
  "condition":     { label: "Condition",     color: "#8B5CF6", Icon: GitBranch    },
  "navigate":      { label: "Navigate",      color: "#10B981", Icon: Navigation   },
  "toast":         { label: "Show Toast",    color: "#EF4444", Icon: Bell         },
  "setState":      { label: "Set State",     color: "#6366F1", Icon: Layers       },
  "execute-query": { label: "Execute Query", color: "#F97316", Icon: Database     },
};

// ── Bezier edge path ──────────────────────────────────────────────

function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const cy = Math.abs(y2 - y1) * 0.55;
  return `M ${x1} ${y1} C ${x1} ${y1 + cy}, ${x2} ${y2 - cy}, ${x2} ${y2}`;
}

// ── NodeCard ─────────────────────────────────────────────────────

function NodeCard({
  node,
  selected,
  onSelect,
  onRemove,
}: {
  node: WorkflowNode;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const meta = NODE_META[node.type] ?? NODE_META["api"];
  const { Icon, label, color } = meta;
  const [menuOpen, setMenuOpen] = useState(false);

  const bodyRows: [string, string][] = (() => {
    const c = (node.config ?? {}) as Record<string, string>;
    switch (node.type) {
      case "trigger":       return [["Element", c.element ?? ""]];
      case "api":           return [["Method", c.method ?? "GET"], ["Endpoint", c.endpoint ?? ""]];
      case "condition":     return [["If", c.expression ?? ""]];
      case "navigate":      return [["To", c.route ?? ""]];
      case "toast":         return [["Type", c.toastType ?? "info"], ["Msg", c.message ?? ""]];
      case "setState":      return [["Key", c.key ?? ""], ["Value", c.value ?? ""]];
      case "execute-query": return [["Resource", c.resource ?? ""], ["Action", c.action ?? ""]];
      default:              return [];
    }
  })();

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      style={{
        position: "absolute",
        left: node.position?.x ?? 0,
        top: node.position?.y ?? 0,
        width: NODE_W,
        background: "var(--st-elevated)",
        border: `1.5px solid ${selected ? "var(--st-brand)" : "var(--st-border)"}`,
        borderRadius: "var(--st-r-lg)",
        boxShadow: selected ? "0 0 0 3px var(--st-brand-tint)" : "var(--st-shadow-raised)",
        cursor: "pointer",
        userSelect: "none",
        zIndex: selected ? 10 : 1,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px 6px 10px", borderBottom: "1px solid var(--st-border)" }}>
        <Icon size={13} style={{ color, flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: "var(--st-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </span>
        <div style={{ position: "relative" }}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
            style={{ display: "grid", placeItems: "center", width: 20, height: 20, borderRadius: 4, background: "transparent", border: "none", color: "var(--st-text-3)", cursor: "pointer" }}
          >
            <MoreVertical size={12} />
          </button>
          {menuOpen && (
            <div
              style={{ position: "absolute", top: 24, right: 0, background: "var(--st-surface)", border: "1px solid var(--st-border)", borderRadius: "var(--st-r-md)", boxShadow: "var(--st-shadow-floating)", zIndex: 100, minWidth: 110, overflow: "hidden" }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => { onRemove(); setMenuOpen(false); }}
                style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "7px 10px", fontSize: 11.5, color: "var(--st-error)", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
              >
                <Trash2 size={12} /> Delete node
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "6px 10px 8px" }}>
        {bodyRows.map(([k, v]) => (
          <div key={k} style={{ display: "flex", gap: 6, marginBottom: 3, fontSize: 10.5 }}>
            <span style={{ color: "var(--st-text-3)", flexShrink: 0 }}>{k}:</span>
            <span style={{ color: "var(--st-text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Condition outputs */}
      {node.type === "condition" && (
        <div style={{ display: "flex", justifyContent: "space-around", padding: "0 10px 8px", gap: 6 }}>
          {["True", "False"].map((lbl) => (
            <span
              key={lbl}
              style={{
                flex: 1,
                textAlign: "center",
                fontSize: 10,
                fontWeight: 600,
                padding: "2px 6px",
                borderRadius: 99,
                background: lbl === "True" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                color: lbl === "True" ? "var(--st-success)" : "var(--st-error)",
              }}
            >
              {lbl}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Inspector tab types ───────────────────────────────────────────

type InspTab = "props" | "style" | "events" | "collab";

const INSP_TABS: { id: InspTab; icon: React.ReactNode; label: string }[] = [
  { id: "props",  icon: <Settings size={13} />,      label: "Properties" },
  { id: "style",  icon: <Layers size={13} />,        label: "Style"      },
  { id: "events", icon: <Calendar size={13} />,      label: "Events"     },
  { id: "collab", icon: <MessageSquare size={13} />, label: "Collab"     },
];

// ── NodeInspector ────────────────────────────────────────────────

function NodeInspector({ node, workflowId }: { node: WorkflowNode; workflowId: string }) {
  const updateWorkflowNode = useRuntimeStore((s) => s.updateWorkflowNode);
  const screens = useRuntimeStore((s) => s.schema.screens);

  function setConfig(key: string, value: string) {
    updateWorkflowNode(workflowId, node.id, { config: { ...node.config, [key]: value } });
  }

  const [runCond,      setRunCond]      = useState(false);
  const [throttle,     setThrottle]     = useState(false);
  const [throttleType, setThrottleType] = useState("debounce");
  const [throttleMs,   setThrottleMs]   = useState("300");
  const [headers,      setHeaders]      = useState<{ k: string; v: string }[]>([]);

  const c = (node.config ?? {}) as Record<string, string>;

  return (
    <>
      <Section title="General">
        <Field label="Action ID">
          <TextField value={node.id} readOnly mono style={{ opacity: 0.6, fontSize: 11 }} />
        </Field>
        <Field label="Type">
          <SelectField
            value={node.type}
            onChange={(e) => updateWorkflowNode(workflowId, node.id, { type: e.target.value as NodeType })}
          >
            {Object.keys(NODE_META).map((t) => (
              <option key={t} value={t}>{NODE_META[t].label}</option>
            ))}
          </SelectField>
        </Field>
      </Section>

      <Section title="Configuration">
        {node.type === "api" && (
          <>
            <Field label="Endpoint URL">
              <div style={{ display: "flex", gap: 4 }}>
                <SelectField
                  value={c.method ?? "GET"}
                  onChange={(e) => setConfig("method", e.target.value)}
                  style={{ width: 72, flexShrink: 0 }}
                >
                  {["GET","POST","PUT","PATCH","DELETE"].map((m) => <option key={m}>{m}</option>)}
                </SelectField>
                <TextField value={c.endpoint ?? ""} onChange={(e) => setConfig("endpoint", e.target.value)} placeholder="/api/..." mono />
              </div>
            </Field>
            <Field label="Payload (JSON)">
              <textarea
                value={c.payload ?? ""}
                onChange={(e) => setConfig("payload", e.target.value)}
                rows={4}
                placeholder="{}"
                style={{ width: "100%", borderRadius: "var(--st-r-md)", padding: "6px 10px", fontSize: 11.5, fontFamily: "var(--st-mono)", background: "var(--st-bg)", color: "var(--st-text)", boxShadow: "inset 0 0 0 1px var(--st-border-2)", border: "none", outline: "none", resize: "vertical" }}
              />
            </Field>
            <Field label="Save result to ($state key)">
              <TextField value={c.outputStateKey ?? ""} onChange={(e) => setConfig("outputStateKey", e.target.value)} placeholder="local.data" mono />
            </Field>
            <Field label="Headers">
              {headers.map((h, i) => (
                <div key={i} style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                  <TextField value={h.k} placeholder="Key"   onChange={(e) => setHeaders((hs) => hs.map((x, j) => j === i ? { ...x, k: e.target.value } : x))} />
                  <TextField value={h.v} placeholder="Value" onChange={(e) => setHeaders((hs) => hs.map((x, j) => j === i ? { ...x, v: e.target.value } : x))} />
                </div>
              ))}
              <Btn variant="outline" size="sm" onClick={() => setHeaders((h) => [...h, { k: "", v: "" }])}>
                <Plus size={11} /> Add header
              </Btn>
            </Field>
          </>
        )}

        {node.type === "condition" && (
          <Field label="If expression">
            <TextField value={c.expression ?? ""} onChange={(e) => setConfig("expression", e.target.value)} placeholder="response.status == 200" mono />
          </Field>
        )}

        {node.type === "navigate" && (
          <Field label="Route">
            <TextField value={c.route ?? ""} onChange={(e) => setConfig("route", e.target.value)} placeholder="ScreenName or /path" />
          </Field>
        )}

        {node.type === "toast" && (
          <>
            <Field label="Type">
              <SelectField value={c.toastType ?? "info"} onChange={(e) => setConfig("toastType", e.target.value)}>
                {["info","success","warning","error"].map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </SelectField>
            </Field>
            <Field label="Message">
              <TextField value={c.message ?? ""} onChange={(e) => setConfig("message", e.target.value)} placeholder="Message text or expression" />
            </Field>
          </>
        )}

        {node.type === "trigger" && (
          <>
            <Field label="Trigger type">
              <SelectField value={c.triggerKind ?? "event"} onChange={(e) => setConfig("triggerKind", e.target.value)}>
                <option value="event">Component event</option>
                <option value="mount">Screen mount</option>
                <option value="stateChange">State change</option>
                <option value="manual">Manual / test</option>
              </SelectField>
            </Field>
            {(c.triggerKind ?? "event") === "event" && (
              <>
                <Field label="Screen">
                  <SelectField value={c.screenId ?? ""} onChange={(e) => setConfig("screenId", e.target.value)}>
                    <option value="">Any screen</option>
                    {screens.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </SelectField>
                </Field>
                <Field label="Component ID (opt)">
                  <TextField value={c.componentId ?? ""} onChange={(e) => setConfig("componentId", e.target.value)} placeholder="btn_save" mono />
                </Field>
                <Field label="Event">
                  <SelectField value={c.eventType ?? "onClick"} onChange={(e) => setConfig("eventType", e.target.value)}>
                    {["onClick","onChange","onSubmit","onMount","onFocus","onBlur"].map((ev) => (
                      <option key={ev} value={ev}>{ev}</option>
                    ))}
                  </SelectField>
                </Field>
              </>
            )}
            {(c.triggerKind ?? "event") === "stateChange" && (
              <Field label="Watch expression">
                <TextField value={c.watchExpr ?? ""} onChange={(e) => setConfig("watchExpr", e.target.value)} placeholder="$user.role" mono />
              </Field>
            )}
          </>
        )}

        {node.type === "execute-query" && (
          <>
            <Field label="Resource">
              <TextField value={c.resource ?? ""} onChange={(e) => setConfig("resource", e.target.value)} placeholder="orders" />
            </Field>
            <Field label="Action">
              <TextField value={c.action ?? ""} onChange={(e) => setConfig("action", e.target.value)} placeholder="insert" />
            </Field>
            <Field label="Payload (JSON)">
              <textarea
                value={c.payload ?? ""}
                onChange={(e) => setConfig("payload", e.target.value)}
                rows={3}
                placeholder="{}"
                style={{ width: "100%", borderRadius: "var(--st-r-md)", padding: "6px 10px", fontSize: 11.5, fontFamily: "var(--st-mono)", background: "var(--st-bg)", color: "var(--st-text)", boxShadow: "inset 0 0 0 1px var(--st-border-2)", border: "none", outline: "none", resize: "vertical" }}
              />
            </Field>
          </>
        )}

        {node.type === "setState" && (
          <>
            <Field label="Key">
              <TextField value={c.key ?? ""} onChange={(e) => setConfig("key", e.target.value)} placeholder="stateKey" mono />
            </Field>
            <Field label="Value">
              <TextField value={c.value ?? ""} onChange={(e) => setConfig("value", e.target.value)} placeholder="expression" mono />
            </Field>
          </>
        )}
      </Section>

      <Section title="Execution" defaultOpen={false}>
        <ToggleRow label="Run Condition" hint="Only execute if expression is true" checked={runCond} onChange={setRunCond} />
        <ToggleRow label="Debounce / Throttle" checked={throttle} onChange={setThrottle} />
        {throttle && (
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <SelectField value={throttleType} onChange={(e) => setThrottleType(e.target.value)} style={{ flex: 1 }}>
              <option value="debounce">Debounce</option>
              <option value="throttle">Throttle</option>
            </SelectField>
            <TextField value={throttleMs} onChange={(e) => setThrottleMs(e.target.value)} style={{ width: 64 }} placeholder="300" />
            <span style={{ alignSelf: "center", fontSize: 11, color: "var(--st-text-3)" }}>ms</span>
          </div>
        )}
      </Section>
    </>
  );
}

// ── Bottom bar ───────────────────────────────────────────────────

type BottomTab = "json" | "console" | "logs" | "validation";

function BottomBar({ workflow }: { workflow: WorkflowSchema | null }) {
  const [tab, setTab] = useState<BottomTab>("json");

  const preview = (() => {
    if (!workflow) return "// No flow selected";
    if (tab === "json")       return JSON.stringify(workflow, null, 2).split("\n")[0] + " …";
    if (tab === "console")    return "// Console output will appear here";
    if (tab === "logs")       return "// Execution logs will appear here";
    return "// No validation errors";
  })();

  return (
    <div style={{ height: 32, flexShrink: 0, borderTop: "1px solid var(--st-border)", background: "var(--st-surface)", display: "flex", alignItems: "stretch", overflow: "hidden" }}>
      {(["json","console","logs","validation"] as BottomTab[]).map((t) => (
        <button
          key={t}
          onClick={() => setTab(t)}
          style={{
            padding: "0 14px",
            fontSize: 11,
            fontWeight: 500,
            background: t === tab ? "var(--st-elevated)" : "transparent",
            color: t === tab ? "var(--st-text)" : "var(--st-text-3)",
            border: "none",
            borderRight: "1px solid var(--st-border)",
            cursor: "pointer",
            textTransform: "capitalize",
          }}
        >
          {t}
        </button>
      ))}
      <div style={{ flex: 1, overflow: "hidden", padding: "0 12px", display: "flex", alignItems: "center" }}>
        <span style={{ fontSize: 10.5, fontFamily: "var(--st-mono)", color: "var(--st-text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {preview}
        </span>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────

export function ActionsEditor({ mode = "actions" }: { mode?: "actions" | "workflows" }) {
  const { schema, addWorkflow, removeWorkflow, updateWorkflow, addWorkflowNode, removeWorkflowNode, updateWorkflowNode } = useRuntimeStore();
  const workflows = schema.workflows as WorkflowSchema[];

  const [selectedFlowId, setSelectedFlowId] = useState<string>(workflows[0]?.id ?? "");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [zoom, setZoom]                     = useState(1);
  const [inspTab, setInspTab]               = useState<InspTab>("props");
  const [editingName, setEditingName]       = useState(false);
  const [nameDraft, setNameDraft]           = useState("");

  const workflow     = workflows.find((w) => w.id === selectedFlowId) ?? null;
  const selectedNode = workflow?.nodes.find((n) => n.id === selectedNodeId) ?? null;

  // Auto-position nodes that lack coordinates (e.g. programmatically-authored
  // or imported flows) so they don't collapse onto (0,0). Stacks in authored
  // order; users can still drag them afterward. Runs once per flow.
  useEffect(() => {
    if (!workflow) return;
    const missing = workflow.nodes.filter((n) => !n.position);
    if (missing.length === 0) return;
    workflow.nodes.forEach((n, i) => {
      if (!n.position) updateWorkflowNode(workflow.id, n.id, { position: { x: 220, y: 24 + i * 110 } });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow?.id]);

  const ZOOM_MIN = 0.4;
  const ZOOM_MAX = 2.0;

  function addFlow() {
    const id = `flow_${uuid().slice(0, 8)}`;
    addWorkflow({ id, name: "New Flow", trigger: { type: "event", config: { event: "click" } }, nodes: [], edges: [] });
    setSelectedFlowId(id);
    setSelectedNodeId(null);
  }

  function deleteFlow(id: string) {
    removeWorkflow(id);
    if (selectedFlowId === id) {
      const next = workflows.find((w) => w.id !== id);
      setSelectedFlowId(next?.id ?? "");
      setSelectedNodeId(null);
    }
  }

  function addNode() {
    if (!workflow) return;
    const id = `n_${uuid().slice(0, 8)}`;
    const node: WorkflowNode = {
      id,
      type: "api",
      config: { method: "GET", endpoint: "" },
      position: { x: 200, y: 20 + workflow.nodes.length * 110 },
    };
    addWorkflowNode(workflow.id, node);
    setSelectedNodeId(id);
  }

  function commitName() {
    if (workflow && nameDraft.trim()) {
      updateWorkflow(workflow.id, { name: nameDraft.trim() });
    }
    setEditingName(false);
  }

  // Canvas dimensions
  const canvasW = 900;
  const canvasH = 650;

  function edgeMeta(edge: WorkflowEdge) {
    const src = workflow?.nodes.find((n) => n.id === edge.from);
    const tgt = workflow?.nodes.find((n) => n.id === edge.to);
    if (!src || !tgt) return null;
    const x1 = (src.position?.x ?? 0) + NODE_W / 2;
    const y1 = (src.position?.y ?? 0) + NODE_H_BASE;
    const x2 = (tgt.position?.x ?? 0) + NODE_W / 2;
    const y2 = tgt.position?.y ?? 0;
    return { d: bezierPath(x1, y1, x2, y2), mx: (x1 + x2) / 2, my: (y1 + y2) / 2, label: edge.label };
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--st-bg)", overflow: "hidden" }}>

      {/* ── 3-column body ── */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>

        {/* Left sidebar */}
        <div style={{ width: 224, flexShrink: 0, borderRight: "1px solid var(--st-border)", background: "var(--st-surface)", display: "flex", flexDirection: "column" }}>
          <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", borderBottom: "1px solid var(--st-border)", flexShrink: 0 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", color: "var(--st-text-2)" }}>{mode === "workflows" ? "FLOWS" : "ACTIONS"}</span>
            <IconBtn onClick={addFlow} title="New flow"><Plus size={14} /></IconBtn>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
            {workflows.map((wf) => {
              const active = wf.id === selectedFlowId;
              return (
                <div
                  key={wf.id}
                  onClick={() => { setSelectedFlowId(wf.id); setSelectedNodeId(null); }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 12px",
                    cursor: "pointer",
                    borderRadius: "var(--st-r-md)",
                    margin: "1px 6px",
                    background: active ? "var(--st-brand-tint)" : "transparent",
                    color: active ? "var(--st-brand)" : "var(--st-text-2)",
                    fontSize: 12,
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{wf.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteFlow(wf.id); }}
                    style={{ display: "grid", placeItems: "center", background: "transparent", border: "none", cursor: "pointer", color: "var(--st-error)", padding: 2, borderRadius: 4, opacity: 0.6 }}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              );
            })}
            {workflows.length === 0 && (
              <EmptyState
                icon={<GitBranch size={22} />}
                title="No flows yet"
                description="Create your first flow to wire up actions and logic for your app."
                action={<Btn variant="primary" size="sm" onClick={addFlow}>New Flow</Btn>}
              />
            )}
          </div>
        </div>

        {/* Center canvas */}
        <div
          style={{ flex: 1, position: "relative", overflow: "hidden", background: "var(--st-canvas)" }}
          onClick={() => setSelectedNodeId(null)}
        >
          {/* Dot grid */}
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} aria-hidden>
            <defs>
              <pattern id="ae-dot-grid" x="0" y="0" width={24 * zoom} height={24 * zoom} patternUnits="userSpaceOnUse">
                <circle cx={1} cy={1} r={1} fill="var(--st-border)" opacity={0.5} />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#ae-dot-grid)" />
          </svg>

          {/* Top bar overlay */}
          <div
            style={{
              position: "absolute",
              top: 10,
              left: 12,
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "var(--st-elevated)",
              border: "1px solid var(--st-border)",
              borderRadius: "var(--st-r-md)",
              padding: "5px 10px",
              boxShadow: "var(--st-shadow-raised)",
              zIndex: 20,
            }}
          >
            {editingName ? (
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitName();
                  if (e.key === "Escape") setEditingName(false);
                }}
                style={{ fontSize: 12, fontWeight: 600, background: "transparent", border: "none", outline: "none", color: "var(--st-text)", width: 160 }}
              />
            ) : (
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--st-text)" }}>
                Flow: {workflow?.name ?? "—"}
              </span>
            )}
            <button
              onClick={() => { setNameDraft(workflow?.name ?? ""); setEditingName(true); }}
              style={{ display: "grid", placeItems: "center", background: "transparent", border: "none", cursor: "pointer", color: "var(--st-text-3)", padding: 2 }}
            >
              <Pencil size={11} />
            </button>
          </div>

          {/* Zoom controls */}
          <div
            style={{
              position: "absolute",
              top: 10,
              right: 12,
              display: "flex",
              alignItems: "center",
              gap: 2,
              background: "var(--st-elevated)",
              border: "1px solid var(--st-border)",
              borderRadius: "var(--st-r-md)",
              padding: "3px 4px",
              boxShadow: "var(--st-shadow-raised)",
              zIndex: 20,
            }}
          >
            <IconBtn onClick={() => setZoom((z) => Math.max(z - 0.15, ZOOM_MIN))} title="Zoom out" style={{ width: 26, height: 26 }}>
              <ZoomOut size={13} />
            </IconBtn>
            <span style={{ fontSize: 10.5, color: "var(--st-text-3)", minWidth: 36, textAlign: "center" }}>
              {Math.round(zoom * 100)}%
            </span>
            <IconBtn onClick={() => setZoom((z) => Math.min(z + 0.15, ZOOM_MAX))} title="Zoom in" style={{ width: 26, height: 26 }}>
              <ZoomIn size={13} />
            </IconBtn>
            <IconBtn onClick={() => setZoom(1)} title="Reset zoom" style={{ width: 26, height: 26 }}>
              <Maximize2 size={13} />
            </IconBtn>
          </div>

          {/* Add node button */}
          {workflow && (
            <div style={{ position: "absolute", bottom: 14, right: 14, zIndex: 20 }}>
              <Btn variant="primary" size="sm" onClick={(e) => { e.stopPropagation(); addNode(); }}>
                <Plus size={13} /> Add Node
              </Btn>
            </div>
          )}

          {/* Scrollable canvas */}
          <div style={{ position: "absolute", inset: 0, overflow: "auto" }}>
            <div style={{ position: "relative", width: canvasW * zoom, height: canvasH * zoom, minWidth: "100%", minHeight: "100%" }}>
              <div
                style={{ position: "absolute", top: 0, left: 0, width: canvasW, height: canvasH, transform: `scale(${zoom})`, transformOrigin: "top left" }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* SVG edges */}
                <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}>
                  <defs>
                    <marker id="ae-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                      <path d="M0,0 L0,6 L8,3 z" fill="var(--st-text-3)" />
                    </marker>
                  </defs>
                  {workflow?.edges.map((edge) => {
                    const ep = edgeMeta(edge);
                    if (!ep) return null;
                    return (
                      <g key={edge.id ?? `${edge.from}-${edge.to}`}>
                        <path d={ep.d} fill="none" stroke="var(--st-border-2)" strokeWidth={1.5} markerEnd="url(#ae-arrow)" />
                        {ep.label && (
                          <text x={ep.mx} y={ep.my - 4} textAnchor="middle" fontSize={9.5} fill="var(--st-text-3)" fontWeight={600}>
                            {ep.label}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>

                {/* Nodes */}
                {workflow?.nodes.map((node) => (
                  <NodeCard
                    key={node.id}
                    node={node}
                    selected={node.id === selectedNodeId}
                    onSelect={() => { setSelectedNodeId(node.id); setInspTab("props"); }}
                    onRemove={() => { removeWorkflowNode(workflow.id, node.id); setSelectedNodeId(null); }}
                  />
                ))}

                {!workflow && (
                  <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
                    <span style={{ color: "var(--st-text-3)", fontSize: 13 }}>Select or create a flow to get started</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right inspector */}
        <Inspector
          title="Inspector"
          tabs={
            <InspectorTabs<InspTab>
              tabs={INSP_TABS}
              value={inspTab}
              onChange={setInspTab}
            />
          }
        >
          {selectedNode && inspTab === "props" ? (
            <NodeInspector node={selectedNode} workflowId={selectedFlowId} />
          ) : (
            <div style={{ padding: 20, color: "var(--st-text-3)", fontSize: 12, textAlign: "center", lineHeight: 1.6 }}>
              {selectedNode
                ? `${inspTab.charAt(0).toUpperCase() + inspTab.slice(1)} panel coming soon`
                : "Select a node to inspect its properties"}
            </div>
          )}
        </Inspector>
      </div>

      {/* Bottom bar */}
      <BottomBar workflow={workflow} />
    </div>
  );
}
