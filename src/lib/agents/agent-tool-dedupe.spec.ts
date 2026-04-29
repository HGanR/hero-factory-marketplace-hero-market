/**
 * Fingerprint logic must stay aligned with stableToolFingerprint in agent-tool-runtime.ts
 * (same-file duplication avoids exporting test-only helpers).
 */
function stableToolFingerprint(actionKey: string, args: unknown): string {
  const o = args && typeof args === "object" ? { ...(args as Record<string, unknown>) } : {};
  delete o.confirmed;
  const keys = Object.keys(o).sort();
  const norm: Record<string, unknown> = {};
  for (const k of keys) norm[k] = o[k];
  return `${actionKey}:${JSON.stringify(norm)}`;
}

describe("per-request duplicate tool call protection", () => {
  it("treats identical args as duplicate even when confirmed toggles", () => {
    expect(
      stableToolFingerprint("calendar.createEvent", { confirmed: true, summary: "A", startDateTime: "t0" })
    ).toBe(
      stableToolFingerprint("calendar.createEvent", { summary: "A", startDateTime: "t0", confirmed: false })
    );
  });

  it("differs when a real argument changes", () => {
    const a = stableToolFingerprint("gmail.createDraft", { confirmed: true, subject: "Hi" });
    const b = stableToolFingerprint("gmail.createDraft", { confirmed: true, subject: "Bye" });
    expect(a).not.toBe(b);
  });
});
