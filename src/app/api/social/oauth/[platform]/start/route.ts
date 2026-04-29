import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import {
  PLATFORM_CONFIG,
  getRedirectUri,
  getClientId,
  type SocialPlatform,
} from "@/lib/social/config";
import { createOAuthState } from "@/lib/social/oauth-state";
import { sanitizeOAuthReturnPath } from "@/lib/social/oauth-return-to";
import {
  normalizeSocialAccountPlatformForWrite,
  OAUTH_CONNECTABLE_PLATFORM_IDS,
  parseOAuthRoutePlatformParam,
} from "@/lib/social/platform-identity";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { platform } = await params;
    const p = parseOAuthRoutePlatformParam(platform);
    if (!p) {
      return NextResponse.json(
        {
          error: "INVALID_PLATFORM",
          message: `Supported: ${OAUTH_CONNECTABLE_PLATFORM_IDS.join(", ")}`,
        },
        { status: 400 }
      );
    }
    const platformStored = normalizeSocialAccountPlatformForWrite(p);
    if (!platformStored) {
      return NextResponse.json(
        {
          error: "INVALID_PLATFORM",
          message: `Supported: ${OAUTH_CONNECTABLE_PLATFORM_IDS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const config = PLATFORM_CONFIG[platformStored];
    if (!config.enabled) {
      return NextResponse.json(
        {
          error: "PLATFORM_DISABLED",
          message: `${platform} OAuth is not configured. Set ${config.clientIdKey} and ${config.clientSecretKey}.`,
        },
        { status: 503 }
      );
    }

    const clientId = getClientId(platformStored);
    if (!clientId) {
      return NextResponse.json({ error: "OAuth not configured" }, { status: 503 });
    }

    const { searchParams } = new URL(req.url);
    const clientIdParam = searchParams.get("clientId")?.trim() || "";
    const returnTo = sanitizeOAuthReturnPath(searchParams.get("returnTo")?.trim() || "/ai-revenue-os");

    const state = createOAuthState({
      userId: String(userId),
      clientId: clientIdParam,
      platform: platformStored,
      returnTo,
    });

    const redirectUri = getRedirectUri(platformStored);
    const authUrl = new URL(config.authUrl);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set(config.useClientKey ? "client_key" : "client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", config.scopes.join(config.useClientKey ? "," : " "));
    authUrl.searchParams.set("state", state);
    if (platformStored === "linkedin") {
      authUrl.searchParams.set("grant_type", "authorization_code");
    }

    return NextResponse.redirect(authUrl.toString());
  } catch (e) {
    console.error("[social/oauth/start]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
