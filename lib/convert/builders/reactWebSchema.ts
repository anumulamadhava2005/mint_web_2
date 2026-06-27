// ═══════════════════════════════════════════════════════════════
// reactWebSchema — AppSchema → React (Vite) emitter
//
// The web counterpart of reactNativeSchema.ts. Consumes
// AppSchema.screens[].components[] (ComponentSchema) and emits a Vite +
// React + react-router app whose behaviour is driven by the REAL Mint
// runtime (lib/runtime/bundle.ts → createMintRuntime): generic action
// dispatch (navigate/setState/fetch/mutate/condition/…), state, and
// expression bindings — NOT hand-written stubs. Styles are precomputed
// at build time via styleToCss and embedded per component id.
// ═══════════════════════════════════════════════════════════════

import type { AppSchema, ComponentSchema } from "../../runtime/schema";
import { generateMintRuntimeBundle } from "../../runtime/bundle";
import { styleToCss } from "../../runtime/styleToCss";

export interface GeneratedFile {
  path: string;
  content: string;
  type: "text";
}

export interface WebSchemaOptions {
  projectId: string;
  appName?: string;
  apiOrigin?: string;
  authToken?: string;
}

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "app";

/** Precompute styleToCss for every component id across all screens. */
export function collectStyles(schema: AppSchema): Record<string, object> {
  const out: Record<string, object> = {};
  const walk = (comps: ComponentSchema[] | undefined) => {
    for (const c of comps ?? []) {
      const css = styleToCss(c.style);
      if (Object.keys(css).length) out[c.id] = css;
      if (c.children?.length) walk(c.children);
    }
  };
  for (const s of schema.screens ?? []) walk(s.components);
  return out;
}

// ── Generated runtime files (strings) ───────────────────────────

function providerFile(opts: WebSchemaOptions): string {
  const bakedOrigin = opts.apiOrigin || "";
  const bakedToken = opts.authToken || "";
  return `import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createMintRuntime, configureMint } from "./mint-runtime.js";
import { SCHEMA, ROUTES } from "./schema.js";

// Backend origin + project token. Override per-environment with a .env file
// (Vite inlines VITE_* at build time); falls back to the values baked at export.
const API_ORIGIN = (import.meta.env && import.meta.env.VITE_MINT_API_ORIGIN) || ${JSON.stringify(bakedOrigin)};
const MINT_TOKEN = (import.meta.env && import.meta.env.VITE_MINT_TOKEN) || ${JSON.stringify(bakedToken)};
// Must run before createMintRuntime so the DB client picks up base + token.
configureMint({ apiOrigin: API_ORIGIN, authToken: MINT_TOKEN });

const Ctx = createContext(null);
export function useMint() { return useContext(Ctx); }

function routeFor(target) {
  if (!target) return "/";
  if (ROUTES[target]) return ROUTES[target];           // screenId → path
  return String(target)[0] === "/" ? String(target) : "/" + target;
}

export function MintProvider({ children }) {
  const ref = useRef(null);
  if (!ref.current) ref.current = createMintRuntime(SCHEMA);
  const runtime = ref.current;
  const navigate = useNavigate();
  const [, force] = useReducer((x) => x + 1, 0);

  // Re-render the whole tree whenever any state changes (preview-grade).
  useEffect(() => runtime.state.subscribe("", () => force()), []);

  const navigation = useMemo(() => ({
    navigate: (r) => navigate(routeFor(r)),
    goBack: () => navigate(-1),
    replace: (r) => navigate(routeFor(r), { replace: true }),
    reset: (routes) => { if (routes && routes[0]) navigate(routeFor(routes[0])); },
  }), [navigate]);

  const dispatch = useMemo(() => (refs, event) => {
    const list = Array.isArray(refs) ? refs : [refs];
    for (const r of list) Promise.resolve(runtime.actions.dispatch(r, { navigation, event })).catch((e) => {
      const msg = (e && e.message) || String(e);
      console.error("[mint] action failed:", msg);
      runtime.state.set("_lastError", msg); // bind a component to $_lastError to surface it
    });
  }, [navigation]);

  // Auto-fetch: dispatch the source action for any global async state on load.
  useEffect(() => {
    for (const d of (SCHEMA.globalState || [])) {
      if (d && d.async && d.async.autoFetch && d.async.source) dispatch([d.async.source]);
    }
  }, [dispatch]);

  const value = useMemo(() => ({ runtime, dispatch, navigation }), [dispatch, navigation]);
  return React.createElement(Ctx.Provider, { value }, children);
}
`;
}

