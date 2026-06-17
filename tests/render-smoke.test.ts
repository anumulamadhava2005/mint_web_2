// ═══════════════════════════════════════════════════════════════
// Render Smoke Tests — SSR renderToString on each runtime component
//
// Validates that all 5 React components render without throwing,
// using react-dom/server. No browser needed.
// ═══════════════════════════════════════════════════════════════

import React from "react";
import { renderToString } from "react-dom/server";

// We import the components directly (not the barrel) to avoid "use client" issues in SSR
// The "use client" directive is fine — it's a hint for bundlers, not a runtime restriction.

import ToastRenderer from "../components/runtime/ToastRenderer";
import DataTable from "../components/runtime/DataTable";
import Timeline from "../components/runtime/Timeline";
import FileUpload from "../components/runtime/FileUpload";
import WorkflowPipelineEditor from "../components/runtime/WorkflowPipelineEditor";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`  ✗ ${name}: ${msg}`);
    failed++;
  }
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

console.log("═══════════════════════════════════════════════════════════");
console.log("Render Smoke Tests");
console.log("═══════════════════════════════════════════════════════════\n");

// ── 1. ToastRenderer ──────────────────────────────────────────

console.log("── ToastRenderer ──");

test("renders empty (no toasts)", () => {
  const html = renderToString(React.createElement(ToastRenderer, { toasts: [], onDismiss: () => {} }));
  // Should return empty since toasts array is empty
  assert(html === "" || html === "<!---->", "Should render nothing when no toasts");
});

test("renders with toasts", () => {
  const toasts = [
    { id: 1, message: "Saved!", type: "success" as const, duration: 3000 },
    { id: 2, message: "Warning!", type: "warning" as const, duration: 3000 },
    { id: 3, message: "Error occurred", type: "error" as const, duration: 3000 },
  ];
  const html = renderToString(React.createElement(ToastRenderer, { toasts, onDismiss: () => {} }));
  assert(html.includes("Saved!"), "Should contain success toast message");
  assert(html.includes("Warning!"), "Should contain warning toast message");
  assert(html.includes("Error occurred"), "Should contain error toast message");
  assert(html.includes("toast-container"), "Should have toast container testid");
});

test("renders info type", () => {
  const toasts = [{ id: 1, message: "Info note", type: "info" as const, duration: 5000 }];
  const html = renderToString(React.createElement(ToastRenderer, { toasts, onDismiss: () => {} }));
  assert(html.includes("Info note"), "Should contain info toast message");
});

// ── 2. DataTable ──────────────────────────────────────────────

console.log("\n── DataTable ──");

test("renders with data", () => {
  const config = {
    columns: [
      { key: "id", label: "ID", type: "number" as const },
      { key: "description", label: "Description" },
      { key: "amount", label: "Amount", type: "currency" as const },
      { key: "status", label: "Status", type: "status" as const },
    ],
    dataSource: "$local.expenses",
    searchable: true,
    pagination: { enabled: true, pageSize: 5 },
  };
  const data = [
    { id: 1, description: "Office supplies", amount: 150, status: "approved" },
    { id: 2, description: "Travel", amount: 500, status: "pending_manager" },
  ];
  const html = renderToString(React.createElement(DataTable, { config, data }));
  assert(html.includes("data-table"), "Should have data-table testid");
  assert(html.includes("Office supplies"), "Should contain row data");
  assert(html.includes("$150.00") || html.includes("150"), "Should format currency");
  assert(html.includes("Approved"), "Should render status badge");
});

test("renders empty state", () => {
  const config = {
    columns: [{ key: "id", label: "ID" }],
    dataSource: "$local.data",
    emptyMessage: "Nothing here",
  };
  const html = renderToString(React.createElement(DataTable, { config, data: [] }));
  assert(html.includes("Nothing here"), "Should show empty message");
});

test("renders with search", () => {
  const config = {
    columns: [{ key: "name", label: "Name" }],
    dataSource: "$local.data",
    searchable: true,
    searchPlaceholder: "Search expenses…",
  };
  const html = renderToString(React.createElement(DataTable, { config, data: [{ name: "Test" }] }));
  assert(html.includes("Search expenses"), "Should render search input with placeholder");
});

// ── 3. Timeline ───────────────────────────────────────────────

console.log("\n── Timeline ──");

