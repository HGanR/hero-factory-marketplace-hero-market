/**
 * @jest-environment jsdom
 */
import { describe, expect, it, jest } from "@jest/globals";
import {
  applyJarvaNextUiActionInBrowser,
  JARVA_NEXT_UI_FOCUS_STEP_EVENT,
} from "./jarva-next-ui-client-actions";

describe("applyJarvaNextUiActionInBrowser", () => {
  it("select_tab replaces query on trust-records when tab is empty", () => {
    const replace = jest.fn();
    const push = jest.fn();
    const r = applyJarvaNextUiActionInBrowser(
      { kind: "select_tab", target: "bonds", label: "x", autoApplyEligible: true },
      {
        pathname: "/trust-records",
        searchParams: new URLSearchParams("trustId=t1"),
        push,
        replace,
        trustId: "t1",
        lane: "trust_bond",
      }
    );
    expect(r.kind).toBe("navigated");
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("tab=bonds"));
    expect(push).not.toHaveBeenCalled();
  });

  it("select_tab no-ops on tab conflict", () => {
    const replace = jest.fn();
    applyJarvaNextUiActionInBrowser(
      { kind: "select_tab", target: "bonds", label: "x", autoApplyEligible: true },
      {
        pathname: "/trust-records",
        searchParams: new URLSearchParams("trustId=t1&tab=instruments"),
        push: jest.fn(),
        replace,
        trustId: "t1",
        lane: "trust_bond",
      }
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("select_tab pushes to trust-records with handoff when not on trust-records", () => {
    const push = jest.fn();
    applyJarvaNextUiActionInBrowser(
      { kind: "select_tab", target: "bonds", label: "x", autoApplyEligible: true },
      {
        pathname: "/smart-trust",
        searchParams: new URLSearchParams(),
        push,
        replace: jest.fn(),
        trustId: "tid",
        lane: "trust_bond",
      }
    );
    expect(push).toHaveBeenCalledWith(expect.stringMatching(/\/trust-records\?.*trustId=tid.*tab=bonds/));
  });

  it("focus_step calls onFocusStep when provided", () => {
    const onFocusStep = jest.fn();
    const r = applyJarvaNextUiActionInBrowser(
      { kind: "focus_step", target: "D", label: "x", autoApplyEligible: false },
      {
        pathname: "/x",
        searchParams: new URLSearchParams(),
        push: jest.fn(),
        replace: jest.fn(),
        onFocusStep,
      }
    );
    expect(r.kind).toBe("dispatched");
    expect(onFocusStep).toHaveBeenCalledWith("D");
  });

  it("focus_step dispatches custom event when onFocusStep omitted", () => {
    const listener = jest.fn();
    window.addEventListener(JARVA_NEXT_UI_FOCUS_STEP_EVENT, listener);
    applyJarvaNextUiActionInBrowser(
      { kind: "focus_step", target: "A", label: "x", autoApplyEligible: false },
      {
        pathname: "/x",
        searchParams: new URLSearchParams(),
        push: jest.fn(),
        replace: jest.fn(),
      }
    );
    expect(listener).toHaveBeenCalled();
    const ce = listener.mock.calls[0][0] as CustomEvent<{ step: string }>;
    expect(ce.detail.step).toBe("A");
    window.removeEventListener(JARVA_NEXT_UI_FOCUS_STEP_EVENT, listener);
  });

  it("prefill_mode is not applied in browser (advisory-only at call sites)", () => {
    const push = jest.fn();
    const replace = jest.fn();
    const r = applyJarvaNextUiActionInBrowser(
      {
        kind: "prefill_mode",
        target: "trust_drafting_lane",
        value: "revocable",
        label: "x",
        autoApplyEligible: false,
      },
      {
        pathname: "/smart-trust",
        searchParams: new URLSearchParams(),
        push,
        replace,
        trustId: "t1",
        lane: "trust_revocable",
      }
    );
    expect(r.kind).toBe("noop");
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("highlight_action scrolls to data-jarva-target", () => {
    const el = document.createElement("div");
    el.setAttribute("data-jarva-target", "issue_security_main");
    document.body.appendChild(el);
    const scrollIntoView = jest.fn();
    el.scrollIntoView = scrollIntoView;
    applyJarvaNextUiActionInBrowser(
      { kind: "highlight_action", target: "issue_security_main", label: "x", autoApplyEligible: true },
      {
        pathname: "/",
        searchParams: new URLSearchParams(),
        push: jest.fn(),
        replace: jest.fn(),
      }
    );
    expect(scrollIntoView).toHaveBeenCalled();
    document.body.removeChild(el);
  });
});
