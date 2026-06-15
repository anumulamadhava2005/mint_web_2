// ═══════════════════════════════════════════════════════════════
// Data Binding Engine — Connects state to UI reactively
//
// Supports:
//   - Property binding:    { "text": "$user.name" }
//   - Conditional render:  { "visible": "$user.role == 'admin'" }
//   - List binding:        { "items": "$cache.posts" }
//   - Two-way binding:     { "value": "$form.email" }
//   - Pipe transforms:     { "text": "$price | currency:'USD'" }
//   - Auto-subscription management
// ═══════════════════════════════════════════════════════════════

import { parse, evaluate, extractDependencies, isExpression, type ASTNode } from "./expressions";
import { StateEngine } from "./state";
import type { ComponentSchema } from "./schema";

// ── Types ────────────────────────────────────────────────────

export interface ResolvedProps {
  [key: string]: unknown;
}

export interface BindingSubscription {
  componentId: string;
  unsubscribes: (() => void)[];
}

// ── Binding Engine ───────────────────────────────────────────

export class BindingEngine {
  private state: StateEngine;
  private subscriptions = new Map<string, BindingSubscription>();
  private compiledBindings = new Map<string, Map<string, ASTNode>>(); // componentId → prop → AST

  constructor(state: StateEngine) {
    this.state = state;
  }

  /**
   * Compile and cache all bindings for a component.
   * Call this once when the component mounts.
   */
  compileBindings(component: ComponentSchema): void {
    const bindings = new Map<string, ASTNode>();

    // Explicit bindings
    if (component.bindings) {
      for (const [prop, expr] of Object.entries(component.bindings)) {
        try {
          bindings.set(prop, parse(expr));
        } catch (e) {
          console.warn(`[Binding] Failed to compile binding '${prop}' for ${component.id}:`, e);
        }
      }
    }

    // Inline expression props (props that start with $)
    for (const [prop, value] of Object.entries(component.props)) {
      if (typeof value === "string" && isExpression(value) && !bindings.has(prop)) {
        try {
          bindings.set(prop, parse(value));
        } catch {
          // Not a valid expression, use as literal
        }
      }
    }

    // Conditional render
    if (component.conditionalRender) {
      try {
        bindings.set("__visible", parse(component.conditionalRender));
      } catch (e) {
        console.warn(`[Binding] Failed to compile conditional for ${component.id}:`, e);
      }
    }

    // List binding
    if (component.repeatFor) {
      try {
        bindings.set("__items", parse(component.repeatFor.items));
      } catch (e) {
        console.warn(`[Binding] Failed to compile list binding for ${component.id}:`, e);
      }
    }

    this.compiledBindings.set(component.id, bindings);
  }

  /**
   * Resolve all bindings for a component into concrete prop values.
   * Returns the merged result of static props + resolved bindings.
   */
  resolveProps(component: ComponentSchema, extraContext?: Record<string, unknown>): ResolvedProps {
    const bindings = this.compiledBindings.get(component.id);
    const result: ResolvedProps = { ...component.props };

    if (!bindings || bindings.size === 0) return result;

    const context = { ...this.state.getEvalContext(), ...extraContext };

    for (const [prop, ast] of bindings) {
      try {
        result[prop] = evaluate(ast, context);
      } catch (e) {
        // Keep the static prop value on error
        console.warn(`[Binding] Evaluation error for ${component.id}.${prop}:`, e);
      }
    }

    return result;
  }

  /**
   * Check if a component should be rendered (conditional rendering + role check).
   */
  isVisible(component: ComponentSchema, extraContext?: Record<string, unknown>): boolean {
    // Check role-based visibility first
    if (component.requiredRoles?.length) {
      const context = { ...this.state.getEvalContext(), ...extraContext };
      const userRole = (context.user as Record<string, unknown>)?.role as string | undefined;
      if (!userRole || !component.requiredRoles.includes(userRole)) {
        return false;
      }
    }

    if (!component.conditionalRender) return true;

    const bindings = this.compiledBindings.get(component.id);
    const ast = bindings?.get("__visible");
    if (!ast) return true;

    try {
      const context = { ...this.state.getEvalContext(), ...extraContext };
      return Boolean(evaluate(ast, context));
    } catch {
      return true; // Show on error
    }
  }

  /**
   * Resolve list items for a repeating component.
   */
  resolveListItems(component: ComponentSchema): unknown[] {
    if (!component.repeatFor) return [];

    const bindings = this.compiledBindings.get(component.id);
    const ast = bindings?.get("__items");
    if (!ast) return [];

    try {
      const result = evaluate(ast, this.state.getEvalContext());
      return Array.isArray(result) ? result : [];
    } catch {
      return [];
    }
  }

  /**
   * Subscribe a component to its binding dependencies.
   * Returns an unsubscribe function.
   */
  subscribe(
    componentId: string,
    onChange: (resolvedProps: ResolvedProps) => void
  ): () => void {
    const bindings = this.compiledBindings.get(componentId);
    if (!bindings || bindings.size === 0) return () => {};

    // Collect all state dependencies
    const allDeps = new Set<string>();
    for (const ast of bindings.values()) {
      for (const dep of extractDependencies(ast)) {
        allDeps.add(dep);
      }
    }

    // Subscribe to each dependency
    const unsubs: (() => void)[] = [];
    for (const dep of allDeps) {
      const unsub = this.state.subscribe(dep, () => {
        // Re-evaluate all bindings when any dependency changes
        const component = { id: componentId, props: {}, bindings: {}, style: {} } as ComponentSchema;
        const resolved = this.resolvePropsById(componentId);
        if (resolved) onChange(resolved);
      });
      unsubs.push(unsub);
    }

    this.subscriptions.set(componentId, { componentId, unsubscribes: unsubs });

    return () => {
      const sub = this.subscriptions.get(componentId);
      if (sub) {
        for (const unsub of sub.unsubscribes) unsub();
        this.subscriptions.delete(componentId);
      }
    };
  }

  /**
   * Resolve props by component ID (uses cached bindings).
   */
  private resolvePropsById(componentId: string): ResolvedProps | null {
    const bindings = this.compiledBindings.get(componentId);
    if (!bindings) return null;

    const context = this.state.getEvalContext();
    const result: ResolvedProps = {};

    for (const [prop, ast] of bindings) {
      try {
        result[prop] = evaluate(ast, context);
      } catch {
        // Skip failed evaluations
      }
    }

    return result;
  }

  /**
   * Create a two-way binding handler.
   * Returns a function that updates the state when the UI value changes.
   */
  createTwoWayHandler(expression: string): (newValue: unknown) => void {
    // Extract the state path from the expression
    // e.g., "$form.email" → "form.email"
    const path = expression.startsWith("$") ? expression.slice(1) : expression;

    return (newValue: unknown) => {
      this.state.set(path, newValue);
    };
  }

  /**
   * Clean up all subscriptions for a component.
   */
  unmount(componentId: string): void {
    const sub = this.subscriptions.get(componentId);
    if (sub) {
      for (const unsub of sub.unsubscribes) unsub();
      this.subscriptions.delete(componentId);
    }
    this.compiledBindings.delete(componentId);
  }

  /**
   * Clean up everything.
   */
  destroy(): void {
    for (const sub of this.subscriptions.values()) {
      for (const unsub of sub.unsubscribes) unsub();
    }
    this.subscriptions.clear();
    this.compiledBindings.clear();
  }
}
