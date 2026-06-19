// ═══════════════════════════════════════════════════════════════
// SchemaRenderer — Runtime React dispatch for ComponentSchema trees
//
// Switches on ComponentSchema.type to produce JSX. Reuses the existing
// BindingEngine (lib/runtime/bindings) for prop / visibility / list
// resolution — the same path used by "list"/"grid" — and renders the
// rich runtime components for the data/UX component types.
// ═══════════════════════════════════════════════════════════════
"use client";

import React from "react";
import type { ComponentSchema } from "@/lib/runtime/schema";
import { StateEngine } from "@/lib/runtime/state";
import { BindingEngine } from "@/lib/runtime/bindings";
import DataTable from "@/components/runtime/DataTable";
import Timeline from "@/components/runtime/Timeline";
import FileUpload from "@/components/runtime/FileUpload";
import type {
  DataTableConfig,
  TimelineConfig,
  FileUploadConfig,
  TabsConfig,
  ChartConfig,
  StatCardConfig,
} from "@/lib/runtime/components/configs";

export interface SchemaRendererProps {
  components: ComponentSchema[];
  /** Optional state engine; a fresh one is created if omitted. */
  state?: StateEngine;
  /** Optional pre-built binding engine (takes precedence over `state`). */
  bindingEngine?: BindingEngine;
  /** Forwarded to FileUpload so uploads are scoped to the project. */
  projectId?: string;
}

export default function SchemaRenderer({
  components,
  state,
  bindingEngine,
  projectId,
}: SchemaRendererProps) {
  const engine = React.useMemo(
    () => bindingEngine ?? new BindingEngine(state ?? new StateEngine()),
    [bindingEngine, state]
  );

  return (
    <>
      {components.map((c) => (
        <RenderNode key={c.id} component={c} engine={engine} projectId={projectId} />
      ))}
    </>
  );
}

// ── Recursive dispatch ────────────────────────────────────────

