import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPlaybookById } from "@/lib/entity-playbooks";
import { DaoTokenVotingConstitutionSchema } from "@/lib/governance/constitution/dao-token-voting/schema";
import { renderClientReviewSummaryPdf } from "@/lib/templates/client_review_summary_v1";

const RequestSchema = z.object({
  playbookId: z.string(),
  draft: z.any(),
});

export async function POST(req: NextRequest) {
  const body = RequestSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid body", details: body.error.flatten() }, { status: 400 });
  }

  const { playbookId, draft } = body.data;
  const playbook = getPlaybookById(playbookId);
  if (!playbook) {
    return NextResponse.json({ error: "Unknown playbook" }, { status: 400 });
  }

  if (playbook.id === "dao_token_voting_constitution_v1") {
    const payload = draft?.constitutionDraft?.data ?? draft?.constitutionDraft ?? {};
    const parsed = DaoTokenVotingConstitutionSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "BLOCKED", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) },
        { status: 400 }
      );
    }

    const pdfBytes = await renderClientReviewSummaryPdf(parsed.data, {
      entityName: draft?.matterName ?? parsed.data.daoName,
      jurisdiction: draft?.governingState ?? parsed.data.chain,
      acknowledgedAt: draft?.clientReviewAcknowledgedAt,
      acknowledgedBy: draft?.clientReviewAcknowledgedBy,
      acknowledgedRole: draft?.clientReviewAcknowledgedRole,
      signatureHash: draft?.clientReviewSignatureHash,
      signatureDataUrl: draft?.clientReviewSignatureDataUrl,
      isPreview: true,
    });

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${draft?.matterName || "ClientReview"}-Summary.pdf"`,
      },
    });
  }

  return NextResponse.json({ error: "Playbook preview not implemented" }, { status: 501 });
}
