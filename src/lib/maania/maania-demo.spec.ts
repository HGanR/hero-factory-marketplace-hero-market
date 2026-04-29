import { BUYER_INTAKE_STEPS } from "@/lib/maania/buyer-question-flow";
import { createInitialBuyerDraft } from "@/lib/maania/buyer-draft";
import {
  BUYER_PREVIEW_DIRECTION_MIN_PERCENT,
  BUYER_TAILORED_DEMO_MIN_PERCENT,
  buildBuyerDemoPayload,
} from "@/lib/maania/build-buyer-demo-payload";
import { buyerDemoPayloadToSiteSchemaDocument } from "@/lib/maania/buyer-demo-payload-to-site-schema";
import {
  buildRetDemoPayload,
  getRetDemoIntakeProgressPercent,
  retDemoPayloadProgressPercent,
} from "@/lib/maania/build-ret-demo-payload";
import { retDemoPayloadToSiteSchemaDocument } from "@/lib/maania/ret-demo-payload-to-site-schema";
import { parseDollarAmounts, extractBuyerDraftPatchFromMessage } from "@/lib/maania/extract-buyer-patch";
import { mergeBuyerDraft } from "@/lib/maania/merge-buyer-draft";
import { getBuyerIntakeProgress, getNextBuyerQuestion } from "@/lib/maania/buyer-progress";
import { SiteSchemaDocument } from "@/lib/site-builder/schema";
import type { RetAgentDraft } from "@/lib/ret/types";

describe("parseDollarAmounts", () => {
  it("parses 450k pre-approval style amounts", () => {
    const amounts = parseDollarAmounts("I'm pre-approved for 450k");
    expect(amounts).toContain(450_000);
  });
});

describe("extractBuyerDraftPatchFromMessage", () => {
  const base = createInitialBuyerDraft();

  it("extracts pre-approval financing and budget from 450k line", () => {
    const p = extractBuyerDraftPatchFromMessage("I'm pre-approved for 450k", base);
    expect(p.financing).toBe("preapproved");
    expect(p.budgetMax).toBe(450_000);
  });

  it("extracts Atlanta and Decatur from looking-in line", () => {
    const p = extractBuyerDraftPatchFromMessage("We're looking in Atlanta and Decatur", base);
    expect(p.targetAreas?.length).toBeGreaterThanOrEqual(2);
    expect(p.targetAreas?.join(" ")).toMatch(/Atlanta/i);
    expect(p.targetAreas?.join(" ")).toMatch(/Decatur/i);
  });

  it("extracts 3 bed 2 bath", () => {
    const p = extractBuyerDraftPatchFromMessage("Ideally 3 bed 2 bath", base);
    expect(p.bedrooms).toBe(3);
    expect(p.bathrooms).toBe(2);
  });

  it("detects spouse / joint decision-makers", () => {
    const p = extractBuyerDraftPatchFromMessage("My wife and I are deciding together", base);
    expect(p.decisionMakers).toMatch(/spouse|partner|Multiple/i);
  });

  it("detects first-time buyer phrasing", () => {
    const p = extractBuyerDraftPatchFromMessage("This is our first home purchase", base);
    expect(p.experienceLevel).toBe("first_time");
  });
});

describe("mergeBuyerDraft", () => {
  it("merges target areas without dropping prior entries", () => {
    let d = createInitialBuyerDraft();
    d = mergeBuyerDraft(d, { targetAreas: ["Atlanta"] });
    d = mergeBuyerDraft(d, { targetAreas: ["Decatur"] });
    expect(d.targetAreas).toEqual(expect.arrayContaining(["Atlanta", "Decatur"]));
    expect(d.targetAreas.length).toBe(2);
  });

  it("does not overwrite financing with unknown from an empty patch path", () => {
    let d = createInitialBuyerDraft();
    d = mergeBuyerDraft(d, { financing: "preapproved" });
    d = mergeBuyerDraft(d, {});
    expect(d.financing).toBe("preapproved");
  });

  it("dedupes identical area strings case-insensitively", () => {
    let d = createInitialBuyerDraft();
    d = mergeBuyerDraft(d, { targetAreas: ["Atlanta"] });
    d = mergeBuyerDraft(d, { targetAreas: ["atlanta"] });
    expect(d.targetAreas.length).toBe(1);
  });
});

