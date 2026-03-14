// ═══════════════════════════════════════════════════════════════
// React Native Builder — v4.0.0
// Generates a complete Expo app with expo-router file-based routing
// Each top-level frame = a screen route
// Overlay system via Modal + React Context
// Transition animations via expo-router screen options
// ═══════════════════════════════════════════════════════════════

import type {
  DrawableNode,
  ImageManifest,
  ConversionOptions,
  GeneratedFile,
  Interaction,
  FrameworkBuilder,
  TextStyle,
} from "../types";
import { generateImagesDocument, collectImages } from "../core/images";
import {
  buildFrameRoutes,
  buildRouteMap,
  rewriteInteractionsForRouting,
  type FrameRoute,
} from "../core/routing";
import {
  analyzeOverlays,
  type OverlayFrame,
} from "../core/overlays";
import {
  rnTransitionOptions,
  buildTransitionMap,
} from "../core/transitions";

export const reactNativeBuilder: FrameworkBuilder = {
  name: "react-native",
  displayName: "React Native (Expo)",
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

    // ── Build route map (only page frames, not overlays) ──────
    const routes = buildFrameRoutes(pageFrames);
    const routeMap = buildRouteMap(routes);
    const routedInteractions = rewriteInteractionsForRouting(interactions, routeMap);
    const hasNavigateInteractions = interactions.some(
      (i) => i.action === "NAVIGATE" && i.targetId
    );
    const transitionMap = buildTransitionMap(interactions);

    // package.json
    files.push({
      path: "package.json",
      content: JSON.stringify(
        {
          name: options.fileName?.toLowerCase().replace(/\s+/g, "-") || "design-export",
          version: "1.0.0",
          main: "expo-router/entry",
          scripts: {
            start: "expo start",
            android: "expo start --android",
            ios: "expo start --ios",
            web: "expo start --web",
          },
          dependencies: {
            expo: "~50.0.0",
            "expo-router": "~3.4.0",
            "expo-status-bar": "~1.11.0",
            react: "18.2.0",
            "react-native": "0.73.0",
            "react-native-safe-area-context": "4.8.0",
            "react-native-screens": "~3.29.0",
          },
          devDependencies: {
            "@babel/core": "^7.23.0",
            "@types/react": "~18.2.0",
            typescript: "^5.3.0",
          },
          private: true,
        },
        null,
        2
      ),
      type: "text",
    });

    // app.json
    files.push({
      path: "app.json",
      content: JSON.stringify(
        {
          expo: {
            name: options.fileName || "Design Export",
            slug: options.fileName?.toLowerCase().replace(/\s+/g, "-") || "design-export",
            version: "1.0.0",
            orientation: "portrait",
            icon: "./assets/icon.png",
            userInterfaceStyle: "automatic",
            splash: {
              image: "./assets/splash.png",
              resizeMode: "contain",
              backgroundColor: "#1a1a1a",
            },
            assetBundlePatterns: ["**/*"],
            ios: {
              supportsTablet: true,
            },
            android: {
              adaptiveIcon: {
                foregroundImage: "./assets/adaptive-icon.png",
                backgroundColor: "#1a1a1a",
              },
            },
            web: {
              bundler: "metro",
              favicon: "./assets/favicon.png",
            },
            scheme: options.fileName?.toLowerCase().replace(/\s+/g, "-") || "design-export",
          },
        },
        null,
        2
      ),
      type: "text",
    });

    // tsconfig.json
    files.push({
      path: "tsconfig.json",
      content: JSON.stringify(
        {
          extends: "expo/tsconfig.base",
          compilerOptions: {
            strict: true,
            paths: {
              "@/*": ["./*"],
            },
          },
          include: ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"],
        },
        null,
        2
      ),
      type: "text",
    });

    // ── app/_layout.tsx — Stack navigator with transitions ───
    const screenEntries = routes.map((r) => {
      const routeName = r.isHome ? "index" : r.slug;
      const txOpts = rnTransitionOptions(transitionMap.get(r.frame.id));
      if (txOpts) {
        return `        <Stack.Screen name="${routeName}" options={{ headerShown: false, ${txOpts} }} />`;
      }
      return `        <Stack.Screen name="${routeName}" options={{ headerShown: false }} />`;
    }).join("\n");

    const overlayProviderImport = hasOverlays
      ? `import { OverlayProvider } from "../components/OverlayProvider";\n`
      : "";
    const overlayProviderOpen = hasOverlays ? `      <OverlayProvider>\n` : "";
    const overlayProviderClose = hasOverlays ? `      </OverlayProvider>\n` : "";

    files.push({
      path: "app/_layout.tsx",
      content: `import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
${overlayProviderImport}
export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
${overlayProviderOpen}      <Stack>
${screenEntries}
      </Stack>
${overlayProviderClose}    </>
  );
}
`,
      type: "text",
    });

    // ── Overlay components ─────────────────────────────────────
    if (hasOverlays) {
      files.push({
        path: "components/OverlayProvider.tsx",
        content: generateRNOverlayProvider(overlayFrames, routedInteractions, manifest),
        type: "text",
      });
    }

    // ── app/index.tsx — home route (first frame) ──────────────
    // ── app/<slug>.tsx — subsequent frame routes ──────────────
    for (const route of routes) {
      const fileName = route.isHome ? "app/index.tsx" : `app/${route.slug}.tsx`;
      files.push({
        path: fileName,
        content: generateRNScreenComponent(route, routedInteractions, manifest, hasOverlays),
        type: "text",
      });
    }

    // components/DesignNode.tsx
    files.push({
      path: "components/DesignNode.tsx",
      content: `import React from "react";
import { View, Text, Image, ViewStyle, TextStyle, ImageStyle } from "react-native";

interface DesignNodeData {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: {
    type: string;
    color?: string;
    imageRef?: string;
  };
  text?: {
    characters?: string;
    color?: string;
    fontSize?: number;
    fontWeight?: string | number;
    fontFamily?: string;
    textAlign?: string;
  };
  corners?: {
    uniform?: number;
  };
  opacity?: number;
  children?: DesignNodeData[];
}

interface Props {
  node: DesignNodeData;
}

export function DesignNode({ node }: Props) {
  const containerStyle: ViewStyle = {
    position: "absolute",
    left: node.x,
    top: node.y,
    width: node.w,
    height: node.h,
    ...(node.fill?.type === "SOLID" && node.fill.color
      ? { backgroundColor: node.fill.color }
      : {}),
    ...(node.corners?.uniform ? { borderRadius: node.corners.uniform } : {}),
    ...(node.opacity !== undefined && node.opacity < 1 ? { opacity: node.opacity } : {}),
  };

  // Text node
  if (node.type === "TEXT" && node.text) {
    const textStyle: TextStyle = {
      color: node.text.color || "#000",
      fontSize: node.text.fontSize || 14,
      fontWeight: (node.text.fontWeight as TextStyle["fontWeight"]) || "400",
      textAlign: (node.text.textAlign?.toLowerCase() as TextStyle["textAlign"]) || "left",
    };

    return (
      <View style={containerStyle}>
        <Text style={textStyle}>{node.text.characters || ""}</Text>
      </View>
    );
  }

  // Image node
  if (node.type === "IMAGE" || node.fill?.type === "IMAGE") {
    const src = node.fill?.imageRef;
    if (src) {
      const imageStyle: ImageStyle = {
        width: "100%" as unknown as number,
        height: "100%" as unknown as number,
        borderRadius: node.corners?.uniform || 0,
      };

      return (
        <View style={containerStyle}>
          <Image
            source={{ uri: src }}
            style={imageStyle}
            resizeMode="cover"
          />
        </View>
      );
    }
  }

  // Container with children
  return (
    <View style={containerStyle}>
      {node.children?.map((child) => (
        <DesignNode key={child.id} node={child} />
      ))}
    </View>
  );
}
`,
      type: "text",
    });

    // README.md
    files.push({
      path: "README.md",
      content: `# ${options.fileName || "Design Export"} — React Native (Expo Router)

Generated from a design file.

## Getting Started

\`\`\`bash
npm install
npx expo start
\`\`\`

## Screens

${routes.map((r, i) => `${i + 1}. **${r.frame.name}** → \`${r.isHome ? "/" : `/${r.slug}`}\` (${Math.round(r.frame.w)}×${Math.round(r.frame.h)})`).join("\n")}

${hasNavigateInteractions ? `## Navigation

Interactions wired as expo-router navigation:

${interactions
  .filter((i) => i.action === "NAVIGATE" && i.targetId)
  .map((i) => {
    const sourceName = nodes.find((n) => n.id === i.sourceId)?.name || i.sourceId;
    const targetRoute = routeMap.get(i.targetId || "") || i.targetId;
    return `- **${sourceName}** → \`${targetRoute}\` (${i.trigger})`;
  }).join("\n")}` : ""}

## Running on devices

- Press \`a\` to open on Android emulator
- Press \`i\` to open on iOS simulator
- Scan QR code with Expo Go app on your phone
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

    // Add placeholder assets
    files.push({
      path: "assets/.gitkeep",
      content: "",
      type: "text",
    });

    // Add image assets
    for (const [localPath, blob] of manifest.blobs) {
      files.push({
        path: `assets${localPath.replace("/assets", "")}`,
        content: blob,
        type: "binary",
      });
    }

    return files;
  },
};

// ═══════════════════════════════════════════════════════════════
// Screen Component Generator — one per frame
// ═══════════════════════════════════════════════════════════════

function generateRNScreenComponent(
  route: FrameRoute,
  routedInteractions: Interaction[],
  manifest: ImageManifest,
  hasOverlays: boolean
): string {
  const { frame } = route;
  const refW = Math.round(frame.w);
  const refH = Math.round(frame.h);

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
  const pageHasBack = pageInteractions.some(
    (ix) => ix.action === "BACK"
  );
  const pageHasUrl = pageInteractions.some(
    (ix) => ix.action === "OPEN_URL" && ix.destinationUrl
  );
  const needsInteractions = pageHasNav || pageHasOverlay || pageHasBack || pageHasUrl;

  // Build the RN tree for this frame's children
  const rnContent = frame.children?.length
    ? frame.children
        .map((child) =>
          renderRNNode(
            child,
            manifest,
            needsInteractions ? pageInteractions : undefined,
            pageHasNav ? "navigate" : undefined,
            10,
            pageHasOverlay ? "openOverlay" : undefined,
            pageHasOverlay ? "closeOverlay" : undefined,
            pageHasOverlay ? "swapOverlay" : undefined
          )
        )
        .join("\n")
    : "";

  const imports: string[] = [];
  const hooks: string[] = [];
  const callbacks: string[] = [];

  if (pageHasNav) {
    imports.push(`import { useRouter } from "expo-router";`);
    hooks.push(`  const router = useRouter();`);
    callbacks.push(`  const navigate = useCallback((path: string) => { router.push(path as any); }, [router]);`);
  }
  if (pageHasBack && !pageHasNav) {
    imports.push(`import { useRouter } from "expo-router";`);
    hooks.push(`  const router = useRouter();`);
  }
  if (pageHasNav || pageHasBack || pageHasOverlay) {
    imports.push(`import { useCallback } from "react";`);
  }
  if (pageHasOverlay && hasOverlays) {
    imports.push(`import { useOverlay } from "../components/OverlayProvider";`);
    hooks.push(`  const { openOverlay, closeOverlay, swapOverlay } = useOverlay();`);
  }
  if (pageHasBack) {
    callbacks.push(`  const goBack = useCallback(() => { router.back(); }, [router]);`);
  }
  if (pageHasUrl) {
    imports.push(`import { Linking } from "react-native";`);
  }

  // Deduplicate imports
  const uniqueImports = [...new Set(imports)];

  const hookBlock = hooks.length || callbacks.length
    ? `\n${hooks.join("\n")}\n${callbacks.join("\n")}\n`
    : "";

  // Detect if the top-level frame should scroll
  const frameScrollX = frame.ux?.scrollX ||
    frame.scroll?.overflowBehavior === "horizontal" || frame.scroll?.overflowBehavior === "both";
  const frameScrollY = frame.ux?.scrollY ||
    frame.scroll?.overflowBehavior === "vertical" || frame.scroll?.overflowBehavior === "both";
  const frameScrolls = frameScrollX || frameScrollY;

  // Build the inner content — wrap in ScrollView if frame scrolls
  const designContainerContent = frameScrolls
    ? `        <ScrollView${frameScrollX ? " horizontal" : ""} showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} style={{ width: DESIGN_WIDTH, height: DESIGN_HEIGHT }}>
          <View style={[styles.designContainer, { transform: [{ scale: SCALE }] }]}>
