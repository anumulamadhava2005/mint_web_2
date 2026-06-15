const { Client } = require("pg");
const crypto = require("crypto");

const PID = "9603d5d5-5836-41f5-a8e9-3a57b4580545";
const DB_URL = "postgresql://postgres:9989882989@m@localhost:5432/mint_web";
const ROOT_ID = "00000000-0000-0000-0000-000000000000";
const OWNER_ID = "4a3114bc-d622-4cf6-afe6-2c251b563091";

const IDS = {
  employee: "11111111-1111-4111-8111-111111111111",
  manager: "22222222-2222-4222-8222-222222222222",
  finance: "33333333-3333-4333-8333-333333333333",
  admin: "44444444-4444-4444-8444-444444444444",
  sales: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  engineering: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  operations: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  meals: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  travel: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  software: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  supplies: "99999999-9999-4999-8999-999999999999",
  expDinner: "10000000-0000-4000-8000-000000000001",
  expFlight: "10000000-0000-4000-8000-000000000002",
  expSoftware: "10000000-0000-4000-8000-000000000003",
  expDesk: "10000000-0000-4000-8000-000000000004",
};

const C = {
  bg: "#101214",
  panel: "#171A1F",
  card: "#20242B",
  card2: "#262B33",
  primary: "#F8FAFC",
  secondary: "#B8C0CC",
  muted: "#7D8794",
  accent: "#4F8CFF",
  success: "#32C879",
  warning: "#F5B84B",
  danger: "#EF5C67",
  border: "#343A45",
  input: "#11151B",
};

function prefixed(table) {
  return `mint_proj_${PID.replace(/[^a-zA-Z0-9_]/g, "")}_${table}`;
}

function mkFrame(id, name, x, y, w, h, fill, parentId, children = [], extra = {}) {
  return {
    id,
    name,
    type: "frame",
    x,
    y,
    width: w,
    height: h,
    fills: fill ? [{ fillColor: fill, fillOpacity: 1 }] : [],
    strokes: [],
    opacity: 1,
    rotation: 0,
    shapes: [...children],
    frameId: parentId || ROOT_ID,
    parentId: parentId || ROOT_ID,
    hidden: false,
    locked: false,
    showContent: true,
    ...extra,
  };
}

function mkRect(id, name, x, y, w, h, fill, parentId, extra = {}) {
  return {
    id,
    name,
    type: "rect",
    x,
    y,
    width: w,
    height: h,
    fills: fill ? [{ fillColor: fill, fillOpacity: 1 }] : [],
    strokes: [],
    opacity: 1,
    rotation: 0,
    shapes: [],
    frameId: parentId,
    parentId,
    hidden: false,
    locked: false,
    ...extra,
  };
}

function mkText(id, name, x, y, w, h, txt, fs, color, parentId, extra = {}) {
  return {
    id,
    name,
    type: "text",
    x,
    y,
    width: w,
    height: h,
    fills: color ? [{ fillColor: color, fillOpacity: 1 }] : [],
    strokes: [],
    opacity: 1,
    rotation: 0,
    shapes: [],
    frameId: parentId,
    parentId,
    hidden: false,
    locked: false,
    content: {
      type: "root",
      children: [{
        type: "paragraph",
        children: [{
          text: txt,
          fontFamily: "Inter",
          fontSize: fs,
          fontWeight: extra.bold ? 700 : 400,
          fill: color,
        }],
      }],
    },
    ...extra,
  };
}

function mapShapeType(kind) {
  return { frame: "FRAME", group: "GROUP", rect: "RECTANGLE", circle: "ELLIPSE", text: "TEXT" }[kind] || "FRAME";
}

function shapeToNode(shape, parentX, parentY, objects) {
  const r = (n) => Math.round(n * 10) / 10;
  const node = {
    id: shape.id,
    name: shape.name,
    type: mapShapeType(shape.type),
    x: r(shape.x - parentX),
    y: r(shape.y - parentY),
    width: r(shape.width),
    height: r(shape.height),
    visible: !shape.hidden,
  };
  if (shape.opacity !== undefined && shape.opacity !== 1) node.opacity = shape.opacity;
  if (shape.rotation) node.rotation = shape.rotation;
  if (shape.fills?.length) {
    node.fills = shape.fills.map((f) => ({ type: "SOLID", color: f.fillColor, opacity: f.fillOpacity }));
  }
  if (shape.strokes?.length) {
    node.strokes = shape.strokes.map((s) => ({
      color: s.strokeColor,
      opacity: s.strokeOpacity,
      weight: s.strokeWidth,
      align: s.strokeAlignment?.toUpperCase() || "CENTER",
    }));
  }
  if (shape.rx || shape.ry) node.corners = { uniform: shape.rx || shape.ry };
  if (shape.type === "text" && shape.content) {
    const firstRun = shape.content.children?.[0]?.children?.[0];
    node.text = {
      characters: firstRun?.text || "",
      fontFamily: firstRun?.fontFamily || "Inter",
      fontSize: firstRun?.fontSize || 14,
      fontWeight: firstRun?.fontWeight || 400,
      color: firstRun?.fill || C.primary,
    };
  }
  if (shape.layoutProps?.layout) {
    const lp = shape.layoutProps;
    node.layout = {
      mode: lp.layout === "flex" ? (lp.layoutFlexDir === "column" ? "VERTICAL" : "HORIZONTAL") : "NONE",
      gap: lp.layoutGap,
      paddingTop: lp.layoutPaddingTop,
      paddingRight: lp.layoutPaddingRight,
      paddingBottom: lp.layoutPaddingBottom,
      paddingLeft: lp.layoutPaddingLeft,
    };
  }
  if (shape.shapes?.length) {
    const kids = shape.shapes.map((id) => objects[id]).filter((s) => !!s && !s.hidden);
    if (kids.length) node.children = kids.map((k) => shapeToNode(k, shape.x, shape.y, objects));
  }
  if (shape.runtimeBindings) node.pluginData = { runtimeBindings: shape.runtimeBindings };
  if (shape.scrollConfig) node.pluginData = { ...(node.pluginData || {}), scrollConfig: shape.scrollConfig };
  return node;
}

function addText(objects, parentId, x, y, w, h, text, size, color = C.primary, extra = {}) {
  const id = crypto.randomUUID();
  objects[id] = mkText(id, extra.name || "Text", x, y, w, h, text, size, color, parentId, extra);
  objects[parentId].shapes.push(id);
  return id;
}

function addRect(objects, parentId, name, x, y, w, h, fill, extra = {}) {
  const id = crypto.randomUUID();
  objects[id] = mkRect(id, name, x, y, w, h, fill, parentId, extra);
  objects[parentId].shapes.push(id);
  return id;
}

function addButton(objects, parentId, x, y, w, label, action, fill = C.accent) {
  const btnId = addRect(objects, parentId, `Btn_${label.replace(/\s+/g, "_")}`, x, y, w, 42, fill, {
    rx: 8,
    runtimeBindings: { onClick: action },
  });
  const txtId = crypto.randomUUID();
  objects[btnId].shapes.push(txtId);
  objects[txtId] = mkText(txtId, "Button_Label", x, y, w, 42, label, 13, C.primary, btnId, { bold: true });
  return btnId;
}

function addInput(objects, parentId, x, y, w, label, bind) {
  addText(objects, parentId, x, y, w, 16, label, 11, C.secondary, { bold: true });
  const inputId = addRect(objects, parentId, `Input_${label.replace(/\s+/g, "_")}`, x, y + 22, w, 40, C.input, {
    rx: 8,
    strokes: [{ strokeColor: C.border, strokeWidth: 1, strokeAlignment: "CENTER" }],
    runtimeBindings: { inputBind: bind },
  });
  const hintId = crypto.randomUUID();
  objects[inputId].shapes.push(hintId);
  objects[hintId] = mkText(hintId, "Input_Value", x + 12, y + 22, w - 24, 40, label, 12, C.muted, inputId);
  return inputId;
}

