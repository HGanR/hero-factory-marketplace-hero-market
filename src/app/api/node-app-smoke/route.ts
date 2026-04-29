import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    marker: "app-node-smoke",
    node: process.version,
    timestamp: new Date().toISOString(),
  });
}
