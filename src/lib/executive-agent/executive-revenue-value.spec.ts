import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeExecutiveRevenueValue,
  buildRevenueOverviewVoiceAnswer,
  formatExecutiveCurrency,
  EXECUTIVE_ACCOUNT_SETUP_VALUE,
  EXECUTIVE_MRR_PER_APPROVED_ACCOUNT,
} from "@/lib/executive-agent/executive-revenue-value";

describe("executive-revenue-value", () => {
  it("computes revenue from real account counts", () => {
    const snap = computeExecutiveRevenueValue({ pendingAccounts: 4, approvedAccounts: 10 });
    assert.equal(snap.potentialEarnings, 4 * EXECUTIVE_ACCOUNT_SETUP_VALUE);
    assert.equal(snap.approvedAccountValue, 10 * EXECUTIVE_ACCOUNT_SETUP_VALUE);
    assert.equal(snap.monthlyRecurringRevenue, 10 * EXECUTIVE_MRR_PER_APPROVED_ACCOUNT);
    assert.equal(snap.unavailable, false);
  });

  it("marks unavailable when both counts are missing", () => {
    const snap = computeExecutiveRevenueValue({ pendingAccounts: null, approvedAccounts: null });
    assert.equal(snap.unavailable, true);
  });

  it("formats currency with commas and two decimals", () => {
    assert.equal(formatExecutiveCurrency(1550), "$1,550.00");
    assert.equal(formatExecutiveCurrency(47.5), "$47.50");
  });

  it("builds spoken revenue overview with all three figures", () => {
    const snap = computeExecutiveRevenueValue({ pendingAccounts: 4, approvedAccounts: 10 });
    const answer = buildRevenueOverviewVoiceAnswer(snap);
    assert.match(answer, /revenue overview/i);
    assert.match(answer, /\$620\.00/);
    assert.match(answer, /\$1,550\.00/);
    assert.match(answer, /\$200\.00/);
    assert.match(answer, /4 pending accounts/);
    assert.match(answer, /10 active approved accounts/);
    assert.doesNotMatch(answer, /tool/i);
  });

  it("reports unavailable revenue honestly", () => {
    const answer = buildRevenueOverviewVoiceAnswer(
      computeExecutiveRevenueValue({ pendingAccounts: null, approvedAccounts: null }),
    );
    assert.match(answer, /aren't available right now/i);
  });
});