function addCard(objects, parentId, x, y, w, h, title, value, bind, tone = C.card) {
  const cardId = addRect(objects, parentId, `Card_${title.replace(/\s+/g, "_")}`, x, y, w, h, tone, {
    rx: 8,
    strokes: [{ strokeColor: C.border, strokeWidth: 1, strokeAlignment: "CENTER" }],
  });
  const labelId = crypto.randomUUID();
  const valueId = crypto.randomUUID();
  objects[cardId].shapes.push(labelId, valueId);
  objects[labelId] = mkText(labelId, "Card_Label", x + 12, y + 12, w - 24, 18, title, 11, C.secondary, cardId);
  objects[valueId] = mkText(valueId, "Card_Value", x + 12, y + 34, w - 24, 26, value, 20, C.primary, cardId, {
    bold: true,
    runtimeBindings: bind ? { textBind: bind } : undefined,
  });
  return cardId;
}

function addHeader(objects, screenId, xO, title, subtitle, onMount) {
  const headerId = addRect(objects, screenId, "Header", xO, 0, 390, 70, C.panel);
  addText(objects, headerId, xO + 18, 16, 260, 26, title, 21, C.primary, { bold: true });
  addText(objects, headerId, xO + 18, 42, 260, 16, subtitle, 11, C.secondary, {
    runtimeBindings: subtitle === "Role-aware workspace" ? { textBind: "$user.role" } : undefined,
  });
  if (onMount) objects[screenId].runtimeBindings = { ...(objects[screenId].runtimeBindings || {}), onMount };
  return headerId;
}

function addBottomNav(objects, screenId, xO, active) {
  const navId = addRect(objects, screenId, "BottomNav", xO, 812, 390, 88, C.panel, {
    strokes: [{ strokeColor: C.border, strokeWidth: 1, strokeAlignment: "TOP" }],
  });
  const tabs = [
    ["Dash", "navigateDashboard", "dashboard"],
    ["Submit", "navigateSubmitExpense", "submit"],
    ["Mine", "navigateMyExpenses", "mine"],
    ["Approvals", "navigateManagerApprovals", "approvals"],
    ["Workflow", "navigateWorkflowBuilder", "workflow"],
  ];
  tabs.forEach(([label, action, key], i) => {
    const tabId = crypto.randomUUID();
    objects[navId].shapes.push(tabId);
    objects[tabId] = mkFrame(tabId, `Tab_${key}`, xO + i * 78, 812, 78, 88, "transparent", navId, [], {
      runtimeBindings: { onClick: action },
    });
    addText(objects, tabId, xO + i * 78, 838, 78, 20, label, 10, key === active ? C.primary : C.muted, { bold: key === active });
  });
  return navId;
}

function addListRow(objects, listId, x, y, title, meta, amount, status, bindPrefix, onClick) {
  const rowId = addRect(objects, listId, "List_Row_Template", x, y, 350, 76, C.card, {
    rx: 8,
    strokes: [{ strokeColor: C.border, strokeWidth: 1, strokeAlignment: "CENTER" }],
    runtimeBindings: onClick ? { onClick } : undefined,
  });
  addText(objects, rowId, x + 12, y + 10, 210, 20, title, 14, C.primary, {
    bold: true,
    runtimeBindings: bindPrefix ? { textBind: `$${bindPrefix}.title` } : undefined,
  });
  addText(objects, rowId, x + 12, y + 34, 210, 16, meta, 11, C.secondary, {
    runtimeBindings: bindPrefix ? { textBind: `$${bindPrefix}.category` } : undefined,
  });
  addText(objects, rowId, x + 238, y + 10, 90, 22, amount, 15, C.primary, {
    bold: true,
    runtimeBindings: bindPrefix ? { textBind: `$${bindPrefix}.amount` } : undefined,
  });
  addText(objects, rowId, x + 238, y + 38, 90, 16, status, 11, C.warning, {
    runtimeBindings: bindPrefix ? { textBind: `$${bindPrefix}.status` } : undefined,
  });
  return rowId;
}

function newScreen(objects, id, name, xO, title, subtitle, activeTab, onMount) {
  objects[id] = mkFrame(id, name, xO, 0, 390, 900, C.bg, ROOT_ID, []);
  addHeader(objects, id, xO, title, subtitle, onMount);
  addBottomNav(objects, id, xO, activeTab);
  return id;
}

function buildLogin(objects, xO) {
  const id = "expense-login-screen";
  objects[id] = mkFrame(id, "Login", xO, 0, 390, 900, C.bg, ROOT_ID, []);
  addText(objects, id, xO + 28, 72, 330, 36, "ExpenseFlow", 30, C.primary, { bold: true });
  addText(objects, id, xO + 28, 116, 330, 38, "Role-based expense approvals powered by Mint runtime.", 13, C.secondary);
  const panel = addRect(objects, id, "LoginPanel", xO + 20, 190, 350, 390, C.panel, { rx: 12 });
  addInput(objects, panel, xO + 42, 226, 306, "Email", "$form.loginEmail");
  addInput(objects, panel, xO + 42, 306, 306, "Password", "$form.loginPassword");
  addInput(objects, panel, xO + 42, 386, 306, "Role assignment", "$form.loginRole");
  const remember = addRect(objects, panel, "Remember_Login", xO + 42, 466, 20, 20, C.input, {
    rx: 4,
    runtimeBindings: { inputBind: "$user.remember_login" },
    strokes: [{ strokeColor: C.border, strokeWidth: 1, strokeAlignment: "CENTER" }],
  });
  addText(objects, panel, xO + 72, 464, 250, 22, "Remember login", 12, C.secondary);
  addButton(objects, panel, xO + 42, 514, 306, "Login", "login");
  objects[remember].runtimeBindings = { inputBind: "$user.remember_login" };
  return id;
}

function buildDashboard(objects, xO) {
  const id = newScreen(objects, "expense-dashboard-screen", "Dashboard", xO, "Dashboard", "Role-aware workspace", "dashboard", "fetchDashboardData");
  addCard(objects, id, xO + 16, 92, 174, 78, "Pending", "3", "$local.dashboard.employee.pending_expenses");
  addCard(objects, id, xO + 200, 92, 174, 78, "Approved", "12", "$local.dashboard.employee.approved_expenses");
  addCard(objects, id, xO + 16, 182, 174, 78, "Rejected", "1", "$local.dashboard.employee.rejected_expenses");
  addCard(objects, id, xO + 200, 182, 174, 78, "Reimbursement", "$1,278", "$local.dashboard.employee.total_reimbursement_amount");
  addText(objects, id, xO + 16, 286, 340, 22, "Manager queue", 15, C.primary, { bold: true });
  addCard(objects, id, xO + 16, 318, 174, 78, "Pending approvals", "5", "$local.dashboard.manager.pending_approvals", C.card2);
  addCard(objects, id, xO + 200, 318, 174, 78, "Team spend", "$4,820", "$local.dashboard.manager.team_total_spend", C.card2);
  addText(objects, id, xO + 16, 422, 340, 22, "Finance overview", 15, C.primary, { bold: true });
  addCard(objects, id, xO + 16, 454, 174, 78, "Final pending", "2", "$local.dashboard.finance.final_approvals_pending", C.card2);
  addCard(objects, id, xO + 200, 454, 174, 78, "Monthly spend", "$8,920", "$local.dashboard.finance.monthly_spend", C.card2);
  addButton(objects, id, xO + 16, 574, 174, "Submit Expense", "navigateSubmitExpense");
  addButton(objects, id, xO + 200, 574, 174, "Workflow Builder", "navigateWorkflowBuilder", C.card2);
  return id;
}

