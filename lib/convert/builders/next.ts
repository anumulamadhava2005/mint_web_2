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

// ═══════════════════════════════════════════════════════════════
// Schema-driven generator — converts AppSchema.screens to Next.js
// pages when studio-authored screens exist in runtimeSchema.
// ═══════════════════════════════════════════════════════════════

function toPascalCase(s: string): string {
  return s.replace(/[-_\s]+(.)/g, (_, c: string) => c.toUpperCase()).replace(/^(.)/, (c: string) => c.toUpperCase());
}

function generateActionCode(action: { actionId: string; params?: Record<string, unknown> }): string {
  switch (action.actionId) {
    case "navigate":
      return `router.push('${String(action.params?.to ?? "/")}')`;
    case "setState":
      return `set${toPascalCase(String(action.params?.key ?? "state"))}(${JSON.stringify(action.params?.value ?? null)})`;
    case "showToast":
      return `alert('${String(action.params?.message ?? "")}')`;
    case "apiCall":
      return `fetch('${String(action.params?.url ?? "")}', { method: '${String(action.params?.method ?? "GET")}' }).then(r => r.json()).then(d => console.log(d))`;
    default:
      return `console.log('${action.actionId}')`;
  }
}

function generateComponentJSX(comp: any): string {
  const events = comp.events ?? {};
  const onClickHandlers: Array<{ actionId: string; params?: Record<string, unknown> }> = events.onClick ?? [];
  const onClickAttr = onClickHandlers.length > 0
    ? `onClick={() => { ${onClickHandlers.map((a) => generateActionCode(a)).join("; ")} }}`
    : "";

  switch (comp.type) {
    case "button":
      return `<button ${onClickAttr} style={{ background: 'var(--color-primary, #6366f1)', color: '#fff', borderRadius: 8, padding: '10px 20px', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>${String(comp.props?.label ?? "Button")}</button>`;
    case "text": {
      const tag = String(comp.props?.tag ?? "p");
      return `<${tag} style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>${String(comp.props?.content ?? "")}</${tag}>`;
    }
    case "input": {
      const inputType = String(comp.props?.inputType ?? "text");
      return `<input type="${inputType}" placeholder="${String(comp.props?.placeholder ?? "")}" style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 14px', fontSize: 14, width: '100%', marginBottom: 8, boxSizing: 'border-box' as const }} />`;
    }
    case "image":
      return `<img src="${String(comp.props?.src ?? "/placeholder.png")}" alt="${String(comp.props?.alt ?? "")}" style={{ width: '100%', borderRadius: 8, marginBottom: 8 }} />`;
    case "view":
    case "scroll":
      return `<div style={{ padding: 16, marginBottom: 8, border: '1px solid #e5e7eb', borderRadius: 8 }}>{/* ${comp.type} container */}</div>`;
    default:
      return `<div style={{ border: '1.5px dashed #d1d5db', borderRadius: 8, padding: '10px 12px', marginBottom: 8, color: '#9ca3af', fontSize: 12 }}>${comp.type}</div>`;
  }
}

function generateScreenPage(screen: any, schema: any): string {
  const componentJSX = (screen.components ?? []).map((c: any) => "      " + generateComponentJSX(c)).join("\n");
  const hasNavigate = (screen.components ?? []).some((c: any) =>
    Object.values(c.events ?? {}).flat().some((a: any) => a.actionId === "navigate")
  );
  const hasSetState = (screen.components ?? []).some((c: any) =>
    Object.values(c.events ?? {}).flat().some((a: any) => a.actionId === "setState")
  );
  const globalStateVars: string[] = (schema.globalState ?? []).map((s: any) => s.id);
  const localStateVars: string[] = (screen.localState ?? []).map((s: any) => ({ id: s.id, initial: s.initialValue ?? null }));
  const needsState = hasSetState || globalStateVars.length > 0 || localStateVars.length > 0;

  const imports: string[] = ['"use client";'];
  if (hasNavigate) imports.push('import { useRouter } from "next/navigation";');
  if (needsState) imports.push('import { useState } from "react";');

  const hooks: string[] = [];
  if (hasNavigate) hooks.push("  const router = useRouter();");
  globalStateVars.forEach((n) => hooks.push(`  const [${n}, set${toPascalCase(n)}] = useState<unknown>(null);`));
  (screen.localState ?? []).forEach((s: any) => {
    hooks.push(`  const [${s.id}, set${toPascalCase(s.id)}] = useState<unknown>(${JSON.stringify(s.initialValue ?? null)});`);
  });

  const themeOverrides = screen.meta?.themeOverrides ?? {};
  const themeStyle = Object.keys(themeOverrides).length > 0
    ? `, ${JSON.stringify(themeOverrides).replace(/"([^"]+)":/g, "'$1':").replace(/"/g, "'")}`
    : "";

  return `${imports.join("\n")}

export default function ${toPascalCase(screen.name)}Page() {
${hooks.join("\n")}${hooks.length ? "\n" : ""}
  return (
    <main style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', padding: '24px 16px'${themeStyle} }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>${screen.name}</h1>
${componentJSX}
    </main>
  );
}
`;
}

