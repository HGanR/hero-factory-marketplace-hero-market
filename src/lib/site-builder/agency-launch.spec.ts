import { describe, expect, it } from "@jest/globals";
import { pickAgencyLaunchActions, runAgencyLaunchOrchestration } from "@/lib/site-builder/agency-launch-pipeline";
import { analyzeConversionPath } from "@/lib/site-builder/conversion-path";
import { evaluateLaunchReadiness, suggestCompanionPages } from "@/lib/site-builder/launch-readiness-evaluate";
import { SiteSchemaDocument, type SiteSchemaDocumentType } from "@/lib/site-builder/schema";

function baseDoc(blocks: SiteSchemaDocumentType["pages"][number]["blocks"]): SiteSchemaDocumentType {
  return SiteSchemaDocument.parse({
    pages: [{ slug: "/", blocks }],
    metadata: {
      title: "Acme SaaS",
      description: "B2B analytics for operators",
      theme: { styleMode: "corporate" },
    },
  });
}

describe("agency launch layer", () => {
  it("analyzeConversionPath detects weak home CTA path", () => {
    const doc = baseDoc([
      { type: "hero", content: { title: "Hello", aiSectionId: "a", aiRegistryKey: "hero_primary" } },
      { type: "text", content: { body: "Long story", aiSectionId: "b" } },
    ]);
    const path = analyzeConversionPath(doc);
    expect(path.homeHasConversionSurface).toBe(false);
    expect(path.issues.some((i) => i.code === "cta_path_weak")).toBe(true);
  });

  it("evaluateLaunchReadiness returns structured checks and readiness", () => {
    const doc = baseDoc([
      { type: "hero", content: { title: "Hi", aiSectionId: "a", aiRegistryKey: "hero_primary" } },
      { type: "paragraph", content: { body: "x", aiSectionId: "b" } },
    ]);
    const path = analyzeConversionPath(doc);
    const { readiness, checks } = evaluateLaunchReadiness(doc, path, null);
    expect(["draft", "needs_attention", "launch_ready"].includes(readiness)).toBe(true);
    expect(checks.length).toBeGreaterThan(0);
    expect(checks.every((c) => typeof c.code === "string" && c.severity)).toBe(true);
  });

  it("suggestCompanionPages proposes contact when missing", () => {
    const doc = baseDoc([
      { type: "hero", content: { title: "Welcome to our product", aiSectionId: "a", aiRegistryKey: "hero_primary" } },
      {
        type: "call_to_action",
        content: { label: "Get started", aiSectionId: "b", aiRegistryKey: "mid_cta" },
      },
    ]);
    const path = analyzeConversionPath(doc);
    const companions = suggestCompanionPages(doc, path);
    expect(companions.some((c) => c.code === "companion_contact")).toBe(true);
  });

  it("runAgencyLaunchOrchestration writes metadata.agencyLaunch and reuses brandBrain", () => {
    const doc = baseDoc([
      { type: "hero", content: { title: "Strong value prop here", aiSectionId: "a", aiRegistryKey: "hero_primary" } },
      {
        type: "call_to_action",
        content: { label: "Start now", aiSectionId: "b", aiRegistryKey: "mid_cta" },
      },
    ]);
    doc.metadata = {
      ...doc.metadata!,
      brandBrain: {
        version: 1,
        decisionMode: "mixed",
        evaluatedAt: new Date().toISOString(),
        findings: [
          {
            code: "proof_underuse_home",
            severity: "info",
            scope: "route",
            route: "/",
            recommendation: "Add proof",
          },
        ],
        scorecard: { consistency: 90, narrative: 90, proofBalance: 70, visualRhythm: 90 },
        improvementQueue: [],
        lastAppliedCodes: [],
      },
    };
    runAgencyLaunchOrchestration(doc);
    const parsed = SiteSchemaDocument.safeParse(doc);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.metadata?.agencyLaunch?.version).toBe(1);
    expect(parsed.data?.metadata?.agencyLaunch?.launchQueue?.length).toBeGreaterThan(0);
    expect(Array.isArray(parsed.data?.metadata?.agencyLaunch?.deliverableSuggestions)).toBe(true);
  });

  it("pickAgencyLaunchActions respects limit 3", () => {
    const queue = Array.from({ length: 10 }, (_, i) => ({
      id: `t${i}`,
      type: "conversion_improvement" as const,
      priority: "medium" as const,
      scope: "site" as const,
      status: "suggested" as const,
      recommendation: "r",
      label: `L${i}`,
      derivedFrom: ["launch_readiness"],
    }));
    const picked = pickAgencyLaunchActions(queue, new Set(), new Set(), 3);
    expect(picked.length).toBeLessThanOrEqual(3);
  });
});
