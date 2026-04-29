import { getPublishingCapabilityMatrix, type ConnectedPublishingProfile } from "./platform-connectors";
import { routeDistributionTargets } from "./distribution-routing";
import {
  transformInstagramPayload,
  transformLinkedInPayload,
  transformYouTubePayload,
} from "./platform-payload-transformers";
import { buildManualExportPackage } from "./manual-export";
import type { DistributionQueueRow, DistributionQueueTargetRow } from "./distribution-queue-actions";

function fakeProfile(overrides: Partial<ConnectedPublishingProfile>): ConnectedPublishingProfile {
  return {
    platform: "instagram",
    profileId: "p1",
    profileName: "Test",
    isConnected: true,
    canPublish: true,
    canSchedule: true,
    supportedFormats: ["feed"],
    supportsImages: true,
    supportsVideo: true,
    supportsCaption: true,
    supportsHashtags: true,
    supportsFirstComment: null,
    supportsLinkInCaption: null,
    supportsShortForm: true,
    supportsLongForm: false,
    platformConstraints: {},
    ...overrides,
  };
}

describe("getPublishingCapabilityMatrix", () => {
  it("summarizes empty profiles without throwing", () => {
    const m = getPublishingCapabilityMatrix([]);
    expect(m.connectedPlatforms.length).toBe(0);
    expect(m.summaryLine.length).toBeGreaterThan(0);
  });

  it("lists auto-publish platforms when canPublish is true", () => {
    const m = getPublishingCapabilityMatrix([fakeProfile({ platform: "instagram", canPublish: true })]);
    expect(m.platformsWithAutoPublish).toContain("instagram");
  });
});

