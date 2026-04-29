/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { prepareV2RenderedCompositorOrReason } from "./broadcast-compositor-fallback";
import * as tmpl from "./broadcast-template";
import * as rsess from "./broadcast-render-sessions";

jest.mock("./broadcast-template", () => ({
  broadcastTemplatePublicOrigin: jest.fn(),
  buildBroadcastTemplateUrl: jest.fn(() => "https://app.example/meet/broadcast-template?rsid=1&rt=x"),
}));

jest.mock("./broadcast-render-sessions", () => ({
  createBroadcastRenderSession: jest.fn(),
}));

const mockOrigin = tmpl.broadcastTemplatePublicOrigin as jest.MockedFunction<typeof tmpl.broadcastTemplatePublicOrigin>;
const mockCreate = rsess.createBroadcastRenderSession as jest.MockedFunction<typeof rsess.createBroadcastRenderSession>;

describe("broadcast-compositor-fallback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns ok:false when template origin missing", async () => {
    mockOrigin.mockReturnValueOnce(null);
    const r = await prepareV2RenderedCompositorOrReason({
      userId: 1,
      broadcastSessionId: 9,
      renderModel: {
        layoutMode: "gallery",
        liveKitLayout: "grid",
        portraitSafe: false,
        branding: {},
        showParticipantNames: true,
        showMutedIndicators: true,
        showFooter: false,
        highlightedParticipantIds: [],
        primarySpeakerId: null,
        screenShareActive: false,
        programNotes: [],
        orientation: "landscape",
        providerHints: { platforms: [], anyPortraitCapable: false },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("template_origin");
  });

  it("returns ok:true when render session created", async () => {
    mockOrigin.mockReturnValueOnce("https://app.example");
    mockCreate.mockResolvedValueOnce({
      id: 5,
      broadcastSessionId: 9,
      userId: 1,
      accessToken: "abc",
      renderModelJson: {},
      expiresAt: new Date(),
      createdAt: new Date(),
    } as never);
    const r = await prepareV2RenderedCompositorOrReason({
      userId: 1,
      broadcastSessionId: 9,
      renderModel: {
        layoutMode: "gallery",
        liveKitLayout: "grid",
        portraitSafe: false,
        branding: {},
        showParticipantNames: true,
        showMutedIndicators: true,
        showFooter: false,
        highlightedParticipantIds: [],
        primarySpeakerId: null,
        screenShareActive: false,
        programNotes: [],
        orientation: "landscape",
        providerHints: { platforms: [], anyPortraitCapable: false },
      },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.customBaseUrl).toContain("broadcast-template");
  });
});