${rnContent}
          </View>
        </ScrollView>`
    : `        <View style={[styles.designContainer, { transform: [{ scale: SCALE }] }]}>
${rnContent}
        </View>`;

  return `import { StyleSheet, View, Dimensions, Text, Image, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
${uniqueImports.join("\n")}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const DESIGN_WIDTH = ${refW};
const DESIGN_HEIGHT = ${refH};
const SCALE = Math.min(SCREEN_WIDTH / DESIGN_WIDTH, SCREEN_HEIGHT / DESIGN_HEIGHT, 1);

export default function ${route.componentName}Screen() {${hookBlock}
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.centered}>
${designContainerContent}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  designContainer: {
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    position: "relative",
  },
});
`;
}

// ═══════════════════════════════════════════════════════════════
// React Native Component Generation
// ═══════════════════════════════════════════════════════════════

function renderRNNode(
  node: DrawableNode,
  manifest: ImageManifest,
  interactions?: Interaction[],
  navigateHandler?: string,
  indent = 6,
  overlayHandler?: string,
  closeOverlayHandler?: string,
  swapOverlayHandler?: string
): string {
  const spaces = " ".repeat(indent);
  const style = generateRNStyle(node);

  // Check for any interaction that needs Pressable wrapping
  let wrapWithPressable = false;
  let pressableAction = "";

  if (interactions?.length) {
    // NAVIGATE
    if (navigateHandler) {
      const navIx = interactions.find(
        (i) => i.sourceId === node.id && i.action === "NAVIGATE" && i.targetId
      );
      if (navIx) {
        wrapWithPressable = true;
        pressableAction = `${navigateHandler}("${navIx.targetId}")`;
      }
    }

    // OPEN_OVERLAY
    if (overlayHandler) {
      const openIx = interactions.find(
        (i) => i.sourceId === node.id && i.action === "OPEN_OVERLAY" && i.targetId
      );
      if (openIx) {
        wrapWithPressable = true;
        pressableAction = `${overlayHandler}("${openIx.targetId}")`;
      }
    }

    // CLOSE_OVERLAY
    if (closeOverlayHandler) {
      const closeIx = interactions.find(
        (i) => i.sourceId === node.id && i.action === "CLOSE_OVERLAY"
      );
      if (closeIx) {
        wrapWithPressable = true;
        pressableAction = `${closeOverlayHandler}()`;
      }
    }

    // SWAP_OVERLAY
    if (swapOverlayHandler) {
      const swapIx = interactions.find(
        (i) => i.sourceId === node.id && i.action === "SWAP_OVERLAY" && i.targetId
      );
      if (swapIx) {
        wrapWithPressable = true;
        pressableAction = `${swapOverlayHandler}("${swapIx.targetId}")`;
      }
    }

    // BACK
    const backIx = interactions.find(
      (i) => i.sourceId === node.id && i.action === "BACK"
    );
    if (backIx) {
      wrapWithPressable = true;
      pressableAction = `goBack()`;
    }

    // OPEN_URL
    const urlIx = interactions.find(
      (i) => i.sourceId === node.id && i.action === "OPEN_URL" && i.destinationUrl
    );
    if (urlIx) {
      wrapWithPressable = true;
      pressableAction = `Linking.openURL("${urlIx.destinationUrl}")`;
    }

    // SCROLL_TO
    const scrollIx = interactions.find(
      (i) => i.sourceId === node.id && i.action === "SCROLL_TO" && i.targetId
    );
    if (scrollIx) {
      // ScrollTo in RN would require refs — skip wrapping for now
    }
  }

  let content: string;

  // Determine if this node is a scroll container
  const isScrollContainer =
    node.ux?.scrollX || node.ux?.scrollY ||
    (node.scroll?.overflowBehavior && node.scroll.overflowBehavior !== "none");

  const scrollHorizontal = node.ux?.scrollX ||
    node.scroll?.overflowBehavior === "horizontal" ||
    node.scroll?.overflowBehavior === "both";

  const scrollVertical = node.ux?.scrollY ||
    node.scroll?.overflowBehavior === "vertical" ||
    node.scroll?.overflowBehavior === "both";

  // Text node
  if (node.type === "TEXT" && node.text) {
    const textStyle = generateRNTextStyle(node.text);
    const text = node.text.characters ?? "";
    content = `${spaces}<View style={${style}}>
