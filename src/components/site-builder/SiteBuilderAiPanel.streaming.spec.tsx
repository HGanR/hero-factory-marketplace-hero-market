/**
 * @jest-environment jsdom
 */
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { SiteBuilderAiPanel } from "@/components/site-builder/SiteBuilderAiPanel";

describe("SiteBuilderAiPanel perceived streaming build", () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: jest.Mock;
  let resolveFull: ((value: unknown) => void) | null = null;

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    fetchMock = jest.fn(async (_input, init?: RequestInit) => {
      const parsed = JSON.parse(String(init?.body ?? "{}")) as { step?: "full" | "plan" };
      if (parsed.step !== "full") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ planner: { sitemap: [{ slug: "/", title: "Home" }], sectionPlan: [] }, llmEnriched: false }),
        };
      }
      await new Promise((resolve) => {
        resolveFull = resolve;
      });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          planner: {
            siteTitle: "Final",
            styleMode: "minimal",
            sitemap: [{ slug: "/", title: "Home" }],
            sectionPlan: [{ id: "hero", registryKey: "hero_primary" }],
          },
          llmEnriched: true,
          schema: {
            pages: [{ slug: "/", blocks: [{ type: "hero", content: { title: "Final hero", subtitle: "Done" } }] }],
            metadata: { title: "Final", governance: {} },
          },
          evaluation: { score: 82, findings: [], flags: [] },
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
    resolveFull = null;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  async function renderPanel(onApplySchema: (json: string) => void) {
    await act(async () => {
      root.render(
        <SiteBuilderAiPanel
          schemaText="{}"
          onApplySchema={onApplySchema}
          onNotice={() => {}}
          onError={() => {}}
          withBusy={async (task) => task()}
          busy={false}
          workflowStage="describe"
        />,
      );
    });
  }

  it("renders preview updates before full pipeline resolves and shows streaming states", async () => {
    const onApplySchema = jest.fn();
    await renderPanel(onApplySchema);
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea).toBeTruthy();

    await act(async () => {
      textarea.value =
        "Build a conversion-optimized consulting site for Acme Growth with clear offer, audience, and CTA for operators";
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    expect(onApplySchema.mock.calls.length).toBeGreaterThan(0);
    expect(container.textContent || "").toContain("Building structure…");

    await act(async () => {
      jest.advanceTimersByTime(900);
    });
    expect(onApplySchema.mock.calls.length).toBeGreaterThan(1);
    expect(container.textContent || "").toContain("Generating content…");

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(container.textContent || "").toContain("Refining design…");

    await act(async () => {
      jest.advanceTimersByTime(1400);
    });
    expect(container.textContent || "").toContain("Finalizing…");

    await act(async () => {
      resolveFull?.(undefined);
    });
  });
});