function generateLayoutWithTheme(schema: any, projectName: string): string {
  const colors = schema.theme?.colors ?? {};
  const cssVars = Object.entries(colors).map(([k, v]) => `    --color-${k}: ${v};`).join("\n");
  const bodyFont = schema.theme?.fonts?.body ?? "Inter, system-ui, sans-serif";

  return `import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "${schema.name || projectName}",
  description: "Generated by Mint Web",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style>{\`
          :root {
${cssVars}
          }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: ${bodyFont}; }
        \`}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
`;
}

function generateRootRedirect(schema: any): string {
  const firstScreen = (schema.screens ?? [])[0];
  const target = schema.navigation?.initialRoute ?? firstScreen?.route ?? "/home";
  return `import { redirect } from "next/navigation";
export default function RootPage() {
  redirect("${target}");
}
`;
}

function generateSchemaDbLib(schema: any): string {
  const tables: any[] = schema.database?.tables ?? [];
  const fns = tables.map((t: any) => {
    const name = toPascalCase(t.name);
    return `
export async function get${name}(limit = 100) {
  const res = await fetch(process.env.DB_PROXY_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "SELECT * FROM ${t.name} LIMIT $1", params: [limit] }),
  });
  const { rows } = await res.json();
  return rows as Record<string, unknown>[];
}

export async function insert${name}(data: Record<string, unknown>) {
  const keys = Object.keys(data);
  const vals = Object.values(data);
  const placeholders = keys.map((_, i) => \`$\${i + 1}\`).join(", ");
  const res = await fetch(process.env.DB_PROXY_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: \`INSERT INTO ${t.name} (\${keys.join(", ")}) VALUES (\${placeholders}) RETURNING *\`, params: vals }),
  });
  const { rows } = await res.json();
  return rows[0] as Record<string, unknown>;
}`;
  }).join("\n");

  return `// Generated by Mint Web — DB helper layer (proxies to DB_PROXY_URL)\n${fns}\n`;
}

