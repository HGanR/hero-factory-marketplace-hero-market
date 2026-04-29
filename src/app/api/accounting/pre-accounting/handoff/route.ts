import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import type { HandoffComposition, PreAccountingProfile, TransactionSnapshot } from "@/lib/accounting/pre-accounting/types";
import { createHandoffPacket, upsertProfile, recomputeReadinessAndForms } from "@/lib/accounting/pre-accounting/server/workspace";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = (await request.json()) as {
      profile: PreAccountingProfile;
      ledgerSnapshot: TransactionSnapshot;
      packetName?: string;
      taxYear?: number;
      composition?: HandoffComposition;
    };
    if (!body?.profile?.taxYear) {
      return NextResponse.json({ error: "profile.taxYear required" }, { status: 400 });
    }
    const ledger: TransactionSnapshot = body.ledgerSnapshot ?? {
      incomeCount: 0,
      expenseCount: 0,
      uncategorizedCount: 0,
      totalTransactions: 0,
    };
    const packetName =
      (typeof body.packetName === "string" && body.packetName.trim()) ||
      `Tax prep handoff ${body.profile.taxYear}`;

    const { id: profileId, profile: saved } = await upsertProfile(userId, body.profile, userId);
    await recomputeReadinessAndForms(profileId, saved, ledger, userId);
    const { handoffId, bundleUrl } = await createHandoffPacket(
      userId,
      profileId,
      saved,
      ledger,
      packetName,
      body.composition
    );

    return NextResponse.json({ ok: true, handoffId, bundleUrl });
  } catch (e) {
    console.error("[pre-accounting handoff POST]", e);
    return NextResponse.json({ error: "Handoff generation failed" }, { status: 500 });
  }
}
