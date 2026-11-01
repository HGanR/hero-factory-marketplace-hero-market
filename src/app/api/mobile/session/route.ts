import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { marketplaceUsers } from "@/lib/db/schema";
import { mysqlTruthy } from "@/lib/mysqlTruthy";
import { sessionCookieBase, cookieHostFromRequest } from "@/lib/auth-cookie-options";
import { POST as websiteLogin } from "@/app/api/marketplace/login/route";
import { mobileMemberId, mobileSameOrigin, mobileCredentials } from "@/lib/mobile/session-policy";
export const dynamic = "force-dynamic";
function reply(body: object, status = 200) {
  return NextResponse.json(body, {status, headers: {"Cache-Control": "no-store", "Vary": "Cookie"}});
}
function unavailable() {
  if (process.env.SMART_TRUST_MOBILE_ENABLED !== "true") return reply({error: "Mobile is not enabled."}, 404);
  // Do not inherit the legacy auth module's development fallback secret.
  if (!process.env.JWT_SECRET?.trim()) return reply({error: "Account service is not configured."}, 503);
  return null;
}
export async function GET(request: NextRequest) {
  const blocked = unavailable(); if (blocked) return blocked;
  const token = request.cookies.get("auth-token")?.value;
  if (!token) return reply({error: "Sign in with your website account."}, 401);
  let id: number | null;
  try { id = mobileMemberId(jwt.verify(token, process.env.JWT_SECRET!, {algorithms: ["HS256"]})); }
  catch { return reply({error: "Your session has expired. Please sign in again."}, 401); }
  if (!id) return reply({error: "A member session is required."}, 401);
  try {
    const db = await getDb();
    const [user] = await db.select({id: marketplaceUsers.id, username: marketplaceUsers.username,
      email: marketplaceUsers.email, walletAddress: marketplaceUsers.walletAddress,
      isActive: marketplaceUsers.isActive, isApproved: marketplaceUsers.isApproved})
      .from(marketplaceUsers).where(eq(marketplaceUsers.id, id)).limit(1);
    if (!user || !mysqlTruthy(user.isActive) || !mysqlTruthy(user.isApproved)) return reply({error: "Account access is unavailable. Contact website support."}, 403);
    return reply({user: {id: user.id, username: user.username, email: user.email, walletAddress: user.walletAddress}});
  } catch { return reply({error: "Account service is unavailable. Please retry."}, 503); }
}
export async function POST(request: NextRequest) {
  const blocked = unavailable(); if (blocked) return blocked;
  if (!mobileSameOrigin(request)) return reply({error: "Same-origin request required."}, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return reply({error: "JSON required."}, 415);
  const raw = await request.text();
  if (raw.length > 8192) return reply({error: "Request too large."}, 413);
  let credentials;
  try { credentials = mobileCredentials(JSON.parse(raw)); } catch { return reply({error: "Invalid sign-in request."}, 400); }
  if (!credentials) return reply({error: "Enter your username/email and password."}, 400);
  const response = await websiteLogin(new NextRequest(request.url, {
    method: "POST", headers: request.headers, body: JSON.stringify(credentials)
  }));
  if (!response.ok) return reply({error: response.status >= 500 ? "Account service is unavailable." : "Sign-in failed. Check your credentials and account approval."}, response.status);
  // Preserve the existing HttpOnly Set-Cookie contract without exposing a token to JS.
  response.headers.set("Cache-Control", "no-store");
  return response;
}
export async function DELETE(request: NextRequest) {
  if (process.env.SMART_TRUST_MOBILE_ENABLED !== "true") return reply({error: "Mobile is not enabled."}, 404);
  if (!mobileSameOrigin(request)) return reply({error: "Same-origin request required."}, 403);
  const response = reply({success: true});
  response.cookies.set("auth-token", "", {...sessionCookieBase(cookieHostFromRequest(request)), maxAge: 0});
  return response;
}
