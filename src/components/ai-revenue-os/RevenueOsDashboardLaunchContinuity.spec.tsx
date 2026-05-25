/**
 * @jest-environment jsdom
 *
 * /revenue-os/dashboard path: form + workflow sync into shared Bentley state (tests omit BentleyPersistedSnapshotHydration; production mounts it for canonical chat rehydration).
 */
import React, { act, useCallback, useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import * as BentleyWorkflow from "@/lib/revenue-os/bentley-workflow";
import { syncPipelineStagesFromWorkflow } from "@/lib/revenue-os/bentley-pipeline-stage-sync";
import { writeBentleySession } from "@/lib/revenue-os/bentley-storage-scope";
import {
  BENTLEY_DASHBOARD_HANDOFF_STORAGE_KEY,
  REVENUE_OS_BENTLEY_APPLIED_FORM_KEY,
  REVENUE_OS_DASHBOARD_USER_TOUCHED_KEY,
  bentleySnapshotFromDashboardForm,
  buildBentleyDashboardPayload,
  serializeBentleyDashboardHandoff,
} from "@/lib/revenue-os/bentley-dashboard-handoff";
import {
  AiRevenueOsSharedStateProvider,
  useAiRevenueOsBentleyActions,
  useAiRevenueOsSnapshotSignature,
} from "@/components/ai-revenue-os/AiRevenueOsSharedState";
import { BentleyDashboardSharedStateSync } from "@/components/ai-revenue-os/BentleyDashboardSharedStateSync";
import { BentleyDashboardBridge } from "@/components/revenue-os/BentleyDashboardBridge";
import {
  CampaignLaunchSectionFromBentleySnapshot,
} from "@/components/ai-revenue-os/CampaignLaunchSection";
import { normalizeDashboardFormValues, type RevenueOsDashboardFormValues } from "@/lib/revenue-os/run-revenue-os-analysis";
import type { BentleyWorkflowState } from "@/lib/revenue-os/bentley-workflow";
import { defaultWorkflowState } from "@/lib/revenue-os/bentley-workflow";
import type { ContentEngineOutput } from "@/lib/revenue-os/content-engine-types";
import type { CampaignResponse } from "@/lib/revenue-os/campaign-schema";
import { bentleyContinuityLog } from "@/lib/revenue-os/bentley-continuity-log";

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/revenue-os/dashboard"),
}));

jest.mock("@/hooks/useSocialAccounts", () => ({
  __esModule: true,
  useSocialAccounts: () => ({ data: [] }),
}));

jest.mock("@/lib/revenue-os/bentley-continuity-log", () => ({
  bentleyContinuityLog: jest.fn(),
}));

function dashboardFormFixture(): RevenueOsDashboardFormValues {
  return normalizeDashboardFormValues({
    businessName: "Acme",
    businessType: "Consulting",
    targetAudience: "SMB owners",
    market: "US",
    currentMonthlyRevenue: 10_000,
    targetMonthlyRevenue: 50_000,
    avgOrderValue: 500,
    grossMarginPct: 60,
    monthlyTraffic: 5000,
    conversionRatePct: 2,
    cac: 200,
    ltv: 2000,
    coreOffer: "Ops system",
    transformation: "Scale",
    platforms: ["LinkedIn", "TikTok"],
    postingPlatforms: ["tiktok"],
    tone: "Professional",
    contentTypeFocus: "Full Post",
    imageStyle: "cinematic",
    notes: "Dashboard seeded notes",
  });
}

function workflowComplete(): BentleyWorkflowState {
  const campaign = {
    offerStatement: "Offer line",
    shortFormHooks: ["Hook A"],
    longFormOutlines: [{ cta: "Book" }],
  } as unknown as CampaignResponse;
  const contentEngine = {
    fullPost: { caption: "Dashboard path caption" },
  } as ContentEngineOutput;
  return {
    ...defaultWorkflowState(),
    currentPhase: "dashboard",
    completed: {
      intake: true,
      analysis: true,
      content: true,
      campaign_generation: true,
      media_brief: true,
    },
    artifacts: {
      analysisComplete: true,
      contentEngine,
      campaign,
      mediaBriefText: "brief",
    },
    updatedAt: Date.now(),
  };
}

