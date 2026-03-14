// ═══════════════════════════════════════════════════════════════
// Vue Builder — v4.0.0
// Generates a complete Vite + Vue 3 SPA with vue-router
// Each top-level frame = a routed view
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
  overlayTimingVars,
  type OverlayFrame,
} from "../core/overlays";
import {
  generatePageTransitionCSS,
  detectHoverInteraction,
} from "../core/transitions";

export const vueBuilder: FrameworkBuilder = {
  name: "vue",
  displayName: "Vue 3",
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
            "type-check": "vue-tsc --noEmit",
          },
          dependencies: {
            vue: "^3.4.0",
            "vue-router": "^4.2.0",
          },
          devDependencies: {
            "@vitejs/plugin-vue": "^5.0.0",
            typescript: "^5.3.0",
            vite: "^5.0.0",
            "vue-tsc": "^1.8.0",
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
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 3000,
    open: true,
  },
});
`,
      type: "text",
    });

    // tsconfig.json
    files.push({
      path: "tsconfig.json",
      content: JSON.stringify(
        {
          compilerOptions: {
            target: "ES2020",
            useDefineForClassFields: true,
            module: "ESNext",
            lib: ["ES2020", "DOM", "DOM.Iterable"],
            skipLibCheck: true,
            moduleResolution: "bundler",
            allowImportingTsExtensions: true,
            resolveJsonModule: true,
            isolatedModules: true,
            noEmit: true,
            jsx: "preserve",
            strict: true,
            noUnusedLocals: true,
            noUnusedParameters: true,
            noFallthroughCasesInSwitch: true,
          },
          include: ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.tsx", "src/**/*.vue"],
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

    // ── src/router/index.ts — vue-router config ───────────────
    const routeImports = routes
      .map((r) => `import ${r.componentName}View from "../views/${r.fileName}.vue";`)
      .join("\n");

    const routeDefs = routes
      .map(
        (r) =>
          `    { path: "${r.routePath}", name: "${r.slug}", component: ${r.componentName}View }`
      )
      .join(",\n");

    files.push({
      path: "src/router/index.ts",
      content: `import { createRouter, createWebHistory } from "vue-router";
${routeImports}

const router = createRouter({
  history: createWebHistory(),
  routes: [
${routeDefs},
  ],
});

export default router;
`,
      type: "text",
    });

    // ── src/main.ts — mount with router ───────────────────────
    files.push({
      path: "src/main.ts",
      content: `import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import "./styles/globals.css";

createApp(App).use(router).mount("#app");
`,
      type: "text",
    });

    // ── src/App.vue — RouterView + optional nav + overlays ────
    const navLinks = routes
      .map(
        (r) =>
          `      <router-link to="${r.routePath}">${r.frame.name}</router-link>`
      )
      .join("\n");

    const overlayContainerImport = hasOverlays
      ? `<script setup lang="ts">\nimport OverlayContainer from "./components/OverlayContainer.vue";\n</script>\n\n`
      : "";
    const overlayContainerTag = hasOverlays ? `  <OverlayContainer />\n` : "";

    files.push({
      path: "src/App.vue",
      content: `${overlayContainerImport}<template>
${routes.length > 1 ? `  <nav class="page-nav">
${navLinks}
  </nav>
` : ""}  <router-view />
${overlayContainerTag}</template>
</template>

<style scoped>
.page-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  display: flex;
  gap: 4px;
  padding: 8px 16px;
  background: rgba(255,255,255,0.9);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid #eee;
}

.page-nav a {
  padding: 4px 12px;
  border-radius: 4px;
  text-decoration: none;
  color: #333;
  font-size: 13px;
}

