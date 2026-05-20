// ═══════════════════════════════════════════════════════════════
// Next.js Builder — v4.0.0
// Generates a complete Next.js App Router project with:
//   • Frame-as-page routing
//   • Overlay/modal system (OPEN_OVERLAY / CLOSE_OVERLAY / SWAP_OVERLAY)
//   • Page transition animations (DISSOLVE / MOVE_IN / PUSH / etc.)
//   • Hover state interactions
//   • Scroll view support
// ═══════════════════════════════════════════════════════════════

import type {
  DrawableNode,
  ImageManifest,
  ConversionOptions,
  GeneratedFile,
  Interaction,
  FrameworkBuilder,
} from "../types";
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
  transitionClassName,
} from "../core/transitions";
import { generateMintRuntimeProvider } from "../core/mintRuntime";
import { hasMintBindings } from "../core/render";

export const nextBuilder: FrameworkBuilder = {
  name: "nextjs",
  displayName: "Next.js",
  version: "4.0.0",

  async build(
    nodes: DrawableNode[],
    options: ConversionOptions,
    manifest: ImageManifest,
    interactions: Interaction[]
  ): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    const enableLiveSync = options.enableLiveSync && options.fileKey;
    const projectName = options.fileName?.toLowerCase().replace(/\s+/g, "-") || "design-export";

    // ── Analyze overlays ──────────────────────────────────────
    const overlayAnalysis = analyzeOverlays(nodes, interactions);
    const { pageFrames, overlayFrames, hasOverlays } = overlayAnalysis;

    // ── Build route map (only page frames, not overlays) ──────
    const routes = buildFrameRoutes(pageFrames);
    const routeMap = buildRouteMap(routes);
    const routedInteractions = rewriteInteractionsForRouting(interactions, routeMap);

    const hasNavigateInteractions = interactions.some(
      (i) => i.action === "NAVIGATE" && i.targetId
    );
    const transitionMap = buildTransitionMap(interactions);

    // ── Check if any node has runtime bindings ──────────────
    const hasRuntimeBindings = hasMintBindings(nodes) || !!options.runtimeSchema;

    // ── package.json ──────────────────────────────────────────
    files.push({
      path: "package.json",
      content: JSON.stringify(
        {
          name: projectName,
          version: "0.1.0",
          private: true,
          scripts: {
            dev: "next dev",
            build: "next build",
            start: "next start",
            lint: "next lint",
          },
          dependencies: {
            next: "^14.0.0",
            react: "^18.2.0",
            "react-dom": "^18.2.0",
            ...(enableLiveSync ? { "socket.io-client": "^4.6.0" } : {}),
          },
          devDependencies: {
            "@types/node": "^20.10.0",
            "@types/react": "^18.2.0",
            "@types/react-dom": "^18.2.0",
            typescript: "^5.3.0",
            eslint: "^8.55.0",
            "eslint-config-next": "^14.0.0",
          },
        },
        null,
        2
      ),
      type: "text",
    });

    // ── next.config.js ────────────────────────────────────────
    files.push({
      path: "next.config.js",
      content: `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

module.exports = nextConfig;
`,
      type: "text",
    });

    // ── tsconfig.json ─────────────────────────────────────────
    files.push({
      path: "tsconfig.json",
      content: JSON.stringify(
        {
          compilerOptions: {
            lib: ["dom", "dom.iterable", "esnext"],
            allowJs: true,
            skipLibCheck: true,
            strict: true,
            noEmit: true,
            esModuleInterop: true,
            module: "esnext",
            moduleResolution: "bundler",
            resolveJsonModule: true,
            isolatedModules: true,
            jsx: "preserve",
            incremental: true,
            plugins: [{ name: "next" }],
            paths: {
              "@/*": ["./*"],
            },
          },
          include: [
            "next-env.d.ts",
            "**/*.ts",
            "**/*.tsx",
            ".next/types/**/*.ts",
          ],
          exclude: ["node_modules"],
        },
        null,
        2
      ),
      type: "text",
    });

    // ── lib/mint-runtime.tsx (only if bindings exist) ─────────
    if (hasRuntimeBindings) {
      files.push({
        path: "lib/mint-runtime.tsx",
        content: generateMintRuntimeProvider(options),
        type: "text",
      });
    }

    // ── .env.local (live sync) ────────────────────────────────
    if (enableLiveSync) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
      const wsUrl = appUrl.replace(/^https:/, "wss:").replace(/^http:/, "ws:");
      files.push({
        path: ".env.local",
        content: `# Live Sync Configuration
NEXT_PUBLIC_WEBSOCKET_URL=${wsUrl}
NEXT_PUBLIC_FILE_KEY=${options.fileKey}
`,
        type: "text",
      });
    }

    // ── app/layout.tsx ────────────────────────────────────────
    const navLinks = "";

    const overlayProviderImport = hasOverlays
      ? `import { OverlayProvider } from "../components/OverlayProvider";\n`
      : "";
    const overlayProviderOpen = hasOverlays ? `        <OverlayProvider>\n` : "";
    const overlayProviderClose = hasOverlays ? `        </OverlayProvider>\n` : "";

    const mintProviderImport = hasRuntimeBindings
      ? `import { MintProvider } from "../lib/mint-runtime";\n`
      : "";
    const mintProviderOpen = hasRuntimeBindings ? `        <MintProvider>\n` : "";
    const mintProviderClose = hasRuntimeBindings ? `        </MintProvider>\n` : "";

    files.push({
      path: "app/layout.tsx",
      content: `import type { Metadata } from "next";
${mintProviderImport}${overlayProviderImport}import "./globals.css";

export const metadata: Metadata = {
  title: "${options.fileName || "Design Export"}",
  description: "Generated from design file",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
${mintProviderOpen}${overlayProviderOpen}        {children}
${overlayProviderClose}${mintProviderClose}      </body>
    </html>
  );
}
`,
      type: "text",
    });

    // ── app/globals.css ───────────────────────────────────────
    files.push({
      path: "app/globals.css",
      content: `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
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
${generateOverlayCSS()}
${generatePageTransitionCSS()}
`,
      type: "text",
    });

    // ── Generate overlay components ───────────────────────────
    if (hasOverlays) {
      // OverlayProvider
      files.push({
        path: "components/OverlayProvider.tsx",
        content: generateReactOverlayProvider(overlayFrames),
        type: "text",
      });

      // Individual overlay components
      for (const overlay of overlayFrames) {
        const overlayContent = overlay.frame.children?.length
          ? renderJSX(overlay.frame.children, {
              indent: 6,
              useTypescript: true,
              includeDataAttributes: true,
              manifest,
              interactions: routedInteractions,
              overlayHandler: "openOverlay",
              closeOverlayHandler: "closeOverlay",
              swapOverlayHandler: "swapOverlay",
            })
          : "";

        files.push({
          path: `components/${overlay.componentName}.tsx`,
          content: generateReactOverlayComponent(overlay, overlayContent),
          type: "text",
        });
      }
    }

    // ── Generate one page per frame ───────────────────────────
    for (const route of routes) {
      const pagePath = route.isHome
        ? "app/page.tsx"
        : `app/${route.slug}/page.tsx`;

      files.push({
        path: pagePath,
        content: generateFramePage(route, routedInteractions, manifest, hasNavigateInteractions, hasOverlays, hasRuntimeBindings),
        type: "text",
      });
    }

    // ── README.md ─────────────────────────────────────────────
    files.push({
      path: "README.md",
      content: `# ${options.fileName || "Design Export"} — Next.js

Generated from a Penpot design file.

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) to view.

## Pages

${routes.map((r, i) => `${i + 1}. **${r.frame.name}** → \`${r.routePath}\` (${Math.round(r.frame.w)}×${Math.round(r.frame.h)})`).join("\n")}

