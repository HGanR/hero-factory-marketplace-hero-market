/**
 * @jest-environment jsdom
 */
import React, { act, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { usePathname } from "next/navigation";
import {
  AiRevenueOsSharedStateProvider,
  useAiRevenueOsBentleyActions,
  useAiRevenueOsSnapshotSignature,
} from "@/components/ai-revenue-os/AiRevenueOsSharedState";
import { BentleyPersistedSnapshotHydration } from "@/components/ai-revenue-os/BentleyPersistedSnapshotHydration";
import { CampaignLaunchSectionFromBentleySnapshot } from "@/components/ai-revenue-os/CampaignLaunchSection";
import { readCanonicalBentleySnapshot, writeCanonicalBentleySnapshot } from "@/lib/revenue-os/bentley-canonical-snapshot";
import { bentleyContinuityLog } from "@/lib/revenue-os/bentley-continuity-log";
import type { BentleyLaunchPrefill, BentleyPipelineStageState, BentleySnapshot } from "@/lib/revenue-os/bentley-orchestrator";
import type { SocialPlatform } from "@/lib/social/config";

const mockUsePathname = jest.fn(() => "/ai-revenue-os");
jest.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

jest.mock("@/hooks/useSocialAccounts", () => ({
  __esModule: true,
  useSocialAccounts: () => ({ data: [] }),
}));

jest.mock("@/lib/revenue-os/bentley-continuity-log", () => ({
  bentleyContinuityLog: jest.fn(),
}));

const LAUNCH_PREFILL: Required<
  Pick<BentleyLaunchPrefill, "campaignName" | "caption" | "hooks" | "cta">
> & { platformsLabel: string } = {
  campaignName: "Acme — launch",
  caption: "Main caption line",
  hooks: "Hook one\nHook two",
  cta: "Book now",
  platformsLabel: "LinkedIn, TikTok",
};

const PIPELINE_READY: BentleyPipelineStageState = {
  intakeComplete: true,
  analysisComplete: true,
  contentGenerated: true,
  campaignGenerated: true,
  launchReady: false,
};

function buildCanonicalSnapshot(over: Partial<BentleySnapshot> = {}): BentleySnapshot {
  return {
    industryKey: "consulting",
    contentIndustry: "Consulting",
    targetAudience: "SMB",
    traffic: 1000,
    conversionRate: 1,
    aov: 100,
    businessName: "Acme",
    coreOffer: "Offer",
    transformation: "Growth",
    platforms: ["LinkedIn", "TikTok"],
    postingPlatforms: ["linkedin", "instagram"],
    tone: "Pro",
    contentType: "Post",
    imageStyle: "clean",
    campaignNotes: "",
    pipeline: PIPELINE_READY,
    launchPrefill: LAUNCH_PREFILL,
    ...over,
  };
}

/** Re-applies pipeline + launchPrefill as a second hydration pass (stable identity for effect deps). */
function ReapplyLaunchPatch({
  pipeline,
  launchPrefill,
}: {
  pipeline: BentleyPipelineStageState;
  launchPrefill: BentleyLaunchPrefill;
}) {
  const { applyBentleyPatch } = useAiRevenueOsBentleyActions();
  useEffect(() => {
    applyBentleyPatch({ pipeline, launchPrefill });
  }, [applyBentleyPatch, pipeline, launchPrefill]);
  return null;
}

function PathnameProbe() {
  const p = usePathname();
  return <div data-testid="pathname-probe">{p ?? "undefined"}</div>;
}

/** Re-reads when shared snapshot changes (hydration + workflow sync both update the signature). */
function CaptureBentleySnapshot({ onSnap }: { onSnap: (s: BentleySnapshot) => void }) {
  const snapshotSig = useAiRevenueOsSnapshotSignature();
  const { getBentleySnapshot } = useAiRevenueOsBentleyActions();
  useEffect(() => {
    onSnap(getBentleySnapshot());
  }, [snapshotSig, getBentleySnapshot, onSnap]);
  return null;
}

function IntegrationHarness({
  postingTargets,
  seed,
  showReapply,
}: {
  postingTargets: SocialPlatform[];
  seed: BentleySnapshot;
  showReapply: boolean;
}) {
  return (
    <AiRevenueOsSharedStateProvider>
      <PathnameProbe />
      <BentleyPersistedSnapshotHydration />
      <CampaignLaunchSectionFromBentleySnapshot
        userId="user-int"
        clientId="client-int"
        postingTargets={postingTargets}
      />
      {showReapply ? (
        <ReapplyLaunchPatch pipeline={seed.pipeline ?? PIPELINE_READY} launchPrefill={seed.launchPrefill ?? LAUNCH_PREFILL} />
      ) : null}
    </AiRevenueOsSharedStateProvider>
  );
}

/** Hydration applies canonical state in an effect; launch prefill runs in a later commit — flush until values land. */
async function flushUntilCampaignNamePrefilled(
  container: HTMLElement,
  expected: string,
  maxTicks = 80
): Promise<void> {
  for (let i = 0; i < maxTicks; i++) {
    await act(async () => {
      await new Promise<void>((r) => queueMicrotask(r));
    });
    const v = container.querySelector<HTMLInputElement>('input[placeholder="Campaign name"]')?.value ?? "";
    if (v === expected) return;
  }
  throw new Error(`Timed out waiting for campaign name prefill "${expected}"`);
}

describe("CampaignLaunchSection canonical hydration integration", () => {
  let container: HTMLDivElement;
  let root: Root;

  it("sanity: canonical storage and BentleyPersistedSnapshotHydration merge pipeline + launchPrefill into context", async () => {
    mockUsePathname.mockReturnValue("/ai-revenue-os");
    const seed = buildCanonicalSnapshot();
    writeCanonicalBentleySnapshot(seed);
    expect(readCanonicalBentleySnapshot()?.launchPrefill?.campaignName).toBe(LAUNCH_PREFILL.campaignName);
    expect(readCanonicalBentleySnapshot()?.pipeline?.campaignGenerated).toBe(true);

    let captured: BentleySnapshot | null = null;
    const onSnap = (s: BentleySnapshot) => {
      captured = s;
    };

    await act(async () => {
      root.render(
        <AiRevenueOsSharedStateProvider>
          <PathnameProbe />
          <BentleyPersistedSnapshotHydration />
          <CaptureBentleySnapshot onSnap={onSnap} />
        </AiRevenueOsSharedStateProvider>
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector("[data-testid=\"pathname-probe\"]")?.textContent).toBe("/ai-revenue-os");
    expect(jest.mocked(bentleyContinuityLog)).toHaveBeenCalledWith(
      "dashboard_hydrated",
      expect.objectContaining({ source: "canonical_snapshot" })
    );
    expect(captured?.businessName).toBe("Acme");
    expect(captured?.pipeline?.campaignGenerated).toBe(true);
    expect(captured?.launchPrefill).toEqual(LAUNCH_PREFILL);
  });

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    sessionStorage.clear();
    localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ campaigns: [] }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.replaceChildren();
  });

  it("hydrates launch prefill from canonical storage via BentleyPersistedSnapshotHydration before prefill runs", async () => {
    mockUsePathname.mockReturnValue("/ai-revenue-os");
    const seed = buildCanonicalSnapshot({
      postingPlatforms: ["linkedin"],
      platforms: ["LinkedIn"],
    });
    writeCanonicalBentleySnapshot(seed);

    await act(async () => {
      root.render(
        <IntegrationHarness postingTargets={["tiktok"]} seed={seed} showReapply={false} />
      );
    });
    expect(container.querySelector("[data-testid=\"pathname-probe\"]")?.textContent).toBe("/ai-revenue-os");
    await flushUntilCampaignNamePrefilled(container, LAUNCH_PREFILL.campaignName);

    expect(jest.mocked(bentleyContinuityLog)).toHaveBeenCalledWith(
      "dashboard_hydrated",
      expect.objectContaining({ source: "canonical_snapshot" })
    );

    const nameInput = container.querySelector(
      'input[placeholder="Campaign name"]'
    ) as HTMLInputElement | null;
    const desc = container.querySelector("textarea") as HTMLTextAreaElement | null;

    expect(nameInput?.value).toBe(LAUNCH_PREFILL.campaignName);
    expect(desc?.value).toContain("Main caption line");
    expect(desc?.value).toContain("Hook one");

      expect(container.textContent).toMatch(/Connect TikTok|TikTok: server publish/);
    expect(container.textContent).not.toContain("Connect LinkedIn");
  });

  it("does not prefill when canonical has launchPrefill but campaignGenerated is false", async () => {
    mockUsePathname.mockReturnValue("/ai-revenue-os");
    const seed = buildCanonicalSnapshot({
      pipeline: { ...PIPELINE_READY, campaignGenerated: false },
    });
    writeCanonicalBentleySnapshot(seed);

    await act(async () => {
      root.render(
        <IntegrationHarness postingTargets={["tiktok"]} seed={seed} showReapply={false} />
      );
    });
    await act(async () => {
      await new Promise<void>((r) => queueMicrotask(r));
    });
    await act(async () => {
      await new Promise<void>((r) => queueMicrotask(r));
    });

    const nameInput = container.querySelector(
      'input[placeholder="Campaign name"]'
    ) as HTMLInputElement | null;
    expect(nameInput?.value).toBe("");
  });

  it("does not overwrite user-entered campaign name when a second canonical-style patch is applied", async () => {
    mockUsePathname.mockReturnValue("/ai-revenue-os");
    const seed = buildCanonicalSnapshot();
    writeCanonicalBentleySnapshot(seed);

    function ControlledReapplyHarness() {
      const [reapply, setReapply] = useState(false);
      return (
        <AiRevenueOsSharedStateProvider>
          <PathnameProbe />
          <BentleyPersistedSnapshotHydration />
          <CampaignLaunchSectionFromBentleySnapshot
            userId="user-int"
            clientId="client-int"
            postingTargets={["tiktok"]}
          />
          <button type="button" data-testid="trigger-reapply" onClick={() => setReapply(true)}>
            Reapply
          </button>
          {reapply ? (
            <ReapplyLaunchPatch pipeline={PIPELINE_READY} launchPrefill={LAUNCH_PREFILL} />
          ) : null}
        </AiRevenueOsSharedStateProvider>
      );
    }

    await act(async () => {
      root.render(<ControlledReapplyHarness />);
    });
    await flushUntilCampaignNamePrefilled(container, LAUNCH_PREFILL.campaignName);

    const nameInput = container.querySelector(
      'input[placeholder="Campaign name"]'
    ) as HTMLInputElement | null;
    expect(nameInput?.value).toBe(LAUNCH_PREFILL.campaignName);

    await act(async () => {
      if (!nameInput) return;
      const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
      proto?.set?.call(nameInput, "User held title");
      const ev = new Event("input", { bubbles: true });
      nameInput.dispatchEvent(ev);
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>("[data-testid=\"trigger-reapply\"]")?.click();
    });
    await act(async () => {
      await new Promise<void>((r) => queueMicrotask(r));
    });
    await act(async () => {
      await new Promise<void>((r) => queueMicrotask(r));
    });

    expect(nameInput?.value).toBe("User held title");
  });
});
