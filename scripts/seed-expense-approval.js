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
 *   # or: yarn add pg
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

// ─── AppSchema ─────────────────────────────────────────────────────────────
const PROJECT_ID = "40780692-dd76-4e25-9fbb-ea194dba9619";

const schema = {
  id: PROJECT_ID,
  name: "Expense Approval",
  version: "1.0.0",
  schemaVersion: 1,

  theme: {
    primary: "#4F46E5",
    secondary: "#7C3AED",
    background: "#F9FAFB",
    surface: "#FFFFFF",
    text: "#111827",
    textSecondary: "#6B7280",
    border: "#E5E7EB",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444",
  },

  meta: {
    themeOverrides: {
      "--color-primary": "#4F46E5",
      "--color-secondary": "#7C3AED",
      "--color-background": "#F9FAFB",
      "--color-surface": "#FFFFFF",
      "--color-text": "#111827",
      "--color-text-secondary": "#6B7280",
      "--color-border": "#E5E7EB",
      "--color-success": "#10B981",
      "--color-warning": "#F59E0B",
      "--color-danger": "#EF4444",
    },
    platform: "mobile",
    description: "Enterprise expense submission and approval workflow app",
  },

  // ── Screens ───────────────────────────────────────────────────────────
  screens: [
    // ── Screen 1: Login ─────────────────────────────────────────────────
    {
      id: "a1b2c3d4-0001-4000-8000-000000000001",
      name: "LoginScreen",
      path: "/login",
      description: "Authentication screen for user sign-in",
      meta: { auth: false, roles: [] },
      components: [
        {
          id: "login-container",
          type: "container",
          name: "loginContainer",
          label: "Login Container",
          props: { direction: "column", align: "center", justify: "center" },
          style: { flex: 1, padding: 32, backgroundColor: "#F9FAFB" },
          children: [
            {
              id: "login-logo",
              type: "image",
              name: "loginLogo",
              label: "Expense Approval Logo",
              props: { source: "/logo.png", alt: "Expense Tracker" },
              style: { width: 80, height: 80, marginBottom: 24 },
            },
            {
              id: "login-heading",
              type: "heading",
              name: "loginHeading",
              label: "Sign in to Expense Tracker",
              props: { text: "Sign in to Expense Tracker", level: 1 },
              style: { fontSize: 24, fontWeight: "700", color: "#111827", marginBottom: 8, textAlign: "center" },
            },
            {
              id: "login-subtext",
              type: "text",
              name: "loginSubtext",
              label: "Track and approve company expenses",
              props: { text: "Track and approve company expenses" },
              style: { fontSize: 14, color: "#6B7280", marginBottom: 32, textAlign: "center" },
            },
            {
              id: "login-email",
              type: "input",
              name: "loginEmail",
              label: "Email Address",
              props: {
                placeholder: "you@company.com",
                keyboardType: "email-address",
                autoCapitalize: "none",
                stateKey: "$local.loginForm.email",
              },
              style: { width: "100%", marginBottom: 16 },
            },
            {
              id: "login-password",
              type: "input",
              name: "loginPassword",
              label: "Password",
              props: {
                placeholder: "Enter your password",
                secureTextEntry: true,
                stateKey: "$local.loginForm.password",
              },
              style: { width: "100%", marginBottom: 24 },
            },
            {
              id: "login-btn",
              type: "button",
              name: "loginButton",
              label: "Sign In",
              props: { text: "Sign In", variant: "primary" },
              style: { width: "100%", height: 48 },
              events: {
                onPress: ["wf-login"],
              },
            },
            {
              id: "login-error",
              type: "text",
              name: "loginError",
              label: "Invalid email or password",
              props: {
                text: "$global.loginError",
                visible: "$global.loginError != ''",
              },
              style: { color: "#EF4444", fontSize: 13, marginTop: 12, textAlign: "center" },
            },
          ],
        },
      ],
      actions: [],
    },

    // ── Screen 2: Dashboard ──────────────────────────────────────────────
    {
      id: "a1b2c3d4-0002-4000-8000-000000000001",
      name: "DashboardScreen",
      path: "/dashboard",
      description: "Main dashboard showing expense summary and recent submissions",
      meta: { auth: true, roles: ["admin", "manager", "user"] },
      components: [
        {
          id: "dash-navbar",
          type: "navigationBar",
          name: "dashNavBar",
          label: "Expense Tracker",
          props: { title: "Expense Tracker", showBack: false },
          style: { backgroundColor: "#4F46E5" },
        },
        {
          id: "dash-scroll",
          type: "container",
          name: "dashScroll",
          label: "Dashboard Content",
          props: { scrollable: true, direction: "column" },
          style: { flex: 1, padding: 16, backgroundColor: "#F9FAFB" },
          children: [
            {
              id: "dash-welcome",
              type: "text",
              name: "dashWelcome",
              label: "Welcome back, $currentUser.name",
              props: { text: "Welcome back, $global.currentUser.name!" },
              style: { fontSize: 18, fontWeight: "600", color: "#111827", marginBottom: 16 },
            },
            {
              id: "dash-summary-card",
              type: "card",
              name: "dashSummaryCard",
              label: "Expense Summary Card",
              props: {},
              style: { padding: 16, borderRadius: 12, backgroundColor: "#FFFFFF", marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8 },
              children: [
                {
                  id: "dash-summary-row",
                  type: "container",
                  name: "dashSummaryRow",
                  label: "Summary Row",
                  props: { direction: "row", justify: "space-between" },
                  style: {},
                  children: [
                    {
                      id: "dash-total-col",
                      type: "container",
                      name: "dashTotalCol",
                      label: "Total Column",
                      props: { direction: "column", align: "center" },
                      style: { flex: 1 },
                      children: [
                        {
                          id: "dash-total-label",
                          type: "text",
                          name: "dashTotalLabel",
                          label: "Total Expenses",
                          props: { text: "Total Expenses" },
                          style: { fontSize: 12, color: "#6B7280", marginBottom: 4 },
                        },
                        {
                          id: "dash-total-amount",
                          type: "text",
                          name: "dashTotalAmount",
                          label: "$expenses.totalAmount",
                          props: { text: "$global.expenses.totalAmount" },
                          style: { fontSize: 22, fontWeight: "700", color: "#4F46E5" },
                        },
                      ],
                    },
                    {
                      id: "dash-pending-col",
                      type: "container",
                      name: "dashPendingCol",
                      label: "Pending Column",
                      props: { direction: "column", align: "center" },
                      style: { flex: 1 },
                      children: [
                        {
                          id: "dash-pending-label",
                          type: "text",
                          name: "dashPendingLabel",
                          label: "Pending Approval",
                          props: { text: "Pending Approval" },
                          style: { fontSize: 12, color: "#6B7280", marginBottom: 4 },
                        },
                        {
                          id: "dash-pending-count",
                          type: "badge",
                          name: "dashPendingCount",
                          label: "$pendingExpenses.length pending",
                          props: {
                            text: "$global.pendingExpenses.length",
                            variant: "warning",
                          },
                          style: { fontSize: 22, fontWeight: "700" },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              id: "dash-actions-row",
              type: "container",
              name: "dashActionsRow",
              label: "Action Buttons Row",
              props: { direction: "row", gap: 12 },
              style: { marginBottom: 20 },
              children: [
                {
                  id: "dash-submit-btn",
                  type: "button",
                  name: "dashSubmitButton",
                  label: "Submit New Expense",
                  props: { text: "Submit New Expense", variant: "primary", icon: "Plus" },
                  style: { flex: 1, height: 44 },
                  events: {
                    onPress: ["act-navigate-submit"],
                  },
                },
                {
                  id: "signout-btn",
                  type: "button",
                  name: "signOutButton",
                  label: "Sign Out",
                  props: { text: "Sign Out", variant: "outline", icon: "LogOut" },
                  style: { height: 44, paddingHorizontal: 16 },
                  events: {
                    onPress: ["wf-logout"],
                  },
                },
              ],
            },
            {
              id: "dash-recent-heading",
              type: "heading",
              name: "dashRecentHeading",
              label: "Recent Expenses",
              props: { text: "Recent Expenses", level: 3 },
              style: { fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 12 },
            },
            {
              id: "dash-recent-list",
              type: "list",
              name: "dashRecentList",
              label: "Recent Expenses List",
              props: {
                data: "$global.expenses.recent",
                keyExtractor: "item.id",
                renderItem: {
                  type: "listItem",
                  props: {
                    title: "item.title",
                    subtitle: "item.category",
                    trailing: "item.amount",
                    badge: "item.status",
                  },
                  events: { onPress: [{ actionId: "act-navigate-expense-detail", params: { id: "item.id" } }] },
                },
              },
              style: {},
            },
          ],
        },
        {
          id: "dash-tabbar",
          type: "tabBar",
          name: "dashTabBar",
          label: "Bottom Navigation Tab Bar",
          props: {
            items: [
              { label: "Home", icon: "Home", route: "/dashboard" },
              { label: "Approval", icon: "CheckSquare", route: "/approval", roles: ["admin", "manager"] },
              { label: "History", icon: "Clock", route: "/history" },
              { label: "Profile", icon: "User", route: "/profile" },
            ],
            activeRoute: "/dashboard",
          },
          style: {},
        },
      ],
      actions: ["wf-load-dashboard"],
    },

    // ── Screen 3: Submit Expense ─────────────────────────────────────────
    {
      id: "a1b2c3d4-0003-4000-8000-000000000001",
      name: "SubmitExpenseScreen",
      path: "/submit",
      description: "Form screen for submitting a new expense",
      meta: { auth: true, roles: ["admin", "manager", "user"] },
      components: [
        {
          id: "submit-navbar",
          type: "navigationBar",
          name: "submitNavBar",
          label: "Submit Expense",
          props: { title: "Submit Expense", showBack: true, backRoute: "/dashboard" },
          style: { backgroundColor: "#4F46E5" },
        },
        {
          id: "submit-scroll",
          type: "container",
          name: "submitScroll",
          label: "Submit Form Content",
          props: { scrollable: true, direction: "column" },
          style: { flex: 1, padding: 16, backgroundColor: "#F9FAFB" },
          children: [
            {
              id: "submit-title-input",
              type: "input",
              name: "expenseTitleInput",
              label: "Expense Title",
              props: {
                label: "Expense Title",
                placeholder: "e.g. Team lunch, Office supplies",
                stateKey: "$global.expenseForm.title",
              },
              style: { marginBottom: 16 },
            },
            {
              id: "submit-amount-input",
              type: "input",
              name: "expenseAmountInput",
              label: "Amount ($)",
              props: {
                label: "Amount ($)",
                placeholder: "0.00",
                keyboardType: "decimal-pad",
                stateKey: "$global.expenseForm.amount",
              },
              style: { marginBottom: 16 },
            },
            {
              id: "submit-category-select",
              type: "select",
              name: "expenseCategorySelect",
              label: "Category",
              props: {
                label: "Category",
                placeholder: "Select a category",
                options: "$global.categories",
                optionLabel: "name",
                optionValue: "id",
                stateKey: "$global.expenseForm.categoryId",
              },
              style: { marginBottom: 16 },
            },
            {
              id: "submit-date-picker",
              type: "input",
              name: "expenseDatePicker",
              label: "Expense Date",
              props: {
                label: "Expense Date",
                type: "date",
                stateKey: "$global.expenseForm.date",
              },
              style: { marginBottom: 16 },
            },
            {
              id: "submit-description-textarea",
              type: "textarea",
              name: "expenseDescriptionTextarea",
              label: "Description (optional)",
              props: {
                label: "Description",
                placeholder: "Provide context for your expense...",
                rows: 4,
                stateKey: "$global.expenseForm.description",
              },
              style: { marginBottom: 24 },
            },
            {
              id: "submit-btn",
              type: "button",
              name: "submitExpenseButton",
              label: "Submit Expense",
              props: {
                text: "Submit Expense",
                variant: "primary",
                loading: "$global.isLoading",
              },
              style: { width: "100%", height: 48, marginBottom: 16 },
              events: {
                onPress: ["wf-submit-expense"],
              },
            },
          ],
        },
      ],
      actions: [],
    },

    // ── Screen 4: Expense Details ────────────────────────────────────────
    {
      id: "a1b2c3d4-0004-4000-8000-000000000001",
      name: "ExpenseDetailScreen",
      path: "/expense/:id",
      description: "Detailed view of a single expense with approval actions",
      meta: { auth: true, roles: ["admin", "manager", "user"], params: ["id"] },
      components: [
        {
          id: "detail-navbar",
          type: "navigationBar",
          name: "detailNavBar",
          label: "Expense Details",
          props: { title: "Expense Details", showBack: true, backRoute: "/dashboard" },
          style: { backgroundColor: "#4F46E5" },
        },
        {
          id: "detail-scroll",
          type: "container",
          name: "detailScroll",
          label: "Detail Content",
          props: { scrollable: true, direction: "column" },
          style: { flex: 1, padding: 16, backgroundColor: "#F9FAFB" },
          children: [
            {
              id: "detail-header-card",
              type: "card",
              name: "detailHeaderCard",
              label: "Expense Header Card",
              props: {},
              style: { padding: 16, borderRadius: 12, backgroundColor: "#FFFFFF", marginBottom: 16 },
              children: [
                {
                  id: "detail-title",
                  type: "heading",
                  name: "detailTitle",
                  label: "Expense Title",
                  props: { text: "$global.selectedExpense.title", level: 2 },
                  style: { fontSize: 20, fontWeight: "700", color: "#111827", marginBottom: 4 },
                },
                {
                  id: "detail-amount",
                  type: "text",
                  name: "detailAmount",
                  label: "Expense Amount",
                  props: { text: "$global.selectedExpense.amount" },
                  style: { fontSize: 28, fontWeight: "700", color: "#4F46E5", marginBottom: 8 },
                },
                {
                  id: "detail-status-badge",
                  type: "badge",
                  name: "detailStatusBadge",
                  label: "Expense Status",
                  props: {
                    text: "$global.selectedExpense.status",
                    variant: "$global.selectedExpense.statusVariant",
                  },
                  style: { alignSelf: "flex-start" },
                },
              ],
            },
            {
              id: "detail-info-card",
              type: "card",
              name: "detailInfoCard",
              label: "Expense Info Card",
              props: {},
              style: { padding: 16, borderRadius: 12, backgroundColor: "#FFFFFF", marginBottom: 16 },
              children: [
                {
                  id: "detail-category",
                  type: "text",
                  name: "detailCategory",
                  label: "Category: $selectedExpense.category",
                  props: { text: "Category: $global.selectedExpense.category" },
                  style: { fontSize: 14, color: "#6B7280", marginBottom: 8 },
                },
                {
                  id: "detail-date",
                  type: "text",
                  name: "detailDate",
                  label: "Date: $selectedExpense.date",
                  props: { text: "Date: $global.selectedExpense.date" },
                  style: { fontSize: 14, color: "#6B7280", marginBottom: 8 },
                },
                {
                  id: "detail-submitter",
                  type: "text",
                  name: "detailSubmitter",
                  label: "Submitted by: $selectedExpense.submitterName",
                  props: { text: "Submitted by: $global.selectedExpense.submitterName" },
                  style: { fontSize: 14, color: "#6B7280", marginBottom: 8 },
                },
                {
                  id: "detail-description",
                  type: "text",
                  name: "detailDescription",
                  label: "Description: $selectedExpense.description",
                  props: { text: "$global.selectedExpense.description" },
                  style: { fontSize: 14, color: "#374151", marginTop: 8 },
                },
              ],
            },
            {
              id: "detail-approval-row",
              type: "container",
              name: "detailApprovalRow",
              label: "Approve / Reject Actions",
              props: {
                direction: "row",
                gap: 12,
                visible: "$global.selectedExpense.status == 'pending' && ($global.currentUser.role == 'admin' || $global.currentUser.role == 'manager')",
              },
              style: { marginBottom: 16 },
              children: [
                {
                  id: "approve-btn",
                  type: "button",
                  name: "approveButton",
                  label: "Approve",
                  props: { text: "Approve", variant: "success", icon: "Check" },
                  style: { flex: 1, height: 48 },
                  events: {
                    onPress: ["wf-approve-expense"],
                  },
                },
                {
                  id: "reject-btn",
                  type: "button",
                  name: "rejectButton",
                  label: "Reject",
                  props: { text: "Reject", variant: "danger", icon: "X" },
                  style: { flex: 1, height: 48 },
                  events: {
                    onPress: ["wf-reject-expense"],
                  },
                },
              ],
            },
            {
              id: "detail-comments-heading",
              type: "heading",
              name: "detailCommentsHeading",
              label: "Comments",
              props: { text: "Comments", level: 3 },
              style: { fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 12 },
            },
            {
              id: "detail-comments-list",
              type: "list",
              name: "detailCommentsList",
              label: "Expense Comments List",
              props: {
                data: "$global.selectedExpense.comments",
                keyExtractor: "item.id",
                renderItem: {
                  type: "listItem",
                  props: {
                    avatar: "item.authorAvatar",
                    title: "item.authorName",
                    subtitle: "item.content",
                    trailing: "item.createdAt",
                  },
                },
              },
              style: {},
            },
          ],
        },
      ],
      actions: [],
    },

    // ── Screen 5: Approval Queue ─────────────────────────────────────────
    {
      id: "a1b2c3d4-0005-4000-8000-000000000001",
      name: "ApprovalQueueScreen",
      path: "/approval",
      description: "Manager/admin view for reviewing and approving pending expenses",
      meta: { auth: true, roles: ["admin", "manager"] },
      components: [
        {
          id: "approval-navbar",
          type: "navigationBar",
          name: "approvalNavBar",
          label: "Approval Queue",
          props: { title: "Approval Queue", showBack: false },
          style: { backgroundColor: "#4F46E5" },
        },
        {
          id: "approval-content",
          type: "container",
          name: "approvalContent",
          label: "Approval Content",
          props: { direction: "column" },
          style: { flex: 1, padding: 16, backgroundColor: "#F9FAFB" },
          children: [
            {
              id: "approval-pending-count",
              type: "text",
              name: "approvalPendingCount",
              label: "$pendingExpenses.length expenses awaiting approval",
              props: { text: "$global.pendingExpenses.length expenses awaiting approval" },
              style: { fontSize: 14, color: "#6B7280", marginBottom: 12 },
            },
            {
              id: "approval-filter-tabs",
              type: "tab",
              name: "approvalFilterTabs",
              label: "Filter by Status",
              props: {
                tabs: [
                  { label: "All Pending", value: "pending" },
                  { label: "High Value", value: "high-value" },
                  { label: "Overdue", value: "overdue" },
                ],
                stateKey: "$local.approvalFilter",
              },
              style: { marginBottom: 12 },
            },
            {
              id: "bulk-approve-btn",
              type: "button",
              name: "bulkApproveButton",
              label: "Bulk Approve Selected",
              props: { text: "Bulk Approve Selected", variant: "primary", icon: "CheckSquare" },
              style: { width: "100%", height: 44, marginBottom: 12 },
              events: {
                onPress: ["act-bulk-approve"],
              },
            },
            {
              id: "approval-list",
              type: "list",
              name: "approvalList",
              label: "Pending Expenses List",
              props: {
                data: "$global.pendingExpenses",
                keyExtractor: "item.id",
                selectable: true,
                selectedKey: "$local.selectedExpenseIds",
                renderItem: {
                  type: "listItem",
                  props: {
                    title: "item.title",
                    subtitle: "item.submitterName + ' · ' + item.category",
                    trailing: "item.amount",
                    badge: "item.submittedAt",
                  },
                  events: { onPress: [{ actionId: "act-navigate-expense-detail", params: { id: "item.id" } }] },
                },
              },
              style: { flex: 1 },
            },
          ],
        },
        {
          id: "approval-tabbar",
          type: "tabBar",
          name: "approvalTabBar",
          label: "Bottom Navigation Tab Bar",
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
        },
      ],
      actions: ["act-fetch-pending"],
    },

    // ── Screen 6: Expense History ────────────────────────────────────────
    {
      id: "a1b2c3d4-0006-4000-8000-000000000001",
      name: "ExpenseHistoryScreen",
      path: "/history",
      description: "View past approved and rejected expenses with filtering",
      meta: { auth: true, roles: ["admin", "manager", "user"] },
      components: [
        {
          id: "history-navbar",
          type: "navigationBar",
          name: "historyNavBar",
          label: "Expense History",
          props: { title: "Expense History", showBack: false },
          style: { backgroundColor: "#4F46E5" },
        },
        {
          id: "history-content",
          type: "container",
          name: "historyContent",
          label: "History Content",
          props: { direction: "column" },
          style: { flex: 1, padding: 16, backgroundColor: "#F9FAFB" },
          children: [
            {
              id: "history-filters-row",
              type: "container",
              name: "historyFiltersRow",
              label: "Filter Row",
              props: { direction: "row", gap: 8 },
              style: { marginBottom: 12 },
              children: [
                {
                  id: "history-status-filter",
                  type: "select",
                  name: "historyStatusFilter",
                  label: "Filter by Status",
                  props: {
                    placeholder: "Status",
                    options: [
                      { label: "All", value: "" },
                      { label: "Approved", value: "approved" },
                      { label: "Rejected", value: "rejected" },
                    ],
                    stateKey: "$local.historyStatusFilter",
                  },
                  style: { flex: 1 },
                },
                {
                  id: "history-date-filter",
                  type: "select",
                  name: "historyDateFilter",
                  label: "Filter by Date Range",
                  props: {
                    placeholder: "Date Range",
                    options: [
                      { label: "All Time", value: "all" },
                      { label: "This Month", value: "month" },
                      { label: "This Quarter", value: "quarter" },
                      { label: "This Year", value: "year" },
                    ],
                    stateKey: "$local.historyDateFilter",
                  },
                  style: { flex: 1 },
                },
              ],
            },
            {
              id: "history-total-card",
              type: "card",
              name: "historyTotalCard",
              label: "Total Approved Expenses Card",
              props: {},
              style: { padding: 12, borderRadius: 10, backgroundColor: "#FFFFFF", marginBottom: 12 },
              children: [
                {
                  id: "history-total-label",
                  type: "text",
                  name: "historyTotalLabel",
                  label: "Total Approved Expenses",
                  props: { text: "Total Approved" },
                  style: { fontSize: 12, color: "#6B7280", marginBottom: 2 },
                },
                {
                  id: "history-total-value",
                  type: "text",
                  name: "historyTotalValue",
                  label: "$expenses.approvedTotal",
                  props: { text: "$global.expenses.approvedTotal" },
                  style: { fontSize: 20, fontWeight: "700", color: "#10B981" },
                },
              ],
            },
            {
              id: "history-export-btn",
              type: "button",
              name: "historyExportButton",
              label: "Export Report (CSV)",
              props: { text: "Export Report (CSV)", variant: "outline", icon: "Download" },
              style: { marginBottom: 12, height: 40 },
              events: {
                onPress: ["act-export-history"],
              },
            },
            {
              id: "history-list",
              type: "list",
              name: "historyList",
              label: "Expense History List",
              props: {
                data: "$global.expenses.history",
                keyExtractor: "item.id",
                renderItem: {
                  type: "listItem",
                  props: {
                    title: "item.title",
                    subtitle: "item.category + ' · ' + item.date",
                    trailing: "item.amount",
                    badge: "item.status",
                    badgeVariant: "item.statusVariant",
                  },
                  events: { onPress: [{ actionId: "act-navigate-expense-detail", params: { id: "item.id" } }] },
                },
              },
              style: { flex: 1 },
            },
          ],
        },
        {
          id: "history-tabbar",
          type: "tabBar",
          name: "historyTabBar",
          label: "Bottom Navigation Tab Bar",
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
        },
      ],
      actions: ["act-fetch-history"],
    },

    // ── Screen 7: Profile & Settings ─────────────────────────────────────
    {
      id: "a1b2c3d4-0007-4000-8000-000000000001",
      name: "ProfileScreen",
      path: "/profile",
      description: "User profile and application settings",
      meta: { auth: true, roles: ["admin", "manager", "user"] },
      components: [
        {
          id: "profile-navbar",
          type: "navigationBar",
          name: "profileNavBar",
          label: "Profile & Settings",
          props: { title: "Profile & Settings", showBack: false },
          style: { backgroundColor: "#4F46E5" },
        },
        {
          id: "profile-scroll",
          type: "container",
          name: "profileScroll",
          label: "Profile Content",
          props: { scrollable: true, direction: "column" },
          style: { flex: 1, padding: 16, backgroundColor: "#F9FAFB" },
          children: [
            {
              id: "profile-header",
              type: "container",
              name: "profileHeader",
              label: "Profile Header",
              props: { direction: "column", align: "center" },
              style: { padding: 24, backgroundColor: "#FFFFFF", borderRadius: 12, marginBottom: 16 },
              children: [
                {
                  id: "profile-avatar",
                  type: "avatar",
                  name: "profileAvatar",
                  label: "User Avatar",
                  props: {
                    source: "$global.currentUser.avatarUrl",
                    initials: "$global.currentUser.initials",
                    size: 80,
                  },
                  style: { marginBottom: 12 },
                },
                {
                  id: "profile-name",
                  type: "text",
                  name: "profileName",
                  label: "Full Name",
                  props: { text: "$global.currentUser.name" },
                  style: { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 4 },
                },
                {
                  id: "profile-email",
                  type: "text",
                  name: "profileEmail",
                  label: "Email Address",
                  props: { text: "$global.currentUser.email" },
                  style: { fontSize: 14, color: "#6B7280", marginBottom: 8 },
                },
                {
                  id: "profile-role-badge",
                  type: "badge",
                  name: "profileRoleBadge",
                  label: "User Role Badge",
                  props: { text: "$global.currentUser.role", variant: "primary" },
                  style: {},
                },
              ],
            },
            {
              id: "profile-settings-card",
              type: "card",
              name: "profileSettingsCard",
              label: "Settings Card",
              props: {},
              style: { padding: 16, borderRadius: 12, backgroundColor: "#FFFFFF", marginBottom: 16 },
              children: [
                {
                  id: "profile-notifications-row",
                  type: "container",
                  name: "profileNotificationsRow",
                  label: "Notification Setting Row",
                  props: { direction: "row", align: "center", justify: "space-between" },
                  style: { marginBottom: 16 },
                  children: [
                    {
                      id: "profile-notifications-label",
                      type: "text",
                      name: "profileNotificationsLabel",
                      label: "Email Notifications",
                      props: { text: "Email Notifications" },
                      style: { fontSize: 14, color: "#111827" },
                    },
                    {
                      id: "profile-notifications-switch",
                      type: "switch",
                      name: "profileNotificationsSwitch",
                      label: "Email Notifications Toggle",
                      props: { stateKey: "$global.currentUser.emailNotifications" },
                      style: {},
                    },
                  ],
                },
                {
                  id: "profile-currency-select",
                  type: "select",
                  name: "profileCurrencySelect",
                  label: "Currency Preference",
                  props: {
                    label: "Currency Preference",
                    options: [
                      { label: "USD — US Dollar", value: "USD" },
                      { label: "EUR — Euro", value: "EUR" },
                      { label: "GBP — British Pound", value: "GBP" },
                      { label: "INR — Indian Rupee", value: "INR" },
                    ],
                    stateKey: "$global.currentUser.currency",
                  },
                  style: {},
                },
              ],
            },
            {
              id: "profile-edit-btn",
              type: "button",
              name: "profileEditButton",
              label: "Edit Profile",
              props: { text: "Edit Profile", variant: "outline", icon: "Edit" },
              style: { width: "100%", height: 44, marginBottom: 12 },
            },
            {
              id: "profile-signout-btn",
              type: "button",
              name: "profileSignOutButton",
              label: "Sign Out",
              props: { text: "Sign Out", variant: "danger", icon: "LogOut" },
              style: { width: "100%", height: 44 },
              events: {
                onPress: ["wf-logout"],
              },
            },
          ],
        },
        {
          id: "profile-tabbar",
          type: "tabBar",
          name: "profileTabBar",
          label: "Bottom Navigation Tab Bar",
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
        },
      ],
      actions: [],
    },
  ],

  // ── Global State ─────────────────────────────────────────────────────
  globalState: [
    {
      id: "gs-001",
      name: "currentUser",
      type: "object",
      defaultValue: null,
      description: "Authenticated user object — id, name, email, role, avatarUrl, currency, emailNotifications",
      meta: { persistent: true, storeKey: "auth:currentUser" },
    },
    {
      id: "gs-002",
      name: "expenses",
      type: "object",
      defaultValue: { recent: [], totalAmount: "$0.00", approvedTotal: "$0.00", history: [] },
      description: "All expense data: recent list, history list, aggregated totals",
      meta: { derivedFrom: ["gs-004", "gs-003"], refreshOn: ["wf-submit-expense", "wf-approve-expense", "wf-reject-expense"] },
    },
    {
      id: "gs-003",
      name: "pendingExpenses",
      type: "array",
      defaultValue: [],
      description: "List of expenses with status=pending, used in approval queue",
      meta: { derivedFrom: ["gs-002"], filter: "status == 'pending'", refreshOn: ["wf-approve-expense", "wf-reject-expense"] },
    },
    {
      id: "gs-004",
      name: "selectedExpense",
      type: "object",
      defaultValue: null,
      description: "Currently selected expense for detail view — set when navigating to /expense/:id",
      meta: { setBy: ["act-fetch-expense-by-id"] },
    },
    {
      id: "gs-005",
      name: "categories",
      type: "array",
      defaultValue: [],
      description: "Expense categories loaded from database — used in submit form select",
      meta: { refreshOn: ["wf-load-dashboard"] },
    },
    {
      id: "gs-006",
      name: "isLoading",
      type: "boolean",
      defaultValue: false,
      description: "Global loading flag — true while any async action is in flight",
      meta: { setBy: ["all-api-actions"] },
    },
    {
      id: "gs-007",
      name: "authToken",
      type: "string",
      defaultValue: "",
      description: "JWT auth token stored after login — sent as Bearer header on API calls",
      meta: { persistent: true, storeKey: "auth:token", sensitive: true },
    },
    {
      id: "gs-008",
      name: "expenseForm",
      type: "object",
      defaultValue: { title: "", amount: "", categoryId: "", date: "", description: "" },
      description: "Controlled form state for submit expense screen — reset after successful submit",
      meta: { resetOn: ["wf-submit-expense:success"] },
    },
  ],

  // ── Global Actions ────────────────────────────────────────────────────
  globalActions: [
    {
      id: "act-login",
      name: "Login",
      type: "api",
      description: "Authenticate user with email and password",
      params: { method: "POST", url: "/api/auth/login", body: "{ email: $local.loginForm.email, password: $local.loginForm.password }", saveResultTo: "gs-007:token, gs-001:user" },
    },
    {
      id: "act-sign-out",
      name: "Sign Out",
      type: "api",
      description: "Invalidate the current session and clear auth state",
      params: { method: "POST", url: "/api/auth/logout", clearState: ["gs-001", "gs-007"] },
    },
    {
      id: "act-fetch-expenses",
      name: "Fetch Expenses",
      type: "api",
      description: "Load all expenses for the current user (or all if admin/manager)",
      params: { method: "GET", url: "/api/expenses", saveResultTo: "gs-002:recent" },
    },
    {
      id: "act-fetch-pending",
      name: "Fetch Pending Expenses",
      type: "api",
      description: "Load all expenses with status=pending for the approval queue",
      params: { method: "GET", url: "/api/expenses?status=pending", saveResultTo: "gs-003" },
    },
    {
      id: "act-fetch-categories",
      name: "Fetch Categories",
      type: "api",
      description: "Load all active expense categories for the submit form",
      params: { method: "GET", url: "/api/expense_categories?is_active=true", saveResultTo: "gs-005" },
    },
    {
      id: "act-fetch-expense-by-id",
      name: "Fetch Expense Detail",
      type: "api",
      description: "Load a single expense by ID and set it as the selected expense",
      params: { method: "GET", url: "/api/expenses/:id", saveResultTo: "gs-004" },
    },
    {
      id: "act-fetch-history",
      name: "Fetch Expense History",
      type: "api",
      description: "Load approved and rejected expenses for the history view",
      params: { method: "GET", url: "/api/expenses?status=approved,rejected", saveResultTo: "gs-002:history" },
    },
    {
      id: "act-submit-expense",
      name: "Submit Expense",
      type: "api",
      description: "Create a new expense record from the submit form state",
      params: { method: "POST", url: "/api/expenses", body: "$global.expenseForm", refreshAfter: ["act-fetch-expenses"] },
    },
    {
      id: "act-approve-expense",
      name: "Approve Expense",
      type: "api",
      description: "Approve the selected expense — updates status to approved",
      params: { method: "PATCH", url: "/api/expenses/$global.selectedExpense.id/approve", refreshAfter: ["act-fetch-pending", "act-fetch-expenses"] },
    },
    {
      id: "act-reject-expense",
      name: "Reject Expense",
      type: "api",
      description: "Reject the selected expense — updates status to rejected",
      params: { method: "PATCH", url: "/api/expenses/$global.selectedExpense.id/reject", refreshAfter: ["act-fetch-pending", "act-fetch-expenses"] },
    },
    {
      id: "act-bulk-approve",
      name: "Bulk Approve",
      type: "api",
      description: "Approve multiple selected expenses in one request",
      params: { method: "POST", url: "/api/expenses/bulk-approve", body: "{ ids: $local.selectedExpenseIds }", refreshAfter: ["act-fetch-pending"] },
    },
    {
      id: "act-export-history",
      name: "Export History",
      type: "api",
      description: "Trigger a CSV download of the filtered expense history",
      params: { method: "GET", url: "/api/expenses/export?status=$local.historyStatusFilter&range=$local.historyDateFilter", responseType: "blob" },
    },
    {
      id: "act-navigate-dashboard",
      name: "Navigate to Dashboard",
      type: "navigate",
      description: "Navigate to the main dashboard screen",
      params: { route: "/dashboard" },
    },
    {
      id: "act-navigate-submit",
      name: "Navigate to Submit Expense",
      type: "navigate",
      description: "Navigate to the expense submission form",
      params: { route: "/submit" },
    },
    {
      id: "act-navigate-approval",
      name: "Navigate to Approval Queue",
      type: "navigate",
      description: "Navigate to the approval queue (manager/admin only)",
      params: { route: "/approval" },
    },
    {
      id: "act-navigate-expense-detail",
      name: "Navigate to Expense Detail",
      type: "navigate",
      description: "Navigate to the expense detail screen with a specific expense ID",
      params: { route: "/expense/:id" },
    },
  ],

  // ── Workflows ─────────────────────────────────────────────────────────
  workflows: [
    {
      id: "wf-login",
      name: "Login Flow",
      description: "Authenticate the user and redirect to dashboard on success",
      trigger: {
        type: "event",
        config: {
          screenId: "a1b2c3d4-0001-4000-8000-000000000001",
          componentId: "login-btn",
          event: "onPress",
        },
      },
      nodes: [
        { id: "wf-login-n1", type: "action", action: "act-login", position: { x: 100, y: 100 }, meta: { label: "POST /api/auth/login" } },
        { id: "wf-login-n2", type: "action", action: "act-navigate-dashboard", position: { x: 100, y: 220 }, meta: { label: "Navigate to Dashboard" } },
        { id: "wf-login-n3", type: "setState", action: "setLoginError", position: { x: 300, y: 220 }, meta: { label: "Show error message", stateKey: "gs-001:loginError", value: "Invalid email or password" } },
      ],
      edges: [
        { from: "wf-login-n1", to: "wf-login-n2", condition: "success", label: "Login success" },
        { from: "wf-login-n1", to: "wf-login-n3", condition: "error", label: "Login failed" },
      ],
    },
    {
      id: "wf-load-dashboard",
      name: "Load Dashboard Data",
      description: "Fetch all data needed by the dashboard on screen mount",
      trigger: {
        type: "event",
        config: {
          screenId: "a1b2c3d4-0002-4000-8000-000000000001",
          event: "onMount",
        },
      },
      nodes: [
        { id: "wf-dash-n1", type: "action", action: "act-fetch-expenses", position: { x: 100, y: 100 }, meta: { label: "Fetch expenses" } },
        { id: "wf-dash-n2", type: "action", action: "act-fetch-pending", position: { x: 300, y: 100 }, meta: { label: "Fetch pending" } },
        { id: "wf-dash-n3", type: "action", action: "act-fetch-categories", position: { x: 500, y: 100 }, meta: { label: "Fetch categories" } },
      ],
      edges: [
        { from: "wf-dash-n1", to: "wf-dash-n2", label: "Parallel fetch" },
        { from: "wf-dash-n2", to: "wf-dash-n3", label: "Then categories" },
      ],
    },
    {
      id: "wf-submit-expense",
      name: "Submit Expense Flow",
      description: "Validate form, create expense record, reset form, navigate to dashboard",
      trigger: {
        type: "event",
        config: {
          screenId: "a1b2c3d4-0003-4000-8000-000000000001",
          componentId: "submit-btn",
          event: "onPress",
        },
      },
      nodes: [
        { id: "wf-sub-n1", type: "condition", position: { x: 100, y: 100 }, meta: { label: "Validate form", condition: "$global.expenseForm.title != '' && $global.expenseForm.amount != ''" } },
        { id: "wf-sub-n2", type: "action", action: "act-submit-expense", position: { x: 100, y: 220 }, meta: { label: "POST /api/expenses" } },
        { id: "wf-sub-n3", type: "action", action: "act-navigate-dashboard", position: { x: 100, y: 340 }, meta: { label: "Back to dashboard" } },
        { id: "wf-sub-n4", type: "setState", action: "setSubmitError", position: { x: 300, y: 220 }, meta: { label: "Show validation error" } },
      ],
      edges: [
        { from: "wf-sub-n1", to: "wf-sub-n2", condition: "true", label: "Form valid" },
        { from: "wf-sub-n1", to: "wf-sub-n4", condition: "false", label: "Form invalid" },
        { from: "wf-sub-n2", to: "wf-sub-n3", condition: "success", label: "Submitted" },
      ],
    },
    {
      id: "wf-approve-expense",
      name: "Approve Expense Flow",
      description: "Approve the current expense, refresh queue, navigate back",
      trigger: {
        type: "event",
        config: {
          screenId: "a1b2c3d4-0004-4000-8000-000000000001",
          componentId: "approve-btn",
          event: "onPress",
        },
      },
      nodes: [
        { id: "wf-apr-n1", type: "action", action: "act-approve-expense", position: { x: 100, y: 100 }, meta: { label: "PATCH /api/expenses/:id/approve" } },
        { id: "wf-apr-n2", type: "action", action: "act-navigate-approval", position: { x: 100, y: 220 }, meta: { label: "Back to approval queue" } },
      ],
      edges: [
        { from: "wf-apr-n1", to: "wf-apr-n2", condition: "success", label: "Approved" },
      ],
    },
    {
      id: "wf-reject-expense",
      name: "Reject Expense Flow",
      description: "Reject the current expense, refresh queue, navigate back",
      trigger: {
        type: "event",
        config: {
          screenId: "a1b2c3d4-0004-4000-8000-000000000001",
          componentId: "reject-btn",
          event: "onPress",
        },
      },
      nodes: [
        { id: "wf-rej-n1", type: "action", action: "act-reject-expense", position: { x: 100, y: 100 }, meta: { label: "PATCH /api/expenses/:id/reject" } },
        { id: "wf-rej-n2", type: "action", action: "act-navigate-approval", position: { x: 100, y: 220 }, meta: { label: "Back to approval queue" } },
      ],
      edges: [
        { from: "wf-rej-n1", to: "wf-rej-n2", condition: "success", label: "Rejected" },
      ],
    },
    {
      id: "wf-logout",
      name: "Logout Flow",
      description: "Sign out the user, clear auth state, redirect to login",
      trigger: {
        type: "event",
        config: {
          componentId: "signout-btn",
          event: "onPress",
        },
      },
      nodes: [
        { id: "wf-out-n1", type: "action", action: "act-sign-out", position: { x: 100, y: 100 }, meta: { label: "POST /api/auth/logout" } },
        { id: "wf-out-n2", type: "navigate", position: { x: 100, y: 220 }, meta: { label: "Navigate to /login", route: "/login" } },
      ],
      edges: [
        { from: "wf-out-n1", to: "wf-out-n2", label: "Signed out" },
      ],
    },
  ],

  // ── Navigation ────────────────────────────────────────────────────────
  navigation: {
    type: "stack",
    initialRoute: "/login",
    routes: [
      {
        id: "route-login",
        path: "/login",
        screenId: "a1b2c3d4-0001-4000-8000-000000000001",
        auth: false,
        roles: [],
        meta: { transition: "fade" },
      },
      {
        id: "route-dashboard",
        path: "/dashboard",
        screenId: "a1b2c3d4-0002-4000-8000-000000000001",
        auth: true,
        roles: ["admin", "manager", "user"],
        meta: { transition: "slide" },
      },
      {
        id: "route-submit",
        path: "/submit",
        screenId: "a1b2c3d4-0003-4000-8000-000000000001",
        auth: true,
        roles: ["admin", "manager", "user"],
        meta: { transition: "slide" },
      },
      {
        id: "route-expense-detail",
        path: "/expense/:id",
        screenId: "a1b2c3d4-0004-4000-8000-000000000001",
        auth: true,
        roles: ["admin", "manager", "user"],
        params: { id: "string" },
        meta: { transition: "slide" },
      },
      {
        id: "route-approval",
        path: "/approval",
        screenId: "a1b2c3d4-0005-4000-8000-000000000001",
        auth: true,
        roles: ["admin", "manager"],
        meta: { transition: "slide", roleRedirect: "/dashboard" },
      },
      {
        id: "route-history",
        path: "/history",
        screenId: "a1b2c3d4-0006-4000-8000-000000000001",
        auth: true,
        roles: ["admin", "manager", "user"],
        meta: { transition: "slide" },
      },
      {
        id: "route-profile",
        path: "/profile",
        screenId: "a1b2c3d4-0007-4000-8000-000000000001",
        auth: true,
        roles: ["admin", "manager", "user"],
        meta: { transition: "slide" },
      },
    ],
  },

  // ── Auth ──────────────────────────────────────────────────────────────
  auth: {
    providers: [
      {
        type: "email",
        config: {
          loginEndpoint: "/api/auth/login",
          logoutEndpoint: "/api/auth/logout",
          refreshEndpoint: "/api/auth/refresh",
          tokenField: "token",
          userField: "user",
        },
      },
    ],
    jwt: {
      expiresIn: "24h",
      refreshExpiresIn: "7d",
      storageKey: "auth:token",
    },
    rbac: {
      roles: ["admin", "manager", "user"],
      permissions: {
        admin: ["read:all", "write:all", "approve:all", "admin:all"],
        manager: ["read:all", "write:own", "approve:team"],
        user: ["read:own", "write:own"],
      },
      defaultRole: "user",
    },
    mfa: {
      enabled: false,
    },
    redirects: {
      afterLogin: "/dashboard",
      afterLogout: "/login",
      unauthorized: "/login",
      forbidden: "/dashboard",
    },
  },

  // ── Database ──────────────────────────────────────────────────────────
  database: {
    tables: [
      {
        name: "expenses",
        description: "Core expense records submitted by users",
        columns: [
          { name: "id", type: "uuid", primaryKey: true, default: "gen_random_uuid()" },
          { name: "title", type: "varchar(255)", nullable: false },
          { name: "amount", type: "decimal(12,2)", nullable: false },
          { name: "category_id", type: "uuid", nullable: false, references: { table: "expense_categories", column: "id" } },
          { name: "description", type: "text", nullable: true },
          { name: "receipt_url", type: "text", nullable: true },
          { name: "status", type: "varchar(20)", nullable: false, default: "'pending'", check: "status IN ('pending','approved','rejected')" },
          { name: "submitter_id", type: "uuid", nullable: false, references: { table: "users", column: "id" } },
          { name: "reviewer_id", type: "uuid", nullable: true, references: { table: "users", column: "id" } },
          { name: "submitted_at", type: "timestamptz", nullable: false, default: "now()" },
          { name: "reviewed_at", type: "timestamptz", nullable: true },
          { name: "created_at", type: "timestamptz", nullable: false, default: "now()" },
          { name: "updated_at", type: "timestamptz", nullable: false, default: "now()" },
        ],
        indexes: [
          { name: "idx_expenses_submitter", columns: ["submitter_id"] },
          { name: "idx_expenses_status", columns: ["status"] },
          { name: "idx_expenses_category", columns: ["category_id"] },
          { name: "idx_expenses_submitted_at", columns: ["submitted_at DESC"] },
        ],
      },
      {
        name: "expense_categories",
        description: "Configurable expense categories (meals, travel, equipment, etc.)",
        columns: [
          { name: "id", type: "uuid", primaryKey: true, default: "gen_random_uuid()" },
          { name: "name", type: "varchar(100)", nullable: false, unique: true },
          { name: "code", type: "varchar(20)", nullable: false, unique: true },
          { name: "description", type: "text", nullable: true },
          { name: "is_active", type: "boolean", nullable: false, default: "true" },
          { name: "created_at", type: "timestamptz", nullable: false, default: "now()" },
        ],
        indexes: [
          { name: "idx_expense_categories_active", columns: ["is_active"], where: "is_active = true" },
        ],
        seed: [
          { name: "Meals & Dining", code: "MEALS", description: "Team lunches, client dinners", is_active: true },
          { name: "Travel & Transport", code: "TRAVEL", description: "Flights, hotels, taxis, mileage", is_active: true },
          { name: "Office Supplies", code: "OFFICE", description: "Stationery, printer ink, etc.", is_active: true },
          { name: "Software & Subscriptions", code: "SOFTWARE", description: "SaaS tools, licenses", is_active: true },
          { name: "Training & Education", code: "TRAINING", description: "Courses, books, conferences", is_active: true },
          { name: "Equipment", code: "EQUIPMENT", description: "Hardware, peripherals", is_active: true },
          { name: "Marketing", code: "MARKETING", description: "Ads, print, promotional items", is_active: true },
          { name: "Other", code: "OTHER", description: "Miscellaneous expenses", is_active: true },
        ],
      },
      {
        name: "expense_comments",
        description: "Threaded comments on expense records (reviewer notes, clarifications)",
        columns: [
          { name: "id", type: "uuid", primaryKey: true, default: "gen_random_uuid()" },
          { name: "expense_id", type: "uuid", nullable: false, references: { table: "expenses", column: "id", onDelete: "CASCADE" } },
          { name: "author_id", type: "uuid", nullable: false, references: { table: "users", column: "id" } },
          { name: "content", type: "text", nullable: false },
          { name: "created_at", type: "timestamptz", nullable: false, default: "now()" },
        ],
        indexes: [
          { name: "idx_expense_comments_expense", columns: ["expense_id"] },
          { name: "idx_expense_comments_author", columns: ["author_id"] },
        ],
      },
      {
        name: "expense_history",
        description: "Immutable audit log of every status change on an expense",
        columns: [
          { name: "id", type: "uuid", primaryKey: true, default: "gen_random_uuid()" },
          { name: "expense_id", type: "uuid", nullable: false, references: { table: "expenses", column: "id", onDelete: "CASCADE" } },
          { name: "action", type: "varchar(50)", nullable: false },
          { name: "from_status", type: "varchar(20)", nullable: true },
          { name: "to_status", type: "varchar(20)", nullable: false },
          { name: "actor_id", type: "uuid", nullable: false, references: { table: "users", column: "id" } },
          { name: "notes", type: "text", nullable: true },
          { name: "created_at", type: "timestamptz", nullable: false, default: "now()" },
        ],
        indexes: [
          { name: "idx_expense_history_expense", columns: ["expense_id"] },
          { name: "idx_expense_history_actor", columns: ["actor_id"] },
          { name: "idx_expense_history_created_at", columns: ["created_at DESC"] },
        ],
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
    // Ensure the table exists
    console.log("Ensuring runtime_schemas table exists…");
    await client.query(CREATE_TABLE_SQL);
    console.log("Table ready.");

    // Upsert the schema (updated_by = null — seeded by script)
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
