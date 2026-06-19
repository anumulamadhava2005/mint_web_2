#!/usr/bin/env tsx
// Populate the Penpot editor file with 8 mobile frames for the Expense App screens
// Each frame contains visual elements matching the AppSchema screen components.

const TOKEN = "401fb95337eefa718540794c4dddc998535df19858908724b4f00c6569f03530";
const PROJECT_ID = "5a31e6a7-9a4f-4722-a488-83b12aa038d3";
const FILE_ID = "fbaaf1fd-1163-4e20-807f-b80d045b5735";
const PAGE_ID = "cb1b39d6-498a-4c0d-915b-8690290b4aba";
const ROOT_FRAME_ID = "00000000-0000-0000-0000-000000000000";
const BASE = "http://localhost:3001";

const uuid = () => crypto.randomUUID();

// Screen definitions
const screens = [
  { name: "Login", color: "#6366F1" },
  { name: "Dashboard", color: "#3B82F6" },
  { name: "Submit Expense", color: "#10B981" },
  { name: "My Expenses", color: "#F59E0B" },
  { name: "Expense Details", color: "#8B5CF6" },
  { name: "Manager Approvals", color: "#EF4444" },
  { name: "Finance Approvals", color: "#06B6D4" },
  { name: "Workflow Builder", color: "#EC4899" },
];

// Screen content definitions - what elements each screen contains
const screenContent: Record<string, { title: string; elements: { text: string; type: "heading" | "input" | "button" | "card" | "list" | "label"; y: number }[] }> = {
  "Login": {
    title: "Login",
    elements: [
      { text: "Expense Approval", type: "heading", y: 80 },
      { text: "Sign in to continue", type: "label", y: 130 },
      { text: "Email", type: "input", y: 180 },
      { text: "Password", type: "input", y: 240 },
      { text: "Select Role", type: "input", y: 300 },
      { text: "Sign In", type: "button", y: 370 },
    ],
  },
  "Dashboard": {
    title: "Dashboard",
    elements: [
      { text: "Dashboard", type: "heading", y: 80 },
      { text: "Pending: 0", type: "card", y: 140 },
      { text: "Approved: 0", type: "card", y: 220 },
      { text: "Total: $0.00", type: "card", y: 300 },
      { text: "Submit Expense", type: "button", y: 380 },
      { text: "My Expenses", type: "button", y: 440 },
      { text: "Review Approvals", type: "button", y: 500 },
      { text: "Workflow Builder", type: "button", y: 560 },
    ],
  },
  "Submit Expense": {
    title: "Submit Expense",
    elements: [
      { text: "Submit Expense", type: "heading", y: 80 },
      { text: "Expense Title", type: "input", y: 140 },
      { text: "Description", type: "input", y: 200 },
      { text: "Amount", type: "input", y: 290 },
      { text: "Category", type: "input", y: 350 },
      { text: "Upload Receipt", type: "button", y: 420 },
      { text: "Submit", type: "button", y: 490 },
    ],
  },
  "My Expenses": {
    title: "My Expenses",
    elements: [
      { text: "My Expenses", type: "heading", y: 80 },
      { text: "Search expenses...", type: "input", y: 140 },
      { text: "Title | Amount | Status", type: "label", y: 200 },
      { text: "Expense list rows...", type: "list", y: 240 },
    ],
  },
  "Expense Details": {
    title: "Expense Details",
    elements: [
      { text: "Expense Details", type: "heading", y: 80 },
      { text: "Expense Info Card", type: "card", y: 140 },
      { text: "Approval Timeline", type: "list", y: 300 },
    ],
  },
  "Manager Approvals": {
    title: "Manager Approvals",
    elements: [
      { text: "Manager Approvals", type: "heading", y: 80 },
      { text: "Pending approval items", type: "list", y: 140 },
      { text: "Approve", type: "button", y: 500 },
      { text: "Reject", type: "button", y: 560 },
    ],
  },
  "Finance Approvals": {
    title: "Finance Approvals",
    elements: [
      { text: "Finance Approvals", type: "heading", y: 80 },
      { text: "Pending finance items", type: "list", y: 140 },
      { text: "Approve", type: "button", y: 460 },
      { text: "Reject", type: "button", y: 520 },
      { text: "Mark Reimbursed", type: "button", y: 580 },
    ],
  },
  "Workflow Builder": {
    title: "Workflow Builder",
    elements: [
      { text: "Workflow Builder", type: "heading", y: 80 },
      { text: "Active pipeline (live)", type: "label", y: 130 },
      { text: "Step list from DB", type: "list", y: 170 },
      { text: "Add New Step", type: "label", y: 400 },
      { text: "Step Key", type: "input", y: 440 },
      { text: "Label", type: "input", y: 500 },
      { text: "Approver Role", type: "input", y: 560 },
      { text: "Add Step", type: "button", y: 630 },
    ],
  },
};

