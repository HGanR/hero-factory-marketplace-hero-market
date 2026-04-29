/**
 * DELETE /api/admin/troo-world/agent-protocols/[id]
 * Remove an agent protocol.
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

function requireAdmin(request: NextRequest) {
  const token = request.cookies.get("admin-token")?.value;
  if (!token) throw new Error("Unauthorized");
  const decoded = verifyToken(token);
  if (!decoded?.isAdmin) throw new Error("Forbidden");
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireAdmin(request);
    await params; // id not used - stub has no persistence
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    if (msg === "Unauthorized" || msg === "Forbidden")
      return NextResponse.json({ error: msg }, { status: 401 });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
