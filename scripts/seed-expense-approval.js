#!/usr/bin/env node
/**
 * Seed script: Expense Approval App — runtime schema
 *
 * Usage (on the machine with the database):
 *   node scripts/seed-expense-approval.js
 *
 * Connection env vars (set at least one of these groups):
 *   DATABASE_URL=postgres://user:pass@host:5432/dbname
 *   OR
 *   PGHOST=localhost PGPORT=5432 PGDATABASE=mintdb PGUSER=postgres PGPASSWORD=secret
 *
 * Install pg if missing:
 *   npm install pg
 */

const { Client } = require("pg");

// ─── Connection ────────────────────────────────────────────────────────────
const client = new Client(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST || "localhost",
        port: parseInt(process.env.PGPORT || "5432"),
        database: process.env.PGDATABASE || "mintdb",
        user: process.env.PGUSER || "postgres",
        password: process.env.PGPASSWORD || "",
      }
);

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Build a StyleSchema from a flat description */
function mkStyle({ flex, width, height, padding, margin, marginBottom, marginTop,
                   bg, borderRadius, fontSize, fontWeight, color, textAlign,
                   direction, align, justify, gap, display } = {}) {
  const s = {};
  if (display || direction || align || justify || gap !== undefined) {
    s.layout = {};
    if (display)    s.layout.display    = display;
    if (direction)  s.layout.direction  = direction;
    if (align)      s.layout.align      = align;
    if (justify)    s.layout.justify    = justify;
    if (gap !== undefined) s.layout.gap = gap;
  }
  if (flex !== undefined || width !== undefined || height !== undefined) {
    s.sizing = {};
    if (flex !== undefined)   s.sizing.flex   = flex;
    if (width !== undefined)  s.sizing.width  = width;
    if (height !== undefined) s.sizing.height = height;
  }
  if (padding !== undefined || margin !== undefined || marginBottom !== undefined || marginTop !== undefined) {
    s.spacing = {};
    if (padding !== undefined)      s.spacing.padding = padding;
    if (marginBottom !== undefined) s.spacing.margin  = [0, 0, marginBottom, 0];
    else if (marginTop !== undefined) s.spacing.margin = [marginTop, 0, 0, 0];
    else if (margin !== undefined)  s.spacing.margin  = margin;
  }
  if (bg)                    s.background = { color: bg };
  if (borderRadius !== undefined) s.border = { radius: borderRadius };
  if (fontSize || fontWeight || color || textAlign) {
    s.typography = {};
    if (fontSize)   s.typography.fontSize   = fontSize;
    if (fontWeight) s.typography.fontWeight = fontWeight;
    if (color)      s.typography.color      = color;
    if (textAlign)  s.typography.textAlign  = textAlign;
  }
  return s;
}

/** Recursively add bindings:{} to a component tree */
function comp(c) {
  const out = { ...c, bindings: {} };
  if (c.children) out.children = c.children.map(comp);
  return out;
}

// ─── AppSchema ─────────────────────────────────────────────────────────────
const PROJECT_ID = "40780692-dd76-4e25-9fbb-ea194dba9619";

