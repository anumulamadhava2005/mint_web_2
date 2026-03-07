// ═══════════════════════════════════════════════════════════════
// Workspace Store — Zustand (replaces Potok event-driven store)
// Mirrors: frontend/src/app/main/store.cljs + refs.cljs
// ═══════════════════════════════════════════════════════════════

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { enableMapSet } from "immer";

enableMapSet();

import type {
  UUID,
  PenpotFile,
  PenpotShape,
  Page,
  ShapeKind,
  Point,
  Flow,
  Interaction,
} from "./types";
import { ROOT_FRAME_ID, createBlankPage, createDefaultShape } from "./types";
import type { FileChange, ChangeSet } from "./changes";
import { applyChanges, generateUndoChanges } from "./changes";
import * as repo from "./repo";
import type { Viewbox, Viewport } from "./geom";
import { adjustForReflow, adjustForResize, adjustForMove, adjustForStructure } from "./layout";

// ── Workspace Local State ─────────────────────────────────────
export interface WorkspaceLocal {
  zoom: number;
  vbox: Viewbox;
  vport: Viewport;
  selected: Set<UUID>;
  edition: UUID | null; // currently edited shape
  panning: boolean;
  transform: "move" | "resize" | "rotate" | null;
  drawing: { tool: ShapeKind; object?: Partial<PenpotShape> } | null;
  editPath: any | null;
  highlighted: Set<UUID>;
  hoveredShapeId: UUID | null;
  selectionRect: { x: number; y: number; width: number; height: number } | null;
}

// ── Presence (other users' cursors) ───────────────────────────
export interface PresenceInfo {
  profileId: UUID;
  profileName: string;
  profileColor: string;
  x: number;
  y: number;
  pageId?: UUID;
  selection?: UUID[];
}

// ── Options Mode ──────────────────────────────────────────────
export type OptionsMode = "design" | "inspect" | "prototype";

// ── Undo/Redo entry ───────────────────────────────────────────
interface UndoEntry {
  changes: FileChange[];
  undoChanges: FileChange[];
}

// ── Store Shape ───────────────────────────────────────────────
export interface WorkspaceState {
  // Profile
  profile: { id: UUID; email: string } | null;

  // File / Document
  file: PenpotFile | null;
  currentPageId: UUID | null;
  sessionId: UUID;

  // Local workspace state
  local: WorkspaceLocal;

  // UI mode
  optionsMode: OptionsMode;
  showRulers: boolean;
  showGuides: boolean;
  showGrid: boolean;
  snapToObjects: boolean;
  snapToGrid: boolean;

  // Presence (other users)
  presence: Map<UUID, PresenceInfo>;

  // Connection
  connected: boolean;
  saving: boolean;
  dirty: boolean;
  lastSaved: string | null;

  // Undo/Redo stacks
  undoStack: UndoEntry[];
  redoStack: UndoEntry[];

  // ── Derived (computed) ────────────────────────────────────
  /** Current page data */
  currentPage: () => Page | null;
  /** All objects on current page */
  currentPageObjects: () => Record<UUID, PenpotShape>;
  /** Selected shapes */
  selectedShapes: () => PenpotShape[];

  // ── Actions ───────────────────────────────────────────────

  // File operations
  initWorkspace: (fileId: UUID) => Promise<void>;
  saveFile: () => Promise<void>;

  // Page operations
  setCurrentPage: (pageId: UUID) => void;
  addPage: (name?: string) => void;
  deletePage: (pageId: UUID) => void;
  renamePage: (pageId: UUID, name: string) => void;

  // Shape operations (these generate changes)
  addShape: (type: ShapeKind, props?: Partial<PenpotShape>) => UUID | null;
  updateShape: (id: UUID, attrs: Partial<PenpotShape>) => void;
  /** Update shape directly without creating an undo entry (used during drag/resize) */
  updateShapeDirect: (id: UUID, attrs: Partial<PenpotShape>) => void;
  /** Commit a batch of buffered changes as a single undo entry */
  commitShapeChanges: (originalShapes: Record<UUID, Partial<PenpotShape>>, currentShapes: Record<UUID, Partial<PenpotShape>>) => void;
  deleteShapes: (ids: UUID[]) => void;
  moveShapes: (ids: UUID[], parentId: UUID, index?: number) => void;
  duplicateShapes: (ids: UUID[]) => void;

