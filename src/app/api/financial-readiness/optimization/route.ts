import { NextResponse } from "next/server";

/** Stub API for Credit Optimization — replace with bureau adapters and letter vault. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    module: "optimization",
    version: 1,
    message: "Optimization endpoint ready. POST dispute payloads for async processing later.",
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  return NextResponse.json({
    ok: true,
    module: "optimization",
    queued: false,
    received: body,
  });
}
