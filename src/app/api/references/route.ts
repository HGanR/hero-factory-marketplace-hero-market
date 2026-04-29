import { NextResponse } from "next/server";
import { REFERENCE_LIBRARY } from "@/lib/references/data";

export async function GET() {
  return NextResponse.json({
    items: REFERENCE_LIBRARY,
    updatedAt: new Date().toISOString(),
  });
}