describe("getBuyerIntakeProgress / getNextBuyerQuestion", () => {
  it("starts at zero with full step count", () => {
    const d = createInitialBuyerDraft();
    const p = getBuyerIntakeProgress(d);
    expect(p.answeredCount).toBe(0);
    expect(p.totalCount).toBe(BUYER_INTAKE_STEPS.length);
    expect(p.percent).toBe(0);
    expect(getNextBuyerQuestion(d)).toBe(BUYER_INTAKE_STEPS[0].question);
  });

  it("crosses preview threshold after five core steps are satisfied", () => {
    let d = createInitialBuyerDraft();
    d = mergeBuyerDraft(d, { financing: "preapproved" });
    d = mergeBuyerDraft(d, { budgetMax: 450_000 });
    d = mergeBuyerDraft(d, { targetAreas: ["Atlanta"] });
    d = mergeBuyerDraft(d, { propertyType: "single_family" });
    d = mergeBuyerDraft(d, { bedrooms: 3 });
    const p = getBuyerIntakeProgress(d);
    expect(p.answeredCount).toBe(5);
    expect(p.percent).toBeGreaterThanOrEqual(BUYER_PREVIEW_DIRECTION_MIN_PERCENT);
  });

  it("crosses tailored threshold once half of intake steps are satisfied (20 steps → 10 answered = 50%)", () => {
    let d = createInitialBuyerDraft();
    d = mergeBuyerDraft(d, { financing: "preapproved" });
    d = mergeBuyerDraft(d, { budgetMax: 450_000 });
    d = mergeBuyerDraft(d, { targetAreas: ["Atlanta"] });
    d = mergeBuyerDraft(d, { propertyType: "single_family" });
    d = mergeBuyerDraft(d, { bedrooms: 3 });
    d = mergeBuyerDraft(d, { mustHaves: ["garage"], dealBreakers: [] });
    d = mergeBuyerDraft(d, { moveInReadyPreference: "move_in_ready" });
    d = mergeBuyerDraft(d, { timeline: "ASAP" });
    d = mergeBuyerDraft(d, { currentHousingSituation: "Renting", mustSellFirst: false });
    d = mergeBuyerDraft(d, { decisionMakers: "Primary buyer only" });
    const p = getBuyerIntakeProgress(d);
    expect(p.totalCount).toBe(20);
    expect(p.answeredCount).toBe(10);
    expect(p.percent).toBe(BUYER_TAILORED_DEMO_MIN_PERCENT);
  });
});

describe("buildBuyerDemoPayload / buyerDemoPayloadToSiteSchemaDocument", () => {
  it("builds a coherent payload with readiness mirroring progress", () => {
    let d = createInitialBuyerDraft();
    d = mergeBuyerDraft(d, { financing: "preapproved", budgetMax: 450_000, targetAreas: ["Atlanta"] });
    const payload = buildBuyerDemoPayload(d);
    expect(payload.heroTitle.length).toBeGreaterThan(0);
    expect(payload.readiness.totalCount).toBe(BUYER_INTAKE_STEPS.length);
    expect(payload.readiness.progressPercent).toBe(getBuyerIntakeProgress(d).percent);
    expect(payload.ctaLabel.length).toBeGreaterThan(0);
  });

  it("maps to a valid SiteSchemaDocument with expected block order and CTA", () => {
    let d = createInitialBuyerDraft();
    d = mergeBuyerDraft(d, {
      financing: "preapproved",
      budgetMax: 400_000,
      targetAreas: ["Austin"],
      propertyType: "condo",
      bedrooms: 2,
      bathrooms: 2,
      mustHaves: ["balcony"],
      dealBreakers: [],
      timeline: "Flexible / exploring",
      currentHousingSituation: "Renting",
      mustSellFirst: false,
      moveInReadyPreference: "move_in_ready",
      decisionMakers: "Couple",
      reasonForBuyingNow: "relocating for work",
      primaryDecisionFactor: "location",
      offerCompetitionComfort: "medium",
      repairTolerance: "medium",
      offMarketInterest: true,
      experienceLevel: "first_time",
      referralNeeds: ["lender"],
      knownTitleIssues: false,
      knownLienIssues: false,
      knownMortgageComplications: false,
      jurisdiction: "TX",
      wantsClientSummary: true,
      wantsAdvisorSummary: false,
    });
    const payload = buildBuyerDemoPayload(d);
    const doc = buyerDemoPayloadToSiteSchemaDocument(payload);
    const parsed = SiteSchemaDocument.safeParse(doc);
    expect(parsed.success).toBe(true);
    const blocks = doc.pages[0].blocks;
    expect(blocks[0].type).toBe("hero");
    expect(blocks[1].type).toBe("section");
    const types = blocks.map((b) => b.type);
    expect(types).toContain("call_to_action");
    const dealIdx = types.findIndex((t, i) => t === "heading" && (blocks[i].content as { text?: string })?.text === "Deal-breakers");
    expect(dealIdx).toBe(-1);
  });

  it("includes deal-breaker blocks when dealBreakers are present", () => {
    let d = createInitialBuyerDraft();
    d = mergeBuyerDraft(d, {
      financing: "cash",
      budgetMax: 300_000,
      targetAreas: ["Denver"],
      propertyType: "single_family",
      bedrooms: 3,
      dealBreakers: ["No HOA"],
    });
    const doc = buyerDemoPayloadToSiteSchemaDocument(buildBuyerDemoPayload(d));
    const labels = doc.pages[0].blocks.map((b) =>
      b.type === "heading" ? (b.content as { text?: string })?.text : ""
    );
    expect(labels.some((l) => /deal-breaker/i.test(l ?? ""))).toBe(true);
  });
});

