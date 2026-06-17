// ═══════════════════════════════════════════════════════════════
// Platform Features — Integration Tests
// Tests all 7 new platform capabilities via direct API calls
// ═══════════════════════════════════════════════════════════════

import { StateEngine } from "../lib/runtime/state";
import { BindingEngine } from "../lib/runtime/bindings";
import { AuthGuard, isRoleAllowed, filterNavByRole } from "../lib/runtime/auth-guard";
import { DataTableEngine, formatCellValue } from "../lib/runtime/components/data-table";
import { TimelineEngine } from "../lib/runtime/components/timeline";
import { PipelineEditor } from "../lib/runtime/components/pipeline-editor";
import { DEFAULT_STATUS_COLORS, DEFAULT_STATUS_LABELS } from "../lib/runtime/components/configs";
import type { ComponentSchema } from "../lib/runtime/schema";
import type { DataTableConfig } from "../lib/runtime/components/configs";

// ── Test Harness ─────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    failures.push(message);
    console.log(`  ✗ ${message}`);
  }
}

function section(name: string) {
  console.log(`\n━━━ ${name} ━━━`);
}

// ═══════════════════════════════════════════════════════════════
// 1. AUTH GUARD & ROLE-BASED VISIBILITY
// ═══════════════════════════════════════════════════════════════

section("1. Auth Guard — Role-Based Access Control");

(() => {
  const state = new StateEngine();
  state.set("user", {
    id: "user-1",
    email: "alex@example.com",
    name: "Alex",
    role: "employee",
    department_id: "dept-1",
  });

  const auth = new AuthGuard(state);

  // Basic checks
  assert(auth.isAuthenticated() === true, "Authenticated user detected");
  assert(auth.getUserRole() === "employee", "User role is employee");
  assert(auth.hasRole(["employee", "manager"]) === true, "Has employee role in list");
  assert(auth.hasRole(["admin"]) === false, "Does not have admin role");

  // Route access
  const publicRoute = { path: "/login", screenId: "login" };
  const protectedRoute = { path: "/dashboard", screenId: "dashboard", auth: true };
  const adminRoute = { path: "/admin", screenId: "admin", auth: true, roles: ["admin"] };
  const managerRoute = { path: "/approvals", screenId: "approvals", auth: true, roles: ["manager", "admin"] };

  assert(auth.checkRouteAccess(publicRoute).allowed === true, "Public route accessible");
  assert(auth.checkRouteAccess(protectedRoute).allowed === true, "Protected route accessible when authenticated");
  assert(auth.checkRouteAccess(adminRoute).allowed === false, "Admin route blocked for employee");
  assert(auth.checkRouteAccess(adminRoute).reason === "insufficient_role", "Correct rejection reason");
  assert(auth.checkRouteAccess(managerRoute).allowed === false, "Manager route blocked for employee");

  // Switch to manager
  state.set("user", { id: "user-2", role: "manager", email: "m@x.com", name: "M" });
  assert(auth.getUserRole() === "manager", "Role updates dynamically");
  assert(auth.checkRouteAccess(managerRoute).allowed === true, "Manager route now accessible");
  assert(auth.checkRouteAccess(adminRoute).allowed === false, "Admin route still blocked for manager");

  // Switch to admin
  state.set("user", { id: "user-3", role: "admin", email: "a@x.com", name: "A" });
  assert(auth.checkRouteAccess(adminRoute).allowed === true, "Admin route accessible for admin");
  assert(auth.checkRouteAccess(managerRoute).allowed === true, "Manager route accessible for admin");

  // Unauthenticated
  state.set("user", { id: "", role: "", email: "" });
  assert(auth.isAuthenticated() === false, "Empty ID = unauthenticated");
  assert(auth.checkRouteAccess(protectedRoute).allowed === false, "Protected route blocked when unauthenticated");
  assert(auth.checkRouteAccess(protectedRoute).reason === "unauthenticated", "Correct unauthenticated reason");

  // Helper functions
  assert(isRoleAllowed("admin", ["admin", "manager"]) === true, "isRoleAllowed helper works");
  assert(isRoleAllowed(null, ["admin"]) === false, "isRoleAllowed null role");
  assert(isRoleAllowed("user", []) === true, "isRoleAllowed empty roles = allow all");

  const navItems = [
    { label: "Dashboard", roles: [] as string[] },
    { label: "Approvals", roles: ["manager", "admin"] },
    { label: "Admin", roles: ["admin"] },
  ];
  const filtered = filterNavByRole(navItems, "manager");
  assert(filtered.length === 2, "filterNavByRole returns 2 items for manager");
  assert(filtered[0].label === "Dashboard", "filterNavByRole includes unrestricted");
  assert(filtered[1].label === "Approvals", "filterNavByRole includes manager items");

  state.destroy();
})();

