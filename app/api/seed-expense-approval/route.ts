// GET /api/seed-expense-approval
// Seeds the Expense Approval project, canvas file, and runtime schema via the DB bridge.
// Safe to call multiple times (all ops use ON CONFLICT DO UPDATE).

import { NextResponse } from "next/server";
import crypto from "crypto";
import db from "../../../lib/db";

const PROJECT_ID = "40780692-dd76-4e25-9fbb-ea194dba9619";
const FILE_ID    = "40780692-dd76-4e25-9fbb-ea194dba9620";
const PAGE_ID    = "40780692-dd76-4e25-9fbb-ea194dba9621";
const ROOT_ID    = "00000000-0000-0000-0000-000000000000";
const OWNER_EMAIL = "manimadhava43@gmail.com";

const SCREENS = [
  { id: "a1b2c3d4-0001-4000-8000-000000000001", name: "LoginScreen",          route: "/login",            bg: "#F9FAFB" },
  { id: "a1b2c3d4-0002-4000-8000-000000000001", name: "DashboardScreen",       route: "/dashboard",        bg: "#F9FAFB" },
  { id: "a1b2c3d4-0003-4000-8000-000000000001", name: "SubmitExpenseScreen",   route: "/submit",           bg: "#FFFFFF" },
  { id: "a1b2c3d4-0004-4000-8000-000000000001", name: "ExpenseDetailScreen",   route: "/expense/:id",      bg: "#FFFFFF" },
  { id: "a1b2c3d4-0005-4000-8000-000000000001", name: "ApprovalQueueScreen",   route: "/approvals",        bg: "#F9FAFB" },
  { id: "a1b2c3d4-0006-4000-8000-000000000001", name: "ExpenseHistoryScreen",  route: "/history",          bg: "#F9FAFB" },
  { id: "a1b2c3d4-0007-4000-8000-000000000001", name: "ProfileScreen",         route: "/profile",          bg: "#FFFFFF" },
];

const FRAME_W = 390;
const FRAME_H = 844;
const GAP     = 100;

function buildCanvasData() {
  const screenFrames = SCREENS.map((s, i) => ({
    id: s.id,
    type: "frame",
    name: s.name,
    x: i * (FRAME_W + GAP),
    y: 0,
    width: FRAME_W,
    height: FRAME_H,
    rotation: 0,
    opacity: 1,
    hidden: false,
    locked: false,
    parentId: ROOT_ID,
    frameId: ROOT_ID,
    shapes: [],
    fills: [{ fillColor: s.bg, fillOpacity: 1 }],
    strokes: [],
    shadow: [],
    blur: null,
    layoutProps: {},
    interactions: [],
    showContent: true,
  }));

  const rootFrame = {
    id: ROOT_ID,
    type: "frame",
    name: "root",
    x: 0, y: 0, width: 0, height: 0,
    rotation: 0, opacity: 1, hidden: false, locked: false,
    parentId: null, frameId: null,
    shapes: screenFrames.map((f) => f.id),
    fills: [], strokes: [], shadow: [], blur: null,
    layoutProps: {}, interactions: [], showContent: true,
  };

  const objects: Record<string, unknown> = { [ROOT_ID]: rootFrame };
  for (const f of screenFrames) objects[f.id] = f;

  return {
    id: FILE_ID,
    name: "Expense Approval",
    revn: 0,
    pages: [PAGE_ID],
    pagesIndex: {
      [PAGE_ID]: {
        id: PAGE_ID,
        name: "Page 1",
        objects,
        flows: [],
        guides: [],
        options: {},
      },
    },
  };
}

