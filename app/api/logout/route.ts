import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";
import { cacheInvalidate } from "@/lib/cache";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (token) {
    await Promise.all([
      db.query("DELETE FROM sessions WHERE token = $1", [token]),
      cacheInvalidate(`session:${token}`),
    ]);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
