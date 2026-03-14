// ═══════════════════════════════════════════════════════════════
// Flutter Builder — v4.0.0
// Generates a complete Flutter app with named routes
// Each top-level frame = a screen with Navigator.pushNamed
// Overlay system via showDialog / showGeneralDialog
// Transition animations via PageRouteBuilder
// ═══════════════════════════════════════════════════════════════

import type {
  DrawableNode,
  ImageManifest,
  ConversionOptions,
  GeneratedFile,
  Interaction,
  FrameworkBuilder,
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
  flutterTransitionRoute,
  buildTransitionMap,
} from "../core/transitions";

export const flutterBuilder: FrameworkBuilder = {
  name: "flutter",
  displayName: "Flutter",
  version: "4.0.0",

  async build(
    nodes: DrawableNode[],
    options: ConversionOptions,
    manifest: ImageManifest,
    interactions: Interaction[]
  ): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    const projectName = (options.fileName || "design_export")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_");

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

    // pubspec.yaml
    files.push({
      path: "pubspec.yaml",
      content: `name: ${projectName}
description: "Generated from design file"
version: 1.0.0+1
publish_to: 'none'

environment:
  sdk: '>=3.2.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter
  cupertino_icons: ^1.0.6

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.0

flutter:
  uses-material-design: true

  assets:
    - assets/
`,
      type: "text",
    });

    // analysis_options.yaml
    files.push({
      path: "analysis_options.yaml",
      content: `include: package:flutter_lints/flutter.yaml

linter:
  rules:
    prefer_const_constructors: false
    prefer_const_literals_to_create_immutables: false
`,
      type: "text",
    });

    // ── lib/main.dart — named routes with transitions ──────
    const routeEntries = routes
      .map((r) => {
        const dartFileName = toSnakeCase(r.componentName);
        return `      '${r.routePath}': (context) => const ${r.componentName}Screen()`;
      })
      .join(",\n");

    // Generate onGenerateRoute with PageRouteBuilder for transitions
    const transitionCases = routes
      .filter((r) => transitionMap.has(r.frame.id))
      .map((r) => {
        const anim = transitionMap.get(r.frame.id)!;
        const routeBuilder = flutterTransitionRoute(r.routePath, `const ${r.componentName}Screen()`, anim);
        return `      case '${r.routePath}':\n        return ${routeBuilder};`;
      })
      .join("\n");

    const screenImports = routes
      .map((r) => {
        const dartFileName = toSnakeCase(r.componentName);
        return `import 'screens/${dartFileName}_screen.dart';`;
      })
      .join("\n");

    const overlayImport = hasOverlays
      ? `import 'overlays/overlay_manager.dart';\n`
      : "";

    const useOnGenerateRoute = transitionCases.length > 0;

    files.push({
      path: "lib/main.dart",
      content: `import 'package:flutter/material.dart';
${screenImports}
${overlayImport}
void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '${options.fileName || "Design Export"}',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.blue,
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
      ),
      initialRoute: '/',
${useOnGenerateRoute ? `      onGenerateRoute: (settings) {
        switch (settings.name) {
${transitionCases}
          default:
            break;
        }
        // Fallback to static routes
        final routes = <String, WidgetBuilder>{
${routeEntries},
        };
        final builder = routes[settings.name];
        if (builder != null) {
          return MaterialPageRoute(builder: builder, settings: settings);
        }
        return null;
      },` : `      routes: {
${routeEntries},
      },`}
      debugShowCheckedModeBanner: false,
    );
  }
}
`,
      type: "text",
    });

    // ── lib/screens/<name>_screen.dart — one per frame ────────
    for (const route of routes) {
      const dartFileName = toSnakeCase(route.componentName);
      files.push({
        path: `lib/screens/${dartFileName}_screen.dart`,
        content: generateFlutterScreenWidget(route, routedInteractions, manifest, hasOverlays, overlayFrames),
        type: "text",
      });
    }

    // ── lib/overlays/overlay_manager.dart ─────────────────────
    if (hasOverlays) {
      files.push({
        path: "lib/overlays/overlay_manager.dart",
        content: generateFlutterOverlayManager(overlayFrames, routedInteractions, manifest),
        type: "text",
      });
    }

    // lib/widgets/design_node.dart (reusable widget)
    files.push({
      path: "lib/widgets/design_node.dart",
      content: `import 'package:flutter/material.dart';

class DesignNode extends StatelessWidget {
  final double x;
  final double y;
  final double width;
  final double height;
  final Color? backgroundColor;
  final double borderRadius;
  final double opacity;
  final String? imageUrl;
  final String? text;
  final TextStyle? textStyle;
  final List<Widget>? children;
  final VoidCallback? onTap;
  final Clip clipBehavior;

  const DesignNode({
    super.key,
    required this.x,
    required this.y,
    required this.width,
    required this.height,
    this.backgroundColor,
    this.borderRadius = 0,
    this.opacity = 1.0,
    this.imageUrl,
    this.text,
    this.textStyle,
    this.children,
    this.onTap,
    this.clipBehavior = Clip.none,
  });

  @override
  Widget build(BuildContext context) {
    Widget child;

    if (text != null) {
      child = Text(
        text!,
        style: textStyle ?? const TextStyle(color: Colors.white),
      );
    } else if (imageUrl != null) {
      child = ClipRRect(
        borderRadius: BorderRadius.circular(borderRadius),
        child: imageUrl!.startsWith('http')
            ? Image.network(
                imageUrl!,
                fit: BoxFit.cover,
                width: width,
                height: height,
                errorBuilder: (_, __, ___) => _buildPlaceholder(),
              )
            : imageUrl!.startsWith('data:')
                ? Image.memory(
                    Uri.parse(imageUrl!).data!.contentAsBytes(),
                    fit: BoxFit.cover,
                    width: width,
                    height: height,
                  )
                : Image.asset(
                    imageUrl!,
                    fit: BoxFit.cover,
                    width: width,
                    height: height,
                    errorBuilder: (_, __, ___) => _buildPlaceholder(),
                  ),
      );
    } else if (children != null && children!.isNotEmpty) {
      child = Stack(children: children!);
    } else {
      child = const SizedBox.shrink();
    }

    Widget result = Positioned(
      left: x,
      top: y,
      width: width,
      height: height,
      child: Opacity(
        opacity: opacity,
        child: Container(
          clipBehavior: clipBehavior,
          decoration: BoxDecoration(
            color: backgroundColor,
            borderRadius: BorderRadius.circular(borderRadius),
          ),
          child: child,
        ),
      ),
    );

    if (onTap != null) {
      return Positioned(
        left: x,
        top: y,
        width: width,
        height: height,
        child: Opacity(
          opacity: opacity,
          child: GestureDetector(
            onTap: onTap,
            child: Container(
              clipBehavior: clipBehavior,
              decoration: BoxDecoration(
                color: backgroundColor,
                borderRadius: BorderRadius.circular(borderRadius),
              ),
              child: child,
            ),
          ),
        ),
      );
    }

    return result;
  }

  Widget _buildPlaceholder() {
    return Container(
      width: width,
      height: height,
      color: Colors.grey[800],
      child: const Center(
        child: Icon(Icons.image, color: Colors.grey),
      ),
    );
  }
}
`,
      type: "text",
    });

    // lib/utils/colors.dart (design tokens)
    files.push({
      path: "lib/utils/colors.dart",
      content: generateFlutterColors(nodes),
      type: "text",
    });

    // README.md
    files.push({
      path: "README.md",
      content: `# ${options.fileName || "Design Export"} — Flutter

Generated from a design file.

## Getting Started

\`\`\`bash
flutter pub get
flutter run
\`\`\`

## Screens

${routes.map((r, i) => `${i + 1}. **${r.frame.name}** → \`${r.routePath}\` (${Math.round(r.frame.w)}×${Math.round(r.frame.h)})`).join("\n")}

${hasNavigateInteractions ? `## Navigation

Interactions wired as Flutter named route transitions:

${interactions
  .filter((i) => i.action === "NAVIGATE" && i.targetId)
  .map((i) => {
    const sourceName = nodes.find((n) => n.id === i.sourceId)?.name || i.sourceId;
    const targetRoute = routeMap.get(i.targetId || "") || i.targetId;
    return `- **${sourceName}** → \`${targetRoute}\` (${i.trigger})`;
  }).join("\n")}` : ""}

## Building

\`\`\`bash
# Android
flutter build apk

# iOS
flutter build ios

# Web
flutter build web
\`\`\`
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

    // Create assets directory
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
// Flutter Screen Widget Generator — one per frame
// ═══════════════════════════════════════════════════════════════

function generateFlutterScreenWidget(
  route: FrameRoute,
  routedInteractions: Interaction[],
  manifest: ImageManifest,
  hasOverlays: boolean,
  overlayFrames: OverlayFrame[]
): string {
  const { frame } = route;
  const refW = Math.round(frame.w);
  const refH = Math.round(frame.h);

  // Filter interactions relevant to this frame's children
  const frameChildIds = collectAllIds(frame);
  const pageInteractions = routedInteractions.filter(
    (ix) => frameChildIds.has(ix.sourceId)
  );
  const pageHasOverlay = pageInteractions.some(
    (ix) =>
      ix.action === "OPEN_OVERLAY" ||
      ix.action === "CLOSE_OVERLAY" ||
      ix.action === "SWAP_OVERLAY"
  );

  // Build the Flutter widget tree for this frame's children
  const flutterTree = frame.children?.length
    ? frame.children
        .map((child) =>
          renderFlutterWidget(child, manifest, pageInteractions, 10, hasOverlays)
        )
        .join("\n")
    : "";

  const overlayImport = pageHasOverlay && hasOverlays
    ? `import '../overlays/overlay_manager.dart';\n`
    : "";

  return `import 'package:flutter/material.dart';
