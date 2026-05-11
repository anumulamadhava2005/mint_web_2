// ═══════════════════════════════════════════════════════════════
// SVG Viewport — Two-layer SVG canvas (render + controls)
// Mirrors: frontend/src/app/main/ui/workspace/viewport.cljs
// ═══════════════════════════════════════════════════════════════
"use client";

import React, { useRef, useEffect, useCallback, useState, memo } from "react";
import { useWorkspaceStore } from "@/lib/penpot/store";
import { usePenpotCollaboration } from "@/hooks/usePenpotCollaboration";
import {
  RootShape,
  SelectionHandles,
  PresenceCursors,
  FrameTitle,
} from "./ShapeRenderers";
import { ROOT_FRAME_ID } from "@/lib/penpot/types";
import type { UUID, PenpotShape, ShapeKind, Point } from "@/lib/penpot/types";
import {
  formatViewbox,
  zoomFromViewbox,
  screenToWorld,
  zoomAtScreenPoint,
  type Viewbox,
} from "@/lib/penpot/geom";
import { snapMove, snapResize, type SnapGuide } from "@/lib/penpot/snapping";

/**
 * Create a shallow overlay of the objects map where the dragged shapes
 * are at their *original* pre-drag positions. This way `snapMove` can
 * compute snap using (originalPos + totalDelta) without double-counting
 * the movement that already happened via `updateShapeDirect`.
 *
 * We use a plain object spread instead of a Proxy because immer/Zustand
 * freezes store objects (non-writable, non-configurable), and a Proxy
 * `get` trap that returns a different value for such properties is a
 * spec violation (throws TypeError).
 */
function patchedObjectsForSnap(
  objects: Record<UUID, PenpotShape>,
  originals: Record<UUID, { x: number; y: number; width: number; height: number }>,
): Record<UUID, PenpotShape> {
  const patched = { ...objects };
  for (const id of Object.keys(originals)) {
    const shape = patched[id];
    if (shape) {
      const o = originals[id];
      patched[id] = { ...shape, x: o.x, y: o.y, width: o.width, height: o.height };
    }
  }
  return patched;
}

/**
 * Collect all descendant shape IDs of a given shape (recursive).
 * Used to move children together with their parent frame/group.
 */
function collectDescendantIds(
  id: UUID,
  objects: Record<UUID, PenpotShape>,
): UUID[] {
  const result: UUID[] = [];
  const walk = (parentId: UUID) => {
    const shape = objects[parentId];
    if (!shape?.shapes) return;
    for (const childId of shape.shapes) {
      result.push(childId);
      walk(childId);
    }
  };
  walk(id);
  return result;
}

// ── Auto-parenting: find deepest frame containing a point ───
function findDropTargetFrame(
  cx: number,
  cy: number,
  excludeIds: UUID[],
  objects: Record<UUID, PenpotShape>
): UUID {
  // Build exclusion set (dragged shapes + all their descendants)
  const excludeSet = new Set<UUID>();
  const addDescendants = (id: UUID) => {
    excludeSet.add(id);
    const shape = objects[id];
    if (shape?.shapes) {
      for (const childId of shape.shapes) addDescendants(childId);
    }
  };
  for (const id of excludeIds) addDescendants(id);

  // Depth-first search — keep track of deepest qualifying frame
  let deepestFrame: UUID = ROOT_FRAME_ID;

  const search = (ids: UUID[]) => {
    for (const id of ids) {
      if (excludeSet.has(id)) continue;
      const shape = objects[id];
      if (!shape || shape.hidden || shape.locked) continue;

      if (
        shape.type === "frame" &&
        cx >= shape.x &&
        cx <= shape.x + shape.width &&
        cy >= shape.y &&
        cy <= shape.y + shape.height
      ) {
        deepestFrame = shape.id;
        // Recurse into children to find a deeper nested frame
        if (shape.shapes) search(shape.shapes);
      }
    }
  };

  const root = objects[ROOT_FRAME_ID];
  if (root?.shapes) search(root.shapes);

  return deepestFrame;
}

// ── Props ─────────────────────────────────────────────────────
interface ViewportProps {
  fileId: UUID;
}

