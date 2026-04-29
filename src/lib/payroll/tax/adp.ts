/**
 * ADP Embedded Payroll adapter.
 * Delegates to ADP for tax calc + filing + payments.
 * Env: ADP_CLIENT_ID, ADP_CLIENT_SECRET, ADP_BASE_URL (optional)
 */
import {
  TaxEngine,
  TaxCalculationInput,
  TaxCalculationResult,
  TaxLine,
} from "./TaxEngine";

const ADP_API_BASE = process.env.ADP_BASE_URL || "https://api.adp.com";

async function getAdpToken(): Promise<string> {
  const clientId = process.env.ADP_CLIENT_ID;
  const clientSecret = process.env.ADP_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("ADP_CLIENT_ID and ADP_CLIENT_SECRET required");
  }

  const res = await fetch(`${ADP_API_BASE}/auth/oauth/v2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ADP OAuth failed: ${err}`);
  }

  const j = (await res.json()) as { access_token?: string };
  return j.access_token || "";
}

export class ADPEmbeddedTaxEngine implements TaxEngine {
  kind = "embedded_provider" as const;

  async calculate(input: TaxCalculationInput): Promise<TaxCalculationResult> {
    const token = await getAdpToken();

    const grossCents = input.earnings.reduce((s, e) => s + e.amount.cents, 0);
    const grossDollars = grossCents / 100;

    const workerId = input.worker.workerId;
    const associateOID = process.env[`ADP_WORKER_${workerId}`] || workerId;

    const payrollPreviewRes = await fetch(
      `${ADP_API_BASE}/payroll/v1/workers/${associateOID}/pay-statement-preview`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payDate: input.payDate,
          payPeriodStart: input.periodStart,
          payPeriodEnd: input.periodEnd,
          grossPay: grossDollars,
          earnings: input.earnings.map((e) => ({
            type: e.code.toUpperCase(),
            amount: e.amount.cents / 100,
          })),
          residentState: input.worker.residentAddress?.state,
          workState: input.worker.workAddress?.state,
        }),
      }
    );

    if (!payrollPreviewRes.ok) {
      const err = await payrollPreviewRes.text();
      throw new Error(`ADP pay-statement-preview failed: ${err}`);
    }

    const preview = (await payrollPreviewRes.json()) as {
      netPay?: number;
      taxWithholdings?: Array<{
        taxType?: string;
        taxName?: string;
        amount?: number;
        jurisdiction?: string;
      }>;
    };

    const netCents = Math.round((preview.netPay ?? 0) * 100);

    const taxes: TaxLine[] = (preview.taxWithholdings ?? []).map((t) => {
      const jurisdiction =
        t.jurisdiction === "federal" || t.taxType === "federal"
          ? "federal"
          : t.jurisdiction === "state" || t.taxType === "state"
            ? "state"
            : "local";
      return {
        jurisdiction: jurisdiction as "federal" | "state" | "local",
        name: t.taxName || t.taxType || "Tax",
        amount: { cents: Math.round((t.amount ?? 0) * 100), currency: "USD" },
      };
    });

    return {
      gross: { cents: grossCents, currency: "USD" },
      taxes,
      net: { cents: netCents, currency: "USD" },
    };
  }
}
