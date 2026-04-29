import { describe, expect, it } from "@jest/globals";
import {
  appendJarvaHandoffParams,
  buildDismissHandoffUrl,
  JARVA_HANDOFF_FROM,
  JARVA_HANDOFF_LANE,
  jarvaHandoffIssueSecurityExecutionContinuityLine,
  jarvaHandoffIssueSecurityExecutionKind,
  jarvaHandoffSuggestedTrustRecordsTabIfAbsent,
  jarvaHandoffTrustDraftingIntakeLine,
  jarvaHandoffTrustDraftingLaneKind,
  jarvaHandoffTrustDraftingSurfaceContinuityLine,
  jarvaHandoffTrustDraftingWizardLine,
  jarvaHandoffTrustRecordsBondRegistryContinuityLine,
  jarvaHandoffTrustRecordsTabForLane,
  mergeJarvaHandoffIntoSearchParamsIfConsistentWithEntity,
  parseJarvaHandoff,
  stripJarvaHandoffFromSearchParams,
} from "@/lib/jarva/jarva-handoff";

describe("appendJarvaHandoffParams", () => {
  it("adds jarvaFrom and jarvaLane preserving existing query", () => {
    const out = appendJarvaHandoffParams("/trust-records?trustId=abc&tab=bonds", "trust_bond");
    const u = new URL(out, "http://localhost");
    expect(u.searchParams.get("trustId")).toBe("abc");
    expect(u.searchParams.get("tab")).toBe("bonds");
    expect(u.searchParams.get(JARVA_HANDOFF_FROM)).toBe("1");
    expect(u.searchParams.get(JARVA_HANDOFF_LANE)).toBe("trust_bond");
  });

  it("works on path-only hrefs", () => {
    const out = appendJarvaHandoffParams("/ecclesiastical", "trust_ecclesiastical");
    expect(out).toContain("jarvaFrom=1");
    expect(out).toContain("jarvaLane=trust_ecclesiastical");
  });
});

describe("parseJarvaHandoff", () => {
  it("returns null without jarvaFrom=1", () => {
    const sp = new URLSearchParams("jarvaLane=trust_bond");
    expect(parseJarvaHandoff(sp)).toBe(null);
  });

  it("returns null for direct navigation without handoff", () => {
    expect(parseJarvaHandoff(new URLSearchParams(""))).toBe(null);
  });

  it("parses valid handoff", () => {
    const sp = new URLSearchParams("jarvaFrom=1&jarvaLane=trust_ppm");
    const h = parseJarvaHandoff(sp);
    expect(h?.lane).toBe("trust_ppm");
    expect(h?.fromJarva).toBe(true);
  });
});

describe("stripJarvaHandoffFromSearchParams", () => {
  it("removes handoff keys", () => {
    const sp = new URLSearchParams("trustId=x&jarvaFrom=1&jarvaLane=trust_estate&tab=estate");
    const stripped = stripJarvaHandoffFromSearchParams(sp);
    expect(stripped.get("trustId")).toBe("x");
    expect(stripped.get("tab")).toBe("estate");
    expect(stripped.get(JARVA_HANDOFF_FROM)).toBeNull();
    expect(stripped.get(JARVA_HANDOFF_LANE)).toBeNull();
  });
});

describe("buildDismissHandoffUrl", () => {
  it("builds pathname with cleaned query", () => {
    const sp = new URLSearchParams("jarvaFrom=1&jarvaLane=trust_bond&tab=bonds");
    const u = buildDismissHandoffUrl("/trust-records", sp);
    expect(u).toContain("tab=bonds");
    expect(u).not.toContain("jarvaFrom");
  });
});

describe("jarvaHandoffTrustRecordsTabForLane", () => {
  it("maps lanes to Trust Records tabs", () => {
    expect(jarvaHandoffTrustRecordsTabForLane("trust_bond")).toBe("bonds");
    expect(jarvaHandoffTrustRecordsTabForLane("trust_certificate")).toBe("issue");
    expect(jarvaHandoffTrustRecordsTabForLane("trust_ppm")).toBe("issue");
    expect(jarvaHandoffTrustRecordsTabForLane("trust_estate")).toBe("estate");
    expect(jarvaHandoffTrustRecordsTabForLane("trust_revocable")).toBe("settings");
    expect(jarvaHandoffTrustRecordsTabForLane("trust_irrevocable")).toBe("settings");
    expect(jarvaHandoffTrustRecordsTabForLane("trust_ecclesiastical")).toBe(null);
  });
});

