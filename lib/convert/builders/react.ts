// ═══════════════════════════════════════════════════════════════
// React (Vite) Builder — v4.0.0
// Generates a complete Vite + React SPA with react-router-dom
// Each top-level frame = a routed page
// Overlays, transitions, hover states
// ═══════════════════════════════════════════════════════════════

import type {
  DrawableNode,
  ImageManifest,
  ConversionOptions,
  GeneratedFile,
  Interaction,
  FrameworkBuilder,
} from "../types";
import { generateMintRuntimeBundle } from "../../runtime/bundle";
import { renderJSX } from "../core/render";
import { generateImagesDocument, collectImages } from "../core/images";
import {
  buildFrameRoutes,
  buildRouteMap,
  rewriteInteractionsForRouting,
  type FrameRoute,
} from "../core/routing";
import {
  analyzeOverlays,
  generateOverlayCSS,
  generateReactOverlayProvider,
  generateReactOverlayComponent,
  type OverlayFrame,
} from "../core/overlays";
import {
  generatePageTransitionCSS,
  buildTransitionMap,
} from "../core/transitions";
import { generateMintRuntimeProvider } from "../core/mintRuntime";
import { hasMintBindings } from "../core/render";

export const reactBuilder: FrameworkBuilder = {
  name: "react",
  displayName: "React (Vite)",
  version: "4.0.0",

  async build(
    nodes: DrawableNode[],
    options: ConversionOptions,
    manifest: ImageManifest,
    interactions: Interaction[]
  ): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    const useTs = options.generateTypeScript !== false;
    const ext = useTs ? "tsx" : "jsx";

    // ── Analyze overlays ──────────────────────────────────────
    const overlayAnalysis = analyzeOverlays(nodes, interactions);
    const { pageFrames, overlayFrames, hasOverlays } = overlayAnalysis;

    // ── Build route map (only page frames) ────────────────────
    const routes = buildFrameRoutes(pageFrames);
    const routeMap = buildRouteMap(routes);
    const routedInteractions = rewriteInteractionsForRouting(interactions, routeMap);
    const hasNavigateInteractions = interactions.some(
      (i) => i.action === "NAVIGATE" && i.targetId
    );

    // ── Check if any node has runtime bindings ──────────────
    const hasRuntimeBindings = hasMintBindings(nodes) || !!options.runtimeSchema;

    // package.json
    files.push({
      path: "package.json",
      content: JSON.stringify(
        {
          name: options.fileName?.toLowerCase().replace(/\s+/g, "-") || "design-export",
          private: true,
          version: "0.1.0",
          type: "module",
          scripts: {
            dev: "vite",
            build: "vite build",
            preview: "vite preview",
          },
          dependencies: {
            react: "^18.2.0",
            "react-dom": "^18.2.0",
            "react-router-dom": "^6.20.0",
          },
          devDependencies: {
            "@types/react": "^18.2.0",
            "@types/react-dom": "^18.2.0",
            "@vitejs/plugin-react": "^4.2.0",
            typescript: "^5.3.0",
            vite: "^5.0.0",
          },
        },
        null,
        2
      ),
      type: "text",
    });

    // vite.config.ts
    files.push({
      path: `vite.config.${useTs ? "ts" : "js"}`,
      content: `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
  },
});
`,
      type: "text",
    });

    // tsconfig.json
    if (useTs) {
      files.push({
        path: "tsconfig.json",
        content: JSON.stringify(
          {
            compilerOptions: {
              target: "ES2020",
              useDefineForClassFields: true,
              lib: ["ES2020", "DOM", "DOM.Iterable"],
              module: "ESNext",
              skipLibCheck: true,
              moduleResolution: "bundler",
              allowImportingTsExtensions: true,
              resolveJsonModule: true,
              isolatedModules: true,
              noEmit: true,
              jsx: "react-jsx",
              strict: true,
              noUnusedLocals: true,
              noUnusedParameters: true,
              noFallthroughCasesInSwitch: true,
            },
            include: ["src"],
            references: [{ path: "./tsconfig.node.json" }],
          },
          null,
          2
        ),
        type: "text",
      });

      files.push({
        path: "tsconfig.node.json",
        content: JSON.stringify(
          {
            compilerOptions: {
              composite: true,
              skipLibCheck: true,
              module: "ESNext",
              moduleResolution: "bundler",
              allowSyntheticDefaultImports: true,
            },
            include: ["vite.config.ts"],
          },
          null,
          2
        ),
        type: "text",
      });
    }

    // index.html
    files.push({
      path: "index.html",
      content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${options.fileName || "Design Export"}</title>
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.${ext}"></script>
  </body>
</html>
`,
      type: "text",
    });

    // ── src/main.tsx — BrowserRouter wrapping ─────────────────
    files.push({
      path: `src/main.${ext}`,
      content: `import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
`,
      type: "text",
    });

    // src/globals.css
    files.push({
      path: "src/globals.css",
      content: `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body, #root {
  width: 100%;
  height: 100%;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.viewport {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #f5f5f5;
}

.frame-container {
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
}
/* Scrollable containers */
[data-scroll-x] {
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
}

[data-scroll-y] {
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

[data-scroll-both] {
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}

/* Hide scrollbars but allow scrolling */
[data-scroll-x]::-webkit-scrollbar,
[data-scroll-y]::-webkit-scrollbar,
[data-scroll-both]::-webkit-scrollbar {
  display: none;
}

[data-scroll-x],
[data-scroll-y],
[data-scroll-both] {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

[data-img-missing] {
  background: linear-gradient(45deg, #e0e0e0 25%, #f0f0f0 25%, #f0f0f0 50%, #e0e0e0 50%, #e0e0e0 75%, #f0f0f0 75%);
  background-size: 20px 20px;
}
` + generateOverlayCSS() + generatePageTransitionCSS(),
      type: "text",
    });

    // ── src/lib/mint-runtime.tsx (only if bindings exist) ─────
    if (hasRuntimeBindings) {
      files.push({
        path: `src/lib/mint-runtime.${ext}`,
        content: generateMintRuntimeProvider(options),
        type: "text",
      });
    }

    // ── Generate overlay components ───────────────────────────
    if (hasOverlays) {
      files.push({
        path: `src/components/OverlayProvider.${ext}`,
        content: generateReactOverlayProvider(overlayFrames),
        type: "text",
      });

      for (const overlay of overlayFrames) {
        const overlayContent = overlay.frame.children?.length
          ? renderJSX(overlay.frame.children, {
              indent: 6,
              useTypescript: useTs,
              includeDataAttributes: true,
              manifest,
              interactions: routedInteractions,
              overlayHandler: "openOverlay",
              closeOverlayHandler: "closeOverlay",
              swapOverlayHandler: "swapOverlay",
            })
          : "";

        files.push({
          path: `src/components/${overlay.componentName}.${ext}`,
          content: generateReactOverlayComponent(overlay, overlayContent),
          type: "text",
        });
      }
    }

    // ── src/App.tsx — Routes definition ───────────────────────
    const routeImports = routes
      .map((r) => `import ${r.componentName}Page from "./pages/${r.fileName}";`)
      .join("\n");

    const routeElements = routes
      .map(
        (r) =>
          `        <Route path="${r.routePath}" element={<${r.componentName}Page />} />`
      )
      .join("\n");

    const navLinks = "";

    const overlayImport = hasOverlays
      ? `import { OverlayProvider } from "./components/OverlayProvider";\n`
      : "";
    const wrapOpen = hasOverlays ? `      <OverlayProvider>\n` : "";
    const wrapClose = hasOverlays ? `      </OverlayProvider>\n` : "";

    const mintImport = hasRuntimeBindings
      ? `import { MintProvider } from "./lib/mint-runtime";\n`
      : "";
    const mintOpen = hasRuntimeBindings ? `      <MintProvider>\n` : "";
    const mintClose = hasRuntimeBindings ? `      </MintProvider>\n` : "";

    files.push({
      path: `src/App.${ext}`,
      content: `import { Routes, Route, Link } from "react-router-dom";
${routeImports}
${overlayImport}${mintImport}
export default function App() {
  return (
    <>
${mintOpen}${wrapOpen}      <Routes>
${routeElements}
      </Routes>
${wrapClose}${mintClose}    </>
  );
}
`,
      type: "text",
    });

    // ── src/pages/<Name>.tsx — one per frame ──────────────────
    for (const route of routes) {
      files.push({
        path: `src/pages/${route.fileName}.${ext}`,
        content: generateReactPageComponent(route, routedInteractions, manifest, useTs, hasOverlays, hasRuntimeBindings),
        type: "text",
      });
    }

    // src/lib/tokens.ts (design tokens)
    files.push({
      path: `src/lib/tokens.${useTs ? "ts" : "js"}`,
      content: generateDesignTokens(nodes),
      type: "text",
    });

    // README.md
    files.push({
      path: "README.md",
      content: `# ${options.fileName || "Design Export"} — React + react-router-dom

Generated from a design file.

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

## Pages

${routes.map((r, i) => `${i + 1}. **${r.frame.name}** → \`${r.routePath}\` (${Math.round(r.frame.w)}×${Math.round(r.frame.h)})`).join("\n")}

${hasNavigateInteractions ? `## Navigation

${interactions
  .filter((i) => i.action === "NAVIGATE" && i.targetId)
  .map((i) => {
    const sourceName = nodes.find((n) => n.id === i.sourceId)?.name || i.sourceId;
    const targetRoute = routeMap.get(i.targetId || "") || i.targetId;
    return `- **${sourceName}** → \`${targetRoute}\` (${i.trigger})`;
  }).join("\n")}` : ""}
`,
      type: "text",
    });

    // IMAGES.txt
    const imageRefs = collectImages(nodes);
    if (imageRefs.length > 0) {
      files.push({
        path: "IMAGES.txt",
        content: generateImagesDocument(imageRefs),
        type: "text",
      });
    }

    // ── Mint Runtime Library ──────────────────────────────────
    files.push({
      path: "src/lib/mint-runtime.js",
      content: generateMintRuntimeBundle(),
      type: "text",
    });

    // ── React integration hook ────────────────────────────────
    files.push({
      path: `src/hooks/useMintRuntime.${useTs ? "ts" : "js"}`,
      content: `import { useSyncExternalStore, useCallback } from "react";
import { createMintRuntime, evalExpr, isExpression } from "../lib/mint-runtime";

let _runtime = null;
export function getMintRuntime(schema) {
  if (!_runtime) _runtime = createMintRuntime(schema || {});
  return _runtime;
}

export function useMintState(path) {
  const rt = getMintRuntime();
  const subscribe = useCallback((cb) => rt.state.subscribe(path, cb), [path]);
  const getSnapshot = useCallback(() => rt.state.get(path), [path]);
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const setValue = useCallback((v) => rt.state.set(path, v), [path]);
  return [value, setValue];
}

export function useMintAction() {
  const rt = getMintRuntime();
  return useCallback((ref, ctx) => rt.actions.dispatch(ref, ctx || {}), []);
}

export function useMintExpr(expression) {
  const rt = getMintRuntime();
  const subscribe = useCallback((cb) => rt.state.subscribe("", cb), []);
  const getSnapshot = useCallback(() => {
    try { return rt.evalExpr(expression, rt.state.getContext()); } catch { return undefined; }
  }, [expression]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export { evalExpr, isExpression };
`,
      type: "text",
    });

    // Add image assets
    for (const [localPath, blob] of manifest.blobs) {
      files.push({
        path: `public${localPath}`,
        content: blob,
        type: "binary",
      });
    }

    return files;
  },
};

