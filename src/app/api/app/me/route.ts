import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const userId = requireUserId(req);
    return NextResponse.json({ userId });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
