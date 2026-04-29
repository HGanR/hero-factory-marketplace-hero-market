// Company Documents API - Placeholder for future document generation
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { verifyToken } from "@/lib/auth";

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ companyId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId } = await ctx.params;
  if (!companyId) return NextResponse.json({ error: "Missing companyId" }, { status: 400 });

  // For now, return not implemented - documents feature to be added later
  return NextResponse.json({
    error: "Document generation feature coming soon",
    message: "Company creation and management is fully functional. Document generation will be available in the next update."
  }, { status: 501 });
}