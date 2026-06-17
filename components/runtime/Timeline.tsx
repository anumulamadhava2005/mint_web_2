"use client";

import React, { useMemo } from "react";
import { TimelineEngine } from "@/lib/runtime/components/timeline";
import type { TimelineConfig } from "@/lib/runtime/components/configs";
import type { TimelineItem } from "@/lib/runtime/components/timeline";

interface TimelineProps {
  config: TimelineConfig;
  data: Record<string, unknown>[];
  activeStepValue?: unknown;
}

const STATUS_COLORS: Record<TimelineItem["status"], { dot: string; line: string; text: string }> = {
  completed: { dot: "#10B981", line: "#10B981", text: "#065F46" },
  active:    { dot: "#3B82F6", line: "#93C5FD", text: "#1E40AF" },
  pending:   { dot: "#D1D5DB", line: "#E5E7EB", text: "#9CA3AF" },
  failed:    { dot: "#EF4444", line: "#FCA5A5", text: "#991B1B" },
  skipped:   { dot: "#9CA3AF", line: "#E5E7EB", text: "#9CA3AF" },
};

const STATUS_ICONS: Record<TimelineItem["status"], string> = {
  completed: "✓",
  active: "●",
  pending: "○",
  failed: "✕",
  skipped: "—",
};

export default function Timeline({ config, data, activeStepValue }: TimelineProps) {
  const engine = useMemo(() => new TimelineEngine(config), [config]);
  const result = engine.process(data, activeStepValue);

  if (config.orientation === "horizontal") {
    return <HorizontalTimeline items={result.items} connectorStyle={config.connectorStyle} />;
  }

  return (
    <div data-testid="timeline" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {result.items.map((item, idx) => {
        const colors = STATUS_COLORS[item.status];
        const isLast = idx === result.items.length - 1;

        return (
          <div key={item.key} style={{ display: "flex", gap: 14, minHeight: isLast ? "auto" : 64 }}>
            {/* Dot + connector */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 24, flexShrink: 0 }}>
              <div
                style={{
                  width: item.status === "active" ? 28 : 22,
                  height: item.status === "active" ? 28 : 22,
                  borderRadius: "50%",
                  background: colors.dot,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: 12,
                  fontWeight: 700,
                  boxShadow: item.status === "active" ? `0 0 0 4px ${colors.dot}33` : "none",
                  transition: "all 200ms",
                }}
              >
                {STATUS_ICONS[item.status]}
              </div>
              {!isLast && (
                <div
                  style={{
                    flex: 1,
                    width: 2,
                    background: colors.line,
                    borderStyle: config.connectorStyle === "dashed" ? "dashed" : "solid",
                    minHeight: 24,
                  }}
                />
              )}
            </div>

            {/* Content */}
            <div style={{ paddingBottom: isLast ? 0 : 16, flex: 1, paddingTop: 1 }}>
              <div
                style={{
                  fontWeight: item.status === "active" ? 600 : 500,
                  fontSize: 14,
                  color: colors.text,
                }}
              >
                {item.title}
              </div>
              {item.subtitle && (
                <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>
                  {item.subtitle}
                </div>
              )}
              {item.timestamp && (
                <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>
                  {item.timestamp}
                </div>
              )}
              {item.comment && (
                <div
                  style={{
                    marginTop: 6,
                    padding: "6px 10px",
                    background: "#F9FAFB",
                    borderRadius: 6,
                    fontSize: 13,
                    color: "#4B5563",
                    borderLeft: "3px solid #E5E7EB",
                  }}
                >
                  {item.comment}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HorizontalTimeline({
  items,
  connectorStyle,
}: {
  items: TimelineItem[];
  connectorStyle?: "solid" | "dashed";
}) {
  return (
    <div
      data-testid="timeline-horizontal"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 0,
        overflowX: "auto",
        padding: "8px 0",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {items.map((item, idx) => {
        const colors = STATUS_COLORS[item.status];
        const isLast = idx === items.length - 1;

        return (
          <div key={item.key} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 80 }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: colors.dot,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                {STATUS_ICONS[item.status]}
              </div>
              <div style={{ fontSize: 11, color: colors.text, marginTop: 6, textAlign: "center", fontWeight: 500 }}>
                {item.title}
              </div>
            </div>
            {!isLast && (
              <div
                style={{
                  width: 40,
                  height: 2,
                  background: colors.line,
                  borderStyle: connectorStyle === "dashed" ? "dashed" : "solid",
                  marginTop: -20,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
