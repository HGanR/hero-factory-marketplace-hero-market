import { describe, expect, it } from "@jest/globals";
import {
  parseJarvaWorkflowPathFromStorage,
  resolveEffectiveJarvaWorkflowPath,
  resolveJarvaWorkflowPath,
  shouldPersistJarvaWorkflowPath,
} from "@/lib/jarva/jarva-workflow-path";
import type { JarvaEntryRoute } from "@/lib/jarva/jarva-entry-router";

describe("resolveJarvaWorkflowPath", () => {
  it("returns null for trust_general and unknown", () => {
    expect(resolveJarvaWorkflowPath({ intent: "trust_general", needsTrustTypeChoice: true } as JarvaEntryRoute)).toBe(
      null
    );
    expect(resolveJarvaWorkflowPath({ intent: "unknown", needsTrustTypeChoice: false } as JarvaEntryRoute)).toBe(null);
  });

  it("resolves the seven specialist lanes", () => {
    expect(resolveJarvaWorkflowPath({ intent: "trust_revocable", needsTrustTypeChoice: false } as JarvaEntryRoute)).toBe(
      "trust_revocable"
    );
    expect(
      resolveJarvaWorkflowPath({ intent: "trust_irrevocable", needsTrustTypeChoice: false } as JarvaEntryRoute)
    ).toBe("trust_irrevocable");
    expect(
      resolveJarvaWorkflowPath({ intent: "trust_ecclesiastical", needsTrustTypeChoice: false } as JarvaEntryRoute)
    ).toBe("trust_ecclesiastical");
    expect(resolveJarvaWorkflowPath({ intent: "trust_certificate", needsTrustTypeChoice: false } as JarvaEntryRoute)).toBe(
      "trust_certificate"
    );
    expect(resolveJarvaWorkflowPath({ intent: "trust_ppm", needsTrustTypeChoice: false } as JarvaEntryRoute)).toBe(
      "trust_ppm"
    );
    expect(resolveJarvaWorkflowPath({ intent: "trust_bond", needsTrustTypeChoice: false } as JarvaEntryRoute)).toBe(
      "trust_bond"
    );
    expect(resolveJarvaWorkflowPath({ intent: "trust_estate", needsTrustTypeChoice: false } as JarvaEntryRoute)).toBe(
      "trust_estate"
    );
  });
});

describe("parseJarvaWorkflowPathFromStorage", () => {
  it("parses valid stored paths", () => {
    expect(parseJarvaWorkflowPathFromStorage("trust_revocable")).toBe("trust_revocable");
    expect(parseJarvaWorkflowPathFromStorage("bogus")).toBe(null);
    expect(parseJarvaWorkflowPathFromStorage("__suppress__")).toBe(null);
  });
});

describe("resolveEffectiveJarvaWorkflowPath", () => {
  it("prefers explicit current message over sticky", () => {
    const a = resolveEffectiveJarvaWorkflowPath({
      currentMessage: "bond indenture for the trust",
      combinedUserText: "revocable trust\nbond indenture for the trust",
      stickyPath: "trust_revocable",
    });
    expect(a.source).toBe("explicit_turn");
    expect(a.path).toBe("trust_bond");
  });

  it("uses sticky when current message does not name a lane", () => {
    const a = resolveEffectiveJarvaWorkflowPath({
      currentMessage: "continue",
      combinedUserText: "revocable trust\ncontinue",
      stickyPath: "trust_revocable",
    });
    expect(a.source).toBe("sticky_session");
    expect(a.path).toBe("trust_revocable");
  });

  it("falls back to transcript when no sticky", () => {
    const a = resolveEffectiveJarvaWorkflowPath({
      currentMessage: "ok",
      combinedUserText: "private placement memorandum",
      stickyPath: null,
    });
    expect(a.source).toBe("transcript_fallback");
    expect(a.path).toBe("trust_ppm");
  });

  it("skips transcript fallback when transcriptFallbackSuppressed is true", () => {
    const a = resolveEffectiveJarvaWorkflowPath({
      currentMessage: "ok",
      combinedUserText: "private placement memorandum",
      stickyPath: null,
      transcriptFallbackSuppressed: true,
    });
    expect(a.source).toBe(null);
    expect(a.path).toBe(null);
  });
});

describe("shouldPersistJarvaWorkflowPath", () => {
  it("persists explicit turn and first transcript fallback only", () => {
    expect(
      shouldPersistJarvaWorkflowPath({ source: "explicit_turn", path: "trust_revocable", hadStickyBefore: false })
    ).toBe("trust_revocable");
    expect(
      shouldPersistJarvaWorkflowPath({ source: "explicit_turn", path: "trust_bond", hadStickyBefore: true })
    ).toBe("trust_bond");
    expect(
      shouldPersistJarvaWorkflowPath({ source: "transcript_fallback", path: "trust_ppm", hadStickyBefore: false })
    ).toBe("trust_ppm");
    expect(
      shouldPersistJarvaWorkflowPath({ source: "transcript_fallback", path: "trust_ppm", hadStickyBefore: true })
    ).toBe(null);
    expect(
      shouldPersistJarvaWorkflowPath({ source: "sticky_session", path: "trust_revocable", hadStickyBefore: true })
    ).toBe(null);
    expect(
      shouldPersistJarvaWorkflowPath({ source: "lane_control", path: "trust_bond", hadStickyBefore: false })
    ).toBe(null);
    expect(
      shouldPersistJarvaWorkflowPath({ source: "lane_clear", path: "trust_revocable", hadStickyBefore: true })
    ).toBe(null);
  });
});
