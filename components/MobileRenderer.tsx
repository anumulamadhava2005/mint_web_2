// ═══════════════════════════════════════════════════════════════
// MobileRenderer — Dynamic runtime renderer for mobile configs
//
// Interprets MobileConfig JSON and renders components dynamically.
// No hardcoded UI — everything is driven by the config.
// ═══════════════════════════════════════════════════════════════
"use client";

import React, { useState, useCallback, useMemo } from "react";
import type {
  MobileConfig,
  MobileScreen,
  MobileComponent,
  MobileAction,
  MobileStyle,
  TextProps,
  ButtonProps,
  ImageProps,
} from "@/lib/mobileConfig";

interface MobileRendererProps {
  config: MobileConfig;
  initialScreenId?: string;
  deviceWidth?: number;
  deviceHeight?: number;
}

export default function MobileRenderer({
  config,
  initialScreenId,
  deviceWidth = 375,
  deviceHeight = 812,
}: MobileRendererProps) {
  // Navigation state
  const [screenStack, setScreenStack] = useState<string[]>(() => {
    // Start with flow's start screen, or first screen, or initialScreenId
    const startId =
      initialScreenId ||
      config.flows?.[0]?.startScreenId ||
      config.screens?.[0]?.id ||
      "";
    return [startId];
  });

  const currentScreenId = screenStack[screenStack.length - 1];
  const currentScreen = config.screens.find((s) => s.id === currentScreenId);

  // Navigation handler
  const handleAction = useCallback(
    (action: MobileAction) => {
      switch (action.type) {
        case "navigate":
          if (action.target) {
            setScreenStack((prev) => [...prev, action.target!]);
          }
          break;
        case "go-back":
          setScreenStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
          break;
        case "open-url":
          if (action.target) {
            window.open(action.target, "_blank");
          }
          break;
      }
    },
    []
  );

  // Scale factor to fit device frame
  const scale = useMemo(() => {
    if (!currentScreen) return 1;
    return Math.min(
      deviceWidth / currentScreen.width,
      deviceHeight / currentScreen.height,
      1
    );
  }, [currentScreen, deviceWidth, deviceHeight]);

  if (!currentScreen) {
    return (
      <div className="flex h-full w-full items-center justify-center text-zinc-500">
        <div className="text-center">
          <p className="text-lg font-medium">No screens available</p>
          <p className="mt-1 text-sm">Commit a design from the editor to see it here</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: currentScreen.width * scale,
        height: currentScreen.height * scale,
        backgroundColor: currentScreen.backgroundColor,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
      }}
    >
      {currentScreen.components.map((component) => (
        <RenderComponent
          key={component.id}
          component={component}
          onAction={handleAction}
          parentX={0}
          parentY={0}
        />
      ))}
    </div>
  );
}

// ── Recursive component renderer ──────────────────────────────