function makeTextShape(id: string, text: string, x: number, y: number, frameId: string, parentId: string, opts: { fontSize?: number; fontWeight?: string; color?: string; width?: number; runtimeBindings?: Record<string, string> } = {}): any {
  const fontSize = opts.fontSize || 14;
  const width = opts.width || 310;
  const shape: any = {
    id, name: text.substring(0, 30), type: "text",
    x, y, width, height: fontSize + 10,
    rotation: 0, parentId, frameId,
    fills: [{ fillColor: opts.color || "#E5E7EB", fillOpacity: 1 }],
    strokes: [], opacity: 1, hidden: false,
    content: {
      // TextShape renderer expects: content.children = [{ textAlign?, children: [{ text, fontSize, ... }] }]
      children: [{
        textAlign: "left",
        children: [{
          text,
          fontFamily: "Inter",
          fontSize,
          fontWeight: opts.fontWeight || "400",
          fill: opts.color || "#E5E7EB",
        }],
      }],
    },
  };
  if (opts.runtimeBindings) shape.runtimeBindings = opts.runtimeBindings;
  return shape;
}

function makeRectShape(id: string, x: number, y: number, w: number, h: number, frameId: string, parentId: string, opts: { fillColor?: string; rx?: number; strokeColor?: string; name?: string; runtimeBindings?: Record<string, string> } = {}): any {
  const shape: any = {
    id, name: opts.name || "Rectangle", type: "rect",
    x, y, width: w, height: h,
    rotation: 0, parentId, frameId,
    fills: [{ fillColor: opts.fillColor || "#15151C", fillOpacity: 1 }],
    strokes: opts.strokeColor ? [{ strokeColor: opts.strokeColor, strokeOpacity: 1, strokeWidth: 1, strokeAlignment: "center" }] : [],
    opacity: 1, hidden: false,
    rx: opts.rx || 10, ry: opts.rx || 10,
  };
  if (opts.runtimeBindings) shape.runtimeBindings = opts.runtimeBindings;
  return shape;
}