describe("routeDistributionTargets", () => {
  const matrix = getPublishingCapabilityMatrix([fakeProfile({ platform: "instagram", canPublish: true })]);

  it("marks ready when connector and format match", () => {
    const queue: DistributionQueueRow = {
      id: "q1",
      userId: "u",
      clientId: "",
      trustId: "",
      experimentId: null,
      experimentVariantId: null,
      title: "t",
      platform: "instagram",
      contentType: "reel",
      queueStatus: "draft",
      approvalStatus: "pending",
      scheduledFor: null,
      publishedAt: null,
      publishPriority: 1,
      publishAttemptCount: 0,
      lastPublishError: null,
      externalPostRef: null,
      lastSyncedAt: null,
      performanceSyncStatus: null,
      leadHandoffStatus: null,
      workflowNote: null,
      winningSignalSource: null,
      cadencePriority: null,
      staleAfterAt: null,
      lastOptimizationAction: null,
      suppressionReason: null,
      promotionReason: null,
      retestEligibleAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const target: DistributionQueueTargetRow = {
      id: "t1",
      queueId: "q1",
      targetPlatform: "instagram",
      targetProfileId: null,
      targetFormat: "reel",
      payloadJson: { angle: "hello", ctaType: "book" },
      targetStatus: "draft",
      routingStatus: null,
      routingWarningsJson: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const out = routeDistributionTargets({
      distributionPlan: null,
      connectedProfiles: [fakeProfile({ platform: "instagram", canPublish: true })],
      capabilityMatrix: matrix,
      queueItems: [queue],
      targets: [target],
      publishingObjective: null,
    });
    expect(out.autoPublishReady).toBe(1);
    expect(out.routedTargets[0]?.routingStatus).toBe("ready");
  });

  it("blocks when no connector for platform", () => {
    const queue: DistributionQueueRow = {
      id: "q2",
      userId: "u",
      clientId: "",
      trustId: "",
      experimentId: null,
      experimentVariantId: null,
      title: "t",
      platform: "tiktok",
      contentType: "short",
      queueStatus: "draft",
      approvalStatus: "pending",
      scheduledFor: null,
      publishedAt: null,
      publishPriority: 1,
      publishAttemptCount: 0,
      lastPublishError: null,
      externalPostRef: null,
      lastSyncedAt: null,
      performanceSyncStatus: null,
      leadHandoffStatus: null,
      workflowNote: null,
      winningSignalSource: null,
      cadencePriority: null,
      staleAfterAt: null,
      lastOptimizationAction: null,
      suppressionReason: null,
      promotionReason: null,
      retestEligibleAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const target: DistributionQueueTargetRow = {
      id: "t2",
      queueId: "q2",
      targetPlatform: "tiktok",
      targetProfileId: null,
      targetFormat: "short",
      payloadJson: {},
      targetStatus: "draft",
      routingStatus: null,
      routingWarningsJson: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const out = routeDistributionTargets({
      distributionPlan: null,
      connectedProfiles: [fakeProfile({ platform: "instagram", canPublish: true })],
      capabilityMatrix: matrix,
      queueItems: [queue],
      targets: [target],
      publishingObjective: null,
    });
    expect(out.routedTargets[0]?.routingStatus).toBe("blocked_no_connector");
  });

  it("flags capability mismatch for long article on TikTok profile", () => {
    const tikTokProfile = fakeProfile({
      platform: "tiktok",
      canPublish: false,
      supportsLongForm: false,
    });
    const m2 = getPublishingCapabilityMatrix([tikTokProfile]);
    const queue: DistributionQueueRow = {
      id: "q3",
      userId: "u",
      clientId: "",
      trustId: "",
      experimentId: null,
      experimentVariantId: null,
      title: "t",
      platform: "tiktok",
      contentType: "article",
      queueStatus: "draft",
      approvalStatus: "pending",
      scheduledFor: null,
      publishedAt: null,
      publishPriority: 1,
      publishAttemptCount: 0,
      lastPublishError: null,
      externalPostRef: null,
      lastSyncedAt: null,
      performanceSyncStatus: null,
      leadHandoffStatus: null,
      workflowNote: null,
      winningSignalSource: null,
      cadencePriority: null,
      staleAfterAt: null,
      lastOptimizationAction: null,
      suppressionReason: null,
      promotionReason: null,
      retestEligibleAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const target: DistributionQueueTargetRow = {
      id: "t3",
      queueId: "q3",
      targetPlatform: "tiktok",
      targetProfileId: null,
      targetFormat: "article",
      payloadJson: {},
      targetStatus: "draft",
      routingStatus: null,
      routingWarningsJson: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const out = routeDistributionTargets({
      distributionPlan: null,
      connectedProfiles: [tikTokProfile],
      capabilityMatrix: m2,
      queueItems: [queue],
      targets: [target],
      publishingObjective: null,
    });
    expect(out.routedTargets[0]?.routingStatus).toBe("blocked_capability_mismatch");
  });
});

describe("platform payload transformers", () => {
  it("warns when Instagram caption exceeds limit", () => {
    const long = "x".repeat(2300);
    const { warnings } = transformInstagramPayload({ caption: long });
    expect(warnings.some((w) => w.includes("trimmed"))).toBe(true);
  });

  it("maps YouTube title and description", () => {
    const { payloadJson } = transformYouTubePayload({
      title: "Hello",
      caption: "Body text",
      hashtags: ["tag"],
    });
    expect(payloadJson.title).toBeTruthy();
    expect(String(payloadJson.description ?? "")).toContain("Body");
  });

  it("keeps LinkedIn under feed limit with warning when huge", () => {
    const long = "y".repeat(4000);
    const { payloadJson, warnings } = transformLinkedInPayload({ body: long });
    expect(String(payloadJson.text ?? "").length).toBeLessThanOrEqual(3000);
    expect(warnings.length).toBeGreaterThan(0);
  });
});

describe("buildManualExportPackage", () => {
  it("includes posting notes for blocked_no_connector", () => {
    const pkg = buildManualExportPackage({
      platform: "tiktok",
      targetFormat: "short",
      caption: "Hi",
      hashtags: ["a"],
      cta: "DM us",
      routingStatus: "blocked_no_connector",
    });
    expect(pkg.postingNotes).toContain("OAuth");
    expect(pkg.hashtags[0]).toContain("#");
  });
});
