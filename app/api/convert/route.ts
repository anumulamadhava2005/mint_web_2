// ═══════════════════════════════════════════════════════════════
// Code Conversion API Route
// POST /api/convert - Converts design JSON to framework code
// ═══════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import { z } from "zod";
import { exec } from "child_process";
import util from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";
import crypto from "crypto";

const execAsync = util.promisify(exec);

import {
  convertDesign,
  getAvailableFrameworks,
  type TargetFramework,
} from "@/lib/convert";
import { patchPackageJsonForSync } from "@/lib/convert/liveSyncFiles";

// ── Request Schema ────────────────────────────────────────────

const ConversionRequestSchema = z.object({
  target: z.enum([
    "react",
    "nextjs",
    "vue",
    "svelte",
    "react-native",
    "flutter",
    "html",
  ] as const),
  fileName: z.string().optional().default("design-export"),
  nodes: z.array(z.any()), // Design nodes - validated loosely for flexibility
  referenceFrame: z
    .object({
      id: z.string().optional(),
      x: z.number().optional().default(0),
      y: z.number().optional().default(0),
      width: z.number().optional().default(1440),
      height: z.number().optional().default(900),
    })
    .optional(),
  interactions: z.array(z.any()).optional().default([]),
  options: z
    .object({
      generateTypeScript: z.boolean().optional(),
      includeComments: z.boolean().optional(),
      cssFramework: z
        .enum(["tailwind", "styled-components", "css-modules", "inline"])
        .optional(),
      embedImages: z.boolean().optional(),
      imageQuality: z.number().min(1).max(100).optional(),
      indentSize: z.number().min(1).max(8).optional(),
      useSemicolons: z.boolean().optional(),
      singleQuotes: z.boolean().optional(),
      nextjsAppRouter: z.boolean().optional(),
      vueCompositionApi: z.boolean().optional(),
      reactUseHooks: z.boolean().optional(),
      enableLiveSync: z.boolean().optional(),
      fileKey: z.string().optional(),
      projectId: z.string().optional(),
      userId: z.string().optional(),
      runtimeSchema: z.object({
        globalState: z.array(z.any()).optional(),
        globalActions: z.array(z.any()).optional(),
        database: z.any().optional(),
        workflows: z.array(z.any()).optional(),
      }).optional(),
    })
    .optional(),
});