function buildRuntimeSchema() {
  return {
    id: PROJECT_ID,
    name: "Expense Approval",
    version: "1.0.0",
    schemaVersion: 1,
    theme: {
      colors: {
        primary: "#4F46E5", secondary: "#7C3AED",
        background: "#F9FAFB", surface: "#FFFFFF",
        text: "#111827", textSecondary: "#6B7280",
        border: "#E5E7EB", success: "#10B981",
        warning: "#F59E0B", danger: "#EF4444",
      },
      fonts: { heading: "Inter", body: "Inter", mono: "JetBrains Mono" },
      spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
      radii: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
    },
    meta: { platform: "mobile", description: "Enterprise expense submission and approval workflow app" },
    screens: SCREENS.map((s) => ({
      id: s.id,
      name: s.name,
      route: s.route,
      localState: [],
      actions: [],
      components: [],
    })),
    globalState: [
      { id: "gs-user",     name: "currentUser",  type: "object",  defaultValue: { name: "", role: "employee" } },
      { id: "gs-expenses", name: "expenses",      type: "array",   defaultValue: [] },
      { id: "gs-pending",  name: "pendingCount",  type: "number",  defaultValue: 0 },
      { id: "gs-form",     name: "form",          type: "object",  defaultValue: { amount: "", description: "", category: "", receipt: "" } },
    ],
    globalActions: [
      { id: "act-login",       name: "login",          type: "navigate", config: { target: "/dashboard", route: "/dashboard" } },
      { id: "act-logout",      name: "logout",         type: "navigate", config: { target: "/login",     route: "/login" } },
      { id: "act-nav-dash",    name: "goToDashboard",  type: "navigate", config: { target: "/dashboard", route: "/dashboard" } },
      { id: "act-nav-submit",  name: "goToSubmit",     type: "navigate", config: { target: "/submit",    route: "/submit" } },
      { id: "act-nav-approve", name: "goToApprovals",  type: "navigate", config: { target: "/approvals", route: "/approvals" } },
      { id: "act-nav-history", name: "goToHistory",    type: "navigate", config: { target: "/history",   route: "/history" } },
      { id: "act-nav-profile", name: "goToProfile",    type: "navigate", config: { target: "/profile",   route: "/profile" } },
    ],
    navigation: {
      type: "stack",
      initialRoute: "/login",
      routes: SCREENS.map((s) => ({ path: s.route, screenId: s.id })),
    },
    database: {
      provider: "mint",
      tables: [
        {
          id: "t-expenses",
          name: "expenses",
          fields: [
            { name: "id",          type: "uuid",      primaryKey: true, required: true },
            { name: "title",       type: "text",      required: true },
            { name: "amount",      type: "decimal",   required: true },
            { name: "category",    type: "text" },
            { name: "status",      type: "text",      defaultValue: "pending" },
            { name: "description", type: "text" },
            { name: "receipt_url", type: "text" },
            { name: "submitted_by",type: "uuid",      references: "users.id" },
            { name: "approved_by", type: "uuid",      references: "users.id" },
            { name: "created_at",  type: "timestamp", defaultValue: "now()" },
            { name: "updated_at",  type: "timestamp", defaultValue: "now()" },
          ],
        },
        {
          id: "t-categories",
          name: "expense_categories",
          fields: [
            { name: "id",   type: "uuid", primaryKey: true, required: true },
            { name: "name", type: "text", required: true },
            { name: "icon", type: "text" },
          ],
        },
      ],
    },
    auth: {
      providers: ["email"],
      roles: [
        { id: "r-employee", name: "employee", description: "Can submit expenses" },
        { id: "r-manager",  name: "manager",  description: "Can approve expenses" },
        { id: "r-admin",    name: "admin",     description: "Full access" },
      ],
      policies: [
        { id: "p1", role: "employee", resource: "expenses", actions: ["create", "read:own"] },
        { id: "p2", role: "manager",  resource: "expenses", actions: ["create", "read", "update:status"] },
        { id: "p3", role: "admin",    resource: "expenses", actions: ["*"] },
      ],
    },
    workflows: [],
    components: [],
  };
}

export async function GET() {
  try {
    // 1. Ensure owner user exists
    let ownerRes = await db.query(
      "SELECT id FROM users WHERE email = $1 LIMIT 1",
      [OWNER_EMAIL]
    );

    let ownerId: string;
    if (ownerRes.rows.length === 0) {
      ownerId = crypto.randomUUID();
      await db.query(
        "INSERT INTO users (id, email, password_hash, salt, role, approved) VALUES ($1, $2, $3, $4, 'admin', true)",
        [ownerId, OWNER_EMAIL, "placeholder_hash", "placeholder_salt"]
      );
    } else {
      ownerId = ownerRes.rows[0].id;
      await db.query(
        "UPDATE users SET role = 'admin', approved = true WHERE id = $1",
        [ownerId]
      );
    }

    // 2. Upsert project — public+editable so any logged-in user can open the canvas
    await db.query(
      `INSERT INTO projects (id, name, description, owner_id, is_public, allow_public_edit)
       VALUES ($1, $2, $3, $4, true, true)
       ON CONFLICT (id) DO UPDATE SET
         name             = EXCLUDED.name,
         description      = EXCLUDED.description,
         is_public        = true,
         allow_public_edit = true`,
      [
        PROJECT_ID,
        "Expense Approval",
        "Enterprise expense submission and approval workflow app",
        ownerId,
      ]
    );

    // 3. Upsert canvas file
    const canvasData = buildCanvasData();
    await db.query(
      `INSERT INTO files (id, project_id, name, revn, data)
       VALUES ($1, $2, $3, 0, $4::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         data = EXCLUDED.data`,
      [FILE_ID, PROJECT_ID, "Expense Approval", JSON.stringify(canvasData)]
    );

    // 4. Ensure runtime_schemas table exists then upsert
    await db.query(`
      CREATE TABLE IF NOT EXISTS runtime_schemas (
        project_id  UUID        PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
        schema_json JSONB       NOT NULL,
        updated_by  UUID        REFERENCES users(id),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const schema = buildRuntimeSchema();
    await db.query(
      `INSERT INTO runtime_schemas (project_id, schema_json, updated_by)
       VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (project_id) DO UPDATE SET
         schema_json = EXCLUDED.schema_json,
         updated_at  = now(),
         updated_by  = EXCLUDED.updated_by`,
      [PROJECT_ID, JSON.stringify(schema), ownerId]
    );

    // 5. Issue a fresh session token so the caller can auth immediately
    const sessionToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await db.query(
      "INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)",
      [sessionToken, ownerId, expiresAt]
    );

    const response = NextResponse.json({
      ok: true,
      projectId: PROJECT_ID,
      fileId: FILE_ID,
      ownerEmail: OWNER_EMAIL,
      screens: SCREENS.map((s) => s.name),
      studioUrl: `/projects/${PROJECT_ID}/studio`,
      message: "Expense Approval project seeded. Cookie set — navigate to studioUrl.",
    });

    response.cookies.set("token", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (e: any) {
    console.error("[seed-expense-approval] error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