  // Selection
  selectShape: (id: UUID, multi?: boolean) => void;
  deselectAll: () => void;
  selectAll: () => void;

  // Local state
  setZoom: (zoom: number) => void;
  setViewbox: (vbox: Viewbox) => void;
  setViewport: (vport: Viewport) => void;
  setPanning: (panning: boolean) => void;
  setTransform: (t: "move" | "resize" | "rotate" | null) => void;
  setDrawing: (tool: ShapeKind | null) => void;
  setEdition: (id: UUID | null) => void;
  setHoveredShape: (id: UUID | null) => void;
  setSelectionRect: (rect: { x: number; y: number; width: number; height: number } | null) => void;

  // UI mode
  setOptionsMode: (mode: OptionsMode) => void;
  toggleRulers: () => void;
  toggleGrid: () => void;
  toggleSnapToObjects: () => void;
  toggleSnapToGrid: () => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Prototyping
  addInteraction: (shapeId: UUID, interaction: Interaction) => void;
  removeInteraction: (shapeId: UUID, interactionId: UUID) => void;
  setFlow: (flow: Flow) => void;
  deleteFlow: (flowId: UUID) => void;

  // Collaboration / Presence
  setPresence: (profileId: UUID, info: PresenceInfo) => void;
  removePresence: (profileId: UUID) => void;
  setConnected: (connected: boolean) => void;

  // Apply remote changes
  applyRemoteChanges: (changes: FileChange[]) => void;

  // Set profile
  setProfile: (profile: { id: UUID; email: string } | null) => void;
}