// ── POST Handler ──────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const parseResult = ConversionRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request body",
          details: parseResult.error.issues,
        },
        { status: 400 }
      );
    }

    const conversionRequest = parseResult.data;

    // Validate that nodes array is not empty
    if (!conversionRequest.nodes.length) {
      return NextResponse.json(
        {
          success: false,
          error: "No design nodes provided",
        },
        { status: 400 }
      );
    }

    // Perform conversion
    const result = await convertDesign({
      target: conversionRequest.target as TargetFramework,
      fileName: conversionRequest.fileName,
      nodes: conversionRequest.nodes,
      referenceFrame: conversionRequest.referenceFrame ? {
        id: conversionRequest.referenceFrame.id ?? "",
        x: conversionRequest.referenceFrame.x,
        y: conversionRequest.referenceFrame.y,
        width: conversionRequest.referenceFrame.width,
        height: conversionRequest.referenceFrame.height,
      } : undefined,
      interactions: conversionRequest.interactions,
      options: conversionRequest.options,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Conversion failed",
          details: result.errors,
        },
        { status: 500 }
      );
    }

    let finalFiles = result.files;

    if (conversionRequest.target === "react-native") {
      const appName = conversionRequest.fileName || "Design Export";
      const slugName = appName.toLowerCase().replace(/\s+/g, "-");
      
      let pkgStr = JSON.stringify({
        name: slugName,
        main: "expo-router/entry",
        version: "1.0.0",
        scripts: {
          start: "expo start",
          reset_project: "node ./scripts/reset-project.js",
          android: "expo start --android",
          ios: "expo start --ios",
          web: "expo start --web",
          lint: "expo lint"
        },
        dependencies: {
          "@expo/vector-icons": "^15.0.3",
          "@react-native-async-storage/async-storage": "2.1.2",
          "expo": "~54.0.33",
          "expo-constants": "~18.0.13",
          "expo-font": "~14.0.11",
          "expo-haptics": "~15.0.8",
          "expo-image": "~3.0.11",
          "expo-linking": "~8.0.11",
          "expo-router": "~6.0.23",
          "expo-splash-screen": "~31.0.13",
          "expo-status-bar": "~3.0.9",
          "expo-symbols": "~1.0.8",
          "expo-system-ui": "~6.0.9",
          "expo-web-browser": "~15.0.10",
          "react": "19.1.0",
          "react-dom": "19.1.0",
          "react-native": "0.81.5",
          "react-native-gesture-handler": "~2.28.0",
          "react-native-reanimated": "~4.1.1",
          "react-native-safe-area-context": "~5.6.0",
          "react-native-screens": "~4.16.0",
          "react-native-web": "~0.21.0",
          "react-native-worklets": "0.5.1"
        },
        devDependencies: {
          "@types/react": "~19.1.0",
          "typescript": "~5.9.2",
          "eslint": "^9.25.0",
          "eslint-config-expo": "~10.0.0"
        },
        private: true
      }, null, 2);

      if (conversionRequest.options?.enableLiveSync) {
        pkgStr = patchPackageJsonForSync(pkgStr);
      }

      const appJsonStr = JSON.stringify({
        expo: {
          name: appName,
          slug: slugName,
          version: "1.0.0",
          orientation: "portrait",
          icon: "./assets/images/icon.png",
          scheme: slugName,
          userInterfaceStyle: "automatic",
          newArchEnabled: true,
          ios: { supportsTablet: true },
          android: {
            adaptiveIcon: {
              backgroundColor: "#E6F4FE",
              foregroundImage: "./assets/images/android-icon-foreground.png",
              backgroundImage: "./assets/images/android-icon-background.png",
              monochromeImage: "./assets/images/android-icon-monochrome.png"
            },
            edgeToEdgeEnabled: true,
            predictiveBackGestureEnabled: false
          },
          web: {
            output: "static",
            favicon: "./assets/images/favicon.png"
          },
          plugins: [
            "expo-router",
            [
              "expo-splash-screen",
              {
                image: "./assets/images/splash-icon.png",
                imageWidth: 200,
                resizeMode: "contain",
                backgroundColor: "#ffffff",
                dark: { backgroundColor: "#000000" }
              }
            ]
          ],
          experiments: { typedRoutes: true, reactCompiler: true }
        }
      }, null, 2);

      const tsconfigStr = JSON.stringify({
        extends: "expo/tsconfig.base",
        compilerOptions: {
          strict: true,
          paths: { "@/*": ["./*"] }
        },
        include: ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
      }, null, 2);

      // .gitignore — matches the official create-expo-app template
      const gitignoreStr = `# Learn more https://docs.github.com/en/get-started/getting-started-with-git/ignoring-files

# dependencies
node_modules/

# Expo
.expo/
dist/
web-build/
expo-env.d.ts

# Native
.kotlin/
*.orig.*
*.jks
*.p8
*.p12
*.key
*.mobileprovision

# Metro
.metro-health-check*

# debug
npm-debug.*
yarn-debug.*
yarn-error.*

# macOS
.DS_Store
*.pem

# local env files
.env*.local

# typescript
*.tsbuildinfo

# generated native folders
/ios
/android
`;

      // eslint.config.js — matches the official create-expo-app template
      const eslintConfigStr = `// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
]);
`;

      finalFiles.push(
        { path: "package.json",     content: pkgStr,        type: "text" },
        { path: "app.json",         content: appJsonStr,    type: "text" },
        { path: "tsconfig.json",    content: tsconfigStr,   type: "text" },
        { path: ".gitignore",       content: gitignoreStr,  type: "text" },
        { path: "eslint.config.js", content: eslintConfigStr, type: "text" }
      );
    }

    // Generate ZIP file
    const zipBuffer = await generateZip(finalFiles);

    // Return ZIP file - convert Uint8Array to Buffer for Response compatibility
    const filename = `${conversionRequest.fileName}-${conversionRequest.target}.zip`;
    const buffer = Buffer.from(zipBuffer);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Conversion-Warnings": JSON.stringify(result.warnings || []),
      },
    });
  } catch (error) {
    console.error("Conversion API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// ── GET Handler (Framework List) ──────────────────────────────

export async function GET() {
  const frameworks = getAvailableFrameworks();

  return NextResponse.json({
    success: true,
    frameworks,
    documentation: "/api/convert/docs",
  });
}

// ── ZIP Generation ────────────────────────────────────────────

async function generateZip(
  files: Array<{ path: string; content: string | Uint8Array; type: "text" | "binary" }>
): Promise<Uint8Array> {
  // Simple ZIP implementation using standard compression
  // In production, you'd use a library like JSZip or archiver
  
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const centralDirectory: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const fileName = encoder.encode(file.path);
    const content =
      file.type === "text"
        ? encoder.encode(file.content as string)
        : (file.content as Uint8Array);

    // Local file header
    const localHeader = createLocalFileHeader(fileName, content);
    parts.push(localHeader);
    parts.push(content);

    // Central directory entry
    const centralEntry = createCentralDirectoryEntry(
      fileName,
      content,
      offset
    );
    centralDirectory.push(centralEntry);

    offset += localHeader.length + content.length;
  }

  // Add central directory
  const centralDirStart = offset;
  for (const entry of centralDirectory) {
    parts.push(entry);
    offset += entry.length;
  }

  // End of central directory record
  const endOfCentralDir = createEndOfCentralDirectory(
    centralDirectory.length,
    offset - centralDirStart,
    centralDirStart
  );
  parts.push(endOfCentralDir);

  // Concatenate all parts
  const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const part of parts) {
    result.set(part, pos);
    pos += part.length;
  }

  return result;
}

