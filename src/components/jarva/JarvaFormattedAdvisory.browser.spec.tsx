/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, beforeEach, afterEach } from "@jest/globals";
import { JarvaFormattedAdvisory } from "./JarvaFormattedAdvisory";

describe("JarvaFormattedAdvisory", () => {
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

  it("renders **segments** as strong", () => {
    act(() => {
      root.render(<JarvaFormattedAdvisory text="**Jarva** note" />);
    });
    expect(container.querySelector("strong")?.textContent).toBe("Jarva");
  });

  it("preserves newlines", () => {
    act(() => {
      root.render(<JarvaFormattedAdvisory text={"Line one\nLine two"} />);
    });
    expect(container.innerHTML).toContain("<br");
    expect(container.textContent).toContain("Line one");
    expect(container.textContent).toContain("Line two");
  });
});
