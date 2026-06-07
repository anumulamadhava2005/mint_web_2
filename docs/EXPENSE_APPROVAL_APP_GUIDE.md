# Build An Expense Approval App In Mint Web

This guide describes how to build a simple but complete expense approval app in Mint Web using the same runtime-driven pattern used by the Pulse seed files.

The Pulse seed demonstrates four important Mint concepts:

- App screens are top-level frames, then registered in `schema.navigation.routes`.
- UI data is connected through `runtimeBindings`, including `textBind`, `inputBind`, `repeatFor`, `visibleBind`, `onClick`, and `onMount`.
- Backend data is described in `schema.database.tables`.
- Behavior is described as `schema.globalState` plus `schema.globalActions`, with actions chaining SQL queries, state updates, and navigation.

This app uses those same ideas for an expense reimbursement workflow.

## App Goal

Build a role-based expense approval system where:

- Employees submit expenses and track status.
- Managers approve, reject, or request changes.
- Finance performs final approval, reimbursement, and export.
- Admins modify the workflow and system configuration.

The showcase moment is the Workflow Builder: an admin adds a `Department Head Approval` step between `Manager Approval` and `Finance Approval`, saves it, and the app immediately updates the approval path.

## Roles

| Role | Responsibilities | Primary screens |
| --- | --- | --- |
| Employee | Submit expenses, save drafts, track pending/approved/rejected items, view details | Dashboard, Submit Expense, My Expenses, Expense Details, Notifications |
| Manager | Review team expenses, approve/reject/request changes, view team stats | Dashboard, Manager Approvals, Expense Details, Approval History, Notifications |
| Finance | Final approval, mark reimbursed, export records, monitor spend | Dashboard, Finance Approvals, Expense Details, Analytics, Approval History |
| Admin | Manage workflow, categories, departments, user roles, notification rules | Workflow Builder, Settings, Analytics |

## Recommended Visual Structure

Use mobile-sized frames if you want a Pulse-style demo app:

- Frame size: `390 x 900`.
- Dark-neutral or quiet enterprise palette.
- Top header with role/account context.
- Bottom navigation for common screens.
- Repeated cards or rows for approvals and expenses.
- Tables can be represented as vertical repeaters on mobile and actual grid/table layouts on wider exports.

Use these top-level frame names so routes are predictable:

| Screen | Frame name | Route |
| --- | --- | --- |
| Login | `Login` | `/login` |
| Dashboard | `Dashboard` | `/dashboard` |
| Submit Expense | `SubmitExpense` | `/submit-expense` |
| My Expenses | `MyExpenses` | `/my-expenses` |
| Expense Details | `ExpenseDetails` | `/expenses/detail` |
| Manager Approvals | `ManagerApprovals` | `/manager/approvals` |
| Finance Approvals | `FinanceApprovals` | `/finance/approvals` |
| Approval History | `ApprovalHistory` | `/approval-history` |
| Workflow Builder | `WorkflowBuilder` | `/admin/workflow` |
| Analytics | `Analytics` | `/analytics` |
| Notifications | `Notifications` | `/notifications` |
| Settings | `Settings` | `/settings` |

## Database Schema

Create these tables in the Backend panel or seed them through a runtime schema.

### `users`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `email` | text | Required, unique |
| `password_hash` | text | Demo apps can omit or mock this |
| `name` | text | Required |
| `role` | text | `employee`, `manager`, `finance`, `admin` |
| `department_id` | uuid | References `departments.id` |
| `manager_id` | uuid | References `users.id` |
| `remember_login` | boolean | Optional |
| `created_at` | timestamp | Default `now()` |

### `departments`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `name` | text | Required |
| `head_user_id` | uuid | Optional, used by the workflow demo |
| `created_at` | timestamp | Default `now()` |

### `expense_categories`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `name` | text | Required |
| `requires_receipt` | boolean | Default `true` |
| `active` | boolean | Default `true` |

### `expenses`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `employee_id` | uuid | References `users.id` |
| `title` | text | Required |
| `description` | text | Optional |
| `amount` | numeric | Required |
| `currency` | text | Example: `USD`, `INR`, `EUR` |
| `category_id` | uuid | References `expense_categories.id` |
| `department_id` | uuid | References `departments.id` |
| `expense_date` | date | Required |
| `receipt_url` | text | Uploaded receipt path |
| `status` | text | `draft`, `pending_manager`, `pending_department_head`, `pending_finance`, `approved`, `rejected`, `changes_requested`, `reimbursed` |
| `current_step_key` | text | Current workflow step |
| `submitted_at` | timestamp | Set on submit |
| `created_at` | timestamp | Default `now()` |
| `updated_at` | timestamp | Default `now()` |

### `approval_events`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `expense_id` | uuid | References `expenses.id` |
| `actor_id` | uuid | References `users.id` |
| `actor_role` | text | Snapshot of actor role |
| `action` | text | `created`, `submitted`, `approved`, `rejected`, `changes_requested`, `reimbursed`, `workflow_updated` |
| `step_key` | text | `manager`, `department_head`, `finance`, etc. |
| `comment` | text | Optional |
| `created_at` | timestamp | Default `now()` |

