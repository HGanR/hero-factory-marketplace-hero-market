import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { trustAssets, trustBeneficiaries, trustParties, trusts } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";

export async function GET(_request: NextRequest, ctx: { params: Promise<{ trustId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId } = await ctx.params;
  if (!trustId) return NextResponse.json({ error: "Missing trustId" }, { status: 400 });

  const db = await getDb();
  const trustRows = await db
    .select()
    .from(trusts)
    .where(and(eq(trusts.id, String(trustId)), eq(trusts.userId, userId)))
    .limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const t: any = trustRows[0];

  const parties = await db.select().from(trustParties).where(eq(trustParties.trustId, String(trustId)));
  const beneficiaries = await db.select({ id: trustBeneficiaries.id }).from(trustBeneficiaries).where(eq(trustBeneficiaries.trustId, String(trustId)));
  const assets = await db.select({ id: trustAssets.id }).from(trustAssets).where(eq(trustAssets.trustId, String(trustId)));

  const grantor = parties.find((p: any) => p.role === "grantor") ?? null;
  const trustee = parties.find((p: any) => p.role === "trustee") ?? null;

  return NextResponse.json({
    trust: {
      id: String(t.id),
      clientId: t.clientId ?? null,
      name: t.name ?? null,
      trustType: t.trustType ?? null,
      jurisdictionState: t.jurisdictionState ?? null,
      workspaceStatus: t.workspaceStatus ?? null,
    },
    counts: {
      parties: parties.length,
      beneficiaries: beneficiaries.length,
      assets: assets.length,
    },
    checklist: {
      partiesAndRoles: Boolean(grantor?.displayName) && Boolean(trustee?.displayName),
      beneficiaries: beneficiaries.length > 0,
      assetsAndFundingPlan: assets.length > 0,
      generateDraftDocuments: false,
    },
  });
}



