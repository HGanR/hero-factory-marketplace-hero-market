import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { wizardSessions } from "@/lib/db/schema";
import { IrrevocableTrustWizardSchema } from "@/lib/irrevocableTrust/schema";
import { and, eq } from "drizzle-orm";
import { createHash } from "crypto";

/**
 * Review-only assembly. Never serves an executed trust, downloadable PDF,
 * attorney-approved clause set, or print authorization.
 * Sensitive intake remains behind session ownership checks.
 */
export async function GET(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });

  const sessionId = new URL(req.url).searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ ok: false, error: { code: "SESSION_REQUIRED" } }, { status: 400 });

  try {
    const db = await getDb();
    const rows = await db.select().from(wizardSessions).where(
      and(eq(wizardSessions.id, sessionId), eq(wizardSessions.userId, userId), eq(wizardSessions.kind, "IRREVOCABLE_TRUST"))
    ).limit(1);
    if (!rows.length) return NextResponse.json({ ok: false, error: { code: "NOT_FOUND" } }, { status: 404 });

    const data = JSON.parse(rows[0].dataJson || "{}");
    const parsed = IrrevocableTrustWizardSchema.safeParse(data);
    if (!parsed.success) return NextResponse.json({
      ok: false,
      error: { code: "INCOMPLETE_INTAKE", message: "Finish all required wizard sections before requesting a review packet.", details: parsed.error.flatten() },
    }, { status: 422 });

    const d = parsed.data;
    const sections = [
      { id: "establishment", title: "Proposed establishment", fields: { trustName: d.terms.trustName, trustType: d.terms.trustType, governingState: d.state.governingState, effectiveDate: d.state.effectiveDate } },
      { id: "parties", title: "Parties and appointments", fields: { grantor: d.parties.grantor, trustees: d.parties.trustees, successorTrustees: d.parties.successorTrustees } },
      { id: "beneficiaries", title: "Proposed beneficial interests", fields: { beneficiaries: d.parties.beneficiaries } },
      { id: "purpose", title: "Purpose and terms", fields: { purposeNotes: d.terms.purposeNotes, spendthriftRequested: d.terms.spendthrift } },
      { id: "distributions", title: "Distribution instructions", fields: d.distributions },
      { id: "powers", title: "Requested fiduciary powers", fields: d.powers },
      { id: "funding", title: "Proposed funding", fields: d.funding },
    ];
    const reviewQuestions = [
      "Confirm governing law, valid trust purpose, and legal creation requirements.",
      "Draft and review operative trust terms, including fiduciary duties, succession, distributions, and termination.",
      "Check whether special trust types, tax elections, beneficiary interests, and spendthrift provisions are legally appropriate.",
      "Confirm signatures, witnesses or acknowledgments, and separate asset-transfer formalities.",
      "Review tax identification and reporting with a qualified professional where necessary.",
    ];
    const canonical = JSON.stringify({ schemaVersion: 1, sessionId, sections, reviewQuestions });
    const sha256 = createHash("sha256").update(canonical).digest("hex");

    return NextResponse.json({
      ok: true,
      packet: {
        kind: "TRUST_DRAFTING_INSTRUCTIONS",
        schemaVersion: 1,
        status: "DRAFT_PENDING_LEGAL_REVIEW",
        sessionId,
        sha256,
        title: `${d.terms.trustName} — Legal Review Intake Packet`,
        sections,
        reviewQuestions,
        disclaimer: "Confidential drafting instructions only. Not a trust declaration, attorney approval, executed instrument, certificate, or proof of funding.",
      },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Review packet assembly failed", error);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}
