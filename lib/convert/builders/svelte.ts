// ═══════════════════════════════════════════════════════════════
// Svelte Builder — v4.0.0
// Generates a complete Vite + Svelte SPA with svelte-spa-router
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
import { cssFromDrawable } from "../core/styles";
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
  overlayEntranceClass,
  type OverlayFrame,
} from "../core/overlays";
import {
  generatePageTransitionCSS,
  detectHoverInteraction,
} from "../core/transitions";

export const svelteBuilder: FrameworkBuilder = {
  name: "svelte",
  displayName: "Svelte",
  version: "4.0.0",

  async build(
    nodes: DrawableNode[],
    options: ConversionOptions,
    manifest: ImageManifest,
    interactions: Interaction[]
  ): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

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
            check: "svelte-check --tsconfig ./tsconfig.json",
          },
          dependencies: {
            "svelte-spa-router": "^4.0.0",
          },
          devDependencies: {
            "@sveltejs/vite-plugin-svelte": "^3.0.0",
            "@tsconfig/svelte": "^5.0.0",
            svelte: "^4.2.0",
            "svelte-check": "^3.6.0",
            tslib: "^2.6.0",
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
      path: "vite.config.ts",
      content: `import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte()],
  server: {
    port: 3000,
    open: true,
  },
});
`,
      type: "text",
    });

    // svelte.config.js
    files.push({
      path: "svelte.config.js",
      content: `import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

export default {
  preprocess: vitePreprocess(),
};
`,
      type: "text",
    });

    // tsconfig.json
    files.push({
      path: "tsconfig.json",
      content: JSON.stringify(
        {
          extends: "@tsconfig/svelte/tsconfig.json",
          compilerOptions: {
            target: "ESNext",
            useDefineForClassFields: true,
            module: "ESNext",
            resolveJsonModule: true,
            allowJs: true,
            checkJs: true,
            isolatedModules: true,
          },
          include: ["src/**/*.d.ts", "src/**/*.ts", "src/**/*.svelte"],
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
          },
          include: ["vite.config.ts"],
        },
        null,
        2
      ),
      type: "text",
    });

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
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`,
      type: "text",
    });

    // src/main.ts
    files.push({
      path: "src/main.ts",
      content: `import "./styles/globals.css";
import App from "./App.svelte";

const app = new App({
  target: document.getElementById("app")!,
});

export default app;
`,
      type: "text",
    });

    // src/styles/globals.css
    files.push({
      path: "src/styles/globals.css",
      content: `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body, #app {
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

