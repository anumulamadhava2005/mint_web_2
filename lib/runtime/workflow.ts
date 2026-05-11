// ═══════════════════════════════════════════════════════════════
// Workflow Execution Engine — Executes visual flowcharts as DAGs
//
// Flowcharts designed in the editor compile into WorkflowSchema
// (nodes + edges). This engine executes them at runtime.
//
// Supports:
//   - DAG execution (topological order)
//   - Async nodes
//   - Condition branching
//   - Parallel execution
//   - Retry with backoff
//   - Rollback on failure
//   - Execution tracing / observability
//   - Timeout protection
// ═══════════════════════════════════════════════════════════════

import type {
  WorkflowSchema,
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeType,
} from "./schema";
import { parse, evaluate, type EvalContext } from "./expressions";
import type { StateEngine } from "./state";
import type { ActionRegistry, ActionContext } from "./actions";

// ── Execution Types ──────────────────────────────────────────

export interface WorkflowExecutionContext {
  state: StateEngine;
  actions: ActionRegistry;
  actionCtx: ActionContext;
  variables: Record<string, unknown>; // workflow-scoped variables
  input?: unknown; // trigger payload
}

export interface WorkflowExecutionResult {
  success: boolean;
  workflowId: string;
  output: unknown;
  trace: ExecutionTrace[];
  duration: number;
  error?: string;
}

export interface ExecutionTrace {
  nodeId: string;
  nodeType: WorkflowNodeType;
  label?: string;
  status: "pending" | "running" | "success" | "failed" | "skipped";
  startTime: number;
  endTime?: number;
  duration?: number;
  input?: unknown;
  output?: unknown;
  error?: string;
  retryCount?: number;
}

export type NodeExecutor = (
  node: WorkflowNode,
  ctx: WorkflowExecutionContext,
  trace: ExecutionTrace
) => Promise<unknown>;

// ── Workflow Engine ──────────────────────────────────────────

export class WorkflowEngine {
  private executors = new Map<string, NodeExecutor>();
  private runningWorkflows = new Map<string, AbortController>();
  private maxConcurrentWorkflows = 10;
  private defaultTimeout = 30_000; // 30s per node

  constructor() {
    this.registerBuiltinExecutors();
  }

  /** Register a custom node executor */
  registerExecutor(type: string, executor: NodeExecutor): void {
    this.executors.set(type, executor);
  }

