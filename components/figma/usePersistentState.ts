"use client";

import { useEffect, useState } from "react";

// localStorage-backed state for the Database Studio's transient UI (active view,
// selected table, SQL editor text). Keyed per-project so it survives switching
// studio tabs, reopening the Dev tab, and full page reloads / new browser tabs.
//
// The Dev studio only ever renders client-side (the editor mounts after the
// project id resolves), so reading localStorage in the lazy initializer is
// safe — there is no server render to mismatch against.
export function usePersistentState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(key);
      return raw != null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  // Writing to an external store (localStorage) is the intended use of an effect.
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* quota / private mode — ignore */
    }
  }, [key, state]);

  return [state, setState] as const;
}
