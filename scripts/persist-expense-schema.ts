#!/usr/bin/env tsx
// Persist the full 8-screen Expense Approval AppSchema
// via POST /api/runtime-schema/[projectId]

const PROJECT_ID = process.env.MINT_PROJECT_ID || "5a31e6a7-9a4f-4722-a488-83b12aa038d3";
const TOKEN = process.env.MINT_TOKEN || "401fb95337eefa718540794c4dddc998535df19858908724b4f00c6569f03530";
const BASE = process.env.MINT_BASE || "http://localhost:3001";

// ── Action configs ───────────────────────────────────────────
// Each action's behaviour, expressed in the mint runtime dialect
// (type + config) so the persisted schema is self-describing rather
// than relying on a hard-coded handler map. Reads → "fetch", writes
// → "mutate", with `params` ($-refs resolve against state / the loop
// item / args). Approval ordering is read LIVE from workflow_steps via
// sub-selects, so adding a step in the DB changes the flow with no
// re-export — the one dynamic-at-runtime property of this app.
type ActionEntry = { type: string; config: Record<string, any> };

// Next active step strictly after the given step_key param ($2); NULL
// when none remain (→ COALESCE to 'approved').
const NEXT_STEP_AFTER =
  "(SELECT step_key FROM workflow_steps WHERE active = true AND position > " +
  "(SELECT position FROM workflow_steps WHERE step_key = $2) ORDER BY position ASC LIMIT 1)";
// First active step (used when an expense is first submitted).
const FIRST_STEP =
  "(SELECT step_key FROM workflow_steps WHERE active = true ORDER BY position ASC LIMIT 1)";

