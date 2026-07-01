// ═══════════════════════════════════════════════════════════════
// End-User Auth API (for the apps people BUILD, not the Mint platform)
//
//   POST /api/app-auth/[projectId]/signup   { email, password, username? }
//   POST /api/app-auth/[projectId]/login    { email, password }
//   POST /api/app-auth/[projectId]/logout   { token }
//
// Owns a DEDICATED auth store per project (prefixed
// mint_proj_<projectId>_auth_users / _auth_sessions), kept separate from the
// builder's own `users` data table so signup never mutates the app's schema.
// Password hashing reuses the platform's scrypt primitives (lib/auth).
// Responses are shaped { user, token } to match the runtime signUp/signIn actions.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import crypto from "crypto";
import db from "@/lib/db";
import { scryptHash, newSalt, verifyPassword } from "@/lib/auth";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

function prefixFor(projectId: string): string {
  return `mint_proj_${projectId.replace(/[^a-zA-Z0-9_]/g, "")}_`;
}

// Dedicated, endpoint-owned auth store — kept SEPARATE from the builder's own
// `users` data table so signup never mutates or writes into the app's schema.
async function ensureAuthTables(p: string): Promise<void> {
  await db.query(`CREATE TABLE IF NOT EXISTS "${p}auth_users" (
    "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "email"         text UNIQUE NOT NULL,
    "username"      text,
    "password_hash" text NOT NULL,
    "salt"          text NOT NULL,
    "role"          text DEFAULT 'user',
    "created_at"    timestamptz DEFAULT now()
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS "${p}auth_sessions" (
    "token"      text PRIMARY KEY,
    "user_id"    uuid NOT NULL,
    "expires_at" timestamptz NOT NULL,
    "created_at" timestamptz DEFAULT now()
  )`);
}

async function issueToken(p: string, userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await db.query(
    `INSERT INTO "${p}auth_sessions" ("token", "user_id", "expires_at") VALUES ($1, $2, $3)`,
    [token, userId, expiresAt]
  );
  if (Math.random() < 0.05) {
    db.query(`DELETE FROM "${p}auth_sessions" WHERE expires_at < now()`).catch(() => {});
  }
  return token;
}

type PublicUser = { id: string; email: string; username: string | null; role: string };

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string; action: string }> }
) {
  const { projectId, action } = await params;
  const cors = corsHeaders();

  // The project must exist; signup/login are otherwise public (end users have
  // no credentials yet), scoped to this project's namespace.
  const proj = await db.query("SELECT id FROM projects WHERE id = $1", [projectId]);
  if (!proj.rows?.length) {
    return NextResponse.json({ error: "Project not found" }, { status: 404, headers: cors });
  }

  const p = prefixFor(projectId);

  try {
    await ensureAuthTables(p);
    const body = await req.json().catch(() => ({} as Record<string, unknown>));

    if (action === "signup") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      // The runtime signUp action passes the display name as `name`; accept either.
      const rawName = body.username ?? body.name;
      const username = rawName != null && rawName !== "" ? String(rawName) : null;
      if (!email || !password) {
        return NextResponse.json({ error: "Email and password are required." }, { status: 400, headers: cors });
      }
      if (password.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400, headers: cors });
      }

      const existing = await db.query(`SELECT id FROM "${p}auth_users" WHERE lower(email) = lower($1) LIMIT 1`, [email]);
      if (existing.rows?.length) {
        return NextResponse.json({ error: "An account with this email already exists." }, { status: 409, headers: cors });
      }

      const salt = newSalt();
      const password_hash = scryptHash(password, salt);
      const ins = await db.query(
        `INSERT INTO "${p}auth_users" ("email", "username", "password_hash", "salt")
         VALUES ($1, $2, $3, $4) RETURNING id, email, username, role`,
        [email, username, password_hash, salt]
      );
      const u = ins.rows[0] as PublicUser;
      const token = await issueToken(p, u.id);
      return NextResponse.json({ user: u, token }, { headers: cors });
    }

    if (action === "login") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      if (!email || !password) {
        return NextResponse.json({ error: "Email and password are required." }, { status: 400, headers: cors });
      }
      const res = await db.query(
        `SELECT id, email, username, role, password_hash, salt FROM "${p}auth_users" WHERE lower(email) = lower($1) LIMIT 1`,
        [email]
      );
      const row = res.rows?.[0];
      if (!row) {
        return NextResponse.json({ error: "Invalid email or password." }, { status: 401, headers: cors });
      }
      const check = verifyPassword(password, row.password_hash, row.salt);
      if (!check.valid) {
        return NextResponse.json({ error: "Invalid email or password." }, { status: 401, headers: cors });
      }
      if (check.rehash && check.newHash) {
        db.query(`UPDATE "${p}auth_users" SET password_hash = $1 WHERE id = $2`, [check.newHash, row.id]).catch(() => {});
      }
      const user: PublicUser = { id: row.id, email: row.email, username: row.username, role: row.role };
      const token = await issueToken(p, user.id);
      return NextResponse.json({ user, token }, { headers: cors });
    }

    if (action === "logout") {
      const token = body.token != null ? String(body.token) : "";
      if (token) {
        await db.query(`DELETE FROM "${p}auth_sessions" WHERE token = $1`, [token]).catch(() => {});
      }
      return NextResponse.json({ ok: true }, { headers: cors });
    }

    return NextResponse.json({ error: "Unknown auth action." }, { status: 400, headers: cors });
  } catch (e) {
    console.error("[AppAuth] error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Auth failed" },
      { status: 500, headers: cors }
    );
  }
}
