import { describe, expect, it } from "@jest/globals";
import {
  applySessionBiasToScope,
  classifyBatchEditIntents,
  classifyEditIntents,
  mergeSessionAfterBatchEdit,
  mergeSessionAfterEdit,
  primaryBatchIntent,
  primaryIntent,
  resolveBatchEditScope,
  resolveEditScope,
  resolveRegistrySwap,
  shouldApplyLayoutRestructureHeuristic,
  shouldRegenerateNeighbors,
} from "./section-edit-intelligence";

describe("section edit intelligence", () => {
  it("classifies intents from stable keyword rules", () => {
    expect(classifyEditIntents("Make the hero headline shorter")).toContain("copy_tone_change");
    expect(classifyEditIntents("Turn this into a testimonial strip")).toContain("section_type_change");
    expect(classifyEditIntents("Use a white background here")).toContain("background_change");
    expect(classifyEditIntents("Replace the hero image")).toContain("media_change");
  });

  it("primaryIntent reflects precedence (structural before copy)", () => {
    const intents = classifyEditIntents("Replace this feature grid with a process section");
    expect(primaryIntent(intents)).toBe("section_type_change");
  });

  it("resolveEditScope keeps local edits section_only by default", () => {
    expect(resolveEditScope(classifyEditIntents("Punch up the wording"), "shorter lines")).toBe("section_only");
  });

  it("resolveEditScope widens to neighbors for continuity-sensitive phrasing", () => {
    expect(resolveEditScope(classifyEditIntents("align with the section above"), "bridge the flow")).toBe(
      "section_plus_neighbors",
    );
  });

  it("resolveEditScope escalates for whole-page and whole-site phrasing", () => {
    expect(resolveEditScope(classifyEditIntents("change everything"), "redo the entire page")).toBe("route_level");
    expect(resolveEditScope(classifyEditIntents("change all pages"), "refresh every page on the whole site")).toBe(
      "full_rebuild",
    );
  });

  it("applySessionBiasToScope narrows neighbor refresh when session prefers copy tweaks", () => {
    expect(
      applySessionBiasToScope("section_plus_neighbors", ["copy_tone_change"], { prefersCopyTweaks: true }),
    ).toBe("section_only");
  });

  it("shouldRegenerateNeighbors is true only for structural or continuity intents at neighbor scope", () => {
    expect(shouldRegenerateNeighbors(["section_type_change"], "section_plus_neighbors")).toBe(true);
    expect(shouldRegenerateNeighbors(["continuity_adjustment"], "section_plus_neighbors")).toBe(true);
    expect(shouldRegenerateNeighbors(["layout_change"], "section_plus_neighbors")).toBe(true);
    expect(shouldRegenerateNeighbors(["proof_change"], "section_plus_neighbors")).toBe(false);
    expect(shouldRegenerateNeighbors(["section_type_change"], "section_only")).toBe(false);
  });

  it("resolveRegistrySwap maps natural language to internal registry keys", () => {
    expect(resolveRegistrySwap("feature_grid", "Turn this into a testimonial strip")).toBe("social_proof");
    expect(resolveRegistrySwap("feature_grid", "Make this a process / how-it-works section")).toBe("value_props");
    expect(resolveRegistrySwap("paragraph_intro", "more proof-heavy; add metrics")).toBe("stat_band");
  });

  it("mergeSessionAfterEdit records style drift hints without storing prompts", () => {
    const s = mergeSessionAfterEdit(
      undefined,
      "sec-1",
      { intents: ["copy_tone_change"], scope: "section_only", registrySwapped: false },
      "more minimal with more air",
    );
    expect(s.lastSectionId).toBe("sec-1");
    expect(s.styleDrift).toBe("minimal");
  });

  it("classifyBatchEditIntents picks structural and multi-section families", () => {
    expect(classifyBatchEditIntents("Move proof higher", 2)).toContain("structural_resequence");
    expect(classifyBatchEditIntents("Merge these two sections", 2)).toContain("structural_merge");
    expect(classifyBatchEditIntents("Make hero and CTA more editorial", 2)).toContain(
      "multi_section_copy_tone_change",
    );
  });

  it("resolveBatchEditScope uses route_level for structural merge and resequence", () => {
    const mergeIntents = classifyBatchEditIntents("Merge these into one section", 2);
    expect(resolveBatchEditScope(mergeIntents, classifyEditIntents("merge"), "merge")).toBe("route_level");
    const reseq = classifyBatchEditIntents("Put the CTA right after the hero", 2);
    expect(resolveBatchEditScope(reseq, classifyEditIntents("after hero"), "after hero")).toBe("route_level");
  });

  it("shouldApplyLayoutRestructureHeuristic is true for structural batch intents", () => {
    expect(shouldApplyLayoutRestructureHeuristic(["structural_resequence"])).toBe(true);
    expect(shouldApplyLayoutRestructureHeuristic(["multi_section_visual_alignment"])).toBe(false);
  });

  it("mergeSessionAfterBatchEdit records lastBatchSectionIds", () => {
    const s = mergeSessionAfterBatchEdit(
      undefined,
      ["a", "b"],
      { intents: ["copy_tone_change"], scope: "section_only", registrySwapped: false },
      "tone",
    );
    expect(s.lastBatchSectionIds).toEqual(["a", "b"]);
    expect(primaryBatchIntent(classifyBatchEditIntents("align visually", 2))).toBe("multi_section_visual_alignment");
  });
});
