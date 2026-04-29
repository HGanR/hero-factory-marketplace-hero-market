import type { NextApiRequest, NextApiResponse } from "next";
import { desc } from "drizzle-orm";
import { getDb, withDbTimeout } from "@/lib/db";
import { consultantProfiles, marketplaceUsers } from "@/lib/db/schema";
import { resolveNpcAdminSessionFromCookieHeader } from "@/lib/admin/require-npc-admin";

function asSqlBoolean(v: unknown): boolean {
  if (v === true || v === 1) return true;
  if (v === false || v === 0 || v === null || v === undefined) return false;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "1" || s === "true" || s === "yes";
  }
  return false;
}

/** Pages Router Node — same URL `/api/admin/users` as former App route (App file removed). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!(await resolveNpcAdminSessionFromCookieHeader(req.headers.cookie))) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const db = await withDbTimeout(getDb(), 5000, "getDb");

    const baseUsers = await withDbTimeout(
      db
        .select({
          id: marketplaceUsers.id,
          email: marketplaceUsers.email,
          username: marketplaceUsers.username,
          phone: marketplaceUsers.phone,
          isActive: marketplaceUsers.isActive,
          isApproved: marketplaceUsers.isApproved,
          revenueOsAccess: marketplaceUsers.revenueOsAccess,
          createdAt: marketplaceUsers.createdAt,
          walletAddress: marketplaceUsers.walletAddress,
        })
        .from(marketplaceUsers)
        .orderBy(desc(marketplaceUsers.createdAt)),
      12_000,
      "list marketplace_users"
    );

    let users = baseUsers.map((u) => ({
      id: u.id,
      email: u.email,
      username: u.username,
      phone: u.phone ?? null,
      isActive: asSqlBoolean(u.isActive),
      isApproved: asSqlBoolean(u.isApproved),
      revenueOsAccess: u.revenueOsAccess == null ? true : asSqlBoolean(u.revenueOsAccess),
      createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : String(u.createdAt),
      walletAddress: u.walletAddress ?? null,
      isConsultant: false,
      consultantSpecialty: null as string | null,
      consultantNote: null as string | null,
    }));

    try {
      const rows = await withDbTimeout(
        db
          .select({
            userId: consultantProfiles.userId,
            specialty: consultantProfiles.specialty,
            note: consultantProfiles.note,
            isActive: consultantProfiles.isActive,
          })
          .from(consultantProfiles),
        8_000,
        "list consultantProfiles"
      );

      const consultantByUser = new Map(
        rows.map((r) => [r.userId, { specialty: r.specialty, note: r.note, isActive: r.isActive }])
      );

      users = users.map((u) => {
        const c = consultantByUser.get(u.id);
        return {
          ...u,
          isConsultant: !!c && c.isActive !== false,
          consultantSpecialty: c?.specialty ?? null,
          consultantNote: c?.note ?? null,
        };
      });
    } catch {
      // consultant_profiles may not exist
    }

    return res.status(200).json({ users, count: users.length });
  } catch (error) {
    console.error("Get users error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isTimeout = /timed out after/i.test(errorMessage);
    const isUnavailable =
      isTimeout || /econn|enotfound|etimedout|getaddrinfo|database connection failed/i.test(errorMessage);
    return res.status(isUnavailable ? 503 : 500).json({
      error: isTimeout ? "Database did not respond in time" : "Failed to get users",
      details: errorMessage,
    });
  }
}