// ── Main Viewport Component ───────────────────────────────────
function SVGViewportInner({ fileId }: ViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderSvgRef = useRef<SVGSVGElement>(null);

  // Store state
  const file = useWorkspaceStore((s) => s.file);
  const currentPageId = useWorkspaceStore((s) => s.currentPageId);
  const local = useWorkspaceStore((s) => s.local);
  const optionsMode = useWorkspaceStore((s) => s.optionsMode);
  const showRulers = useWorkspaceStore((s) => s.showRulers);
  const showGrid = useWorkspaceStore((s) => s.showGrid);
  const snapToObjects = useWorkspaceStore((s) => s.snapToObjects);
  const snapToGrid = useWorkspaceStore((s) => s.snapToGrid);
  const presence = useWorkspaceStore((s) => s.presence);

  // Store actions
  const {
    setViewbox,
    setViewport,
    setZoom,
    setPanning,
    selectShape,
    deselectAll,
    addShape,
    updateShape,
    updateShapeDirect,
    commitShapeChanges,
    deleteShapes,
    moveShapes,
    setHoveredShape,
    setTransform,
    setDrawing,
    setEdition,
    setSelectionRect,
    undo,
    redo,
    copyShapes,
    pasteShapes,
    groupShapes,
    ungroupShapes,
    bringToFront,
    bringForward,
    sendBackward,
    sendToBack,
    nudgeShapes,
    toggleLocked,
    toggleHidden,
    saveFile,
  } = useWorkspaceStore();

  // Collaboration
  const { sendCursorPosition, sendSelectionChange, sendViewportChange } =
    usePenpotCollaboration(fileId);

  // Derive current page objects
  const pageObjects = useWorkspaceStore((s) => {
    if (!s.file || !s.currentPageId) return {};
    return s.file.pagesIndex[s.currentPageId]?.objects || {};
  });

  // Interaction state
  const [isPanning, setIsPanning] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [drawStart, setDrawStart] = useState<Point | null>(null);
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 });
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{
    shapes: Record<UUID, { x: number; y: number; width: number; height: number }>;
    worldStart: Point;
  } | null>(null);

  // Space key for pan
  const [spaceHeld, setSpaceHeld] = useState(false);

  // Auto-parenting: frame currently highlighted as drop target during drag
  const [dropTargetId, setDropTargetId] = useState<UUID | null>(null);

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; worldX: number; worldY: number } | null>(null);

  // Snap guides to render
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);

  // Accumulated world-space delta since drag started (for snap accumulation)
  const dragAccum = useRef<Point>({ x: 0, y: 0 });

  // Refs for buffered drag/resize (stores original shape positions for single undo entry)
  const dragOriginals = useRef<Record<UUID, { x: number; y: number; width: number; height: number }>>({});

  // ── Resize observer ───────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setViewport({ width, height });
      // Read current zoom/vbox from store to avoid stale closure
      const state = useWorkspaceStore.getState();
      const currentZoom = state.local.vport.width / state.local.vbox.width;
      setViewbox({
        ...state.local.vbox,
        width: width / currentZoom,
        height: height / currentZoom,
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;

      const mod = e.metaKey || e.ctrlKey;

      if (e.key === " ") {
        e.preventDefault();
        setSpaceHeld(true);
      }

      // Delete / Backspace → Delete selected
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        const selected = Array.from(local.selected);
        if (selected.length > 0) deleteShapes(selected);
      }

      // Ctrl+Z → Undo
      if (mod && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Ctrl+Shift+Z → Redo
      if (mod && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      }
      // Ctrl+D → Duplicate
      if (mod && e.key === "d") {
        e.preventDefault();
        const selected = Array.from(local.selected);
        if (selected.length > 0) {
          useWorkspaceStore.getState().duplicateShapes(selected);
        }
      }
      // Ctrl+A → Select all
      if (mod && e.key === "a") {
        e.preventDefault();
        useWorkspaceStore.getState().selectAll();
      }
      // Ctrl+C → Copy
      if (mod && e.key === "c" && !e.shiftKey) {
        e.preventDefault();
        copyShapes();
      }
      // Ctrl+V → Paste
      if (mod && e.key === "v" && !e.shiftKey) {
        e.preventDefault();
        pasteShapes();
      }
      // Ctrl+X → Cut (copy + delete)
      if (mod && e.key === "x") {
        e.preventDefault();
        copyShapes();
        const selected = Array.from(useWorkspaceStore.getState().local.selected);
        if (selected.length > 0) deleteShapes(selected);
      }
      // Ctrl+G → Group
      if (mod && e.key === "g" && !e.shiftKey) {
        e.preventDefault();
        const selected = Array.from(local.selected);
        if (selected.length >= 2) groupShapes(selected);
      }
      // Ctrl+Shift+G → Ungroup
      if (mod && e.key === "g" && e.shiftKey) {
        e.preventDefault();
        const selected = Array.from(local.selected);
        if (selected.length > 0) ungroupShapes(selected);
      }
      // Ctrl+S → Save
      if (mod && e.key === "s") {
        e.preventDefault();
        saveFile();
      }
      // Ctrl+] → Bring Forward
      if (mod && e.key === "]") {
        e.preventDefault();
        const selected = Array.from(local.selected);
        if (e.shiftKey) {
          bringToFront(selected);
        } else {
          bringForward(selected);
        }
      }
      // Ctrl+[ → Send Backward
      if (mod && e.key === "[") {
        e.preventDefault();
        const selected = Array.from(local.selected);
        if (e.shiftKey) {
          sendToBack(selected);
        } else {
          sendBackward(selected);
        }
      }
      // Ctrl+0 → Zoom to fit
      if (mod && e.key === "0") {
        e.preventDefault();
        const state = useWorkspaceStore.getState();
        setViewbox({ x: -100, y: -100, width: state.local.vport.width, height: state.local.vport.height });
        setZoom(1);
      }
      // + / = → Zoom in (with or without Ctrl)
      if (e.key === "+" || e.key === "=" || (mod && (e.key === "+" || e.key === "="))) {
        e.preventDefault();
        const state = useWorkspaceStore.getState();
        const currentZoom = state.local.vport.width / state.local.vbox.width;
        const newZoom = Math.min(64, currentZoom * 1.2);
        const cx = state.local.vbox.x + state.local.vbox.width / 2;
        const cy = state.local.vbox.y + state.local.vbox.height / 2;
        const newW = state.local.vport.width / newZoom;
        const newH = state.local.vport.height / newZoom;
        setViewbox({ x: cx - newW / 2, y: cy - newH / 2, width: newW, height: newH });
        setZoom(newZoom);
      }
      // - → Zoom out (with or without Ctrl)
      if (e.key === "-" || (mod && e.key === "-")) {
        e.preventDefault();
        const state = useWorkspaceStore.getState();
        const currentZoom = state.local.vport.width / state.local.vbox.width;
        const newZoom = Math.max(0.1, currentZoom / 1.2);
        const cx = state.local.vbox.x + state.local.vbox.width / 2;
        const cy = state.local.vbox.y + state.local.vbox.height / 2;
        const newW = state.local.vport.width / newZoom;
        const newH = state.local.vport.height / newZoom;
        setViewbox({ x: cx - newW / 2, y: cy - newH / 2, width: newW, height: newH });
        setZoom(newZoom);
      }

      // Escape
      if (e.key === "Escape") {
        deselectAll();
        setDrawing(null);
        setContextMenu(null);
      }

      // Tool shortcuts (only when no modifier key)
      if (!mod && !e.shiftKey) {
        if (e.key === "v" || e.key === "V") setDrawing(null);
        if (e.key === "r" || e.key === "R") setDrawing("rect");
        if (e.key === "o" || e.key === "O") setDrawing("circle");
        if (e.key === "t" || e.key === "T") setDrawing("text");
        if (e.key === "f" || e.key === "F") setDrawing("frame");
        if (e.key === "p" || e.key === "P") setDrawing("path");
      }

      // Arrow keys → Nudge shapes
      if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const selected = Array.from(local.selected);
        if (selected.length > 0) {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
          const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
          nudgeShapes(selected, dx, dy);
        }
      }

      // Toggle snapping (Ctrl+Shift+')
      if (mod && e.shiftKey && e.key === "'") {
        e.preventDefault();
        useWorkspaceStore.getState().toggleSnapToObjects();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === " ") setSpaceHeld(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [local.selected, deleteShapes, undo, redo, deselectAll, setDrawing, copyShapes, pasteShapes, groupShapes, ungroupShapes, saveFile, bringForward, bringToFront, sendBackward, sendToBack, nudgeShapes, setViewbox, setZoom]);

  // ── Hit testing ───────────────────────────────────────────
  const hitTestShapes = useCallback(
    (worldP: Point): PenpotShape | null => {
      const root = pageObjects[ROOT_FRAME_ID];
      if (!root?.shapes) return null;

      // Traverse in reverse (top-most first)
      const test = (ids: UUID[]): PenpotShape | null => {
        for (let i = ids.length - 1; i >= 0; i--) {
          const shape = pageObjects[ids[i]];
          if (!shape || shape.hidden || shape.locked) continue;

          // Check children first (for frames/groups)
          if (shape.shapes && shape.shapes.length > 0) {
            const child = test(shape.shapes);
            if (child) return child;
          }

          // Check this shape
          if (
            worldP.x >= shape.x &&
            worldP.x <= shape.x + shape.width &&
            worldP.y >= shape.y &&
            worldP.y <= shape.y + shape.height
          ) {
            return shape;
          }
        }
        return null;
      };

      return test(root.shapes);
    },
    [pageObjects]
  );

  // ── Mouse coordinates to world ────────────────────────────
  const toWorld = useCallback(
    (e: React.MouseEvent): Point => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      const screenP = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      return screenToWorld(screenP, local.vbox, local.vport);
    },
    [local.vbox, local.vport]
  );

  // ── Wheel handler (zoom + pan) ────────────────────────────
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const screenP = { x: e.clientX - rect.left, y: e.clientY - rect.top };

      if (e.ctrlKey || e.metaKey) {
        // Zoom
        const delta = -e.deltaY * 0.001;
        const newVbox = zoomAtScreenPoint(local.vbox, local.vport, screenP, delta);
        setViewbox(newVbox);
        setZoom(zoomFromViewbox(local.vport, newVbox));
        sendViewportChange(newVbox.x, newVbox.y, zoomFromViewbox(local.vport, newVbox));
      } else {
        // Pan
        const zoom = zoomFromViewbox(local.vport, local.vbox);
        const dx = e.deltaX / zoom;
        const dy = e.deltaY / zoom;
        setViewbox({
          ...local.vbox,
          x: local.vbox.x + dx,
          y: local.vbox.y + dy,
        });
        sendViewportChange(local.vbox.x + dx, local.vbox.y + dy, zoom);
      }
    },
    [local.vbox, local.vport, setViewbox, setZoom, sendViewportChange]
  );

  // Attach wheel handler with { passive: false } to prevent browser zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // ── Mouse Down ────────────────────────────────────────────
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && spaceHeld)) {
        // Middle button or space+click = pan
        setIsPanning(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        setPanning(true);
        return;
      }

      // Close context menu on any click
      if (contextMenu) setContextMenu(null);

      const worldP = toWorld(e);

      // Drawing mode
      if (local.drawing) {
        setIsDrawing(true);
        setDrawStart(worldP);
        return;
      }

      // Check if clicking on resize handle
      const target = e.target as SVGElement;
      const handleAttr = target.getAttribute?.("data-handle");
      if (handleAttr && local.selected.size > 0) {
        setIsResizing(true);
        setResizeHandle(handleAttr);
        const shapes: Record<UUID, { x: number; y: number; width: number; height: number }> = {};
        for (const id of local.selected) {
          const s = pageObjects[id];
          if (s) shapes[id] = { x: s.x, y: s.y, width: s.width, height: s.height };
        }
        setResizeStart({ shapes, worldStart: worldP });
        dragOriginals.current = { ...shapes }; // Capture originals for undo
        setTransform("resize");
        return;
      }

      // Hit test
      const hit = hitTestShapes(worldP);

      if (hit) {
        if (e.shiftKey) {
          selectShape(hit.id, true);
        } else if (!local.selected.has(hit.id)) {
          selectShape(hit.id);
        }
        // Defer selection broadcast to next microtask so store has updated
        queueMicrotask(() => {
          const currentSelected = useWorkspaceStore.getState().local.selected;
          sendSelectionChange(Array.from(currentSelected));
        });

        // Start drag
        setIsDragging(true);
        setDragStart(worldP);
        setTransform("move");
        dragAccum.current = { x: 0, y: 0 };

        // Capture original positions for buffered undo
        // Read from latest store state because selectShape() above may have
        // just updated the selection, but `local.selected` in this closure
        // is still the stale pre-render value.
        const latestSelected = useWorkspaceStore.getState().local.selected;
        const latestObjects = useWorkspaceStore.getState().currentPageObjects();
        const originals: Record<UUID, { x: number; y: number; width: number; height: number }> = {};
        for (const id of latestSelected) {
          const s = latestObjects[id];
          if (s) {
            originals[id] = { x: s.x, y: s.y, width: s.width, height: s.height };
            // Also capture all descendant positions so children move with parent
            const descendants = collectDescendantIds(id, latestObjects);
            for (const childId of descendants) {
              if (!originals[childId]) {
                const c = latestObjects[childId];
                if (c) originals[childId] = { x: c.x, y: c.y, width: c.width, height: c.height };
              }
            }
          }
        }
        dragOriginals.current = originals;
      } else {
        // Deselect and start selection rect
        if (!e.shiftKey) deselectAll();
        setDragStart(worldP);
      }
    },
    [
      local.drawing,
      local.selected,
      spaceHeld,
      toWorld,
      hitTestShapes,
      selectShape,
      deselectAll,
      setPanning,
      setTransform,
      sendSelectionChange,
      pageObjects,
      contextMenu,
    ]
  );

  // ── Mouse Move ────────────────────────────────────────────
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const worldP = toWorld(e);
      sendCursorPosition(worldP.x, worldP.y);

      // Pan
      if (isPanning && dragStart) {
        const zoom = zoomFromViewbox(local.vport, local.vbox);
        const dx = (e.clientX - dragStart.x) / zoom;
        const dy = (e.clientY - dragStart.y) / zoom;
        setViewbox({
          ...local.vbox,
          x: local.vbox.x - dx,
          y: local.vbox.y - dy,
        });
        setDragStart({ x: e.clientX, y: e.clientY });
        return;
      }

      // Drawing
      if (isDrawing && drawStart) {
        const width = worldP.x - drawStart.x;
        const height = worldP.y - drawStart.y;
        setSelectionRect({
          x: width >= 0 ? drawStart.x : worldP.x,
          y: height >= 0 ? drawStart.y : worldP.y,
          width: Math.abs(width),
          height: Math.abs(height),
        });
        return;
      }

      // Resize
      if (isResizing && resizeStart && resizeHandle) {
        let dx = worldP.x - resizeStart.worldStart.x;
        let dy = worldP.y - resizeStart.worldStart.y;

        // Apply snap to the resize edge(s)
        if (snapToObjects || snapToGrid) {
          const zoom = zoomFromViewbox(local.vport, local.vbox);
          const snapR = snapResize(
            resizeHandle,
            local.selected,
            dx,
            dy,
            resizeStart.shapes,
            pageObjects,
            zoom,
            { objectSnap: snapToObjects, gridSnap: snapToGrid },
          );
          dx += snapR.snapDx;
          dy += snapR.snapDy;
          setSnapGuides(snapR.guides);
        } else {
          setSnapGuides([]);
        }

        for (const [id, orig] of Object.entries(resizeStart.shapes)) {
          const newProps: Partial<PenpotShape> = {};

          if (resizeHandle.includes("right")) {
            newProps.width = Math.max(1, orig.width + dx);
          }
          if (resizeHandle.includes("left")) {
            newProps.x = orig.x + dx;
            newProps.width = Math.max(1, orig.width - dx);
          }
          if (resizeHandle.includes("bottom")) {
            newProps.height = Math.max(1, orig.height + dy);
          }
          if (resizeHandle.includes("top")) {
            newProps.y = orig.y + dy;
            newProps.height = Math.max(1, orig.height - dy);
          }

          updateShapeDirect(id, newProps);
        }
        return;
      }

      // Drag (move shapes) — use direct update to avoid per-pixel undo entries
      if (isDragging && dragStart && local.selected.size > 0) {
        // Accumulate total raw delta since drag started
        const rawDx = worldP.x - dragStart.x;
        const rawDy = worldP.y - dragStart.y;
        dragAccum.current = {
          x: dragAccum.current.x + rawDx,
          y: dragAccum.current.y + rawDy,
        };

        if (Math.abs(dragAccum.current.x) > 1 || Math.abs(dragAccum.current.y) > 1) {
          // Compute snap-corrected total delta from originals
          let totalDx = dragAccum.current.x;
          let totalDy = dragAccum.current.y;

          if (snapToObjects || snapToGrid) {
            const zoom = zoomFromViewbox(local.vport, local.vbox);
            // snapMove computes from current shape positions + delta,
            // but shapes are still at their *original* positions in dragOriginals.
            // Use a synthetic objects map with original positions for accurate snap.
            const sr = snapMove(
              local.selected,
              totalDx,
              totalDy,
              // Pass the live objects — snapMove reads current bounds
              // and adds the delta, but since we set shapes to originals+total
              // below, we need to pass originals as "current". We'll construct
              // a patched view:
              patchedObjectsForSnap(pageObjects, dragOriginals.current),
              zoom,
              { objectSnap: snapToObjects, gridSnap: snapToGrid },
            );
            totalDx += sr.snapDx;
            totalDy += sr.snapDy;
            setSnapGuides(sr.guides);
          } else {
            setSnapGuides([]);
          }

          // Set shapes (and all their descendants) to original position + snapped total delta
          for (const [id, orig] of Object.entries(dragOriginals.current)) {
            updateShapeDirect(id, {
              x: orig.x + totalDx,
              y: orig.y + totalDy,
            });
          }
          setDragStart(worldP);

          // Update drop-target highlight for auto-parenting
          const draggedIds = Array.from(local.selected);
          const latestObjects = useWorkspaceStore.getState().currentPageObjects();
          let cx = 0, cy = 0, cnt = 0;
          for (const id of draggedIds) {
            const s = latestObjects[id];
            if (s) { cx += s.x + s.width / 2; cy += s.y + s.height / 2; cnt++; }
          }
          if (cnt > 0) {
            cx /= cnt; cy /= cnt;
            const target = findDropTargetFrame(cx, cy, draggedIds, latestObjects);
            setDropTargetId(target !== ROOT_FRAME_ID ? target : null);
          }
        }
        return;
      }

      // Selection rect
      if (dragStart && !isDragging && !isPanning && !isDrawing && !local.drawing) {
        const width = worldP.x - dragStart.x;
        const height = worldP.y - dragStart.y;
        if (Math.abs(width) > 3 || Math.abs(height) > 3) {
          setSelectionRect({
            x: width >= 0 ? dragStart.x : worldP.x,
            y: height >= 0 ? dragStart.y : worldP.y,
            width: Math.abs(width),
            height: Math.abs(height),
          });
        }
      }

      // Hover detection
      const hit = hitTestShapes(worldP);
      setHoveredShape(hit?.id || null);
    },
    [
      isPanning,
      isDrawing,
      isDragging,
      isResizing,
      dragStart,
      drawStart,
      resizeStart,
      resizeHandle,
      local.vbox,
      local.vport,
      local.drawing,
      local.selected,
      toWorld,
      sendCursorPosition,
      hitTestShapes,
      setViewbox,
      setHoveredShape,
      updateShapeDirect,
      setSelectionRect,
      pageObjects,
      snapToObjects,
      snapToGrid,
    ]
  );

  // ── Mouse Up ──────────────────────────────────────────────
  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      const worldP = toWorld(e);

      // Commit buffered drag/resize as a single undo entry
      if ((isDragging || isResizing) && Object.keys(dragOriginals.current).length > 0) {
        const currentShapes: Record<UUID, Partial<PenpotShape>> = {};
        const storeObjects = useWorkspaceStore.getState().currentPageObjects();
        for (const id of Object.keys(dragOriginals.current)) {
          const s = storeObjects[id];
          if (s) currentShapes[id] = { x: s.x, y: s.y, width: s.width, height: s.height };
        }
        commitShapeChanges(dragOriginals.current, currentShapes);
        dragOriginals.current = {};

        // ── Auto-parenting: reparent dragged shapes into the frame they land on ──
        if (isDragging && local.selected.size > 0) {
          const latestObjects = useWorkspaceStore.getState().currentPageObjects();
          const draggedIds = Array.from(local.selected);

          // Compute combined center of all dragged shapes
          let cx = 0,
            cy = 0,
            count = 0;
          for (const id of draggedIds) {
            const s = latestObjects[id];
            if (s) {
              cx += s.x + s.width / 2;
              cy += s.y + s.height / 2;
              count++;
            }
          }

          if (count > 0) {
            cx /= count;
            cy /= count;

            const targetParent = findDropTargetFrame(cx, cy, draggedIds, latestObjects);
            const currentParent = latestObjects[draggedIds[0]]?.parentId || ROOT_FRAME_ID;

            if (targetParent !== currentParent) {
              moveShapes(draggedIds, targetParent);
            }
          }
        }
      }

      // Finish drawing
      if (isDrawing && drawStart && local.drawing) {
        const width = Math.abs(worldP.x - drawStart.x);
        const height = Math.abs(worldP.y - drawStart.y);

        if (width > 2 && height > 2) {
          addShape(local.drawing.tool, {
            x: Math.min(drawStart.x, worldP.x),
            y: Math.min(drawStart.y, worldP.y),
            width,
            height,
          });
        }
        setIsDrawing(false);
        setDrawStart(null);
        setSelectionRect(null);
        setDrawing(null);
        return;
      }

      // Finish selection rect
      if (local.selectionRect && !isDragging) {
        const rect = local.selectionRect;
        const root = pageObjects[ROOT_FRAME_ID];
        if (root?.shapes) {
          const found = new Set<UUID>();
          const checkIds = (ids: UUID[]) => {
            for (const id of ids) {
              const s = pageObjects[id];
              if (!s || s.hidden) continue;
              if (
                s.x < rect.x + rect.width &&
                s.x + s.width > rect.x &&
                s.y < rect.y + rect.height &&
                s.y + s.height > rect.y
              ) {
                found.add(id);
              }
              if (s.shapes) checkIds(s.shapes);
            }
          };
          checkIds(root.shapes);
          for (const id of found) selectShape(id, true);
        }
      }

      // Reset all interaction states
      setIsPanning(false);
      setIsDrawing(false);
      setIsDragging(false);
      setIsResizing(false);
      setDragStart(null);
      setDrawStart(null);
      setResizeHandle(null);
      setResizeStart(null);
      setDropTargetId(null);
      setSnapGuides([]);
      dragAccum.current = { x: 0, y: 0 };
      setPanning(false);
      setTransform(null);
      setSelectionRect(null);
    },
    [
      isDrawing,
      isDragging,
      isResizing,
      drawStart,
      local.drawing,
      local.selected,
      local.selectionRect,
      toWorld,
      addShape,
      moveShapes,
      setDrawing,
      setPanning,
      setTransform,
      setSelectionRect,
      selectShape,
      commitShapeChanges,
      pageObjects,
    ]
  );

  // ── Derived values ────────────────────────────────────────
  const zoom = local.vport.width / local.vbox.width;
  const selectedShapes = Array.from(local.selected)
    .map((id) => pageObjects[id])
    .filter(Boolean);

  // Frame titles for non-root frames
  const frameTitles = Object.values(pageObjects).filter(
    (s) => s.type === "frame" && s.id !== ROOT_FRAME_ID
  );

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-zinc-800"
      style={{ cursor: spaceHeld || isPanning ? "grab" : local.drawing ? "crosshair" : "default" }}
      onContextMenu={(e) => {
        e.preventDefault();
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const screenP = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        const worldP = screenToWorld(screenP, local.vbox, local.vport);
        // Hit test and select if clicking on a shape
        const hit = hitTestShapes(worldP);
        if (hit && !local.selected.has(hit.id)) {
          selectShape(hit.id);
        }
        setContextMenu({ x: e.clientX, y: e.clientY, worldX: worldP.x, worldY: worldP.y });
      }}
    >
      {/* ── Layer 1: Shape rendering SVG (pointer-events: none on shapes) ── */}
      <svg
        ref={renderSvgRef}
        id="render"
        className="absolute inset-0 h-full w-full"
        viewBox={formatViewbox(local.vbox)}
        preserveAspectRatio="xMidYMid meet"
        style={{ pointerEvents: "none" }}
      >
        {/* Background */}
        <rect
          x={local.vbox.x}
          y={local.vbox.y}
          width={local.vbox.width}
          height={local.vbox.height}
          fill="#E8E9EA"
        />

        {/* Grid */}
        {showGrid && <GridPattern vbox={local.vbox} zoom={zoom} />}

        {/* Shape tree */}
        <RootShape objects={pageObjects} />
      </svg>

      {/* ── Layer 2: Interactive controls SVG ── */}
      <svg
        className="viewport-controls absolute inset-0 h-full w-full"
        viewBox={formatViewbox(local.vbox)}
        preserveAspectRatio="xMidYMid meet"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Frame titles */}
        {frameTitles.map((shape) => (
          <FrameTitle key={shape.id} shape={shape} zoom={zoom} />
        ))}

        {/* Selection handles */}
        <SelectionHandles shapes={selectedShapes} zoom={zoom} />

        {/* Drop-target highlight (auto-parenting) */}
        {dropTargetId && pageObjects[dropTargetId] && (
          <rect
            x={pageObjects[dropTargetId].x}
            y={pageObjects[dropTargetId].y}
            width={pageObjects[dropTargetId].width}
            height={pageObjects[dropTargetId].height}
            fill="none"
            stroke="#7B61FF"
            strokeWidth={2 / zoom}
            rx={4 / zoom}
            pointerEvents="none"
          />
        )}

        {/* Hover outline */}
        {local.hoveredShapeId &&
          !local.selected.has(local.hoveredShapeId) &&
          pageObjects[local.hoveredShapeId] && (
            <rect
              x={pageObjects[local.hoveredShapeId].x}
              y={pageObjects[local.hoveredShapeId].y}
              width={pageObjects[local.hoveredShapeId].width}
              height={pageObjects[local.hoveredShapeId].height}
              fill="none"
              stroke="#1592EC"
              strokeWidth={1 / zoom}
              strokeDasharray={`${4 / zoom} ${4 / zoom}`}
              pointerEvents="none"
            />
          )}

        {/* Selection rect */}
        {local.selectionRect && (
          <rect
            x={local.selectionRect.x}
            y={local.selectionRect.y}
            width={local.selectionRect.width}
            height={local.selectionRect.height}
            fill="rgba(21, 146, 236, 0.1)"
            stroke="#1592EC"
            strokeWidth={1 / zoom}
            pointerEvents="none"
          />
        )}

        {/* Presence cursors */}
        <PresenceCursors presence={presence} zoom={zoom} />

        {/* Snap guides */}
        {snapGuides.length > 0 &&
          snapGuides.map((g, i) => (
            <line
              key={i}
              x1={g.start.x}
              y1={g.start.y}
              x2={g.end.x}
              y2={g.end.y}
              stroke={g.kind === "center" ? "#FF00FF" : g.kind === "spacing" ? "#00D9FF" : "#FF6B6B"}
              strokeWidth={1 / zoom}
              strokeDasharray={g.kind === "grid" ? `${3 / zoom} ${3 / zoom}` : "none"}
              pointerEvents="none"
            />
          ))}

        {/* Prototyping interaction arrows (in prototype mode) */}
        {optionsMode === "prototype" && (
          <InteractionArrows objects={pageObjects} selected={local.selected} zoom={zoom} />
        )}
      </svg>

      {/* ── Rulers (HTML overlay) ── */}
      {showRulers && <Rulers vbox={local.vbox} vport={local.vport} zoom={zoom} />}

      {/* ── Context Menu ── */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          hasSelection={local.selected.size > 0}
          selectionCount={local.selected.size}
          onClose={() => setContextMenu(null)}
          onCopy={() => { copyShapes(); setContextMenu(null); }}
          onPaste={() => { pasteShapes(); setContextMenu(null); }}
          onCut={() => { copyShapes(); const s = Array.from(local.selected); if (s.length) deleteShapes(s); setContextMenu(null); }}
          onDuplicate={() => { const s = Array.from(local.selected); if (s.length) useWorkspaceStore.getState().duplicateShapes(s); setContextMenu(null); }}
          onDelete={() => { const s = Array.from(local.selected); if (s.length) deleteShapes(s); setContextMenu(null); }}
          onGroup={() => { const s = Array.from(local.selected); if (s.length >= 2) groupShapes(s); setContextMenu(null); }}
          onUngroup={() => { const s = Array.from(local.selected); if (s.length) ungroupShapes(s); setContextMenu(null); }}
          onBringToFront={() => { bringToFront(Array.from(local.selected)); setContextMenu(null); }}
          onBringForward={() => { bringForward(Array.from(local.selected)); setContextMenu(null); }}
          onSendBackward={() => { sendBackward(Array.from(local.selected)); setContextMenu(null); }}
          onSendToBack={() => { sendToBack(Array.from(local.selected)); setContextMenu(null); }}
          onLock={() => { toggleLocked(Array.from(local.selected)); setContextMenu(null); }}
          onHide={() => { toggleHidden(Array.from(local.selected)); setContextMenu(null); }}
          onSelectAll={() => { useWorkspaceStore.getState().selectAll(); setContextMenu(null); }}
        />
      )}
    </div>
  );
}

