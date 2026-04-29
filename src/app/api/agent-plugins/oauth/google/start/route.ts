import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { canAccessAgent } from "@/lib/agents/agent-access";
import { createAgentPluginOAuthState } from "@/lib/agent-plugins/oauth-state";
import { GOOGLE_AGENT_SCOPES } from "@/lib/agent-plugins/registry";
import { getGoogleAgentClientId, getGoogleAgentRedirectUri, isGoogleAgentOAuthConfigured } from "@/lib/agent-plugins/google-config";
import { sanitizeOAuthReturnPath } from "@/lib/social/oauth-return-to";

export async function GET(req: NextRequest) {
  try {
    const userId = requireUserId(req);
    if (!isGoogleAgentOAuthConfigured()) {
      return NextResponse.json(
        { error: "Google agent OAuth is not configured (set GOOGLE_AGENT_CLIENT_ID and GOOGLE_AGENT_CLIENT_SECRET)." },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId")?.trim() ?? "";
    if (!agentId) {
      return NextResponse.json({ error: "agentId is required" }, { status: 400 });
    }

    const ok = await canAccessAgent(agentId, userId);
    if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const returnTo = sanitizeOAuthReturnPath(searchParams.get("returnTo")?.trim() || "/app/agents");

    const state = createAgentPluginOAuthState({
      userId: String(userId),
      agentId,
      returnTo,
    });

    const clientId = getGoogleAgentClientId()!;
    const redirectUri = getGoogleAgentRedirectUri();

    const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    auth.searchParams.set("client_id", clientId);
    auth.searchParams.set("redirect_uri", redirectUri);
    auth.searchParams.set("response_type", "code");
    auth.searchParams.set("scope", GOOGLE_AGENT_SCOPES.join(" "));
    auth.searchParams.set("access_type", "offline");
    auth.searchParams.set("prompt", "consent");
    auth.searchParams.set("state", state);

    return NextResponse.redirect(auth.toString());
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("[agent-plugins/google/start]", e);
    return NextResponse.json({ error: "OAuth start failed" }, { status: 500 });
  }
}