// ── Create Store ──────────────────────────────────────────────
export const useWorkspaceStore = create<WorkspaceState>()(
  immer((set, get) => ({
    // Initial state
    profile: null,
    file: null,
    currentPageId: null,
    sessionId: crypto.randomUUID(),

    local: {
      zoom: 1,
      vbox: { x: 0, y: 0, width: 1920, height: 1080 },
      vport: { width: 1920, height: 1080 },
      selected: new Set(),
      edition: null,
      panning: false,
      transform: null,
      drawing: null,
      editPath: null,
      highlighted: new Set(),
      hoveredShapeId: null,
      selectionRect: null,
    },

    optionsMode: "design",
    showRulers: true,
    showGuides: true,
    showGrid: false,
    snapToObjects: true,
    snapToGrid: false,

    presence: new Map(),
    connected: false,
    saving: false,
    dirty: false,
    lastSaved: null,

    undoStack: [],
    redoStack: [],

    // ── Derived ─────────────────────────────────────────────
    currentPage: () => {
      const { file, currentPageId } = get();
      if (!file || !currentPageId) return null;
      return file.pagesIndex[currentPageId] || null;
    },

    currentPageObjects: () => {
      const page = get().currentPage();
      return page?.objects || {};
    },

    selectedShapes: () => {
      const objects = get().currentPageObjects();
      return Array.from(get().local.selected)
        .map((id) => objects[id])
        .filter(Boolean);
    },

    // ── File Operations ─────────────────────────────────────
    initWorkspace: async (fileId: UUID) => {
      try {
        const { file: rawFile } = await repo.getFile(fileId);
        const fileData =
          typeof rawFile.data === "string"
            ? JSON.parse(rawFile.data)
            : rawFile.data;

        const file: PenpotFile = {
          id: rawFile.id,
          name: rawFile.name,
          projectId: rawFile.project_id,
          revn: parseInt(rawFile.revn, 10) || 0,
          pages: fileData?.pages || [],
          pagesIndex: fileData?.pagesIndex || {},
          colors: fileData?.colors || {},
          typographies: fileData?.typographies || {},
          components: fileData?.components || {},
          createdAt: rawFile.created_at,
          modifiedAt: rawFile.modified_at,
        };

        // Ensure at least one page
        if (file.pages.length === 0) {
          const pageId = crypto.randomUUID();
          const page = createBlankPage(pageId, "Page 1");
          file.pages.push(pageId);
          file.pagesIndex[pageId] = page;
        }

        set((state) => {
          state.file = file as any;
          state.currentPageId = file.pages[0];
        });

        // Persist initial structure so it isn't lost on refresh
        if (fileData?.pages === undefined || fileData?.pages?.length === 0) {
          // Schedule initial save to persist the blank page
          queueMicrotask(() => get().saveFile());
        }
      } catch (e) {
        console.error("Failed to init workspace:", e);
      }
    },

    saveFile: async () => {
      const { file, sessionId } = get();
      if (!file) return;

      // Skip save if no changes in undo stack since last save
      set((state) => { state.saving = true; });

      try {
        // Build the full file data snapshot for persistence
        const fileData = {
          pages: file.pages,
          pagesIndex: file.pagesIndex,
          colors: file.colors,
          typographies: file.typographies,
          components: file.components,
        };

        // Single POST: save full data snapshot via the changes endpoint
        const res = await fetch("/api/files/changes", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileId: file.id,
            sessionId,
            revn: file.revn,
            changes: [{
              type: "mod-page",
              id: file.pages[0],
              name: file.pagesIndex[file.pages[0]]?.name,
            }],
            // Include full data snapshot for the server to persist
            snapshotData: fileData,
          }),
        });

        if (res.ok) {
          const result = await res.json();
          set((state) => {
            state.saving = false;
            state.dirty = false;
            state.lastSaved = new Date().toISOString();
            if (state.file) state.file.revn = result.revn;
          });
        } else {
          set((state) => { state.saving = false; });
        }
      } catch (e) {
        console.error("Failed to save:", e);
        set((state) => { state.saving = false; });
      }
    },

    // ── Page Operations ─────────────────────────────────────
    setCurrentPage: (pageId) => {
      set((state) => {
        state.currentPageId = pageId;
        state.local.selected = new Set() as any;
        state.local.edition = null;
      });
    },

    addPage: (name) => {
      const pageId = crypto.randomUUID();
      const page = createBlankPage(pageId, name || `Page ${(get().file?.pages.length || 0) + 1}`);

      const change: FileChange = { type: "add-page", page };
      applyAndRecord(set, get, [change]);
    },

    deletePage: (pageId) => {
      const file = get().file;
      if (!file || file.pages.length <= 1) return;

      const change: FileChange = { type: "del-page", id: pageId };
      applyAndRecord(set, get, [change]);

      // Switch to another page if current was deleted
      if (get().currentPageId === pageId) {
        set((state) => {
          state.currentPageId = state.file!.pages[0] || null;
        });
      }
    },

    renamePage: (pageId, name) => {
      const change: FileChange = { type: "mod-page", id: pageId, name };
      applyAndRecord(set, get, [change]);
    },

    // ── Shape Operations ────────────────────────────────────
    addShape: (type, props) => {
      const { currentPageId, file } = get();
      if (!currentPageId || !file) return null;

      const shape = createDefaultShape(type, props);
      const targetParentId = props?.parentId || ROOT_FRAME_ID;
      shape.parentId = targetParentId;

      const parentShape = file.pagesIndex[currentPageId]?.objects[targetParentId];
      shape.frameId = parentShape?.type === "frame" ? targetParentId : (parentShape?.frameId || ROOT_FRAME_ID);

      // If parent is a layout frame, set default layout child props
      if (parentShape?.layoutProps?.layout && !shape.layoutItemProps) {
        shape.layoutItemProps = {
          layoutItemHSizing: "fix",
          layoutItemVSizing: "fix",
        };
      }

      const change: FileChange = {
        type: "add-obj",
        pageId: currentPageId,
        id: shape.id,
        parentId: targetParentId,
        frameId: shape.frameId,
        obj: shape,
      };

      applyAndRecord(set, get, [change]);

      // Trigger layout reflow on the parent if it has a layout
      runLayoutReflow(set, get, [targetParentId]);

      // Auto-select
      set((state) => {
        state.local.selected = new Set([shape.id]) as any;
        state.local.drawing = null;
      });

      return shape.id;
    },

    updateShape: (id, attrs) => {
      const { currentPageId } = get();
      if (!currentPageId) return;

      const operations = Object.entries(attrs).map(([attr, val]) => ({
        type: "set" as const,
        attr,
        val,
      }));

      const change: FileChange = {
        type: "mod-obj",
        pageId: currentPageId,
        id,
        operations,
      };

      applyAndRecord(set, get, [change]);

      // Trigger layout adjustment if geometry changed
      const geometryAttrs = ["x", "y", "width", "height", "rotation"];
      const hasGeometryChange = Object.keys(attrs).some((a) => geometryAttrs.includes(a));
      const layoutAttrs = ["layoutProps", "layoutItemProps"];
      const hasLayoutChange = Object.keys(attrs).some((a) => layoutAttrs.includes(a));

      if (hasGeometryChange || hasLayoutChange) {
        const objects = get().currentPageObjects();
        const shape = objects[id];
        if (shape) {
          const parentIds = shape.parentId ? [shape.parentId] : [];
          // If the shape itself is a layout container, reflow it
          if (shape.layoutProps?.layout) parentIds.push(id);
          if (parentIds.length > 0) {
            runLayoutReflow(set, get, parentIds);
          }
        }
      }
    },

    updateShapeDirect: (id, attrs) => {
      // Update shape in-place without generating an undo entry — used during drag/resize
      const { currentPageId } = get();
      if (!currentPageId) return;

      set((state) => {
        const page = state.file?.pagesIndex[currentPageId];
        if (!page) return;
        const shape = page.objects[id];
        if (!shape) return;
        Object.assign(shape, attrs);

        // Run layout adjustment inline for direct updates (real-time)
        const geometryAttrs = ["x", "y", "width", "height", "rotation"];
        if (Object.keys(attrs).some((a) => geometryAttrs.includes(a))) {
          const parentIds: UUID[] = [];
          if (shape.parentId) parentIds.push(shape.parentId);
          if (shape.layoutProps?.layout) parentIds.push(id);
          if (parentIds.length > 0) {
            const adjusted = adjustForReflow(parentIds, page.objects);
            for (const [sid, adjustedShape] of Object.entries(adjusted)) {
              if (sid !== id && page.objects[sid]) {
                Object.assign(page.objects[sid], adjustedShape);
              }
            }
          }
        }
      });
    },

    commitShapeChanges: (originalShapes, currentShapes) => {
      // Create a single undo entry from original → current for all affected shapes
      const { currentPageId, file } = get();
      if (!currentPageId || !file) return;

      const changes: FileChange[] = [];
      const undoChanges: FileChange[] = [];

      for (const [id, current] of Object.entries(currentShapes)) {
        const original = originalShapes[id];
        if (!original) continue;

        const fwdOps = Object.entries(current).map(([attr, val]) => ({
          type: "set" as const,
          attr,
          val,
        }));
        const revOps = Object.entries(original).map(([attr, val]) => ({
          type: "set" as const,
          attr,
          val,
        }));

        changes.push({
          type: "mod-obj",
          pageId: currentPageId,
          id: id as UUID,
          operations: fwdOps,
        });
        undoChanges.push({
          type: "mod-obj",
          pageId: currentPageId,
          id: id as UUID,
          operations: revOps,
        });
      }

      if (changes.length === 0) return;

      set((state: any) => {
        state.dirty = true;
        state.undoStack.push({ changes, undoChanges: undoChanges.reverse() });
        state.redoStack = [];
        if (state.undoStack.length > 100) state.undoStack.shift();
      });

      // Broadcast the final changes
      if (_changeBroadcaster) {
        _changeBroadcaster(changes, file.revn);
      }
    },

    deleteShapes: (ids) => {
      const { currentPageId } = get();
      if (!currentPageId) return;

      // Collect parent IDs before deletion for reflow
      const objects = get().currentPageObjects();
      const parentIds = new Set<UUID>();
      for (const id of ids) {
        const shape = objects[id];
        if (shape?.parentId) parentIds.add(shape.parentId);
      }

      const changes: FileChange[] = ids.map((id) => ({
        type: "del-obj",
        pageId: currentPageId,
        id,
      }));

      applyAndRecord(set, get, changes);

      // Trigger layout reflow on affected parents
      if (parentIds.size > 0) {
        runLayoutReflow(set, get, [...parentIds]);
      }

      set((state) => {
        for (const id of ids) {
          state.local.selected.delete(id);
        }
      });
    },

    moveShapes: (ids, parentId, index) => {
      const { currentPageId } = get();
      if (!currentPageId) return;

      // Collect old parent IDs for reflow
      const objects = get().currentPageObjects();
      const affectedParents = new Set<UUID>();
      affectedParents.add(parentId); // New parent
      for (const id of ids) {
        const shape = objects[id];
        if (shape?.parentId) affectedParents.add(shape.parentId);
      }

      const change: FileChange = {
        type: "mov-objects",
        pageId: currentPageId,
        parentId,
        shapes: ids,
        index,
      };

      applyAndRecord(set, get, [change]);

      // Reset constraints for moved shapes based on new parent type
      const newParent = get().currentPageObjects()[parentId];
      if (newParent) {
        const constraintChanges: FileChange[] = [];
        for (const id of ids) {
          const defaultH = newParent.type === "frame" ? "left" : "scale";
          const defaultV = newParent.type === "frame" ? "top" : "scale";
          constraintChanges.push({
            type: "mod-obj",
            pageId: currentPageId,
            id,
            operations: [
              { type: "set", attr: "constraintsH", val: defaultH },
              { type: "set", attr: "constraintsV", val: defaultV },
            ],
          });
          // Set default layout item props if moving into a layout frame
          if (newParent.layoutProps?.layout) {
            constraintChanges.push({
              type: "mod-obj",
              pageId: currentPageId,
              id,
              operations: [
                {
                  type: "set",
                  attr: "layoutItemProps",
                  val: { layoutItemHSizing: "fix", layoutItemVSizing: "fix" },
                },
              ],
            });
          }
        }
        if (constraintChanges.length > 0) {
          // Apply constraint resets without separate undo entry
          const file = get().file;
          if (file) {
            const updatedFile = applyChanges(file, constraintChanges);
            set((state: any) => { state.file = updatedFile; });
          }
        }
      }

      // Trigger layout reflow on all affected parents
      runLayoutReflow(set, get, [...affectedParents]);
    },

    duplicateShapes: (ids) => {
      const objects = get().currentPageObjects();
      const { currentPageId } = get();
      if (!currentPageId) return;

      const changes: FileChange[] = [];
      const newIds: UUID[] = [];

      for (const id of ids) {
        const shape = objects[id];
        if (!shape) continue;

        const newId = crypto.randomUUID();
        newIds.push(newId);

        changes.push({
          type: "add-obj",
          pageId: currentPageId,
          id: newId,
          parentId: shape.parentId || ROOT_FRAME_ID,
          frameId: shape.frameId,
          obj: {
            ...structuredClone(shape),
            id: newId,
            name: shape.name + " copy",
            x: shape.x + 20,
            y: shape.y + 20,
          },
        });
      }

      applyAndRecord(set, get, changes);

      set((state) => {
        state.local.selected = new Set(newIds) as any;
      });
    },

    // ── Selection ───────────────────────────────────────────
    selectShape: (id, multi = false) => {
      set((state) => {
        if (multi) {
          if (state.local.selected.has(id)) {
            state.local.selected.delete(id);
          } else {
            state.local.selected.add(id);
          }
        } else {
          state.local.selected = new Set([id]) as any;
        }
      });
    },

    deselectAll: () => {
      set((state) => {
        state.local.selected = new Set() as any;
        state.local.edition = null;
      });
    },

    selectAll: () => {
      const objects = get().currentPageObjects();
      const root = objects[ROOT_FRAME_ID];
      set((state) => {
        state.local.selected = new Set(root?.shapes || []) as any;
      });
    },

    // ── Local State ─────────────────────────────────────────
    setZoom: (zoom) => set((s) => { s.local.zoom = Math.max(0.01, Math.min(256, zoom)); }),
    setViewbox: (vbox) => set((s) => { s.local.vbox = vbox as any; }),
    setViewport: (vport) => set((s) => { s.local.vport = vport as any; }),
    setPanning: (panning) => set((s) => { s.local.panning = panning; }),
    setTransform: (t) => set((s) => { s.local.transform = t; }),
    setDrawing: (tool) => set((s) => {
      s.local.drawing = tool ? { tool } : null;
    }),
    setEdition: (id) => set((s) => { s.local.edition = id; }),
    setHoveredShape: (id) => set((s) => { s.local.hoveredShapeId = id; }),
    setSelectionRect: (rect) => set((s) => { s.local.selectionRect = rect as any; }),

    // ── UI Mode ─────────────────────────────────────────────
    setOptionsMode: (mode) => set((s) => { s.optionsMode = mode; }),
    toggleRulers: () => set((s) => { s.showRulers = !s.showRulers; }),
    toggleGrid: () => set((s) => { s.showGrid = !s.showGrid; }),
    toggleSnapToObjects: () => set((s) => { s.snapToObjects = !s.snapToObjects; }),
    toggleSnapToGrid: () => set((s) => { s.snapToGrid = !s.snapToGrid; }),

    // ── Undo / Redo ─────────────────────────────────────────
    undo: () => {
      const { undoStack, file } = get();
      if (undoStack.length === 0 || !file) return;

      const entry = undoStack[undoStack.length - 1];
      const newFile = applyChanges(file, entry.undoChanges);

      set((state) => {
        state.file = newFile as any;
        state.undoStack.pop();
        state.redoStack.push(entry as any);
      });
    },

    redo: () => {
      const { redoStack, file } = get();
      if (redoStack.length === 0 || !file) return;

      const entry = redoStack[redoStack.length - 1];
      const newFile = applyChanges(file, entry.changes);

      set((state) => {
        state.file = newFile as any;
        state.redoStack.pop();
        state.undoStack.push(entry as any);
      });
    },

    canUndo: () => get().undoStack.length > 0,
    canRedo: () => get().redoStack.length > 0,

    // ── Prototyping ─────────────────────────────────────────
    addInteraction: (shapeId, interaction) => {
      const { currentPageId } = get();
      if (!currentPageId) return;

      const objects = get().currentPageObjects();
      const shape = objects[shapeId];
      if (!shape) return;

      const interactions = [...(shape.interactions || []), interaction];
      const change: FileChange = {
        type: "mod-obj",
        pageId: currentPageId,
        id: shapeId,
        operations: [{ type: "set", attr: "interactions", val: interactions }],
      };
      applyAndRecord(set, get, [change]);
    },

    removeInteraction: (shapeId, interactionId) => {
      const { currentPageId } = get();
      if (!currentPageId) return;

      const objects = get().currentPageObjects();
      const shape = objects[shapeId];
      if (!shape) return;

      const interactions = (shape.interactions || []).filter((i) => i.id !== interactionId);
      const change: FileChange = {
        type: "mod-obj",
        pageId: currentPageId,
        id: shapeId,
        operations: [{ type: "set", attr: "interactions", val: interactions }],
      };
      applyAndRecord(set, get, [change]);
    },

    setFlow: (flow) => {
      const { currentPageId } = get();
      if (!currentPageId) return;
      const change: FileChange = { type: "set-flow", pageId: currentPageId, flow };
      applyAndRecord(set, get, [change]);
    },

    deleteFlow: (flowId) => {
      const { currentPageId } = get();
      if (!currentPageId) return;
      const change: FileChange = { type: "del-flow", pageId: currentPageId, id: flowId };
      applyAndRecord(set, get, [change]);
    },

    // ── Collaboration ───────────────────────────────────────
    setPresence: (profileId, info) => {
      set((state) => {
        state.presence.set(profileId, info as any);
      });
    },
    removePresence: (profileId) => {
      set((state) => {
        state.presence.delete(profileId);
      });
    },
    setConnected: (connected) => set((s) => { s.connected = connected; }),

    applyRemoteChanges: (changes) => {
      const { file, currentPageId } = get();
      if (!file) return;
      const newFile = applyChanges(file, changes);
      set((state) => {
        state.file = newFile as any;
      });

      // Trigger layout reflow for affected layout parents
      if (currentPageId) {
        const affectedParents = new Set<UUID>();
        for (const change of changes) {
          if ('pageId' in change && change.pageId === currentPageId) {
            if (change.type === 'add-obj') affectedParents.add(change.parentId);
            if (change.type === 'del-obj') {
              const shape = file.pagesIndex[currentPageId]?.objects[change.id];
              if (shape?.parentId) affectedParents.add(shape.parentId);
            }
            if (change.type === 'mov-objects') affectedParents.add(change.parentId);
            if (change.type === 'mod-obj') {
              const shape = newFile.pagesIndex[currentPageId]?.objects[change.id];
              if (shape?.parentId) affectedParents.add(shape.parentId);
            }
          }
        }
        if (affectedParents.size > 0) {
          runLayoutReflow(set, get, [...affectedParents]);
        }
      }
    },

    setProfile: (profile) => set((s) => { s.profile = profile as any; }),
  }))
);

