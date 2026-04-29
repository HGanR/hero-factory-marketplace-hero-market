import { describe, expect, it } from "@jest/globals";
import {
  JARVA_CLEAR_LANE_MESSAGE,
  displayLabelForLaneMessage,
  parseJarvaLaneControlMessage,
} from "@/lib/jarva/jarva-lane-control";

describe("parseJarvaLaneControlMessage", () => {
  it("parses short lane token", () => {
    expect(parseJarvaLaneControlMessage("__jarva_set_lane__:bond")).toEqual({
      action: "set",
      path: "trust_bond",
    });
  });

  it("parses full trust_* path", () => {
    expect(parseJarvaLaneControlMessage("__jarva_set_lane__:trust_revocable")).toEqual({
      action: "set",
      path: "trust_revocable",
    });
  });

  it("parses clear", () => {
    expect(parseJarvaLaneControlMessage(JARVA_CLEAR_LANE_MESSAGE)).toEqual({ action: "clear" });
  });

  it("returns null for normal chat", () => {
    expect(parseJarvaLaneControlMessage("We need a revocable trust")).toBe(null);
  });

  it("returns null for invalid lane token", () => {
    expect(parseJarvaLaneControlMessage("__jarva_set_lane__:nope")).toBe(null);
  });
});

describe("displayLabelForLaneMessage", () => {
  it("formats lane messages for UI", () => {
    expect(displayLabelForLaneMessage("__jarva_set_lane__:bond")).toBe("[Workflow lane: trust_bond]");
    expect(displayLabelForLaneMessage(JARVA_CLEAR_LANE_MESSAGE)).toBe("[Clear workflow lane]");
    expect(displayLabelForLaneMessage("hello")).toBe(null);
  });
});