/* Scrollable containers — hide scrollbars, allow touch scroll */
.scroll-x { overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; }
.scroll-y { overflow-x: hidden; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.scroll-both { overflow: auto; -webkit-overflow-scrolling: touch; }
.scroll-x::-webkit-scrollbar, .scroll-y::-webkit-scrollbar, .scroll-both::-webkit-scrollbar { display: none; }
.scroll-x, .scroll-y, .scroll-both { -ms-overflow-style: none; scrollbar-width: none; }


[data-img-missing] {
  background: linear-gradient(45deg, #e0e0e0 25%, #f0f0f0 25%, #f0f0f0 50%, #e0e0e0 50%, #e0e0e0 75%, #f0f0f0 75%);
  background-size: 20px 20px;
}
` + generateOverlayCSS() + generatePageTransitionCSS(),
      type: "text",
    });

    // ── Overlay store + components ────────────────────────────
    if (hasOverlays) {
      files.push({
        path: "src/stores/overlayStore.ts",
        content: generateSvelteOverlayStore(),
        type: "text",
      });

      for (const overlay of overlayFrames) {
        files.push({
          path: `src/components/${overlay.componentName}.svelte`,
          content: generateSvelteOverlayComponent(overlay, routedInteractions, manifest),
          type: "text",
        });
      }

      files.push({
        path: "src/components/OverlayContainer.svelte",
        content: generateSvelteOverlayContainer(overlayFrames),
        type: "text",
      });
    }

    // ── src/App.svelte — Router + nav ─────────────────────────
    const routeImports = routes
      .map((r) => `  import ${r.componentName}Page from "./pages/${r.fileName}.svelte";`)
      .join("\n");

    const overlayContainerImport = hasOverlays
      ? `  import OverlayContainer from "./components/OverlayContainer.svelte";\n`
      : "";
    const overlayContainerTag = hasOverlays ? `<OverlayContainer />\n` : "";

    const routeEntries = routes
      .map(
        (r) =>
          `    "${r.isHome ? "/" : r.routePath}": ${r.componentName}Page`
      )
      .join(",\n");

    const navLinks = "";

    files.push({
      path: "src/App.svelte",
      content: `<script lang="ts">
  import Router from "svelte-spa-router";
${routeImports}
${overlayContainerImport}
  const routeMap = {
${routeEntries},
  };
</script>

<Router routes={routeMap} />
${overlayContainerTag}`,
      type: "text",
    });

    // ── src/pages/<Name>.svelte — one per frame ───────────────
    for (const route of routes) {
      files.push({
        path: `src/pages/${route.fileName}.svelte`,
        content: generateSveltePageComponent(route, routedInteractions, manifest, hasOverlays),
        type: "text",
      });
    }

    // src/vite-env.d.ts
    files.push({
      path: "src/vite-env.d.ts",
      content: `/// <reference types="svelte" />
/// <reference types="vite/client" />
`,
      type: "text",
    });

    // README.md
    files.push({
      path: "README.md",
      content: `# ${options.fileName || "Design Export"} — Svelte + svelte-spa-router

Generated from a design file.

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

## Pages

${routes.map((r, i) => `${i + 1}. **${r.frame.name}** → \`#${r.routePath}\` (${Math.round(r.frame.w)}×${Math.round(r.frame.h)})`).join("\n")}

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
// Svelte Page Component Generator
// ═══════════════════════════════════════════════════════════════

function generateSveltePageComponent(
  route: FrameRoute,
  routedInteractions: Interaction[],
  manifest: ImageManifest,
  hasOverlays: boolean
): string {
  const { frame } = route;

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
  const needsScript = pageHasNav || pageHasOverlay;

  const childrenContent = frame.children?.length
    ? frame.children
        .map((child) =>
          renderSvelteNode(
            child,
            manifest,
            pageInteractions.length ? pageInteractions : undefined,
            pageHasNav ? "navigate" : undefined,
            4,
            pageHasOverlay ? "openOverlay" : undefined,
            pageHasOverlay ? "closeOverlay" : undefined,
            pageHasOverlay ? "swapOverlay" : undefined
          )
        )
        .join("\n")
    : "";

  const bgColor =
    frame.fill?.type === "SOLID" && frame.fill.color
      ? frame.fill.color
      : undefined;
  const bgStyle = bgColor ? ` background-color: ${bgColor};` : "";
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

  if (needsScript) {
    const imports: string[] = [];
    const functions: string[] = [];

    if (pageHasNav) {
      imports.push(`  import { push } from "svelte-spa-router";`);
      functions.push(`  function navigate(path: string) { push(path); }`);
    }
    if (pageHasOverlay && hasOverlays) {
      imports.push(`  import { overlayStore } from "../stores/overlayStore";`);
      functions.push(`  function openOverlay(id: string) { overlayStore.open(id); }`);
      functions.push(`  function closeOverlay() { overlayStore.close(); }`);
      functions.push(`  function swapOverlay(id: string) { overlayStore.swap(id); }`);
    }

    return `<script lang="ts">
${imports.join("\n")}

${functions.join("\n")}
</script>

<main class="viewport">
  <section
    class="frame-container"
    style="width: ${w}px; height: ${h}px;${bgStyle}"
    data-name="${frame.name}"${scrollAttr}
  >
${childrenContent}
  </section>
</main>
`;
  }

  return `<main class="viewport">
  <section
    class="frame-container"
    style="width: ${w}px; height: ${h}px;${bgStyle}"
    data-name="${frame.name}"${scrollAttr}
  >
${childrenContent}
  </section>
</main>
`;
}

// ═══════════════════════════════════════════════════════════════
// Svelte Node Rendering
// ═══════════════════════════════════════════════════════════════

function renderSvelteNode(
  node: DrawableNode,
  manifest: ImageManifest,
  interactions?: Interaction[],
  navigateHandler?: string,
  indent = 2,
  overlayHandler?: string,
  closeOverlayHandler?: string,
  swapOverlayHandler?: string
): string {
  const spaces = " ".repeat(indent);
  const style = cssFromDrawable(node);
  const styleStr = Object.entries(style)
    .filter(([_, v]) => v !== undefined)
    .map(([k, v]) => {
      const prop = k.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`);
      const val = typeof v === "number" ? `${v}px` : v;
      return `${prop}: ${val}`;
    })
    .join("; ");

  // Hover data attribute
  let hoverAttr = "";
  if (interactions?.length) {
    const hover = detectHoverInteraction(node.id, interactions);
    if (hover) hoverAttr = ` ${hover}`;
  }

  // Check for interactions
  let clickHandler = "";
  if (interactions?.length) {
    // NAVIGATE
    if (navigateHandler) {
      const navIx = interactions.find(
        (i) => i.sourceId === node.id && i.action === "NAVIGATE" && i.targetId
      );
      if (navIx) {
        clickHandler = ` on:click={() => ${navigateHandler}('${navIx.targetId}')} style:cursor="pointer"`;
      }
    }

    // OPEN_OVERLAY
    if (overlayHandler) {
      const openIx = interactions.find(
        (i) => i.sourceId === node.id && i.action === "OPEN_OVERLAY" && i.targetId
      );
      if (openIx) {
        clickHandler = ` on:click={() => ${overlayHandler}('${openIx.targetId}')} style:cursor="pointer"`;
      }
    }

    // CLOSE_OVERLAY
    if (closeOverlayHandler) {
      const closeIx = interactions.find(
        (i) => i.sourceId === node.id && i.action === "CLOSE_OVERLAY"
      );
      if (closeIx) {
        clickHandler = ` on:click={() => ${closeOverlayHandler}()} style:cursor="pointer"`;
      }
    }

    // SWAP_OVERLAY
    if (swapOverlayHandler) {
      const swapIx = interactions.find(
        (i) => i.sourceId === node.id && i.action === "SWAP_OVERLAY" && i.targetId
      );
      if (swapIx) {
        clickHandler = ` on:click={() => ${swapOverlayHandler}('${swapIx.targetId}')} style:cursor="pointer"`;
      }
    }

    // SCROLL_TO
    const scrollIx = interactions.find(
      (i) => i.sourceId === node.id && i.action === "SCROLL_TO" && i.targetId
    );
    if (scrollIx) {
      clickHandler = ` on:click={() => document.getElementById('${scrollIx.targetId}')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} style:cursor="pointer"`;
    }

    // BACK
    const backIx = interactions.find(
      (i) => i.sourceId === node.id && i.action === "BACK"
    );
    if (backIx) {
      clickHandler = ` on:click={() => window.history.back()} style:cursor="pointer"`;
    }

    // OPEN_URL
    const urlIx = interactions.find(
      (i) => i.sourceId === node.id && i.action === "OPEN_URL" && i.destinationUrl
    );
    if (urlIx) {
      clickHandler = ` on:click={() => window.open('${urlIx.destinationUrl}', '_blank')} style:cursor="pointer"`;
    }
  }

  // Text node
  if (node.type === "TEXT") {
    const text = node.text?.characters ?? "";
    return `${spaces}<div id="${node.id}" style="${styleStr}"${hoverAttr}${clickHandler} data-name="${node.name}">${escapeSvelteText(text)}</div>`;
  }

  // Image node
  if (node.type === "IMAGE" || node.fill?.type === "IMAGE") {
    let src = node.fill?.imageRef ?? "";
    if (manifest.images.has(src)) {
      src = manifest.images.get(src)!;
    }

    if (src) {
      const imgStyle = styleStr.replace(/background-[^;]+;?\s*/g, "");
      return `${spaces}<img id="${node.id}" src="${src}" alt="${node.name}" style="${imgStyle}"${hoverAttr}${clickHandler} data-name="${node.name}" />`;
    }
  }

  // Container with children
  if (node.children?.length) {
    const isScrollContainer =
      node.ux?.scrollX || node.ux?.scrollY ||
      (node.scroll?.overflowBehavior && node.scroll.overflowBehavior !== "none");

    const scrollX = node.ux?.scrollX ||
      node.scroll?.overflowBehavior === "horizontal" ||
      node.scroll?.overflowBehavior === "both";
    const scrollY = node.ux?.scrollY ||
      node.scroll?.overflowBehavior === "vertical" ||
      node.scroll?.overflowBehavior === "both";

    // Separate fixed and scrollable children
    const fixedChildren = isScrollContainer
      ? node.children.filter((c) => c.scroll?.fixedWhenScrolling)
      : [];
    const scrollableChildren = isScrollContainer && fixedChildren.length > 0
      ? node.children.filter((c) => !c.scroll?.fixedWhenScrolling)
      : node.children;

    const childContent = scrollableChildren
      .map((child) =>
        renderSvelteNode(
          child,
          manifest,
          interactions,
          navigateHandler,
          indent + (isScrollContainer ? 4 : 2),
          overlayHandler,
          closeOverlayHandler,
          swapOverlayHandler
        )
      )
      .join("\n");

    if (isScrollContainer) {
      const contentW = Math.ceil(Math.max(...scrollableChildren.map((c) => c.x + c.w)));
      const contentH = Math.ceil(Math.max(...scrollableChildren.map((c) => c.y + c.h)));
      const innerW = scrollX ? contentW : Math.round(node.w);
      const innerH = scrollY ? contentH : Math.round(node.h);
      const innerStyle = `position: relative; width: ${innerW}px; height: ${innerH}px;${scrollX ? ` min-width: ${innerW}px;` : ''}${scrollY ? ` min-height: ${innerH}px;` : ''}`;

      // Determine scroll CSS class for scrollbar hiding
      let scrollClass = '';
      if (scrollX && scrollY) scrollClass = ' scroll-both';
      else if (scrollX) scrollClass = ' scroll-x';
      else if (scrollY) scrollClass = ' scroll-y';

      const fixedContent = fixedChildren.length > 0
        ? "\n" + fixedChildren.map((child) =>
            renderSvelteNode(child, manifest, interactions, navigateHandler, indent + 2, overlayHandler, closeOverlayHandler, swapOverlayHandler)
          ).join("\n")
        : "";

      return `${spaces}<div id="${node.id}" class="${scrollClass.trim()}" style="${styleStr}"${hoverAttr}${clickHandler} data-name="${node.name}">
${spaces}  <div style="${innerStyle}">
${childContent}
${spaces}  </div>${fixedContent}
${spaces}</div>`;
    }

    return `${spaces}<div id="${node.id}" style="${styleStr}"${hoverAttr}${clickHandler} data-name="${node.name}">
${childContent}
${spaces}</div>`;
  }

  // Simple element
  return `${spaces}<div id="${node.id}" style="${styleStr}"${hoverAttr}${clickHandler} data-name="${node.name}"></div>`;
}

function escapeSvelteText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/{/g, "&#123;")
    .replace(/}/g, "&#125;");
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

// ═══════════════════════════════════════════════════════════════
// Svelte Overlay System
// ═══════════════════════════════════════════════════════════════

function generateSvelteOverlayStore(): string {
  return `import { writable } from "svelte/store";

interface OverlayEntry {
  id: string;
  key: number;
}

let nextKey = 0;

function createOverlayStore() {
  const { subscribe, update } = writable<OverlayEntry[]>([]);

  return {
    subscribe,
    open(id: string) {
      nextKey++;
      update((stack) => [...stack, { id, key: nextKey }]);
    },
    close() {
      update((stack) => stack.slice(0, -1));
    },
    swap(id: string) {
      nextKey++;
      update((stack) => [...stack.slice(0, -1), { id, key: nextKey }]);
    },
  };
}

export const overlayStore = createOverlayStore();
`;
}

function generateSvelteOverlayContainer(overlayFrames: OverlayFrame[]): string {
  const imports = overlayFrames
    .map((ov) => `  import ${ov.componentName} from "./${ov.componentName}.svelte";`)
    .join("\n");

  const registry = overlayFrames
    .map((ov) => `    "${ov.frame.id}": { component: ${ov.componentName}, animation: "${overlayEntranceClass(ov.animation)}" }`)
    .join(",\n");

  return `<script lang="ts">
  import { overlayStore } from "../stores/overlayStore";
${imports}

  const REGISTRY: Record<string, { component: any; animation: string }> = {
${registry}
  };

  function onBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) overlayStore.close();
  }
</script>

{#each $overlayStore as entry (entry.key)}
  <div class="overlay-backdrop" on:click={onBackdropClick}>
    <div class="overlay-content {REGISTRY[entry.id]?.animation || ''}">
      <svelte:component this={REGISTRY[entry.id]?.component} />
    </div>
  </div>
{/each}
`;
}

function generateSvelteOverlayComponent(
  overlay: OverlayFrame,
  routedInteractions: Interaction[],
  manifest: ImageManifest
): string {
  const { frame, componentName } = overlay;
  const w = Math.round(frame.w);
  const h = Math.round(frame.h);
  const bgColor =
    frame.fill?.type === "SOLID" && frame.fill.color
      ? frame.fill.color
      : undefined;
  const bgStyle = bgColor ? ` background-color: ${bgColor};` : "";

  const childrenContent = frame.children?.length
    ? frame.children
        .map((child) =>
          renderSvelteNode(child, manifest, routedInteractions, undefined, 2, "openOverlay", "closeOverlay", "swapOverlay")
        )
        .join("\n")
    : "";

  return `<script lang="ts">
  import { overlayStore } from "../stores/overlayStore";

  function openOverlay(id: string) { overlayStore.open(id); }
  function closeOverlay() { overlayStore.close(); }
  function swapOverlay(id: string) { overlayStore.swap(id); }
</script>

<div
  style="width: ${w}px; height: ${h}px; position: relative; overflow: hidden;${bgStyle}"
  data-name="${frame.name}"
>
${childrenContent}
</div>
`;
}

export default svelteBuilder;