// ═══════════════════════════════════════════════════════════════
// Page Component Generator
// ═══════════════════════════════════════════════════════════════

function generateReactPageComponent(
  route: FrameRoute,
  routedInteractions: Interaction[],
  manifest: ImageManifest,
  useTs: boolean,
  hasOverlays: boolean,
  hasRuntimeBindings: boolean = false
): string {
  const { frame } = route;

  // Filter interactions relevant to this frame's children
  const frameChildIds = collectAllIds(frame);
  const pageInteractions = routedInteractions.filter(
    (ix) => frameChildIds.has(ix.sourceId)
  );
  const pageHasNav = pageInteractions.some(
    (ix) => ix.action === "NAVIGATE" && ix.targetId
  );
  const pageHasOverlay = pageInteractions.some(
    (ix) =>
      ix.action === "OPEN_OVERLAY" ||
      ix.action === "CLOSE_OVERLAY" ||
      ix.action === "SWAP_OVERLAY"
  );
  const needsHooks = pageHasNav || pageHasOverlay || hasRuntimeBindings;

  const childrenJSX = frame.children?.length
    ? renderJSX(frame.children, {
        indent: 8,
        useTypescript: useTs,
        includeDataAttributes: true,
        manifest,
        interactions: pageInteractions.length ? pageInteractions : undefined,
        navigateHandler: pageHasNav ? "navigate" : undefined,
        overlayHandler: pageHasOverlay ? "openOverlay" : undefined,
        closeOverlayHandler: pageHasOverlay ? "closeOverlay" : undefined,
        swapOverlayHandler: pageHasOverlay ? "swapOverlay" : undefined,
      })
    : "";

  const bgColor = resolveFrameBg(frame);
  const bgStyle = bgColor ? `, backgroundColor: "${bgColor}"` : "";
  const w = Math.round(frame.w);
  const h = Math.round(frame.h);

  // Detect if the top-level frame should scroll
  const frameScrollX = frame.ux?.scrollX ||
    frame.scroll?.overflowBehavior === "horizontal" || frame.scroll?.overflowBehavior === "both";
  const frameScrollY = frame.ux?.scrollY ||
    frame.scroll?.overflowBehavior === "vertical" || frame.scroll?.overflowBehavior === "both";
  let scrollAttr = "";
  if (frameScrollX && frameScrollY) scrollAttr = ` data-scroll-both`;
  else if (frameScrollX) scrollAttr = ` data-scroll-x`;
  else if (frameScrollY) scrollAttr = ` data-scroll-y`;

  if (needsHooks) {
    const imports: string[] = [];
    if (pageHasNav) imports.push(`import { useNavigate } from "react-router-dom";`);
    if (pageHasOverlay && hasOverlays) imports.push(`import { useOverlay } from "../components/OverlayProvider";`);
    imports.push(`import { useCallback } from "react";`);
    if (hasRuntimeBindings) imports.push(`import { useMint } from "../lib/mint-runtime";`);

    const hooks: string[] = [];
    if (pageHasNav) {
      hooks.push(`  const nav = useNavigate();`);
      hooks.push(`  const navigate = useCallback((path: string) => { nav(path); }, [nav]);`);
    }
    if (pageHasOverlay && hasOverlays) {
      hooks.push(`  const { openOverlay, closeOverlay, swapOverlay } = useOverlay();`);
    }
    if (hasRuntimeBindings) {
      hooks.push(`  const { state, setState, actions, db } = useMint();`);
    }

    return `${imports.join("\n")}

export default function ${route.componentName}Page() {
${hooks.join("\n")}

  return (
    <main className="viewport">
      <section
        className="frame-container"
        style={{ width: ${w}, height: ${h}${bgStyle} }}
        data-name="${frame.name}"${scrollAttr}
      >
${childrenJSX}
      </section>
    </main>
  );
}
`;
  }

  return `export default function ${route.componentName}Page() {
  return (
    <main className="viewport">
      <section
        className="frame-container"
        style={{ width: ${w}, height: ${h}${bgStyle} }}
        data-name="${frame.name}"${scrollAttr}
      >
${childrenJSX}
      </section>
    </main>
  );
}
`;
}

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

