// ═══════════════════════════════════════════════════════════════
// nextSchema — AppSchema → Next.js (App Router) emitter
//
// Reuses the shared schema-driven React renderer + embedded Mint runtime
// from reactWebSchema.ts; only the provider (next/navigation) and the
// scaffold (App Router) differ. The provider lives in the root layout so
// runtime state persists across route navigations; an optional catch-all
// page renders the screen matching the current pathname.
// ═══════════════════════════════════════════════════════════════

import type { AppSchema } from "../../runtime/schema";
import { generateMintRuntimeBundle } from "../../runtime/bundle";
import { collectStyles, rendererFile, type GeneratedFile, type WebSchemaOptions } from "./reactWebSchema";

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "app";

function providerFileNext(opts: WebSchemaOptions): string {
  const bakedOrigin = opts.apiOrigin || "";
  const bakedToken = opts.authToken || "";
  return `"use client";
import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import { useRouter } from "next/navigation";
import { createMintRuntime, configureMint } from "./mint-runtime.js";
import { SCHEMA, ROUTES } from "./schema.js";

// Backend origin + project token. Override per-environment with NEXT_PUBLIC_*
// (inlined at build); falls back to the values baked at export.
const API_ORIGIN = (typeof process !== "undefined" && process.env && process.env.NEXT_PUBLIC_MINT_API_ORIGIN) || ${JSON.stringify(bakedOrigin)};
const MINT_TOKEN = (typeof process !== "undefined" && process.env && process.env.NEXT_PUBLIC_MINT_TOKEN) || ${JSON.stringify(bakedToken)};
configureMint({ apiOrigin: API_ORIGIN, authToken: MINT_TOKEN });

const Ctx = createContext(null);
export function useMint() { return useContext(Ctx); }

function routeFor(target) {
  if (!target) return "/";
  if (ROUTES[target]) return ROUTES[target];
  return String(target)[0] === "/" ? String(target) : "/" + target;
}

export function MintProvider({ children }) {
  const ref = useRef(null);
  if (!ref.current) ref.current = createMintRuntime(SCHEMA);
  const runtime = ref.current;
  const router = useRouter();
  const [, force] = useReducer((x) => x + 1, 0);

  useEffect(() => runtime.state.subscribe("", () => force()), []);

  const navigation = useMemo(() => ({
    navigate: (r) => router.push(routeFor(r)),
    goBack: () => router.back(),
    replace: (r) => router.replace(routeFor(r)),
    reset: (routes) => { if (routes && routes[0]) router.push(routeFor(routes[0])); },
  }), [router]);

  const dispatch = useMemo(() => (refs, event) => {
    const list = Array.isArray(refs) ? refs : [refs];
    for (const r of list) Promise.resolve(runtime.actions.dispatch(r, { navigation, event })).catch((e) => {
      const msg = (e && e.message) || String(e);
      console.error("[mint] action failed:", msg);
      runtime.state.set("_lastError", msg);
    });
  }, [navigation]);

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

export function buildNextFromSchema(schema: AppSchema, opts: WebSchemaOptions): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const appName = opts.appName || schema.name || "Mint App";
  const name = slug(appName);

  const routesMap: Record<string, string> = {};
  for (const s of schema.screens ?? []) routesMap[s.id] = s.route;
  const themeBg = (schema.theme?.colors?.background as string) || "#ffffff";

  // ── Shared runtime modules (private app/_mint folder, not routed) ──
  files.push({ path: "app/_mint/mint-runtime.js", type: "text", content: generateMintRuntimeBundle() });
  files.push({ path: "app/_mint/MintProvider.jsx", type: "text", content: providerFileNext(opts) });
  files.push({ path: "app/_mint/SchemaRenderer.jsx", type: "text", content: rendererFile() });
  files.push({
    path: "app/_mint/schema.js",
    type: "text",
    content: `export const SCHEMA = ${JSON.stringify(schema)};
export const ROUTES = ${JSON.stringify(routesMap)};
export const THEME_BG = ${JSON.stringify(themeBg)};
`,
  });
  files.push({
    path: "app/_mint/styles.js",
    type: "text",
    content: `export const STYLES = ${JSON.stringify(collectStyles(schema))};
`,
  });
  files.push({
    path: "app/_mint/Providers.jsx",
    type: "text",
    content: `"use client";
import { MintProvider } from "./MintProvider.jsx";
export default function Providers({ children }) {
  return <MintProvider>{children}</MintProvider>;
}
`,
  });

  // ── App Router scaffold ──
  files.push({
    path: "app/layout.tsx",
    type: "text",
    content: `import Providers from "./_mint/Providers.jsx";

export const metadata = { title: ${JSON.stringify(appName)} };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
`,
  });

  // Optional catch-all page renders the screen matching the current path.
  files.push({
    path: "app/[[...slug]]/page.tsx",
    type: "text",
    content: `"use client";
import { usePathname } from "next/navigation";
import { ScreenHost } from "../_mint/SchemaRenderer.jsx";
import { SCHEMA, THEME_BG } from "../_mint/schema.js";

export default function Page() {
  const pathname = usePathname();
  const screens = (SCHEMA as any).screens || [];
  const initial = ((SCHEMA as any).navigation && (SCHEMA as any).navigation.initialRoute) || (screens[0] && screens[0].route) || "/";
  let screen = screens.find((s: any) => s.route === pathname);
  if (!screen && pathname === "/") screen = screens.find((s: any) => s.route === initial) || screens[0];
  if (!screen) screen = screens[0];
  if (!screen) return null;
  return <ScreenHost screen={screen} background={THEME_BG} />;
}
`,
  });

  files.push({
    path: "next.config.mjs",
    type: "text",
    content: `/** @type {import('next').NextConfig} */
const nextConfig = {};
export default nextConfig;
`,
  });

  files.push({
    path: "package.json",
    type: "text",
    content: JSON.stringify({
      name,
      private: true,
      version: "1.0.0",
      scripts: { dev: "next dev", build: "next build", start: "next start" },
      dependencies: {
        next: "^14.2.5",
        react: "^18.3.1",
        "react-dom": "^18.3.1",
      },
      devDependencies: {
        "@types/node": "^20",
        "@types/react": "^18",
        "@types/react-dom": "^18",
        typescript: "^5",
      },
    }, null, 2),
  });

  files.push({
    path: "tsconfig.json",
    type: "text",
    content: JSON.stringify({
      compilerOptions: {
        target: "ES2017",
        lib: ["dom", "dom.iterable", "esnext"],
        allowJs: true,
        skipLibCheck: true,
        strict: false,
        noEmit: true,
        esModuleInterop: true,
        module: "esnext",
        moduleResolution: "bundler",
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: "preserve",
        incremental: true,
        plugins: [{ name: "next" }],
      },
      include: ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
      exclude: ["node_modules"],
    }, null, 2),
  });

  files.push({
    path: ".env.example",
    type: "text",
    content: `# Copy to .env.local. Next inlines NEXT_PUBLIC_* into the client bundle at build.

# Backend the app's auth/fetch/DB calls target (baked default = the Mint editor
# you exported from). Override for staging/production.
NEXT_PUBLIC_MINT_API_ORIGIN=${opts.apiOrigin || "https://mintweb.mintit.pro"}

# Project token authenticating managed-DB + auth calls. A working default is
# baked into the export; set here to override. Set in host env, not in git.
NEXT_PUBLIC_MINT_TOKEN=
`,
  });

  files.push({
    path: "README.md",
    type: "text",
    content: `# ${appName}

Generated by Mint — a Next.js (App Router) app driven by your runtime schema.

- \`app/_mint/\` — embedded Mint runtime, provider, schema-driven renderer, styles.
- \`app/layout.tsx\` — mounts the runtime provider (state persists across routes).
- \`app/[[...slug]]/page.tsx\` — renders the screen matching the current path.

## Run

\`\`\`bash
npm install
npm run dev
\`\`\`

Actions (navigate, setState, fetch, mutate, signIn/out, …) run through the
embedded runtime — the same engine the Mint editor previews with.

## Configure the backend (auth + database)

Auth, \`fetch\`, and database calls go to **\`NEXT_PUBLIC_MINT_API_ORIGIN\`** with
**\`NEXT_PUBLIC_MINT_TOKEN\`** as a bearer token. Both are baked at export and
overridable via env:

\`\`\`bash
cp .env.example .env.local
# edit .env.local: point at your Mint backend + set the token
npm run dev
\`\`\`

A \`401\` or "set MINT_TOKEN" in the console means the token is missing/wrong
for the target origin.

## Deploy (Vercel)

1. Import the repo; framework preset = Next.js (build/output auto-detected).
2. Set env vars in project settings:
   - \`NEXT_PUBLIC_MINT_API_ORIGIN\` = your Mint backend origin
   - \`NEXT_PUBLIC_MINT_TOKEN\` = your project token
3. Deploy. The App Router catch-all serves every screen route.

## Editing this code

Everything under \`app/_mint/\` plus \`app/layout.tsx\` and \`app/[[...slug]]/page.tsx\`
is **generated** — a re-export from Mint overwrites it. Keep hand-written code in
new files/routes you add outside \`app/_mint/\`.
`,
  });

  return files;
}
