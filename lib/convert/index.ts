// ═══════════════════════════════════════════════════════════════
// Code Conversion Module
// Main entry point for design-to-code conversion
// ═══════════════════════════════════════════════════════════════

import type {
  DesignNode,
  DrawableNode,
  ConversionRequest,
  ConversionResult,
  ConversionOptions,
  GeneratedFile,
  ImageManifest,
  Interaction,
  TargetFramework,
} from "./types";

import {
  generateLiveSyncFiles,
  patchPackageJsonForSync,
} from "./liveSyncFiles";

import {
  buildDrawableTree,
  applyUXEnhancements,
  flattenTree,
  findNodeById,
} from "./core/tree";

import {
  collectImages,
  buildImageManifest,
  remapImagePaths,
  downloadImages,
  processBase64Images,
} from "./core/images";

import { getBuilder, getAvailableFrameworks } from "./builders";
import { buildReactNativeFromSchema } from "./builders/reactNativeSchema";
import { buildReactWebFromSchema } from "./builders/reactWebSchema";
import { buildNextFromSchema } from "./builders/nextSchema";

// ═══════════════════════════════════════════════════════════════
// Main Conversion Function
// ═══════════════════════════════════════════════════════════════

/**
 * Converts design nodes to framework-specific code
 */
export async function convertDesign(
  request: ConversionRequest
): Promise<ConversionResult> {
  const {
    target,
    fileName,
    nodes,
    referenceFrame,
    interactions = [],
    options = {},
  } = request;

  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    // 0. Schema-driven React Native path.
    // When exporting React Native and the project has authored screen
    // components (dataTable / camera / chart / forms / …), generate the app
    // from the runtime AppSchema (Expo Router + mint-runtime) instead of the
    // design-shape path. This exporter emits its own package.json/app.json,
    // so the result is flagged for callers to skip RN scaffolding injection.
    const rs = options.runtimeSchema as
      | (NonNullable<ConversionOptions["runtimeSchema"]> & { screens?: any[] })
      | undefined;
    const schemaScreens = Array.isArray(rs?.screens) ? rs!.screens! : [];
    const hasAuthoredComponents = schemaScreens.some(
      (s) => Array.isArray(s?.components) && s.components.length > 0
    );

    // Shared AppSchema for all schema-driven exporters (RN + web).
    const buildAppSchema = () => ({
      id: rs?.id || options.projectId || "app",
      name: rs?.name || fileName || "Mint App",
      version: "1.0.0",
      schemaVersion: 1,
      theme: rs?.theme ?? { colors: {}, fonts: {}, spacing: {}, radii: {}, shadows: {} },
      screens: schemaScreens,
      globalState: rs?.globalState ?? [],
      globalActions: rs?.globalActions ?? [],
      workflows: rs?.workflows ?? [],
      navigation: rs?.navigation ?? { type: "stack", initialRoute: "/", routes: [] },
      auth: rs?.auth,
      database: rs?.database,
    } as any);

    // Live-sync injector shared by the schema paths.
    const withLiveSync = (files: GeneratedFile[]): GeneratedFile[] => {
      if (!options.enableLiveSync) return files;
      files.push(...generateLiveSyncFiles(options));
      const pkgIdx = files.findIndex(
        (f) => f.path === "package.json" || f.path.endsWith("/package.json")
      );
      if (pkgIdx !== -1 && files[pkgIdx].type === "text") {
        files[pkgIdx] = {
          ...files[pkgIdx],
          content: patchPackageJsonForSync(files[pkgIdx].content as string),
        };
      }
      return files;
    };

    // Schema-driven React Native (Expo Router + mint-runtime).
    if (target === "react-native" && hasAuthoredComponents) {
      const appSchema = buildAppSchema();
      const files = withLiveSync(buildReactNativeFromSchema(appSchema, {
        projectId: options.projectId || appSchema.id,
        appName: appSchema.name,
        apiOrigin: options.apiOrigin,
        authToken: options.authToken,
      }) as GeneratedFile[]);
      return { success: true, files, usedSchemaRuntime: true };
    }

    // Schema-driven React web (Vite + react-router + embedded Mint runtime).
    // Emits working state/actions/navigation from the AppSchema — no static
    // canvas markup, no action stubs. Same engine the editor previews with.
    if (target === "react" && hasAuthoredComponents) {
      const appSchema = buildAppSchema();
      const files = withLiveSync(buildReactWebFromSchema(appSchema, {
        projectId: options.projectId || appSchema.id,
        appName: appSchema.name,
        apiOrigin: options.apiOrigin,
        authToken: options.authToken,
      }) as GeneratedFile[]);
      return { success: true, files, usedSchemaRuntime: true };
    }

    // Schema-driven Next.js (App Router + embedded Mint runtime) — reuses the
    // React renderer/runtime; provider uses next/navigation.
    if (target === "nextjs" && hasAuthoredComponents) {
      const appSchema = buildAppSchema();
      const files = withLiveSync(buildNextFromSchema(appSchema, {
        projectId: options.projectId || appSchema.id,
        appName: appSchema.name,
        apiOrigin: options.apiOrigin,
        authToken: options.authToken,
      }) as GeneratedFile[]);
      return { success: true, files, usedSchemaRuntime: true };
    }

    // 1. Get the appropriate builder
    const builder = getBuilder(target);
    if (!builder) {
      return {
        success: false,
        files: [],
        errors: [`Unknown target framework: ${target}`],
      };
    }

    // 2. Build drawable tree (coordinates are already local to each frame)
    const drawableTree = buildDrawableTree(
      nodes,
      0,
      0,
      interactions
    );

    // 3. Apply UX enhancements
    const refWidth = referenceFrame?.width ?? 1440;
    const refHeight = referenceFrame?.height ?? 900;
    const enhancedTree = applyUXEnhancements(drawableTree, refWidth, refHeight);

    // 4. Collect and process images
    const imageRefs = collectImages(enhancedTree);
    const manifest = buildImageManifest(imageRefs);

    // Process base64 images
    processBase64Images(imageRefs, manifest);

    // Download URL images (with timeout)
    try {
      await downloadImages(imageRefs, manifest, { timeout: 15000 });
    } catch (err) {
      warnings.push(`Some images could not be downloaded: ${err}`);
    }

    // Remap image paths in the tree
    const finalTree = remapImagePaths(enhancedTree, manifest);

    // 5. Filter interactions to only include nodes in the export
    const nodeIds = new Set(flattenTree(finalTree).map((n) => n.id));
    const filteredInteractions = interactions.filter(
      (i) => nodeIds.has(i.sourceId) && (!i.targetId || nodeIds.has(i.targetId))
    );

    // 6. Build the project
    const files = await builder.build(
      finalTree,
      { ...options, fileName },
      manifest,
      filteredInteractions
    );

    // 7. Inject live sync files if enabled
    if (options.enableLiveSync) {
      const syncFiles = generateLiveSyncFiles(options);
      files.push(...syncFiles);

      // Patch package.json to add sync dependencies + script
      const pkgIdx = files.findIndex(
        (f) => f.path === "package.json" || f.path.endsWith("/package.json")
      );
      if (pkgIdx !== -1 && files[pkgIdx].type === "text") {
        files[pkgIdx] = {
          ...files[pkgIdx],
          content: patchPackageJsonForSync(files[pkgIdx].content as string),
        };
      }
    }

    return {
      success: true,
      files,
      warnings: warnings.length > 0 ? warnings : undefined,
      manifest,
    };
  } catch (err) {
    return {
      success: false,
      files: [],
      errors: [err instanceof Error ? err.message : String(err)],
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// Utility Exports
// ═══════════════════════════════════════════════════════════════

export { getAvailableFrameworks };

export type {
  DesignNode,
  DrawableNode,
  ConversionRequest,
  ConversionResult,
  ConversionOptions,
  GeneratedFile,
  ImageManifest,
  Interaction,
  TargetFramework,
};

// Re-export core utilities for advanced use cases
export * from "./core";
export * from "./types";
