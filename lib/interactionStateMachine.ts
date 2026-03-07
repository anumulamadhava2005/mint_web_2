// ═══════════════════════════════════════════════════════════════
// Interaction State Machine — Formal state machine for canvas
//
// Instead of messy if/else chains for mouse events, this uses
// explicit interaction states with defined transitions.
//
// Each state has its own:
//   - onEnter (setup)
//   - onUpdate (mouse move processing)
//   - onExit (cleanup)
//   - transition rules (what events cause state changes)
//
// States:
//   Idle → Hover → Selecting → Dragging → Resizing → Rotating
//       → Reparenting → Panning → MarqueeSelecting → Drawing
//       → PenDrawing
//
// This eliminates edge-case bugs that arise from ad-hoc mode tracking.
// ═══════════════════════════════════════════════════════════════

import type { CanvasShape, Vec2, HandlePosition, AABB } from "./canvasEngine";
import type { VirtualGroup } from "./multiSelectionSolver";

// ── State types ───────────────────────────────────────────────

export type InteractionState =
  | "idle"
  | "hover"
  | "selecting"
  | "dragging"
  | "resizing"
  | "rotating"
  | "reparenting"
  | "panning"
  | "marquee-selecting"
  | "drawing"
  | "pen-drawing";

// ── Event types ───────────────────────────────────────────────

export type InteractionEvent =
  | { type: "MOUSE_DOWN"; worldPos: Vec2; screenPos: Vec2; button: number; shift: boolean; ctrl: boolean }
  | { type: "MOUSE_MOVE"; worldPos: Vec2; screenPos: Vec2; shift: boolean; ctrl: boolean }
  | { type: "MOUSE_UP"; worldPos: Vec2; screenPos: Vec2; shift: boolean }
  | { type: "DOUBLE_CLICK"; worldPos: Vec2 }
  | { type: "KEY_DOWN"; key: string; ctrl: boolean; shift: boolean }
  | { type: "KEY_UP"; key: string }
  | { type: "WHEEL"; delta: Vec2; screenPos: Vec2; ctrl: boolean }
  | { type: "TOOL_CHANGE"; tool: string }
  | { type: "ESCAPE" }
  | { type: "CANCEL" };

// ── Context (shared state across all states) ──────────────────

export interface InteractionContext {
  /** Current state */
  state: InteractionState;

  /** Active tool */
  tool: string;

  /** Currently hovered shape id */
  hoveredId: string | null;

  /** Selected shape ids */
  selectedIds: Set<string>;

  /** Drag state */
  dragStart: Vec2 | null;
  dragCurrent: Vec2 | null;
  dragOffsets: Map<string, Vec2>;

  /** Pan state */
  panStart: Vec2 | null;

  /** Resize state */
  resizeHandle: HandlePosition | null;
  resizeOrigin: { shape: CanvasShape; mouse: Vec2 } | null;

  /** Rotate state */
  rotateStart: { angle: number; shapeRotation: number } | null;

  /** Marquee selection */
  marqueeRect: AABB | null;

  /** Drawing preview */
  drawPreview: { type: string; x: number; y: number; w: number; h: number } | null;

  /** Pen tool points */
  penPoints: Vec2[];

  /** Virtual group for multi-selection transforms */
  virtualGroup: VirtualGroup | null;

  /** Drop target during reparenting */
  dropTargetId: string | null;

  /** Shapes snapshot for undo (captured at interaction start) */
  snapshotBeforeInteraction: CanvasShape[] | null;

  /** Cursor style */
  cursor: string;
}

/** Create initial context */
export function createInteractionContext(): InteractionContext {
  return {
    state: "idle",
    tool: "select",
    hoveredId: null,
    selectedIds: new Set(),
    dragStart: null,
    dragCurrent: null,
    dragOffsets: new Map(),
    panStart: null,
    resizeHandle: null,
    resizeOrigin: null,
    rotateStart: null,
    marqueeRect: null,
    drawPreview: null,
    penPoints: [],
    virtualGroup: null,
    dropTargetId: null,
    snapshotBeforeInteraction: null,
    cursor: "default",
  };
}

// ── Transition result ─────────────────────────────────────────

