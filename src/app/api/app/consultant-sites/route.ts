import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { web3Sites } from "@/lib/db/schema";

function getCurrentUser(req: NextRequest): { userId: number; isAdmin?: boolean } | null {
  const token = req.cookies.get("auth-token")?.value || req.cookies.get("admin-token")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded?.userId) return null;
  return { userId: decoded.userId as number, isAdmin: !!decoded.isAdmin };
}

/** Returns web3 sites for a consultant. Admin can query any consultant; users only their own. */
export async function GET(req: NextRequest) {
  const user = getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const consultantId = req.nextUrl.searchParams.get("consultantId");
  const cid = consultantId ? parseInt(consultantId, 10) : null;
  if (!cid || isNaN(cid)) return NextResponse.json({ error: "consultantId required" }, { status: 400 });

  if (!user.isAdmin && cid !== user.userId) {
    return NextResponse.json({ error: "Can only list your own sites" }, { status: 403 });
  }

  try {
    const db = await getDb();
    const rows = await db
      .select({ id: web3Sites.id, name: web3Sites.name, slug: web3Sites.slug, status: web3Sites.status })
      .from(web3Sites)
      .where(eq(web3Sites.userId, cid))
      .orderBy(desc(web3Sites.updatedAt));

    const sites = rows.map((r) => ({ ...r, domain: null }));
    return NextResponse.json({ sites, items: sites });
  } catch (err) {
    console.error("consultant-sites GET error:", err);
    return NextResponse.json({ error: "Failed to list sites" }, { status: 500 });
  }
}