// ── Change broadcaster (set by collaboration hook) ────────────
let _changeBroadcaster: ((changes: FileChange[], revn: number) => void) | null = null;

export function setChangeBroadcaster(
  fn: ((changes: FileChange[], revn: number) => void) | null
) {
  _changeBroadcaster = fn;
}

// ── Internal: Apply changes + push to undo stack ──────────────
function applyAndRecord(
  set: any,
  get: () => WorkspaceState,
  changes: FileChange[]
) {
  const file = get().file;
  if (!file) return;

  const undoChanges = generateUndoChanges(file, changes);
  const newFile = applyChanges(file, changes);

  set((state: any) => {
    state.file = newFile;
    state.dirty = true;
    state.undoStack.push({ changes, undoChanges });
    state.redoStack = []; // Clear redo on new action
    // Limit undo stack to 100
    if (state.undoStack.length > 100) {
      state.undoStack.shift();
    }
  });

  // Broadcast to other collaborators via WebSocket
  if (_changeBroadcaster) {
    const updatedFile = get().file;
    _changeBroadcaster(changes, updatedFile?.revn ?? 0);
  }
}

// ── Internal: Run layout reflow pipeline ──────────────────────
/**
 * Trigger the layout auto-adjustment pipeline for affected parents.
 * This runs the full Penpot-style modifier pipeline:
 *   constraints → flex/grid layout → auto-sizing → group resize
 *
 * The adjusted shapes are written back as mod-obj changes
 * (without creating a separate undo entry — they are part of
 * the triggering action's undo group).
 */
