/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, jest, beforeEach, afterEach } from "@jest/globals";
import { JarvaChatNextUiActions } from "./JarvaChatNextUiActions";
import type { JarvaNextUiActionBundle } from "@/lib/jarva/jarva-next-ui-actions";
import { JARVA_NEXT_UI_FOCUS_STEP_EVENT } from "@/lib/jarva/jarva-next-ui-client-actions";

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => "/trusts/t1/issue-security",
  useSearchParams: () => new URLSearchParams("jarvaFrom=1&jarvaLane=trust_ppm"),
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

describe("JarvaChatNextUiActions", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- React 18 + Jest jsdom
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    mockPush.mockClear();
    mockReplace.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  it("renders nothing when bundle is null", () => {
    act(() => {
      root.render(<JarvaChatNextUiActions bundle={null} trustId="t1" />);
    });
    expect(container.innerHTML).toBe("");
  });

  it("renders next actions when lane resolves on surface", () => {
    const bundle: JarvaNextUiActionBundle = {
      lane: "trust_ppm",
      proceduralStep: null,
      actions: [],
      advisoryLine: "Test advisory",
    };
    act(() => {
      root.render(<JarvaChatNextUiActions bundle={bundle} trustId="t1" />);
    });
    expect(container.textContent).toContain("Next actions");
    expect(container.textContent).toContain("Test advisory");
    expect(container.querySelectorAll("button").length).toBeGreaterThan(0);
  });

  it("renders nothing when surface filters all actions for lane", () => {
    const bundle: JarvaNextUiActionBundle = {
      lane: "trust_revocable",
      proceduralStep: null,
      actions: [],
    };
    act(() => {
      root.render(<JarvaChatNextUiActions bundle={bundle} trustId="t1" />);
    });
    expect(container.innerHTML).toBe("");
  });

  it("focus_step dispatches shared focus event when not aligned", () => {
    const bundle: JarvaNextUiActionBundle = {
      lane: "trust_ppm",
      proceduralStep: null,
      actions: [],
    };
    const spy = jest.fn();
    window.addEventListener(JARVA_NEXT_UI_FOCUS_STEP_EVENT, spy);

    act(() => {
      root.render(<JarvaChatNextUiActions bundle={bundle} trustId="t1" wizardStepLetter="A" />);
    });

    const stepBtn = [...container.querySelectorAll("button")].find(
      (b) => b.textContent?.includes("Focus this step") || b.textContent?.includes("Step D")
    );
    expect(stepBtn).toBeTruthy();

    act(() => {
      stepBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(spy).toHaveBeenCalled();
    window.removeEventListener(JARVA_NEXT_UI_FOCUS_STEP_EVENT, spy);
  });

  it("does not offer redundant focus CTA when wizard already on that step", () => {
    const bundle: JarvaNextUiActionBundle = {
      lane: "trust_ppm",
      proceduralStep: null,
      actions: [],
    };
    const spy = jest.fn();
    window.addEventListener(JARVA_NEXT_UI_FOCUS_STEP_EVENT, spy);

    act(() => {
      root.render(<JarvaChatNextUiActions bundle={bundle} trustId="t1" wizardStepLetter="D" />);
    });

    const aligned = [...container.querySelectorAll("button")].find((b) => b.textContent === "Already aligned");
    expect(aligned).toBeTruthy();
    expect(aligned?.hasAttribute("disabled")).toBe(true);

    act(() => {
      aligned!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(spy).not.toHaveBeenCalled();
    window.removeEventListener(JARVA_NEXT_UI_FOCUS_STEP_EVENT, spy);
  });

  it("shows handoff lane match hint on issue-security when query matches bundle", () => {
    const bundle: JarvaNextUiActionBundle = {
      lane: "trust_ppm",
      proceduralStep: null,
      actions: [],
    };
    act(() => {
      root.render(<JarvaChatNextUiActions bundle={bundle} trustId="t1" wizardStepLetter="A" />);
    });
    expect(container.textContent).toMatch(/Handoff lane matches/);
  });
});
