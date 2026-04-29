/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { MeetDestinationsPanel } from "./MeetDestinationsPanel";
import { STREAM_DESTINATION_ENCRYPTION_NOT_CONFIGURED } from "@/lib/streaming/destinations";

describe("MeetDestinationsPanel encryption contract", () => {
  let container: HTMLDivElement;
  let root: Root;
  const origFetch = globalThis.fetch;

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    globalThis.fetch = origFetch;
    jest.clearAllMocks();
  });

  async function flushEffects() {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }

  /** Controlled React inputs ignore plain `el.value = x`; use the native setter so `onChange` sees the new value. */
  function setInputValue(el: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  const noopDelete = async () => {};
  const noopTest = async () => {};

  it("when encryptionConfigured=false: panel banner, modal warns, Save disabled", async () => {
    await act(async () => {
      root.render(
        <MeetDestinationsPanel
          destinations={[]}
          loading={false}
          onSaved={jest.fn()}
          onDelete={noopDelete}
          onTest={noopTest}
          error={null}
          encryptionConfigured={false}
        />
      );
    });

    expect(container.querySelector('[data-testid="meet-destinations-encryption-banner"]')).toBeTruthy();
    expect(container.textContent).toMatch(/STREAM_DESTINATION_ENCRYPTION_KEY/);

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="meet-destination-add-button"]')?.click();
    });

    expect(container.querySelector('[data-testid="meet-destination-modal-backdrop"]')).toBeTruthy();
    expect(container.textContent).toMatch(/Saving is disabled/);

    const saveBtn = container.querySelector<HTMLButtonElement>('[data-testid="meet-destination-save"]');
    expect(saveBtn?.disabled).toBe(true);
    expect(saveBtn?.getAttribute("title")).toMatch(/STREAM_DESTINATION_ENCRYPTION_KEY/);
  });

  it("when encryptionConfigured=true and POST returns 503: inline error in modal, modal stays open", async () => {
    globalThis.fetch = jest.fn(async (input: RequestInfo) => {
      const u = String(input);
      if (u.includes("/api/stream-destinations") && !u.match(/\/\d+/)) {
        return {
          ok: false,
          status: 503,
          json: async () => ({
            code: STREAM_DESTINATION_ENCRYPTION_NOT_CONFIGURED,
            error: "Server encryption is not configured.",
          }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    }) as typeof fetch;

    const onSaved = jest.fn();

    await act(async () => {
      root.render(
        <MeetDestinationsPanel
          destinations={[]}
          loading={false}
          onSaved={onSaved}
          onDelete={noopDelete}
          onTest={noopTest}
          error={null}
          encryptionConfigured={true}
        />
      );
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="meet-destination-add-button"]')?.click();
    });

    const keyInput = container.querySelector<HTMLInputElement>('[data-testid="meet-destination-stream-key-input"]');
    expect(keyInput).toBeTruthy();
    await act(async () => {
      setInputValue(keyInput!, "secret_stream_key_123");
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="meet-destination-save"]')?.click();
    });
    await flushEffects();

    expect(container.querySelector('[data-testid="meet-destination-save-error"]')).toBeTruthy();
    expect(container.textContent).toMatch(/server configuration issue|Encryption not configured|STREAM_DESTINATION/i);
    expect(onSaved).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="meet-destination-modal-backdrop"]')).toBeTruthy();
  });

  it("when encryptionConfigured=true and POST succeeds: modal closes and onSaved runs", async () => {
    globalThis.fetch = jest.fn(async (input: RequestInfo) => {
      const u = String(input);
      if (u.includes("/api/stream-destinations") && !u.match(/stream-destinations\/\d/)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            destination: {
              id: 1,
              platform: "twitch",
              label: "Main",
              serverUrl: "",
              streamKeyLast4: "bcde",
              orientationPreference: "auto",
              isActive: true,
              requiresManualGoLive: false,
            },
            warnings: [],
          }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    }) as typeof fetch;

    const onSaved = jest.fn();

    await act(async () => {
      root.render(
        <MeetDestinationsPanel
          destinations={[]}
          loading={false}
          onSaved={onSaved}
          onDelete={noopDelete}
          onTest={noopTest}
          error={null}
          encryptionConfigured={true}
        />
      );
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="meet-destination-add-button"]')?.click();
    });

    const keyInput = container.querySelector<HTMLInputElement>('[data-testid="meet-destination-stream-key-input"]');
    await act(async () => {
      setInputValue(keyInput!, "live_abc_xyz");
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="meet-destination-save"]')?.click();
    });
    await flushEffects();

    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="meet-destination-modal-backdrop"]')).toBeNull();
    expect(container.querySelector('[data-testid="meet-destination-save-error"]')).toBeNull();
  });
});
