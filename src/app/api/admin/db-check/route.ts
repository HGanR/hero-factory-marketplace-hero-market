import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { marketplaceUsers } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

function parseDbUrl(url?: string) {
  try {
    if (!url) return null;
    const u = new URL(url);
    return {
      host: u.hostname,
      port: u.port || undefined,
      database: u.pathname.replace(/^\//, "") || undefined,
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("admin-token")?.value;
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized (missing token)" }, { status: 401 });
    const decoded = verifyToken(token);
    if (!decoded?.isAdmin) return NextResponse.json({ ok: false, error: "Unauthorized (not admin)" }, { status: 401 });

    const db = await getDb();
    const [{ cnt }] = await db
      .select({ cnt: sql<number>`count(*)` })
      .from(marketplaceUsers)
      .limit(1);

    return NextResponse.json({
      ok: true,
      dbInfo: parseDbUrl(process.env.DATABASE_URL),
      marketplaceUsersCount: Number(cnt ?? 0),
    });
  } catch (err: any) {
    // Fall back to plain text if JSON fails to help debugging
    const msg = err?.message || "Unknown error";
    return new NextResponse(`db-check error: ${msg}`, { status: 500, headers: { "content-type": "text/plain" } });
  }
}