export interface TransitionResult {
  /** New state */
  newState: InteractionState;
  /** Updated context */
  context: InteractionContext;
  /** Side effects to execute */
  effects: InteractionEffect[];
}

export type InteractionEffect =
  | { type: "SET_CURSOR"; cursor: string }
  | { type: "UPDATE_SHAPES"; updater: (shapes: CanvasShape[]) => CanvasShape[] }
  | { type: "SET_SELECTION"; ids: Set<string> }
  | { type: "SET_CAMERA"; delta: Vec2 }
  | { type: "ZOOM_AT"; focal: Vec2; delta: number }
  | { type: "ADD_SHAPE"; shape: CanvasShape }
  | { type: "SNAPSHOT_UNDO"; description: string }
  | { type: "SET_DROP_TARGET"; id: string | null }
  | { type: "RENDER_GUIDES"; guides: Array<{ axis: "x" | "y"; position: number; start: Vec2; end: Vec2 }> }
  | { type: "COMMIT_PEN_PATH"; points: Vec2[] };

/**
 * Interaction State Machine.
 * Manages all user interactions on the canvas through formal state transitions.
 */
export class InteractionStateMachine {
  private context: InteractionContext;
  private stateHandlers: Map<InteractionState, StateHandler>;

  constructor() {
    this.context = createInteractionContext();
    this.stateHandlers = new Map();

    // Register state handlers
    this.stateHandlers.set("idle", new IdleState());
    this.stateHandlers.set("hover", new HoverState());
    this.stateHandlers.set("panning", new PanningState());
    this.stateHandlers.set("dragging", new DraggingState());
    this.stateHandlers.set("resizing", new ResizingState());
    this.stateHandlers.set("rotating", new RotatingState());
    this.stateHandlers.set("marquee-selecting", new MarqueeSelectingState());
    this.stateHandlers.set("drawing", new DrawingState());
    this.stateHandlers.set("pen-drawing", new PenDrawingState());
  }

  getContext(): InteractionContext { return this.context; }
  getState(): InteractionState { return this.context.state; }

  setTool(tool: string): void {
    this.context.tool = tool;
  }

  /**
   * Process an event and return effects to apply.
   */
  processEvent(event: InteractionEvent): InteractionEffect[] {
    const handler = this.stateHandlers.get(this.context.state);
    if (!handler) return [];

    const result = handler.handleEvent(event, this.context);
    if (!result) return [];

    // Transition
    if (result.newState !== this.context.state) {
      // Exit old state
      const oldHandler = this.stateHandlers.get(this.context.state);
      oldHandler?.onExit?.(this.context);

      // Enter new state
      this.context.state = result.newState;
      const newHandler = this.stateHandlers.get(result.newState);
      newHandler?.onEnter?.(this.context);
    }

    // Apply context updates
    Object.assign(this.context, result.context);
    this.context.state = result.newState;

    return result.effects;
  }

  /** Reset to idle */
  reset(): void {
    this.context = createInteractionContext();
  }
}

// ── State Handler interface ───────────────────────────────────

interface StateHandler {
  handleEvent(event: InteractionEvent, ctx: InteractionContext): TransitionResult | null;
  onEnter?(ctx: InteractionContext): void;
  onExit?(ctx: InteractionContext): void;
}

// ── Idle State ────────────────────────────────────────────────

class IdleState implements StateHandler {
  handleEvent(event: InteractionEvent, ctx: InteractionContext): TransitionResult | null {
    if (event.type === "TOOL_CHANGE") {
      return {
        newState: "idle",
        context: { ...ctx, tool: event.tool },
        effects: [{ type: "SET_CURSOR", cursor: this.cursorForTool(event.tool) }],
      };
    }

    if (event.type === "MOUSE_MOVE" && ctx.tool === "select") {
      // Hover detection will be handled by the component
      return {
        newState: "idle",
        context: { ...ctx, cursor: "default" },
        effects: [],
      };
    }

    if (event.type === "MOUSE_DOWN") {
      // Delegate to tool-specific handlers
      if (ctx.tool === "hand" || event.button === 1) {
        return {
          newState: "panning",
          context: { ...ctx, panStart: event.screenPos },
          effects: [{ type: "SET_CURSOR", cursor: "grabbing" }],
        };
      }

      if (ctx.tool === "select") {
        // This will be resolved by the component (handle/shape/empty hit test)
        return null; // Let component decide
      }

      if (ctx.tool === "pen") {
        return {
          newState: "pen-drawing",
          context: {
            ...ctx,
            penPoints: [...ctx.penPoints, event.worldPos],
          },
          effects: [],
        };
      }

      // Drawing tools
      return {
        newState: "drawing",
        context: {
          ...ctx,
          dragStart: event.worldPos,
          drawPreview: null,
        },
        effects: [{ type: "SET_CURSOR", cursor: "crosshair" }],
      };
    }

    return null;
  }