  /** Execute a workflow */
  async execute(
    workflow: WorkflowSchema,
    ctx: WorkflowExecutionContext,
    options?: { timeout?: number; signal?: AbortSignal }
  ): Promise<WorkflowExecutionResult> {
    const startTime = Date.now();
    const trace: ExecutionTrace[] = [];
    const executionId = `${workflow.id}_${Date.now()}`;

    // Check concurrent limit
    if (this.runningWorkflows.size >= this.maxConcurrentWorkflows) {
      return {
        success: false,
        workflowId: workflow.id,
        output: null,
        trace: [],
        duration: 0,
        error: "Maximum concurrent workflows exceeded",
      };
    }

    const abortController = new AbortController();
    this.runningWorkflows.set(executionId, abortController);

    // Combine with external signal
    if (options?.signal) {
      options.signal.addEventListener("abort", () => abortController.abort());
    }

    try {
      // Build adjacency graph
      const graph = this.buildGraph(workflow);

      // Find entry nodes (nodes with no incoming edges)
      const entryNodes = this.findEntryNodes(workflow);
      if (entryNodes.length === 0) {
        return {
          success: false,
          workflowId: workflow.id,
          output: null,
          trace,
          duration: Date.now() - startTime,
          error: "No entry nodes found in workflow",
        };
      }

      // Execute starting from entry nodes
      let lastOutput: unknown = ctx.input;
      const completed = new Set<string>();

      const executeNode = async (nodeId: string): Promise<unknown> => {
        if (completed.has(nodeId)) return ctx.variables[`_node_${nodeId}_output`];
        if (abortController.signal.aborted) throw new Error("Workflow aborted");

        const node = workflow.nodes.find((n) => n.id === nodeId);
        if (!node) throw new Error(`Node not found: ${nodeId}`);

        // Wait for all dependencies (incoming edges) to complete
        const incomingEdges = workflow.edges.filter((e) => e.to === nodeId);
        for (const edge of incomingEdges) {
          if (!completed.has(edge.from)) {
            await executeNode(edge.from);
          }

          // Check edge condition
          if (edge.condition) {
            try {
              const evalCtx: EvalContext = {
                ...ctx.state.getEvalContext(),
                ...ctx.variables,
                _input: ctx.input,
              };
              const condResult = evaluate(parse(edge.condition), evalCtx);
              if (!condResult) {
                // Condition false — skip this node
                const skipTrace: ExecutionTrace = {
                  nodeId,
                  nodeType: node.type,
                  label: node.label,
                  status: "skipped",
                  startTime: Date.now(),
                  endTime: Date.now(),
                  duration: 0,
                };
                trace.push(skipTrace);
                completed.add(nodeId);
                return undefined;
              }
            } catch (e) {
              // On expression error, proceed (don't skip)
            }
          }
        }

        // Create trace entry
        const nodeTrace: ExecutionTrace = {
          nodeId,
          nodeType: node.type,
          label: node.label,
          status: "running",
          startTime: Date.now(),
        };
        trace.push(nodeTrace);

        // Execute with retry
        const retryPolicy = node.retryPolicy || { maxRetries: 0, backoff: "linear" as const, delayMs: 1000 };
        let lastError: Error | null = null;
        let retryCount = 0;

        for (let attempt = 0; attempt <= retryPolicy.maxRetries; attempt++) {
          try {
            const nodeTimeout = options?.timeout || this.defaultTimeout;
            const output = await this.executeNodeWithTimeout(node, ctx, nodeTrace, nodeTimeout);

            // Store output in workflow variables
            ctx.variables[`_node_${nodeId}_output`] = output;
            lastOutput = output;

            nodeTrace.status = "success";
            nodeTrace.output = output;
            nodeTrace.endTime = Date.now();
            nodeTrace.duration = nodeTrace.endTime - nodeTrace.startTime;
            nodeTrace.retryCount = retryCount;

            completed.add(nodeId);

            // Execute outgoing edges
            const outgoing = workflow.edges.filter((e) => e.from === nodeId);
            for (const edge of outgoing) {
              await executeNode(edge.to);
            }

            return output;
          } catch (e) {
            lastError = e instanceof Error ? e : new Error(String(e));
            retryCount = attempt + 1;

            if (attempt < retryPolicy.maxRetries) {
              const delay = retryPolicy.backoff === "exponential"
                ? retryPolicy.delayMs * Math.pow(2, attempt)
                : retryPolicy.delayMs * (attempt + 1);
              await this.sleep(delay);
            }
          }
        }

        // All retries exhausted
        nodeTrace.status = "failed";
        nodeTrace.error = lastError?.message || "Unknown error";
        nodeTrace.endTime = Date.now();
        nodeTrace.duration = nodeTrace.endTime - nodeTrace.startTime;
        nodeTrace.retryCount = retryCount;

        completed.add(nodeId);
        throw lastError || new Error(`Node ${nodeId} failed`);
      };

      // Execute all entry nodes
      for (const entryId of entryNodes) {
        await executeNode(entryId);
      }

      return {
        success: true,
        workflowId: workflow.id,
        output: lastOutput,
        trace,
        duration: Date.now() - startTime,
      };
    } catch (e) {
      return {
        success: false,
        workflowId: workflow.id,
        output: null,
        trace,
        duration: Date.now() - startTime,
        error: e instanceof Error ? e.message : String(e),
      };
    } finally {
      this.runningWorkflows.delete(executionId);
    }
  }

