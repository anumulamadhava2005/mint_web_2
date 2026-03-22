// ═══════════════════════════════════════════════════════════════
// Text Engine — Measurement, wrapping, layout, and rendering
//
// Handles all text-specific logic for the Figma-style canvas:
//   - Text case transforms
//   - Word wrapping / line breaking
//   - Text measurement (intrinsic size computation)
//   - Full rendering with alignment, decorations, list markers
//   - Auto-resize mode support (autoWidth/autoHeight/fixed)
//
// Uses an offscreen canvas for text measurement.
// ═══════════════════════════════════════════════════════════════

import type {
  CanvasShape,
  TextAlign,
  VerticalAlign,
  TextResizeMode,
  TextDecoration,
  TextCase,
  ListType,
} from "./canvasEngine";

// ── Constants ─────────────────────────────────────────────────

const DEFAULT_FONT = "Inter, system-ui, sans-serif";
const DEFAULT_FONT_SIZE = 16;
const AUTO_LINE_HEIGHT_RATIO = 1.3;
const LIST_INDENT = 20; // px for list markers

// ── Measurement context (singleton) ───────────────────────────

let _measureCtx: CanvasRenderingContext2D | null = null;

function getMeasureCtx(): CanvasRenderingContext2D {
  if (!_measureCtx) {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    _measureCtx = c.getContext("2d")!;
  }
  return _measureCtx;
}

// ── Text transform ────────────────────────────────────────────

export function applyTextCase(text: string, textCase: TextCase): string {
  switch (textCase) {
    case "uppercase": return text.toUpperCase();
    case "lowercase": return text.toLowerCase();
    case "titleCase":
      return text.replace(/\b\w/g, (c) => c.toUpperCase());
    default: return text;
  }
}

// ── Font string builder ───────────────────────────────────────

export function buildFontString(shape: CanvasShape): string {
  const style = shape.fontStyle === "italic" ? "italic" : "normal";
  const weight = shape.fontWeight ?? 400;
  const size = shape.fontSize || DEFAULT_FONT_SIZE;
  const family = shape.fontFamily || DEFAULT_FONT;
  return `${style} ${weight} ${size}px ${family}`;
}

// ── Line height resolver ──────────────────────────────────────

export function getLineHeight(shape: CanvasShape): number {
  const fontSize = shape.fontSize || DEFAULT_FONT_SIZE;
  if (shape.lineHeight && shape.lineHeight > 0) return shape.lineHeight;
  return Math.round(fontSize * AUTO_LINE_HEIGHT_RATIO);
}

// ── Laid-out line data ────────────────────────────────────────

export interface TextLine {
  text: string;
  width: number;
  /** Whether this is a paragraph end (original '\n') */
  paragraphEnd: boolean;
  /** List marker text (e.g. "•" or "1.") — empty for non-list lines */
  listMarker: string;
  /** Index within its paragraph (for numbered lists) */
  lineIndex: number;
}

// ── Word wrapping ─────────────────────────────────────────────

/**
 * Break text into wrapped lines that fit within `maxWidth`.
 * If maxWidth <= 0 (autoWidth mode), no wrapping occurs — only
 * explicit newlines create new lines.
 */