function buildSubmitExpense(objects, xO) {
  const id = newScreen(objects, "expense-submit-screen", "SubmitExpense", xO, "Submit Expense", "Create a claim", "submit", "fetchSettings");
  addInput(objects, id, xO + 16, 92, 358, "Expense Title", "$form.expenseTitle");
  addInput(objects, id, xO + 16, 170, 358, "Description", "$form.expenseDescription");
  addInput(objects, id, xO + 16, 248, 170, "Amount", "$form.expenseAmount");
  addInput(objects, id, xO + 202, 248, 172, "Currency", "$form.expenseCurrency");
  addInput(objects, id, xO + 16, 326, 170, "Expense Category", "$form.expenseCategoryId");
  addInput(objects, id, xO + 202, 326, 172, "Department", "$form.expenseDepartmentId");
  addInput(objects, id, xO + 16, 404, 358, "Expense Date", "$form.expenseDate");
  addInput(objects, id, xO + 16, 482, 358, "Receipt Upload", "$form.receiptUrl");
  addButton(objects, id, xO + 16, 604, 174, "Save Draft", "saveExpenseDraft", C.card2);
  addButton(objects, id, xO + 200, 604, 174, "Submit", "submitExpense");
  return id;
}

function buildMyExpenses(objects, xO) {
  const id = newScreen(objects, "expense-my-expenses-screen", "MyExpenses", xO, "My Expenses", "Track submitted claims", "mine", "fetchMyExpenses");
  addInput(objects, id, xO + 16, 86, 358, "Search", "$local.filters.search");
  ["Pending", "Approved", "Rejected"].forEach((label, i) => {
    addButton(objects, id, xO + 16 + i * 122, 166, 112, label, `filter${label}Expenses`, i === 0 ? C.accent : C.card2);
  });
  const list = addRect(objects, id, "Expense_List", xO + 16, 226, 358, 560, "transparent", {
    runtimeBindings: { repeatFor: "$local.myExpenses", repeatAs: "expense", dataSource: "expenses" },
  });
  objects[list].layoutProps = { layout: "flex", layoutFlexDir: "column", layoutGap: 10 };
  objects[list].scrollConfig = { behavior: "vertical" };
  addListRow(objects, list, xO + 20, 230, "Client dinner", "Meals", "$142.50", "pending_manager", "expense", "openExpenseDetail");
  return id;
}

function buildExpenseDetails(objects, xO) {
  const id = newScreen(objects, "expense-details-screen", "ExpenseDetails", xO, "Expense Details", "Review claim context", "mine", "fetchExpenseDetail");
  addCard(objects, id, xO + 16, 92, 358, 96, "Expense", "Client dinner", "$local.activeExpense.title");
  addCard(objects, id, xO + 16, 204, 174, 78, "Amount", "$142.50", "$local.activeExpense.amount");
  addCard(objects, id, xO + 200, 204, 174, 78, "Status", "pending", "$local.activeExpense.status");
  addText(objects, id, xO + 16, 310, 330, 22, "Workflow timeline", 15, C.primary, { bold: true });
  const flow = addRect(objects, id, "Workflow_Timeline", xO + 16, 342, 358, 196, C.panel, {
    rx: 10,
    runtimeBindings: { repeatFor: "$local.workflowSteps", repeatAs: "step", dataSource: "workflow_steps" },
  });
  addListRow(objects, flow, xO + 20, 350, "Manager Approval", "Approver role", "", "active", "step");
  addText(objects, id, xO + 16, 566, 330, 22, "Approval history", 15, C.primary, { bold: true });
  const history = addRect(objects, id, "Approval_History_List", xO + 16, 598, 358, 180, "transparent", {
    runtimeBindings: { repeatFor: "$local.approvalHistory", repeatAs: "event", dataSource: "approval_events" },
  });
  addListRow(objects, history, xO + 20, 602, "Expense Created", "Alex Employee", "", "submitted", "event");
  return id;
}

function buildApprovalQueue(objects, xO, id, name, title, subtitle, active, onMount, repeatFor, repeatAs, approveAction, rejectAction, extraAction) {
  const screenId = newScreen(objects, id, name, xO, title, subtitle, active, onMount);
  const list = addRect(objects, screenId, `${name}_List`, xO + 16, 94, 358, 560, "transparent", {
    runtimeBindings: { repeatFor, repeatAs, dataSource: "expenses" },
  });
  objects[list].scrollConfig = { behavior: "vertical" };
  const row = addRect(objects, list, "Approval_Row_Template", xO + 20, 100, 350, 150, C.card, {
    rx: 8,
    runtimeBindings: { onClick: "openExpenseDetail" },
    strokes: [{ strokeColor: C.border, strokeWidth: 1, strokeAlignment: "CENTER" }],
  });
  addText(objects, row, xO + 34, 114, 180, 22, "Alex Employee", 15, C.primary, {
    bold: true,
    runtimeBindings: { textBind: `$${repeatAs}.employee_name` },
  });
  addText(objects, row, xO + 34, 140, 180, 18, "Meals", 12, C.secondary, {
    runtimeBindings: { textBind: `$${repeatAs}.category` },
  });
  addText(objects, row, xO + 250, 114, 80, 24, "$142.50", 16, C.primary, {
    bold: true,
    runtimeBindings: { textBind: `$${repeatAs}.amount` },
  });
  addButton(objects, row, xO + 34, 178, 96, "Approve", approveAction, C.success);
  addButton(objects, row, xO + 140, 178, 86, "Reject", rejectAction, C.danger);
  addButton(objects, row, xO + 236, 178, 94, extraAction[0], extraAction[1], C.card2);
  return screenId;
}

function buildHistory(objects, xO) {
  const id = newScreen(objects, "expense-approval-history-screen", "ApprovalHistory", xO, "Approval History", "Audit trail", "approvals", "fetchApprovalHistory");
  const list = addRect(objects, id, "History_List", xO + 16, 94, 358, 680, "transparent", {
    runtimeBindings: { repeatFor: "$local.approvalHistory", repeatAs: "event", dataSource: "approval_events" },
  });
  addListRow(objects, list, xO + 20, 100, "Manager Approved", "Maya Manager", "", "approved", "event");
  return id;
}

function buildWorkflow(objects, xO) {
  const id = newScreen(objects, "expense-workflow-builder-screen", "WorkflowBuilder", xO, "Workflow Builder", "Runtime routing", "workflow", "fetchWorkflow");
  const flow = addRect(objects, id, "Workflow_Steps", xO + 16, 92, 358, 430, C.panel, {
    rx: 10,
    runtimeBindings: { repeatFor: "$local.workflowSteps", repeatAs: "step", dataSource: "workflow_steps" },
  });
  addListRow(objects, flow, xO + 20, 104, "Submit Expense", "Start", "", "position 1", "step");
  addListRow(objects, flow, xO + 20, 194, "Manager Approval", "manager", "", "position 2", "step");
  addListRow(objects, flow, xO + 20, 284, "Finance Approval", "finance", "", "position 3", "step");
  addButton(objects, id, xO + 16, 552, 358, "Add Department Head Approval", "addDepartmentHeadApproval");
  addButton(objects, id, xO + 16, 606, 174, "Save Workflow", "fetchWorkflow", C.card2);
  addButton(objects, id, xO + 200, 606, 174, "Preview Details", "navigateExpenseDetails", C.card2);
  return id;
}

