import { NextResponse } from "next/server";

/** Stub API for Credit Foundation — replace with persistence and scoring services. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    module: "foundation",
    version: 1,
    message: "Foundation endpoint ready. POST JSON to save session snapshots later.",
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  return NextResponse.json({
    ok: true,
    module: "foundation",
    saved: false,
    received: body,
  });
}
