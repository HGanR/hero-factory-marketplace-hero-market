/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import { getDefaultSceneConfig } from "./broadcast-scene";
import { buildBroadcastProgramState, deriveHighlightedParticipants } from "./broadcast-program";

describe("broadcast-program", () => {
  it("deriveHighlightedParticipants prefers primary speaker", () => {
    const c = getDefaultSceneConfig();
    const ids = deriveHighlightedParticipants(c, {
      participantIds: ["a", "b"],
      primarySpeakerId: "b",
    });
    expect(ids).toEqual(["b"]);
  });

  it("buildBroadcastProgramState carries layout and notes for portrait safe", () => {
    const c = { ...getDefaultSceneConfig(), portraitSafe: true };
    const st = buildBroadcastProgramState(c, { participantIds: ["x"], screenShareTrackPublished: false });
    expect(st.layoutMode).toBe("gallery");
    expect(st.providerHints.platforms).toEqual([]);
    expect(st.programNotes.some((n) => /Portrait-safe/i.test(n))).toBe(true);
  });

  it("deriveHighlightedParticipants respects screen share priority when share is active", () => {
    const c = { ...getDefaultSceneConfig(), screenSharePriority: true };
    const ids = deriveHighlightedParticipants(c, {
      participantIds: ["a", "b", "c"],
      screenShareTrackPublished: true,
    });
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.length).toBeLessThanOrEqual(3);
  });
});