function buildAnalytics(objects, xO) {
  const id = newScreen(objects, "expense-analytics-screen", "Analytics", xO, "Analytics", "Spend and speed", "dashboard", "fetchAnalytics");
  addCard(objects, id, xO + 16, 92, 174, 78, "Total Expenses", "24", "$local.analytics.summary.total_expenses");
  addCard(objects, id, xO + 200, 92, 174, 78, "Approval Rate", "86%", "$local.analytics.summary.approval_rate");
  addCard(objects, id, xO + 16, 182, 174, 78, "Avg Approval", "1.8d", "$local.analytics.summary.average_approval_time");
  addCard(objects, id, xO + 200, 182, 174, 78, "Monthly Spend", "$8,920", "$local.analytics.summary.monthly_spend");
  addText(objects, id, xO + 16, 300, 330, 22, "Spend by department", 15, C.primary, { bold: true });
  addRect(objects, id, "Department_Chart", xO + 16, 334, 358, 140, C.card, { rx: 8, runtimeBindings: { dataSource: "$local.analytics.spendByDepartment" } });
  addText(objects, id, xO + 16, 500, 330, 22, "Monthly trend", 15, C.primary, { bold: true });
  addRect(objects, id, "Monthly_Trend_Chart", xO + 16, 534, 358, 140, C.card, { rx: 8, runtimeBindings: { dataSource: "$local.analytics.monthlyTrend" } });
  return id;
}

function buildNotifications(objects, xO) {
  const id = newScreen(objects, "expense-notifications-screen", "Notifications", xO, "Notifications", "Approvals and updates", "dashboard", "fetchNotifications");
  const list = addRect(objects, id, "Notifications_List", xO + 16, 94, 358, 680, "transparent", {
    runtimeBindings: { repeatFor: "$local.notifications", repeatAs: "notification", dataSource: "notifications" },
  });
  addListRow(objects, list, xO + 20, 100, "Expense Approved", "Finance approved your claim", "", "unread", "notification");
  return id;
}

function buildSettings(objects, xO) {
  const id = newScreen(objects, "expense-settings-screen", "Settings", xO, "Settings", "Admin configuration", "workflow", "fetchSettings");
  ["Expense Categories", "Departments", "Approval Workflow", "User Roles", "Notification Rules"].forEach((label, i) => {
    addCard(objects, id, xO + 16, 92 + i * 92, 358, 76, label, "Configure", null, C.card);
  });
  return id;
}

function buildScreens(objects) {
  const builders = [
    (x) => buildLogin(objects, x),
    (x) => buildDashboard(objects, x),
    (x) => buildSubmitExpense(objects, x),
    (x) => buildMyExpenses(objects, x),
    (x) => buildExpenseDetails(objects, x),
    (x) => buildApprovalQueue(objects, x, "expense-manager-approvals-screen", "ManagerApprovals", "Manager Approvals", "Team review queue", "approvals", "fetchManagerApprovals", "$local.pendingApprovals", "expense", "managerApproveExpense", "managerRejectExpense", ["Changes", "managerRequestChanges"]),
    (x) => buildApprovalQueue(objects, x, "expense-finance-approvals-screen", "FinanceApprovals", "Finance Approvals", "Final review queue", "approvals", "fetchFinanceApprovals", "$local.financeApprovals", "expense", "financeApproveExpense", "financeRejectExpense", ["Reimburse", "markReimbursed"]),
    (x) => buildHistory(objects, x),
    (x) => buildWorkflow(objects, x),
    (x) => buildAnalytics(objects, x),
    (x) => buildNotifications(objects, x),
    (x) => buildSettings(objects, x),
  ];
  return builders.map((build, i) => build(i * 430));
}

function emptyFileData() {
  return {
    pages: ["page1"],
    colors: {},
    components: {},
    pagesIndex: {
      page1: {
        id: "page1",
        name: "Expense Approval App",
        flows: [],
        objects: {
          [ROOT_ID]: {
            x: 0,
            y: 0,
            id: ROOT_ID,
            name: "Root Frame",
            type: "frame",
            fills: [],
            width: 0,
            height: 0,
            shapes: [],
            frameId: ROOT_ID,
            opacity: 1,
            strokes: [],
            parentId: null,
            rotation: 0,
          },
        },
      },
    },
    typographies: {},
  };
}

function databaseSchema() {
  return {
    provider: "mint",
    tables: [
      {
        id: "t-users", name: "users", fields: [
          { name: "id", type: "uuid", primaryKey: true, required: true },
          { name: "email", type: "text", required: true, unique: true },
          { name: "password_hash", type: "text" },
          { name: "name", type: "text", required: true },
          { name: "role", type: "text", required: true },
          { name: "department_id", type: "uuid", references: "departments.id" },
          { name: "manager_id", type: "uuid", references: "users.id" },
          { name: "remember_login", type: "boolean", defaultValue: false },
          { name: "created_at", type: "timestamp", defaultValue: "now()" },
        ]
      },
      {
        id: "t-departments", name: "departments", fields: [
          { name: "id", type: "uuid", primaryKey: true, required: true },
          { name: "name", type: "text", required: true },
          { name: "head_user_id", type: "uuid", references: "users.id" },
          { name: "created_at", type: "timestamp", defaultValue: "now()" },
          { name: "updated_at", type: "timestamp", defaultValue: "now()" },
        ]
      },
      {
        id: "t-expense-categories", name: "expense_categories", fields: [
          { name: "id", type: "uuid", primaryKey: true, required: true },
          { name: "name", type: "text", required: true },
          { name: "requires_receipt", type: "boolean", defaultValue: true },
          { name: "active", type: "boolean", defaultValue: true },
        ]
      },
      {
        id: "t-expenses", name: "expenses", fields: [
          { name: "id", type: "uuid", primaryKey: true, required: true },
          { name: "employee_id", type: "uuid", references: "users.id" },
          { name: "title", type: "text", required: true },
          { name: "description", type: "text" },
          { name: "amount", type: "numeric", required: true },
          { name: "currency", type: "text", required: true },
          { name: "category_id", type: "uuid", references: "expense_categories.id" },
          { name: "department_id", type: "uuid", references: "departments.id" },
          { name: "expense_date", type: "date" },
          { name: "receipt_url", type: "text" },
          { name: "status", type: "text", required: true },
          { name: "current_step_key", type: "text" },
          { name: "submitted_at", type: "timestamp" },
          { name: "created_at", type: "timestamp", defaultValue: "now()" },
          { name: "updated_at", type: "timestamp", defaultValue: "now()" },
        ]
      },
      {
        id: "t-approval-events", name: "approval_events", fields: [
          { name: "id", type: "uuid", primaryKey: true, required: true },
          { name: "expense_id", type: "uuid", references: "expenses.id" },
          { name: "actor_id", type: "uuid", references: "users.id" },
          { name: "actor_role", type: "text" },
          { name: "action", type: "text" },
          { name: "step_key", type: "text" },
          { name: "comment", type: "text" },
          { name: "created_at", type: "timestamp", defaultValue: "now()" },
        ]
      },
      {
        id: "t-workflow-steps", name: "workflow_steps", fields: [
          { name: "id", type: "uuid", primaryKey: true, required: true },
          { name: "step_key", type: "text", required: true },
          { name: "label", type: "text", required: true },
          { name: "approver_role", type: "text" },
          { name: "position", type: "integer", required: true },
          { name: "active", type: "boolean", defaultValue: true },
          { name: "condition_json", type: "jsonb" },
          { name: "created_at", type: "timestamp", defaultValue: "now()" },
        ]
      },
      {
        id: "t-notifications", name: "notifications", fields: [
          { name: "id", type: "uuid", primaryKey: true, required: true },
          { name: "user_id", type: "uuid", references: "users.id" },
          { name: "expense_id", type: "uuid", references: "expenses.id" },
          { name: "type", type: "text" },
          { name: "title", type: "text" },
          { name: "body", type: "text" },
          { name: "read_at", type: "timestamp" },
          { name: "created_at", type: "timestamp", defaultValue: "now()" },
        ]
      },
    ],
  };
}