function RenderNode({
  component,
  engine,
  projectId,
  context,
}: {
  component: ComponentSchema;
  engine: BindingEngine;
  projectId?: string;
  context?: Record<string, unknown>;
}) {
  engine.compileBindings(component);
  if (!engine.isVisible(component, context)) return null;

  const resolved = engine.resolveProps(component, context);
  const props = component.props as Record<string, unknown>;

  switch (component.type) {
    // ── Rich data components ──────────────────────────────────
    case "dataTable": {
      const data = Array.isArray(resolved.dataSource)
        ? (resolved.dataSource as Record<string, unknown>[])
        : [];
      // `props` is the static config; `dataSource` is resolved into `data`.
      return <DataTable config={props as unknown as DataTableConfig} data={data} />;
    }

    case "timeline": {
      const data = Array.isArray(resolved.dataSource)
        ? (resolved.dataSource as Record<string, unknown>[])
        : [];
      return <Timeline config={props as unknown as TimelineConfig} data={data} />;
    }

    case "fileUpload": {
      return <FileUpload config={props as unknown as FileUploadConfig} projectId={projectId} />;
    }

    case "tabs": {
      return (
        <TabsRenderer
          component={component}
          engine={engine}
          projectId={projectId}
          context={context}
        />
      );
    }

    // ── List/grid: reuse the existing list-binding path ───────
    case "list":
    case "grid": {
      if (component.repeatFor) {
        const items = engine.resolveListItems(component);
        const as = component.repeatFor.as;
        const children = component.children ?? [];
        return (
          <div data-type={component.type}>
            {items.map((item, i) => (
              <div key={i} data-index={i}>
                {children.map((ch) => (
                  <RenderNode
                    key={ch.id}
                    component={ch}
                    engine={engine}
                    projectId={projectId}
                    context={{ ...context, [as]: item }}
                  />
                ))}
              </div>
            ))}
          </div>
        );
      }
      return (
        <Container component={component} engine={engine} projectId={projectId} context={context} />
      );
    }

    // ── Leaf primitives ───────────────────────────────────────
    case "text": {
      const value = resolved.text ?? resolved.value ?? props.text ?? props.value;
      return <span>{value != null ? String(value) : null}</span>;
    }

    case "button": {
      const label = resolved.text ?? resolved.label ?? props.text ?? props.label;
      return <button type="button">{label != null ? String(label) : null}</button>;
    }

    case "input": {
      const value = resolved.value ?? props.value;
      return (
        <input
          defaultValue={value != null ? String(value) : ""}
          placeholder={props.placeholder != null ? String(props.placeholder) : ""}
        />
      );
    }

    case "select": {
      // Options may be ["a","b"] or [{ value, label }]; also accept enumValues.
      const raw = (props.options ?? props.enumValues ?? []) as unknown[];
      const options = raw.map((o) =>
        o != null && typeof o === "object"
          ? (o as { value: unknown; label?: unknown })
          : { value: o, label: o }
      );
      const value = resolved.value ?? props.value;
      return (
        <select defaultValue={value != null ? String(value) : ""} data-type="select">
          {props.placeholder != null && <option value="">{String(props.placeholder)}</option>}
          {options.map((o, i) => (
            <option key={i} value={String(o.value)}>
              {String(o.label ?? o.value)}
            </option>
          ))}
        </select>
      );
    }

    case "checkbox":
    case "switch": {
      const checked = Boolean(resolved.value ?? props.value ?? props.checked);
      const label = resolved.label ?? props.label;
      return (
        <label data-type={component.type}>
          <input type="checkbox" defaultChecked={checked} role={component.type === "switch" ? "switch" : undefined} />
          {label != null ? <span>{String(label)}</span> : null}
        </label>
      );
    }

    case "statusChip": {
      const value = resolved.value ?? props.value ?? "";
      return <span data-type="statusChip">{String(value)}</span>;
    }

    // ── Media: image & camera ─────────────────────────────────
    case "image": {
      const src = resolved.src ?? props.src;
      const radius = typeof props.radius === "number" ? props.radius : 8;
      const height = typeof props.height === "number" ? props.height : 160;
      if (!src) {
        return (
          <div
            data-type="image"
            style={{ height, borderRadius: radius, background: "#1f2937", display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280", fontSize: 12 }}
          >
            No image
          </div>
        );
      }
      return (
        <img
          src={String(src)}
          alt={props.alt != null ? String(props.alt) : ""}
          style={{ width: "100%", height, objectFit: (props.fit as React.CSSProperties["objectFit"]) ?? "cover", borderRadius: radius, display: "block" }}
        />
      );
    }

    case "camera": {
      // Web preview captures via the file input (with `capture` for mobile web).
      return (
        <label
          data-type="camera"
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: "#6366f1", color: "#fff", fontSize: 14, cursor: "pointer" }}
        >
          <span aria-hidden>📷</span>
          <span>{props.label != null ? String(props.label) : "Take Photo"}</span>
          <input type="file" accept="image/*" capture={(props.facing === "front" ? "user" : "environment") as unknown as boolean} style={{ display: "none" }} />
        </label>
      );
    }

    // ── Chart (line / bar / area) — dependency-free inline SVG ──
    case "chart": {
      const cfg = props as unknown as ChartConfig;
      const rows = Array.isArray(resolved.dataSource)
        ? (resolved.dataSource as Record<string, unknown>[])
        : [];
      return <Chart cfg={cfg} rows={rows} />;
    }

    // ── Stat / metric card ────────────────────────────────────
    case "statCard": {
      const cfg = props as unknown as StatCardConfig;
      const value = resolved.value ?? cfg.value ?? "";
      const delta = resolved.delta ?? cfg.delta;
      const goodDown = cfg.deltaDirection === "down-good";
      const deltaNum = delta != null ? Number(delta) : NaN;
      const deltaColor = Number.isNaN(deltaNum)
        ? "#9ca3af"
        : (deltaNum < 0) === goodDown
          ? "#10b981"
          : "#ef4444";
      return (
        <div data-type="statCard" style={{ background: "#15151c", border: "1px solid #23232e", borderRadius: 12, padding: 14, minWidth: 120 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#9ca3af", fontSize: 12 }}>
            {cfg.icon ? <span aria-hidden>{cfg.icon}</span> : null}
            <span>{cfg.label}</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 4 }}>
            <span style={{ color: cfg.color ?? "#e5e7eb", fontSize: 26, fontWeight: 700 }}>{String(value)}</span>
            {cfg.unit ? <span style={{ color: "#9ca3af", fontSize: 13 }}>{cfg.unit}</span> : null}
          </div>
          {delta != null && String(delta) !== "" ? (
            <div style={{ color: deltaColor, fontSize: 12, marginTop: 2 }}>
              {!Number.isNaN(deltaNum) && deltaNum > 0 ? "▲" : !Number.isNaN(deltaNum) && deltaNum < 0 ? "▼" : ""} {String(delta)}
            </div>
          ) : null}
        </div>
      );
    }

    // ── Containers (view/scroll/card/form/modal/…) ────────────
    default:
      return (
        <Container component={component} engine={engine} projectId={projectId} context={context} />
      );
  }
}