### `workflow_steps`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `step_key` | text | `submit`, `manager`, `department_head`, `finance`, `reimbursement` |
| `label` | text | Display label |
| `approver_role` | text | Role or resolver used by the step |
| `position` | integer | Step order |
| `active` | boolean | Default `true` |
| `condition_json` | jsonb | Optional routing condition |
| `created_at` | timestamp | Default `now()` |

### `notifications`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `user_id` | uuid | Recipient |
| `expense_id` | uuid | Optional |
| `type` | text | `expense_approved`, `expense_rejected`, `approval_required`, `reimbursement_processed` |
| `title` | text | Required |
| `body` | text | Required |
| `read_at` | timestamp | Null until read |
| `created_at` | timestamp | Default `now()` |

## Global State

Add these global state variables:

```json
[
  {
    "id": "gs-user",
    "name": "user",
    "type": "object",
    "defaultValue": {
      "id": "",
      "email": "",
      "name": "",
      "role": "employee",
      "department_id": "",
      "remember_login": false
    }
  },
  {
    "id": "gs-form",
    "name": "form",
    "type": "object",
    "defaultValue": {
      "loginEmail": "",
      "loginPassword": "",
      "loginRole": "employee",
      "expenseTitle": "",
      "expenseDescription": "",
      "expenseAmount": "",
      "expenseCurrency": "USD",
      "expenseCategoryId": "",
      "expenseDepartmentId": "",
      "expenseDate": "",
      "receiptUrl": "",
      "approvalComment": ""
    }
  },
  {
    "id": "gs-local",
    "name": "local",
    "type": "object",
    "defaultValue": {
      "dashboard": {},
      "myExpenses": [],
      "pendingApprovals": [],
      "financeApprovals": [],
      "activeExpense": null,
      "approvalHistory": [],
      "workflowSteps": [],
      "analytics": {},
      "notifications": [],
      "settings": {
        "categories": [],
        "departments": [],
        "roles": [],
        "notificationRules": []
      },
      "filters": {
        "expenseStatus": "pending",
        "search": ""
      },
      "_modals": {
        "rejectExpense": { "open": false },
        "requestChanges": { "open": false },
        "workflowCondition": { "open": false }
      }
    }
  }
]
```

## Global Actions

The examples below use the same style as Pulse: database calls go through `/api/db/{projectId}`, results are written into state through `onSuccess`, and screens call loader actions through `onMount`.

### Navigation Actions

```json
[
  { "id": "act-nav-login", "name": "navigateLogin", "type": "navigate", "config": { "target": "/login" } },
  { "id": "act-nav-dashboard", "name": "navigateDashboard", "type": "navigate", "config": { "target": "/dashboard" } },
  { "id": "act-nav-submit", "name": "navigateSubmitExpense", "type": "navigate", "config": { "target": "/submit-expense" } },
  { "id": "act-nav-mine", "name": "navigateMyExpenses", "type": "navigate", "config": { "target": "/my-expenses" } },
  { "id": "act-nav-detail", "name": "navigateExpenseDetails", "type": "navigate", "config": { "target": "/expenses/detail" } },
  { "id": "act-nav-manager", "name": "navigateManagerApprovals", "type": "navigate", "config": { "target": "/manager/approvals" } },
  { "id": "act-nav-finance", "name": "navigateFinanceApprovals", "type": "navigate", "config": { "target": "/finance/approvals" } },
  { "id": "act-nav-workflow", "name": "navigateWorkflowBuilder", "type": "navigate", "config": { "target": "/admin/workflow" } },
  { "id": "act-nav-analytics", "name": "navigateAnalytics", "type": "navigate", "config": { "target": "/analytics" } },
  { "id": "act-nav-notifications", "name": "navigateNotifications", "type": "navigate", "config": { "target": "/notifications" } },
  { "id": "act-nav-settings", "name": "navigateSettings", "type": "navigate", "config": { "target": "/settings" } }
]
```

### Login And Role Routing

For a demo, the role assignment can be selected on the login screen. In production, the role should come from the user record.

```json
{
  "id": "act-login",
  "name": "login",
  "type": "fetch",
  "config": {
    "url": "/api/db/{projectId}",
    "method": "POST",
    "body": {
      "sql": "SELECT id, email, name, role, department_id FROM users WHERE email = $1 AND role = $2 LIMIT 1",
      "params": ["$form.loginEmail", "$form.loginRole"]
    },
    "onSuccess": "SET $user = $result.rows[0]; CALL navigateDashboard",
    "onError": "SET $local.loginError = 'Invalid login'"
  }
}
```

### Dashboard Loaders

Create a role-aware `fetchDashboardData` action that chains to the correct loader:

```json
{
  "id": "act-fetch-dashboard",
  "name": "fetchDashboardData",
  "type": "setState",
  "config": {
    "path": "local.dashboardLoading",
    "value": true,
    "also": "CALL fetchEmployeeDashboard; CALL fetchManagerDashboard; CALL fetchFinanceDashboard"
  }
}
```