const ACTION_CONFIG: Record<string, ActionEntry> = {
  // Real authentication — hits the Mint platform auth endpoints. The
  // runtime signIn/signUp read $local.form (email/password/name), POST to
  // the API, and persist the returned $user + $session.token. signOut
  // clears them. Role now comes from the authenticated DB user, NOT a
  // form picker — no more fake "choose your role" sign-in.
  signIn: {
    type: "signIn",
    config: {
      url: "/api/login",
      email: "$local.form.email",
      password: "$local.form.password",
      userPath: "user",
      tokenPath: "session.token",
      // After a successful sign-in, go to the dashboard (skipped on failure).
      navigateTo: "dashboard",
    },
  },
  signUp: {
    type: "signUp",
    config: {
      url: "/api/signup",
      email: "$local.form.email",
      password: "$local.form.password",
      name: "$local.form.name",
      userPath: "user",
      tokenPath: "session.token",
      navigateTo: "dashboard",
    },
  },
  signOut: {
    type: "signOut",
    // Back to the login (home) screen after clearing the session.
    config: { url: "/api/logout", userPath: "user", tokenPath: "session.token", navigateTo: "login" },
  },
  // ── Reads ──
  loadExpenses: {
    type: "fetch",
    config: { sql: "SELECT * FROM expenses ORDER BY created_at DESC", params: [], storePath: "local.expenses" },
  },
  loadSteps: {
    type: "fetch",
    config: { sql: "SELECT * FROM workflow_steps ORDER BY position ASC", params: [], storePath: "local.steps" },
  },
  loadEvents: {
    type: "fetch",
    config: {
      sql: "SELECT * FROM approval_events WHERE expense_id = $1 ORDER BY created_at ASC",
      params: ["$local.activeExpense.id"],
      storePath: "local.events",
    },
  },
  loadDashboard: {
    type: "fetch",
    config: {
      sql:
        "SELECT COUNT(*) FILTER (WHERE status LIKE 'pending_%') AS pending_count, " +
        "COUNT(*) FILTER (WHERE status IN ('approved','reimbursed')) AS approved_count, " +
        "COALESCE(SUM(amount), 0) AS total_amount FROM expenses",
      params: [],
      storePath: "local.dashboard",
    },
  },
  loadPendingManager: {
    type: "fetch",
    config: {
      sql: "SELECT * FROM expenses WHERE status = $1 ORDER BY created_at DESC",
      params: ["pending_manager"],
      storePath: "local.pendingExpenses",
    },
  },
  loadPendingFinance: {
    type: "fetch",
    config: {
      sql: "SELECT * FROM expenses WHERE status = $1 ORDER BY created_at DESC",
      params: ["pending_finance"],
      storePath: "local.pendingExpenses",
    },
  },
  // ── Writes ──
  // Insert a new expense; first step + status computed LIVE from workflow_steps.
  submitExpense: {
    type: "mutate",
    config: {
      sql:
        "INSERT INTO expenses (title, description, amount, category, receipt_url, status, current_step_key, employee_id) " +
        "VALUES ($1, $2, $3, $4, $5, COALESCE('pending_' || " + FIRST_STEP + ", 'approved'), " + FIRST_STEP + ", $6) RETURNING *",
      params: ["$local.form.title", "$local.form.description", "$local.form.amount", "$local.form.category", "$local.receipt_url", "$user.id"],
      storePath: "local.lastSubmitted",
      also: "SET $local.form = []",
      // After submitting, take the user to their expense list.
      navigateTo: "my-expenses",
    },
  },
  // Approve the active expense (details screen) — advance to the live next step.
  approveExpense: {
    type: "mutate",
    config: {
      sql:
        "UPDATE expenses SET status = COALESCE('pending_' || " + NEXT_STEP_AFTER + ", 'approved'), " +
        "current_step_key = " + NEXT_STEP_AFTER + " WHERE id = $1",
      params: ["$local.activeExpense.id", "$local.activeExpense.current_step_key"],
      also:
        "SET $local._evt = dbQuery('INSERT INTO approval_events (expense_id, step_key, label, status) VALUES ($1,$2,$3,$4)', " +
        "[$local.activeExpense.id, $local.activeExpense.current_step_key, 'Approved', 'completed']); CALL loadEvents",
      // After approving on the details screen, return to the dashboard.
      navigateTo: "dashboard",
    },
  },
  // Approve from a Manager/Finance list row ($expense = the loop item).
  approveExpenseFromList: {
    type: "mutate",
    config: {
      sql:
        "UPDATE expenses SET status = COALESCE('pending_' || " + NEXT_STEP_AFTER + ", 'approved'), " +
        "current_step_key = " + NEXT_STEP_AFTER + " WHERE id = $1",
      params: ["$expense.id", "$expense.current_step_key"],
      also:
        "SET $local._evt = dbQuery('INSERT INTO approval_events (expense_id, step_key, label, status) VALUES ($1,$2,$3,$4)', " +
        "[$expense.id, $expense.current_step_key, 'Approved', 'completed'])",
    },
  },
  // Reject from a list row.
  rejectExpenseFromList: {
    type: "mutate",
    config: {
      sql: "UPDATE expenses SET status = 'rejected', current_step_key = NULL WHERE id = $1",
      params: ["$expense.id"],
      also:
        "SET $local._evt = dbQuery('INSERT INTO approval_events (expense_id, step_key, label, status) VALUES ($1,$2,$3,$4)', " +
        "[$expense.id, $expense.current_step_key, 'Rejected', 'failed'])",
    },
  },
  // Mark a finance-approved expense as reimbursed, then refresh the finance queue.
  markReimbursed: {
    type: "mutate",
    config: {
      sql: "UPDATE expenses SET status = 'reimbursed' WHERE id = $1",
      params: ["$expense.id"],
      also:
        "SET $local._evt = dbQuery('INSERT INTO approval_events (expense_id, step_key, label, status) VALUES ($1,$2,$3,$4)', " +
        "[$expense.id, 'finance', 'Reimbursed', 'completed']); CALL loadPendingFinance",
    },
  },
  // Append a workflow step at the next position, then reload the pipeline.
  addWorkflowStep: {
    type: "mutate",
    config: {
      sql:
        "INSERT INTO workflow_steps (step_key, label, approver_role, position, active) " +
        "VALUES ($1, $2, $3, (SELECT COALESCE(MAX(position), 0) + 1 FROM workflow_steps), true)",
      params: ["$local.newStep.step_key", "$local.newStep.label", "$local.newStep.approver_role"],
      also: "SET $local.newStep = []; CALL loadSteps",
    },
  },
};

// Build a screen/global action entry from the shared config map.
function act(name: string) {
  const def = ACTION_CONFIG[name];
  if (!def) throw new Error(`No ACTION_CONFIG entry for "${name}"`);
  return { id: name, name, type: def.type as any, config: def.config };
}

