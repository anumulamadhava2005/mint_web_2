"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import MLogo from "@/app/M.png";
import {
  LayoutDashboard, GitBranch, Database, Download, Lightbulb,
  PenTool, Cpu, Box, Server, Repeat, Code, Zap, ArrowRight,
  AlertTriangle, LogIn, TerminalSquare, Smartphone, Monitor,
  Layers, Package, Play, Settings, Users, FileCode, Rocket,
  ChevronRight, Hash, Workflow, MousePointer, Type, Image as ImageIcon,
  Square, Circle, Minus, Copy, Scissors, RotateCcw, RotateCw,
  ZoomIn, Lock, Unlock, Eye, EyeOff, AlignLeft, Columns,
  Palette, Receipt, ShieldCheck
} from "lucide-react";

const sections = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "getting-started", label: "Getting Started", icon: Rocket },
  { id: "editor", label: "Editor", icon: PenTool },
  { id: "backend", label: "Backend", icon: Cpu },
  { id: "export", label: "Export & Build", icon: Download },
  { id: "sync", label: "Live Sync", icon: Repeat },
  { id: "collab", label: "Collaboration", icon: Users },
  { id: "actions", label: "Actions Config", icon: TerminalSquare },
  { id: "examples", label: "Examples", icon: Lightbulb },
  { id: "shortcuts", label: "Shortcuts", icon: Zap },
];

// Examples shown in the left sidebar of the Examples tab.
const EXAMPLES = [
  { id: "expense-tracker", label: "Expense Tracker", icon: Receipt },
];

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[26px] font-semibold tracking-tight text-[#f6f4f0] mb-3">{children}</h2>;
}

