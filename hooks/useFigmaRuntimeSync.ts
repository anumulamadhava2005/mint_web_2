"use client";

// One-way sync: figmaStore canvas changes → runtime schema screens.
// Runs inside StudioShell. Does NOT sync runtime → canvas.

import { useEffect, useRef } from 'react';
import { useFigmaStore } from '@/lib/stores/figmaStore';
import { useRuntimeStore } from '@/lib/runtime/runtime-store';
import { figmaPageToScreenSchemas } from '@/lib/runtime/figmaToSchema';

export function useFigmaRuntimeSync() {
  const lastHashRef = useRef<string>('');

  useEffect(() => {
    const sync = () => {
      const { layers, activePageId, pages } = useFigmaStore.getState();
      const pageLayers = layers[activePageId] ?? [];

      // Cheap structural hash to avoid unnecessary work
      const hash = pageLayers
        .map(l => `${l.id}:${l.type}:${l.x}:${l.y}:${l.width}:${l.height}:${l.name}:${l.visible}`)
        .join('|');

      if (hash === lastHashRef.current) return;
      lastHashRef.current = hash;

      const page = pages.find(p => p.id === activePageId);
      if (!page) return;

      // Get top-level frames as screen candidates
      const frames = pageLayers.filter(
        l => l.type === 'frame' || l.type === 'component' || l.type === 'section'
      );

      // 1. Sync frame names/ids (lightweight, existing action)
      useRuntimeStore.getState().syncFromCanvas(
        frames.map(f => ({ id: f.id, name: f.name }))
      );

      // 2. Sync full component trees for each screen
      const newScreens = figmaPageToScreenSchemas(page, pageLayers);
      const runtimeStore = useRuntimeStore.getState();

      for (const screen of newScreens) {
        // updateScreen preserves localState/actions (it's a shallow merge via Object.assign)
        runtimeStore.updateScreen(screen.id, {
          components: screen.components,
          width: screen.width,
          height: screen.height,
          backgroundColor: screen.backgroundColor,
          route: screen.route,
          name: screen.name,
        });
      }
    };

    // Subscribe to figmaStore — fires on any state change
    const unsub = useFigmaStore.subscribe(sync);
    // Initial sync on mount
    sync();
    return unsub;
  }, []);
}
