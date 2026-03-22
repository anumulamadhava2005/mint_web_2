// ═══════════════════════════════════════════════════════════════
// SVG Shape Renderers — Renders PenpotShapes in the viewport
// Mirrors: frontend/src/app/main/ui/shapes/*.cljs
// ═══════════════════════════════════════════════════════════════
"use client";

import React, { memo, useMemo } from "react";
import type { PenpotShape, UUID, Fill, Stroke, Shadow } from "@/lib/penpot/types";
import { ROOT_FRAME_ID } from "@/lib/penpot/types";

// ── Fill to CSS/SVG ───────────────────────────────────────────
function fillToSVG(fills: Fill[]): { fill: string; fillOpacity: number } {
  if (!fills || fills.length === 0) return { fill: "none", fillOpacity: 1 };
  const f = fills[0];
  if (f.fillColor) {
    return { fill: f.fillColor, fillOpacity: f.fillOpacity ?? 1 };
  }
  return { fill: "none", fillOpacity: 1 };
}

function strokeToSVG(strokes: Stroke[]): Record<string, any> {
  if (!strokes || strokes.length === 0) return { stroke: "none", strokeWidth: 0 };
  const s = strokes[0];
  return {
    stroke: s.strokeColor || "none",
    strokeOpacity: s.strokeOpacity ?? 1,
    strokeWidth: s.strokeWidth || 0,
  };
}

// ── Shadow filter ─────────────────────────────────────────────
function shadowFilter(shadows: Shadow[] | undefined, id: UUID): React.ReactNode {
  if (!shadows || shadows.length === 0) return null;
  const visible = shadows.filter((s) => !s.hidden);
  if (visible.length === 0) return null;

  return (
    <defs>
      <filter id={`shadow-${id}`} x="-50%" y="-50%" width="200%" height="200%">
        {visible.map((s, i) => (
          <feDropShadow
            key={i}
            dx={s.offsetX}
            dy={s.offsetY}
            stdDeviation={s.blur / 2}
            floodColor={s.color}
            floodOpacity={s.opacity}
          />
        ))}
      </filter>
    </defs>
  );
}

// ── Rect Shape ────────────────────────────────────────────────
const RectShape = memo(function RectShape({ shape }: { shape: PenpotShape }) {
  const fillProps = fillToSVG(shape.fills);
  const strokeProps = strokeToSVG(shape.strokes);

  return (
    <>
      {shadowFilter(shape.shadow, shape.id)}
      <rect
        x={shape.x}
        y={shape.y}
        width={shape.width}
        height={shape.height}
        rx={shape.rx || 0}
        ry={shape.ry || 0}
        {...fillProps}
        {...strokeProps}
        opacity={shape.opacity}
        filter={shape.shadow?.length ? `url(#shadow-${shape.id})` : undefined}
        data-shape-id={shape.id}
      />
    </>
  );
});

// ── Circle/Ellipse Shape ──────────────────────────────────────
const CircleShape = memo(function CircleShape({ shape }: { shape: PenpotShape }) {
  const fillProps = fillToSVG(shape.fills);
  const strokeProps = strokeToSVG(shape.strokes);
  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;

  return (
    <>
      {shadowFilter(shape.shadow, shape.id)}
      <ellipse
        cx={cx}
        cy={cy}
        rx={shape.width / 2}
        ry={shape.height / 2}
        {...fillProps}
        {...strokeProps}
        opacity={shape.opacity}
        filter={shape.shadow?.length ? `url(#shadow-${shape.id})` : undefined}
        data-shape-id={shape.id}
      />
    </>
  );
});