  private cursorForTool(tool: string): string {
    switch (tool) {
      case "hand": return "grab";
      case "select": return "default";
      default: return "crosshair";
    }
  }
}

// ── Hover State ───────────────────────────────────────────────

class HoverState implements StateHandler {
  handleEvent(event: InteractionEvent, ctx: InteractionContext): TransitionResult | null {
    if (event.type === "MOUSE_MOVE") {
      return {
        newState: "hover",
        context: ctx,
        effects: [{ type: "SET_CURSOR", cursor: "move" }],
      };
    }

    if (event.type === "MOUSE_DOWN") {
      return {
        newState: "dragging",
        context: {
          ...ctx,
          dragStart: event.worldPos,
          snapshotBeforeInteraction: null, // Will be set by component
        },
        effects: [{ type: "SET_CURSOR", cursor: "grabbing" }],
      };
    }

    return {
      newState: "idle",
      context: { ...ctx, hoveredId: null },
      effects: [],
    };
  }
}

// ── Panning State ─────────────────────────────────────────────

class PanningState implements StateHandler {
  handleEvent(event: InteractionEvent, ctx: InteractionContext): TransitionResult | null {
    if (event.type === "MOUSE_MOVE" && ctx.panStart) {
      const dx = event.screenPos.x - ctx.panStart.x;
      const dy = event.screenPos.y - ctx.panStart.y;
      return {
        newState: "panning",
        context: { ...ctx, panStart: event.screenPos },
        effects: [{ type: "SET_CAMERA", delta: { x: dx, y: dy } }],
      };
    }

    if (event.type === "MOUSE_UP") {
      return {
        newState: "idle",
        context: { ...ctx, panStart: null },
        effects: [{ type: "SET_CURSOR", cursor: ctx.tool === "hand" ? "grab" : "default" }],
      };
    }

    return null;
  }
}

// ── Dragging State ────────────────────────────────────────────

class DraggingState implements StateHandler {
  handleEvent(event: InteractionEvent, ctx: InteractionContext): TransitionResult | null {
    if (event.type === "MOUSE_MOVE") {
      return {
        newState: "dragging",
        context: { ...ctx, dragCurrent: event.worldPos },
        effects: [], // Shape update handled by component
      };
    }

    if (event.type === "MOUSE_UP") {
      return {
        newState: "idle",
        context: {
          ...ctx,
          dragStart: null,
          dragCurrent: null,
          dragOffsets: new Map(),
          dropTargetId: null,
          snapshotBeforeInteraction: null,
        },
        effects: [
          { type: "SNAPSHOT_UNDO", description: "Move shape(s)" },
          { type: "SET_DROP_TARGET", id: null },
          { type: "SET_CURSOR", cursor: "default" },
        ],
      };
    }

    if (event.type === "ESCAPE") {
      return {
        newState: "idle",
        context: {
          ...ctx,
          dragStart: null,
          dragCurrent: null,
          dragOffsets: new Map(),
        },
        effects: [{ type: "SET_CURSOR", cursor: "default" }],
      };
    }

    return null;
  }
}

// ── Resizing State ────────────────────────────────────────────

class ResizingState implements StateHandler {
  handleEvent(event: InteractionEvent, ctx: InteractionContext): TransitionResult | null {
    if (event.type === "MOUSE_MOVE") {
      return {
        newState: "resizing",
        context: { ...ctx, dragCurrent: event.worldPos },
        effects: [], // Resize logic in component
      };
    }

    if (event.type === "MOUSE_UP") {
      return {
        newState: "idle",
        context: {
          ...ctx,
          resizeHandle: null,
          resizeOrigin: null,
          dragCurrent: null,
          snapshotBeforeInteraction: null,
        },
        effects: [
          { type: "SNAPSHOT_UNDO", description: "Resize shape" },
          { type: "SET_CURSOR", cursor: "default" },
        ],
      };
    }

    return null;
  }
}