describe("RET demo payload / schema", () => {
  const baseRetDraft = (): RetAgentDraft => ({
    intake: { propertyLabel: "", ownerContact: "", notes: "" },
    flags: { titleClear: false, lienRecorded: false, mortgageActive: false },
    structure: "llc",
    tokenDesign: "utility-receipt",
    risk: { securities: 3, lender: 3, title: 3 },
    jurisdiction: "",
    consultantSummary: "",
    clientSummary: "",
    escalation: {
      "Title defect or missing instrument": false,
      "Lien payoff or subordination required": false,
      "Lender / covenant breach exposure": false,
      "Securities / token offering review": false,
      "Jurisdiction or tax counsel": false,
    },
  });

  it("buildRetDemoPayload produces stable labels", () => {
    const d = baseRetDraft();
    d.intake.propertyLabel = "123 Main St";
    d.intake.ownerContact = "owner@example.com";
    d.intake.notes = "Selling investment property.";
    const p = buildRetDemoPayload(d);
    expect(p.propertyDealLabel).toContain("123 Main");
    expect(p.riskSummary.length).toBeGreaterThan(0);
  });

  it("retDemoPayloadProgressPercent and getRetDemoIntakeProgressPercent align", () => {
    const d = baseRetDraft();
    d.intake.propertyLabel = "Deal A";
    d.intake.ownerContact = "x@y.com";
    d.intake.notes = "Enough notes here to count.";
    d.consultantSummary = "Advisor line.";
    d.clientSummary = "Client line.";
    const payload = buildRetDemoPayload(d);
    expect(retDemoPayloadProgressPercent(payload)).toBe(getRetDemoIntakeProgressPercent(d));
  });

  it("omits escalation section in schema when escalation list is empty", () => {
    const d = baseRetDraft();
    d.intake.propertyLabel = "P";
    d.intake.ownerContact = "a@b.co";
    d.intake.notes = "n";
    const doc = retDemoPayloadToSiteSchemaDocument(buildRetDemoPayload(d));
    const text = JSON.stringify(doc);
    expect(text).not.toContain("Escalation items");
  });

  it("includes escalation blocks when escalation items exist", () => {
    const d = baseRetDraft();
    d.intake.propertyLabel = "P";
    d.intake.ownerContact = "a@b.co";
    d.intake.notes = "n";
    d.escalation["Title defect or missing instrument"] = true;
    const doc = retDemoPayloadToSiteSchemaDocument(buildRetDemoPayload(d));
    expect(JSON.stringify(doc)).toContain("Escalation items");
    const parsed = SiteSchemaDocument.safeParse(doc);
    expect(parsed.success).toBe(true);
  });
});