${hasNavigateInteractions ? `## Navigation

Interactions from the design are wired as Next.js route transitions:

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

    // ── IMAGES.txt ────────────────────────────────────────────
    const imageRefs = collectImages(nodes);
    if (imageRefs.length > 0) {
      files.push({
        path: "IMAGES.txt",
        content: generateImagesDocument(imageRefs),
        type: "text",
      });
    }

    // ── Image assets ──────────────────────────────────────────
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
// Page Generator — one per frame
// ═══════════════════════════════════════════════════════════════

function generateFramePage(
  route: FrameRoute,
  routedInteractions: Interaction[],
  manifest: ImageManifest,
  hasNavigation: boolean,
  hasOverlays: boolean,
  hasRuntimeBindings: boolean = false
): string {
  const { frame } = route;

  // Filter interactions relevant to children of this frame
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
  const needsClient = pageHasNav || pageHasOverlay || hasRuntimeBindings;

  const childrenJSX = frame.children?.length
    ? renderJSX(frame.children, {
        indent: 8,
        useTypescript: true,
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

  // Build imports
  const imports: string[] = [];
  if (pageHasNav) {
    imports.push(`import { useRouter } from "next/navigation";`);
  }
  if (pageHasOverlay && hasOverlays) {
    imports.push(`import { useOverlay } from "../../components/OverlayProvider";`);
  }
  if (needsClient) {
    const hasUseEffect = !!frame.bindings?.onMount;
    imports.push(`import { useCallback${hasUseEffect ? ", useEffect" : ""} } from "react";`);
  }
  if (hasRuntimeBindings) {
    imports.push(`import { useMint } from "${route.isHome ? '../' : '../../'}lib/mint-runtime";`);
  }

  if (needsClient) {
    const hookLines: string[] = [];
    if (pageHasNav) {
      hookLines.push(`  const router = useRouter();`);
      hookLines.push(`  const navigate = useCallback((path: string) => { router.push(path); }, [router]);`);
    }
    if (pageHasOverlay && hasOverlays) {
      hookLines.push(`  const { openOverlay, closeOverlay, swapOverlay } = useOverlay();`);
    }
    if (hasRuntimeBindings) {
      hookLines.push(`  const { state, setState, actions, db } = useMint();`);
    }
    if (frame.bindings?.onMount) {
      hookLines.push(`\n  useEffect(() => {\n    if (actions.${frame.bindings.onMount}) {\n      actions.${frame.bindings.onMount}();\n    }\n  }, [actions]);`);
    }

    return `"use client";

${imports.join("\n")}

export default function ${route.componentName}Page() {
${hookLines.join("\n")}

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

// ── Helpers ───────────────────────────────────────────────────

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

export default nextBuilder;
