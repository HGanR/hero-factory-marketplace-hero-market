import { describe, expect, it } from "@jest/globals";
import { evaluateSiteSchema } from "@/lib/site-builder/ai/evaluator";
import { generateSiteSchemaFromPlanner, buildPageBlueprint } from "@/lib/site-builder/ai/generator";
import { runSitePlanner } from "@/lib/site-builder/ai/planner";
import { SiteSchemaDocument } from "@/lib/site-builder/schema";
import { regenerateSection } from "@/lib/site-builder/ai/regenerate-section";

describe("site-builder AI pipeline", () => {
  it("runSitePlanner returns valid structured output without LLM", async () => {
    const { output, llmEnriched } = await runSitePlanner({
      userPrompt: "NFT membership pass for a creative community with token-gated drops",
      siteType: "auto",
      styleIntensity: 60,
      web3VisualMode: true,
    });
    expect(llmEnriched).toBe(false);
    expect(output.version).toBe(1);
    expect(output.intent).toBe("web3_product");
    expect(output.sitemap.length).toBeGreaterThan(0);
    expect(output.sitemap[0]?.slug).toBe("/");
    expect(output.sectionPlan.length).toBeGreaterThan(3);
    expect(output.web3ExtensionHints?.manualApprovalRequiredForContractWrites).toBe(true);
  });

  it("generateSiteSchemaFromPlanner produces parseable SiteSchemaDocument with multiple blocks", async () => {
    const { output } = await runSitePlanner({
      userPrompt: "Local coffee roastery with pickup and wholesale",
      siteType: "local_business",
      styleIntensity: 40,
      web3VisualMode: false,
    });
    const schema = generateSiteSchemaFromPlanner(output);
    const parsed = SiteSchemaDocument.safeParse(schema);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.pages?.[0]?.blocks?.length).toBeGreaterThan(2);
    const blueprint = buildPageBlueprint(output);
    expect(blueprint.sectionIds.length).toBe(output.sectionPlan.length);
  });

  it("evaluateSiteSchema returns scored findings", async () => {
    const { output } = await runSitePlanner({
      userPrompt: "Simple landing",
      siteType: "landing",
      styleIntensity: 50,
      web3VisualMode: false,
    });
    const schema = generateSiteSchemaFromPlanner(output);
    const report = evaluateSiteSchema(schema);
    expect(report.version).toBe(1);
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
    expect(Array.isArray(report.findings)).toBe(true);
    expect(report.dependencyAllowlist.length).toBeGreaterThan(10);
  });

  it("regenerateSection swaps one block and preserves count", async () => {
    const { output } = await runSitePlanner({
      userPrompt: "SaaS analytics dashboard",
      siteType: "saas",
      styleIntensity: 55,
      web3VisualMode: false,
    });
    const schema = generateSiteSchemaFromPlanner(output);
    const firstSection = output.sectionPlan[0];
    expect(firstSection).toBeTruthy();
    const before = schema.pages[0]!.blocks.length;
    const regen = await regenerateSection({
      schemaJson: schema,
      sectionId: firstSection!.id,
      instruction: "Make hero more concise",
    });
    expect(regen.editMeta.scope).toBe("section_only");
    expect(regen.sessionEditContext.lastSectionId).toBe(firstSection!.id);
    expect(regen.schema.pages[0]!.blocks.length).toBe(before);
    const hero = regen.schema.pages[0]!.blocks.find(
      (b) => (b.content as { aiSectionId?: string }).aiSectionId === firstSection!.id
    );
    expect(hero?.type).toBe("hero");
  });
});
