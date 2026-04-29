import type { NextApiRequest, NextApiResponse } from "next";
import { getTrustRecordsUserIdFromCookieHeader } from "@/lib/api/cookie-header-auth";
import { buildTrustRecordsMeResponse } from "@/lib/trust-records/me-response";

/** Pages Router Node — `/api/trust-records/me` (App route removed). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userId = getTrustRecordsUserIdFromCookieHeader(req.headers.cookie);
  if (!userId) {
    return res.status(401).json({
      ok: false,
      error: { code: "UNAUTHENTICATED", message: "Sign in required" },
    });
  }

  const out = await buildTrustRecordsMeResponse(userId);
  return res.status(out.status).json(out.body);
}