// Map screen + element to runtimeBindings
function getBindings(screenName: string, elText: string, elType: string): Record<string, string> | undefined {
  const key = `${screenName}::${elText}`;
  const map: Record<string, Record<string, string>> = {
    // Login
    "Login::Email":            { inputBind: "local.form.email" },
    "Login::Password":         { inputBind: "local.form.password" },
    "Login::Select Role":      { inputBind: "local.form.role" },
    "Login::Sign In":          { onClick: "login" },

    // Dashboard
    "Dashboard::Dashboard":    { onMount: "loadDashboard" },
    "Dashboard::Pending: 0":   { textBind: "local.pendingCount" },
    "Dashboard::Approved: 0":  { textBind: "local.approvedCount" },
    "Dashboard::Total: $0.00": { textBind: "local.totalAmount" },
    "Dashboard::Submit Expense":   { onClick: "navigate:submit-expense" },
    "Dashboard::My Expenses":      { onClick: "navigate:my-expenses" },
    "Dashboard::Review Approvals": { onClick: "navigate:manager-approvals" },
    "Dashboard::Workflow Builder":  { onClick: "navigate:workflow-builder" },

    // Submit Expense
    "Submit Expense::Expense Title": { inputBind: "local.form.title" },
    "Submit Expense::Description":   { inputBind: "local.form.description" },
    "Submit Expense::Amount":        { inputBind: "local.form.amount" },
    "Submit Expense::Category":      { inputBind: "local.form.category" },
    "Submit Expense::Upload Receipt": { onClick: "uploadReceipt" },
    "Submit Expense::Submit":         { onClick: "submitExpense" },

    // My Expenses
    "My Expenses::My Expenses":    { onMount: "loadExpenses" },
    "My Expenses::Expense list rows...": { dataSource: "local.expenses", repeatFor: "local.expenses", repeatAs: "expense" },

    // Expense Details
    "Expense Details::Expense Details": { onMount: "loadEvents" },
    "Expense Details::Approval Timeline": { dataSource: "local.events", repeatFor: "local.events", repeatAs: "event" },

    // Manager Approvals
    "Manager Approvals::Manager Approvals": { onMount: "loadPendingManager" },
    "Manager Approvals::Pending approval items": { dataSource: "local.pendingExpenses", repeatFor: "local.pendingExpenses", repeatAs: "expense" },
    "Manager Approvals::Approve": { onClick: "approveExpenseFromList" },
    "Manager Approvals::Reject":  { onClick: "rejectExpenseFromList" },

    // Finance Approvals
    "Finance Approvals::Finance Approvals": { onMount: "loadPendingFinance" },
    "Finance Approvals::Pending finance items": { dataSource: "local.pendingExpenses", repeatFor: "local.pendingExpenses", repeatAs: "expense" },
    "Finance Approvals::Approve": { onClick: "approveExpenseFromList" },
    "Finance Approvals::Reject":  { onClick: "rejectExpenseFromList" },
    "Finance Approvals::Mark Reimbursed": { onClick: "markReimbursed" },

    // Workflow Builder
    "Workflow Builder::Workflow Builder": { onMount: "loadSteps" },
    "Workflow Builder::Step list from DB": { dataSource: "local.steps", repeatFor: "local.steps", repeatAs: "step" },
    "Workflow Builder::Step Key":       { inputBind: "local.newStep.step_key" },
    "Workflow Builder::Label":          { inputBind: "local.newStep.label" },
    "Workflow Builder::Approver Role":  { inputBind: "local.newStep.approver_role" },
    "Workflow Builder::Add Step":       { onClick: "addWorkflowStep" },
  };

  return map[key] || undefined;
}