.page-nav a:hover {
  background: #f0f0f0;
}
</style>
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

    // ── Overlay composable + components ───────────────────────
    if (hasOverlays) {
      files.push({
        path: "src/composables/useOverlay.ts",
        content: generateVueOverlayComposable(),
        type: "text",
      });

      for (const overlay of overlayFrames) {
        files.push({
          path: `src/components/${overlay.componentName}.vue`,
          content: generateVueOverlayComponent(overlay, routedInteractions, manifest),
          type: "text",
        });
      }

      // OverlayContainer.vue — renders the overlay stack
      files.push({
        path: "src/components/OverlayContainer.vue",
        content: generateVueOverlayContainer(overlayFrames),
        type: "text",
      });
    }

    // ── src/views/<Name>.vue — one per frame ──────────────────
    for (const route of routes) {
      files.push({
        path: `src/views/${route.fileName}.vue`,
        content: generateVueViewComponent(route, routedInteractions, manifest, hasOverlays),
        type: "text",
      });
    }

    // README.md
    files.push({
      path: "README.md",
      content: `# ${options.fileName || "Design Export"} — Vue 3 + vue-router

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
// Vue View Component Generator
// ═══════════════════════════════════════════════════════════════

function generateVueViewComponent(
  route: FrameRoute,
  routedInteractions: Interaction[],
  manifest: ImageManifest,
  hasOverlays: boolean
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
  const needsScript = pageHasNav || pageHasOverlay;

  const childrenTemplate = frame.children?.length
    ? frame.children
        .map((child) =>
          renderVueNode(
            child,
            manifest,
            pageInteractions.length ? pageInteractions : undefined,
            pageHasNav ? "navigate" : undefined,
            6,
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
      imports.push(`import { useRouter } from "vue-router";`);
      functions.push(`const router = useRouter();`);
      functions.push(`function navigate(path: string) { router.push(path); }`);
    }
    if (pageHasOverlay && hasOverlays) {
      imports.push(`import { useOverlay } from "../composables/useOverlay";`);
      functions.push(`const { openOverlay, closeOverlay, swapOverlay } = useOverlay();`);
    }

    return `<script setup lang="ts">
${imports.join("\n")}

${functions.join("\n")}
</script>

<template>
  <main class="viewport">
    <section
      class="frame-container"
      style="width: ${w}px; height: ${h}px;${bgStyle}"
      data-name="${frame.name}"${scrollAttr}
    >
${childrenTemplate}
    </section>
  </main>
</template>
`;
  }

  return `<template>
  <main class="viewport">
    <section
      class="frame-container"
      style="width: ${w}px; height: ${h}px;${bgStyle}"
      data-name="${frame.name}"${scrollAttr}
    >
${childrenTemplate}
    </section>
  </main>
</template>
`;
}

// ═══════════════════════════════════════════════════════════════
// Vue Template Node Rendering
// ═══════════════════════════════════════════════════════════════

function renderVueNode(
  node: DrawableNode,
  manifest: ImageManifest,
  interactions?: Interaction[],
  navigateHandler?: string,
  indent = 4,
  overlayHandler?: string,
  closeOverlayHandler?: string,
  swapOverlayHandler?: string
): string {
  const spaces = " ".repeat(indent);
  const style = cssFromDrawable(node);
  const styleStr = vueInlineStyle(style);

  // Check for hover data attribute
  let hoverAttr = "";
  if (interactions?.length) {
    const hover = detectHoverInteraction(node.id, interactions);
    if (hover) hoverAttr = ` ${hover}`;
  }

  // Check for interaction on this node
  let clickHandler = "";
  if (interactions?.length) {
    // NAVIGATE
    if (navigateHandler) {
      const navIx = interactions.find(
        (i) => i.sourceId === node.id && i.action === "NAVIGATE" && i.targetId
      );
      if (navIx) {
        clickHandler = ` @click="${navigateHandler}('${navIx.targetId}')" style="cursor: pointer;"`;
      }
    }

    // OPEN_OVERLAY
    if (overlayHandler) {
      const openIx = interactions.find(
        (i) => i.sourceId === node.id && i.action === "OPEN_OVERLAY" && i.targetId
      );
      if (openIx) {
        clickHandler = ` @click="${overlayHandler}('${openIx.targetId}')" style="cursor: pointer;"`;
      }
    }

    // CLOSE_OVERLAY
    if (closeOverlayHandler) {
      const closeIx = interactions.find(
        (i) => i.sourceId === node.id && i.action === "CLOSE_OVERLAY"
      );
      if (closeIx) {
        clickHandler = ` @click="${closeOverlayHandler}()" style="cursor: pointer;"`;
      }
    }

    // SWAP_OVERLAY
    if (swapOverlayHandler) {
      const swapIx = interactions.find(
        (i) => i.sourceId === node.id && i.action === "SWAP_OVERLAY" && i.targetId
      );
      if (swapIx) {
        clickHandler = ` @click="${swapOverlayHandler}('${swapIx.targetId}')" style="cursor: pointer;"`;
      }
    }

    // SCROLL_TO
    const scrollIx = interactions.find(
      (i) => i.sourceId === node.id && i.action === "SCROLL_TO" && i.targetId
    );
    if (scrollIx) {
      clickHandler = ` @click="document.getElementById('${scrollIx.targetId}')?.scrollIntoView({ behavior: 'smooth', block: 'start' })" style="cursor: pointer;"`;
    }

    // BACK
    const backIx = interactions.find(
      (i) => i.sourceId === node.id && i.action === "BACK"
    );
    if (backIx) {
      clickHandler = ` @click="window.history.back()" style="cursor: pointer;"`;
    }

    // OPEN_URL
    const urlIx = interactions.find(
      (i) => i.sourceId === node.id && i.action === "OPEN_URL" && i.destinationUrl
    );
    if (urlIx) {
      clickHandler = ` @click="window.open('${urlIx.destinationUrl}', '_blank')" style="cursor: pointer;"`;
    }
  }

  // Text node
  if (node.type === "TEXT") {
    const text = node.text?.characters ?? "";
    return `${spaces}<div id="${node.id}" style="${styleStr}"${hoverAttr}${clickHandler} data-name="${node.name}">${escapeVueText(text)}</div>`;
  }

  // Image node
  if (node.type === "IMAGE" || node.fill?.type === "IMAGE") {
    let src = node.fill?.imageRef ?? "";
    if (manifest.images.has(src)) {
      src = manifest.images.get(src)!;
    }

    if (src) {
      const imgStyle = Object.entries(style)
        .filter(([k]) => !k.startsWith("background"))
        .reduce(
          (acc, [k, v]) => ({ ...acc, [k]: v }),
          {} as Record<string, unknown>
        );
      return `${spaces}<img id="${node.id}" src="${src}" alt="${node.name}" style="${vueInlineStyle(imgStyle)}"${hoverAttr}${clickHandler} data-name="${node.name}" />`;
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
        renderVueNode(child, manifest, interactions, navigateHandler, indent + (isScrollContainer ? 4 : 2), overlayHandler, closeOverlayHandler, swapOverlayHandler)
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
            renderVueNode(child, manifest, interactions, navigateHandler, indent + 2, overlayHandler, closeOverlayHandler, swapOverlayHandler)
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

function vueInlineStyle(style: Record<string, unknown>): string {
  return Object.entries(style)
    .filter(([_, v]) => v !== undefined)
    .map(([k, v]) => {
      const prop = k.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`);
      const val = typeof v === "number" ? `${v}px` : v;
      return `${prop}: ${val}`;
    })
    .join("; ");
}

