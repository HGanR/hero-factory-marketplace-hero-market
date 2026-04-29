import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { marketplaceUsers } from "@/lib/db/schema";
import { and, eq, like, or } from "drizzle-orm";
import { requireUserId } from "@/lib/auth";

/**
 * Returns approved users (isApproved, isActive) matching the search query.
 * Used for the collaborate invite dropdown - only approved site users can be invited.
 */
export async function GET(req: NextRequest) {
  try {
    requireUserId(req);
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim().toLowerCase() || "";
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 50);

    const db = await getDb();

    if (q.length < 2) {
      return NextResponse.json({ users: [] });
    }

    const pattern = `%${q}%`;
    const rows = await db
      .select({
        id: marketplaceUsers.id,
        email: marketplaceUsers.email,
        username: marketplaceUsers.username,
      })
      .from(marketplaceUsers)
      .where(
        and(
          eq(marketplaceUsers.isApproved, true),
          eq(marketplaceUsers.isActive, true),
          or(
            like(marketplaceUsers.email, pattern),
            like(marketplaceUsers.username, pattern)
          )
        )
      )
      .limit(limit);

    const users = rows.map((r) => ({
      id: r.id,
      email: r.email,
      username: r.username,
    }));

    return NextResponse.json({ users });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("eligible-collaborators GET error:", err);
    return NextResponse.json({ error: "Failed to search users" }, { status: 500 });
  }
}
