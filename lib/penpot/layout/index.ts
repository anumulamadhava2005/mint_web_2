// ═══════════════════════════════════════════════════════════════
// Layout System — Barrel Export
// Penpot-style auto-adjustment system for frames, groups, and shapes
// ═══════════════════════════════════════════════════════════════

// Core modifier algebra
export type {
  GeometricOp,
  MoveOp,
  ResizeOp,
  RotationOp,
  StructureOp,
  Modifiers,
  ModifTree,
  Bounds,
} from "./modifiers";

export {
  emptyModifiers,
  createModifTree,
  getOrCreateModifiers,
  moveModifiers,
  resizeModifiers,
  rotationModifiers,
  reflowModifiers,
  addMoveChild,
  addMoveParent,
  addResizeChild,
  addResizeParent,
  addReflow,
  shapeToBounds,
  applyGeometricOps,
  applyModifiersToShape,
  mergeModifTrees,
  selectChildOps,
} from "./modifiers";

// Constraint system
export {
  defaultConstraintH,
  defaultConstraintV,
  calcChildConstraintModifiers,
  propagateConstraints,
  isAbsolutelyPositioned,
} from "./constraints";

// Flex layout
export { calcFlexLayoutModifiers, flexLayoutContentBounds } from "./flexLayout";

// Grid layout
export type { GridTrackDef, GridCell, GridLayoutProps } from "./gridLayout";
export {
  calcGridLayoutModifiers,
  assignGridCells,
  pushIntoCell,
  gridLayoutContentBounds,
} from "./gridLayout";

// Auto-sizing
export {
  isAutoWidth,
  isAutoHeight,
  isLayoutFrame,
  findAutoLayouts,
  calcAutoModifiers,
  sizingAutoModifiers,
} from "./autoSizing";

// Group/bool auto-resize
export {
  calcGroupResizeModifiers,
  resizeGroupParents,
} from "./groupResize";

// Pipeline (main entry point)
export type { PipelineParams } from "./pipeline";
export {
  setObjectsModifiers,
  adjustForMove,
  adjustForResize,
  adjustForReflow,
  adjustForStructure,
} from "./pipeline";
