import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findUserByToken, verifyPassword } from "@/lib/auth";
import db from "@/lib/db";
import crypto from "crypto";

// GET /api/profile — fetch authenticated user's profile + stats
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await findUserByToken(token);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch full profile data
    const profileRes = await db.query(
      `SELECT id, email, fullname, photo, lang, theme, created_at
       FROM users WHERE id = $1`,
      [user.id]
    );
    const profile = profileRes.rows?.[0];
    if (!profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Fetch stats in parallel
    const [projectsRes, commitsRes, teamsRes] = await Promise.all([
      db.query(
        `SELECT COUNT(*)::int AS count FROM projects WHERE owner_id = $1`,
        [user.id]
      ),
      db.query(
        `SELECT COUNT(*)::int AS count FROM project_commits WHERE committed_by = $1`,
        [user.id]
      ),
      db.query(
        `SELECT t.id, t.name, tpr.is_owner, tpr.is_admin, tpr.can_edit
         FROM team_profile_rel tpr
         JOIN teams t ON t.id = tpr.team_id
         WHERE tpr.profile_id = $1 AND t.deleted_at IS NULL
         ORDER BY t.name`,
        [user.id]
      ),
    ]);

    // Fetch recent projects
    const recentProjectsRes = await db.query(
      `SELECT id, name, description, thumbnail_url, created_at, updated_at
       FROM projects WHERE owner_id = $1
       ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 5`,
      [user.id]
    );

    // Fetch recent commits
    const recentCommitsRes = await db.query(
      `SELECT pc.version, pc.message, pc.created_at, p.name AS project_name
       FROM project_commits pc
       JOIN projects p ON p.id = pc.project_id
       WHERE pc.committed_by = $1
       ORDER BY pc.created_at DESC LIMIT 10`,
      [user.id]
    );

    return NextResponse.json({
      profile: {
        id: profile.id,
        email: profile.email,
        fullname: profile.fullname || "",
        photo: profile.photo || "",
        lang: profile.lang || null,
        theme: profile.theme || null,
        created_at: profile.created_at,
      },
      stats: {
        projectCount: projectsRes.rows?.[0]?.count ?? 0,
        commitCount: commitsRes.rows?.[0]?.count ?? 0,
        teamCount: teamsRes.rows?.length ?? 0,
      },
      teams: teamsRes.rows || [],
      recentProjects: recentProjectsRes.rows || [],
      recentCommits: recentCommitsRes.rows || [],
    });
  } catch (err) {
    console.error("Profile GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// PATCH /api/profile — update profile fields and/or change password
export async function PATCH(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await findUserByToken(token);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { fullname, photo, lang, theme, current_password, new_password } = body ?? {};

    // Handle password change
    if (current_password && new_password) {
      if (typeof current_password !== "string" || typeof new_password !== "string") {
        return NextResponse.json({ error: "Invalid password fields" }, { status: 400 });
      }
      if (new_password.length < 6) {
        return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
      }

      // Fetch current hash and salt
      const userRes = await db.query(
        "SELECT password_hash, salt FROM users WHERE id = $1",
        [user.id]
      );
      const userData = userRes.rows?.[0];
      if (!userData) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const result = verifyPassword(current_password, userData.password_hash, userData.salt);
      if (!result.valid) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });
      }

      // Hash new password with existing salt
      const newSalt = crypto.randomBytes(16).toString("hex");
      const newHash = crypto.scryptSync(new_password, newSalt, 64, {
        N: 65536,
        r: 8,
        p: 1,
        maxmem: 128 * 65536 * 8 * 2,
      }).toString("hex");

      await db.query(
        "UPDATE users SET password_hash = $1, salt = $2 WHERE id = $3",
        [newHash, newSalt, user.id]
      );
    }

    // Handle profile field updates
    const updates: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (fullname !== undefined && typeof fullname === "string") {
      updates.push(`fullname = $${paramIdx++}`);
      values.push(fullname.trim().slice(0, 200));
    }
    if (photo !== undefined && typeof photo === "string") {
      updates.push(`photo = $${paramIdx++}`);
      values.push(photo.trim().slice(0, 500));
    }
    if (lang !== undefined && (lang === null || typeof lang === "string")) {
      updates.push(`lang = $${paramIdx++}`);
      values.push(lang ? lang.trim().slice(0, 10) : null);
    }
    if (theme !== undefined && (theme === null || typeof theme === "string")) {
      updates.push(`theme = $${paramIdx++}`);
      values.push(theme ? theme.trim().slice(0, 20) : null);
    }

    if (updates.length > 0) {
      values.push(user.id);
      await db.query(
        `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramIdx}`,
        values
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Profile PATCH error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
