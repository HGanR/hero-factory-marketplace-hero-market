import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeExecutiveRevenueValue,
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
});
