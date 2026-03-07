// ═══════════════════════════════════════════════════════════════
// Prototype Engine — Graph-based interaction resolution
//
// Builds a directed graph from all interactions on a page,
// provides fast lookup of triggers, and manages the runtime
// state machine for prototype playback.
//
// ── Data model ────────────────────────────────────────────────
//   Node = frame or interactive element
//   Edge = interaction (trigger → action → destination)
//
// ── Runtime state ─────────────────────────────────────────────
//   currentFrameId      – the visible screen
//   navStack            – back-navigation history
//   overlayStack        – layered overlays
//   scrollPositions     – per-frame scroll offsets
//   variantOverrides    – per-component variant swaps
//   activeHovers        – shapes currently under cursor
//   activeKeyListeners  – key-down triggers that are live
// ═══════════════════════════════════════════════════════════════

import type {
  UUID,
  PenpotShape,
  Interaction,
  InteractionEventType,
  InteractionActionType,
  AnimationType,
  Flow,
  Point,
} from "./types";
import { ROOT_FRAME_ID } from "./types";

// ── Graph types ───────────────────────────────────────────────

export interface InteractionEdge {
  /** Shape that owns this interaction */
  sourceShapeId: UUID;
  /** The interaction definition */
  interaction: Interaction;
}

export interface PrototypeGraph {
  /** All edges indexed by source shape ID */
  bySource: Map<UUID, InteractionEdge[]>;
  /** All edges indexed by event type */
  byEvent: Map<InteractionEventType, InteractionEdge[]>;
  /** All edges indexed by destination frame ID */
  byDestination: Map<UUID, InteractionEdge[]>;
  /** All flows on the page */
  flows: Flow[];
  /** Quick lookup: shape ID → has interactions */
  interactiveShapes: Set<UUID>;
}

// ── Build graph ───────────────────────────────────────────────

export function buildPrototypeGraph(
  objects: Record<UUID, PenpotShape>,
  flows: Flow[] = [],
): PrototypeGraph {
  const graph: PrototypeGraph = {
    bySource: new Map(),
    byEvent: new Map(),
    byDestination: new Map(),
    flows,
    interactiveShapes: new Set(),
  };

  for (const shape of Object.values(objects)) {
    if (!shape.interactions?.length) continue;
    graph.interactiveShapes.add(shape.id);

    for (const interaction of shape.interactions) {
      const edge: InteractionEdge = {
        sourceShapeId: shape.id,
        interaction,
      };

      // By source
      const srcEdges = graph.bySource.get(shape.id) || [];
      srcEdges.push(edge);
      graph.bySource.set(shape.id, srcEdges);

      // By event type
      const evtEdges = graph.byEvent.get(interaction.eventType) || [];
      evtEdges.push(edge);
      graph.byEvent.set(interaction.eventType, evtEdges);

      // By destination
      if (interaction.destination) {
        const dstEdges = graph.byDestination.get(interaction.destination) || [];
        dstEdges.push(edge);
        graph.byDestination.set(interaction.destination, dstEdges);
      }
    }
  }

  return graph;
}

/** Check if a shape or any ancestor has an interaction for a given event. */
export function findInteractionForEvent(
  shapeId: UUID,
  eventType: InteractionEventType,
  objects: Record<UUID, PenpotShape>,
): { shapeId: UUID; interaction: Interaction } | null {
  let current: PenpotShape | undefined = objects[shapeId];

  while (current) {
    if (current.interactions) {
      const match = current.interactions.find((i) => i.eventType === eventType);
      if (match) return { shapeId: current.id, interaction: match };
    }
    // Walk up: check parent
    if (current.parentId && current.parentId !== ROOT_FRAME_ID) {
      current = objects[current.parentId];
    } else {
      break;
    }
  }

  return null;
}

/** Get all shapes within a frame (recursive). */
export function collectFrameChildren(
  frameId: UUID,
  objects: Record<UUID, PenpotShape>,
): Record<UUID, PenpotShape> {
  const result: Record<UUID, PenpotShape> = {};
  const frame = objects[frameId];
  if (!frame) return result;
  result[frame.id] = frame;

  const collect = (ids: UUID[]) => {
    for (const id of ids) {
      const shape = objects[id];
      if (shape) {
        result[id] = shape;
        if (shape.shapes) collect(shape.shapes);
      }
    }
  };

  if (frame.shapes) collect(frame.shapes);
  return result;
}