function globalState() {
  return [
    {
      id: "gs-user", name: "user", type: "object", defaultValue: {
        id: IDS.employee,
        email: "alex.employee@example.com",
        name: "Alex Employee",
        role: "employee",
        department_id: IDS.sales,
        remember_login: false,
      }
    },
    {
      id: "gs-form", name: "form", type: "object", defaultValue: {
        loginEmail: "alex.employee@example.com",
        loginPassword: "demo",
        loginRole: "employee",
        expenseTitle: "",
        expenseDescription: "",
        expenseAmount: "",
        expenseCurrency: "USD",
        expenseCategoryId: IDS.meals,
        expenseDepartmentId: IDS.sales,
        expenseDate: "",
        receiptUrl: "",
        approvalComment: "",
      }
    },
    {
      id: "gs-local", name: "local", type: "object", defaultValue: {
        dashboard: { employee: {}, manager: {}, finance: {} },
        myExpenses: [],
        pendingApprovals: [],
        financeApprovals: [],
        activeExpense: null,
        approvalHistory: [],
        workflowSteps: [],
        analytics: { summary: {}, spendByDepartment: [], spendByCategory: [], monthlyTrend: [] },
        notifications: [],
        settings: { categories: [], departments: [], roles: [], notificationRules: [] },
        filters: { expenseStatus: "pending", search: "" },
        _modals: { rejectExpense: { open: false }, requestChanges: { open: false }, workflowCondition: { open: false } },
      }
    },
  ];
}

