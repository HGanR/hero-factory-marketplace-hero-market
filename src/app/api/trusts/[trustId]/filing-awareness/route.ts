// Trust Filing Awareness API - Provides informational awareness of regulatory instruments
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { trusts } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";
import { buildFilingAwareness, FilingAwarenessInput, EntityContext } from "@/lib/filing-awareness/engine";
import { FilingEvent } from "@/lib/filing-awareness/types";

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ trustId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId } = await ctx.params;
  if (!trustId) return NextResponse.json({ error: "Missing trustId" }, { status: 400 });

  const db = await getDb();

  // Verify trust ownership
  const trustCheck = await db
    .select({
      id: trusts.id,
      trustType: trusts.trustType,
      workspaceStatus: trusts.workspaceStatus,
      jurisdictionState: trusts.jurisdictionState,
      governingLawState: trusts.governingLawState,
    })
    .from(trusts)
    .where(and(eq(trusts.id, trustId), eq(trusts.userId, userId)))
    .limit(1);

  if (trustCheck.length === 0) {
    return NextResponse.json({ error: "Trust not found or access denied" }, { status: 404 });
  }

  const trust = trustCheck[0];

  // Map trust data to filing awareness input
  let entityContext: EntityContext;
  switch (trust.trustType) {
    case "revocable_living_trust":
      entityContext = "revocable_living_trust";
      break;
    case "irrevocable_trust":
      entityContext = "irrevocable_trust";
      break;
    default:
      entityContext = "other";
  }

  // Build events array from trust data (simplified for now)
  const events: FilingEvent[] = [];

  // You would expand this to include actual workflow events
  // For now, using basic trust characteristics

  // Infer some characteristics from trust type
  const isIrrevocable = trust.trustType === "irrevocable_trust";

  const input: FilingAwarenessInput = {
    entityContext,
    hasEIN: false, // Would need to be tracked separately
    formationState: trust.jurisdictionState,
    governingLawState: trust.governingLawState,
    isGrantorTrust: trust.trustType === "revocable_living_trust" ? true : null,
    isIrrevocable: isIrrevocable,
    isCharitable: null, // Would need to be tracked separately
    isReligiousOrg508c1a: null, // Not applicable for trusts
    hasBankingIntent: false, // Would need to be tracked separately
    hasIncomeProducingAssets: isIrrevocable, // Irrevocable trusts often have assets
    hadFiduciaryChange: false, // Would need workflow tracking
    hadAddressChange: false, // Would need workflow tracking
    hadResponsiblePartyChange: false, // Would need workflow tracking
    hasAuthorizedRep: false, // Would need workflow tracking
    events,
  };

  const result = buildFilingAwareness(input);

  return NextResponse.json(result);
}