// ── Rotating State ────────────────────────────────────────────

class RotatingState implements StateHandler {
  handleEvent(event: InteractionEvent, ctx: InteractionContext): TransitionResult | null {
    if (event.type === "MOUSE_MOVE") {
      return {
        newState: "rotating",
        context: { ...ctx, dragCurrent: event.worldPos },
        effects: [],
      };
    }

    if (event.type === "MOUSE_UP") {
      return {
        newState: "idle",
        context: {
          ...ctx,
          rotateStart: null,
          dragCurrent: null,
          snapshotBeforeInteraction: null,
        },
        effects: [
          { type: "SNAPSHOT_UNDO", description: "Rotate shape" },
          { type: "SET_CURSOR", cursor: "default" },
        ],
      };
    }

    return null;
  }
}

// ── Marquee Selecting State ───────────────────────────────────

class MarqueeSelectingState implements StateHandler {
  handleEvent(event: InteractionEvent, ctx: InteractionContext): TransitionResult | null {
    if (event.type === "MOUSE_MOVE" && ctx.dragStart) {
      const marqueeRect: AABB = {
        minX: Math.min(ctx.dragStart.x, event.worldPos.x),
        minY: Math.min(ctx.dragStart.y, event.worldPos.y),
        maxX: Math.max(ctx.dragStart.x, event.worldPos.x),
        maxY: Math.max(ctx.dragStart.y, event.worldPos.y),
      };
      return {
        newState: "marquee-selecting",
        context: { ...ctx, marqueeRect },
        effects: [],
      };
    }

    if (event.type === "MOUSE_UP") {
      return {
        newState: "idle",
        context: {
          ...ctx,
          marqueeRect: null,
          dragStart: null,
        },
        effects: [],
      };
    }

    return null;
  }
}

// ── Drawing State ─────────────────────────────────────────────

class DrawingState implements StateHandler {
  handleEvent(event: InteractionEvent, ctx: InteractionContext): TransitionResult | null {
    if (event.type === "MOUSE_MOVE" && ctx.dragStart) {
      const start = ctx.dragStart;
      let w = event.worldPos.x - start.x;
      let h = event.worldPos.y - start.y;
      let x = start.x;
      let y = start.y;

      if (event.shift && ctx.tool !== "line") {
        const size = Math.max(Math.abs(w), Math.abs(h));
        w = Math.sign(w) * size;
        h = Math.sign(h) * size;
      }

      if (w < 0) { x = start.x + w; w = -w; }
      if (h < 0) { y = start.y + h; h = -h; }

      return {
        newState: "drawing",
        context: {
          ...ctx,
          drawPreview: { type: ctx.tool, x, y, w, h },
        },
        effects: [],
      };
    }

    if (event.type === "MOUSE_UP") {
      return {
        newState: "idle",
        context: {
          ...ctx,
          dragStart: null,
          drawPreview: null,
        },
        effects: [], // Shape creation in component
      };
    }

    return null;
  }
}

// ── Pen Drawing State ─────────────────────────────────────────

class PenDrawingState implements StateHandler {
  handleEvent(event: InteractionEvent, ctx: InteractionContext): TransitionResult | null {
    if (event.type === "MOUSE_DOWN") {
      return {
        newState: "pen-drawing",
        context: {
          ...ctx,
          penPoints: [...ctx.penPoints, event.worldPos],
        },
        effects: [],
      };
    }

    if (event.type === "DOUBLE_CLICK") {
      if (ctx.penPoints.length >= 2) {
        return {
          newState: "idle",
          context: { ...ctx, penPoints: [] },
          effects: [{ type: "COMMIT_PEN_PATH", points: ctx.penPoints }],
        };
      }
    }

    if (event.type === "ESCAPE") {
      return {
        newState: "idle",
        context: { ...ctx, penPoints: [] },
        effects: [],
      };
    }

    return null;
  }
}