function escapeVueText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\{\{/g, "&#123;&#123;")
    .replace(/\}\}/g, "&#125;&#125;");
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
// Vue Overlay System
// ═══════════════════════════════════════════════════════════════

function generateVueOverlayComposable(): string {
  return `import { ref, readonly } from "vue";

interface OverlayEntry {
  id: string;
  key: number;
}

const stack = ref<OverlayEntry[]>([]);
let nextKey = 0;

export function useOverlay() {
  function openOverlay(id: string) {
    nextKey++;
    stack.value = [...stack.value, { id, key: nextKey }];
  }

  function closeOverlay() {
    stack.value = stack.value.slice(0, -1);
  }

  function swapOverlay(id: string) {
    nextKey++;
    stack.value = [...stack.value.slice(0, -1), { id, key: nextKey }];
  }

  return {
    stack: readonly(stack),
    openOverlay,
    closeOverlay,
    swapOverlay,
  };
}
`;
}

function generateVueOverlayContainer(overlayFrames: OverlayFrame[]): string {
  const imports = overlayFrames
    .map((ov) => `import ${ov.componentName} from "./${ov.componentName}.vue";`)
    .join("\n");

  const registry = overlayFrames
    .map((ov) => `  "${ov.frame.id}": { component: ${ov.componentName}, animation: "${overlayEntranceClass(ov.animation)}" }`)
    .join(",\n");

  return `<script setup lang="ts">
import { useOverlay } from "../composables/useOverlay";
${imports}

const { stack, closeOverlay } = useOverlay();

const REGISTRY: Record<string, { component: any; animation: string }> = {
${registry}
};

function onBackdropClick(e: Event) {
  if (e.target === e.currentTarget) closeOverlay();
}
</script>

<template>
  <div v-for="entry in stack" :key="entry.key">
    <div class="overlay-backdrop" @click="onBackdropClick">
      <div :class="['overlay-content', REGISTRY[entry.id]?.animation]">
        <component :is="REGISTRY[entry.id]?.component" />
      </div>
    </div>
  </div>
</template>
`;
}

function generateVueOverlayComponent(
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

  const childrenTemplate = frame.children?.length
    ? frame.children
        .map((child) =>
          renderVueNode(child, manifest, routedInteractions, undefined, 4, "openOverlay", "closeOverlay", "swapOverlay")
        )
        .join("\n")
    : "";

  const hasOverlayActions = routedInteractions.some(
    (ix) =>
      ix.action === "OPEN_OVERLAY" ||
      ix.action === "CLOSE_OVERLAY" ||
      ix.action === "SWAP_OVERLAY"
  );

  const scriptBlock = hasOverlayActions
    ? `<script setup lang="ts">
import { useOverlay } from "../composables/useOverlay";

const { openOverlay, closeOverlay, swapOverlay } = useOverlay();
</script>

`
    : "";

  return `${scriptBlock}<template>
  <div
    style="width: ${w}px; height: ${h}px; position: relative; overflow: hidden;${bgStyle}"
    data-name="${frame.name}"
  >
${childrenTemplate}
  </div>
</template>
`;
}

export default vueBuilder;