test("renders vertical timeline", () => {
  const config = {
    dataSource: "$local.steps",
    titleKey: "label",
    subtitleKey: "role",
    statusKey: "status",
    orientation: "vertical" as const,
  };
  const data = [
    { id: "1", label: "Manager Review", role: "manager", status: "completed" },
    { id: "2", label: "Finance Review", role: "finance", status: "active" },
    { id: "3", label: "Final Approval", role: "admin", status: "pending" },
  ];
  const html = renderToString(React.createElement(Timeline, { config, data }));
  assert(html.includes("timeline"), "Should have timeline testid");
  assert(html.includes("Manager Review"), "Should contain step title");
  assert(html.includes("finance"), "Should contain subtitle");
});

test("renders horizontal timeline", () => {
  const config = {
    dataSource: "$local.steps",
    titleKey: "label",
    orientation: "horizontal" as const,
  };
  const data = [
    { id: "1", label: "Step 1", status: "completed" },
    { id: "2", label: "Step 2", status: "pending" },
  ];
  const html = renderToString(React.createElement(Timeline, { config, data }));
  assert(html.includes("timeline-horizontal"), "Should have horizontal testid");
  assert(html.includes("Step 1"), "Should contain step");
});

test("renders with comments", () => {
  const config = {
    dataSource: "$local.history",
    titleKey: "action",
    commentKey: "comment",
    orientation: "vertical" as const,
  };
  const data = [{ id: "1", action: "Approved", comment: "Looks good" }];
  const html = renderToString(React.createElement(Timeline, { config, data }));
  assert(html.includes("Looks good"), "Should render comment");
});

// ── 4. FileUpload ─────────────────────────────────────────────

console.log("\n── FileUpload ──");

test("renders drop zone", () => {
  const config = {
    storePath: "$local.receiptUrl",
    accept: "image/*,.pdf",
    label: "Upload receipt",
    hint: "PNG, JPG, PDF up to 10MB",
  };
  const html = renderToString(React.createElement(FileUpload, { config }));
  assert(html.includes("file-upload"), "Should have file-upload testid");
  assert(html.includes("Upload receipt"), "Should show label");
  assert(html.includes("PNG, JPG, PDF"), "Should show hint");
  assert(html.includes("image/*,.pdf"), "Should set accept attr");
});

test("renders with custom config", () => {
  const config = {
    storePath: "$local.files",
    multiple: true,
    maxFiles: 5,
    dropZone: true,
  };
  const html = renderToString(React.createElement(FileUpload, { config }));
  assert(html.includes("file-upload"), "Should render");
});

// ── 5. WorkflowPipelineEditor ──────────────────────────────────

console.log("\n── WorkflowPipelineEditor ──");

test("renders empty pipeline", () => {
  const html = renderToString(React.createElement(WorkflowPipelineEditor, {}));
  assert(html.includes("pipeline-editor"), "Should have pipeline-editor testid");
  assert(html.includes("auto-approved"), "Should show empty state message");
  assert(html.includes("active step"), "Should show active steps info");
});

test("renders with steps", () => {
  const steps = [
    { id: "s1", stepKey: "manager", label: "Manager Approval", approverRole: "manager", position: 1, active: true },
    { id: "s2", stepKey: "finance", label: "Finance Review", approverRole: "finance", position: 2, active: true },
    { id: "s3", stepKey: "vp", label: "VP Sign-off", position: 3, active: false },
  ];
  const html = renderToString(React.createElement(WorkflowPipelineEditor, { initialSteps: steps }));
  assert(html.includes("Manager Approval"), "Should show step label");
  assert(html.includes("Finance Review"), "Should show second step");
  assert(html.includes("active step"), "Should show active steps info");
  assert(html.includes("Role:"), "Should show approver role label");
});

test("renders validation warnings", () => {
  const steps = [
    { id: "s1", stepKey: "manager", label: "Manager Review", position: 1, active: true },
  ];
  const html = renderToString(React.createElement(WorkflowPipelineEditor, { initialSteps: steps }));
  assert(html.includes("no approver role"), "Should warn about missing approver role");
});

// ── Results ───────────────────────────────────────────────────

console.log(`\n═══════════════════════════════════════════════════════════`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`═══════════════════════════════════════════════════════════`);

if (failed > 0) process.exit(1);
