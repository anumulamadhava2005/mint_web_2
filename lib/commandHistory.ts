// ═══════════════════════════════════════════════════════════════
// Command History — Undo / Redo via Command Pattern
//
// Professional editors never mutate state directly. Every
// mutation is wrapped in a Command with execute() and undo().
//
// Benefits:
//   - Undo / redo
//   - Multiplayer sync (commands are serialisable operations)
//   - History tracking
// ═══════════════════════════════════════════════════════════════

import type { CanvasShape } from "./canvasEngine";

// ── Command interface ─────────────────────────────────────────

export interface Command {
  /** Human-readable description for history panel */
  description: string;
  /** Execute the command, returns new shapes array */
  execute(shapes: CanvasShape[]): CanvasShape[];
  /** Undo the command, returns previous shapes array */
  undo(shapes: CanvasShape[]): CanvasShape[];
}

/** Serialisable operation for multiplayer sync */
export interface SyncOperation {
  type: string;
  payload: Record<string, unknown>;
  timestamp: number;
  userId?: string;
}

// ── Command History ───────────────────────────────────────────

const MAX_HISTORY = 100;

export class CommandHistory {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private listeners: Array<() => void> = [];

  /**
   * Execute a command. Pushes it onto the undo stack
   * and clears the redo stack.
   */
  execute(cmd: Command, shapes: CanvasShape[]): CanvasShape[] {
    const result = cmd.execute(shapes);
    this.undoStack.push(cmd);
    this.redoStack = []; // Clear redo on new action

    // Trim to max history
    if (this.undoStack.length > MAX_HISTORY) {
      this.undoStack.shift();
    }

    this.notify();
    return result;
  }

  /** Undo the last command */
  undo(shapes: CanvasShape[]): CanvasShape[] | null {
    const cmd = this.undoStack.pop();
    if (!cmd) return null;
    const result = cmd.undo(shapes);
    this.redoStack.push(cmd);
    this.notify();
    return result;
  }

  /** Redo the last undone command */
  redo(shapes: CanvasShape[]): CanvasShape[] | null {
    const cmd = this.redoStack.pop();
    if (!cmd) return null;
    const result = cmd.execute(shapes);
    this.undoStack.push(cmd);
    this.notify();
    return result;
  }

  canUndo(): boolean { return this.undoStack.length > 0; }
  canRedo(): boolean { return this.redoStack.length > 0; }
  undoCount(): number { return this.undoStack.length; }
  redoCount(): number { return this.redoStack.length; }

  /** Get the description of the last undo-able command */
  lastUndoDescription(): string | null {
    return this.undoStack.length > 0
      ? this.undoStack[this.undoStack.length - 1].description
      : null;
  }

  /** Get the description of the last redo-able command */
  lastRedoDescription(): string | null {
    return this.redoStack.length > 0
      ? this.redoStack[this.redoStack.length - 1].description
      : null;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }

  /** Subscribe to history changes */
  subscribe(fn: () => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }

  /** Convert last command to a sync operation for multiplayer */
  toSyncOperation(userId?: string): SyncOperation | null {
    const cmd = this.undoStack[this.undoStack.length - 1];
    if (!cmd) return null;
    return {
      type: cmd.description,
      payload: {},
      timestamp: Date.now(),
      userId,
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// Built-in Commands
// ═══════════════════════════════════════════════════════════════

// ── Move Command ──────────────────────────────────────────────

export class MoveCommand implements Command {
  description: string;
  private shapeIds: string[];
  private dx: number;
  private dy: number;

  constructor(shapeIds: string[], dx: number, dy: number) {
    this.shapeIds = shapeIds;
    this.dx = dx;
    this.dy = dy;
    this.description = `Move ${shapeIds.length} shape(s)`;
  }

  execute(shapes: CanvasShape[]): CanvasShape[] {
    const ids = new Set(this.shapeIds);
    return shapes.map(s =>
      ids.has(s.id) ? { ...s, x: s.x + this.dx, y: s.y + this.dy } : s,
    );
  }

  undo(shapes: CanvasShape[]): CanvasShape[] {
    const ids = new Set(this.shapeIds);
    return shapes.map(s =>
      ids.has(s.id) ? { ...s, x: s.x - this.dx, y: s.y - this.dy } : s,
    );
  }
}

// ── Add Shape Command ─────────────────────────────────────────

export class AddShapeCommand implements Command {
  description: string;
  private shape: CanvasShape;

  constructor(shape: CanvasShape) {
    this.shape = shape;
    this.description = `Add ${shape.type}`;
  }

  execute(shapes: CanvasShape[]): CanvasShape[] {
    return [...shapes, this.shape];
  }

  undo(shapes: CanvasShape[]): CanvasShape[] {
    return shapes.filter(s => s.id !== this.shape.id);
  }
}

// ── Delete Shapes Command ─────────────────────────────────────

export class DeleteShapesCommand implements Command {
  description: string;
  private deletedShapes: CanvasShape[];
  private deletedIds: Set<string>;

  constructor(shapes: CanvasShape[], idsToDelete: Set<string>) {
    this.deletedIds = new Set(idsToDelete);
    this.deletedShapes = shapes.filter(s => idsToDelete.has(s.id));
    this.description = `Delete ${idsToDelete.size} shape(s)`;
  }

  execute(shapes: CanvasShape[]): CanvasShape[] {
    return shapes.filter(s => !this.deletedIds.has(s.id));
  }

  undo(shapes: CanvasShape[]): CanvasShape[] {
    return [...shapes, ...this.deletedShapes];
  }
}

// ── Update Shape Command ──────────────────────────────────────

export class UpdateShapeCommand implements Command {
  description: string;
  private shapeId: string;
  private patch: Partial<CanvasShape>;
  private previousValues: Partial<CanvasShape>;

  constructor(
    shapeId: string,
    patch: Partial<CanvasShape>,
    currentShapes: CanvasShape[],
    description?: string,
  ) {
    this.shapeId = shapeId;
    this.patch = patch;
    this.description = description || `Update shape`;
    // Capture previous values for undo
    const current = currentShapes.find(s => s.id === shapeId);
    this.previousValues = {};
    if (current) {
      for (const key of Object.keys(patch) as Array<keyof CanvasShape>) {
        (this.previousValues as Record<string, unknown>)[key] = current[key];
      }
    }
  }

  execute(shapes: CanvasShape[]): CanvasShape[] {
    return shapes.map(s =>
      s.id === this.shapeId ? { ...s, ...this.patch } : s,
    );
  }

  undo(shapes: CanvasShape[]): CanvasShape[] {
    return shapes.map(s =>
      s.id === this.shapeId ? { ...s, ...this.previousValues } : s,
    );
  }
}

// ── Reparent Command ──────────────────────────────────────────

export class ReparentCommand implements Command {
  description: string;
  private shapeId: string;
  private newParentId: string | null;
  private snapshotBefore: CanvasShape[];

  constructor(
    shapeId: string,
    newParentId: string | null,
    currentShapes: CanvasShape[],
  ) {
    this.shapeId = shapeId;
    this.newParentId = newParentId;
    this.snapshotBefore = currentShapes.map(s => ({ ...s }));
    this.description = newParentId
      ? `Reparent into frame`
      : `Unparent to root`;
  }

  execute(shapes: CanvasShape[]): CanvasShape[] {
    // Reparenting is complex — handled by SceneGraph.reparent externally.
    // This command stores the result of reparenting when executed the first time.
    // For subsequent executions (redo), we need to re-run the reparent logic.
    // Since we store the snapshot before, undo simply restores it.
    return shapes; // Actual reparenting done via scene graph
  }

  undo(_shapes: CanvasShape[]): CanvasShape[] {
    return this.snapshotBefore;
  }
}

// ── Batch Command (multiple commands as one undo step) ────────

export class BatchCommand implements Command {
  description: string;
  private commands: Command[];

  constructor(description: string, commands: Command[]) {
    this.description = description;
    this.commands = commands;
  }

  execute(shapes: CanvasShape[]): CanvasShape[] {
    let result = shapes;
    for (const cmd of this.commands) {
      result = cmd.execute(result);
    }
    return result;
  }

  undo(shapes: CanvasShape[]): CanvasShape[] {
    let result = shapes;
    // Undo in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      result = this.commands[i].undo(result);
    }
    return result;
  }
}
