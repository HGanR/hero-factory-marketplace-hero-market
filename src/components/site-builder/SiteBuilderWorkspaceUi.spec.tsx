/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { SiteBuilderFileDrawer } from "@/components/site-builder/SiteBuilderFileDrawer";
import { SiteBuilderSeoAuditPanel } from "@/components/site-builder/SiteBuilderSeoAuditPanel";
import { isShowCodeRequest, nextMissingIntakeQuestion } from "@/components/site-builder/SiteBuilderAiPanel";

describe("Site Builder workspace UI helpers", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
  });

  it("opens and closes file drawer", async () => {
    const files = [
      { id: "schema.json", label: "schema.json", content: "{}", languageHint: "json" },
      { id: "metadata.json", label: "metadata.json", content: "{\"title\":\"x\"}", languageHint: "json" },
    ];
    let open = true;
    const close = () => {
      open = false;
    };
    await act(async () => {
      root.render(
        <SiteBuilderFileDrawer
          open={open}
          files={files}
          activeFileId="schema.json"
          onSelectFile={() => {}}
          onClose={close}
        />,
      );
    });
    expect(container.textContent).toMatch(/Files \/ Code/);
    const closeBtn = container.querySelector("button");
    await act(async () => {
      (closeBtn as HTMLButtonElement).click();
      root.render(
        <SiteBuilderFileDrawer
          open={open}
          files={files}
          activeFileId="schema.json"
          onSelectFile={() => {}}
          onClose={close}
        />,
      );
    });
    expect(container.textContent || "").not.toMatch(/Files \/ Code/);
  });

  it("shows selected file in code viewer", async () => {
    const files = [
      { id: "schema.json", label: "schema.json", content: "{\"a\":1}", languageHint: "json" },
      { id: "metadata.json", label: "metadata.json", content: "{\"title\":\"new\"}", languageHint: "json" },
    ];
    let active = "schema.json";
    const select = (id: string) => {
      active = id;
    };
    await act(async () => {
      root.render(
        <SiteBuilderFileDrawer open files={files} activeFileId={active} onSelectFile={select} onClose={() => {}} />,
      );
    });
    const secondBtn = container.querySelectorAll("nav button")[1] as HTMLButtonElement;
    await act(async () => {
      secondBtn.click();
      root.render(
        <SiteBuilderFileDrawer open files={files} activeFileId={active} onSelectFile={select} onClose={() => {}} />,
      );
    });
    expect(container.textContent).toContain("\"title\":\"new\"");
  });

  it("seo audit score card updates when metadata score changes", async () => {
    const baseProps = {
      title: "SEO title",
      description: "D".repeat(150),
      primaryKeyword: "atlanta web3 consulting",
      secondaryKeywords: ["blockchain strategy"],
      h1Status: "Good",
      structuredDataStatus: "Present",
      imageAltStatus: "Present",
      localSeoStatus: "Present",
      warnings: [],
      onGenerateSeo: () => {},
      onImproveTitle: () => {},
      onAddStructuredData: () => {},
      onOptimizeLocal: () => {},
    };
    await act(async () => {
      root.render(<SiteBuilderSeoAuditPanel {...baseProps} score={{ score: 40, missingItems: ["CTA"], suggestedKeywords: [] }} />);
    });
    expect(container.textContent).toContain("40");
    await act(async () => {
      root.render(
        <SiteBuilderSeoAuditPanel
          {...baseProps}
          score={{ score: 88, missingItems: [], suggestedKeywords: ["blockchain consulting"] }}
        />,
      );
    });
    expect(container.textContent).toContain("88");
  });

  it("asks missing SEO follow-up question after core intake", () => {
    const q = nextMissingIntakeQuestion({
      businessName: "Atlas",
      industry: "Consulting",
      primaryOffer: "Web3 advisory",
      audience: "Founders",
      market: "Atlanta",
      additionalNotes: "Build a modern site",
    });
    expect(q?.prompt).toMatch(/SEO keyword/i);
  });

  it("detects show code commands", () => {
    expect(isShowCodeRequest("show code")).toBe(true);
    expect(isShowCodeRequest("open files drawer")).toBe(true);
    expect(isShowCodeRequest("optimize seo")).toBe(false);
  });
});