${spaces}  <Text style={${textStyle}}>${escapeRNText(text)}</Text>
${spaces}</View>`;
  }
  // Image node
  else if (node.type === "IMAGE" || node.fill?.type === "IMAGE") {
    let src = node.fill?.imageRef ?? "";
    if (manifest.images.has(src)) {
      src = manifest.images.get(src)!;
    }

    if (src) {
      const source = src.startsWith("http") || src.startsWith("data:")
        ? `{ uri: "${src}" }`
        : `require("../assets${src.replace("/assets", "")}")`;

      content = `${spaces}<View style={${style}}>
${spaces}  <Image source={${source}} style={{ width: "100%", height: "100%", borderRadius: ${node.corners?.uniform || 0} }} resizeMode="cover" />
${spaces}</View>`;
    } else {
      content = `${spaces}<View style={${style}} />`;
    }
  }
  // Container with children — may be scrollable
  else if (node.children?.length) {
    // Separate fixed children from scrollable children
    const fixedChildren = isScrollContainer
      ? node.children.filter((c) => c.scroll?.fixedWhenScrolling)
      : [];
    const scrollableChildren = fixedChildren.length > 0
      ? node.children.filter((c) => !c.scroll?.fixedWhenScrolling)
      : node.children;

    const childContent = scrollableChildren
      .map((child) =>
        renderRNNode(child, manifest, interactions, navigateHandler, indent + 2, overlayHandler, closeOverlayHandler, swapOverlayHandler)
      )
      .join("\n");

    if (isScrollContainer) {
      // Compute the actual content dimensions from children
      const contentW = Math.ceil(Math.max(...scrollableChildren.map((c) => c.x + c.w)));
      const contentH = Math.ceil(Math.max(...scrollableChildren.map((c) => c.y + c.h)));

      // Determine ScrollView props
      const scrollProps: string[] = [];
      if (scrollHorizontal) scrollProps.push("horizontal");
      scrollProps.push("showsVerticalScrollIndicator={false}");
      scrollProps.push("showsHorizontalScrollIndicator={false}");
      if (node.ux?.snap) {
        const snapInterval = computeHorizontalSnapInterval(scrollableChildren, node);
        scrollProps.push(`pagingEnabled`);
        scrollProps.push(`decelerationRate="fast"`);
        scrollProps.push(`snapToAlignment="start"`);
        if (snapInterval) {
          scrollProps.push(`snapToInterval={${snapInterval}}`);
        }
      }

      // contentContainerStyle gives the ScrollView an inner size for scrollable area
      const ccWidth = scrollHorizontal ? contentW : Math.round(node.w);
      const ccHeight = scrollVertical ? contentH : Math.round(node.h);
      scrollProps.push(`contentContainerStyle={{ width: ${ccWidth}, height: ${ccHeight} }}`);

      const fixedContent = fixedChildren
        .map((child) =>
          renderRNNode(child, manifest, interactions, navigateHandler, indent + 2, overlayHandler, closeOverlayHandler, swapOverlayHandler)
        )
        .join("\n");

      // Wrap in ScrollView inside the container
      content = `${spaces}<View style={${style}}>
