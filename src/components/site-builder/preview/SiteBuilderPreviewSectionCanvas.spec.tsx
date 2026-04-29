/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { getPreviewBlockSectionMeta } from "@/lib/site-builder/preview/blockPreviewUtils";
import { SiteBuilderPreviewSectionCanvas } from "./SiteBuilderPreviewSectionCanvas";

describe("getPreviewBlockSectionMeta", () => {
  it("reads aiSectionId and type", () => {
    expect(getPreviewBlockSectionMeta({ type: "hero", content: { aiSectionId: "sec-a" } })).toEqual({
      sectionId: "sec-a",
      sectionType: "hero",
    });
  });

  it("returns null sectionId when missing", () => {
    expect(getPreviewBlockSectionMeta({ type: "hero", content: {} }).sectionId).toBeNull();
  });
});

describe("SiteBuilderPreviewSectionCanvas", () => {
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

  it("invokes onSelect when the section shell is clicked", async () => {
    let shift: boolean | undefined;
    await act(async () => {
      root.render(
        <SiteBuilderPreviewSectionCanvas
          enabled
          sectionId="s1"
          sectionType="hero"
          selected={false}
          refineActionVisible={false}
          editorOpen={false}
          busy={false}
          feedback="idle"
          errorMessage={null}
          workflowStage="refine"
          onSelect={(opts) => {
            shift = opts?.shiftKey;
          }}
          onOpenEditor={() => {}}
          onCloseEditor={() => {}}
          onSubmitEdit={async () => {}}
          onDismissFeedback={() => {}}
          onDismissError={() => {}}
        >
          <div data-testid="inner">content</div>
        </SiteBuilderPreviewSectionCanvas>,
      );
    });
    const shell = container.querySelector('[role="button"]');
    expect(shell).toBeTruthy();
    await act(async () => {
      (shell as HTMLElement).click();
    });
    expect(shift).toBe(false);
  });

  it("passes shiftKey true when Shift-clicking the section shell", async () => {
    let shift: boolean | undefined;
    await act(async () => {
      root.render(
        <SiteBuilderPreviewSectionCanvas
          enabled
          sectionId="s1"
          sectionType="hero"
          selected={false}
          refineActionVisible={false}
          editorOpen={false}
          busy={false}
          feedback="idle"
          errorMessage={null}
          workflowStage="refine"
          onSelect={(opts) => {
            shift = opts?.shiftKey;
          }}
          onOpenEditor={() => {}}
          onCloseEditor={() => {}}
          onSubmitEdit={async () => {}}
          onDismissFeedback={() => {}}
          onDismissError={() => {}}
        >
          <div data-testid="inner">content</div>
        </SiteBuilderPreviewSectionCanvas>,
      );
    });
    const shell = container.querySelector('[role="button"]');
    await act(async () => {
      (shell as HTMLElement).dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, shiftKey: true }),
      );
    });
    expect(shift).toBe(true);
  });

  it("shows the refine chip when selected and editor is closed", async () => {
    await act(async () => {
      root.render(
        <SiteBuilderPreviewSectionCanvas
          enabled
          sectionId="s1"
          sectionType="call_to_action"
          selected
          refineActionVisible
          editorOpen={false}
          busy={false}
          feedback="idle"
          errorMessage={null}
          workflowStage="refine"
          onSelect={() => {}}
          onOpenEditor={() => {}}
          onCloseEditor={() => {}}
          onSubmitEdit={async () => {}}
          onDismissFeedback={() => {}}
          onDismissError={() => {}}
        >
          <div>cta</div>
        </SiteBuilderPreviewSectionCanvas>,
      );
    });
    expect(container.textContent).toMatch(/Refine this section/);
  });

  it("renders children only when disabled (backward compatible)", async () => {
    await act(async () => {
      root.render(
        <SiteBuilderPreviewSectionCanvas
          enabled={false}
          sectionId="s1"
          sectionType="hero"
          selected={false}
          refineActionVisible={false}
          editorOpen={false}
          busy={false}
          feedback="idle"
          errorMessage={null}
          workflowStage="refine"
          onSelect={() => {}}
          onOpenEditor={() => {}}
          onCloseEditor={() => {}}
          onSubmitEdit={async () => {}}
          onDismissFeedback={() => {}}
          onDismissError={() => {}}
        >
          <div data-testid="plain">x</div>
        </SiteBuilderPreviewSectionCanvas>,
      );
    });
    expect(container.querySelector('[data-testid="plain"]')).toBeTruthy();
    expect(container.querySelector('[role="button"]')).toBeNull();
  });

  it("supports inline text editing callback on double click", async () => {
    let payload: { previous: string; next: string } | null = null;
    await act(async () => {
      root.render(
        <SiteBuilderPreviewSectionCanvas
          enabled
          sectionId="s1"
          sectionType="hero"
          selected
          refineActionVisible={false}
          editorOpen={false}
          busy={false}
          feedback="idle"
          errorMessage={null}
          workflowStage="refine"
          onSelect={() => {}}
          onOpenEditor={() => {}}
          onCloseEditor={() => {}}
          onSubmitEdit={async () => {}}
          onInlineTextEdit={(previousText, nextText) => {
            payload = { previous: previousText, next: nextText };
          }}
          onDismissFeedback={() => {}}
          onDismissError={() => {}}
        >
          <p>Old title</p>
        </SiteBuilderPreviewSectionCanvas>,
      );
    });
    const text = container.querySelector("p") as HTMLElement;
    await act(async () => {
      text.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
    });
    text.textContent = "New title";
    await act(async () => {
      text.dispatchEvent(new FocusEvent("blur", { bubbles: true, cancelable: true }));
    });
    expect(payload).toEqual({ previous: "Old title", next: "New title" });
  });

  it("renders critique badge text for section quality", async () => {
    await act(async () => {
      root.render(
        <SiteBuilderPreviewSectionCanvas
          enabled
          sectionId="s1"
          sectionType="hero"
          selected
          refineActionVisible={false}
          editorOpen={false}
          busy={false}
          feedback="idle"
          errorMessage={null}
          workflowStage="refine"
          critiqueScore={55}
          onSelect={() => {}}
          onOpenEditor={() => {}}
          onCloseEditor={() => {}}
          onSubmitEdit={async () => {}}
          onDismissFeedback={() => {}}
          onDismissError={() => {}}
        >
          <div>hero</div>
        </SiteBuilderPreviewSectionCanvas>,
      );
    });
    expect(container.textContent).toMatch(/needs improvement/i);
  });
});
