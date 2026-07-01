// ═══════════════════════════════════════════════════════════════
// SchemaRenderer — Runtime React dispatch for ComponentSchema trees
//
// Switches on ComponentSchema.type to produce JSX. Reuses the existing
// BindingEngine (lib/runtime/bindings) for prop / visibility / list
// resolution and the rich runtime components for data/UX types.
//
// When wrapped in a <RuntimeProvider>, it becomes interactive:
//   • component.style → real inline styles (styleToCss)
//   • component.events (onClick/onPress/onChange…) → ActionRegistry dispatch
//   • bound inputs → two-way state binding
//   • re-renders on any state change
// Without a provider (static render / tests) it degrades gracefully:
// styles still apply, events are no-ops.
// ═══════════════════════════════════════════════════════════════
"use client";

import React from "react";
import type { ComponentSchema } from "@/lib/runtime/schema";
import { StateEngine } from "@/lib/runtime/state";
import { BindingEngine } from "@/lib/runtime/bindings";
import { styleToCss } from "@/lib/runtime/styleToCss";
import { useRuntime, type RuntimeHandle } from "@/components/runtime/RuntimeProvider";
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

/** Re-render the subtree whenever any state value changes. */
function useRerenderOnState(state?: StateEngine): void {
  const [, force] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => {
    if (!state) return;
    const unsub = state.subscribeAll(() => force());
    return unsub;
  }, [state]);
}

export default function SchemaRenderer({
  components,
  state,
  bindingEngine,
  projectId,
}: SchemaRendererProps) {
  const runtime = useRuntime();

  const engine = React.useMemo(
    () =>
      bindingEngine ??
      runtime?.bindingEngine ??
      new BindingEngine(state ?? runtime?.state ?? new StateEngine()),
    [bindingEngine, runtime, state]
  );

  // Subscribe to the underlying state engine so bindings stay live.
  useRerenderOnState(state ?? runtime?.state);

  return (
    <>
      {components.map((c) => (
        <RenderNode key={c.id} component={c} engine={engine} runtime={runtime} projectId={projectId} />
      ))}
    </>
  );
}

// ── Event wiring ──────────────────────────────────────────────

/** Build a click handler from a component's events (onClick / onPress). */
function clickHandler(
  component: ComponentSchema,
  runtime: RuntimeHandle | null,
  context?: Record<string, unknown>
): ((e: React.MouseEvent) => void) | undefined {
  const refs = component.events?.onClick ?? component.events?.onPress;
  if (!runtime || !refs?.length) return undefined;
  return (e) => { void runtime.dispatch(refs, e, context); };
}

/** Resolve the two-way bound state expression for an input-like component. */
function valueBinding(component: ComponentSchema): string | undefined {
  return component.bindings?.value ?? component.bindings?.inputBind;
}

// ── Recursive dispatch ────────────────────────────────────────

