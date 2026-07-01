// Phase 6: Generate a realistic RN export and write it to disk for manual testing.
// Run: npx tsx _phase6-gen.ts
import * as fs from "fs";
import * as path from "path";

async function main() {
  const mod = await import("@/lib/convert/builders/reactNativeSchema");

  // A realistic expense-tracking schema with:
  //  - Login screen (email+password → signIn, no auth required)
  //  - Dashboard screen (requires auth, loads expenses via dbQuery, per-row delete)
  //  - New Expense screen (form → dbInsert, navigate back)
  const schema = {
    id: "69fef54b-6de6-4bbe-bf86-7dfd4b20b56a",
    name: "Expense Tracker",
    version: "1.0.0",
    schemaVersion: 1,
    theme: {
      colors: { background: "#0B0B0F", primary: "#6366F1", surface: "#15151C" },
      fonts: {}, spacing: {}, radii: {}, shadows: {},
    },
    screens: [
      // ── Screen 1: Login ──────────────────────────────────
      {
        id: "scr-login",
        name: "Login",
        route: "/",
        requiresAuth: false,
        components: [
          {
            id: "c-login-title", type: "text",
            props: { text: "Expense Tracker" },
            style: { typography: { color: "#fff", fontSize: 28, fontWeight: "700", textAlign: "center" }, spacing: { margin: [40, 0, 24, 0] } },
          },
          {
            id: "c-login-subtitle", type: "text",
            props: { text: "Sign in to continue" },
            style: { typography: { color: "#9CA3AF", fontSize: 16, textAlign: "center" }, spacing: { margin: [0, 0, 32, 0] } },
          },
          {
            id: "c-login-email", type: "input",
            props: { placeholder: "Email", inputType: "email" },
            bindings: { value: "$login.email" },
            style: { border: { width: 1, color: "#2A2A35", radius: 10 }, spacing: { padding: 12, margin: [0, 0, 12, 0] }, typography: { color: "#E5E7EB" }, background: { color: "#15151C" } },
          },
          {
            id: "c-login-password", type: "input",
            props: { placeholder: "Password", inputType: "password" },
            bindings: { value: "$login.password" },
            style: { border: { width: 1, color: "#2A2A35", radius: 10 }, spacing: { padding: 12, margin: [0, 0, 20, 0] }, typography: { color: "#E5E7EB" }, background: { color: "#15151C" } },
          },
          {
            id: "c-login-btn", type: "button",
            props: { text: "Sign In" },
            style: { background: { color: "#6366F1" }, spacing: { padding: [14, 0, 14, 0] }, border: { radius: 10 } },
            events: { onClick: [{ actionId: "act-sign-in" }] },
          },
          {
            id: "c-login-signup-link", type: "button",
            props: { text: "Don't have an account? Sign Up" },
            style: { background: { color: "transparent" }, spacing: { padding: [14, 0, 14, 0] }, typography: { color: "#6366F1", fontSize: 14 } },
            events: { onClick: [{ actionId: "act-go-signup" }] },
          },
          {
            id: "c-login-error", type: "text",
            bindings: { text: "$_lastError" },
            conditionalRender: "$_lastError",
            props: {},
            style: { typography: { color: "#EF4444", fontSize: 13, textAlign: "center" }, spacing: { margin: [12, 0, 0, 0] } },
          },
        ],
        localState: [
          { name: "login", type: "object", defaultValue: { email: "", password: "" } },
        ],
        actions: [
          {
            id: "act-sign-in", name: "Sign In", type: "signIn",
            config: {
              url: "$_authUrl",
              email: "$login.email",
              password: "$login.password",
            },
            onSuccess: [{ actionId: "act-go-dashboard" }],
          },
          {
            id: "act-go-dashboard", name: "Go Dashboard", type: "navigate",
            config: { route: "scr-dashboard" },
          },
          {
            id: "act-go-signup", name: "Go Signup", type: "navigate",
            config: { route: "scr-signup" },
          },
        ],
      },
      // ── Screen 2: Sign Up ──────────────────────────────
      {
        id: "scr-signup",
        name: "Sign Up",
        route: "/signup",
        requiresAuth: false,
        components: [
          {
            id: "c-su-title", type: "text",
            props: { text: "Create Account" },
            style: { typography: { color: "#fff", fontSize: 28, fontWeight: "700", textAlign: "center" }, spacing: { margin: [40, 0, 32, 0] } },
          },
          {
            id: "c-su-name", type: "input",
            props: { placeholder: "Full Name", inputType: "text" },
            bindings: { value: "$signup.name" },
            style: { border: { width: 1, color: "#2A2A35", radius: 10 }, spacing: { padding: 12, margin: [0, 0, 12, 0] }, typography: { color: "#E5E7EB" }, background: { color: "#15151C" } },
          },
          {
            id: "c-su-email", type: "input",
            props: { placeholder: "Email", inputType: "email" },
            bindings: { value: "$signup.email" },
            style: { border: { width: 1, color: "#2A2A35", radius: 10 }, spacing: { padding: 12, margin: [0, 0, 12, 0] }, typography: { color: "#E5E7EB" }, background: { color: "#15151C" } },
          },
          {
            id: "c-su-password", type: "input",
            props: { placeholder: "Password", inputType: "password" },
            bindings: { value: "$signup.password" },
            style: { border: { width: 1, color: "#2A2A35", radius: 10 }, spacing: { padding: 12, margin: [0, 0, 20, 0] }, typography: { color: "#E5E7EB" }, background: { color: "#15151C" } },
          },
          {
            id: "c-su-btn", type: "button",
            props: { text: "Sign Up" },
            style: { background: { color: "#6366F1" }, spacing: { padding: [14, 0, 14, 0] }, border: { radius: 10 } },
            events: { onClick: [{ actionId: "act-sign-up" }] },
          },
          {
            id: "c-su-error", type: "text",
            bindings: { text: "$_lastError" },
            conditionalRender: "$_lastError",
            props: {},
            style: { typography: { color: "#EF4444", fontSize: 13, textAlign: "center" }, spacing: { margin: [12, 0, 0, 0] } },
          },
        ],
        localState: [
          { name: "signup", type: "object", defaultValue: { name: "", email: "", password: "" } },
        ],
        actions: [
          {
            id: "act-sign-up", name: "Sign Up", type: "signUp",
            config: {
              url: "$_authUrl_signup",
              email: "$signup.email",
              password: "$signup.password",
              name: "$signup.name",
            },
            onSuccess: [{ actionId: "act-su-go-dashboard" }],
          },
          {
            id: "act-su-go-dashboard", name: "Go Dashboard", type: "navigate",
            config: { route: "scr-dashboard" },
          },
        ],
      },
      // ── Screen 3: Dashboard ────────────────────────────
      {
        id: "scr-dashboard",
        name: "Dashboard",
        route: "/dashboard",
        requiresAuth: true,
        onMount: [{ actionId: "act-load-expenses" }],
        components: [
          {
            id: "c-dash-header", type: "frame",
            style: { layout: { direction: "row", justify: "between", align: "center" }, spacing: { margin: [0, 0, 16, 0] } },
            children: [
              {
                id: "c-dash-title", type: "text",
                props: { text: "My Expenses" },
                style: { typography: { color: "#fff", fontSize: 24, fontWeight: "700" } },
              },
              {
                id: "c-dash-add-btn", type: "button",
                props: { text: "+ New" },
                style: { background: { color: "#6366F1" }, spacing: { padding: [10, 16, 10, 16] }, border: { radius: 10 } },
                events: { onClick: [{ actionId: "act-go-new" }] },
              },
            ],
          },
          {
            id: "c-dash-welcome", type: "text",
            bindings: { text: "'Welcome, ' + $user.name" },
            props: {},
            style: { typography: { color: "#9CA3AF", fontSize: 14 }, spacing: { margin: [0, 0, 16, 0] } },
          },
          {
            id: "c-dash-list", type: "frame",
            repeatFor: { items: "$expenses", as: "item" },
            style: { layout: { direction: "column", gap: 12 } },
            children: [
              {
                id: "c-row-card", type: "frame",
                style: { background: { color: "#15151C" }, border: { width: 1, color: "#23232E", radius: 12 }, spacing: { padding: 14 }, layout: { direction: "column", gap: 8 } },
                children: [
                  {
                    id: "c-row-top", type: "frame",
                    style: { layout: { direction: "row", justify: "between", align: "center" } },
                    children: [
                      {
                        id: "c-row-desc", type: "text",
                        bindings: { text: "$item.description" },
                        props: {},
                        style: { typography: { color: "#E5E7EB", fontSize: 16, fontWeight: "600" } },
                      },
                      {
                        id: "c-row-amount", type: "text",
                        bindings: { text: "'$' + $item.amount" },
                        props: {},
                        style: { typography: { color: "#10B981", fontSize: 16, fontWeight: "700" } },
                      },
                    ],
                  },
                  {
                    id: "c-row-bottom", type: "frame",
                    style: { layout: { direction: "row", justify: "between", align: "center" } },
                    children: [
                      {
                        id: "c-row-category", type: "text",
                        bindings: { text: "$item.category" },
                        props: {},
                        style: { typography: { color: "#9CA3AF", fontSize: 13 } },
                      },
                      {
                        id: "c-row-delete-btn", type: "button",
                        props: { text: "🗑 Delete" },
                        style: { background: { color: "#EF444422" }, spacing: { padding: [6, 12, 6, 12] }, border: { radius: 8 }, typography: { color: "#EF4444", fontSize: 13 } },
                        events: {
                          onClick: [{ actionId: "act-delete-expense" }],
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            id: "c-dash-empty", type: "text",
            props: { text: "No expenses yet. Tap + New to add one." },
            conditionalRender: "length($expenses) == 0",
            style: { typography: { color: "#9CA3AF", fontSize: 14, textAlign: "center" }, spacing: { margin: [40, 0, 0, 0] } },
          },
          {
            id: "c-dash-logout", type: "button",
            props: { text: "Sign Out" },
            style: { background: { color: "#1F1F28" }, spacing: { padding: [12, 0, 12, 0], margin: [24, 0, 0, 0] }, border: { radius: 10, width: 1, color: "#2A2A35" }, typography: { color: "#9CA3AF" } },
            events: { onClick: [{ actionId: "act-sign-out" }] },
          },
        ],
        localState: [
          {
            name: "expenses", type: "array", defaultValue: [],
            async: {
              autoFetch: true,
              source: { actionId: "act-load-expenses" },
            },
          },
        ],
        actions: [
          {
            id: "act-load-expenses", name: "Load Expenses", type: "dbQuery",
            config: {
              projectId: "69fef54b-6de6-4bbe-bf86-7dfd4b20b56a",
              sql: "SELECT * FROM expenses ORDER BY created_at DESC",
              storePath: "expenses",
            },
          },
          {
            id: "act-delete-expense", name: "Delete Expense", type: "dbDelete",
            config: {
              projectId: "69fef54b-6de6-4bbe-bf86-7dfd4b20b56a",
              table: "expenses",
              where: { id: "$item.id" },
            },
            onSuccess: [{ actionId: "act-load-expenses" }],
          },
          {
            id: "act-go-new", name: "Go New Expense", type: "navigate",
            config: { route: "scr-new-expense" },
          },
          {
            id: "act-sign-out", name: "Sign Out", type: "signOut",
            config: { url: "$_authUrl_logout" },
            onSuccess: [{ actionId: "act-go-login-after-logout" }],
          },
          {
            id: "act-go-login-after-logout", name: "Go Login", type: "navigate",
            config: { route: "scr-login" },
          },
        ],
      },
      // ── Screen 4: New Expense ──────────────────────────
      {
        id: "scr-new-expense",
        name: "New Expense",
        route: "/new-expense",
        requiresAuth: true,
        components: [
          {
            id: "c-new-title", type: "text",
            props: { text: "Add Expense" },
            style: { typography: { color: "#fff", fontSize: 24, fontWeight: "700" }, spacing: { margin: [0, 0, 24, 0] } },
          },
          {
            id: "c-new-desc", type: "input",
            props: { placeholder: "Description", inputType: "text" },
            bindings: { value: "$newExpense.description" },
            style: { border: { width: 1, color: "#2A2A35", radius: 10 }, spacing: { padding: 12, margin: [0, 0, 12, 0] }, typography: { color: "#E5E7EB" }, background: { color: "#15151C" } },
          },
          {
            id: "c-new-amount", type: "input",
            props: { placeholder: "Amount", inputType: "number" },
            bindings: { value: "$newExpense.amount" },
            style: { border: { width: 1, color: "#2A2A35", radius: 10 }, spacing: { padding: 12, margin: [0, 0, 12, 0] }, typography: { color: "#E5E7EB" }, background: { color: "#15151C" } },
          },
          {
            id: "c-new-category", type: "input",
            props: { placeholder: "Category (e.g. Food, Transport)", inputType: "text" },
            bindings: { value: "$newExpense.category" },
            style: { border: { width: 1, color: "#2A2A35", radius: 10 }, spacing: { padding: 12, margin: [0, 0, 20, 0] }, typography: { color: "#E5E7EB" }, background: { color: "#15151C" } },
          },
          {
            id: "c-new-submit", type: "button",
            props: { text: "Save Expense" },
            style: { background: { color: "#6366F1" }, spacing: { padding: [14, 0, 14, 0] }, border: { radius: 10 } },
            events: { onClick: [{ actionId: "act-create-expense" }] },
          },
          {
            id: "c-new-error", type: "text",
            bindings: { text: "$_lastError" },
            conditionalRender: "$_lastError",
            props: {},
            style: { typography: { color: "#EF4444", fontSize: 13, textAlign: "center" }, spacing: { margin: [12, 0, 0, 0] } },
          },
        ],
        localState: [
          { name: "newExpense", type: "object", defaultValue: { description: "", amount: "", category: "" } },
        ],
        actions: [
          {
            id: "act-create-expense", name: "Create Expense", type: "dbInsert",
            config: {
              projectId: "69fef54b-6de6-4bbe-bf86-7dfd4b20b56a",
              table: "expenses",
              values: {
                description: "$newExpense.description",
                amount: "$newExpense.amount",
                category: "$newExpense.category",
                user_id: "$user.id",
              },
            },
            onSuccess: [{ actionId: "act-go-back-dashboard" }],
          },
          {
            id: "act-go-back-dashboard", name: "Go Dashboard", type: "navigate",
            config: { route: "scr-dashboard" },
          },
        ],
      },
    ],
    globalState: [
      { name: "user", type: "object", defaultValue: null },
      { name: "session", type: "object", defaultValue: { token: null } },
      { name: "_lastError", type: "string", defaultValue: "" },
      { name: "_authUrl", type: "string", defaultValue: "/api/app-auth/69fef54b-6de6-4bbe-bf86-7dfd4b20b56a/login" },
      { name: "_authUrl_signup", type: "string", defaultValue: "/api/app-auth/69fef54b-6de6-4bbe-bf86-7dfd4b20b56a/signup" },
      { name: "_authUrl_logout", type: "string", defaultValue: "/api/app-auth/69fef54b-6de6-4bbe-bf86-7dfd4b20b56a/logout" },
    ],
    globalActions: [],
    workflows: [],
    navigation: {
      type: "stack",
      initialRoute: "/",
      loginRoute: "/",
    },
    auth: {
      provider: "built-in",
      loginRoute: "/",
    },
  };

  const files = mod.buildReactNativeFromSchema(schema as any, {
    projectId: "69fef54b-6de6-4bbe-bf86-7dfd4b20b56a",
    apiOrigin: "https://mintweb.mintit.pro",
    authToken: "", // will be filled by getProjectSyncToken at real export time
    appName: "Expense Tracker",
  });

  const outDir = path.join(process.cwd(), "rn-export-phase6");
  // Clean previous
  if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  for (const f of files) {
    const fp = path.join(outDir, f.path);
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, f.content, "utf-8");
  }
  console.log(`✓ Wrote ${files.length} files to ${outDir}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
