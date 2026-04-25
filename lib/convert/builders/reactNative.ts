// ═══════════════════════════════════════════════════════════════
// React Native Builder — v4.0.0
// Generates a complete Expo app with expo-router file-based routing
// Each top-level frame = a screen route
// Overlay system via Modal + React Context
// Transition animations via expo-router screen options
// ═══════════════════════════════════════════════════════════════

import { deflateSync } from "zlib";

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

    // We no longer generate package.json, app.json, and tsconfig.json here.
    // They are generated dynamically via \`npx create-expo-app\` in the convert API route.

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
import { MintLiveProvider } from "../providers/MintLiveProvider";
${overlayProviderImport}
export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <MintLiveProvider>
${overlayProviderOpen}      <Stack>
${screenEntries}
      </Stack>
${overlayProviderClose}      </MintLiveProvider>
    </>
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
  const isText = node.type === "TEXT";
  const containerStyle: ViewStyle = {
    position: "absolute",
    left: node.x,
    top: node.y,
    width: node.w,
    height: node.h,
    // Only apply background fill to non-text nodes (text uses fill as text color)
    ...(node.fill?.type === "SOLID" && node.fill.color && !isText
      ? { backgroundColor: node.fill.color }
      : {}),
    ...(node.corners?.uniform ? { borderRadius: node.corners.uniform } : {}),
    ...(node.opacity !== undefined && node.opacity < 1 ? { opacity: node.opacity } : {}),
  };

  // Text node
  if (isText && node.text) {
    const textStyle: TextStyle = {
      color: node.text.color || "#000",
      fontSize: node.text.fontSize || 14,
      fontWeight: (node.text.fontWeight as TextStyle["fontWeight"]) || "400",
      textAlign: (node.text.textAlign?.toLowerCase() as TextStyle["textAlign"]) || "left",
      ...(node.text.fontFamily ? { fontFamily: node.text.fontFamily.replace(/["']/g, "").trim() } : {}),
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

    // ── Server-Driven UI runtime files ─────────────────────────
    // These enable live OTA updates in production apps.
    // The app polls /api/design-data for new design JSON and
    // MintRenderer renders the UI dynamically from that JSON.
    files.push(...generateSDUIFiles(options, routes));

    // Add placeholder PNG assets required by Expo (icon, splash, adaptive-icon, favicon).
    // These are proper 512×512 solid-color PNGs so expo-splash-screen can generate
    // the splashscreen_logo Android drawable correctly during npx expo prebuild.
    const placeholderPng = buildSolidPng(512, 512, 99, 102, 241); // indigo #6366f1
    for (const assetName of ["icon.png", "splash-icon.png", "adaptive-icon.png", "favicon.png"]) {
      files.push({
        path: `assets/${assetName}`,
        content: placeholderPng,
        type: "binary",
      });
    }

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
import { useMintDesign } from "../providers/MintLiveProvider";
import { MintRenderer } from "../components/MintRenderer";
${uniqueImports.join("\n")}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const DESIGN_WIDTH = ${refW};
const DESIGN_HEIGHT = ${refH};
const SCALE = Math.min(SCREEN_WIDTH / DESIGN_WIDTH, SCREEN_HEIGHT / DESIGN_HEIGHT, 1);

export default function ${route.componentName}Screen() {
  const { screenData, designData, isLive } = useMintDesign("${frame.id}");
${hookBlock}
  // Live SDUI — render dynamically from server data (works in production)
  if (isLive && screenData) {
    return (
      <MintRenderer
        node={screenData}
        interactions={designData?.interactions || []}
      />
    );
  }

  // Offline fallback — static generated UI
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
  const pressableStyle = generateRNPressableStyle(node);
  const innerStyle = generateRNInnerStyle(node);

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
    if (wrapWithPressable) {
      content = `${spaces}  <View style={${innerStyle}}>
${spaces}    <Text style={${textStyle}}>${escapeRNText(text)}</Text>
${spaces}  </View>`;
    } else {
      content = `${spaces}<View style={${style}}>
${spaces}  <Text style={${textStyle}}>${escapeRNText(text)}</Text>
${spaces}</View>`;
    }
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

      if (wrapWithPressable) {
        content = `${spaces}  <View style={${innerStyle}}>
${spaces}    <Image source={${source}} style={{ width: "100%", height: "100%", borderRadius: ${node.corners?.uniform || 0} }} resizeMode="cover" />
${spaces}  </View>`;
      } else {
        content = `${spaces}<View style={${style}}>
${spaces}  <Image source={${source}} style={{ width: "100%", height: "100%", borderRadius: ${node.corners?.uniform || 0} }} resizeMode="cover" />
${spaces}</View>`;
      }
    } else {
      content = wrapWithPressable
        ? `${spaces}  <View style={${innerStyle}} />`
        : `${spaces}<View style={${style}} />`;
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

      const containerStyle = wrapWithPressable ? innerStyle : style;
      // Wrap in ScrollView inside the container
      content = `${spaces}<View style={${containerStyle}}>
${spaces}  <ScrollView ${scrollProps.join(" ")} style={{ flex: 1 }}>
${childContent}
${spaces}  </ScrollView>${fixedContent ? `\n${fixedContent}` : ""}
${spaces}</View>`;
    } else {
      const containerStyle = wrapWithPressable ? innerStyle : style;
      content = `${spaces}<View style={${containerStyle}}>
${childContent}
${spaces}</View>`;
    }
  }
  // Simple view
  else {
    content = wrapWithPressable
      ? `${spaces}  <View style={${innerStyle}} />`
      : `${spaces}<View style={${style}} />`;
  }

  // Wrap with Pressable if this node has an interaction
  // Position/size styles go on the Pressable so it has a proper hit area
  if (wrapWithPressable && pressableAction) {
    return `${spaces}<Pressable style={${pressableStyle}} onPress={() => ${pressableAction}}>
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

  // Only apply background fill to non-text nodes (text fill = text color, not bg)
  if (node.fill?.type === "SOLID" && node.fill.color && node.type !== "TEXT") {
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

  return `{ ${parts.join(", ")} }`;
}

/**
 * Position/size style for the Pressable wrapper — gives it a real hit area.
 */
function generateRNPressableStyle(node: DrawableNode): string {
  return `{ position: "absolute", left: ${Math.round(node.x)}, top: ${Math.round(node.y)}, width: ${Math.round(node.w)}, height: ${Math.round(node.h)} }`;
}

/**
 * Visual-only style for the inner View when wrapped by a Pressable.
 * Uses 100% width/height since the Pressable already handles positioning.
 */
function generateRNInnerStyle(node: DrawableNode): string {
  const parts: string[] = [];

  parts.push(`width: "100%"`);
  parts.push(`height: "100%"`);

  if (node.fill?.type === "SOLID" && node.fill.color && node.type !== "TEXT") {
    parts.push(`backgroundColor: "${node.fill.color}"`);
  }

  if (node.corners?.uniform) {
    parts.push(`borderRadius: ${node.corners.uniform}`);
  }

  if (node.opacity !== undefined && node.opacity < 1) {
    parts.push(`opacity: ${node.opacity}`);
  }

  if (node.scroll?.clipContent) {
    if (!node.scroll.overflowBehavior || node.scroll.overflowBehavior === "none") {
      parts.push(`overflow: "hidden"`);
    }
  }

  return `{ ${parts.join(", ")} }`;
}

function generateRNTextStyle(text: TextStyle): string {
  const parts: string[] = [];

  if (text.color) parts.push(`color: "${text.color}"`);
  if (text.fontSize) parts.push(`fontSize: ${text.fontSize}`);
  if (text.fontWeight) parts.push(`fontWeight: "${text.fontWeight}"`);
  if (text.fontFamily) {
    // Strip any stale quotes to avoid double-quoting
    const clean = text.fontFamily.replace(/["']/g, "").trim();
    parts.push(`fontFamily: "${clean}"`);
  }
  if (text.textAlign)
    parts.push(`textAlign: "${text.textAlign.toLowerCase()}"`);

  return `{ ${parts.join(", ")} }`;
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
// ═══════════════════════════════════════════════════════════════
// Server-Driven UI — Runtime files for OTA design updates
//
// These 4 files ship inside the generated Expo project ZIP.
// They allow a production app (Play Store / App Store) to
// receive design updates from the Mint server without
// requiring a new app-store release.
//
//   1. mint.config.ts          — API URL, projectId, poll interval
//   2. services/MintConnector  — HTTP polling service
//   3. providers/MintLiveProvider — React Context + AsyncStorage cache
//   4. components/MintRenderer — Renders DrawableNode[] at runtime
// ═══════════════════════════════════════════════════════════════

function generateSDUIFiles(
  options: ConversionOptions,
  routes: FrameRoute[]
): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const projectId = options.projectId || options.fileKey || "unknown";
  const userId = options.userId || "unknown";
  // In production the app should point at the deployed Mint server.
  // Users must replace this URL before publishing to the Play Store.
  const apiOrigin = "https://YOUR_PRODUCTION_MINT_URL.com";

  // ── 1. mint.config.ts ───────────────────────────────────────
  files.push({
    path: "mint.config.ts",
    content: `// ═══════════════════════════════════════════════════════════════
// Mint Live Config — Connection settings for OTA design updates
//
// In PRODUCTION, replace apiOrigin with your deployed Mint URL.
// The app polls this server for design data updates.
// ═══════════════════════════════════════════════════════════════
import Constants from "expo-constants";

// Dynamically use the host machine's IP (from Expo metro server) during dev
// so Android emulators don't fail trying to connect to their own localhost.
const devHost = Constants.expoConfig?.hostUri
  ? Constants.expoConfig.hostUri.split(":")[0]
  : "localhost";

export const MINT_CONFIG = {
  /** Base URL of the Mint editor server */
  apiOrigin: __DEV__ ? \`http://\${devHost}:3001\` : "${apiOrigin}",

  /** Project identifier (set at conversion time) */
  projectId: "${projectId}",

  /** User identifier (set at conversion time) */
  userId: "${userId}",

  /** Polling interval in milliseconds (default 3 seconds) */
  pollInterval: 3000,

  /** Enable live updates (set false to disable OTA entirely) */
  enabled: true,
};
`,
    type: "text",
  });

  // ── 2. services/MintConnector.ts ────────────────────────────
  files.push({
    path: "services/MintConnector.ts",
    content: `// ═══════════════════════════════════════════════════════════════
// Mint Connector — Polls /api/design-data for OTA design updates
//
// Usage:
//   const connector = new MintConnector(config);
//   connector.onUpdate((data) => { ... });
//   connector.start();
//   connector.stop();
// ═══════════════════════════════════════════════════════════════

export interface DesignDataResponse {
  projectId: string;
  version: number;
  framework: string;
  designData: {
    nodes: any[];
    interactions: any[];
    referenceFrame?: {
      id: string;
      x: number;
      y: number;
      width: number;
      height: number;
    };
  } | null;
  committedAt?: string;
}

export interface MintConnectorConfig {
  apiOrigin: string;
  projectId: string;
  pollInterval: number;
}

type UpdateCallback = (data: DesignDataResponse) => void;

export class MintConnector {
  private config: MintConnectorConfig;
  private lastVersion = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners: UpdateCallback[] = [];
  private isPolling = false;

  constructor(config: MintConnectorConfig) {
    this.config = config;
  }

  /** Set the last-known version (e.g. from cache) to avoid re-fetching. */
  setLastVersion(version: number) {
    this.lastVersion = version;
  }

  /** Register a callback for design data updates. */
  onUpdate(cb: UpdateCallback) {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  /** Start polling. */
  start() {
    if (this.timer) return;
    // Fetch immediately on start
    this.poll();
    this.timer = setInterval(() => this.poll(), this.config.pollInterval);
  }

  /** Stop polling. */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Fetch the latest design data once (used internally + for manual refresh). */
  async fetchLatest(): Promise<DesignDataResponse | null> {
    try {
      const url = \`\${this.config.apiOrigin}/api/design-data/\${this.config.projectId}\`;
      const res = await fetch(url);
      if (!res.ok) return null;
      return (await res.json()) as DesignDataResponse;
    } catch {
      return null;
    }
  }

  private async poll() {
    if (this.isPolling) return;
    this.isPolling = true;
    try {
      const url = \`\${this.config.apiOrigin}/api/design-data/\${this.config.projectId}?since=\${this.lastVersion}\`;
      const res = await fetch(url);
      if (res.status === 204) {
        // No new version
        return;
      }
      if (!res.ok) return;

      const data = (await res.json()) as DesignDataResponse;
      if (data.version && data.version > this.lastVersion && data.designData) {
        this.lastVersion = data.version;
        for (const cb of this.listeners) {
          cb(data);
        }
      }
    } catch {
      // Silently retry on next interval
    } finally {
      this.isPolling = false;
    }
  }
}
`,
    type: "text",
  });

  // Build route lookup: frameId → routePath for the MintLiveProvider
  const routeEntries = routes.map((r) => {
    return `  "${r.frame.id}": "${r.isHome ? "/" : `/${r.slug}`}"`;
  }).join(",\n");

  // ── 3. providers/MintLiveProvider.tsx ────────────────────────
  files.push({
    path: "providers/MintLiveProvider.tsx",
    content: `// ═══════════════════════════════════════════════════════════════
// Mint Live Provider — Manages OTA design data state
//
// Wraps the app in a React Context that:
//   1. Starts the MintConnector on mount
//   2. Caches design data in AsyncStorage for offline use
//   3. Provides \`useMintDesign(routeId)\` hook for screens
// ═══════════════════════════════════════════════════════════════

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MINT_CONFIG } from "../mint.config";
import { MintConnector, DesignDataResponse } from "../services/MintConnector";

const CACHE_KEY = "@mint_design_data";

// ── Route map: frameId → route path ───────────────────────────
const ROUTE_MAP: Record<string, string> = {
${routeEntries}
};

// ── Context ───────────────────────────────────────────────────
interface MintLiveContextValue {
  /** The latest design data (null if not yet loaded or disabled). */
  designData: DesignDataResponse["designData"];
  /** Current version number. */
  version: number;
  /** Whether live data is available and loaded. */
  isLive: boolean;
  /** Whether a fetch is in progress. */
  isLoading: boolean;
  /** Get the design nodes for a specific screen by route path or frame ID. */
  getScreenNodes: (screenIdOrRoute: string) => any | null;
  /** Force a refresh from the server. */
  refresh: () => Promise<void>;
}

const MintLiveContext = createContext<MintLiveContextValue>({
  designData: null,
  version: 0,
  isLive: false,
  isLoading: false,
  getScreenNodes: () => null,
  refresh: async () => {},
});

export function useMintDesign(screenIdOrRoute?: string) {
  const ctx = useContext(MintLiveContext);
  if (!screenIdOrRoute) return ctx;

  return {
    ...ctx,
    screenData: ctx.getScreenNodes(screenIdOrRoute),
  };
}

// ── Provider ──────────────────────────────────────────────────
export function MintLiveProvider({ children }: { children: ReactNode }) {
  const [designData, setDesignData] = useState<DesignDataResponse["designData"]>(null);
  const [version, setVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [connector] = useState(() =>
    new MintConnector({
      apiOrigin: MINT_CONFIG.apiOrigin,
      projectId: MINT_CONFIG.projectId,
      pollInterval: MINT_CONFIG.pollInterval,
    })
  );

  // Load cached data on mount
  useEffect(() => {
    if (!MINT_CONFIG.enabled) return;

    (async () => {
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as DesignDataResponse;
          if (parsed.designData) {
            setDesignData(parsed.designData);
            setVersion(parsed.version);
            connector.setLastVersion(parsed.version);
          }
        }
      } catch {
        // Ignore cache read errors
      }

      // Start polling
      connector.start();
    })();

    return () => connector.stop();
  }, [connector]);

  // Listen for updates
  useEffect(() => {
    if (!MINT_CONFIG.enabled) return;

    const unsub = connector.onUpdate((data) => {
      if (data.designData) {
        setDesignData(data.designData);
        setVersion(data.version);
        // Cache to AsyncStorage
        AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data)).catch(() => {});
      }
    });

    return unsub;
  }, [connector]);

  // Get screen nodes by route path or frame ID
  const getScreenNodes = useCallback(
    (screenIdOrRoute: string) => {
      if (!designData?.nodes) return null;

      // Try matching by frame ID directly
      const byId = designData.nodes.find((n: any) => n.id === screenIdOrRoute);
      if (byId) return byId;

      // Try matching by route path → frame ID
      for (const [frameId, routePath] of Object.entries(ROUTE_MAP)) {
        if (routePath === screenIdOrRoute || routePath === \`/\${screenIdOrRoute}\`) {
          const node = designData.nodes.find((n: any) => n.id === frameId);
          if (node) return node;
        }
      }

      // Try matching by name
      return designData.nodes.find(
        (n: any) => n.name?.toLowerCase().replace(/\\s+/g, "-") === screenIdOrRoute
      ) || null;
    },
    [designData]
  );

  // Manual refresh
  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await connector.fetchLatest();
      if (data?.designData) {
        setDesignData(data.designData);
        setVersion(data.version);
        connector.setLastVersion(data.version);
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
      }
    } finally {
      setIsLoading(false);
    }
  }, [connector]);

  const value: MintLiveContextValue = {
    designData,
    version,
    isLive: !!designData,
    isLoading,
    getScreenNodes,
    refresh,
  };

  return (
    <MintLiveContext.Provider value={value}>
      {children}
    </MintLiveContext.Provider>
  );
}
`,
    type: "text",
  });

  // ── 4. components/MintRenderer.tsx ──────────────────────────
  files.push({
    path: "components/MintRenderer.tsx",
    content: `// ═══════════════════════════════════════════════════════════════
// Mint Renderer — Dynamic runtime renderer for design nodes
//
// Takes a design node tree (JSON from /api/design-data) and
// renders it using React Native primitives. This is the runtime
// equivalent of the static code generated by the builder.
//
// Usage:
//   import { MintRenderer } from "../components/MintRenderer";
//   <MintRenderer node={screenNode} />
// ═══════════════════════════════════════════════════════════════

import React from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  Dimensions,
  Linking,
  ViewStyle,
  TextStyle,
  ImageStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ── Types ─────────────────────────────────────────────────────

interface DesignNode {
  id: string;
  name?: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  visible?: boolean;
  rotation?: number;
  opacity?: number;
  fills?: Array<{
    type: string;
    color?: string;
    opacity?: number;
    imageRef?: string;
  }>;
  strokes?: Array<{
    color?: string;
    opacity?: number;
    weight?: number;
    align?: string;
  }>;
  corners?: {
    uniform?: number;
    topLeft?: number;
    topRight?: number;
    bottomRight?: number;
    bottomLeft?: number;
  };
  effects?: Array<{
    type: string;
    color?: string;
    offsetX?: number;
    offsetY?: number;
    blur?: number;
    spread?: number;
  }>;
  text?: {
    characters?: string;
    fontFamily?: string;
    fontWeight?: number | string;
    fontSize?: number;
    lineHeight?: number | string;
    letterSpacing?: number;
    textAlign?: string;
    color?: string;
  };
  layout?: {
    mode?: string;
    gap?: number;
    paddingTop?: number;
    paddingRight?: number;
    paddingBottom?: number;
    paddingLeft?: number;
  };
  clipContent?: boolean;
  overflowBehavior?: string;
  fixedWhenScrolling?: boolean;
  children?: DesignNode[];
}

interface Interaction {
  sourceId: string;
  trigger: string;
  action: string;
  targetId?: string;
  destinationUrl?: string;
}

// ── Route map (for navigation) ────────────────────────────────
const ROUTE_MAP: Record<string, string> = {
${routeEntries}
};

// ── Main Renderer ─────────────────────────────────────────────

interface MintRendererProps {
  /** A single screen node (top-level frame). */
  node: DesignNode;
  /** Interactions array for the entire project. */
  interactions?: Interaction[];
}

export function MintRenderer({ node, interactions = [] }: MintRendererProps) {
  const refW = node.width;
  const refH = node.height;
  const scale = Math.min(SCREEN_WIDTH / refW, SCREEN_HEIGHT / refH, 1);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#1a1a1a" }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <View
          style={{
            width: refW,
            height: refH,
            position: "relative",
            transform: [{ scale }],
          }}
        >
          {node.children?.map((child) => (
            <NodeRenderer key={child.id} node={child} interactions={interactions} />
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

// ── Recursive Node Renderer ───────────────────────────────────

function NodeRenderer({ node, interactions }: { node: DesignNode; interactions: Interaction[] }) {
  const router = useRouter();

  if (node.visible === false) return null;

  const isText = node.type === "TEXT";
  const isImage = node.type === "IMAGE" || node.fills?.some((f) => f.type === "IMAGE");

  // Build the style object
  const style = buildNodeStyle(node);

  // Check for interactions on this node
  const nodeInteraction = interactions.find((ix) => ix.sourceId === node.id);
  const isClickable = !!nodeInteraction;

  // When clickable, split styles: position/size on Pressable, visuals on inner View
  const pressableStyle: ViewStyle | undefined = isClickable ? {
    position: "absolute" as const,
    left: Math.round(node.x),
    top: Math.round(node.y),
    width: Math.round(node.width),
    height: Math.round(node.height),
  } : undefined;

  // Inner style fills the Pressable and carries visual properties only
  const innerStyle: ViewStyle | undefined = isClickable ? (() => {
    const { position, left, top, width, height, ...visual } = style;
    return { width: "100%" as unknown as number, height: "100%" as unknown as number, ...visual };
  })() : undefined;

  // Determine scroll behavior
  const isScrollContainer =
    node.overflowBehavior && node.overflowBehavior !== "none";
  const scrollH = node.overflowBehavior === "horizontal" || node.overflowBehavior === "both";

  // Pick the right container style
  const containerStyle = isClickable ? innerStyle! : style;

  // Build content
  let content: React.ReactNode;

  if (isText && node.text) {
    const textStyle = buildTextStyle(node.text);
    content = (
      <View style={containerStyle}>
        <Text style={textStyle}>{node.text.characters || ""}</Text>
      </View>
    );
  } else if (isImage) {
    const imageRef = node.fills?.find((f) => f.type === "IMAGE")?.imageRef;
    content = (
      <View style={containerStyle}>
        {imageRef && (
          <Image
            source={{ uri: imageRef }}
            style={{
              width: "100%" as unknown as number,
              height: "100%" as unknown as number,
              borderRadius: node.corners?.uniform || 0,
            }}
            resizeMode="cover"
          />
        )}
      </View>
    );
  } else if (isScrollContainer && node.children?.length) {
    content = (
      <View style={containerStyle}>
        <ScrollView
          horizontal={scrollH}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
        >
          {node.children.map((child) => (
            <NodeRenderer key={child.id} node={child} interactions={interactions} />
          ))}
        </ScrollView>
      </View>
    );
  } else if (node.children?.length) {
    content = (
      <View style={containerStyle}>
        {node.children.map((child) => (
          <NodeRenderer key={child.id} node={child} interactions={interactions} />
        ))}
      </View>
    );
  } else {
    content = <View style={containerStyle} />;
  }

  // Wrap with Pressable if the node has an interaction
  // Position/size styles on Pressable give it a proper hit area
  if (isClickable && nodeInteraction && pressableStyle) {
    return (
      <Pressable style={pressableStyle} onPress={() => handleInteraction(nodeInteraction, router)}>
        {content}
      </Pressable>
    );
  }

  return <>{content}</>;
}

// ── Interaction Handler ───────────────────────────────────────

function handleInteraction(ix: Interaction, router: any) {
  switch (ix.action) {
    case "NAVIGATE":
      if (ix.targetId) {
        const route = ROUTE_MAP[ix.targetId];
        if (route) {
          router.push(route);
        }
      }
      break;
    case "BACK":
      router.back();
      break;
    case "OPEN_URL":
      if (ix.destinationUrl) {
        Linking.openURL(ix.destinationUrl);
      }
      break;
    // OPEN_OVERLAY, CLOSE_OVERLAY, SWAP_OVERLAY are handled by
    // the OverlayProvider if present. The renderer focuses on
    // navigation interactions for production use.
    default:
      break;
  }
}

// ── Style Builders ────────────────────────────────────────────

function buildNodeStyle(node: DesignNode): ViewStyle {
  const isText = node.type === "TEXT";

  const style: ViewStyle = {
    position: "absolute",
    left: Math.round(node.x),
    top: Math.round(node.y),
    width: Math.round(node.width),
    height: Math.round(node.height),
  };

  // Background color (only for non-text nodes)
  if (!isText && node.fills?.length) {
    const solidFill = node.fills.find((f) => f.type === "SOLID" && f.color);
    if (solidFill) {
      style.backgroundColor = solidFill.color;
    }
  }

  // Corner radius
  if (node.corners) {
    if (node.corners.uniform) {
      style.borderRadius = node.corners.uniform;
    } else {
      if (node.corners.topLeft) style.borderTopLeftRadius = node.corners.topLeft;
      if (node.corners.topRight) style.borderTopRightRadius = node.corners.topRight;
      if (node.corners.bottomRight) style.borderBottomRightRadius = node.corners.bottomRight;
      if (node.corners.bottomLeft) style.borderBottomLeftRadius = node.corners.bottomLeft;
    }
  }

  // Opacity
  if (node.opacity !== undefined && node.opacity < 1) {
    style.opacity = node.opacity;
  }

  // Stroke → border
  if (node.strokes?.length) {
    const stroke = node.strokes[0];
    if (stroke.color && stroke.weight) {
      style.borderWidth = stroke.weight;
      style.borderColor = stroke.color;
    }
  }

  // Layout (auto-layout → flexbox)
  if (node.layout && node.layout.mode && node.layout.mode !== "NONE") {
    style.flexDirection = node.layout.mode === "VERTICAL" ? "column" : "row";
    if (node.layout.gap) {
      style.gap = node.layout.gap;
    }
    if (node.layout.paddingTop) style.paddingTop = node.layout.paddingTop;
    if (node.layout.paddingRight) style.paddingRight = node.layout.paddingRight;
    if (node.layout.paddingBottom) style.paddingBottom = node.layout.paddingBottom;
    if (node.layout.paddingLeft) style.paddingLeft = node.layout.paddingLeft;
  }

  // Clip content
  if (node.clipContent && !node.overflowBehavior) {
    style.overflow = "hidden";
  }

  // Drop shadow
  if (node.effects?.length) {
    const shadow = node.effects.find(
      (e) => e.type === "DROP_SHADOW"
    );
    if (shadow) {
      style.shadowColor = shadow.color || "#000";
      style.shadowOffset = {
        width: shadow.offsetX || 0,
        height: shadow.offsetY || 0,
      };
      style.shadowOpacity = 1;
      style.shadowRadius = (shadow.blur || 0) / 2;
      style.elevation = Math.max(shadow.blur || 0, 1); // Android
    }
  }

  return style;
}

function buildTextStyle(text: NonNullable<DesignNode["text"]>): TextStyle {
  const style: TextStyle = {};

  if (text.color) style.color = text.color;
  if (text.fontSize) style.fontSize = text.fontSize;
  if (text.fontWeight) style.fontWeight = String(text.fontWeight) as TextStyle["fontWeight"];
  if (text.fontFamily) {
    style.fontFamily = text.fontFamily.replace(/["']/g, "").trim();
  }
  if (text.textAlign) {
    style.textAlign = text.textAlign.toLowerCase() as TextStyle["textAlign"];
  }
  if (text.lineHeight && text.lineHeight !== "AUTO" && text.fontSize) {
    style.lineHeight = typeof text.lineHeight === "number" ? text.lineHeight : undefined;
  }
  if (text.letterSpacing) {
    style.letterSpacing = text.letterSpacing;
  }

  return style;
}
`,
    type: "text",
  });

  return files;
}

export default reactNativeBuilder;

// ═══════════════════════════════════════════════════════════════
// PNG builder — generates a solid-color PNG using Node.js zlib
// expo-splash-screen requires a real image (≥ a few px) to generate
// the splashscreen_logo Android drawable during `expo prebuild`.
// ═══════════════════════════════════════════════════════════════

function buildSolidPng(
  width: number,
  height: number,
  r: number,
  g: number,
  b: number
): Uint8Array {
  // ── CRC32 ─────────────────────────────────────────────────────
  const crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[i] = c >>> 0;
  }
  function crc32(data: Buffer): number {
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++)
      crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  // ── Chunk builder ─────────────────────────────────────────────
  function makeChunk(type: string, data: Buffer): Buffer {
    const typeBuf = Buffer.from(type, "ascii");
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length, 0);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
  }

  // ── IHDR ──────────────────────────────────────────────────────
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB (no alpha)
  // bytes 10-12: compression=0, filter=0, interlace=0 (already 0)

  // ── Raw pixel data (filter type 0 = None per row) ─────────────
  const rowSize = 1 + width * 3;
  const raw = Buffer.alloc(height * rowSize);
  for (let y = 0; y < height; y++) {
    raw[y * rowSize] = 0; // filter byte
    for (let x = 0; x < width; x++) {
      raw[y * rowSize + 1 + x * 3] = r;
      raw[y * rowSize + 2 + x * 3] = g;
      raw[y * rowSize + 3 + x * 3] = b;
    }
  }
  const compressed = deflateSync(raw);

  // ── Assemble PNG ──────────────────────────────────────────────
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const png = Buffer.concat([
    sig,
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", compressed),
    makeChunk("IEND", Buffer.alloc(0)),
  ]);

  return new Uint8Array(png.buffer, png.byteOffset, png.byteLength);
}
