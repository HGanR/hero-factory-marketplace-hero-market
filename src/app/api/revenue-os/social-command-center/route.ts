import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import {
  buildBentleySocialCommandCenter,
  type CommandCenterSection,
} from "@/lib/revenue-os/social-command-center";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
function parseBool(v: string | null, defaultTrue: boolean): boolean {
  if (v == null) return defaultTrue;
  const lower = v.toLowerCase();
  if (lower === "false" || lower === "0") return false;
  if (lower === "true" || lower === "1") return true;
  return defaultTrue;
}

function parseSection(v: string | null): CommandCenterSection | undefined {
  if (!v?.trim()) return undefined;
  const s = v.trim().toLowerCase();
  const allowed: CommandCenterSection[] = [
    "all",
    "planner",
    "intelligence",
    "inbox",
    "approvals",
    "reports",
    "accounts",
  ];
  return allowed.includes(s as CommandCenterSection) ? (s as CommandCenterSection) : undefined;
}

export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/social-command-center", req);
    const sp = req.nextUrl.searchParams;
    const clientId = sp.get("clientId")?.trim() || undefined;
    const trustId = sp.get("trustId")?.trim() || undefined;
    const section = parseSection(sp.get("section"));
    const includeHeavyReports = parseBool(sp.get("includeHeavyReports"), true);

    const userId = await getAuthedUserId();
    if (userId == null) {
      const { commandCenter, generatedAt } = await buildBentleySocialCommandCenter({
        userId: "",
        section: "all",
        includeHeavyReports: false,
      });
      return NextResponse.json({
        signedOut: true,
        commandCenter,
        generatedAt,
      });
    }

    const uid = String(userId);
    const { commandCenter, generatedAt } = await buildBentleySocialCommandCenter({
      userId: uid,
      clientId,
      trustId,
      section,
      includeHeavyReports,
    });

    return NextResponse.json({
      signedOut: false,
      commandCenter,
      generatedAt,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
