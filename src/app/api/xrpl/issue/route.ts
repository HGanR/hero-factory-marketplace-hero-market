import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getIouIssuer, getXrplEnv } from "@/lib/xrpl";

const BodySchema = z.object({
  recipient: z.string().min(1),
  currency: z.string().min(1),
  amount: z.string().min(1),
  memo: z.string().optional(),
  memoType: z.string().optional(),
});

export async function POST(req: Request) {
  const env = getXrplEnv();
  if (!env.issuerSeed || !env.issuerAddress) {
    return NextResponse.json(
      {
        error:
          "XRPL issuer is not configured. Set XRPL_ISSUER_ADDRESS and XRPL_ISSUER_SEED (server-side).",
      },
      { status: 500 }
    );
  }

  let parsed: z.infer<typeof BodySchema>;
  try {
    const body = await req.json();
    parsed = BodySchema.parse(body);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid JSON body" },
      { status: 400 }
    );
  }

  try {
    const iouIssuer = getIouIssuer();
    const txHash = await iouIssuer.issueIOUs({
      amount: parsed.amount,
      currency: parsed.currency.toUpperCase(),
      recipient: parsed.recipient,
      memo: parsed.memo,
      memoType: parsed.memoType,
    });

    return NextResponse.json({
      txHash,
      issuer: env.issuerAddress,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "XRPL issuance failed" },
      { status: 500 }
    );
  } finally {
    // Prevent lingering websocket connections in serverless environments
    await getIouIssuer().disconnect().catch(() => {});
  }
}


