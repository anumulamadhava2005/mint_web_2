// ═══════════════════════════════════════════════════════════════
// CRDT Collaborative Sync Layer — Conflict-free replicated data
//
// Simple command replay breaks when two users simultaneously:
//   - Move the same object
//   - Delete an object while someone edits it
//   - Reparent overlapping hierarchies
//
// CRDTs (Conflict-free Replicated Data Types) resolve conflicts
// automatically by design. We use:
//   - LWW-Register (Last Writer Wins) for property values
//   - LWW-Map for the shapes collection
//   - Lamport timestamps for causal ordering
//   - Vector clocks for conflict detection
//
// Architecture:
//   Local change
//       ↓
//   Create CRDT operation
//       ↓
//   Apply locally (optimistic)
//       ↓
//   Broadcast to peers (via WebSocket)
//       ↓
//   Remote receives
//       ↓
//   Merge (automatic conflict resolution)
//       ↓
//   Update local state
// ═══════════════════════════════════════════════════════════════

import type { CanvasShape } from "./canvasEngine";

// ── Lamport Timestamp ─────────────────────────────────────────

export class LamportClock {
  private counter: number;
  private nodeId: string;

  constructor(nodeId: string, initial = 0) {
    this.nodeId = nodeId;
    this.counter = initial;
  }

  /** Generate next timestamp */
  tick(): LamportTimestamp {
    this.counter++;
    return { counter: this.counter, nodeId: this.nodeId };
  }

  /** Update clock on receiving a remote timestamp */
  receive(remote: LamportTimestamp): void {
    this.counter = Math.max(this.counter, remote.counter) + 1;
  }

  getCounter(): number { return this.counter; }
  getNodeId(): string { return this.nodeId; }
}

export interface LamportTimestamp {
  counter: number;
  nodeId: string;
}

/** Compare two Lamport timestamps. Returns >0 if a wins, <0 if b wins, 0 if equal */
function compareTimestamps(a: LamportTimestamp, b: LamportTimestamp): number {
  if (a.counter !== b.counter) return a.counter - b.counter;
  return a.nodeId < b.nodeId ? -1 : a.nodeId > b.nodeId ? 1 : 0;
}

// ── CRDT Operations ───────────────────────────────────────────

export type CRDTOperation =
  | CRDTSetProperty
  | CRDTAddShape
  | CRDTDeleteShape
  | CRDTReparent;

export interface CRDTSetProperty {
  type: "set_property";
  shapeId: string;
  property: string;
  value: unknown;
  timestamp: LamportTimestamp;
}

export interface CRDTAddShape {
  type: "add_shape";
  shape: CanvasShape;
  timestamp: LamportTimestamp;
}

export interface CRDTDeleteShape {
  type: "delete_shape";
  shapeId: string;
  timestamp: LamportTimestamp;
}

export interface CRDTReparent {
  type: "reparent";
  shapeId: string;
  newParentId: string | null;
  newX: number;
  newY: number;
  timestamp: LamportTimestamp;
}

// ── LWW Register ──────────────────────────────────────────────
// Last-Writer-Wins Register: stores a value with a timestamp.
// On merge, the one with the higher timestamp wins.

interface LWWEntry<T> {
  value: T;
  timestamp: LamportTimestamp;
}

// ── CRDT Document ─────────────────────────────────────────────
// Represents the entire document as a map of shape IDs → LWW properties.

interface ShapeCRDT {
  /** Each property is a LWW register */
  properties: Map<string, LWWEntry<unknown>>;
  /** Tombstone flag — true if shape has been deleted */
  deleted: LWWEntry<boolean>;
}

/**
 * CRDTDocument manages the conflict-free replicated state of all shapes.
 */
export class CRDTDocument {
  private shapes = new Map<string, ShapeCRDT>();
  private clock: LamportClock;
  private pendingOps: CRDTOperation[] = [];
  private listeners: Array<(ops: CRDTOperation[]) => void> = [];

  constructor(nodeId: string) {
    this.clock = new LamportClock(nodeId);
  }

  /** Get the current node ID */
  getNodeId(): string { return this.clock.getNodeId(); }

  // ── Local Operations ──────────────────────────────────

