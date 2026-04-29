/**
 * @jest-environment node
 */
import { describe, expect, it } from "@jest/globals";
import {
  buildJarvaNextUiActionBundleFromJarvaState,
  buildJarvaNextUiSurfaceBundle,
  detectJarvaDestinationSurface,
  filterJarvaNextUiActionsForSurface,
  getResolvedJarvaNextUiActionsForContext,
  jarvaNextUiActionsForLane,
  parseJarvaNextUiActionBundleFromApi,
} from "./jarva-next-ui-actions";

describe("detectJarvaDestinationSurface", () => {
  it("maps known paths", () => {
    expect(detectJarvaDestinationSurface("/trust-records")).toBe("trust_records");
    expect(detectJarvaDestinationSurface("/trust-records/jarva")).toBe("trust_records_jarva");
    expect(detectJarvaDestinationSurface("/trust-records/estate/will")).toBe("estate_will");
    expect(detectJarvaDestinationSurface("/trusts/x/issue-security")).toBe("issue_security");
    expect(detectJarvaDestinationSurface("/ecclesiastical")).toBe("ecclesiastical");
    expect(detectJarvaDestinationSurface("/smart-trust")).toBe("smart_trust");
  });
});

describe("jarvaNextUiActionsForLane", () => {
  it("includes trust_records tab + bond registry for bond lane", () => {
    const a = jarvaNextUiActionsForLane("trust_bond");
    expect(a.some((x) => x.kind === "select_tab" && x.target === "bonds")).toBe(true);
    expect(a.some((x) => x.kind === "highlight_action" && x.target === "bond_registry")).toBe(true);
  });

  it("includes PPM step D for ppm lane", () => {
    const a = jarvaNextUiActionsForLane("trust_ppm");
    expect(a.some((x) => x.kind === "focus_step" && x.target === "D")).toBe(true);
  });

  it("includes certificate steps for certificate lane", () => {
    const a = jarvaNextUiActionsForLane("trust_certificate");
    expect(a.filter((x) => x.kind === "focus_step").map((x) => x.target)).toEqual(
      expect.arrayContaining(["E", "F"])
    );
  });

  it("includes ecclesiastical binding highlight", () => {
    const a = jarvaNextUiActionsForLane("trust_ecclesiastical");
    expect(a.some((x) => x.target === "ecclesiastical_binding")).toBe(true);
  });

  it("includes prefill for revocable / irrevocable", () => {
    expect(jarvaNextUiActionsForLane("trust_revocable").some((x) => x.kind === "prefill_mode" && x.value === "revocable")).toBe(
      true
    );
    expect(jarvaNextUiActionsForLane("trust_irrevocable").some((x) => x.kind === "prefill_mode" && x.value === "irrevocable")).toBe(
      true
    );
  });
});

describe("filterJarvaNextUiActionsForSurface", () => {
  it("drops focus_step on trust_records console", () => {
    const raw = jarvaNextUiActionsForLane("trust_ppm");
    const f = filterJarvaNextUiActionsForSurface(raw, "trust_records");
    expect(f.every((x) => x.kind !== "focus_step")).toBe(true);
  });

  it("keeps focus_step on issue_security", () => {
    const raw = jarvaNextUiActionsForLane("trust_ppm");
    const f = filterJarvaNextUiActionsForSurface(raw, "issue_security");
    expect(f.some((x) => x.kind === "focus_step")).toBe(true);
  });

  it("drops bond registry highlight on issue_security", () => {
    const raw = jarvaNextUiActionsForLane("trust_bond");
    const f = filterJarvaNextUiActionsForSurface(raw, "issue_security");
    expect(f.some((x) => x.target === "bond_registry")).toBe(false);
  });
});

describe("buildJarvaNextUiSurfaceBundle", () => {
  it("adds jarva intake highlight on /trust-records/jarva for revocable", () => {
    const b = buildJarvaNextUiSurfaceBundle({
      pathname: "/trust-records/jarva",
      searchParams: new URLSearchParams("trustId=t1&jarvaFrom=1&jarvaLane=trust_revocable"),
      lane: "trust_revocable",
    });
    expect(b.actions.some((x) => x.target === "jarva_intake_main")).toBe(true);
  });
});

describe("buildJarvaNextUiActionBundleFromJarvaState", () => {
  it("includes procedural title in advisory when no hint lines", () => {
    const b = buildJarvaNextUiActionBundleFromJarvaState({
      lane: "trust_bond",
      proceduralStep: "provisions",
      proceduralTitle: "Bond issuance (underway)",
      documentAssemblyHints: undefined,
    });
    expect(b.actions.length).toBeGreaterThan(0);
    expect(b.advisoryLine).toMatch(/Bond issuance/);
  });

  it("prefers document assembly hint line when present", () => {
    const b = buildJarvaNextUiActionBundleFromJarvaState({
      lane: "trust_ppm",
      proceduralStep: "certificate",
      proceduralTitle: "x",
      documentAssemblyHints: {
        ppmDraftReadyForGeneration: true,
        certificatePackageReady: false,
        bondDocumentationReady: false,
        trustReviewPacketReady: false,
        lines: ["First assembly line"],
      },
    });
    expect(b.advisoryLine).toBe("First assembly line");
  });
});

describe("parseJarvaNextUiActionBundleFromApi", () => {
  it("returns null for non-objects", () => {
    expect(parseJarvaNextUiActionBundleFromApi(null)).toBeNull();
    expect(parseJarvaNextUiActionBundleFromApi("x")).toBeNull();
  });

  it("parses lane and drops invalid actions", () => {
    const b = parseJarvaNextUiActionBundleFromApi({
      lane: "trust_ppm",
      proceduralStep: "x",
      advisoryLine: "Hello",
      actions: [
        { kind: "focus_step", target: "D", label: "Step D", autoApplyEligible: false },
        { kind: "bad", target: "x" },
      ],
    });
    expect(b?.lane).toBe("trust_ppm");
    expect(b?.actions).toHaveLength(1);
    expect(b?.actions[0]?.kind).toBe("focus_step");
    expect(b?.advisoryLine).toBe("Hello");
  });

  it("maps unknown lane string to null", () => {
    const b = parseJarvaNextUiActionBundleFromApi({ lane: "not_a_lane", actions: [] });
    expect(b?.lane).toBeNull();
  });
});

describe("getResolvedJarvaNextUiActionsForContext", () => {
  it("re-derives surface-filtered actions from lane (ignores raw API action list)", () => {
    const rawApi = parseJarvaNextUiActionBundleFromApi({
      lane: "trust_ppm",
      actions: [{ kind: "select_tab", target: "instruments", label: "x", autoApplyEligible: true }],
    });
    expect(rawApi?.actions.length).toBeGreaterThan(0);
    const resolved = getResolvedJarvaNextUiActionsForContext(
      "/trusts/t1/issue-security",
      new URLSearchParams("jarvaFrom=1&jarvaLane=trust_ppm"),
      "trust_ppm"
    );
    expect(resolved.some((a) => a.kind === "focus_step")).toBe(true);
    expect(resolved.every((a) => a.kind !== "select_tab")).toBe(true);
  });

  it("returns empty when lane is null", () => {
    expect(getResolvedJarvaNextUiActionsForContext("/", new URLSearchParams(), null)).toEqual([]);
  });
});
