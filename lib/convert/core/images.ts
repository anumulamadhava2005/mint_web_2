// ═══════════════════════════════════════════════════════════════
// Image Processing — Handles image extraction, optimization, and
// manifest generation for code conversion
// ═══════════════════════════════════════════════════════════════

import type { DrawableNode, ImageManifest, Fill } from "../types";

// ── Image Reference Types ─────────────────────────────────────

export interface ImageReference {
  nodeId: string;
  originalRef: string;
  localPath: string;
  type: "base64" | "url" | "figma";
  format?: "png" | "jpg" | "webp" | "svg" | "gif";
  width?: number;
  height?: number;
}

// ═══════════════════════════════════════════════════════════════
// Image Collection
// ═══════════════════════════════════════════════════════════════

/**
 * Extracts all image references from a drawable tree
 */
export function collectImages(nodes: DrawableNode[]): ImageReference[] {
  const images: ImageReference[] = [];
  let imageIndex = 0;

  function traverse(node: DrawableNode) {
    // Check for image fill
    if (node.fill?.type === "IMAGE" && node.fill.imageRef) {
      const ref = node.fill.imageRef;
      const type = detectImageType(ref);
      const format = detectImageFormat(ref);

      images.push({
        nodeId: node.id,
        originalRef: ref,
        localPath: generateLocalPath(node.name, imageIndex++, format),
        type,
        format,
        width: node.w,
        height: node.h,
      });
    }

    // Check for IMAGE type nodes
    if (node.type === "IMAGE" && node.fill?.imageRef) {
      // Already handled above
    }

    // Recurse
    node.children?.forEach(traverse);
  }

  nodes.forEach(traverse);
  return images;
}

/**
 * Detects the image reference type
 */
function detectImageType(ref: string): "base64" | "url" | "figma" {
  if (ref.startsWith("data:")) {
    return "base64";
  }
  if (ref.startsWith("http://") || ref.startsWith("https://")) {
    return "url";
  }
  return "figma";
}

/**
 * Detects image format from reference
 */
function detectImageFormat(ref: string): "png" | "jpg" | "webp" | "svg" | "gif" {
  if (ref.includes("image/png") || ref.endsWith(".png")) return "png";
  if (ref.includes("image/jpeg") || ref.endsWith(".jpg") || ref.endsWith(".jpeg")) return "jpg";
  if (ref.includes("image/webp") || ref.endsWith(".webp")) return "webp";
  if (ref.includes("image/svg") || ref.endsWith(".svg")) return "svg";
  if (ref.includes("image/gif") || ref.endsWith(".gif")) return "gif";
  return "png"; // Default
}

/**
 * Generates a local path for an image
 */
function generateLocalPath(name: string, index: number, format: string): string {
  // Sanitize name
  const safeName = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 32);

  return `/assets/${safeName}-${index}.${format}`;
}

// ═══════════════════════════════════════════════════════════════
// Image Manifest
// ═══════════════════════════════════════════════════════════════

/**
 * Builds an image manifest for the conversion
 */
export function buildImageManifest(references: ImageReference[]): ImageManifest {
  return {
    images: new Map(references.map((r) => [r.originalRef, r.localPath])),
    blobs: new Map(), // Will be populated during download
  };
}

/**
 * Updates drawable nodes with local image paths
 */
export function remapImagePaths(
  nodes: DrawableNode[],
  manifest: ImageManifest
): DrawableNode[] {
  function processNode(node: DrawableNode): DrawableNode {
    const result = { ...node };

    // Remap fill image reference
    if (result.fill?.type === "IMAGE" && result.fill.imageRef) {
      const localPath = manifest.images.get(result.fill.imageRef);
      if (localPath) {
        result.fill = {
          ...result.fill,
          imageRef: localPath,
        };
      }
    }

    // Process children
    if (result.children) {
      result.children = result.children.map(processNode);
    }

    return result;
  }

  return nodes.map(processNode);
}

