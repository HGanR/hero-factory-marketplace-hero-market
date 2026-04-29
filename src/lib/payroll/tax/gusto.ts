/**
 * Gusto Embedded Payroll adapter.
 * Delegates to Gusto for tax calc + filing + payments.
 * @see https://docs.gusto.com/embedded-payroll/
 * Env: GUSTO_CLIENT_ID, GUSTO_CLIENT_SECRET, GUSTO_ACCESS_TOKEN (or OAuth flow)
 */
import {
  TaxEngine,
  TaxCalculationInput,
  TaxCalculationResult,
  TaxLine,
} from "./TaxEngine";

const GUSTO_API_BASE = "https://api.gusto.com";

async function getGustoToken(): Promise<string> {
  const token = process.env.GUSTO_ACCESS_TOKEN;
  if (token) return token;

  const clientId = process.env.GUSTO_CLIENT_ID;
  const clientSecret = process.env.GUSTO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GUSTO_CLIENT_ID and GUSTO_CLIENT_SECRET (or GUSTO_ACCESS_TOKEN) required");
  }

  const res = await fetch(`${GUSTO_API_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      // Or use grant_type: "system_access" per Gusto Embedded docs for system token
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gusto OAuth failed: ${err}`);
  }

  const j = (await res.json()) as { access_token?: string };
  return j.access_token || "";
}

export class GustoEmbeddedTaxEngine implements TaxEngine {
  kind = "embedded_provider" as const;

  async calculate(input: TaxCalculationInput): Promise<TaxCalculationResult> {
    const token = await getGustoToken();

    const grossCents = input.earnings.reduce((s, e) => s + e.amount.cents, 0);

    const companyUuid = process.env.GUSTO_COMPANY_UUID;
    if (!companyUuid) {
      throw new Error(
        "GUSTO_COMPANY_UUID required. Create a Partner Managed Company via POST /v1/partner_managed_companies"
      );
    }

    const payrollsRes = await fetch(
      `${GUSTO_API_BASE}/v1/companies/${companyUuid}/payrolls?processing_statuses=unprocessed`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!payrollsRes.ok) {
      const err = await payrollsRes.text();
      throw new Error(`Gusto payrolls fetch failed: ${err}`);
    }

    const payrollsJson = (await payrollsRes.json()) as { data?: Array<{ uuid: string }> };
    const payrollUuid = payrollsJson.data?.[0]?.uuid;

    if (!payrollUuid) {
      throw new Error(
        "No unprocessed payroll found. Gusto Embedded requires an upcoming payroll; run via their dashboard or API first."
      );
    }

    const prepareRes = await fetch(
      `${GUSTO_API_BASE}/v1/companies/${companyUuid}/payrolls/${payrollUuid}/prepare`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          version: "3.0",
          pay_schedule_uuid: process.env.GUSTO_PAY_SCHEDULE_UUID,
          compensation: [
            {
              employee_uuid: input.worker.workerId,
              gross_pay: grossCents / 100,
              net_pay: null,
              fixed_compensations: [],
              hourly_compensations: [],
            },
          ],
        }),
      }
    );

    if (!prepareRes.ok) {
      const err = await prepareRes.text();
      throw new Error(`Gusto prepare payroll failed: ${err}`);
    }

    const prepared = (await prepareRes.json()) as {
      compensations?: Array<{
        net_pay?: number;
        employee_taxes?: Array<{ name?: string; amount?: number }>;
      }>;
    };

    const comp = prepared.compensations?.[0];
    const netDollars = comp?.net_pay ?? 0;
    const netCents = Math.round(netDollars * 100);
    const employeeTaxes = comp?.employee_taxes ?? [];

    const taxes: TaxLine[] = employeeTaxes.map((t) => ({
      jurisdiction: "federal",
      name: t.name || "Tax",
      amount: { cents: Math.round((t.amount ?? 0) * 100), currency: "USD" },
    }));

    const totalTaxCents = taxes.reduce((s, t) => s + t.amount.cents, 0);

    return {
      gross: { cents: grossCents, currency: "USD" },
      taxes,
      net: { cents: netCents, currency: "USD" },
    };
  }
}