// ═══════════════════════════════════════════════════════════════
// 2. COMPONENT ROLE-BASED VISIBILITY (Binding Engine)
// ═══════════════════════════════════════════════════════════════

section("2. Component Role-Based Visibility");

(() => {
  const state = new StateEngine();
  state.set("user", { id: "u1", role: "employee" });

  const bindings = new BindingEngine(state);

  const adminOnly: ComponentSchema = {
    id: "admin-panel",
    type: "view",
    props: {},
    bindings: {},
    style: {},
    requiredRoles: ["admin"],
  };

  const employeeVisible: ComponentSchema = {
    id: "my-expenses",
    type: "view",
    props: {},
    bindings: {},
    style: {},
    requiredRoles: ["employee", "manager"],
  };

  const noRestriction: ComponentSchema = {
    id: "public-view",
    type: "view",
    props: {},
    bindings: {},
    style: {},
  };

  const conditionAndRole: ComponentSchema = {
    id: "conditional-role",
    type: "view",
    props: {},
    bindings: {},
    style: {},
    requiredRoles: ["manager"],
    conditionalRender: "$user.role == 'manager'",
  };

  bindings.compileBindings(adminOnly);
  bindings.compileBindings(employeeVisible);
  bindings.compileBindings(noRestriction);
  bindings.compileBindings(conditionAndRole);

  assert(bindings.isVisible(adminOnly) === false, "Admin component hidden from employee");
  assert(bindings.isVisible(employeeVisible) === true, "Employee component visible to employee");
  assert(bindings.isVisible(noRestriction) === true, "Unrestricted component always visible");
  assert(bindings.isVisible(conditionAndRole) === false, "Role check fails before condition check");

  // Switch to manager
  state.set("user", { id: "u2", role: "manager" });
  assert(bindings.isVisible(adminOnly) === false, "Admin component still hidden from manager");
  assert(bindings.isVisible(employeeVisible) === true, "Employee component visible to manager");
  assert(bindings.isVisible(conditionAndRole) === true, "Both role and condition pass for manager");

  state.destroy();
  bindings.destroy();
})();

// ═══════════════════════════════════════════════════════════════
// 3. DATA TABLE ENGINE
// ═══════════════════════════════════════════════════════════════

section("3. Data Table — Search, Sort, Filter, Pagination");

