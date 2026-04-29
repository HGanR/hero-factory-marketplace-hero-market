import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { requireUserId } from "@/lib/auth";
import { canAccessAgent } from "@/lib/agents/agent-access";
import { verifyAgentPluginOAuthState } from "@/lib/agent-plugins/oauth-state";
import { getGoogleAgentClientId, getGoogleAgentClientSecret, getGoogleAgentRedirectUri } from "@/lib/agent-plugins/google-config";
import { encryptToken } from "@/lib/social/encrypt";
import { getDb } from "@/lib/db";
import { ensureAgentTables } from "@/lib/db/agents-ensure";
import { agentPluginCredentials } from "@/lib/db/schema";
import { sanitizeOAuthReturnPath } from "@/lib/social/oauth-return-to";

const PROVIDER_GOOGLE = "google";

export async function GET(req: NextRequest) {
  try {
    const userId = requireUserId(req);
    const { searchParams } = new URL(req.url);
    const err = searchParams.get("error");
    if (err) {
      return NextResponse.redirect(
        new URL(`/app/agents?google_error=${encodeURIComponent(err)}`, req.url).toString()
      );
    }

    const code = searchParams.get("code");
    const stateRaw = searchParams.get("state");
    if (!code || !stateRaw) {
      return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
    }

    const state = verifyAgentPluginOAuthState(stateRaw);
    if (!state || state.userId !== String(userId)) {
      return NextResponse.json({ error: "Invalid state" }, { status: 400 });
    }

    const agentId = state.agentId;
    const ok = await canAccessAgent(agentId, userId);
    if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const clientId = getGoogleAgentClientId();
    const clientSecret = getGoogleAgentClientSecret();
    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: "OAuth not configured" }, { status: 503 });
    }

    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getGoogleAgentRedirectUri(),
      grant_type: "authorization_code",
    });

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const tokenJson = (await tokenRes.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      error?: string;
    };

    if (!tokenRes.ok || !tokenJson.access_token) {
      console.error("[google/callback] token error", tokenJson);
      return NextResponse.redirect(
        new URL(
          `/app/agents?google_error=${encodeURIComponent(tokenJson.error ?? "token_exchange")}`,
          req.url
        ).toString()
      );
    }

    const refresh = tokenJson.refresh_token ?? "";
    const scopes = (tokenJson.scope ?? "")
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const expiresIn = typeof tokenJson.expires_in === "number" ? tokenJson.expires_in : 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const db = await getDb();
    await ensureAgentTables();
    const [existing] = await db
      .select()
      .from(agentPluginCredentials)
      .where(
        and(eq(agentPluginCredentials.agentId, agentId), eq(agentPluginCredentials.provider, PROVIDER_GOOGLE))
      )
      .limit(1);

    const accessEnc = encryptToken(tokenJson.access_token);
    const refreshEnc = refresh
      ? encryptToken(refresh)
      : existing?.refreshTokenEnc ?? null;

    const rowId = existing?.id ?? crypto.randomUUID();

    await db
      .insert(agentPluginCredentials)
      .values({
        id: rowId,
        agentId,
        provider: PROVIDER_GOOGLE,
        refreshTokenEnc: refreshEnc,
        accessTokenEnc: accessEnc,
        expiresAt,
        scopesJson: JSON.stringify(scopes),
        lastError: null,
      })
      .onDuplicateKeyUpdate({
        set: {
          refreshTokenEnc: refreshEnc ?? undefined,
          accessTokenEnc: accessEnc,
          expiresAt,
          scopesJson: JSON.stringify(scopes),
          lastError: null,
          updatedAt: new Date(),
        },
      });

    const returnTo = sanitizeOAuthReturnPath(state.returnTo, "/app/agents");
    const sep = returnTo.includes("?") ? "&" : "?";
    const url = `${returnTo}${sep}google_connected=1&agent=${encodeURIComponent(agentId)}`;
    return NextResponse.redirect(new URL(url, req.url).toString());
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("[agent-plugins/google/callback]", e);
    return NextResponse.json({ error: "Callback failed" }, { status: 500 });
  }
}