function actions() {
  const db = "/api/db/{projectId}";
  const nav = [
    ["navigateLogin", "/login"],
    ["navigateDashboard", "/dashboard"],
    ["navigateSubmitExpense", "/submit-expense"],
    ["navigateMyExpenses", "/my-expenses"],
    ["navigateExpenseDetails", "/expenses/detail"],
    ["navigateManagerApprovals", "/manager/approvals"],
    ["navigateFinanceApprovals", "/finance/approvals"],
    ["navigateApprovalHistory", "/approval-history"],
    ["navigateWorkflowBuilder", "/admin/workflow"],
    ["navigateAnalytics", "/analytics"],
    ["navigateNotifications", "/notifications"],
    ["navigateSettings", "/settings"],
  ].map(([name, target], i) => ({ id: `act-nav-${i}`, name, type: "navigate", config: { target } }));

  return [
    ...nav,
    {
      id: "act-login", name: "login", type: "fetch", config: {
        url: db, method: "POST",
        body: { sql: "SELECT id, email, name, role, department_id, remember_login FROM users WHERE email = $1 AND role = $2 LIMIT 1", params: ["$form.loginEmail", "$form.loginRole"] },
        onSuccess: "SET $user = $result.rows[0]; CALL navigateDashboard",
        onError: "SET $local.loginError = 'Invalid login'",
      }
    },
    {
      id: "act-fetch-dashboard", name: "fetchDashboardData", type: "setState", config: {
        path: "local.dashboardLoading", value: true,
        also: "CALL fetchEmployeeDashboard; CALL fetchManagerDashboard; CALL fetchFinanceDashboard; CALL fetchWorkflow; CALL fetchNotifications",
      }
    },
    {
      id: "act-fetch-employee-dashboard", name: "fetchEmployeeDashboard", type: "fetch", config: {
        url: db, method: "POST",
        body: { sql: "SELECT COUNT(*) FILTER (WHERE status IN ('pending_manager','pending_department_head','pending_finance')) AS pending_expenses, COUNT(*) FILTER (WHERE status IN ('approved','reimbursed')) AS approved_expenses, COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_expenses, COALESCE(SUM(amount) FILTER (WHERE status IN ('approved','reimbursed')),0) AS total_reimbursement_amount FROM expenses WHERE employee_id = $1", params: ["$user.id"] },
        onSuccess: "SET $local.dashboard.employee = $result.rows[0]",
      }
    },
    {
      id: "act-fetch-manager-dashboard", name: "fetchManagerDashboard", type: "fetch", config: {
        url: db, method: "POST",
        body: { sql: "SELECT COUNT(*) FILTER (WHERE status = 'pending_manager') AS pending_approvals, COUNT(*) FILTER (WHERE status IN ('approved','reimbursed')) AS recently_approved, COALESCE(SUM(amount),0) AS team_total_spend FROM expenses WHERE department_id = $1", params: ["$user.department_id"] },
        onSuccess: "SET $local.dashboard.manager = $result.rows[0]",
      }
    },
    {
      id: "act-fetch-finance-dashboard", name: "fetchFinanceDashboard", type: "fetch", config: {
        url: db, method: "POST",
        body: { sql: "SELECT COUNT(*) FILTER (WHERE status = 'pending_finance') AS final_approvals_pending, COALESCE(SUM(amount) FILTER (WHERE submitted_at >= date_trunc('month', now())),0) AS monthly_spend FROM expenses", params: [] },
        onSuccess: "SET $local.dashboard.finance = $result.rows[0]",
      }
    },
    {
      id: "act-save-draft", name: "saveExpenseDraft", type: "fetch", config: {
        url: db, method: "POST",
        body: { sql: "INSERT INTO expenses (employee_id, title, description, amount, currency, category_id, department_id, expense_date, receipt_url, status, current_step_key) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft','submit') RETURNING *", params: ["$user.id", "$form.expenseTitle", "$form.expenseDescription", "$form.expenseAmount", "$form.expenseCurrency", "$form.expenseCategoryId", "$form.expenseDepartmentId", "$form.expenseDate", "$form.receiptUrl"] },
        onSuccess: "SET $local.activeExpense = $result.rows[0]; CALL fetchMyExpenses",
      }
    },
    {
      id: "act-submit-expense", name: "submitExpense", type: "fetch", config: {
        url: db, method: "POST",
        body: { sql: "INSERT INTO expenses (employee_id, title, description, amount, currency, category_id, department_id, expense_date, receipt_url, status, current_step_key, submitted_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending_manager','manager',now()) RETURNING *", params: ["$user.id", "$form.expenseTitle", "$form.expenseDescription", "$form.expenseAmount", "$form.expenseCurrency", "$form.expenseCategoryId", "$form.expenseDepartmentId", "$form.expenseDate", "$form.receiptUrl"] },
        onSuccess: "SET $local.activeExpense = $result.rows[0]; CALL createSubmittedEvent; CALL notifyManager; CALL fetchMyExpenses; CALL navigateExpenseDetails",
      }
    },
    {
      id: "act-fetch-my-expenses", name: "fetchMyExpenses", type: "fetch", config: {
        url: db, method: "POST",
        body: { sql: "SELECT id, title, category_id::text AS category, amount, currency, status, submitted_at FROM expenses WHERE employee_id = $1 AND ($2 IS NULL OR title ILIKE '%' || $2 || '%') AND (($3 = 'pending' AND status IN ('pending_manager','pending_department_head','pending_finance')) OR ($3 = 'approved' AND status IN ('approved','reimbursed')) OR ($3 = 'rejected' AND status = 'rejected') OR $3 IS NULL) ORDER BY created_at DESC", params: ["$user.id", "$local.filters.search", "$local.filters.expenseStatus"] },
        onSuccess: "SET $local.myExpenses = $result.rows",
      }
    },
    {
      id: "act-open-detail", name: "openExpenseDetail", type: "setState", config: {
        path: "local.activeExpense", value: "$args.0",
        also: "CALL fetchExpenseDetail; CALL fetchExpenseHistory; CALL fetchWorkflow; CALL navigateExpenseDetails",
      }
    },
    {
      id: "act-fetch-detail", name: "fetchExpenseDetail", type: "fetch", config: {
        url: db, method: "POST",
        body: { sql: "SELECT *, category_id::text AS category, department_id::text AS department FROM expenses WHERE id = $1 LIMIT 1", params: ["$local.activeExpense.id"] },
        onSuccess: "SET $local.activeExpense = $result.rows[0]",
      }
    },
    {
      id: "act-fetch-history", name: "fetchExpenseHistory", type: "fetch", config: {
        url: db, method: "POST",
        body: { sql: "SELECT *, actor_id::text AS actor_name FROM approval_events WHERE expense_id = $1 ORDER BY created_at ASC", params: ["$local.activeExpense.id"] },
        onSuccess: "SET $local.approvalHistory = $result.rows",
      }
    },
    {
      id: "act-fetch-all-history", name: "fetchApprovalHistory", type: "fetch", config: {
        url: db, method: "POST",
        body: { sql: "SELECT *, actor_id::text AS actor_name FROM approval_events ORDER BY created_at DESC LIMIT 50", params: [] },
        onSuccess: "SET $local.approvalHistory = $result.rows",
      }
    },
    {
      id: "act-fetch-manager-approvals", name: "fetchManagerApprovals", type: "fetch", config: {
        url: db, method: "POST",
        body: { sql: "SELECT *, employee_id::text AS employee_name, category_id::text AS category FROM expenses WHERE status = 'pending_manager' AND department_id = $1 ORDER BY submitted_at ASC", params: ["$user.department_id"] },
        onSuccess: "SET $local.pendingApprovals = $result.rows",
      }
    },
    {
      id: "act-manager-approve", name: "managerApproveExpense", type: "fetch", config: {
        url: db, method: "POST",
        body: { sql: "UPDATE expenses SET status = 'pending_finance', current_step_key = 'finance', updated_at = now() WHERE id = $1 RETURNING *", params: ["$expense.id"] },
        onSuccess: "SET $local.activeExpense = $result.rows[0]; CALL createManagerApprovedEvent; CALL notifyFinance; CALL fetchManagerApprovals",
      }
    },
    {
      id: "act-manager-reject", name: "managerRejectExpense", type: "fetch", config: {
        url: db, method: "POST",
        body: { sql: "UPDATE expenses SET status = 'rejected', current_step_key = 'completed', updated_at = now() WHERE id = $1 RETURNING *", params: ["$expense.id"] },
        onSuccess: "SET $local.activeExpense = $result.rows[0]; CALL createRejectedEvent; CALL fetchManagerApprovals",
      }
    },
    {
      id: "act-manager-changes", name: "managerRequestChanges", type: "fetch", config: {
        url: db, method: "POST",
        body: { sql: "UPDATE expenses SET status = 'changes_requested', current_step_key = 'employee_revision', updated_at = now() WHERE id = $1 RETURNING *", params: ["$expense.id"] },
        onSuccess: "SET $local.activeExpense = $result.rows[0]; CALL createChangesRequestedEvent; CALL fetchManagerApprovals",
      }
    },
    {
      id: "act-fetch-finance-approvals", name: "fetchFinanceApprovals", type: "fetch", config: {
        url: db, method: "POST",
        body: { sql: "SELECT *, employee_id::text AS employee_name, category_id::text AS category, department_id::text AS department FROM expenses WHERE status IN ('pending_finance','approved') ORDER BY submitted_at ASC", params: [] },
        onSuccess: "SET $local.financeApprovals = $result.rows",
      }
    },
    {
      id: "act-finance-approve", name: "financeApproveExpense", type: "fetch", config: {
        url: db, method: "POST",
        body: { sql: "UPDATE expenses SET status = 'approved', current_step_key = 'reimbursement', updated_at = now() WHERE id = $1 RETURNING *", params: ["$expense.id"] },
        onSuccess: "SET $local.activeExpense = $result.rows[0]; CALL createFinanceApprovedEvent; CALL fetchFinanceApprovals",
      }
    },
    {
      id: "act-finance-reject", name: "financeRejectExpense", type: "fetch", config: {
        url: db, method: "POST",
        body: { sql: "UPDATE expenses SET status = 'rejected', current_step_key = 'completed', updated_at = now() WHERE id = $1 RETURNING *", params: ["$expense.id"] },
        onSuccess: "SET $local.activeExpense = $result.rows[0]; CALL createRejectedEvent; CALL fetchFinanceApprovals",
      }
    },
    {
      id: "act-reimburse", name: "markReimbursed", type: "fetch", config: {
        url: db, method: "POST",
        body: { sql: "UPDATE expenses SET status = 'reimbursed', current_step_key = 'completed', updated_at = now() WHERE id = $1 RETURNING *", params: ["$expense.id"] },
        onSuccess: "SET $local.activeExpense = $result.rows[0]; CALL createReimbursedEvent; CALL fetchFinanceApprovals",
      }
    },
    {
      id: "act-export", name: "exportRecord", type: "fetch", config: {
        url: db, method: "POST",
        body: { sql: "SELECT *, employee_id::text AS employee_name, department_id::text AS department, category_id::text AS category FROM expenses WHERE id = $1", params: ["$expense.id"] },
        onSuccess: "SET $local.exportRecord = $result.rows[0]",
      }
    },
    {
      id: "act-fetch-workflow", name: "fetchWorkflow", type: "fetch", config: {
        url: db, method: "POST",
        body: { sql: "SELECT * FROM workflow_steps WHERE active = true ORDER BY position ASC", params: [] },
        onSuccess: "SET $local.workflowSteps = $result.rows",
      }
    },
    { id: "act-add-dept-head", name: "addDepartmentHeadApproval", type: "custom", config: { also: "CALL shiftWorkflowForDepartmentHead" } },
    {
      id: "act-shift-workflow", name: "shiftWorkflowForDepartmentHead", type: "fetch", config: {
        url: db, method: "POST",
        body: { sql: "UPDATE workflow_steps SET position = position + 1 WHERE position >= $1 AND step_key != 'department_head' RETURNING *", params: [3] },
        onSuccess: "CALL insertDepartmentHeadApproval",
      }
    },
    {
      id: "act-insert-dept-head", name: "insertDepartmentHeadApproval", type: "fetch", config: {
        url: db, method: "POST",
        body: { sql: "INSERT INTO workflow_steps (id, step_key, label, approver_role, position, active, condition_json) VALUES ($1,$2,$3,$4,$5,true,$6) RETURNING *", params: ["55555555-5555-4555-8555-555555555555", "department_head", "Department Head Approval", "department_head", 3, { when: "amount > 0" }] },
        onSuccess: "CALL fetchWorkflow",
      }
    },
    {
      id: "act-fetch-analytics", name: "fetchAnalytics", type: "setState", config: {
        path: "local.analyticsLoading", value: true,
        also: "CALL fetchAnalyticsSummary; CALL fetchSpendByDepartment; CALL fetchSpendByCategory; CALL fetchMonthlyTrend",
      }
    },
    {
      id: "act-fetch-analytics-summary", name: "fetchAnalyticsSummary", type: "fetch", config: {
        url: db, method: "POST",
        body: { sql: "SELECT COUNT(*) AS total_expenses, ROUND((COUNT(*) FILTER (WHERE status IN ('approved','reimbursed'))::numeric / NULLIF(COUNT(*),0)) * 100, 2) AS approval_rate, COALESCE(SUM(amount) FILTER (WHERE submitted_at >= date_trunc('month', now())),0) AS monthly_spend FROM expenses", params: [] },
        onSuccess: "SET $local.analytics.summary = $result.rows[0]",
      }
    },
    {
      id: "act-spend-dept", name: "fetchSpendByDepartment", type: "fetch", config: {
        url: db, method: "POST",
        body: { sql: "SELECT department_id::text AS name, COALESCE(SUM(amount),0) AS total FROM expenses GROUP BY department_id ORDER BY total DESC", params: [] },
        onSuccess: "SET $local.analytics.spendByDepartment = $result.rows",
      }
    },
    {
      id: "act-spend-cat", name: "fetchSpendByCategory", type: "fetch", config: {
        url: db, method: "POST",
        body: { sql: "SELECT category_id::text AS name, COALESCE(SUM(amount),0) AS total FROM expenses GROUP BY category_id ORDER BY total DESC", params: [] },
        onSuccess: "SET $local.analytics.spendByCategory = $result.rows",
      }
    },
    {
      id: "act-monthly-trend", name: "fetchMonthlyTrend", type: "fetch", config: {
        url: db, method: "POST",
        body: { sql: "SELECT date_trunc('month', submitted_at) AS month, COALESCE(SUM(amount),0) AS total FROM expenses WHERE submitted_at IS NOT NULL GROUP BY month ORDER BY month", params: [] },
        onSuccess: "SET $local.analytics.monthlyTrend = $result.rows",
      }
    },
    {
      id: "act-fetch-notifications", name: "fetchNotifications", type: "fetch", config: {
        url: db, method: "POST",
        body: { sql: "SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC", params: ["$user.id"] },
        onSuccess: "SET $local.notifications = $result.rows",
      }
    },
    {
      id: "act-fetch-settings", name: "fetchSettings", type: "setState", config: {
        path: "local.settingsLoading", value: true,
        also: "CALL fetchCategories; CALL fetchDepartments",
      }
    },
    {
      id: "act-fetch-categories", name: "fetchCategories", type: "fetch", config: {
        url: db, method: "POST",
        body: { sql: "SELECT * FROM expense_categories WHERE active = true ORDER BY name", params: [] },
        onSuccess: "SET $local.settings.categories = $result.rows",
      }
    },
    {
      id: "act-fetch-departments", name: "fetchDepartments", type: "fetch", config: {
        url: db, method: "POST",
        body: { sql: "SELECT * FROM departments ORDER BY name", params: [] },
        onSuccess: "SET $local.settings.departments = $result.rows",
      }
    },
    ...eventAndNotificationActions(db),
    { id: "act-filter-pending", name: "filterPendingExpenses", type: "setState", config: { path: "local.filters.expenseStatus", value: "pending", also: "CALL fetchMyExpenses" } },
    { id: "act-filter-approved", name: "filterApprovedExpenses", type: "setState", config: { path: "local.filters.expenseStatus", value: "approved", also: "CALL fetchMyExpenses" } },
    { id: "act-filter-rejected", name: "filterRejectedExpenses", type: "setState", config: { path: "local.filters.expenseStatus", value: "rejected", also: "CALL fetchMyExpenses" } },
  ];
}