${spaces}  <ScrollView ${scrollProps.join(" ")} style={{ flex: 1 }}>
${childContent}
${spaces}  </ScrollView>${fixedContent ? `\n${fixedContent}` : ""}
${spaces}</View>`;
    } else {
      content = `${spaces}<View style={${style}}>
${childContent}
${spaces}</View>`;
    }
  }
  // Simple view
  else {
    content = `${spaces}<View style={${style}} />`;
  }

  // Wrap with Pressable if this node has an interaction
  if (wrapWithPressable && pressableAction) {
    return `${spaces}<Pressable onPress={() => ${pressableAction}}>
${content}
${spaces}</Pressable>`;
  }

  return content;
}

function computeHorizontalSnapInterval(
  children: DrawableNode[],
  container: DrawableNode
): number | undefined {
  if (children.length < 2) return undefined;

  const sorted = [...children].sort((a, b) => a.x - b.x);
  const firstGap = sorted[1].x - sorted[0].x;
  if (firstGap > 0) {
    return Math.round(firstGap);
  }

  const fallback = sorted[0].w + (container.layout?.gap ?? 0);
  if (fallback > 0) {
    return Math.round(fallback);
  }

  return undefined;
}

function generateRNStyle(node: DrawableNode): string {
  const parts: string[] = [];

  parts.push(`position: "absolute"`);
  parts.push(`left: ${Math.round(node.x)}`);
  parts.push(`top: ${Math.round(node.y)}`);
  parts.push(`width: ${Math.round(node.w)}`);
  parts.push(`height: ${Math.round(node.h)}`);

  if (node.fill?.type === "SOLID" && node.fill.color) {
    parts.push(`backgroundColor: "${node.fill.color}"`);
  }

  if (node.corners?.uniform) {
    parts.push(`borderRadius: ${node.corners.uniform}`);
  }

  if (node.opacity !== undefined && node.opacity < 1) {
    parts.push(`opacity: ${node.opacity}`);
  }

  // Clip content (Figma "Clip Content") → overflow: hidden
  // Applies when clipContent is on and there is no active scroll direction
  if (node.scroll?.clipContent) {
    if (!node.scroll.overflowBehavior || node.scroll.overflowBehavior === "none") {
      parts.push(`overflow: "hidden"`);
    }
  }

  return `{{ ${parts.join(", ")} }}`;
}

function generateRNTextStyle(text: TextStyle): string {
  const parts: string[] = [];

  if (text.color) parts.push(`color: "${text.color}"`);
  if (text.fontSize) parts.push(`fontSize: ${text.fontSize}`);
  if (text.fontWeight) parts.push(`fontWeight: "${text.fontWeight}"`);
  if (text.textAlign)
    parts.push(`textAlign: "${text.textAlign.toLowerCase()}"`);

  return `{{ ${parts.join(", ")} }}`;
}

function escapeRNText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
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
// React Native Overlay System (Modal + Context)
// ═══════════════════════════════════════════════════════════════

function generateRNOverlayProvider(
  overlayFrames: OverlayFrame[],
  routedInteractions: Interaction[],
  manifest: ImageManifest
): string {
  // Generate render code for each overlay frame's content
  const overlayComponents = overlayFrames.map((overlay) => {
    const { frame, componentName } = overlay;
    const w = Math.round(frame.w);
    const h = Math.round(frame.h);
    const bgColor =
      frame.fill?.type === "SOLID" && frame.fill.color
        ? frame.fill.color
        : "#FFFFFF";

    const innerContent = frame.children?.length
      ? frame.children
          .map((child) =>
            renderRNNode(
              child,
              manifest,
              routedInteractions,
              undefined,
              10,
              "openOverlay",
              "closeOverlay",
              "swapOverlay"
            )
          )
          .join("\n")
      : "";

    return { id: frame.id, componentName, w, h, bgColor, innerContent };
  });

  const registryEntries = overlayComponents
    .map(
      (ov) =>
        `  "${ov.id}": { name: "${ov.componentName}", w: ${ov.w}, h: ${ov.h}, bg: "${ov.bgColor}" }`
    )
    .join(",\n");

  const renderCases = overlayComponents
    .map(
      (ov) => `      case "${ov.id}":
        return (
          <View style={{ width: ${ov.w}, height: ${ov.h}, position: "relative", backgroundColor: "${ov.bgColor}", borderRadius: 12, overflow: "hidden" }}>
${ov.innerContent}
          </View>
        );`
    )
    .join("\n");

  return `import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { View, Text, Image, Pressable, Modal, StyleSheet, ScrollView, Dimensions } from "react-native";