  /**
   * Set a property on a shape. Returns the operation for sync.
   */
  setProperty(shapeId: string, property: string, value: unknown): CRDTSetProperty {
    const timestamp = this.clock.tick();
    const op: CRDTSetProperty = {
      type: "set_property",
      shapeId,
      property,
      value,
      timestamp,
    };

    this.applySetProperty(op);
    this.pendingOps.push(op);
    return op;
  }

  /**
   * Add a new shape. Returns the operation for sync.
   */
  addShape(shape: CanvasShape): CRDTAddShape {
    const timestamp = this.clock.tick();
    const op: CRDTAddShape = {
      type: "add_shape",
      shape: { ...shape },
      timestamp,
    };

    this.applyAddShape(op);
    this.pendingOps.push(op);
    return op;
  }

  /**
   * Delete a shape. Returns the operation for sync.
   */
  deleteShape(shapeId: string): CRDTDeleteShape {
    const timestamp = this.clock.tick();
    const op: CRDTDeleteShape = {
      type: "delete_shape",
      shapeId,
      timestamp,
    };

    this.applyDeleteShape(op);
    this.pendingOps.push(op);
    return op;
  }

  /**
   * Reparent a shape. Returns the operation for sync.
   */
  reparent(
    shapeId: string,
    newParentId: string | null,
    newX: number,
    newY: number,
  ): CRDTReparent {
    const timestamp = this.clock.tick();
    const op: CRDTReparent = {
      type: "reparent",
      shapeId,
      newParentId,
      newX,
      newY,
      timestamp,
    };

    this.applyReparent(op);
    this.pendingOps.push(op);
    return op;
  }

  // ── Remote Operation Merge ────────────────────────────

  /**
   * Merge a remote operation. CRDT guarantees convergence.
   */
  mergeRemote(op: CRDTOperation): void {
    this.clock.receive(op.timestamp);

    switch (op.type) {
      case "set_property":
        this.applySetProperty(op);
        break;
      case "add_shape":
        this.applyAddShape(op);
        break;
      case "delete_shape":
        this.applyDeleteShape(op);
        break;
      case "reparent":
        this.applyReparent(op);
        break;
    }
  }

  /**
   * Merge multiple remote operations (batch).
   */
  mergeRemoteBatch(ops: CRDTOperation[]): void {
    for (const op of ops) {
      this.mergeRemote(op);
    }
  }

  // ── Apply Operations ──────────────────────────────────

  private applySetProperty(op: CRDTSetProperty): void {
    let shapeCRDT = this.shapes.get(op.shapeId);
    if (!shapeCRDT) {
      shapeCRDT = {
        properties: new Map(),
        deleted: { value: false, timestamp: { counter: 0, nodeId: "" } },
      };
      this.shapes.set(op.shapeId, shapeCRDT);
    }

    // LWW: only apply if timestamp is newer
    const existing = shapeCRDT.properties.get(op.property);
    if (!existing || compareTimestamps(op.timestamp, existing.timestamp) > 0) {
      shapeCRDT.properties.set(op.property, {
        value: op.value,
        timestamp: op.timestamp,
      });
    }
  }

  private applyAddShape(op: CRDTAddShape): void {
    let shapeCRDT = this.shapes.get(op.shape.id);
    if (!shapeCRDT) {
      shapeCRDT = {
        properties: new Map(),
        deleted: { value: false, timestamp: op.timestamp },
      };
      this.shapes.set(op.shape.id, shapeCRDT);
    }

    // Set all properties from the shape
    const shape = op.shape as unknown as Record<string, unknown>;
    for (const key of Object.keys(shape)) {
      const existing = shapeCRDT.properties.get(key);
      if (!existing || compareTimestamps(op.timestamp, existing.timestamp) > 0) {
        shapeCRDT.properties.set(key, {
          value: shape[key],
          timestamp: op.timestamp,
        });
      }
    }

    // Un-delete if it was deleted
    if (compareTimestamps(op.timestamp, shapeCRDT.deleted.timestamp) > 0) {
      shapeCRDT.deleted = { value: false, timestamp: op.timestamp };
    }
  }

