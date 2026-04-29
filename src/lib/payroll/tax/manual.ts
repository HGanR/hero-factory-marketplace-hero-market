import {
  TaxEngine,
  TaxCalculationInput,
  TaxCalculationResult,
} from "./TaxEngine";

/** Manual/estimate tax engine. Good for contractors or quick estimates. */
export class ManualTaxEngine implements TaxEngine {
  kind = "manual" as const;

  async calculate(input: TaxCalculationInput): Promise<TaxCalculationResult> {
    const grossCents = input.earnings.reduce((s, e) => s + e.amount.cents, 0);

    const state = input.worker.residentAddress?.state || "CA";
    const stateRateBps = state === "CA" ? 600 : 500;
    const fedRateBps = 800;

    const fedTax = Math.round((grossCents * fedRateBps) / 10_000);
    const stateTax = Math.round((grossCents * stateRateBps) / 10_000);

    const netCents = grossCents - fedTax - stateTax;

    return {
      gross: { cents: grossCents, currency: "USD" },
      taxes: [
        {
          jurisdiction: "federal",
          name: "Federal withholding (estimate)",
          amount: { cents: fedTax, currency: "USD" },
        },
        {
          jurisdiction: "state",
          name: `${state} withholding (estimate)`,
          amount: { cents: stateTax, currency: "USD" },
        },
      ],
      net: { cents: Math.max(0, netCents), currency: "USD" },
    };
  }
}
