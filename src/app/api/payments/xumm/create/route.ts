import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const BodySchema = z.object({
  destination: z.string().min(1),
  amountXrp: z.string().min(1), // decimal XRP
  memo: z.string().max(500).optional(),
  returnUrl: z.string().url().optional(),
});

function xrpToDrops(xrp: string): string {
  const s = (xrp || "").trim();
  if (!/^\d+(\.\d{0,6})?$/.test(s)) throw new Error("Invalid XRP amount format");
  const [i, f = ""] = s.split(".");
  const frac = (f + "0".repeat(6)).slice(0, 6);
  const drops = BigInt((i.replace(/^0+/, "") || "0") + frac);
  return drops.toString();
}

export async function POST(req: NextRequest) {
  const apiKey = (process.env.XUMM_API_KEY || "").trim();
  const apiSecret = (process.env.XUMM_API_SECRET || "").trim();
  if (!apiKey || !apiSecret) {
    return NextResponse.json(
      { error: "XUMM is not configured (set XUMM_API_KEY and XUMM_API_SECRET)." },
      { status: 500 }
    );
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid body" },
      { status: 400 }
    );
  }

  let drops: string;
  try {
    drops = xrpToDrops(body.amountXrp);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid amount" },
      { status: 400 }
    );
  }

  const payload = {
    txjson: {
      TransactionType: "Payment",
      Destination: body.destination,
      Amount: drops,
    },
    options: body.returnUrl
      ? {
          return_url: {
            app: body.returnUrl,
            web: body.returnUrl,
          },
        }
      : undefined,
    custom_meta: body.memo
      ? {
          instruction: body.memo,
        }
      : undefined,
  };

  try {
    const resp = await fetch("https://xumm.app/api/v1/platform/payload", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-API-Key": apiKey,
        "X-API-Secret": apiSecret,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const txt = await resp.text();
    const data = txt ? JSON.parse(txt) : {};
    if (!resp.ok) {
      return NextResponse.json(
        { error: data?.message || data?.error || `XUMM HTTP ${resp.status}` },
        { status: 502 }
      );
    }

    return NextResponse.json({
      uuid: data?.uuid,
      next: data?.next,
      refs: data?.refs,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to reach XUMM" },
      { status: 502 }
    );
  }
}