Then use role-specific SQL:

```json
{
  "id": "act-fetch-employee-dashboard",
  "name": "fetchEmployeeDashboard",
  "type": "fetch",
  "config": {
    "url": "/api/db/{projectId}",
    "method": "POST",
    "body": {
      "sql": "SELECT COUNT(*) FILTER (WHERE status IN ('pending_manager','pending_department_head','pending_finance')) AS pending_expenses, COUNT(*) FILTER (WHERE status IN ('approved','reimbursed')) AS approved_expenses, COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_expenses, COALESCE(SUM(amount) FILTER (WHERE status IN ('approved','reimbursed')),0) AS total_reimbursement_amount FROM expenses WHERE employee_id = $1",
      "params": ["$user.id"]
    },
    "onSuccess": "SET $local.dashboard.employee = $result.rows[0]"
  }
}
```

```json
{
  "id": "act-fetch-manager-dashboard",
  "name": "fetchManagerDashboard",
  "type": "fetch",
  "config": {
    "url": "/api/db/{projectId}",
    "method": "POST",
    "body": {
      "sql": "SELECT COUNT(*) FILTER (WHERE e.status = 'pending_manager') AS pending_approvals, COUNT(*) FILTER (WHERE ae.action = 'approved' AND ae.created_at > now() - interval '7 days') AS recently_approved, COALESCE(SUM(e.amount),0) AS team_total_spend FROM expenses e LEFT JOIN approval_events ae ON ae.expense_id = e.id WHERE e.department_id = $1",
      "params": ["$user.department_id"]
    },
    "onSuccess": "SET $local.dashboard.manager = $result.rows[0]"
  }
}
```

```json
{
  "id": "act-fetch-finance-dashboard",
  "name": "fetchFinanceDashboard",
  "type": "fetch",
  "config": {
    "url": "/api/db/{projectId}",
    "method": "POST",
    "body": {
      "sql": "SELECT COUNT(*) FILTER (WHERE status = 'pending_finance') AS final_approvals_pending, COALESCE(SUM(amount) FILTER (WHERE date_trunc('month', submitted_at) = date_trunc('month', now())),0) AS monthly_spend FROM expenses",
      "params": []
    },
    "onSuccess": "SET $local.dashboard.finance = $result.rows[0]"
  }
}
```

### Expense Form Actions

```json
{
  "id": "act-save-expense-draft",
  "name": "saveExpenseDraft",
  "type": "fetch",
  "config": {
    "url": "/api/db/{projectId}",
    "method": "POST",
    "body": {
      "sql": "INSERT INTO expenses (employee_id, title, description, amount, currency, category_id, department_id, expense_date, receipt_url, status, current_step_key) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft','submit') RETURNING *",
      "params": ["$user.id", "$form.expenseTitle", "$form.expenseDescription", "$form.expenseAmount", "$form.expenseCurrency", "$form.expenseCategoryId", "$form.expenseDepartmentId", "$form.expenseDate", "$form.receiptUrl"]
    },
    "onSuccess": "SET $local.activeExpense = $result.rows[0]; CALL fetchMyExpenses"
  }
}
```

```json
{
  "id": "act-submit-expense",
  "name": "submitExpense",
  "type": "fetch",
  "config": {
    "url": "/api/db/{projectId}",
    "method": "POST",
    "body": {
      "sql": "INSERT INTO expenses (employee_id, title, description, amount, currency, category_id, department_id, expense_date, receipt_url, status, current_step_key, submitted_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending_manager','manager',now()) RETURNING *",
      "params": ["$user.id", "$form.expenseTitle", "$form.expenseDescription", "$form.expenseAmount", "$form.expenseCurrency", "$form.expenseCategoryId", "$form.expenseDepartmentId", "$form.expenseDate", "$form.receiptUrl"]
    },
    "onSuccess": "SET $local.activeExpense = $result.rows[0]; CALL createSubmittedEvent; CALL notifyManager; CALL fetchMyExpenses; CALL navigateExpenseDetails"
  }
}
```

### Expense Lists And Details

```json
{
  "id": "act-fetch-my-expenses",
  "name": "fetchMyExpenses",
  "type": "fetch",
  "config": {
    "url": "/api/db/{projectId}",
    "method": "POST",
    "body": {
      "sql": "SELECT e.id, e.title, c.name AS category, e.amount, e.currency, e.status, e.submitted_at FROM expenses e LEFT JOIN expense_categories c ON c.id = e.category_id WHERE e.employee_id = $1 AND ($2 = '' OR e.title ILIKE '%' || $2 || '%') ORDER BY e.created_at DESC",
      "params": ["$user.id", "$local.filters.search"]
    },
    "onSuccess": "SET $local.myExpenses = $result.rows"
  }
}
```

