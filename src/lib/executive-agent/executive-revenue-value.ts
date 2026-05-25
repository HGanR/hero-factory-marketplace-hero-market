/** Derived executive revenue display — from real account counts only. */

export const EXECUTIVE_ACCOUNT_SETUP_VALUE = 155;
export const EXECUTIVE_MRR_PER_APPROVED_ACCOUNT = 20;

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
    `Here's the revenue overview, Boss. ` +
    `With ${snap.pendingAccounts} pending ${pendingWord}, potential earnings are ${formatExecutiveCurrency(snap.potentialEarnings)}. ` +
    `Approved account value from ${snap.approvedAccounts} active approved ${approvedWord} is ${formatExecutiveCurrency(snap.approvedAccountValue)}. ` +
    `Monthly recurring revenue is ${formatExecutiveCurrency(snap.monthlyRecurringRevenue)}.`
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