describe("jarvaHandoffTrustDraftingLaneKind", () => {
  it("maps revocable / irrevocable lanes for Smart Trust and Jarva intake", () => {
    expect(jarvaHandoffTrustDraftingLaneKind("trust_revocable")).toBe("revocable");
    expect(jarvaHandoffTrustDraftingLaneKind("trust_irrevocable")).toBe("irrevocable");
  });

  it("returns null for non-drafting lanes so unrelated surfaces stay neutral", () => {
    expect(jarvaHandoffTrustDraftingLaneKind("trust_ecclesiastical")).toBe(null);
    expect(jarvaHandoffTrustDraftingLaneKind("trust_bond")).toBe(null);
    expect(jarvaHandoffTrustDraftingLaneKind("trust_estate")).toBe(null);
  });
});

describe("jarvaHandoffTrustDraftingIntakeLine", () => {
  it("returns compact copy per drafting kind", () => {
    expect(jarvaHandoffTrustDraftingIntakeLine("revocable")).toContain("revocable trust intake");
    expect(jarvaHandoffTrustDraftingIntakeLine("irrevocable")).toContain("irrevocable");
  });
});

describe("jarvaHandoffTrustDraftingWizardLine", () => {
  it("mentions revocable vs irrevocable wizard framing", () => {
    expect(jarvaHandoffTrustDraftingWizardLine("revocable")).toContain("Revocable trust drafting");
    expect(jarvaHandoffTrustDraftingWizardLine("irrevocable")).toContain("Irrevocable trust drafting");
  });
});

describe("jarvaHandoffTrustDraftingSurfaceContinuityLine", () => {
  it("frames clauses/memo/funding/references continuity for each drafting kind", () => {
    expect(jarvaHandoffTrustDraftingSurfaceContinuityLine("revocable")).toContain("revocable trust drafting");
    expect(jarvaHandoffTrustDraftingSurfaceContinuityLine("revocable")).toContain("Jarva lane");
    expect(jarvaHandoffTrustDraftingSurfaceContinuityLine("irrevocable")).toContain("irrevocable trust drafting");
  });
});

describe("jarvaHandoffIssueSecurityExecutionKind", () => {
  it("maps certificate, PPM, and bond lanes for Issue Security", () => {
    expect(jarvaHandoffIssueSecurityExecutionKind("trust_certificate")).toBe("certificate");
    expect(jarvaHandoffIssueSecurityExecutionKind("trust_ppm")).toBe("ppm");
    expect(jarvaHandoffIssueSecurityExecutionKind("trust_bond")).toBe("bond");
  });

  it("returns null for lanes that should not emphasize Issue Security execution", () => {
    expect(jarvaHandoffIssueSecurityExecutionKind("trust_estate")).toBe(null);
    expect(jarvaHandoffIssueSecurityExecutionKind("trust_revocable")).toBe(null);
    expect(jarvaHandoffIssueSecurityExecutionKind("trust_ecclesiastical")).toBe(null);
  });
});

describe("jarvaHandoffIssueSecurityExecutionContinuityLine", () => {
  it("provides distinct framing per execution kind", () => {
    expect(jarvaHandoffIssueSecurityExecutionContinuityLine("certificate")).toContain("Certificate issuance");
    expect(jarvaHandoffIssueSecurityExecutionContinuityLine("certificate")).toContain("Steps E");
    expect(jarvaHandoffIssueSecurityExecutionContinuityLine("ppm")).toContain("PPM");
    expect(jarvaHandoffIssueSecurityExecutionContinuityLine("ppm")).toContain("Step D");
    expect(jarvaHandoffIssueSecurityExecutionContinuityLine("bond")).toContain("Bond execution");
    expect(jarvaHandoffIssueSecurityExecutionContinuityLine("bond")).toContain("Step A");
  });
});

