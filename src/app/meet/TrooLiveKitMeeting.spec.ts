jest.mock("@livekit/components-styles", () => ({}));
jest.mock("@/components/meet/MeetBroadcastControls", () => ({ MeetBroadcastControls: () => null }));
jest.mock("@/components/meet/TrooVideoConference", () => ({ TrooVideoConference: () => null }));
jest.mock("@/components/meet/NftVideoPublisher", () => ({ NftVideoPublisher: () => null }));
jest.mock("@/components/meet/MeetLiveKitCameraSync", () => ({ MeetLiveKitCameraSync: () => null }));
jest.mock("@livekit/components-react", () => ({
  LiveKitRoom: () => null,
  useParticipants: () => [],
}));

import { describe, it, expect } from "@jest/globals";
import { getLiveKitRoomVideoEnabled, shouldPublishNftAvatarVideo } from "./TrooLiveKitMeeting";

describe("getLiveKitRoomVideoEnabled", () => {
  it("is false when NFT avatar is selected (avoids double camera with NftVideoPublisher)", () => {
    expect(getLiveKitRoomVideoEnabled("https://cdn.example/nft.png", true, false)).toBe(false);
  });

  it("is true for normal camera when video on and camera required", () => {
    expect(getLiveKitRoomVideoEnabled(null, true, false)).toBe(true);
  });

  it("is false when camera optional", () => {
    expect(getLiveKitRoomVideoEnabled(null, true, true)).toBe(false);
  });

  it("is false when video toggled off", () => {
    expect(getLiveKitRoomVideoEnabled(null, false, false)).toBe(false);
  });
});

describe("shouldPublishNftAvatarVideo", () => {
  it("is true only when avatar URL and video on", () => {
    expect(shouldPublishNftAvatarVideo("https://x/nft.png", true)).toBe(true);
    expect(shouldPublishNftAvatarVideo("https://x/nft.png", false)).toBe(false);
    expect(shouldPublishNftAvatarVideo(null, true)).toBe(false);
  });
});