function runLayoutReflow(
  set: any,
  get: () => WorkspaceState,
  parentIds: UUID[]
): void {
  const { file, currentPageId } = get();
  if (!file || !currentPageId) return;

  const page = file.pagesIndex[currentPageId];
  if (!page) return;

  // Filter to only existing parents that are layout containers or groups
  const relevantParents = parentIds.filter((pid) => {
    const parent = page.objects[pid];
    return parent && (
      parent.layoutProps?.layout ||
      parent.type === "group" ||
      parent.type === "bool"
    );
  });

  if (relevantParents.length === 0) return;

  try {
    const adjustedObjects = adjustForStructure(relevantParents, page.objects, {
      snapPixel: true,
      snapPrecision: 1,
    });

    // Collect changes
    const layoutChanges: FileChange[] = [];

    for (const [id, updatedShape] of Object.entries(adjustedObjects)) {
      const originalShape = page.objects[id];
      if (!originalShape) continue;

      const ops: Array<{ type: "set"; attr: string; val: any }> = [];

      if (updatedShape.x !== originalShape.x) ops.push({ type: "set", attr: "x", val: updatedShape.x });
      if (updatedShape.y !== originalShape.y) ops.push({ type: "set", attr: "y", val: updatedShape.y });
      if (updatedShape.width !== originalShape.width) ops.push({ type: "set", attr: "width", val: updatedShape.width });
      if (updatedShape.height !== originalShape.height) ops.push({ type: "set", attr: "height", val: updatedShape.height });
      if (updatedShape.selrect && JSON.stringify(updatedShape.selrect) !== JSON.stringify(originalShape.selrect)) {
        ops.push({ type: "set", attr: "selrect", val: updatedShape.selrect });
      }

      if (ops.length > 0) {
        layoutChanges.push({
          type: "mod-obj",
          pageId: currentPageId,
          id: id as UUID,
          operations: ops,
        });
      }
    }

    // Apply layout changes silently (no undo entry — they're part of the parent action)
    if (layoutChanges.length > 0) {
      const currentFile = get().file;
      if (currentFile) {
        const updatedFile = applyChanges(currentFile, layoutChanges);
        set((state: any) => {
          state.file = updatedFile;
        });
      }
    }
  } catch (e) {
    console.warn("Layout reflow error:", e);
  }
}
