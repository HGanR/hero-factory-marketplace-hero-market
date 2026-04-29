/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import {
  normalizeStreamPlatform,
  validateDestinationInput,
  toPublicDestination,
} from "./destinations";
import type { StreamDestinationRow } from "@/lib/db/schema";

describe("streaming/destinations", () => {
  it("normalizes pump.fun alias", () => {
    expect(normalizeStreamPlatform("Pump.Fun")).toBe("pumpfun");
  });

  it("validateDestinationInput rejects bad platform", () => {
    const r = validateDestinationInput({
      platform: "youtube",
      streamKey: "x",
    });
    expect(r.ok).toBe(false);
  });

  it("toPublicDestination omits ciphertext", () => {
    const row = {
      id: 1,
      userId: 2,
      platform: "twitch",
      label: "Main",
      serverUrl: "",
      streamKeyEncrypted: "SECRET",
      streamKeyLast4: "wxyz",
      orientationPreference: "auto",
      isActive: true,
      requiresManualGoLive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastTestedAt: null,
    } as StreamDestinationRow;
    const pub = toPublicDestination(row);
    expect(pub).not.toHaveProperty("streamKeyEncrypted");
    expect(pub.streamKeyLast4).toBe("wxyz");
  });
});
