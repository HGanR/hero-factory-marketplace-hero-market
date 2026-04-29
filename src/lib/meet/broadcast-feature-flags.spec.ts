/**
 * @jest-environment node
 */
import { describe, it, expect, afterEach } from "@jest/globals";
import {
  isRenderedBroadcastCompositorEnabledGlobally,
  isRenderedBroadcastCompositorEnabledForUser,
} from "./broadcast-feature-flags";

describe("broadcast-feature-flags", () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it("global flag enables for all users", () => {
    process.env.MEET_BROADCAST_RENDERED_COMPOSITOR = "1";
    expect(isRenderedBroadcastCompositorEnabledGlobally()).toBe(true);
    expect(isRenderedBroadcastCompositorEnabledForUser(999)).toBe(true);
  });

  it("user allow-list works when global off", () => {
    delete process.env.MEET_BROADCAST_RENDERED_COMPOSITOR;
    process.env.MEET_BROADCAST_RENDERED_COMPOSITOR_USER_IDS = "3, 4";
    expect(isRenderedBroadcastCompositorEnabledGlobally()).toBe(false);
    expect(isRenderedBroadcastCompositorEnabledForUser(3)).toBe(true);
    expect(isRenderedBroadcastCompositorEnabledForUser(5)).toBe(false);
  });
});
