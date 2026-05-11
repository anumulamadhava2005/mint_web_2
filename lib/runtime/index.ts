// ═══════════════════════════════════════════════════════════════
// Mint Runtime — Public API
//
// This is the unified entry point for the Mint runtime engine.
// It can be:
//   1. Bundled into exported apps (React, RN, etc.)
//   2. Used server-side for schema interpretation
//   3. Used in the editor for preview/prototyping
// ═══════════════════════════════════════════════════════════════

// ── Core Modules ─────────────────────────────────────────────

export {
  // Expression engine
  tokenize,
  parse,
  evaluate,
  evalExpression,
  extractDependencies,
  extractFullPaths,
  isExpression,
  ExpressionError,
  type ASTNode,
  type EvalContext,
  type Token,
  TokenType,
} from "./expressions";

export {
  // Dependency graph
  DependencyGraph,
} from "./dependency-graph";

export {
  // State engine
  StateEngine,
  LocalStoragePersistence,
  type PersistenceAdapter,
  type StateSubscription,
  type AsyncStateEntry,
} from "./state";

export {
  // Action runtime
  ActionRegistry,
  loggingMiddleware,
  performanceMiddleware,
  type ActionContext,
  type ActionHandler,
  type MiddlewareFn,
  type NavigationAdapter,
  type ApiAdapter,
  type StorageAdapter,
  type DeviceAdapter,
} from "./actions";

export {
  // Data binding
  BindingEngine,
  type ResolvedProps,
} from "./bindings";

export {
  // Schema validator
  validateAppSchema,
  type ValidationResult,
  type ValidationError,
  type ValidationWarning,
} from "./validator";

export {
  // Workflow engine
  WorkflowEngine,
  WorkflowTriggerManager,
  compileWorkflow,
  type WorkflowExecutionContext,
  type WorkflowExecutionResult,
  type ExecutionTrace,
  type NodeExecutor,
  type CompiledWorkflow,
} from "./workflow";

export {
  // Database engine
  MintDatabaseClient,
  QueryBuilder,
  generateMigrations,
  generateCRUDRoutes,
  type Migration,
} from "./database";

// ── Schema Types ─────────────────────────────────────────────

export type {
  AppSchema,
  ScreenSchema,
  ComponentSchema,
  ComponentType,
  PropValue,
  StyleSchema,
  LayoutStyle,
  SpacingStyle,
  SizingStyle,
  BackgroundStyle,
  BorderStyle,
  TypographyStyle,
  EffectStyle,
  ResponsiveOverride,
  StateNodeSchema,
  StateScope,
  StateType,
  AsyncStateConfig,
  PersistConfig,
  ValidationRule,
  ActionSchema,
  ActionRef,
  ActionType,
  WorkflowSchema,
  WorkflowTrigger,
  WorkflowNode,
  WorkflowNodeType,
  WorkflowEdge,
  NavigationSchema,
  RouteSchema,
  ThemeSchema,
  AuthConfigSchema,
  AuthProvider,
  DatabaseConfigSchema,
  TableSchema,
  FieldSchema,
  FieldType,
  RelationSchema,
  IndexSchema,
  PolicySchema,
} from "./schema";

// ── Runtime Factory ──────────────────────────────────────────

import type { AppSchema, StateNodeSchema } from "./schema";
import { StateEngine, LocalStoragePersistence } from "./state";
import { ActionRegistry } from "./actions";
import { BindingEngine } from "./bindings";
import { validateAppSchema } from "./validator";
import { WorkflowEngine, WorkflowTriggerManager } from "./workflow";

export interface MintRuntime {
  state: StateEngine;
  actions: ActionRegistry;
  bindings: BindingEngine;
  workflows: WorkflowEngine;
  triggers: WorkflowTriggerManager;
  destroy: () => void;
}

/**
 * Create a complete Mint runtime from an app schema.
 * This is the main entry point for exported apps.
 */
export function createRuntime(schema: AppSchema, options?: {
  validate?: boolean;
  enableLogging?: boolean;
  persistencePrefix?: string;
}): MintRuntime {
  // Validate schema
  if (options?.validate !== false) {
    const result = validateAppSchema(schema);
    if (!result.valid) {
      console.error("[MintRuntime] Schema validation errors:", result.errors);
    }
    if (result.warnings.length > 0) {
      console.warn("[MintRuntime] Schema validation warnings:", result.warnings);
    }
  }

  // Initialize state engine
  const state = new StateEngine();
  state.setPersistenceAdapter(new LocalStoragePersistence(options?.persistencePrefix));

  // Collect all state definitions
  const allState: StateNodeSchema[] = [
    ...(schema.globalState || []),
    ...schema.screens.flatMap((s) => s.localState || []),
  ];
  state.initFromSchema(allState);

  // Initialize action registry
  const actions = new ActionRegistry();
  if (options?.enableLogging) {
    const { loggingMiddleware: lm } = require("./actions");
    actions.use(lm);
  }

  // Register all action schemas
  const allActions = [
    ...(schema.globalActions || []),
    ...schema.screens.flatMap((s) => s.actions || []),
  ];
  actions.registerSchemas(allActions);

  // Initialize binding engine
  const bindings = new BindingEngine(state);

  // Compile all component bindings
  for (const screen of schema.screens) {
    const compileRecursive = (components: typeof screen.components) => {
      for (const comp of components) {
        bindings.compileBindings(comp);
        if (comp.children) compileRecursive(comp.children);
      }
    };
    compileRecursive(screen.components || []);
  }

  // Initialize workflow engine
  const workflows = new WorkflowEngine();
  const triggers = new WorkflowTriggerManager(workflows);

  // Register workflow triggers
  if (schema.workflows?.length) {
    const actionCtx = { state, navigation: undefined, api: undefined, storage: undefined, device: undefined };
    triggers.register(schema.workflows, {
      state,
      actions,
      actionCtx,
      variables: {},
    });
  }

  return {
    state,
    actions,
    bindings,
    workflows,
    triggers,
    destroy: () => {
      state.destroy();
      actions.destroy();
      bindings.destroy();
      workflows.destroy();
      triggers.destroy();
    },
  };
}
