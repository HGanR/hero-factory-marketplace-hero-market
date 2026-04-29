import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { calculateGovernanceHealth } from "@/lib/governance/health-scoring";

export async function GET(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const trustId = searchParams.get("trustId");

    if (!trustId) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "trustId is required" } },
        { status: 400 }
      );
    }

    const health = await calculateGovernanceHealth(trustId);

    return NextResponse.json({ ok: true, health });
  } catch (error: any) {
    console.error("Health score error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to calculate health score" } },
      { status: 500 }
    );
  }
}