// ── Path Shape ────────────────────────────────────────────────
const PathShape = memo(function PathShape({ shape }: { shape: PenpotShape }) {
  const fillProps = fillToSVG(shape.fills);
  const strokeProps = strokeToSVG(shape.strokes);

  const d = useMemo(() => {
    if (!shape.pathContent) return "";
    return shape.pathContent
      .map((cmd) => {
        switch (cmd.command) {
          case "M": return `M ${cmd.x} ${cmd.y}`;
          case "L": return `L ${cmd.x} ${cmd.y}`;
          case "C": return `C ${cmd.x1} ${cmd.y1} ${cmd.x2} ${cmd.y2} ${cmd.x} ${cmd.y}`;
          case "Q": return `Q ${cmd.x1} ${cmd.y1} ${cmd.x} ${cmd.y}`;
          case "Z": return "Z";
          default: return "";
        }
      })
      .join(" ");
  }, [shape.pathContent]);

  return (
    <>
      {shadowFilter(shape.shadow, shape.id)}
      <path
        d={d}
        {...fillProps}
        {...strokeProps}
        opacity={shape.opacity}
        filter={shape.shadow?.length ? `url(#shadow-${shape.id})` : undefined}
        data-shape-id={shape.id}
      />
    </>
  );
});

// ── Text Shape ────────────────────────────────────────────────
const TextShape = memo(function TextShape({ shape }: { shape: PenpotShape }) {
  const fillProps = fillToSVG(shape.fills);
  const defaultFill = fillProps.fill === "none" ? "#000" : fillProps.fill;

  const content = shape.content;
  if (!content || !content.children || content.children.length === 0) {
    // Fallback: simple text
    return (
      <text
        x={shape.x}
        y={shape.y + 16}
        fontSize={16}
        fontFamily="sans-serif"
        fill={defaultFill}
        opacity={shape.opacity}
        data-shape-id={shape.id}
      >
        Text
      </text>
    );
  }

  // Render each paragraph and its runs
  let yOffset = 0;
  const elements: React.ReactNode[] = [];

  content.children.forEach((para, pi) => {
    const textAlign = para.textAlign || "left";

    // Compute paragraph line height from first run
    const firstRun = para.children?.[0];
    const pFontSize = firstRun?.fontSize || 16;
    const pLineHeight = firstRun?.lineHeight
      ? firstRun.lineHeight
      : pFontSize * 1.4;

    if (pi > 0) yOffset += pLineHeight;

    // Compute anchor for text alignment
    let anchor: "start" | "middle" | "end" = "start";
    let xPos = shape.x;
    if (textAlign === "center") {
      anchor = "middle";
      xPos = shape.x + shape.width / 2;
    } else if (textAlign === "right") {
      anchor = "end";
      xPos = shape.x + shape.width;
    }

    // Check if paragraph is empty
    const paraText = para.children.map(r => r.text).join("");
    if (paraText === "" && pi > 0) {
      yOffset += pLineHeight;
      return;
    }

    // Render runs within this paragraph as tspans
    const tspans = para.children.map((run, ri) => {
      const fontSize = run.fontSize || pFontSize;
      const fontFamily = run.fontFamily || "sans-serif";
      const fontWeight = run.fontWeight || 400;
      const fontStyle = run.fontStyle || "normal";
      const letterSpacing = run.letterSpacing || 0;
      const runFill = run.fill || defaultFill;
      const textDecoration = run.textDecoration === "underline"
        ? "underline"
        : run.textDecoration === "line-through"
          ? "line-through"
          : "none";

      return (
        <tspan
          key={ri}
          fontFamily={fontFamily}
          fontSize={fontSize}
          fontWeight={fontWeight}
          fontStyle={fontStyle}
          fill={runFill}
          letterSpacing={letterSpacing}
          textDecoration={textDecoration !== "none" ? textDecoration : undefined}
        >
          {run.text}
        </tspan>
      );
    });

    elements.push(
      <text
        key={pi}
        x={xPos}
        y={shape.y + yOffset + pFontSize}
        textAnchor={anchor}
        fillOpacity={fillProps.fillOpacity}
        opacity={shape.opacity}
        data-shape-id={shape.id}
      >
        {tspans}
      </text>
    );

    yOffset += pLineHeight;
  });

  return <g data-shape-id={shape.id}>{elements}</g>;
});

