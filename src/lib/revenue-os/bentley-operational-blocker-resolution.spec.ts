import {
  mergeBentleyBlockerActions,
  operationalCodesFromRows,
  resolveBentleyOperationalBlocker,
} from "@/lib/revenue-os/bentley-operational-blocker-resolution";
import { isBentleyOperationalIssueCode } from "@/lib/revenue-os/bentley-operational-blockers";

describe("resolveBentleyOperationalBlocker", () => {
  it("maps OAuth missing to assisted connect flow", () => {
    const p = resolveBentleyOperationalBlocker("launch_blocked_missing_social_account", {});
    expect(p.resolutionMode).toBe("assisted");
    expect(p.primaryActionId).toBe("connect_social_accounts");
    expect(p.allowsAutomaticRetry).toBe(false);
    expect(p.href).toContain("/revenue-os/dashboard");
    expect(p.href).toContain("campaign-launch");
  });

  it("maps provider unresolved to account selection", () => {
    const p = resolveBentleyOperationalBlocker("launch_blocked_provider_unresolved", {});
    expect(p.primaryActionId).toBe("select_social_account_on_posts");
  });

  it("maps approval pending to assisted (no auto bypass)", () => {
    const p = resolveBentleyOperationalBlocker("approval_pending_blocks_publish", {});
    expect(p.primaryActionId).toBe("complete_publish_approvals");
    expect(p.allowsAutomaticRetry).toBe(false);
  });

  it("maps publish failed to manual queue review", () => {
    const p = resolveBentleyOperationalBlocker("publish_failed_detected", {});
    expect(p.resolutionMode).toBe("manual_only");
    expect(p.primaryActionId).toBe("review_publish_queue");
  });

  it("maps launch_ready_but_publish to retry launch sync (idempotent)", () => {
    const p = resolveBentleyOperationalBlocker("launch_ready_but_publish_not_possible", {});
    expect(p.primaryActionId).toBe("retry_launch_sync");
    expect(p.allowsAutomaticRetry).toBe(true);
  });

  it("maps analytics blocked to refresh readiness", () => {
    const p = resolveBentleyOperationalBlocker("analytics_blocked_no_feedback_after_expected_window", {});
    expect(p.primaryActionId).toBe("refresh_operational_readiness");
    expect(p.allowsAutomaticRetry).toBe(true);
  });
});

describe("mergeBentleyBlockerActions", () => {
  it("dedupes by primary action and preserves priority order", () => {
    const merged = mergeBentleyBlockerActions([
      "analytics_waiting_initial_window",
      "analytics_blocked_no_feedback_after_expected_window",
      "launch_blocked_missing_social_account",
    ]);
    const ids = merged.map((m) => m.actionId);
    expect(ids[0]).toBe("connect_social_accounts");
    expect(ids).toContain("refresh_operational_readiness");
    const refresh = merged.find((m) => m.actionId === "refresh_operational_readiness");
    expect(refresh?.codes.length).toBe(2);
  });
});

describe("operationalCodesFromRows", () => {
  it("filters unknown codes", () => {
    const codes = operationalCodesFromRows([
      { code: "launch_blocked_missing_social_account", detail: "", severity: "blocked" },
      { code: "future_unknown_code", detail: "", severity: "blocked" },
    ]);
    expect(codes).toEqual(["launch_blocked_missing_social_account"]);
  });
});

describe("isBentleyOperationalIssueCode", () => {
  it("narrows string codes", () => {
    expect(isBentleyOperationalIssueCode("publish_failed_detected")).toBe(true);
    expect(isBentleyOperationalIssueCode("not_a_code")).toBe(false);
  });
});