function createLocalFileHeader(
  fileName: Uint8Array,
  content: Uint8Array
): Uint8Array {
  const header = new Uint8Array(30 + fileName.length);
  const view = new DataView(header.buffer);

  // Signature
  view.setUint32(0, 0x04034b50, true);
  // Version needed
  view.setUint16(4, 20, true);
  // Flags
  view.setUint16(6, 0, true);
  // Compression method (0 = store)
  view.setUint16(8, 0, true);
  // Mod time/date
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  // CRC32 (simplified - 0 for now)
  view.setUint32(14, crc32(content), true);
  // Compressed size
  view.setUint32(18, content.length, true);
  // Uncompressed size
  view.setUint32(22, content.length, true);
  // File name length
  view.setUint16(26, fileName.length, true);
  // Extra field length
  view.setUint16(28, 0, true);
  // File name
  header.set(fileName, 30);

  return header;
}

function createCentralDirectoryEntry(
  fileName: Uint8Array,
  content: Uint8Array,
  offset: number
): Uint8Array {
  const entry = new Uint8Array(46 + fileName.length);
  const view = new DataView(entry.buffer);

  // Signature
  view.setUint32(0, 0x02014b50, true);
  // Version made by
  view.setUint16(4, 20, true);
  // Version needed
  view.setUint16(6, 20, true);
  // Flags
  view.setUint16(8, 0, true);
  // Compression method
  view.setUint16(10, 0, true);
  // Mod time/date
  view.setUint16(12, 0, true);
  view.setUint16(14, 0, true);
  // CRC32
  view.setUint32(16, crc32(content), true);
  // Compressed size
  view.setUint32(20, content.length, true);
  // Uncompressed size
  view.setUint32(24, content.length, true);
  // File name length
  view.setUint16(28, fileName.length, true);
  // Extra field length
  view.setUint16(30, 0, true);
  // Comment length
  view.setUint16(32, 0, true);
  // Disk number start
  view.setUint16(34, 0, true);
  // Internal attributes
  view.setUint16(36, 0, true);
  // External attributes
  view.setUint32(38, 0, true);
  // Offset of local header
  view.setUint32(42, offset, true);
  // File name
  entry.set(fileName, 46);

  return entry;
}

function createEndOfCentralDirectory(
  numEntries: number,
  centralDirSize: number,
  centralDirOffset: number
): Uint8Array {
  const record = new Uint8Array(22);
  const view = new DataView(record.buffer);

  // Signature
  view.setUint32(0, 0x06054b50, true);
  // Disk number
  view.setUint16(4, 0, true);
  // Disk with central dir
  view.setUint16(6, 0, true);
  // Entries on this disk
  view.setUint16(8, numEntries, true);
  // Total entries
  view.setUint16(10, numEntries, true);
  // Central dir size
  view.setUint32(12, centralDirSize, true);
  // Offset to central dir
  view.setUint32(16, centralDirOffset, true);
  // Comment length
  view.setUint16(20, 0, true);

  return record;
}

// Simple CRC32 implementation
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  const table = getCrc32Table();

  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

let crc32Table: Uint32Array | null = null;

function getCrc32Table(): Uint32Array {
  if (crc32Table) return crc32Table;

  crc32Table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crc32Table[i] = c >>> 0;
  }

  return crc32Table;
}