```json
{
  "id": "act-open-expense-detail",
  "name": "openExpenseDetail",
  "type": "setState",
  "config": {
    "path": "local.activeExpense",
    "value": "$args.0",
    "also": "CALL fetchExpenseDetail; CALL fetchExpenseHistory; CALL navigateExpenseDetails"
  }
}
```

```json
{
  "id": "act-fetch-expense-history",
  "name": "fetchExpenseHistory",
  "type": "fetch",
  "config": {
    "url": "/api/db/{projectId}",
    "method": "POST",
    "body": {
      "sql": "SELECT ae.*, u.name AS actor_name FROM approval_events ae LEFT JOIN users u ON u.id = ae.actor_id WHERE ae.expense_id = $1 ORDER BY ae.created_at ASC",
      "params": ["$local.activeExpense.id"]
    },
    "onSuccess": "SET $local.approvalHistory = $result.rows"
  }
}
```

### Manager Approval Actions

```json
{
  "id": "act-fetch-manager-approvals",
  "name": "fetchManagerApprovals",
  "type": "fetch",
  "config": {
    "url": "/api/db/{projectId}",
    "method": "POST",
    "body": {
      "sql": "SELECT e.*, u.name AS employee_name, c.name AS category FROM expenses e JOIN users u ON u.id = e.employee_id LEFT JOIN expense_categories c ON c.id = e.category_id WHERE e.status = 'pending_manager' AND e.department_id = $1 ORDER BY e.submitted_at ASC",
      "params": ["$user.department_id"]
    },
    "onSuccess": "SET $local.pendingApprovals = $result.rows"
  }
}
```

```json
{
  "id": "act-manager-approve",
  "name": "managerApproveExpense",
  "type": "fetch",
  "config": {
    "url": "/api/db/{projectId}",
    "method": "POST",
    "body": {
      "sql": "UPDATE expenses SET status = 'pending_finance', current_step_key = 'finance', updated_at = now() WHERE id = $1 RETURNING *",
      "params": ["$expense.id"]
    },
    "onSuccess": "SET $local.activeExpense = $result.rows[0]; CALL createManagerApprovedEvent; CALL notifyFinance; CALL fetchManagerApprovals"
  }
}
```

```json
{
  "id": "act-manager-reject",
  "name": "managerRejectExpense",
  "type": "fetch",
  "config": {
    "url": "/api/db/{projectId}",
    "method": "POST",
    "body": {
      "sql": "UPDATE expenses SET status = 'rejected', current_step_key = 'completed', updated_at = now() WHERE id = $1 RETURNING *",
      "params": ["$expense.id"]
    },
    "onSuccess": "SET $local.activeExpense = $result.rows[0]; CALL createRejectedEvent; CALL notifyEmployeeRejected; CALL fetchManagerApprovals"
  }
}
```

```json
{
  "id": "act-manager-request-changes",
  "name": "managerRequestChanges",
  "type": "fetch",
  "config": {
    "url": "/api/db/{projectId}",
    "method": "POST",
    "body": {
      "sql": "UPDATE expenses SET status = 'changes_requested', current_step_key = 'employee_revision', updated_at = now() WHERE id = $1 RETURNING *",
      "params": ["$expense.id"]
    },
    "onSuccess": "SET $local.activeExpense = $result.rows[0]; CALL createChangesRequestedEvent; CALL notifyEmployeeChangesRequested; CALL fetchManagerApprovals"
  }
}
```

### Finance Approval Actions

```json
{
  "id": "act-fetch-finance-approvals",
  "name": "fetchFinanceApprovals",
  "type": "fetch",
  "config": {
    "url": "/api/db/{projectId}",
    "method": "POST",
    "body": {
      "sql": "SELECT e.*, u.name AS employee_name, c.name AS category, d.name AS department FROM expenses e JOIN users u ON u.id = e.employee_id LEFT JOIN expense_categories c ON c.id = e.category_id LEFT JOIN departments d ON d.id = e.department_id WHERE e.status = 'pending_finance' ORDER BY e.submitted_at ASC",
      "params": []
    },
    "onSuccess": "SET $local.financeApprovals = $result.rows"
  }
}
```

```json
{
  "id": "act-finance-approve",
  "name": "financeApproveExpense",
  "type": "fetch",
  "config": {
    "url": "/api/db/{projectId}",
    "method": "POST",
    "body": {
      "sql": "UPDATE expenses SET status = 'approved', current_step_key = 'reimbursement', updated_at = now() WHERE id = $1 RETURNING *",
      "params": ["$expense.id"]
    },
    "onSuccess": "SET $local.activeExpense = $result.rows[0]; CALL createFinanceApprovedEvent; CALL notifyEmployeeApproved; CALL fetchFinanceApprovals"
  }
}
```

```json
{
  "id": "act-mark-reimbursed",
  "name": "markReimbursed",
  "type": "fetch",
  "config": {
    "url": "/api/db/{projectId}",
    "method": "POST",
    "body": {
      "sql": "UPDATE expenses SET status = 'reimbursed', current_step_key = 'completed', updated_at = now() WHERE id = $1 RETURNING *",
      "params": ["$expense.id"]
    },
    "onSuccess": "SET $local.activeExpense = $result.rows[0]; CALL createReimbursedEvent; CALL notifyEmployeeReimbursed; CALL fetchFinanceApprovals"
  }
}
```