  private applyDeleteShape(op: CRDTDeleteShape): void {
    let shapeCRDT = this.shapes.get(op.shapeId);
    if (!shapeCRDT) {
      shapeCRDT = {
        properties: new Map(),
        deleted: { value: true, timestamp: op.timestamp },
      };
      this.shapes.set(op.shapeId, shapeCRDT);
      return;
    }

    // LWW for tombstone
    if (compareTimestamps(op.timestamp, shapeCRDT.deleted.timestamp) > 0) {
      shapeCRDT.deleted = { value: true, timestamp: op.timestamp };
    }
  }

  private applyReparent(op: CRDTReparent): void {
    // Reparenting is modeled as property updates
    this.applySetProperty({
      type: "set_property",
      shapeId: op.shapeId,
      property: "parentId",
      value: op.newParentId,
      timestamp: op.timestamp,
    });
    this.applySetProperty({
      type: "set_property",
      shapeId: op.shapeId,
      property: "x",
      value: op.newX,
      timestamp: op.timestamp,
    });
    this.applySetProperty({
      type: "set_property",
      shapeId: op.shapeId,
      property: "y",
      value: op.newY,
      timestamp: op.timestamp,
    });
  }

  // ── Materialization ───────────────────────────────────

  /**
   * Materialize the CRDT state into a CanvasShape array.
   * This is the "read" side — converts CRDT registers into shapes.
   */
  materialize(): CanvasShape[] {
    const result: CanvasShape[] = [];

    for (const [id, shapeCRDT] of this.shapes) {
      // Skip tombstoned shapes
      if (shapeCRDT.deleted.value) continue;

      // Build shape from LWW registers
      const shape: Record<string, unknown> = { id };
      for (const [key, entry] of shapeCRDT.properties) {
        shape[key] = entry.value;
      }

      result.push(shape as unknown as CanvasShape);
    }

    return result;
  }

  /**
   * Initialize from an existing shapes array (first load).
   */
  initFromShapes(shapes: CanvasShape[]): void {
    this.shapes.clear();
    const ts = this.clock.tick();

    for (const shape of shapes) {
      const shapeCRDT: ShapeCRDT = {
        properties: new Map(),
        deleted: { value: false, timestamp: ts },
      };

      const record = shape as unknown as Record<string, unknown>;
      for (const key of Object.keys(record)) {
        shapeCRDT.properties.set(key, {
          value: record[key],
          timestamp: ts,
        });
      }

      this.shapes.set(shape.id, shapeCRDT);
    }
  }

  // ── Pending Operations (for network sync) ─────────────

  /**
   * Get and clear pending operations for network broadcast.
   */
  flushPendingOps(): CRDTOperation[] {
    const ops = this.pendingOps;
    this.pendingOps = [];
    return ops;
  }

  /**
   * Check if there are pending operations to sync.
   */
  hasPendingOps(): boolean {
    return this.pendingOps.length > 0;
  }

  // ── Event system ──────────────────────────────────────

  /**
   * Subscribe to state changes.
   */
  onSync(listener: (ops: CRDTOperation[]) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(ops: CRDTOperation[]): void {
    for (const l of this.listeners) l(ops);
  }

  // ── Serialization ─────────────────────────────────────

  /**
   * Serialize the full CRDT state for persistence or full sync.
   */
  serialize(): string {
    const data: Array<{
      id: string;
      deleted: { value: boolean; timestamp: LamportTimestamp };
      properties: Array<[string, { value: unknown; timestamp: LamportTimestamp }]>;
    }> = [];

    for (const [id, shapeCRDT] of this.shapes) {
      data.push({
        id,
        deleted: shapeCRDT.deleted,
        properties: Array.from(shapeCRDT.properties.entries()),
      });
    }

    return JSON.stringify({
      nodeId: this.clock.getNodeId(),
      counter: this.clock.getCounter(),
      shapes: data,
    });
  }

  /**
   * Deserialize full CRDT state.
   */
  static deserialize(json: string): CRDTDocument {
    const data = JSON.parse(json);
    const doc = new CRDTDocument(data.nodeId);

    for (const entry of data.shapes) {
      const shapeCRDT: ShapeCRDT = {
        properties: new Map(entry.properties),
        deleted: entry.deleted,
      };
      doc.shapes.set(entry.id, shapeCRDT);
    }

    return doc;
  }
}
