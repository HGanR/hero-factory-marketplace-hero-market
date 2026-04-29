/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import { validateBroadcastShowPackage, resolveEffectiveLaunchFields } from "./broadcast-show-packages";
import { validateBroadcastOverlayPack, buildOverlayPatchFromPack, type BroadcastOverlayPack } from "./broadcast-overlay-packs";
import { validateBroadcastGuestCardPackJson, buildLowerThirdFromGuestCard } from "./broadcast-guest-cards";
import type { BroadcastEvent } from "./broadcast-events";
import { getDefaultLowerThird } from "./broadcast-overlays";

describe("broadcast show packages & packs", () => {
  it("validateBroadcastShowPackage create requires name", () => {
    const r = validateBroadcastShowPackage({}, "create");
    expect(r.ok).toBe(false);
  });

  it("resolveEffectiveLaunchFields prefers overrides then event then package", () => {
    const event: BroadcastEvent = {
      id: 1,
      userId: 1,
      title: "E",
      description: null,
      scheduledStartIso: "2026-06-01T18:00:00.000Z",
      scheduledEndIso: null,
      timezone: null,
      roomId: "room-event",
      status: "scheduled",
      scenePresetId: 10,
      defaultTimelineTemplateId: 20,
      showPackageId: null,
      createdAtIso: "",
      updatedAtIso: "",
    };
    const r1 = resolveEffectiveLaunchFields({
      event,
      packageDefaults: { roomId: "room-pkg", scenePresetId: 99, timelineTemplateId: 88, defaultBrandingJson: null, defaultOverlayPackId: null, defaultGuestCardPackId: null },
    });
    expect(r1.roomId).toBe("room-event");
    expect(r1.scenePresetId).toBe(10);
    expect(r1.defaultTimelineTemplateId).toBe(20);

    const r2 = resolveEffectiveLaunchFields({
      event: { ...event, roomId: null, scenePresetId: null, defaultTimelineTemplateId: null },
      packageDefaults: { roomId: "room-pkg", scenePresetId: 99, timelineTemplateId: 88, defaultBrandingJson: null, defaultOverlayPackId: null, defaultGuestCardPackId: null },
    });
    expect(r2.roomId).toBe("room-pkg");
    expect(r2.scenePresetId).toBe(99);

    const r3 = resolveEffectiveLaunchFields({
      event,
      packageDefaults: { roomId: "x", scenePresetId: 1, timelineTemplateId: 1, defaultBrandingJson: null, defaultOverlayPackId: null, defaultGuestCardPackId: null },
      overrides: { roomId: "override-room", scenePresetId: 3, defaultTimelineTemplateId: 4 },
    });
    expect(r3.roomId).toBe("override-room");
    expect(r3.scenePresetId).toBe(3);
    expect(r3.defaultTimelineTemplateId).toBe(4);
  });

  it("validateBroadcastOverlayPack and buildOverlayPatchFromPack", () => {
    const v = validateBroadcastOverlayPack({ name: "P", lowerThirdPresetJson: { headline: "Hi", visible: true } }, "create");
    expect(v.ok).toBe(true);
    const pack: BroadcastOverlayPack = {
      id: 1,
      userId: 1,
      name: "P",
      description: null,
      lowerThirdPresetJson: { headline: "Hello", accentHex: "#aabbcc" },
      tickerPresetJson: null,
      ctaPresetJson: null,
      createdAtIso: "",
      updatedAtIso: "",
    };
    const patch = buildOverlayPatchFromPack(pack);
    expect(patch.lowerThird?.headline).toBe("Hello");
    expect(patch.lowerThird?.accentHex).toBe("#aabbcc");
  });

  it("validateBroadcastGuestCardPackJson and buildLowerThirdFromGuestCard", () => {
    const v = validateBroadcastGuestCardPackJson({
      cards: [{ id: "g1", displayName: "Alex", title: "Host", company: "Co" }],
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const lt = buildLowerThirdFromGuestCard(v.data.cards[0], getDefaultLowerThird());
    expect(lt.headline).toBe("Alex");
    expect(lt.visible).toBe(true);
    expect(lt.subheadline).toContain("Host");
  });
});
