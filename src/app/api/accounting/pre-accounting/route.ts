import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import type { PreAccountingProfile, TransactionSnapshot } from "@/lib/accounting/pre-accounting/types";
import {
  loadWorkspaceState,
  upsertProfile,
  recomputeReadinessAndForms,
  getProfileByUserAndYear,
} from "@/lib/accounting/pre-accounting/server/workspace";
import { rowToPreAccountingProfile } from "@/lib/accounting/pre-accounting/server/profile-map";
import { evaluateHandoffReadinessGateForProfile } from "@/lib/accounting/pre-accounting/server/readiness-gate";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const taxYear = Math.min(
      2100,
      Math.max(2000, Number(request.nextUrl.searchParams.get("taxYear") || new Date().getFullYear()))
    );
    const data = await loadWorkspaceState(userId, taxYear);
    return NextResponse.json({ ok: true, ...data });
  } catch (e) {
    console.error("[pre-accounting GET]", e);
    return NextResponse.json({ error: "Failed to load workspace" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = (await request.json()) as {
      profile: PreAccountingProfile;
      ledgerSnapshot: TransactionSnapshot;
      handoffReadinessOverrideNote?: string | null;
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

    const existing = await getProfileByUserAndYear(userId, body.profile.taxYear);
    const prevStatus = existing?.reviewStatus ?? "draft";
    const nextStatus = body.profile.reviewStatus ?? prevStatus;
    const elevated =
      (nextStatus === "ready_for_preparer" || nextStatus === "finalized_for_handoff") && nextStatus !== prevStatus;

    let profileForUpsert = body.profile;
    if (elevated && existing) {
      const mergedForGate: PreAccountingProfile = {
        ...rowToPreAccountingProfile(existing),
        ...body.profile,
        reviewStatus: nextStatus,
      };
      const gate = await evaluateHandoffReadinessGateForProfile(existing.id, mergedForGate, ledger);
      const overrideOk =
        typeof body.handoffReadinessOverrideNote === "string" && body.handoffReadinessOverrideNote.trim().length > 0;
      if (!gate.passed && !overrideOk) {
        return NextResponse.json({ ok: false, error: "Readiness gate not satisfied", gate }, { status: 422 });
      }
      if (gate.passed) {
        profileForUpsert = {
          ...profileForUpsert,
          handoffReadinessOverrideNote: null,
          handoffReadinessOverrideAt: null,
        };
      } else if (overrideOk) {
        profileForUpsert = {
          ...profileForUpsert,
          handoffReadinessOverrideNote: body.handoffReadinessOverrideNote!.trim(),
          handoffReadinessOverrideAt: new Date().toISOString(),
        };
      }
    }

    const { id, profile: saved } = await upsertProfile(userId, profileForUpsert, userId);
    await recomputeReadinessAndForms(id, saved, ledger, userId);
    const data = await loadWorkspaceState(userId, saved.taxYear);
    return NextResponse.json({ ok: true, ...data });
  } catch (e) {
    console.error("[pre-accounting PUT]", e);
    return NextResponse.json({ error: "Failed to save workspace" }, { status: 500 });
  }
}
