// Company Filing Awareness API - Provides informational awareness of regulatory instruments
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { companies } from "@/lib/db/schema";
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

export async function GET(request: NextRequest, ctx: { params: Promise<{ companyId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId } = await ctx.params;
  if (!companyId) return NextResponse.json({ error: "Missing companyId" }, { status: 400 });

  const db = await getDb();

  // Verify company ownership
  const companyCheck = await db
    .select({
      id: companies.id,
      companyName: companies.companyName,
      formationState: companies.formationState,
      companyKind: companies.companyKind,
      corpType: companies.corpType,
      draftJson: companies.draftJson,
    })
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.userId, userId)))
    .limit(1);

  if (companyCheck.length === 0) {
    return NextResponse.json({ error: "Company not found or access denied" }, { status: 404 });
  }

  const company = companyCheck[0];

  // Extract EIN information from draft (simplified - would need proper tracking)
  let hasEIN = false;
  let hasBankingIntent = false;

  if (company.draftJson) {
    try {
      const draft = JSON.parse(company.draftJson);
      hasEIN = draft.einPlanned === true;
      hasBankingIntent = draft.bankingReady === true || draft.einPlanned === true;
    } catch (e) {
      // Ignore parsing errors
    }
  }

  // Map company data to filing awareness input
  let entityContext: EntityContext;
  if (company.companyKind === "parent_holding_company") {
    entityContext = "company_parent_holding";
  } else if (company.corpType === "c_corp") {
    entityContext = "company_c_corp";
  } else {
    entityContext = "other";
  }

  // Build events array from company data (simplified for now)
  const events: FilingEvent[] = [];

  // Add events based on company characteristics
  if (hasBankingIntent) {
    events.push("bank_account_opening");
  }

  // You would expand this to include actual workflow events
  // For now, using basic company characteristics

  const input: FilingAwarenessInput = {
    entityContext,
    hasEIN,
    formationState: company.formationState,
    governingLawState: company.formationState,
    isGrantorTrust: null, // Not applicable for companies
    isIrrevocable: null, // Not applicable for companies
    isCharitable: null, // Not applicable for companies
    isReligiousOrg508c1a: null, // Not applicable for companies
    hasBankingIntent,
    hasIncomeProducingAssets: false, // Would need to be determined from assets
    hadFiduciaryChange: false, // Would need workflow tracking
    hadAddressChange: false, // Would need workflow tracking
    hadResponsiblePartyChange: false, // Would need workflow tracking
    hasAuthorizedRep: false, // Would need workflow tracking
    events,
  };

  const result = buildFilingAwareness(input);

  return NextResponse.json(result);
}
