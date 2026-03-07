// ═══════════════════════════════════════════════════════════════
// Editor State — Separation of editor concerns from scene data
//
// Figma separates:
//   Scene:  Nodes, Transforms, Hierarchy (persisted)
//   Editor: Selection, Hover, Active tool, Snap guides, Drag state
//           (ephemeral, local to each user)
//
// This separation is critical because:
//   1. Scene data is synced between users via CRDT
//   2. Editor state is per-user (each user has their own selection)
//   3. Scene data is serialized/persisted
//   4. Editor state is transient
//
// This module provides the EditorState class that holds all
// ephemeral editor state in one place.
// ═══════════════════════════════════════════════════════════════

import type { Vec2, AABB, HandlePosition, CanvasShape, Camera } from "./canvasEngine";
import type { SnapGuide } from "./snappingEngine";
import type { VirtualGroup } from "./multiSelectionSolver";
import type { InteractionState } from "./interactionStateMachine";

// ── Editor State ──────────────────────────────────────────────

export interface EditorSnapshot {
  selectedIds: Set<string>;
  hoveredId: string | null;
  tool: string;
  interactionState: InteractionState;
  camera: Camera;
}

/**
 * EditorState holds all ephemeral, per-user editor state.
 * This is NOT synced between users. Each user has their own instance.
 */
export class EditorState {
  // ── Selection ───────────────────────────────────────────
  /** Currently selected shape IDs */
  selectedIds: Set<string> = new Set();
  /** Hovered shape ID */
  hoveredId: string | null = null;
  /** Multi-selection virtual group */
  virtualGroup: VirtualGroup | null = null;

  // ── Tool / Mode ─────────────────────────────────────────
  /** Active tool (select, hand, rectangle, etc.) */
  tool: string = "select";
  /** Current interaction state */
  interactionState: InteractionState = "idle";

  // ── Camera ──────────────────────────────────────────────
  camera: Camera = { x: 0, y: 0, zoom: 1 };

  // ── Drag State ──────────────────────────────────────────
  /** World position where drag started */
  dragStart: Vec2 | null = null;
  /** Current world position during drag */
  dragCurrent: Vec2 | null = null;
  /** Screen position where pan started */
  panStart: Vec2 | null = null;
  /** Per-shape offsets from drag point */
  dragOffsets: Map<string, Vec2> = new Map();

  // ── Resize / Rotate State ───────────────────────────────
  /** Active resize handle */
  resizeHandle: HandlePosition | null = null;
  /** Original shape data at resize start */
  resizeOrigin: { shape: CanvasShape; mouse: Vec2 } | null = null;
  /** Rotation start data */
  rotateStart: { angle: number; shapeRotation: number } | null = null;

  // ── Marquee Selection ───────────────────────────────────
  /** Current marquee selection rectangle (world space) */
  marqueeRect: AABB | null = null;

  // ── Drawing Preview ─────────────────────────────────────
  /** Preview shape during drawing */
  drawPreview: { type: string; x: number; y: number; w: number; h: number } | null = null;
  /** Pen points during pen drawing */
  penPoints: Vec2[] = [];

  // ── Snap Guides ─────────────────────────────────────────
  /** Active snap guides to render */
  snapGuides: SnapGuide[] = [];

  // ── Drop Target ─────────────────────────────────────────
  /** Current drop target frame ID during drag */
  dropTargetId: string | null = null;

  // ── Undo Snapshot ───────────────────────────────────────
  /** Shapes snapshot captured at interaction start (for undo) */
  snapshotBeforeInteraction: CanvasShape[] | null = null;

  // ── Cursor ──────────────────────────────────────────────
  cursor: string = "default";

  // ── Methods ─────────────────────────────────────────────

  /** Set selection (replaces current) */
  setSelection(ids: Set<string>): void {
    this.selectedIds = ids;
    this.virtualGroup = null; // Invalidate virtual group
  }

