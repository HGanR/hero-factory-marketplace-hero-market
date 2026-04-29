/**
 * @jest-environment jsdom
 */
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, jest } from "@jest/globals";
import { SiteBuilderAiPanel } from "@/components/site-builder/SiteBuilderAiPanel";

type PipelineStep = "plan" | "full";

describe("SiteBuilderAiPanel Enter behavior", () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    fetchMock = jest.fn(async (_input, init?: RequestInit) => {
      const parsed = JSON.parse(String(init?.body ?? "{}")) as { step?: PipelineStep };
      if (parsed.step === "plan") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            planner: {
              siteTitle: "Plan",
              styleMode: "minimal",
              sitemap: [{ slug: "/", title: "Home" }],
              sectionPlan: [{ id: "hero", registryKey: "hero" }],
            },
            llmEnriched: false,
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          planner: {
            siteTitle: "Full",
            styleMode: "minimal",
            sitemap: [{ slug: "/", title: "Home" }],
            sectionPlan: [{ id: "hero", registryKey: "hero" }],
          },
          llmEnriched: false,
          schema: {
            pages: [
              {
                slug: "/",
                blocks: [{ type: "hero", content: { aiSectionId: "hero-1", aiRegistryKey: "hero_primary", title: "T", subtitle: "S" } }],
              },
            ],
            metadata: { title: "Generated", governance: {} },
          },
          evaluation: { score: 80, findings: [], flags: [] },
          variantSeeds: ["seed-1"],
          generationMeta: { plannerPath: "llm_enriched", diversityScore: 0.5, retryCount: 0 },
        }),
      };
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
    jest.restoreAllMocks();
  });

  async function renderPanel() {
    await act(async () => {
      root.render(
        <SiteBuilderAiPanel
          schemaText="{}"
          onApplySchema={() => {}}
          onNotice={() => {}}
          onError={() => {}}
          withBusy={async (task) => task()}
          busy={false}
          workflowStage="describe"
        />,
      );
    });
  }

  function bodyStepsFromFetchCalls(): PipelineStep[] {
    return fetchMock.mock.calls
      .map(([, init]) => {
        const body = JSON.parse(String((init as RequestInit | undefined)?.body ?? "{}")) as { step?: PipelineStep };
        return body.step;
      })
      .filter((step): step is PipelineStep => step === "plan" || step === "full");
  }

  it("pressing Enter in Describe runs full build, not plan-only", async () => {
    await renderPanel();

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea).toBeTruthy();

    await act(async () => {
      textarea.value = "Build a cinematic brand site for an operator-led studio";
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    const steps = bodyStepsFromFetchCalls();
    expect(steps).toContain("full");
    expect(steps).not.toContain("plan");
  });

  it("plan-only pipeline runs from Manual Tools button", async () => {
    await renderPanel();

    const summary = Array.from(container.querySelectorAll("summary")).find((el) =>
      (el.textContent || "").includes("Plan & outline"),
    ) as HTMLElement;
    expect(summary).toBeTruthy();

    await act(async () => {
      summary.click();
    });

    const planOnlyButton = Array.from(container.querySelectorAll("button")).find((el) =>
      (el.textContent || "").includes("Plan only"),
    ) as HTMLButtonElement;
    expect(planOnlyButton).toBeTruthy();

    await act(async () => {
      planOnlyButton.click();
    });

    const steps = bodyStepsFromFetchCalls();
    expect(steps).toContain("plan");
  });
});
