import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { resolveAgentRuntimeType } from "@/lib/agents/agent-runtime-types";
import { getPreferredSkipperAgentRowForUser, getSkipperOutputVoiceForUser } from "@/lib/voices/executive-skipper-output-voice";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const db = await getDb();
    const voice = await getSkipperOutputVoiceForUser(db, adminUserId);
    const preferred = await getPreferredSkipperAgentRowForUser(db, adminUserId);
    const preferredSkipperRuntimeType = preferred
      ? resolveAgentRuntimeType({ agentRuntimeType: preferred.agentRuntimeType, name: preferred.name })
      : null;
    return NextResponse.json({
      voice,
      source: voice ? "db" : "not_configured",
      preferredSkipperRuntimeType,
      preferredAgentId: preferred?.id ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "OUTPUT_PROFILE_FAILED", message: msg }, { status: 500 });
  }
}