interface OverlayEntry {
  id: string;
  key: number;
}

interface OverlayContextValue {
  openOverlay: (id: string) => void;
  closeOverlay: () => void;
  swapOverlay: (id: string) => void;
}

const OverlayContext = createContext<OverlayContextValue>({
  openOverlay: () => {},
  closeOverlay: () => {},
  swapOverlay: () => {},
});

export function useOverlay() {
  return useContext(OverlayContext);
}

let _nextKey = 0;

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<OverlayEntry[]>([]);

  const openOverlay = useCallback((id: string) => {
    _nextKey++;
    setStack((prev) => [...prev, { id, key: _nextKey }]);
  }, []);

  const closeOverlay = useCallback(() => {
    setStack((prev) => prev.slice(0, -1));
  }, []);

  const swapOverlay = useCallback((id: string) => {
    _nextKey++;
    setStack((prev) => [...prev.slice(0, -1), { id, key: _nextKey }]);
  }, []);

  function renderOverlayContent(id: string) {
    switch (id) {
${renderCases}
      default:
        return <View style={{ padding: 20 }}><Text>Unknown overlay: {id}</Text></View>;
    }
  }

  const topOverlay = stack.length > 0 ? stack[stack.length - 1] : null;

  return (
    <OverlayContext.Provider value={{ openOverlay, closeOverlay, swapOverlay }}>
      {children}
      {topOverlay && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={closeOverlay}
        >
          <Pressable style={overlayStyles.backdrop} onPress={closeOverlay}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              {renderOverlayContent(topOverlay.id)}
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </OverlayContext.Provider>
  );
}

const overlayStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
});
`;
}

export default reactNativeBuilder;
