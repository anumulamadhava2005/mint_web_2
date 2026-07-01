"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useFigmaStore, type ToolType, type FigmaLayer } from '@/lib/stores/figmaStore';
import TopBar from './TopBar';
import ToolStrip from './ToolStrip';
import LeftPanel from './LeftPanel';
import Canvas from './Canvas';
import RightPanel from './RightPanel';
import PrototypePreview from './PrototypePreview';
import RuntimeEditorPreview from './RuntimeEditorPreview';
import PrototypeCanvas from './PrototypeCanvas';
import DevDatabaseStudio from './DevDatabaseStudio';
import FindReplacePanel from './FindReplacePanel';
import ShortcutsPanel from './ShortcutsPanel';
import { useFigmaCollaboration } from '@/hooks/useFigmaCollaboration';

interface Props {
  projectId?: string;
  embedded?: boolean;
  onExit?: () => void;
}

export default function FigmaEditor({ projectId, embedded, onExit }: Props) {
  const {
    selection, setActiveTool, setSelection, deleteLayer, duplicateLayer,
    setCopied, paste, bringForward, sendBackward, bringToFront, sendToBack,
    previewMode, setPreviewMode,
    livePreviewMode, setLivePreviewMode,
    undo, redo, canUndo, canRedo,
    toggleRulers, toggleGrid,
    loadFromServer, editorMode,
  } = useFigmaStore();

  const [showFind, setShowFind] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const { emitCursor, remoteCursors } = useFigmaCollaboration();

  // Load from server on mount when projectId is provided
  useEffect(() => {
    if (projectId) {
      loadFromServer(projectId);
    }
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Flush pending Redis-cached saves to PostgreSQL every 5 minutes
  useEffect(() => {
    if (!projectId) return;
    const flush = () =>
      fetch(`/api/figma-flush?projectId=${projectId}`, { method: 'POST' }).catch(() => {});
    const interval = setInterval(flush, 5 * 60 * 1000);
    // Also flush when the tab is about to unload
    const onUnload = () => navigator.sendBeacon(`/api/figma-flush?projectId=${projectId}`);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [projectId]);

  // Autosave: debounced 2s after any canvas or backend/logic mutation
  const layersRef = useRef(useFigmaStore.getState().layers);
  const apiSourcesRef = useRef(useFigmaStore.getState().apiSources);
  const globalStateVarsRef = useRef(useFigmaStore.getState().globalStateVars);
  const actionFlowsRef = useRef(useFigmaStore.getState().actionFlows);
  const databaseRef = useRef(useFigmaStore.getState().database);
  const authRef = useRef(useFigmaStore.getState().auth);
  const navigationRef = useRef(useFigmaStore.getState().navigation);
  const appWorkflowsRef = useRef(useFigmaStore.getState().appWorkflows);
  useEffect(() => {
    if (!projectId) return;
    let timer: ReturnType<typeof setTimeout>;
    const unsub = useFigmaStore.subscribe((state) => {
      const changed =
        state.layers !== layersRef.current ||
        state.apiSources !== apiSourcesRef.current ||
        state.globalStateVars !== globalStateVarsRef.current ||
        state.actionFlows !== actionFlowsRef.current ||
        state.database !== databaseRef.current ||
        state.auth !== authRef.current ||
        state.navigation !== navigationRef.current ||
        state.appWorkflows !== appWorkflowsRef.current;
      if (changed) {
        layersRef.current = state.layers;
        apiSourcesRef.current = state.apiSources;
        globalStateVarsRef.current = state.globalStateVars;
        actionFlowsRef.current = state.actionFlows;
        databaseRef.current = state.database;
        authRef.current = state.auth;
        navigationRef.current = state.navigation;
        appWorkflowsRef.current = state.appWorkflows;
        clearTimeout(timer);
        timer = setTimeout(() => useFigmaStore.getState().saveToServer(), 2000);
      }
    });
    return () => { unsub(); clearTimeout(timer); };
  }, [projectId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && previewMode) {
        e.preventDefault();
        setPreviewMode(false);
        return;
      }

      const target = e.target as HTMLElement;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.contentEditable === 'true' ||
        target.isContentEditable
      ) return;

      const toolMap: Record<string, ToolType> = {
        v: 'select', k: 'scale', f: 'frame', r: 'rect', o: 'ellipse',
        l: 'line', p: 'pen', t: 'text', i: 'input', h: 'hand', c: 'comment',
      };

      const key = e.key.toLowerCase();

      if (toolMap[key] && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setActiveTool(toolMap[key]);
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        setActiveTool('select');
        setSelection([]);
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selection.length > 0) {
        e.preventDefault();
        selection.forEach(id => deleteLayer(id));
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        selection.forEach(id => duplicateLayer(id));
        return;
      }

      // Ctrl+] / Ctrl+[ — z-order within the layer's siblings (Shift = front/back)
      if ((e.ctrlKey || e.metaKey) && (e.key === ']' || e.key === '[')) {
        e.preventDefault();
        const forward = e.key === ']';
        selection.forEach(id => {
          if (e.shiftKey) (forward ? bringToFront : sendToBack)(id);
          else (forward ? bringForward : sendBackward)(id);
        });
        return;
      }

      // Ctrl+C — copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !e.shiftKey) {
        e.preventDefault();
        const { layers, activePageId, selection: sel } = useFigmaStore.getState();
        const curLayers = layers[activePageId] ?? [];
        const toCopy = curLayers.filter(l => sel.includes(l.id));
        if (toCopy.length) setCopied(toCopy);
        return;
      }

      // Ctrl+V — paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !e.shiftKey) {
        e.preventDefault();
        paste();
        return;
      }

      // Ctrl+Shift+] — bring to front
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === ']') {
        e.preventDefault();
        selection.forEach(id => bringToFront(id));
        return;
      }

      // Ctrl+Shift+[ — send to back
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '[') {
        e.preventDefault();
        selection.forEach(id => sendToBack(id));
        return;
      }

      // Ctrl+] — bring forward
      if ((e.ctrlKey || e.metaKey) && e.key === ']' && !e.shiftKey) {
        e.preventDefault();
        selection.forEach(id => bringForward(id));
        return;
      }

      // Ctrl+[ — send backward
      if ((e.ctrlKey || e.metaKey) && e.key === '[' && !e.shiftKey) {
        e.preventDefault();
        selection.forEach(id => sendBackward(id));
        return;
      }

      // Ctrl+Z — undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Ctrl+Shift+Z or Ctrl+Y — redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }

      // Ctrl+F — find/replace
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowFind(f => !f);
        return;
      }

      // ? — keyboard shortcuts panel
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowShortcuts(s => !s);
        return;
      }

      // Shift+1 — zoom to fit
      if (e.shiftKey && e.key === '1') {
        e.preventDefault();
        const { layers, activePageId, setViewport } = useFigmaStore.getState();
        const pageLayers = layers[activePageId] ?? [];
        if (pageLayers.length === 0) { setViewport({ x: 0, y: 0, zoom: 1 }); return; }
        const xs = pageLayers.flatMap(l => [l.x, l.x + l.width]);
        const ys = pageLayers.flatMap(l => [l.y, l.y + l.height]);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const W = window.innerWidth - 480, H = window.innerHeight - 44;
        const zoom = Math.min(1, (W / (maxX - minX)) * 0.85, (H / (maxY - minY)) * 0.85);
        const x = (W - (maxX - minX) * zoom) / 2 - minX * zoom;
        const y = (H - (maxY - minY) * zoom) / 2 - minY * zoom;
        setViewport({ x, y, zoom });
        return;
      }

      // Ctrl+' — toggle grid
      if ((e.ctrlKey || e.metaKey) && e.key === "'") {
        e.preventDefault();
        toggleGrid();
        return;
      }

      // Ctrl+R — toggle rulers
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        toggleRulers();
        return;
      }

      // Shift+A — toggle auto layout on selected frame/component/instance
      if (e.shiftKey && e.key.toLowerCase() === 'a' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const { layers, activePageId, selection: sel, setAutoLayout } = useFigmaStore.getState();
        const pageLayers = layers[activePageId] ?? [];
        const findLayer = (arr: FigmaLayer[]): FigmaLayer | null => {
          for (const l of arr) {
            if (sel.includes(l.id)) return l;
            if (l.children) { const f = findLayer(l.children); if (f) return f; }
          }
          return null;
        };
        sel.forEach(id => {
          const findById = (arr: FigmaLayer[]): FigmaLayer | null => {
            for (const l of arr) {
              if (l.id === id) return l;
              if (l.children) { const f = findById(l.children); if (f) return f; }
            }
            return null;
          };
          const layer = findById(pageLayers);
          if (!layer) return;
          if (layer.type === 'frame' || layer.type === 'component' || layer.type === 'instance') {
            if (layer.autoLayout) {
              setAutoLayout(id, null);
            } else {
              setAutoLayout(id, {
                direction: 'horizontal', gap: 8,
                paddingTop: 8, paddingRight: 8, paddingBottom: 8, paddingLeft: 8,
                primaryAlign: 'start', counterAlign: 'start',
                widthMode: 'fixed', heightMode: 'fixed', wrap: false,
              });
            }
          }
        });
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selection, setActiveTool, setSelection, deleteLayer, duplicateLayer, setCopied, paste, bringForward, sendBackward, bringToFront, sendToBack, previewMode, setPreviewMode, undo, redo, canUndo, canRedo, toggleRulers, toggleGrid]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: embedded ? '100%' : '100vw',
      height: embedded ? '100%' : '100vh',
      background: '#1e1e1e',
      overflow: 'hidden',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize: 12,
      color: '#ebebeb',
    }}>
      <TopBar onExit={onExit} />
      {editorMode === 'dev' ? (
        <DevDatabaseStudio projectId={projectId} />
      ) : (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <ToolStrip />
          <LeftPanel />
          {editorMode === 'prototype'
            ? <PrototypeCanvas />
            : <Canvas remoteCursors={remoteCursors} emitCursor={emitCursor} />
          }
          <RightPanel />
        </div>
      )}
      {previewMode && <PrototypePreview onClose={() => setPreviewMode(false)} />}
      {livePreviewMode && <RuntimeEditorPreview projectId={projectId} onClose={() => setLivePreviewMode(false)} />}
      {showFind && <FindReplacePanel onClose={() => setShowFind(false)} />}
      {showShortcuts && <ShortcutsPanel onClose={() => setShowShortcuts(false)} />}
    </div>
  );
}