function eventAndNotificationActions(db) {
  const event = (id, name, action, step, comment) => ({
    id, name, type: "fetch", config: {
      url: db, method: "POST",
      body: { sql: "INSERT INTO approval_events (expense_id, actor_id, actor_role, action, step_key, comment) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *", params: ["$local.activeExpense.id", "$user.id", "$user.role", action, step, comment] },
      onSuccess: "CALL fetchExpenseHistory",
    },
  });
  return [
    event("act-event-submitted", "createSubmittedEvent", "submitted", "submit", "Expense submitted"),
    event("act-event-manager-approved", "createManagerApprovedEvent", "approved", "manager", "Manager approved"),
    event("act-event-finance-approved", "createFinanceApprovedEvent", "approved", "finance", "Finance approved"),
    event("act-event-rejected", "createRejectedEvent", "rejected", "completed", "Expense rejected"),
    event("act-event-changes", "createChangesRequestedEvent", "changes_requested", "employee_revision", "Changes requested"),
    event("act-event-reimbursed", "createReimbursedEvent", "reimbursed", "completed", "Reimbursement sent"),
    {
      id: "act-notify-manager", name: "notifyManager", type: "fetch", config: {
        url: db, method: "POST",
        body: { sql: "INSERT INTO notifications (user_id, expense_id, type, title, body) SELECT manager_id, $1, 'approval_required', 'New Approval Required', $2 FROM users WHERE id = $3 RETURNING *", params: ["$local.activeExpense.id", "$local.activeExpense.title", "$local.activeExpense.employee_id"] },
      }
    },
    {
      id: "act-notify-finance", name: "notifyFinance", type: "fetch", config: {
        url: db, method: "POST",
        body: { sql: "INSERT INTO notifications (user_id, expense_id, type, title, body) SELECT id, $1, 'approval_required', 'Final Approval Required', $2 FROM users WHERE role = 'finance' LIMIT 1 RETURNING *", params: ["$local.activeExpense.id", "$local.activeExpense.title"] },
      }
    },
  ];
}

function navigation(screenIds) {
  const paths = [
    "/login",
    "/dashboard",
    "/submit-expense",
    "/my-expenses",
    "/expenses/detail",
    "/manager/approvals",
    "/finance/approvals",
    "/approval-history",
    "/admin/workflow",
    "/analytics",
    "/notifications",
    "/settings",
  ];
  return {
    type: "stack",
    initialRoute: "/login",
    routes: paths.map((path, i) => ({ path, screenId: screenIds[i] })),
  };
}

async function ensureCoreProject(client) {
  await client.query(`
    ALTER TABLE IF EXISTS users
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now()
  `);
  await client.query(`
    ALTER TABLE IF EXISTS projects
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now()
  `);
  await client.query(
    `INSERT INTO users (id, email, password_hash, salt, fullname, role, approved)
     VALUES ($1, $2, $3, $4, $5, 'admin', true)
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, fullname = EXCLUDED.fullname, role = 'admin', approved = true`,
    [OWNER_ID, "manimadhava43@gmail.com", "dummyhash", "dummysalt", "Mint Admin"]
  );
  await client.query(
    `INSERT INTO projects (id, name, description, owner_id, is_public)
     VALUES ($1, $2, $3, $4, true)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, owner_id = EXCLUDED.owner_id`,
    [PID, "Expense Approval Demo", "Role-based expense approval workflow built with Mint runtime", OWNER_ID]
  );
}

async function ensureProjectTables(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "${prefixed("users")}" (
      id uuid PRIMARY KEY,
      email text UNIQUE NOT NULL,
      password_hash text,
      name text NOT NULL,
      role text NOT NULL,
      department_id uuid,
      manager_id uuid,
      remember_login boolean DEFAULT false,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )`);
  await client.query(`
    ALTER TABLE "${prefixed("users")}"
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now()
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS "${prefixed("departments")}" (
      id uuid PRIMARY KEY,
      name text NOT NULL,
      head_user_id uuid,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )`);
  await client.query(`
    ALTER TABLE "${prefixed("departments")}"
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now()
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS "${prefixed("expense_categories")}" (
      id uuid PRIMARY KEY,
      name text NOT NULL,
      requires_receipt boolean DEFAULT true,
      active boolean DEFAULT true,
      updated_at timestamptz DEFAULT now()
    )`);
  await client.query(`
    ALTER TABLE "${prefixed("expense_categories")}"
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now()
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS "${prefixed("expenses")}" (
      id uuid PRIMARY KEY,
      employee_id uuid,
      title text NOT NULL,
      description text,
      amount numeric NOT NULL,
      currency text NOT NULL,
      category_id uuid,
      department_id uuid,
      expense_date date,
      receipt_url text,
      status text NOT NULL,
      current_step_key text,
      submitted_at timestamptz,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS "${prefixed("approval_events")}" (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      expense_id uuid,
      actor_id uuid,
      actor_role text,
      action text,
      step_key text,
      comment text,
      created_at timestamptz DEFAULT now()
    )`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS "${prefixed("workflow_steps")}" (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      step_key text NOT NULL UNIQUE,
      label text NOT NULL,
      approver_role text,
      position integer NOT NULL,
      active boolean DEFAULT true,
      condition_json jsonb,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )`);
  await client.query(`
    ALTER TABLE "${prefixed("workflow_steps")}"
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now()
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS "${prefixed("notifications")}" (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid,
      expense_id uuid,
      type text,
      title text,
      body text,
      read_at timestamptz,
      created_at timestamptz DEFAULT now()
    )`);
}

