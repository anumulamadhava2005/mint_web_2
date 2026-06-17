"use client";

import React, { useEffect, useState, useCallback } from "react";

// Toast shape matches the handler in lib/runtime/actions.ts L258-262
export interface Toast {
  id: number;
  message: string;
  type: "info" | "success" | "warning" | "error";
  duration: number;
}

interface ToastRendererProps {
  toasts: Toast[];
  onDismiss: (id: number) => void;
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
}

const TYPE_STYLES: Record<Toast["type"], { bg: string; border: string; icon: string }> = {
  info:    { bg: "#EFF6FF", border: "#3B82F6", icon: "ℹ" },
  success: { bg: "#F0FDF4", border: "#10B981", icon: "✓" },
  warning: { bg: "#FFFBEB", border: "#F59E0B", icon: "⚠" },
  error:   { bg: "#FEF2F2", border: "#EF4444", icon: "✕" },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const [exiting, setExiting] = useState(false);
  const style = TYPE_STYLES[toast.type] || TYPE_STYLES.info;

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 200);
  }, [toast.id, onDismiss]);

  useEffect(() => {
    if (toast.duration > 0) {
      const t = setTimeout(dismiss, toast.duration);
      return () => clearTimeout(t);
    }
  }, [toast.duration, dismiss]);

  return (
    <div
      role="alert"
      aria-live="polite"
      data-testid={`toast-${toast.id}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 16px",
        borderRadius: 8,
        borderLeft: `4px solid ${style.border}`,
        background: style.bg,
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        minWidth: 280,
        maxWidth: 420,
        opacity: exiting ? 0 : 1,
        transform: exiting ? "translateX(20px)" : "translateX(0)",
        transition: "opacity 200ms, transform 200ms",
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: 14,
        color: "#1F2937",
      }}
    >
      <span style={{ fontSize: 16, flexShrink: 0 }}>{style.icon}</span>
      <span style={{ flex: 1 }}>{toast.message}</span>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#9CA3AF",
          fontSize: 16,
          padding: 0,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}

const POSITION_MAP: Record<string, React.CSSProperties> = {
  "top-right":    { top: 16, right: 16 },
  "top-left":     { top: 16, left: 16 },
  "bottom-right": { bottom: 16, right: 16 },
  "bottom-left":  { bottom: 16, left: 16 },
};

export default function ToastRenderer({ toasts, onDismiss, position = "top-right" }: ToastRendererProps) {
  if (!toasts?.length) return null;

  return (
    <div
      data-testid="toast-container"
      style={{
        position: "fixed",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        ...POSITION_MAP[position],
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