function workflowEmpty(): BentleyWorkflowState {
  return {
    ...defaultWorkflowState(),
    completed: {},
    artifacts: {},
    updatedAt: Date.now(),
  };
}

const emptyFormState = (): RevenueOsDashboardFormValues =>
  normalizeDashboardFormValues({
    businessName: "",
    businessType: "",
    targetAudience: "",
    market: "US",
    currentMonthlyRevenue: 0,
    targetMonthlyRevenue: 0,
    avgOrderValue: 0,
    grossMarginPct: 50,
    monthlyTraffic: 0,
    conversionRatePct: 0,
    cac: 0,
    ltv: 0,
    coreOffer: "",
    transformation: "",
    platforms: [],
    postingPlatforms: [],
    tone: "",
    contentTypeFocus: "",
    imageStyle: "",
    notes: "",
  });

/** Mirrors production: pipeline resync runs on `onBentleySnapshotAppliedFromForm` (after debounced form→snapshot apply). */
function DashboardFormSyncWithPipelineResync({ form }: { form: RevenueOsDashboardFormValues }) {
  const { applyBentleyPatch, getBentleySnapshot } = useAiRevenueOsBentleyActions();
  const onApplied = useCallback(() => {
    syncPipelineStagesFromWorkflow(applyBentleyPatch, getBentleySnapshot);
  }, [applyBentleyPatch, getBentleySnapshot]);
  return (
    <BentleyDashboardSharedStateSync form={form} onBentleySnapshotAppliedFromForm={onApplied} />
  );
}

/** Manual second sync when workflow mock switches to an “all false” derive (validates merge OR). */
function ManualWorkflowResync({ gen }: { gen: number }) {
  const { applyBentleyPatch, getBentleySnapshot } = useAiRevenueOsBentleyActions();
  useEffect(() => {
    if (gen < 1) return;
    syncPipelineStagesFromWorkflow(applyBentleyPatch, getBentleySnapshot);
  }, [gen, applyBentleyPatch, getBentleySnapshot]);
  return null;
}

