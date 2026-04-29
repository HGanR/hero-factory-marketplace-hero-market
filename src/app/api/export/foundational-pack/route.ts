import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import archiver from "archiver";
import { PDFDocument } from "pdf-lib";
import { getPlaybookById } from "@/lib/entity-playbooks";
import { DaoTokenVotingConstitutionSchema } from "@/lib/governance/constitution/dao-token-voting/schema";
import { renderDaoTokenVotingConstitutionPdf, DAO_CONSTITUTION_TEMPLATE_VERSION } from "@/lib/templates/dao/constitution_token_voting_v1";
import { renderClientReviewSummaryPdf, CLIENT_REVIEW_TEMPLATE_VERSION } from "@/lib/templates/client_review_summary_v1";
import { FamilyOfficePlaybookStateSchema, evaluateFamilyOfficeReadiness } from "@/lib/playbooks/family-office/schema";
import {
  FAMILY_OFFICE_PROTOCOL_ITEMS,
  FAMILY_OFFICE_PROTOCOL_TEMPLATE_VERSION,
  renderFamilyOfficeProtocolPdf,
} from "@/lib/templates/family_office_protocol_v1";

const RequestSchema = z.object({
  playbookId: z.string(),
  draft: z.any(),
  format: z.enum(["pdf", "zip"]).default("pdf"),
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
    if (
      !draft?.clientReviewAcknowledgedAt ||
      !(draft?.clientReviewAcknowledgedBy ?? "").trim() ||
      !(draft?.clientReviewSignatureDataUrl ?? "").trim() ||
      !(draft?.clientReviewAcknowledgedRole ?? "").trim()
    ) {
      return NextResponse.json({ error: "CLIENT_REVIEW_REQUIRED" }, { status: 400 });
    }
    const signatureDataUrl = String(draft?.clientReviewSignatureDataUrl ?? "");
    const signatureHash = String(draft?.clientReviewSignatureHash ?? "");
    if (signatureDataUrl && signatureHash) {
      const digest = crypto.createHash("sha256").update(signatureDataUrl).digest("hex");
      if (digest !== signatureHash) {
        return NextResponse.json({ error: "SIGNATURE_HASH_MISMATCH" }, { status: 400 });
      }
    }
    const payload = draft?.constitutionDraft?.data ?? draft?.constitutionDraft ?? {};
    const parsed = DaoTokenVotingConstitutionSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "BLOCKED", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) },
        { status: 400 }
      );
    }

    const summaryBytes = await renderClientReviewSummaryPdf(parsed.data, {
      entityName: draft?.matterName ?? parsed.data.daoName,
      jurisdiction: draft?.governingState ?? parsed.data.chain,
      acknowledgedAt: draft?.clientReviewAcknowledgedAt,
      acknowledgedBy: draft?.clientReviewAcknowledgedBy,
      acknowledgedRole: draft?.clientReviewAcknowledgedRole,
      signatureHash: draft?.clientReviewSignatureHash,
      signatureDataUrl: draft?.clientReviewSignatureDataUrl,
      isPreview: false,
    });

    const constitutionBytes = await renderDaoTokenVotingConstitutionPdf(parsed.data, {
      entityName: draft?.matterName ?? parsed.data.daoName,
      jurisdiction: draft?.governingState ?? parsed.data.chain,
    });

    const docs = [
      {
        filename: "00_Client_Review_Summary.pdf",
        bytes: summaryBytes,
        docId: "client_review_summary",
        schemaVersion: "1.0.0",
        templateVersion: CLIENT_REVIEW_TEMPLATE_VERSION,
      },
      {
        filename: "01_Constitution_DAO_Token_Voting.pdf",
        bytes: constitutionBytes,
        docId: "constitution:dao_token_voting",
        schemaVersion: "1.0.0",
        templateVersion: DAO_CONSTITUTION_TEMPLATE_VERSION,
      },
    ];

    const manifest = {
      playbookId: playbook.id,
      exportedAt: new Date().toISOString(),
      docs: docs.map((d) => ({
        filename: d.filename,
        docId: d.docId,
        schemaVersion: d.schemaVersion,
        templateVersion: d.templateVersion,
        sha256: crypto.createHash("sha256").update(d.bytes).digest("hex"),
      })),
    };
    const bundleSha256 = crypto.createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
    (manifest as any).bundleSha256 = bundleSha256;

    if (body.data.format === "zip") {
      const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
        const archive = archiver("zip", { zlib: { level: 9 } });
        const chunks: Buffer[] = [];
        archive.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        archive.on("end", () => resolve(Buffer.concat(chunks)));
        archive.on("error", reject);
        docs.forEach((doc) => archive.append(Buffer.from(doc.bytes), { name: doc.filename }));
        archive.append(JSON.stringify(manifest, null, 2), { name: "MANIFEST.json" });
        archive.finalize().catch(reject);
      });
      const zipSha256 = crypto.createHash("sha256").update(zipBuffer).digest("hex");

      return new NextResponse(Buffer.from(zipBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${draft?.matterName || "FoundationalPack"}-DAO-Pack.zip"`,
          "X-Pack-Sha256": zipSha256,
        },
      });
    }

    const merged = await PDFDocument.create();
    for (const doc of docs) {
      const pdf = await PDFDocument.load(doc.bytes);
      const pages = await merged.copyPages(pdf, pdf.getPageIndices());
      pages.forEach((p) => merged.addPage(p));
    }
    const mergedBytes = await merged.save();

    return new NextResponse(Buffer.from(mergedBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${draft?.matterName || "FoundationalPack"}-DAO-Pack.pdf"`,
      },
    });
  }

  if (playbook.id === "family_office_v1") {
    if (
      !draft?.clientReviewAcknowledgedAt ||
      !(draft?.clientReviewAcknowledgedBy ?? "").trim() ||
      !(draft?.clientReviewSignatureDataUrl ?? "").trim() ||
      !(draft?.clientReviewAcknowledgedRole ?? "").trim()
    ) {
      return NextResponse.json({ error: "CLIENT_REVIEW_REQUIRED" }, { status: 400 });
    }

    const signatureDataUrl = String(draft?.clientReviewSignatureDataUrl ?? "");
    const signatureHash = String(draft?.clientReviewSignatureHash ?? "");
    if (signatureDataUrl && signatureHash) {
      const digest = crypto.createHash("sha256").update(signatureDataUrl).digest("hex");
      if (digest !== signatureHash) {
        return NextResponse.json({ error: "SIGNATURE_HASH_MISMATCH" }, { status: 400 });
      }
    }

    const checklist = (draft?.familyOfficeProtocolChecklist ?? {}) as Record<string, boolean>;
    const missingProtocolItems = FAMILY_OFFICE_PROTOCOL_ITEMS.filter((item) => checklist[item.id] !== true).map(
      (item) => item.label
    );
    if (missingProtocolItems.length > 0) {
      return NextResponse.json(
        { error: "BLOCKED", blockers: missingProtocolItems, advisories: [] },
        { status: 400 }
      );
    }

    const payload = draft?.familyOfficePlaybookState ?? draft?.playbookState ?? {};
    const parsed = FamilyOfficePlaybookStateSchema.safeParse(payload);
    const playbookReadiness = parsed.success ? evaluateFamilyOfficeReadiness(parsed.data) : null;

    const protocolBytes = await renderFamilyOfficeProtocolPdf(checklist, {
      matterName: draft?.matterName,
      governingState: draft?.governingState,
      familyOfficeStructure: draft?.familyOfficeStructure,
      servicesScope: draft?.servicesScope,
      investmentAdviserConsiderations: draft?.investmentAdviserConsiderations,
      attorneyNotes: draft?.attorneyNotes,
      acknowledgedBy: draft?.clientReviewAcknowledgedBy,
      acknowledgedRole: draft?.clientReviewAcknowledgedRole,
      acknowledgedAt: draft?.clientReviewAcknowledgedAt,
    });

    const docs = [
      {
        filename: "00_Family_Office_Protocol_Packet.pdf",
        bytes: protocolBytes,
        docId: "policy:family_office_protocol",
        schemaVersion: "1.0.0",
        templateVersion: FAMILY_OFFICE_PROTOCOL_TEMPLATE_VERSION,
      },
    ];

    const manifest = {
      playbookId: playbook.id,
      exportedAt: new Date().toISOString(),
      docs: docs.map((d) => ({
        filename: d.filename,
        docId: d.docId,
        schemaVersion: d.schemaVersion,
        templateVersion: d.templateVersion,
        sha256: crypto.createHash("sha256").update(d.bytes).digest("hex"),
      })),
      warnings: playbookReadiness && !playbookReadiness.isReady ? playbookReadiness.blockers : [],
      advisories: playbookReadiness?.advisories ?? [],
    };
    const bundleSha256 = crypto.createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
    (manifest as any).bundleSha256 = bundleSha256;

    if (body.data.format === "zip") {
      const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
        const archive = archiver("zip", { zlib: { level: 9 } });
        const chunks: Buffer[] = [];
        archive.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        archive.on("end", () => resolve(Buffer.concat(chunks)));
        archive.on("error", reject);
        docs.forEach((doc) => archive.append(Buffer.from(doc.bytes), { name: doc.filename }));
        archive.append(JSON.stringify(manifest, null, 2), { name: "MANIFEST.json" });
        archive.finalize().catch(reject);
      });
      const zipSha256 = crypto.createHash("sha256").update(zipBuffer).digest("hex");

      return new NextResponse(Buffer.from(zipBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${draft?.matterName || "FoundationalPack"}-Family-Office-Pack.zip"`,
          "X-Pack-Sha256": zipSha256,
        },
      });
    }

    return new NextResponse(Buffer.from(protocolBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${draft?.matterName || "FoundationalPack"}-Family-Office-Pack.pdf"`,
      },
    });
  }

  return NextResponse.json({ error: "Playbook export not implemented" }, { status: 501 });
}
