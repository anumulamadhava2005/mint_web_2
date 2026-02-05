import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  // Clear the token cookie
  response.cookies.set("token", "", {
    path: "/",
    maxAge: 0,
  });
  return response;
}