// ── Image Shape ───────────────────────────────────────────────
const ImageShape = memo(function ImageShape({ shape }: { shape: PenpotShape }) {
  return (
    <image
      x={shape.x}
      y={shape.y}
      width={shape.width}
      height={shape.height}
      href={shape.imageMetadata?.url || ""}
      preserveAspectRatio="none"
      opacity={shape.opacity}
      data-shape-id={shape.id}
    />
  );
});

// ── Frame Shape (container with optional clip) ────────────────
export const FrameShape = memo(function FrameShape({
  shape,
  objects,
  isRoot = false,
}: {
  shape: PenpotShape;
  objects: Record<UUID, PenpotShape>;
  isRoot?: boolean;
}) {
  const fillProps = fillToSVG(shape.fills);
  const children = shape.shapes || [];
  const clipId = `clip-${shape.id}`;

  return (
    <g
      opacity={shape.opacity}
      data-shape-id={shape.id}
      transform={
        shape.rotation
          ? `rotate(${shape.rotation} ${shape.x + shape.width / 2} ${shape.y + shape.height / 2})`
          : undefined
      }
    >
      {/* Frame background */}
      {!isRoot && (
        <>
          {shape.showContent === false && (
            <defs>
              <clipPath id={clipId}>
                <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} />
              </clipPath>
            </defs>
          )}
          <rect
            x={shape.x}
            y={shape.y}
            width={shape.width}
            height={shape.height}
            {...fillProps}
            data-frame-bg={shape.id}
          />
        </>
      )}

      {/* Children */}
      <g clipPath={!isRoot && shape.showContent === false ? `url(#${clipId})` : undefined}>
        {children.map((childId) => {
          const child = objects[childId];
          if (!child || child.hidden) return null;
          return <ShapeWrapper key={childId} shape={child} objects={objects} />;
        })}
      </g>
    </g>
  );
});

// ── Group Shape ───────────────────────────────────────────────
const GroupShape = memo(function GroupShape({
  shape,
  objects,
}: {
  shape: PenpotShape;
  objects: Record<UUID, PenpotShape>;
}) {
  const children = shape.shapes || [];

  return (
    <g
      opacity={shape.opacity}
      data-shape-id={shape.id}
      transform={
        shape.rotation
          ? `rotate(${shape.rotation} ${shape.x + shape.width / 2} ${shape.y + shape.height / 2})`
          : undefined
      }
    >
      {children.map((childId) => {
        const child = objects[childId];
        if (!child || child.hidden) return null;
        return <ShapeWrapper key={childId} shape={child} objects={objects} />;
      })}
    </g>
  );
});

// ── Shape Wrapper (dispatches by type) ────────────────────────
export const ShapeWrapper = memo(function ShapeWrapper({
  shape,
  objects,
}: {
  shape: PenpotShape;
  objects: Record<UUID, PenpotShape>;
}) {
  if (shape.hidden) return null;

  const transform = shape.rotation
    ? `rotate(${shape.rotation} ${shape.x + shape.width / 2} ${shape.y + shape.height / 2})`
    : undefined;

  switch (shape.type) {
    case "frame":
      return <FrameShape shape={shape} objects={objects} />;
    case "group":
    case "bool":
      return <GroupShape shape={shape} objects={objects} />;
    case "rect":
      return <g transform={transform}><RectShape shape={shape} /></g>;
    case "circle":
      return <g transform={transform}><CircleShape shape={shape} /></g>;
    case "path":
      return <g transform={transform}><PathShape shape={shape} /></g>;
    case "text":
      return <g transform={transform}><TextShape shape={shape} /></g>;
    case "image":
      return <g transform={transform}><ImageShape shape={shape} /></g>;
    default:
      return <g transform={transform}><RectShape shape={shape} /></g>;
  }
});

// ── Root Shape Renderer ───────────────────────────────────────
export const RootShape = memo(function RootShape({
  objects,
}: {
  objects: Record<UUID, PenpotShape>;
}) {
  const root = objects[ROOT_FRAME_ID];
  if (!root) return null;

  return <FrameShape shape={root} objects={objects} isRoot />;
});