export function wrapTextToLines(
  shape: CanvasShape,
  maxWidth: number,
): TextLine[] {
  const ctx = getMeasureCtx();
  const font = buildFontString(shape);
  ctx.font = font;

  const letterSpacing = shape.letterSpacing ?? 0;
  const rawText = applyTextCase(shape.text || "Text", shape.textCase ?? "none");
  const listType = shape.listType ?? "none";

  // Split into paragraphs (explicit newlines)
  const paragraphs = rawText.split("\n");
  const lines: TextLine[] = [];
  let paragraphIndex = 0;

  for (let pi = 0; pi < paragraphs.length; pi++) {
    const para = paragraphs[pi];
    const isLastParagraph = pi === paragraphs.length - 1;
    const marker = getListMarker(listType, paragraphIndex);
    const markerWidth = marker ? measureTextWidth(ctx, marker + " ", letterSpacing) : 0;
    const availWidth = maxWidth > 0 ? maxWidth - (marker ? LIST_INDENT : 0) : 0;

    if (maxWidth <= 0 || availWidth <= 0) {
      // No wrapping — single line per paragraph
      const lineWidth = measureTextWidth(ctx, para, letterSpacing) + (marker ? LIST_INDENT : 0);
      lines.push({
        text: para,
        width: lineWidth,
        paragraphEnd: true,
        listMarker: marker,
        lineIndex: 0,
      });
      if (marker) paragraphIndex++;
    } else {
      // Word wrap
      const words = para.split(/(\s+)/); // Keep whitespace tokens
      let currentLine = "";
      let currentWidth = 0;
      let lineIdx = 0;

      for (const word of words) {
        if (word === "") continue;
        const wordWidth = measureTextWidth(ctx, word, letterSpacing);

        if (currentLine === "") {
          currentLine = word;
          currentWidth = wordWidth;
        } else if (currentWidth + wordWidth <= availWidth) {
          currentLine += word;
          currentWidth += wordWidth;
        } else {
          // Emit current line
          lines.push({
            text: currentLine.trimEnd(),
            width: measureTextWidth(ctx, currentLine.trimEnd(), letterSpacing) + (lineIdx === 0 && marker ? LIST_INDENT : 0),
            paragraphEnd: false,
            listMarker: lineIdx === 0 ? marker : "",
            lineIndex: lineIdx,
          });
          lineIdx++;
          currentLine = word.trimStart();
          currentWidth = measureTextWidth(ctx, currentLine, letterSpacing);
        }
      }

      // Emit last line of paragraph
      if (currentLine || para === "") {
        lines.push({
          text: currentLine.trimEnd(),
          width: measureTextWidth(ctx, currentLine.trimEnd(), letterSpacing) + (lineIdx === 0 && marker ? LIST_INDENT : 0),
          paragraphEnd: true,
          listMarker: lineIdx === 0 ? marker : "",
          lineIndex: lineIdx,
        });
      }

      if (marker) paragraphIndex++;
    }
  }

  return lines;
}

// ── Text measurement ──────────────────────────────────────────

function measureTextWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  letterSpacing: number,
): number {
  if (text.length === 0) return 0;
  const base = ctx.measureText(text).width;
  // Letter spacing applies between characters (n-1 gaps)
  return base + Math.max(0, text.length - 1) * letterSpacing;
}

/**
 * Compute the intrinsic (natural) size of text content.
 * Used for "hug contents" and auto-resize logic.
 */
export function computeTextSize(
  shape: CanvasShape,
): { width: number; height: number } {
  const lineHeight = getLineHeight(shape);
  const paragraphSpacing = shape.paragraphSpacing ?? 0;
  const resizeMode = shape.textResizeMode ?? "autoWidth";

  // For autoWidth, wrap with no constraint; for others, wrap to shape width
  const maxWidth = resizeMode === "autoWidth" ? 0 : shape.width;
  const lines = wrapTextToLines(shape, maxWidth);

  if (lines.length === 0) {
    return { width: 0, height: lineHeight };
  }

  const maxLineWidth = Math.max(...lines.map(l => l.width));

  // Height = sum of line heights + paragraph spacing at paragraph ends
  let height = 0;
  for (let i = 0; i < lines.length; i++) {
    height += lineHeight;
    if (lines[i].paragraphEnd && i < lines.length - 1) {
      height += paragraphSpacing;
    }
  }

  return {
    width: Math.ceil(maxLineWidth) + 4, // +4 for slight padding
    height: Math.ceil(height),
  };
}

// ── List markers ──────────────────────────────────────────────

function getListMarker(listType: ListType, index: number): string {
  switch (listType) {
    case "bullet": return "•";
    case "numbered": return `${index + 1}.`;
    default: return "";
  }
}

// ── Text rendering ────────────────────────────────────────────

/**
 * Render text for a CanvasShape onto a 2D context.
 * The context should already be transformed to the shape's
 * local coordinate system (0,0 = top-left of shape).
 */
