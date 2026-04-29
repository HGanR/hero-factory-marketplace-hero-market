import { NextResponse } from "next/server";

/** Stub API for Debt Resolution — replace with case management and document delivery. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    module: "resolution",
    version: 1,
    message: "Resolution endpoint ready. POST interaction logs for compliance archive later.",
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  return NextResponse.json({
    ok: true,
    module: "resolution",
    archived: false,
    received: body,
  });
}
