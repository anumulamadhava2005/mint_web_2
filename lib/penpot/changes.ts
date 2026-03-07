// ═══════════════════════════════════════════════════════════════
// Change System — Operational Transforms for File Data
// Mirrors: common/src/app/common/files/changes.cljc
// ═══════════════════════════════════════════════════════════════

import type { UUID, PenpotShape, Page, PenpotFile, Flow } from "./types";
import { ROOT_FRAME_ID } from "./types";

// ── Change Types ──────────────────────────────────────────────
export type ChangeType =
  // Shape operations
  | "add-obj"
  | "mod-obj"
  | "del-obj"
  | "mov-objects"
  // Page operations
  | "add-page"
  | "mod-page"
  | "del-page"
  | "mov-page"
  // Flow operations
  | "set-flow"
  | "del-flow";

// ── Attribute Operations (within mod-obj) ─────────────────────
export interface SetOp {
  type: "set";
  attr: string;
  val: any;
}

export interface AssignOp {
  type: "assign";
  value: Record<string, any>;
}

export type AttributeOp = SetOp | AssignOp;

// ── Individual Change Shapes ──────────────────────────────────
export interface AddObjChange {
  type: "add-obj";
  pageId: UUID;
  id: UUID;
  parentId: UUID;
  frameId: UUID;
  obj: PenpotShape;
  index?: number; // position in parent's children
}

export interface ModObjChange {
  type: "mod-obj";
  pageId: UUID;
  id: UUID;
  operations: AttributeOp[];
}

export interface DelObjChange {
  type: "del-obj";
  pageId: UUID;
  id: UUID;
}

export interface MovObjectsChange {
  type: "mov-objects";
  pageId: UUID;
  parentId: UUID;
  shapes: UUID[]; // IDs to move
  index?: number;
}

export interface AddPageChange {
  type: "add-page";
  page: Page;
}

export interface ModPageChange {
  type: "mod-page";
  id: UUID;
  name?: string;
}

export interface DelPageChange {
  type: "del-page";
  id: UUID;
}

export interface MovPageChange {
  type: "mov-page";
  id: UUID;
  index: number;
}

export interface SetFlowChange {
  type: "set-flow";
  pageId: UUID;
  flow: Flow;
}

export interface DelFlowChange {
  type: "del-flow";
  pageId: UUID;
  id: UUID;
}

export type FileChange =
  | AddObjChange
  | ModObjChange
  | DelObjChange
  | MovObjectsChange
  | AddPageChange
  | ModPageChange
  | DelPageChange
  | MovPageChange
  | SetFlowChange
  | DelFlowChange;

// ── Change Set (batch of changes) ─────────────────────────────
export interface ChangeSet {
  sessionId: UUID;
  revn: number;
  changes: FileChange[];
  timestamp: number;
}

// ── Apply Changes to File ─────────────────────────────────────

/**
 * Apply a list of changes to the file. Returns a new file (immutable).
 */
export function applyChanges(file: PenpotFile, changes: FileChange[]): PenpotFile {
  // Deep clone to avoid mutation
  let result = structuredClone(file);

  for (const change of changes) {
    result = applyChange(result, change);
  }

  return result;
}

function applyChange(file: PenpotFile, change: FileChange): PenpotFile {
  switch (change.type) {
    case "add-obj":
      return applyAddObj(file, change);
    case "mod-obj":
      return applyModObj(file, change);
    case "del-obj":
      return applyDelObj(file, change);
    case "mov-objects":
      return applyMovObjects(file, change);
    case "add-page":
      return applyAddPage(file, change);
    case "mod-page":
      return applyModPage(file, change);
    case "del-page":
      return applyDelPage(file, change);
    case "mov-page":
      return applyMovPage(file, change);
    case "set-flow":
      return applySetFlow(file, change);
    case "del-flow":
      return applyDelFlow(file, change);
    default:
      return file;
  }
}