export function renderText(
  ctx: CanvasRenderingContext2D,
  shape: CanvasShape,
): void {
  const fontSize = shape.fontSize || DEFAULT_FONT_SIZE;
  const lineHeight = getLineHeight(shape);
  const textAlign = shape.textAlign ?? "left";
  const verticalAlign = shape.verticalAlign ?? "top";
  const textDecoration = shape.textDecoration ?? "none";
  const letterSpacing = shape.letterSpacing ?? 0;
  const paragraphSpacing = shape.paragraphSpacing ?? 0;
  const resizeMode = shape.textResizeMode ?? "autoWidth";
  const listType = shape.listType ?? "none";

  const font = buildFontString(shape);
  ctx.font = font;
  ctx.fillStyle = shape.fill || "#FFFFFF";
  ctx.textBaseline = "top";

  // Determine wrapping width
  const maxWidth = resizeMode === "autoWidth" ? 0 : shape.width;
  const lines = wrapTextToLines(shape, maxWidth);

  if (lines.length === 0) return;

  // Compute total text height
  let totalHeight = 0;
  for (let i = 0; i < lines.length; i++) {
    totalHeight += lineHeight;
    if (lines[i].paragraphEnd && i < lines.length - 1) {
      totalHeight += paragraphSpacing;
    }
  }

  // Vertical alignment offset
  let yOffset = 0;
  if (verticalAlign === "center") {
    yOffset = Math.max(0, (shape.height - totalHeight) / 2);
  } else if (verticalAlign === "bottom") {
    yOffset = Math.max(0, shape.height - totalHeight);
  }

  // Clip in fixed mode
  if (resizeMode === "fixed") {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, shape.width, shape.height);
    ctx.clip();
  }

  const drawWidth = resizeMode === "autoWidth" ? Infinity : shape.width;

  // Draw each line
  let y = yOffset;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const hasMarker = line.listMarker && line.lineIndex === 0;
    const textIndent = hasMarker ? LIST_INDENT : (listType !== "none" ? LIST_INDENT : 0);
    const textAreaWidth = drawWidth - textIndent;

    // Draw list marker
    if (hasMarker) {
      ctx.fillText(line.listMarker, 0, y);
    }

    // Horizontal alignment
    let x = textIndent;
    if (textAlign === "center") {
      const lineW = measureLineWidth(ctx, line.text, letterSpacing);
      x = textIndent + Math.max(0, (textAreaWidth - lineW) / 2);
    } else if (textAlign === "right") {
      const lineW = measureLineWidth(ctx, line.text, letterSpacing);
      x = Math.max(textIndent, drawWidth - lineW);
    }

    // Draw text with letter spacing
    if (letterSpacing > 0 && line.text.length > 0) {
      drawTextWithSpacing(ctx, line.text, x, y, letterSpacing, textAlign === "justified" ? textAreaWidth : 0, line.paragraphEnd);
    } else if (textAlign === "justified" && !line.paragraphEnd && line.text.trim().length > 0) {
      drawJustifiedText(ctx, line.text, x, y, textAreaWidth);
    } else {
      ctx.fillText(line.text, x, y);
    }

    // Draw decoration
    if (textDecoration !== "none" && line.text.trim().length > 0) {
      const lineW = measureLineWidth(ctx, line.text, letterSpacing);
      const decorY = textDecoration === "underline"
        ? y + fontSize + 2
        : y + fontSize * 0.5; // strikethrough at middle

      ctx.save();
      ctx.strokeStyle = shape.fill || "#FFFFFF";
      ctx.lineWidth = Math.max(1, fontSize / 14);
      ctx.beginPath();
      ctx.moveTo(x, decorY);
      ctx.lineTo(x + lineW, decorY);
      ctx.stroke();
      ctx.restore();
    }

    y += lineHeight;
    if (line.paragraphEnd && i < lines.length - 1) {
      y += paragraphSpacing;
    }
  }

  if (resizeMode === "fixed") {
    ctx.restore();
  }
}

// ── Drawing helpers ───────────────────────────────────────────

function measureLineWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  letterSpacing: number,
): number {
  if (text.length === 0) return 0;
  const base = ctx.measureText(text).width;
  return base + Math.max(0, text.length - 1) * letterSpacing;
}

function drawTextWithSpacing(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
  justifyWidth: number,
  isParagraphEnd: boolean,
): void {
  if (justifyWidth > 0 && !isParagraphEnd && text.trim().length > 0) {
    drawJustifiedText(ctx, text, x, y, justifyWidth);
    return;
  }

  // Draw character by character with spacing
  let cx = x;
  for (let i = 0; i < text.length; i++) {
    ctx.fillText(text[i], cx, y);
    cx += ctx.measureText(text[i]).width + spacing;
  }
}

function drawJustifiedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  targetWidth: number,
): void {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  if (words.length <= 1) {
    ctx.fillText(text, x, y);
    return;
  }

  const totalWordWidth = words.reduce((sum, w) => sum + ctx.measureText(w).width, 0);
  const extraSpace = Math.max(0, targetWidth - totalWordWidth) / (words.length - 1);

  let cx = x;
  for (let i = 0; i < words.length; i++) {
    ctx.fillText(words[i], cx, y);
    cx += ctx.measureText(words[i]).width + extraSpace;
  }
}
