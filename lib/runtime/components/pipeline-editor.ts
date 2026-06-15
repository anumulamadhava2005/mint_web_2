// ═══════════════════════════════════════════════════════════════
// Workflow Pipeline Editor — Approval pipeline management
//
// Provides CRUD operations for workflow_steps and maps them
// to the WorkflowSchema (nodes + edges) for execution.
// ═══════════════════════════════════════════════════════════════

import type { WorkflowSchema, WorkflowNode, WorkflowEdge } from "../schema";

// ── Types ────────────────────────────────────────────────────

export interface PipelineStep {
  id: string;
  stepKey: string;
  label: string;
  approverRole?: string;
  position: number;
  active: boolean;
  conditionJson?: Record<string, unknown>;
  createdAt?: string;
}

export interface PipelineConfig {
  steps: PipelineStep[];
  name?: string;
  description?: string;
}

export interface PipelineValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ── Pipeline Editor Engine ───────────────────────────────────

export class PipelineEditor {
  private steps: PipelineStep[];
  private name: string;

  constructor(config?: PipelineConfig) {
    this.steps = config?.steps || [];
    this.name = config?.name || "Approval Pipeline";
    this.sortSteps();
  }

  // ── CRUD ─────────────────────────────────────────────────

  /** Get all steps sorted by position */
  getSteps(): PipelineStep[] {
    return [...this.steps];
  }

  /** Add a step at the given position (or end) */
  addStep(step: Omit<PipelineStep, "position">, atPosition?: number): PipelineStep {
    const pos = atPosition ?? this.steps.length + 1;
    const newStep: PipelineStep = { ...step, position: pos, active: step.active ?? true };

    // Shift existing steps down if inserting
    for (const s of this.steps) {
      if (s.position >= pos) s.position++;
    }

    this.steps.push(newStep);
    this.sortSteps();
    return newStep;
  }

  /** Update a step by ID */
  updateStep(id: string, updates: Partial<PipelineStep>): PipelineStep | null {
    const step = this.steps.find((s) => s.id === id);
    if (!step) return null;
    Object.assign(step, updates);
    this.sortSteps();
    return step;
  }

  /** Remove a step by ID */
  removeStep(id: string): boolean {
    const idx = this.steps.findIndex((s) => s.id === id);
    if (idx === -1) return false;
    this.steps.splice(idx, 1);
    this.reindex();
    return true;
  }

  /** Move a step to a new position */
  moveStep(id: string, newPosition: number): boolean {
    const step = this.steps.find((s) => s.id === id);
    if (!step) return false;

    const oldPos = step.position;
    if (oldPos === newPosition) return true;

    // Shift other steps
    for (const s of this.steps) {
      if (s.id === id) continue;
      if (oldPos < newPosition && s.position > oldPos && s.position <= newPosition) {
        s.position--;
      } else if (oldPos > newPosition && s.position >= newPosition && s.position < oldPos) {
        s.position++;
      }
    }
    step.position = newPosition;
    this.sortSteps();
    return true;
  }

  /** Toggle a step active/inactive */
  toggleStep(id: string): boolean {
    const step = this.steps.find((s) => s.id === id);
    if (!step) return false;
    step.active = !step.active;
    return true;
  }

  // ── Conversion ─────────────────────────────────────────────