function RenderNode({
  component,
  engine,
  runtime,
  projectId,
  context,
}: {
  component: ComponentSchema;
  engine: BindingEngine;
  runtime: RuntimeHandle | null;
  projectId?: string;
  context?: Record<string, unknown>;
}) {
  engine.compileBindings(component);
  if (!engine.isVisible(component, context)) return null;

  const resolved = engine.resolveProps(component, context);
  const props = component.props as Record<string, unknown>;
  const css = styleToCss(component.style);
  const onClick = clickHandler(component, runtime, context);

  // Any container bound to data (repeatFor) becomes a live list: render the
  // component's children once per row with the loop var (`as`) in context.
  // list/grid have their own handling below.
  if (component.repeatFor && component.type !== "list" && component.type !== "grid") {
    const items = engine.resolveListItems(component);
    const as = component.repeatFor.as;
    const children = component.children ?? [];
    return (
      <div data-repeat={component.type} style={css}>
        {items.map((item, i) => (
          <div key={i} data-index={i}>
            {children.map((ch) => (
              <RenderNode
                key={ch.id}
                component={ch}
                engine={engine}
                runtime={runtime}
                projectId={projectId}
                context={{ ...context, [as]: item }}
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  switch (component.type) {
    // ── Rich data components ──────────────────────────────────
    case "dataTable": {
      const data = Array.isArray(resolved.dataSource)
        ? (resolved.dataSource as Record<string, unknown>[])
        : [];
      return withStyle(css, <DataTable config={props as unknown as DataTableConfig} data={data} />);
    }

    case "timeline": {
      const data = Array.isArray(resolved.dataSource)
        ? (resolved.dataSource as Record<string, unknown>[])
        : [];
      return withStyle(css, <Timeline config={props as unknown as TimelineConfig} data={data} />);
    }

    case "fileUpload": {
      return withStyle(css, <FileUpload config={props as unknown as FileUploadConfig} projectId={projectId} />);
    }

    case "tabs": {
      return (
        <TabsRenderer
          component={component}
          engine={engine}
          runtime={runtime}
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
          <div data-type={component.type} style={css}>
            {items.map((item, i) => (
              <div key={i} data-index={i}>
                {children.map((ch) => (
                  <RenderNode
                    key={ch.id}
                    component={ch}
                    engine={engine}
                    runtime={runtime}
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
        <Container component={component} engine={engine} runtime={runtime} projectId={projectId} context={context} />
      );
    }

    // ── Leaf primitives ───────────────────────────────────────
    case "text": {
      const value = resolved.text ?? resolved.value ?? props.text ?? props.value;
      const text = value != null ? String(value) : null;
      const role = (props.textRole ?? props._textRole) as string | undefined;
      if (role === "h1") return <h1 style={css}>{text}</h1>;
      if (role === "h2") return <h2 style={css}>{text}</h2>;
      if (role === "h3") return <h3 style={css}>{text}</h3>;
      if (role === "p") return <p style={css}>{text}</p>;
      if (role === "label") return <label style={css}>{text}</label>;
      if (role === "code") return <code style={css}>{text}</code>;
      return <span style={css}>{text}</span>;
    }

    case "button": {
      const label = resolved.text ?? resolved.label ?? props.text ?? props.label;
      const disabled = Boolean(resolved.disabled ?? props.disabled);
      return (
        <button type="button" style={css} onClick={onClick} disabled={disabled}>
          {label != null ? String(label) : null}
        </button>
      );
    }

    case "input": {
      const bind = valueBinding(component);
      const value = resolved.value ?? props.value;
      const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value;
        if (bind) engine.createTwoWayHandler(bind)(v);
        if (runtime && component.events?.onChange?.length) {
          void runtime.dispatch(component.events.onChange, e, { ...context, value: v });
        }
      };
      const common = {
        style: css,
        placeholder: props.placeholder != null ? String(props.placeholder) : "",
        type: props.inputType != null ? String(props.inputType) : "text",
      };
      // Controlled when bound to state; uncontrolled otherwise.
      return bind || (runtime && component.events?.onChange)
        ? <input {...common} value={value != null ? String(value) : ""} onChange={onChange} />
        : <input {...common} defaultValue={value != null ? String(value) : ""} />;
    }

    case "select": {
      // Options may be ["a","b"] or [{ value, label }]; also accept enumValues.
      const raw = (props.options ?? props.enumValues ?? []) as unknown[];
      const options = raw.map((o) =>
        o != null && typeof o === "object"
          ? (o as { value: unknown; label?: unknown })
          : { value: o, label: o }
      );
      const bind = valueBinding(component);
      const value = resolved.value ?? props.value;
      const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const v = e.target.value;
        if (bind) engine.createTwoWayHandler(bind)(v);
        if (runtime && component.events?.onChange?.length) {
          void runtime.dispatch(component.events.onChange, e, { ...context, value: v });
        }
      };
      const controlled = bind || (runtime && component.events?.onChange);
      return (
        <select
          style={css}
          data-type="select"
          {...(controlled
            ? { value: value != null ? String(value) : "", onChange }
            : { defaultValue: value != null ? String(value) : "" })}
        >
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
      const bind = valueBinding(component) ?? component.bindings?.checked;
      const checked = Boolean(resolved.value ?? resolved.checked ?? props.value ?? props.checked);
      const label = resolved.label ?? props.label;
      const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.checked;
        if (bind) engine.createTwoWayHandler(bind)(v);
        if (runtime && component.events?.onChange?.length) {
          void runtime.dispatch(component.events.onChange, e, { ...context, value: v });
        }
      };
      const controlled = bind || (runtime && component.events?.onChange);
      return (
        <label data-type={component.type} style={css}>
          <input
            type="checkbox"
            role={component.type === "switch" ? "switch" : undefined}
            {...(controlled ? { checked, onChange } : { defaultChecked: checked })}
          />
          {label != null ? <span>{String(label)}</span> : null}
        </label>
      );
    }

    case "statusChip": {
      const value = resolved.value ?? props.value ?? "";
      return <span data-type="statusChip" style={css}>{String(value)}</span>;
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
            style={{ height, borderRadius: radius, background: "#1f2937", display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280", fontSize: 12, ...css }}
          >
            No image
          </div>
        );
      }
      return (
        <img
          src={String(src)}
          alt={props.alt != null ? String(props.alt) : ""}
          style={{ width: "100%", height, objectFit: ((props.imageFit ?? props.fit) as React.CSSProperties["objectFit"]) ?? "cover", borderRadius: radius, display: "block", ...css }}
        />
      );
    }

    case "camera": {
      // Web preview captures via the file input (with `capture` for mobile web).
      return (
        <label
          data-type="camera"
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: "#6366f1", color: "#fff", fontSize: 14, cursor: "pointer", ...css }}
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
      return withStyle(css, <Chart cfg={cfg} rows={rows} />);
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
        <div data-type="statCard" style={{ background: "#15151c", border: "1px solid #23232e", borderRadius: 12, padding: 14, minWidth: 120, ...css }}>
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

    // ── Free-form frame layer ─────────────────────────────────
    case "frame": {
      const inputType = (props.inputType ?? props._inputType) as string | undefined;

      if (inputType === "textarea") {
        const bind = valueBinding(component);
        const value = resolved.value ?? props.value;
        const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
          const v = e.target.value;
          if (bind) engine.createTwoWayHandler(bind)(v);
          if (runtime && component.events?.onChange?.length) void runtime.dispatch(component.events.onChange, e, { ...context, value: v });
        };
        const common = { style: css, placeholder: props.placeholder != null ? String(props.placeholder) : "" };
        return bind || (runtime && component.events?.onChange)
          ? <textarea {...common} value={value != null ? String(value) : ""} onChange={onChange} />
          : <textarea {...common} defaultValue={value != null ? String(value) : ""} />;
      }

      if (inputType && inputType !== "select") {
        const bind = valueBinding(component);
        const value = resolved.value ?? props.value;
        const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          const v = e.target.value;
          if (bind) engine.createTwoWayHandler(bind)(v);
          if (runtime && component.events?.onChange?.length) void runtime.dispatch(component.events.onChange, e, { ...context, value: v });
        };
        const common = { style: css, placeholder: props.placeholder != null ? String(props.placeholder) : "", type: inputType };
        return bind || (runtime && component.events?.onChange)
          ? <input {...common} value={value != null ? String(value) : ""} onChange={onChange} />
          : <input {...common} defaultValue={value != null ? String(value) : ""} />;
      }

      if (inputType === "select") {
        const raw = (props.selectOptions ?? props.options ?? []) as unknown[];
        const options = raw.map((o) => typeof o === "string" ? { value: o, label: o } : o as { value: unknown; label?: unknown });
        const bind = valueBinding(component);
        const value = resolved.value ?? props.value;
        const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
          const v = e.target.value;
          if (bind) engine.createTwoWayHandler(bind)(v);
          if (runtime && component.events?.onChange?.length) void runtime.dispatch(component.events.onChange, e, { ...context, value: v });
        };
        return (
          <select style={css} value={value != null ? String(value) : ""} onChange={onChange}>
            {props.placeholder != null && <option value="">{String(props.placeholder)}</option>}
            {options.map((o, i) => <option key={i} value={String((o as { value: unknown }).value)}>{String((o as { value: unknown; label?: unknown }).label ?? (o as { value: unknown }).value)}</option>)}
          </select>
        );
      }

      if (component.repeatFor) {
        const items = engine.resolveListItems(component);
        const as = component.repeatFor.as;
        const children = component.children ?? [];
        return (
          <div data-type="frame" style={css} onClick={onClick}>
            {items.map((item, i) => (
              <React.Fragment key={i}>
                {children.map((ch) => (
                  <RenderNode key={ch.id} component={ch} engine={engine} runtime={runtime} projectId={projectId} context={{ ...context, [as]: item }} />
                ))}
              </React.Fragment>
            ))}
          </div>
        );
      }
      return <Container component={component} engine={engine} runtime={runtime} projectId={projectId} context={context} onClick={onClick} css={css} />;
    }

    // ── Containers (view/scroll/card/form/modal/…) ────────────
    default:
      return (
        <Container component={component} engine={engine} runtime={runtime} projectId={projectId} context={context} onClick={onClick} css={css} />
      );
  }
}

/** Wrap a node in a styled div only when there are styles to apply. */
function withStyle(css: React.CSSProperties, node: React.ReactNode): React.ReactElement {
  if (Object.keys(css).length === 0) return <>{node}</>;
  return <div style={css}>{node}</div>;
}

function Container({
  component,
  engine,
  runtime,
  projectId,
  context,
  onClick,
  css,
}: {
  component: ComponentSchema;
  engine: BindingEngine;
  runtime: RuntimeHandle | null;
  projectId?: string;
  context?: Record<string, unknown>;
  onClick?: (e: React.MouseEvent) => void;
  css?: React.CSSProperties;
}) {
  const children = component.children ?? [];
  const style = css ?? styleToCss(component.style);
  const handler = onClick ?? clickHandler(component, runtime, context);
  return (
    <div data-type={component.type} style={style} onClick={handler}>
      {children.map((ch) => (
        <RenderNode
          key={ch.id}
          component={ch}
          engine={engine}
          runtime={runtime}
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
  runtime,
  projectId,
  context,
}: {
  component: ComponentSchema;
  engine: BindingEngine;
  runtime: RuntimeHandle | null;
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
    <div data-testid="tabs" style={styleToCss(component.style)}>
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
            runtime={runtime}
            projectId={projectId}
            context={context}
          />
        ))}
      </div>
    </div>
  );
}
