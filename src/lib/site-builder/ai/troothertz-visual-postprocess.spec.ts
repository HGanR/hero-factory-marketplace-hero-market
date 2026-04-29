import { describe, expect, it } from "@jest/globals";
import { buyerDemoPayloadToSiteSchemaDocument } from "@/lib/maania/buyer-demo-payload-to-site-schema";
import { generateSiteSchemaFromPlanner } from "@/lib/site-builder/ai/generator";
import { runSitePlanner } from "@/lib/site-builder/ai/planner";
import {
  applyTroothertzVisualPostProcessToBlocks,
  sectionDepthKindFromBlock,
  styleModeFromSiteDocument,
} from "@/lib/site-builder/ai/troothertz-visual-postprocess";
import { regenerateSection } from "@/lib/site-builder/ai/regenerate-section";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";

function assertRhythmAndContinuity(blocks: SiteSchemaDocumentType["pages"][number]["blocks"]) {
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    const c = b.content as Record<string, unknown>;
    const ve = c.visualEngine as { signature?: string; rhythmSlot?: number; sectionTone?: string } | undefined;
    expect(ve?.signature).toBe("troothertz-sve-v1");
    expect(typeof ve?.rhythmSlot).toBe("number");
    expect(["light", "dark", "visual"]).toContain(ve?.sectionTone);
    const vis = c.visual as Record<string, unknown> | undefined;
    expect(vis?.rhythmOverlay).toBeTruthy();
    const kind = sectionDepthKindFromBlock(b);
    if (kind) {
      expect(vis?.sectionDepth).toBeTruthy();
    }
    if (vis?.continuity) {
      expect(typeof vis.continuity).toBe("object");
    }
  }
}

describe("troothertz visual post-process", () => {
  it("applies rhythm, sectionDepth where applicable, and continuity on planner generation", async () => {
    const { output } = await runSitePlanner({
      userPrompt: "Analytics SaaS for product teams",
      siteType: "saas",
      styleIntensity: 50,
      web3VisualMode: false,
    });
    const schema = generateSiteSchemaFromPlanner(output);
    assertRhythmAndContinuity(schema.pages[0]!.blocks);
  });

  it("post-processes raw blocks without throwing when visual fields are absent", () => {
    const blocks: SiteSchemaDocumentType["pages"][number]["blocks"] = [
      { type: "hero", content: { title: "T", subtitle: "S" } },
      { type: "paragraph", content: { text: "Hello" } },
      { type: "call_to_action", content: { title: "Go", body: "B", label: "L", href: "#" } },
    ];
    applyTroothertzVisualPostProcessToBlocks(blocks, "corporate");
    expect((blocks[0]!.content as { visualEngine?: unknown }).visualEngine).toBeTruthy();
    expect((blocks[2]!.content as { visual?: { sectionDepth?: unknown } }).visual?.sectionDepth).toBeTruthy();
  });

  it("regenerated section keeps full-page Troothertz metadata aligned", async () => {
    const { output } = await runSitePlanner({
      userPrompt: "B2B compliance automation",
      siteType: "saas",
      styleIntensity: 48,
      web3VisualMode: false,
    });
    const schema = generateSiteSchemaFromPlanner(output);
    const first = output.sectionPlan[0]!;
    const regen = await regenerateSection({
      schemaJson: schema,
      sectionId: first.id,
      instruction: "Tighten hero title",
    });
    assertRhythmAndContinuity(regen.schema.pages[0]!.blocks);
  });

  it("assigns proof_shallow depth to text and paragraph_intro with subtle motifs", () => {
    const blocks: SiteSchemaDocumentType["pages"][number]["blocks"] = [
      { type: "hero", content: { title: "H", subtitle: "S" } },
      { type: "text", content: { body: "Social proof line" } },
      {
        type: "paragraph",
        content: { text: "Narrative intro", aiRegistryKey: "paragraph_intro" },
      },
      { type: "call_to_action", content: { title: "Next", body: "Go", label: "Go", href: "#" } },
    ];
    applyTroothertzVisualPostProcessToBlocks(blocks, "corporate");
    expect(sectionDepthKindFromBlock(blocks[1]!)).toBe("proof_shallow");
    expect(sectionDepthKindFromBlock(blocks[2]!)).toBe("proof_shallow");
    const tVis = (blocks[1]!.content as { visual?: { sectionDepth?: { kind?: string; motifs?: string[]; tier?: number } } }).visual;
    expect(tVis?.sectionDepth?.kind).toBe("proof_shallow");
    expect(tVis?.sectionDepth?.tier).toBe(0);
    expect(tVis?.sectionDepth?.motifs).toContain("soft_proof_line");
    const ctaCont = blocks[3]!.content as { visual?: { continuity?: { bridge?: string } } };
    expect(ctaCont.visual?.continuity?.bridge).toContain("narrative_proof_to_cta");
  });

  it("plain paragraph without registry key stays backward compatible (no proof sectionDepth)", () => {
    const blocks: SiteSchemaDocumentType["pages"][number]["blocks"] = [
      { type: "hero", content: { title: "H", subtitle: "S" } },
      { type: "paragraph", content: { text: "Legacy copy" } },
    ];
    applyTroothertzVisualPostProcessToBlocks(blocks, "corporate");
    expect(sectionDepthKindFromBlock(blocks[1]!)).toBeNull();
    const vis = (blocks[1]!.content as { visual?: { sectionDepth?: unknown } }).visual;
    expect(vis?.sectionDepth).toBeUndefined();
  });

  it("damps proof_shallow motifs when adjacent to dense sections", () => {
    const blocks: SiteSchemaDocumentType["pages"][number]["blocks"] = [
      {
        type: "stat_band",
        content: { stats: [{ value: "1", label: "a" }] },
      },
      { type: "text", content: { body: "Between stats and next" } },
      { type: "divider", content: { color: "#334155", thickness: 1 } },
    ];
    applyTroothertzVisualPostProcessToBlocks(blocks, "corporate");
    const motifs = (
      blocks[1]!.content as {
        visual?: { sectionDepth?: { motifs?: string[] } };
      }
    ).visual?.sectionDepth?.motifs;
    expect(motifs).toBeDefined();
    expect(motifs).not.toContain("faint_grid_fragment");
  });

  it("MAANIA buyer demo import receives sectionDepth and continuity on depth-capable blocks", () => {
    const doc = buyerDemoPayloadToSiteSchemaDocument({
      heroTitle: "Demo",
      heroSubtitle: "Sub",
      buyerProfile: {
        financing: "Conventional",
        budgetText: "$500k",
        targetAreas: ["Austin"],
        propertyType: "SFH",
        bedroomsText: "3",
        bathroomsText: "2",
        timeline: "90d",
        occupancyGoal: "Primary",
      },
      readiness: { answeredCount: 3, totalCount: 10, progressPercent: 30, nextBestQuestion: null },
      priorities: ["A"],
      dealBreakers: [],
      agentSummary: ["x"],
      clientFacingSummary: ["y"],
      decisionSummary: "Z",
      ctaLabel: "Next",
    });
    expect(styleModeFromSiteDocument(doc)).toBe("corporate");
    const cta = doc.pages[0]!.blocks.find((b) => b.type === "call_to_action");
    expect(cta).toBeTruthy();
    const vis = (cta!.content as { visual?: Record<string, unknown> }).visual;
    expect(vis?.sectionDepth).toBeTruthy();
    expect(vis?.continuity).toBeTruthy();
  });
});
