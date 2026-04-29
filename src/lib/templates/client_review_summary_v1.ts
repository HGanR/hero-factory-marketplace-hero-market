import { PDFDocument, StandardFonts } from "pdf-lib";
import type { DaoTokenVotingConstitution } from "@/lib/governance/constitution/dao-token-voting/schema";
import { DAO_SCHEMA_VERSION } from "@/lib/governance/constitution/dao-token-voting/bindings";

export const CLIENT_REVIEW_TEMPLATE_VERSION = "1.0.0";

type SummaryMeta = {
  entityName?: string;
  effectiveDate?: string;
  jurisdiction?: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  acknowledgedRole?: string;
  signatureHash?: string;
  signatureDataUrl?: string;
  isPreview?: boolean;
};

export async function renderClientReviewSummaryPdf(
  data: DaoTokenVotingConstitution,
  meta: SummaryMeta
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage([612, 792]);
  const { height } = page.getSize();

  let y = height - 60;
  const left = 56;
  const line = (text: string, size = 11, bold = false) => {
    page.drawText(text, { x: left, y, size, font: bold ? fontBold : font });
    y -= size + 6;
  };

  line("Client Review Summary", 16, true);
  if (meta.isPreview) {
    line("DRAFT PREVIEW — NOT YET ACKNOWLEDGED", 10, true);
  }
  line(`Entity: ${meta.entityName || data.daoName}`, 11);
  line(`Effective Date: ${meta.effectiveDate || new Date().toISOString().slice(0, 10)}`, 11);
  line(`Jurisdiction/Chain: ${meta.jurisdiction || data.chain}`, 11);
  y -= 10;

  line("Governance Overview", 13, true);
  line(`Governance Platform: ${data.governancePlatform}`);
  line(`Voting Model: ${data.votingUnit}`);
  line(`Proposal Types: ${data.proposalTypes.join(", ")}`);
  line(`Quorum: ${data.quorumBps} bps`);
  line(`Approval: ${data.approvalBps} bps`);
  line(`Supermajority: ${data.supermajorityBps} bps`);
  line(`Voting Period: ${data.votingPeriodDays} days`);
  line(`Timelock: ${data.timelockHours} hours`);
  y -= 6;

  line("Treasury Controls", 13, true);
  line(`Treasury Type: ${data.treasuryType}`);
  if (data.multisigAddress) line(`Multisig: ${data.multisigAddress}`);
  if (typeof data.spendingLimitUsd === "number") line(`Spending Limit: $${data.spendingLimitUsd}`);
  y -= 6;

  line("Safety & Dispute Handling", 13, true);
  line(`Emergency Council: ${data.emergencyCouncilEnabled ? "Enabled" : "Disabled"}`);
  if (data.emergencyPowers.length) line(`Emergency Powers: ${data.emergencyPowers.join(", ")}`);
  line(`Transparency: ${data.recordsTransparency}`);
  line(`Dispute Resolution: ${data.disputeResolution}`);
  y -= 10;

  if (meta.acknowledgedBy) {
    line(`Acknowledged By: ${meta.acknowledgedBy}`, 9);
  }
  if (meta.acknowledgedRole) {
    line(`Role/Title: ${meta.acknowledgedRole}`, 9);
  }
  if (meta.acknowledgedAt) {
    line(`Acknowledged At: ${meta.acknowledgedAt}`, 9);
  }
  if (meta.signatureHash) {
    line(`Signature Hash: ${meta.signatureHash}`, 9);
  }
  line(`Schema Version: ${DAO_SCHEMA_VERSION}`, 9);
  line(`Template Version: ${CLIENT_REVIEW_TEMPLATE_VERSION}`, 9);
  line("This summary is for client review and confirmation.", 9);

  if (meta.signatureDataUrl?.startsWith("data:image/png")) {
    const base64 = meta.signatureDataUrl.split(",")[1] ?? "";
    const bytes = Uint8Array.from(Buffer.from(base64, "base64"));
    const png = await pdfDoc.embedPng(bytes);
    const pngDims = png.scale(0.5);
    const sigPage = pdfDoc.addPage([612, 200]);
    sigPage.drawText("Client Signature", { x: 56, y: 160, size: 12, font: fontBold });
    sigPage.drawImage(png, { x: 56, y: 40, width: pngDims.width, height: pngDims.height });
  }

  return pdfDoc.save();
}