describe("Revenue OS dashboard launch continuity (shared state + workflow sync)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let loadSpy: jest.SpyInstance;

  function remountRoot(): void {
    act(() => {
      root.unmount();
    });
    root = createRoot(container);
  }

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
    jest.mocked(bentleyContinuityLog).mockClear();
    loadSpy = jest.spyOn(BentleyWorkflow, "loadWorkflowState").mockReturnValue(workflowComplete());
  });

  afterEach(() => {
    loadSpy.mockRestore();
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.replaceChildren();
  });

  it("dashboard route: handoff + SharedStateSync + workflow sync (gate + pipeline OR, no canonical hydration)", async () => {
    const formSeed = dashboardFormFixture();
    const snap = bentleySnapshotFromDashboardForm(formSeed);
    writeBentleySession(
      BENTLEY_DASHBOARD_HANDOFF_STORAGE_KEY,
      serializeBentleyDashboardHandoff({
        payload: buildBentleyDashboardPayload(snap, { autoRunFullAnalysis: false }),
      })
    );

    function TreeHandoff() {
      const [form, setForm] = useState<RevenueOsDashboardFormValues>(emptyFormState);
      const formRef = useRef(form);
      formRef.current = form;

      return (
        <AiRevenueOsSharedStateProvider>
          <BentleyDashboardBridge
            setForm={setForm}
            getDashboardFormForMerge={() => formRef.current}
            onHydratedFromBentley={() => {}}
            runAnalysisWithForm={async () => {}}
          />
          <DashboardFormSyncWithPipelineResync form={form} />
          <CampaignLaunchSectionFromBentleySnapshot
            userId="dash-u"
            clientId="dash-c"
            postingTargets={form.postingPlatforms}
          />
        </AiRevenueOsSharedStateProvider>
      );
    }

    await act(async () => {
      root.render(<TreeHandoff />);
    });

    await act(async () => {
      await new Promise<void>((r) => {
        window.setTimeout(r, 400);
      });
    });

    const nameInput = container.querySelector(
      'input[placeholder="Campaign name"]'
    ) as HTMLInputElement | null;
    const desc = container.querySelector("textarea") as HTMLTextAreaElement | null;

    expect(nameInput?.value?.length ?? 0).toBeGreaterThan(0);
    expect(desc?.value?.trim().length ?? 0).toBeGreaterThan(0);
    expect(desc?.value).toContain("Dashboard path caption");

    expect(container.textContent).toMatch(/Connect TikTok|TikTok: server publish/);
    expect(container.textContent).not.toContain("Connect LinkedIn");

    expect(jest.mocked(bentleyContinuityLog)).not.toHaveBeenCalledWith(
      "dashboard_hydrated",
      expect.objectContaining({ source: "canonical_snapshot" })
    );

    /** Applied-form restore branch (no handoff): same bridge + sync path after refresh-style entry. */
    remountRoot();
    sessionStorage.clear();
    localStorage.clear();
    writeBentleySession(REVENUE_OS_BENTLEY_APPLIED_FORM_KEY, JSON.stringify(formSeed));
    loadSpy.mockReturnValue(workflowComplete());
    jest.mocked(bentleyContinuityLog).mockClear();

    function TreeAppliedForm() {
      const [form, setForm] = useState<RevenueOsDashboardFormValues>(emptyFormState);
      const formRef = useRef(form);
      formRef.current = form;

      return (
        <AiRevenueOsSharedStateProvider>
          <BentleyDashboardBridge
            setForm={setForm}
            getDashboardFormForMerge={() => formRef.current}
            onHydratedFromBentley={() => {}}
            runAnalysisWithForm={async () => {}}
          />
          <DashboardFormSyncWithPipelineResync form={form} />
          <CampaignLaunchSectionFromBentleySnapshot
            userId="dash-u"
            clientId="dash-c"
            postingTargets={form.postingPlatforms}
          />
        </AiRevenueOsSharedStateProvider>
      );
    }

    await act(async () => {
      root.render(<TreeAppliedForm />);
    });
    await act(async () => {
      await new Promise<void>((r) => {
        window.setTimeout(r, 400);
      });
    });

    const nameAfterApplied = container.querySelector(
      'input[placeholder="Campaign name"]'
    ) as HTMLInputElement | null;
    const descAfterApplied = container.querySelector("textarea") as HTMLTextAreaElement | null;
    expect(nameAfterApplied?.value?.length ?? 0).toBeGreaterThan(0);
    expect(descAfterApplied?.value?.trim().length ?? 0).toBeGreaterThan(0);
    expect(descAfterApplied?.value).toContain("Dashboard path caption");
    expect(container.textContent).toMatch(/Connect TikTok|TikTok: server publish/);
    expect(container.textContent).not.toContain("Connect LinkedIn");

    /** Gate: empty workflow does not prefill launch fields when campaign is not generated. */
    remountRoot();
    sessionStorage.clear();
    localStorage.clear();
    loadSpy.mockReturnValue(workflowEmpty());
    const form = dashboardFormFixture();

    function TreeNoBridge() {
      return (
        <AiRevenueOsSharedStateProvider>
          <DashboardFormSyncWithPipelineResync form={form} />
          <CampaignLaunchSectionFromBentleySnapshot
            userId="dash-u"
            clientId="dash-c"
            postingTargets={form.postingPlatforms}
          />
        </AiRevenueOsSharedStateProvider>
      );
    }

    await act(async () => {
      root.render(<TreeNoBridge />);
    });
    await act(async () => {
      await new Promise<void>((r) => {
        window.setTimeout(r, 400);
      });
    });

    const nameGated = container.querySelector(
      'input[placeholder="Campaign name"]'
    ) as HTMLInputElement | null;
    expect(nameGated?.value ?? "").toBe("");

    /** mergePipelineStages OR: later workflow-derived false flags do not clear campaignGenerated. */
    remountRoot();
    sessionStorage.clear();
    localStorage.clear();
    loadSpy.mockReturnValue(workflowComplete());
    const campaignGen = { current: false };

    function PipelineCampaignGenProbe() {
      const sig = useAiRevenueOsSnapshotSignature();
      const { getBentleySnapshot } = useAiRevenueOsBentleyActions();
      useEffect(() => {
        campaignGen.current = getBentleySnapshot().pipeline?.campaignGenerated === true;
      }, [sig, getBentleySnapshot]);
      return null;
    }

    function TreePipelinePreserve() {
      const [wfEmpty, setWfEmpty] = useState(false);
      return (
        <AiRevenueOsSharedStateProvider>
          <DashboardFormSyncWithPipelineResync form={form} />
          <PipelineCampaignGenProbe />
          <button type="button" data-testid="switch-wf-empty" onClick={() => setWfEmpty(true)}>
            empty
          </button>
          <ManualWorkflowResync gen={wfEmpty ? 1 : 0} />
        </AiRevenueOsSharedStateProvider>
      );
    }

    await act(async () => {
      root.render(<TreePipelinePreserve />);
    });
    await act(async () => {
      await new Promise<void>((r) => {
        window.setTimeout(r, 400);
      });
    });
    expect(campaignGen.current).toBe(true);

    loadSpy.mockReturnValue(workflowEmpty());
    await act(async () => {
      container.querySelector<HTMLButtonElement>("[data-testid=\"switch-wf-empty\"]")?.click();
    });
    await act(async () => {
      await new Promise<void>((r) => {
        window.setTimeout(r, 400);
      });
    });

    expect(campaignGen.current).toBe(true);
  });

  it("applies Bentley handoff even when dashboard-user-touched is stale (explicit open-dashboard wins)", async () => {
    const formSeed = dashboardFormFixture();
    const snap = bentleySnapshotFromDashboardForm(formSeed);
    snap.businessName = "From Bentley Handoff Only";
    writeBentleySession(REVENUE_OS_DASHBOARD_USER_TOUCHED_KEY, "1");
    writeBentleySession(
      BENTLEY_DASHBOARD_HANDOFF_STORAGE_KEY,
      serializeBentleyDashboardHandoff({
        payload: buildBentleyDashboardPayload(snap, { autoRunFullAnalysis: false }),
      })
    );

    function Tree() {
      const [form, setForm] = useState<RevenueOsDashboardFormValues>(emptyFormState());
      const formRef = useRef(form);
      formRef.current = form;
      return (
        <AiRevenueOsSharedStateProvider>
          <BentleyDashboardBridge
            setForm={setForm}
            getDashboardFormForMerge={() => formRef.current}
            onHydratedFromBentley={() => {}}
            runAnalysisWithForm={async () => {}}
          />
          <span data-testid="biz-name">{form.businessName}</span>
        </AiRevenueOsSharedStateProvider>
      );
    }

    await act(async () => {
      root.render(<Tree />);
    });
    await act(async () => {
      await new Promise<void>((r) => {
        window.setTimeout(r, 50);
      });
    });

    const shown = container.querySelector("[data-testid=\"biz-name\"]")?.textContent ?? "";
    expect(shown).toBe("From Bentley Handoff Only");
    expect(sessionStorage.getItem(REVENUE_OS_DASHBOARD_USER_TOUCHED_KEY)).not.toBe("1");
  });
});
