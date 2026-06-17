"use client";

import React, { useEffect, useState, useCallback } from "react";
import ToastRenderer, { type Toast } from "./ToastRenderer";

/**
 * Global toast provider — mounts at app root.
 * Listens for custom "mint:toast" events dispatched by the runtime action handler,
 * or can be used via window.__mintToast(toast) for direct integration.
 */
export default function ToastProvider() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    setToasts((prev) => [...prev, { ...toast, id: Date.now() + Math.random() }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    // Expose globally for runtime bridge
    (window as unknown as Record<string, unknown>).__mintToast = addToast;

    // Listen for custom events
    const handler = (e: CustomEvent<Omit<Toast, "id">>) => addToast(e.detail);
    window.addEventListener("mint:toast", handler as EventListener);

    return () => {
      window.removeEventListener("mint:toast", handler as EventListener);
      delete (window as unknown as Record<string, unknown>).__mintToast;
    };
  }, [addToast]);

  return <ToastRenderer toasts={toasts} onDismiss={dismissToast} />;
}
