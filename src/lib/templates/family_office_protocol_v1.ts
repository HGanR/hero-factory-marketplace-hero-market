import { PDFDocument, PDFPage, PDFFont, StandardFonts } from "pdf-lib";

export const FAMILY_OFFICE_PROTOCOL_TEMPLATE_VERSION = "1.0.0";

export const FAMILY_OFFICE_PROTOCOL_ITEMS: Array<{ id: string; label: string }> = [
  { id: "charter_intent", label: "Family Office charter intent documented" },
  { id: "ownership_layer", label: "Ownership layer defined (trust/foundation + holding entity)" },
  { id: "management_entity", label: "Family Office management entity designated" },
  { id: "asset_segregation_plan", label: "Asset segregation/SPV plan completed" },
  { id: "governance_charter", label: "Governance charter and authority matrix completed" },
  { id: "investment_policy", label: "Investment policy and risk limits documented" },
  { id: "compliance_guardrails", label: "Securities/compliance guardrails reviewed" },
  { id: "succession_plan", label: "Succession and continuity plan documented" },
];

type FamilyOfficeProtocolChecklist = Record<string, boolean>;

type FamilyOfficeProtocolMeta = {
  matterName?: string;
  governingState?: string | null;
  familyOfficeStructure?: string;
  servicesScope?: string[];
  investmentAdviserConsiderations?: string;
  attorneyNotes?: string;
  acknowledgedBy?: string;
  acknowledgedRole?: string;
  acknowledgedAt?: string;
};

function drawWrappedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  font: PDFFont,
  fontSize: number
): number {
  const words = text.split(/\s+/).filter(Boolean);
  let line = "";
  let cursorY = y;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, fontSize);
    if (width > maxWidth && line) {
      page.drawText(line, { x, y: cursorY, size: fontSize, font });
      cursorY -= lineHeight;
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) {
    page.drawText(line, { x, y: cursorY, size: fontSize, font });
    cursorY -= lineHeight;
  }
  return cursorY;
}

export async function renderFamilyOfficeProtocolPdf(
  checklist: FamilyOfficeProtocolChecklist,
  meta: FamilyOfficeProtocolMeta
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([612, 792]);
  const margin = 48;
  const contentWidth = 612 - margin * 2;
  let y = 760;

  const line = (text: string, size = 11, bold = false) => {
    page.drawText(text, { x: margin, y, size, font: bold ? fontBold : font });
    y -= size + 6;
  };

  line("Family Office Formation Protocol Packet", 16, true);
  line(`Matter: ${meta.matterName || "Untitled Matter"}`);
  line(`Jurisdiction: ${meta.governingState || "Not specified"}`);
  line(`Structure: ${meta.familyOfficeStructure || "Not specified"}`);
  line(`Generated: ${new Date().toISOString()}`);
  y -= 8;

  line("Protocol Checklist", 13, true);
  for (const item of FAMILY_OFFICE_PROTOCOL_ITEMS) {
    const done = checklist[item.id] === true;
    const mark = done ? "[x]" : "[ ]";
    y = drawWrappedText(page, `${mark} ${item.label}`, margin, y, contentWidth, 15, font, 11);
  }

  y -= 6;
  line("Services Scope", 13, true);
  const services = meta.servicesScope && meta.servicesScope.length > 0 ? meta.servicesScope.join(", ") : "Not provided";
  y = drawWrappedText(page, services, margin, y, contentWidth, 15, font, 11);

  y -= 6;
  line("Investment Adviser / Regulatory Considerations", 13, true);
  y = drawWrappedText(
    page,
    (meta.investmentAdviserConsiderations || "").trim() || "Not provided",
    margin,
    y,
    contentWidth,
    15,
    font,
    11
  );

  const notesPage = pdfDoc.addPage([612, 792]);
  let ny = 760;
  notesPage.drawText("Attorney Notes and Legal Review", { x: margin, y: ny, size: 16, font: fontBold });
  ny -= 24;
  ny = drawWrappedText(
    notesPage,
    (meta.attorneyNotes || "").trim() || "No attorney notes captured.",
    margin,
    ny,
    contentWidth,
    15,
    font,
    11
  );
  ny -= 12;
  notesPage.drawText(`Acknowledged By: ${meta.acknowledgedBy || "Not set"}`, {
    x: margin,
    y: ny,
    size: 10,
    font,
  });
  ny -= 14;
  notesPage.drawText(`Role: ${meta.acknowledgedRole || "Not set"}`, {
    x: margin,
    y: ny,
    size: 10,
    font,
  });
  ny -= 14;
  notesPage.drawText(`Acknowledged At: ${meta.acknowledgedAt || "Not set"}`, {
    x: margin,
    y: ny,
    size: 10,
    font,
  });
  ny -= 14;
  notesPage.drawText(`Template Version: ${FAMILY_OFFICE_PROTOCOL_TEMPLATE_VERSION}`, {
    x: margin,
    y: ny,
    size: 10,
    font,
  });

  return pdfDoc.save();
}