async function main() {
  // Build the Penpot objects structure
  const objects: Record<string, any> = {};

  // Root frame
  const frameIds: string[] = [];
  const FRAME_W = 375;
  const FRAME_H = 812;
  const GAP = 80;

  for (let i = 0; i < screens.length; i++) {
    const screen = screens[i];
    const content = screenContent[screen.name];
    const frameId = uuid();
    frameIds.push(frameId);
    const fx = i * (FRAME_W + GAP);
    const fy = 0;

    const childIds: string[] = [];

    // All child coordinates must be ABSOLUTE (frame origin + local offset)
    // Penpot stores global canvas coordinates, not parent-relative

    // Status bar background
    const statusBarId = uuid();
    objects[statusBarId] = makeRectShape(statusBarId, fx, fy, FRAME_W, 44, frameId, frameId, { fillColor: "#0B0B0F", name: "Status Bar" });
    childIds.push(statusBarId);

    // Screen header accent bar
    const accentId = uuid();
    objects[accentId] = makeRectShape(accentId, fx, fy + 44, FRAME_W, 4, frameId, frameId, { fillColor: screen.color, rx: 0, name: "Accent" });
    childIds.push(accentId);

    // Elements
    if (content) {
      for (const el of content.elements) {
        const elId = uuid();
        const elX = fx + 20;
        const elY = fy + el.y;

        // Compute runtimeBindings based on screen + element
        const bindings = getBindings(screen.name, el.text, el.type);

        switch (el.type) {
          case "heading": {
            objects[elId] = makeTextShape(elId, el.text, elX, elY, frameId, frameId, { fontSize: 24, fontWeight: "700", color: "#F6F4F0", runtimeBindings: bindings });
            childIds.push(elId);
            break;
          }
          case "label": {
            objects[elId] = makeTextShape(elId, el.text, elX, elY, frameId, frameId, { fontSize: 13, color: "#9CA3AF", runtimeBindings: bindings });
            childIds.push(elId);
            break;
          }
          case "input": {
            // Input background (carries the inputBind)
            objects[elId] = makeRectShape(elId, elX, elY, 335, 44, frameId, frameId, { fillColor: "#15151C", strokeColor: "#2A2A35", name: el.text, runtimeBindings: bindings });
            childIds.push(elId);
            // Input placeholder text
            const labelId = uuid();
            objects[labelId] = makeTextShape(labelId, el.text, elX + 12, elY + 12, frameId, frameId, { fontSize: 14, color: "#9CA3AF", width: 300 });
            childIds.push(labelId);
            break;
          }
          case "button": {
            objects[elId] = makeRectShape(elId, elX, elY, 335, 44, frameId, frameId, { fillColor: "#6366F1", rx: 10, name: el.text, runtimeBindings: bindings });
            childIds.push(elId);
            const btnLabelId = uuid();
            objects[btnLabelId] = makeTextShape(btnLabelId, el.text, elX + 12, elY + 12, frameId, frameId, { fontSize: 15, fontWeight: "600", color: "#FFFFFF", width: 310 });
            childIds.push(btnLabelId);
            break;
          }
          case "card": {
            objects[elId] = makeRectShape(elId, elX, elY, 335, 70, frameId, frameId, { fillColor: "#15151C", strokeColor: "#23232E", name: el.text, runtimeBindings: bindings });
            childIds.push(elId);
            const cardLabelId = uuid();
            const textBind = bindings?.textBind;
            objects[cardLabelId] = makeTextShape(cardLabelId, el.text, elX + 16, elY + 24, frameId, frameId, { fontSize: 16, fontWeight: "600", color: "#E5E7EB", runtimeBindings: textBind ? { textBind } : undefined });
            childIds.push(cardLabelId);
            break;
          }
          case "list": {
            objects[elId] = makeRectShape(elId, elX, elY, 335, 200, frameId, frameId, { fillColor: "#15151C", strokeColor: "#23232E", name: el.text, runtimeBindings: bindings });
            childIds.push(elId);
            // List placeholder items
            for (let row = 0; row < 3; row++) {
              const rowId = uuid();
              objects[rowId] = makeRectShape(rowId, elX + 8, elY + 8 + row * 60, 319, 50, frameId, frameId, { fillColor: "#1A1A24", strokeColor: "#2A2A35", name: `Row ${row + 1}` });
              childIds.push(rowId);
            }
            break;
          }
        }
      }
    }

    // Create the frame
    objects[frameId] = {
      id: frameId,
      name: screen.name,
      type: "frame",
      x: fx, y: fy,
      width: FRAME_W, height: FRAME_H,
      rotation: 0,
      parentId: ROOT_FRAME_ID,
      frameId: ROOT_FRAME_ID,
      fills: [{ fillColor: "#0B0B0F", fillOpacity: 1 }],
      strokes: [],
      opacity: 1,
      hidden: false,
      rx: 0, ry: 0,
      shapes: childIds,
    };
  }

  // Root frame contains all top-level frames
  objects[ROOT_FRAME_ID] = {
    id: ROOT_FRAME_ID,
    name: "Root Frame",
    type: "frame",
    x: 0, y: 0,
    width: screens.length * (FRAME_W + GAP),
    height: FRAME_H,
    rotation: 0,
    parentId: ROOT_FRAME_ID,
    frameId: ROOT_FRAME_ID,
    fills: [],
    strokes: [],
    opacity: 1,
    hidden: false,
    shapes: frameIds,
  };

  // Build the file data
  const fileData = {
    pages: [PAGE_ID],
    pagesIndex: {
      [PAGE_ID]: {
        id: PAGE_ID,
        name: "Screens",
        objects,
      },
    },
    colors: {},
    typographies: {},
    components: {},
  };

  // Update the file via the changes endpoint (snapshotData)
  const res = await fetch(`${BASE}/api/files/changes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `token=${TOKEN}`,
    },
    body: JSON.stringify({
      fileId: FILE_ID,
      sessionId: crypto.randomUUID(),
      revn: 0,
      changes: [{ type: "mod-page", id: PAGE_ID, name: "Screens" }],
      snapshotData: fileData,
    }),
  });

  const result = await res.json();
  console.log("Update result:", res.status, JSON.stringify(result));

  // Verify
  const verify = await fetch(`${BASE}/api/files?id=${FILE_ID}`, {
    headers: { Cookie: `token=${TOKEN}` },
  });
  const verifyData = await verify.json();
  const data = typeof verifyData.file?.data === "string" ? JSON.parse(verifyData.file.data) : verifyData.file?.data;
  const pageObjects = data?.pagesIndex?.[PAGE_ID]?.objects || {};
  const root = pageObjects[ROOT_FRAME_ID];
  console.log(`Verification: ${root?.shapes?.length || 0} top-level frames, ${Object.keys(pageObjects).length} total objects`);
}

main().catch(console.error);