describe("jarvaHandoffTrustRecordsBondRegistryContinuityLine", () => {
  it("mentions bond registry and PPM alignment", () => {
    const line = jarvaHandoffTrustRecordsBondRegistryContinuityLine();
    expect(line).toContain("Bond registry");
    expect(line).toContain("PPM");
  });
});

describe("mergeJarvaHandoffIntoSearchParamsIfConsistentWithEntity", () => {
  it("merges revocable handoff when entity matches or is unset", () => {
    const target = new URLSearchParams();
    target.set("type", "revocable_living_trust");
    const source = new URLSearchParams("jarvaFrom=1&jarvaLane=trust_revocable");
    mergeJarvaHandoffIntoSearchParamsIfConsistentWithEntity(target, source, "revocable_living_trust");
    expect(target.get("jarvaFrom")).toBe("1");
    expect(target.get("jarvaLane")).toBe("trust_revocable");
  });

  it("merges irrevocable handoff for irrevocable entity", () => {
    const target = new URLSearchParams();
    mergeJarvaHandoffIntoSearchParamsIfConsistentWithEntity(
      target,
      new URLSearchParams("jarvaFrom=1&jarvaLane=trust_irrevocable"),
      "irrevocable_trust",
    );
    expect(target.get("jarvaLane")).toBe("trust_irrevocable");
  });

  it("does not merge when explicit entity contradicts the Jarva lane", () => {
    const target = new URLSearchParams();
    target.set("type", "revocable_living_trust");
    mergeJarvaHandoffIntoSearchParamsIfConsistentWithEntity(
      target,
      new URLSearchParams("jarvaFrom=1&jarvaLane=trust_irrevocable"),
      "revocable_living_trust",
    );
    expect(target.get("jarvaFrom")).toBeNull();
  });

  it("does not merge non-drafting lanes into wizard navigation", () => {
    const target = new URLSearchParams();
    mergeJarvaHandoffIntoSearchParamsIfConsistentWithEntity(
      target,
      new URLSearchParams("jarvaFrom=1&jarvaLane=trust_bond"),
      null,
    );
    expect(target.get("jarvaLane")).toBeNull();
  });

  it("direct visits leave target unchanged", () => {
    const target = new URLSearchParams();
    target.set("type", "revocable_living_trust");
    mergeJarvaHandoffIntoSearchParamsIfConsistentWithEntity(target, new URLSearchParams(""), "revocable_living_trust");
    expect(target.get("jarvaFrom")).toBeNull();
  });
});

describe("jarvaHandoffSuggestedTrustRecordsTabIfAbsent", () => {
  it("suggests a tab from handoff when tab is not set", () => {
    const sp = new URLSearchParams("jarvaFrom=1&jarvaLane=trust_bond");
    expect(jarvaHandoffSuggestedTrustRecordsTabIfAbsent(sp)).toBe("bonds");
  });

  it("returns null for direct visits without handoff", () => {
    expect(jarvaHandoffSuggestedTrustRecordsTabIfAbsent(new URLSearchParams(""))).toBe(null);
    expect(jarvaHandoffSuggestedTrustRecordsTabIfAbsent(new URLSearchParams("tab=issue"))).toBe(null);
  });

  it("does not suggest when an explicit tab is already in the URL", () => {
    const sp = new URLSearchParams("jarvaFrom=1&jarvaLane=trust_bond&tab=assets");
    expect(jarvaHandoffSuggestedTrustRecordsTabIfAbsent(sp)).toBe(null);
  });

  it("matches dismiss-handoff semantics: tab preserved after strip removes handoff keys", () => {
    const sp = new URLSearchParams("jarvaFrom=1&jarvaLane=trust_bond&tab=bonds");
    const stripped = stripJarvaHandoffFromSearchParams(sp);
    expect(stripped.get("tab")).toBe("bonds");
    expect(parseJarvaHandoff(stripped)).toBe(null);
    expect(jarvaHandoffSuggestedTrustRecordsTabIfAbsent(stripped)).toBe(null);
  });
});