function applyAddObj(file: PenpotFile, change: AddObjChange): PenpotFile {
  const page = file.pagesIndex[change.pageId];
  if (!page) return file;

  // Add shape to objects map
  page.objects[change.id] = change.obj;

  // Add to parent's children
  const parent = page.objects[change.parentId];
  if (parent) {
    if (!parent.shapes) parent.shapes = [];
    if (change.index !== undefined) {
      parent.shapes.splice(change.index, 0, change.id);
    } else {
      parent.shapes.push(change.id);
    }
  }

  return file;
}

function applyModObj(file: PenpotFile, change: ModObjChange): PenpotFile {
  const page = file.pagesIndex[change.pageId];
  if (!page) return file;

  const shape = page.objects[change.id];
  if (!shape) return file;

  for (const op of change.operations) {
    if (op.type === "set") {
      (shape as any)[op.attr] = op.val;
    } else if (op.type === "assign") {
      Object.assign(shape, op.value);
    }
  }

  return file;
}

function applyDelObj(file: PenpotFile, change: DelObjChange): PenpotFile {
  const page = file.pagesIndex[change.pageId];
  if (!page) return file;

  const shape = page.objects[change.id];
  if (!shape) return file;

  // Remove from parent's children
  if (shape.parentId) {
    const parent = page.objects[shape.parentId];
    if (parent?.shapes) {
      parent.shapes = parent.shapes.filter((sid) => sid !== change.id);
    }
  }

  // Recursively delete children
  const deleteRecursive = (id: UUID) => {
    const s = page.objects[id];
    if (s?.shapes) {
      for (const childId of s.shapes) {
        deleteRecursive(childId);
      }
    }
    delete page.objects[id];
  };

  deleteRecursive(change.id);
  return file;
}

function applyMovObjects(file: PenpotFile, change: MovObjectsChange): PenpotFile {
  const page = file.pagesIndex[change.pageId];
  if (!page) return file;

  // Remove shapes from their current parents
  for (const shapeId of change.shapes) {
    const shape = page.objects[shapeId];
    if (!shape) continue;

    if (shape.parentId) {
      const oldParent = page.objects[shape.parentId];
      if (oldParent?.shapes) {
        oldParent.shapes = oldParent.shapes.filter((sid) => sid !== shapeId);
      }
    }
  }

  // Add to new parent
  const newParent = page.objects[change.parentId];
  if (newParent) {
    if (!newParent.shapes) newParent.shapes = [];
    if (change.index !== undefined) {
      newParent.shapes.splice(change.index, 0, ...change.shapes);
    } else {
      newParent.shapes.push(...change.shapes);
    }
  }

  // Update parentId and frameId
  for (const shapeId of change.shapes) {
    const shape = page.objects[shapeId];
    if (shape) {
      shape.parentId = change.parentId;
      // Update frameId: if new parent is a frame, use it; otherwise inherit
      const parentShape = page.objects[change.parentId];
      if (parentShape) {
        shape.frameId =
          parentShape.type === "frame" ? parentShape.id : parentShape.frameId;
      }
    }
  }

  return file;
}

function applyAddPage(file: PenpotFile, change: AddPageChange): PenpotFile {
  file.pages.push(change.page.id);
  file.pagesIndex[change.page.id] = change.page;
  return file;
}

function applyModPage(file: PenpotFile, change: ModPageChange): PenpotFile {
  const page = file.pagesIndex[change.id];
  if (!page) return file;
  if (change.name !== undefined) page.name = change.name;
  return file;
}

function applyDelPage(file: PenpotFile, change: DelPageChange): PenpotFile {
  file.pages = file.pages.filter((pid) => pid !== change.id);
  delete file.pagesIndex[change.id];
  return file;
}

function applyMovPage(file: PenpotFile, change: MovPageChange): PenpotFile {
  file.pages = file.pages.filter((pid) => pid !== change.id);
  file.pages.splice(change.index, 0, change.id);
  return file;
}

function applySetFlow(file: PenpotFile, change: SetFlowChange): PenpotFile {
  const page = file.pagesIndex[change.pageId];
  if (!page) return file;
  if (!page.flows) page.flows = [];
  const idx = page.flows.findIndex((f) => f.id === change.flow.id);
  if (idx >= 0) {
    page.flows[idx] = change.flow;
  } else {
    page.flows.push(change.flow);
  }
  return file;
}