// ── Runtime State Machine ─────────────────────────────────────

export interface OverlayEntry {
  frameId: UUID;
  posType: string;
  position?: Point;
  closeOnClick: boolean;
  backgroundOverlay: boolean;
}

export interface PrototypeState {
  currentFrameId: UUID | null;
  navStack: UUID[];
  overlayStack: OverlayEntry[];
  scrollPositions: Map<UUID, Point>;
  variantOverrides: Map<UUID, Record<string, string>>;
  transitionActive: boolean;
  transitionType: AnimationType;
  transitionDirection?: string;
  transitionDuration: number;
}

export function createInitialPrototypeState(
  objects: Record<UUID, PenpotShape>,
  flows: Flow[],
): PrototypeState {
  let startFrame: UUID | null = null;

  if (flows.length > 0) {
    startFrame = flows[0].startingFrame;
  } else {
    const firstFrame = Object.values(objects).find(
      (s) => s.type === "frame" && s.id !== ROOT_FRAME_ID,
    );
    startFrame = firstFrame?.id || null;
  }

  return {
    currentFrameId: startFrame,
    navStack: [],
    overlayStack: [],
    scrollPositions: new Map(),
    variantOverrides: new Map(),
    transitionActive: false,
    transitionType: "instant",
    transitionDuration: 0,
  };
}

/**
 * Execute an interaction and produce a new state.
 * Pure function — doesn't mutate the input.
 */
export function executeInteraction(
  state: PrototypeState,
  interaction: Interaction,
  _sourceShapeId: UUID,
  objects: Record<UUID, PenpotShape>,
): PrototypeState {
  const next = { ...state };
  const anim = interaction.animation;

  switch (interaction.actionType) {
    case "navigate": {
      if (!interaction.destination) break;
      next.navStack = [...state.navStack, state.currentFrameId!];
      next.currentFrameId = interaction.destination;
      next.overlayStack = []; // close overlays on navigate
      if (!interaction.preserveScroll) {
        next.scrollPositions = new Map(state.scrollPositions);
        next.scrollPositions.set(interaction.destination, { x: 0, y: 0 });
      }
      if (anim && anim.animationType !== "instant") {
        next.transitionActive = true;
        next.transitionType = anim.animationType;
        next.transitionDirection = anim.direction;
        next.transitionDuration = anim.duration;
      }
      break;
    }

    case "open-overlay": {
      if (!interaction.destination) break;
      next.overlayStack = [
        ...state.overlayStack,
        {
          frameId: interaction.destination,
          posType: interaction.overlayPosType || "center",
          position: interaction.overlayPosition,
          closeOnClick: interaction.closeClickOutside ?? true,
          backgroundOverlay: interaction.backgroundOverlay ?? true,
        },
      ];
      break;
    }

    case "swap-overlay": {
      if (!interaction.destination) break;
      const newStack = state.overlayStack.length > 0
        ? [...state.overlayStack.slice(0, -1)]
        : [];
      newStack.push({
        frameId: interaction.destination,
        posType: interaction.overlayPosType || "center",
        position: interaction.overlayPosition,
        closeOnClick: interaction.closeClickOutside ?? true,
        backgroundOverlay: interaction.backgroundOverlay ?? true,
      });
      next.overlayStack = newStack;
      break;
    }

    case "toggle-overlay": {
      if (!interaction.destination) break;
      const existing = state.overlayStack.findIndex(
        (o) => o.frameId === interaction.destination,
      );
      if (existing >= 0) {
        // Close it
        next.overlayStack = state.overlayStack.filter(
          (_, i) => i !== existing,
        );
      } else {
        // Open it
        next.overlayStack = [
          ...state.overlayStack,
          {
            frameId: interaction.destination,
            posType: interaction.overlayPosType || "center",
            position: interaction.overlayPosition,
            closeOnClick: interaction.closeClickOutside ?? true,
            backgroundOverlay: interaction.backgroundOverlay ?? true,
          },
        ];
      }
      break;
    }

    case "close-overlay": {
      if (state.overlayStack.length > 0) {
        next.overlayStack = state.overlayStack.slice(0, -1);
      }
      break;
    }

    case "prev-screen": {
      if (state.navStack.length > 0) {
        const prev = state.navStack[state.navStack.length - 1];
        next.navStack = state.navStack.slice(0, -1);
        next.currentFrameId = prev;
        next.overlayStack = [];
        if (anim && anim.animationType !== "instant") {
          next.transitionActive = true;
          next.transitionType = anim.animationType;
          next.transitionDirection = anim.direction;
          next.transitionDuration = anim.duration;
        }
      }
      break;
    }

    case "open-url": {
      if (interaction.url) {
        window.open(interaction.url, "_blank");
      }
      break;
    }

    case "scroll-to": {
      if (interaction.scrollTargetId && state.currentFrameId) {
        const target = objects[interaction.scrollTargetId];
        const frame = objects[state.currentFrameId];
        if (target && frame) {
          next.scrollPositions = new Map(state.scrollPositions);
          next.scrollPositions.set(state.currentFrameId, {
            x: target.x - frame.x,
            y: target.y - frame.y,
          });
        }
      }
      break;
    }

    case "swap-variant": {
      // Stub for component variant swapping
      // Would apply variantProperties to the source component
      break;
    }
  }

  return next;
}