  /** Convert pipeline steps to a WorkflowSchema for execution */
  toWorkflowSchema(): WorkflowSchema {
    const activeSteps = this.steps.filter((s) => s.active);
    const nodes: WorkflowNode[] = [];
    const edges: WorkflowEdge[] = [];

    // Submit node (entry)
    nodes.push({
      id: "node_submit",
      type: "updateState",
      label: "Submit Expense",
      config: {
        path: "local.activeExpense.status",
        value: activeSteps.length > 0
          ? `pending_${activeSteps[0].stepKey}`
          : "approved",
      },
    });

    // Approval nodes
    for (let i = 0; i < activeSteps.length; i++) {
      const step = activeSteps[i];
      const nextStatus = i < activeSteps.length - 1
        ? `pending_${activeSteps[i + 1].stepKey}`
        : "approved";

      nodes.push({
        id: `node_${step.stepKey}`,
        type: "condition",
        label: step.label,
        config: {
          expression: `$local.activeExpense.current_step_key == '${step.stepKey}'`,
          approverRole: step.approverRole,
          ...(step.conditionJson || {}),
        },
      });

      // Edge from previous to current
      const prevId = i === 0 ? "node_submit" : `node_${activeSteps[i - 1].stepKey}`;
      edges.push({
        id: `edge_${prevId}_to_${step.stepKey}`,
        from: prevId,
        to: `node_${step.stepKey}`,
        condition: i === 0 ? undefined : `$local.activeExpense.status == 'pending_${step.stepKey}'`,
      });
    }

    // Approved node (end)
    if (activeSteps.length > 0) {
      nodes.push({
        id: "node_approved",
        type: "updateState",
        label: "Approved",
        config: {
          path: "local.activeExpense.status",
          value: "approved",
        },
      });

      const lastStep = activeSteps[activeSteps.length - 1];
      edges.push({
        id: `edge_${lastStep.stepKey}_to_approved`,
        from: `node_${lastStep.stepKey}`,
        to: "node_approved",
      });
    }

    return {
      id: "expense_approval_workflow",
      name: this.name,
      nodes,
      edges,
      trigger: { type: "action", config: { actionName: "submitExpense" } },
    };
  }

  /** Convert from workflow_steps DB rows */
  static fromDatabaseRows(rows: Record<string, unknown>[]): PipelineEditor {
    const steps: PipelineStep[] = rows.map((row) => ({
      id: String(row.id),
      stepKey: String(row.step_key),
      label: String(row.label),
      approverRole: row.approver_role ? String(row.approver_role) : undefined,
      position: Number(row.position),
      active: row.active !== false,
      conditionJson: row.condition_json as Record<string, unknown> | undefined,
      createdAt: row.created_at ? String(row.created_at) : undefined,
    }));

    return new PipelineEditor({ steps });
  }

  /** Generate SQL to sync steps back to workflow_steps table */
  toSyncSQL(tablePrefix: string = ""): { upserts: { sql: string; params: unknown[] }[]; deletes: string[] } {
    const table = tablePrefix ? `${tablePrefix}workflow_steps` : "workflow_steps";
    const upserts = this.steps.map((step) => ({
      sql: `INSERT INTO "${table}" (id, step_key, label, approver_role, position, active, condition_json)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (id) DO UPDATE SET
              step_key = EXCLUDED.step_key,
              label = EXCLUDED.label,
              approver_role = EXCLUDED.approver_role,
              position = EXCLUDED.position,
              active = EXCLUDED.active,
              condition_json = EXCLUDED.condition_json`,
      params: [
        step.id,
        step.stepKey,
        step.label,
        step.approverRole || null,
        step.position,
        step.active,
        step.conditionJson ? JSON.stringify(step.conditionJson) : null,
      ],
    }));

    return { upserts, deletes: [] };
  }

  // ── Validation ─────────────────────────────────────────────

  validate(): PipelineValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (this.steps.length === 0) {
      warnings.push("Pipeline has no steps — expenses will be auto-approved");
    }

    const activeSteps = this.steps.filter((s) => s.active);
    if (activeSteps.length === 0 && this.steps.length > 0) {
      warnings.push("All steps are inactive — expenses will be auto-approved");
    }

    // Check for duplicate step keys
    const keys = new Set<string>();
    for (const step of this.steps) {
      if (keys.has(step.stepKey)) {
        errors.push(`Duplicate step key: ${step.stepKey}`);
      }
      keys.add(step.stepKey);
    }

    // Check for missing approver roles
    for (const step of activeSteps) {
      if (!step.approverRole) {
        warnings.push(`Step "${step.label}" has no approver role assigned`);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  // ── Internals ──────────────────────────────────────────────

  private sortSteps(): void {
    this.steps.sort((a, b) => a.position - b.position);
  }

  private reindex(): void {
    this.steps.forEach((s, i) => (s.position = i + 1));
  }
}