// ═══════════════════════════════════════════════════════════════
// Image Download & Processing
// ═══════════════════════════════════════════════════════════════

/**
 * Downloads images from URLs and stores them in the manifest
 */
export async function downloadImages(
  references: ImageReference[],
  manifest: ImageManifest,
  options: { timeout?: number } = {}
): Promise<void> {
  const urlImages = references.filter((r) => r.type === "url");
  const timeout = options.timeout ?? 10000;

  const downloads = urlImages.map(async (ref) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(ref.originalRef, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`Failed to download image: ${ref.originalRef}`);
        return;
      }

      const buffer = await response.arrayBuffer();
      manifest.blobs.set(ref.localPath, new Uint8Array(buffer));
    } catch (error) {
      console.warn(`Error downloading image: ${ref.originalRef}`, error);
    }
  });

  await Promise.all(downloads);
}

/**
 * Converts base64 images to binary
 */
export function processBase64Images(
  references: ImageReference[],
  manifest: ImageManifest
): void {
  const base64Images = references.filter((r) => r.type === "base64");

  for (const ref of base64Images) {
    try {
      const base64Data = ref.originalRef.split(",")[1];
      if (base64Data) {
        const binary = base64ToUint8Array(base64Data);
        manifest.blobs.set(ref.localPath, binary);
      }
    } catch (error) {
      console.warn(`Error processing base64 image for ${ref.nodeId}`, error);
    }
  }
}

/**
 * Converts base64 string to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  // Decode base64 to binary string
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// ═══════════════════════════════════════════════════════════════
// Image Embedding
// ═══════════════════════════════════════════════════════════════

/**
 * Determines whether an image should be embedded or referenced
 */
export function shouldEmbedImage(ref: ImageReference): boolean {
  // Always embed small images (icons, avatars)
  if (ref.width && ref.height) {
    const area = ref.width * ref.height;
    if (area < 10000) return true; // < 100x100
  }

  // Embed base64 images that are already inline
  if (ref.type === "base64") return true;

  return false;
}

/**
 * Generates an image source string for different embedding strategies
 */
export function getImageSrc(
  ref: ImageReference,
  manifest: ImageManifest,
  embed: boolean
): string {
  if (embed && ref.type === "base64") {
    return ref.originalRef; // Keep data URL
  }

  const localPath = manifest.images.get(ref.originalRef);
  return localPath ?? ref.originalRef;
}

// ═══════════════════════════════════════════════════════════════
// Image Info Generation
// ═══════════════════════════════════════════════════════════════

/**
 * Generates IMAGES.txt file content documenting all images
 */
export function generateImagesDocument(references: ImageReference[]): string {
  const lines = [
    "# Images in this project",
    "",
    "This document lists all images used in the design.",
    "",
    "| Local Path | Original Source | Type | Dimensions |",
    "|------------|-----------------|------|------------|",
  ];

  for (const ref of references) {
    const dims = ref.width && ref.height ? `${ref.width}x${ref.height}` : "N/A";
    const source =
      ref.type === "base64"
        ? "[embedded base64]"
        : ref.type === "figma"
        ? `[Figma: ${ref.originalRef}]`
        : ref.originalRef;

    lines.push(`| ${ref.localPath} | ${source} | ${ref.type} | ${dims} |`);
  }

  lines.push("");
  lines.push(`Total images: ${references.length}`);

  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════
// Placeholder Generation
// ═══════════════════════════════════════════════════════════════

/**
 * Generates a placeholder SVG for missing images
 */
export function generatePlaceholderSVG(width: number, height: number): string {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#e5e7eb"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-family="system-ui" font-size="14">
      Image
    </text>
  </svg>`;
}

/**
 * Converts SVG to data URL
 */
export function svgToDataUrl(svg: string): string {
  const encoded = encodeURIComponent(svg);
  return `data:image/svg+xml,${encoded}`;
}