function Container({
  component,
  engine,
  projectId,
  context,
}: {
  component: ComponentSchema;
  engine: BindingEngine;
  projectId?: string;
  context?: Record<string, unknown>;
}) {
  const children = component.children ?? [];
  return (
    <div data-type={component.type}>
      {children.map((ch) => (
        <RenderNode
          key={ch.id}
          component={ch}
          engine={engine}
          projectId={projectId}
          context={context}
        />
      ))}
    </div>
  );
}

function Chart({ cfg, rows }: { cfg: ChartConfig; rows: Record<string, unknown>[] }) {
  const W = 320;
  const H = typeof cfg.height === "number" ? cfg.height : 180;
  const pad = 24;
  const color = cfg.color ?? "#6366f1";
  const data = (cfg.maxPoints ? rows.slice(-cfg.maxPoints) : rows).map((r) => ({
    x: String(r[cfg.xKey] ?? ""),
    y: Number(r[cfg.yKey] ?? 0),
  }));

  if (data.length === 0) {
    return (
      <div data-type="chart" style={{ height: H, borderRadius: 8, background: "#15151c", border: "1px solid #23232e", display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280", fontSize: 12 }}>
        {cfg.title ? `${cfg.title}: ` : ""}No data
      </div>
    );
  }

  const ys = data.map((d) => d.y);
  const min = Math.min(...ys, 0);
  const max = Math.max(...ys, 1);
  const span = max - min || 1;
  const innerW = W - pad * 2;
  const innerH = H - pad * 2;
  const px = (i: number) => pad + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const py = (y: number) => pad + innerH - ((y - min) / span) * innerH;

  return (
    <div data-type="chart" style={{ background: "#15151c", border: "1px solid #23232e", borderRadius: 12, padding: 10 }}>
      {cfg.title ? <div style={{ color: "#9ca3af", fontSize: 12, marginBottom: 4 }}>{cfg.title}</div> : null}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img">
        {cfg.showGrid !== false && [0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={pad} x2={W - pad} y1={pad + innerH * f} y2={pad + innerH * f} stroke="#23232e" strokeWidth={1} />
        ))}
        {cfg.type === "bar" ? (
          data.map((d, i) => {
            const bw = Math.max(4, (innerW / data.length) * 0.6);
            return <rect key={i} x={px(i) - bw / 2} y={py(d.y)} width={bw} height={pad + innerH - py(d.y)} rx={2} fill={color} />;
          })
        ) : (
          <>
            {cfg.type === "area" && (
              <polygon
                points={`${pad},${pad + innerH} ${data.map((d, i) => `${px(i)},${py(d.y)}`).join(" ")} ${W - pad},${pad + innerH}`}
                fill={color} opacity={0.18}
              />
            )}
            <polyline points={data.map((d, i) => `${px(i)},${py(d.y)}`).join(" ")} fill="none" stroke={color} strokeWidth={2} />
            {data.map((d, i) => <circle key={i} cx={px(i)} cy={py(d.y)} r={2.5} fill={color} />)}
          </>
        )}
        {cfg.showValues && data.map((d, i) => (
          <text key={i} x={px(i)} y={py(d.y) - 6} fill="#9ca3af" fontSize={9} textAnchor="middle">{d.y}</text>
        ))}
      </svg>
    </div>
  );
}

function TabsRenderer({
  component,
  engine,
  projectId,
  context,
}: {
  component: ComponentSchema;
  engine: BindingEngine;
  projectId?: string;
  context?: Record<string, unknown>;
}) {
  const config = component.props as unknown as TabsConfig;
  const tabs = config.tabs ?? [];
  const [active, setActive] = React.useState<string>(tabs[0]?.key ?? "");
  const activeTab = tabs.find((t) => t.key === active) ?? tabs[0];
  const children = component.children ?? [];
  const content = activeTab?.content
    ? children.filter((c) => c.id === activeTab.content)
    : children;

  return (
    <div data-testid="tabs">
      <div role="tablist" style={{ display: "flex", gap: 8 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === active}
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {content.map((c) => (
          <RenderNode
            key={c.id}
            component={c}
            engine={engine}
            projectId={projectId}
            context={context}
          />
        ))}
      </div>
    </div>
  );
}