For `Export Record`, either call an API endpoint or store export data in local state:

```json
{
  "id": "act-export-record",
  "name": "exportRecord",
  "type": "fetch",
  "config": {
    "url": "/api/db/{projectId}",
    "method": "POST",
    "body": {
      "sql": "SELECT e.*, u.name AS employee_name, d.name AS department, c.name AS category FROM expenses e JOIN users u ON u.id = e.employee_id LEFT JOIN departments d ON d.id = e.department_id LEFT JOIN expense_categories c ON c.id = e.category_id WHERE e.id = $1",
      "params": ["$expense.id"]
    },
    "onSuccess": "SET $local.exportRecord = $result.rows[0]"
  }
}
```

### Audit And Notification Helper Actions

Use small helper actions for approval history and notifications. The main approval actions can call these helpers in their `onSuccess` chains.

Submitted event:

```json
{
  "id": "act-create-submitted-event",
  "name": "createSubmittedEvent",
  "type": "fetch",
  "config": {
    "url": "/api/db/{projectId}",
    "method": "POST",
    "body": {
      "sql": "INSERT INTO approval_events (expense_id, actor_id, actor_role, action, step_key, comment) VALUES ($1, $2, $3, 'submitted', 'submit', 'Expense submitted') RETURNING *",
      "params": ["$local.activeExpense.id", "$user.id", "$user.role"]
    },
    "onSuccess": "CALL fetchExpenseHistory"
  }
}
```

Manager approved event:

```json
{
  "id": "act-create-manager-approved-event",
  "name": "createManagerApprovedEvent",
  "type": "fetch",
  "config": {
    "url": "/api/db/{projectId}",
    "method": "POST",
    "body": {
      "sql": "INSERT INTO approval_events (expense_id, actor_id, actor_role, action, step_key, comment) VALUES ($1, $2, $3, 'approved', 'manager', $4) RETURNING *",
      "params": ["$local.activeExpense.id", "$user.id", "$user.role", "$form.approvalComment"]
    },
    "onSuccess": "CALL fetchExpenseHistory"
  }
}
```

Use the same pattern for:

- `createFinanceApprovedEvent`
- `createRejectedEvent`
- `createChangesRequestedEvent`
- `createReimbursedEvent`

Manager notification:

```json
{
  "id": "act-notify-manager",
  "name": "notifyManager",
  "type": "fetch",
  "config": {
    "url": "/api/db/{projectId}",
    "method": "POST",
    "body": {
      "sql": "INSERT INTO notifications (user_id, expense_id, type, title, body) SELECT manager_id, $1, 'approval_required', 'New Approval Required', $2 FROM users WHERE id = $3 RETURNING *",
      "params": ["$local.activeExpense.id", "$local.activeExpense.title", "$local.activeExpense.employee_id"]
    },
    "onSuccess": "CALL fetchNotifications"
  }
}
```

Create equivalent notification helpers for:

- `notifyFinance`
- `notifyEmployeeApproved`
- `notifyEmployeeRejected`
- `notifyEmployeeChangesRequested`
- `notifyEmployeeReimbursed`

## Screen By Screen Build

### Screen 1: Login

Purpose: let a demo user enter credentials and choose a role.

UI:

- Email input.
- Password input.
- Role assignment segmented control or select: Employee, Manager, Finance, Admin.
- Remember login toggle.
- Login button.

Bindings:

| Element | Binding |
| --- | --- |
| Email input | `inputBind: "$form.loginEmail"` |
| Password input | `inputBind: "$form.loginPassword"` |
| Role control | `inputBind: "$form.loginRole"` |
| Remember login | `inputBind: "$user.remember_login"` |
| Login button | `onClick: "login"` |

After login, route to `Dashboard`.

### Screen 2: Dashboard

Purpose: one role-aware home screen.

On mount:

```json
{ "runtimeBindings": { "onMount": "fetchDashboardData" } }
```

Employee dashboard cards:

- Pending expenses: `$local.dashboard.employee.pending_expenses`
- Approved expenses: `$local.dashboard.employee.approved_expenses`
- Rejected expenses: `$local.dashboard.employee.rejected_expenses`
- Total reimbursement amount: `$local.dashboard.employee.total_reimbursement_amount`

Manager dashboard cards:

- Pending approvals: `$local.dashboard.manager.pending_approvals`
- Recently approved: `$local.dashboard.manager.recently_approved`
- Team expense statistics: `$local.dashboard.manager.team_total_spend`

Finance dashboard cards:

- Final approvals pending: `$local.dashboard.finance.final_approvals_pending`
- Monthly spend: `$local.dashboard.finance.monthly_spend`
- Department breakdown: bind a chart/list to `$local.dashboard.finance.departmentBreakdown`