// ── Selection Handles ─────────────────────────────────────────
export const SelectionHandles = memo(function SelectionHandles({
  shapes,
  zoom,
}: {
  shapes: PenpotShape[];
  zoom: number;
}) {
  if (shapes.length === 0) return null;

  // Compute bounding box of all selected shapes
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of shapes) {
    minX = Math.min(minX, s.x);
    minY = Math.min(minY, s.y);
    maxX = Math.max(maxX, s.x + s.width);
    maxY = Math.max(maxY, s.y + s.height);
  }

  const handleSize = 8 / zoom;
  const strokeW = 1.5 / zoom;

  const handles = [
    { x: minX, y: minY, cursor: "nwse-resize", pos: "top-left" },
    { x: (minX + maxX) / 2, y: minY, cursor: "ns-resize", pos: "top" },
    { x: maxX, y: minY, cursor: "nesw-resize", pos: "top-right" },
    { x: maxX, y: (minY + maxY) / 2, cursor: "ew-resize", pos: "right" },
    { x: maxX, y: maxY, cursor: "nwse-resize", pos: "bottom-right" },
    { x: (minX + maxX) / 2, y: maxY, cursor: "ns-resize", pos: "bottom" },
    { x: minX, y: maxY, cursor: "nesw-resize", pos: "bottom-left" },
    { x: minX, y: (minY + maxY) / 2, cursor: "ew-resize", pos: "left" },
  ];

  return (
    <g className="selection-handles">
      {/* Selection outline */}
      <rect
        x={minX}
        y={minY}
        width={maxX - minX}
        height={maxY - minY}
        fill="none"
        stroke="#1592EC"
        strokeWidth={strokeW}
        pointerEvents="none"
      />
      {/* Handles */}
      {handles.map((h) => (
        <rect
          key={h.pos}
          x={h.x - handleSize / 2}
          y={h.y - handleSize / 2}
          width={handleSize}
          height={handleSize}
          fill="white"
          stroke="#1592EC"
          strokeWidth={strokeW}
          style={{ cursor: h.cursor }}
          data-handle={h.pos}
        />
      ))}
    </g>
  );
});

// ── Presence Cursors ──────────────────────────────────────────
export const PresenceCursors = memo(function PresenceCursors({
  presence,
  zoom,
}: {
  presence: Map<UUID, { profileId: UUID; profileName: string; profileColor: string; x: number; y: number }>;
  zoom: number;
}) {
  return (
    <g className="presence-cursors">
      {Array.from(presence.values()).map((p) => (
        <g key={p.profileId} transform={`translate(${p.x}, ${p.y})`}>
          {/* Cursor arrow */}
          <path
            d={`M 0 0 L ${6 / zoom} ${8 / zoom} L ${2 / zoom} ${7 / zoom} L ${3 / zoom} ${12 / zoom} L ${1 / zoom} ${12 / zoom} L 0 ${7 / zoom} L ${-3 / zoom} ${9 / zoom} Z`}
            fill={p.profileColor}
            stroke="white"
            strokeWidth={0.5 / zoom}
          />
          {/* Name label */}
          <rect
            x={8 / zoom}
            y={10 / zoom}
            width={Math.max(40, p.profileName.length * 6) / zoom}
            height={16 / zoom}
            rx={3 / zoom}
            fill={p.profileColor}
          />
          <text
            x={12 / zoom}
            y={20 / zoom}
            fontSize={10 / zoom}
            fill="white"
            fontFamily="sans-serif"
          >
            {p.profileName}
          </text>
        </g>
      ))}
    </g>
  );
});

// ── Frame Title ───────────────────────────────────────────────
export const FrameTitle = memo(function FrameTitle({
  shape,
  zoom,
}: {
  shape: PenpotShape;
  zoom: number;
}) {
  if (shape.type !== "frame" || shape.id === ROOT_FRAME_ID) return null;

  return (
    <text
      x={shape.x}
      y={shape.y - 8 / zoom}
      fontSize={11 / zoom}
      fill="#7B8794"
      fontFamily="sans-serif"
    >
      {shape.name}
    </text>
  );
});