function generateSchemaMiddleware(): string {
  return `import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_ROUTES = ["/login", "/signup", "/api/login", "/api/signup"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }
  const token =
    request.cookies.get("session")?.value ??
    request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
`;
}

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

    // ── SDUI files (live production updates) ──────────────────
    const hasSDUI = hasRuntimeBindings && !!options.projectId;
    if (hasSDUI) {
      files.push({
        path: "lib/mint-live.tsx",
        content: generateMintLiveProvider(options, routes),
        type: "text",
      });
      files.push({
        path: "components/MintWebRenderer.tsx",
        content: generateMintWebRenderer(routes),
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
    const mintLiveImport = hasSDUI
      ? `import { MintLiveProvider } from "../lib/mint-live";\n`
      : "";
    const mintProviderOpen = hasRuntimeBindings ? `        <MintProvider>\n` : "";
    const mintProviderClose = hasRuntimeBindings ? `        </MintProvider>\n` : "";
    const mintLiveOpen = hasSDUI ? `          <MintLiveProvider>\n` : "";
    const mintLiveClose = hasSDUI ? `          </MintLiveProvider>\n` : "";

    files.push({
      path: "app/layout.tsx",
      content: `import type { Metadata } from "next";
${mintProviderImport}${mintLiveImport}${overlayProviderImport}import "./globals.css";

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
${mintProviderOpen}${mintLiveOpen}${overlayProviderOpen}        {children}
${overlayProviderClose}${mintLiveClose}${mintProviderClose}      </body>
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
        content: generateFramePage(route, routedInteractions, manifest, hasNavigateInteractions, hasOverlays, hasRuntimeBindings, hasSDUI),
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

    // ── Schema-driven generation (studio screens override canvas pages) ──
    const rSchema = options.runtimeSchema;
    if (rSchema && Array.isArray(rSchema.screens) && rSchema.screens.length > 0) {
      // Override layout with theme-aware version
      const layoutIdx = files.findIndex((f) => f.path === "app/layout.tsx");
      const layoutContent = generateLayoutWithTheme(rSchema, projectName);
      if (layoutIdx >= 0) {
        files[layoutIdx] = { path: "app/layout.tsx", content: layoutContent, type: "text" };
      } else {
        files.push({ path: "app/layout.tsx", content: layoutContent, type: "text" });
      }

      // Root redirect
      files.push({ path: "app/_root-redirect/page.tsx", content: generateRootRedirect(rSchema), type: "text" });

      // One page per screen
      for (const screen of rSchema.screens) {
        const routeSegment = String(screen.route ?? "").replace(/^\//, "") || "home";
        files.push({
          path: `app/${routeSegment}/page.tsx`,
          content: generateScreenPage(screen, rSchema),
          type: "text",
        });
      }

      // DB helper lib
      if ((rSchema.database?.tables?.length ?? 0) > 0) {
        files.push({ path: "lib/schema-db.ts", content: generateSchemaDbLib(rSchema), type: "text" });
      }

      // Auth middleware
      const authEnabled = Array.isArray(rSchema.auth?.providers) && rSchema.auth.providers.some((p: any) => p.enabled);
      if (authEnabled) {
        files.push({ path: "middleware.ts", content: generateSchemaMiddleware(), type: "text" });
      }
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
  hasRuntimeBindings: boolean = false,
  hasSDUI: boolean = false
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
    if (hasSDUI) {
      imports.push(`import { useMintDesign } from "${route.isHome ? '../' : '../../'}lib/mint-live";`);
      imports.push(`import { MintWebRenderer } from "${route.isHome ? '../' : '../../'}components/MintWebRenderer";`);
      hookLines.push(`  const { screenData, designData, isLive } = useMintDesign("${frame.id}");`);
    }
    if (frame.bindings?.onMount) {
      hookLines.push(`\n  useEffect(() => {\n    if (actions.${frame.bindings.onMount}) {\n      actions.${frame.bindings.onMount}();\n    }\n  }, [actions]);`);
    }

    const sduiCheck = hasSDUI ? `
  // Live SDUI — render dynamically from server data (works in production)
  if (isLive && screenData) {
    return (
      <MintWebRenderer
        node={screenData}
        interactions={designData?.interactions || []}
      />
    );
  }
` : "";

    return `"use client";

${imports.join("\n")}

export default function ${route.componentName}Page() {
${hookLines.join("\n")}
${sduiCheck}
  // ${hasSDUI ? 'Offline fallback — static generated UI' : ''}
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

// ═══════════════════════════════════════════════════════════════
// SDUI — Server-Driven UI for Next.js (production live updates)
// ═══════════════════════════════════════════════════════════════

function generateMintLiveProvider(
  options: ConversionOptions,
  routes: FrameRoute[]
): string {
  const apiOrigin = process.env.NEXT_PUBLIC_APP_URL || "https://mintweb.mintit.pro";
  const projectId = options.projectId || "unknown";
  const authToken = options.authToken || "";

  return `"use client";
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useMint } from "./mint-runtime";

const API_ORIGIN = "${apiOrigin}";
const PROJECT_ID = "${projectId}";
const AUTH_TOKEN = "";
const POLL_INTERVAL = 5000;
const CACHE_KEY = "@mint_web_design";

function authHeaders(): Record<string, string> {
  if (!AUTH_TOKEN) return {};
  return { Authorization: \`Bearer \${AUTH_TOKEN}\` };
}

interface DesignData {
  nodes: any[];
  interactions: any[];
  referenceFrame?: any;
  runtimeSchema?: any;
}

interface MintLiveContextValue {
  designData: DesignData | null;
  version: number;
  isLive: boolean;
  isLoading: boolean;
  getScreenNodes: (screenId: string) => any | null;
  screenData?: any;
}

const MintLiveContext = createContext<MintLiveContextValue>({
  designData: null,
  version: 0,
  isLive: false,
  isLoading: false,
  getScreenNodes: () => null,
});

export function useMintDesign(screenId?: string) {
  const ctx = useContext(MintLiveContext);
  if (!screenId) return ctx;
  return { ...ctx, screenData: ctx.getScreenNodes(screenId) };
}

function SchemaUpdater({ designData, version }: { designData: DesignData | null; version: number }) {
  const { updateSchema } = useMint();
  useEffect(() => {
    if (designData?.runtimeSchema && updateSchema) {
      updateSchema(designData.runtimeSchema, version);
    }
  }, [designData, version, updateSchema]);
  return null;
}

export function MintLiveProvider({ children }: { children: React.ReactNode }) {
  const [designData, setDesignData] = useState<DesignData | null>(null);
  const [version, setVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const lastVersionRef = useRef(0);

  useEffect(() => {
    // Load from localStorage cache
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.designData) {
          setDesignData(parsed.designData);
          setVersion(parsed.version || 0);
          lastVersionRef.current = parsed.version || 0;
        }
      }
    } catch {}

    // Poll for updates
    const poll = async () => {
      try {
        const url = API_ORIGIN + "/api/design-data/" + PROJECT_ID + "?since=" + lastVersionRef.current;
        const res = await fetch(url, { headers: authHeaders() });
        if (res.status === 204 || !res.ok) return;
        const data = await res.json();
        if (data.designData && data.version > lastVersionRef.current) {
          setDesignData(data.designData);
          setVersion(data.version);
          lastVersionRef.current = data.version;
          try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
        }
      } catch {}
    };

    poll();
    const timer = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  const getScreenNodes = useCallback((screenId: string) => {
    if (!designData?.nodes) return null;
    return designData.nodes.find((n: any) => n.id === screenId) || null;
  }, [designData]);

  const value: MintLiveContextValue = {
    designData, version, isLive: !!designData, isLoading, getScreenNodes,
  };

  return (
    <MintLiveContext.Provider value={value}>
      <SchemaUpdater designData={designData} version={version} />
      {children}
    </MintLiveContext.Provider>
  );
}
`;
}

function generateMintWebRenderer(routes: FrameRoute[]): string {
  const routeEntries = routes.map((r) =>
    `  "${r.frame.id}": "${r.isHome ? "/" : `/${r.slug}`}"`
  ).join(",\n");

  return `"use client";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMint } from "../lib/mint-runtime";

const ROUTE_MAP: Record<string, string> = {
${routeEntries}
};

function resolveBinding(expr: string, state: any, loopCtx?: Record<string, any>): any {
  if (!expr) return undefined;
  const path = expr.startsWith("$") ? expr.slice(1) : expr;
  const parts = path.split(".");
  if (loopCtx && parts[0] in loopCtx) {
    let cur: any = loopCtx;
    for (const p of parts) { if (cur == null) return undefined; cur = cur[p]; }
    return cur;
  }
  let cur: any = state;
  for (const p of parts) { if (cur == null) return undefined; cur = cur[p]; }
  return cur;
}

interface MintWebRendererProps {
  node: any;
  interactions?: any[];
}

export function MintWebRenderer({ node, interactions = [] }: MintWebRendererProps) {
  const { actions } = useMint();
  const bgFill = node.fills?.find((f: any) => f.type === "SOLID");
  const bgColor = bgFill?.color || undefined;
  const onMount = node.pluginData?.runtimeBindings?.onMount;

  useEffect(() => {
    if (onMount && (actions as any)[onMount]) {
      (actions as any)[onMount]();
    }
  }, [onMount]);

  return (
    <main style={{ width: "100vw", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: "#f5f5f5" }}>
      <section style={{ width: node.width, height: node.height, position: "relative", overflow: "hidden", flexShrink: 0, backgroundColor: bgColor }}>
        {node.children?.map((child: any) => (
          <NodeRenderer key={child.id} node={child} interactions={interactions} />
        ))}
      </section>
    </main>
  );
}

function NodeRenderer({ node, interactions, loopCtx }: { node: any; interactions: any[]; loopCtx?: Record<string, any> }) {
  const router = useRouter();
  const { state, setState, actions } = useMint();

  if (node.visible === false) return null;
  const b = node.pluginData?.runtimeBindings;

  // ── repeatFor: render as list ──
  if (b?.repeatFor && b?.repeatAs) {
    const listKey = b.repeatFor.replace(/^\\$/, "");
    let listData = resolveBinding(listKey, state, loopCtx);
    if (!Array.isArray(listData)) listData = [];
    const itemVar = b.repeatAs.trim();
    const kids = node.children || [];
    let minY = 0, itemH = 0;
    if (kids.length > 0) {
      minY = Math.floor(Math.min(...kids.map((c: any) => c.y)));
      const maxY = Math.ceil(Math.max(...kids.map((c: any) => c.y + c.height)));
      itemH = Math.max(0, maxY - minY);
    }
    const gap = 12;
    const style = buildStyle(node);
    return (
      <div style={{ ...style, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ height: minY, flexShrink: 0 }} />
        {listData.map((item: any, idx: number) => {
          const childCtx = { ...loopCtx, [itemVar]: item };
          return (
            <div key={idx} style={{ position: "relative", width: "100%", height: itemH + gap, flexShrink: 0 }}>
              <div style={{ position: "absolute", top: -minY, left: 0, width: "100%", height: "100%" }}>
                {kids.map((child: any) => (
                  <NodeRenderer key={child.id + "-" + idx} node={child} interactions={interactions} loopCtx={childCtx} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── inputBind: render <input> ──
  if (b?.inputBind) {
    const stateKey = b.inputBind.replace(/^\\$/, "").trim();
    const value = resolveBinding(stateKey, state, loopCtx);
    const style = buildStyle(node);
    return (
      <input
        style={{ ...style, color: "#e2e8f0", paddingLeft: 12, fontSize: 16, border: "none", outline: "none", boxSizing: "border-box" as const }}
        value={value ?? ""}
        onChange={(e) => setState(stateKey, e.target.value)}
        placeholder={node.name?.replace(/_/g, " ") || ""}
      />
    );
  }

  const isText = node.type === "TEXT";
  const style = buildStyle(node);

  // onClick from bindings or interactions
  const nodeIx = interactions.find((ix: any) => ix.sourceId === node.id);
  const isClickable = !!b?.onClick || !!nodeIx;

  const handleClick = isClickable ? () => {
    if (b?.onClick) {
      const fn = (actions as any)[b.onClick];
      if (fn) fn(); else console.warn("Action not found:", b.onClick);
      return;
    }
    if (nodeIx) {
      if (nodeIx.action === "NAVIGATE" && nodeIx.targetId) {
        const route = ROUTE_MAP[nodeIx.targetId];
        if (route) router.push(route);
      } else if (nodeIx.action === "BACK") {
        router.back();
      } else if (nodeIx.action === "OPEN_URL" && nodeIx.destinationUrl) {
        window.open(nodeIx.destinationUrl, "_blank");
      }
    }
  } : undefined;

  // ── Text node ──
  if (isText && node.text) {
    let displayText = node.text.characters || "";
    if (b?.textBind) {
      const bound = resolveBinding(b.textBind, state, loopCtx);
      if (bound != null) displayText = String(bound);
    }
    const textStyle: React.CSSProperties = {
      fontFamily: node.text.fontFamily ? node.text.fontFamily + ", system-ui, sans-serif" : undefined,
      fontSize: node.text.fontSize,
      fontWeight: node.text.fontWeight,
      color: node.text.color,
      textAlign: node.text.textAlign?.toLowerCase() as any,
    };
    return (
      <div style={{ ...style, cursor: isClickable ? "pointer" : undefined }} onClick={handleClick}>
        <span style={textStyle}>{displayText}</span>
      </div>
    );
  }

  // ── Container with children ──
  if (node.children?.length) {
    return (
      <div style={{ ...style, cursor: isClickable ? "pointer" : undefined }} onClick={handleClick}>
        {node.children.map((child: any) => (
          <NodeRenderer key={child.id} node={child} interactions={interactions} loopCtx={loopCtx} />
        ))}
      </div>
    );
  }

  // ── Leaf node ──
  return <div style={{ ...style, cursor: isClickable ? "pointer" : undefined }} onClick={handleClick} />;
}

function buildStyle(node: any): React.CSSProperties {
  const style: React.CSSProperties = {
    position: "absolute",
    left: Math.round(node.x),
    top: Math.round(node.y),
    width: Math.round(node.width),
    height: Math.round(node.height),
    boxSizing: "border-box",
  };
  if (node.type !== "TEXT" && node.fills?.length) {
    const solid = node.fills.find((f: any) => f.type === "SOLID" && f.color);
    if (solid) style.backgroundColor = solid.color;
  }
  if (node.corners?.uniform) style.borderRadius = node.corners.uniform;
  if (node.opacity !== undefined && node.opacity < 1) style.opacity = node.opacity;
  if (node.strokes?.length) {
    const s = node.strokes[0];
    if (s.color && s.weight) { style.borderWidth = s.weight; style.borderColor = s.color; style.borderStyle = "solid"; }
  }
  if (node.layout?.mode && node.layout.mode !== "NONE") {
    style.display = "flex";
    style.flexDirection = node.layout.mode === "VERTICAL" ? "column" : "row";
    if (node.layout.gap) style.gap = node.layout.gap;
  }
  return style;
}
`;
}

export default nextBuilder;