const schema = {
  id: PROJECT_ID,
  name: "Expense Approval",
  version: "1.0.0",
  schemaVersion: 1,

  // ── Theme ─────────────────────────────────────────────────────────────
  theme: {
    colors: {
      primary:       "#4F46E5",
      secondary:     "#7C3AED",
      background:    "#F9FAFB",
      surface:       "#FFFFFF",
      text:          "#111827",
      textSecondary: "#6B7280",
      border:        "#E5E7EB",
      success:       "#10B981",
      warning:       "#F59E0B",
      danger:        "#EF4444",
    },
    fonts: {
      heading: "Inter",
      body:    "Inter",
      mono:    "JetBrains Mono",
    },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    radii:   { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
    shadows: {},
  },

  meta: {
    platform:    "mobile",
    description: "Enterprise expense submission and approval workflow app",
  },

  // ── Screens ───────────────────────────────────────────────────────────
  screens: [
    // ── Screen 1: Login ──────────────────────────────────────────────────
    {
      id:         "a1b2c3d4-0001-4000-8000-000000000001",
      name:       "LoginScreen",
      route:      "/login",
      localState: [],
      actions:    [],
      components: [
        comp({
          id:    "login-container",
          type:  "container",
          props: { direction: "column", align: "center", justify: "center" },
          style: mkStyle({ flex: 1, padding: 32, bg: "#F9FAFB", direction: "column", align: "center", justify: "center" }),
          children: [
            {
              id:    "login-logo",
              type:  "image",
              props: { source: "/logo.png", alt: "Expense Tracker" },
              style: mkStyle({ width: 80, height: 80, marginBottom: 24 }),
            },
            {
              id:    "login-heading",
              type:  "heading",
              props: { text: "Sign in to Expense Tracker", level: 1 },
              style: mkStyle({ fontSize: 24, fontWeight: "700", color: "#111827", marginBottom: 8, textAlign: "center" }),
            },
            {
              id:    "login-subtext",
              type:  "text",
              props: { text: "Track and approve company expenses" },
              style: mkStyle({ fontSize: 14, color: "#6B7280", marginBottom: 32, textAlign: "center" }),
            },
            {
              id:    "login-email",
              type:  "input",
              props: { placeholder: "you@company.com", keyboardType: "email-address", autoCapitalize: "none", stateKey: "$local.loginForm.email" },
              style: mkStyle({ width: "100%", marginBottom: 16 }),
            },
            {
              id:    "login-password",
              type:  "input",
              props: { placeholder: "Enter your password", secureTextEntry: true, stateKey: "$local.loginForm.password" },
              style: mkStyle({ width: "100%", marginBottom: 24 }),
            },
            {
              id:    "login-btn",
              type:  "button",
              props: { text: "Sign In", variant: "primary" },
              style: mkStyle({ width: "100%", height: 48 }),
              events: { onClick: [{ actionId: "wf-login" }] },
            },
            {
              id:    "login-error",
              type:  "text",
              props: { text: "$global.loginError", visible: "$global.loginError != ''" },
              style: mkStyle({ color: "#EF4444", fontSize: 13, marginTop: 12, textAlign: "center" }),
            },
          ],
        }),
      ],
    },

    // ── Screen 2: Dashboard ──────────────────────────────────────────────
    {
      id:         "a1b2c3d4-0002-4000-8000-000000000001",
      name:       "DashboardScreen",
      route:      "/dashboard",
      localState: [],
      actions:    [],
      onMount:    [{ actionId: "wf-load-dashboard" }],
      components: [
        comp({
          id:    "dash-navbar",
          type:  "navigationBar",
          props: { title: "Expense Tracker", showBack: false },
          style: mkStyle({ bg: "#4F46E5" }),
        }),
        comp({
          id:    "dash-scroll",
          type:  "container",
          props: { scrollable: true, direction: "column" },
          style: mkStyle({ flex: 1, padding: 16, bg: "#F9FAFB", direction: "column" }),
          children: [
            {
              id:    "dash-welcome",
              type:  "text",
              props: { text: "Welcome back, $global.currentUser.name!" },
              style: mkStyle({ fontSize: 18, fontWeight: "600", color: "#111827", marginBottom: 16 }),
            },
            {
              id:    "dash-summary-card",
              type:  "card",
              props: {},
              style: mkStyle({ padding: 16, borderRadius: 12, bg: "#FFFFFF", marginBottom: 16 }),
              children: [
                {
                  id:    "dash-summary-row",
                  type:  "container",
                  props: { direction: "row", justify: "space-between" },
                  style: mkStyle({ direction: "row", justify: "between" }),
                  children: [
                    {
                      id:    "dash-total-col",
                      type:  "container",
                      props: { direction: "column", align: "center" },
                      style: mkStyle({ flex: 1, direction: "column", align: "center" }),
                      children: [
                        { id: "dash-total-label",  type: "text",  props: { text: "Total Expenses" },           style: mkStyle({ fontSize: 12, color: "#6B7280", marginBottom: 4 }) },
                        { id: "dash-total-amount", type: "text",  props: { text: "$global.expenses.totalAmount" }, style: mkStyle({ fontSize: 22, fontWeight: "700", color: "#4F46E5" }) },
                      ],
                    },
                    {
                      id:    "dash-pending-col",
                      type:  "container",
                      props: { direction: "column", align: "center" },
                      style: mkStyle({ flex: 1, direction: "column", align: "center" }),
                      children: [
                        { id: "dash-pending-label", type: "text",  props: { text: "Pending Approval" },              style: mkStyle({ fontSize: 12, color: "#6B7280", marginBottom: 4 }) },
                        { id: "dash-pending-count", type: "badge", props: { text: "$global.pendingExpenses.length", variant: "warning" }, style: mkStyle({ fontSize: 22, fontWeight: "700" }) },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              id:    "dash-actions-row",
              type:  "container",
              props: { direction: "row", gap: 12 },
              style: mkStyle({ marginBottom: 20, direction: "row", gap: 12 }),
              children: [
                {
                  id:    "dash-submit-btn",
                  type:  "button",
                  props: { text: "Submit New Expense", variant: "primary", icon: "Plus" },
                  style: mkStyle({ flex: 1, height: 44 }),
                  events: { onClick: [{ actionId: "act-navigate-submit" }] },
                },
                {
                  id:    "signout-btn",
                  type:  "button",
                  props: { text: "Sign Out", variant: "outline", icon: "LogOut" },
                  style: mkStyle({ height: 44 }),
                  events: { onClick: [{ actionId: "wf-logout" }] },
                },
              ],
            },
            {
              id:    "dash-recent-heading",
              type:  "heading",
              props: { text: "Recent Expenses", level: 3 },
              style: mkStyle({ fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 12 }),
            },
            {
              id:    "dash-recent-list",
              type:  "list",
              props: {
                data:         "$global.expenses.recent",
                keyExtractor: "item.id",
                renderItem:   { type: "listItem", props: { title: "item.title", subtitle: "item.category", trailing: "item.amount", badge: "item.status" } },
              },
              style: {},
            },
          ],
        }),
        comp({
          id:    "dash-tabbar",
          type:  "tabBar",
          props: {
            items: [
              { label: "Home",     icon: "Home",        route: "/dashboard" },
              { label: "Approval", icon: "CheckSquare", route: "/approval",  roles: ["admin", "manager"] },
              { label: "History",  icon: "Clock",       route: "/history" },
              { label: "Profile",  icon: "User",        route: "/profile" },
            ],
            activeRoute: "/dashboard",
          },
          style: {},
        }),
      ],
    },

    // ── Screen 3: Submit Expense ─────────────────────────────────────────
    {
      id:         "a1b2c3d4-0003-4000-8000-000000000001",
      name:       "SubmitExpenseScreen",
      route:      "/submit",
      localState: [],
      actions:    [],
      components: [
        comp({
          id:    "submit-navbar",
          type:  "navigationBar",
          props: { title: "Submit Expense", showBack: true, backRoute: "/dashboard" },
          style: mkStyle({ bg: "#4F46E5" }),
        }),
        comp({
          id:    "submit-scroll",
          type:  "container",
          props: { scrollable: true, direction: "column" },
          style: mkStyle({ flex: 1, padding: 16, bg: "#F9FAFB", direction: "column" }),
          children: [
            { id: "submit-title-input",    type: "input",    props: { label: "Expense Title",    placeholder: "e.g. Team lunch", stateKey: "$global.expenseForm.title" }, style: mkStyle({ marginBottom: 16 }) },
            { id: "submit-amount-input",   type: "input",    props: { label: "Amount ($)",       placeholder: "0.00", keyboardType: "decimal-pad", stateKey: "$global.expenseForm.amount" }, style: mkStyle({ marginBottom: 16 }) },
            { id: "submit-category-select",type: "select",   props: { label: "Category",         placeholder: "Select a category", options: "$global.categories", optionLabel: "name", optionValue: "id", stateKey: "$global.expenseForm.categoryId" }, style: mkStyle({ marginBottom: 16 }) },
            { id: "submit-date-picker",    type: "input",    props: { label: "Expense Date",     type: "date", stateKey: "$global.expenseForm.date" }, style: mkStyle({ marginBottom: 16 }) },
            { id: "submit-description",    type: "textarea", props: { label: "Description",      placeholder: "Provide context...", rows: 4, stateKey: "$global.expenseForm.description" }, style: mkStyle({ marginBottom: 24 }) },
            {
              id:    "submit-btn",
              type:  "button",
              props: { text: "Submit Expense", variant: "primary", loading: "$global.isLoading" },
              style: mkStyle({ width: "100%", height: 48, marginBottom: 16 }),
              events: { onClick: [{ actionId: "wf-submit-expense" }] },
            },
          ],
        }),
      ],
    },

    // ── Screen 4: Expense Detail ─────────────────────────────────────────
    {
      id:         "a1b2c3d4-0004-4000-8000-000000000001",
      name:       "ExpenseDetailScreen",
      route:      "/expense/:id",
      localState: [],
      actions:    [],
      components: [
        comp({
          id:    "detail-navbar",
          type:  "navigationBar",
          props: { title: "Expense Details", showBack: true, backRoute: "/dashboard" },
          style: mkStyle({ bg: "#4F46E5" }),
        }),
        comp({
          id:    "detail-scroll",
          type:  "container",
          props: { scrollable: true, direction: "column" },
          style: mkStyle({ flex: 1, padding: 16, bg: "#F9FAFB", direction: "column" }),
          children: [
            {
              id:    "detail-header-card",
              type:  "card",
              props: {},
              style: mkStyle({ padding: 16, borderRadius: 12, bg: "#FFFFFF", marginBottom: 16 }),
              children: [
                { id: "detail-title",        type: "heading", props: { text: "$global.selectedExpense.title",  level: 2 }, style: mkStyle({ fontSize: 20, fontWeight: "700", color: "#111827", marginBottom: 4 }) },
                { id: "detail-amount",       type: "text",    props: { text: "$global.selectedExpense.amount" },           style: mkStyle({ fontSize: 28, fontWeight: "700", color: "#4F46E5", marginBottom: 8 }) },
                { id: "detail-status-badge", type: "badge",   props: { text: "$global.selectedExpense.status", variant: "$global.selectedExpense.statusVariant" }, style: {} },
              ],
            },
            {
              id:    "detail-info-card",
              type:  "card",
              props: {},
              style: mkStyle({ padding: 16, borderRadius: 12, bg: "#FFFFFF", marginBottom: 16 }),
              children: [
                { id: "detail-category",   type: "text", props: { text: "Category: $global.selectedExpense.category" },     style: mkStyle({ fontSize: 14, color: "#6B7280", marginBottom: 8 }) },
                { id: "detail-date",       type: "text", props: { text: "Date: $global.selectedExpense.date" },              style: mkStyle({ fontSize: 14, color: "#6B7280", marginBottom: 8 }) },
                { id: "detail-submitter",  type: "text", props: { text: "Submitted by: $global.selectedExpense.submitterName" }, style: mkStyle({ fontSize: 14, color: "#6B7280", marginBottom: 8 }) },
                { id: "detail-description",type: "text", props: { text: "$global.selectedExpense.description" },             style: mkStyle({ fontSize: 14, color: "#374151", marginTop: 8 }) },
              ],
            },
            {
              id:    "detail-approval-row",
              type:  "container",
              props: { direction: "row", gap: 12, conditionalRender: "$global.selectedExpense.status == 'pending' && ($global.currentUser.role == 'admin' || $global.currentUser.role == 'manager')" },
              style: mkStyle({ marginBottom: 16, direction: "row", gap: 12 }),
              children: [
                {
                  id:    "approve-btn",
                  type:  "button",
                  props: { text: "Approve", variant: "success", icon: "Check" },
                  style: mkStyle({ flex: 1, height: 48 }),
                  events: { onClick: [{ actionId: "wf-approve-expense" }] },
                },
                {
                  id:    "reject-btn",
                  type:  "button",
                  props: { text: "Reject", variant: "danger", icon: "X" },
                  style: mkStyle({ flex: 1, height: 48 }),
                  events: { onClick: [{ actionId: "wf-reject-expense" }] },
                },
              ],
            },
            { id: "detail-comments-heading", type: "heading", props: { text: "Comments", level: 3 }, style: mkStyle({ fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 12 }) },
            {
              id:    "detail-comments-list",
              type:  "list",
              props: {
                data:         "$global.selectedExpense.comments",
                keyExtractor: "item.id",
                renderItem:   { type: "listItem", props: { avatar: "item.authorAvatar", title: "item.authorName", subtitle: "item.content", trailing: "item.createdAt" } },
              },
              style: {},
            },
          ],
        }),
      ],
    },

    // ── Screen 5: Approval Queue ─────────────────────────────────────────
    {
      id:         "a1b2c3d4-0005-4000-8000-000000000001",
      name:       "ApprovalQueueScreen",
      route:      "/approval",
      localState: [],
      actions:    [],
      onMount:    [{ actionId: "act-fetch-pending" }],
      components: [
        comp({
          id:    "approval-navbar",
          type:  "navigationBar",
          props: { title: "Approval Queue", showBack: false },
          style: mkStyle({ bg: "#4F46E5" }),
        }),
        comp({
          id:    "approval-content",
          type:  "container",
          props: { direction: "column" },
          style: mkStyle({ flex: 1, padding: 16, bg: "#F9FAFB", direction: "column" }),
          children: [
            { id: "approval-pending-count", type: "text",   props: { text: "$global.pendingExpenses.length expenses awaiting approval" }, style: mkStyle({ fontSize: 14, color: "#6B7280", marginBottom: 12 }) },
            {
              id:    "approval-filter-tabs",
              type:  "tab",
              props: { tabs: [{ label: "All Pending", value: "pending" }, { label: "High Value", value: "high-value" }, { label: "Overdue", value: "overdue" }], stateKey: "$local.approvalFilter" },
              style: mkStyle({ marginBottom: 12 }),
            },
            {
              id:    "bulk-approve-btn",
              type:  "button",
              props: { text: "Bulk Approve Selected", variant: "primary", icon: "CheckSquare" },
              style: mkStyle({ width: "100%", height: 44, marginBottom: 12 }),
              events: { onClick: [{ actionId: "act-bulk-approve" }] },
            },
            {
              id:    "approval-list",
              type:  "list",
              props: {
                data:         "$global.pendingExpenses",
                keyExtractor: "item.id",
                selectable:   true,
                selectedKey:  "$local.selectedExpenseIds",
                renderItem:   { type: "listItem", props: { title: "item.title", subtitle: "item.submitterName + ' · ' + item.category", trailing: "item.amount", badge: "item.submittedAt" } },
              },
              style: mkStyle({ flex: 1 }),
            },
          ],
        }),
        comp({
          id:    "approval-tabbar",
          type:  "tabBar",
          props: {
            items: [
              { label: "Home", icon: "Home", route: "/dashboard" },
              { label: "Approval", icon: "CheckSquare", route: "/approval", roles: ["admin", "manager"] },
              { label: "History", icon: "Clock", route: "/history" },
              { label: "Profile", icon: "User", route: "/profile" },
            ],
            activeRoute: "/approval",
          },
          style: {},
        }),
      ],
    },

    // ── Screen 6: Expense History ────────────────────────────────────────
    {
      id:         "a1b2c3d4-0006-4000-8000-000000000001",
      name:       "ExpenseHistoryScreen",
      route:      "/history",
      localState: [],
      actions:    [],
      onMount:    [{ actionId: "act-fetch-history" }],
      components: [
        comp({
          id:    "history-navbar",
          type:  "navigationBar",
          props: { title: "Expense History", showBack: false },
          style: mkStyle({ bg: "#4F46E5" }),
        }),
        comp({
          id:    "history-content",
          type:  "container",
          props: { direction: "column" },
          style: mkStyle({ flex: 1, padding: 16, bg: "#F9FAFB", direction: "column" }),
          children: [
            {
              id:    "history-filters-row",
              type:  "container",
              props: { direction: "row", gap: 8 },
              style: mkStyle({ marginBottom: 12, direction: "row", gap: 8 }),
              children: [
                { id: "history-status-filter", type: "select", props: { placeholder: "Status",     options: [{ label: "All", value: "" }, { label: "Approved", value: "approved" }, { label: "Rejected", value: "rejected" }], stateKey: "$local.historyStatusFilter" }, style: mkStyle({ flex: 1 }) },
                { id: "history-date-filter",   type: "select", props: { placeholder: "Date Range", options: [{ label: "All Time", value: "all" }, { label: "This Month", value: "month" }, { label: "This Quarter", value: "quarter" }, { label: "This Year", value: "year" }], stateKey: "$local.historyDateFilter" }, style: mkStyle({ flex: 1 }) },
              ],
            },
            {
              id:    "history-total-card",
              type:  "card",
              props: {},
              style: mkStyle({ padding: 12, borderRadius: 10, bg: "#FFFFFF", marginBottom: 12 }),
              children: [
                { id: "history-total-label", type: "text", props: { text: "Total Approved" },               style: mkStyle({ fontSize: 12, color: "#6B7280", marginBottom: 2 }) },
                { id: "history-total-value", type: "text", props: { text: "$global.expenses.approvedTotal" }, style: mkStyle({ fontSize: 20, fontWeight: "700", color: "#10B981" }) },
              ],
            },
            {
              id:    "history-export-btn",
              type:  "button",
              props: { text: "Export Report (CSV)", variant: "outline", icon: "Download" },
              style: mkStyle({ marginBottom: 12, height: 40 }),
              events: { onClick: [{ actionId: "act-export-history" }] },
            },
            {
              id:    "history-list",
              type:  "list",
              props: {
                data:         "$global.expenses.history",
                keyExtractor: "item.id",
                renderItem:   { type: "listItem", props: { title: "item.title", subtitle: "item.category + ' · ' + item.date", trailing: "item.amount", badge: "item.status" } },
              },
              style: mkStyle({ flex: 1 }),
            },
          ],
        }),
        comp({
          id:    "history-tabbar",
          type:  "tabBar",
          props: {
            items: [
              { label: "Home", icon: "Home", route: "/dashboard" },
              { label: "Approval", icon: "CheckSquare", route: "/approval", roles: ["admin", "manager"] },
              { label: "History", icon: "Clock", route: "/history" },
              { label: "Profile", icon: "User", route: "/profile" },
            ],
            activeRoute: "/history",
          },
          style: {},
        }),
      ],
    },

    // ── Screen 7: Profile ────────────────────────────────────────────────
    {
      id:         "a1b2c3d4-0007-4000-8000-000000000001",
      name:       "ProfileScreen",
      route:      "/profile",
      localState: [],
      actions:    [],
      components: [
        comp({
          id:    "profile-navbar",
          type:  "navigationBar",
          props: { title: "Profile & Settings", showBack: false },
          style: mkStyle({ bg: "#4F46E5" }),
        }),
        comp({
          id:    "profile-scroll",
          type:  "container",
          props: { scrollable: true, direction: "column" },
          style: mkStyle({ flex: 1, padding: 16, bg: "#F9FAFB", direction: "column" }),
          children: [
            {
              id:    "profile-header",
              type:  "container",
              props: { direction: "column", align: "center" },
              style: mkStyle({ padding: 24, bg: "#FFFFFF", borderRadius: 12, marginBottom: 16, direction: "column", align: "center" }),
              children: [
                { id: "profile-avatar",     type: "avatar", props: { source: "$global.currentUser.avatarUrl", initials: "$global.currentUser.initials", size: 80 }, style: mkStyle({ marginBottom: 12 }) },
                { id: "profile-name",       type: "text",   props: { text: "$global.currentUser.name" },  style: mkStyle({ fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 4 }) },
                { id: "profile-email",      type: "text",   props: { text: "$global.currentUser.email" }, style: mkStyle({ fontSize: 14, color: "#6B7280", marginBottom: 8 }) },
                { id: "profile-role-badge", type: "badge",  props: { text: "$global.currentUser.role", variant: "primary" }, style: {} },
              ],
            },
            {
              id:    "profile-settings-card",
              type:  "card",
              props: {},
              style: mkStyle({ padding: 16, borderRadius: 12, bg: "#FFFFFF", marginBottom: 16 }),
              children: [
                {
                  id:    "profile-notifications-row",
                  type:  "container",
                  props: { direction: "row", align: "center", justify: "space-between" },
                  style: mkStyle({ marginBottom: 16, direction: "row", align: "center", justify: "between" }),
                  children: [
                    { id: "profile-notifications-label",  type: "text",   props: { text: "Email Notifications" }, style: mkStyle({ fontSize: 14, color: "#111827" }) },
                    { id: "profile-notifications-switch", type: "switch", props: { stateKey: "$global.currentUser.emailNotifications" }, style: {} },
                  ],
                },
                {
                  id:    "profile-currency-select",
                  type:  "select",
                  props: {
                    label: "Currency Preference",
                    options: [
                      { label: "USD — US Dollar",     value: "USD" },
                      { label: "EUR — Euro",           value: "EUR" },
                      { label: "GBP — British Pound",  value: "GBP" },
                      { label: "INR — Indian Rupee",   value: "INR" },
                    ],
                    stateKey: "$global.currentUser.currency",
                  },
                  style: {},
                },
              ],
            },
            { id: "profile-edit-btn",    type: "button", props: { text: "Edit Profile", variant: "outline", icon: "Edit" },  style: mkStyle({ width: "100%", height: 44, marginBottom: 12 }) },
            {
              id:    "profile-signout-btn",
              type:  "button",
              props: { text: "Sign Out", variant: "danger", icon: "LogOut" },
              style: mkStyle({ width: "100%", height: 44 }),
              events: { onClick: [{ actionId: "wf-logout" }] },
            },
          ],
        }),
        comp({
          id:    "profile-tabbar",
          type:  "tabBar",
          props: {
            items: [
              { label: "Home", icon: "Home", route: "/dashboard" },
              { label: "Approval", icon: "CheckSquare", route: "/approval", roles: ["admin", "manager"] },
              { label: "History", icon: "Clock", route: "/history" },
              { label: "Profile", icon: "User", route: "/profile" },
            ],
            activeRoute: "/profile",
          },
          style: {},
        }),
      ],
    },
  ],

  // ── Global State ─────────────────────────────────────────────────────
  globalState: [
    { id: "gs-001", name: "currentUser",    scope: "global",    type: "object",  defaultValue: null },
    { id: "gs-002", name: "expenses",       scope: "global",    type: "object",  defaultValue: { recent: [], totalAmount: "$0.00", approvedTotal: "$0.00", history: [] } },
    { id: "gs-003", name: "pendingExpenses",scope: "global",    type: "array",   defaultValue: [] },
    { id: "gs-004", name: "selectedExpense",scope: "global",    type: "object",  defaultValue: null },
    { id: "gs-005", name: "categories",     scope: "global",    type: "array",   defaultValue: [] },
    { id: "gs-006", name: "isLoading",      scope: "global",    type: "boolean", defaultValue: false },
    { id: "gs-007", name: "authToken",      scope: "persisted", type: "string",  defaultValue: "" },
    { id: "gs-008", name: "expenseForm",    scope: "global",    type: "object",  defaultValue: { title: "", amount: "", categoryId: "", date: "", description: "" } },
    { id: "gs-009", name: "loginError",     scope: "global",    type: "string",  defaultValue: "" },
  ],

  // ── Global Actions ────────────────────────────────────────────────────
  globalActions: [
    { id: "act-login",                   name: "Login",                    type: "api",      config: { method: "POST", endpoint: "/api/auth/login" } },
    { id: "act-sign-out",                name: "Sign Out",                 type: "api",      config: { method: "POST", endpoint: "/api/auth/logout" } },
    { id: "act-fetch-expenses",          name: "Fetch Expenses",           type: "api",      config: { method: "GET",  endpoint: "/api/expenses" } },
    { id: "act-fetch-pending",           name: "Fetch Pending Expenses",   type: "api",      config: { method: "GET",  endpoint: "/api/expenses?status=pending" } },
    { id: "act-fetch-categories",        name: "Fetch Categories",         type: "api",      config: { method: "GET",  endpoint: "/api/expense_categories?is_active=true" } },
    { id: "act-fetch-expense-by-id",     name: "Fetch Expense Detail",     type: "api",      config: { method: "GET",  endpoint: "/api/expenses/:id" } },
    { id: "act-fetch-history",           name: "Fetch Expense History",    type: "api",      config: { method: "GET",  endpoint: "/api/expenses?status=approved,rejected" } },
    { id: "act-submit-expense",          name: "Submit Expense",           type: "api",      config: { method: "POST", endpoint: "/api/expenses" } },
    { id: "act-approve-expense",         name: "Approve Expense",          type: "api",      config: { method: "PATCH", endpoint: "/api/expenses/$global.selectedExpense.id/approve" } },
    { id: "act-reject-expense",          name: "Reject Expense",           type: "api",      config: { method: "PATCH", endpoint: "/api/expenses/$global.selectedExpense.id/reject" } },
    { id: "act-bulk-approve",            name: "Bulk Approve",             type: "api",      config: { method: "POST", endpoint: "/api/expenses/bulk-approve" } },
    { id: "act-export-history",          name: "Export History",           type: "api",      config: { method: "GET",  endpoint: "/api/expenses/export" } },
    { id: "act-navigate-dashboard",      name: "Navigate to Dashboard",    type: "navigate", config: { route: "/dashboard" } },
    { id: "act-navigate-submit",         name: "Navigate to Submit",       type: "navigate", config: { route: "/submit" } },
    { id: "act-navigate-approval",       name: "Navigate to Approval",     type: "navigate", config: { route: "/approval" } },
    { id: "act-navigate-expense-detail", name: "Navigate to Expense Detail", type: "navigate", config: { route: "/expense/:id" } },
  ],

  // ── Workflows ─────────────────────────────────────────────────────────
  workflows: [
    // ── Login Flow ────────────────────────────────────────────────────────
    {
      id:   "wf-login",
      name: "Login Flow",
      nodes: [
        { id: "wf-login-trigger", type: "trigger",  label: "Login button click",      config: { event: "onClick", componentId: "login-btn" }, position: { x: 100, y: 20 } },
        { id: "wf-login-n1",      type: "api",       label: "POST /api/auth/login",    config: { method: "POST", endpoint: "/api/auth/login" }, position: { x: 100, y: 140 } },
        { id: "wf-login-n2",      type: "navigate",  label: "Navigate to Dashboard",   config: { route: "/dashboard" }, position: { x: 100, y: 260 } },
        { id: "wf-login-n3",      type: "setState",  label: "Show error message",      config: { key: "loginError", value: "Invalid email or password" }, position: { x: 320, y: 260 } },
      ],
      edges: [
        { id: "wf-login-e0", from: "wf-login-trigger", to: "wf-login-n1" },
        { id: "wf-login-e1", from: "wf-login-n1", to: "wf-login-n2", condition: "success", label: "Login success" },
        { id: "wf-login-e2", from: "wf-login-n1", to: "wf-login-n3", condition: "error",   label: "Login failed" },
      ],
    },

    // ── Load Dashboard Data ───────────────────────────────────────────────
    {
      id:   "wf-load-dashboard",
      name: "Load Dashboard Data",
      nodes: [
        { id: "wf-dash-trigger", type: "trigger", label: "Dashboard mounted",  config: { event: "onMount", screenId: "a1b2c3d4-0002-4000-8000-000000000001" }, position: { x: 100, y: 20 } },
        { id: "wf-dash-n1",      type: "api",     label: "Fetch expenses",      config: { method: "GET", endpoint: "/api/expenses" }, position: { x: 100, y: 140 } },
        { id: "wf-dash-n2",      type: "api",     label: "Fetch pending",       config: { method: "GET", endpoint: "/api/expenses?status=pending" }, position: { x: 320, y: 140 } },
        { id: "wf-dash-n3",      type: "api",     label: "Fetch categories",    config: { method: "GET", endpoint: "/api/expense_categories?is_active=true" }, position: { x: 540, y: 140 } },
      ],
      edges: [
        { id: "wf-dash-e0", from: "wf-dash-trigger", to: "wf-dash-n1" },
        { id: "wf-dash-e1", from: "wf-dash-n1",      to: "wf-dash-n2" },
        { id: "wf-dash-e2", from: "wf-dash-n2",      to: "wf-dash-n3" },
      ],
    },

    // ── Submit Expense ────────────────────────────────────────────────────
    {
      id:   "wf-submit-expense",
      name: "Submit Expense Flow",
      nodes: [
        { id: "wf-sub-trigger", type: "trigger",   label: "Submit button click", config: { event: "onClick", componentId: "submit-btn" }, position: { x: 100, y: 20 } },
        { id: "wf-sub-n1",      type: "condition", label: "Validate form",       config: { expression: "$global.expenseForm.title != '' && $global.expenseForm.amount != ''" }, position: { x: 100, y: 140 } },
        { id: "wf-sub-n2",      type: "api",       label: "POST /api/expenses",  config: { method: "POST", endpoint: "/api/expenses" }, position: { x: 100, y: 260 } },
        { id: "wf-sub-n3",      type: "navigate",  label: "Back to dashboard",   config: { route: "/dashboard" }, position: { x: 100, y: 380 } },
        { id: "wf-sub-n4",      type: "toast",     label: "Show validation error", config: { toastType: "error", message: "Please fill all required fields" }, position: { x: 320, y: 260 } },
      ],
      edges: [
        { id: "wf-sub-e0", from: "wf-sub-trigger", to: "wf-sub-n1" },
        { id: "wf-sub-e1", from: "wf-sub-n1",      to: "wf-sub-n2", condition: "true",    label: "Form valid" },
        { id: "wf-sub-e2", from: "wf-sub-n1",      to: "wf-sub-n4", condition: "false",   label: "Form invalid" },
        { id: "wf-sub-e3", from: "wf-sub-n2",      to: "wf-sub-n3", condition: "success", label: "Submitted" },
      ],
    },

    // ── Approve Expense ───────────────────────────────────────────────────
    {
      id:   "wf-approve-expense",
      name: "Approve Expense Flow",
      nodes: [
        { id: "wf-apr-trigger", type: "trigger",  label: "Approve button click",             config: { event: "onClick", componentId: "approve-btn" }, position: { x: 100, y: 20 } },
        { id: "wf-apr-n1",      type: "api",      label: "PATCH .../approve",                config: { method: "PATCH", endpoint: "/api/expenses/$global.selectedExpense.id/approve" }, position: { x: 100, y: 140 } },
        { id: "wf-apr-n2",      type: "navigate", label: "Back to approval queue",           config: { route: "/approval" }, position: { x: 100, y: 260 } },
      ],
      edges: [
        { id: "wf-apr-e0", from: "wf-apr-trigger", to: "wf-apr-n1" },
        { id: "wf-apr-e1", from: "wf-apr-n1",      to: "wf-apr-n2", condition: "success", label: "Approved" },
      ],
    },

    // ── Reject Expense ────────────────────────────────────────────────────
    {
      id:   "wf-reject-expense",
      name: "Reject Expense Flow",
      nodes: [
        { id: "wf-rej-trigger", type: "trigger",  label: "Reject button click",   config: { event: "onClick", componentId: "reject-btn" }, position: { x: 100, y: 20 } },
        { id: "wf-rej-n1",      type: "api",      label: "PATCH .../reject",      config: { method: "PATCH", endpoint: "/api/expenses/$global.selectedExpense.id/reject" }, position: { x: 100, y: 140 } },
        { id: "wf-rej-n2",      type: "navigate", label: "Back to approval queue",config: { route: "/approval" }, position: { x: 100, y: 260 } },
      ],
      edges: [
        { id: "wf-rej-e0", from: "wf-rej-trigger", to: "wf-rej-n1" },
        { id: "wf-rej-e1", from: "wf-rej-n1",      to: "wf-rej-n2", condition: "success", label: "Rejected" },
      ],
    },

    // ── Logout Flow ───────────────────────────────────────────────────────
    {
      id:   "wf-logout",
      name: "Logout Flow",
      nodes: [
        { id: "wf-out-trigger", type: "trigger",  label: "Sign Out button click", config: { event: "onClick", componentId: "signout-btn" }, position: { x: 100, y: 20 } },
        { id: "wf-out-n1",      type: "api",      label: "POST /api/auth/logout", config: { method: "POST", endpoint: "/api/auth/logout" }, position: { x: 100, y: 140 } },
        { id: "wf-out-n2",      type: "navigate", label: "Navigate to /login",   config: { route: "/login" }, position: { x: 100, y: 260 } },
      ],
      edges: [
        { id: "wf-out-e0", from: "wf-out-trigger", to: "wf-out-n1" },
        { id: "wf-out-e1", from: "wf-out-n1",      to: "wf-out-n2", label: "Signed out" },
      ],
    },
  ],

  // ── Navigation ────────────────────────────────────────────────────────
  navigation: {
    type:         "stack",
    initialRoute: "/login",
    routes: [
      { id: "route-login",           route: "/login",        screenId: "a1b2c3d4-0001-4000-8000-000000000001", auth: false, roles: [] },
      { id: "route-dashboard",       route: "/dashboard",    screenId: "a1b2c3d4-0002-4000-8000-000000000001", auth: true,  roles: ["admin", "manager", "user"] },
      { id: "route-submit",          route: "/submit",       screenId: "a1b2c3d4-0003-4000-8000-000000000001", auth: true,  roles: ["admin", "manager", "user"] },
      { id: "route-expense-detail",  route: "/expense/:id",  screenId: "a1b2c3d4-0004-4000-8000-000000000001", auth: true,  roles: ["admin", "manager", "user"] },
      { id: "route-approval",        route: "/approval",     screenId: "a1b2c3d4-0005-4000-8000-000000000001", auth: true,  roles: ["admin", "manager"] },
      { id: "route-history",         route: "/history",      screenId: "a1b2c3d4-0006-4000-8000-000000000001", auth: true,  roles: ["admin", "manager", "user"] },
      { id: "route-profile",         route: "/profile",      screenId: "a1b2c3d4-0007-4000-8000-000000000001", auth: true,  roles: ["admin", "manager", "user"] },
    ],
  },

  // ── Auth ──────────────────────────────────────────────────────────────
  auth: {
    providers: [
      {
        type:    "email",
        enabled: true,
        config: {
          loginEndpoint:   "/api/auth/login",
          logoutEndpoint:  "/api/auth/logout",
          refreshEndpoint: "/api/auth/refresh",
        },
      },
    ],
    sessionType:    "jwt",
    tokenExpiry:    86400,
    refreshEnabled: true,
    rbac: {
      roles:       ["admin", "manager", "user"],
      defaultRole: "user",
    },
    mfa: {
      enabled: false,
      methods: [],
    },
  },

  // ── Database ──────────────────────────────────────────────────────────
  database: {
    provider: "mint",
    tables: [
      {
        id:         "tbl-expenses",
        name:       "expenses",
        timestamps: true,
        fields: [
          { name: "id",           type: "uuid",      required: true,  unique: true,  default: "gen_random_uuid()" },
          { name: "title",        type: "text",      required: true,  unique: false },
          { name: "amount",       type: "float",     required: true,  unique: false },
          { name: "category_id",  type: "uuid",      required: true,  unique: false },
          { name: "description",  type: "text",      required: false, unique: false },
          { name: "receipt_url",  type: "text",      required: false, unique: false },
          { name: "status",       type: "enum",      required: true,  unique: false, enumValues: ["pending", "approved", "rejected"], default: "pending" },
          { name: "submitter_id", type: "uuid",      required: true,  unique: false },
          { name: "reviewer_id",  type: "uuid",      required: false, unique: false },
          { name: "submitted_at", type: "timestamp", required: true,  unique: false },
          { name: "reviewed_at",  type: "timestamp", required: false, unique: false },
        ],
        relations: [
          { type: "many-to-one", targetTable: "expense_categories", foreignKey: "category_id", onDelete: "restrict" },
          { type: "many-to-one", targetTable: "users",              foreignKey: "submitter_id", targetKey: "id", onDelete: "restrict" },
          { type: "many-to-one", targetTable: "users",              foreignKey: "reviewer_id",  targetKey: "id", onDelete: "set-null" },
        ],
        indexes: [
          { name: "idx_expenses_submitter",   fields: ["submitter_id"], unique: false },
          { name: "idx_expenses_status",      fields: ["status"],       unique: false },
          { name: "idx_expenses_category",    fields: ["category_id"],  unique: false },
          { name: "idx_expenses_submitted_at",fields: ["submitted_at"], unique: false },
        ],
        policies: [],
      },
      {
        id:   "tbl-expense-categories",
        name: "expense_categories",
        fields: [
          { name: "id",          type: "uuid",    required: true,  unique: true,  default: "gen_random_uuid()" },
          { name: "name",        type: "text",    required: true,  unique: true },
          { name: "code",        type: "text",    required: true,  unique: true },
          { name: "description", type: "text",    required: false, unique: false },
          { name: "is_active",   type: "boolean", required: true,  unique: false, default: true },
          { name: "created_at",  type: "timestamp", required: true, unique: false },
        ],
        relations: [],
        indexes: [
          { name: "idx_expense_categories_active", fields: ["is_active"], unique: false },
        ],
        policies: [],
      },
      {
        id:   "tbl-expense-comments",
        name: "expense_comments",
        fields: [
          { name: "id",          type: "uuid",      required: true,  unique: true,  default: "gen_random_uuid()" },
          { name: "expense_id",  type: "uuid",      required: true,  unique: false },
          { name: "author_id",   type: "uuid",      required: true,  unique: false },
          { name: "content",     type: "text",      required: true,  unique: false },
          { name: "created_at",  type: "timestamp", required: true,  unique: false },
        ],
        relations: [
          { type: "many-to-one", targetTable: "expenses", foreignKey: "expense_id", onDelete: "cascade" },
          { type: "many-to-one", targetTable: "users",    foreignKey: "author_id",  onDelete: "restrict" },
        ],
        indexes: [
          { name: "idx_expense_comments_expense", fields: ["expense_id"], unique: false },
          { name: "idx_expense_comments_author",  fields: ["author_id"],  unique: false },
        ],
        policies: [],
      },
      {
        id:   "tbl-expense-history",
        name: "expense_history",
        fields: [
          { name: "id",          type: "uuid",      required: true,  unique: true,  default: "gen_random_uuid()" },
          { name: "expense_id",  type: "uuid",      required: true,  unique: false },
          { name: "action",      type: "text",      required: true,  unique: false },
          { name: "from_status", type: "text",      required: false, unique: false },
          { name: "to_status",   type: "text",      required: true,  unique: false },
          { name: "actor_id",    type: "uuid",      required: true,  unique: false },
          { name: "notes",       type: "text",      required: false, unique: false },
          { name: "created_at",  type: "timestamp", required: true,  unique: false },
        ],
        relations: [
          { type: "many-to-one", targetTable: "expenses", foreignKey: "expense_id", onDelete: "cascade" },
          { type: "many-to-one", targetTable: "users",    foreignKey: "actor_id",   onDelete: "restrict" },
        ],
        indexes: [
          { name: "idx_expense_history_expense",    fields: ["expense_id"], unique: false },
          { name: "idx_expense_history_actor",      fields: ["actor_id"],   unique: false },
          { name: "idx_expense_history_created_at", fields: ["created_at"], unique: false },
        ],
        policies: [],
      },
    ],
  },
};

// ─── DDL for runtime_schemas ───────────────────────────────────────────
const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS runtime_schemas (
    project_id  UUID        PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    schema_json JSONB       NOT NULL,
    updated_by  UUID        REFERENCES users(id),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

// ─── Upsert SQL ────────────────────────────────────────────────────────
const UPSERT_SQL = `
  INSERT INTO runtime_schemas (project_id, schema_json, updated_by)
  VALUES ($1, $2::jsonb, $3)
  ON CONFLICT (project_id)
  DO UPDATE SET
    schema_json = EXCLUDED.schema_json,
    updated_at  = now(),
    updated_by  = EXCLUDED.updated_by
`;

// ─── Main ──────────────────────────────────────────────────────────────
async function main() {
  console.log("Connecting to database…");
  await client.connect();
  console.log("Connected.");

  try {
    console.log("Ensuring runtime_schemas table exists…");
    await client.query(CREATE_TABLE_SQL);
    console.log("Table ready.");

    console.log(`Seeding schema for project ${PROJECT_ID}…`);
    await client.query(UPSERT_SQL, [PROJECT_ID, JSON.stringify(schema), null]);
    console.log("Schema seeded successfully.");
    console.log("");
    console.log("Done. Open the project studio to verify:");
    console.log(`  https://<your-host>/projects/${PROJECT_ID}/studio`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
