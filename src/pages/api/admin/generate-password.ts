import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { getDb, withDbTimeout } from "@/lib/db";
import { marketplaceUsers, adminLogs } from "@/lib/db/schema";
import { generatePassword, hashPassword } from "@/lib/auth";
import { resolveNpcAdminSessionFromCookieHeader } from "@/lib/admin/require-npc-admin";

/** Pages Router Node — `/api/admin/generate-password` (App route removed). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!(await resolveNpcAdminSessionFromCookieHeader(req.headers.cookie))) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const userId = Number(body?.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ error: "Invalid userId" });
    }

    const db = await withDbTimeout(getDb(), 5000, "getDb");

    const users = await withDbTimeout(
      db
        .select()
        .from(marketplaceUsers)
        .where(eq(marketplaceUsers.id, userId))
        .limit(1),
      5000,
      "find user for password reset"
    );

    if (users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = users[0]!;
    const password = generatePassword(12);
    const passwordHash = hashPassword(password);

    await withDbTimeout(
      db
        .update(marketplaceUsers)
        .set({
          passwordHash,
          isApproved: true,
          isActive: true,
        })
        .where(eq(marketplaceUsers.id, userId)),
      5000,
      "update user passwordHash"
    );

    await withDbTimeout(
      db.insert(adminLogs).values({
        adminId: 0,
        action: "GENERATE_PASSWORD",
        targetUserId: userId,
        targetEmail: user.email,
        details: `Generated password for ${user.email}`,
      }),
      5000,
      "insert admin log"
    );

    return res.status(200).json({
      success: true,
      password,
      message: `Password generated for ${user.email}`,
    });
  } catch (error) {
    console.error("Generate password error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    const isTimeout = /timed out after/i.test(msg);
    return res.status(isTimeout ? 503 : 500).json({
      error: isTimeout ? "Database unavailable" : "Failed to generate password",
      ...(isTimeout ? { details: msg } : {}),
    });
  }
}