function resolveFrameBg(frame: DrawableNode): string | undefined {
  if (frame.fill?.type === "SOLID" && frame.fill.color) {
    return frame.fill.color;
  }
  return undefined;
}

/** Recursively collect all IDs under a frame (inclusive). */
function collectAllIds(node: DrawableNode): Set<string> {
  const ids = new Set<string>();
  function walk(n: DrawableNode) {
    ids.add(n.id);
    n.children?.forEach(walk);
  }
  walk(node);
  return ids;
}

function generateDesignTokens(nodes: DrawableNode[]): string {
  const colors = new Set<string>();
  const fontSizes = new Set<number>();
  const radii = new Set<number>();

  function collect(node: DrawableNode) {
    if (node.fill?.color) colors.add(node.fill.color);
    if (node.stroke?.color) colors.add(node.stroke.color);
    if (node.text?.color) colors.add(node.text.color);
    if (node.text?.fontSize) fontSizes.add(node.text.fontSize);
    if (node.corners?.uniform) radii.add(node.corners.uniform);
    node.children?.forEach(collect);
  }

  nodes.forEach(collect);

  const colorEntries = Array.from(colors)
    .map((c, i) => `  color${i + 1}: "${c}"`)
    .join(",\n");

  const fontSizeEntries = Array.from(fontSizes)
    .sort((a, b) => a - b)
    .map((s) => `  text${s}: ${s}`)
    .join(",\n");

  const radiusEntries = Array.from(radii)
    .sort((a, b) => a - b)
    .map((r) => `  radius${r}: ${r}`)
    .join(",\n");

  return `// Design Tokens
export const colors = {
${colorEntries}
} as const;

export const fontSizes = {
${fontSizeEntries}
} as const;

export const radii = {
${radiusEntries}
} as const;
`;
}

export default reactBuilder;