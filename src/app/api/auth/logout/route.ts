 import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true });

  const secure = process.env.NODE_ENV === "production";

  // Clear both marketplace + admin auth cookies
  response.cookies.set("auth-token", "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  response.cookies.set("admin-token", "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}