import '../widgets/design_node.dart';
${overlayImport}
class ${route.componentName}Screen extends StatelessWidget {
  const ${route.componentName}Screen({super.key});

  static const double designWidth = ${refW};
  static const double designHeight = ${refH};

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF1A1A1A),
      body: SafeArea(
        child: Center(
          child: LayoutBuilder(
            builder: (context, constraints) {
              final scaleX = constraints.maxWidth / designWidth;
              final scaleY = constraints.maxHeight / designHeight;
              final scale = scaleX < scaleY ? scaleX : scaleY;
              final clampedScale = scale > 1 ? 1.0 : scale;

              return SingleChildScrollView(
                child: Transform.scale(
                  scale: clampedScale,
                  alignment: Alignment.topCenter,
                  child: SizedBox(
                    width: designWidth,
                    height: designHeight,
                    child: Stack(
                      children: [
${flutterTree}
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}
`;
}

// ═══════════════════════════════════════════════════════════════
// Flutter Widget Tree Generation
// ═══════════════════════════════════════════════════════════════

function renderFlutterWidget(
  node: DrawableNode,
  manifest: ImageManifest,
  interactions: Interaction[],
  indent: number,
  hasOverlays = false
): string {
  const spaces = " ".repeat(indent);
  const hasChildren = node.children && node.children.length > 0;

  // Check for interactions
  const navIx = interactions.find(
    (i) =>
      i.sourceId === node.id && i.action === "NAVIGATE" && i.targetId
  );
  const openOverlayIx = interactions.find(
    (i) =>
      i.sourceId === node.id && i.action === "OPEN_OVERLAY" && i.targetId
  );
  const closeOverlayIx = interactions.find(
    (i) =>
      i.sourceId === node.id && i.action === "CLOSE_OVERLAY"
  );
  const swapOverlayIx = interactions.find(
    (i) =>
      i.sourceId === node.id && i.action === "SWAP_OVERLAY" && i.targetId
  );
  const backIx = interactions.find(
    (i) =>
      i.sourceId === node.id && i.action === "BACK"
  );
  const urlIx = interactions.find(
    (i) =>
      i.sourceId === node.id && i.action === "OPEN_URL" && i.destinationUrl
  );

  // Build widget properties
  const props: string[] = [];
  props.push(`x: ${Math.round(node.x)}`);
  props.push(`y: ${Math.round(node.y)}`);
  props.push(`width: ${Math.round(node.w)}`);
  props.push(`height: ${Math.round(node.h)}`);

  // Background color
  if (node.fill?.type === "SOLID" && node.fill.color) {
    props.push(`backgroundColor: ${colorToFlutter(node.fill.color)}`);
  }

  // Border radius
  if (node.corners?.uniform) {
    props.push(`borderRadius: ${node.corners.uniform}`);
  }

  // Opacity
  if (node.opacity !== undefined && node.opacity < 1) {
    props.push(`opacity: ${node.opacity}`);
  }

  // Clip content (Figma "Clip Content" → Flutter Clip.hardEdge)
  if (node.scroll?.clipContent) {
    props.push(`clipBehavior: Clip.hardEdge`);
  }

  // Navigation onTap
  if (navIx) {
    props.push(
      `onTap: () => Navigator.pushNamed(context, '${navIx.targetId}')`
    );
  } else if (openOverlayIx && hasOverlays) {
    props.push(
      `onTap: () => OverlayManager.show(context, '${openOverlayIx.targetId}')`
    );
  } else if (closeOverlayIx) {
    props.push(
      `onTap: () => Navigator.pop(context)`
    );
  } else if (swapOverlayIx && hasOverlays) {
    props.push(
      `onTap: () { Navigator.pop(context); OverlayManager.show(context, '${swapOverlayIx.targetId}'); }`
    );
  } else if (backIx) {
    props.push(
      `onTap: () => Navigator.maybePop(context)`
    );
  } else if (urlIx) {
    props.push(
      `onTap: () => launchUrlString('${urlIx.destinationUrl}')`
    );
  }

  // Text node
  if (node.type === "TEXT" && node.text?.characters) {
    const text = node.text.characters
      .replace(/'/g, "\\'")
      .replace(/\n/g, "\\n");
    props.push(`text: '${text}'`);

    // Text style
    const styleProps: string[] = [];
    if (node.text.color)
      styleProps.push(`color: ${colorToFlutter(node.text.color)}`);
    if (node.text.fontSize)
      styleProps.push(`fontSize: ${node.text.fontSize}`);
    if (node.text.fontWeight)
      styleProps.push(
        `fontWeight: ${fontWeightToFlutter(node.text.fontWeight)}`
      );

    if (styleProps.length > 0) {
      props.push(
        `textStyle: const TextStyle(${styleProps.join(", ")})`
      );
    }

    return `${spaces}DesignNode(
${props.map((p) => `${spaces}  ${p},`).join("\n")}
${spaces}),`;
  }

  // Image node
  if (node.type === "IMAGE" || node.fill?.type === "IMAGE") {
    let src = node.fill?.imageRef ?? "";
    if (manifest.images.has(src)) {
      src = manifest.images.get(src)!;
    }

    if (src) {
      if (src.startsWith("/assets/")) {
        src = `assets${src.replace("/assets", "")}`;
      }
      props.push(`imageUrl: '${src}'`);
    }

    return `${spaces}DesignNode(
${props.map((p) => `${spaces}  ${p},`).join("\n")}
${spaces}),`;
  }

  // Container with children
  if (hasChildren) {
    const isScrollContainer =
      node.ux?.scrollX || node.ux?.scrollY ||
      (node.scroll?.overflowBehavior && node.scroll.overflowBehavior !== "none");

    const scrollHorizontal = node.ux?.scrollX ||
      node.scroll?.overflowBehavior === "horizontal" ||
      node.scroll?.overflowBehavior === "both";

    const scrollVertical = node.ux?.scrollY ||
      node.scroll?.overflowBehavior === "vertical" ||
      node.scroll?.overflowBehavior === "both";

    // Separate fixed children from scrollable children
    const fixedChildren = isScrollContainer
      ? node.children!.filter((c) => c.scroll?.fixedWhenScrolling)
      : [];
    const scrollableChildren = fixedChildren.length > 0
      ? node.children!.filter((c) => !c.scroll?.fixedWhenScrolling)
      : node.children!;

    const childWidgets = scrollableChildren
      .map((child) =>
        renderFlutterWidget(child, manifest, interactions, indent + 4, hasOverlays)
      )
      .join("\n");

    const fixedWidgets = fixedChildren
      .map((child) =>
        renderFlutterWidget(child, manifest, interactions, indent + 4, hasOverlays)
      )
      .join("\n");

    if (isScrollContainer) {
      // Compute the actual content dimensions from children
      const contentW = Math.ceil(Math.max(...scrollableChildren.map((c) => c.x + c.w)));
      const contentH = Math.ceil(Math.max(...scrollableChildren.map((c) => c.y + c.h)));

      const sizedW = scrollHorizontal ? contentW : Math.round(node.w);
      const sizedH = scrollVertical ? contentH : Math.round(node.h);

      // Wrap children in SingleChildScrollView
      const scrollDir = scrollHorizontal
        ? "scrollDirection: Axis.horizontal,"
        : "scrollDirection: Axis.vertical,";
      const scrollPhysics = node.ux?.snap && scrollHorizontal
        ? "const PageScrollPhysics()"
        : "const BouncingScrollPhysics()";

      // Use Stack: ScrollView is bottom, fixed children overlay on top
      const scrollChild = `${spaces}    SingleChildScrollView(
${spaces}      ${scrollDir}
    ${spaces}      physics: ${scrollPhysics},
${spaces}      child: SizedBox(
${spaces}        width: ${sizedW},
${spaces}        height: ${sizedH},
${spaces}        child: Stack(
${spaces}          clipBehavior: Clip.none,
${spaces}          children: [
${childWidgets}
${spaces}          ],
${spaces}        ),
${spaces}      ),
${spaces}    ),`;

      if (fixedWidgets) {
        return `${spaces}DesignNode(
${props.map((p) => `${spaces}  ${p},`).join("\n")}
${spaces}  children: [
${scrollChild}
${fixedWidgets}
${spaces}  ],
${spaces}),`;
      }

      return `${spaces}DesignNode(
${props.map((p) => `${spaces}  ${p},`).join("\n")}
${spaces}  children: [
${scrollChild}
${spaces}  ],
${spaces}),`;
    }

    return `${spaces}DesignNode(
${props.map((p) => `${spaces}  ${p},`).join("\n")}
${spaces}  children: [
${childWidgets}
${spaces}  ],
${spaces}),`;
  }

  // Simple positioned container
  return `${spaces}DesignNode(
${props.map((p) => `${spaces}  ${p},`).join("\n")}
${spaces}),`;
}

// ═══════════════════════════════════════════════════════════════
// Dart / Flutter Helpers
// ═══════════════════════════════════════════════════════════════

function colorToFlutter(color: string): string {
  if (!color) return "Colors.transparent";

  if (color.startsWith("#")) {
    const hex = color.slice(1);
    if (hex.length === 6) {
      return `const Color(0xFF${hex.toUpperCase()})`;
    }
    if (hex.length === 8) {
      return `const Color(0x${hex.slice(6, 8).toUpperCase()}${hex.slice(0, 6).toUpperCase()})`;
    }
    if (hex.length === 3) {
      const expanded = hex
        .split("")
        .map((c) => c + c)
        .join("");
      return `const Color(0xFF${expanded.toUpperCase()})`;
    }
  }

  if (color.startsWith("rgba")) {
    const match = color.match(
      /rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]+)?\)/
    );
    if (match) {
      const r = parseInt(match[1]).toString(16).padStart(2, "0");
      const g = parseInt(match[2]).toString(16).padStart(2, "0");
      const b = parseInt(match[3]).toString(16).padStart(2, "0");
      const a = match[4]
        ? Math.round(parseFloat(match[4]) * 255)
        : 255;
      const aHex = a.toString(16).padStart(2, "0");
      return `const Color(0x${aHex}${r}${g}${b})`.toUpperCase();
    }
  }

  return `const Color(0xFF000000)`;
}

function fontWeightToFlutter(
  weight: string | number | undefined
): string {
  if (!weight) return "FontWeight.w400";

  const numWeight =
    typeof weight === "number" ? weight : parseInt(weight);

  const weights: Record<number, string> = {
    100: "FontWeight.w100",
    200: "FontWeight.w200",
    300: "FontWeight.w300",
    400: "FontWeight.w400",
    500: "FontWeight.w500",
    600: "FontWeight.w600",
    700: "FontWeight.w700",
    800: "FontWeight.w800",
    900: "FontWeight.w900",
  };

  return weights[numWeight] || "FontWeight.w400";
}

/** Convert PascalCase to snake_case for Dart filenames. */
function toSnakeCase(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();
}

function generateFlutterColors(nodes: DrawableNode[]): string {
  const colors = new Set<string>();

  function collect(node: DrawableNode) {
    if (node.fill?.color) colors.add(node.fill.color);
    if (node.stroke?.color) colors.add(node.stroke.color);
    if (node.text?.color) colors.add(node.text.color);
    node.children?.forEach(collect);
  }

  nodes.forEach(collect);

  const colorDefs = Array.from(colors)
    .map(
      (c, i) =>
        `  static const Color color${i + 1} = ${colorToFlutter(c)};`
    )
    .join("\n");

  return `import 'package:flutter/material.dart';

/// Design tokens extracted from the design file
class DesignColors {
${colorDefs}
}
`;
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
// Flutter Overlay System (showGeneralDialog)
// ═══════════════════════════════════════════════════════════════

function generateFlutterOverlayManager(
  overlayFrames: OverlayFrame[],
  routedInteractions: Interaction[],
  manifest: ImageManifest
): string {
  const overlayWidgets = overlayFrames.map((overlay) => {
    const { frame, componentName } = overlay;
    const w = Math.round(frame.w);
    const h = Math.round(frame.h);
    const bgColor =
      frame.fill?.type === "SOLID" && frame.fill.color
        ? colorToFlutter(frame.fill.color)
        : "Colors.white";

    const innerContent = frame.children?.length
      ? frame.children
          .map((child) =>
            renderFlutterWidget(child, manifest, routedInteractions, 12, true)
          )
          .join("\n")
      : "";

    return { id: frame.id, componentName, w, h, bgColor, innerContent };
  });

  const caseBranches = overlayWidgets
    .map(
      (ov) => `      case '${ov.id}':
        content = SizedBox(
          width: ${ov.w},
          height: ${ov.h},
          child: Container(
            decoration: BoxDecoration(
              color: ${ov.bgColor},
              borderRadius: BorderRadius.circular(12),
            ),
            clipBehavior: Clip.hardEdge,
            child: Stack(
              children: [
${ov.innerContent}
              ],
            ),
          ),
        );
        break;`
    )
    .join("\n");

  return `import 'package:flutter/material.dart';
import '../widgets/design_node.dart';

class OverlayManager {
  static void show(BuildContext context, String overlayId) {
    Widget content;
    switch (overlayId) {
${caseBranches}
      default:
        content = Container(
          padding: const EdgeInsets.all(20),
          color: Colors.white,
          child: Text('Unknown overlay: \$overlayId'),
        );
    }

    showGeneralDialog(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'Overlay',
      barrierColor: Colors.black54,
      transitionDuration: const Duration(milliseconds: 200),
      pageBuilder: (ctx, anim1, anim2) {
        return Center(
          child: Material(
            color: Colors.transparent,
            child: content,
          ),
        );
      },
      transitionBuilder: (ctx, anim1, anim2, child) {
        return FadeTransition(
          opacity: anim1,
          child: ScaleTransition(
            scale: Tween<double>(begin: 0.95, end: 1.0).animate(
              CurvedAnimation(parent: anim1, curve: Curves.easeOut),
            ),
            child: child,
          ),
        );
      },
    );
  }
}
`;
}

export default flutterBuilder;