// ── CSS easing ────────────────────────────────────────────────

export function easingToCss(easing: string): string {
  switch (easing) {
    case "linear": return "linear";
    case "ease": return "ease";
    case "ease-in": return "ease-in";
    case "ease-out": return "ease-out";
    case "ease-in-out": return "ease-in-out";
    case "spring": return "cubic-bezier(0.175, 0.885, 0.32, 1.275)";
    default: return "ease-in-out";
  }
}

// ── Transition CSS ────────────────────────────────────────────

export function transitionToStyle(
  type: AnimationType,
  direction: string | undefined,
  active: boolean,
): React.CSSProperties {
  if (type === "instant" || !active) return {};

  switch (type) {
    case "dissolve":
      return { opacity: active ? 0 : 1 };

    case "slide":
    case "move-in": {
      const dir = direction || "right";
      const translate = active
        ? dir === "right" ? "100%" : dir === "left" ? "-100%" : dir === "down" ? "0, 100%" : "0, -100%"
        : "0, 0";
      return {
        transform: `translate(${translate})`,
        opacity: active ? 0 : 1,
      };
    }

    case "move-out": {
      const dir = direction || "left";
      const translate = active
        ? dir === "right" ? "100%" : dir === "left" ? "-100%" : dir === "down" ? "0, 100%" : "0, -100%"
        : "0, 0";
      return { transform: `translate(${translate})` };
    }

    case "push": {
      const dir = direction || "left";
      const translate = active
        ? dir === "right" ? "-50%" : dir === "left" ? "50%" : dir === "down" ? "0, -50%" : "0, 50%"
        : "0, 0";
      return {
        transform: `translate(${translate}) scale(${active ? 0.9 : 1})`,
        opacity: active ? 0 : 1,
      };
    }

    case "smart-animate":
      // Smart animate is handled per-element, not as a page transition
      return { opacity: active ? 0 : 1 };

    default:
      return {};
  }
}

// ── Hotspot detection ─────────────────────────────────────────

/** Get list of interactive shape IDs within a frame. */
export function getHotspots(
  frameId: UUID,
  objects: Record<UUID, PenpotShape>,
): UUID[] {
  const result: UUID[] = [];

  const walk = (ids: UUID[]) => {
    for (const id of ids) {
      const shape = objects[id];
      if (!shape || shape.hidden) continue;
      if (shape.interactions?.length) result.push(id);
      if (shape.shapes) walk(shape.shapes);
    }
  };

  const frame = objects[frameId];
  if (frame?.shapes) walk(frame.shapes);

  return result;
}
