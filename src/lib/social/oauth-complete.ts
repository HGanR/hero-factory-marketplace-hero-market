/**
 * Shared OAuth completion: token exchange, account upsert, audit, redirect.
 * Used by `/api/social/oauth/[platform]/callback` and `/api/social/linkedin/callback`.
 */

import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import crypto from "crypto";
import { getDb } from "@/lib/db";
import { campaignAuditEvents, socialAccounts } from "@/lib/db/schema";
import {
  PLATFORM_CONFIG,
  getRedirectUri,
  getClientId,
  getClientSecret,
  type SocialPlatform,
} from "@/lib/social/config";
import { verifyOAuthState } from "@/lib/social/oauth-state";
import { sanitizeOAuthReturnPath } from "@/lib/social/oauth-return-to";
import { encryptToken } from "@/lib/social/encrypt";
import { normalizeSocialAccountPlatformForWrite, parseOAuthRoutePlatformParam } from "@/lib/social/platform-identity";

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

async function exchangeCode(
  platform: SocialPlatform,
  code: string
): Promise<{
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  [k: string]: unknown;
}> {
  const config = PLATFORM_CONFIG[platform];
  const clientId = getClientId(platform);
  const clientSecret = getClientSecret(platform);
  if (!clientId || !clientSecret) throw new Error("OAuth not configured");

  const redirectUri = getRedirectUri(platform);

  const idKey = config.useClientKey ? "client_key" : "client_id";
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    [idKey]: clientId,
    client_secret: clientSecret,
  });

  let headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  if (platform === "pinterest") {
    headers["Authorization"] = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
    body.delete(idKey);
    body.delete("client_secret");
  }

  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers,
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function getLinkedInUserinfo(accessToken: string): Promise<{ displayName: string; sub: string | null }> {
  const res = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return { displayName: "LinkedIn", sub: null };
  const j = (await res.json()) as { name?: string; preferred_username?: string; sub?: string };
  return {
    displayName: (j.name as string) || (j.preferred_username as string) || "LinkedIn",
    sub: j.sub ? String(j.sub) : null,
  };
}

type MetaPageAccount = {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string };
};

/**
 * Pages the user can manage — used to obtain Page access tokens for Graph publishing.
 */
async function fetchMetaManagedPages(userAccessToken: string): Promise<MetaPageAccount[]> {
  const url = new URL("https://graph.facebook.com/v21.0/me/accounts");
  url.searchParams.set("fields", "id,name,access_token,instagram_business_account");
  url.searchParams.set("limit", "50");
  url.searchParams.set("access_token", userAccessToken);
  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const j = (await res.json()) as { data?: MetaPageAccount[] };
  return Array.isArray(j.data) ? j.data : [];
}

/**
 * Facebook Page posts and Instagram Graph publishing require a **Page** access token tied to the correct Page.
 * We store that token (not the user token) when we can resolve a Page; otherwise fall back to the user token
 * (publish may fail until the user reconnects with Page permissions).
 */
async function resolveMetaOAuthConnection(args: {
  userAccessToken: string;
  platform: "facebook" | "instagram";
}): Promise<{ accessToken: string; externalAccountId: string | null; displayName: string }> {
  const pages = await fetchMetaManagedPages(args.userAccessToken);
  if (pages.length === 0) {
    return {
      accessToken: args.userAccessToken,
      externalAccountId: null,
      displayName: args.platform === "instagram" ? "Instagram" : "Facebook",
    };
  }
  if (args.platform === "facebook") {
    const p = pages[0]!;
    return {
      accessToken: p.access_token || args.userAccessToken,
      externalAccountId: p.id,
      displayName: p.name?.trim() ? p.name : "Facebook Page",
    };
  }
  const igPage = pages.find((x) => x.instagram_business_account?.id);
  if (igPage?.access_token) {
    return {
      accessToken: igPage.access_token,
      externalAccountId: igPage.id,
      displayName: igPage.name?.trim() ? `${igPage.name} (Instagram)` : "Instagram",
    };
  }
  return {
    accessToken: args.userAccessToken,
    externalAccountId: null,
    displayName: "Instagram",
  };
}

