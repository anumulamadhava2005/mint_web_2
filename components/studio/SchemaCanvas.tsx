"use client";

// ═══════════════════════════════════════════════════════════════
// SchemaCanvas — Figma-style multi-screen WYSIWYG canvas
//
// All screens rendered as artboards side-by-side on an infinite
// pan/zoom canvas. Clicking an artboard activates it for editing.
// Drag components from the left palette directly onto any artboard.
// Every edit commits to useRuntimeStore (schema-as-truth).
// ═══════════════════════════════════════════════════════════════

import React from "react";
import { Trash2, Undo2, Redo2, ZoomIn, ZoomOut, Maximize, Plus, Layers, LayoutGrid, Check, Download, GitCommitHorizontal, Loader2, Monitor } from "lucide-react";
import { useRuntimeStore } from "@/lib/runtime/runtime-store";
import SchemaRenderer from "@/components/SchemaRenderer";
import { styleToCss } from "@/lib/runtime/styleToCss";
import { PALETTE_CATEGORIES, createComponentForType, type PaletteEntry } from "./componentFactory";
import {
  boxOf, isContainer, clone, findNode, findPath, parentIdOf,
  mutate, mutateMany, removeNodes, insertNode, reparentNode, regenIds, containerAt,
  flowLayout,
  type Box,
} from "./canvasTree";
import type { ComponentSchema, PropValue, StyleSchema, TypographyStyle } from "@/lib/runtime/schema";

const DEFAULT_W  = 390;
const DEFAULT_H  = 844;
const SNAP       = 6;
const SCREEN_GAP = 80;
const STAGE_PAD  = 60;

interface FramePreset { name: string; w: number; h: number; icon: string }
const FRAME_PRESETS: FramePreset[] = [
  { name: "iPhone 14",  w: 390,  h: 844,  icon: "📱" },
  { name: "iPhone SE",  w: 375,  h: 667,  icon: "📱" },
  { name: "Android",    w: 360,  h: 800,  icon: "📱" },
  { name: "iPad",       w: 768,  h: 1024, icon: "📲" },
  { name: "Desktop",    w: 1440, h: 900,  icon: "🖥️"  },
  { name: "Tablet",     w: 1024, h: 768,  icon: "📲" },
];

type Drag =
  | { mode: "move"; primary: string; startX: number; startY: number; starts: Map<string, Box> }
  | { mode: "resize"; id: string; startX: number; startY: number; startW: number; startH: number }
  | { mode: "resize-art"; sid: string; startX: number; startY: number; startW: number; startH: number }
  | { mode: "pan"; startX: number; startY: number; panX: number; panY: number }
  | { mode: "marquee"; x0: number; y0: number }
  | null;

function renderClone(c: ComponentSchema): ComponentSchema {
  return {
    ...c,
    style: {
      ...c.style,
      layout: { ...(c.style?.layout ?? {}), position: undefined, left: undefined, top: undefined },
      sizing: { ...(c.style?.sizing ?? {}), width: "100%", height: "100%" },
    },
  };
}

function primaryTextKey(type: string): string | null {
  if (type === "text" || type === "button") return "text";
  if (["checkbox", "switch", "radio", "statCard"].includes(type)) return "label";
  if (["input", "select", "searchInput", "datePicker"].includes(type)) return "placeholder";
  return null;
}

function absOffsetFrom(boxes: Map<string, Box>, tree: ComponentSchema[], id: string) {
  const path = findPath(tree, id);
  if (!path) return { x: 0, y: 0 };
  let x = 0, y = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const b = boxes.get(path[i].id);
    if (b) { x += b.left; y += b.top; }
  }
  return { x, y };
}

type Framework = "react-native" | "react" | "nextjs" | "html";

const FRAMEWORKS: { id: Framework; label: string }[] = [
  { id: "react-native", label: "React Native" },
  { id: "react",        label: "React" },
  { id: "nextjs",       label: "Next.js" },
  { id: "html",         label: "HTML" },
];