Implementation note:

- Use role-specific dashboard sections with `visibleBind` expressions based on `$user.role`.
- Keep quick action buttons role-aware:
  - Employee: `Submit Expense`, `My Expenses`.
  - Manager: `Approvals`.
  - Finance: `Final Approvals`, `Analytics`.
  - Admin: `Workflow Builder`, `Settings`.

### Screen 3: Submit Expense

Purpose: employee creates a draft or submits an expense.

Fields:

| Field | Binding |
| --- | --- |
| Expense Title | `$form.expenseTitle` |
| Description | `$form.expenseDescription` |
| Amount | `$form.expenseAmount` |
| Currency | `$form.expenseCurrency` |
| Expense Category | `$form.expenseCategoryId` |
| Department | `$form.expenseDepartmentId` |
| Expense Date | `$form.expenseDate` |
| Receipt Upload | `$form.receiptUrl` |

Actions:

- Save Draft: `saveExpenseDraft`
- Submit: `submitExpense`

Recommended layout:

- Header: `Submit Expense`.
- Form body with labels and inputs.
- Receipt upload zone.
- Sticky bottom action row with `Save Draft` and `Submit`.

### Screen 4: My Expenses

Purpose: employee list view.

On mount: `fetchMyExpenses`.

Table/repeater columns:

- ID: `$expense.id`
- Title: `$expense.title`
- Category: `$expense.category`
- Amount: `$expense.amount`
- Status: `$expense.status`
- Submitted Date: `$expense.submitted_at`

Filters:

- Pending.
- Approved.
- Rejected.

Search:

- Input bound to `$local.filters.search`.
- On change calls `fetchMyExpenses`.

Repeater binding:

```json
{
  "repeatFor": "$local.myExpenses",
  "repeatAs": "expense",
  "dataSource": "expenses"
}
```

Row click:

```json
{ "onClick": "openExpenseDetail" }
```

### Screen 5: Expense Details

Purpose: single expense record plus approval context.

Shows:

- Expense information.
- Approval history.
- Comments.
- Uploaded receipts.

Bindings:

- Title: `$local.activeExpense.title`
- Description: `$local.activeExpense.description`
- Amount: `$local.activeExpense.amount`
- Status: `$local.activeExpense.status`
- Receipt link/image: `$local.activeExpense.receipt_url`

Approval history repeater:

```json
{
  "repeatFor": "$local.approvalHistory",
  "repeatAs": "event",
  "dataSource": "approval_events"
}
```

Timeline:

```text
Submitted
Manager Review
Finance Review
Completed
```

After the workflow demo, this timeline should become:

```text
Submitted
Manager Review
Department Head Approval
Finance Review
Completed
```

Bind the timeline to `$local.workflowSteps` so the change appears from data instead of hard-coded UI.

### Screen 6: Manager Approvals

Purpose: manager review queue.

On mount: `fetchManagerApprovals`.

Cards/table fields:

- Employee Name: `$expense.employee_name`
- Expense Amount: `$expense.amount`
- Category: `$expense.category`
- Date: `$expense.expense_date`

Actions:

- Approve: `managerApproveExpense`
- Reject: `managerRejectExpense`
- Request Changes: `managerRequestChanges`

Recommended card structure:

- Top row: employee name and status chip.
- Middle row: category, date, amount.
- Bottom row: three compact action buttons.

### Screen 7: Finance Approvals

Purpose: finance final review queue.

On mount: `fetchFinanceApprovals`.

Fields:

- Employee Name.
- Expense Amount.
- Category.
- Department.
- Date.

Actions:

- Approve: `financeApproveExpense`
- Reject: use a finance-specific reject action or reuse a generic reject action.
- Mark Reimbursed: `markReimbursed`
- Export Record: `exportRecord`

Finance should only see expenses in `pending_finance`, `approved`, or reimbursement-ready states depending on the tab/filter.

### Screen 8: Approval History

Purpose: audit view for all events.

Use the same `approval_events` table, but show a richer timeline:

Example:

```text
Expense Created
Manager Approved
Finance Approved
Reimbursement Sent
```

For each timeline row:

- Icon or dot.
- Event title from `$event.action`.
- Actor from `$event.actor_name`.
- Comment from `$event.comment`.
- Timestamp from `$event.created_at`.

Use filters by status, actor role, department, and date range if you want to make the screen feel complete.

### Screen 9: Workflow Builder

Purpose: Mint showcase screen.

This is the killer demo because it shows business logic changing without rebuilding the app.

Initial visual flow:

```text
Submit Expense
Manager Approval
Finance Approval
Reimbursement
```

Back this screen with the `workflow_steps` table:

```json
{
  "id": "act-fetch-workflow",
  "name": "fetchWorkflow",
  "type": "fetch",
  "config": {
    "url": "/api/db/{projectId}",
    "method": "POST",
    "body": {
      "sql": "SELECT * FROM workflow_steps WHERE active = true ORDER BY position ASC",
      "params": []
    },
    "onSuccess": "SET $local.workflowSteps = $result.rows"
  }
}
```

