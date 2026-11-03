/** Derived executive revenue display — from real account counts only. */

import { SKIPPER_CHARTER } from "@/policy/skipperCharter";
export const EXECUTIVE_ACCOUNT_SETUP_VALUE = SKIPPER_CHARTER.goal.membershipSetupUsd;
export const EXECUTIVE_MRR_PER_APPROVED_ACCOUNT = SKIPPER_CHARTER.goal.membershipMonthlyUsd;

export type ExecutiveRevenueValueSnapshot = {
  pendingAccounts: number;
  approvedAccounts: number;
  potentialEarnings: number;
  approvedAccountValue: number;
  monthlyRecurringRevenue: number;
  unavailable: boolean;
};

export function formatExecutiveCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function buildRevenueOverviewVoiceAnswer(snap: ExecutiveRevenueValueSnapshot): string {
  if (snap.unavailable) {
    return "Revenue numbers aren't available right now, Boss — I couldn't load the latest account counts.";
  }

  const pendingWord = snap.pendingAccounts === 1 ? "account" : "accounts";
  const approvedWord = snap.approvedAccounts === 1 ? "account" : "accounts";

  return (
    `Here's the modeled revenue overview, Boss. These figures are account-based display math, not verified billing or collections. ` +
    `With ${snap.pendingAccounts} pending ${pendingWord}, modeled one-time setup value is ${formatExecutiveCurrency(snap.potentialEarnings)}. ` +
    `Modeled one-time setup value from ${snap.approvedAccounts} active approved ${approvedWord} is ${formatExecutiveCurrency(snap.approvedAccountValue)}. ` +
    `Modeled monthly membership value is ${formatExecutiveCurrency(snap.monthlyRecurringRevenue)}. Setup fees do not count toward ARR.`
  );
}

export function computeExecutiveRevenueValue(input: {
  pendingAccounts: number | null | undefined;
  approvedAccounts: number | null | undefined;
  unavailable?: boolean;
}): ExecutiveRevenueValueSnapshot {
  const pendingUnavailable = input.pendingAccounts == null;
  const approvedUnavailable = input.approvedAccounts == null;
  const pending = input.pendingAccounts ?? 0;
  const approved = input.approvedAccounts ?? 0;

  return {
    pendingAccounts: pending,
    approvedAccounts: approved,
    potentialEarnings: pending * EXECUTIVE_ACCOUNT_SETUP_VALUE,
    approvedAccountValue: approved * EXECUTIVE_ACCOUNT_SETUP_VALUE,
    monthlyRecurringRevenue: approved * EXECUTIVE_MRR_PER_APPROVED_ACCOUNT,
    unavailable: Boolean(input.unavailable ?? (pendingUnavailable && approvedUnavailable)),
  };
}