// ─────────────────────────────────────────────────────────────────
export function SchemaCanvas({ projectId, fileId }: { projectId?: string; fileId?: string } = {}) {
  const screens       = useRuntimeStore((s) => s.schema.screens);
  const globalActions = useRuntimeStore((s) => s.schema.globalActions);
  const theme         = useRuntimeStore((s) => s.schema.theme);
  const storeActiveId = useRuntimeStore((s) => s.activeScreenId);
  const setActiveScreenId = useRuntimeStore((s) => s.setActiveScreenId);
  const updateScreen  = useRuntimeStore((s) => s.updateScreen);
  const addScreen     = useRuntimeStore((s) => s.addScreen);
  const removeScreen  = useRuntimeStore((s) => s.removeScreen);

  const activeScreen = screens.find((s) => s.id === storeActiveId) ?? screens[0] ?? null;
  const screenId = activeScreen?.id ?? "";
  const tree = (activeScreen?.components ?? []) as ComponentSchema[];

  const artW = (sid: string) => screens.find(s => s.id === sid)?.width  ?? DEFAULT_W;
  const artH = (sid: string) => screens.find(s => s.id === sid)?.height ?? DEFAULT_H;
  const ART_W = artW(screenId);
  const ART_H = artH(screenId);

  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [zoom, setZoom]   = React.useState(0.65);
  const [pan, setPan]     = React.useState({ x: STAGE_PAD, y: STAGE_PAD });
  const [marquee, setMarquee] = React.useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [guides, setGuides]   = React.useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  const [paletteDragPos, setPaletteDragPos] = React.useState<{ entry: PaletteEntry; x: number; y: number } | null>(null);
  const [inspectorTab, setInspectorTab] = React.useState<"inspect" | "layers" | "screens">("inspect");
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [framework, setFramework] = React.useState<Framework>("react-native");
  const [exporting, setExporting] = React.useState(false);
  const [committing, setCommitting] = React.useState(false);
  const [canvasToast, setCanvasToast] = React.useState<string | null>(null);
  const [showPresetPicker, setShowPresetPicker] = React.useState(false);
  const [presetCustomW, setPresetCustomW] = React.useState(DEFAULT_W);
  const [presetCustomH, setPresetCustomH] = React.useState(DEFAULT_H);

  const dragRef        = React.useRef<Drag>(null);
  const paletteDragRef = React.useRef<PaletteEntry | null>(null);
  const undoRef        = React.useRef<ComponentSchema[][]>([]);
  const redoRef        = React.useRef<ComponentSchema[][]>([]);
  const clipRef        = React.useRef<{ node: ComponentSchema; parentId: string | null }[]>([]);
  const spaceRef       = React.useRef(false);
  const artRefs        = React.useRef<Map<string, HTMLDivElement>>(new Map());

  const single = selectedIds.size === 1 ? findNode(tree, [...selectedIds][0]) : null;

  const layoutBoxes = React.useCallback((comps: ComponentSchema[]) => flowLayout(comps, ART_W).boxes, [ART_W]);
  const layout = React.useMemo(() => layoutBoxes(tree), [layoutBoxes, tree]);
  const box = React.useCallback((c: ComponentSchema) => layout.get(c.id) ?? boxOf(c), [layout]);

  // ── Store helpers ────────────────────────────────────────────
  const getTree = React.useCallback(
    () => (useRuntimeStore.getState().schema.screens.find((s) => s.id === screenId)?.components ?? []) as ComponentSchema[],
    [screenId]
  );
  const commit = React.useCallback(
    (next: ComponentSchema[], undoable = true) => {
      if (undoable) { undoRef.current.push(clone(getTree())); redoRef.current = []; }
      updateScreen(screenId, { components: next });
    },
    [getTree, screenId, updateScreen]
  );
  const snapshot = React.useCallback(() => { undoRef.current.push(clone(getTree())); redoRef.current = []; }, [getTree]);

  const undo = React.useCallback(() => {
    const prev = undoRef.current.pop(); if (!prev) return;
    redoRef.current.push(clone(getTree())); updateScreen(screenId, { components: prev });
  }, [getTree, screenId, updateScreen]);

  const redo = React.useCallback(() => {
    const next = redoRef.current.pop(); if (!next) return;
    undoRef.current.push(clone(getTree())); updateScreen(screenId, { components: next });
  }, [getTree, screenId, updateScreen]);

  // ── Coordinates ──────────────────────────────────────────────
  const toArt = React.useCallback((clientX: number, clientY: number) => {
    const r = artRefs.current.get(screenId)?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: (clientX - r.left) / zoom, y: (clientY - r.top) / zoom };
  }, [zoom, screenId]);

  // ── Selection ────────────────────────────────────────────────
  const selectOnly = (id: string) => setSelectedIds(new Set([id]));
  const toggleSel  = (id: string) =>
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const editNode = (id: string, fn: (n: ComponentSchema) => void) =>
    commit(mutate(getTree(), id, fn), true);

  // ── Snap ─────────────────────────────────────────────────────
  function computeSnap(primaryId: string, nl: number, nt: number, w: number, h: number) {
    const t = getTree(); const fl = layoutBoxes(t);
    const parentId = parentIdOf(t, primaryId);
    const siblings = (parentId ? findNode(t, parentId)?.children : t) ?? [];
    const parentBox = parentId
      ? (fl.get(parentId) ?? boxOf(findNode(t, parentId)!))
      : { left: 0, top: 0, width: ART_W, height: ART_H };
    const parentOrigin = absOffsetFrom(fl, t, primaryId);
    const xs = [0, parentBox.width, parentBox.width / 2];
    const ys = [0, parentBox.height, parentBox.height / 2];
    for (const s of siblings) {
      if (s.id === primaryId || selectedIds.has(s.id)) continue;
      const b = fl.get(s.id) ?? boxOf(s);
      xs.push(b.left, b.left + b.width, b.left + b.width / 2);
      ys.push(b.top, b.top + b.height, b.top + b.height / 2);
    }
    const snap = (anchors: number[], targets: number[]) => {
      let best = { delta: 0, target: NaN, dist: SNAP + 1 };
      for (const a of anchors) for (const tg of targets) {
        const d = Math.abs(a - tg);
        if (d < best.dist) best = { delta: tg - a, target: tg, dist: d };
      }
      return best.dist <= SNAP ? best : null;
    };
    const sx = snap([nl, nl + w, nl + w / 2], xs);
    const sy = snap([nt, nt + h, nt + h / 2], ys);
    const v: number[] = [], hh: number[] = [];
    if (sx) v.push(parentOrigin.x + sx.target);
    if (sy) hh.push(parentOrigin.y + sy.target);
    return { dx: sx?.delta ?? 0, dy: sy?.delta ?? 0, guides: { v, h: hh } };
  }

  // ── Mouse move/up ─────────────────────────────────────────────
  const onMove = React.useCallback((e: MouseEvent) => {
    const d = dragRef.current; if (!d) return;
    if (d.mode === "pan") {
      setPan({ x: d.panX + (e.clientX - d.startX), y: d.panY + (e.clientY - d.startY) }); return;
    }
    if (d.mode === "marquee") {
      const p = toArt(e.clientX, e.clientY);
      setMarquee({ x: Math.min(d.x0, p.x), y: Math.min(d.y0, p.y), w: Math.abs(p.x - d.x0), h: Math.abs(p.y - d.y0) }); return;
    }
    if (d.mode === "resize") {
      const cur = toArt(e.clientX, e.clientY);
      const w = Math.max(16, Math.round(d.startW + (cur.x - d.startX)));
      const h = Math.max(8,  Math.round(d.startH + (cur.y - d.startY)));
      commit(mutate(getTree(), d.id, (n) => { n.style = { ...n.style, sizing: { ...(n.style?.sizing ?? {}), width: w, height: h } }; }), false); return;
    }
    if (d.mode === "resize-art") {
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      const newW = Math.max(100, Math.round(d.startW + dx / zoom));
      const newH = Math.max(100, Math.round(d.startH + dy / zoom));
      updateScreen(d.sid, { width: newW, height: newH });
      return;
    }
    const cur = toArt(e.clientX, e.clientY);
    let dx = cur.x - d.startX, dy = cur.y - d.startY;
    const ps = d.starts.get(d.primary)!;
    const sn = computeSnap(d.primary, Math.round(ps.left + dx), Math.round(ps.top + dy), ps.width, ps.height);
    dx += sn.dx; dy += sn.dy;
    setGuides(sn.guides);
    commit(mutateMany(getTree(), new Set(d.starts.keys()), (n) => {
      const st = d.starts.get(n.id)!;
      n.style = { ...n.style, layout: { ...(n.style?.layout ?? {}), position: "absolute", left: Math.max(0, Math.round(st.left + dx)), top: Math.max(0, Math.round(st.top + dy)) } };
    }), false);
  }, [toArt, commit, getTree, selectedIds, zoom, updateScreen]); // eslint-disable-line react-hooks/exhaustive-deps

  const onUp = React.useCallback((e: MouseEvent) => {
    const d = dragRef.current;
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    dragRef.current = null; setGuides({ v: [], h: [] });

    if (d?.mode === "pan") {
      const dist = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
      if (dist < 4) setSelectedIds(new Set());
      return;
    }
    if (d?.mode === "marquee") {
      const p = toArt(e.clientX, e.clientY);
      const rx = Math.min(d.x0, p.x), ry = Math.min(d.y0, p.y);
      const rw = Math.abs(p.x - d.x0), rh = Math.abs(p.y - d.y0);
      setMarquee(null);
      if (rw < 4 && rh < 4) { setSelectedIds(new Set()); return; }
      const hits = new Set<string>();
      const t = getTree(); const fl = layoutBoxes(t);
      const visit = (arr: ComponentSchema[]) => {
        for (const n of arr) {
          const off = absOffsetFrom(fl, t, n.id); const b = fl.get(n.id) ?? boxOf(n);
          const ax = off.x + b.left, ay = off.y + b.top;
          if (ax < rx + rw && ax + b.width > rx && ay < ry + rh && ay + b.height > ry) hits.add(n.id);
          if (n.children?.length) visit(n.children);
        }
      };
      visit(t); setSelectedIds(hits); return;
    }
    if (d?.mode === "move" && selectedIds.size === 1) {
      const p = toArt(e.clientX, e.clientY);
      const target = containerAt(getTree(), p.x, p.y, new Set([d.primary]));
      const currentParent = parentIdOf(getTree(), d.primary);
      if (target !== currentParent) commit(reparentNode(getTree(), d.primary, target, p.x - 8, p.y - 8), false);
    }
  }, [onMove, toArt, getTree, selectedIds, layoutBoxes]);

  // ── Drag starters ─────────────────────────────────────────────
  const startMove = (e: React.MouseEvent, c: ComponentSchema) => {
    e.stopPropagation(); if (spaceRef.current) { startPan(e); return; } e.preventDefault();
    let ids = selectedIds;
    if (e.shiftKey) { toggleSel(c.id); ids = new Set(selectedIds).add(c.id); }
    else if (!selectedIds.has(c.id)) { selectOnly(c.id); ids = new Set([c.id]); }
    const t = getTree(); const fl = layoutBoxes(t);
    const starts = new Map<string, Box>();
    for (const id of ids) { const n = findNode(t, id); if (n) starts.set(id, fl.get(id) ?? boxOf(n)); }
    if (!starts.has(c.id)) starts.set(c.id, fl.get(c.id) ?? boxOf(c));
    const p = toArt(e.clientX, e.clientY); snapshot();
    dragRef.current = { mode: "move", primary: c.id, startX: p.x, startY: p.y, starts };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
  };

  const startResize = (e: React.MouseEvent, c: ComponentSchema) => {
    e.preventDefault(); e.stopPropagation();
    const b = box(c); const p = toArt(e.clientX, e.clientY); snapshot();
    dragRef.current = { mode: "resize", id: c.id, startX: p.x, startY: p.y, startW: b.width, startH: b.height };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
  };

  const startPan = (e: React.MouseEvent) => {
    dragRef.current = { mode: "pan", startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
  };

  const startMarquee = (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent viewport pan handler from also firing
    if (spaceRef.current || e.button === 1) { startPan(e); return; }
    const p = toArt(e.clientX, e.clientY);
    if (!e.shiftKey) setSelectedIds(new Set());
    dragRef.current = { mode: "marquee", x0: p.x, y0: p.y };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
  };

  // ── Palette: click-to-add ─────────────────────────────────────
  const handleAdd = (entry: PaletteEntry) => {
    if (!screenId) return;
    const parent = single && isContainer(single) ? single.id : null;
    const sibs   = (parent ? findNode(tree, parent)?.children : tree) ?? [];
    const n      = sibs.length;
    const comp   = createComponentForType(entry, 16 + (n % 5) * 16, 16 + (n % 8) * 22);
    commit(insertNode(getTree(), parent, comp), true);
    selectOnly(comp.id);
  };

  // ── Palette: drag-and-drop ────────────────────────────────────
  const startPaletteDrag = (e: React.MouseEvent, entry: PaletteEntry) => {
    e.preventDefault();
    paletteDragRef.current = entry;
    setPaletteDragPos({ entry, x: e.clientX, y: e.clientY });

    const onPM = (me: MouseEvent) => setPaletteDragPos({ entry, x: me.clientX, y: me.clientY });
    const onPU = (me: MouseEvent) => {
      window.removeEventListener("mousemove", onPM);
      window.removeEventListener("mouseup", onPU);
      setPaletteDragPos(null);
      const ent = paletteDragRef.current;
      paletteDragRef.current = null;
      if (!ent) return;
      // Find which artboard received the drop
      for (const [sid, el] of artRefs.current) {
        const r = el.getBoundingClientRect();
        if (me.clientX >= r.left && me.clientX <= r.right && me.clientY >= r.top && me.clientY <= r.bottom) {
          const targetTree = (useRuntimeStore.getState().schema.screens.find((s) => s.id === sid)?.components ?? []) as ComponentSchema[];
          const ax = Math.max(0, Math.round((me.clientX - r.left) / zoom - ent.w / 2));
          const ay = Math.max(0, Math.round((me.clientY - r.top)  / zoom - ent.h / 2));
          const comp = createComponentForType(ent, ax, ay);
          setActiveScreenId(sid);
          updateScreen(sid, { components: insertNode(targetTree, null, comp) });
          setSelectedIds(new Set([comp.id]));
          return;
        }
      }
    };
    window.addEventListener("mousemove", onPM);
    window.addEventListener("mouseup", onPU);
  };

  // ── Clipboard ─────────────────────────────────────────────────
  const copySelection = React.useCallback(() => {
    const t = getTree();
    clipRef.current = [...selectedIds].map((id) => ({ node: clone(findNode(t, id)!), parentId: parentIdOf(t, id) })).filter((x) => x.node);
  }, [getTree, selectedIds]);

  const pasteClipboard = React.useCallback(() => {
    if (!clipRef.current.length) return;
    let next = getTree(); const newIds = new Set<string>();
    for (const { node, parentId } of clipRef.current) {
      const copy = regenIds(node); const b = boxOf(copy);
      copy.style = { ...copy.style, layout: { ...(copy.style?.layout ?? {}), position: "absolute", left: b.left + 16, top: b.top + 16 } };
      const target = parentId && findNode(next, parentId) ? parentId : null;
      next = insertNode(next, target, copy); newIds.add(copy.id);
    }
    commit(next, true); setSelectedIds(newIds);
  }, [commit, getTree]);

  const duplicateSelection = React.useCallback(() => { copySelection(); pasteClipboard(); }, [copySelection, pasteClipboard]);

  const deleteSelection = React.useCallback(() => {
    if (!selectedIds.size) return;
    commit(removeNodes(getTree(), selectedIds), true);
    setSelectedIds(new Set());
  }, [commit, getTree, selectedIds]);

  // ── Z-order ──────────────────────────────────────────────────
  const moveNodeInSiblings = React.useCallback((id: string, dir: 1 | -1) => {
    const t = getTree();
    const parentId = parentIdOf(t, id);
    const siblings = parentId ? (findNode(t, parentId)?.children ?? []) : t;
    const idx = siblings.findIndex(n => n.id === id);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= siblings.length) return;
    const next = [...siblings]; [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    if (parentId) commit(mutate(t, parentId, n => { n.children = next; }), true);
    else commit(next, true);
  }, [getTree, commit]);

  const bringForward = React.useCallback(() => { if (single) moveNodeInSiblings(single.id, 1);  }, [single, moveNodeInSiblings]);
  const sendBackward = React.useCallback(() => { if (single) moveNodeInSiblings(single.id, -1); }, [single, moveNodeInSiblings]);
  const bringToFront = React.useCallback(() => {
    if (!single) return; const t = getTree();
    const parentId = parentIdOf(t, single.id);
    const siblings = parentId ? (findNode(t, parentId)?.children ?? []) : t;
    const rest = siblings.filter(n => n.id !== single.id);
    const next = [...rest, single];
    if (parentId) commit(mutate(t, parentId, n => { n.children = next; }), true);
    else commit(next, true);
  }, [single, getTree, commit]);
  const sendToBack = React.useCallback(() => {
    if (!single) return; const t = getTree();
    const parentId = parentIdOf(t, single.id);
    const siblings = parentId ? (findNode(t, parentId)?.children ?? []) : t;
    const rest = siblings.filter(n => n.id !== single.id);
    const next = [single, ...rest];
    if (parentId) commit(mutate(t, parentId, n => { n.children = next; }), true);
    else commit(next, true);
  }, [single, getTree, commit]);

  // ── Keyboard ─────────────────────────────────────────────────
  React.useEffect(() => {
    const isField = () => ["input","textarea","select"].includes((document.activeElement?.tagName ?? "").toLowerCase());
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceRef.current = true;
      const mod = e.metaKey || e.ctrlKey;
      if (isField()) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.size) { e.preventDefault(); deleteSelection(); }
      else if (mod && e.key === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (mod && e.key === "y") { e.preventDefault(); redo(); }
      else if (mod && e.key === "c") { e.preventDefault(); copySelection(); }
      else if (mod && e.key === "v") { e.preventDefault(); pasteClipboard(); }
      else if (mod && e.key === "d") { e.preventDefault(); duplicateSelection(); }
      else if (mod && e.key === "a") { e.preventDefault(); setSelectedIds(new Set(tree.map((n) => n.id))); }
      else if (mod && e.key === "[") { e.preventDefault(); sendBackward(); }
      else if (mod && e.key === "]") { e.preventDefault(); bringForward(); }
      else if (e.key === "Escape") setSelectedIds(new Set());
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.code === "Space") spaceRef.current = false; };
    window.addEventListener("keydown", onKey); window.addEventListener("keyup", onKeyUp);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKeyUp); };
  }, [selectedIds, deleteSelection, undo, redo, copySelection, pasteClipboard, duplicateSelection, tree, sendBackward, bringForward]);

  // ── Zoom / pan via wheel (non-passive so preventDefault works) ──
  const viewportRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.ctrlKey || e.metaKey) {
        setZoom((z) => Math.min(2, Math.max(0.15, +(z - e.deltaY * 0.0015).toFixed(2))));
      } else {
        setPan((p) => ({
          x: p.x - (e.shiftKey ? e.deltaY : e.deltaX),
          y: p.y - (e.shiftKey ? 0 : e.deltaY),
        }));
      }
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);
  const resetView = () => { setZoom(0.65); setPan({ x: STAGE_PAD, y: STAGE_PAD }); };

  // ── Export / Commit ───────────────────────────────────────────
  const flashCanvasToast = (msg: string) => {
    setCanvasToast(msg);
    window.setTimeout(() => setCanvasToast(null), 2400);
  };

  const handleExport = React.useCallback(async () => {
    setExporting(true);
    try {
      const schema = useRuntimeStore.getState().getSchema();
      const res = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: framework,
          fileName: (schema.name || "mint-export").replace(/\s+/g, "-").toLowerCase(),
          nodes: [],
          options: { runtimeSchema: schema },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(schema.name || "mint-export").replace(/\s+/g, "-")}-${framework}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      flashCanvasToast(`Exported as ${framework}`);
    } catch (e: any) {
      flashCanvasToast(e.message || "Export failed");
    } finally {
      setExporting(false);
    }
  }, [framework]);

  const handleCommit = React.useCallback(async () => {
    if (!projectId) { flashCanvasToast("No project ID — cannot commit"); return; }
    setCommitting(true);
    try {
      const schema = useRuntimeStore.getState().getSchema();
      const res = await fetch("/api/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          fileId: fileId || projectId,
          targetFramework: framework,
          fileName: (schema.name || "mint-export").replace(/\s+/g, "-").toLowerCase(),
          nodes: [],
          runtimeSchema: schema,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      flashCanvasToast(`Committed v${data.version} · ${data.fileCount} file${data.fileCount !== 1 ? "s" : ""} changed`);
    } catch (e: any) {
      flashCanvasToast(e.message || "Commit failed");
    } finally {
      setCommitting(false);
    }
  }, [projectId, fileId, framework]);

  if (screens.length === 0) {
    return (
      <div className="flex h-full items-center justify-center" style={{ background: "var(--st-canvas)" }}>
        <p className="text-[13px]" style={{ color: "var(--st-text-3)" }}>No screens yet. Switch to the Screens tab in the right panel to add one.</p>
      </div>
    );
  }

  // ── Frame renderers ───────────────────────────────────────────
  const renderFrame = (c: ComponentSchema): React.ReactNode => {
    const b = box(c); const sel = selectedIds.has(c.id); const cont = isContainer(c);
    return (
      <div key={c.id}
        style={{ ...(cont ? styleToCss(c.style) : {}), position: "absolute", left: b.left, top: b.top, width: b.width, height: b.height, padding: 0,
          outline: sel ? "2px solid #6366f1" : "1px dashed rgba(99,102,241,0.25)", cursor: "move" }}
        onMouseDown={(e) => startMove(e, c)}>
        {cont
          ? (c.children ?? []).map((ch) => renderFrame(ch))
          : <div style={{ width: "100%", height: "100%", pointerEvents: "none", overflow: "hidden" }}><SchemaRenderer components={[renderClone(c)]} /></div>
        }
        {sel && selectedIds.size === 1 && (
          <div onMouseDown={(e) => startResize(e, c)}
            style={{ position: "absolute", right: -5, bottom: -5, width: 10, height: 10, background: "#6366f1", borderRadius: 2, cursor: "nwse-resize" }} />
        )}
      </div>
    );
  };

  const renderFrameRO = (c: ComponentSchema, lyt: Map<string, Box>): React.ReactNode => {
    const b = lyt.get(c.id) ?? boxOf(c); const cont = isContainer(c);
    return (
      <div key={c.id} style={{ position: "absolute", left: b.left, top: b.top, width: b.width, height: b.height, pointerEvents: "none" }}>
        {cont
          ? (c.children ?? []).map((ch) => renderFrameRO(ch, lyt))
          : <div style={{ width: "100%", height: "100%", overflow: "hidden" }}><SchemaRenderer components={[renderClone(c)]} /></div>
        }
      </div>
    );
  };

  const bgColor = (theme?.colors?.background as string) || "#FFFFFF";

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* ── Component Palette ──────────────────────────────────── */}
      <aside className="flex w-48 shrink-0 flex-col overflow-y-auto border-r" style={{ borderColor: "var(--st-border)", background: "var(--st-surface)" }}>
        <div className="sticky top-0 z-10 border-b px-3 py-2.5" style={{ borderColor: "var(--st-border)", background: "var(--st-surface)" }}>
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--st-text-3)" }}>Components</span>
        </div>
        {PALETTE_CATEGORIES.map((cat) => (
          <div key={cat.label}>
            <div className="px-3 pb-0.5 pt-3 text-[9.5px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--st-text-3)" }}>
              {cat.label}
            </div>
            <div className="grid grid-cols-2 gap-1 px-2 pb-1">
              {cat.entries.map((entry) => (
                <button key={entry.id}
                  onMouseDown={(e) => startPaletteDrag(e, entry)}
                  onClick={() => handleAdd(entry)}
                  title="Click to add · Drag to canvas"
                  className="st-pressable flex cursor-grab flex-col items-center gap-1 rounded-[var(--st-r-md)] px-1 py-2 text-center active:scale-[0.96] active:cursor-grabbing hover:bg-white/[0.06]"
                  style={{ color: "var(--st-text-2)", border: "1px solid var(--st-border)" }}>
                  <span className="text-[15px]">{entry.icon}</span>
                  <span className="text-[10px] font-medium leading-tight">{entry.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="h-4 shrink-0" />
      </aside>

      {/* ── Canvas area ────────────────────────────────────────── */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Toolbar */}
        <div className="flex h-9 shrink-0 items-center gap-1 border-b px-2" style={{ borderColor: "var(--st-border)", background: "var(--st-surface)" }}>
          <span className="text-[11.5px] font-medium" style={{ color: "var(--st-text-3)" }}>
            <span style={{ color: "var(--st-brand)" }}>{activeScreen?.name}</span>
            <span className="ml-1.5 opacity-60">· {screens.length} screen{screens.length !== 1 ? "s" : ""}</span>
          </span>
          <div className="ml-auto flex items-center gap-0.5">
            <ToolBtn title="Undo (⌘Z)" onClick={undo}><Undo2 size={14} /></ToolBtn>
            <ToolBtn title="Redo (⌘⇧Z)" onClick={redo}><Redo2 size={14} /></ToolBtn>
            <div className="mx-1 h-4 w-px" style={{ background: "var(--st-border)" }} />
            <ToolBtn title="Zoom out" onClick={() => setZoom((z) => Math.max(0.15, +(z - 0.1).toFixed(2)))}><ZoomOut size={14} /></ToolBtn>
            <button onClick={resetView} className="min-w-[44px] rounded px-1 text-[11.5px]" style={{ color: "var(--st-text-3)" }}>
              {Math.round(zoom * 100)}%
            </button>
            <ToolBtn title="Zoom in" onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))}><ZoomIn size={14} /></ToolBtn>
            <ToolBtn title="Fit all screens" onClick={resetView}><Maximize size={13} /></ToolBtn>
            <div className="mx-1 h-4 w-px" style={{ background: "var(--st-border)" }} />
            {/* Framework selector */}
            <select
              value={framework}
              onChange={(e) => setFramework(e.target.value as Framework)}
              className="h-6 rounded-[var(--st-r-sm)] px-1.5 text-[11px] font-medium"
              style={{ background: "var(--st-bg)", color: "var(--st-text-2)", border: "1px solid var(--st-border-2)", outline: "none" }}
              title="Target framework for export / commit"
            >
              {FRAMEWORKS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
            {/* Export ZIP */}
            <button
              onClick={handleExport}
              disabled={exporting}
              title="Export as ZIP"
              className="st-pressable ml-0.5 flex h-6 items-center gap-1 rounded-[var(--st-r-sm)] px-2 text-[11px] font-medium active:scale-[0.96] disabled:opacity-50"
              style={{ background: "var(--st-surface-2)", color: "var(--st-text-2)", border: "1px solid var(--st-border-2)" }}
            >
              {exporting ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
              Export
            </button>
            {/* Commit */}
            <button
              onClick={handleCommit}
              disabled={committing}
              title="Commit versioned snapshot to DB"
              className="st-pressable ml-0.5 flex h-6 items-center gap-1 rounded-[var(--st-r-sm)] px-2 text-[11px] font-medium active:scale-[0.96] disabled:opacity-50"
              style={{ background: "var(--st-brand)", color: "#fff" }}
            >
              {committing ? <Loader2 size={11} className="animate-spin" /> : <GitCommitHorizontal size={11} />}
              Commit
            </button>
          </div>
        </div>

        {/* Viewport */}
        <div ref={viewportRef} className="relative flex-1 overflow-hidden"
          style={{ background: "var(--st-canvas)", userSelect: "none", WebkitUserSelect: "none" }}
          onMouseDown={(e) => {
            if (e.detail > 1) e.preventDefault(); // block text selection on double/triple click
            if (e.button !== 2) startPan(e);
          }}>

          {/* Stage — all artboards */}
          <div style={{ position: "absolute", top: 0, left: 0, transformOrigin: "0 0", transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`, userSelect: "none" }}>
            {screens.map((screen, i) => {
              const isActive    = screen.id === screenId;
              const screenTree  = (screen.components ?? []) as ComponentSchema[];
              const sW = artW(screen.id);
              const sH = artH(screen.id);
              const screenLayout = isActive ? layout : flowLayout(screenTree, sW).boxes;
              const artLeft = screens.slice(0, i).reduce((acc, s) => acc + artW(s.id) + SCREEN_GAP, 0);

              return (
                <div key={screen.id} style={{ position: "absolute", left: artLeft, top: 44 }}>
                  {/* Screen name label — double-click to rename */}
                  <div style={{ position: "absolute", top: -32, left: 0, display: "flex", alignItems: "center", gap: 6, userSelect: "none" }}>
                    {renamingId === screen.id ? (
                      <input autoFocus value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onBlur={() => { if (renameValue.trim()) updateScreen(screen.id, { name: renameValue.trim() }); setRenamingId(null); }}
                        onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setRenamingId(null); }}
                        style={{ fontSize: 13, fontWeight: 600, background: "transparent", border: "none", borderBottom: "1px solid var(--st-brand)", outline: "none", color: isActive ? "var(--st-brand)" : "var(--st-text-3)", width: 150 }} />
                    ) : (
                      <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em", color: isActive ? "var(--st-brand)" : "var(--st-text-3)", cursor: "pointer", whiteSpace: "nowrap" }}
                        onClick={() => { setActiveScreenId(screen.id); setSelectedIds(new Set()); }}
                        onDoubleClick={e => { e.stopPropagation(); setRenamingId(screen.id); setRenameValue(screen.name); }}>
                        {screen.name}
                      </span>
                    )}
                  </div>

                  {/* Artboard */}
                  <div
                    ref={(el) => { if (el) artRefs.current.set(screen.id, el); else artRefs.current.delete(screen.id); }}
                    style={{ position: "relative", width: sW, height: sH, background: screen.backgroundColor ?? bgColor, borderRadius: 12, overflow: "hidden",
                      boxShadow: isActive
                        ? "0 0 0 2px #6366f1, 0 8px 40px rgba(0,0,0,0.55)"
                        : "0 4px 24px rgba(0,0,0,0.35)",
                      cursor: isActive ? "default" : "pointer",
                      transition: "box-shadow 150ms ease",
                    }}
                    onMouseDown={(e) => {
                      if (!isActive) { e.stopPropagation(); setActiveScreenId(screen.id); setSelectedIds(new Set()); return; }
                      startMarquee(e);
                    }}>

                    {isActive
                      ? screenTree.map((c) => renderFrame(c))
                      : screenTree.map((c) => renderFrameRO(c, screenLayout))
                    }

                    {isActive && guides.v.map((x, idx) => (
                      <div key={`v${idx}`} style={{ position: "absolute", left: x, top: 0, width: 1, height: sH, background: "#ec4899", pointerEvents: "none" }} />
                    ))}
                    {isActive && guides.h.map((y, idx) => (
                      <div key={`h${idx}`} style={{ position: "absolute", top: y, left: 0, height: 1, width: sW, background: "#ec4899", pointerEvents: "none" }} />
                    ))}
                    {isActive && marquee && (
                      <div style={{ position: "absolute", left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h,
                        background: "rgba(99,102,241,0.12)", border: "1px solid #6366f1", pointerEvents: "none" }} />
                    )}
                  </div>

                  {/* Size label + artboard resize handle */}
                  <div style={{ position: "absolute", bottom: -22, left: 0, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, color: "var(--st-text-3)", userSelect: "none" }}>{sW} × {sH}</span>
                    {isActive && (
                      <div title="Drag to resize frame"
                        onMouseDown={e => {
                          e.preventDefault(); e.stopPropagation();
                          dragRef.current = { mode: "resize-art", sid: screen.id, startX: e.clientX, startY: e.clientY, startW: sW, startH: sH };
                          window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
                        }}
                        style={{ width: 12, height: 12, cursor: "nwse-resize", background: "var(--st-brand)", borderRadius: 2, opacity: 0.6 }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pointer-events-none absolute bottom-2 left-2 text-[10.5px]" style={{ color: "var(--st-text-3)" }}>
            Drag to pan · Scroll to pan · ⌘-scroll zoom · ⌘Z undo · ⌘D duplicate · ⌘[ ] layer order
          </div>
        </div>
      </div>

      {/* ── Inspector ────────────────────────────────────────── */}
      <div className="flex w-60 shrink-0 flex-col border-l" style={{ borderColor: "var(--st-border)", background: "var(--st-surface)" }}>
        {/* Tab bar */}
        <div className="flex h-9 shrink-0 items-center border-b" style={{ borderColor: "var(--st-border)" }}>
          {([
            ["inspect", <LayoutGrid key="inspect" size={12} />, "Inspect"],
            ["layers",  <Layers    key="layers"  size={12} />, "Layers"],
            ["screens", <Monitor   key="screens" size={12} />, "Screens"],
          ] as const).map(([tab, icon, label]) => (
            <button key={tab} onClick={() => setInspectorTab(tab)}
              className="flex flex-1 items-center justify-center gap-1 h-full text-[11px] font-medium border-b-2"
              style={{
                color: inspectorTab === tab ? "var(--st-brand)" : "var(--st-text-3)",
                borderColor: inspectorTab === tab ? "var(--st-brand)" : "transparent",
                background: "transparent",
              }}>
              {icon}<span>{label}</span>
            </button>
          ))}
        </div>

        {/* Inspect tab */}
        {inspectorTab === "inspect" && (
          <div className="flex flex-col gap-3 overflow-auto p-3">
            {selectedIds.size > 1 ? (
              <div className="flex items-center justify-between">
                <span className="text-[12.5px]" style={{ color: "var(--st-text-2)" }}>{selectedIds.size} selected</span>
                <button onClick={deleteSelection} className="grid h-6 w-6 place-items-center rounded hover:bg-white/10" title="Delete"><Trash2 size={13} style={{ color: "#ef4444" }} /></button>
              </div>
            ) : single ? (
              <Inspector key={single.id} comp={single} resolvedBox={box(single)}
                globalActions={globalActions as { id: string; name: string }[]}
                onPos={(l, t) => editNode(single.id, (n) => { n.style = { ...n.style, layout: { ...(n.style?.layout ?? {}), position: "absolute", left: l, top: t } }; })}
                onSize={(w, h) => editNode(single.id, (n) => { n.style = { ...n.style, sizing: { ...(n.style?.sizing ?? {}), width: w, height: h } }; })}
                onStyleCommit={(patch) => editNode(single.id, (n) => {
                  const s = n.style ?? {};
                  n.style = {
                    ...s,
                    ...(patch.background ? { background: { ...s.background, ...patch.background } } : {}),
                    ...(patch.border     ? { border:     { ...s.border,     ...patch.border     } } : {}),
                    ...(patch.typography ? { typography: { ...s.typography, ...patch.typography } } : {}),
                    ...(patch.spacing    ? { spacing:    { ...s.spacing,    ...patch.spacing    } } : {}),
                    ...(patch.layout ? { layout: { ...s.layout, ...patch.layout } } : {}),
                  };
                })}
                onProp={(k, v) => editNode(single.id, (n) => { n.props = { ...n.props, [k]: v }; })}
                onBind={(k, v) => editNode(single.id, (n) => { const b = { ...(n.bindings ?? {}) }; if (v) b[k] = v; else delete b[k]; n.bindings = b; })}
                onClickAction={(a) => editNode(single.id, (n) => { n.events = { ...(n.events ?? {}), onClick: a ? [a] : [] }; })}
                onDelete={deleteSelection}
              />
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-[12px]" style={{ color: "var(--st-text-3)" }}>
                  Select a component to inspect it, or drag one from the palette onto any artboard.
                </p>
                <div className="mt-1 rounded-[var(--st-r-md)] p-2.5 text-[11px]" style={{ background: "var(--st-bg)", color: "var(--st-text-3)" }}>
                  <div>Active screen</div>
                  <div className="mt-0.5 font-semibold" style={{ color: "var(--st-text)" }}>{activeScreen?.name}</div>
                  <div className="mt-2 opacity-70">{screens.length} artboard{screens.length !== 1 ? "s" : ""} on canvas</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Screens tab */}
        {inspectorTab === "screens" && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 overflow-y-auto">
              {screens.map((s) => {
                const isActive = s.id === screenId;
                const isRenaming = renamingId === s.id;
                return (
                  <div key={s.id}
                    onClick={() => { setActiveScreenId(s.id); setSelectedIds(new Set()); }}
                    className="group flex items-center gap-2 px-3 py-2 cursor-pointer"
                    style={{ background: isActive ? "var(--st-brand-tint)" : "transparent" }}>
                    <div className="h-8 w-6 shrink-0 rounded overflow-hidden border" style={{ borderColor: isActive ? "var(--st-brand)" : "var(--st-border)", background: "var(--st-bg)" }}>
                      <div style={{ transform: "scale(0.08)", transformOrigin: "0 0", width: `${ART_W}px`, height: `${ART_H}px`, pointerEvents: "none" }}>
                        {(s.components ?? []).map((c) => <SchemaRenderer key={c.id} components={[c]} />)}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      {isRenaming ? (
                        <input autoFocus value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => { if (renameValue.trim()) updateScreen(s.id, { name: renameValue.trim() }); setRenamingId(null); }}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.currentTarget.blur(); } if (e.key === "Escape") setRenamingId(null); }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full rounded px-1 text-[12px]"
                          style={{ background: "var(--st-bg)", border: "1px solid var(--st-brand)", color: "var(--st-text)", outline: "none" }} />
                      ) : (
                        <span className="block truncate text-[12.5px] font-medium"
                          style={{ color: isActive ? "var(--st-brand)" : "var(--st-text)" }}
                          onDoubleClick={(e) => { e.stopPropagation(); setRenamingId(s.id); setRenameValue(s.name); }}>
                          {s.name}
                        </span>
                      )}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10.5px]" style={{ color: "var(--st-text-3)" }}>{s.route || "/"}</span>
                        {isActive && (
                          <div title="Screen background color"
                            className="relative h-[14px] w-[14px] shrink-0 rounded-[2px] overflow-hidden cursor-pointer"
                            style={{ background: s.backgroundColor ?? "#ffffff", boxShadow: "inset 0 0 0 1px rgba(128,128,128,0.3)" }}>
                            <input type="color"
                              value={s.backgroundColor ?? "#ffffff"}
                              onChange={e => updateScreen(s.id, { backgroundColor: e.target.value })}
                              className="absolute inset-0 opacity-0 cursor-pointer"
                              style={{ width: "100%", height: "100%" }} />
                          </div>
                        )}
                      </div>
                    </div>
                    {!isRenaming && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100" style={{ transition: "opacity 100ms" }}>
                        <button title="Rename" onClick={(e) => { e.stopPropagation(); setRenamingId(s.id); setRenameValue(s.name); }}
                          className="grid h-5 w-5 place-items-center rounded hover:bg-white/10">
                          <Check size={11} style={{ color: "var(--st-text-3)" }} />
                        </button>
                        <button title="Delete screen" onClick={(e) => { e.stopPropagation(); if (screens.length > 1) removeScreen(s.id); }}
                          className="grid h-5 w-5 place-items-center rounded hover:bg-white/10"
                          disabled={screens.length <= 1}>
                          <Trash2 size={11} style={{ color: screens.length > 1 ? "#ef4444" : "var(--st-text-3)" }} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add screen */}
            <div className="shrink-0 border-t p-2" style={{ borderColor: "var(--st-border)" }}>
              {showPresetPicker ? (
                <div className="rounded-[var(--st-r-md)] border p-2" style={{ background: "var(--st-bg)", borderColor: "var(--st-border-2)" }}>
                  <div className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--st-text-3)" }}>Choose frame</div>
                  {FRAME_PRESETS.map((p) => (
                    <button key={p.name}
                      onClick={() => {
                        const n = screens.length + 1;
                        addScreen({ id: `screen-${Date.now()}`, name: `Screen ${n}`, route: `/screen-${n}`, components: [], localState: [], actions: [], width: p.w, height: p.h });
                        setShowPresetPicker(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-[4px] px-2 py-1.5 text-left hover:bg-white/[0.06]">
                      <span className="text-[12px]">{p.icon}</span>
                      <span className="flex-1 text-[12px]" style={{ color: "var(--st-text)" }}>{p.name}</span>
                      <span className="font-mono text-[10px]" style={{ color: "var(--st-text-3)" }}>{p.w}×{p.h}</span>
                    </button>
                  ))}
                  <div className="mt-1 flex items-center gap-1 px-1">
                    <input type="number" value={presetCustomW} onChange={e => setPresetCustomW(Number(e.target.value))}
                      className="w-14 rounded px-1.5 py-1 text-right text-[11px] outline-none"
                      style={{ background: "var(--st-surface)", border: "1px solid var(--st-border-2)", color: "var(--st-text)" }} />
                    <span className="text-[10px]" style={{ color: "var(--st-text-3)" }}>×</span>
                    <input type="number" value={presetCustomH} onChange={e => setPresetCustomH(Number(e.target.value))}
                      className="w-14 rounded px-1.5 py-1 text-right text-[11px] outline-none"
                      style={{ background: "var(--st-surface)", border: "1px solid var(--st-border-2)", color: "var(--st-text)" }} />
                    <button
                      onClick={() => {
                        const n = screens.length + 1;
                        addScreen({ id: `screen-${Date.now()}`, name: `Screen ${n}`, route: `/screen-${n}`, components: [], localState: [], actions: [], width: presetCustomW, height: presetCustomH });
                        setShowPresetPicker(false);
                      }}
                      className="ml-auto rounded px-2 py-1 text-[11px] font-medium"
                      style={{ background: "var(--st-brand)", color: "#fff" }}>
                      Add
                    </button>
                  </div>
                  <button onClick={() => setShowPresetPicker(false)}
                    className="mt-1 w-full rounded py-1 text-center text-[11px] hover:bg-white/[0.04]"
                    style={{ color: "var(--st-text-3)" }}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowPresetPicker(true)}
                  className="st-pressable flex w-full items-center justify-center gap-1.5 rounded-[var(--st-r-md)] py-1.5 text-[12px] font-medium active:scale-[0.97] hover:bg-white/[0.05]"
                  style={{ color: "var(--st-text-2)", border: "1px dashed var(--st-border-2)" }}>
                  <Plus size={13} />
                  Add Screen
                </button>
              )}
            </div>
          </div>
        )}

        {/* Layers tab */}
        {inspectorTab === "layers" && (
          <div className="flex flex-1 flex-col overflow-hidden">
            {single && (
              <div className="flex shrink-0 items-center gap-1 border-b px-2 py-1.5" style={{ borderColor: "var(--st-border)" }}>
                <span className="mr-1 text-[10px]" style={{ color: "var(--st-text-3)" }}>Order</span>
                <button title="Send to back" onClick={sendToBack}
                  className="grid h-6 w-6 place-items-center rounded text-[11px] hover:bg-white/10"
                  style={{ color: "var(--st-text-2)" }}>↙</button>
                <button title="Move backward (⌘[)" onClick={sendBackward}
                  className="grid h-6 w-6 place-items-center rounded text-[11px] hover:bg-white/10"
                  style={{ color: "var(--st-text-2)" }}>↓</button>
                <button title="Move forward (⌘])" onClick={bringForward}
                  className="grid h-6 w-6 place-items-center rounded text-[11px] hover:bg-white/10"
                  style={{ color: "var(--st-text-2)" }}>↑</button>
                <button title="Bring to front" onClick={bringToFront}
                  className="grid h-6 w-6 place-items-center rounded text-[11px] hover:bg-white/10"
                  style={{ color: "var(--st-text-2)" }}>↗</button>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto py-1">
              {tree.length === 0 ? (
                <div className="px-4 py-6 text-center text-[11.5px]" style={{ color: "var(--st-text-3)" }}>
                  No components yet.<br />Drag from the palette to add.
                </div>
              ) : (
                <LayerTree
                  nodes={tree}
                  selectedIds={selectedIds}
                  onSelect={(id, multi) => multi ? toggleSel(id) : selectOnly(id)}
                  depth={0}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Drag ghost */}
      {paletteDragPos && (
        <div style={{ position: "fixed", left: paletteDragPos.x + 14, top: paletteDragPos.y - 14, pointerEvents: "none", zIndex: 9999,
          background: "var(--st-elevated)", border: "1px solid var(--st-brand)", borderRadius: 6, padding: "4px 10px",
          fontSize: 12, fontWeight: 500, color: "var(--st-text)", boxShadow: "0 4px 16px rgba(0,0,0,0.45)", userSelect: "none" }}>
          + {paletteDragPos.entry.label}
        </div>
      )}

      {/* Canvas toast */}
      {canvasToast && (
        <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", zIndex: 200,
          background: "var(--st-elevated)", color: "var(--st-text)", border: "1px solid var(--st-border-2)",
          boxShadow: "var(--st-shadow-floating)", borderRadius: "var(--st-r-md)",
          padding: "6px 14px", fontSize: 12, fontWeight: 500, whiteSpace: "nowrap",
          animation: "st-pop-in var(--st-dur-medium) var(--st-ease-out)",
          pointerEvents: "none" }}>
          {canvasToast}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
function ToolBtn({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button onClick={onClick} title={title}
      className="st-pressable grid h-7 w-7 place-items-center rounded active:scale-[0.93] hover:bg-white/[0.08]"
      style={{ color: "var(--st-text-2)" }}>
      {children}
    </button>
  );
}

// ── LayerTree ─────────────────────────────────────────────────────
function layerIcon(type: string): string {
  if (["view","card","form","scroll","modal"].includes(type)) return "⬜";
  if (type === "text")   return "T";
  if (type === "button") return "⬛";
  if (type === "image")  return "⬡";
  if (["input","select","searchInput"].includes(type)) return "▭";
  if (type === "icon")   return "✦";
  return "◾";
}

function LayerTree({ nodes, selectedIds, onSelect, depth }: {
  nodes: ComponentSchema[];
  selectedIds: Set<string>;
  onSelect: (id: string, multi: boolean) => void;
  depth: number;
}) {
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  return (
    <>
      {[...nodes].reverse().map((node) => {
        const isSelected = selectedIds.has(node.id);
        const hasChildren = (node.children?.length ?? 0) > 0;
        const isCollapsed = collapsed.has(node.id);
        const label = (node.props?._label as string) || node.type;
        return (
          <React.Fragment key={node.id}>
            <div
              onClick={(e) => onSelect(node.id, e.shiftKey)}
              className="group flex cursor-pointer select-none items-center gap-1 py-[5px]"
              style={{
                paddingLeft: 8 + depth * 14,
                paddingRight: 8,
                background: isSelected ? "var(--st-brand-tint)" : "transparent",
                borderLeft: isSelected ? "2px solid var(--st-brand)" : "2px solid transparent",
              }}>
              {hasChildren ? (
                <button onClick={e => { e.stopPropagation(); setCollapsed(prev => { const n = new Set(prev); n.has(node.id) ? n.delete(node.id) : n.add(node.id); return n; }); }}
                  className="grid h-4 w-4 shrink-0 place-items-center rounded text-[9px]"
                  style={{ color: "var(--st-text-3)" }}>
                  {isCollapsed ? "▶" : "▼"}
                </button>
              ) : <span className="w-4 shrink-0" />}
              <span className="w-3 shrink-0 text-center text-[11px]" style={{ color: "var(--st-text-3)" }}>
                {layerIcon(node.type)}
              </span>
              <span className="flex-1 truncate text-[12px] font-medium" style={{ color: isSelected ? "var(--st-brand)" : "var(--st-text)" }}>
                {label}
              </span>
            </div>
            {hasChildren && !isCollapsed && (
              <LayerTree nodes={node.children!} selectedIds={selectedIds} onSelect={onSelect} depth={depth + 1} />
            )}
          </React.Fragment>
        );
      })}
    </>
  );
}

// ── Inspector sub-components (hoisted to avoid "created during render" lint errors) ──
const IP_CLS = "rounded-[4px] outline-none bg-transparent";
const ROW_CLS = "flex items-center rounded-[4px]";
const ROW_STYLE: React.CSSProperties = { background: "var(--st-bg)", border: "1px solid var(--st-border-2)" };

function NumBox({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className={ROW_CLS} style={ROW_STYLE}>
      <span className="pl-[7px] text-[9px] font-semibold shrink-0 select-none" style={{ color: "var(--st-text-3)", minWidth: 12 }}>{label}</span>
      <input type="number" defaultValue={Math.round(value)}
        onBlur={(e) => onChange(Number(e.target.value) || 0)}
        className={`${IP_CLS} w-full min-w-0 pr-[6px] py-[5px] text-[11.5px] text-right`}
        style={{ color: "var(--st-text)" }} />
    </div>
  );
}

function ColorRow({ color, onLive, onCommit }: { color: string; onLive: (c: string) => void; onCommit: (c: string) => void }) {
  return (
    <div className={`${ROW_CLS} flex-1 gap-[6px] px-[6px] py-[5px]`} style={ROW_STYLE}>
      <div className="relative h-[14px] w-[14px] shrink-0 rounded-[3px] overflow-hidden cursor-pointer"
        style={{ background: color, boxShadow: "inset 0 0 0 1px rgba(128,128,128,0.25)" }}>
        <input type="color" value={color}
          onChange={(e) => { onLive(e.target.value); onCommit(e.target.value); }}
          className="absolute inset-0 opacity-0 cursor-pointer"
          style={{ width: "100%", height: "100%" }} />
      </div>
      <input type="text" value={color.toUpperCase()}
        onChange={(e) => onLive(e.target.value)}
        onBlur={(e) => { const v = e.target.value; /^#[0-9a-fA-F]{6}$/.test(v) ? onCommit(v) : onLive(color); }}
        className={`${IP_CLS} flex-1 min-w-0 text-[11px] font-mono uppercase`}
        style={{ color: "var(--st-text)" }} />
    </div>
  );
}

function PropHR() {
  return <div className="border-t -mx-3" style={{ borderColor: "var(--st-border)" }} />;
}

function PropSL({ label }: { label: string }) {
  return <div className="mb-[7px] text-[9px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--st-text-3)" }}>{label}</div>;
}

// ─────────────────────────────────────────────────────────────────
function Inspector({
  comp, resolvedBox, globalActions,
  onPos, onSize, onStyleCommit, onProp, onBind, onClickAction, onDelete,
}: {
  comp: ComponentSchema; resolvedBox: Box;
  globalActions: { id: string; name: string }[];
  onPos: (l: number, t: number) => void;
  onSize: (w: number, h: number) => void;
  onStyleCommit: (patch: Partial<StyleSchema>) => void;
  onProp: (k: string, v: PropValue) => void;
  onBind: (k: string, v: string) => void;
  onClickAction: (a: string) => void;
  onDelete: () => void;
}) {
  const b = resolvedBox;
  const st = comp.style ?? {};
  const textKey = primaryTextKey(comp.type);

  const [bgColor,  setBgColor]  = React.useState(st.background?.color  ?? "#ffffff");
  const [brdColor, setBrdColor] = React.useState(st.border?.color      ?? "#e5e7eb");
  const [txtColor, setTxtColor] = React.useState(st.typography?.color  ?? "#111827");
  const [aspectLocked, setAspectLocked] = React.useState(false);

  const showBinding = ["input","select","checkbox","switch","radio","searchInput","text","statCard","button"].includes(comp.type);
  const isCont = ["view","card","form","scroll","modal","list"].includes(comp.type);

  return (
    <div className="flex flex-col gap-0">

      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="shrink-0 text-[10px] capitalize" style={{ color: "var(--st-text-3)" }}>{comp.type}</span>
          <input
            defaultValue={(comp.props?._label as string) || ""}
            placeholder={comp.type}
            onBlur={(e) => onProp("_label", e.target.value.trim() || "")}
            className="min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 text-[12px] font-semibold outline-none"
            style={{ color: "var(--st-text)", border: "1px solid transparent" }}
            onFocus={(e) => { e.currentTarget.style.border = "1px solid var(--st-border-2)"; e.currentTarget.style.background = "var(--st-bg)"; }}
            onBlurCapture={(e) => { e.currentTarget.style.border = "1px solid transparent"; e.currentTarget.style.background = "transparent"; }}
          />
        </div>
        <button onClick={onDelete} className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded hover:bg-white/10" title="Delete (Del)">
          <Trash2 size={11} style={{ color: "#f87171" }} />
        </button>
      </div>

      <PropHR />

      {/* Frame */}
      <div className="px-3 py-2.5">
        <div className="mb-[7px] flex items-center justify-between">
          <PropSL label="Frame" />
          <button onClick={() => setAspectLocked(l => !l)}
            title={aspectLocked ? "Unlock aspect ratio" : "Lock aspect ratio"}
            className="grid h-5 w-5 place-items-center rounded hover:bg-white/10 text-[11px]"
            style={{ color: aspectLocked ? "var(--st-brand)" : "var(--st-text-3)" }}>
            {aspectLocked ? "🔒" : "🔓"}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1">
          <NumBox label="X" value={b.left}   onChange={(n) => onPos(n, b.top)} />
          <NumBox label="Y" value={b.top}    onChange={(n) => onPos(b.left, n)} />
          <NumBox label="W" value={b.width}  onChange={(n) => { const h = aspectLocked ? Math.round(n * b.height / Math.max(1, b.width))  : b.height; onSize(n, h); }} />
          <NumBox label="H" value={b.height} onChange={(n) => { const w = aspectLocked ? Math.round(n * b.width  / Math.max(1, b.height)) : b.width;  onSize(w, n); }} />
        </div>
      </div>

      <PropHR />

      {/* Fill */}
      <div className="px-3 py-2.5">
        <PropSL label="Fill" />
        <div className="flex items-center gap-1.5">
          <ColorRow color={bgColor}
            onLive={(c) => setBgColor(c)}
            onCommit={(c) => { setBgColor(c); onStyleCommit({ background: { color: c } }); }} />
          <div className={`${ROW_CLS} w-[52px] shrink-0 gap-[3px] px-[6px] py-[5px]`} style={ROW_STYLE}>
            <input type="number" min={0} max={100}
              defaultValue={Math.round((st.background?.opacity ?? 1) * 100)}
              onBlur={(e) => onStyleCommit({ background: { opacity: Math.max(0, Math.min(1, Number(e.target.value) / 100)) } })}
              className={`${IP_CLS} w-full text-right text-[11px]`}
              style={{ color: "var(--st-text)" }} />
            <span className="text-[9px] shrink-0 select-none" style={{ color: "var(--st-text-3)" }}>%</span>
          </div>
        </div>
      </div>

      <PropHR />

      {/* Border */}
      <div className="px-3 py-2.5">
        <PropSL label="Border" />
        <div className="grid grid-cols-2 gap-1 mb-1.5">
          <NumBox label="R" value={typeof st.border?.radius === "number" ? st.border.radius : 0}
            onChange={(n) => onStyleCommit({ border: { radius: n } })} />
          <NumBox label="W" value={st.border?.width ?? 0}
            onChange={(n) => onStyleCommit({ border: { width: n } })} />
        </div>
        <ColorRow color={brdColor}
          onLive={(c) => setBrdColor(c)}
          onCommit={(c) => { setBrdColor(c); onStyleCommit({ border: { color: c } }); }} />
      </div>

      <PropHR />

      {/* Typography */}
      <div className="px-3 py-2.5">
        <PropSL label="Typography" />
        <div className="grid grid-cols-2 gap-1 mb-1.5">
          <NumBox label="Sz" value={st.typography?.fontSize ?? 14}
            onChange={(n) => onStyleCommit({ typography: { fontSize: n } })} />
          <div className={ROW_CLS} style={ROW_STYLE}>
            <span className="pl-[7px] text-[9px] font-semibold shrink-0 select-none" style={{ color: "var(--st-text-3)" }}>Wt</span>
            <select
              defaultValue={String(st.typography?.fontWeight ?? "400")}
              onChange={(e) => onStyleCommit({ typography: { fontWeight: e.target.value as TypographyStyle["fontWeight"] } })}
              className={`${IP_CLS} flex-1 py-[5px] pr-[4px] text-[11px] cursor-pointer`}
              style={{ color: "var(--st-text)" }}>
              {[["100","Thin"],["200","ExLight"],["300","Light"],["400","Regular"],["500","Medium"],["600","SemiBold"],["700","Bold"],["800","ExBold"],["900","Black"]].map(([v,l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mb-1.5">
          <ColorRow color={txtColor}
            onLive={(c) => setTxtColor(c)}
            onCommit={(c) => { setTxtColor(c); onStyleCommit({ typography: { color: c } }); }} />
        </div>
        <div className="flex gap-1">
          {(["left","center","right"] as const).map((align) => (
            <button key={align}
              onClick={() => onStyleCommit({ typography: { textAlign: align } })}
              className="flex-1 rounded-[4px] py-[5px] text-[11px] font-medium"
              style={{
                background: (st.typography?.textAlign ?? "left") === align ? "var(--st-brand-tint)" : "var(--st-bg)",
                color: (st.typography?.textAlign ?? "left") === align ? "var(--st-brand)" : "var(--st-text-3)",
                border: "1px solid var(--st-border-2)",
              }}>
              {align === "left" ? "←" : align === "center" ? "↔" : "→"}
            </button>
          ))}
        </div>
      </div>

      {/* Spacing */}
      <PropHR />
      <div className="px-3 py-2.5">
        <PropSL label="Spacing" />
        <div className="grid grid-cols-2 gap-1">
          <NumBox label="Pad"
            value={Array.isArray(st.spacing?.padding) ? (st.spacing!.padding as number[])[0] : ((st.spacing?.padding as number) ?? 0)}
            onChange={(n) => onStyleCommit({ spacing: { padding: n } })} />
          <NumBox label="Gap"
            value={st.layout?.gap ?? 0}
            onChange={(n) => onStyleCommit({ layout: { gap: n } })} />
        </div>
      </div>

      {/* Auto Layout (containers only) */}
      {isCont && (
        <>
          <PropHR />
          <div className="px-3 py-2.5">
            <PropSL label="Layout" />
            <div className="flex gap-1">
              {([["none","Abs"],["row","Row"],["column","Col"]] as const).map(([val, lbl]) => {
                const cur = st.layout?.display === "flex" ? (st.layout?.direction === "column" ? "column" : "row") : "none";
                return (
                  <button key={val}
                    onClick={() => {
                      if (val === "none") onStyleCommit({ layout: { display: undefined, direction: undefined } } as Partial<StyleSchema>);
                      else onStyleCommit({ layout: { display: "flex", direction: val } } as Partial<StyleSchema>);
                    }}
                    className="flex-1 rounded-[4px] py-[5px] text-[10.5px] font-medium"
                    style={{
                      background: cur === val ? "var(--st-brand-tint)" : "var(--st-bg)",
                      color: cur === val ? "var(--st-brand)" : "var(--st-text-3)",
                      border: "1px solid var(--st-border-2)",
                    }}>
                    {lbl}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Content */}
      {textKey && (
        <>
          <PropHR />
          <div className="px-3 py-2.5">
            <PropSL label="Content" />
            <input type="text"
              defaultValue={String(comp.props?.[textKey] ?? "")}
              onBlur={(e) => onProp(textKey, e.target.value)}
              placeholder={textKey === "placeholder" ? "Placeholder…" : "Text…"}
              className="w-full rounded-[4px] px-2 py-[6px] text-[12px] outline-none"
              style={{ background: "var(--st-bg)", border: "1px solid var(--st-border-2)", color: "var(--st-text)" }} />
          </div>
        </>
      )}

      {/* Binding */}
      {showBinding && (
        <>
          <PropHR />
          <div className="px-3 py-2.5">
            <PropSL label="Binding" />
            {["input","select","checkbox","switch","radio","searchInput"].includes(comp.type) && (
              <div className="mb-1.5 flex items-center gap-2">
                <span className="w-9 shrink-0 text-[10px]" style={{ color: "var(--st-text-3)" }}>Value</span>
                <input type="text" placeholder="$form.field"
                  defaultValue={String(comp.bindings?.value ?? "")}
                  onBlur={(e) => onBind("value", e.target.value.trim())}
                  className="flex-1 rounded-[4px] px-2 py-[5px] font-mono text-[10.5px] outline-none"
                  style={{ background: "var(--st-bg)", border: "1px solid var(--st-border-2)", color: "var(--st-text)" }} />
              </div>
            )}
            {["text","statCard"].includes(comp.type) && (
              <div className="mb-1.5 flex items-center gap-2">
                <span className="w-9 shrink-0 text-[10px]" style={{ color: "var(--st-text-3)" }}>{comp.type === "statCard" ? "Value" : "Text"}</span>
                <input type="text" placeholder="$currentUser.name"
                  defaultValue={String(comp.bindings?.text ?? comp.bindings?.value ?? "")}
                  onBlur={(e) => onBind(comp.type === "statCard" ? "value" : "text", e.target.value.trim())}
                  className="flex-1 rounded-[4px] px-2 py-[5px] font-mono text-[10.5px] outline-none"
                  style={{ background: "var(--st-bg)", border: "1px solid var(--st-border-2)", color: "var(--st-text)" }} />
              </div>
            )}
            {comp.type === "button" && (
              <div className="flex items-center gap-2">
                <span className="w-9 shrink-0 text-[10px]" style={{ color: "var(--st-text-3)" }}>Click</span>
                <select
                  defaultValue={(comp.events?.onClick?.[0] as string) ?? ""}
                  onChange={(e) => onClickAction(e.target.value)}
                  className="flex-1 rounded-[4px] px-2 py-[5px] text-[11px] outline-none"
                  style={{ background: "var(--st-bg)", border: "1px solid var(--st-border-2)", color: "var(--st-text)" }}>
                  <option value="">— none —</option>
                  {globalActions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}
          </div>
        </>
      )}

      <div className="h-3 shrink-0" />
    </div>
  );
}
