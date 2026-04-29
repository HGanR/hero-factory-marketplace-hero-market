import { PDFDocument, StandardFonts } from "pdf-lib";
import type { DaoTokenVotingConstitution } from "@/lib/governance/constitution/dao-token-voting/schema";
import { DAO_SCHEMA_VERSION } from "@/lib/governance/constitution/dao-token-voting/bindings";

type RenderMeta = {
  entityName?: string;
  effectiveDate?: string;
  jurisdiction?: string;
};

export const DAO_CONSTITUTION_TEMPLATE_VERSION = "1.0.0";

export async function renderDaoTokenVotingConstitutionPdf(
  data: DaoTokenVotingConstitution,
  meta: RenderMeta
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([612, 792]);
  const { width, height } = page.getSize();

  let y = height - 60;
  const left = 56;
  const line = (text: string, size = 11, bold = false) => {
    page.drawText(text, { x: left, y, size, font: bold ? fontBold : font });
    y -= size + 6;
  };

  line("DAO Constitution (Token Voting)", 16, true);
  line(`Entity: ${meta.entityName || data.daoName}`, 11);
  line(`Effective Date: ${meta.effectiveDate || new Date().toISOString().slice(0, 10)}`, 11);
  line(`Jurisdiction/Chain: ${meta.jurisdiction || data.chain}`, 11);
  y -= 10;

  line("Purpose", 13, true);
  line(data.mission, 11);
  y -= 6;

  line("Governance Parameters", 13, true);
  line(`Governance Platform: ${data.governancePlatform}`);
  line(`Voting Model: ${data.votingUnit}`);
  line(`Proposal Types: ${data.proposalTypes.join(", ")}`);
  line(`Quorum: ${data.quorumBps} bps`);
  line(`Approval Threshold: ${data.approvalBps} bps`);
  line(`Supermajority Threshold: ${data.supermajorityBps} bps`);
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

  line(`Schema Version: ${DAO_SCHEMA_VERSION}`, 9);
  line(`Template Version: ${DAO_CONSTITUTION_TEMPLATE_VERSION}`, 9);
  line("This document is generated for drafting and review. It is not legal advice.", 9);

  return pdfDoc.save();
}