function RenderComponent({
  component,
  onAction,
  parentX,
  parentY,
}: {
  component: MobileComponent;
  onAction: (action: MobileAction) => void;
  parentX: number;
  parentY: number;
}) {
  const style = buildCSSStyle(component.style, parentX, parentY);

  const handleClick = component.action
    ? (e: React.MouseEvent) => {
        e.stopPropagation();
        onAction(component.action!);
      }
    : undefined;

  const Wrapper = component.action ? "button" : "div";

  switch (component.type) {
    case "Text":
      return (
        <Wrapper
          style={style}
          onClick={handleClick}
          className={component.action ? "cursor-pointer" : ""}
        >
          <TextComponent props={component.props as TextProps} />
        </Wrapper>
      );

    case "Button":
      return (
        <button
          style={{
            ...style,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={handleClick}
        >
          <ButtonComponent props={component.props as ButtonProps} />
        </button>
      );

    case "Image":
      return (
        <Wrapper style={style} onClick={handleClick}>
          <ImageComponent props={component.props as ImageProps} />
        </Wrapper>
      );

    case "Ellipse":
      return (
        <Wrapper
          style={{
            ...style,
            borderRadius: "50%",
          }}
          onClick={handleClick}
        >
          {component.children?.map((child) => (
            <RenderComponent
              key={child.id}
              component={child}
              onAction={onAction}
              parentX={component.style.x}
              parentY={component.style.y}
            />
          ))}
        </Wrapper>
      );

    case "Container":
    case "ScrollView":
    default:
      return (
        <Wrapper
          style={{
            ...style,
            overflow: component.type === "ScrollView" ? "auto" : style.overflow,
          }}
          onClick={handleClick}
          className={component.action ? "cursor-pointer" : ""}
        >
          {component.children?.map((child) => (
            <RenderComponent
              key={child.id}
              component={child}
              onAction={onAction}
              parentX={component.style.x}
              parentY={component.style.y}
            />
          ))}
        </Wrapper>
      );
  }
}

// ── Individual component renderers ────────────────────────────

function TextComponent({ props }: { props: TextProps }) {
  return (
    <span
      style={{
        fontSize: props.fontSize || 16,
        fontWeight: props.fontWeight || 400,
        fontFamily: props.fontFamily || "Inter, system-ui, sans-serif",
        fontStyle: props.fontStyle || "normal",
        color: props.color || "#000000",
        textAlign: props.textAlign || "left",
        textDecoration: props.textDecoration || "none",
        letterSpacing: props.letterSpacing ? `${props.letterSpacing}px` : undefined,
        lineHeight: props.lineHeight ? `${props.lineHeight}` : undefined,
        display: "block",
        width: "100%",
        height: "100%",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {props.value}
    </span>
  );
}

function ButtonComponent({ props }: { props: ButtonProps }) {
  return (
    <span
      style={{
        fontSize: props.fontSize || 16,
        fontWeight: props.fontWeight || 600,
        fontFamily: props.fontFamily || "Inter, system-ui, sans-serif",
        color: props.color || "#FFFFFF",
      }}
    >
      {props.label}
    </span>
  );
}

function ImageComponent({ props }: { props: ImageProps }) {
  if (!props.src) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#E5E7EB",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={props.src}
      alt={props.alt || ""}
      style={{
        width: "100%",
        height: "100%",
        objectFit: props.objectFit || "cover",
      }}
    />
  );
}

// ── CSS style builder ─────────────────────────────────────────

function buildCSSStyle(
  ms: MobileStyle,
  parentX: number,
  parentY: number
): React.CSSProperties {
  const style: React.CSSProperties = {
    position: "absolute",
    left: ms.x - parentX,
    top: ms.y - parentY,
    width: ms.width,
    height: ms.height,
  };

  if (ms.rotation) {
    style.transform = `rotate(${ms.rotation}deg)`;
  }
  if (ms.opacity !== undefined) {
    style.opacity = ms.opacity;
  }
  if (ms.backgroundColor) {
    style.backgroundColor = ms.backgroundColor;
  }
  if (ms.backgroundGradient) {
    const g = ms.backgroundGradient;
    const stops = g.colors.map((c, i) => `${c} ${(g.stops[i] || 0) * 100}%`).join(", ");
    style.background =
      g.type === "linear"
        ? `linear-gradient(to bottom, ${stops})`
        : `radial-gradient(circle, ${stops})`;
  }
  if (ms.borderRadius !== undefined) {
    style.borderRadius = ms.borderRadius;
  }
  if (ms.borderColor && ms.borderWidth) {
    style.border = `${ms.borderWidth}px solid ${ms.borderColor}`;
  }
  if (ms.overflow) {
    style.overflow = ms.overflow;
  }

  // Flex layout
  if (ms.flexDirection) {
    style.display = "flex";
    style.flexDirection = ms.flexDirection;
    style.position = "absolute"; // keep absolute for positioning
  }
  if (ms.justifyContent) style.justifyContent = ms.justifyContent;
  if (ms.alignItems) style.alignItems = ms.alignItems;
  if (ms.gap) style.gap = ms.gap;
  if (ms.flexWrap) style.flexWrap = ms.flexWrap;
  if (ms.padding) {
    style.padding = `${ms.padding.top}px ${ms.padding.right}px ${ms.padding.bottom}px ${ms.padding.left}px`;
  }

  // Shadows
  if (ms.shadow && ms.shadow.length > 0) {
    const shadows = ms.shadow
      .map((s) => {
        const inset = s.type === "inner" ? "inset " : "";
        return `${inset}${s.offsetX}px ${s.offsetY}px ${s.blur}px ${s.spread}px ${s.color}`;
      })
      .join(", ");
    style.boxShadow = shadows;
  }

  return style;
}

// ── Screen navigation bar (for multi-screen previews) ─────────

export function ScreenNavigator({
  screens,
  currentScreenId,
  onNavigate,
}: {
  screens: MobileScreen[];
  currentScreenId: string;
  onNavigate: (screenId: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 p-2">
      {screens.map((screen) => (
        <button
          key={screen.id}
          onClick={() => onNavigate(screen.id)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            screen.id === currentScreenId
              ? "bg-indigo-600 text-white"
              : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
          }`}
        >
          {screen.name}
        </button>
      ))}
    </div>
  );
}