async function upsertSocialAccountRow(args: {
  db: Awaited<ReturnType<typeof getDb>>;
  payload: { userId: string; clientId: string; platform: SocialPlatform; returnTo: string };
  platformStored: SocialPlatform;
  accessEnc: string;
  refreshEnc: string | null;
  expiresAt: Date | null;
  scopesStr: string;
  displayName: string;
  externalAccountId: string | null;
}): Promise<void> {
  const { db, payload, platformStored } = args;
  const triple = and(
    eq(socialAccounts.userId, payload.userId),
    eq(socialAccounts.clientId, payload.clientId),
    eq(socialAccounts.platform, platformStored)
  );

  if (platformStored === "linkedin" && args.externalAccountId) {
    const bySub = await db
      .select()
      .from(socialAccounts)
      .where(
        and(
          eq(socialAccounts.userId, payload.userId),
          eq(socialAccounts.clientId, payload.clientId),
          eq(socialAccounts.platform, "linkedin"),
          eq(socialAccounts.externalAccountId, args.externalAccountId)
        )
      )
      .limit(1);
    if (bySub[0]) {
      await db
        .update(socialAccounts)
        .set({
          accessTokenEnc: args.accessEnc,
          refreshTokenEnc: args.refreshEnc,
          expiresAt: args.expiresAt,
          scopes: args.scopesStr,
          displayName: args.displayName,
          updatedAt: new Date(),
        })
        .where(eq(socialAccounts.id, bySub[0].id));
      return;
    }
  }

  const tripleRows = await db.select().from(socialAccounts).where(triple).orderBy(desc(socialAccounts.updatedAt));
  const legacySingleton = tripleRows.filter((r) => !r.externalAccountId?.trim());
  if (legacySingleton.length === 1) {
    await db
      .update(socialAccounts)
      .set({
        accessTokenEnc: args.accessEnc,
        refreshTokenEnc: args.refreshEnc,
        expiresAt: args.expiresAt,
        scopes: args.scopesStr,
        displayName: args.displayName,
        externalAccountId: args.externalAccountId ?? legacySingleton[0].externalAccountId,
        updatedAt: new Date(),
      })
      .where(eq(socialAccounts.id, legacySingleton[0].id));
    return;
  }

  await db.insert(socialAccounts).values({
    id: crypto.randomUUID(),
    userId: payload.userId,
    clientId: payload.clientId,
    platform: platformStored,
    authType: "OAUTH",
    accessTokenEnc: args.accessEnc,
    refreshTokenEnc: args.refreshEnc,
    expiresAt: args.expiresAt,
    scopes: args.scopesStr,
    displayName: args.displayName,
    externalAccountId: args.externalAccountId,
  });
}

/**
 * Complete OAuth for a platform after LinkedIn/Meta redirect.
 * @param platformParam — route segment (e.g. `linkedin`) or pass fixed platform for `/linkedin/callback`
 */
export async function completeSocialOAuthCallback(
  req: NextRequest,
  platformParam: string
): Promise<NextResponse> {
  try {
    const p = parseOAuthRoutePlatformParam(platformParam);
    if (!p) {
      return NextResponse.redirect(`${BASE_URL}/ai-revenue-os?error=invalid_platform`);
    }
    const platformStored = normalizeSocialAccountPlatformForWrite(p);
    if (!platformStored) {
      return NextResponse.redirect(`${BASE_URL}/ai-revenue-os?error=invalid_platform`);
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      const errDesc = searchParams.get("error_description") || error;
      return NextResponse.redirect(
        `${BASE_URL}/ai-revenue-os?error=oauth_denied&message=${encodeURIComponent(errDesc)}`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(`${BASE_URL}/ai-revenue-os?error=missing_code`);
    }

    const payload = verifyOAuthState(state);
    if (!payload || payload.platform !== platformStored) {
      return NextResponse.redirect(`${BASE_URL}/ai-revenue-os?error=invalid_state`);
    }

    const tokens = await exchangeCode(platformStored, code);
    const accessToken = tokens.access_token as string;
    const refreshToken = (tokens.refresh_token as string) || null;
    const expiresIn = (tokens.expires_in as number) || null;
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;

    let displayName: string = platformStored;
    let externalAccountId: string | null = null;
    let tokenToStore = accessToken;
    try {
      if (platformStored === "linkedin") {
        const li = await getLinkedInUserinfo(accessToken);
        displayName = li.displayName;
        externalAccountId = li.sub;
      } else if (platformStored === "instagram" || platformStored === "facebook") {
        const meta = await resolveMetaOAuthConnection({
          userAccessToken: accessToken,
          platform: platformStored,
        });
        tokenToStore = meta.accessToken;
        externalAccountId = meta.externalAccountId;
        displayName = meta.displayName;
      }
    } catch {
      // ignore
    }

    const db = await getDb();
    const accessEnc = encryptToken(tokenToStore);
    const refreshEnc = refreshToken ? encryptToken(refreshToken) : null;
    const scopesStr = PLATFORM_CONFIG[platformStored].scopes.join(" ");

    await upsertSocialAccountRow({
      db,
      payload,
      platformStored,
      accessEnc,
      refreshEnc,
      expiresAt,
      scopesStr,
      displayName,
      externalAccountId,
    });

    const auditId = crypto.randomUUID();
    await db.insert(campaignAuditEvents).values({
      id: auditId,
      userId: payload.userId,
      action: "connect",
      platform: platformStored,
      details: { displayName, externalAccountId },
    });

    const returnPath = sanitizeOAuthReturnPath(payload.returnTo, "/ai-revenue-os");
    const next = new URL(returnPath, BASE_URL);
    next.searchParams.set("connected", platformStored);
    return NextResponse.redirect(next.toString());
  } catch (e) {
    console.error("[social/oauth-complete]", e);
    return NextResponse.redirect(
      `${BASE_URL}/ai-revenue-os?error=oauth_failed&message=${encodeURIComponent(String(e))}`
    );
  }
}