// ── Context Menu Component ────────────────────────────────────
function ContextMenu({
  x, y, hasSelection, selectionCount, onClose,
  onCopy, onPaste, onCut, onDuplicate, onDelete,
  onGroup, onUngroup, onBringToFront, onBringForward,
  onSendBackward, onSendToBack, onLock, onHide, onSelectAll,
}: {
  x: number; y: number; hasSelection: boolean; selectionCount: number;
  onClose: () => void;
  onCopy: () => void; onPaste: () => void; onCut: () => void;
  onDuplicate: () => void; onDelete: () => void;
  onGroup: () => void; onUngroup: () => void;
  onBringToFront: () => void; onBringForward: () => void;
  onSendBackward: () => void; onSendToBack: () => void;
  onLock: () => void; onHide: () => void; onSelectAll: () => void;
}) {
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Close on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Adjust position to stay in viewport
  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - 400);

  const MenuItem = ({ label, shortcut, onClick, disabled }: { label: string; shortcut?: string; onClick: () => void; disabled?: boolean }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition-colors ${
        disabled ? "text-zinc-600 cursor-default" : "text-zinc-300 hover:bg-zinc-700 hover:text-white"
      }`}
    >
      <span>{label}</span>
      {shortcut && <span className="ml-4 text-[10px] text-zinc-500">{shortcut}</span>}
    </button>
  );

  const Divider = () => <div className="my-1 h-px bg-zinc-700" />;

  return (
    <div
      ref={menuRef}
      className="fixed z-[200] min-w-[200px] rounded-lg border border-zinc-700 bg-zinc-800 py-1 shadow-2xl backdrop-blur-sm"
      style={{ left: adjustedX, top: adjustedY }}
    >
      <MenuItem label="Cut" shortcut="⌘X" onClick={onCut} disabled={!hasSelection} />
      <MenuItem label="Copy" shortcut="⌘C" onClick={onCopy} disabled={!hasSelection} />
      <MenuItem label="Paste" shortcut="⌘V" onClick={onPaste} />
      <MenuItem label="Duplicate" shortcut="⌘D" onClick={onDuplicate} disabled={!hasSelection} />
      <Divider />
      <MenuItem label="Delete" shortcut="⌫" onClick={onDelete} disabled={!hasSelection} />
      <Divider />
      <MenuItem label="Group" shortcut="⌘G" onClick={onGroup} disabled={selectionCount < 2} />
      <MenuItem label="Ungroup" shortcut="⌘⇧G" onClick={onUngroup} disabled={!hasSelection} />
      <Divider />
      <MenuItem label="Bring to Front" shortcut="⌘⇧]" onClick={onBringToFront} disabled={!hasSelection} />
      <MenuItem label="Bring Forward" shortcut="⌘]" onClick={onBringForward} disabled={!hasSelection} />
      <MenuItem label="Send Backward" shortcut="⌘[" onClick={onSendBackward} disabled={!hasSelection} />
      <MenuItem label="Send to Back" shortcut="⌘⇧[" onClick={onSendToBack} disabled={!hasSelection} />
      <Divider />
      <MenuItem label="Lock / Unlock" onClick={onLock} disabled={!hasSelection} />
      <MenuItem label="Show / Hide" onClick={onHide} disabled={!hasSelection} />
      <Divider />
      <MenuItem label="Select All" shortcut="⌘A" onClick={onSelectAll} />
    </div>
  );
}

export const SVGViewport = memo(SVGViewportInner);

// ── Grid Pattern ──────────────────────────────────────────────
const GridPattern = memo(function GridPattern({
  vbox,
  zoom,
}: {
  vbox: Viewbox;
  zoom: number;
}) {
  const gridSize = zoom > 4 ? 1 : zoom > 1 ? 10 : zoom > 0.3 ? 50 : 100;
  const startX = Math.floor(vbox.x / gridSize) * gridSize;
  const startY = Math.floor(vbox.y / gridSize) * gridSize;
  const lines: React.ReactNode[] = [];

  for (let x = startX; x < vbox.x + vbox.width; x += gridSize) {
    lines.push(
      <line
        key={`v${x}`}
        x1={x}
        y1={vbox.y}
        x2={x}
        y2={vbox.y + vbox.height}
        stroke="#CBD5E1"
        strokeWidth={0.5 / zoom}
        opacity={0.3}
      />
    );
  }
  for (let y = startY; y < vbox.y + vbox.height; y += gridSize) {
    lines.push(
      <line
        key={`h${y}`}
        x1={vbox.x}
        y1={y}
        x2={vbox.x + vbox.width}
        y2={y}
        stroke="#CBD5E1"
        strokeWidth={0.5 / zoom}
        opacity={0.3}
      />
    );
  }

  return <g className="grid-lines">{lines}</g>;
});

// ── Rulers ────────────────────────────────────────────────────
const Rulers = memo(function Rulers({
  vbox,
  vport,
  zoom,
}: {
  vbox: Viewbox;
  vport: { width: number; height: number };
  zoom: number;
}) {
  const RULER_SIZE = 20;
  const step = zoom > 2 ? 10 : zoom > 0.5 ? 50 : zoom > 0.1 ? 100 : 500;

  const hTicks: React.ReactNode[] = [];
  const vTicks: React.ReactNode[] = [];

  const startX = Math.floor(vbox.x / step) * step;
  for (let wx = startX; wx < vbox.x + vbox.width; wx += step) {
    const sx = ((wx - vbox.x) / vbox.width) * vport.width;
    hTicks.push(
      <React.Fragment key={`h${wx}`}>
        <line x1={sx} y1={RULER_SIZE - 6} x2={sx} y2={RULER_SIZE} stroke="#64748B" strokeWidth={1} />
        <text x={sx + 2} y={RULER_SIZE - 8} fontSize={9} fill="#64748B" fontFamily="monospace">
          {wx}
        </text>
      </React.Fragment>
    );
  }

  const startY = Math.floor(vbox.y / step) * step;
  for (let wy = startY; wy < vbox.y + vbox.height; wy += step) {
    const sy = ((wy - vbox.y) / vbox.height) * vport.height;
    vTicks.push(
      <React.Fragment key={`v${wy}`}>
        <line x1={RULER_SIZE - 6} y1={sy} x2={RULER_SIZE} y2={sy} stroke="#64748B" strokeWidth={1} />
        <text
          x={3}
          y={sy - 2}
          fontSize={9}
          fill="#64748B"
          fontFamily="monospace"
          transform={`rotate(-90 3 ${sy - 2})`}
        >
          {wy}
        </text>
      </React.Fragment>
    );
  }

  return (
    <>
      {/* Horizontal ruler */}
      <svg
        className="pointer-events-none absolute left-5 top-0"
        width={vport.width - RULER_SIZE}
        height={RULER_SIZE}
      >
        <rect width="100%" height="100%" fill="#1E293B" />
        {hTicks}
      </svg>
      {/* Vertical ruler */}
      <svg
        className="pointer-events-none absolute left-0 top-5"
        width={RULER_SIZE}
        height={vport.height - RULER_SIZE}
      >
        <rect width="100%" height="100%" fill="#1E293B" />
        {vTicks}
      </svg>
      {/* Corner */}
      <div
        className="pointer-events-none absolute left-0 top-0 bg-slate-800"
        style={{ width: RULER_SIZE, height: RULER_SIZE }}
      />
    </>
  );
});

// ── Interaction Arrows (Prototype mode) ───────────────────────
const InteractionArrows = memo(function InteractionArrows({
  objects,
  selected,
  zoom,
}: {
  objects: Record<UUID, PenpotShape>;
  selected: Set<UUID>;
  zoom: number;
}) {
  const addInteraction = useWorkspaceStore((s) => s.addInteraction);

  // Drag-to-connect state
  const [dragging, setDragging] = React.useState<{
    sourceId: UUID;
    startX: number;
    startY: number;
    mouseX: number;
    mouseY: number;
  } | null>(null);

  const svgRef = React.useRef<SVGGElement>(null);

  // Mouse move for drag arrow
  React.useEffect(() => {
    if (!dragging) return;

    const handleMove = (e: MouseEvent) => {
      const svg = svgRef.current?.closest("svg");
      if (!svg) return;
      const pt = (svg as SVGSVGElement).createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = (svg as SVGSVGElement).getScreenCTM();
      if (!ctm) return;
      const svgPt = pt.matrixTransform(ctm.inverse());
      setDragging((d) => d ? { ...d, mouseX: svgPt.x, mouseY: svgPt.y } : null);
    };

    const handleUp = (e: MouseEvent) => {
      if (!dragging) { setDragging(null); return; }
      // Find which frame the mouse is over
      const svg = svgRef.current?.closest("svg");
      if (!svg) { setDragging(null); return; }
      const pt = (svg as SVGSVGElement).createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = (svg as SVGSVGElement).getScreenCTM();
      if (!ctm) { setDragging(null); return; }
      const svgPt = pt.matrixTransform(ctm.inverse());

      // Check all frames
      for (const shape of Object.values(objects)) {
        if (shape.type !== "frame" || shape.id === dragging.sourceId) continue;
        if (shape.id === ROOT_FRAME_ID) continue;
        if (
          svgPt.x >= shape.x &&
          svgPt.x <= shape.x + shape.width &&
          svgPt.y >= shape.y &&
          svgPt.y <= shape.y + shape.height
        ) {
          // Create navigate interaction
          addInteraction(dragging.sourceId, {
            id: crypto.randomUUID(),
            eventType: "click" as const,
            actionType: "navigate" as const,
            destination: shape.id,
            animation: {
              animationType: "dissolve" as const,
              duration: 300,
              easing: "ease-in-out" as const,
            },
          });
          break;
        }
      }
      setDragging(null);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragging, objects, addInteraction]);

  const arrows: React.ReactNode[] = [];
  const nubs: React.ReactNode[] = [];

  for (const shape of Object.values(objects)) {
    if (shape.type === "frame" && shape.id !== ROOT_FRAME_ID) {
      // Nub = draggable connection point on right edge (only for selected shapes)
      if (selected.has(shape.id) || (shape.interactions && shape.interactions.length > 0)) {
        const nubX = shape.x + shape.width;
        const nubY = shape.y + shape.height / 2;
        const r = 6 / zoom;

        nubs.push(
          <circle
            key={`nub-${shape.id}`}
            cx={nubX}
            cy={nubY}
            r={r}
            fill="#7C3AED"
            stroke="white"
            strokeWidth={1.5 / zoom}
            style={{ cursor: "crosshair" }}
            onMouseDown={(e) => {
              e.stopPropagation();
              setDragging({
                sourceId: shape.id,
                startX: nubX,
                startY: nubY,
                mouseX: nubX,
                mouseY: nubY,
              });
            }}
          />
        );
      }
    }

    if (!shape.interactions?.length) continue;

    for (const interaction of shape.interactions) {
      if (
        interaction.actionType === "navigate" ||
        interaction.actionType === "open-overlay" ||
        interaction.actionType === "swap-overlay" ||
        interaction.actionType === "toggle-overlay"
      ) {
        const dest = interaction.destination ? objects[interaction.destination] : null;
        if (!dest) continue;

        const startX = shape.x + shape.width;
        const startY = shape.y + shape.height / 2;
        const endX = dest.x;
        const endY = dest.y + dest.height / 2;

        const isSelected = selected.has(shape.id);

        arrows.push(
          <g key={`${shape.id}-${interaction.id}`} opacity={isSelected ? 1 : 0.5}>
            <line
              x1={startX}
              y1={startY}
              x2={endX}
              y2={endY}
              stroke="#7C3AED"
              strokeWidth={2 / zoom}
              markerEnd="url(#arrowhead)"
            />
            {/* Source indicator */}
            <circle
              cx={startX}
              cy={startY}
              r={4 / zoom}
              fill="#7C3AED"
            />
          </g>
        );
      }
    }
  }

  if (arrows.length === 0 && nubs.length === 0 && !dragging) return null;

  return (
    <g className="interaction-arrows" ref={svgRef}>
      <defs>
        <marker
          id="arrowhead"
          markerWidth={10}
          markerHeight={7}
          refX={10}
          refY={3.5}
          orient="auto"
          fill="#7C3AED"
        >
          <polygon points="0 0, 10 3.5, 0 7" />
        </marker>
      </defs>
      {arrows}
      {nubs}

      {/* Drag-to-connect preview arrow */}
      {dragging && (
        <line
          x1={dragging.startX}
          y1={dragging.startY}
          x2={dragging.mouseX}
          y2={dragging.mouseY}
          stroke="#7C3AED"
          strokeWidth={2 / zoom}
          strokeDasharray={`${4 / zoom} ${4 / zoom}`}
          markerEnd="url(#arrowhead)"
          pointerEvents="none"
        />
      )}
    </g>
  );
});