Admin can:

- Add approval step.
- Remove step.
- Change routing.
- Add conditions.

Demo action: add `Department Head Approval` between Manager and Finance.

Because the project DB route blocks multi-statement SQL, model this as a chained action: first shift existing step positions, then insert the new step, then reload the workflow.

```json
{
  "id": "act-shift-workflow-for-department-head",
  "name": "shiftWorkflowForDepartmentHead",
  "type": "fetch",
  "config": {
    "url": "/api/db/{projectId}",
    "method": "POST",
    "body": {
      "sql": "UPDATE workflow_steps SET position = position + 1 WHERE position >= $1 RETURNING *",
      "params": [3]
    },
    "onSuccess": "CALL insertDepartmentHeadApproval"
  }
}
```

```json
{
  "id": "act-insert-department-head-step",
  "name": "insertDepartmentHeadApproval",
  "type": "fetch",
  "config": {
    "url": "/api/db/{projectId}",
    "method": "POST",
    "body": {
      "sql": "INSERT INTO workflow_steps (step_key, label, approver_role, position, active, condition_json) VALUES ($1, $2, $3, $4, true, $5) RETURNING *",
      "params": ["department_head", "Department Head Approval", "department_head", 3, { "when": "amount > 0" }]
    },
    "onSuccess": "CALL fetchWorkflow"
  }
}
```

Bind the UI button to the chain starter:

```json
{
  "id": "act-add-department-head-step",
  "name": "addDepartmentHeadApproval",
  "type": "custom",
  "config": {
    "also": "CALL shiftWorkflowForDepartmentHead"
  }
}
```

Then update manager approval routing so the next step comes from workflow data instead of always going straight to Finance.

For the simple demo, replace manager approval SQL with:

```sql
UPDATE expenses
SET status = 'pending_department_head',
    current_step_key = 'department_head',
    updated_at = now()
WHERE id = $1
RETURNING *
```

For a more advanced version, create a `resolveNextWorkflowStep` action that reads `workflow_steps` and sets the expense status dynamically based on the next active step.

Workflow screen bindings:

```json
{
  "repeatFor": "$local.workflowSteps",
  "repeatAs": "step",
  "dataSource": "workflow_steps"
}
```

Each step card:

- Label: `$step.label`
- Approver role: `$step.approver_role`
- Condition: `$step.condition_json`
- Remove button: `removeWorkflowStep`
- Move up/down buttons: `moveWorkflowStep`

Save button:

- Calls `saveWorkflow`.
- Then calls `fetchWorkflow`.
- Then calls loader actions for any screen that shows timeline or routing.

Show instant update:

1. Open an expense detail screen and show the timeline.
2. Go to Workflow Builder as Admin.
3. Add `Department Head Approval`.
4. Save.
5. Return to Expense Details.
6. The timeline now includes `Department Head Approval`.

### Screen 10: Analytics

Purpose: finance/admin reporting.

Cards:

- Total Expenses.
- Approval Rate.
- Average Approval Time.
- Monthly Spend.

Charts:

- Spend by Department.
- Spend by Category.
- Monthly Trend.

Loader:

```json
{
  "id": "act-fetch-analytics",
  "name": "fetchAnalytics",
  "type": "fetch",
  "config": {
    "url": "/api/db/{projectId}",
    "method": "POST",
    "body": {
      "sql": "SELECT COUNT(*) AS total_expenses, ROUND((COUNT(*) FILTER (WHERE status IN ('approved','reimbursed'))::numeric / NULLIF(COUNT(*),0)) * 100, 2) AS approval_rate, COALESCE(SUM(amount) FILTER (WHERE date_trunc('month', submitted_at) = date_trunc('month', now())),0) AS monthly_spend FROM expenses",
      "params": []
    },
    "onSuccess": "SET $local.analytics.summary = $result.rows[0]"
  }
}
```

Create additional actions:

- `fetchSpendByDepartment`.
- `fetchSpendByCategory`.
- `fetchMonthlyTrend`.

Bind chart containers with:

```json
{ "dataSource": "$local.analytics.spendByDepartment" }
```

### Screen 11: Notifications

Purpose: role-aware notification inbox.

Examples:

- Expense Approved.
- Expense Rejected.
- New Approval Required.
- Reimbursement Processed.

Loader:

```json
{
  "id": "act-fetch-notifications",
  "name": "fetchNotifications",
  "type": "fetch",
  "config": {
    "url": "/api/db/{projectId}",
    "method": "POST",
    "body": {
      "sql": "SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC",
      "params": ["$user.id"]
    },
    "onSuccess": "SET $local.notifications = $result.rows"
  }
}
```

Repeater:

```json
{
  "repeatFor": "$local.notifications",
  "repeatAs": "notification",
  "dataSource": "notifications"
}
```

Notification card bindings:

- Title: `$notification.title`
- Body: `$notification.body`
- Type chip: `$notification.type`
- Date: `$notification.created_at`

### Screen 12: Settings

