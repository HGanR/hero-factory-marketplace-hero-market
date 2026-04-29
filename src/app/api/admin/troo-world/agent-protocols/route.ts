/**
 * Admin API for Troo World agent protocols.
 * Assigns business protocols to workers/receptionists in the world.
 * GET: list protocols
 * POST: upsert protocol
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

function requireAdmin(request: NextRequest) {
  const token = request.cookies.get("admin-token")?.value;
  if (!token) throw new Error("Unauthorized");
  const decoded = verifyToken(token);
  if (!decoded?.isAdmin) throw new Error("Forbidden");
}

// Stub: returns empty list. Add DB table (troo_world_agent_protocols) for persistence.
export async function GET(request: NextRequest) {
  try {
    requireAdmin(request);
    return NextResponse.json([]);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    requireAdmin(request);
    await request.json();
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    if (msg === "Unauthorized" || msg === "Forbidden") return NextResponse.json({ error: msg }, { status: 401 });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
