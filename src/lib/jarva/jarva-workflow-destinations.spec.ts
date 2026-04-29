import { describe, expect, it } from "@jest/globals";
import { resolveJarvaWorkflowDestination } from "@/lib/jarva/jarva-workflow-destinations";

const TID = "aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee";

describe("resolveJarvaWorkflowDestination", () => {
  it("maps revocable / irrevocable to trust-scoped Jarva intake when trustId exists", () => {
    const r = resolveJarvaWorkflowDestination("trust_revocable", { trustId: TID });
    expect(r.href).toBe(`/trust-records/jarva?trustId=${encodeURIComponent(TID)}`);
    expect(r.autoOpenEligible).toBe(true);

    const i = resolveJarvaWorkflowDestination("trust_irrevocable", { trustId: TID });
    expect(i.href).toContain("trust-records/jarva");
    expect(i.autoOpenEligible).toBe(true);
  });

  it("falls back conservatively without trustId for revocable / irrevocable", () => {
    const r = resolveJarvaWorkflowDestination("trust_revocable", {});
    expect(r.href).toBe("/trust-records");
    expect(r.autoOpenEligible).toBe(false);
  });

  it("maps ecclesiastical to /ecclesiastical", () => {
    const e = resolveJarvaWorkflowDestination("trust_ecclesiastical", {});
    expect(e.href).toBe("/ecclesiastical");
    expect(e.autoOpenEligible).toBe(true);
  });

  it("maps certificate and ppm to issue-security when trust-bound", () => {
    expect(resolveJarvaWorkflowDestination("trust_certificate", { trustId: TID }).href).toBe(
      `/trusts/${encodeURIComponent(TID)}/issue-security`
    );
    expect(resolveJarvaWorkflowDestination("trust_ppm", { trustId: TID }).href).toBe(
      `/trusts/${encodeURIComponent(TID)}/issue-security`
    );
  });

  it("maps bond to Trust Records bonds tab", () => {
    const b = resolveJarvaWorkflowDestination("trust_bond", { trustId: TID });
    expect(b.href).toContain("tab=bonds");
    expect(b.href).toContain("trustId=");
    expect(b.autoOpenEligible).toBe(true);
  });

  it("maps estate with trustId to estate tab; without trustId to will page", () => {
    const t = resolveJarvaWorkflowDestination("trust_estate", { trustId: TID });
    expect(t.href).toContain("tab=estate");
    expect(t.autoOpenEligible).toBe(true);

    const u = resolveJarvaWorkflowDestination("trust_estate", {});
    expect(u.href).toBe("/trust-records/estate/will");
    expect(u.autoOpenEligible).toBe(true);
  });
});