const schema = {
  id: "expense-approval-app",
  name: "Expense Approval",
  version: "1.0.0",
  schemaVersion: 1,
  theme: {
    colors: { primary: "#6366F1", background: "#0B0B0F", surface: "#15151C", text: "#E5E7EB", muted: "#9CA3AF", success: "#10B981", warning: "#F59E0B", error: "#EF4444", info: "#3B82F6" },
    fonts: { body: "Inter", heading: "Inter" },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
    radii: { sm: 6, md: 10, lg: 12, xl: 16, full: 999 },
    shadows: {},
  },
  screens: [
    // ─── 1. Login ────────────────────────────────────────────
    {
      id: "login",
      name: "Login",
      route: "/login",
      components: [
        { id: "login-title", type: "text" as const, props: { text: "Expense Approval", fontSize: 28, fontWeight: "700" }, bindings: {}, style: {}, children: [] },
        { id: "login-subtitle", type: "text" as const, props: { text: "Sign in to continue" }, bindings: {}, style: {}, children: [] },
        { id: "login-name", type: "input" as const, props: { placeholder: "Name (sign up only)" }, bindings: { inputBind: "$local.form.name" }, style: {}, children: [] },
        { id: "login-email", type: "input" as const, props: { placeholder: "Email" }, bindings: { inputBind: "$local.form.email" }, style: {}, children: [] },
        { id: "login-password", type: "input" as const, props: { placeholder: "Password", secure: true }, bindings: { inputBind: "$local.form.password" }, style: {}, children: [] },
        // Real auth: credentials verified server-side; role comes from the DB user.
        { id: "login-btn", type: "button" as const, props: { text: "Sign In" }, bindings: { onClick: "signIn" }, style: {}, children: [] },
        { id: "login-signup-btn", type: "button" as const, props: { text: "Create Account" }, bindings: { onClick: "signUp" }, style: {}, children: [] },
        { id: "login-error", type: "text" as const, props: { color: "#EF4444" }, bindings: { textBind: "$local.authError", visibleBind: "$local.authError" }, style: {}, children: [] },
      ],
      localState: [],
      actions: [act("signIn"), act("signUp")],
      onMount: [],
    },
    // ─── 2. Dashboard ────────────────────────────────────────
    {
      id: "dashboard",
      name: "Dashboard",
      route: "/dashboard",
      components: [
        { id: "dash-title", type: "text" as const, props: { text: "Dashboard", fontSize: 24, fontWeight: "700" }, bindings: {}, style: {}, children: [] },
        // Stats cards
        {
          id: "dash-stats", type: "view" as const, props: {}, bindings: {}, style: {},
          children: [
            {
              id: "stat-pending", type: "card" as const, props: {}, bindings: {}, style: {},
              children: [
                { id: "stat-pending-label", type: "text" as const, props: { text: "Pending" }, bindings: {}, style: {}, children: [] },
                { id: "stat-pending-count", type: "text" as const, props: { fontSize: 28, fontWeight: "700" }, bindings: { textBind: "$local.pendingCount" }, style: {}, children: [] },
              ],
            },
            {
              id: "stat-approved", type: "card" as const, props: {}, bindings: {}, style: {},
              children: [
                { id: "stat-approved-label", type: "text" as const, props: { text: "Approved" }, bindings: {}, style: {}, children: [] },
                { id: "stat-approved-count", type: "text" as const, props: { fontSize: 28, fontWeight: "700" }, bindings: { textBind: "$local.approvedCount" }, style: {}, children: [] },
              ],
            },
            {
              id: "stat-total", type: "card" as const, props: {}, bindings: {}, style: {},
              children: [
                { id: "stat-total-label", type: "text" as const, props: { text: "Total Amount" }, bindings: {}, style: {}, children: [] },
                { id: "stat-total-amount", type: "text" as const, props: { fontSize: 28, fontWeight: "700" }, bindings: { textBind: "$local.totalAmount" }, style: {}, children: [] },
              ],
            },
          ],
        },
        // Quick actions — role-conditional
        { id: "dash-submit-btn", type: "button" as const, props: { text: "Submit Expense" }, bindings: { onClick: "navigate:submit-expense" }, style: {}, children: [], requiredRoles: ["employee", "admin"] },
        { id: "dash-approvals-btn", type: "button" as const, props: { text: "Review Approvals" }, bindings: { onClick: "navigate:manager-approvals" }, style: {}, children: [], requiredRoles: ["manager", "admin"] },
        { id: "dash-finance-btn", type: "button" as const, props: { text: "Finance Review" }, bindings: { onClick: "navigate:finance-approvals" }, style: {}, children: [], requiredRoles: ["finance", "admin"] },
        { id: "dash-workflow-btn", type: "button" as const, props: { text: "Workflow Builder" }, bindings: { onClick: "navigate:workflow-builder" }, style: {}, children: [], requiredRoles: ["admin"] },
        { id: "dash-expenses-btn", type: "button" as const, props: { text: "My Expenses" }, bindings: { onClick: "navigate:my-expenses" }, style: {}, children: [] },
        { id: "dash-gallery-btn", type: "button" as const, props: { text: "🧪 Component Gallery" }, bindings: { onClick: "navigate:component-gallery" }, style: {}, children: [] },
        { id: "dash-signout-btn", type: "button" as const, props: { text: "Sign Out" }, bindings: { onClick: "signOut" }, style: {}, children: [] },
      ],
      localState: [],
      actions: [act("loadDashboard"), act("signOut")],
      onMount: ["loadDashboard"],
    },
    // ─── 3. Submit Expense ───────────────────────────────────
    {
      id: "submit-expense",
      name: "Submit Expense",
      route: "/submit-expense",
      components: [
        { id: "se-title", type: "text" as const, props: { text: "Submit Expense", fontSize: 24, fontWeight: "700" }, bindings: {}, style: {}, children: [] },
        { id: "se-name", type: "input" as const, props: { placeholder: "Expense Title" }, bindings: { inputBind: "$local.form.title" }, style: {}, children: [] },
        { id: "se-desc", type: "input" as const, props: { placeholder: "Description", multiline: true }, bindings: { inputBind: "$local.form.description" }, style: {}, children: [] },
        { id: "se-amount", type: "input" as const, props: { placeholder: "Amount" }, bindings: { inputBind: "$local.form.amount" }, style: {}, children: [] },
        {
          id: "se-category", type: "select" as const,
          props: { placeholder: "Category", options: [
            { label: "Travel", value: "travel" },
            { label: "Meals", value: "meals" },
            { label: "Software", value: "software" },
            { label: "Equipment", value: "equipment" },
            { label: "Other", value: "other" },
          ]},
          bindings: { inputBind: "$local.form.category" }, style: {}, children: [],
        },
        { id: "se-upload", type: "fileUpload" as const, props: { storePath: "$local.receipt_url" }, bindings: {}, style: {}, children: [] },
        { id: "se-submit", type: "button" as const, props: { text: "Submit Expense" }, bindings: { onClick: "submitExpense" }, style: {}, children: [] },
      ],
      localState: [],
      actions: [act("submitExpense")],
      onMount: [],
    },
    // ─── 4. My Expenses ──────────────────────────────────────
    {
      id: "my-expenses",
      name: "My Expenses",
      route: "/my-expenses",
      components: [
        { id: "me-title", type: "text" as const, props: { text: "My Expenses", fontSize: 24, fontWeight: "700" }, bindings: {}, style: {}, children: [] },
        {
          id: "me-table", type: "dataTable" as const,
          props: {
            searchable: true,
            searchPlaceholder: "Search expenses...",
            searchFields: ["title", "category", "status"],
            emptyMessage: "No expenses yet",
            columns: [
              { key: "title", label: "Title", type: "text" },
              { key: "amount", label: "Amount", type: "currency", format: "USD" },
              { key: "category", label: "Category", type: "text" },
              { key: "status", label: "Status", type: "status" },
              { key: "created_at", label: "Date", type: "text" },
            ],
            defaultSort: { key: "created_at", direction: "desc" },
          },
          bindings: { dataSource: "$local.expenses" },
          style: {}, children: [],
        },
      ],
      localState: [],
      actions: [act("loadExpenses")],
      onMount: ["loadExpenses"],
    },
    // ─── 5. Expense Details ──────────────────────────────────
    {
      id: "expense-details",
      name: "Expense Details",
      route: "/expense-details",
      components: [
        { id: "ed-title", type: "text" as const, props: { text: "Expense Details", fontSize: 24, fontWeight: "700" }, bindings: {}, style: {}, children: [] },
        {
          id: "ed-info", type: "card" as const, props: {}, bindings: {}, style: {},
          children: [
            { id: "ed-name", type: "text" as const, props: { fontSize: 20, fontWeight: "600" }, bindings: { textBind: "$local.activeExpense.title" }, style: {}, children: [] },
            { id: "ed-amount", type: "text" as const, props: { fontSize: 18 }, bindings: { textBind: "$local.activeExpense.amount" }, style: {}, children: [] },
            { id: "ed-status", type: "statusChip" as const, props: {}, bindings: { textBind: "$local.activeExpense.status" }, style: {}, children: [] },
            { id: "ed-desc", type: "text" as const, props: {}, bindings: { textBind: "$local.activeExpense.description" }, style: {}, children: [] },
            { id: "ed-category", type: "text" as const, props: {}, bindings: { textBind: "$local.activeExpense.category" }, style: {}, children: [] },
          ],
        },
        {
          id: "ed-timeline", type: "timeline" as const,
          props: {
            titleKey: "label",
            subtitleKey: "step_key",
            statusKey: "status",
            commentKey: "comment",
            activeMatchKey: "step_key",
            activeStepExpression: "$local.activeExpense.current_step_key",
          },
          bindings: { dataSource: "$local.events" },
          style: {}, children: [],
        },
      ],
      localState: [],
      actions: [act("loadEvents")],
      onMount: ["loadEvents"],
    },
    // ─── 6. Manager Approvals ────────────────────────────────
    {
      id: "manager-approvals",
      name: "Manager Approvals",
      route: "/manager-approvals",
      components: [
        { id: "ma-title", type: "text" as const, props: { text: "Manager Approvals", fontSize: 24, fontWeight: "700" }, bindings: {}, style: {}, children: [] },
        {
          id: "ma-list", type: "list" as const, props: {}, bindings: {}, style: {},
          repeatFor: { items: "$local.pendingExpenses", as: "expense" },
          children: [
            { id: "ma-item-title", type: "text" as const, props: { fontSize: 16, fontWeight: "600" }, bindings: { textBind: "$expense.title" }, style: {}, children: [] },
            { id: "ma-item-amount", type: "text" as const, props: {}, bindings: { textBind: "$expense.amount" }, style: {}, children: [] },
            { id: "ma-item-status", type: "statusChip" as const, props: {}, bindings: { textBind: "$expense.status" }, style: {}, children: [] },
            { id: "ma-approve-btn", type: "button" as const, props: { text: "Approve" }, bindings: { onClick: "approveExpenseFromList" }, style: {}, children: [] },
            { id: "ma-reject-btn", type: "button" as const, props: { text: "Reject" }, bindings: { onClick: "rejectExpenseFromList" }, style: {}, children: [] },
          ],
        },
      ],
      localState: [],
      actions: [act("loadPendingManager"), act("approveExpenseFromList"), act("rejectExpenseFromList")],
      onMount: ["loadPendingManager"],
    },
    // ─── 7. Finance Approvals ────────────────────────────────
    {
      id: "finance-approvals",
      name: "Finance Approvals",
      route: "/finance-approvals",
      components: [
        { id: "fa-title", type: "text" as const, props: { text: "Finance Approvals", fontSize: 24, fontWeight: "700" }, bindings: {}, style: {}, children: [] },
        {
          id: "fa-list", type: "list" as const, props: {}, bindings: {}, style: {},
          repeatFor: { items: "$local.pendingExpenses", as: "expense" },
          children: [
            { id: "fa-item-title", type: "text" as const, props: { fontSize: 16, fontWeight: "600" }, bindings: { textBind: "$expense.title" }, style: {}, children: [] },
            { id: "fa-item-amount", type: "text" as const, props: {}, bindings: { textBind: "$expense.amount" }, style: {}, children: [] },
            { id: "fa-item-status", type: "statusChip" as const, props: {}, bindings: { textBind: "$expense.status" }, style: {}, children: [] },
            { id: "fa-approve-btn", type: "button" as const, props: { text: "Approve" }, bindings: { onClick: "approveExpenseFromList" }, style: {}, children: [] },
            { id: "fa-reject-btn", type: "button" as const, props: { text: "Reject" }, bindings: { onClick: "rejectExpenseFromList" }, style: {}, children: [] },
            { id: "fa-reimburse-btn", type: "button" as const, props: { text: "Mark Reimbursed" }, bindings: { onClick: "markReimbursed" }, style: {}, children: [] },
          ],
        },
      ],
      localState: [],
      actions: [act("loadPendingFinance"), act("approveExpenseFromList"), act("rejectExpenseFromList"), act("markReimbursed")],
      onMount: ["loadPendingFinance"],
    },
    // ─── 8. Workflow Builder ─────────────────────────────────
    {
      id: "workflow-builder",
      name: "Workflow Builder",
      route: "/workflow-builder",
      components: [
        { id: "wb-title", type: "text" as const, props: { text: "Workflow Builder", fontSize: 24, fontWeight: "700" }, bindings: {}, style: {}, children: [] },
        { id: "wb-subtitle", type: "text" as const, props: { text: "Active approval pipeline (live from DB)" }, bindings: {}, style: {}, children: [] },
        {
          id: "wb-pipeline", type: "list" as const, props: {}, bindings: {}, style: {},
          repeatFor: { items: "$local.steps", as: "step" },
          children: [
            {
              id: "wb-step-card", type: "card" as const, props: {}, bindings: {}, style: {},
              children: [
                { id: "wb-step-pos", type: "text" as const, props: { fontWeight: "700" }, bindings: { textBind: "$step.position" }, style: {}, children: [] },
                { id: "wb-step-label", type: "text" as const, props: { fontSize: 16, fontWeight: "600" }, bindings: { textBind: "$step.label" }, style: {}, children: [] },
                { id: "wb-step-role", type: "text" as const, props: {}, bindings: { textBind: "$step.approver_role" }, style: {}, children: [] },
                { id: "wb-step-key", type: "text" as const, props: {}, bindings: { textBind: "$step.step_key" }, style: {}, children: [] },
              ],
            },
          ],
        },
        // Add step form
        { id: "wb-add-title", type: "text" as const, props: { text: "Add New Step", fontSize: 18, fontWeight: "600" }, bindings: {}, style: {}, children: [] },
        { id: "wb-step-key-input", type: "input" as const, props: { placeholder: "Step Key (e.g. dept_head)" }, bindings: { inputBind: "$local.newStep.step_key" }, style: {}, children: [] },
        { id: "wb-step-label-input", type: "input" as const, props: { placeholder: "Label (e.g. Department Head Approval)" }, bindings: { inputBind: "$local.newStep.label" }, style: {}, children: [] },
        { id: "wb-step-role-input", type: "input" as const, props: { placeholder: "Approver Role (e.g. department_head)" }, bindings: { inputBind: "$local.newStep.approver_role" }, style: {}, children: [] },
        { id: "wb-add-btn", type: "button" as const, props: { text: "Add Step" }, bindings: { onClick: "addWorkflowStep" }, style: {}, children: [] },
      ],
      localState: [],
      actions: [act("loadSteps"), act("addWorkflowStep")],
      onMount: ["loadSteps"],
    },
    // ─── 9. Component Gallery (tests every new component) ────
    {
      id: "component-gallery",
      name: "Component Gallery",
      route: "/component-gallery",
      components: [
        { id: "cg-title", type: "text" as const, props: { text: "Component Gallery", fontSize: 24, fontWeight: "700" }, bindings: {}, style: {}, children: [] },
        { id: "cg-sub", type: "text" as const, props: { text: "Live test of every Mint component" }, bindings: {}, style: {}, children: [] },

        // ── Stat cards (one static, one bound to the authed user → proves real auth) ──
        {
          id: "cg-stats", type: "view" as const, props: {}, bindings: {}, style: {},
          children: [
            { id: "cg-stat-1", type: "statCard" as const, props: { label: "Expenses", value: "0", unit: "", icon: "🧾", deltaDirection: "up-good" }, bindings: { value: "$local.expenseCount" }, style: {}, children: [] },
            { id: "cg-stat-2", type: "statCard" as const, props: { label: "Signed-in role", value: "—", icon: "🔐" }, bindings: { value: "$user.role" }, style: {}, children: [] },
          ],
        },

        // ── Chart (line) — plots real expense amounts ──
        {
          id: "cg-chart", type: "chart" as const,
          props: { type: "line", xKey: "created_at", yKey: "amount", title: "Expense amounts", height: 180, showGrid: true, showValues: true },
          bindings: { dataSource: "$local.expenses" }, style: {}, children: [],
        },

        // ── Camera → Image (live: capture a photo, preview it) ──
        { id: "cg-cam-label", type: "text" as const, props: { text: "Camera → Image", fontSize: 16, fontWeight: "600" }, bindings: {}, style: {}, children: [] },
        { id: "cg-camera", type: "camera" as const, props: { storePath: "local.gallery_photo", facing: "front", label: "Take Photo", previewEnabled: true }, bindings: {}, style: {}, children: [] },
        { id: "cg-image", type: "image" as const, props: { fit: "cover", height: 200, radius: 12, alt: "Captured photo" }, bindings: { src: "$local.gallery_photo" }, style: {}, children: [] },

        // ── Data table — real expenses ──
        {
          id: "cg-table", type: "dataTable" as const,
          props: {
            dataSource: "$local.expenses", searchable: true, searchPlaceholder: "Search expenses…",
            columns: [
              { key: "title", label: "Title", type: "text" },
              { key: "amount", label: "Amount", type: "currency", format: "USD" },
              { key: "status", label: "Status", type: "status" },
            ],
          },
          bindings: { dataSource: "$local.expenses" }, style: {}, children: [],
        },

        // ── Timeline — real workflow steps ──
        {
          id: "cg-timeline", type: "timeline" as const,
          props: { dataSource: "$local.steps", titleKey: "label", subtitleKey: "approver_role", statusKey: "active", orientation: "vertical" },
          bindings: { dataSource: "$local.steps" }, style: {}, children: [],
        },

        // ── Inputs row ──
        { id: "cg-inputs-label", type: "text" as const, props: { text: "Inputs", fontSize: 16, fontWeight: "600" }, bindings: {}, style: {}, children: [] },
        { id: "cg-text", type: "input" as const, props: { placeholder: "Text input" }, bindings: { inputBind: "$local.form.note" }, style: {}, children: [] },
        { id: "cg-search", type: "searchInput" as const, props: { placeholder: "Search…" }, bindings: { inputBind: "$local.form.q" }, style: {}, children: [] },
        {
          id: "cg-select", type: "select" as const,
          props: { placeholder: "Pick a unit", options: [ { label: "Kilograms", value: "kg" }, { label: "Pounds", value: "lb" } ] },
          bindings: { inputBind: "$local.form.unit" }, style: {}, children: [],
        },
        { id: "cg-date", type: "datePicker" as const, props: {}, bindings: { inputBind: "$local.form.date" }, style: {}, children: [] },
        { id: "cg-checkbox", type: "checkbox" as const, props: { label: "Email me reminders" }, bindings: { inputBind: "$local.form.notify" }, style: {}, children: [] },
        { id: "cg-switch", type: "switch" as const, props: { label: "Dark mode" }, bindings: { inputBind: "$local.form.dark" }, style: {}, children: [] },

        // ── File upload + status chip ──
        { id: "cg-upload", type: "fileUpload" as const, props: { storePath: "local.gallery_file", label: "Upload a file" }, bindings: {}, style: {}, children: [] },
        { id: "cg-status", type: "statusChip" as const, props: { value: "active" }, bindings: {}, style: {}, children: [] },

        // ── Back ──
        { id: "cg-back", type: "button" as const, props: { text: "← Back to Dashboard" }, bindings: { onClick: "navigate:dashboard" }, style: {}, children: [] },
      ],
      localState: [],
      actions: [act("loadExpenses"), act("loadSteps")],
      onMount: ["loadExpenses", "loadSteps"],
    },
  ],
  globalState: [
    { id: "user", name: "user", scope: "global" as const, defaultValue: { role: "employee" }, type: "object" as const },
    { id: "local", name: "local", scope: "local" as const, defaultValue: {}, type: "object" as const },
  ],
  globalActions: [
    act("signIn"),
    act("signUp"),
    act("signOut"),
    act("loadExpenses"),
    act("loadSteps"),
    act("loadEvents"),
    act("submitExpense"),
    act("approveExpense"),
    act("addWorkflowStep"),
    act("loadDashboard"),
    act("loadPendingManager"),
    act("loadPendingFinance"),
    act("approveExpenseFromList"),
    act("rejectExpenseFromList"),
    act("markReimbursed"),
  ],
  workflows: [],
  navigation: {
    type: "stack" as const,
    initialRoute: "/login",
    routes: [
      { path: "/login", screenId: "login" },
      { path: "/dashboard", screenId: "dashboard", auth: true },
      { path: "/submit-expense", screenId: "submit-expense", auth: true, roles: ["employee", "admin"] },
      { path: "/my-expenses", screenId: "my-expenses", auth: true },
      { path: "/expense-details", screenId: "expense-details", auth: true },
      { path: "/manager-approvals", screenId: "manager-approvals", auth: true, roles: ["manager", "admin"] },
      { path: "/finance-approvals", screenId: "finance-approvals", auth: true, roles: ["finance", "admin"] },
      { path: "/workflow-builder", screenId: "workflow-builder", auth: true, roles: ["admin"] },
      { path: "/component-gallery", screenId: "component-gallery", auth: true },
    ],
  },
  database: {
    provider: "mint" as const,
    tables: [
      {
        id: "users", name: "users",
        fields: [
          { name: "id", type: "uuid" as const, required: true, unique: true },
          { name: "email", type: "text" as const, required: true, unique: true },
          { name: "name", type: "text" as const, required: false, unique: false },
          { name: "role", type: "text" as const, required: true, unique: false, default: "employee" },
          { name: "password_hash", type: "text" as const, required: false, unique: false },
        ],
        relations: [], indexes: [], policies: [], timestamps: true,
      },
      {
        id: "expenses", name: "expenses",
        fields: [
          { name: "id", type: "uuid" as const, required: true, unique: true },
          { name: "title", type: "text" as const, required: true, unique: false },
          { name: "description", type: "text" as const, required: false, unique: false },
          { name: "amount", type: "float" as const, required: true, unique: false },
          { name: "category", type: "text" as const, required: false, unique: false },
          { name: "receipt_url", type: "text" as const, required: false, unique: false },
          { name: "status", type: "text" as const, required: true, unique: false, default: "draft" },
          { name: "current_step_key", type: "text" as const, required: false, unique: false },
          { name: "employee_id", type: "uuid" as const, required: false, unique: false },
        ],
        relations: [], indexes: [], policies: [], timestamps: true,
      },
      {
        id: "workflow_steps", name: "workflow_steps",
        fields: [
          { name: "id", type: "uuid" as const, required: true, unique: true },
          { name: "step_key", type: "text" as const, required: true, unique: true },
          { name: "label", type: "text" as const, required: true, unique: false },
          { name: "approver_role", type: "text" as const, required: true, unique: false },
          { name: "position", type: "integer" as const, required: true, unique: false },
          { name: "active", type: "boolean" as const, required: true, unique: false, default: true },
        ],
        relations: [], indexes: [], policies: [], timestamps: true,
      },
      {
        id: "approval_events", name: "approval_events",
        fields: [
          { name: "id", type: "uuid" as const, required: true, unique: true },
          { name: "expense_id", type: "uuid" as const, required: true, unique: false },
          { name: "step_key", type: "text" as const, required: true, unique: false },
          { name: "label", type: "text" as const, required: false, unique: false },
          { name: "status", type: "text" as const, required: true, unique: false },
          { name: "actor_id", type: "uuid" as const, required: false, unique: false },
          { name: "comment", type: "text" as const, required: false, unique: false },
        ],
        relations: [], indexes: [], policies: [], timestamps: true,
      },
    ],
  },
};

async function main() {
  // Persist the schema
  const res = await fetch(`${BASE}/api/runtime-schema/${PROJECT_ID}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `token=${TOKEN}`,
    },
    body: JSON.stringify({ schema }),
  });
  const body = await res.json();
  console.log("Schema persist:", res.status, JSON.stringify(body));

  // Verify readback
  const get = await fetch(`${BASE}/api/runtime-schema/${PROJECT_ID}`, {
    headers: { Cookie: `token=${TOKEN}` },
  });
  const readback = await get.json();
  const screenCount = readback.schema?.screens?.length || 0;
  console.log(`Readback: ${screenCount} screens`);
}

main().catch(console.error);
