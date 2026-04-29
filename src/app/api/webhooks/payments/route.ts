import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const signature = req.headers.get("x-signature") || req.headers.get("stripe-signature");
  const payload = await req.json().catch(() => null);

  // TODO: verify signature against provider secret before processing.
  if (!payload) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    received: true,
    signaturePresent: Boolean(signature),
    eventType: payload?.type || "unknown",
  });
}