  /** Cancel a running workflow */
  cancelAll(): void {
    for (const controller of this.runningWorkflows.values()) {
      controller.abort();
    }
    this.runningWorkflows.clear();
  }

  // ── Graph Utilities ────────────────────────────────────

  private buildGraph(workflow: WorkflowSchema): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();
    for (const node of workflow.nodes) {
      graph.set(node.id, new Set());
    }
    for (const edge of workflow.edges) {
      graph.get(edge.from)?.add(edge.to);
    }
    return graph;
  }

  private findEntryNodes(workflow: WorkflowSchema): string[] {
    const hasIncoming = new Set<string>();
    for (const edge of workflow.edges) {
      hasIncoming.add(edge.to);
    }
    return workflow.nodes
      .filter((n) => !hasIncoming.has(n.id))
      .map((n) => n.id);
  }

  // ── Node Execution ─────────────────────────────────────

  private async executeNodeWithTimeout(
    node: WorkflowNode,
    ctx: WorkflowExecutionContext,
    trace: ExecutionTrace,
    timeout: number
  ): Promise<unknown> {
    return Promise.race([
      this.executeNodeDirect(node, ctx, trace),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Node '${node.label || node.id}' timed out after ${timeout}ms`)), timeout)
      ),
    ]);
  }

  private async executeNodeDirect(
    node: WorkflowNode,
    ctx: WorkflowExecutionContext,
    trace: ExecutionTrace
  ): Promise<unknown> {
    const executor = this.executors.get(node.type);
    if (!executor) {
      throw new Error(`No executor registered for node type: ${node.type}`);
    }
    return executor(node, ctx, trace);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ── Built-in Executors ─────────────────────────────────

  private registerBuiltinExecutors(): void {
    // ── Logic Nodes ──────────────────────────────────────

    this.registerExecutor("condition", async (node, ctx) => {
      const expression = String(node.config.expression || "true");
      const evalCtx: EvalContext = {
        ...ctx.state.getEvalContext(),
        ...ctx.variables,
        _input: ctx.input,
      };
      return evaluate(parse(expression), evalCtx);
    });

    this.registerExecutor("switch", async (node, ctx) => {
      const expression = String(node.config.expression || "");
      const evalCtx: EvalContext = {
        ...ctx.state.getEvalContext(),
        ...ctx.variables,
        _input: ctx.input,
      };
      return evaluate(parse(expression), evalCtx);
    });

    this.registerExecutor("transform", async (node, ctx) => {
      const expression = String(node.config.expression || "$_input");
      const evalCtx: EvalContext = {
        ...ctx.state.getEvalContext(),
        ...ctx.variables,
        _input: ctx.variables._lastOutput,
      };
      const result = evaluate(parse(expression), evalCtx);
      if (node.config.storePath) {
        ctx.state.set(String(node.config.storePath), result);
      }
      return result;
    });

    this.registerExecutor("loop", async (node, ctx) => {
      const itemsExpr = String(node.config.items || "[]");
      const evalCtx: EvalContext = {
        ...ctx.state.getEvalContext(),
        ...ctx.variables,
      };
      const items = evaluate(parse(itemsExpr), evalCtx);
      if (!Array.isArray(items)) return [];

      const results: unknown[] = [];
      const bodyActions = node.config.actions as string[] | undefined;

      for (let i = 0; i < items.length; i++) {
        ctx.variables._loop = { item: items[i], index: i, length: items.length };

        if (bodyActions) {
          for (const actionRef of bodyActions) {
            const result = await ctx.actions.dispatch(actionRef, ctx.actionCtx);
            results.push(result);
          }
        }
      }

      delete ctx.variables._loop;
      return results;
    });

    this.registerExecutor("delay", async (node) => {
      const ms = Number(node.config.ms || node.config.duration || 1000);
      await this.sleep(ms);
      return { delayed: ms };
    });

    this.registerExecutor("parallel", async (node, ctx) => {
      const actionRefs = node.config.actions as string[] | undefined;
      if (!actionRefs?.length) return [];
      return Promise.all(
        actionRefs.map((ref) => ctx.actions.dispatch(ref, ctx.actionCtx))
      );
    });

    // ── Backend Nodes ────────────────────────────────────

    this.registerExecutor("apiCall", async (node, ctx) => {
      const url = this.resolveTemplate(String(node.config.url || ""), ctx);
      const method = String(node.config.method || "GET").toUpperCase();
      const headers = (node.config.headers || {}) as Record<string, string>;
      const body = node.config.body
        ? JSON.stringify(this.resolveConfigExpressions(node.config.body as Record<string, unknown>, ctx))
        : undefined;

      const response = await fetch(url, { method, headers, body });
      const data = await response.json();

      if (node.config.storePath) {
        ctx.state.set(String(node.config.storePath), data);
      }
      if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }

      return data;
    });

    this.registerExecutor("dbQuery", async (node, ctx) => {
      // Database queries are executed via the API layer
      const query = this.resolveTemplate(String(node.config.query || ""), ctx);
      const params = this.resolveConfigExpressions(
        (node.config.params || {}) as Record<string, unknown>,
        ctx
      );

      // Route through the API adapter
      if (ctx.actionCtx.api) {
        const response = await ctx.actionCtx.api.fetch("/api/db/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, params }),
        });
        const data = await response.json();
        if (node.config.storePath) {
          ctx.state.set(String(node.config.storePath), data);
        }
        return data;
      }

      throw new Error("No API adapter configured for database queries");
    });

    this.registerExecutor("dbMutate", async (node, ctx) => {
      const operation = String(node.config.operation || "insert");
      const table = String(node.config.table || "");
      const data = this.resolveConfigExpressions(
        (node.config.data || {}) as Record<string, unknown>,
        ctx
      );

      if (ctx.actionCtx.api) {
        const response = await ctx.actionCtx.api.fetch("/api/db/mutate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operation, table, data }),
        });
        return response.json();
      }

      throw new Error("No API adapter configured for database mutations");
    });

    this.registerExecutor("authCheck", async (node, ctx) => {
      const requiredRole = node.config.role as string | undefined;
      const evalCtx: EvalContext = {
        ...ctx.state.getEvalContext(),
        ...ctx.variables,
      };

      const user = evaluate(parse("$session.user"), evalCtx);
      if (!user) throw new Error("User not authenticated");

      if (requiredRole) {
        const userRole = evaluate(parse("$session.user.role"), evalCtx);
        if (userRole !== requiredRole) {
          throw new Error(`Insufficient permissions: required '${requiredRole}', got '${userRole}'`);
        }
      }

      return user;
    });

    // ── UI Nodes ─────────────────────────────────────────

    this.registerExecutor("navigate", async (node, ctx) => {
      const route = this.resolveTemplate(String(node.config.route || "/"), ctx);
      ctx.actionCtx.navigation?.navigate(route, node.config.params as Record<string, unknown>);
      return { navigated: route };
    });

    this.registerExecutor("showModal", async (node, ctx) => {
      const modalId = String(node.config.modalId || "default");
      ctx.state.set(`_modals.${modalId}`, { open: true, data: node.config.data });
      return { modal: modalId };
    });

    this.registerExecutor("updateState", async (node, ctx) => {
      const path = String(node.config.path || "");
      const valueExpr = node.config.value;

      let value: unknown;
      if (typeof valueExpr === "string" && valueExpr.startsWith("$")) {
        const evalCtx: EvalContext = {
          ...ctx.state.getEvalContext(),
          ...ctx.variables,
          _input: ctx.input,
        };
        value = evaluate(parse(valueExpr), evalCtx);
      } else {
        value = valueExpr;
      }

      ctx.state.set(path, value);
      return { path, value };
    });

    this.registerExecutor("toast", async (node, ctx) => {
      const message = this.resolveTemplate(String(node.config.message || ""), ctx);
      const type = String(node.config.type || "info");
      const toasts = (ctx.state.get("_toasts") as unknown[]) || [];
      ctx.state.set("_toasts", [
        ...toasts,
        { id: Date.now(), message, type, duration: node.config.duration || 3000 },
      ]);
      return { toast: message };
    });

    // ── Utility Nodes ────────────────────────────────────

    this.registerExecutor("timer", async (node) => {
      const ms = Number(node.config.duration || node.config.ms || 1000);
      await this.sleep(ms);
      return { elapsed: ms };
    });

    this.registerExecutor("formatter", async (node, ctx) => {
      const template = String(node.config.template || "");
      return this.resolveTemplate(template, ctx);
    });

    this.registerExecutor("parser", async (node, ctx) => {
      const input = node.config.input
        ? this.resolveTemplate(String(node.config.input), ctx)
        : String(ctx.variables._lastOutput || "");
      const format = String(node.config.format || "json");

      switch (format) {
        case "json":
          return JSON.parse(input);
        case "number":
          return Number(input);
        case "boolean":
          return input === "true" || input === "1";
        default:
          return input;
      }
    });

    this.registerExecutor("logger", async (node, ctx) => {
      const level = String(node.config.level || "log");
      const message = this.resolveTemplate(String(node.config.message || ""), ctx);
      const data = node.config.data
        ? this.resolveConfigExpressions(node.config.data as Record<string, unknown>, ctx)
        : undefined;

      switch (level) {
        case "error": console.error(`[Workflow] ${message}`, data || ""); break;
        case "warn": console.warn(`[Workflow] ${message}`, data || ""); break;
        case "debug": console.debug(`[Workflow] ${message}`, data || ""); break;
        default: console.log(`[Workflow] ${message}`, data || "");
      }

      return { logged: message };
    });

    this.registerExecutor("email", async (node, ctx) => {
      // Email is sent via API
      if (!ctx.actionCtx.api) throw new Error("No API adapter for email");

      const to = this.resolveTemplate(String(node.config.to || ""), ctx);
      const subject = this.resolveTemplate(String(node.config.subject || ""), ctx);
      const body = this.resolveTemplate(String(node.config.body || ""), ctx);

      const response = await ctx.actionCtx.api.fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, body }),
      });

      return response.json();
    });

    this.registerExecutor("notification", async (node, ctx) => {
      const title = this.resolveTemplate(String(node.config.title || ""), ctx);
      const body = this.resolveTemplate(String(node.config.body || ""), ctx);

      if (ctx.actionCtx.device?.notifications) {
        await ctx.actionCtx.device.notifications.send(title, body);
        return { sent: true };
      }

      // Fallback to state-based toast
      const toasts = (ctx.state.get("_toasts") as unknown[]) || [];
      ctx.state.set("_toasts", [
        ...toasts,
        { id: Date.now(), message: `${title}: ${body}`, type: "info", duration: 5000 },
      ]);
      return { sent: false, fallback: "toast" };
    });
  }

  // ── Template Resolution ────────────────────────────────

  /** Resolve {{expression}} templates in strings */
  private resolveTemplate(template: string, ctx: WorkflowExecutionContext): string {
    return template.replace(/\{\{(.+?)\}\}/g, (_, expr) => {
      try {
        const evalCtx: EvalContext = {
          ...ctx.state.getEvalContext(),
          ...ctx.variables,
          _input: ctx.input,
        };
        const result = evaluate(parse(expr.trim()), evalCtx);
        return String(result ?? "");
      } catch {
        return `{{${expr}}}`;
      }
    });
  }

  /** Resolve expression values in a config object */
  private resolveConfigExpressions(
    config: Record<string, unknown>,
    ctx: WorkflowExecutionContext
  ): Record<string, unknown> {
    const evalCtx: EvalContext = {
      ...ctx.state.getEvalContext(),
      ...ctx.variables,
      _input: ctx.input,
    };

    const resolved: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(config)) {
      if (typeof value === "string" && value.startsWith("$")) {
        try {
          resolved[key] = evaluate(parse(value), evalCtx);
        } catch {
          resolved[key] = value;
        }
      } else {
        resolved[key] = value;
      }
    }
    return resolved;
  }

  /** Destroy and clean up */
  destroy(): void {
    this.cancelAll();
    this.executors.clear();
  }
}

// ── Workflow Compiler ────────────────────────────────────────
// Validates and compiles a workflow schema into an optimized form

export interface CompiledWorkflow {
  schema: WorkflowSchema;
  entryNodes: string[];
  topologicalOrder: string[];
  edgesFrom: Map<string, WorkflowEdge[]>;
  edgesTo: Map<string, WorkflowEdge[]>;
}

export function compileWorkflow(schema: WorkflowSchema): CompiledWorkflow {
  // Build edge lookup maps
  const edgesFrom = new Map<string, WorkflowEdge[]>();
  const edgesTo = new Map<string, WorkflowEdge[]>();

  for (const node of schema.nodes) {
    edgesFrom.set(node.id, []);
    edgesTo.set(node.id, []);
  }

  for (const edge of schema.edges) {
    edgesFrom.get(edge.from)?.push(edge);
    edgesTo.get(edge.to)?.push(edge);
  }

  // Find entry nodes
  const entryNodes = schema.nodes
    .filter((n) => (edgesTo.get(n.id)?.length || 0) === 0)
    .map((n) => n.id);

  // Topological sort
  const visited = new Set<string>();
  const order: string[] = [];

  function visit(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    for (const edge of edgesFrom.get(nodeId) || []) {
      visit(edge.to);
    }
    order.unshift(nodeId);
  }

  for (const entry of entryNodes) visit(entry);

  return { schema, entryNodes, topologicalOrder: order, edgesFrom, edgesTo };
}

// ── Workflow Trigger System ──────────────────────────────────

export class WorkflowTriggerManager {
  private engine: WorkflowEngine;
  private workflows: WorkflowSchema[] = [];
  private timers = new Map<string, ReturnType<typeof setInterval>>();

  constructor(engine: WorkflowEngine) {
    this.engine = engine;
  }

  /** Register workflows and set up their triggers */
  register(
    workflows: WorkflowSchema[],
    ctx: WorkflowExecutionContext
  ): void {
    this.workflows = workflows;

    for (const workflow of workflows) {
      if (!workflow.trigger) continue;

      switch (workflow.trigger.type) {
        case "schedule": {
          const interval = Number(workflow.trigger.config.interval || 60000);
          const timer = setInterval(async () => {
            await this.engine.execute(workflow, {
              ...ctx,
              variables: {},
              input: { trigger: "schedule", timestamp: Date.now() },
            });
          }, interval);
          this.timers.set(workflow.id, timer);
          break;
        }

        case "stateChange": {
          const path = String(workflow.trigger.config.path || "");
          if (path) {
            ctx.state.subscribe(path, async (value) => {
              await this.engine.execute(workflow, {
                ...ctx,
                variables: {},
                input: { trigger: "stateChange", path, value },
              });
            });
          }
          break;
        }

        // "event" and "action" triggers are dispatched manually
        // "webhook" triggers are handled by the API layer
      }
    }
  }

  /** Manually trigger a workflow by ID */
  async trigger(
    workflowId: string,
    ctx: WorkflowExecutionContext,
    input?: unknown
  ): Promise<WorkflowExecutionResult | null> {
    const workflow = this.workflows.find((w) => w.id === workflowId);
    if (!workflow) return null;

    return this.engine.execute(workflow, {
      ...ctx,
      variables: {},
      input,
    });
  }

  /** Clean up all timers */
  destroy(): void {
    for (const timer of this.timers.values()) {
      clearInterval(timer);
    }
    this.timers.clear();
  }
}