function SectionSub({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] text-[#a8a6a2] leading-relaxed mb-7">{children}</p>;
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[17px] font-medium text-[#f6f4f0] mt-8 mb-3">{children}</h3>;
}

function Tip({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-l-[3px] border-blue-500/50 bg-blue-500/[0.06] rounded-r-lg px-4 py-3 my-5 text-[14px] leading-relaxed text-[#e0deda]">
      <strong className="font-semibold">{title}</strong> {children}
    </div>
  );
}

function Warning({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-l-[3px] border-amber-500/50 bg-amber-500/[0.06] rounded-r-lg px-4 py-3 my-5 text-[14px] leading-relaxed text-[#e0deda]">
      <strong className="font-semibold">{title}</strong> {children}
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-3 my-3 font-mono text-[13px] leading-[1.7] text-[#e0deda] whitespace-pre-wrap overflow-x-auto">
      {children}
    </pre>
  );
}

function StepList({ steps }: { steps: { title: string; desc: React.ReactNode }[] }) {
  return (
    <div className="flex flex-col gap-0">
      {steps.map((s, i) => (
        <div key={i} className="flex gap-4 py-4 border-b border-white/[0.04] last:border-b-0">
          <div className="w-[28px] h-[28px] rounded-full bg-blue-500/10 text-blue-400 text-[13px] font-semibold flex items-center justify-center flex-shrink-0 mt-0.5">
            {i + 1}
          </div>
          <div>
            <h4 className="text-[15px] font-medium text-[#f6f4f0] mb-1">{s.title}</h4>
            <div className="text-[14px] text-[#a8a6a2] leading-relaxed">{s.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Card({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
      <Icon size={22} className="text-blue-400 mb-3" />
      <h3 className="text-[15px] font-medium text-[#f6f4f0] mb-2">{title}</h3>
      <p className="text-[13px] text-[#a8a6a2] leading-relaxed">{children}</p>
    </div>
  );
}

function PropRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-white/[0.04] last:border-b-0 text-[13px]">
      <span className="text-[#a8a6a2]">{label}</span>
      <code className="font-mono text-[12px] text-[#e0deda]">{value}</code>
    </div>
  );
}

function FrameworkGrid() {
  const fws = [
    { name: "React", icon: Code, desc: "JSX/TSX components with hooks" },
    { name: "Next.js", icon: Server, desc: "App Router pages and layouts" },
    { name: "Vue", icon: Layers, desc: "Single File Components (.vue)" },
    { name: "Svelte", icon: Zap, desc: "Svelte components (.svelte)" },
    { name: "React Native", icon: Smartphone, desc: "Expo Router mobile app" },
    { name: "Flutter", icon: Palette, desc: "Dart widgets and screens" },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 my-4">
      {fws.map(f => (
        <div key={f.name} className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 flex items-start gap-3">
          <f.icon size={18} className="text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-[14px] font-medium text-[#f6f4f0]">{f.name}</div>
            <div className="text-[12px] text-[#a8a6a2] mt-0.5">{f.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
// ── Small helpers used by the example guides ──────────────────
function Tag({ children, color = "blue" }: { children: React.ReactNode; color?: string }) {
  const map: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-300 border-blue-500/20",
    emerald: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    violet: "bg-violet-500/10 text-violet-300 border-violet-500/20",
    rose: "bg-rose-500/10 text-rose-300 border-rose-500/20",
  };
  return <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-md border ${map[color] || map.blue}`}>{children}</span>;
}

function TableCard({ name, badge, fields }: { name: string; badge?: string; fields: { col: string; type: string }[] }) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Database size={15} className="text-emerald-400" />
        <h4 className="text-[14px] font-semibold text-[#f6f4f0]">{name}</h4>
        {badge && <Tag color="emerald">{badge}</Tag>}
      </div>
      {fields.map((f) => <PropRow key={f.col} label={f.col} value={f.type} />)}
    </div>
  );
}

function ScreenCard({ n, title, route, roles, children }: { n: number; title: string; route: string; roles?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5 mb-3">
      <div className="flex items-center gap-2.5 mb-2 flex-wrap">
        <span className="w-[24px] h-[24px] rounded-full bg-blue-500/10 text-blue-400 text-[12px] font-semibold flex items-center justify-center">{n}</span>
        <h4 className="text-[15px] font-semibold text-[#f6f4f0]">{title}</h4>
        <code className="font-mono text-[12px] text-emerald-400/90">{route}</code>
        {roles && <Tag color="amber">{roles}</Tag>}
      </div>
      <div className="text-[13px] text-[#a8a6a2] leading-relaxed pl-[34px]">{children}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Example guide: Expense Approval Tracker
// ═══════════════════════════════════════════════════════════════
function ExpenseTrackerGuide() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
          <Receipt size={22} className="text-white" />
        </div>
        <div>
          <SectionHeading>Expense Approval Tracker</SectionHeading>
        </div>
      </div>
      <SectionSub>
        A complete, role-based expense app with a <strong>live, database-driven approval pipeline</strong>. Employees submit expenses; managers and finance approve or reject them in turn; admins edit the approval steps at runtime. This guide rebuilds the exact app end-to-end — database, state, actions, screens, navigation, and export.
      </SectionSub>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <Card icon={ShieldCheck} title="Real auth">Email/password sign-in &amp; sign-up against the platform. Roles come from the authenticated DB user — never a form picker.</Card>
        <Card icon={Workflow} title="Live approval flow">The next approval step is read fresh from <code className="text-[#e0deda]">workflow_steps</code> on every action. Add a step in the DB and the flow changes with no re-export.</Card>
        <Card icon={Users} title="Role-gated UI">Employee, Manager, Finance, Admin. Buttons, screens and routes show/hide by role.</Card>
      </div>

      <Tip title="The whole app is data.">Everything below lives in one runtime schema (screens, state, actions, DB, navigation). You author it in the editor&apos;s <strong>Backend → UI / DB / State / Actions / Flows</strong> tabs; the exporter turns it into a React Native (Expo) app.</Tip>

      <SubHeading>Build order</SubHeading>
      <StepList steps={[
        { title: "Model the database", desc: "Create 4 tables and Deploy the migrations." },
        { title: "Declare global state", desc: "Two stores: user (who is logged in) and local (per-screen scratch space)." },
        { title: "Write the actions", desc: "Auth, data reads (fetch), and writes (mutate) — including the live next-step logic and post-action navigation." },
        { title: "Lay out the screens", desc: "9 screens of components, each bound to state and wired to actions." },
        { title: "Configure navigation", desc: "Stack navigator with auth + role guards." },
        { title: "Export & run", desc: "Generate the Expo app and run it." },
      ]} />

      {/* ── 1. DATABASE ── */}
      <SubHeading>1 · Database</SubHeading>
      <p className="text-[14px] text-[#a8a6a2] mb-3">Open <strong>Backend → DB</strong>. Add each table, then its fields. Every table gets an auto <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[12px]">id (uuid)</code> primary key and <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[12px]">created_at / updated_at</code> when <strong>Timestamps</strong> is on. Click <strong>Deploy</strong> to run the migrations.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <TableCard name="users" fields={[
          { col: "email", type: "text · unique · required" },
          { col: "name", type: "text" },
          { col: "role", type: "text · default 'employee'" },
          { col: "password_hash", type: "text" },
        ]} />
        <TableCard name="expenses" fields={[
          { col: "title", type: "text · required" },
          { col: "description", type: "text" },
          { col: "amount", type: "float · required" },
          { col: "category", type: "text" },
          { col: "receipt_url", type: "text" },
          { col: "status", type: "text · default 'draft'" },
          { col: "current_step_key", type: "text" },
          { col: "employee_id", type: "uuid" },
        ]} />
        <TableCard name="workflow_steps" badge="drives the flow" fields={[
          { col: "step_key", type: "text · unique · required" },
          { col: "label", type: "text · required" },
          { col: "approver_role", type: "text · required" },
          { col: "position", type: "integer · required" },
          { col: "active", type: "boolean · default true" },
        ]} />
        <TableCard name="approval_events" fields={[
          { col: "expense_id", type: "uuid · required" },
          { col: "step_key", type: "text · required" },
          { col: "label", type: "text" },
          { col: "status", type: "text · required" },
          { col: "actor_id", type: "uuid" },
          { col: "comment", type: "text" },
        ]} />
      </div>
      <p className="text-[13px] text-[#a8a6a2] mb-3">Seed <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[12px]">workflow_steps</code> with the approval ladder (order = <code className="text-[#e0deda]">position</code>):</p>
      <CodeBlock>{`position | step_key     | label                | approver_role
   1     | manager      | Manager Approval     | manager
   2     | finance      | Finance Approval     | finance`}</CodeBlock>
      <Tip title="Why a table, not code?">Because the approval order is rows, an admin can insert &quot;department_head&quot; between Manager and Finance at runtime and every expense instantly follows the new ladder — no rebuild.</Tip>

      {/* ── 2. STATE ── */}
      <SubHeading>2 · State management</SubHeading>
      <p className="text-[14px] text-[#a8a6a2] mb-3">Open <strong>Backend → State</strong>. Two stores are enough — the app keeps server data in <code className="text-[#e0deda]">local</code> and identity in <code className="text-[#e0deda]">user</code>.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2"><h4 className="text-[14px] font-semibold text-[#f6f4f0]">user</h4><Tag color="violet">global · object</Tag></div>
          <p className="text-[13px] text-[#a8a6a2] leading-relaxed">The signed-in account, written by <code className="text-[#e0deda]">signIn/signUp</code>. <code className="text-[#e0deda]">$user.role</code> drives every role-gated control.</p>
        </div>
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2"><h4 className="text-[14px] font-semibold text-[#f6f4f0]">local</h4><Tag color="blue">local · object</Tag></div>
          <p className="text-[13px] text-[#a8a6a2] leading-relaxed">Scratch space: <code className="text-[#e0deda]">$local.form</code> (inputs), <code className="text-[#e0deda]">$local.expenses</code>, <code className="text-[#e0deda]">$local.steps</code>, <code className="text-[#e0deda]">$local.activeExpense</code>, <code className="text-[#e0deda]">$local.authError</code>.</p>
        </div>
      </div>
      <p className="text-[13px] text-[#a8a6a2] mb-2">Bind any component property to state with a <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[12px]">$</code> expression. Inputs use <code className="text-[#e0deda]">inputBind</code> (two-way), text uses <code className="text-[#e0deda]">textBind</code>, lists/tables use <code className="text-[#e0deda]">dataSource</code>:</p>
      <CodeBlock>{`$local.form.email        → two-way bind a text input
$user.role               → show the signed-in role
$local.expenses          → feed a Data Table / Chart
$local.activeExpense.title  → detail field
repeatFor: $local.steps as step   → render a list row per record`}</CodeBlock>

      {/* ── 3. ACTIONS ── */}
      <SubHeading>3 · Actions</SubHeading>
      <p className="text-[14px] text-[#a8a6a2] mb-3">Open <strong>Backend → Actions</strong>. Each action is <code className="text-[#e0deda]">{`{ name, type, config }`}</code>. Reads are <Tag color="blue">fetch</Tag>, writes are <Tag color="amber">mutate</Tag>, auth uses the dedicated <Tag color="emerald">signIn/signUp/signOut</Tag> types. A button runs an action via <code className="text-[#e0deda]">onClick: &quot;actionName&quot;</code>.</p>

      <h4 className="text-[15px] font-medium text-[#f6f4f0] mt-6 mb-2">Authentication <Tag color="emerald">real</Tag></h4>
      <p className="text-[14px] text-[#a8a6a2] mb-3">These POST to the platform auth endpoints with server-side password verification, store the returned user, and navigate on success. On failure they set <code className="text-[#e0deda]">$local.authError</code> and stay put.</p>
      <CodeBlock>{`signIn  → { type: "signIn",  config: {
  url: "/api/login",
  email: "$local.form.email", password: "$local.form.password",
  userPath: "user", tokenPath: "session.token",
  navigateTo: "dashboard"        // only on success
}}
signUp  → { type: "signUp",  config: { url: "/api/signup", name: "$local.form.name", …, navigateTo: "dashboard" }}
signOut → { type: "signOut", config: { url: "/api/logout", userPath: "user", navigateTo: "login" }}`}</CodeBlock>
      <Warning title="No fake roles.">The role is whatever the database says for that account — the sign-in form never lets the user pick it. That&apos;s the difference between a demo and real auth.</Warning>

      <h4 className="text-[15px] font-medium text-[#f6f4f0] mt-6 mb-2">Reads <Tag color="blue">fetch</Tag></h4>
      <p className="text-[14px] text-[#a8a6a2] mb-3">A <code className="text-[#e0deda]">fetch</code> with <code className="text-[#e0deda]">sql</code> runs against the project DB and writes rows to <code className="text-[#e0deda]">storePath</code>. Call them from a screen&apos;s <code className="text-[#e0deda]">onMount</code>.</p>
      <CodeBlock>{`loadExpenses → SELECT * FROM expenses ORDER BY created_at DESC      → $local.expenses
loadSteps    → SELECT * FROM workflow_steps ORDER BY position ASC  → $local.steps
loadEvents   → SELECT * FROM approval_events WHERE expense_id = $1  → $local.events
                params: ["$local.activeExpense.id"]
loadDashboard→ SELECT COUNT(*) FILTER (WHERE status LIKE 'pending_%') AS pending_count, … → $local.*`}</CodeBlock>

      <h4 className="text-[15px] font-medium text-[#f6f4f0] mt-6 mb-2">Writes <Tag color="amber">mutate</Tag> + the live step</h4>
      <p className="text-[14px] text-[#a8a6a2] mb-3">The heart of the app. Instead of hard-coding &quot;manager → finance&quot;, the SQL <em>reads the next step from the table</em> with a sub-select, so the ladder is whatever the rows say.</p>
      <CodeBlock>{`-- reusable sub-selects
FIRST_STEP      = (SELECT step_key FROM workflow_steps
                   WHERE active ORDER BY position ASC LIMIT 1)
NEXT_STEP_AFTER = (SELECT step_key FROM workflow_steps
                   WHERE active AND position >
                     (SELECT position FROM workflow_steps WHERE step_key = $2)
                   ORDER BY position ASC LIMIT 1)

submitExpense (mutate):
  INSERT INTO expenses (title, …, status, current_step_key, employee_id)
  VALUES ($1, …, COALESCE('pending_' || FIRST_STEP, 'approved'), FIRST_STEP, $6)
  params: ["$local.form.title", …, "$user.id"]
  also: "SET $local.form = []"      navigateTo: "my-expenses"

approveExpense (mutate):     // on the details screen
  UPDATE expenses
  SET status = COALESCE('pending_' || NEXT_STEP_AFTER, 'approved'),
      current_step_key = NEXT_STEP_AFTER
  WHERE id = $1
  params: ["$local.activeExpense.id", "$local.activeExpense.current_step_key"]
  also: "… INSERT INTO approval_events …; CALL loadEvents"   navigateTo: "dashboard"`}</CodeBlock>
      <p className="text-[13px] text-[#a8a6a2] mb-3">The list-row variants <code className="text-[#e0deda]">approveExpenseFromList</code>, <code className="text-[#e0deda]">rejectExpenseFromList</code> and <code className="text-[#e0deda]">markReimbursed</code> do the same write for <code className="text-[#e0deda]">$expense</code> (the loop item) and then re-query the list — they intentionally <strong>stay on the same screen</strong> (no <code className="text-[#e0deda]">navigateTo</code>). <code className="text-[#e0deda]">addWorkflowStep</code> inserts a row into <code className="text-[#e0deda]">workflow_steps</code> and refreshes.</p>

      <h4 className="text-[15px] font-medium text-[#f6f4f0] mt-6 mb-2">Navigation from actions</h4>
      <p className="text-[14px] text-[#a8a6a2] mb-3">Add <code className="text-[#e0deda]">navigateTo: &quot;screenId&quot;</code> to any action&apos;s config to route after it succeeds. Buttons that only navigate use <code className="text-[#e0deda]">onClick: &quot;navigate:screenId&quot;</code>.</p>
      <div className="space-y-2 mb-4">
        <PropRow label="signIn / signUp" value="navigateTo: dashboard" />
        <PropRow label="signOut" value="navigateTo: login" />
        <PropRow label="submitExpense" value="navigateTo: my-expenses" />
        <PropRow label="approveExpense" value="navigateTo: dashboard" />
        <PropRow label='button onClick="navigate:workflow-builder"' value="push that screen" />
      </div>

      {/* ── 4. SCREENS ── */}
      <SubHeading>4 · Screens &amp; UI</SubHeading>
      <p className="text-[14px] text-[#a8a6a2] mb-4">Open <strong>Backend → UI</strong>, pick a screen (synced from your canvas frames), and drop components from the palette. Each component has bindings; each screen has <code className="text-[#e0deda]">onMount</code> actions and optional <code className="text-[#e0deda]">requiredRoles</code>.</p>

      <ScreenCard n={1} title="Login" route="/login">
        Inputs bound to <code className="text-[#e0deda]">$local.form.name/email/password</code>; <strong>Sign In</strong> → <code className="text-[#e0deda]">signIn</code>, <strong>Create Account</strong> → <code className="text-[#e0deda]">signUp</code>; a text bound to <code className="text-[#e0deda]">$local.authError</code> (visible only when set).
      </ScreenCard>
      <ScreenCard n={2} title="Dashboard" route="/dashboard">
        Three stat cards bound to <code className="text-[#e0deda]">$local.pendingCount / approvedCount / totalAmount</code>; role-gated nav buttons (Submit, Review Approvals, Finance, Workflow Builder); <strong>Sign Out</strong> → <code className="text-[#e0deda]">signOut</code>. <code className="text-[#e0deda]">onMount: loadDashboard</code>.
      </ScreenCard>
      <ScreenCard n={3} title="Submit Expense" route="/submit-expense" roles="employee · admin">
        Form inputs → <code className="text-[#e0deda]">$local.form.*</code>, a category <strong>Dropdown</strong>, a <strong>File Upload</strong> for the receipt; <strong>Submit</strong> → <code className="text-[#e0deda]">submitExpense</code> (routes to My Expenses).
      </ScreenCard>
      <ScreenCard n={4} title="My Expenses" route="/my-expenses">
        A <strong>Data Table</strong> bound to <code className="text-[#e0deda]">$local.expenses</code> with Title / Amount (currency) / Category / Status (chip) / Date columns. <code className="text-[#e0deda]">onMount: loadExpenses</code>.
      </ScreenCard>
      <ScreenCard n={5} title="Expense Details" route="/expense-details">
        Card of fields from <code className="text-[#e0deda]">$local.activeExpense.*</code>, a <strong>Status Chip</strong>, and a <strong>Timeline</strong> of <code className="text-[#e0deda]">$local.events</code> highlighting the current step. <code className="text-[#e0deda]">onMount: loadEvents</code>.
      </ScreenCard>
      <ScreenCard n={6} title="Manager Approvals" route="/manager-approvals" roles="manager · admin">
        A <strong>List</strong> <code className="text-[#e0deda]">repeatFor $local.pendingExpenses as expense</code>; each row shows title/amount/status with <strong>Approve</strong>/<strong>Reject</strong> → the <code className="text-[#e0deda]">…FromList</code> actions. <code className="text-[#e0deda]">onMount: loadPendingManager</code>.
      </ScreenCard>
      <ScreenCard n={7} title="Finance Approvals" route="/finance-approvals" roles="finance · admin">
        Same pattern, plus <strong>Mark Reimbursed</strong> → <code className="text-[#e0deda]">markReimbursed</code>. <code className="text-[#e0deda]">onMount: loadPendingFinance</code>.
      </ScreenCard>
      <ScreenCard n={8} title="Workflow Builder" route="/workflow-builder" roles="admin">
        Lists the live <code className="text-[#e0deda]">$local.steps</code>; a form (step_key / label / approver_role) → <code className="text-[#e0deda]">addWorkflowStep</code> inserts a new approval stage at runtime.
      </ScreenCard>
      <ScreenCard n={9} title="Component Gallery" route="/component-gallery">
        A test bench rendering every component — Stat Card, Chart, Camera→Image, Data Table, Timeline, Dropdown, Date, Checkbox, Switch, File Upload, Status Chip — bound to real data via <code className="text-[#e0deda]">loadExpenses</code> + <code className="text-[#e0deda]">loadSteps</code>.
      </ScreenCard>

      {/* ── 5. NAVIGATION ── */}
      <SubHeading>5 · Navigation</SubHeading>
      <p className="text-[14px] text-[#a8a6a2] mb-3">A <strong>stack</strong> navigator with the login screen as the entry. Routes can require auth and a role; unauthorized roles never see the screen (and its nav buttons are hidden via <code className="text-[#e0deda]">requiredRoles</code>).</p>
      <CodeBlock>{`navigation: { type: "stack", initialRoute: "/login", routes: [
  { path: "/login",            screenId: "login" },
  { path: "/dashboard",        screenId: "dashboard",        auth: true },
  { path: "/submit-expense",   screenId: "submit-expense",   auth: true, roles: ["employee","admin"] },
  { path: "/my-expenses",      screenId: "my-expenses",      auth: true },
  { path: "/expense-details",  screenId: "expense-details",  auth: true },
  { path: "/manager-approvals",screenId: "manager-approvals",auth: true, roles: ["manager","admin"] },
  { path: "/finance-approvals",screenId: "finance-approvals",auth: true, roles: ["finance","admin"] },
  { path: "/workflow-builder", screenId: "workflow-builder", auth: true, roles: ["admin"] },
  { path: "/component-gallery",screenId: "component-gallery",auth: true },
]}`}</CodeBlock>

      {/* ── 6. EXPORT ── */}
      <SubHeading>6 · Export &amp; run</SubHeading>
      <p className="text-[14px] text-[#a8a6a2] mb-3">Because the screens have authored components, exporting <strong>React Native</strong> uses the schema exporter — a full Expo Router app whose screens, actions and live DB bridge come straight from the runtime schema.</p>
      <CodeBlock>{`unzip expense-approval-react-native.zip -d expense-app
cd expense-app
npm install
npx expo start   # scan the QR code with Expo Go`}</CodeBlock>
      <Tip title="One source of truth.">Change a workflow step in the DB, or edit a screen in the editor and re-commit — the running app reflects it. The design, the logic and the data are the same schema all the way down.</Tip>
    </div>
  );
}

export default function DocsPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [activeExample, setActiveExample] = useState("expense-tracker");

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f6f4f0] antialiased selection:bg-white/20">
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-6 lg:px-10 py-4 max-w-[1600px] mx-auto">
          <Link href="/home" className="flex items-center gap-3 group">
            <Image src={MLogo} alt="mint" width={28} height={28} className="rounded-[6px]" />
            <span className="text-lg font-semibold tracking-tight">mint <span className="text-white/40 font-normal">Docs</span></span>
          </Link>
          <div className="hidden lg:flex items-center gap-4">
            <Link href="/login" className="text-[13px] font-medium text-[#a8a6a2] hover:text-[#f6f4f0] transition-colors">Platform</Link>
            <Link href="/signup" className="text-[13px] font-semibold bg-[#f6f4f0] text-[#0a0a0a] px-4 py-1.5 rounded-full hover:bg-white transition-all">Get Started</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-[1600px] mx-auto pt-[90px] px-6 lg:px-10 pb-32">
        <div className="max-w-[820px] mx-auto">
          {/* Tab navigation */}
          <div className="flex gap-1.5 flex-wrap mb-8 pb-4 border-b border-white/[0.04]">
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveTab(s.id)}
                className={`text-[13px] px-3.5 py-2 rounded-md border flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === s.id
                    ? "border-white/[0.15] bg-white/[0.05] text-[#f6f4f0] font-medium"
                    : "border-white/[0.06] bg-transparent text-[#a8a6a2] hover:bg-white/[0.03] hover:text-[#f6f4f0]"
                }`}
              >
                <s.icon size={15} />
                {s.label}
              </button>
            ))}
          </div>

          {/* ─── OVERVIEW ─── */}
          {activeTab === "overview" && (
            <div>
              <SectionHeading>What is Mint?</SectionHeading>
              <SectionSub>
                Mint is a visual application builder. You design your UI on a canvas, configure your backend logic visually, and Mint generates production-ready source code across six frameworks. You own the code — export it, modify it, deploy it anywhere.
              </SectionSub>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                <Card icon={Box} title="Visual Canvas">Design screens on a Figma-like editor. Every element maps directly to real, readable code.</Card>
                <Card icon={Cpu} title="Runtime Engine">Lightweight engine that manages state, data bindings, and actions between your UI and backend.</Card>
                <Card icon={Server} title="Auto Backend">Define database tables visually. Mint generates the schema, API routes, and CRUD operations.</Card>
                <Card icon={GitBranch} title="Workflows">Build complex business logic as visual flowcharts — conditions, loops, API calls, all without code.</Card>
                <Card icon={Repeat} title="Live Sync">Push canvas changes to your running app instantly. The sync daemon patches your code via HMR.</Card>
                <Card icon={Code} title="6 Frameworks">Export to React, Next.js, Vue, Svelte, React Native (Expo), or Flutter. Full project scaffolds included.</Card>
              </div>

              <SubHeading>How it works</SubHeading>
              <StepList steps={[
                { title: "Design your screens", desc: "Draw frames on the canvas. Each frame becomes a route in your app. Add shapes, text, buttons, images, and forms." },
                { title: "Add logic and data", desc: "Open the Backend Panel to define state variables, actions, database tables, and workflows. Bind data to UI elements." },
                { title: "Commit or export", desc: "Click Commit to generate versioned code, or Export to download a ZIP. Your design becomes a complete, runnable project." },
                { title: "Run and iterate", desc: "Install dependencies, start your dev server. Enable Live Sync to push design changes without rebuilding." },
              ]} />

              <Tip title="Mental model:">Think of Mint as three layers — the Canvas (what users see), the Runtime (logic), and the Backend (data). All three stay in sync automatically.</Tip>
            </div>
          )}

          {/* ─── GETTING STARTED ─── */}
          {activeTab === "getting-started" && (
            <div>
              <SectionHeading>Getting Started</SectionHeading>
              <SectionSub>Create your account, set up your first project, and export working code in under 5 minutes.</SectionSub>

              <SubHeading>Create an account</SubHeading>
              <StepList steps={[
                { title: "Sign up", desc: "Go to the signup page. Enter your name, email, and password. Complete the onboarding wizard — tell us what you're building, your industry, and team size." },
                { title: "Create a project", desc: <>From the dashboard, click <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">New Project</code>. Give it a name and optional description.</> },
                { title: "Open the editor", desc: "Click your project to open the visual editor. You'll see a blank canvas ready for your first frame." },
              ]} />

              <SubHeading>Your first screen</SubHeading>
              <StepList steps={[
                { title: "Draw a frame", desc: <>Press <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">F</code> and drag on the canvas. This frame is your first screen — name it &quot;Home&quot; in the layers panel.</> },
                { title: "Add elements", desc: <>Use the toolbar: <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">R</code> for rectangles, <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">T</code> for text, <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">O</code> for ellipses. Drag elements into your frame.</> },
                { title: "Style with the sidebar", desc: "Select any element to see its properties in the right panel — fill color, border, typography, layout direction, padding, and effects." },
                { title: "Export your project", desc: <>Click <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">Export</code> in the toolbar, pick a framework (e.g. React Native), and download the ZIP.</> },
              ]} />

              <SubHeading>Run the exported code</SubHeading>
              <CodeBlock>{`# Extract the ZIP
unzip my-app-react-native.zip -d my-app
cd my-app

# Install dependencies
npm install

# Start the development server
npx expo start

# Or for web frameworks:
npm run dev`}</CodeBlock>

              <Tip title="Expo Go:">For React Native exports, scan the QR code with the Expo Go app on your phone to see your design running as a real mobile app.</Tip>
            </div>
          )}

          {/* ─── EDITOR ─── */}
          {activeTab === "editor" && (
            <div>
              <SectionHeading>The Visual Editor</SectionHeading>
              <SectionSub>The editor is where you design your app. It works like Figma — draw shapes, arrange layouts, style elements — but everything maps to real code components.</SectionSub>

              <SubHeading>Canvas basics</SubHeading>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
                  <h4 className="text-[15px] font-medium text-[#f6f4f0] mb-3">Frames = Screens</h4>
                  <p className="text-[13px] text-[#a8a6a2] leading-relaxed mb-2">Every top-level frame becomes a route in your app. The frame name sets the URL path.</p>
                  <PropRow label="Home" value="→ /" />
                  <PropRow label="UserProfile" value="→ /user-profile" />
                  <PropRow label="Settings" value="→ /settings" />
                </div>
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
                  <h4 className="text-[15px] font-medium text-[#f6f4f0] mb-3">Shape tools</h4>
                  <PropRow label="Frame" value="F" />
                  <PropRow label="Rectangle" value="R" />
                  <PropRow label="Ellipse" value="O" />
                  <PropRow label="Text" value="T" />
                  <PropRow label="Line" value="L" />
                  <PropRow label="Pen (vector)" value="P" />
                </div>
              </div>

              <SubHeading>Design properties</SubHeading>
              <p className="text-[14px] text-[#a8a6a2] mb-3">Select any element to configure it in the right sidebar.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
                  <h4 className="text-[14px] font-medium text-[#f6f4f0] mb-3">Layout</h4>
                  <PropRow label="Direction" value="row / column" />
                  <PropRow label="Align" value="start / center / end" />
                  <PropRow label="Justify" value="between / around / evenly" />
                  <PropRow label="Gap" value="px value" />
                  <PropRow label="Padding" value="per-side control" />
                </div>
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
                  <h4 className="text-[14px] font-medium text-[#f6f4f0] mb-3">Appearance</h4>
                  <PropRow label="Fill" value="solid / gradient" />
                  <PropRow label="Border" value="width, color, radius" />
                  <PropRow label="Shadow" value="x, y, blur, spread" />
                  <PropRow label="Opacity" value="0–100%" />
                  <PropRow label="Blur" value="background / layer" />
                </div>
              </div>

              <SubHeading>Layers panel</SubHeading>
              <p className="text-[14px] text-[#a8a6a2] mb-3">The left panel shows your layer hierarchy. Drag to reorder, nest elements by dragging onto frames. Right-click for options: rename, duplicate, delete, lock, hide.</p>

              <SubHeading>Interactions & prototyping</SubHeading>
              <p className="text-[14px] text-[#a8a6a2] mb-3">Connect frames with interaction links to create click-through prototypes. Select an element, choose an event (tap, hover), and set the target frame and transition animation. Use the Prototype Viewer to test flows without exporting.</p>

              <Warning title="Frame naming matters:">The frame name becomes the URL route. Renaming a frame after creating navigation actions can break those references. Name frames intentionally from the start.</Warning>
            </div>
          )}

          {/* ─── BACKEND ─── */}
          {activeTab === "backend" && (
            <div>
              <SectionHeading>Backend Panel</SectionHeading>
              <SectionSub>The Backend Panel is where you configure everything behind the UI — state management, actions, database tables, and workflows. Open it from the bottom toolbar in the editor.</SectionSub>

              <SubHeading>State management</SubHeading>
              <p className="text-[14px] text-[#a8a6a2] mb-3">State holds your app&apos;s data. Define variables with a name, type, and default value.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
                  <h4 className="text-[14px] font-medium text-[#f6f4f0] mb-2">Global state</h4>
                  <p className="text-[13px] text-[#a8a6a2] leading-relaxed">Accessible from any screen. Use for auth tokens, user data, app settings. Enable <strong>Persist</strong> to save to localStorage automatically.</p>
                </div>
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
                  <h4 className="text-[14px] font-medium text-[#f6f4f0] mb-2">Local state</h4>
                  <p className="text-[13px] text-[#a8a6a2] leading-relaxed">Scoped to one screen. Use for form values, loading flags, modal visibility. Destroyed when the screen unmounts.</p>
                </div>
              </div>

              <SubHeading>Data bindings</SubHeading>
              <p className="text-[14px] text-[#a8a6a2] mb-3">Connect state to UI using expressions. Click the link icon next to any component property, then enter an expression:</p>
              <CodeBlock>{`$global.user.name          → global state
$local.isLoading           → local state
$route.params.id           → URL parameter
$local.count > 0 ? "Items" : "Empty"  → ternary`}</CodeBlock>

              <SubHeading>Actions</SubHeading>
              <p className="text-[14px] text-[#a8a6a2] mb-3">Actions are operations triggered by events (tap, submit, mount). Types include:</p>
              <div className="space-y-2 mb-4">
                <PropRow label="setState / updateState / resetState" value="Modify state variables" />
                <PropRow label="navigate / goBack" value="Change screens" />
                <PropRow label="apiCall / fetch" value="HTTP requests" />
                <PropRow label="showToast / showAlert" value="UI feedback" />
                <PropRow label="condition / loop / delay" value="Logic control" />
                <PropRow label="login / logout / register" value="Auth operations" />
              </div>

              <SubHeading>Database</SubHeading>
              <StepList steps={[
                { title: "Enable the database", desc: "Open the Database tab and click Enable. Mint provisions a PostgreSQL schema for your project." },
                { title: "Create tables", desc: "Click New Table. Define columns with name, type (text, integer, boolean, uuid, json, timestamp), and constraints." },
                { title: "Set relations", desc: "Define one-to-many or many-to-many relations between tables. Mint generates foreign keys and join tables." },
                { title: "Access data", desc: <>Use <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">fetch</code> actions with your table&apos;s API route, or <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">DB Query</code> nodes in workflows for raw SQL.</> },
              ]} />

              <SubHeading>Workflows</SubHeading>
              <p className="text-[14px] text-[#a8a6a2] mb-3">For complex logic, use the visual workflow builder. Drag nodes from the palette, connect them with edges, and configure each node&apos;s parameters.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                {["If / Else", "Switch", "Loop", "ForEach", "Map", "Filter", "Delay", "Debounce", "API Call", "DB Query", "Navigate", "Toast"].map(n => (
                  <div key={n} className="bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2 text-[13px] text-[#a8a6a2] text-center">{n}</div>
                ))}
              </div>
              <Tip title="When to use Workflows vs Actions:">Use action JSON for simple, single-step logic. Switch to Workflows when you need branching, loops, or more than 3 chained steps.</Tip>
            </div>
          )}

          {/* ─── ACTIONS CONFIG ─── */}
          {activeTab === "actions" && (
            <div>
              <SectionHeading>Actions Configuration Guide</SectionHeading>
              <SectionSub>This guide describes how to configure Actions in a Mint Web project. Actions represent the behavior and business logic of your application—connecting user events with state modifications, backend API calls, database operations, and screen routing.</SectionSub>

              <SubHeading>1. Action Schema Structure</SubHeading>
              <p className="text-[14px] text-[#a8a6a2] mb-3">In the project configuration, actions are defined as an array under <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">globalActions</code> (app-wide) or <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">actions</code> (screen-specific). Each action object follows this schema:</p>
              <CodeBlock>{`{
  "id": "uuid-string",
  "name": "actionFunctionName",
  "type": "setState | fetch | mutate | navigate | custom",
  "config": {
    // Type-specific configurations
  }
}`}</CodeBlock>
              <div className="space-y-2 mb-6 mt-4">
                <PropRow label="id" value="Unique identifier for the action." />
                <PropRow label="name" value="The JavaScript function name exposed by the runtime hook." />
                <PropRow label="type" value="The category of operation to perform." />
                <PropRow label="config" value="Key-value map defining parameters for the specific action type." />
              </div>

              <SubHeading>2. Action Types & Configurations</SubHeading>
              
              <h4 className="text-[15px] font-medium text-[#f6f4f0] mt-6 mb-2">2.1. fetch / mutate</h4>
              <p className="text-[14px] text-[#a8a6a2] mb-3">Handles REST API requests as well as direct PostgreSQL database queries. The runtime distinguishes between them based on the presence and prefix of the <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">url</code> config property.</p>
              
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5 mb-4">
                <h5 className="text-[14px] font-semibold text-blue-400 mb-2">Option A: REST API Calls</h5>
                <p className="text-[13px] text-[#a8a6a2] mb-3">If <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">url</code> is specified and does <strong>not</strong> contain <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">/api/db</code>, the runtime performs an HTTP REST request.</p>
                <CodeBlock>{`{
  "id": "fetch-todos",
  "name": "getTodos",
  "type": "fetch",
  "config": {
    "url": "/api/todos/:status",
    "method": "GET",
    "body": null,
    "storePath": "todosList",
    "onSuccess": "SET $loading = false; SET $items = $result.rows",
    "onError": "SET $error = 'Failed to load'"
  }
}`}</CodeBlock>
                <div className="space-y-2 mt-4">
                  <PropRow label="url" value="The target endpoint template." />
                  <PropRow label="method" value="HTTP request verb (GET, POST, etc.)." />
                  <PropRow label="body" value="Optional request payload object." />
                  <PropRow label="storePath" value="Optional path in state where response is written." />
                  <PropRow label="onSuccess / onError" value="Statements executed based on success/fail." />
                </div>
              </div>

              <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5 mb-6">
                <h5 className="text-[14px] font-semibold text-amber-400 mb-2">Option B: Database SQL Queries</h5>
                <p className="text-[13px] text-[#a8a6a2] mb-3">If <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">url</code> is <strong>not</strong> specified, or if <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">url</code> contains <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">/api/db</code>, the action runs an SQL query against the database using the <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">dbQuery</code> helper. The <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">sql</code> and <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">params</code> can be at the root of <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">config</code>, or nested inside a <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">body</code> object.</p>
                <CodeBlock>{`{
  "id": "insert-todo-db",
  "name": "createTodoInDb",
  "type": "mutate",
  "config": {
    "url": "/api/db/{projectId}",
    "method": "POST",
    "body": {
      "sql": "INSERT INTO todos (title, status, user_id) VALUES ($1, $2, $3) RETURNING *",
      "params": [ "$args.0", "pending", "$global.user.id" ]
    },
    "storePath": "lastCreatedTodo",
    "onSuccess": "SET $status = 'Saved successfully'; CALL getTodos"
  }
}`}</CodeBlock>
                <div className="space-y-2 mt-4">
                  <PropRow label="body.sql (or config.sql)" value="The raw SQL query string." />
                  <PropRow label="body.params (or config.params)" value="Array of parameters for SQL placeholders." />
                </div>
              </div>

              <h4 className="text-[15px] font-medium text-[#f6f4f0] mb-2">2.2. setState</h4>
              <p className="text-[14px] text-[#a8a6a2] mb-3">Updates specific values inside the application state. Dotted paths are supported for nested objects.</p>
              <CodeBlock>{`{
  "type": "setState",
  "config": {
    "path": "form.username",
    "value": "$args.0",
    "also": "SET $form.dirty = true; CALL validateForm"
  }
}`}</CodeBlock>
              <Tip title="Navigation Trigger:">If the path matches <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">/current.?screen/i</code>, the runtime treats the value as a screen name and triggers navigation.</Tip>

              <h4 className="text-[15px] font-medium text-[#f6f4f0] mt-6 mb-2">2.3. navigate</h4>
              <p className="text-[14px] text-[#a8a6a2] mb-3">Transitions between screens.</p>
              <CodeBlock>{`{
  "type": "navigate",
  "config": {
    "target": "/dashboard"
  }
}`}</CodeBlock>

              <h4 className="text-[15px] font-medium text-[#f6f4f0] mt-6 mb-2">2.4. custom</h4>
              <p className="text-[14px] text-[#a8a6a2] mb-3">Acts as a pure scripting logic container. It executes sequential actions without having a primary state mutation or fetch command.</p>
              <CodeBlock>{`{
  "type": "custom",
  "config": {
    "onSuccess": "CALL checkAuth",
    "also": "SET $clicked = true; CALL refreshApp"
  }
}`}</CodeBlock>

              <SubHeading>3. Parameter & Argument Resolution</SubHeading>
              <p className="text-[14px] text-[#a8a6a2] mb-3">The runtime dynamically resolves values prefixed with <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">$</code> inside action properties:</p>
              <StepList steps={[
                { title: "$args.X", desc: "Resolves to the X-th argument passed when calling the action function (e.g. $args.0)." },
                { title: "$path.to.variable", desc: "Resolves to a property path in the state (e.g., $form.username)." },
                { title: "Argument Fallback", desc: "If a path resolves to undefined in state, checks if args[0] is an object and resolves the key from it." },
              ]} />

              <SubHeading>4. Scripting Syntax (onSuccess, onError, also)</SubHeading>
              <p className="text-[14px] text-[#a8a6a2] mb-3">Fields like <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">onSuccess</code> allow chainable scripting. Expressions are split by semicolons.</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
                  <h4 className="text-[14px] font-medium text-[#f6f4f0] mb-3">SET Statement</h4>
                  <p className="text-[13px] text-[#a8a6a2] mb-2">Modifies a state variable. Syntax: <code className="text-[#f6f4f0]">SET $path = expression</code></p>
                  <PropRow label="$result" value="Root JSON response" />
                  <PropRow label="$result.rows" value="SQL rows array" />
                  <PropRow label="dbQuery(...)" value="Inline SQL (in also)" />
                </div>
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
                  <h4 className="text-[14px] font-medium text-[#f6f4f0] mb-3">CALL Statement</h4>
                  <p className="text-[13px] text-[#a8a6a2] mb-2">Executes another action by name. Syntax: <code className="text-[#f6f4f0]">CALL actionName</code></p>
                  <p className="text-[13px] text-[#a8a6a2]">Fetch/mutate calls are resolved via React refs to ensure the latest state context.</p>
                </div>
              </div>
            </div>
          )}

          {/* ─── EXPORT & BUILD ─── */}
          {activeTab === "export" && (
            <div>
              <SectionHeading>Export & Build</SectionHeading>
              <SectionSub>When your design is ready, Mint compiles it into real source code. Download a ZIP, extract it, install dependencies, and run — it&apos;s a complete project.</SectionSub>

              <SubHeading>Supported frameworks</SubHeading>
              <FrameworkGrid />

              <SubHeading>How to export</SubHeading>
              <StepList steps={[
                { title: "Click Export in the toolbar", desc: "Select your target framework from the dialog." },
                { title: "Configure options", desc: "Choose TypeScript or JavaScript, CSS framework (Tailwind, CSS Modules, Styled Components), and whether to enable Live Sync." },
                { title: "Download the ZIP", desc: "Mint generates code, bundles images, and creates a complete project scaffold. The ZIP downloads to your browser." },
              ]} />

              <SubHeading>How to commit</SubHeading>
              <p className="text-[14px] text-[#a8a6a2] mb-3">Committing is different from exporting. A commit generates code and stores it as a versioned snapshot on the server. This enables Live Sync and version history.</p>
              <StepList steps={[
                { title: "Click Commit in the toolbar", desc: "Select the target framework and enter an optional commit message." },
                { title: "Mint diffs against the previous commit", desc: "Only changed files are stored and sent to sync clients. A full snapshot is kept for future diffs." },
                { title: "Version number increments", desc: "Each commit gets an auto-incrementing version. You can view history and roll back from the commit log." },
              ]} />

              <SubHeading>Extract and run</SubHeading>
              <CodeBlock>{`# Web frameworks (React, Next.js, Vue, Svelte)
unzip my-app-react.zip -d my-app && cd my-app
npm install
npm run dev

# React Native (Expo)
unzip my-app-react-native.zip -d my-app && cd my-app
npm install
npx expo start`}</CodeBlock>

              <SubHeading>Build a release APK (React Native)</SubHeading>
              <p className="text-[14px] text-[#a8a6a2] mb-3">To build a production Android APK, eject from Expo&apos;s managed workflow and use Gradle:</p>
              <CodeBlock>{`# 1. Generate native android/ and ios/ folders
npx expo prebuild

# 2. Build a release APK
cd android
./gradlew assembleRelease

# Output: android/app/build/outputs/apk/release/app-release.apk

# 3. Or build an App Bundle for Play Store
./gradlew bundleRelease

# Output: android/app/build/outputs/bundle/release/app-release.aab`}</CodeBlock>

              <Warning title="Signing:">Release builds require a signing keystore. Create one with keytool and configure it in android/app/build.gradle before running assembleRelease.</Warning>

              <SubHeading>Build for iOS</SubHeading>
              <CodeBlock>{`# After npx expo prebuild
cd ios
pod install
# Open .xcworkspace in Xcode → Product → Archive`}</CodeBlock>
            </div>
          )}

          {/* ─── LIVE SYNC ─── */}
          {activeTab === "sync" && (
            <div>
              <SectionHeading>Live Sync</SectionHeading>
              <SectionSub>Live Sync keeps your running app in sync with the canvas. Make a design change, commit it, and your dev server updates automatically via Hot Module Replacement — no rebuild needed.</SectionSub>

              <SubHeading>How it works</SubHeading>
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5 my-4 font-mono text-[13px] text-[#a8a6a2] leading-loose">
                <div>Editor (browser) → Commit → Server stores version</div>
                <div className="ml-12">↓</div>
                <div>mint-connector.mjs polls /api/project-data every 2s</div>
                <div className="ml-12">↓</div>
                <div>mint-the-god.mjs writes changed files to disk</div>
                <div className="ml-12">↓</div>
                <div>Dev server HMR detects changes → UI updates</div>
              </div>

              <SubHeading>Enable Live Sync</SubHeading>
              <StepList steps={[
                { title: "Enable during export", desc: "Check the \"Enable Live Sync\" option when exporting. This injects three files into your project." },
                { title: "Start the sync daemon", desc: <><code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">npm run sync</code> — or it starts automatically with <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">npm run dev</code> (the dev script is auto-patched).</> },
                { title: "Make changes and commit", desc: "Edit anything on the canvas, click Commit. The daemon picks up the new version within 2 seconds." },
              ]} />

              <SubHeading>Injected files</SubHeading>
              <div className="space-y-2 mb-4">
                <PropRow label="mint-connector.mjs" value="Polls server for new commits" />
                <PropRow label="mint-the-god.mjs" value="Writes received files to disk" />
                <PropRow label="mint-sync.config.json" value="Project ID, server URL, poll interval" />
              </div>

              <SubHeading>Protected files</SubHeading>
              <p className="text-[14px] text-[#a8a6a2] mb-3">The sync daemon will never overwrite these files, even if they appear in a commit:</p>
              <CodeBlock>{`package.json, package-lock.json, node_modules/,
.gitignore, .env, .env.local,
mint-connector.mjs, mint-the-god.mjs, mint-sync.config.json`}</CodeBlock>

              <Tip title="Custom poll interval:">Edit mint-sync.config.json to change the polling frequency. Default is 2000ms (2 seconds).</Tip>
            </div>
          )}

          {/* ─── COLLABORATION ─── */}
          {activeTab === "collab" && (
            <div>
              <SectionHeading>Collaboration</SectionHeading>
              <SectionSub>Work with your team in real-time on the same canvas. See each other&apos;s cursors, selections, and changes as they happen.</SectionSub>

              <SubHeading>Real-time features</SubHeading>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <Card icon={MousePointer} title="Live cursors">See where each collaborator is pointing in real-time. Each user gets a unique color.</Card>
                <Card icon={Square} title="Selection sync">When someone selects elements, you see their selection highlighted on your canvas.</Card>
                <Card icon={GitBranch} title="Change broadcasting">Shape additions, deletions, moves, and style changes sync instantly to all editors.</Card>
                <Card icon={Users} title="Presence indicators">See who&apos;s online in the current file with avatar indicators in the toolbar.</Card>
              </div>

              <SubHeading>Teams</SubHeading>
              <p className="text-[14px] text-[#a8a6a2] mb-3">Create teams to manage access. Team members can have different roles: Owner, Admin, or Editor. Owners can manage members and project settings. Editors can design but cannot change project configuration.</p>

              <SubHeading>Limits</SubHeading>
              <div className="space-y-2">
                <PropRow label="Max editors per file" value="50 simultaneous" />
                <PropRow label="Cursor update rate" value="60 fps (16ms throttle)" />
              </div>
            </div>
          )}

          {/* ─── EXAMPLES ─── */}
          {activeTab === "examples" && (
            <div className="flex gap-6 items-start">
              {/* Examples sidebar */}
              <aside className="w-[180px] shrink-0 sticky top-[100px]">
                <p className="text-[11px] uppercase tracking-widest text-[#666360] mb-2 px-2">Examples</p>
                <div className="flex flex-col gap-1">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex.id}
                      onClick={() => setActiveExample(ex.id)}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] text-left transition-all border ${
                        activeExample === ex.id
                          ? "bg-white/[0.06] text-[#f6f4f0] border-white/[0.1] font-medium"
                          : "text-[#a8a6a2] hover:bg-white/[0.03] hover:text-[#f6f4f0] border-transparent"
                      }`}
                    >
                      <ex.icon size={15} className={activeExample === ex.id ? "text-emerald-400" : ""} />
                      <span>{ex.label}</span>
                    </button>
                  ))}
                  <div className="mt-3 px-3 py-2 rounded-lg border border-dashed border-white/[0.08] text-[11px] text-[#666360] leading-relaxed">
                    More examples coming soon.
                  </div>
                </div>
              </aside>

              {/* Example content */}
              <div className="flex-1 min-w-0">
                {activeExample === "expense-tracker" && <ExpenseTrackerGuide />}
              </div>
            </div>
          )}

          {/* ─── SHORTCUTS ─── */}
          {activeTab === "shortcuts" && (
            <div>
              <SectionHeading>Keyboard Shortcuts</SectionHeading>
              <SectionSub>Speed up your workflow with keyboard shortcuts. These work when the canvas is focused.</SectionSub>

              <SubHeading>Tools</SubHeading>
              <div className="space-y-0">
                <PropRow label="Frame tool" value="F" />
                <PropRow label="Rectangle" value="R" />
                <PropRow label="Ellipse" value="O" />
                <PropRow label="Text" value="T" />
                <PropRow label="Line" value="L" />
                <PropRow label="Pen tool" value="P" />
                <PropRow label="Move tool" value="V" />
                <PropRow label="Hand / pan" value="H or Space + drag" />
              </div>

              <SubHeading>Editing</SubHeading>
              <div className="space-y-0">
                <PropRow label="Copy" value="Ctrl + C" />
                <PropRow label="Paste" value="Ctrl + V" />
                <PropRow label="Cut" value="Ctrl + X" />
                <PropRow label="Duplicate" value="Ctrl + D" />
                <PropRow label="Delete" value="Delete / Backspace" />
                <PropRow label="Undo" value="Ctrl + Z" />
                <PropRow label="Redo" value="Ctrl + Shift + Z" />
                <PropRow label="Select all" value="Ctrl + A" />
                <PropRow label="Group" value="Ctrl + G" />
                <PropRow label="Ungroup" value="Ctrl + Shift + G" />
              </div>

              <SubHeading>View</SubHeading>
              <div className="space-y-0">
                <PropRow label="Zoom in" value="Ctrl + =" />
                <PropRow label="Zoom out" value="Ctrl + -" />
                <PropRow label="Zoom to fit" value="Ctrl + 1" />
                <PropRow label="Zoom to 100%" value="Ctrl + 0" />
                <PropRow label="Toggle layers panel" value="Alt + 1" />
                <PropRow label="Toggle design panel" value="Alt + 2" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/[0.04] py-8 text-center text-xs text-zinc-600">
        &copy; {new Date().getFullYear()} mint technologies inc. All rights reserved.
      </footer>
    </div>
  );
}