export function rendererFile(): string {
  return `"use client";
import React from "react";
import { useMint } from "./MintProvider.jsx";
import { STYLES } from "./styles.js";

// Screen = the list of top-level components for a route.
export function Screen({ components, background }) {
  return (
    <div style={{ minHeight: "100vh", background: background || "#fff" }}>
      {(components || []).map((c) => <Node key={c.id} comp={c} />)}
    </div>
  );
}

// ScreenHost wraps a Screen and runs its onMount actions + async auto-fetch.
export function ScreenHost({ screen, background }) {
  const { dispatch } = useMint();
  React.useEffect(() => {
    (screen.onMount || []).forEach((a) => dispatch([a]));
    (screen.localState || []).forEach((d) => { if (d.async && d.async.autoFetch && d.async.source) dispatch([d.async.source]); });
    // eslint-disable-next-line
  }, [screen.id]);
  return <Screen components={screen.components} background={background} />;
}

function Node({ comp, loopCtx }) {
  const { runtime, dispatch } = useMint();
  const ctx = { ...runtime.state.getContext(), ...(loopCtx || {}) };

  // visibility (role + conditionalRender)
  if (comp.requiredRoles && comp.requiredRoles.length) {
    const role = ctx.user && ctx.user.role;
    if (!role || comp.requiredRoles.indexOf(role) === -1) return null;
  }
  if (comp.conditionalRender) {
    try { if (!runtime.evalExpr(comp.conditionalRender, ctx)) return null; } catch {}
  }

  // resolve bound props
  const props = { ...(comp.props || {}) };
  const b = comp.bindings || {};
  for (const k in b) { try { props[k] = runtime.evalExpr(b[k], ctx); } catch {} }

  const style = STYLES[comp.id] || {};
  const fire = (refs, e) => { if (refs && refs.length) dispatch(refs, e); };
  const ev = comp.events || {};
  const kids = (lc) => (comp.children || []).map((ch) => <Node key={ch.id} comp={ch} loopCtx={lc || loopCtx} />);

  const setBound = (key, v) => { const expr = b[key]; if (expr) runtime.state.set(String(expr).replace(/^\\$/, ""), v); };

  switch (comp.type) {
    case "text":
      return <span style={style}>{String(props.text ?? props.value ?? "")}</span>;

    case "button":
      return <button type="button" style={style} disabled={!!props.disabled} onClick={(e) => fire(ev.onClick || ev.onPress, e)}>{String(props.text ?? props.label ?? "Button")}</button>;

    case "input": {
      const bind = b.value || b.inputBind;
      const common = { style, placeholder: props.placeholder != null ? String(props.placeholder) : "", type: props.inputType ? String(props.inputType) : "text" };
      const onChange = (e) => { if (bind) runtime.state.set(String(bind).replace(/^\\$/, ""), e.target.value); fire(ev.onChange, e); };
      return bind || ev.onChange
        ? <input {...common} value={props.value != null ? String(props.value) : ""} onChange={onChange} />
        : <input {...common} defaultValue={props.value != null ? String(props.value) : ""} />;
    }

    case "select": {
      const bind = b.value || b.inputBind;
      const raw = props.options || props.enumValues || [];
      const opts = raw.map((o) => (o && typeof o === "object") ? o : { value: o, label: o });
      const onChange = (e) => { if (bind) runtime.state.set(String(bind).replace(/^\\$/, ""), e.target.value); fire(ev.onChange, e); };
      return (
        <select style={style} value={props.value != null ? String(props.value) : ""} onChange={onChange}>
          {props.placeholder != null && <option value="">{String(props.placeholder)}</option>}
          {opts.map((o, i) => <option key={i} value={String(o.value)}>{String(o.label ?? o.value)}</option>)}
        </select>
      );
    }

    case "checkbox":
    case "switch": {
      const bind = b.value || b.checked;
      const checked = !!(props.value ?? props.checked);
      const onChange = (e) => { if (bind) runtime.state.set(String(bind).replace(/^\\$/, ""), e.target.checked); fire(ev.onChange, e); };
      return <label style={style}><input type="checkbox" checked={checked} onChange={onChange} />{props.label != null ? <span>{String(props.label)}</span> : null}</label>;
    }

    case "image":
      return props.src ? <img src={String(props.src)} alt={props.alt ? String(props.alt) : ""} style={{ display: "block", ...style }} /> : <div style={{ background: "#e5e7eb", ...style }} />;

    case "statusChip":
      return <span style={style}>{String(props.value ?? "")}</span>;

    case "list":
    case "grid": {
      if (comp.repeatFor) {
        let items = [];
        try { const v = runtime.evalExpr(comp.repeatFor.items, ctx); items = Array.isArray(v) ? v : []; } catch {}
        const as = comp.repeatFor.as || "item";
        return <div style={style}>{items.map((it, i) => <div key={i}>{(comp.children || []).map((ch) => <Node key={ch.id} comp={ch} loopCtx={{ ...loopCtx, [as]: it }} />)}</div>)}</div>;
      }
      return <div style={style}>{kids()}</div>;
    }

    case "dataTable": {
      const rows = Array.isArray(props.dataSource) ? props.dataSource : [];
      const cols = props.columns || [];
      return (
        <table style={{ width: "100%", borderCollapse: "collapse", ...style }}>
          <thead><tr>{cols.map((c, i) => <th key={i} style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 6 }}>{c.label || c.key}</th>)}</tr></thead>
          <tbody>{rows.map((r, ri) => <tr key={ri}>{cols.map((c, ci) => <td key={ci} style={{ borderBottom: "1px solid #f1f1f4", padding: 6 }}>{String(r[c.key] ?? "")}</td>)}</tr>)}</tbody>
        </table>
      );
    }

    case "divider":
      return <div style={{ height: 1, background: "#e5e7eb", ...style }} />;

    default: // view, card, form, scroll, modal, container
      return <div style={style} onClick={ev.onClick ? (e) => fire(ev.onClick, e) : undefined}>{kids()}</div>;
  }
}
`;
}