  /** Add to selection */
  addToSelection(id: string): void {
    this.selectedIds = new Set([...this.selectedIds, id]);
    this.virtualGroup = null;
  }

  /** Remove from selection */
  removeFromSelection(id: string): void {
    const next = new Set(this.selectedIds);
    next.delete(id);
    this.selectedIds = next;
    this.virtualGroup = null;
  }

  /** Toggle selection */
  toggleSelection(id: string): void {
    if (this.selectedIds.has(id)) {
      this.removeFromSelection(id);
    } else {
      this.addToSelection(id);
    }
  }

  /** Clear all selection */
  clearSelection(): void {
    this.selectedIds = new Set();
    this.hoveredId = null;
    this.virtualGroup = null;
  }

  /** Whether any shapes are selected */
  hasSelection(): boolean {
    return this.selectedIds.size > 0;
  }

  /** Whether multiple shapes are selected */
  isMultiSelect(): boolean {
    return this.selectedIds.size > 1;
  }

  /** Begin a drag interaction */
  beginDrag(worldPos: Vec2): void {
    this.dragStart = worldPos;
    this.dragCurrent = worldPos;
    this.interactionState = "dragging";
  }

  /** Begin a resize interaction */
  beginResize(handle: HandlePosition, shape: CanvasShape, mousePos: Vec2): void {
    this.resizeHandle = handle;
    this.resizeOrigin = { shape: { ...shape }, mouse: mousePos };
    this.interactionState = "resizing";
  }

  /** Begin a rotation interaction */
  beginRotate(currentAngle: number, shapeRotation: number): void {
    this.rotateStart = { angle: currentAngle, shapeRotation };
    this.interactionState = "rotating";
  }

  /** Begin panning */
  beginPan(screenPos: Vec2): void {
    this.panStart = screenPos;
    this.interactionState = "panning";
    this.cursor = "grabbing";
  }

  /** Begin marquee select */
  beginMarquee(worldPos: Vec2): void {
    this.dragStart = worldPos;
    this.marqueeRect = null;
    this.interactionState = "marquee-selecting";
  }

  /** Begin drawing */
  beginDraw(worldPos: Vec2): void {
    this.dragStart = worldPos;
    this.drawPreview = null;
    this.interactionState = "drawing";
  }

  /** End current interaction, reset transient state */
  endInteraction(): void {
    this.interactionState = "idle";
    this.dragStart = null;
    this.dragCurrent = null;
    this.panStart = null;
    this.resizeHandle = null;
    this.resizeOrigin = null;
    this.rotateStart = null;
    this.marqueeRect = null;
    this.drawPreview = null;
    this.dropTargetId = null;
    this.snapGuides = [];
    this.snapshotBeforeInteraction = null;
    this.dragOffsets = new Map();
    this.cursor = this.cursorForTool(this.tool);
  }

  /** Capture shapes snapshot for undo at interaction start */
  captureSnapshot(shapes: CanvasShape[]): void {
    this.snapshotBeforeInteraction = shapes.map(s => ({ ...s }));
  }

  /** Get cursor style for current tool */
  private cursorForTool(tool: string): string {
    switch (tool) {
      case "hand": return "grab";
      case "select": return "default";
      default: return "crosshair";
    }
  }

  /** Create a serializable snapshot of editor state */
  snapshot(): EditorSnapshot {
    return {
      selectedIds: new Set(this.selectedIds),
      hoveredId: this.hoveredId,
      tool: this.tool,
      interactionState: this.interactionState,
      camera: { ...this.camera },
    };
  }

  /** Restore from snapshot */
  restore(snap: EditorSnapshot): void {
    this.selectedIds = new Set(snap.selectedIds);
    this.hoveredId = snap.hoveredId;
    this.tool = snap.tool;
    this.interactionState = snap.interactionState;
    this.camera = { ...snap.camera };
  }
}
