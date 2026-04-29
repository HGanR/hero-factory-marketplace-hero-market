import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { emailNotifications } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";

function requireAdmin(request: NextRequest) {
  const token = request.cookies.get("admin-token")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded?.isAdmin) return null;
  return decoded;
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(emailNotifications)
      .orderBy(desc(emailNotifications.createdAt))
      .limit(500);
    return NextResponse.json({ emails: rows });
  } catch (err) {
    console.error("admin/emails-sent GET error:", err);
    return NextResponse.json({ error: "Failed to load emails" }, { status: 500 });
  }
}
