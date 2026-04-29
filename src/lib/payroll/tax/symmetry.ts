/**
 * Symmetry Tax Engine adapter.
 * Gross-to-net payroll tax calculation across 7,400+ US jurisdictions.
 * @see https://docs.symmetry.com/reference/compute-gross-to-net-calculations
 */
import {
  TaxEngine,
  TaxCalculationInput,
  TaxCalculationResult,
  TaxLine,
} from "./TaxEngine";

const SYMMETRY_BASE_URL =
  process.env.SYMMETRY_TAX_ENGINE_URL ||
  "https://ste-staging.symmetry.com/ste-hosted";

/** Map state abbreviation to Symmetry location code (simplified). Use full jurisdiction list in production. */
function stateToLocationCode(state: string): string {
  const FIPS: Record<string, string> = {
    AL: "01", AK: "02", AZ: "04", AR: "05", CA: "06", CO: "08", CT: "09",
    DE: "10", FL: "12", GA: "13", HI: "15", ID: "16", IL: "17", IN: "18",
    IA: "19", KS: "20", KY: "21", LA: "22", ME: "23", MD: "24", MA: "25",
    MI: "26", MN: "27", MS: "28", MO: "29", MT: "30", NE: "31", NV: "32",
    NH: "33", NJ: "34", NM: "35", NY: "36", NC: "37", ND: "38", OH: "39",
    OK: "40", OR: "41", PA: "42", RI: "44", SC: "45", SD: "46", TN: "47",
    TX: "48", UT: "49", VT: "50", VA: "51", WA: "53", WV: "54", WI: "55", WY: "56",
    DC: "11",
  };
  const fips = FIPS[state.toUpperCase()] || "00";
  return `${fips}-000-0000`;
}

export class SymmetryTaxEngine implements TaxEngine {
  kind = "symmetry" as const;

  async calculate(input: TaxCalculationInput): Promise<TaxCalculationResult> {
    const apiKey = process.env.SYMMETRY_API_KEY;
    if (!apiKey) {
      throw new Error("SYMMETRY_API_KEY is required for Symmetry Tax Engine");
    }

    const grossCents = input.earnings.reduce((s, e) => s + e.amount.cents, 0);
    const grossDollars = grossCents / 100;

    const workState = input.worker.workAddress?.state || input.worker.residentAddress?.state || "CA";
    const residentState = input.worker.residentAddress?.state || workState;
    const workLoc = stateToLocationCode(workState);
    const residentLoc = stateToLocationCode(residentState);

    const wageTypeMap: Record<string, string> = {
      regular: "Regular",
      overtime: "Overtime",
      bonus: "Supplemental",
      commission: "Supplemental",
      reimbursement: "Regular",
    };

    const wages = input.earnings.map((e) => ({
      locationCode: workLoc,
      wageType: wageTypeMap[e.code] || "Regular",
      hours: 0,
      grossWages: e.amount.cents / 100,
      mtdWages: 0,
      qtdWages: 0,
      ytdWages: 0,
    }));

    const payDate = input.payDate.split("T")[0];
    const payPeriodsPerYear = 26;

    const body = {
      PayCalcRequest: {
        payCalc: [
          {
            employeeID: input.worker.workerId,
            payrollRunParameters: {
              payDate,
              payPeriodsPerYear,
              payPeriodNumber: 1,
            },
            wages,
            taxJurisdictionParms: [],
          },
        ],
      },
    };

    const res = await fetch(`${SYMMETRY_BASE_URL}/v1/payCalc`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Symmetry API error ${res.status}: ${errText}`);
    }

    const json = (await res.json()) as {
      PayCalcResponse?: {
        payCalc?: Array<{
          employeeID: string;
          taxCalculation?: Array<{
            description: string;
            taxAmount: number;
            uniqueTaxID?: string;
            locationCode?: string;
          }>;
          errorStatus?: { errorCode: number; errorMessage: string };
        }>;
      };
    };

    const response = json.PayCalcResponse;
    const calc = response?.payCalc?.[0];
    if (!calc) {
      throw new Error("Symmetry returned no payCalc result");
    }

    if (calc.errorStatus?.errorCode !== 0 && calc.errorStatus?.errorCode != null) {
      throw new Error(calc.errorStatus.errorMessage || "Symmetry calculation failed");
    }

    const taxCalcs = calc.taxCalculation ?? [];
    let totalTaxCents = 0;
    const taxes: TaxLine[] = taxCalcs.map((t) => {
      const cents = Math.round(t.taxAmount * 100);
      totalTaxCents += cents;
      const jurisdiction =
        t.uniqueTaxID?.includes("FIT") || t.description?.toLowerCase().includes("federal")
          ? "federal"
          : t.uniqueTaxID?.startsWith("00-") || !t.locationCode
            ? "federal"
            : t.locationCode?.includes("-") && t.locationCode !== "00-000-0000"
              ? "state"
              : "local";
      return {
        jurisdiction: jurisdiction as "federal" | "state" | "local",
        name: t.description || t.uniqueTaxID || "Tax",
        amount: { cents, currency: "USD" },
        meta: { uniqueTaxID: t.uniqueTaxID, locationCode: t.locationCode },
      };
    });

    const netCents = Math.max(0, grossCents - totalTaxCents);

    return {
      gross: { cents: grossCents, currency: "USD" },
      taxes,
      net: { cents: netCents, currency: "USD" },
    };
  }
}
