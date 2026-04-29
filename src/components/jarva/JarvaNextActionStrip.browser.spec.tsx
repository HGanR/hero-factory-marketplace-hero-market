/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, jest, beforeEach, afterEach } from "@jest/globals";
import { JarvaNextActionStrip } from "./JarvaNextActionStrip";

jest.mock("next/navigation", () => ({
  usePathname: () => "/trusts/t1/issue-security",
  useSearchParams: () => new URLSearchParams("jarvaFrom=1&jarvaLane=trust_ppm"),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

describe("JarvaNextActionStrip", () => {
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

  it("hides primary apply when wizard step already matches focus suggestion", () => {
    act(() => {
      root.render(
        <JarvaNextActionStrip
          wizardStepLetter="D"
          onApplyFocusStep={() => {}}
        />
      );
    });
    expect(container.textContent).toMatch(/Step already matches/);
    expect(container.querySelectorAll("button").length).toBe(1);
    expect(container.textContent).toContain("Dismiss");
  });
});
