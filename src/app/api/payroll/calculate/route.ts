import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getTaxEngine } from "@/lib/payroll/tax";

/** Calculate gross-to-net for a worker. Uses PAYROLL_TAX_ENGINE env. */
export async function POST(req: NextRequest) {
  try {
    const userId = requireUserId(req);
    const body = await req.json().catch(() => ({}));

    const worker = body?.worker;
    const earnings = Array.isArray(body?.earnings) ? body.earnings : [];
    const payDate = typeof body?.payDate === "string" ? body.payDate : new Date().toISOString().split("T")[0];
    const periodStart = typeof body?.periodStart === "string" ? body.periodStart : payDate;
    const periodEnd = typeof body?.periodEnd === "string" ? body.periodEnd : payDate;
    const engineKind = body?.engineKind ?? process.env.PAYROLL_TAX_ENGINE ?? "manual";

    if (!worker?.workerId) {
      return NextResponse.json({ error: "worker.workerId required" }, { status: 400 });
    }

    const residentAddress = worker?.residentAddress ?? {};
    const workAddress = worker?.workAddress ?? residentAddress;

    const taxInput = {
      userId,
      payDate,
      periodStart,
      periodEnd,
      worker: {
        workerId: worker.workerId,
        type: worker.type || "employee",
        residentAddress: {
          line1: residentAddress.line1 ?? "",
          line2: residentAddress.line2,
          city: residentAddress.city ?? "",
          state: residentAddress.state ?? "CA",
          postal: residentAddress.postal ?? "",
          country: "US" as const,
        },
        workAddress: {
          line1: workAddress.line1 ?? "",
          line2: workAddress.line2,
          city: workAddress.city ?? "",
          state: workAddress.state ?? residentAddress.state ?? "CA",
          postal: workAddress.postal ?? "",
          country: "US" as const,
        },
        filingStatus: worker.filingStatus,
        allowances: worker.allowances ?? 0,
        additionalWithholdingCents: worker.additionalWithholdingCents ?? 0,
      },
      earnings: earnings.map((e: { code?: string; amount?: number }) => ({
        code: e.code || "regular",
        amount: { cents: Math.round((e.amount ?? 0) * 100), currency: "USD" as const },
      })),
    };

    if (taxInput.earnings.length === 0) {
      taxInput.earnings = [{ code: "regular", amount: { cents: 0, currency: "USD" } }];
    }

    const engine = getTaxEngine(engineKind);
    const result = await engine.calculate(taxInput);

    return NextResponse.json({
      result: {
        gross: result.gross.cents / 100,
        grossCents: result.gross.cents,
        net: result.net.cents / 100,
        netCents: result.net.cents,
        taxes: result.taxes.map((t) => ({
          jurisdiction: t.jurisdiction,
          name: t.name,
          amount: t.amount.cents / 100,
          amountCents: t.amount.cents,
        })),
      },
      engineKind: engine.kind,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("payroll calculate:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
