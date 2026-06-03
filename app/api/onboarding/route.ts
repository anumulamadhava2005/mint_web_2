import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findUserByToken } from "@/lib/auth";
import db from "@/lib/db";

// PATCH /api/onboarding — save onboarding context data
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
    const { project_type, industry, stage, platforms, features, goal } = body ?? {};

    const onboardingData = {
      project_type: typeof project_type === "string" ? project_type : null,
      industry: typeof industry === "string" ? industry : null,
      stage: typeof stage === "string" ? stage : null,
      platforms: Array.isArray(platforms) ? platforms.filter((p: any) => typeof p === "string").slice(0, 10) : [],
      features: Array.isArray(features) ? features.filter((f: any) => typeof f === "string").slice(0, 20) : [],
      goal: typeof goal === "string" ? goal : null,
      completed_at: new Date().toISOString(),
    };

    await db.query(
      `UPDATE users SET onboarding = $1, onboarded = true WHERE id = $2`,
      [JSON.stringify(onboardingData), user.id]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Onboarding PATCH error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