function applyDelFlow(file: PenpotFile, change: DelFlowChange): PenpotFile {
  const page = file.pagesIndex[change.pageId];
  if (!page) return file;
  page.flows = page.flows?.filter((f) => f.id !== change.id);
  return file;
}

// ── Generate reverse changes for undo ─────────────────────────
export function generateUndoChanges(
  file: PenpotFile,
  changes: FileChange[]
): FileChange[] {
  const undo: FileChange[] = [];

  for (const change of changes) {
    switch (change.type) {
      case "add-obj":
        undo.push({ type: "del-obj", pageId: change.pageId, id: change.id });
        break;
      case "del-obj": {
        const page = file.pagesIndex[change.pageId];
        const shape = page?.objects[change.id];
        if (shape) {
          undo.push({
            type: "add-obj",
            pageId: change.pageId,
            id: change.id,
            parentId: shape.parentId || ROOT_FRAME_ID,
            frameId: shape.frameId,
            obj: structuredClone(shape),
          });
        }
        break;
      }
      case "mod-obj": {
        const page = file.pagesIndex[change.pageId];
        const shape = page?.objects[change.id];
        if (shape) {
          const reverseOps: AttributeOp[] = change.operations.map((op) => {
            if (op.type === "set") {
              return { type: "set", attr: op.attr, val: (shape as any)[op.attr] };
            } else {
              const oldVals: Record<string, any> = {};
              for (const key of Object.keys(op.value)) {
                oldVals[key] = (shape as any)[key];
              }
              return { type: "assign", value: oldVals };
            }
          });
          undo.push({
            type: "mod-obj",
            pageId: change.pageId,
            id: change.id,
            operations: reverseOps,
          });
        }
        break;
      }
      // For simplicity, other change types use a snapshot approach
      case "add-page":
        undo.push({ type: "del-page", id: change.page.id });
        break;
      case "del-page": {
        const page = file.pagesIndex[change.id];
        if (page) {
          undo.push({ type: "add-page", page: structuredClone(page) });
        }
        break;
      }
      case "mod-page": {
        const page = file.pagesIndex[change.id];
        if (page) {
          undo.push({ type: "mod-page", id: change.id, name: page.name });
        }
        break;
      }
      case "mov-page": {
        const currentIdx = file.pages.indexOf(change.id);
        if (currentIdx >= 0) {
          undo.push({ type: "mov-page", id: change.id, index: currentIdx });
        }
        break;
      }
      case "mov-objects": {
        // Record original parent/index positions for each moved shape
        const page = file.pagesIndex[change.pageId];
        if (page) {
          for (const shapeId of change.shapes) {
            const shape = page.objects[shapeId];
            if (shape && shape.parentId) {
              const oldParent = page.objects[shape.parentId];
              const oldIndex = oldParent?.shapes?.indexOf(shapeId) ?? -1;
              undo.push({
                type: "mov-objects",
                pageId: change.pageId,
                parentId: shape.parentId,
                shapes: [shapeId],
                index: oldIndex >= 0 ? oldIndex : undefined,
              });
            }
          }
        }
        break;
      }
      case "set-flow": {
        const page = file.pagesIndex[change.pageId];
        const existingFlow = page?.flows?.find((f) => f.id === change.flow.id);
        if (existingFlow) {
          // Was an update — undo restores the old flow
          undo.push({ type: "set-flow", pageId: change.pageId, flow: structuredClone(existingFlow) });
        } else {
          // Was a new flow — undo deletes it
          undo.push({ type: "del-flow", pageId: change.pageId, id: change.flow.id });
        }
        break;
      }
      case "del-flow": {
        const page = file.pagesIndex[change.pageId];
        const deletedFlow = page?.flows?.find((f) => f.id === change.id);
        if (deletedFlow) {
          undo.push({ type: "set-flow", pageId: change.pageId, flow: structuredClone(deletedFlow) });
        }
        break;
      }
      default:
        break;
    }
  }

  return undo.reverse();
}
