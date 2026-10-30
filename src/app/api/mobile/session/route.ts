import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { getDb, getConnection } from "@/lib/db";
import { marketplaceUsers } from "@/lib/db/schema";
import { mysqlTruthy } from "@/lib/mysqlTruthy";
import { sessionCookieBase, cookieHostFromRequest } from "@/lib/auth-cookie-options";
import { POST as websiteLogin } from "@/app/api/marketplace/login/route";
import { mobileMemberId, mobileSameOrigin, mobileCredentials } from "@/lib/mobile/session-policy";
import { checkMobileAdministrator, signInMobileAdministrator, mobileAdminCookie } from "@/lib/mobile/admin-session";
import { activeMemberTerms } from "@/lib/mobile/terms-document";
import { findTermsReceipt } from "@/lib/mobile/terms-acceptance";
export const dynamic = "force-dynamic";
// A separate host-only cookie avoids collisions with website cookies on .troothhurtz.app.
// Leave unset on the canonical website to retain its existing session behavior.
const mobileCookieName = process.env.SMART_TRUST_MOBILE_SESSION_COOKIE === "__Host-smart-trust-mobile"
  ? "__Host-smart-trust-mobile" : "auth-token";
function mobileCookieOptions(request: NextRequest) {
  if (mobileCookieName === "auth-token") return sessionCookieBase(cookieHostFromRequest(request));
  return { httpOnly: true as const, secure: true, sameSite: "lax" as const, path: "/" };
}
function reply(body: object, status = 200) {
  return NextResponse.json(body, {status, headers: {"Cache-Control": "no-store", "Vary": "Cookie"}});
}
function adminEnabled() { return process.env.SMART_TRUST_MOBILE_ADMIN_LOGIN === "true"; }
function termsRequired() { return process.env.SMART_TRUST_MOBILE_TERMS_REQUIRED === "true"; }
const privateCookieOptions = {httpOnly: true as const, secure: true, sameSite: "lax" as const, path: "/"};
function unavailable() {
  if (process.env.SMART_TRUST_MOBILE_ENABLED !== "true") return reply({error: "Mobile is not enabled."}, 404);
  // Do not inherit the legacy auth module's development fallback secret.
  if (!process.env.JWT_SECRET?.trim()) return reply({error: "Account service is not configured."}, 503);
  return null;
}
export async function GET(request: NextRequest) {
  const blocked = unavailable(); if (blocked) return blocked;
  const adminToken = adminEnabled() ? request.cookies.get(mobileAdminCookie)?.value : undefined;
  if (adminToken) {
    const result = await checkMobileAdministrator(adminToken);
    return result.ok ? reply({user: result.user}) : reply({error: result.status === 401 ? "Administrator session expired. Please sign in again." : "Website administrator service is unavailable. Please retry."}, result.status);
  }
  const token = request.cookies.get(mobileCookieName)?.value;
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
    if (termsRequired()) {
      const document = activeMemberTerms();
      if (!document) return reply({access: "terms_unavailable", message: "Member terms are being finalized. Profile access is not available yet."});
      const receipt = await findTermsReceipt(await getConnection(), id, document);
      if (!receipt) return reply({access: "terms_required", terms: {version: document.version, sha256: document.sha256, title: document.title, url: "/mobile/terms"}});
      return reply({user: {id: user.id, username: user.username, email: user.email, walletAddress: user.walletAddress}, termsAcceptance: receipt});
    }
    return reply({user: {id: user.id, username: user.username, email: user.email, walletAddress: user.walletAddress}});
  } catch { return reply({error: "Account service is unavailable. Please retry."}, 503); }
}
export async function POST(request: NextRequest) {
  const blocked = unavailable(); if (blocked) return blocked;
  if (!mobileSameOrigin(request)) return reply({error: "Same-origin request required."}, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return reply({error: "JSON required."}, 415);
  const raw = await request.text();
  if (raw.length > 8192) return reply({error: "Request too large."}, 413);
  let credentials; let input: Record<string, unknown>;
  try { input = JSON.parse(raw); credentials = mobileCredentials(input); } catch { return reply({error: "Invalid sign-in request."}, 400); }
  if (!credentials) return reply({error: "Enter your username/email and password."}, 400);
  const accountType = input!.accountType ?? "member";
  if (accountType !== "member" && accountType !== "administrator") return reply({error: "Choose a member or administrator account."}, 400);
  if (accountType === "administrator") {
    if (!adminEnabled()) return reply({error: "Administrator mobile sign-in is not enabled."}, 503);
    const result = await signInMobileAdministrator(credentials.identifier, credentials.password);
    if (!result.ok || !result.token) return reply({error: !result.ok && result.status === 401 ? "Administrator sign-in failed. Check your website admin credentials." : "Website administrator service is unavailable. Please retry."}, !result.ok ? result.status : 503);
    const response = reply({success: true, user: result.user});
    response.cookies.set(mobileAdminCookie, result.token, {...privateCookieOptions, maxAge: 60 * 60 * 24});
    response.cookies.set(mobileCookieName, "", {...mobileCookieOptions(request), maxAge: 0});
    return response;
  }
  const response = await websiteLogin(new NextRequest(request.url, {
    method: "POST", headers: request.headers, body: JSON.stringify(credentials)
  }));
  if (!response.ok) return reply({error: response.status >= 500 ? "Account service is unavailable." : "Sign-in failed. Check your credentials and account approval."}, response.status);
  if (mobileCookieName !== "auth-token" || termsRequired()) {
    const cookie = response.cookies.get("auth-token");
    if (!cookie?.value) return reply({error: "Account session could not be established."}, 503);
    // Keep the token server-side. Do not forward a website-domain Set-Cookie header.
    const mobileResponse = reply(termsRequired() ? {success: true} : await response.json());
    mobileResponse.cookies.set(mobileCookieName, cookie.value, {
      ...mobileCookieOptions(request), maxAge: 60 * 60 * 24 * 7,
    });
    if (adminEnabled()) mobileResponse.cookies.set(mobileAdminCookie, "", {...privateCookieOptions, maxAge: 0});
    return mobileResponse;
  }
  // Preserve the existing HttpOnly Set-Cookie contract without exposing a token to JS.
  response.headers.set("Cache-Control", "no-store");
  if (adminEnabled()) response.cookies.set(mobileAdminCookie, "", {...privateCookieOptions, maxAge: 0});
  return response;
}
export async function DELETE(request: NextRequest) {
  if (process.env.SMART_TRUST_MOBILE_ENABLED !== "true") return reply({error: "Mobile is not enabled."}, 404);
  if (!mobileSameOrigin(request)) return reply({error: "Same-origin request required."}, 403);
  const response = reply({success: true});
  response.cookies.set(mobileCookieName, "", {...mobileCookieOptions(request), maxAge: 0});
  if (adminEnabled()) response.cookies.set(mobileAdminCookie, "", {...privateCookieOptions, maxAge: 0});
  return response;
}