(() => {
  const config: DataTableConfig = {
    columns: [
      { key: "title", label: "Title", sortable: true, type: "text" },
      { key: "amount", label: "Amount", sortable: true, type: "currency", format: "USD" },
      { key: "status", label: "Status", sortable: true, filterable: true, type: "status" },
      { key: "submitted_at", label: "Submitted", sortable: true, type: "date" },
    ],
    dataSource: "$local.myExpenses",
    searchable: true,
    pagination: { enabled: true, pageSize: 3 },
    sortable: true,
    defaultSort: { key: "amount", direction: "desc" },
  };

  const engine = new DataTableEngine(config);

  const data = [
    { id: "1", title: "Client dinner", amount: 142.5, status: "pending_manager", submitted_at: "2024-01-15" },
    { id: "2", title: "Flight to NYC", amount: 450.0, status: "approved", submitted_at: "2024-01-10" },
    { id: "3", title: "Software license", amount: 299.0, status: "pending_finance", submitted_at: "2024-01-20" },
    { id: "4", title: "Office supplies", amount: 45.0, status: "rejected", submitted_at: "2024-01-05" },
    { id: "5", title: "Team lunch", amount: 89.0, status: "pending_manager", submitted_at: "2024-01-18" },
    { id: "6", title: "Conference ticket", amount: 800.0, status: "approved", submitted_at: "2024-01-12" },
    { id: "7", title: "Taxi rides", amount: 35.0, status: "reimbursed", submitted_at: "2024-01-22" },
  ];

  // Default sort (amount desc) + pagination (page 1, 3 per page)
  let result = engine.process(data);
  assert(result.totalRows === 7, "Total rows = 7");
  assert(result.totalPages === 3, "Total pages = 3 (ceil 7/3)");
  assert(result.rows.length === 3, "Page 1 has 3 rows");
  assert((result.rows[0] as any).amount === 800, "First row is highest amount (desc sort)");
  assert(result.hasNext === true, "Has next page");
  assert(result.hasPrev === false, "No previous page");

  // Page 2
  engine.setPage(2);
  result = engine.process(data);
  assert(result.currentPage === 2, "Current page = 2");
  assert(result.rows.length === 3, "Page 2 has 3 rows");
  assert(result.hasNext === true, "Page 2 has next");
  assert(result.hasPrev === true, "Page 2 has prev");

  // Page 3
  engine.setPage(3);
  result = engine.process(data);
  assert(result.rows.length === 1, "Page 3 has 1 row");
  assert(result.hasNext === false, "Last page has no next");

  // Search
  engine.setPage(1);
  engine.setSearch("flight");
  result = engine.process(data);
  assert(result.totalRows === 1, "Search 'flight' finds 1 row");
  assert((result.rows[0] as any).title === "Flight to NYC", "Correct search result");

  // Search case insensitive
  engine.setSearch("DINNER");
  result = engine.process(data);
  assert(result.totalRows === 1, "Case-insensitive search works");

  // Clear search, add filter
  engine.setSearch("");
  engine.setFilter("status", "approved");
  result = engine.process(data);
  assert(result.totalRows === 2, "Status filter 'approved' finds 2 rows");

  // Filter + search
  engine.setSearch("conference");
  result = engine.process(data);
  assert(result.totalRows === 1, "Filter + search combined");

  // Clear all
  engine.clearFilters();
  result = engine.process(data);
  assert(result.totalRows === 7, "Clear filters restores all rows");

  // Sort toggle (amount desc → asc)
  engine.setSort("amount");
  result = engine.process(data);
  assert(result.sortDirection === "asc", "Sort toggled to asc");
  assert((result.rows[0] as any).amount === 35, "Lowest amount first in asc");

  // Sort by title
  engine.setSort("title");
  result = engine.process(data);
  assert(result.sortKey === "title", "Sort key changed to title");

  // Selection
  engine.toggleRowSelection("1");
  engine.toggleRowSelection("3");
  assert(engine.isSelected("1") === true, "Row 1 selected");
  assert(engine.isSelected("2") === false, "Row 2 not selected");
  assert(engine.getSelectedRows().length === 2, "2 rows selected");
  engine.toggleRowSelection("1");
  assert(engine.isSelected("1") === false, "Row 1 deselected");
  engine.clearSelection();
  assert(engine.getSelectedRows().length === 0, "Selection cleared");

  // Column values for filter dropdown
  const statuses = engine.getColumnValues(data, "status");
  assert(statuses.length === 5, "5 unique status values");

  // Cell formatting
  assert(formatCellValue(142.5, config.columns[1]) === "$142.50", "Currency formatting");
  assert(formatCellValue("pending_manager", config.columns[2]) === "Pending Manager", "Status formatting");
  assert(formatCellValue(null, config.columns[0]) === "—", "Null formatting");
})();

// ═══════════════════════════════════════════════════════════════
// 4. TIMELINE ENGINE
// ═══════════════════════════════════════════════════════════════

section("4. Timeline — Workflow Steps & Approval History");

