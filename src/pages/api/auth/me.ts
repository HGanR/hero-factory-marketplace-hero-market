import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { getDb, withDbTimeout } from "@/lib/db";
import { marketplaceUsers } from "@/lib/db/schema";
import { getAuthedMarketplaceUserIdFromCookieHeader } from "@/lib/api/cookie-header-auth";

/** Pages Router Node — `/api/auth/me` (App route removed). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const userId = getAuthedMarketplaceUserIdFromCookieHeader(req.headers.cookie);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const db = await withDbTimeout(getDb(), 5000, "getDb");
    const userRows = await withDbTimeout(
      db
        .select({
          id: marketplaceUsers.id,
          email: marketplaceUsers.email,
          username: marketplaceUsers.username,
        })
        .from(marketplaceUsers)
        .where(eq(marketplaceUsers.id, userId))
        .limit(1),
      5000,
      "auth/me user row"
    );

    if (userRows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userRows[0]!;
    return res.status(200).json({
      userId: user.id,
      email: user.email,
      username: user.username,
    });
  } catch (error) {
    console.error("Auth check error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    const isTimeout = /timed out after/i.test(msg);
    if (isTimeout) {
      return res.status(503).json({ error: "Database unavailable" });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
}
