/**
 * Check Payroll adapter.
 * Tax calculation when previewing payroll.
 * @see https://docs.checkhq.com/docs/calculating-payroll-taxes
 * @see https://docs.checkhq.com/reference/create-payroll
 * Env: CHECK_API_KEY, CHECK_COMPANY_ID
 */
import {
  TaxEngine,
  TaxCalculationInput,
  TaxCalculationResult,
  TaxLine,
} from "./TaxEngine";

const CHECK_API_BASE = "https://api.checkhq.com";

function getCheckHeaders(): Record<string, string> {
  const key = process.env.CHECK_API_KEY;
  if (!key) throw new Error("CHECK_API_KEY required for Check Payroll");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export class CheckTaxEngine implements TaxEngine {
  kind = "embedded_provider" as const;

  async calculate(input: TaxCalculationInput): Promise<TaxCalculationResult> {
    const companyId = process.env.CHECK_COMPANY_ID;
    if (!companyId) {
      throw new Error("CHECK_COMPANY_ID required. Create a company via Check API first.");
    }

    const grossCents = input.earnings.reduce((s, e) => s + e.amount.cents, 0);
    const grossDollars = grossCents / 100;

    const employeeId = input.worker.workerId;
    const workplaceId = process.env.CHECK_WORKPLACE_ID || "default";

    const createRes = await fetch(`${CHECK_API_BASE}/v1/payrolls`, {
      method: "POST",
      headers: getCheckHeaders(),
      body: JSON.stringify({
        company: companyId,
        pay_period_start: input.periodStart,
        pay_period_end: input.periodEnd,
        pay_day: input.payDate,
        pay_run_type: "regular",
        payroll_items: [
          {
            employee: employeeId,
            payment_method: "direct_deposit",
            supplemental_tax_calc_method: "flat",
            earnings: [
              {
                amount: grossDollars.toFixed(2),
                hours: 40,
                type: "salaried",
                workplace: workplaceId,
              },
            ],
          },
        ],
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`Check create payroll failed: ${err}`);
    }

    const createJson = (await createRes.json()) as { id?: string };
    const payrollId = createJson.id;
    if (!payrollId) throw new Error("Check returned no payroll id");

    const previewRes = await fetch(
      `${CHECK_API_BASE}/v1/payrolls/${payrollId}/preview?include_items=true`,
      { headers: getCheckHeaders() }
    );

    if (!previewRes.ok) {
      const err = await previewRes.text();
      throw new Error(`Check preview payroll failed: ${err}`);
    }

    const previewJson = (await previewRes.json()) as {
      totals?: { employee_net?: string; employee_taxes?: string };
      items?: Array<{
        net_pay?: string;
        taxes?: Array<{
          description?: string;
          amount?: string;
          payer?: string;
        }>;
      }>;
    };

    const item = previewJson.items?.[0];
    const netPayStr = item?.net_pay ?? previewJson.totals?.employee_net ?? "0";
    const netCents = Math.round(parseFloat(netPayStr) * 100);

    const taxes: TaxLine[] = (item?.taxes ?? [])
      .filter((t) => t.payer === "employee")
      .map((t) => ({
        jurisdiction: t.description?.toLowerCase().includes("federal") ? "federal" : t.description?.toLowerCase().includes("state") ? "state" : "local",
        name: t.description || "Tax",
        amount: { cents: Math.round((parseFloat(t.amount ?? "0") || 0) * 100), currency: "USD" },
      }));

    return {
      gross: { cents: grossCents, currency: "USD" },
      taxes,
      net: { cents: netCents, currency: "USD" },
    };
  }
}