async function seedDemoData(client) {
  const users = prefixed("users");
  const departments = prefixed("departments");
  const categories = prefixed("expense_categories");
  const expenses = prefixed("expenses");
  const events = prefixed("approval_events");
  const steps = prefixed("workflow_steps");
  const notifications = prefixed("notifications");

  await client.query(
    `INSERT INTO "${departments}" (id, name, head_user_id) VALUES
     ($1, 'Sales', $2),
     ($3, 'Engineering', $4),
     ($5, 'Operations', $4)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, head_user_id = EXCLUDED.head_user_id`,
    [IDS.sales, IDS.manager, IDS.engineering, IDS.admin, IDS.operations]
  );
  await client.query(
    `INSERT INTO "${users}" (id, email, password_hash, name, role, department_id, manager_id) VALUES
     ($1, 'alex.employee@example.com', 'demo', 'Alex Employee', 'employee', $5, $2),
     ($2, 'maya.manager@example.com', 'demo', 'Maya Manager', 'manager', $5, NULL),
     ($3, 'finley.finance@example.com', 'demo', 'Finley Finance', 'finance', $6, NULL),
     ($4, 'ari.admin@example.com', 'demo', 'Ari Admin', 'admin', $6, NULL)
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name, role = EXCLUDED.role, department_id = EXCLUDED.department_id, manager_id = EXCLUDED.manager_id`,
    [IDS.employee, IDS.manager, IDS.finance, IDS.admin, IDS.sales, IDS.operations]
  );
  await client.query(
    `INSERT INTO "${categories}" (id, name, requires_receipt, active) VALUES
     ($1, 'Meals', true, true),
     ($2, 'Travel', true, true),
     ($3, 'Software', false, true),
     ($4, 'Office Supplies', false, true)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, requires_receipt = EXCLUDED.requires_receipt, active = EXCLUDED.active`,
    [IDS.meals, IDS.travel, IDS.software, IDS.supplies]
  );
  await client.query(
    `INSERT INTO "${expenses}" (id, employee_id, title, description, amount, currency, category_id, department_id, expense_date, receipt_url, status, current_step_key, submitted_at) VALUES
     ($1, $5, 'Client dinner', 'Dinner after customer workshop', 142.50, 'USD', $6, $10, CURRENT_DATE - interval '2 days', '/receipts/client-dinner.pdf', 'pending_manager', 'manager', now() - interval '2 days'),
     ($2, $5, 'Conference flight', 'Flight for annual SaaS conference', 620.00, 'USD', $7, $10, CURRENT_DATE - interval '8 days', '/receipts/conference-flight.pdf', 'pending_finance', 'finance', now() - interval '8 days'),
     ($3, $5, 'Design software', 'Monthly design tooling', 89.00, 'USD', $8, $10, CURRENT_DATE - interval '12 days', '', 'approved', 'reimbursement', now() - interval '12 days'),
     ($4, $5, 'Desk accessories', 'Keyboard tray and cable dock', 54.00, 'USD', $9, $10, CURRENT_DATE - interval '20 days', '', 'rejected', 'completed', now() - interval '20 days')
     ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, amount = EXCLUDED.amount, status = EXCLUDED.status, current_step_key = EXCLUDED.current_step_key`,
    [IDS.expDinner, IDS.expFlight, IDS.expSoftware, IDS.expDesk, IDS.employee, IDS.meals, IDS.travel, IDS.software, IDS.supplies, IDS.sales]
  );
  await client.query(
    `INSERT INTO "${steps}" (id, step_key, label, approver_role, position, active, condition_json) VALUES
     ('20000000-0000-4000-8000-000000000001', 'submit', 'Submit Expense', 'employee', 1, true, '{}'::jsonb),
     ('20000000-0000-4000-8000-000000000002', 'manager', 'Manager Approval', 'manager', 2, true, '{}'::jsonb),
     ('20000000-0000-4000-8000-000000000003', 'finance', 'Finance Approval', 'finance', 3, true, '{}'::jsonb),
     ('20000000-0000-4000-8000-000000000004', 'reimbursement', 'Reimbursement', 'finance', 4, true, '{}'::jsonb)
     ON CONFLICT (step_key) DO UPDATE SET label = EXCLUDED.label, approver_role = EXCLUDED.approver_role, position = EXCLUDED.position, active = EXCLUDED.active`,
  );
  await client.query(
    `INSERT INTO "${events}" (expense_id, actor_id, actor_role, action, step_key, comment, created_at) VALUES
     ($1, $5, 'employee', 'submitted', 'submit', 'Expense created', now() - interval '2 days'),
     ($2, $5, 'employee', 'submitted', 'submit', 'Expense created', now() - interval '8 days'),
     ($2, $6, 'manager', 'approved', 'manager', 'Approved for finance', now() - interval '7 days'),
     ($3, $5, 'employee', 'submitted', 'submit', 'Expense created', now() - interval '12 days'),
     ($3, $6, 'manager', 'approved', 'manager', 'Approved', now() - interval '11 days'),
     ($3, $7, 'finance', 'approved', 'finance', 'Final approval complete', now() - interval '10 days'),
     ($4, $5, 'employee', 'submitted', 'submit', 'Expense created', now() - interval '20 days'),
     ($4, $6, 'manager', 'rejected', 'manager', 'Missing business justification', now() - interval '19 days')
     ON CONFLICT DO NOTHING`,
    [IDS.expDinner, IDS.expFlight, IDS.expSoftware, IDS.expDesk, IDS.employee, IDS.manager, IDS.finance]
  );
  await client.query(
    `INSERT INTO "${notifications}" (user_id, expense_id, type, title, body) VALUES
     ($1, $3, 'approval_required', 'New Approval Required', 'Client dinner is waiting for manager review.'),
     ($2, $4, 'approval_required', 'Final Approval Required', 'Conference flight is ready for finance approval.'),
     ($5, $6, 'expense_approved', 'Expense Approved', 'Design software was approved.')
     ON CONFLICT DO NOTHING`,
    [IDS.manager, IDS.finance, IDS.expDinner, IDS.expFlight, IDS.employee, IDS.expSoftware]
  );
}

async function main() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  console.log("Connected to DB");

  await ensureCoreProject(client);
  await ensureProjectTables(client);
  await seedDemoData(client);
  console.log("Project tables and demo data seeded");

  const fileRes = await client.query("SELECT * FROM files WHERE project_id = $1 LIMIT 1", [PID]);
  let fileRow;
  if (!fileRes.rows.length) {
    const fileId = crypto.randomUUID();
    const insertRes = await client.query(
      "INSERT INTO files (id, project_id, name, data, revn) VALUES ($1, $2, $3, $4::jsonb, 1) RETURNING *",
      [fileId, PID, "Expense Approval App", JSON.stringify(emptyFileData())]
    );
    fileRow = insertRes.rows[0];
  } else {
    fileRow = fileRes.rows[0];
  }

  const fileData = emptyFileData();
  const pageId = fileData.pages[0];
  const objects = fileData.pagesIndex[pageId].objects;
  const root = objects[ROOT_ID];
  const screenIds = buildScreens(objects);
  root.shapes = screenIds;

  await client.query("UPDATE files SET name = $1, data = $2::jsonb, modified_at = now() WHERE id = $3", [
    "Expense Approval App",
    JSON.stringify(fileData),
    fileRow.id,
  ]);
  console.log("Canvas saved");

  const schema = {
    id: PID,
    name: "Expense Approval App",
    database: databaseSchema(),
    globalState: globalState(),
    globalActions: actions(),
    navigation: navigation(screenIds),
  };

  await client.query(
    `INSERT INTO runtime_schemas (project_id, schema_json, updated_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (project_id)
     DO UPDATE SET schema_json = $2, updated_at = now(), updated_by = $3`,
    [PID, JSON.stringify(schema), OWNER_ID]
  );
  console.log("Runtime schema saved");

  const nodes = screenIds.map((id) => {
    const screen = objects[id];
    return shapeToNode(screen, screen.x, screen.y, objects);
  });

  console.log("Compiled nodes:", nodes.length);
  console.log("Seed complete for project:", PID);
  console.log("File id:", fileRow.id);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