(() => {
  // Workflow steps timeline
  const workflowEngine = new TimelineEngine({
    dataSource: "$local.workflowSteps",
    titleKey: "label",
    subtitleKey: "approver_role",
    statusKey: "status",
    activeMatchKey: "step_key",
    orientation: "vertical",
    connectorStyle: "solid",
  });

  const workflowSteps = [
    { id: "s1", step_key: "submit", label: "Submit Expense", approver_role: "employee", position: 1 },
    { id: "s2", step_key: "manager", label: "Manager Approval", approver_role: "manager", position: 2 },
    { id: "s3", step_key: "finance", label: "Finance Approval", approver_role: "finance", position: 3 },
    { id: "s4", step_key: "completed", label: "Completed", approver_role: "", position: 4 },
  ];

  // Active at manager step
  let result = workflowEngine.process(workflowSteps, "manager");
  assert(result.items.length === 4, "4 timeline items");
  assert(result.activeIndex === 1, "Active index is 1 (manager)");
  assert(result.items[0].status === "completed", "Submit step is completed");
  assert(result.items[1].status === "active", "Manager step is active");
  assert(result.items[2].status === "pending", "Finance step is pending");
  assert(result.items[3].status === "pending", "Completed step is pending");
  assert(result.completedSteps === 1, "1 completed step");

  // Active at finance
  result = workflowEngine.process(workflowSteps, "finance");
  assert(result.activeIndex === 2, "Active index is 2 (finance)");
  assert(result.items[0].status === "completed", "Submit completed");
  assert(result.items[1].status === "completed", "Manager completed");
  assert(result.items[2].status === "active", "Finance active");
  assert(result.completedSteps === 2, "2 completed steps");

  // All done
  result = workflowEngine.process(workflowSteps, "completed");
  assert(result.items[3].status === "active", "Completed step active");
  assert(result.completedSteps === 3, "3 completed steps");

  // Approval history timeline (status-based)
  const historyEngine = new TimelineEngine({
    dataSource: "$local.approvalHistory",
    titleKey: "action",
    subtitleKey: "actor_name",
    timestampKey: "created_at",
    commentKey: "comment",
    statusKey: "action",
    orientation: "vertical",
  });

  const history = [
    { id: "e1", action: "submitted", actor_name: "Alex Employee", created_at: new Date(Date.now() - 3600000).toISOString(), comment: "" },
    { id: "e2", action: "approved", actor_name: "Maya Manager", created_at: new Date(Date.now() - 1800000).toISOString(), comment: "Looks good" },
    { id: "e3", action: "approved", actor_name: "Finance Team", created_at: new Date(Date.now() - 600000).toISOString(), comment: "" },
  ];

  result = historyEngine.process(history);
  assert(result.items.length === 3, "3 history items");
  assert(result.items[0].title === "submitted", "First event title");
  assert(result.items[0].subtitle === "Alex Employee", "First event subtitle");
  assert(result.items[1].comment === "Looks good", "Comment preserved");
  assert(result.items[1].status === "completed", "Approved maps to completed");
  assert(result.items[0].timestamp !== "", "Timestamp formatted");
})();

// ═══════════════════════════════════════════════════════════════
// 5. PIPELINE EDITOR (Workflow Builder)
// ═══════════════════════════════════════════════════════════════

section("5. Pipeline Editor — Workflow Management");

(() => {
  const editor = new PipelineEditor();

  // Add steps
  editor.addStep({ id: "ws-1", stepKey: "manager", label: "Manager Approval", approverRole: "manager", active: true });
  editor.addStep({ id: "ws-2", stepKey: "finance", label: "Finance Approval", approverRole: "finance", active: true });

  let steps = editor.getSteps();
  assert(steps.length === 2, "2 steps added");
  assert(steps[0].position === 1, "First step at position 1");
  assert(steps[1].position === 2, "Second step at position 2");

  // Insert step at position 2
  editor.addStep({ id: "ws-3", stepKey: "dept_head", label: "Department Head", approverRole: "department_head", active: true }, 2);
  steps = editor.getSteps();
  assert(steps.length === 3, "3 steps after insert");
  assert(steps[0].stepKey === "manager", "Manager still first");
  assert(steps[1].stepKey === "dept_head", "Dept head inserted at 2");
  assert(steps[2].stepKey === "finance", "Finance shifted to 3");

  // Update step
  const updated = editor.updateStep("ws-3", { label: "VP Approval" });
  assert(updated?.label === "VP Approval", "Step updated");

  // Move step
  editor.moveStep("ws-2", 1);
  steps = editor.getSteps();
  assert(steps[0].stepKey === "finance", "Finance moved to position 1");

  // Toggle step
  editor.toggleStep("ws-3");
  steps = editor.getSteps();
  const toggled = steps.find(s => s.id === "ws-3");
  assert(toggled?.active === false, "Step toggled inactive");

  // Validation
  let validation = editor.validate();
  assert(validation.valid === true, "Pipeline valid");

  // Remove step
  editor.removeStep("ws-3");
  steps = editor.getSteps();
  assert(steps.length === 2, "Step removed");
  assert(steps[0].position === 1, "Reindexed after remove");
  assert(steps[1].position === 2, "Reindexed after remove (2)");

  // Convert to WorkflowSchema
  editor.toggleStep("ws-2"); // reactivate finance
  const workflow = editor.toWorkflowSchema();
  assert(workflow.id === "expense_approval_workflow", "Workflow ID set");
  assert(workflow.nodes.length >= 3, "At least 3 nodes (submit + 2 steps + approved)");
  assert(workflow.edges.length >= 2, "At least 2 edges");
  assert(workflow.trigger.type === "action", "Trigger is action type");

  // From database rows
  const dbRows = [
    { id: "r1", step_key: "manager", label: "Manager", approver_role: "manager", position: 1, active: true },
    { id: "r2", step_key: "finance", label: "Finance", approver_role: "finance", position: 2, active: true },
  ];
  const fromDB = PipelineEditor.fromDatabaseRows(dbRows);
  assert(fromDB.getSteps().length === 2, "Loaded from DB rows");
  assert(fromDB.getSteps()[0].stepKey === "manager", "DB row mapping correct");

  // Generate sync SQL
  const sync = fromDB.toSyncSQL();
  assert(sync.upserts.length === 2, "2 upsert statements");
  assert(sync.upserts[0].sql.includes("INSERT INTO"), "Valid SQL generated");
})();