function appFile(): string {
  return `import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { SCHEMA, THEME_BG } from "./schema.js";
import { ScreenHost } from "./SchemaRenderer.jsx";

export default function App() {
  const screens = SCHEMA.screens || [];
  const initial = (SCHEMA.navigation && SCHEMA.navigation.initialRoute) || (screens[0] && screens[0].route) || "/";
  return (
    <Routes>
      {initial !== "/" && <Route path="/" element={<Navigate to={initial} replace />} />}
      {screens.map((s) => (
        <Route key={s.id} path={s.route} element={<ScreenHost screen={s} background={THEME_BG} />} />
      ))}
      <Route path="*" element={<Navigate to={initial} replace />} />
    </Routes>
  );
}
`;
}

// ── Public entry ────────────────────────────────────────────────

export function buildReactWebFromSchema(schema: AppSchema, opts: WebSchemaOptions): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const appName = opts.appName || schema.name || "Mint App";
  const name = slug(appName);

  // screenId → route path (for navigate-by-id)
  const routesMap: Record<string, string> = {};
  for (const s of schema.screens ?? []) routesMap[s.id] = s.route;

  const themeBg = (schema.theme?.colors?.background as string) || "#ffffff";

  // schema.js — the embedded AppSchema + helper maps
  files.push({
    path: "src/schema.js",
    type: "text",
    content: `// Auto-generated — the runtime AppSchema this app is driven by.
export const SCHEMA = ${JSON.stringify(schema)};
export const ROUTES = ${JSON.stringify(routesMap)};
export const THEME_BG = ${JSON.stringify(themeBg)};
`,
  });

  // styles.js — precomputed inline styles per component id
  files.push({
    path: "src/styles.js",
    type: "text",
    content: `// Auto-generated — styleToCss output keyed by component id.
export const STYLES = ${JSON.stringify(collectStyles(schema))};
`,
  });

  // mint-runtime.js — the real embedded runtime engine
  files.push({ path: "src/mint-runtime.js", type: "text", content: generateMintRuntimeBundle() });
  files.push({ path: "src/MintProvider.jsx", type: "text", content: providerFile(opts) });
  files.push({ path: "src/SchemaRenderer.jsx", type: "text", content: rendererFile() });
  files.push({ path: "src/App.jsx", type: "text", content: appFile() });

  files.push({
    path: "src/main.jsx",
    type: "text",
    content: `import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MintProvider } from "./MintProvider.jsx";
import App from "./App.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <MintProvider>
        <App />
      </MintProvider>
    </BrowserRouter>
  </React.StrictMode>
);
`,
  });

  files.push({
    path: "src/index.css",
    type: "text",
    content: `* { box-sizing: border-box; }
html, body, #root { margin: 0; padding: 0; height: 100%; }
body { font-family: Inter, system-ui, -apple-system, sans-serif; }
button { font: inherit; cursor: pointer; }
input, select { font: inherit; }
`,
  });

  files.push({
    path: "index.html",
    type: "text",
    content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${appName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`,
  });

  files.push({
    path: "vite.config.js",
    type: "text",
    content: `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({ plugins: [react()] });
`,
  });

  files.push({
    path: "package.json",
    type: "text",
    content: JSON.stringify({
      name,
      private: true,
      version: "1.0.0",
      type: "module",
      scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
      dependencies: {
        react: "^18.3.1",
        "react-dom": "^18.3.1",
        "react-router-dom": "^6.26.2",
      },
      devDependencies: {
        "@vitejs/plugin-react": "^4.3.1",
        vite: "^5.4.0",
      },
    }, null, 2),
  });

  files.push({
    path: ".env.example",
    type: "text",
    content: `# Copy to .env and restart \`npm run dev\` to apply. Vite inlines VITE_* at build.

# Backend the app's auth/fetch/DB calls target. Baked default points at the
# Mint editor you exported from; override for staging/production.
VITE_MINT_API_ORIGIN=${opts.apiOrigin || "https://mintweb.mintit.pro"}

# Project token authenticating managed-DB + auth calls. Treat as a secret;
# set it in your host's env (Vercel/Netlify project settings), not in git.
# (A working default is already baked into the export; override here.)
VITE_MINT_TOKEN=
`,
  });

  files.push({
    path: "README.md",
    type: "text",
    content: `# ${appName}

Generated by Mint — a React (Vite) app driven by your runtime schema.

- \`src/schema.js\` — the embedded AppSchema (screens, state, actions, navigation).
- \`src/mint-runtime.js\` — the embedded Mint runtime (state + action dispatch + bindings).
- \`src/MintProvider.jsx\` — wires the runtime to React + react-router.
- \`src/SchemaRenderer.jsx\` — renders ComponentSchema trees; events dispatch real actions.

## Run

\`\`\`bash
npm install
npm run dev
\`\`\`

Actions (navigate, setState, fetch, mutate, condition, signIn/out, …) execute
through the embedded runtime — the same engine the Mint editor previews with.

## Configure the backend (auth + database)

Auth, \`fetch\`, and database calls go to **\`VITE_MINT_API_ORIGIN\`** with
**\`VITE_MINT_TOKEN\`** as a bearer token. Both are baked at export time and
overridable via env. Copy \`.env.example\` to \`.env\` and set them:

\`\`\`bash
cp .env.example .env
# edit .env: point VITE_MINT_API_ORIGIN at your Mint backend + set VITE_MINT_TOKEN
npm run dev
\`\`\`

If you see \`401\` errors or "set MINT_TOKEN" in the console, the token is
missing or wrong for the target origin.

## Deploy (Vercel / Netlify)

1. Build command \`npm run build\`, output dir \`dist\`.
2. Set env vars in the host's project settings:
   - \`VITE_MINT_API_ORIGIN\` = your Mint backend origin
   - \`VITE_MINT_TOKEN\` = your project token
3. This is a client-side SPA (react-router) — enable SPA fallback (rewrite all
   routes to \`/index.html\`). Vercel: add a rewrite \`{ "source": "/(.*)", "destination": "/" }\`.

## Editing this code

\`src/schema.js\`, \`src/styles.js\`, \`src/mint-runtime.js\`, \`src/SchemaRenderer.jsx\`,
and \`src/MintProvider.jsx\` are **generated** — a re-export from Mint overwrites
them. Keep hand-written code in new files you add, and import it from there.
`,
  });

  return files;
}
