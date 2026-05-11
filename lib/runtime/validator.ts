// ═══════════════════════════════════════════════════════════════
// Schema Validator — Validates runtime schemas before execution
//
// Ensures schemas are well-formed before they reach the runtime.
// Invalid schemas produce clear error messages, not runtime crashes.
// ═══════════════════════════════════════════════════════════════

import type {
  AppSchema, ScreenSchema, ComponentSchema, StateNodeSchema,
  ActionSchema, WorkflowSchema, StyleSchema, TableSchema,
} from "./schema";
import { parse, extractDependencies } from "./expressions";

// ── Validation Result ────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  path: string; // e.g., "screens[0].components[2].bindings.text"
  code: string;
  message: string;
}

export interface ValidationWarning {
  path: string;
  code: string;
  message: string;
}

// ── Validator ────────────────────────────────────────────────

export function validateAppSchema(schema: AppSchema): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Basic structure
  if (!schema.id) errors.push({ path: "id", code: "MISSING_ID", message: "App schema must have an id" });
  if (!schema.name) errors.push({ path: "name", code: "MISSING_NAME", message: "App schema must have a name" });
  if (!schema.schemaVersion) warnings.push({ path: "schemaVersion", code: "NO_VERSION", message: "Schema version not set" });

  // Collect all known IDs for cross-reference validation
  const screenIds = new Set<string>();
  const stateIds = new Set<string>();
  const actionIds = new Set<string>();
  const routePaths = new Set<string>();

  // Register global state and actions
  for (const s of schema.globalState || []) stateIds.add(s.name);
  for (const a of schema.globalActions || []) actionIds.add(a.id);

  // Validate screens
  for (let i = 0; i < (schema.screens || []).length; i++) {
    const screen = schema.screens[i];
    const path = `screens[${i}]`;

    if (!screen.id) errors.push({ path: `${path}.id`, code: "MISSING_ID", message: "Screen must have an id" });
    if (!screen.route) errors.push({ path: `${path}.route`, code: "MISSING_ROUTE", message: "Screen must have a route" });

    if (screenIds.has(screen.id)) {
      errors.push({ path: `${path}.id`, code: "DUPLICATE_ID", message: `Duplicate screen id: ${screen.id}` });
    }
    screenIds.add(screen.id);

    if (routePaths.has(screen.route)) {
      errors.push({ path: `${path}.route`, code: "DUPLICATE_ROUTE", message: `Duplicate route: ${screen.route}` });
    }
    routePaths.add(screen.route);

    // Validate local state
    for (const s of screen.localState || []) stateIds.add(s.name);

    // Validate components
    validateComponents(screen.components || [], `${path}.components`, errors, warnings, stateIds);

    // Validate actions
    for (const a of screen.actions || []) actionIds.add(a.id);
  }

  // Validate global state schemas
  for (let i = 0; i < (schema.globalState || []).length; i++) {
    validateStateNode(schema.globalState[i], `globalState[${i}]`, errors, warnings, stateIds);
  }

  // Validate navigation
  if (schema.navigation) {
    if (!schema.navigation.initialRoute) {
      errors.push({ path: "navigation.initialRoute", code: "MISSING_INITIAL_ROUTE", message: "Navigation must have an initialRoute" });
    }
    for (let i = 0; i < (schema.navigation.routes || []).length; i++) {
      const route = schema.navigation.routes[i];
      if (!screenIds.has(route.screenId)) {
        warnings.push({
          path: `navigation.routes[${i}].screenId`,
          code: "UNKNOWN_SCREEN",
          message: `Route references unknown screen: ${route.screenId}`,
        });
      }
    }
  }

  // Validate workflows
  for (let i = 0; i < (schema.workflows || []).length; i++) {
    validateWorkflow(schema.workflows[i], `workflows[${i}]`, errors, warnings);
  }

  // Validate database tables
  if (schema.database?.tables) {
    for (let i = 0; i < schema.database.tables.length; i++) {
      validateTable(schema.database.tables[i], `database.tables[${i}]`, errors, warnings);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

function validateComponents(
  components: ComponentSchema[],
  basePath: string,
  errors: ValidationError[],
  warnings: ValidationWarning[],
  stateIds: Set<string>
): void {
  for (let i = 0; i < components.length; i++) {
    const comp = components[i];
    const path = `${basePath}[${i}]`;

    if (!comp.id) errors.push({ path: `${path}.id`, code: "MISSING_ID", message: "Component must have an id" });
    if (!comp.type) errors.push({ path: `${path}.type`, code: "MISSING_TYPE", message: "Component must have a type" });

    // Validate bindings are parseable
    if (comp.bindings) {
      for (const [prop, expr] of Object.entries(comp.bindings)) {
        try {
          const ast = parse(expr);
          const deps = extractDependencies(ast);
          for (const dep of deps) {
            if (!stateIds.has(dep) && !dep.startsWith("_")) {
              warnings.push({
                path: `${path}.bindings.${prop}`,
                code: "UNKNOWN_STATE_REF",
                message: `Binding references unknown state: $${dep}`,
              });
            }
          }
        } catch (e) {
          errors.push({
            path: `${path}.bindings.${prop}`,
            code: "INVALID_EXPRESSION",
            message: `Invalid expression: ${e instanceof Error ? e.message : String(e)}`,
          });
        }
      }
    }

    // Validate conditional
    if (comp.conditionalRender) {
      try { parse(comp.conditionalRender); }
      catch (e) {
        errors.push({
          path: `${path}.conditionalRender`,
          code: "INVALID_EXPRESSION",
          message: `Invalid conditional expression: ${e instanceof Error ? e.message : String(e)}`,
        });
      }
    }

    // Recurse into children
    if (comp.children) {
      validateComponents(comp.children, `${path}.children`, errors, warnings, stateIds);
    }
  }
}

function validateStateNode(
  schema: StateNodeSchema,
  path: string,
  errors: ValidationError[],
  warnings: ValidationWarning[],
  stateIds: Set<string>
): void {
  if (!schema.name) errors.push({ path: `${path}.name`, code: "MISSING_NAME", message: "State node must have a name" });
  if (!schema.scope) errors.push({ path: `${path}.scope`, code: "MISSING_SCOPE", message: "State node must have a scope" });

  if (schema.derived) {
    try {
      const ast = parse(schema.derived);
      const deps = extractDependencies(ast);
      // Check for self-reference
      if (deps.has(schema.name)) {
        errors.push({
          path: `${path}.derived`,
          code: "SELF_REFERENCE",
          message: `Derived state '${schema.name}' references itself`,
        });
      }
    } catch (e) {
      errors.push({
        path: `${path}.derived`,
        code: "INVALID_EXPRESSION",
        message: `Invalid derived expression: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }
}

function validateWorkflow(
  schema: WorkflowSchema,
  path: string,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  if (!schema.id) errors.push({ path: `${path}.id`, code: "MISSING_ID", message: "Workflow must have an id" });
  if (!schema.nodes?.length) warnings.push({ path: `${path}.nodes`, code: "EMPTY_WORKFLOW", message: "Workflow has no nodes" });

  const nodeIds = new Set<string>();
  for (const node of schema.nodes || []) {
    if (nodeIds.has(node.id)) {
      errors.push({ path: `${path}.nodes`, code: "DUPLICATE_NODE", message: `Duplicate node id: ${node.id}` });
    }
    nodeIds.add(node.id);
  }

  // Validate edges reference existing nodes
  for (let i = 0; i < (schema.edges || []).length; i++) {
    const edge = schema.edges[i];
    if (!nodeIds.has(edge.from)) {
      errors.push({ path: `${path}.edges[${i}].from`, code: "UNKNOWN_NODE", message: `Edge references unknown node: ${edge.from}` });
    }
    if (!nodeIds.has(edge.to)) {
      errors.push({ path: `${path}.edges[${i}].to`, code: "UNKNOWN_NODE", message: `Edge references unknown node: ${edge.to}` });
    }
  }
}

function validateTable(
  schema: TableSchema,
  path: string,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  if (!schema.name) errors.push({ path: `${path}.name`, code: "MISSING_NAME", message: "Table must have a name" });
  if (!/^[a-z][a-z0-9_]*$/.test(schema.name || "")) {
    warnings.push({ path: `${path}.name`, code: "INVALID_TABLE_NAME", message: `Table name should be snake_case: ${schema.name}` });
  }

  const fieldNames = new Set<string>();
  for (const field of schema.fields || []) {
    if (fieldNames.has(field.name)) {
      errors.push({ path: `${path}.fields`, code: "DUPLICATE_FIELD", message: `Duplicate field: ${field.name}` });
    }
    fieldNames.add(field.name);
  }
}