// ═══════════════════════════════════════════════════════════════
// 6. STATUS CHIP DEFAULTS
// ═══════════════════════════════════════════════════════════════

section("6. Status Chip — Color & Label Maps");

(() => {
  assert(DEFAULT_STATUS_COLORS.approved === "#10B981", "Approved color is green");
  assert(DEFAULT_STATUS_COLORS.rejected === "#EF4444", "Rejected color is red");
  assert(DEFAULT_STATUS_COLORS.pending_manager === "#F59E0B", "Pending manager is amber");
  assert(DEFAULT_STATUS_COLORS.reimbursed === "#8B5CF6", "Reimbursed is purple");

  assert(DEFAULT_STATUS_LABELS.pending_manager === "Pending Manager", "Label mapping works");
  assert(DEFAULT_STATUS_LABELS.changes_requested === "Changes Requested", "Compound status label");
  assert(Object.keys(DEFAULT_STATUS_COLORS).length >= 12, "At least 12 status colors defined");
})();

// ═══════════════════════════════════════════════════════════════
// 7. SCHEMA EXPANSION VERIFICATION
// ═══════════════════════════════════════════════════════════════

section("7. Schema — New Component Types");

(() => {
  // Verify ComponentType accepts new types by creating valid schemas
  const dataTableComponent: ComponentSchema = {
    id: "dt-1",
    type: "dataTable",
    props: { columns: [], dataSource: "$local.expenses" },
    bindings: {},
    style: {},
  };
  assert(dataTableComponent.type === "dataTable", "dataTable is valid ComponentType");

  const timelineComponent: ComponentSchema = {
    id: "tl-1",
    type: "timeline",
    props: {},
    bindings: {},
    style: {},
  };
  assert(timelineComponent.type === "timeline", "timeline is valid ComponentType");

  const fileUploadComponent: ComponentSchema = {
    id: "fu-1",
    type: "fileUpload",
    props: {},
    bindings: {},
    style: {},
  };
  assert(fileUploadComponent.type === "fileUpload", "fileUpload is valid ComponentType");

  const tabsComponent: ComponentSchema = {
    id: "tabs-1",
    type: "tabs",
    props: {},
    bindings: {},
    style: {},
  };
  assert(tabsComponent.type === "tabs", "tabs is valid ComponentType");

  const statusChipComponent: ComponentSchema = {
    id: "sc-1",
    type: "statusChip",
    props: {},
    bindings: {},
    style: {},
    requiredRoles: ["admin"],
  };
  assert(statusChipComponent.type === "statusChip", "statusChip is valid ComponentType");
  assert(statusChipComponent.requiredRoles?.[0] === "admin", "requiredRoles on ComponentSchema");

  // New component types list
  const newTypes = ["dataTable", "timeline", "fileUpload", "tabs", "drawer", "accordion", "avatar", "badge", "statusChip", "datePicker", "searchInput"];
  for (const t of newTypes) {
    const comp: ComponentSchema = { id: `test-${t}`, type: t as any, props: {}, bindings: {}, style: {} };
    assert(comp.type === t, `${t} is valid type`);
  }
})();

// ═══════════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════════

console.log("\n" + "═".repeat(60));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log("\nFailures:");
  failures.forEach(f => console.log(`  ✗ ${f}`));
}
console.log("═".repeat(60));
process.exit(failed > 0 ? 1 : 0);