Purpose: admin configuration.

Admin settings:

- Expense Categories.
- Departments.
- Approval Workflow.
- User Roles.
- Notification Rules.

Use tabs or segmented controls:

- Categories tab: repeater bound to `$local.settings.categories`.
- Departments tab: repeater bound to `$local.settings.departments`.
- Roles tab: repeater bound to `$local.settings.roles`.
- Notification Rules tab: repeater bound to `$local.settings.notificationRules`.

Actions:

- `fetchSettings`.
- `createCategory`.
- `updateCategory`.
- `createDepartment`.
- `updateDepartment`.
- `updateUserRole`.
- `saveNotificationRule`.

For admin-only access, either hide the screen navigation with `visibleBind: "$user.role === 'admin'"` or route non-admins back to Dashboard on mount.

## Navigation Schema

Configure navigation like this:

```json
{
  "type": "stack",
  "initialRoute": "/login",
  "routes": [
    { "path": "/login", "screenId": "expense-login-screen" },
    { "path": "/dashboard", "screenId": "expense-dashboard-screen" },
    { "path": "/submit-expense", "screenId": "expense-submit-screen" },
    { "path": "/my-expenses", "screenId": "expense-my-expenses-screen" },
    { "path": "/expenses/detail", "screenId": "expense-details-screen" },
    { "path": "/manager/approvals", "screenId": "expense-manager-approvals-screen" },
    { "path": "/finance/approvals", "screenId": "expense-finance-approvals-screen" },
    { "path": "/approval-history", "screenId": "expense-approval-history-screen" },
    { "path": "/admin/workflow", "screenId": "expense-workflow-builder-screen" },
    { "path": "/analytics", "screenId": "expense-analytics-screen" },
    { "path": "/notifications", "screenId": "expense-notifications-screen" },
    { "path": "/settings", "screenId": "expense-settings-screen" }
  ]
}
```

## Bottom Navigation

Use role-aware bottom navigation:

Employee:

- Dashboard.
- Submit.
- My Expenses.
- Notifications.

Manager:

- Dashboard.
- Approvals.
- History.
- Notifications.

Finance:

- Dashboard.
- Final Approvals.
- Analytics.
- Notifications.

Admin:

- Dashboard.
- Workflow.
- Analytics.
- Settings.

Each tab should use `onClick` bindings to navigation actions, just like Pulse uses `navigateDashboard`, `navigateWorkouts`, and similar actions.

## Demo Data

Seed a small dataset:

- 1 employee: `Alex Employee`, Sales.
- 1 manager: `Maya Manager`, Sales.
- 1 finance user: `Finley Finance`.
- 1 admin: `Ari Admin`.
- Departments: Sales, Engineering, Operations.
- Categories: Travel, Meals, Software, Office Supplies.
- Expenses:
  - `Client dinner`, `$142.50`, Meals, pending manager.
  - `Conference flight`, `$620.00`, Travel, pending finance.
  - `Design software`, `$89.00`, Software, approved.
  - `Desk accessories`, `$54.00`, Office Supplies, rejected.
- Workflow steps:
  - `submit`, `Submit Expense`, position `1`.
  - `manager`, `Manager Approval`, position `2`.
  - `finance`, `Finance Approval`, position `3`.
  - `reimbursement`, `Reimbursement`, position `4`.

## End-To-End Test Script

Use this sequence to verify the app:

1. Login as Employee.
2. Open Dashboard and verify employee cards render.
3. Submit a new expense with amount, category, department, date, and receipt.
4. Confirm it appears in My Expenses as `pending_manager`.
5. Login as Manager.
6. Open Manager Approvals and approve the expense.
7. Confirm the expense status changes to `pending_finance`.
8. Login as Finance.
9. Open Finance Approvals and approve the expense.
10. Mark it reimbursed.
11. Login as Admin.
12. Open Workflow Builder.
13. Add `Department Head Approval` between Manager and Finance.
14. Save the workflow.
15. Submit another expense and confirm its timeline includes the new step.

## Implementation Notes From Pulse

When creating a seed script or converting this into a runtime schema:

- Put runtime bindings on the element that owns the interaction, not just the text child.
- Use `repeatFor` with a single child template for list rows/cards.
- Use `onMount` on the screen frame for data loaders.
- Use `$args.0` for row/card context in click actions.
- Store selected records in `local.activeExpense` before navigating.
- Use explicit SQL casts for numeric analytics if field types are uncertain.
- Keep hidden modals hidden in the shape data and reveal them through `visibleBind`.
- After changing workflow records, call `fetchWorkflow` and any loader that depends on the workflow.

## Minimum Viable Version

If you need the smallest build that still proves the concept, build only:

- Login.
- Dashboard.
- Submit Expense.
- My Expenses.
- Manager Approvals.
- Finance Approvals.
- Expense Details.
- Workflow Builder.

The other screens deepen the product story, but those eight screens are enough to demonstrate role-based state, database-backed workflows, approval routing, and instant runtime-driven workflow changes.
